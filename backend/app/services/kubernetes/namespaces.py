"""Namespace-related Kubernetes operations."""

import logging
from typing import List

from kubernetes import client
from kubernetes.client.rest import ApiException

from app.services.kubernetes.base import KubernetesBase
from app.core.cache import cache_service, CacheConfig
from app.schemas.kubernetes import NamespaceInfo

logger = logging.getLogger(__name__)


class NamespaceService(KubernetesBase):
    """Service for Namespace-related operations."""

    async def get_namespaces(self) -> List[NamespaceInfo]:
        """Get all namespaces."""
        cache_key = "k8s:namespaces"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [NamespaceInfo(**ns) for ns in cached]

        try:
            namespaces = self.core_v1.list_namespace()
            result = [
                NamespaceInfo(
                    name=ns.metadata.name,
                    status=ns.status.phase,
                    created_at=ns.metadata.creation_timestamp,
                    labels=ns.metadata.labels or {},
                )
                for ns in namespaces.items
            ]
            await cache_service.set(
                cache_key, [r.model_dump() for r in result], CacheConfig.NAMESPACES
            )
            return result
        except ApiException as e:
            logger.error(f"Error listing namespaces: {e}")
            raise

    async def get_namespaces_with_details(self) -> List["NamespaceDetail"]:
        """Get all namespaces with resource counts."""
        from app.schemas.kubernetes import NamespaceDetail

        try:
            namespaces = self.core_v1.list_namespace()
            result = []

            for ns in namespaces.items:
                ns_name = ns.metadata.name

                # Get resource counts for this namespace
                try:
                    pods = self.core_v1.list_namespaced_pod(ns_name)
                    pod_count = len(pods.items)
                except Exception:
                    pod_count = 0

                try:
                    deployments = self.apps_v1.list_namespaced_deployment(ns_name)
                    deployment_count = len(deployments.items)
                except Exception:
                    deployment_count = 0

                try:
                    services = self.core_v1.list_namespaced_service(ns_name)
                    service_count = len(services.items)
                except Exception:
                    service_count = 0

                try:
                    configmaps = self.core_v1.list_namespaced_config_map(ns_name)
                    configmap_count = len(configmaps.items)
                except Exception:
                    configmap_count = 0

                try:
                    secrets = self.core_v1.list_namespaced_secret(ns_name)
                    secret_count = len(secrets.items)
                except Exception:
                    secret_count = 0

                age = self.calculate_age(ns.metadata.creation_timestamp)

                result.append(
                    NamespaceDetail(
                        name=ns_name,
                        status=ns.status.phase,
                        created_at=ns.metadata.creation_timestamp,
                        labels=ns.metadata.labels or {},
                        age=age,
                        pods=pod_count,
                        deployments=deployment_count,
                        services=service_count,
                        configmaps=configmap_count,
                        secrets=secret_count,
                    )
                )

            return result
        except ApiException as e:
            logger.error(f"Error listing namespaces with details: {e}")
            raise

    async def create_namespace(self, request: "NamespaceCreateRequest") -> NamespaceInfo:
        """Create a new namespace."""
        from app.schemas.kubernetes import NamespaceCreateRequest

        try:
            namespace = client.V1Namespace(
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    labels=request.labels or None,
                )
            )

            created = self.core_v1.create_namespace(namespace)

            return NamespaceInfo(
                name=created.metadata.name,
                status=created.status.phase,
                created_at=created.metadata.creation_timestamp,
                labels=created.metadata.labels or {},
            )
        except ApiException as e:
            logger.error(f"Error creating namespace {request.name}: {e}")
            raise

    async def delete_namespace(self, name: str) -> bool:
        """Delete a namespace."""
        try:
            self.core_v1.delete_namespace(name)
            return True
        except ApiException as e:
            logger.error(f"Error deleting namespace {name}: {e}")
            raise
