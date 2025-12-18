import base64
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from app.core.config import settings
from app.core.cache import cache_service, CacheConfig
from app.utils.security import validate_shell_command, validate_path_safe
from app.schemas.kubernetes import (
    AppliedResourceInfo,
    ClusterMetrics,
    ConfigMapInfo,
    ContainerMetrics,
    CronJobInfo,
    DaemonSetInfo,
    DeploymentInfo,
    HPAInfo,
    IngressInfo,
    IngressRule,
    IngressCreateRequest,
    IngressUpdateRequest,
    JobInfo,
    K8sClusterHealth,
    K8sEvent,
    KubectlResponse,
    NamespaceInfo,
    NodeCondition,
    NodeInfo,
    NodeMetrics,
    NodeResources,
    PodExecResponse,
    PodInfo,
    PodLogResponse,
    PodMetrics,
    PodPhase,
    PVCInfo,
    PVCCreateRequest,
    PVCUpdateRequest,
    PVInfo,
    ResourceDeleteResponse,
    ResourceYAMLResponse,
    SecretInfo,
    SecretDetail,
    SecretCreateRequest,
    SecretUpdateRequest,
    ServiceInfo,
    ServiceCreateRequest,
    ServiceUpdateRequest,
    ShellResponse,
    StatefulSetInfo,
    StorageClassInfo,
    StorageClassCreateRequest,
    StorageClassUpdateRequest,
    PVCreateRequest,
    YAMLApplyResponse,
)

logger = logging.getLogger(__name__)


class KubernetesService:
    def __init__(self):
        self._api_client = None
        self._core_v1 = None
        self._apps_v1 = None
        self._networking_v1 = None
        self._batch_v1 = None
        self._autoscaling_v1 = None
        self._storage_v1 = None
        self._initialized = False

    def _initialize(self):
        if self._initialized:
            return

        try:
            if settings.K8S_IN_CLUSTER:
                config.load_incluster_config()
            elif settings.K8S_CONFIG_PATH:
                # Expand ~ to home directory
                config_path = os.path.expanduser(settings.K8S_CONFIG_PATH)
                config.load_kube_config(config_file=config_path)
            else:
                config.load_kube_config()

            # Override host for Docker Desktop compatibility
            if settings.K8S_HOST_OVERRIDE:
                configuration = client.Configuration.get_default_copy()
                if configuration.host:
                    # Replace localhost/127.0.0.1 with override host
                    configuration.host = configuration.host.replace("127.0.0.1", settings.K8S_HOST_OVERRIDE).replace(
                        "localhost", settings.K8S_HOST_OVERRIDE
                    )
                    client.Configuration.set_default(configuration)
                    logger.info(f"K8s host overridden to: {configuration.host}")

            self._api_client = client.ApiClient()
            self._core_v1 = client.CoreV1Api(self._api_client)
            self._apps_v1 = client.AppsV1Api(self._api_client)
            self._networking_v1 = client.NetworkingV1Api(self._api_client)
            self._batch_v1 = client.BatchV1Api(self._api_client)
            self._autoscaling_v1 = client.AutoscalingV1Api(self._api_client)
            self._storage_v1 = client.StorageV1Api(self._api_client)
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Kubernetes client: {e}")
            raise

    def _calculate_age(self, created_at: datetime) -> str:
        if not created_at:
            return "Unknown"
        now = datetime.now(timezone.utc)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        delta = now - created_at
        days = delta.days
        hours = delta.seconds // 3600
        minutes = (delta.seconds % 3600) // 60

        if days > 0:
            return f"{days}d"
        elif hours > 0:
            return f"{hours}h"
        else:
            return f"{minutes}m"

    async def get_namespaces(self) -> List[NamespaceInfo]:
        # Check cache first
        cache_key = "k8s:namespaces"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [NamespaceInfo(**ns) for ns in cached]

        self._initialize()
        try:
            namespaces = self._core_v1.list_namespace()
            result = [
                NamespaceInfo(
                    name=ns.metadata.name,
                    status=ns.status.phase,
                    created_at=ns.metadata.creation_timestamp,
                    labels=ns.metadata.labels or {},
                )
                for ns in namespaces.items
            ]
            # Cache for 5 minutes
            await cache_service.set(cache_key, [r.model_dump() for r in result], CacheConfig.NAMESPACES)
            return result
        except ApiException as e:
            logger.error(f"Error listing namespaces: {e}")
            raise

    async def get_namespaces_with_details(self) -> List["NamespaceDetail"]:
        """Get all namespaces with resource counts."""
        from app.schemas.kubernetes import NamespaceDetail
        self._initialize()
        try:
            namespaces = self._core_v1.list_namespace()
            result = []

            for ns in namespaces.items:
                ns_name = ns.metadata.name

                # Get resource counts for this namespace
                try:
                    pods = self._core_v1.list_namespaced_pod(ns_name)
                    pod_count = len(pods.items)
                except Exception:
                    pod_count = 0

                try:
                    deployments = self._apps_v1.list_namespaced_deployment(ns_name)
                    deployment_count = len(deployments.items)
                except Exception:
                    deployment_count = 0

                try:
                    services = self._core_v1.list_namespaced_service(ns_name)
                    service_count = len(services.items)
                except Exception:
                    service_count = 0

                try:
                    configmaps = self._core_v1.list_namespaced_config_map(ns_name)
                    configmap_count = len(configmaps.items)
                except Exception:
                    configmap_count = 0

                try:
                    secrets = self._core_v1.list_namespaced_secret(ns_name)
                    secret_count = len(secrets.items)
                except Exception:
                    secret_count = 0

                age = self._calculate_age(ns.metadata.creation_timestamp)

                result.append(NamespaceDetail(
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
                ))

            return result
        except ApiException as e:
            logger.error(f"Error listing namespaces with details: {e}")
            raise

    async def create_namespace(self, request: "NamespaceCreateRequest") -> NamespaceInfo:
        """Create a new namespace."""
        from app.schemas.kubernetes import NamespaceCreateRequest
        self._initialize()
        try:
            namespace = client.V1Namespace(
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    labels=request.labels or None,
                )
            )

            created = self._core_v1.create_namespace(namespace)

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
        self._initialize()
        try:
            self._core_v1.delete_namespace(name)
            return True
        except ApiException as e:
            logger.error(f"Error deleting namespace {name}: {e}")
            raise

    async def get_pods(self, namespace: Optional[str] = None) -> List[PodInfo]:
        # Check cache first
        cache_key = f"k8s:pods:{namespace or 'all'}"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [PodInfo(**p) for p in cached]

        self._initialize()
        try:
            if namespace:
                pods = self._core_v1.list_namespaced_pod(namespace)
            else:
                pods = self._core_v1.list_pod_for_all_namespaces()

            result = []
            for pod in pods.items:
                ready_containers = sum(1 for cs in (pod.status.container_statuses or []) if cs.ready)
                total_containers = len(pod.spec.containers)
                restarts = sum(cs.restart_count for cs in (pod.status.container_statuses or []))

                result.append(
                    PodInfo(
                        name=pod.metadata.name,
                        namespace=pod.metadata.namespace,
                        status=PodPhase(pod.status.phase),
                        ready=ready_containers == total_containers,
                        restarts=restarts,
                        age=self._calculate_age(pod.metadata.creation_timestamp),
                        node=pod.spec.node_name,
                        ip=pod.status.pod_ip,
                        containers=[c.name for c in pod.spec.containers],
                    )
                )
            # Cache for 30 seconds
            await cache_service.set(cache_key, [r.model_dump() for r in result], CacheConfig.PODS)
            return result
        except ApiException as e:
            logger.error(f"Error listing pods: {e}")
            raise

    async def get_pods_on_node(self, node_name: str) -> List[PodInfo]:
        """Get all pods running on a specific node."""
        # Check cache first
        cache_key = f"k8s:pods:node:{node_name}"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [PodInfo(**p) for p in cached]

        self._initialize()
        try:
            # Use field selector to filter pods by node
            pods = self._core_v1.list_pod_for_all_namespaces(
                field_selector=f"spec.nodeName={node_name}"
            )

            result = []
            for pod in pods.items:
                ready_containers = sum(1 for cs in (pod.status.container_statuses or []) if cs.ready)
                total_containers = len(pod.spec.containers)
                restarts = sum(cs.restart_count for cs in (pod.status.container_statuses or []))

                result.append(
                    PodInfo(
                        name=pod.metadata.name,
                        namespace=pod.metadata.namespace,
                        status=PodPhase(pod.status.phase),
                        ready=ready_containers == total_containers,
                        restarts=restarts,
                        age=self._calculate_age(pod.metadata.creation_timestamp),
                        node=pod.spec.node_name,
                        ip=pod.status.pod_ip,
                        containers=[c.name for c in pod.spec.containers],
                    )
                )
            # Cache for 30 seconds
            await cache_service.set(cache_key, [r.model_dump() for r in result], CacheConfig.PODS)
            return result
        except ApiException as e:
            logger.error(f"Error listing pods on node {node_name}: {e}")
            raise

    async def get_deployments(self, namespace: Optional[str] = None) -> List[DeploymentInfo]:
        # Check cache first
        cache_key = f"k8s:deployments:{namespace or 'all'}"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [DeploymentInfo(**d) for d in cached]

        self._initialize()
        try:
            if namespace:
                deployments = self._apps_v1.list_namespaced_deployment(namespace)
            else:
                deployments = self._apps_v1.list_deployment_for_all_namespaces()

            result = []
            for dep in deployments.items:
                image = None
                if dep.spec.template.spec.containers:
                    image = dep.spec.template.spec.containers[0].image

                result.append(
                    DeploymentInfo(
                        name=dep.metadata.name,
                        namespace=dep.metadata.namespace,
                        replicas=dep.spec.replicas or 0,
                        ready_replicas=dep.status.ready_replicas or 0,
                        available_replicas=dep.status.available_replicas or 0,
                        image=image,
                        age=self._calculate_age(dep.metadata.creation_timestamp),
                        labels=dep.metadata.labels or {},
                    )
                )
            # Cache for 1 minute
            await cache_service.set(cache_key, [r.model_dump() for r in result], CacheConfig.DEPLOYMENTS)
            return result
        except ApiException as e:
            logger.error(f"Error listing deployments: {e}")
            raise

    async def get_deployment(self, namespace: str, name: str) -> Optional[DeploymentInfo]:
        """Get a specific deployment by name."""
        self._initialize()
        try:
            dep = self._apps_v1.read_namespaced_deployment(name, namespace)
            image = None
            if dep.spec.template.spec.containers:
                image = dep.spec.template.spec.containers[0].image

            return DeploymentInfo(
                name=dep.metadata.name,
                namespace=dep.metadata.namespace,
                replicas=dep.spec.replicas or 0,
                ready_replicas=dep.status.ready_replicas or 0,
                available_replicas=dep.status.available_replicas or 0,
                image=image,
                age=self._calculate_age(dep.metadata.creation_timestamp),
                labels=dep.metadata.labels or {},
            )
        except ApiException as e:
            if e.status == 404:
                return None
            logger.error(f"Error getting deployment {namespace}/{name}: {e}")
            raise

    async def delete_deployment(self, namespace: str, name: str) -> ResourceDeleteResponse:
        """Delete a deployment."""
        self._initialize()
        try:
            self._apps_v1.delete_namespaced_deployment(name, namespace)
            return ResourceDeleteResponse(
                success=True,
                message=f"Deployment {namespace}/{name} deleted successfully",
                kind="Deployment",
                name=name,
                namespace=namespace,
            )
        except ApiException as e:
            logger.error(f"Error deleting deployment {namespace}/{name}: {e}")
            raise

    async def get_services(self, namespace: Optional[str] = None) -> List[ServiceInfo]:
        # Check cache first
        cache_key = f"k8s:services:{namespace or 'all'}"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [ServiceInfo(**s) for s in cached]

        self._initialize()
        try:
            if namespace:
                services = self._core_v1.list_namespaced_service(namespace)
            else:
                services = self._core_v1.list_service_for_all_namespaces()

            result = []
            for svc in services.items:
                ports = []
                for port in svc.spec.ports or []:
                    ports.append(
                        {
                            "port": port.port,
                            "target_port": str(port.target_port),
                            "protocol": port.protocol,
                            "name": port.name,
                        }
                    )

                external_ips = svc.status.load_balancer.ingress if svc.status.load_balancer else None
                external_ip = None
                if external_ips and len(external_ips) > 0:
                    external_ip = external_ips[0].ip or external_ips[0].hostname

                result.append(
                    ServiceInfo(
                        name=svc.metadata.name,
                        namespace=svc.metadata.namespace,
                        type=svc.spec.type,
                        cluster_ip=svc.spec.cluster_ip,
                        external_ip=external_ip,
                        ports=ports,
                    )
                )

            # Cache for 2 minutes
            await cache_service.set(cache_key, [r.model_dump() for r in result], CacheConfig.SERVICES)
            return result
        except ApiException as e:
            logger.error(f"Error listing services: {e}")
            raise

    async def create_service(self, request: ServiceCreateRequest) -> ServiceInfo:
        """Create a new Kubernetes Service."""
        self._initialize()
        try:
            # Build service ports
            ports = []
            for p in request.ports:
                port = client.V1ServicePort(
                    name=p.name,
                    port=p.port,
                    target_port=p.target_port,
                    protocol=p.protocol,
                )
                if request.type == "NodePort" and p.node_port:
                    port.node_port = p.node_port
                ports.append(port)

            # Build service spec
            service = client.V1Service(
                api_version="v1",
                kind="Service",
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    namespace=request.namespace,
                    labels=request.labels or None,
                    annotations=request.annotations or None,
                ),
                spec=client.V1ServiceSpec(
                    type=request.type,
                    selector=request.selector if request.selector else None,
                    ports=ports if ports else None,
                ),
            )

            created = self._core_v1.create_namespaced_service(request.namespace, service)

            return ServiceInfo(
                name=created.metadata.name,
                namespace=created.metadata.namespace,
                type=created.spec.type,
                cluster_ip=created.spec.cluster_ip,
                external_ip=None,
                ports=[
                    {
                        "port": p.port,
                        "target_port": str(p.target_port),
                        "protocol": p.protocol,
                        "name": p.name,
                    }
                    for p in (created.spec.ports or [])
                ],
            )
        except ApiException as e:
            logger.error(f"Error creating service {request.namespace}/{request.name}: {e}")
            raise

    async def update_service(self, namespace: str, name: str, request: ServiceUpdateRequest) -> ServiceInfo:
        """Update an existing Kubernetes Service."""
        self._initialize()
        try:
            # Get existing service
            existing = self._core_v1.read_namespaced_service(name, namespace)

            # Update fields if provided
            if request.type is not None:
                existing.spec.type = request.type

            if request.selector is not None:
                existing.spec.selector = request.selector

            if request.ports is not None:
                ports = []
                for p in request.ports:
                    port = client.V1ServicePort(
                        name=p.name,
                        port=p.port,
                        target_port=p.target_port,
                        protocol=p.protocol,
                    )
                    if existing.spec.type == "NodePort" and p.node_port:
                        port.node_port = p.node_port
                    ports.append(port)
                existing.spec.ports = ports

            if request.labels is not None:
                existing.metadata.labels = request.labels

            if request.annotations is not None:
                existing.metadata.annotations = request.annotations

            updated = self._core_v1.replace_namespaced_service(name, namespace, existing)

            external_ips = updated.status.load_balancer.ingress if updated.status.load_balancer else None
            external_ip = None
            if external_ips and len(external_ips) > 0:
                external_ip = external_ips[0].ip or external_ips[0].hostname

            return ServiceInfo(
                name=updated.metadata.name,
                namespace=updated.metadata.namespace,
                type=updated.spec.type,
                cluster_ip=updated.spec.cluster_ip,
                external_ip=external_ip,
                ports=[
                    {
                        "port": p.port,
                        "target_port": str(p.target_port),
                        "protocol": p.protocol,
                        "name": p.name,
                    }
                    for p in (updated.spec.ports or [])
                ],
            )
        except ApiException as e:
            logger.error(f"Error updating service {namespace}/{name}: {e}")
            raise

    async def delete_service(self, namespace: str, name: str) -> ResourceDeleteResponse:
        """Delete a Kubernetes Service."""
        self._initialize()
        try:
            self._core_v1.delete_namespaced_service(name, namespace)
            return ResourceDeleteResponse(
                success=True,
                message=f"Service {namespace}/{name} deleted successfully",
                kind="Service",
                name=name,
                namespace=namespace,
            )
        except ApiException as e:
            logger.error(f"Error deleting service {namespace}/{name}: {e}")
            raise

    async def get_events(self, namespace: Optional[str] = None, limit: int = 100) -> List[K8sEvent]:
        # Check cache first (short TTL for events - 15 seconds)
        cache_key = f"k8s:events:{namespace or 'all'}:{limit}"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [K8sEvent(**e) for e in cached]

        self._initialize()
        try:
            if namespace:
                events = self._core_v1.list_namespaced_event(namespace, limit=limit)
            else:
                events = self._core_v1.list_event_for_all_namespaces(limit=limit)

            result = []
            for event in events.items:
                result.append(
                    K8sEvent(
                        name=event.metadata.name,
                        namespace=event.metadata.namespace,
                        type=event.type or "Normal",
                        reason=event.reason or "",
                        message=event.message or "",
                        count=event.count or 1,
                        first_timestamp=event.first_timestamp,
                        last_timestamp=event.last_timestamp,
                        involved_object={
                            "kind": event.involved_object.kind,
                            "name": event.involved_object.name,
                            "namespace": event.involved_object.namespace or "",
                        },
                    )
                )

            # Cache for 15 seconds (events change frequently)
            await cache_service.set(cache_key, [r.model_dump() for r in result], CacheConfig.EVENTS)
            return result
        except ApiException as e:
            logger.error(f"Error listing events: {e}")
            raise

    async def get_pod_events(self, namespace: str, pod_name: str) -> List[K8sEvent]:
        """Get events for a specific pod."""
        self._initialize()
        try:
            # Use field selector to filter events for this specific pod
            field_selector = f"involvedObject.name={pod_name},involvedObject.kind=Pod"
            events = self._core_v1.list_namespaced_event(namespace, field_selector=field_selector)

            result = []
            for event in events.items:
                result.append(
                    K8sEvent(
                        name=event.metadata.name,
                        namespace=event.metadata.namespace,
                        type=event.type or "Normal",
                        reason=event.reason or "",
                        message=event.message or "",
                        count=event.count or 1,
                        first_timestamp=event.first_timestamp,
                        last_timestamp=event.last_timestamp,
                        involved_object={
                            "kind": event.involved_object.kind,
                            "name": event.involved_object.name,
                            "namespace": event.involved_object.namespace or "",
                        },
                    )
                )
            # Sort by last_timestamp descending (most recent first)
            result.sort(key=lambda x: x.last_timestamp or x.first_timestamp or datetime.min, reverse=True)
            return result
        except ApiException as e:
            logger.error(f"Error listing pod events: {e}")
            raise

    async def scale_deployment(self, namespace: str, deployment_name: str, replicas: int) -> Dict[str, Any]:
        self._initialize()
        try:
            body = {"spec": {"replicas": replicas}}
            self._apps_v1.patch_namespaced_deployment_scale(name=deployment_name, namespace=namespace, body=body)
            return {
                "success": True,
                "message": f"Scaled {deployment_name} to {replicas} replicas",
                "deployment": deployment_name,
                "namespace": namespace,
                "replicas": replicas,
            }
        except ApiException as e:
            logger.error(f"Error scaling deployment: {e}")
            raise

    async def restart_deployment(self, namespace: str, deployment_name: str) -> Dict[str, Any]:
        self._initialize()
        try:
            now = datetime.now(timezone.utc).isoformat()
            body = {"spec": {"template": {"metadata": {"annotations": {"kubectl.kubernetes.io/restartedAt": now}}}}}
            self._apps_v1.patch_namespaced_deployment(name=deployment_name, namespace=namespace, body=body)
            return {
                "success": True,
                "message": f"Restarted deployment {deployment_name}",
                "deployment": deployment_name,
                "namespace": namespace,
                "timestamp": now,
            }
        except ApiException as e:
            logger.error(f"Error restarting deployment: {e}")
            raise

    async def get_cluster_health(self) -> K8sClusterHealth:
        # Check cache first (short TTL for health data)
        cache_key = "k8s:cluster_health"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return K8sClusterHealth(**cached)

        self._initialize()
        try:
            nodes = self._core_v1.list_node()
            pods = self._core_v1.list_pod_for_all_namespaces()
            namespaces = self._core_v1.list_namespace()

            ready_nodes = 0
            warnings = []

            for node in nodes.items:
                for condition in node.status.conditions:
                    if condition.type == "Ready" and condition.status == "True":
                        ready_nodes += 1
                        break

            running_pods = sum(1 for p in pods.items if p.status.phase == "Running")

            if ready_nodes < len(nodes.items):
                warnings.append(f"Only {ready_nodes}/{len(nodes.items)} nodes are ready")

            failed_pods = sum(1 for p in pods.items if p.status.phase == "Failed")
            if failed_pods > 0:
                warnings.append(f"{failed_pods} pods are in Failed state")

            result = K8sClusterHealth(
                healthy=ready_nodes == len(nodes.items) and len(warnings) == 0,
                node_count=len(nodes.items),
                ready_nodes=ready_nodes,
                total_pods=len(pods.items),
                running_pods=running_pods,
                namespaces=len(namespaces.items),
                warnings=warnings,
            )
            # Cache for 10 seconds (cluster health changes frequently)
            await cache_service.set(cache_key, result.model_dump(), CacheConfig.CLUSTER_METRICS)
            return result
        except ApiException as e:
            logger.error(f"Error getting cluster health: {e}")
            raise

    async def get_nodes(self) -> List[NodeInfo]:
        """Get all nodes with detailed information."""
        # Check cache first
        cache_key = "k8s:nodes"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return [NodeInfo(**n) for n in cached]

        self._initialize()
        try:
            nodes = self._core_v1.list_node()
            result = []

            for node in nodes.items:
                # Determine node status
                status = "Unknown"
                conditions = []
                for condition in node.status.conditions:
                    conditions.append(
                        NodeCondition(
                            type=condition.type,
                            status=condition.status,
                            reason=condition.reason,
                            message=condition.message,
                        )
                    )
                    if condition.type == "Ready":
                        status = "Ready" if condition.status == "True" else "NotReady"

                # Extract roles from labels
                roles = []
                role_prefix = "node-role.kubernetes.io/"
                for label in node.metadata.labels or {}:
                    if label.startswith(role_prefix):
                        # Extract role name after the prefix
                        role_name = label[len(role_prefix):]
                        if role_name:  # Only add non-empty roles
                            roles.append(role_name)
                if not roles:
                    roles = ["worker"]

                # Get IPs
                internal_ip = None
                external_ip = None
                for addr in node.status.addresses or []:
                    if addr.type == "InternalIP":
                        internal_ip = addr.address
                    elif addr.type == "ExternalIP":
                        external_ip = addr.address

                # Get taints
                taints = []
                for taint in node.spec.taints or []:
                    taints.append({"key": taint.key, "value": taint.value or "", "effect": taint.effect})

                result.append(
                    NodeInfo(
                        name=node.metadata.name,
                        status=status,
                        roles=roles,
                        age=self._calculate_age(node.metadata.creation_timestamp),
                        version=node.status.node_info.kubelet_version,
                        os_image=node.status.node_info.os_image,
                        kernel_version=node.status.node_info.kernel_version,
                        container_runtime=node.status.node_info.container_runtime_version,
                        internal_ip=internal_ip,
                        external_ip=external_ip,
                        conditions=conditions,
                        capacity=NodeResources(
                            cpu=node.status.capacity.get("cpu", "0"),
                            memory=node.status.capacity.get("memory", "0"),
                            pods=node.status.capacity.get("pods", "0"),
                            storage=node.status.capacity.get("ephemeral-storage"),
                        ),
                        allocatable=NodeResources(
                            cpu=node.status.allocatable.get("cpu", "0"),
                            memory=node.status.allocatable.get("memory", "0"),
                            pods=node.status.allocatable.get("pods", "0"),
                            storage=node.status.allocatable.get("ephemeral-storage"),
                        ),
                        labels=node.metadata.labels or {},
                        taints=taints,
                    )
                )

            # Cache the result for 1 minute
            await cache_service.set(cache_key, [r.model_dump() for r in result], CacheConfig.NODES)
            return result
        except ApiException as e:
            logger.error(f"Error listing nodes: {e}")
            raise

    async def get_node(self, name: str) -> Optional[NodeInfo]:
        """Get a specific node by name."""
        nodes = await self.get_nodes()
        for node in nodes:
            if node.name == name:
                return node
        return None

    async def get_pod_logs(
        self,
        namespace: str,
        pod_name: str,
        container: Optional[str] = None,
        tail_lines: int = 100,
        since_seconds: Optional[int] = None,
        timestamps: bool = False,
        previous: bool = False,
    ) -> PodLogResponse:
        """Get logs from a pod container."""
        self._initialize()
        try:
            # If no container specified, get the first container
            if not container:
                pod = self._core_v1.read_namespaced_pod(name=pod_name, namespace=namespace)
                container = pod.spec.containers[0].name

            kwargs = {
                "name": pod_name,
                "namespace": namespace,
                "container": container,
                "tail_lines": tail_lines,
                "timestamps": timestamps,
                "previous": previous,
            }
            if since_seconds:
                kwargs["since_seconds"] = since_seconds

            logs = self._core_v1.read_namespaced_pod_log(**kwargs)

            # Check if logs were truncated
            truncated = len(logs.split("\n")) >= tail_lines

            return PodLogResponse(
                namespace=namespace, pod_name=pod_name, container=container, logs=logs, truncated=truncated
            )
        except ApiException as e:
            logger.error(f"Error getting pod logs: {e}")
            raise

    async def get_pod_metrics(self, namespace: Optional[str] = None) -> List[PodMetrics]:
        """Get resource metrics for pods (requires metrics-server)."""
        self._initialize()
        try:
            custom_api = client.CustomObjectsApi(self._api_client)

            if namespace:
                metrics = custom_api.list_namespaced_custom_object(
                    group="metrics.k8s.io", version="v1beta1", namespace=namespace, plural="pods"
                )
            else:
                metrics = custom_api.list_cluster_custom_object(
                    group="metrics.k8s.io", version="v1beta1", plural="pods"
                )

            result = []
            for item in metrics.get("items", []):
                containers = []
                total_cpu_nano = 0
                total_memory_bytes = 0

                for container in item.get("containers", []):
                    cpu = container.get("usage", {}).get("cpu", "0")
                    memory = container.get("usage", {}).get("memory", "0")

                    # Parse CPU (convert to nanocores)
                    cpu_nano = self._parse_cpu(cpu)
                    total_cpu_nano += cpu_nano

                    # Parse memory (convert to bytes)
                    memory_bytes = self._parse_memory(memory)
                    total_memory_bytes += memory_bytes

                    containers.append(
                        ContainerMetrics(
                            name=container.get("name", "unknown"),
                            cpu_usage=cpu,
                            cpu_percent=0,  # Would need limits to calculate
                            memory_usage=memory,
                            memory_percent=0,
                        )
                    )

                result.append(
                    PodMetrics(
                        name=item["metadata"]["name"],
                        namespace=item["metadata"]["namespace"],
                        containers=containers,
                        total_cpu=f"{total_cpu_nano // 1000000}m",
                        total_memory=self._format_memory(total_memory_bytes),
                        timestamp=datetime.now(timezone.utc),
                    )
                )

            return result
        except ApiException as e:
            if e.status == 404:
                logger.warning("Metrics server not available")
                return []
            logger.error(f"Error getting pod metrics: {e}")
            raise

    async def get_node_metrics(self) -> List[NodeMetrics]:
        """Get resource metrics for nodes (requires metrics-server)."""
        self._initialize()
        try:
            custom_api = client.CustomObjectsApi(self._api_client)
            metrics = custom_api.list_cluster_custom_object(group="metrics.k8s.io", version="v1beta1", plural="nodes")

            # Get node capacities
            nodes = self._core_v1.list_node()
            node_capacity = {}
            for node in nodes.items:
                node_capacity[node.metadata.name] = {
                    "cpu": self._parse_cpu(node.status.capacity.get("cpu", "0")),
                    "memory": self._parse_memory(node.status.capacity.get("memory", "0")),
                }

            result = []
            for item in metrics.get("items", []):
                name = item["metadata"]["name"]
                cpu_usage = item.get("usage", {}).get("cpu", "0")
                memory_usage = item.get("usage", {}).get("memory", "0")

                cpu_nano = self._parse_cpu(cpu_usage)
                memory_bytes = self._parse_memory(memory_usage)

                capacity = node_capacity.get(name, {"cpu": 1, "memory": 1})
                cpu_percent = (cpu_nano / capacity["cpu"] * 100) if capacity["cpu"] > 0 else 0
                memory_percent = (memory_bytes / capacity["memory"] * 100) if capacity["memory"] > 0 else 0

                result.append(
                    NodeMetrics(
                        name=name,
                        cpu_usage=f"{cpu_nano // 1000000}m",
                        cpu_percent=round(cpu_percent, 1),
                        memory_usage=self._format_memory(memory_bytes),
                        memory_percent=round(memory_percent, 1),
                        timestamp=datetime.now(timezone.utc),
                    )
                )

            return result
        except ApiException as e:
            if e.status == 404:
                logger.warning("Metrics server not available")
                return []
            logger.error(f"Error getting node metrics: {e}")
            raise

    async def get_cluster_metrics(self) -> Optional[ClusterMetrics]:
        """Get overall cluster resource metrics."""
        # Check cache first (short TTL - 10 seconds for real-time metrics)
        cache_key = "k8s:cluster_metrics"
        cached = await cache_service.get(cache_key)
        if cached is not None:
            return ClusterMetrics(**cached)

        self._initialize()
        try:
            node_metrics = await self.get_node_metrics()
            if not node_metrics:
                return None

            nodes = self._core_v1.list_node()
            total_cpu_capacity = 0
            total_memory_capacity = 0

            for node in nodes.items:
                total_cpu_capacity += self._parse_cpu(node.status.capacity.get("cpu", "0"))
                total_memory_capacity += self._parse_memory(node.status.capacity.get("memory", "0"))

            total_cpu_usage = sum(self._parse_cpu(n.cpu_usage) for n in node_metrics)
            total_memory_usage = sum(self._parse_memory(n.memory_usage) for n in node_metrics)

            result = ClusterMetrics(
                total_cpu_capacity=f"{total_cpu_capacity // 1000000}m",
                total_cpu_usage=f"{total_cpu_usage // 1000000}m",
                cpu_percent=round((total_cpu_usage / total_cpu_capacity * 100) if total_cpu_capacity > 0 else 0, 1),
                total_memory_capacity=self._format_memory(total_memory_capacity),
                total_memory_usage=self._format_memory(total_memory_usage),
                memory_percent=round(
                    (total_memory_usage / total_memory_capacity * 100) if total_memory_capacity > 0 else 0, 1
                ),
                nodes=node_metrics,
                timestamp=datetime.now(timezone.utc),
            )

            # Cache for 10 seconds
            await cache_service.set(cache_key, result.model_dump(), CacheConfig.CLUSTER_METRICS)
            return result
        except Exception as e:
            logger.error(f"Error getting cluster metrics: {e}")
            return None

    def _parse_cpu(self, cpu_str: str) -> int:
        """Parse CPU string to nanocores."""
        if not cpu_str:
            return 0
        cpu_str = str(cpu_str)
        if cpu_str.endswith("n"):
            return int(cpu_str[:-1])
        elif cpu_str.endswith("u"):
            return int(cpu_str[:-1]) * 1000
        elif cpu_str.endswith("m"):
            return int(cpu_str[:-1]) * 1000000
        else:
            return int(float(cpu_str) * 1000000000)

    def _parse_memory(self, mem_str: str) -> int:
        """Parse memory string to bytes."""
        if not mem_str:
            return 0
        mem_str = str(mem_str)
        units = {
            "Ki": 1024,
            "Mi": 1024**2,
            "Gi": 1024**3,
            "Ti": 1024**4,
            "K": 1000,
            "M": 1000**2,
            "G": 1000**3,
            "T": 1000**4,
        }
        for unit, multiplier in units.items():
            if mem_str.endswith(unit):
                return int(mem_str[: -len(unit)]) * multiplier
        return int(mem_str)

    def _format_memory(self, bytes_val: int) -> str:
        """Format bytes to human readable string."""
        if bytes_val >= 1024**3:
            return f"{bytes_val // (1024**3)}Gi"
        elif bytes_val >= 1024**2:
            return f"{bytes_val // (1024**2)}Mi"
        elif bytes_val >= 1024:
            return f"{bytes_val // 1024}Ki"
        return f"{bytes_val}"

    async def exec_command(
        self, namespace: str, pod_name: str, command: List[str], container: Optional[str] = None
    ) -> PodExecResponse:
        """Execute a command in a pod container."""
        self._initialize()
        try:
            from kubernetes.stream import stream

            # If no container specified, get the first container
            if not container:
                pod = self._core_v1.read_namespaced_pod(name=pod_name, namespace=namespace)
                container = pod.spec.containers[0].name

            resp = stream(
                self._core_v1.connect_get_namespaced_pod_exec,
                pod_name,
                namespace,
                command=command,
                container=container,
                stderr=True,
                stdin=False,
                stdout=True,
                tty=False,
                _preload_content=False,
            )

            stdout = ""
            stderr = ""
            while resp.is_open():
                resp.update(timeout=1)
                if resp.peek_stdout():
                    stdout += resp.read_stdout()
                if resp.peek_stderr():
                    stderr += resp.read_stderr()

            return PodExecResponse(
                namespace=namespace,
                pod_name=pod_name,
                container=container,
                command=command,
                stdout=stdout,
                stderr=stderr,
                exit_code=resp.returncode or 0,
            )
        except ApiException as e:
            logger.error(f"Error executing command: {e}")
            raise

    async def get_ingresses(self, namespace: Optional[str] = None) -> List[IngressInfo]:
        """Get all ingresses."""
        self._initialize()
        try:
            if namespace:
                ingresses = self._networking_v1.list_namespaced_ingress(namespace)
            else:
                ingresses = self._networking_v1.list_ingress_for_all_namespaces()

            result = []
            for ing in ingresses.items:
                hosts = []
                rules = []
                for rule in ing.spec.rules or []:
                    if rule.host:
                        hosts.append(rule.host)
                    paths = []
                    if rule.http:
                        for path in rule.http.paths or []:
                            paths.append(
                                {
                                    "path": path.path,
                                    "path_type": path.path_type,
                                    "backend": {
                                        "service": path.backend.service.name if path.backend.service else None,
                                        "port": (
                                            path.backend.service.port.number
                                            if path.backend.service and path.backend.service.port
                                            else None
                                        ),
                                    },
                                }
                            )
                    rules.append(IngressRule(host=rule.host, paths=paths))

                address = None
                if ing.status.load_balancer and ing.status.load_balancer.ingress:
                    lb = ing.status.load_balancer.ingress[0]
                    address = lb.ip or lb.hostname

                result.append(
                    IngressInfo(
                        name=ing.metadata.name,
                        namespace=ing.metadata.namespace,
                        class_name=ing.spec.ingress_class_name,
                        hosts=hosts,
                        address=address,
                        rules=rules,
                        tls=[{"hosts": t.hosts, "secret": t.secret_name} for t in (ing.spec.tls or [])],
                        age=self._calculate_age(ing.metadata.creation_timestamp),
                        labels=ing.metadata.labels or {},
                        annotations=ing.metadata.annotations or {},
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing ingresses: {e}")
            raise

    async def create_ingress(self, request: IngressCreateRequest) -> IngressInfo:
        """Create a new Kubernetes Ingress."""
        self._initialize()
        try:
            # Build ingress rules
            rules = []
            for rule_spec in request.rules:
                paths = []
                for path_spec in rule_spec.paths:
                    paths.append(
                        client.V1HTTPIngressPath(
                            path=path_spec.path,
                            path_type=path_spec.path_type,
                            backend=client.V1IngressBackend(
                                service=client.V1IngressServiceBackend(
                                    name=path_spec.service_name,
                                    port=client.V1ServiceBackendPort(number=path_spec.service_port),
                                )
                            ),
                        )
                    )
                rules.append(
                    client.V1IngressRule(
                        host=rule_spec.host,
                        http=client.V1HTTPIngressRuleValue(paths=paths) if paths else None,
                    )
                )

            # Build TLS config
            tls = []
            for tls_spec in request.tls:
                tls.append(
                    client.V1IngressTLS(
                        hosts=tls_spec.hosts if tls_spec.hosts else None,
                        secret_name=tls_spec.secret_name,
                    )
                )

            # Build ingress
            ingress = client.V1Ingress(
                api_version="networking.k8s.io/v1",
                kind="Ingress",
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    namespace=request.namespace,
                    labels=request.labels or None,
                    annotations=request.annotations or None,
                ),
                spec=client.V1IngressSpec(
                    ingress_class_name=request.ingress_class_name,
                    rules=rules if rules else None,
                    tls=tls if tls else None,
                ),
            )

            created = self._networking_v1.create_namespaced_ingress(request.namespace, ingress)

            # Extract hosts from rules
            hosts = []
            for rule in created.spec.rules or []:
                if rule.host:
                    hosts.append(rule.host)

            return IngressInfo(
                name=created.metadata.name,
                namespace=created.metadata.namespace,
                class_name=created.spec.ingress_class_name,
                hosts=hosts,
                address=None,
                rules=[],
                tls=[{"hosts": t.hosts, "secret": t.secret_name} for t in (created.spec.tls or [])],
                age="0m",
                labels=created.metadata.labels or {},
                annotations=created.metadata.annotations or {},
            )
        except ApiException as e:
            logger.error(f"Error creating ingress {request.namespace}/{request.name}: {e}")
            raise

    async def update_ingress(self, namespace: str, name: str, request: IngressUpdateRequest) -> IngressInfo:
        """Update an existing Kubernetes Ingress."""
        self._initialize()
        try:
            # Get existing ingress
            existing = self._networking_v1.read_namespaced_ingress(name, namespace)

            # Update fields if provided
            if request.ingress_class_name is not None:
                existing.spec.ingress_class_name = request.ingress_class_name

            if request.rules is not None:
                rules = []
                for rule_spec in request.rules:
                    paths = []
                    for path_spec in rule_spec.paths:
                        paths.append(
                            client.V1HTTPIngressPath(
                                path=path_spec.path,
                                path_type=path_spec.path_type,
                                backend=client.V1IngressBackend(
                                    service=client.V1IngressServiceBackend(
                                        name=path_spec.service_name,
                                        port=client.V1ServiceBackendPort(number=path_spec.service_port),
                                    )
                                ),
                            )
                        )
                    rules.append(
                        client.V1IngressRule(
                            host=rule_spec.host,
                            http=client.V1HTTPIngressRuleValue(paths=paths) if paths else None,
                        )
                    )
                existing.spec.rules = rules

            if request.tls is not None:
                tls = []
                for tls_spec in request.tls:
                    tls.append(
                        client.V1IngressTLS(
                            hosts=tls_spec.hosts if tls_spec.hosts else None,
                            secret_name=tls_spec.secret_name,
                        )
                    )
                existing.spec.tls = tls

            if request.labels is not None:
                existing.metadata.labels = request.labels

            if request.annotations is not None:
                existing.metadata.annotations = request.annotations

            updated = self._networking_v1.replace_namespaced_ingress(name, namespace, existing)

            # Extract hosts from rules
            hosts = []
            for rule in updated.spec.rules or []:
                if rule.host:
                    hosts.append(rule.host)

            address = None
            if updated.status.load_balancer and updated.status.load_balancer.ingress:
                lb = updated.status.load_balancer.ingress[0]
                address = lb.ip or lb.hostname

            return IngressInfo(
                name=updated.metadata.name,
                namespace=updated.metadata.namespace,
                class_name=updated.spec.ingress_class_name,
                hosts=hosts,
                address=address,
                rules=[],
                tls=[{"hosts": t.hosts, "secret": t.secret_name} for t in (updated.spec.tls or [])],
                age=self._calculate_age(updated.metadata.creation_timestamp),
                labels=updated.metadata.labels or {},
                annotations=updated.metadata.annotations or {},
            )
        except ApiException as e:
            logger.error(f"Error updating ingress {namespace}/{name}: {e}")
            raise

    async def delete_ingress(self, namespace: str, name: str) -> ResourceDeleteResponse:
        """Delete a Kubernetes Ingress."""
        self._initialize()
        try:
            self._networking_v1.delete_namespaced_ingress(name, namespace)
            return ResourceDeleteResponse(
                success=True,
                message=f"Ingress {namespace}/{name} deleted successfully",
                kind="Ingress",
                name=name,
                namespace=namespace,
            )
        except ApiException as e:
            logger.error(f"Error deleting ingress {namespace}/{name}: {e}")
            raise

    async def get_configmaps(self, namespace: Optional[str] = None) -> List[ConfigMapInfo]:
        """Get all configmaps (keys only, not values)."""
        self._initialize()
        try:
            if namespace:
                configmaps = self._core_v1.list_namespaced_config_map(namespace)
            else:
                configmaps = self._core_v1.list_config_map_for_all_namespaces()

            result = []
            for cm in configmaps.items:
                data_keys = list((cm.data or {}).keys()) + list((cm.binary_data or {}).keys())
                result.append(
                    ConfigMapInfo(
                        name=cm.metadata.name,
                        namespace=cm.metadata.namespace,
                        data_keys=data_keys,
                        data_count=len(data_keys),
                        age=self._calculate_age(cm.metadata.creation_timestamp),
                        labels=cm.metadata.labels or {},
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing configmaps: {e}")
            raise

    async def get_configmap(self, namespace: str, name: str) -> "ConfigMapDetail":
        """Get a single ConfigMap with full data values."""
        from app.schemas.kubernetes import ConfigMapDetail
        self._initialize()
        try:
            cm = self._core_v1.read_namespaced_config_map(name, namespace)

            created_at = None
            if cm.metadata.creation_timestamp:
                created_at = cm.metadata.creation_timestamp.isoformat()

            return ConfigMapDetail(
                name=cm.metadata.name,
                namespace=cm.metadata.namespace,
                data=cm.data or {},
                binary_data_keys=list((cm.binary_data or {}).keys()),
                labels=cm.metadata.labels or {},
                annotations=cm.metadata.annotations or {},
                created_at=created_at,
            )
        except ApiException as e:
            logger.error(f"Error getting configmap {namespace}/{name}: {e}")
            raise

    async def create_configmap(self, request: "ConfigMapCreateRequest") -> "ConfigMapDetail":
        """Create a new ConfigMap."""
        from app.schemas.kubernetes import ConfigMapCreateRequest, ConfigMapDetail
        self._initialize()
        try:
            configmap = client.V1ConfigMap(
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    namespace=request.namespace,
                    labels=request.labels or None,
                ),
                data=request.data if request.data else None,
            )

            self._core_v1.create_namespaced_config_map(request.namespace, configmap)

            return await self.get_configmap(request.namespace, request.name)
        except ApiException as e:
            logger.error(f"Error creating configmap {request.namespace}/{request.name}: {e}")
            raise

    async def update_configmap(self, namespace: str, name: str, request: "ConfigMapUpdateRequest") -> "ConfigMapDetail":
        """Update an existing ConfigMap."""
        from app.schemas.kubernetes import ConfigMapUpdateRequest, ConfigMapDetail
        self._initialize()
        try:
            # Get existing configmap
            existing = self._core_v1.read_namespaced_config_map(name, namespace)

            # Update data
            existing.data = request.data if request.data else None

            if request.labels is not None:
                existing.metadata.labels = request.labels

            self._core_v1.replace_namespaced_config_map(name, namespace, existing)

            return await self.get_configmap(namespace, name)
        except ApiException as e:
            logger.error(f"Error updating configmap {namespace}/{name}: {e}")
            raise

    async def delete_configmap(self, namespace: str, name: str) -> bool:
        """Delete a ConfigMap."""
        self._initialize()
        try:
            self._core_v1.delete_namespaced_config_map(name, namespace)
            return True
        except ApiException as e:
            logger.error(f"Error deleting configmap {namespace}/{name}: {e}")
            raise

    async def get_secrets(self, namespace: Optional[str] = None) -> List[SecretInfo]:
        """Get all secrets (keys only, not values for security)."""
        self._initialize()
        try:
            if namespace:
                secrets = self._core_v1.list_namespaced_secret(namespace)
            else:
                secrets = self._core_v1.list_secret_for_all_namespaces()

            result = []
            for secret in secrets.items:
                data_keys = list((secret.data or {}).keys())
                result.append(
                    SecretInfo(
                        name=secret.metadata.name,
                        namespace=secret.metadata.namespace,
                        type=secret.type,
                        data_keys=data_keys,
                        data_count=len(data_keys),
                        age=self._calculate_age(secret.metadata.creation_timestamp),
                        labels=secret.metadata.labels or {},
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing secrets: {e}")
            raise

    async def get_secret(self, namespace: str, name: str) -> SecretDetail:
        """Get a single secret with decoded data values."""
        self._initialize()
        try:
            secret = self._core_v1.read_namespaced_secret(name, namespace)

            # Decode base64 data values
            decoded_data = {}
            if secret.data:
                for key, value in secret.data.items():
                    try:
                        decoded_data[key] = base64.b64decode(value).decode('utf-8')
                    except (UnicodeDecodeError, ValueError):
                        # Binary data - show as base64
                        decoded_data[key] = f"[binary data: {value[:50]}...]" if len(value) > 50 else f"[binary: {value}]"

            created_at = None
            if secret.metadata.creation_timestamp:
                created_at = secret.metadata.creation_timestamp.isoformat()

            return SecretDetail(
                name=secret.metadata.name,
                namespace=secret.metadata.namespace,
                type=secret.type,
                data=decoded_data,
                labels=secret.metadata.labels or {},
                annotations=secret.metadata.annotations or {},
                created_at=created_at,
            )
        except ApiException as e:
            logger.error(f"Error getting secret {namespace}/{name}: {e}")
            raise

    async def create_secret(self, request: SecretCreateRequest) -> SecretDetail:
        """Create a new secret."""
        self._initialize()
        try:
            # Encode data values to base64
            encoded_data = {}
            for key, value in request.data.items():
                encoded_data[key] = base64.b64encode(value.encode('utf-8')).decode('utf-8')

            secret = client.V1Secret(
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    namespace=request.namespace,
                    labels=request.labels or None,
                ),
                type=request.type,
                data=encoded_data if encoded_data else None,
            )

            created = self._core_v1.create_namespaced_secret(request.namespace, secret)

            return await self.get_secret(request.namespace, request.name)
        except ApiException as e:
            logger.error(f"Error creating secret {request.namespace}/{request.name}: {e}")
            raise

    async def update_secret(self, namespace: str, name: str, request: SecretUpdateRequest) -> SecretDetail:
        """Update an existing secret."""
        self._initialize()
        try:
            # Get existing secret
            existing = self._core_v1.read_namespaced_secret(name, namespace)

            # Encode new data values to base64
            encoded_data = {}
            for key, value in request.data.items():
                encoded_data[key] = base64.b64encode(value.encode('utf-8')).decode('utf-8')

            # Update the secret
            existing.data = encoded_data if encoded_data else None

            if request.labels is not None:
                existing.metadata.labels = request.labels

            self._core_v1.replace_namespaced_secret(name, namespace, existing)

            return await self.get_secret(namespace, name)
        except ApiException as e:
            logger.error(f"Error updating secret {namespace}/{name}: {e}")
            raise

    async def delete_secret(self, namespace: str, name: str) -> bool:
        """Delete a secret."""
        self._initialize()
        try:
            self._core_v1.delete_namespaced_secret(name, namespace)
            return True
        except ApiException as e:
            logger.error(f"Error deleting secret {namespace}/{name}: {e}")
            raise

    async def get_pvcs(self, namespace: Optional[str] = None) -> List[PVCInfo]:
        """Get all persistent volume claims."""
        self._initialize()
        try:
            if namespace:
                pvcs = self._core_v1.list_namespaced_persistent_volume_claim(namespace)
            else:
                pvcs = self._core_v1.list_persistent_volume_claim_for_all_namespaces()

            result = []
            for pvc in pvcs.items:
                capacity = None
                if pvc.status.capacity:
                    capacity = pvc.status.capacity.get("storage")

                result.append(
                    PVCInfo(
                        name=pvc.metadata.name,
                        namespace=pvc.metadata.namespace,
                        status=pvc.status.phase,
                        volume=pvc.spec.volume_name,
                        capacity=capacity,
                        access_modes=pvc.spec.access_modes or [],
                        storage_class=pvc.spec.storage_class_name,
                        age=self._calculate_age(pvc.metadata.creation_timestamp),
                        labels=pvc.metadata.labels or {},
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing PVCs: {e}")
            raise

    async def get_statefulsets(self, namespace: Optional[str] = None) -> List[StatefulSetInfo]:
        """Get all statefulsets."""
        self._initialize()
        try:
            if namespace:
                statefulsets = self._apps_v1.list_namespaced_stateful_set(namespace)
            else:
                statefulsets = self._apps_v1.list_stateful_set_for_all_namespaces()

            result = []
            for sts in statefulsets.items:
                image = None
                if sts.spec.template.spec.containers:
                    image = sts.spec.template.spec.containers[0].image

                result.append(
                    StatefulSetInfo(
                        name=sts.metadata.name,
                        namespace=sts.metadata.namespace,
                        replicas=sts.spec.replicas or 0,
                        ready_replicas=sts.status.ready_replicas or 0,
                        current_replicas=sts.status.current_replicas or 0,
                        image=image,
                        service_name=sts.spec.service_name,
                        age=self._calculate_age(sts.metadata.creation_timestamp),
                        labels=sts.metadata.labels or {},
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing statefulsets: {e}")
            raise

    async def get_statefulset(self, namespace: str, name: str) -> Optional[StatefulSetInfo]:
        """Get a specific statefulset by name."""
        self._initialize()
        try:
            sts = self._apps_v1.read_namespaced_stateful_set(name, namespace)
            image = None
            if sts.spec.template.spec.containers:
                image = sts.spec.template.spec.containers[0].image

            return StatefulSetInfo(
                name=sts.metadata.name,
                namespace=sts.metadata.namespace,
                replicas=sts.spec.replicas or 0,
                ready_replicas=sts.status.ready_replicas or 0,
                current_replicas=sts.status.current_replicas or 0,
                image=image,
                service_name=sts.spec.service_name,
                age=self._calculate_age(sts.metadata.creation_timestamp),
                labels=sts.metadata.labels or {},
            )
        except ApiException as e:
            if e.status == 404:
                return None
            logger.error(f"Error getting statefulset {namespace}/{name}: {e}")
            raise

    async def delete_statefulset(self, namespace: str, name: str) -> ResourceDeleteResponse:
        """Delete a statefulset."""
        self._initialize()
        try:
            self._apps_v1.delete_namespaced_stateful_set(name, namespace)
            return ResourceDeleteResponse(
                success=True,
                message=f"StatefulSet {namespace}/{name} deleted successfully",
                kind="StatefulSet",
                name=name,
                namespace=namespace,
            )
        except ApiException as e:
            logger.error(f"Error deleting statefulset {namespace}/{name}: {e}")
            raise

    async def scale_statefulset(self, namespace: str, name: str, replicas: int) -> Dict[str, Any]:
        """Scale a statefulset to the specified number of replicas."""
        self._initialize()
        try:
            body = {"spec": {"replicas": replicas}}
            self._apps_v1.patch_namespaced_stateful_set_scale(name=name, namespace=namespace, body=body)
            return {
                "success": True,
                "message": f"Scaled {name} to {replicas} replicas",
                "statefulset": name,
                "namespace": namespace,
                "replicas": replicas,
            }
        except ApiException as e:
            logger.error(f"Error scaling statefulset: {e}")
            raise

    async def restart_statefulset(self, namespace: str, name: str) -> Dict[str, Any]:
        """Restart a statefulset by updating its pod template."""
        self._initialize()
        try:
            now = datetime.now(timezone.utc).isoformat()
            body = {"spec": {"template": {"metadata": {"annotations": {"kubectl.kubernetes.io/restartedAt": now}}}}}
            self._apps_v1.patch_namespaced_stateful_set(name=name, namespace=namespace, body=body)
            return {
                "success": True,
                "message": f"Restarted statefulset {name}",
                "statefulset": name,
                "namespace": namespace,
                "timestamp": now,
            }
        except ApiException as e:
            logger.error(f"Error restarting statefulset: {e}")
            raise

    async def get_daemonsets(self, namespace: Optional[str] = None) -> List[DaemonSetInfo]:
        """Get all daemonsets."""
        self._initialize()
        try:
            if namespace:
                daemonsets = self._apps_v1.list_namespaced_daemon_set(namespace)
            else:
                daemonsets = self._apps_v1.list_daemon_set_for_all_namespaces()

            result = []
            for ds in daemonsets.items:
                image = None
                if ds.spec.template.spec.containers:
                    image = ds.spec.template.spec.containers[0].image

                result.append(
                    DaemonSetInfo(
                        name=ds.metadata.name,
                        namespace=ds.metadata.namespace,
                        desired=ds.status.desired_number_scheduled or 0,
                        current=ds.status.current_number_scheduled or 0,
                        ready=ds.status.number_ready or 0,
                        available=ds.status.number_available or 0,
                        node_selector=ds.spec.template.spec.node_selector or {},
                        image=image,
                        age=self._calculate_age(ds.metadata.creation_timestamp),
                        labels=ds.metadata.labels or {},
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing daemonsets: {e}")
            raise

    async def get_daemonset(self, namespace: str, name: str) -> Optional[DaemonSetInfo]:
        """Get a specific daemonset by name."""
        self._initialize()
        try:
            ds = self._apps_v1.read_namespaced_daemon_set(name, namespace)
            image = None
            if ds.spec.template.spec.containers:
                image = ds.spec.template.spec.containers[0].image

            return DaemonSetInfo(
                name=ds.metadata.name,
                namespace=ds.metadata.namespace,
                desired=ds.status.desired_number_scheduled or 0,
                current=ds.status.current_number_scheduled or 0,
                ready=ds.status.number_ready or 0,
                available=ds.status.number_available or 0,
                node_selector=ds.spec.template.spec.node_selector or {},
                image=image,
                age=self._calculate_age(ds.metadata.creation_timestamp),
                labels=ds.metadata.labels or {},
            )
        except ApiException as e:
            if e.status == 404:
                return None
            logger.error(f"Error getting daemonset {namespace}/{name}: {e}")
            raise

    async def delete_daemonset(self, namespace: str, name: str) -> ResourceDeleteResponse:
        """Delete a daemonset."""
        self._initialize()
        try:
            self._apps_v1.delete_namespaced_daemon_set(name, namespace)
            return ResourceDeleteResponse(
                success=True,
                message=f"DaemonSet {namespace}/{name} deleted successfully",
                kind="DaemonSet",
                name=name,
                namespace=namespace,
            )
        except ApiException as e:
            logger.error(f"Error deleting daemonset {namespace}/{name}: {e}")
            raise

    async def restart_daemonset(self, namespace: str, name: str) -> Dict[str, Any]:
        """Restart a daemonset by updating its pod template."""
        self._initialize()
        try:
            now = datetime.now(timezone.utc).isoformat()
            body = {"spec": {"template": {"metadata": {"annotations": {"kubectl.kubernetes.io/restartedAt": now}}}}}
            self._apps_v1.patch_namespaced_daemon_set(name=name, namespace=namespace, body=body)
            return {
                "success": True,
                "message": f"Restarted daemonset {name}",
                "daemonset": name,
                "namespace": namespace,
                "timestamp": now,
            }
        except ApiException as e:
            logger.error(f"Error restarting daemonset: {e}")
            raise

    async def get_jobs(self, namespace: Optional[str] = None) -> List[JobInfo]:
        """Get all jobs."""
        self._initialize()
        try:
            if namespace:
                jobs = self._batch_v1.list_namespaced_job(namespace)
            else:
                jobs = self._batch_v1.list_job_for_all_namespaces()

            result = []
            for job in jobs.items:
                duration = None
                if job.status.start_time and job.status.completion_time:
                    delta = job.status.completion_time - job.status.start_time
                    duration = f"{int(delta.total_seconds())}s"

                result.append(
                    JobInfo(
                        name=job.metadata.name,
                        namespace=job.metadata.namespace,
                        completions=job.spec.completions,
                        succeeded=job.status.succeeded or 0,
                        failed=job.status.failed or 0,
                        active=job.status.active or 0,
                        duration=duration,
                        age=self._calculate_age(job.metadata.creation_timestamp),
                        labels=job.metadata.labels or {},
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing jobs: {e}")
            raise

    async def get_job(self, namespace: str, name: str) -> Optional[JobInfo]:
        """Get a specific job by name."""
        self._initialize()
        try:
            job = self._batch_v1.read_namespaced_job(name, namespace)
            duration = None
            if job.status.start_time and job.status.completion_time:
                delta = job.status.completion_time - job.status.start_time
                duration = f"{int(delta.total_seconds())}s"

            return JobInfo(
                name=job.metadata.name,
                namespace=job.metadata.namespace,
                completions=job.spec.completions,
                succeeded=job.status.succeeded or 0,
                failed=job.status.failed or 0,
                active=job.status.active or 0,
                duration=duration,
                age=self._calculate_age(job.metadata.creation_timestamp),
                labels=job.metadata.labels or {},
            )
        except ApiException as e:
            if e.status == 404:
                return None
            logger.error(f"Error getting job {namespace}/{name}: {e}")
            raise

    async def delete_job(self, namespace: str, name: str) -> ResourceDeleteResponse:
        """Delete a job."""
        self._initialize()
        try:
            self._batch_v1.delete_namespaced_job(name, namespace)
            return ResourceDeleteResponse(
                success=True,
                message=f"Job {namespace}/{name} deleted successfully",
                kind="Job",
                name=name,
                namespace=namespace,
            )
        except ApiException as e:
            logger.error(f"Error deleting job {namespace}/{name}: {e}")
            raise

    async def get_cronjobs(self, namespace: Optional[str] = None) -> List[CronJobInfo]:
        """Get all cronjobs."""
        self._initialize()
        try:
            if namespace:
                cronjobs = self._batch_v1.list_namespaced_cron_job(namespace)
            else:
                cronjobs = self._batch_v1.list_cron_job_for_all_namespaces()

            result = []
            for cj in cronjobs.items:
                result.append(
                    CronJobInfo(
                        name=cj.metadata.name,
                        namespace=cj.metadata.namespace,
                        schedule=cj.spec.schedule,
                        suspend=cj.spec.suspend or False,
                        active=len(cj.status.active or []),
                        last_schedule=cj.status.last_schedule_time,
                        age=self._calculate_age(cj.metadata.creation_timestamp),
                        labels=cj.metadata.labels or {},
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing cronjobs: {e}")
            raise

    async def get_hpas(self, namespace: Optional[str] = None) -> List[HPAInfo]:
        """Get all horizontal pod autoscalers."""
        self._initialize()
        try:
            if namespace:
                hpas = self._autoscaling_v1.list_namespaced_horizontal_pod_autoscaler(namespace)
            else:
                hpas = self._autoscaling_v1.list_horizontal_pod_autoscaler_for_all_namespaces()

            result = []
            for hpa in hpas.items:
                target_cpu = None
                current_cpu = None
                if hpa.spec.target_cpu_utilization_percentage:
                    target_cpu = f"{hpa.spec.target_cpu_utilization_percentage}%"
                if hpa.status.current_cpu_utilization_percentage:
                    current_cpu = f"{hpa.status.current_cpu_utilization_percentage}%"

                result.append(
                    HPAInfo(
                        name=hpa.metadata.name,
                        namespace=hpa.metadata.namespace,
                        reference=f"{hpa.spec.scale_target_ref.kind}/{hpa.spec.scale_target_ref.name}",
                        min_replicas=hpa.spec.min_replicas or 1,
                        max_replicas=hpa.spec.max_replicas,
                        current_replicas=hpa.status.current_replicas or 0,
                        target_cpu=target_cpu,
                        current_cpu=current_cpu,
                        age=self._calculate_age(hpa.metadata.creation_timestamp),
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing HPAs: {e}")
            raise

    async def apply_yaml(
        self, yaml_content: str, namespace: Optional[str] = None, dry_run: bool = False
    ) -> YAMLApplyResponse:
        """Apply YAML manifest(s) to the cluster."""
        import yaml
        from kubernetes import utils

        self._initialize()

        applied_resources: List[AppliedResourceInfo] = []
        errors: List[str] = []

        try:
            # Parse YAML (supports multi-document YAML)
            documents = list(yaml.safe_load_all(yaml_content))

            if not documents or all(doc is None for doc in documents):
                return YAMLApplyResponse(
                    success=False,
                    message="No valid YAML documents found",
                    resources=[],
                    errors=["Empty or invalid YAML content"],
                    dry_run=dry_run,
                )

            for doc in documents:
                if doc is None:
                    continue

                try:
                    # Get resource info
                    kind = doc.get("kind", "Unknown")
                    metadata = doc.get("metadata", {})
                    name = metadata.get("name", "unknown")
                    doc_namespace = metadata.get("namespace") or namespace

                    # Override namespace if provided
                    if namespace and "metadata" in doc:
                        doc["metadata"]["namespace"] = namespace
                        doc_namespace = namespace

                    # Use kubernetes utils to create from dict
                    if dry_run:
                        # For dry run, just validate the structure
                        applied_resources.append(
                            AppliedResourceInfo(
                                kind=kind,
                                name=name,
                                namespace=doc_namespace,
                                action="validated",
                                message="Dry run - resource would be applied",
                            )
                        )
                    else:
                        # Apply the resource using dynamic client
                        try:
                            utils.create_from_dict(self._api_client, doc, namespace=doc_namespace)
                            applied_resources.append(
                                AppliedResourceInfo(
                                    kind=kind,
                                    name=name,
                                    namespace=doc_namespace,
                                    action="created",
                                    message=f"{kind}/{name} created successfully",
                                )
                            )
                        except ApiException as e:
                            if e.status == 409:  # Already exists, try to patch
                                try:
                                    # Get the appropriate API for this resource
                                    api_version = doc.get("apiVersion", "v1")
                                    self._patch_resource(doc, doc_namespace)
                                    applied_resources.append(
                                        AppliedResourceInfo(
                                            kind=kind,
                                            name=name,
                                            namespace=doc_namespace,
                                            action="configured",
                                            message=f"{kind}/{name} configured successfully",
                                        )
                                    )
                                except Exception as patch_error:
                                    errors.append(f"{kind}/{name}: Failed to update - {str(patch_error)}")
                            else:
                                errors.append(f"{kind}/{name}: {e.reason}")

                except Exception as doc_error:
                    errors.append(f"Error processing document: {str(doc_error)}")

            success = len(errors) == 0
            if success:
                message = f"Successfully applied {len(applied_resources)} resource(s)"
            else:
                message = f"Applied {len(applied_resources)} resource(s) with {len(errors)} error(s)"

            return YAMLApplyResponse(
                success=success, message=message, resources=applied_resources, errors=errors, dry_run=dry_run
            )

        except yaml.YAMLError as e:
            return YAMLApplyResponse(
                success=False,
                message="Failed to parse YAML",
                resources=[],
                errors=[f"YAML parse error: {str(e)}"],
                dry_run=dry_run,
            )
        except Exception as e:
            logger.error(f"Error applying YAML: {e}")
            return YAMLApplyResponse(
                success=False,
                message="Failed to apply YAML manifest",
                resources=applied_resources,
                errors=[str(e)],
                dry_run=dry_run,
            )

    def _patch_resource(self, doc: Dict[str, Any], namespace: Optional[str] = None):
        """Patch an existing resource."""
        kind = doc.get("kind", "").lower()
        name = doc["metadata"]["name"]
        api_version = doc.get("apiVersion", "v1")

        # Map of resource types to their patch methods
        if kind == "deployment":
            self._apps_v1.patch_namespaced_deployment(name, namespace, doc)
        elif kind == "service":
            self._core_v1.patch_namespaced_service(name, namespace, doc)
        elif kind == "configmap":
            self._core_v1.patch_namespaced_config_map(name, namespace, doc)
        elif kind == "secret":
            self._core_v1.patch_namespaced_secret(name, namespace, doc)
        elif kind == "pod":
            self._core_v1.patch_namespaced_pod(name, namespace, doc)
        elif kind == "statefulset":
            self._apps_v1.patch_namespaced_stateful_set(name, namespace, doc)
        elif kind == "daemonset":
            self._apps_v1.patch_namespaced_daemon_set(name, namespace, doc)
        elif kind == "job":
            self._batch_v1.patch_namespaced_job(name, namespace, doc)
        elif kind == "cronjob":
            self._batch_v1.patch_namespaced_cron_job(name, namespace, doc)
        elif kind == "ingress":
            self._networking_v1.patch_namespaced_ingress(name, namespace, doc)
        elif kind == "horizontalpodautoscaler":
            self._autoscaling_v1.patch_namespaced_horizontal_pod_autoscaler(name, namespace, doc)
        elif kind == "persistentvolumeclaim":
            self._core_v1.patch_namespaced_persistent_volume_claim(name, namespace, doc)
        elif kind == "namespace":
            self._core_v1.patch_namespace(name, doc)
        else:
            raise Exception(f"Unsupported resource type for patching: {kind}")

    async def execute_kubectl(self, command: str, timeout: int = 30) -> KubectlResponse:
        """Execute a kubectl command and return the result."""
        import shlex
        import subprocess
        import time

        start_time = time.time()

        # Security: Block dangerous commands
        dangerous_patterns = [
            "delete --all",
            "delete namespace",
            "delete ns",
            "--force --grace-period=0",
            "drain",
            "cordon",
            "uncordon",
            "taint",
            "cluster-info dump",
            "proxy",
            "port-forward",
            "attach",
            "cp ",  # file copy
            "auth can-i",
            "certificate",
            "token",
        ]

        command_lower = command.lower()
        for pattern in dangerous_patterns:
            if pattern in command_lower:
                return KubectlResponse(
                    success=False,
                    command=f"kubectl {command}",
                    stdout="",
                    stderr=f"Command blocked: '{pattern}' is not allowed for security reasons",
                    exit_code=1,
                    execution_time=0.0,
                )

        # Build the full kubectl command
        # Use kubeconfig from settings if available
        kubectl_cmd = ["kubectl"]
        if settings.K8S_CONFIG_PATH:
            # Expand ~ to home directory
            config_path = os.path.expanduser(settings.K8S_CONFIG_PATH)
            kubectl_cmd.extend(["--kubeconfig", config_path])

        # Parse and add the user command
        try:
            cmd_parts = shlex.split(command)
            kubectl_cmd.extend(cmd_parts)
        except ValueError as e:
            return KubectlResponse(
                success=False,
                command=f"kubectl {command}",
                stdout="",
                stderr=f"Invalid command syntax: {str(e)}",
                exit_code=1,
                execution_time=0.0,
            )

        try:
            # Execute the command
            result = subprocess.run(kubectl_cmd, capture_output=True, text=True, timeout=timeout)

            execution_time = time.time() - start_time

            return KubectlResponse(
                success=result.returncode == 0,
                command=f"kubectl {command}",
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.returncode,
                execution_time=round(execution_time, 3),
            )

        except subprocess.TimeoutExpired:
            execution_time = time.time() - start_time
            return KubectlResponse(
                success=False,
                command=f"kubectl {command}",
                stdout="",
                stderr=f"Command timed out after {timeout} seconds",
                exit_code=124,
                execution_time=round(execution_time, 3),
            )
        except FileNotFoundError:
            return KubectlResponse(
                success=False,
                command=f"kubectl {command}",
                stdout="",
                stderr="kubectl not found. Please ensure kubectl is installed and in PATH",
                exit_code=127,
                execution_time=0.0,
            )
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Error executing kubectl command: {e}")
            return KubectlResponse(
                success=False,
                command=f"kubectl {command}",
                stdout="",
                stderr=str(e),
                exit_code=1,
                execution_time=round(execution_time, 3),
            )

    async def execute_shell(
        self, command: str, timeout: int = 30, working_directory: Optional[str] = None
    ) -> ShellResponse:
        """Execute a shell command and return the result."""
        import subprocess
        import time

        start_time = time.time()

        # Determine working directory
        # Validate working directory to prevent path traversal
        if working_directory:
            try:
                validate_path_safe(working_directory)
                cwd = os.path.expanduser(working_directory)
            except Exception as e:
                return ShellResponse(
                    success=False,
                    command=command,
                    stdout="",
                    stderr=f"Invalid working directory: {str(e)}",
                    exit_code=1,
                    execution_time=0.0,
                    working_directory=working_directory,
                )
        else:
            cwd = os.path.expanduser("~")

        # Security: Validate command against dangerous patterns
        try:
            validate_shell_command(command)
        except Exception as e:
            return ShellResponse(
                success=False,
                command=command,
                stdout="",
                stderr=f"Command blocked: {str(e)}",
                exit_code=1,
                execution_time=0.0,
                working_directory=cwd,
            )

        try:
            # Execute the command using shell
            # NOTE: shell=True is required for shell features (pipes, redirects, etc.)
            # but poses security risks. Commands are validated against dangerous patterns above.
            # This endpoint should be protected with strong authentication and authorization.
            # Consider using a more restrictive shell or sandboxed environment in production.
            result = subprocess.run(
                command,
                shell=True,  # nosec B602 - Intentional, protected by auth and pattern blocking
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=cwd,
                env={**os.environ, "HOME": os.path.expanduser("~")},
            )

            execution_time = time.time() - start_time

            return ShellResponse(
                success=result.returncode == 0,
                command=command,
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.returncode,
                execution_time=round(execution_time, 3),
                working_directory=cwd,
            )

        except subprocess.TimeoutExpired:
            execution_time = time.time() - start_time
            return ShellResponse(
                success=False,
                command=command,
                stdout="",
                stderr=f"Command timed out after {timeout} seconds",
                exit_code=124,
                execution_time=round(execution_time, 3),
                working_directory=cwd,
            )
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Error executing shell command: {e}")
            return ShellResponse(
                success=False,
                command=command,
                stdout="",
                stderr=str(e),
                exit_code=1,
                execution_time=round(execution_time, 3),
                working_directory=cwd,
            )

    async def stream_pod_logs(
        self,
        namespace: str,
        pod_name: str,
        container: str,
        tail_lines: int = 100,
        timestamps: bool = False,
        follow: bool = True,
    ):
        """
        Stream logs from a pod container as an async generator.

        Yields log lines one at a time for real-time streaming.
        First yields historical logs (tail_lines), then streams new logs if follow=True.
        """
        import asyncio

        self._initialize()

        try:
            kwargs = {
                "name": pod_name,
                "namespace": namespace,
                "container": container,
                "tail_lines": tail_lines,
                "timestamps": timestamps,
                "follow": follow,
                "_preload_content": False,
            }

            response = self._core_v1.read_namespaced_pod_log(**kwargs)

            for line in response.stream():
                if isinstance(line, bytes):
                    line = line.decode("utf-8")
                line = line.rstrip("\n")
                if line:
                    yield line
                await asyncio.sleep(0.01)

        except ApiException as e:
            logger.error(f"Error streaming pod logs: {e}")
            raise
        except GeneratorExit:
            logger.info(f"Log stream closed for {namespace}/{pod_name}/{container}")
        except Exception as e:
            logger.error(f"Unexpected error streaming logs: {e}")
            raise

    async def get_pod(self, namespace: str, pod_name: str) -> Optional[PodInfo]:
        """Get a specific pod by name."""
        self._initialize()
        try:
            pod = self._core_v1.read_namespaced_pod(name=pod_name, namespace=namespace)
            return self._parse_pod(pod)
        except ApiException as e:
            if e.status == 404:
                return None
            raise

    async def get_deployment_revisions(self, namespace: str, deployment_name: str) -> List[Dict[str, Any]]:
        """Get rollout history of a deployment by listing its ReplicaSets."""
        self._initialize()
        try:
            # Get the deployment to find the revision annotation
            deployment = self._apps_v1.read_namespaced_deployment(deployment_name, namespace)
            deployment_uid = deployment.metadata.uid

            # List all ReplicaSets in the namespace
            replica_sets = self._apps_v1.list_namespaced_replica_set(namespace)

            revisions = []
            for rs in replica_sets.items:
                # Check if this RS belongs to our deployment
                owner_refs = rs.metadata.owner_references or []
                is_owned = any(ref.kind == "Deployment" and ref.uid == deployment_uid for ref in owner_refs)

                if is_owned:
                    annotations = rs.metadata.annotations or {}
                    revision = annotations.get("deployment.kubernetes.io/revision", "0")

                    # Get image from the pod template
                    image = None
                    if rs.spec.template.spec.containers:
                        image = rs.spec.template.spec.containers[0].image

                    # Get change cause annotation
                    change_cause = annotations.get("kubernetes.io/change-cause", "")

                    revisions.append(
                        {
                            "revision": int(revision),
                            "name": rs.metadata.name,
                            "replicas": rs.status.replicas or 0,
                            "ready_replicas": rs.status.ready_replicas or 0,
                            "image": image,
                            "change_cause": change_cause,
                            "created_at": (
                                rs.metadata.creation_timestamp.isoformat() if rs.metadata.creation_timestamp else None
                            ),
                            "age": self._calculate_age(rs.metadata.creation_timestamp),
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
        """Rollback a deployment to a specific revision using kubectl."""
        import subprocess
        import time

        self._initialize()

        start_time = time.time()

        try:
            # Build the kubectl rollback command
            kubectl_cmd = ["kubectl"]
            if settings.K8S_CONFIG_PATH:
                config_path = os.path.expanduser(settings.K8S_CONFIG_PATH)
                kubectl_cmd.extend(["--kubeconfig", config_path])

            kubectl_cmd.extend(
                ["rollout", "undo", f"deployment/{deployment_name}", f"--to-revision={revision}", "-n", namespace]
            )

            # Execute the rollback
            result = subprocess.run(kubectl_cmd, capture_output=True, text=True, timeout=60)

            execution_time = time.time() - start_time

            if result.returncode == 0:
                return {
                    "success": True,
                    "message": f"Rollback initiated for {deployment_name} to revision {revision}",
                    "deployment": deployment_name,
                    "namespace": namespace,
                    "target_revision": revision,
                    "output": result.stdout.strip(),
                    "execution_time": round(execution_time, 3),
                }
            else:
                return {
                    "success": False,
                    "message": f"Rollback failed: {result.stderr.strip()}",
                    "deployment": deployment_name,
                    "namespace": namespace,
                    "target_revision": revision,
                    "error": result.stderr.strip(),
                    "execution_time": round(execution_time, 3),
                }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": "Rollback command timed out",
                "deployment": deployment_name,
                "namespace": namespace,
                "target_revision": revision,
                "error": "Command timed out after 60 seconds",
            }
        except Exception as e:
            logger.error(f"Error rolling back deployment: {e}")
            return {
                "success": False,
                "message": f"Rollback failed: {str(e)}",
                "deployment": deployment_name,
                "namespace": namespace,
                "target_revision": revision,
                "error": str(e),
            }
    # ==================== Storage CRUD Operations ====================

    async def get_pvs(self) -> List[PVInfo]:
        """Get all PersistentVolumes."""
        self._initialize()
        try:
            pvs = self._core_v1.list_persistent_volume()
            result = []
            for pv in pvs.items:
                capacity = pv.spec.capacity.get("storage", "") if pv.spec.capacity else ""
                claim = None
                if pv.spec.claim_ref:
                    claim = f"{pv.spec.claim_ref.namespace}/{pv.spec.claim_ref.name}"

                result.append(
                    PVInfo(
                        name=pv.metadata.name,
                        capacity=capacity,
                        access_modes=pv.spec.access_modes or [],
                        reclaim_policy=pv.spec.persistent_volume_reclaim_policy or "Retain",
                        status=pv.status.phase or "Unknown",
                        claim=claim,
                        storage_class=pv.spec.storage_class_name,
                        volume_mode=pv.spec.volume_mode,
                        age=self._calculate_age(pv.metadata.creation_timestamp),
                        labels=pv.metadata.labels or {},
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing PVs: {e}")
            raise

    async def get_storage_classes(self) -> List[StorageClassInfo]:
        """Get all StorageClasses."""
        self._initialize()
        try:
            scs = self._storage_v1.list_storage_class()
            result = []
            for sc in scs.items:
                is_default = False
                annotations = sc.metadata.annotations or {}
                if annotations.get("storageclass.kubernetes.io/is-default-class") == "true":
                    is_default = True
                if annotations.get("storageclass.beta.kubernetes.io/is-default-class") == "true":
                    is_default = True

                result.append(
                    StorageClassInfo(
                        name=sc.metadata.name,
                        provisioner=sc.provisioner,
                        reclaim_policy=sc.reclaim_policy or "Delete",
                        volume_binding_mode=sc.volume_binding_mode or "Immediate",
                        allow_volume_expansion=sc.allow_volume_expansion or False,
                        is_default=is_default,
                        parameters=sc.parameters or {},
                        age=self._calculate_age(sc.metadata.creation_timestamp),
                    )
                )
            return result
        except ApiException as e:
            logger.error(f"Error listing StorageClasses: {e}")
            raise

    async def create_pvc(self, request: PVCCreateRequest) -> PVCInfo:
        """Create a new PersistentVolumeClaim."""
        self._initialize()
        try:
            pvc = client.V1PersistentVolumeClaim(
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    namespace=request.namespace,
                    labels=request.labels or {},
                    annotations=request.annotations or {},
                ),
                spec=client.V1PersistentVolumeClaimSpec(
                    access_modes=request.access_modes,
                    resources=client.V1ResourceRequirements(
                        requests={"storage": request.storage}
                    ),
                    storage_class_name=request.storage_class_name,
                    volume_mode=request.volume_mode,
                ),
            )

            created = self._core_v1.create_namespaced_persistent_volume_claim(
                namespace=request.namespace, body=pvc
            )

            return PVCInfo(
                name=created.metadata.name,
                namespace=created.metadata.namespace,
                status=created.status.phase or "Pending",
                volume=created.spec.volume_name,
                capacity=request.storage,
                access_modes=created.spec.access_modes or [],
                storage_class=created.spec.storage_class_name,
                age=self._calculate_age(created.metadata.creation_timestamp),
                labels=created.metadata.labels or {},
            )
        except ApiException as e:
            logger.error(f"Error creating PVC: {e}")
            raise

    async def update_pvc(self, namespace: str, name: str, request: PVCUpdateRequest) -> PVCInfo:
        """Update a PersistentVolumeClaim (storage expansion if supported)."""
        self._initialize()
        try:
            # Get existing PVC
            pvc = self._core_v1.read_namespaced_persistent_volume_claim(name, namespace)

            # Update labels/annotations
            if request.labels is not None:
                pvc.metadata.labels = request.labels
            if request.annotations is not None:
                pvc.metadata.annotations = request.annotations

            # Update storage size (expansion)
            if request.storage:
                pvc.spec.resources.requests["storage"] = request.storage

            updated = self._core_v1.patch_namespaced_persistent_volume_claim(
                name, namespace, pvc
            )

            capacity = None
            if updated.status.capacity:
                capacity = updated.status.capacity.get("storage")

            return PVCInfo(
                name=updated.metadata.name,
                namespace=updated.metadata.namespace,
                status=updated.status.phase or "Unknown",
                volume=updated.spec.volume_name,
                capacity=capacity,
                access_modes=updated.spec.access_modes or [],
                storage_class=updated.spec.storage_class_name,
                age=self._calculate_age(updated.metadata.creation_timestamp),
                labels=updated.metadata.labels or {},
            )
        except ApiException as e:
            logger.error(f"Error updating PVC {namespace}/{name}: {e}")
            raise

    async def delete_pvc(self, namespace: str, name: str) -> ResourceDeleteResponse:
        """Delete a PersistentVolumeClaim."""
        self._initialize()
        try:
            self._core_v1.delete_namespaced_persistent_volume_claim(name, namespace)
            return ResourceDeleteResponse(
                success=True,
                message=f"PersistentVolumeClaim '{name}' deleted successfully",
                kind="PersistentVolumeClaim",
                name=name,
                namespace=namespace,
            )
        except ApiException as e:
            logger.error(f"Error deleting PVC {namespace}/{name}: {e}")
            raise

    async def create_pv(self, request: PVCreateRequest) -> PVInfo:
        """Create a new PersistentVolume."""
        self._initialize()
        try:
            # Build volume source
            volume_source = {}
            if request.host_path:
                volume_source["hostPath"] = client.V1HostPathVolumeSource(
                    path=request.host_path
                )
            elif request.nfs_server and request.nfs_path:
                volume_source["nfs"] = client.V1NFSVolumeSource(
                    server=request.nfs_server,
                    path=request.nfs_path,
                )

            pv = client.V1PersistentVolume(
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    labels=request.labels or {},
                    annotations=request.annotations or {},
                ),
                spec=client.V1PersistentVolumeSpec(
                    capacity={"storage": request.capacity},
                    access_modes=request.access_modes,
                    persistent_volume_reclaim_policy=request.reclaim_policy,
                    storage_class_name=request.storage_class_name,
                    volume_mode=request.volume_mode,
                    **volume_source,
                ),
            )

            created = self._core_v1.create_persistent_volume(body=pv)

            return PVInfo(
                name=created.metadata.name,
                capacity=request.capacity,
                access_modes=created.spec.access_modes or [],
                reclaim_policy=created.spec.persistent_volume_reclaim_policy or "Retain",
                status=created.status.phase or "Available",
                claim=None,
                storage_class=created.spec.storage_class_name,
                volume_mode=created.spec.volume_mode,
                age=self._calculate_age(created.metadata.creation_timestamp),
                labels=created.metadata.labels or {},
            )
        except ApiException as e:
            logger.error(f"Error creating PV: {e}")
            raise

    async def delete_pv(self, name: str) -> ResourceDeleteResponse:
        """Delete a PersistentVolume."""
        self._initialize()
        try:
            self._core_v1.delete_persistent_volume(name)
            return ResourceDeleteResponse(
                success=True,
                message=f"PersistentVolume '{name}' deleted successfully",
                kind="PersistentVolume",
                name=name,
                namespace="",
            )
        except ApiException as e:
            logger.error(f"Error deleting PV {name}: {e}")
            raise

    async def create_storage_class(self, request: StorageClassCreateRequest) -> StorageClassInfo:
        """Create a new StorageClass."""
        self._initialize()
        try:
            annotations = {}
            if request.is_default:
                annotations["storageclass.kubernetes.io/is-default-class"] = "true"

            sc = client.V1StorageClass(
                metadata=client.V1ObjectMeta(
                    name=request.name,
                    annotations=annotations if annotations else None,
                ),
                provisioner=request.provisioner,
                reclaim_policy=request.reclaim_policy,
                volume_binding_mode=request.volume_binding_mode,
                allow_volume_expansion=request.allow_volume_expansion,
                parameters=request.parameters or None,
                mount_options=request.mount_options or None,
            )

            created = self._storage_v1.create_storage_class(body=sc)

            return StorageClassInfo(
                name=created.metadata.name,
                provisioner=created.provisioner,
                reclaim_policy=created.reclaim_policy or "Delete",
                volume_binding_mode=created.volume_binding_mode or "Immediate",
                allow_volume_expansion=created.allow_volume_expansion or False,
                is_default=request.is_default,
                parameters=created.parameters or {},
                age=self._calculate_age(created.metadata.creation_timestamp),
            )
        except ApiException as e:
            logger.error(f"Error creating StorageClass: {e}")
            raise

    async def delete_storage_class(self, name: str) -> ResourceDeleteResponse:
        """Delete a StorageClass."""
        self._initialize()
        try:
            self._storage_v1.delete_storage_class(name)
            return ResourceDeleteResponse(
                success=True,
                message=f"StorageClass '{name}' deleted successfully",
                kind="StorageClass",
                name=name,
                namespace="",
            )
        except ApiException as e:
            logger.error(f"Error deleting StorageClass {name}: {e}")
            raise

    async def get_resource_yaml(self, kind: str, name: str, namespace: Optional[str] = None) -> ResourceYAMLResponse:
        """Get the YAML definition of any Kubernetes resource."""
        import yaml

        self._initialize()
        try:
            resource = None
            kind_lower = kind.lower()

            # Map resource kinds to their API methods
            if kind_lower == "deployment":
                resource = self._apps_v1.read_namespaced_deployment(name, namespace)
            elif kind_lower == "statefulset":
                resource = self._apps_v1.read_namespaced_stateful_set(name, namespace)
            elif kind_lower == "daemonset":
                resource = self._apps_v1.read_namespaced_daemon_set(name, namespace)
            elif kind_lower == "job":
                resource = self._batch_v1.read_namespaced_job(name, namespace)
            elif kind_lower == "cronjob":
                resource = self._batch_v1.read_namespaced_cron_job(name, namespace)
            elif kind_lower == "pod":
                resource = self._core_v1.read_namespaced_pod(name, namespace)
            elif kind_lower == "service":
                resource = self._core_v1.read_namespaced_service(name, namespace)
            elif kind_lower == "configmap":
                resource = self._core_v1.read_namespaced_config_map(name, namespace)
            elif kind_lower == "secret":
                resource = self._core_v1.read_namespaced_secret(name, namespace)
            elif kind_lower == "ingress":
                resource = self._networking_v1.read_namespaced_ingress(name, namespace)
            elif kind_lower == "persistentvolumeclaim" or kind_lower == "pvc":
                resource = self._core_v1.read_namespaced_persistent_volume_claim(name, namespace)
            elif kind_lower == "persistentvolume" or kind_lower == "pv":
                resource = self._core_v1.read_persistent_volume(name)
            elif kind_lower == "storageclass":
                resource = self._storage_v1.read_storage_class(name)
            elif kind_lower == "namespace":
                resource = self._core_v1.read_namespace(name)
            elif kind_lower == "horizontalpodautoscaler" or kind_lower == "hpa":
                resource = self._autoscaling_v1.read_namespaced_horizontal_pod_autoscaler(name, namespace)
            else:
                return ResourceYAMLResponse(
                    success=False,
                    kind=kind,
                    name=name,
                    namespace=namespace,
                    yaml_content="",
                    error=f"Unsupported resource kind: {kind}"
                )

            if not resource:
                return ResourceYAMLResponse(
                    success=False,
                    kind=kind,
                    name=name,
                    namespace=namespace,
                    yaml_content="",
                    error=f"Resource {kind}/{name} not found"
                )

            # Convert to dict and clean up (remove status, managed fields, etc.)
            resource_dict = self._api_client.sanitize_for_serialization(resource)

            # Remove unnecessary fields
            if "status" in resource_dict:
                del resource_dict["status"]
            if "metadata" in resource_dict:
                metadata = resource_dict["metadata"]
                # Keep only essential metadata
                essential_metadata = {
                    "name": metadata.get("name"),
                    "namespace": metadata.get("namespace"),
                    "labels": metadata.get("labels", {}),
                    "annotations": metadata.get("annotations", {})
                }
                resource_dict["metadata"] = essential_metadata

            # Convert to YAML
            yaml_content = yaml.dump(resource_dict, default_flow_style=False, sort_keys=False)

            return ResourceYAMLResponse(
                success=True,
                kind=kind,
                name=name,
                namespace=namespace,
                yaml_content=yaml_content
            )

        except ApiException as e:
            logger.error(f"Error getting YAML for {kind}/{name}: {e}")
            return ResourceYAMLResponse(
                success=False,
                kind=kind,
                name=name,
                namespace=namespace,
                yaml_content="",
                error=f"API error: {e.reason}"
            )
        except Exception as e:
            logger.error(f"Unexpected error getting YAML for {kind}/{name}: {e}")
            return ResourceYAMLResponse(
                success=False,
                kind=kind,
                name=name,
                namespace=namespace,
                yaml_content="",
                error=str(e)
            )

    async def get_workload_events(self, kind: str, name: str, namespace: str) -> List[K8sEvent]:
        """Get events for a specific workload (Deployment, StatefulSet, DaemonSet, Job)."""
        self._initialize()
        try:
            # Use field selector to filter events for this specific workload
            field_selector = f"involvedObject.name={name},involvedObject.kind={kind}"
            events = self._core_v1.list_namespaced_event(namespace, field_selector=field_selector)

            result = []
            for event in events.items:
                result.append(
                    K8sEvent(
                        name=event.metadata.name,
                        namespace=event.metadata.namespace,
                        type=event.type or "Normal",
                        reason=event.reason or "",
                        message=event.message or "",
                        count=event.count or 1,
                        first_timestamp=event.first_timestamp,
                        last_timestamp=event.last_timestamp,
                        involved_object={
                            "kind": event.involved_object.kind,
                            "name": event.involved_object.name,
                            "namespace": event.involved_object.namespace or "",
                        },
                    )
                )

            # Sort by last timestamp (most recent first)
            result.sort(key=lambda x: x.last_timestamp or x.first_timestamp or datetime.min, reverse=True)
            return result

        except ApiException as e:
            logger.error(f"Error getting events for {kind}/{name}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting events for {kind}/{name}: {e}")
            return []


kubernetes_service = KubernetesService()
