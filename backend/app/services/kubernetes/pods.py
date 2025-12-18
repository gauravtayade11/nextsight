"""Pod-related Kubernetes operations."""

import logging
from typing import List, Optional

from kubernetes.client.rest import ApiException

from app.services.kubernetes.base import KubernetesBase
from app.core.cache import cache_service, CacheConfig
from app.schemas.kubernetes import (
    PodInfo,
    PodPhase,
    PodLogResponse,
    PodMetrics,
    ContainerMetrics,
    K8sEvent,
)

logger = logging.getLogger(__name__)


class PodService(KubernetesBase):
    """Service for Pod-related operations."""

    async def get_pods(self, namespace: Optional[str] = None) -> List[PodInfo]:
        """Get all pods, optionally filtered by namespace."""
        cache_key = f"k8s:pods:{namespace or 'all'}"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [PodInfo(**p) for p in cached]

        try:
            if namespace:
                pods = self.core_v1.list_namespaced_pod(namespace)
            else:
                pods = self.core_v1.list_pod_for_all_namespaces()

            result = []
            for pod in pods.items:
                ready_containers = sum(
                    1 for cs in (pod.status.container_statuses or []) if cs.ready
                )
                total_containers = len(pod.spec.containers)
                restarts = sum(
                    cs.restart_count for cs in (pod.status.container_statuses or [])
                )

                result.append(
                    PodInfo(
                        name=pod.metadata.name,
                        namespace=pod.metadata.namespace,
                        status=PodPhase(pod.status.phase),
                        ready=ready_containers == total_containers,
                        restarts=restarts,
                        age=self.calculate_age(pod.metadata.creation_timestamp),
                        node=pod.spec.node_name,
                        ip=pod.status.pod_ip,
                        containers=[c.name for c in pod.spec.containers],
                    )
                )
            await cache_service.set(
                cache_key, [r.model_dump() for r in result], CacheConfig.PODS
            )
            return result
        except ApiException as e:
            logger.error(f"Error listing pods: {e}")
            raise

    async def get_pod(self, namespace: str, pod_name: str) -> Optional[PodInfo]:
        """Get a specific pod by name."""
        pods = await self.get_pods(namespace)
        return next((p for p in pods if p.name == pod_name), None)

    async def get_pod_logs(
        self,
        namespace: str,
        pod_name: str,
        container: Optional[str] = None,
        tail_lines: int = 100,
        previous: bool = False,
    ) -> PodLogResponse:
        """Get logs from a pod."""
        try:
            logs = self.core_v1.read_namespaced_pod_log(
                name=pod_name,
                namespace=namespace,
                container=container,
                tail_lines=tail_lines,
                previous=previous,
            )
            return PodLogResponse(
                pod_name=pod_name,
                namespace=namespace,
                container=container,
                logs=logs or "",
            )
        except ApiException as e:
            logger.error(f"Error getting pod logs: {e}")
            raise

    async def get_pod_metrics(
        self, namespace: Optional[str] = None
    ) -> List[PodMetrics]:
        """Get metrics for pods using metrics-server."""
        try:
            from kubernetes import client as k8s_client

            custom_api = k8s_client.CustomObjectsApi(self._api_client)

            if namespace:
                metrics = custom_api.list_namespaced_custom_object(
                    group="metrics.k8s.io",
                    version="v1beta1",
                    namespace=namespace,
                    plural="pods",
                )
            else:
                metrics = custom_api.list_cluster_custom_object(
                    group="metrics.k8s.io", version="v1beta1", plural="pods"
                )

            result = []
            for item in metrics.get("items", []):
                containers = []
                for container in item.get("containers", []):
                    cpu_str = container.get("usage", {}).get("cpu", "0")
                    memory_str = container.get("usage", {}).get("memory", "0")

                    cpu_nano = int(cpu_str.rstrip("n")) if "n" in cpu_str else 0
                    cpu_milli = cpu_nano / 1_000_000

                    if "Ki" in memory_str:
                        memory_bytes = int(memory_str.rstrip("Ki")) * 1024
                    elif "Mi" in memory_str:
                        memory_bytes = int(memory_str.rstrip("Mi")) * 1024 * 1024
                    elif "Gi" in memory_str:
                        memory_bytes = int(memory_str.rstrip("Gi")) * 1024 * 1024 * 1024
                    else:
                        memory_bytes = int(memory_str) if memory_str.isdigit() else 0

                    containers.append(
                        ContainerMetrics(
                            name=container.get("name", ""),
                            cpu_usage=f"{cpu_milli:.1f}m",
                            memory_usage=f"{memory_bytes // (1024 * 1024)}Mi",
                        )
                    )

                result.append(
                    PodMetrics(
                        name=item["metadata"]["name"],
                        namespace=item["metadata"]["namespace"],
                        containers=containers,
                    )
                )
            return result
        except ApiException as e:
            if e.status == 404:
                logger.warning("Metrics server not available")
                return []
            logger.error(f"Error getting pod metrics: {e}")
            raise

    async def get_pod_events(self, namespace: str, pod_name: str) -> List[K8sEvent]:
        """Get events for a specific pod."""
        try:
            events = self.core_v1.list_namespaced_event(
                namespace=namespace,
                field_selector=f"involvedObject.name={pod_name}",
            )
            return [
                K8sEvent(
                    type=event.type or "Normal",
                    reason=event.reason or "",
                    message=event.message or "",
                    first_timestamp=event.first_timestamp,
                    last_timestamp=event.last_timestamp,
                    count=event.count or 1,
                    source=event.source.component if event.source else None,
                    object_kind=event.involved_object.kind
                    if event.involved_object
                    else None,
                    object_name=event.involved_object.name
                    if event.involved_object
                    else None,
                    namespace=namespace,
                )
                for event in events.items
            ]
        except ApiException as e:
            logger.error(f"Error getting pod events: {e}")
            raise
