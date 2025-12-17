"""
ArgoCD Deployment Service for installing and managing ArgoCD instances.
Uses Helm to deploy ArgoCD to Kubernetes clusters.
"""

import asyncio
import logging
import secrets
import string
from typing import Any, Dict, Optional, Tuple

from app.services.helm_service import HelmService

logger = logging.getLogger(__name__)


class ArgoCDDeploymentService:
    """Service for deploying and managing ArgoCD instances."""

    ARGOCD_REPO_NAME = "argo"
    ARGOCD_REPO_URL = "https://argoproj.github.io/argo-helm"
    ARGOCD_CHART_NAME = "argo-cd"
    DEFAULT_NAMESPACE = "argocd"
    DEFAULT_RELEASE_NAME = "argocd"

    def __init__(self, kubeconfig: Optional[str] = None, context: Optional[str] = None):
        """
        Initialize ArgoCD deployment service.

        Args:
            kubeconfig: Path to kubeconfig file
            context: Kubernetes context to use
        """
        self.helm_service = HelmService(kubeconfig=kubeconfig, context=context)
        self.kubeconfig = kubeconfig
        self.context = context

    def _generate_admin_password(self, length: int = 16) -> str:
        """Generate a secure random password."""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    async def _ensure_repo_added(self) -> Tuple[bool, str]:
        """Ensure ArgoCD Helm repository is added."""
        try:
            # Check if repo exists
            repos = await self.helm_service.list_repositories()
            repo_exists = any(r.name == self.ARGOCD_REPO_NAME for r in repos)

            if not repo_exists:
                result = await self.helm_service.add_repository(
                    self.ARGOCD_REPO_NAME,
                    self.ARGOCD_REPO_URL
                )
                if not result.success:
                    return False, f"Failed to add ArgoCD repo: {result.message}"

            # Update repo
            await self.helm_service.update_repositories()
            return True, "Repository ready"

        except Exception as e:
            logger.error(f"Failed to ensure repo: {e}")
            return False, str(e)

    async def get_deployment_status(
        self,
        namespace: str = DEFAULT_NAMESPACE,
        release_name: str = DEFAULT_RELEASE_NAME,
    ) -> Dict[str, Any]:
        """
        Check if ArgoCD is deployed and get its status.

        Returns:
            Dictionary with deployment status information
        """
        try:
            release = await self.helm_service.get_release(release_name, namespace)

            if release:
                # Get server URL
                server_url = await self._get_argocd_server_url(namespace)

                return {
                    "deployed": True,
                    "release_name": release.name,
                    "namespace": release.namespace,
                    "status": release.status,
                    "chart_version": release.chart_version,
                    "app_version": release.app_version,
                    "server_url": server_url,
                    "updated": release.updated,
                }

            return {
                "deployed": False,
                "message": "ArgoCD is not deployed",
            }

        except Exception as e:
            logger.error(f"Failed to get deployment status: {e}")
            return {
                "deployed": False,
                "error": str(e),
            }

    async def _get_argocd_server_url(self, namespace: str) -> Optional[str]:
        """Get the ArgoCD server URL from the service."""
        try:
            # Try to get the service info using kubectl
            cmd = [
                "kubectl",
                "get", "svc", "argocd-server",
                "-n", namespace,
                "-o", "jsonpath={.status.loadBalancer.ingress[0].ip}",
            ]

            if self.kubeconfig:
                cmd.extend(["--kubeconfig", self.kubeconfig])
            if self.context:
                cmd.extend(["--context", self.context])

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await process.communicate()

            external_ip = stdout.decode().strip()
            if external_ip:
                return f"https://{external_ip}"

            # If no LoadBalancer IP, return the internal service URL
            return f"https://argocd-server.{namespace}.svc.cluster.local"

        except Exception as e:
            logger.warning(f"Could not get ArgoCD server URL: {e}")
            return None

    async def deploy(
        self,
        namespace: str = DEFAULT_NAMESPACE,
        release_name: str = DEFAULT_RELEASE_NAME,
        version: Optional[str] = None,
        values: Optional[Dict[str, Any]] = None,
        expose_type: str = "ClusterIP",  # ClusterIP, LoadBalancer, NodePort
        admin_password: Optional[str] = None,
        ha_enabled: bool = False,
        insecure: bool = True,  # Disable TLS for easier local dev
    ) -> Dict[str, Any]:
        """
        Deploy ArgoCD to the cluster.

        Args:
            namespace: Kubernetes namespace for ArgoCD
            release_name: Helm release name
            version: Specific chart version (latest if not specified)
            values: Custom Helm values
            expose_type: Service type for ArgoCD server
            admin_password: Admin password (generated if not provided)
            ha_enabled: Enable high availability mode
            insecure: Run server without TLS (for local development)

        Returns:
            Deployment result with connection details
        """
        try:
            # Ensure repo is added
            success, msg = await self._ensure_repo_added()
            if not success:
                return {"success": False, "message": msg}

            # Generate admin password if not provided
            if not admin_password:
                admin_password = self._generate_admin_password()

            # Build Helm values
            helm_values = self._build_helm_values(
                expose_type=expose_type,
                admin_password=admin_password,
                ha_enabled=ha_enabled,
                insecure=insecure,
            )

            # Merge custom values
            if values:
                helm_values = self._deep_merge(helm_values, values)

            # Install ArgoCD
            from app.schemas.helm import InstallRequest

            install_request = InstallRequest(
                release_name=release_name,
                chart=f"{self.ARGOCD_REPO_NAME}/{self.ARGOCD_CHART_NAME}",
                namespace=namespace,
                version=version,
                values=helm_values,
                create_namespace=True,
                wait=True,
                timeout=600,  # 10 minutes for ArgoCD to start
            )

            result = await self.helm_service.install(install_request)

            # Check for CRD ownership conflicts
            if not result.success and "invalid ownership metadata" in result.message.lower():
                return {
                    "success": False,
                    "message": "ArgoCD CRDs already exist from a different installation. Please run: kubectl delete crd applications.argoproj.io applicationsets.argoproj.io appprojects.argoproj.io",
                    "error_type": "crd_ownership_conflict",
                }

            if result.success:
                # Wait a bit for services to be ready
                await asyncio.sleep(5)

                # Get server URL
                server_url = await self._get_argocd_server_url(namespace)

                return {
                    "success": True,
                    "message": "ArgoCD deployed successfully",
                    "release_name": release_name,
                    "namespace": namespace,
                    "server_url": server_url,
                    "admin_username": "admin",
                    "admin_password": admin_password,
                    "chart_version": result.release.chart_version if result.release else None,
                    "notes": result.notes,
                }

            return {
                "success": False,
                "message": result.message,
            }

        except Exception as e:
            logger.error(f"Failed to deploy ArgoCD: {e}")
            return {
                "success": False,
                "message": str(e),
            }

    def _build_helm_values(
        self,
        expose_type: str,
        admin_password: str,
        ha_enabled: bool,
        insecure: bool,
    ) -> Dict[str, Any]:
        """Build Helm values for ArgoCD deployment."""
        values: Dict[str, Any] = {
            "server": {
                "service": {
                    "type": expose_type,
                },
                "extraArgs": [],
            },
            "configs": {
                "params": {
                    "server.insecure": insecure,
                },
                "secret": {
                    "argocdServerAdminPassword": admin_password,
                    "argocdServerAdminPasswordMtime": "2024-01-01T00:00:00Z",
                },
            },
            "controller": {
                "replicas": 1,
            },
            "repoServer": {
                "replicas": 1,
            },
            "applicationSet": {
                "replicas": 1,
            },
        }

        if insecure:
            values["server"]["extraArgs"].append("--insecure")

        if ha_enabled:
            values["controller"]["replicas"] = 2
            values["repoServer"]["replicas"] = 2
            values["applicationSet"]["replicas"] = 2
            values["redis-ha"] = {"enabled": True}
            values["redis"] = {"enabled": False}

        return values

    def _deep_merge(self, base: Dict, override: Dict) -> Dict:
        """Deep merge two dictionaries."""
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    async def upgrade(
        self,
        namespace: str = DEFAULT_NAMESPACE,
        release_name: str = DEFAULT_RELEASE_NAME,
        version: Optional[str] = None,
        values: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Upgrade ArgoCD deployment.

        Args:
            namespace: Kubernetes namespace
            release_name: Helm release name
            version: Target chart version
            values: Custom Helm values to apply

        Returns:
            Upgrade result
        """
        try:
            # Ensure repo is updated
            await self._ensure_repo_added()

            from app.schemas.helm import UpgradeRequest

            upgrade_request = UpgradeRequest(
                chart=f"{self.ARGOCD_REPO_NAME}/{self.ARGOCD_CHART_NAME}",
                version=version,
                values=values,
                reuse_values=True,
                wait=True,
                timeout=600,
            )

            result = await self.helm_service.upgrade(
                release_name, namespace, upgrade_request
            )

            if result.success:
                return {
                    "success": True,
                    "message": "ArgoCD upgraded successfully",
                    "chart_version": result.release.chart_version if result.release else None,
                }

            return {
                "success": False,
                "message": result.message,
            }

        except Exception as e:
            logger.error(f"Failed to upgrade ArgoCD: {e}")
            return {
                "success": False,
                "message": str(e),
            }

    async def uninstall(
        self,
        namespace: str = DEFAULT_NAMESPACE,
        release_name: str = DEFAULT_RELEASE_NAME,
        delete_namespace: bool = False,
    ) -> Dict[str, Any]:
        """
        Uninstall ArgoCD from the cluster.

        Args:
            namespace: Kubernetes namespace
            release_name: Helm release name
            delete_namespace: Also delete the namespace

        Returns:
            Uninstall result
        """
        try:
            from app.schemas.helm import UninstallRequest

            uninstall_request = UninstallRequest(
                release_name=release_name,
                namespace=namespace,
                keep_history=False,
            )

            result = await self.helm_service.uninstall(release_name, namespace, uninstall_request)

            if result.success:
                # Optionally delete namespace
                if delete_namespace:
                    cmd = ["kubectl", "delete", "namespace", namespace]
                    if self.kubeconfig:
                        cmd.extend(["--kubeconfig", self.kubeconfig])
                    if self.context:
                        cmd.extend(["--context", self.context])

                    process = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await process.communicate()

                return {
                    "success": True,
                    "message": "ArgoCD uninstalled successfully",
                }

            return {
                "success": False,
                "message": result.message,
            }

        except Exception as e:
            logger.error(f"Failed to uninstall ArgoCD: {e}")
            return {
                "success": False,
                "message": str(e),
            }

    async def get_admin_password(
        self,
        namespace: str = DEFAULT_NAMESPACE,
    ) -> Optional[str]:
        """
        Get the ArgoCD admin password from the Kubernetes secret.

        Args:
            namespace: ArgoCD namespace

        Returns:
            Admin password or None if not found
        """
        try:
            cmd = [
                "kubectl",
                "get", "secret", "argocd-initial-admin-secret",
                "-n", namespace,
                "-o", "jsonpath={.data.password}",
            ]

            if self.kubeconfig:
                cmd.extend(["--kubeconfig", self.kubeconfig])
            if self.context:
                cmd.extend(["--context", self.context])

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await process.communicate()

            if process.returncode == 0:
                import base64
                password_b64 = stdout.decode().strip()
                if password_b64:
                    return base64.b64decode(password_b64).decode()

            return None

        except Exception as e:
            logger.warning(f"Could not get admin password: {e}")
            return None

    async def port_forward(
        self,
        namespace: str = DEFAULT_NAMESPACE,
        local_port: int = 8080,
    ) -> Dict[str, Any]:
        """
        Set up port forwarding to ArgoCD server.

        Args:
            namespace: ArgoCD namespace
            local_port: Local port to forward to

        Returns:
            Port forward information
        """
        try:
            cmd = [
                "kubectl",
                "port-forward",
                "svc/argocd-server",
                f"{local_port}:443",
                "-n", namespace,
            ]

            if self.kubeconfig:
                cmd.extend(["--kubeconfig", self.kubeconfig])
            if self.context:
                cmd.extend(["--context", self.context])

            # Start port-forward in background
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            # Give it a moment to start
            await asyncio.sleep(2)

            if process.returncode is None:  # Still running
                return {
                    "success": True,
                    "message": f"Port forwarding active",
                    "url": f"https://localhost:{local_port}",
                    "pid": process.pid,
                }

            return {
                "success": False,
                "message": "Port forwarding failed to start",
            }

        except Exception as e:
            logger.error(f"Failed to set up port forwarding: {e}")
            return {
                "success": False,
                "message": str(e),
            }


# Singleton instance
_deployment_service: Optional[ArgoCDDeploymentService] = None


def get_argocd_deployment_service(
    kubeconfig: Optional[str] = None,
    context: Optional[str] = None,
) -> ArgoCDDeploymentService:
    """Get or create ArgoCD deployment service instance."""
    global _deployment_service

    if _deployment_service is None:
        _deployment_service = ArgoCDDeploymentService(
            kubeconfig=kubeconfig,
            context=context,
        )

    return _deployment_service
