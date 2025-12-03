import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from kubernetes import client, config
from kubernetes.client.rest import ApiException
from kubernetes.config import list_kube_config_contexts

from app.core.config import settings
from app.schemas.cluster import ClusterConfig, ClusterContextInfo, ClusterHealth, ClusterInfo, ClusterStatus

logger = logging.getLogger(__name__)


class ClusterService:
    """Service for managing multiple Kubernetes clusters."""

    def __init__(self):
        self._clusters: Dict[str, ClusterConfig] = {}
        self._clients: Dict[str, Dict[str, Any]] = {}
        self._active_cluster_id: Optional[str] = None
        self._initialized = False

    def _initialize(self):
        """Initialize clusters from kubeconfig contexts."""
        if self._initialized:
            return

        try:
            # Load contexts from kubeconfig
            config_path = settings.K8S_CONFIG_PATH
            if config_path:
                config_path = os.path.expanduser(config_path)

            contexts, active_context = list_kube_config_contexts(config_file=config_path)

            for ctx in contexts:
                ctx_name = ctx.get("name", "unknown")
                cluster_id = ctx_name.replace(" ", "-").lower()

                self._clusters[cluster_id] = ClusterConfig(
                    id=cluster_id,
                    name=ctx_name,
                    context=ctx_name,
                    kubeconfig_path=config_path,
                    in_cluster=False,
                    is_default=(ctx_name == active_context.get("name")),
                )

                if ctx_name == active_context.get("name"):
                    self._active_cluster_id = cluster_id

            # If running in-cluster, add that as well
            if settings.K8S_IN_CLUSTER:
                self._clusters["in-cluster"] = ClusterConfig(
                    id="in-cluster", name="In-Cluster", in_cluster=True, is_default=True
                )
                if not self._active_cluster_id:
                    self._active_cluster_id = "in-cluster"

            self._initialized = True
            logger.info(f"Initialized {len(self._clusters)} cluster(s)")

        except Exception as e:
            logger.error(f"Failed to initialize clusters: {e}")
            # Create a default cluster from settings
            self._clusters["default"] = ClusterConfig(
                id="default",
                name="Default Cluster",
                kubeconfig_path=settings.K8S_CONFIG_PATH,
                in_cluster=settings.K8S_IN_CLUSTER,
                host_override=settings.K8S_HOST_OVERRIDE,
                is_default=True,
            )
            self._active_cluster_id = "default"
            self._initialized = True

    def _get_client(self, cluster_id: str) -> Dict[str, Any]:
        """Get or create Kubernetes clients for a cluster."""
        self._initialize()

        if cluster_id in self._clients:
            return self._clients[cluster_id]

        cluster = self._clusters.get(cluster_id)
        if not cluster:
            raise ValueError(f"Cluster not found: {cluster_id}")

        try:
            if cluster.in_cluster:
                config.load_incluster_config()
            elif cluster.context:
                config_path = cluster.kubeconfig_path
                if config_path:
                    config_path = os.path.expanduser(config_path)
                config.load_kube_config(config_file=config_path, context=cluster.context)
            else:
                config.load_kube_config()

            # Handle host override for Docker Desktop
            if cluster.host_override:
                configuration = client.Configuration.get_default_copy()
                if configuration.host:
                    configuration.host = configuration.host.replace("127.0.0.1", cluster.host_override).replace(
                        "localhost", cluster.host_override
                    )
                    client.Configuration.set_default(configuration)

            api_client = client.ApiClient()
            self._clients[cluster_id] = {
                "api_client": api_client,
                "core_v1": client.CoreV1Api(api_client),
                "apps_v1": client.AppsV1Api(api_client),
                "version": client.VersionApi(api_client),
            }

            return self._clients[cluster_id]

        except Exception as e:
            logger.error(f"Failed to create client for cluster {cluster_id}: {e}")
            raise

    async def list_clusters(self) -> List[ClusterInfo]:
        """List all configured clusters with their status."""
        self._initialize()

        clusters = []
        for cluster_id, cluster_config in self._clusters.items():
            try:
                clients = self._get_client(cluster_id)
                core_v1 = clients["core_v1"]
                version_api = clients["version"]

                # Get cluster version
                version_info = version_api.get_code()
                version = version_info.git_version
                platform = version_info.platform

                # Get basic counts
                nodes = core_v1.list_node()
                namespaces = core_v1.list_namespace()

                clusters.append(
                    ClusterInfo(
                        id=cluster_id,
                        name=cluster_config.name,
                        context=cluster_config.context,
                        status=ClusterStatus.CONNECTED,
                        is_active=(cluster_id == self._active_cluster_id),
                        is_default=cluster_config.is_default,
                        version=version,
                        platform=platform,
                        node_count=len(nodes.items),
                        namespace_count=len(namespaces.items),
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to get status for cluster {cluster_id}: {e}")
                clusters.append(
                    ClusterInfo(
                        id=cluster_id,
                        name=cluster_config.name,
                        context=cluster_config.context,
                        status=ClusterStatus.DISCONNECTED,
                        is_active=(cluster_id == self._active_cluster_id),
                        is_default=cluster_config.is_default,
                    )
                )

        return clusters

    async def get_cluster(self, cluster_id: str) -> Optional[ClusterInfo]:
        """Get details for a specific cluster."""
        self._initialize()

        cluster_config = self._clusters.get(cluster_id)
        if not cluster_config:
            return None

        try:
            clients = self._get_client(cluster_id)
            core_v1 = clients["core_v1"]
            version_api = clients["version"]

            version_info = version_api.get_code()
            nodes = core_v1.list_node()
            namespaces = core_v1.list_namespace()

            return ClusterInfo(
                id=cluster_id,
                name=cluster_config.name,
                context=cluster_config.context,
                status=ClusterStatus.CONNECTED,
                is_active=(cluster_id == self._active_cluster_id),
                is_default=cluster_config.is_default,
                version=version_info.git_version,
                platform=version_info.platform,
                node_count=len(nodes.items),
                namespace_count=len(namespaces.items),
            )
        except Exception as e:
            logger.error(f"Failed to get cluster {cluster_id}: {e}")
            return ClusterInfo(
                id=cluster_id,
                name=cluster_config.name,
                context=cluster_config.context,
                status=ClusterStatus.ERROR,
                is_active=(cluster_id == self._active_cluster_id),
                is_default=cluster_config.is_default,
            )

    async def get_cluster_health(self, cluster_id: str) -> ClusterHealth:
        """Get health status for a specific cluster."""
        self._initialize()

        cluster_config = self._clusters.get(cluster_id)
        if not cluster_config:
            return ClusterHealth(
                cluster_id=cluster_id,
                healthy=False,
                status=ClusterStatus.ERROR,
                error="Cluster not found",
                checked_at=datetime.now(timezone.utc),
            )

        try:
            clients = self._get_client(cluster_id)
            core_v1 = clients["core_v1"]

            nodes = core_v1.list_node()
            pods = core_v1.list_pod_for_all_namespaces()
            namespaces = core_v1.list_namespace()

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

            return ClusterHealth(
                cluster_id=cluster_id,
                healthy=ready_nodes == len(nodes.items) and len(warnings) == 0,
                status=ClusterStatus.CONNECTED,
                node_count=len(nodes.items),
                ready_nodes=ready_nodes,
                total_pods=len(pods.items),
                running_pods=running_pods,
                namespaces=len(namespaces.items),
                warnings=warnings,
                checked_at=datetime.now(timezone.utc),
            )

        except Exception as e:
            logger.error(f"Failed to get health for cluster {cluster_id}: {e}")
            return ClusterHealth(
                cluster_id=cluster_id,
                healthy=False,
                status=ClusterStatus.ERROR,
                error=str(e),
                checked_at=datetime.now(timezone.utc),
            )

    async def set_active_cluster(self, cluster_id: str) -> bool:
        """Set the active cluster for operations."""
        self._initialize()

        if cluster_id not in self._clusters:
            return False

        self._active_cluster_id = cluster_id
        logger.info(f"Active cluster set to: {cluster_id}")
        return True

    async def get_active_cluster(self) -> Optional[str]:
        """Get the currently active cluster ID."""
        self._initialize()
        return self._active_cluster_id

    async def get_active_cluster_clients(self) -> Dict[str, Any]:
        """Get Kubernetes clients for the active cluster."""
        self._initialize()

        if not self._active_cluster_id:
            raise ValueError("No active cluster set")

        return self._get_client(self._active_cluster_id)

    async def list_kubeconfig_contexts(self) -> List[ClusterContextInfo]:
        """List all available contexts from kubeconfig."""
        try:
            config_path = settings.K8S_CONFIG_PATH
            if config_path:
                config_path = os.path.expanduser(config_path)

            contexts, _ = list_kube_config_contexts(config_file=config_path)

            return [
                ClusterContextInfo(
                    name=ctx.get("name", "unknown"),
                    cluster=ctx.get("context", {}).get("cluster", "unknown"),
                    user=ctx.get("context", {}).get("user", "unknown"),
                    namespace=ctx.get("context", {}).get("namespace"),
                )
                for ctx in contexts
            ]
        except Exception as e:
            logger.error(f"Failed to list kubeconfig contexts: {e}")
            return []

    async def add_cluster(self, cluster_config: ClusterConfig) -> bool:
        """Add a new cluster configuration."""
        self._initialize()

        if cluster_config.id in self._clusters:
            return False

        self._clusters[cluster_config.id] = cluster_config

        if cluster_config.is_default or not self._active_cluster_id:
            self._active_cluster_id = cluster_config.id

        return True

    async def remove_cluster(self, cluster_id: str) -> bool:
        """Remove a cluster configuration."""
        self._initialize()

        if cluster_id not in self._clusters:
            return False

        # Close client connections
        if cluster_id in self._clients:
            del self._clients[cluster_id]

        del self._clusters[cluster_id]

        # Reset active cluster if needed
        if self._active_cluster_id == cluster_id:
            self._active_cluster_id = next(iter(self._clusters.keys()), None)

        return True


# Singleton instance
cluster_service = ClusterService()
