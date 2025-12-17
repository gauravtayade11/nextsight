"""Security scanning and posture management service."""

import asyncio
import json
import logging
import os
import shutil
import subprocess
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from app.core.config import settings

logger = logging.getLogger(__name__)
from app.schemas.security import (  # New schemas for RBAC, Network Policies, and Trends
    ComplianceCheck,
    ImageScanResult,
    NamespaceNetworkPolicy,
    NetworkPolicyCoverage,
    NetworkPolicyStatus,
    PodSecurityCheck,
    RBACAnalysis,
    RBACRiskLevel,
    RoleBindingRisk,
    SecurityDashboardResponse,
    SecurityFinding,
    SecurityFindingType,
    SecurityPosture,
    SecurityScore,
    SecurityTrendPoint,
    SecurityTrends,
    ServiceAccountRisk,
    SeverityLevel,
    VulnerabilityDetail,
    VulnerabilitySummary,
)

# In-memory storage for security trends (in production, use a database)
_security_trends_history: List[SecurityTrendPoint] = []

# Global cache with TTL for scan results
_scan_cache: Dict[str, Tuple[Any, datetime]] = {}
_image_scan_cache: Dict[str, Tuple[ImageScanResult, datetime]] = {}
_failed_images: Dict[str, datetime] = {}  # Track images that failed to scan
CACHE_TTL_MINUTES = 5  # Cache results for 5 minutes
FAILED_IMAGE_RETRY_MINUTES = 30  # Don't retry failed images for 30 minutes

# Semaphore to limit concurrent Trivy scans
_trivy_semaphore = asyncio.Semaphore(2)  # Only 2 concurrent scans


def _find_trivy_binary() -> Optional[str]:
    """Find Trivy binary in PATH or common locations."""
    # Try shutil.which first (checks PATH)
    trivy_path = shutil.which("trivy")
    if trivy_path:
        return trivy_path

    # Check common installation locations
    common_paths = [
        "/opt/homebrew/bin/trivy",  # Homebrew on Apple Silicon
        "/usr/local/bin/trivy",  # Homebrew on Intel Mac / Linux
        "/usr/bin/trivy",  # System package manager
        os.path.expanduser("~/.local/bin/trivy"),  # User local install
    ]

    for path in common_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    return None


def _get_k8s_client() -> client.CoreV1Api:
    """Get Kubernetes CoreV1Api client."""
    try:
        if settings.K8S_IN_CLUSTER:
            config.load_incluster_config()
        elif settings.K8S_CONFIG_PATH:
            config_path = os.path.expanduser(settings.K8S_CONFIG_PATH)
            config.load_kube_config(config_file=config_path)
        else:
            config.load_kube_config()

        # Override host if needed
        if settings.K8S_HOST_OVERRIDE:
            configuration = client.Configuration.get_default_copy()
            if configuration.host:
                configuration.host = configuration.host.replace("127.0.0.1", settings.K8S_HOST_OVERRIDE).replace(
                    "localhost", settings.K8S_HOST_OVERRIDE
                )
                client.Configuration.set_default(configuration)

        return client.CoreV1Api()
    except Exception as e:
        logger.error(f"Failed to initialize Kubernetes client: {e}")
        raise


class SecurityService:
    """Service for security scanning and compliance checking."""

    def __init__(self):
        self.findings_cache: Dict[str, List[SecurityFinding]] = {}

    async def get_security_posture(self, cluster_id: str = "default") -> SecurityPosture:
        """Get complete security posture for a cluster."""
        try:
            # Run all security checks in parallel
            findings, pod_checks, compliance, image_scans = await asyncio.gather(
                self.scan_cluster_security(cluster_id),
                self.check_pod_security(),
                self.run_compliance_checks(),
                self.scan_container_images(),
                return_exceptions=True,
            )

            # Handle any exceptions from parallel execution
            findings = findings if not isinstance(findings, Exception) else []
            pod_checks = pod_checks if not isinstance(pod_checks, Exception) else []
            compliance = compliance if not isinstance(compliance, Exception) else []
            image_scans = image_scans if not isinstance(image_scans, Exception) else []

            # Calculate vulnerability summary from both findings and image scans
            vuln_summary = self._calculate_vulnerability_summary(findings, image_scans)

            # Calculate security score
            security_score = self._calculate_security_score(
                findings=findings, pod_checks=pod_checks, compliance=compliance
            )

            # Generate recommendations
            recommendations = self._generate_recommendations(findings, pod_checks)

            return SecurityPosture(
                cluster_id=cluster_id,
                security_score=security_score,
                vulnerabilities=vuln_summary,
                findings=findings,
                pod_security_checks=pod_checks,
                compliance_checks=compliance,
                image_scans=image_scans,
                recommendations=recommendations,
                last_updated=datetime.utcnow(),
            )
        except Exception as e:
            logger.error(f"Error getting security posture: {e}")
            raise

    async def scan_cluster_security(self, cluster_id: str = "default") -> List[SecurityFinding]:
        """Scan cluster for security issues."""
        findings = []

        try:
            core_v1 = _get_k8s_client()

            # Check for pods running as root
            pods = core_v1.list_pod_for_all_namespaces()
            for pod in pods.items:
                # Check security context
                if pod.spec.security_context is None or (
                    pod.spec.security_context.run_as_non_root is None or not pod.spec.security_context.run_as_non_root
                ):
                    findings.append(
                        SecurityFinding(
                            id=f"root-{pod.metadata.namespace}-{pod.metadata.name}",
                            type=SecurityFindingType.MISCONFIGURATION,
                            severity=SeverityLevel.HIGH,
                            title="Pod running as root user",
                            description=f"Pod {pod.metadata.name} is not configured to run as non-root user",
                            resource_type="pod",
                            resource_name=pod.metadata.name,
                            namespace=pod.metadata.namespace,
                            recommendation="Set securityContext.runAsNonRoot to true",
                            detected_at=datetime.utcnow(),
                            can_auto_remediate=False,
                        )
                    )

                # Check for privileged containers
                for container in pod.spec.containers or []:
                    if container.security_context and container.security_context.privileged:
                        findings.append(
                            SecurityFinding(
                                id=f"priv-{pod.metadata.namespace}-{pod.metadata.name}-{container.name}",
                                type=SecurityFindingType.MISCONFIGURATION,
                                severity=SeverityLevel.CRITICAL,
                                title="Privileged container detected",
                                description=f"Container {container.name} in pod {pod.metadata.name} is running in privileged mode",
                                resource_type="container",
                                resource_name=container.name,
                                namespace=pod.metadata.namespace,
                                recommendation="Remove privileged flag or use specific capabilities instead",
                                detected_at=datetime.utcnow(),
                                can_auto_remediate=False,
                            )
                        )

            # Check for services exposed to internet
            services = core_v1.list_service_for_all_namespaces()
            for svc in services.items:
                if svc.spec.type == "LoadBalancer":
                    findings.append(
                        SecurityFinding(
                            id=f"lb-{svc.metadata.namespace}-{svc.metadata.name}",
                            type=SecurityFindingType.POLICY_VIOLATION,
                            severity=SeverityLevel.MEDIUM,
                            title="Service exposed via LoadBalancer",
                            description=f"Service {svc.metadata.name} is exposed to the internet via LoadBalancer",
                            resource_type="service",
                            resource_name=svc.metadata.name,
                            namespace=svc.metadata.namespace,
                            recommendation="Review if internet exposure is necessary. Consider using Ingress with authentication.",
                            detected_at=datetime.utcnow(),
                            can_auto_remediate=False,
                        )
                    )

            # Check for secrets
            secrets = core_v1.list_secret_for_all_namespaces()
            for secret in secrets.items:
                # Check for old secrets (potential secret sprawl)
                if secret.metadata.creation_timestamp:
                    age_days = (
                        datetime.utcnow().replace(tzinfo=None) - secret.metadata.creation_timestamp.replace(tzinfo=None)
                    ).days
                    if age_days > 90 and secret.type != "kubernetes.io/service-account-token":
                        findings.append(
                            SecurityFinding(
                                id=f"secret-age-{secret.metadata.namespace}-{secret.metadata.name}",
                                type=SecurityFindingType.SECRET,
                                severity=SeverityLevel.LOW,
                                title="Old secret detected",
                                description=f"Secret {secret.metadata.name} is {age_days} days old",
                                resource_type="secret",
                                resource_name=secret.metadata.name,
                                namespace=secret.metadata.namespace,
                                recommendation="Review and rotate secrets regularly. Consider using external secret management.",
                                detected_at=datetime.utcnow(),
                                can_auto_remediate=False,
                            )
                        )

            # Cache findings for this cluster
            self.findings_cache[cluster_id] = findings

        except ApiException as e:
            logger.error(f"Kubernetes API error: {e}")
        except Exception as e:
            logger.error(f"Error scanning cluster security: {e}")

        return findings

    async def check_pod_security(self) -> List[PodSecurityCheck]:
        """Check pod security standards compliance."""
        checks = []

        try:
            core_v1 = _get_k8s_client()
            pods = core_v1.list_pod_for_all_namespaces()

            for pod in pods.items:
                privileged_containers = []
                capabilities_added = []
                runs_as_root = False
                host_network = bool(pod.spec.host_network)
                host_pid = bool(pod.spec.host_pid)
                host_ipc = bool(pod.spec.host_ipc)
                read_only_root_fs = True

                # Check containers
                for container in pod.spec.containers or []:
                    if container.security_context:
                        if container.security_context.privileged:
                            privileged_containers.append(container.name)
                        if container.security_context.capabilities and container.security_context.capabilities.add:
                            capabilities_added.extend(container.security_context.capabilities.add)
                        if container.security_context.read_only_root_filesystem is False:
                            read_only_root_fs = False
                        if container.security_context.run_as_user == 0:
                            runs_as_root = True

                # Calculate security score (100 = perfect)
                score = 100
                if runs_as_root:
                    score -= 20
                if privileged_containers:
                    score -= 30
                if host_network:
                    score -= 15
                if host_pid or host_ipc:
                    score -= 10
                if capabilities_added:
                    score -= 10
                if not read_only_root_fs:
                    score -= 15

                score = max(0, score)

                checks.append(
                    PodSecurityCheck(
                        pod_name=pod.metadata.name,
                        namespace=pod.metadata.namespace,
                        runs_as_root=runs_as_root,
                        privileged_containers=privileged_containers,
                        host_network=host_network,
                        host_pid=host_pid,
                        host_ipc=host_ipc,
                        capabilities_added=capabilities_added,
                        read_only_root_filesystem=read_only_root_fs,
                        security_score=score,
                    )
                )

        except Exception as e:
            logger.error(f"Error checking pod security: {e}")

        return checks

    async def run_compliance_checks(self) -> List[ComplianceCheck]:
        """Run compliance checks (CIS Kubernetes Benchmark style)."""
        checks = []

        try:
            core_v1 = _get_k8s_client()

            # Check 1: Ensure that the --anonymous-auth argument is set to false
            checks.append(
                ComplianceCheck(
                    check_id="CIS-4.2.1",
                    category="API Server",
                    description="Ensure anonymous authentication is disabled",
                    passed=True,  # Simplified - would need to check actual API server config
                    severity=SeverityLevel.HIGH,
                    remediation="Set --anonymous-auth=false in API server configuration",
                    affected_resources=[],
                )
            )

            # Check 2: Ensure default namespace is not used
            pods_in_default = core_v1.list_namespaced_pod(namespace="default")
            default_ns_passed = len(pods_in_default.items) == 0
            checks.append(
                ComplianceCheck(
                    check_id="CIS-5.7.1",
                    category="Workload Isolation",
                    description="Ensure default namespace is not used for workloads",
                    passed=default_ns_passed,
                    severity=SeverityLevel.MEDIUM,
                    remediation="Create and use specific namespaces for workloads instead of default",
                    affected_resources=[pod.metadata.name for pod in pods_in_default.items],
                )
            )

            # Check 3: Ensure network policies exist
            networking_v1 = client.NetworkingV1Api()
            try:
                policies = networking_v1.list_network_policy_for_all_namespaces()
                network_policy_passed = len(policies.items) > 0
                checks.append(
                    ComplianceCheck(
                        check_id="CIS-5.3.2",
                        category="Network Segmentation",
                        description="Ensure Network Policies are used to segment traffic",
                        passed=network_policy_passed,
                        severity=SeverityLevel.HIGH,
                        remediation="Implement NetworkPolicy resources to control pod-to-pod communication",
                        affected_resources=[],
                    )
                )
            except ApiException:
                pass

            # Check 4: Ensure ResourceQuota is enabled
            quotas = core_v1.list_resource_quota_for_all_namespaces()
            namespaces = core_v1.list_namespace()
            ns_with_quotas = set(q.metadata.namespace for q in quotas.items)
            ns_without_quotas = [
                ns.metadata.name
                for ns in namespaces.items
                if ns.metadata.name not in ns_with_quotas
                and ns.metadata.name not in ["kube-system", "kube-public", "kube-node-lease"]
            ]

            checks.append(
                ComplianceCheck(
                    check_id="CIS-5.2.1",
                    category="Resource Management",
                    description="Ensure ResourceQuotas are configured for each namespace",
                    passed=len(ns_without_quotas) == 0,
                    severity=SeverityLevel.MEDIUM,
                    remediation="Create ResourceQuota objects for each application namespace",
                    affected_resources=ns_without_quotas,
                )
            )

        except Exception as e:
            logger.error(f"Error running compliance checks: {e}")

        return checks

    async def scan_container_images(self, force_scan: bool = False) -> List[ImageScanResult]:
        """Scan container images for vulnerabilities using Trivy.

        Args:
            force_scan: If True, bypass cache and force a fresh scan
        """
        cache_key = "container_images_scan"

        # Check cache first (unless force_scan is True)
        if not force_scan and cache_key in _scan_cache:
            cached_result, cached_time = _scan_cache[cache_key]
            if datetime.utcnow() - cached_time < timedelta(minutes=CACHE_TTL_MINUTES):
                logger.debug(f"Using cached image scan results (age: {datetime.utcnow() - cached_time})")
                return cached_result

        results = []

        try:
            core_v1 = _get_k8s_client()
            pods = core_v1.list_pod_for_all_namespaces()

            # Get unique images
            images = set()
            for pod in pods.items:
                for container in pod.spec.containers or []:
                    if container.image:
                        images.add(container.image)

            # Clean up old failed images entries
            now = datetime.utcnow()
            expired_failed = [
                img
                for img, time in _failed_images.items()
                if now - time > timedelta(minutes=FAILED_IMAGE_RETRY_MINUTES)
            ]
            for img in expired_failed:
                del _failed_images[img]

            # Filter out recently failed images
            images_to_scan = [img for img in images if img not in _failed_images]

            # Check individual image cache first
            for image in list(images_to_scan)[:10]:
                if image in _image_scan_cache:
                    cached_result, cached_time = _image_scan_cache[image]
                    if datetime.utcnow() - cached_time < timedelta(minutes=CACHE_TTL_MINUTES * 2):
                        results.append(cached_result)
                        continue

                # Scan new/expired images
                try:
                    result = await self._scan_image_with_trivy(image)
                    if result:
                        results.append(result)
                        _image_scan_cache[image] = (result, datetime.utcnow())
                except Exception as e:
                    logger.error(f"Error scanning image {image}: {e}")
                    _failed_images[image] = datetime.utcnow()

            # Cache the full results
            _scan_cache[cache_key] = (results, datetime.utcnow())

        except Exception as e:
            logger.error(f"Error scanning container images: {e}")

        return results

    async def _scan_image_with_trivy(self, image: str) -> Optional[ImageScanResult]:
        """Scan a single image with Trivy."""
        # Use semaphore to limit concurrent scans
        async with _trivy_semaphore:
            try:
                # Find Trivy binary
                trivy_binary = _find_trivy_binary()
                if not trivy_binary:
                    logger.warning("Trivy not found. Install Trivy for vulnerability scanning: https://trivy.dev/")
                    return None

                logger.info(f"Scanning image {image} with Trivy at {trivy_binary}")

                # Run Trivy scan with --skip-db-update to avoid DB lock issues
                # Only update DB on the first scan
                cmd = [
                    trivy_binary,
                    "image",
                    "--format",
                    "json",
                    "--quiet",
                    "--timeout",
                    "3m",
                    "--skip-db-update",  # Avoid DB lock issues with concurrent scans
                    image,
                ]

                process = await asyncio.create_subprocess_exec(
                    *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                )

                stdout, stderr = await process.communicate()

                stderr_text = stderr.decode() if stderr else ""

                if process.returncode != 0:
                    # Check if it's an image not found error
                    if (
                        "unable to find the specified image" in stderr_text
                        or "MANIFEST_UNKNOWN" in stderr_text
                        or "No such image" in stderr_text
                    ):
                        logger.warning(f"Image not found (skipping): {image}")
                        _failed_images[image] = datetime.utcnow()
                        return None

                    # Check for DB lock issues
                    if "may be in use by another process" in stderr_text or "timeout" in stderr_text.lower():
                        logger.warning(f"Trivy DB busy, will retry later: {image}")
                        return None

                    logger.error(f"Trivy scan failed for {image}: {stderr_text}")
                    _failed_images[image] = datetime.utcnow()
                    return None

                logger.info(f"Trivy scan completed for {image}")

                # Parse Trivy output
                scan_data = json.loads(stdout.decode())

                # Count vulnerabilities by severity and extract details
                vuln_summary = VulnerabilitySummary()
                vulnerability_details = []

                for result in scan_data.get("Results", []):
                    for vuln in result.get("Vulnerabilities", []):
                        severity = vuln.get("Severity", "UNKNOWN").lower()
                        if severity == "critical":
                            vuln_summary.critical += 1
                        elif severity == "high":
                            vuln_summary.high += 1
                        elif severity == "medium":
                            vuln_summary.medium += 1
                        elif severity == "low":
                            vuln_summary.low += 1
                        else:
                            vuln_summary.unknown += 1

                        # Extract full vulnerability details
                        vuln_detail = VulnerabilityDetail(
                            vulnerability_id=vuln.get("VulnerabilityID", "UNKNOWN"),
                            pkg_name=vuln.get("PkgName", "unknown"),
                            installed_version=vuln.get("InstalledVersion", "unknown"),
                            fixed_version=vuln.get("FixedVersion"),
                            severity=(
                                SeverityLevel(severity)
                                if severity in ["critical", "high", "medium", "low", "unknown"]
                                else SeverityLevel.UNKNOWN
                            ),
                            title=vuln.get("Title"),
                            description=vuln.get("Description"),
                            cvss_score=(
                                vuln.get("CVSS", {}).get("nvd", {}).get("V3Score")
                                if isinstance(vuln.get("CVSS"), dict)
                                else None
                            ),
                            published_date=vuln.get("PublishedDate"),
                            references=vuln.get("References", [])[:5],  # Limit to first 5 references
                        )
                        vulnerability_details.append(vuln_detail)

                vuln_summary.total = (
                    vuln_summary.critical
                    + vuln_summary.high
                    + vuln_summary.medium
                    + vuln_summary.low
                    + vuln_summary.unknown
                )

                # Extract image details
                image_parts = image.split(":")
                image_name = image_parts[0]
                image_tag = image_parts[1] if len(image_parts) > 1 else "latest"

                # Get OS info if available
                os_family = None
                os_name = None
                metadata = scan_data.get("Metadata", {})
                if "OS" in metadata:
                    os_info = metadata["OS"]
                    os_family = os_info.get("Family")
                    os_name = os_info.get("Name")

                return ImageScanResult(
                    image=image_name,
                    tag=image_tag,
                    digest=None,
                    vulnerabilities=vuln_summary,
                    vulnerability_details=vulnerability_details,
                    scan_date=datetime.utcnow(),
                    os_family=os_family,
                    os_name=os_name,
                )

            except FileNotFoundError:
                logger.warning("Trivy not found. Install Trivy for vulnerability scanning: https://trivy.dev/")
                return None
            except Exception as e:
                logger.error(f"Error scanning image with Trivy: {e}")
                return None

    def _calculate_vulnerability_summary(
        self, findings: List[SecurityFinding], image_scans: List[ImageScanResult] = None
    ) -> VulnerabilitySummary:
        """Calculate vulnerability summary from findings and image scans."""
        summary = VulnerabilitySummary()

        # Count vulnerabilities from security findings
        for finding in findings:
            if finding.type == SecurityFindingType.VULNERABILITY:
                if finding.severity == SeverityLevel.CRITICAL:
                    summary.critical += 1
                elif finding.severity == SeverityLevel.HIGH:
                    summary.high += 1
                elif finding.severity == SeverityLevel.MEDIUM:
                    summary.medium += 1
                elif finding.severity == SeverityLevel.LOW:
                    summary.low += 1
                else:
                    summary.unknown += 1

        # Aggregate vulnerabilities from Trivy image scans
        if image_scans:
            for scan in image_scans:
                if scan and scan.vulnerabilities:
                    summary.critical += scan.vulnerabilities.critical
                    summary.high += scan.vulnerabilities.high
                    summary.medium += scan.vulnerabilities.medium
                    summary.low += scan.vulnerabilities.low
                    summary.unknown += scan.vulnerabilities.unknown

        summary.total = summary.critical + summary.high + summary.medium + summary.low + summary.unknown

        return summary

    def _calculate_security_score(
        self, findings: List[SecurityFinding], pod_checks: List[PodSecurityCheck], compliance: List[ComplianceCheck]
    ) -> SecurityScore:
        """
        Calculate overall security score (0-100).

        Scoring algorithm:
        - Start with 100 points
        - Deduct points for findings based on severity:
          * Critical: -10 points each
          * High: -5 points each
          * Medium: -2 points each
          * Low: -1 point each
        - Deduct points for failed compliance checks:
          * Critical: -8 points each
          * High: -4 points each
          * Medium: -2 points each
        - Average pod security scores contribute 20% of final score
        - Minimum score is 0
        """
        score = 100

        # Deduct for findings
        for finding in findings:
            if finding.severity == SeverityLevel.CRITICAL:
                score -= 10
            elif finding.severity == SeverityLevel.HIGH:
                score -= 5
            elif finding.severity == SeverityLevel.MEDIUM:
                score -= 2
            elif finding.severity == SeverityLevel.LOW:
                score -= 1

        # Deduct for failed compliance checks
        for check in compliance:
            if not check.passed:
                if check.severity == SeverityLevel.CRITICAL:
                    score -= 8
                elif check.severity == SeverityLevel.HIGH:
                    score -= 4
                elif check.severity == SeverityLevel.MEDIUM:
                    score -= 2

        # Factor in pod security scores (20% weight)
        if pod_checks:
            avg_pod_score = sum(p.security_score for p in pod_checks) / len(pod_checks)
            score = int(score * 0.8 + avg_pod_score * 0.2)

        # Ensure score is between 0 and 100
        score = max(0, min(100, score))

        # Count issues by severity
        critical_issues = sum(1 for f in findings if f.severity == SeverityLevel.CRITICAL)
        high_issues = sum(1 for f in findings if f.severity == SeverityLevel.HIGH)
        medium_issues = sum(1 for f in findings if f.severity == SeverityLevel.MEDIUM)
        low_issues = sum(1 for f in findings if f.severity == SeverityLevel.LOW)

        # Add failed compliance checks to counts
        critical_issues += sum(1 for c in compliance if not c.passed and c.severity == SeverityLevel.CRITICAL)
        high_issues += sum(1 for c in compliance if not c.passed and c.severity == SeverityLevel.HIGH)
        medium_issues += sum(1 for c in compliance if not c.passed and c.severity == SeverityLevel.MEDIUM)
        low_issues += sum(1 for c in compliance if not c.passed and c.severity == SeverityLevel.LOW)

        return SecurityScore(
            score=score,
            grade=SecurityScore.calculate_grade(score),
            total_findings=len(findings) + sum(1 for c in compliance if not c.passed),
            critical_issues=critical_issues,
            high_issues=high_issues,
            medium_issues=medium_issues,
            low_issues=low_issues,
            last_scan=datetime.utcnow(),
        )

    def _generate_recommendations(
        self, findings: List[SecurityFinding], pod_checks: List[PodSecurityCheck]
    ) -> List[str]:
        """Generate actionable security recommendations."""
        recommendations = []

        # Check for common issues
        root_pods = sum(1 for p in pod_checks if p.runs_as_root)
        privileged_pods = sum(1 for p in pod_checks if p.privileged_containers)
        host_network_pods = sum(1 for p in pod_checks if p.host_network)

        if root_pods > 0:
            recommendations.append(
                f"Configure {root_pods} pod(s) to run as non-root user by setting " "securityContext.runAsNonRoot: true"
            )

        if privileged_pods > 0:
            recommendations.append(
                f"Remove privileged mode from {privileged_pods} pod(s). " "Use specific Linux capabilities instead."
            )

        if host_network_pods > 0:
            recommendations.append(f"Disable hostNetwork on {host_network_pods} pod(s) unless absolutely necessary")

        # Check for high/critical findings
        critical_findings = [f for f in findings if f.severity == SeverityLevel.CRITICAL]
        if critical_findings:
            recommendations.append(f"Address {len(critical_findings)} critical security issue(s) immediately")

        high_findings = [f for f in findings if f.severity == SeverityLevel.HIGH]
        if high_findings:
            recommendations.append(f"Review and fix {len(high_findings)} high-severity security issue(s)")

        # General best practices
        if not recommendations:
            recommendations.append("Your cluster security posture is good! Continue monitoring for new threats.")
        else:
            recommendations.append("Implement Pod Security Standards (PSS) to enforce security policies cluster-wide")
            recommendations.append("Enable audit logging to track security-relevant events")
            recommendations.append("Regularly scan container images for vulnerabilities before deployment")

        return recommendations[:5]  # Return top 5 recommendations

    async def get_security_dashboard(self, cluster_id: str = "default") -> SecurityDashboardResponse:
        """Get security dashboard summary."""
        posture = await self.get_security_posture(cluster_id)

        # Get top 10 most critical findings
        top_findings = sorted(
            posture.findings,
            key=lambda f: (
                ["low", "medium", "high", "critical"].index(f.severity.value)
                if f.severity.value in ["low", "medium", "high", "critical"]
                else 0
            ),
            reverse=True,
        )[:10]

        # Calculate compliance summary
        compliance_summary = {
            "passed": sum(1 for c in posture.compliance_checks if c.passed),
            "failed": sum(1 for c in posture.compliance_checks if not c.passed),
            "total": len(posture.compliance_checks),
        }

        # Find risky namespaces (namespaces with most security issues)
        namespace_issues: Dict[str, int] = {}
        for finding in posture.findings:
            namespace_issues[finding.namespace] = namespace_issues.get(finding.namespace, 0) + 1

        risky_namespaces = sorted(namespace_issues.items(), key=lambda x: x[1], reverse=True)[:5]

        return SecurityDashboardResponse(
            security_score=posture.security_score,
            vulnerability_summary=posture.vulnerabilities,
            top_findings=top_findings,
            compliance_summary=compliance_summary,
            risky_namespaces=[ns for ns, _ in risky_namespaces],
            total_images_scanned=len(posture.image_scans),
            last_scan=posture.last_updated,
        )

    # ============== RBAC Analysis ==============

    async def analyze_rbac(self) -> RBACAnalysis:
        """Analyze RBAC permissions for security risks."""
        service_account_risks = []
        role_binding_risks = []
        recommendations = []

        try:
            core_v1 = _get_k8s_client()
            rbac_v1 = client.RbacAuthorizationV1Api()

            # Get all service accounts
            service_accounts = core_v1.list_service_account_for_all_namespaces()

            # Get all role bindings and cluster role bindings
            role_bindings = rbac_v1.list_role_binding_for_all_namespaces()
            cluster_role_bindings = rbac_v1.list_cluster_role_binding()

            # Get all cluster roles and roles for analysis
            cluster_roles = rbac_v1.list_cluster_role()
            roles = rbac_v1.list_role_for_all_namespaces()

            # Build a map of role/clusterrole to their rules
            role_rules = {}
            for role in roles.items:
                key = f"Role/{role.metadata.namespace}/{role.metadata.name}"
                role_rules[key] = role.rules or []
            for crole in cluster_roles.items:
                key = f"ClusterRole/{crole.metadata.name}"
                role_rules[key] = crole.rules or []

            # Analyze cluster role bindings
            cluster_admin_count = 0
            wildcard_count = 0

            for binding in cluster_role_bindings.items:
                issues = []
                risk_level = RBACRiskLevel.INFO
                is_cluster_admin = False
                grants_secrets = False
                grants_wildcard = False

                role_ref = binding.role_ref
                role_key = f"{role_ref.kind}/{role_ref.name}"

                # Check if it grants cluster-admin
                if role_ref.name == "cluster-admin":
                    is_cluster_admin = True
                    cluster_admin_count += 1
                    risk_level = RBACRiskLevel.CRITICAL
                    issues.append("Grants cluster-admin privileges")

                # Check role rules for risky permissions
                rules = role_rules.get(role_key, [])
                for rule in rules:
                    resources = rule.resources or []
                    verbs = rule.verbs or []

                    # Check for wildcard permissions
                    if "*" in resources or "*" in verbs:
                        grants_wildcard = True
                        wildcard_count += 1
                        if risk_level != RBACRiskLevel.CRITICAL:
                            risk_level = RBACRiskLevel.HIGH
                        issues.append("Uses wildcard (*) permissions")

                    # Check for secrets access
                    if "secrets" in resources:
                        grants_secrets = True
                        if risk_level not in [RBACRiskLevel.CRITICAL, RBACRiskLevel.HIGH]:
                            risk_level = RBACRiskLevel.MEDIUM
                        issues.append("Grants access to secrets")

                # Build subjects list
                subjects = []
                for subj in binding.subjects or []:
                    subjects.append({"kind": subj.kind, "name": subj.name, "namespace": subj.namespace or ""})

                if issues:  # Only add risky bindings
                    role_binding_risks.append(
                        RoleBindingRisk(
                            name=binding.metadata.name,
                            namespace=None,
                            binding_type="ClusterRoleBinding",
                            role_name=role_ref.name,
                            role_kind=role_ref.kind,
                            subjects=subjects,
                            risk_level=risk_level,
                            issues=issues,
                            is_cluster_admin=is_cluster_admin,
                            grants_secrets_access=grants_secrets,
                            grants_wildcard=grants_wildcard,
                        )
                    )

            # Analyze role bindings
            for binding in role_bindings.items:
                issues = []
                risk_level = RBACRiskLevel.INFO
                is_cluster_admin = False
                grants_secrets = False
                grants_wildcard = False

                role_ref = binding.role_ref
                if role_ref.kind == "ClusterRole":
                    role_key = f"ClusterRole/{role_ref.name}"
                else:
                    role_key = f"Role/{binding.metadata.namespace}/{role_ref.name}"

                # Check if it references cluster-admin
                if role_ref.name == "cluster-admin":
                    is_cluster_admin = True
                    cluster_admin_count += 1
                    risk_level = RBACRiskLevel.CRITICAL
                    issues.append("References cluster-admin ClusterRole")

                # Check role rules
                rules = role_rules.get(role_key, [])
                for rule in rules:
                    resources = rule.resources or []
                    verbs = rule.verbs or []

                    if "*" in resources or "*" in verbs:
                        grants_wildcard = True
                        if risk_level != RBACRiskLevel.CRITICAL:
                            risk_level = RBACRiskLevel.HIGH
                        if "Uses wildcard (*) permissions" not in issues:
                            issues.append("Uses wildcard (*) permissions")

                    if "secrets" in resources:
                        grants_secrets = True
                        if risk_level not in [RBACRiskLevel.CRITICAL, RBACRiskLevel.HIGH]:
                            risk_level = RBACRiskLevel.MEDIUM
                        if "Grants access to secrets" not in issues:
                            issues.append("Grants access to secrets")

                subjects = []
                for subj in binding.subjects or []:
                    subjects.append({"kind": subj.kind, "name": subj.name, "namespace": subj.namespace or ""})

                if issues:
                    role_binding_risks.append(
                        RoleBindingRisk(
                            name=binding.metadata.name,
                            namespace=binding.metadata.namespace,
                            binding_type="RoleBinding",
                            role_name=role_ref.name,
                            role_kind=role_ref.kind,
                            subjects=subjects,
                            risk_level=risk_level,
                            issues=issues,
                            is_cluster_admin=is_cluster_admin,
                            grants_secrets_access=grants_secrets,
                            grants_wildcard=grants_wildcard,
                        )
                    )

            # Analyze service accounts
            pods = core_v1.list_pod_for_all_namespaces()
            sa_pods: Dict[str, List[str]] = {}

            for pod in pods.items:
                sa_name = pod.spec.service_account_name or "default"
                sa_key = f"{pod.metadata.namespace}/{sa_name}"
                if sa_key not in sa_pods:
                    sa_pods[sa_key] = []
                sa_pods[sa_key].append(pod.metadata.name)

            for sa in service_accounts.items:
                sa_key = f"{sa.metadata.namespace}/{sa.metadata.name}"
                issues = []
                risk_level = RBACRiskLevel.INFO
                has_cluster_admin = False
                has_secrets_access = False
                has_wildcard = False
                bound_roles = []

                # Check bindings for this service account
                for rb in role_binding_risks:
                    for subj in rb.subjects:
                        if (
                            subj["kind"] == "ServiceAccount"
                            and subj["name"] == sa.metadata.name
                            and (subj["namespace"] == sa.metadata.namespace or not subj["namespace"])
                        ):
                            bound_roles.append(rb.role_name)
                            if rb.is_cluster_admin:
                                has_cluster_admin = True
                                risk_level = RBACRiskLevel.CRITICAL
                                if "Has cluster-admin binding" not in issues:
                                    issues.append("Has cluster-admin binding")
                            if rb.grants_wildcard:
                                has_wildcard = True
                                if risk_level != RBACRiskLevel.CRITICAL:
                                    risk_level = RBACRiskLevel.HIGH
                                if "Has wildcard permissions" not in issues:
                                    issues.append("Has wildcard permissions")
                            if rb.grants_secrets_access:
                                has_secrets_access = True
                                if risk_level not in [RBACRiskLevel.CRITICAL, RBACRiskLevel.HIGH]:
                                    risk_level = RBACRiskLevel.MEDIUM
                                if "Can access secrets" not in issues:
                                    issues.append("Can access secrets")

                if issues:
                    service_account_risks.append(
                        ServiceAccountRisk(
                            name=sa.metadata.name,
                            namespace=sa.metadata.namespace,
                            risk_level=risk_level,
                            issues=issues,
                            has_cluster_admin=has_cluster_admin,
                            has_secrets_access=has_secrets_access,
                            has_wildcard_permissions=has_wildcard,
                            bound_roles=list(set(bound_roles)),
                            pods_using=sa_pods.get(sa_key, [])[:10],
                        )
                    )

            # Generate recommendations
            if cluster_admin_count > 0:
                recommendations.append(
                    f"Review {cluster_admin_count} cluster-admin binding(s). " "Consider using more restrictive roles."
                )
            if wildcard_count > 0:
                recommendations.append(f"Replace {wildcard_count} wildcard permission(s) with specific resources.")
            if len([r for r in role_binding_risks if r.grants_secrets_access]) > 0:
                recommendations.append(
                    "Audit service accounts with secrets access and apply least-privilege principle."
                )
            if not recommendations:
                recommendations.append("RBAC configuration follows security best practices.")

        except Exception as e:
            logger.error(f"Error analyzing RBAC: {e}")
            recommendations.append(f"Error during RBAC analysis: {str(e)}")

        return RBACAnalysis(
            total_service_accounts=len(service_accounts.items) if "service_accounts" in dir() else 0,
            risky_service_accounts=len(service_account_risks),
            total_role_bindings=(len(role_bindings.items) if "role_bindings" in dir() else 0)
            + (len(cluster_role_bindings.items) if "cluster_role_bindings" in dir() else 0),
            risky_role_bindings=len(role_binding_risks),
            cluster_admin_bindings=cluster_admin_count,
            wildcard_permissions=wildcard_count,
            service_account_risks=service_account_risks,
            role_binding_risks=role_binding_risks,
            recommendations=recommendations[:5],
            analyzed_at=datetime.utcnow(),
        )

    # ============== Network Policy Analysis ==============

    async def analyze_network_policies(self) -> NetworkPolicyCoverage:
        """Analyze network policy coverage across namespaces."""
        namespace_policies = []
        recommendations = []

        try:
            core_v1 = _get_k8s_client()
            networking_v1 = client.NetworkingV1Api()

            # Get all namespaces
            namespaces = core_v1.list_namespace()

            # Get all network policies
            all_policies = networking_v1.list_network_policy_for_all_namespaces()

            # Group policies by namespace
            policies_by_ns: Dict[str, List] = {}
            for policy in all_policies.items:
                ns = policy.metadata.namespace
                if ns not in policies_by_ns:
                    policies_by_ns[ns] = []
                policies_by_ns[ns].append(policy)

            total_pods = 0
            covered_pods = 0
            protected_count = 0
            partial_count = 0
            unprotected_count = 0

            for ns in namespaces.items:
                ns_name = ns.metadata.name

                # Skip system namespaces
                if ns_name in ["kube-system", "kube-public", "kube-node-lease"]:
                    continue

                # Get pods in namespace
                pods = core_v1.list_namespaced_pod(ns_name)
                pod_names = [p.metadata.name for p in pods.items]
                ns_pod_count = len(pod_names)
                total_pods += ns_pod_count

                # Get policies for this namespace
                ns_policies = policies_by_ns.get(ns_name, [])
                policy_names = [p.metadata.name for p in ns_policies]

                if not ns_policies:
                    # No policies - unprotected
                    status = NetworkPolicyStatus.UNPROTECTED
                    unprotected_count += 1
                    pods_covered = 0
                    pods_uncovered = pod_names[:10]
                    has_default_deny_ingress = False
                    has_default_deny_egress = False
                else:
                    # Check for default deny policies
                    has_default_deny_ingress = False
                    has_default_deny_egress = False
                    covered_pod_set = set()

                    for policy in ns_policies:
                        spec = policy.spec

                        # Check for default deny (empty pod selector = all pods)
                        is_default = not spec.pod_selector.match_labels if spec.pod_selector else True

                        if is_default:
                            if spec.policy_types:
                                if "Ingress" in spec.policy_types and not spec.ingress:
                                    has_default_deny_ingress = True
                                if "Egress" in spec.policy_types and not spec.egress:
                                    has_default_deny_egress = True

                        # Track which pods are covered by this policy
                        if spec.pod_selector and spec.pod_selector.match_labels:
                            # Policy targets specific pods
                            for pod in pods.items:
                                pod_labels = pod.metadata.labels or {}
                                match = all(pod_labels.get(k) == v for k, v in spec.pod_selector.match_labels.items())
                                if match:
                                    covered_pod_set.add(pod.metadata.name)
                        else:
                            # Default policy covers all pods
                            covered_pod_set = set(pod_names)

                    pods_covered_count = len(covered_pod_set)
                    covered_pods += pods_covered_count
                    pods_uncovered = [p for p in pod_names if p not in covered_pod_set][:10]

                    if pods_covered_count == ns_pod_count and (has_default_deny_ingress or has_default_deny_egress):
                        status = NetworkPolicyStatus.PROTECTED
                        protected_count += 1
                    elif pods_covered_count > 0:
                        status = NetworkPolicyStatus.PARTIAL
                        partial_count += 1
                    else:
                        status = NetworkPolicyStatus.UNPROTECTED
                        unprotected_count += 1

                    pods_covered = pods_covered_count

                namespace_policies.append(
                    NamespaceNetworkPolicy(
                        namespace=ns_name,
                        status=status,
                        policy_count=len(ns_policies),
                        policies=policy_names,
                        pods_total=ns_pod_count,
                        pods_covered=pods_covered,
                        pods_uncovered=pods_uncovered,
                        has_default_deny_ingress=has_default_deny_ingress,
                        has_default_deny_egress=has_default_deny_egress,
                    )
                )

            # Calculate coverage percentage
            coverage_pct = (covered_pods / total_pods * 100) if total_pods > 0 else 0

            # Generate recommendations
            if unprotected_count > 0:
                recommendations.append(f"Add network policies to {unprotected_count} unprotected namespace(s)")
            if not any(np.has_default_deny_ingress for np in namespace_policies):
                recommendations.append("Implement default-deny ingress policies for zero-trust networking")
            if partial_count > 0:
                recommendations.append(
                    f"Extend network policy coverage in {partial_count} partially protected namespace(s)"
                )
            if coverage_pct < 80:
                recommendations.append(f"Current coverage is {coverage_pct:.1f}%. Aim for >80% pod coverage.")
            if not recommendations:
                recommendations.append("Network policy coverage is excellent!")

        except Exception as e:
            logger.error(f"Error analyzing network policies: {e}")
            recommendations.append(f"Error during analysis: {str(e)}")

        return NetworkPolicyCoverage(
            total_namespaces=len(namespace_policies),
            protected_namespaces=protected_count,
            partial_namespaces=partial_count,
            unprotected_namespaces=unprotected_count,
            total_pods=total_pods,
            covered_pods=covered_pods,
            coverage_percentage=coverage_pct,
            namespaces=namespace_policies,
            recommendations=recommendations[:5],
            analyzed_at=datetime.utcnow(),
        )

    # ============== Security Trends ==============

    async def record_security_snapshot(self, posture: SecurityPosture) -> None:
        """Record a security snapshot for trend tracking."""
        global _security_trends_history

        snapshot = SecurityTrendPoint(
            timestamp=datetime.utcnow(),
            security_score=posture.security_score.score,
            critical_count=posture.vulnerabilities.critical,
            high_count=posture.vulnerabilities.high,
            medium_count=posture.vulnerabilities.medium,
            low_count=posture.vulnerabilities.low,
            total_vulnerabilities=posture.vulnerabilities.total,
            images_scanned=len(posture.image_scans),
        )

        _security_trends_history.append(snapshot)

        # Keep only last 30 days of data (assuming hourly snapshots max)
        max_entries = 24 * 30  # 720 entries
        if len(_security_trends_history) > max_entries:
            _security_trends_history = _security_trends_history[-max_entries:]

    async def get_security_trends(self, days: int = 30) -> SecurityTrends:
        """Get security trends over time."""
        from datetime import timedelta

        now = datetime.utcnow()
        cutoff = now - timedelta(days=days)

        # Filter to requested time range
        filtered_data = [point for point in _security_trends_history if point.timestamp >= cutoff]

        # If no historical data, create a baseline from current state
        if not filtered_data:
            try:
                posture = await self.get_security_posture()
                await self.record_security_snapshot(posture)
                filtered_data = _security_trends_history[-1:]
            except Exception:
                pass

        # Calculate changes
        score_change_7d = 0
        score_change_30d = 0
        vulns_fixed_7d = 0
        vulns_new_7d = 0
        trend_direction = "stable"

        if len(filtered_data) >= 2:
            current = filtered_data[-1]

            # Find data point closest to 7 days ago
            seven_days_ago = now - timedelta(days=7)
            point_7d = min(filtered_data, key=lambda x: abs((x.timestamp - seven_days_ago).total_seconds()))

            # Find data point closest to 30 days ago
            thirty_days_ago = now - timedelta(days=30)
            point_30d = min(filtered_data, key=lambda x: abs((x.timestamp - thirty_days_ago).total_seconds()))

            score_change_7d = current.security_score - point_7d.security_score
            score_change_30d = current.security_score - point_30d.security_score

            # Estimate vulnerabilities fixed/new
            vuln_diff_7d = current.total_vulnerabilities - point_7d.total_vulnerabilities
            if vuln_diff_7d < 0:
                vulns_fixed_7d = abs(vuln_diff_7d)
            else:
                vulns_new_7d = vuln_diff_7d

            # Determine trend direction
            if score_change_7d > 5:
                trend_direction = "improving"
            elif score_change_7d < -5:
                trend_direction = "declining"

        return SecurityTrends(
            trend_data=filtered_data,
            score_change_7d=score_change_7d,
            score_change_30d=score_change_30d,
            vulnerabilities_fixed_7d=vulns_fixed_7d,
            vulnerabilities_new_7d=vulns_new_7d,
            trend_direction=trend_direction,
            generated_at=now,
        )


# Singleton instance
_security_service = SecurityService()


def get_security_service() -> SecurityService:
    """Get security service instance."""
    return _security_service
