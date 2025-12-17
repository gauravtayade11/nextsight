"""
Helm service for managing Helm chart deployments.
Executes Helm CLI commands via subprocess and parses output.
"""

import asyncio
import json
import logging
import re
import subprocess
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import yaml

from app.schemas.helm import (
    ChartInfo,
    ChartSearchResult,
    HelmOperationResult,
    InstallRequest,
    ReleaseHistory,
    ReleaseInfo,
    ReleaseStatus,
    ReleaseValues,
    Repository,
    RollbackRequest,
    UninstallRequest,
    UpgradeRequest,
)

logger = logging.getLogger(__name__)


class HelmService:
    """Service for managing Helm deployments."""

    def __init__(self, kubeconfig: Optional[str] = None, context: Optional[str] = None):
        """
        Initialize Helm service.

        Args:
            kubeconfig: Path to kubeconfig file (uses default if not provided)
            context: Kubernetes context to use
        """
        self.kubeconfig = kubeconfig
        self.context = context
        self._default_repositories = [
            Repository(name="bitnami", url="https://charts.bitnami.com/bitnami"),
            Repository(name="stable", url="https://charts.helm.sh/stable"),
            Repository(name="prometheus-community", url="https://prometheus-community.github.io/helm-charts"),
            Repository(name="grafana", url="https://grafana.github.io/helm-charts"),
            Repository(name="jetstack", url="https://charts.jetstack.io"),
            Repository(name="ingress-nginx", url="https://kubernetes.github.io/ingress-nginx"),
        ]

    def _build_base_cmd(self) -> List[str]:
        """Build base helm command with common flags."""
        cmd = ["helm"]
        if self.kubeconfig:
            cmd.extend(["--kubeconfig", self.kubeconfig])
        if self.context:
            cmd.extend(["--kube-context", self.context])
        return cmd

    async def _run_helm_cmd(self, args: List[str], timeout: int = 300) -> Tuple[bool, str, str]:
        """
        Run a helm command asynchronously.

        Returns:
            Tuple of (success, stdout, stderr)
        """
        cmd = self._build_base_cmd() + args
        logger.debug(f"Running helm command: {' '.join(cmd)}")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)

            success = process.returncode == 0
            return success, stdout.decode(), stderr.decode()
        except asyncio.TimeoutError:
            return False, "", f"Command timed out after {timeout} seconds"
        except Exception as e:
            logger.error(f"Helm command failed: {e}")
            return False, "", str(e)

    def _run_helm_cmd_sync(self, args: List[str], timeout: int = 300) -> Tuple[bool, str, str]:
        """
        Run a helm command synchronously (for non-async contexts).
        """
        cmd = self._build_base_cmd() + args
        logger.debug(f"Running helm command: {' '.join(cmd)}")

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            success = result.returncode == 0
            return success, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return False, "", f"Command timed out after {timeout} seconds"
        except Exception as e:
            logger.error(f"Helm command failed: {e}")
            return False, "", str(e)

    def _parse_release_status(self, status: str) -> ReleaseStatus:
        """Parse release status string to enum."""
        status_map = {
            "deployed": ReleaseStatus.DEPLOYED,
            "failed": ReleaseStatus.FAILED,
            "pending-install": ReleaseStatus.PENDING_INSTALL,
            "pending-upgrade": ReleaseStatus.PENDING_UPGRADE,
            "pending-rollback": ReleaseStatus.PENDING_ROLLBACK,
            "uninstalling": ReleaseStatus.UNINSTALLING,
            "superseded": ReleaseStatus.SUPERSEDED,
        }
        return status_map.get(status.lower(), ReleaseStatus.UNKNOWN)

    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """Parse datetime string from helm output."""
        if not dt_str:
            return None
        try:
            # Helm outputs datetime in various formats
            for fmt in [
                "%Y-%m-%d %H:%M:%S.%f %z %Z",
                "%Y-%m-%d %H:%M:%S %z %Z",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d %H:%M:%S.%f",
                "%Y-%m-%d %H:%M:%S",
            ]:
                try:
                    return datetime.strptime(dt_str.strip(), fmt)
                except ValueError:
                    continue
            # Try ISO format as fallback
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except Exception:
            return None

    async def list_releases(self, namespace: Optional[str] = None, all_namespaces: bool = True) -> List[ReleaseInfo]:
        """
        List all Helm releases.

        Args:
            namespace: Filter by namespace
            all_namespaces: List releases in all namespaces
        """
        args = ["list", "-o", "json"]

        if all_namespaces:
            args.append("--all-namespaces")
        elif namespace:
            args.extend(["--namespace", namespace])

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to list releases: {stderr}")
            return []

        try:
            releases_data = json.loads(stdout) if stdout.strip() else []
            releases = []

            for r in releases_data:
                # Parse chart name and version from chart field (e.g., "nginx-15.0.0")
                chart_full = r.get("chart", "")
                chart_parts = chart_full.rsplit("-", 1)
                chart_name = chart_parts[0] if chart_parts else chart_full
                chart_version = chart_parts[1] if len(chart_parts) > 1 else ""

                releases.append(
                    ReleaseInfo(
                        name=r.get("name", ""),
                        namespace=r.get("namespace", "default"),
                        revision=r.get("revision", 1),
                        status=self._parse_release_status(r.get("status", "")),
                        chart=chart_name,
                        chart_version=chart_version,
                        app_version=r.get("app_version"),
                        updated=self._parse_datetime(r.get("updated", "")),
                    )
                )

            return releases
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse releases JSON: {e}")
            return []

    async def get_release(self, name: str, namespace: str = "default") -> Optional[ReleaseInfo]:
        """Get details of a specific release."""
        # First, get chart metadata from helm list (more reliable)
        list_args = ["list", "-n", namespace, "-o", "json"]
        list_success, list_stdout, list_stderr = await self._run_helm_cmd(list_args)

        chart_name = ""
        chart_version = ""
        app_version = None

        if list_success and list_stdout.strip():
            try:
                releases = json.loads(list_stdout)
                # Find the release by name
                release_data = next((r for r in releases if r.get("name") == name), None)
                if release_data:
                    # Parse chart field (format: "chart-name-version")
                    chart_full = release_data.get("chart", "")
                    if chart_full:
                        # Split chart name and version (e.g., "argo-cd-9.1.6" -> "argo-cd", "9.1.6")
                        # Handle cases where chart name might contain hyphens
                        parts = chart_full.rsplit("-", 2)  # Split from right, max 2 splits
                        if len(parts) >= 2:
                            # Check if the last part looks like a version (contains digits)
                            if any(c.isdigit() for c in parts[-1]):
                                chart_version = parts[-1]
                                chart_name = "-".join(parts[:-1])
                            else:
                                chart_name = chart_full
                        else:
                            chart_name = chart_full

                    app_version = release_data.get("app_version")
                    logger.info(f"[get_release] Extracted from helm list - chart: '{chart_name}', version: '{chart_version}'")
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse helm list JSON: {e}")

        # Then get detailed status information
        args = ["status", name, "-n", namespace, "-o", "json"]

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to get release {name}: {stderr}")
            return None

        try:
            data = json.loads(stdout)
            info = data.get("info", {})

            return ReleaseInfo(
                name=data.get("name", name),
                namespace=data.get("namespace", namespace),
                revision=data.get("version", 1),
                status=self._parse_release_status(info.get("status", "")),
                chart=chart_name,
                chart_version=chart_version,
                app_version=app_version,
                updated=self._parse_datetime(info.get("last_deployed", "")),
                description=info.get("description"),
            )
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse release JSON: {e}")
            return None

    async def get_release_history(self, name: str, namespace: str = "default") -> List[ReleaseHistory]:
        """Get revision history for a release."""
        args = ["history", name, "-n", namespace, "-o", "json"]

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to get release history: {stderr}")
            return []

        try:
            history_data = json.loads(stdout) if stdout.strip() else []
            history = []

            for h in history_data:
                chart_full = h.get("chart", "")
                chart_parts = chart_full.rsplit("-", 1)
                chart_name = chart_parts[0] if chart_parts else chart_full
                chart_version = chart_parts[1] if len(chart_parts) > 1 else ""

                history.append(
                    ReleaseHistory(
                        revision=h.get("revision", 0),
                        status=self._parse_release_status(h.get("status", "")),
                        chart=chart_name,
                        chart_version=chart_version,
                        app_version=h.get("app_version"),
                        updated=self._parse_datetime(h.get("updated", "")) or datetime.now(),
                        description=h.get("description"),
                    )
                )

            return sorted(history, key=lambda x: x.revision, reverse=True)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse history JSON: {e}")
            return []

    async def get_release_values(
        self, name: str, namespace: str = "default", all_values: bool = False
    ) -> ReleaseValues:
        """Get values for a release."""
        args = ["get", "values", name, "-n", namespace, "-o", "json"]
        if all_values:
            args.append("--all")

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to get release values: {stderr}")
            return ReleaseValues()

        try:
            values = json.loads(stdout) if stdout.strip() else {}

            if all_values:
                return ReleaseValues(computed=values)
            return ReleaseValues(user_supplied=values)
        except json.JSONDecodeError:
            return ReleaseValues()

    async def get_release_manifest(self, name: str, namespace: str = "default") -> str:
        """Get the manifest (all Kubernetes resources) for a release."""
        args = ["get", "manifest", name, "-n", namespace]

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to get release manifest: {stderr}")
            return ""

        return stdout

    async def install(self, request: InstallRequest) -> HelmOperationResult:
        """Install a Helm chart."""
        import tempfile
        import os

        logger.info(f"Installing chart {request.chart} as {request.release_name} in namespace {request.namespace}")
        logger.info(f"Install request: version={request.version}, create_namespace={request.create_namespace}")
        logger.info(f"Number of values provided: {len(request.values) if request.values else 0}")

        args = ["install", request.release_name, request.chart]
        args.extend(["-n", request.namespace])

        if request.version:
            args.extend(["--version", request.version])

        if request.create_namespace:
            args.append("--create-namespace")

        if request.wait:
            args.append("--wait")

        args.extend(["--timeout", f"{request.timeout}s"])

        if request.dry_run:
            args.append("--dry-run")

        if request.repository:
            args.extend(["--repo", request.repository])

        # Write values to temporary file if provided
        values_file = None
        if request.values:
            try:
                # Create temporary file for values
                fd, values_file = tempfile.mkstemp(suffix='.yaml', text=True)
                values_yaml = yaml.dump(request.values, default_flow_style=False)
                logger.info(f"Writing values to temp file: {values_file}")
                logger.debug(f"Values YAML:\n{values_yaml}")

                with os.fdopen(fd, 'w') as f:
                    f.write(values_yaml)

                args.extend(["-f", values_file])
            except Exception as e:
                logger.error(f"Failed to write values file: {e}")
                if values_file and os.path.exists(values_file):
                    os.unlink(values_file)
                return HelmOperationResult(success=False, message=f"Failed to prepare values: {str(e)}")

        args.extend(["-o", "json"])

        logger.info(f"Executing helm command: {' '.join(args[:5])}... (values file: {values_file})")

        try:
            success, stdout, stderr = await self._run_helm_cmd(args, timeout=request.timeout + 30)

            if not success:
                logger.error(f"Installation failed. stderr: {stderr}")
                return HelmOperationResult(success=False, message=f"Installation failed: {stderr}")

            logger.info("Installation command completed successfully")

            try:
                data = json.loads(stdout)
                info = data.get("info", {})
                chart_meta = data.get("chart", {}).get("metadata", {})

                release = ReleaseInfo(
                    name=data.get("name", request.release_name),
                    namespace=data.get("namespace", request.namespace),
                    revision=data.get("version", 1),
                    status=self._parse_release_status(info.get("status", "")),
                    chart=chart_meta.get("name", ""),
                    chart_version=chart_meta.get("version", ""),
                    app_version=chart_meta.get("appVersion"),
                    updated=self._parse_datetime(info.get("last_deployed", "")),
                )

                logger.info(f"Installation successful. Revision: {release.revision}")

                return HelmOperationResult(
                    success=True,
                    message="Chart installed successfully",
                    release=release,
                    manifest=data.get("manifest"),
                    notes=info.get("notes"),
                )
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse response JSON: {e}")
                return HelmOperationResult(success=True, message="Chart installed (unable to parse response)")
        finally:
            # Clean up temporary values file
            if values_file and os.path.exists(values_file):
                try:
                    os.unlink(values_file)
                    logger.debug(f"Cleaned up temp file: {values_file}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp file {values_file}: {e}")

    async def upgrade(self, name: str, namespace: str, request: UpgradeRequest) -> HelmOperationResult:
        """Upgrade a Helm release."""
        import tempfile
        import os

        logger.info(f"Upgrading release {name} in namespace {namespace}")
        logger.info(f"Upgrade request: chart={request.chart}, version={request.version}, reuse_values={request.reuse_values}")
        logger.info(f"Number of values provided: {len(request.values) if request.values else 0}")

        # Get current chart if not specified
        if not request.chart:
            current = await self.get_release(name, namespace)
            if not current:
                return HelmOperationResult(success=False, message=f"Release {name} not found in namespace {namespace}")
            chart_name = current.chart
            logger.info(f"Current chart name: {chart_name}")

            # If chart name doesn't contain '/', search for it in repositories
            if '/' not in chart_name:
                logger.info(f"Searching for chart '{chart_name}' in configured repositories")
                search_results = await self.search_charts(chart_name)

                if search_results:
                    # Prefer bitnami, stable, or first match
                    preferred_repos = ['bitnami', 'stable']
                    chart_match = None

                    # First try preferred repos
                    for repo in preferred_repos:
                        for result in search_results:
                            # Access Pydantic model attributes directly, not with .get()
                            if result.repository == repo and result.name == chart_name:
                                chart_match = f"{repo}/{chart_name}"
                                break
                        if chart_match:
                            break

                    # If not found in preferred repos, use first exact match
                    if not chart_match:
                        for result in search_results:
                            if result.name == chart_name:
                                repo = result.repository if result.repository else 'unknown'
                                chart_match = f"{repo}/{chart_name}"
                                break

                    if chart_match:
                        request.chart = chart_match
                        logger.info(f"Found chart in repository: {request.chart}")
                    else:
                        request.chart = chart_name
                        logger.warning(f"Could not find exact match for chart '{chart_name}', using name as-is")
                else:
                    logger.warning(f"No search results for chart '{chart_name}', using name as-is")
                    request.chart = chart_name
            else:
                request.chart = chart_name
                logger.info(f"Using current chart: {request.chart}")

        args = ["upgrade", name, request.chart]
        args.extend(["-n", namespace])

        if request.version:
            args.extend(["--version", request.version])

        if request.reset_values:
            args.append("--reset-values")
        elif request.reuse_values:
            args.append("--reuse-values")

        if request.wait:
            args.append("--wait")

        args.extend(["--timeout", f"{request.timeout}s"])

        if request.dry_run:
            args.append("--dry-run")

        if request.force:
            args.append("--force")

        if request.repository:
            args.extend(["--repo", request.repository])

        # Write values to temporary file if provided
        values_file = None
        if request.values:
            try:
                # Create temporary file for values
                fd, values_file = tempfile.mkstemp(suffix='.yaml', text=True)
                values_yaml = yaml.dump(request.values, default_flow_style=False)
                logger.info(f"Writing values to temp file: {values_file}")
                logger.debug(f"Values YAML:\n{values_yaml}")

                with os.fdopen(fd, 'w') as f:
                    f.write(values_yaml)

                args.extend(["-f", values_file])
            except Exception as e:
                logger.error(f"Failed to write values file: {e}")
                if values_file and os.path.exists(values_file):
                    os.unlink(values_file)
                return HelmOperationResult(success=False, message=f"Failed to prepare values: {str(e)}")

        args.extend(["-o", "json"])

        logger.info(f"Executing helm command: {' '.join(args[:5])}... (values file: {values_file})")

        try:
            success, stdout, stderr = await self._run_helm_cmd(args, timeout=request.timeout + 30)

            if not success:
                logger.error(f"Upgrade failed. stderr: {stderr}")
                return HelmOperationResult(success=False, message=f"Upgrade failed: {stderr}")

            logger.info("Upgrade command completed successfully")

            try:
                data = json.loads(stdout)
                info = data.get("info", {})
                chart_meta = data.get("chart", {}).get("metadata", {})

                release = ReleaseInfo(
                    name=data.get("name", name),
                    namespace=data.get("namespace", namespace),
                    revision=data.get("version", 1),
                    status=self._parse_release_status(info.get("status", "")),
                    chart=chart_meta.get("name", ""),
                    chart_version=chart_meta.get("version", ""),
                    app_version=chart_meta.get("appVersion"),
                    updated=self._parse_datetime(info.get("last_deployed", "")),
                )

                logger.info(f"Upgrade successful. New revision: {release.revision}")

                return HelmOperationResult(
                    success=True,
                    message="Release upgraded successfully",
                    release=release,
                    manifest=data.get("manifest"),
                    notes=info.get("notes"),
                )
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse response JSON: {e}")
                return HelmOperationResult(success=True, message="Release upgraded (unable to parse response)")
        finally:
            # Clean up temporary values file
            if values_file and os.path.exists(values_file):
                try:
                    os.unlink(values_file)
                    logger.debug(f"Cleaned up temp file: {values_file}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp file {values_file}: {e}")

    async def rollback(self, name: str, namespace: str, request: RollbackRequest) -> HelmOperationResult:
        """Rollback a release to a specific revision."""
        args = ["rollback", name, str(request.revision)]
        args.extend(["-n", namespace])

        if request.wait:
            args.append("--wait")

        args.extend(["--timeout", f"{request.timeout}s"])

        if request.dry_run:
            args.append("--dry-run")

        if request.force:
            args.append("--force")

        success, stdout, stderr = await self._run_helm_cmd(args, timeout=request.timeout + 30)

        if not success:
            return HelmOperationResult(success=False, message=f"Rollback failed: {stderr}")

        # Get updated release info
        release = await self.get_release(name, namespace)

        return HelmOperationResult(
            success=True,
            message=f"Rolled back to revision {request.revision}",
            release=release,
        )

    async def uninstall(self, name: str, namespace: str, request: UninstallRequest) -> HelmOperationResult:
        """Uninstall a Helm release."""
        args = ["uninstall", name]
        args.extend(["-n", namespace])

        if request.keep_history:
            args.append("--keep-history")

        if request.dry_run:
            args.append("--dry-run")

        args.extend(["--timeout", f"{request.timeout}s"])

        success, stdout, stderr = await self._run_helm_cmd(args, timeout=request.timeout + 30)

        if not success:
            return HelmOperationResult(success=False, message=f"Uninstall failed: {stderr}")

        return HelmOperationResult(
            success=True,
            message=f"Release {name} uninstalled successfully",
        )

    async def test_release(self, name: str, namespace: str, timeout: int = 300) -> HelmOperationResult:
        """Run tests for a Helm release."""
        args = ["test", name]
        args.extend(["-n", namespace])
        args.extend(["--timeout", f"{timeout}s"])

        success, stdout, stderr = await self._run_helm_cmd(args, timeout=timeout + 30)

        if not success:
            return HelmOperationResult(
                success=False,
                message=f"Tests failed: {stderr}",
                notes=stdout if stdout else stderr,
            )

        return HelmOperationResult(
            success=True,
            message="Tests passed successfully",
            notes=stdout,
        )

    async def get_release_health(self, name: str, namespace: str) -> Dict[str, Any]:
        """Get health information for a Helm release including pod status."""
        # Get the release manifest to find all resources
        manifest = await self.get_release_manifest(name, namespace)

        if not manifest:
            return {
                "healthy": False,
                "total_pods": 0,
                "ready_pods": 0,
                "pods": [],
                "events": [],
                "error": "Failed to get release manifest"
            }

        # Use kubectl to get pods with label selectors
        # We'll look for pods with release label
        kubectl_cmd = ["kubectl", "get", "pods", "-n", namespace,
                      "-l", f"app.kubernetes.io/instance={name}",
                      "-o", "json"]

        if self.kubeconfig:
            kubectl_cmd.extend(["--kubeconfig", self.kubeconfig])
        if self.context:
            kubectl_cmd.extend(["--context", self.context])

        try:
            process = await asyncio.create_subprocess_exec(
                *kubectl_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30)

            if process.returncode != 0:
                logger.error(f"Failed to get pods: {stderr.decode()}")
                return {
                    "healthy": False,
                    "total_pods": 0,
                    "ready_pods": 0,
                    "pods": [],
                    "events": [],
                    "error": f"kubectl error: {stderr.decode()}"
                }

            pods_data = json.loads(stdout.decode())
            pods = []
            ready_count = 0
            total_count = len(pods_data.get("items", []))

            for pod in pods_data.get("items", []):
                pod_name = pod["metadata"]["name"]
                pod_status = pod["status"]

                # Determine pod state
                phase = pod_status.get("phase", "Unknown")
                conditions = pod_status.get("conditions", [])
                container_statuses = pod_status.get("containerStatuses", [])

                ready = False
                for condition in conditions:
                    if condition.get("type") == "Ready" and condition.get("status") == "True":
                        ready = True
                        break

                if ready:
                    ready_count += 1

                # Get container status details
                containers = []
                for container in container_statuses:
                    container_state = container.get("state", {})
                    state_key = list(container_state.keys())[0] if container_state else "unknown"

                    containers.append({
                        "name": container.get("name"),
                        "ready": container.get("ready", False),
                        "restartCount": container.get("restartCount", 0),
                        "state": state_key,
                        "image": container.get("image"),
                    })

                pods.append({
                    "name": pod_name,
                    "namespace": namespace,
                    "phase": phase,
                    "ready": ready,
                    "containers": containers,
                    "node": pod["spec"].get("nodeName"),
                    "created": pod["metadata"].get("creationTimestamp"),
                })

            # Get recent events for the release
            events_cmd = ["kubectl", "get", "events", "-n", namespace,
                         "--field-selector", f"involvedObject.name={name}",
                         "-o", "json", "--sort-by=.lastTimestamp"]

            if self.kubeconfig:
                events_cmd.extend(["--kubeconfig", self.kubeconfig])
            if self.context:
                events_cmd.extend(["--context", self.context])

            events_process = await asyncio.create_subprocess_exec(
                *events_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            events_stdout, _ = await asyncio.wait_for(events_process.communicate(), timeout=30)

            events = []
            if events_process.returncode == 0:
                events_data = json.loads(events_stdout.decode())
                for event in events_data.get("items", [])[-10:]:  # Last 10 events
                    events.append({
                        "type": event.get("type", "Normal"),
                        "reason": event.get("reason", ""),
                        "message": event.get("message", ""),
                        "timestamp": event.get("lastTimestamp") or event.get("firstTimestamp"),
                        "count": event.get("count", 1),
                    })

            healthy = ready_count == total_count and total_count > 0

            return {
                "healthy": healthy,
                "total_pods": total_count,
                "ready_pods": ready_count,
                "pods": pods,
                "events": events,
            }

        except asyncio.TimeoutError:
            return {
                "healthy": False,
                "total_pods": 0,
                "ready_pods": 0,
                "pods": [],
                "events": [],
                "error": "Timeout while fetching pod status"
            }
        except Exception as e:
            logger.error(f"Error getting release health: {e}")
            return {
                "healthy": False,
                "total_pods": 0,
                "ready_pods": 0,
                "pods": [],
                "events": [],
                "error": str(e)
            }

    async def list_repositories(self) -> List[Repository]:
        """List configured Helm repositories."""
        args = ["repo", "list", "-o", "json"]

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            # Return default repos if no repos configured
            return self._default_repositories

        try:
            repos_data = json.loads(stdout) if stdout.strip() else []
            return [Repository(name=r.get("name", ""), url=r.get("url", "")) for r in repos_data]
        except json.JSONDecodeError:
            return self._default_repositories

    async def add_repository(self, name: str, url: str) -> bool:
        """Add a Helm repository."""
        args = ["repo", "add", name, url]

        success, _, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to add repository: {stderr}")
            return False

        # Update repo index
        await self._run_helm_cmd(["repo", "update"])
        return True

    async def remove_repository(self, name: str) -> bool:
        """Remove a Helm repository."""
        args = ["repo", "remove", name]

        success, _, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to remove repository: {stderr}")
            return False

        return True

    async def update_repositories(self) -> bool:
        """Update all Helm repository indexes."""
        args = ["repo", "update"]

        success, _, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to update repositories: {stderr}")
            return False

        return True

    async def search_charts(self, query: str, repository: Optional[str] = None) -> List[ChartSearchResult]:
        """Search for charts in repositories."""
        args = ["search", "repo", query, "-o", "json"]

        if repository:
            args = ["search", "repo", f"{repository}/{query}", "-o", "json"]

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Chart search failed: {stderr}")
            return []

        try:
            charts_data = json.loads(stdout) if stdout.strip() else []
            results = []

            for c in charts_data:
                name_full = c.get("name", "")
                # Parse repository and chart name (e.g., "bitnami/nginx")
                if "/" in name_full:
                    repo, chart_name = name_full.split("/", 1)
                else:
                    repo = ""
                    chart_name = name_full

                results.append(
                    ChartSearchResult(
                        name=chart_name,
                        version=c.get("version", ""),
                        app_version=c.get("app_version"),
                        description=c.get("description"),
                        repository=repo,
                    )
                )

            return results
        except json.JSONDecodeError:
            return []

    async def get_chart_versions(self, chart: str, repository: Optional[str] = None) -> List[ChartSearchResult]:
        """Get all available versions of a specific chart."""
        args = ["search", "repo", chart, "--versions", "-o", "json"]

        if repository:
            args = ["search", "repo", f"{repository}/{chart}", "--versions", "-o", "json"]

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to get chart versions: {stderr}")
            return []

        try:
            charts_data = json.loads(stdout) if stdout.strip() else []
            results = []

            for c in charts_data:
                name_full = c.get("name", "")
                # Parse repository and chart name
                if "/" in name_full:
                    repo, chart_name = name_full.split("/", 1)
                else:
                    repo = ""
                    chart_name = name_full

                results.append(
                    ChartSearchResult(
                        name=chart_name,
                        version=c.get("version", ""),
                        app_version=c.get("app_version"),
                        description=c.get("description"),
                        repository=repo,
                    )
                )

            return results
        except json.JSONDecodeError:
            return []

    async def get_chart_info(self, chart: str, repository: Optional[str] = None) -> Optional[ChartInfo]:
        """Get detailed information about a chart."""
        args = ["show", "chart", chart, "-o", "json"]

        if repository:
            args.extend(["--repo", repository])

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to get chart info: {stderr}")
            return None

        try:
            # helm show chart outputs YAML, not JSON
            data = yaml.safe_load(stdout) if stdout.strip() else {}

            return ChartInfo(
                name=data.get("name", ""),
                version=data.get("version", ""),
                app_version=data.get("appVersion"),
                description=data.get("description"),
                repository=repository,
                icon=data.get("icon"),
                home=data.get("home"),
                sources=data.get("sources", []),
                keywords=data.get("keywords", []),
                maintainers=data.get("maintainers", []),
            )
        except yaml.YAMLError:
            return None

    async def get_chart_values(self, chart: str, repository: Optional[str] = None) -> Dict[str, Any]:
        """Get default values for a chart."""
        args = ["show", "values", chart]

        if repository:
            args.extend(["--repo", repository])

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to get chart values: {stderr}")
            return {}

        try:
            return yaml.safe_load(stdout) if stdout.strip() else {}
        except yaml.YAMLError:
            return {}

    def _flatten_dict(self, d: Dict[str, Any], parent_key: str = "") -> List[Tuple[str, Any]]:
        """Flatten a nested dictionary for Helm --set arguments."""
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}.{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, new_key))
            elif isinstance(v, list):
                for i, item in enumerate(v):
                    if isinstance(item, dict):
                        items.extend(self._flatten_dict(item, f"{new_key}[{i}]"))
                    else:
                        items.append((f"{new_key}[{i}]", item))
            else:
                items.append((new_key, v))
        return items


# Singleton instance
helm_service = HelmService()
