import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from kubernetes import client
from kubernetes.client.rest import ApiException

from app.schemas.gitflow import DeploymentRequest, DeploymentStatus, Environment, ReleaseStatus, RollbackRequest
from app.services.kubernetes_service import kubernetes_service

logger = logging.getLogger(__name__)


class K8sDeploymentService:
    def __init__(self):
        self._deployments: Dict[str, DeploymentStatus] = {}
        self._deployment_history: Dict[str, List[DeploymentStatus]] = {}

    async def deploy_release(
        self,
        release_id: str,
        version: str,
        environment: Environment,
        namespace: str,
        services: List[str],
        image_registry: str,
        dry_run: bool = False,
        wait_for_ready: bool = True,
        timeout_seconds: int = 300,
        deployed_by: Optional[str] = None,
    ) -> DeploymentStatus:
        deployment_id = str(uuid.uuid4())

        deployment_status = DeploymentStatus(
            id=deployment_id,
            release_id=release_id,
            environment=environment,
            namespace=namespace,
            status="starting",
            services=[],
            started_at=datetime.now(timezone.utc),
            deployed_by=deployed_by,
            rollback_available=False,
        )

        self._deployments[deployment_id] = deployment_status

        if namespace not in self._deployment_history:
            self._deployment_history[namespace] = []

        try:
            kubernetes_service._initialize()

            previous_versions = await self._get_current_versions(namespace, services)
            deployment_status.previous_version = previous_versions.get("primary")

            service_results = []
            for service_name in services:
                if dry_run:
                    service_results.append(
                        {
                            "name": service_name,
                            "status": "dry_run",
                            "new_image": f"{image_registry}/{service_name}:{version}",
                            "message": "Dry run - no changes made",
                        }
                    )
                    continue

                result = await self._update_deployment_image(
                    namespace=namespace,
                    deployment_name=service_name,
                    new_image=f"{image_registry}/{service_name}:{version}",
                    version=version,
                )
                service_results.append(result)

            deployment_status.services = service_results

            if not dry_run and wait_for_ready:
                await self._wait_for_rollout(namespace=namespace, deployments=services, timeout=timeout_seconds)
                deployment_status.status = "deployed"
            elif dry_run:
                deployment_status.status = "dry_run_complete"
            else:
                deployment_status.status = "deploying"

            deployment_status.completed_at = datetime.now(timezone.utc)
            deployment_status.rollback_available = not dry_run

            self._deployment_history[namespace].append(deployment_status)

            return deployment_status

        except Exception as e:
            logger.error(f"Deployment failed: {e}")
            deployment_status.status = "failed"
            deployment_status.services.append({"error": str(e)})
            return deployment_status

    async def _get_current_versions(self, namespace: str, services: List[str]) -> Dict[str, str]:
        versions = {}
        apps_v1 = kubernetes_service._apps_v1

        for service in services:
            try:
                deployment = apps_v1.read_namespaced_deployment(service, namespace)
                if deployment.spec.template.spec.containers:
                    image = deployment.spec.template.spec.containers[0].image
                    if ":" in image:
                        versions[service] = image.split(":")[-1]
                    else:
                        versions[service] = "latest"
            except ApiException:
                versions[service] = "unknown"

        if versions:
            versions["primary"] = list(versions.values())[0]

        return versions

    async def _update_deployment_image(
        self, namespace: str, deployment_name: str, new_image: str, version: str
    ) -> Dict[str, Any]:
        apps_v1 = kubernetes_service._apps_v1

        try:
            deployment = apps_v1.read_namespaced_deployment(deployment_name, namespace)
            old_image = deployment.spec.template.spec.containers[0].image

            deployment.spec.template.spec.containers[0].image = new_image

            if not deployment.spec.template.metadata.annotations:
                deployment.spec.template.metadata.annotations = {}

            deployment.spec.template.metadata.annotations.update(
                {
                    "nextsight.io/version": version,
                    "nextsight.io/deployed-at": datetime.now(timezone.utc).isoformat(),
                    "nextsight.io/previous-image": old_image,
                }
            )

            apps_v1.replace_namespaced_deployment(name=deployment_name, namespace=namespace, body=deployment)

            return {
                "name": deployment_name,
                "status": "updated",
                "old_image": old_image,
                "new_image": new_image,
                "message": f"Updated {deployment_name} to {version}",
            }

        except ApiException as e:
            logger.error(f"Failed to update deployment {deployment_name}: {e}")
            return {"name": deployment_name, "status": "failed", "error": str(e)}

    async def _wait_for_rollout(self, namespace: str, deployments: List[str], timeout: int = 300) -> bool:
        apps_v1 = kubernetes_service._apps_v1
        start_time = datetime.now(timezone.utc)

        while True:
            all_ready = True

            for deployment_name in deployments:
                try:
                    deployment = apps_v1.read_namespaced_deployment(deployment_name, namespace)

                    ready = deployment.status.ready_replicas or 0
                    desired = deployment.spec.replicas or 1

                    if ready < desired:
                        all_ready = False
                        break

                except ApiException as e:
                    logger.error(f"Error checking deployment status: {e}")
                    all_ready = False
                    break

            if all_ready:
                return True

            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
            if elapsed >= timeout:
                raise TimeoutError(f"Rollout timed out after {timeout} seconds")

            await asyncio.sleep(5)

    async def rollback(
        self,
        deployment_id: str,
        target_version: Optional[str] = None,
        reason: str = "",
        rolled_back_by: Optional[str] = None,
    ) -> DeploymentStatus:
        if deployment_id not in self._deployments:
            raise ValueError(f"Deployment {deployment_id} not found")

        original_deployment = self._deployments[deployment_id]

        if not original_deployment.rollback_available:
            raise ValueError("Rollback not available for this deployment")

        rollback_id = str(uuid.uuid4())
        rollback_status = DeploymentStatus(
            id=rollback_id,
            release_id=f"rollback-{original_deployment.release_id}",
            environment=original_deployment.environment,
            namespace=original_deployment.namespace,
            status="rolling_back",
            services=[],
            started_at=datetime.now(timezone.utc),
            deployed_by=rolled_back_by,
        )

        self._deployments[rollback_id] = rollback_status

        try:
            apps_v1 = kubernetes_service._apps_v1

            for service_info in original_deployment.services:
                if isinstance(service_info, dict) and "old_image" in service_info:
                    deployment_name = service_info["name"]
                    previous_image = service_info["old_image"]

                    if target_version:
                        base_image = previous_image.rsplit(":", 1)[0]
                        previous_image = f"{base_image}:{target_version}"

                    deployment = apps_v1.read_namespaced_deployment(deployment_name, original_deployment.namespace)

                    deployment.spec.template.spec.containers[0].image = previous_image

                    if not deployment.spec.template.metadata.annotations:
                        deployment.spec.template.metadata.annotations = {}

                    deployment.spec.template.metadata.annotations.update(
                        {
                            "nextsight.io/rollback-reason": reason,
                            "nextsight.io/rolled-back-at": datetime.now(timezone.utc).isoformat(),
                            "nextsight.io/rolled-back-by": rolled_back_by or "system",
                        }
                    )

                    apps_v1.replace_namespaced_deployment(
                        name=deployment_name, namespace=original_deployment.namespace, body=deployment
                    )

                    rollback_status.services.append(
                        {
                            "name": deployment_name,
                            "status": "rolled_back",
                            "restored_image": previous_image,
                            "reason": reason,
                        }
                    )

            await self._wait_for_rollout(
                namespace=original_deployment.namespace,
                deployments=[s["name"] for s in rollback_status.services if isinstance(s, dict) and "name" in s],
                timeout=300,
            )

            rollback_status.status = "rolled_back"
            rollback_status.completed_at = datetime.now(timezone.utc)

            original_deployment.rollback_available = False

            return rollback_status

        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            rollback_status.status = "rollback_failed"
            rollback_status.services.append({"error": str(e)})
            return rollback_status

    async def get_deployment_status(self, deployment_id: str) -> Optional[DeploymentStatus]:
        return self._deployments.get(deployment_id)

    async def get_deployment_history(self, namespace: str, limit: int = 20) -> List[DeploymentStatus]:
        history = self._deployment_history.get(namespace, [])
        return sorted(history, key=lambda x: x.started_at, reverse=True)[:limit]

    async def get_environment_status(self, environment: Environment) -> Dict[str, Any]:
        env_deployments = [d for d in self._deployments.values() if d.environment == environment]

        latest = None
        if env_deployments:
            latest = max(env_deployments, key=lambda x: x.started_at)

        return {
            "environment": environment.value,
            "total_deployments": len(env_deployments),
            "latest_deployment": latest,
            "successful_deployments": sum(1 for d in env_deployments if d.status == "deployed"),
            "failed_deployments": sum(1 for d in env_deployments if d.status == "failed"),
        }


k8s_deployment_service = K8sDeploymentService()
