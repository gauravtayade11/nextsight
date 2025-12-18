"""Deployment-related Kubernetes operations."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from kubernetes.client.rest import ApiException

from app.services.kubernetes.base import KubernetesBase
from app.core.cache import cache_service, CacheConfig
from app.schemas.kubernetes import (
    DeploymentInfo,
    ResourceDeleteResponse,
)

logger = logging.getLogger(__name__)


class DeploymentService(KubernetesBase):
    """Service for Deployment-related operations."""

    async def get_deployments(
        self, namespace: Optional[str] = None
    ) -> List[DeploymentInfo]:
        """Get all deployments, optionally filtered by namespace."""
        cache_key = f"k8s:deployments:{namespace or 'all'}"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [DeploymentInfo(**d) for d in cached]

        try:
            if namespace:
                deployments = self.apps_v1.list_namespaced_deployment(namespace)
            else:
                deployments = self.apps_v1.list_deployment_for_all_namespaces()

            result = []
            for dep in deployments.items:
                result.append(
                    DeploymentInfo(
                        name=dep.metadata.name,
                        namespace=dep.metadata.namespace,
                        replicas=dep.spec.replicas or 0,
                        ready_replicas=dep.status.ready_replicas or 0,
                        available_replicas=dep.status.available_replicas or 0,
                        image=dep.spec.template.spec.containers[0].image
                        if dep.spec.template.spec.containers
                        else None,
                        age=self.calculate_age(dep.metadata.creation_timestamp),
                        labels=dep.metadata.labels or {},
                    )
                )
            await cache_service.set(
                cache_key, [r.model_dump() for r in result], CacheConfig.DEPLOYMENTS
            )
            return result
        except ApiException as e:
            logger.error(f"Error listing deployments: {e}")
            raise

    async def get_deployment(
        self, namespace: str, name: str
    ) -> Optional[DeploymentInfo]:
        """Get a specific deployment by name."""
        try:
            dep = self.apps_v1.read_namespaced_deployment(name, namespace)
            return DeploymentInfo(
                name=dep.metadata.name,
                namespace=dep.metadata.namespace,
                replicas=dep.spec.replicas or 0,
                ready_replicas=dep.status.ready_replicas or 0,
                available_replicas=dep.status.available_replicas or 0,
                image=dep.spec.template.spec.containers[0].image
                if dep.spec.template.spec.containers
                else None,
                age=self.calculate_age(dep.metadata.creation_timestamp),
                labels=dep.metadata.labels or {},
            )
        except ApiException as e:
            if e.status == 404:
                return None
            logger.error(f"Error getting deployment: {e}")
            raise

    async def delete_deployment(
        self, namespace: str, name: str
    ) -> ResourceDeleteResponse:
        """Delete a deployment."""
        try:
            self.apps_v1.delete_namespaced_deployment(name, namespace)
            return ResourceDeleteResponse(
                success=True, message=f"Deployment {name} deleted successfully"
            )
        except ApiException as e:
            logger.error(f"Error deleting deployment: {e}")
            raise

    async def scale_deployment(
        self, namespace: str, deployment_name: str, replicas: int
    ) -> Dict[str, Any]:
        """Scale a deployment to the specified number of replicas."""
        try:
            body = {"spec": {"replicas": replicas}}
            self.apps_v1.patch_namespaced_deployment_scale(
                deployment_name, namespace, body
            )
            return {"success": True, "replicas": replicas}
        except ApiException as e:
            logger.error(f"Error scaling deployment: {e}")
            raise

    async def restart_deployment(
        self, namespace: str, deployment_name: str
    ) -> Dict[str, Any]:
        """Restart a deployment by updating the pod template annotation."""
        try:
            body = {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": datetime.now(
                                    timezone.utc
                                ).isoformat()
                            }
                        }
                    }
                }
            }
            self.apps_v1.patch_namespaced_deployment(deployment_name, namespace, body)
            return {"success": True, "message": "Deployment restart initiated"}
        except ApiException as e:
            logger.error(f"Error restarting deployment: {e}")
            raise

    async def get_deployment_revisions(
        self, namespace: str, deployment_name: str
    ) -> List[Dict[str, Any]]:
        """Get revision history for a deployment."""
        try:
            # Get ReplicaSets owned by this deployment
            replica_sets = self.apps_v1.list_namespaced_replica_set(namespace)

            revisions = []
            for rs in replica_sets.items:
                # Check if this RS belongs to our deployment
                owner_refs = rs.metadata.owner_references or []
                is_owned = any(
                    ref.kind == "Deployment" and ref.name == deployment_name
                    for ref in owner_refs
                )

                if is_owned:
                    revision = rs.metadata.annotations.get(
                        "deployment.kubernetes.io/revision"
                    )
                    if revision:
                        change_cause = rs.metadata.annotations.get(
                            "kubernetes.io/change-cause", "<none>"
                        )
                        image = None
                        if rs.spec.template.spec.containers:
                            image = rs.spec.template.spec.containers[0].image

                        revisions.append(
                            {
                                "revision": int(revision),
                                "change_cause": change_cause,
                                "image": image,
                                "created_at": rs.metadata.creation_timestamp,
                                "replicas": rs.spec.replicas or 0,
                            }
                        )

            # Sort by revision number descending
            revisions.sort(key=lambda x: x["revision"], reverse=True)
            return revisions
        except ApiException as e:
            logger.error(f"Error getting deployment revisions: {e}")
            raise

    async def rollback_deployment_to_revision(
        self, namespace: str, deployment_name: str, revision: int
    ) -> Dict[str, Any]:
        """Rollback a deployment to a specific revision."""
        try:
            # Get the ReplicaSet for the target revision
            replica_sets = self.apps_v1.list_namespaced_replica_set(namespace)

            target_rs = None
            for rs in replica_sets.items:
                owner_refs = rs.metadata.owner_references or []
                is_owned = any(
                    ref.kind == "Deployment" and ref.name == deployment_name
                    for ref in owner_refs
                )

                if is_owned:
                    rs_revision = rs.metadata.annotations.get(
                        "deployment.kubernetes.io/revision"
                    )
                    if rs_revision and int(rs_revision) == revision:
                        target_rs = rs
                        break

            if not target_rs:
                raise ValueError(f"Revision {revision} not found")

            # Get the current deployment
            deployment = self.apps_v1.read_namespaced_deployment(
                deployment_name, namespace
            )

            # Update deployment with the target RS's pod template
            deployment.spec.template = target_rs.spec.template

            # Add rollback annotation
            if deployment.metadata.annotations is None:
                deployment.metadata.annotations = {}
            deployment.metadata.annotations["kubernetes.io/change-cause"] = (
                f"Rollback to revision {revision}"
            )

            self.apps_v1.replace_namespaced_deployment(
                deployment_name, namespace, deployment
            )

            return {
                "success": True,
                "message": f"Deployment rolled back to revision {revision}",
            }
        except ApiException as e:
            logger.error(f"Error rolling back deployment: {e}")
            raise
