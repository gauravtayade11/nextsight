"""Security scanning and compliance API endpoints."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_user
from app.schemas.auth import UserInfo
from app.schemas.security import (
    ComplianceCheck,
    ImageScanResult,
    NetworkPolicyCoverage,
    PodSecurityCheck,
    RBACAnalysis,
    RemediationRequest,
    SecurityDashboardResponse,
    SecurityFinding,
    SecurityPosture,
    SecurityScore,
    SecurityTrends,
)
from app.services.security_service import SecurityService, get_security_service

router = APIRouter(prefix="/security", tags=["Security"])


@router.get("/posture", response_model=SecurityPosture)
async def get_security_posture(
    cluster_id: str = Query("default", description="Cluster ID to scan"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get complete security posture for a cluster.

    Includes:
    - Overall security score
    - Vulnerability summary
    - Security findings
    - Pod security checks
    - Compliance checks
    - Image scan results
    - Recommendations
    """
    try:
        posture = await security_service.get_security_posture(cluster_id)
        return posture
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security posture: {str(e)}")


@router.get("/dashboard", response_model=SecurityDashboardResponse)
async def get_security_dashboard(
    cluster_id: str = Query("default", description="Cluster ID"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get security dashboard summary.

    Provides a high-level overview including:
    - Security score and grade
    - Vulnerability counts by severity
    - Top critical findings
    - Compliance summary
    - Risky namespaces
    - Total images scanned
    """
    try:
        dashboard = await security_service.get_security_dashboard(cluster_id)
        return dashboard
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security dashboard: {str(e)}")


@router.get("/findings", response_model=List[SecurityFinding])
async def get_security_findings(
    cluster_id: str = Query("default", description="Cluster ID"),
    severity: Optional[str] = Query(None, description="Filter by severity: critical, high, medium, low"),
    finding_type: Optional[str] = Query(
        None, description="Filter by type: vulnerability, misconfiguration, compliance, secret, policy_violation"
    ),
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get all security findings with optional filters.

    Returns detailed list of security issues found in the cluster.
    """
    try:
        posture = await security_service.get_security_posture(cluster_id)
        findings = posture.findings

        # Apply filters
        if severity:
            findings = [f for f in findings if f.severity.value == severity.lower()]

        if finding_type:
            findings = [f for f in findings if f.type.value == finding_type.lower()]

        if namespace:
            findings = [f for f in findings if f.namespace == namespace]

        return findings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security findings: {str(e)}")


@router.post("/scan")
async def trigger_security_scan(
    cluster_id: str = Query("default", description="Cluster ID to scan"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Trigger a new security scan.

    This will scan the cluster for:
    - Security misconfigurations
    - Policy violations
    - Pod security issues
    - Compliance violations
    - Container vulnerabilities (if Trivy is available)

    Note: Full scans may take several minutes.
    """
    try:
        # Clear cache to force fresh scan
        if cluster_id in security_service.findings_cache:
            del security_service.findings_cache[cluster_id]

        # Trigger scan
        posture = await security_service.get_security_posture(cluster_id)

        return {
            "status": "completed",
            "cluster_id": cluster_id,
            "scan_time": posture.last_updated,
            "security_score": posture.security_score.score,
            "grade": posture.security_score.grade,
            "total_findings": len(posture.findings),
            "critical_issues": posture.security_score.critical_issues,
            "high_issues": posture.security_score.high_issues,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger security scan: {str(e)}")


@router.get("/score", response_model=SecurityScore)
async def get_security_score(
    cluster_id: str = Query("default", description="Cluster ID"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get security score for a cluster.

    Returns:
    - Score (0-100)
    - Letter grade (A-F)
    - Issue counts by severity
    - Last scan time
    """
    try:
        posture = await security_service.get_security_posture(cluster_id)
        return posture.security_score
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security score: {str(e)}")


@router.get("/pod-security", response_model=List[PodSecurityCheck])
async def get_pod_security_checks(
    cluster_id: str = Query("default", description="Cluster ID"),
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    min_score: Optional[int] = Query(None, description="Minimum security score (0-100)"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get pod security standard checks.

    Returns security analysis for each pod including:
    - Runs as root
    - Privileged containers
    - Host network/PID/IPC usage
    - Capabilities added
    - Read-only root filesystem
    - Security score (0-100)
    """
    try:
        checks = await security_service.check_pod_security()

        # Apply filters
        if namespace:
            checks = [c for c in checks if c.namespace == namespace]

        if min_score is not None:
            checks = [c for c in checks if c.security_score >= min_score]

        return checks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pod security checks: {str(e)}")


@router.get("/compliance", response_model=List[ComplianceCheck])
async def get_compliance_checks(
    cluster_id: str = Query("default", description="Cluster ID"),
    category: Optional[str] = Query(None, description="Filter by category"),
    passed: Optional[bool] = Query(None, description="Filter by pass/fail status"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get compliance check results.

    Returns CIS Kubernetes Benchmark style checks for:
    - API Server configuration
    - Workload isolation
    - Network segmentation
    - Resource management
    - Access controls
    """
    try:
        checks = await security_service.run_compliance_checks()

        # Apply filters
        if category:
            checks = [c for c in checks if c.category.lower() == category.lower()]

        if passed is not None:
            checks = [c for c in checks if c.passed == passed]

        return checks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get compliance checks: {str(e)}")


@router.get("/image-scans", response_model=List[ImageScanResult])
async def get_image_scan_results(
    cluster_id: str = Query("default", description="Cluster ID"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get container image vulnerability scan results.

    Requires Trivy to be installed on the system.
    Returns vulnerability counts by severity for each scanned image.
    """
    try:
        scans = await security_service.scan_container_images()
        return scans
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get image scan results: {str(e)}")


@router.post("/remediate")
async def remediate_finding(request: RemediationRequest, current_user: UserInfo = Depends(get_current_user)):
    """
    Request remediation for a security finding.

    Note: Auto-remediation is currently not implemented.
    This endpoint is reserved for future functionality.

    For now, it returns the finding details and manual remediation steps.
    """
    # This is a placeholder for future auto-remediation functionality
    return {
        "status": "manual_remediation_required",
        "finding_id": request.finding_id,
        "message": "Auto-remediation is not yet available. Please review the finding's recommendation and apply fixes manually.",
        "approved_by": request.approved_by,
    }


# ============== AI Security Assistant ==============

from pydantic import BaseModel


class AIRemediationRequest(BaseModel):
    """Request for AI-powered security remediation advice."""

    finding_type: str  # vulnerability, misconfiguration, compliance, rbac, network_policy
    severity: str
    title: str
    description: str
    resource_type: Optional[str] = None
    resource_name: Optional[str] = None
    namespace: Optional[str] = None
    cve_id: Optional[str] = None
    additional_context: Optional[str] = None


@router.post("/ai-remediate")
async def get_ai_remediation(request: AIRemediationRequest, current_user: UserInfo = Depends(get_current_user)):
    """
    Get AI-powered remediation advice for a security finding.

    Uses intelligent analysis to provide:
    - Step-by-step remediation instructions
    - YAML/kubectl commands for fixes
    - Best practices and preventive measures
    - Risk assessment and priority guidance
    """
    try:
        remediation = await _generate_ai_remediation(request)
        return remediation
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate remediation advice: {str(e)}")


async def _generate_ai_remediation(request: AIRemediationRequest) -> dict:
    """Generate intelligent remediation advice based on the security finding."""
    from app.core.config import settings

    # Try to use Google Gemini if available
    try:
        import google.generativeai as genai

        api_key = settings.GEMINI_API_KEY
        if api_key:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(settings.GEMINI_MODEL)

            prompt = f"""You are a Kubernetes security expert. Analyze this security finding and provide detailed remediation advice.

**Security Finding:**
- Type: {request.finding_type}
- Severity: {request.severity}
- Title: {request.title}
- Description: {request.description}
- Resource Type: {request.resource_type or 'N/A'}
- Resource Name: {request.resource_name or 'N/A'}
- Namespace: {request.namespace or 'N/A'}
- CVE ID: {request.cve_id or 'N/A'}
- Additional Context: {request.additional_context or 'N/A'}

Please provide:
1. **Risk Assessment**: Explain the security risk and potential impact
2. **Immediate Steps**: What to do right now to mitigate the risk
3. **Remediation Commands**: Provide exact kubectl/YAML commands to fix the issue
4. **Best Practices**: How to prevent this issue in the future
5. **Verification**: How to verify the fix was successful

Format your response in markdown with clear sections."""

            response = model.generate_content(prompt)
            return {
                "status": "success",
                "ai_powered": True,
                "finding": {
                    "type": request.finding_type,
                    "severity": request.severity,
                    "title": request.title,
                },
                "remediation": {"analysis": response.text, "generated_at": datetime.now().isoformat()},
            }
    except ImportError:
        pass  # Fall back to rule-based
    except Exception as e:
        print(f"AI remediation failed, using fallback: {e}")

    # Fallback to rule-based remediation
    return _get_rule_based_remediation(request)


def _get_rule_based_remediation(request: AIRemediationRequest) -> dict:
    """Generate rule-based remediation advice when AI is not available."""

    remediation_rules = {
        "vulnerability": {
            "critical": {
                "priority": "IMMEDIATE ACTION REQUIRED",
                "steps": [
                    "1. Identify all affected workloads using this image",
                    "2. Check if a patched version is available",
                    "3. Update the image to the fixed version",
                    "4. Roll out the deployment with the new image",
                    "5. Verify the vulnerability is resolved by re-scanning",
                ],
                "commands": [
                    "# Find pods using the vulnerable image",
                    "kubectl get pods --all-namespaces -o json | jq '.items[] | select(.spec.containers[].image | contains(\"IMAGE_NAME\"))' | jq '.metadata.name, .metadata.namespace'",
                    "",
                    "# Update deployment to use fixed image",
                    "kubectl set image deployment/DEPLOYMENT_NAME CONTAINER_NAME=NEW_IMAGE:TAG -n NAMESPACE",
                    "",
                    "# Verify rollout",
                    "kubectl rollout status deployment/DEPLOYMENT_NAME -n NAMESPACE",
                ],
                "prevention": [
                    "Implement image scanning in CI/CD pipeline",
                    "Use image policies to block vulnerable images",
                    "Enable automatic image updates for patch versions",
                    "Subscribe to security advisories for your images",
                ],
            },
            "high": {
                "priority": "HIGH - Address within 24-48 hours",
                "steps": [
                    "1. Assess the exploitability of the vulnerability",
                    "2. Check for available patches or mitigations",
                    "3. Plan and schedule the update",
                    "4. Test the update in a non-production environment",
                    "5. Deploy the fix during a maintenance window",
                ],
                "commands": [
                    "# List affected deployments",
                    "kubectl get deployments --all-namespaces -o wide",
                    "",
                    "# Check current image versions",
                    "kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}' | tr ' ' '\\n' | sort | uniq",
                ],
                "prevention": [
                    "Regularly scan images for vulnerabilities",
                    "Maintain an inventory of all container images",
                    "Set up alerts for new CVEs affecting your images",
                ],
            },
        },
        "misconfiguration": {
            "privileged_container": {
                "priority": "HIGH - Security Risk",
                "steps": [
                    "1. Review if privileged access is truly required",
                    "2. If not required, remove the privileged flag",
                    "3. If required, consider using specific capabilities instead",
                    "4. Apply Pod Security Standards/Policies",
                ],
                "commands": [
                    "# Remove privileged flag from deployment",
                    'kubectl patch deployment DEPLOYMENT_NAME -n NAMESPACE --type=json -p=\'[{"op": "remove", "path": "/spec/template/spec/containers/0/securityContext/privileged"}]\'',
                    "",
                    "# Or update with specific capabilities",
                    'kubectl patch deployment DEPLOYMENT_NAME -n NAMESPACE --type=json -p=\'[{"op": "replace", "path": "/spec/template/spec/containers/0/securityContext", "value": {"capabilities": {"drop": ["ALL"], "add": ["NET_BIND_SERVICE"]}}}]\'',
                ],
                "yaml_example": """apiVersion: v1
kind: Pod
spec:
  containers:
  - name: secure-container
    securityContext:
      privileged: false
      runAsNonRoot: true
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL""",
            },
            "root_user": {
                "priority": "MEDIUM-HIGH - Security Best Practice",
                "steps": [
                    "1. Check if the application requires root access",
                    "2. Create a non-root user in the Dockerfile",
                    "3. Update the Pod security context",
                    "4. Test the application with non-root user",
                ],
                "commands": [
                    "# Add runAsNonRoot to deployment",
                    'kubectl patch deployment DEPLOYMENT_NAME -n NAMESPACE --type=json -p=\'[{"op": "add", "path": "/spec/template/spec/securityContext", "value": {"runAsNonRoot": true, "runAsUser": 1000}}]\'',
                ],
                "yaml_example": """apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000""",
            },
        },
        "rbac": {
            "cluster_admin": {
                "priority": "CRITICAL - Over-privileged Access",
                "steps": [
                    "1. Identify who/what is using cluster-admin",
                    "2. Determine minimum required permissions",
                    "3. Create a custom Role/ClusterRole with minimal permissions",
                    "4. Update the RoleBinding/ClusterRoleBinding",
                    "5. Remove the cluster-admin binding",
                ],
                "commands": [
                    "# List cluster-admin bindings",
                    "kubectl get clusterrolebindings -o json | jq '.items[] | select(.roleRef.name==\"cluster-admin\") | {name: .metadata.name, subjects: .subjects}'",
                    "",
                    "# Delete unnecessary cluster-admin binding",
                    "kubectl delete clusterrolebinding BINDING_NAME",
                ],
                "yaml_example": """# Create a more restrictive role instead
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: limited-admin
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list", "watch"]""",
            }
        },
        "network_policy": {
            "no_policy": {
                "priority": "MEDIUM - Network Segmentation Missing",
                "steps": [
                    "1. Identify the communication patterns for the namespace",
                    "2. Create a default-deny NetworkPolicy",
                    "3. Add specific allow rules for required traffic",
                    "4. Test connectivity after applying policies",
                ],
                "commands": [
                    "# Apply default deny policy",
                    "kubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny-all\n  namespace: NAMESPACE\nspec:\n  podSelector: {}\n  policyTypes:\n  - Ingress\n  - Egress\nEOF",
                ],
                "yaml_example": """apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: your-namespace
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress""",
            }
        },
    }

    # Determine the remediation category
    finding_type = request.finding_type.lower()
    severity = request.severity.lower()
    title_lower = request.title.lower()

    # Find matching rule
    remediation_data = None

    if finding_type == "vulnerability":
        remediation_data = remediation_rules.get("vulnerability", {}).get(
            severity, remediation_rules["vulnerability"]["high"]
        )
    elif finding_type == "misconfiguration":
        if "privileged" in title_lower:
            remediation_data = remediation_rules["misconfiguration"]["privileged_container"]
        elif "root" in title_lower:
            remediation_data = remediation_rules["misconfiguration"]["root_user"]
    elif finding_type == "rbac" or "cluster-admin" in title_lower or "cluster admin" in title_lower:
        remediation_data = remediation_rules["rbac"]["cluster_admin"]
    elif finding_type == "network_policy" or "network" in title_lower:
        remediation_data = remediation_rules["network_policy"]["no_policy"]

    # Default fallback
    if not remediation_data:
        remediation_data = {
            "priority": f"{severity.upper()} - Review Required",
            "steps": [
                "1. Review the security finding details",
                "2. Assess the impact on your environment",
                "3. Research best practices for this type of issue",
                "4. Implement the recommended fix",
                "5. Verify the fix and monitor for recurrence",
            ],
            "commands": [],
            "prevention": [
                "Implement security scanning in your CI/CD pipeline",
                "Follow Kubernetes security best practices",
                "Regular security audits and reviews",
            ],
        }

    return {
        "status": "success",
        "ai_powered": False,
        "finding": {
            "type": request.finding_type,
            "severity": request.severity,
            "title": request.title,
            "resource": f"{request.resource_type}/{request.resource_name}" if request.resource_type else None,
            "namespace": request.namespace,
        },
        "remediation": {
            "priority": remediation_data.get("priority", "MEDIUM"),
            "steps": remediation_data.get("steps", []),
            "commands": remediation_data.get("commands", []),
            "yaml_example": remediation_data.get("yaml_example"),
            "prevention": remediation_data.get("prevention", []),
            "generated_at": datetime.now().isoformat(),
        },
        "note": "For more detailed AI-powered analysis, configure GOOGLE_API_KEY or GEMINI_API_KEY environment variable.",
    }


@router.get("/namespaces/risky")
async def get_risky_namespaces(
    cluster_id: str = Query("default", description="Cluster ID"),
    limit: int = Query(10, description="Number of namespaces to return"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get namespaces with the most security issues.

    Useful for identifying which namespaces need immediate attention.
    """
    try:
        dashboard = await security_service.get_security_dashboard(cluster_id)
        return {
            "risky_namespaces": dashboard.risky_namespaces[:limit],
            "total_namespaces_analyzed": len(dashboard.risky_namespaces),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get risky namespaces: {str(e)}")


@router.get("/recommendations")
async def get_security_recommendations(
    cluster_id: str = Query("default", description="Cluster ID"),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get actionable security recommendations.

    Returns prioritized list of recommendations to improve security posture.
    """
    try:
        posture = await security_service.get_security_posture(cluster_id)
        return {
            "recommendations": posture.recommendations,
            "security_score": posture.security_score.score,
            "grade": posture.security_score.grade,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")


# ============== RBAC Analysis Endpoints ==============


@router.get("/rbac", response_model=RBACAnalysis)
async def get_rbac_analysis(
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Analyze RBAC permissions for security risks.

    Returns:
    - Risky service accounts (with cluster-admin, wildcard permissions, or secrets access)
    - Risky role bindings (over-privileged bindings)
    - Cluster-admin binding count
    - Wildcard permission count
    - Recommendations for RBAC hardening
    """
    try:
        analysis = await security_service.analyze_rbac()
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze RBAC: {str(e)}")


@router.get("/rbac/summary")
async def get_rbac_summary(
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get a quick summary of RBAC security status.
    """
    try:
        analysis = await security_service.analyze_rbac()
        return {
            "total_service_accounts": analysis.total_service_accounts,
            "risky_service_accounts": analysis.risky_service_accounts,
            "total_role_bindings": analysis.total_role_bindings,
            "risky_role_bindings": analysis.risky_role_bindings,
            "cluster_admin_bindings": analysis.cluster_admin_bindings,
            "wildcard_permissions": analysis.wildcard_permissions,
            "risk_level": (
                "critical"
                if analysis.cluster_admin_bindings > 5
                else (
                    "high"
                    if analysis.cluster_admin_bindings > 2
                    else "medium" if analysis.risky_service_accounts > 5 else "low"
                )
            ),
            "recommendations": analysis.recommendations[:3],
            "analyzed_at": analysis.analyzed_at,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get RBAC summary: {str(e)}")


# ============== Network Policy Endpoints ==============


@router.get("/network-policies", response_model=NetworkPolicyCoverage)
async def get_network_policy_coverage(
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Analyze network policy coverage across namespaces.

    Returns:
    - Coverage percentage
    - Protected vs unprotected namespaces
    - Pods covered by network policies
    - Default deny policy status
    - Recommendations for improving network security
    """
    try:
        coverage = await security_service.analyze_network_policies()
        return coverage
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze network policies: {str(e)}")


@router.get("/network-policies/summary")
async def get_network_policy_summary(
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get a quick summary of network policy coverage.
    """
    try:
        coverage = await security_service.analyze_network_policies()
        return {
            "total_namespaces": coverage.total_namespaces,
            "protected_namespaces": coverage.protected_namespaces,
            "partial_namespaces": coverage.partial_namespaces,
            "unprotected_namespaces": coverage.unprotected_namespaces,
            "total_pods": coverage.total_pods,
            "covered_pods": coverage.covered_pods,
            "coverage_percentage": round(coverage.coverage_percentage, 1),
            "status": (
                "good"
                if coverage.coverage_percentage >= 80
                else "moderate" if coverage.coverage_percentage >= 50 else "poor"
            ),
            "recommendations": coverage.recommendations[:3],
            "analyzed_at": coverage.analyzed_at,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get network policy summary: {str(e)}")


# ============== Security Trends Endpoints ==============


@router.get("/trends", response_model=SecurityTrends)
async def get_security_trends(
    days: int = Query(30, description="Number of days of trend data", ge=1, le=90),
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get security trends over time.

    Returns:
    - Historical security scores
    - Vulnerability counts over time
    - Score changes (7-day and 30-day)
    - Trend direction (improving, stable, declining)
    """
    try:
        trends = await security_service.get_security_trends(days)
        return trends
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security trends: {str(e)}")


@router.get("/trends/summary")
async def get_trends_summary(
    current_user: UserInfo = Depends(get_current_user),
    security_service: SecurityService = Depends(get_security_service),
):
    """
    Get a quick summary of security trends.
    """
    try:
        trends = await security_service.get_security_trends(30)
        current_score = trends.trend_data[-1].security_score if trends.trend_data else 0
        current_vulns = trends.trend_data[-1].total_vulnerabilities if trends.trend_data else 0

        return {
            "current_score": current_score,
            "current_vulnerabilities": current_vulns,
            "score_change_7d": trends.score_change_7d,
            "score_change_30d": trends.score_change_30d,
            "vulnerabilities_fixed_7d": trends.vulnerabilities_fixed_7d,
            "vulnerabilities_new_7d": trends.vulnerabilities_new_7d,
            "trend_direction": trends.trend_direction,
            "trend_icon": (
                "arrow_up"
                if trends.trend_direction == "improving"
                else "arrow_down" if trends.trend_direction == "declining" else "minus"
            ),
            "data_points": len(trends.trend_data),
            "generated_at": trends.generated_at,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get trends summary: {str(e)}")
