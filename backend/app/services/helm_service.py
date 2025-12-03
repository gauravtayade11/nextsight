"""
Helm service for managing Helm chart deployments.
Executes Helm CLI commands via subprocess and parses output.
"""

import asyncio
import json
import logging
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
        args = ["status", name, "-n", namespace, "-o", "json"]

        success, stdout, stderr = await self._run_helm_cmd(args)

        if not success:
            logger.error(f"Failed to get release {name}: {stderr}")
            return None

        try:
            data = json.loads(stdout)
            info = data.get("info", {})
            chart_meta = data.get("chart", {}).get("metadata", {})

            return ReleaseInfo(
                name=data.get("name", name),
                namespace=data.get("namespace", namespace),
                revision=data.get("version", 1),
                status=self._parse_release_status(info.get("status", "")),
                chart=chart_meta.get("name", ""),
                chart_version=chart_meta.get("version", ""),
                app_version=chart_meta.get("appVersion"),
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

    async def install(self, request: InstallRequest) -> HelmOperationResult:
        """Install a Helm chart."""
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

        # Write values to temp file if provided
        if request.values:
            values_yaml = yaml.dump(request.values)
            args.extend(["--values", "-"])
            # For simplicity, we'll pass values as --set arguments
            for key, value in self._flatten_dict(request.values):
                args.extend(["--set", f"{key}={value}"])
            # Remove the --values - since we're using --set
            args = [a for a in args if a not in ["--values", "-"]]

        args.extend(["-o", "json"])

        success, stdout, stderr = await self._run_helm_cmd(args, timeout=request.timeout + 30)

        if not success:
            return HelmOperationResult(success=False, message=f"Installation failed: {stderr}")

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

            return HelmOperationResult(
                success=True,
                message="Chart installed successfully",
                release=release,
                manifest=data.get("manifest"),
                notes=info.get("notes"),
            )
        except json.JSONDecodeError:
            return HelmOperationResult(success=True, message="Chart installed (unable to parse response)")

    async def upgrade(self, name: str, namespace: str, request: UpgradeRequest) -> HelmOperationResult:
        """Upgrade a Helm release."""
        # Get current chart if not specified
        if not request.chart:
            current = await self.get_release(name, namespace)
            if not current:
                return HelmOperationResult(success=False, message=f"Release {name} not found in namespace {namespace}")
            request.chart = current.chart

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

        # Add values via --set
        if request.values:
            for key, value in self._flatten_dict(request.values):
                args.extend(["--set", f"{key}={value}"])

        args.extend(["-o", "json"])

        success, stdout, stderr = await self._run_helm_cmd(args, timeout=request.timeout + 30)

        if not success:
            return HelmOperationResult(success=False, message=f"Upgrade failed: {stderr}")

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

            return HelmOperationResult(
                success=True,
                message="Release upgraded successfully",
                release=release,
                manifest=data.get("manifest"),
                notes=info.get("notes"),
            )
        except json.JSONDecodeError:
            return HelmOperationResult(success=True, message="Release upgraded (unable to parse response)")

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
