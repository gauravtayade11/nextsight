"""
Resource optimization service for Kubernetes workloads.
Analyzes actual resource usage vs requests/limits and provides recommendations.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from app.core.config import settings
from app.core.cache import cache_service, CacheConfig
from app.schemas.optimization import (
    ApplyOptimizationRequest,
    ApplyOptimizationResponse,
    ClusterOptimizationSummary,
    ContainerOptimization,
    EfficiencyScore,
    NamespaceOptimization,
    OptimizationDashboardResponse,
    OptimizationRecommendation,
    OptimizationSeverity,
    OptimizationType,
    PodOptimization,
)

logger = logging.getLogger(__name__)


class OptimizationService:
    """Service for analyzing and recommending Kubernetes resource optimizations."""

    # Pricing (configurable)
    CPU_HOURLY_COST = 0.031611  # per vCPU-hour
    MEMORY_GB_HOURLY_COST = 0.004237  # per GB-hour

    # Thresholds for optimization detection
    OVER_PROVISIONED_THRESHOLD = 0.3  # Using less than 30% of requested
    UNDER_PROVISIONED_THRESHOLD = 0.85  # Using more than 85% of requested
    IDLE_THRESHOLD = 0.05  # Using less than 5% (near-zero)
    OPTIMAL_MIN = 0.5  # Optimal usage: 50-80% of requested
    OPTIMAL_MAX = 0.8

    # Safety margin for recommendations
    RECOMMENDATION_HEADROOM = 1.3  # 30% headroom above actual usage

    def __init__(self):
        self._api_client = None
        self._core_v1 = None
        self._apps_v1 = None
        self._custom_api = None
        self._initialized = False

    def _initialize(self):
        """Initialize Kubernetes clients."""
        if self._initialized:
            return

        try:
            if settings.K8S_IN_CLUSTER:
                config.load_incluster_config()
            elif settings.K8S_CONFIG_PATH:
                import os
                config_path = os.path.expanduser(settings.K8S_CONFIG_PATH)
                config.load_kube_config(config_file=config_path)
            else:
                config.load_kube_config()

            self._api_client = client.ApiClient()
            self._core_v1 = client.CoreV1Api(self._api_client)
            self._apps_v1 = client.AppsV1Api(self._api_client)
            self._custom_api = client.CustomObjectsApi(self._api_client)
            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize Kubernetes client: {e}")
            raise

    def _parse_cpu(self, cpu_str: str) -> int:
        """Parse CPU string to millicores."""
        if not cpu_str:
            return 0
        cpu_str = str(cpu_str).strip()
        if cpu_str.endswith("n"):
            return int(int(cpu_str[:-1]) / 1000000)
        elif cpu_str.endswith("u"):
            return int(int(cpu_str[:-1]) / 1000)
        elif cpu_str.endswith("m"):
            return int(cpu_str[:-1])
        else:
            return int(float(cpu_str) * 1000)

    def _parse_memory(self, mem_str: str) -> int:
        """Parse memory string to bytes."""
        if not mem_str:
            return 0
        mem_str = str(mem_str).strip()
        units = {
            "Ki": 1024,
            "Mi": 1024 ** 2,
            "Gi": 1024 ** 3,
            "Ti": 1024 ** 4,
            "K": 1000,
            "M": 1000 ** 2,
            "G": 1000 ** 3,
            "T": 1000 ** 4,
        }
        for unit, multiplier in units.items():
            if mem_str.endswith(unit):
                return int(float(mem_str[: -len(unit)]) * multiplier)
        try:
            return int(mem_str)
        except ValueError:
            return 0

    def _format_cpu(self, millicores: int) -> str:
        """Format millicores to human-readable string."""
        if millicores >= 1000:
            return f"{millicores // 1000}"
        return f"{millicores}m"

    def _format_memory(self, bytes_val: int) -> str:
        """Format bytes to human-readable string."""
        if bytes_val >= 1024 ** 3:
            return f"{bytes_val // (1024 ** 3)}Gi"
        elif bytes_val >= 1024 ** 2:
            return f"{bytes_val // (1024 ** 2)}Mi"
        elif bytes_val >= 1024:
            return f"{bytes_val // 1024}Ki"
        return f"{bytes_val}"

    def _calculate_efficiency(self, used: int, requested: int) -> float:
        """Calculate efficiency percentage (used/requested)."""
        if requested <= 0:
            return 0.0
        return min((used / requested) * 100, 100.0)

    def _get_efficiency_score(self, efficiency: float) -> EfficiencyScore:
        """Convert efficiency percentage to a score with grade."""
        if efficiency >= 50 and efficiency <= 80:
            return EfficiencyScore(score=efficiency, grade="A", status="optimal")
        elif efficiency > 80 and efficiency <= 95:
            return EfficiencyScore(score=efficiency, grade="B", status="review")
        elif efficiency > 95:
            return EfficiencyScore(score=min(efficiency, 100), grade="C", status="under_provisioned")
        elif efficiency >= 30 and efficiency < 50:
            return EfficiencyScore(score=efficiency, grade="C", status="review")
        elif efficiency >= 10 and efficiency < 30:
            return EfficiencyScore(score=efficiency, grade="D", status="wasteful")
        else:
            return EfficiencyScore(score=efficiency, grade="F", status="critical")

    def _calculate_hourly_cost(self, cpu_millicores: int, memory_bytes: int) -> float:
        """Calculate hourly cost based on resource requests."""
        cpu_cores = cpu_millicores / 1000
        memory_gb = memory_bytes / (1024 ** 3)
        return (cpu_cores * self.CPU_HOURLY_COST) + (memory_gb * self.MEMORY_GB_HOURLY_COST)

    def _get_recommended_resources(
        self, cpu_usage: int, memory_usage: int
    ) -> Tuple[int, int]:
        """Calculate recommended resources with headroom."""
        # Add 30% headroom to actual usage
        recommended_cpu = int(cpu_usage * self.RECOMMENDATION_HEADROOM)
        recommended_memory = int(memory_usage * self.RECOMMENDATION_HEADROOM)

        # Minimum thresholds
        recommended_cpu = max(recommended_cpu, 10)  # At least 10m
        recommended_memory = max(recommended_memory, 32 * 1024 * 1024)  # At least 32Mi

        return recommended_cpu, recommended_memory

    async def get_pod_metrics(self) -> Dict[str, Dict]:
        """Get current pod metrics from metrics-server."""
        self._initialize()
        metrics_map = {}

        try:
            metrics = self._custom_api.list_cluster_custom_object(
                group="metrics.k8s.io",
                version="v1beta1",
                plural="pods"
            )

            for item in metrics.get("items", []):
                pod_name = item["metadata"]["name"]
                namespace = item["metadata"]["namespace"]
                key = f"{namespace}/{pod_name}"

                containers = {}
                for container in item.get("containers", []):
                    containers[container["name"]] = {
                        "cpu": self._parse_cpu(container.get("usage", {}).get("cpu", "0")),
                        "memory": self._parse_memory(container.get("usage", {}).get("memory", "0")),
                    }

                metrics_map[key] = containers

        except ApiException as e:
            if e.status == 404:
                logger.warning("Metrics server not available")
            else:
                logger.error(f"Error getting pod metrics: {e}")

        return metrics_map

    async def analyze_pod(
        self, pod: Any, metrics: Dict[str, Dict]
    ) -> Optional[PodOptimization]:
        """Analyze a single pod for optimization opportunities."""
        pod_name = pod.metadata.name
        namespace = pod.metadata.namespace
        key = f"{namespace}/{pod_name}"

        # Skip non-running pods
        if pod.status.phase != "Running":
            return None

        pod_metrics = metrics.get(key, {})
        containers = []

        total_cpu_usage = 0
        total_cpu_request = 0
        total_cpu_limit = 0
        total_memory_usage = 0
        total_memory_request = 0
        total_memory_limit = 0

        for container in pod.spec.containers:
            container_name = container.name
            container_metrics = pod_metrics.get(container_name, {"cpu": 0, "memory": 0})

            # Get requests and limits
            resources = container.resources or client.V1ResourceRequirements()
            requests = resources.requests or {}
            limits = resources.limits or {}

            cpu_usage = container_metrics.get("cpu", 0)
            cpu_request = self._parse_cpu(requests.get("cpu", "0"))
            cpu_limit = self._parse_cpu(limits.get("cpu", "0"))
            memory_usage = container_metrics.get("memory", 0)
            memory_request = self._parse_memory(requests.get("memory", "0"))
            memory_limit = self._parse_memory(limits.get("memory", "0"))

            # Calculate efficiency
            cpu_eff = self._calculate_efficiency(cpu_usage, cpu_request) if cpu_request > 0 else 0
            mem_eff = self._calculate_efficiency(memory_usage, memory_request) if memory_request > 0 else 0

            # Calculate recommendations
            rec_cpu, rec_mem = self._get_recommended_resources(cpu_usage, memory_usage)

            containers.append(ContainerOptimization(
                container_name=container_name,
                cpu_usage_millicores=cpu_usage,
                cpu_request_millicores=cpu_request,
                cpu_limit_millicores=cpu_limit,
                memory_usage_bytes=memory_usage,
                memory_request_bytes=memory_request,
                memory_limit_bytes=memory_limit,
                cpu_efficiency=round(cpu_eff, 1),
                memory_efficiency=round(mem_eff, 1),
                cpu_recommendation_millicores=rec_cpu if cpu_request > 0 else None,
                memory_recommendation_bytes=rec_mem if memory_request > 0 else None,
            ))

            total_cpu_usage += cpu_usage
            total_cpu_request += cpu_request
            total_cpu_limit += cpu_limit
            total_memory_usage += memory_usage
            total_memory_request += memory_request
            total_memory_limit += memory_limit

        # Calculate overall efficiency
        cpu_efficiency = self._calculate_efficiency(total_cpu_usage, total_cpu_request)
        memory_efficiency = self._calculate_efficiency(total_memory_usage, total_memory_request)
        overall_efficiency = (cpu_efficiency + memory_efficiency) / 2 if (total_cpu_request > 0 or total_memory_request > 0) else 0

        # Determine optimization type and severity
        optimization_type = None
        severity = OptimizationSeverity.INFO
        recommendations = []

        if total_cpu_request == 0 and total_memory_request == 0:
            optimization_type = OptimizationType.NO_REQUESTS
            severity = OptimizationSeverity.HIGH
            recommendations.append("Set resource requests to ensure proper scheduling")
        elif total_cpu_limit == 0 and total_memory_limit == 0:
            optimization_type = OptimizationType.NO_LIMITS
            severity = OptimizationSeverity.MEDIUM
            recommendations.append("Set resource limits to prevent resource exhaustion")
        elif overall_efficiency < self.IDLE_THRESHOLD * 100:
            optimization_type = OptimizationType.IDLE_RESOURCE
            severity = OptimizationSeverity.HIGH
            recommendations.append("Pod appears idle - consider scaling down or removing")
        elif overall_efficiency < self.OVER_PROVISIONED_THRESHOLD * 100:
            optimization_type = OptimizationType.OVER_PROVISIONED
            severity = OptimizationSeverity.MEDIUM
            recommendations.append("Reduce resource requests to match actual usage")
        elif overall_efficiency > self.UNDER_PROVISIONED_THRESHOLD * 100:
            optimization_type = OptimizationType.UNDER_PROVISIONED
            severity = OptimizationSeverity.HIGH
            recommendations.append("Increase resource requests to prevent throttling/OOM")

        # Get owner reference - traverse to find Deployment/StatefulSet/DaemonSet
        owner_kind = None
        owner_name = None
        if pod.metadata.owner_references:
            owner = pod.metadata.owner_references[0]
            owner_kind = owner.kind
            owner_name = owner.name

            # If owner is ReplicaSet, find its parent Deployment
            if owner_kind == "ReplicaSet":
                try:
                    rs = self._apps_v1.read_namespaced_replica_set(owner_name, namespace)
                    if rs.metadata.owner_references:
                        rs_owner = rs.metadata.owner_references[0]
                        if rs_owner.kind == "Deployment":
                            owner_kind = "Deployment"
                            owner_name = rs_owner.name
                except Exception:
                    # Fallback: extract deployment name from ReplicaSet name
                    # ReplicaSet names follow pattern: {deployment-name}-{hash}
                    parts = owner_name.rsplit("-", 1)
                    if len(parts) == 2 and len(parts[1]) >= 8:
                        owner_kind = "Deployment"
                        owner_name = parts[0]

        # Calculate costs
        current_cost = self._calculate_hourly_cost(total_cpu_request, total_memory_request)
        rec_cpu, rec_mem = self._get_recommended_resources(total_cpu_usage, total_memory_usage)
        optimized_cost = self._calculate_hourly_cost(rec_cpu, rec_mem)
        savings = max(0, current_cost - optimized_cost)
        savings_pct = (savings / current_cost * 100) if current_cost > 0 else 0

        return PodOptimization(
            name=pod_name,
            namespace=namespace,
            owner_kind=owner_kind,
            owner_name=owner_name,
            containers=containers,
            total_cpu_usage_millicores=total_cpu_usage,
            total_cpu_request_millicores=total_cpu_request,
            total_cpu_limit_millicores=total_cpu_limit,
            total_memory_usage_bytes=total_memory_usage,
            total_memory_request_bytes=total_memory_request,
            total_memory_limit_bytes=total_memory_limit,
            cpu_efficiency=self._get_efficiency_score(cpu_efficiency),
            memory_efficiency=self._get_efficiency_score(memory_efficiency),
            overall_efficiency=self._get_efficiency_score(overall_efficiency),
            recommendations=recommendations,
            optimization_type=optimization_type,
            severity=severity,
            current_hourly_cost=round(current_cost, 4),
            optimized_hourly_cost=round(optimized_cost, 4),
            potential_savings=round(savings, 4),
            savings_percentage=round(savings_pct, 1),
        )

    async def get_optimization_dashboard(
        self, namespace: Optional[str] = None
    ) -> OptimizationDashboardResponse:
        """Get complete optimization dashboard data with caching."""
        self._initialize()

        # Try to get from cache first
        cache_key = f"optimization:dashboard:{namespace or 'all'}"
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.debug(f"Cache hit for optimization dashboard: {cache_key}")
            return OptimizationDashboardResponse(**cached_data)

        try:
            # Get pod metrics first
            metrics = await self.get_pod_metrics()

            # Get all pods
            if namespace:
                pods = self._core_v1.list_namespaced_pod(namespace)
            else:
                pods = self._core_v1.list_pod_for_all_namespaces()

            # Analyze each pod
            pod_optimizations: List[PodOptimization] = []
            for pod in pods.items:
                opt = await self.analyze_pod(pod, metrics)
                if opt:
                    pod_optimizations.append(opt)

            # Calculate summary
            summary = self._calculate_summary(pod_optimizations)

            # Get namespace breakdown
            namespace_breakdown = self._calculate_namespace_breakdown(pod_optimizations)

            # Get top wasteful pods (over-provisioned)
            top_wasteful = sorted(
                [p for p in pod_optimizations if p.optimization_type == OptimizationType.OVER_PROVISIONED],
                key=lambda x: x.potential_savings,
                reverse=True
            )[:10]

            # Get under-provisioned pods
            top_underprovisioned = sorted(
                [p for p in pod_optimizations if p.optimization_type == OptimizationType.UNDER_PROVISIONED],
                key=lambda x: x.overall_efficiency.score,
                reverse=True
            )[:10]

            # Get idle resources
            idle_resources = [
                p for p in pod_optimizations
                if p.optimization_type == OptimizationType.IDLE_RESOURCE
            ][:10]

            # Generate recommendations
            recommendations = self._generate_recommendations(pod_optimizations)

            response = OptimizationDashboardResponse(
                summary=summary,
                namespace_breakdown=namespace_breakdown,
                top_wasteful_pods=top_wasteful,
                top_underprovisioned_pods=top_underprovisioned,
                recommendations=recommendations,
                idle_resources=idle_resources,
                analyzed_at=datetime.now(timezone.utc),
            )

            # Cache the response for 60 seconds (optimization data doesn't need real-time refresh)
            await cache_service.set(cache_key, response.model_dump(), ttl=60)
            logger.debug(f"Cached optimization dashboard: {cache_key}")

            return response

        except ApiException as e:
            logger.error(f"Kubernetes API error: {e}")
            if settings.DEMO_MODE:
                return self._get_demo_dashboard()
            raise
        except Exception as e:
            logger.error(f"Error getting optimization dashboard: {e}")
            if settings.DEMO_MODE:
                return self._get_demo_dashboard()
            raise

    def _calculate_summary(
        self, pod_optimizations: List[PodOptimization]
    ) -> ClusterOptimizationSummary:
        """Calculate cluster-wide optimization summary."""
        total_pods = len(pod_optimizations)
        if total_pods == 0:
            return ClusterOptimizationSummary(
                cluster_efficiency_score=EfficiencyScore(score=0, grade="N/A", status="no_data")
            )

        optimal = sum(1 for p in pod_optimizations if p.overall_efficiency.status == "optimal")
        over_provisioned = sum(1 for p in pod_optimizations if p.optimization_type == OptimizationType.OVER_PROVISIONED)
        under_provisioned = sum(1 for p in pod_optimizations if p.optimization_type == OptimizationType.UNDER_PROVISIONED)
        idle = sum(1 for p in pod_optimizations if p.optimization_type == OptimizationType.IDLE_RESOURCE)
        no_limits = sum(1 for p in pod_optimizations if p.optimization_type == OptimizationType.NO_LIMITS)
        no_requests = sum(1 for p in pod_optimizations if p.optimization_type == OptimizationType.NO_REQUESTS)

        avg_cpu_eff = sum(p.cpu_efficiency.score for p in pod_optimizations) / total_pods
        avg_mem_eff = sum(p.memory_efficiency.score for p in pod_optimizations) / total_pods
        overall_eff = (avg_cpu_eff + avg_mem_eff) / 2

        total_cost = sum(p.current_hourly_cost for p in pod_optimizations)
        total_savings = sum(p.potential_savings for p in pod_optimizations)
        savings_pct = (total_savings / total_cost * 100) if total_cost > 0 else 0

        total_cpu_requested = sum(p.total_cpu_request_millicores for p in pod_optimizations)
        total_cpu_used = sum(p.total_cpu_usage_millicores for p in pod_optimizations)
        total_mem_requested = sum(p.total_memory_request_bytes for p in pod_optimizations)
        total_mem_used = sum(p.total_memory_usage_bytes for p in pod_optimizations)

        return ClusterOptimizationSummary(
            total_pods=total_pods,
            analyzed_pods=total_pods,
            optimal_pods=optimal,
            over_provisioned_pods=over_provisioned,
            under_provisioned_pods=under_provisioned,
            idle_pods=idle,
            no_limits_pods=no_limits,
            no_requests_pods=no_requests,
            avg_cpu_efficiency=round(avg_cpu_eff, 1),
            avg_memory_efficiency=round(avg_mem_eff, 1),
            cluster_efficiency_score=self._get_efficiency_score(overall_eff),
            total_current_hourly_cost=round(total_cost, 2),
            total_potential_savings=round(total_savings, 2),
            total_savings_percentage=round(savings_pct, 1),
            total_cpu_requested_millicores=total_cpu_requested,
            total_cpu_used_millicores=total_cpu_used,
            total_memory_requested_bytes=total_mem_requested,
            total_memory_used_bytes=total_mem_used,
        )

    def _calculate_namespace_breakdown(
        self, pod_optimizations: List[PodOptimization]
    ) -> List[NamespaceOptimization]:
        """Calculate optimization breakdown by namespace."""
        ns_map: Dict[str, List[PodOptimization]] = {}

        for pod in pod_optimizations:
            if pod.namespace not in ns_map:
                ns_map[pod.namespace] = []
            ns_map[pod.namespace].append(pod)

        result = []
        for ns, pods in ns_map.items():
            pod_count = len(pods)
            if pod_count == 0:
                continue

            optimal = sum(1 for p in pods if p.overall_efficiency.status == "optimal")
            over_prov = sum(1 for p in pods if p.optimization_type == OptimizationType.OVER_PROVISIONED)
            under_prov = sum(1 for p in pods if p.optimization_type == OptimizationType.UNDER_PROVISIONED)
            idle = sum(1 for p in pods if p.optimization_type == OptimizationType.IDLE_RESOURCE)

            avg_cpu = sum(p.cpu_efficiency.score for p in pods) / pod_count
            avg_mem = sum(p.memory_efficiency.score for p in pods) / pod_count
            overall = (avg_cpu + avg_mem) / 2

            cost = sum(p.current_hourly_cost for p in pods)
            savings = sum(p.potential_savings for p in pods)
            savings_pct = (savings / cost * 100) if cost > 0 else 0

            result.append(NamespaceOptimization(
                namespace=ns,
                pod_count=pod_count,
                optimized_pods=optimal,
                over_provisioned_pods=over_prov,
                under_provisioned_pods=under_prov,
                idle_pods=idle,
                avg_cpu_efficiency=round(avg_cpu, 1),
                avg_memory_efficiency=round(avg_mem, 1),
                overall_efficiency=self._get_efficiency_score(overall),
                current_hourly_cost=round(cost, 4),
                potential_hourly_savings=round(savings, 4),
                savings_percentage=round(savings_pct, 1),
            ))

        return sorted(result, key=lambda x: x.potential_hourly_savings, reverse=True)

    def _generate_recommendations(
        self, pod_optimizations: List[PodOptimization]
    ) -> List[OptimizationRecommendation]:
        """Generate actionable optimization recommendations."""
        recommendations = []

        for pod in pod_optimizations:
            if pod.optimization_type is None:
                continue

            # Skip if no significant savings
            if pod.potential_savings < 0.01 and pod.optimization_type not in [
                OptimizationType.UNDER_PROVISIONED,
                OptimizationType.NO_REQUESTS,
                OptimizationType.NO_LIMITS,
            ]:
                continue

            for container in pod.containers:
                rec_id = str(uuid.uuid4())

                if pod.optimization_type == OptimizationType.OVER_PROVISIONED:
                    recommendations.append(OptimizationRecommendation(
                        id=rec_id,
                        type=OptimizationType.OVER_PROVISIONED,
                        severity=pod.severity,
                        title=f"Reduce resources for {pod.name}",
                        description=f"Container '{container.container_name}' is using only {container.cpu_efficiency:.0f}% CPU and {container.memory_efficiency:.0f}% memory of requested resources.",
                        resource_kind=pod.owner_kind or "Pod",
                        resource_name=pod.owner_name or pod.name,
                        namespace=pod.namespace,
                        container_name=container.container_name,
                        current_cpu_request=self._format_cpu(container.cpu_request_millicores),
                        current_memory_request=self._format_memory(container.memory_request_bytes),
                        recommended_cpu_request=self._format_cpu(container.cpu_recommendation_millicores or 0),
                        recommended_memory_request=self._format_memory(container.memory_recommendation_bytes or 0),
                        current_cost=pod.current_hourly_cost,
                        estimated_savings=pod.potential_savings,
                        savings_percentage=pod.savings_percentage,
                        risk_level="low",
                        action=f"Reduce CPU request to {self._format_cpu(container.cpu_recommendation_millicores or 0)} and memory to {self._format_memory(container.memory_recommendation_bytes or 0)}",
                    ))

                elif pod.optimization_type == OptimizationType.UNDER_PROVISIONED:
                    rec_cpu = int(container.cpu_usage_millicores * 1.5)
                    rec_mem = int(container.memory_usage_bytes * 1.5)
                    recommendations.append(OptimizationRecommendation(
                        id=rec_id,
                        type=OptimizationType.UNDER_PROVISIONED,
                        severity=OptimizationSeverity.HIGH,
                        title=f"Increase resources for {pod.name}",
                        description=f"Container '{container.container_name}' is using {container.cpu_efficiency:.0f}% CPU and {container.memory_efficiency:.0f}% memory. Risk of throttling or OOM.",
                        resource_kind=pod.owner_kind or "Pod",
                        resource_name=pod.owner_name or pod.name,
                        namespace=pod.namespace,
                        container_name=container.container_name,
                        current_cpu_request=self._format_cpu(container.cpu_request_millicores),
                        current_memory_request=self._format_memory(container.memory_request_bytes),
                        recommended_cpu_request=self._format_cpu(rec_cpu),
                        recommended_memory_request=self._format_memory(rec_mem),
                        current_cost=pod.current_hourly_cost,
                        estimated_savings=0,
                        savings_percentage=0,
                        risk_level="high",
                        action=f"Increase CPU request to {self._format_cpu(rec_cpu)} and memory to {self._format_memory(rec_mem)}",
                    ))

                elif pod.optimization_type == OptimizationType.IDLE_RESOURCE:
                    # For idle resources, recommend minimal values (10m CPU, 32Mi memory)
                    # The real recommendation is to scale down, but these values allow the Apply button to work
                    min_cpu = 10  # 10m minimum
                    min_mem = 32 * 1024 * 1024  # 32Mi minimum
                    recommendations.append(OptimizationRecommendation(
                        id=rec_id,
                        type=OptimizationType.IDLE_RESOURCE,
                        severity=OptimizationSeverity.HIGH,
                        title=f"Idle pod detected: {pod.name}",
                        description=f"Pod is using less than 5% of requested resources. Consider scaling down to 0 replicas or removing the deployment entirely.",
                        resource_kind=pod.owner_kind or "Pod",
                        resource_name=pod.owner_name or pod.name,
                        namespace=pod.namespace,
                        container_name=container.container_name,
                        current_cpu_request=self._format_cpu(container.cpu_request_millicores),
                        current_memory_request=self._format_memory(container.memory_request_bytes),
                        recommended_cpu_request=self._format_cpu(min_cpu),
                        recommended_memory_request=self._format_memory(min_mem),
                        current_cost=pod.current_hourly_cost,
                        estimated_savings=pod.current_hourly_cost * 0.95,  # 95% savings with minimal resources
                        savings_percentage=95,
                        risk_level="medium",
                        action=f"Scale down to 0 replicas, or reduce resources to {self._format_cpu(min_cpu)} CPU / {self._format_memory(min_mem)} memory",
                    ))

                elif pod.optimization_type == OptimizationType.NO_REQUESTS:
                    recommendations.append(OptimizationRecommendation(
                        id=rec_id,
                        type=OptimizationType.NO_REQUESTS,
                        severity=OptimizationSeverity.HIGH,
                        title=f"No resource requests: {pod.name}",
                        description=f"Container '{container.container_name}' has no resource requests set. This can lead to scheduling issues and resource contention.",
                        resource_kind=pod.owner_kind or "Pod",
                        resource_name=pod.owner_name or pod.name,
                        namespace=pod.namespace,
                        container_name=container.container_name,
                        current_cpu_request="Not set",
                        current_memory_request="Not set",
                        recommended_cpu_request=self._format_cpu(container.cpu_recommendation_millicores or 100),
                        recommended_memory_request=self._format_memory(container.memory_recommendation_bytes or 128 * 1024 * 1024),
                        current_cost=0,
                        estimated_savings=0,
                        savings_percentage=0,
                        risk_level="high",
                        action="Set resource requests based on actual usage",
                    ))

                elif pod.optimization_type == OptimizationType.NO_LIMITS:
                    # Calculate recommended limits based on requests or usage
                    rec_cpu_limit = int((container.cpu_request_millicores or container.cpu_usage_millicores) * 2)
                    rec_mem_limit = int((container.memory_request_bytes or container.memory_usage_bytes) * 2)
                    recommendations.append(OptimizationRecommendation(
                        id=rec_id,
                        type=OptimizationType.NO_LIMITS,
                        severity=OptimizationSeverity.MEDIUM,
                        title=f"No resource limits: {pod.name}",
                        description=f"Container '{container.container_name}' has no resource limits set. This can lead to resource exhaustion affecting other workloads.",
                        resource_kind=pod.owner_kind or "Pod",
                        resource_name=pod.owner_name or pod.name,
                        namespace=pod.namespace,
                        container_name=container.container_name,
                        current_cpu_request=self._format_cpu(container.cpu_request_millicores),
                        current_cpu_limit="Not set",
                        current_memory_request=self._format_memory(container.memory_request_bytes),
                        current_memory_limit="Not set",
                        recommended_cpu_request=self._format_cpu(container.cpu_request_millicores),
                        recommended_cpu_limit=self._format_cpu(rec_cpu_limit),
                        recommended_memory_request=self._format_memory(container.memory_request_bytes),
                        recommended_memory_limit=self._format_memory(rec_mem_limit),
                        current_cost=pod.current_hourly_cost,
                        estimated_savings=0,
                        savings_percentage=0,
                        risk_level="medium",
                        action=f"Set CPU limit to {self._format_cpu(rec_cpu_limit)} and memory limit to {self._format_memory(rec_mem_limit)}",
                    ))

        return sorted(recommendations, key=lambda x: x.estimated_savings, reverse=True)[:50]

    def _get_demo_dashboard(self) -> OptimizationDashboardResponse:
        """Return demo data when K8s API is unavailable."""
        demo_pods = [
            PodOptimization(
                name="api-server-7d8b9c6f-xk2p3",
                namespace="production",
                owner_kind="Deployment",
                owner_name="api-server",
                containers=[ContainerOptimization(
                    container_name="api",
                    cpu_usage_millicores=180,
                    cpu_request_millicores=500,
                    cpu_limit_millicores=1000,
                    memory_usage_bytes=420 * 1024 * 1024,
                    memory_request_bytes=1024 * 1024 * 1024,
                    memory_limit_bytes=2048 * 1024 * 1024,
                    cpu_efficiency=36.0,
                    memory_efficiency=41.0,
                    cpu_recommendation_millicores=234,
                    memory_recommendation_bytes=546 * 1024 * 1024,
                )],
                total_cpu_usage_millicores=180,
                total_cpu_request_millicores=500,
                total_cpu_limit_millicores=1000,
                total_memory_usage_bytes=420 * 1024 * 1024,
                total_memory_request_bytes=1024 * 1024 * 1024,
                total_memory_limit_bytes=2048 * 1024 * 1024,
                cpu_efficiency=EfficiencyScore(score=36.0, grade="D", status="wasteful"),
                memory_efficiency=EfficiencyScore(score=41.0, grade="C", status="review"),
                overall_efficiency=EfficiencyScore(score=38.5, grade="D", status="wasteful"),
                recommendations=["Reduce resource requests to match actual usage"],
                optimization_type=OptimizationType.OVER_PROVISIONED,
                severity=OptimizationSeverity.MEDIUM,
                current_hourly_cost=0.052,
                optimized_hourly_cost=0.029,
                potential_savings=0.023,
                savings_percentage=44.2,
            ),
            PodOptimization(
                name="web-frontend-5c4d3e2f-lm9n8",
                namespace="production",
                owner_kind="Deployment",
                owner_name="web-frontend",
                containers=[ContainerOptimization(
                    container_name="nginx",
                    cpu_usage_millicores=220,
                    cpu_request_millicores=250,
                    cpu_limit_millicores=500,
                    memory_usage_bytes=480 * 1024 * 1024,
                    memory_request_bytes=512 * 1024 * 1024,
                    memory_limit_bytes=1024 * 1024 * 1024,
                    cpu_efficiency=88.0,
                    memory_efficiency=93.8,
                    cpu_recommendation_millicores=286,
                    memory_recommendation_bytes=624 * 1024 * 1024,
                )],
                total_cpu_usage_millicores=220,
                total_cpu_request_millicores=250,
                total_cpu_limit_millicores=500,
                total_memory_usage_bytes=480 * 1024 * 1024,
                total_memory_request_bytes=512 * 1024 * 1024,
                total_memory_limit_bytes=1024 * 1024 * 1024,
                cpu_efficiency=EfficiencyScore(score=88.0, grade="B", status="review"),
                memory_efficiency=EfficiencyScore(score=93.8, grade="C", status="under_provisioned"),
                overall_efficiency=EfficiencyScore(score=90.9, grade="B", status="review"),
                recommendations=["Increase resource requests to prevent throttling/OOM"],
                optimization_type=OptimizationType.UNDER_PROVISIONED,
                severity=OptimizationSeverity.HIGH,
                current_hourly_cost=0.028,
                optimized_hourly_cost=0.034,
                potential_savings=0,
                savings_percentage=0,
            ),
            PodOptimization(
                name="dev-test-pod-abc123",
                namespace="development",
                owner_kind="Deployment",
                owner_name="dev-test",
                containers=[ContainerOptimization(
                    container_name="app",
                    cpu_usage_millicores=5,
                    cpu_request_millicores=200,
                    cpu_limit_millicores=500,
                    memory_usage_bytes=32 * 1024 * 1024,
                    memory_request_bytes=512 * 1024 * 1024,
                    memory_limit_bytes=1024 * 1024 * 1024,
                    cpu_efficiency=2.5,
                    memory_efficiency=6.3,
                    cpu_recommendation_millicores=10,
                    memory_recommendation_bytes=64 * 1024 * 1024,
                )],
                total_cpu_usage_millicores=5,
                total_cpu_request_millicores=200,
                total_cpu_limit_millicores=500,
                total_memory_usage_bytes=32 * 1024 * 1024,
                total_memory_request_bytes=512 * 1024 * 1024,
                total_memory_limit_bytes=1024 * 1024 * 1024,
                cpu_efficiency=EfficiencyScore(score=2.5, grade="F", status="critical"),
                memory_efficiency=EfficiencyScore(score=6.3, grade="F", status="critical"),
                overall_efficiency=EfficiencyScore(score=4.4, grade="F", status="critical"),
                recommendations=["Pod appears idle - consider scaling down or removing"],
                optimization_type=OptimizationType.IDLE_RESOURCE,
                severity=OptimizationSeverity.HIGH,
                current_hourly_cost=0.025,
                optimized_hourly_cost=0.001,
                potential_savings=0.024,
                savings_percentage=96.0,
            ),
        ]

        summary = self._calculate_summary(demo_pods)
        ns_breakdown = self._calculate_namespace_breakdown(demo_pods)
        recommendations = self._generate_recommendations(demo_pods)

        return OptimizationDashboardResponse(
            summary=summary,
            namespace_breakdown=ns_breakdown,
            top_wasteful_pods=[p for p in demo_pods if p.optimization_type == OptimizationType.OVER_PROVISIONED],
            top_underprovisioned_pods=[p for p in demo_pods if p.optimization_type == OptimizationType.UNDER_PROVISIONED],
            recommendations=recommendations,
            idle_resources=[p for p in demo_pods if p.optimization_type == OptimizationType.IDLE_RESOURCE],
            analyzed_at=datetime.now(timezone.utc),
        )

    async def apply_optimization(
        self, request: ApplyOptimizationRequest
    ) -> ApplyOptimizationResponse:
        """Apply optimization to a Kubernetes workload."""
        namespace = request.namespace
        name = request.resource_name
        container_name = request.container_name

        # Handle demo mode - return simulated response
        if settings.DEMO_MODE:
            return self._get_demo_apply_response(request)

        self._initialize()

        try:
            # Get current resource based on kind
            kind = request.resource_kind.lower()
            actual_kind = request.resource_kind
            actual_name = name

            # Handle ReplicaSet by finding parent Deployment
            if kind == "replicaset":
                try:
                    rs = self._apps_v1.read_namespaced_replica_set(name, namespace)
                    if rs.metadata.owner_references:
                        rs_owner = rs.metadata.owner_references[0]
                        if rs_owner.kind == "Deployment":
                            kind = "deployment"
                            actual_kind = "Deployment"
                            actual_name = rs_owner.name
                            name = actual_name
                except Exception:
                    # Fallback: extract deployment name from ReplicaSet name
                    parts = name.rsplit("-", 1)
                    if len(parts) == 2 and len(parts[1]) >= 8:
                        kind = "deployment"
                        actual_kind = "Deployment"
                        actual_name = parts[0]
                        name = actual_name

            # Fetch the current resource
            if kind == "deployment":
                resource = self._apps_v1.read_namespaced_deployment(name, namespace)
                patch_func = self._apps_v1.patch_namespaced_deployment
            elif kind == "statefulset":
                resource = self._apps_v1.read_namespaced_stateful_set(name, namespace)
                patch_func = self._apps_v1.patch_namespaced_stateful_set
            elif kind == "daemonset":
                resource = self._apps_v1.read_namespaced_daemon_set(name, namespace)
                patch_func = self._apps_v1.patch_namespaced_daemon_set
            else:
                return ApplyOptimizationResponse(
                    success=False,
                    message=f"Unsupported resource kind: {request.resource_kind}. Supported: Deployment, StatefulSet, DaemonSet, ReplicaSet",
                    dry_run=request.dry_run,
                    resource_kind=request.resource_kind,
                    resource_name=name,
                    namespace=namespace,
                )

            # Find the container and get current values
            container_found = False
            previous_values = {}
            changes_applied = {}

            for container in resource.spec.template.spec.containers:
                if container.name == container_name:
                    container_found = True

                    # Store previous values
                    prev = {}
                    if container.resources and container.resources.requests:
                        prev["cpu_request"] = container.resources.requests.get("cpu", "not set")
                        prev["memory_request"] = container.resources.requests.get("memory", "not set")
                    else:
                        prev["cpu_request"] = "not set"
                        prev["memory_request"] = "not set"

                    if container.resources and container.resources.limits:
                        prev["cpu_limit"] = container.resources.limits.get("cpu", "not set")
                        prev["memory_limit"] = container.resources.limits.get("memory", "not set")
                    else:
                        prev["cpu_limit"] = "not set"
                        prev["memory_limit"] = "not set"

                    previous_values[container_name] = prev

                    # Prepare new values
                    new_requests = {}
                    new_limits = {}

                    if request.cpu_request:
                        new_requests["cpu"] = request.cpu_request
                    if request.memory_request:
                        new_requests["memory"] = request.memory_request
                    if request.cpu_limit:
                        new_limits["cpu"] = request.cpu_limit
                    if request.memory_limit:
                        new_limits["memory"] = request.memory_limit

                    changes = {}
                    if request.cpu_request:
                        changes["cpu_request"] = request.cpu_request
                    if request.memory_request:
                        changes["memory_request"] = request.memory_request
                    if request.cpu_limit:
                        changes["cpu_limit"] = request.cpu_limit
                    if request.memory_limit:
                        changes["memory_limit"] = request.memory_limit

                    changes_applied[container_name] = changes
                    break

            if not container_found:
                return ApplyOptimizationResponse(
                    success=False,
                    message=f"Container '{container_name}' not found in {request.resource_kind}/{name}",
                    dry_run=request.dry_run,
                    resource_kind=request.resource_kind,
                    resource_name=name,
                    namespace=namespace,
                )

            # Build the patch
            patch_body = self._build_resource_patch(
                container_name,
                request.cpu_request,
                request.memory_request,
                request.cpu_limit,
                request.memory_limit,
            )

            # Generate YAML diff for preview
            yaml_diff = self._generate_yaml_diff(
                container_name, previous_values.get(container_name, {}), changes_applied.get(container_name, {})
            )

            if request.dry_run:
                return ApplyOptimizationResponse(
                    success=True,
                    message=f"Dry run: Would update {request.resource_kind}/{name} container {container_name}",
                    dry_run=True,
                    resource_kind=request.resource_kind,
                    resource_name=name,
                    namespace=namespace,
                    changes_applied=changes_applied,
                    previous_values=previous_values,
                    yaml_diff=yaml_diff,
                )

            # Apply the patch
            patch_func(name, namespace, patch_body)

            return ApplyOptimizationResponse(
                success=True,
                message=f"Successfully updated {request.resource_kind}/{name} container {container_name}",
                dry_run=False,
                resource_kind=request.resource_kind,
                resource_name=name,
                namespace=namespace,
                changes_applied=changes_applied,
                previous_values=previous_values,
                yaml_diff=yaml_diff,
            )

        except ApiException as e:
            logger.error(f"Kubernetes API error applying optimization: {e}")
            # Fallback to demo mode if K8s is unavailable
            if request.dry_run:
                logger.info("Falling back to demo mode for preview")
                return self._get_demo_apply_response(request)
            return ApplyOptimizationResponse(
                success=False,
                message=f"Kubernetes API error: {e.reason}",
                dry_run=request.dry_run,
                resource_kind=request.resource_kind,
                resource_name=request.resource_name,
                namespace=request.namespace,
            )
        except Exception as e:
            logger.error(f"Error applying optimization: {e}")
            # Fallback to demo mode if K8s is unavailable
            if request.dry_run:
                logger.info("Falling back to demo mode for preview")
                return self._get_demo_apply_response(request)
            return ApplyOptimizationResponse(
                success=False,
                message=f"Error: {str(e)}",
                dry_run=request.dry_run,
                resource_kind=request.resource_kind,
                resource_name=request.resource_name,
                namespace=request.namespace,
            )

    def _get_demo_apply_response(
        self, request: ApplyOptimizationRequest
    ) -> ApplyOptimizationResponse:
        """Return demo response for apply optimization when K8s is unavailable."""
        container_name = request.container_name
        resource_kind = request.resource_kind
        resource_name = request.resource_name

        # Handle ReplicaSet by resolving to parent Deployment name
        if resource_kind.lower() == "replicaset":
            # Extract deployment name from ReplicaSet name pattern: {deployment-name}-{hash}
            parts = resource_name.rsplit("-", 1)
            if len(parts) == 2 and len(parts[1]) >= 8:
                resource_kind = "Deployment"
                resource_name = parts[0]

        # Simulated previous values based on demo data
        demo_previous = {
            "api": {"cpu_request": "500m", "memory_request": "1Gi", "cpu_limit": "1000m", "memory_limit": "2Gi"},
            "nginx": {"cpu_request": "250m", "memory_request": "512Mi", "cpu_limit": "500m", "memory_limit": "1Gi"},
            "app": {"cpu_request": "200m", "memory_request": "512Mi", "cpu_limit": "500m", "memory_limit": "1Gi"},
        }

        # Detect NO_REQUESTS case: if request uses default values (100m/128Mi) and
        # container isn't in demo data, it's likely a container without requests
        is_no_requests = (
            container_name not in demo_previous and
            request.cpu_request in ["100m", None] and
            request.memory_request in ["128Mi", None]
        )

        if is_no_requests:
            previous_values = {
                container_name: {
                    "cpu_request": "not set",
                    "memory_request": "not set",
                    "cpu_limit": "not set",
                    "memory_limit": "not set",
                }
            }
        else:
            previous_values = {
                container_name: demo_previous.get(container_name, {
                    "cpu_request": "500m",
                    "memory_request": "512Mi",
                    "cpu_limit": "1000m",
                    "memory_limit": "1Gi",
                })
            }

        # Build changes applied
        changes_applied = {}
        changes = {}
        if request.cpu_request:
            changes["cpu_request"] = request.cpu_request
        if request.memory_request:
            changes["memory_request"] = request.memory_request
        if request.cpu_limit:
            changes["cpu_limit"] = request.cpu_limit
        if request.memory_limit:
            changes["memory_limit"] = request.memory_limit
        changes_applied[container_name] = changes

        # Generate YAML diff
        yaml_diff = self._generate_yaml_diff(
            container_name, previous_values.get(container_name, {}), changes
        )

        if request.dry_run:
            return ApplyOptimizationResponse(
                success=True,
                message=f"[Demo Mode] Dry run: Would update {resource_kind}/{resource_name} container {container_name}",
                dry_run=True,
                resource_kind=resource_kind,
                resource_name=resource_name,
                namespace=request.namespace,
                changes_applied=changes_applied,
                previous_values=previous_values,
                yaml_diff=yaml_diff,
            )
        else:
            return ApplyOptimizationResponse(
                success=True,
                message=f"[Demo Mode] Successfully updated {resource_kind}/{resource_name} container {container_name} (simulated)",
                dry_run=False,
                resource_kind=resource_kind,
                resource_name=resource_name,
                namespace=request.namespace,
                changes_applied=changes_applied,
                previous_values=previous_values,
                yaml_diff=yaml_diff,
            )

    def _build_resource_patch(
        self,
        container_name: str,
        cpu_request: Optional[str],
        memory_request: Optional[str],
        cpu_limit: Optional[str],
        memory_limit: Optional[str],
    ) -> Dict:
        """Build a strategic merge patch for container resources."""
        resources = {}

        if cpu_request or memory_request:
            resources["requests"] = {}
            if cpu_request:
                resources["requests"]["cpu"] = cpu_request
            if memory_request:
                resources["requests"]["memory"] = memory_request

        if cpu_limit or memory_limit:
            resources["limits"] = {}
            if cpu_limit:
                resources["limits"]["cpu"] = cpu_limit
            if memory_limit:
                resources["limits"]["memory"] = memory_limit

        return {
            "spec": {
                "template": {
                    "spec": {
                        "containers": [
                            {
                                "name": container_name,
                                "resources": resources,
                            }
                        ]
                    }
                }
            }
        }

    def _generate_yaml_diff(
        self, container_name: str, previous: Dict[str, str], new: Dict[str, str]
    ) -> str:
        """Generate a human-readable YAML diff."""
        lines = [f"# Container: {container_name}", "resources:"]

        if "cpu_request" in new or "memory_request" in new:
            lines.append("  requests:")
            if "cpu_request" in new:
                prev_val = previous.get("cpu_request", "not set")
                lines.append(f"    cpu: {new['cpu_request']}  # was: {prev_val}")
            if "memory_request" in new:
                prev_val = previous.get("memory_request", "not set")
                lines.append(f"    memory: {new['memory_request']}  # was: {prev_val}")

        if "cpu_limit" in new or "memory_limit" in new:
            lines.append("  limits:")
            if "cpu_limit" in new:
                prev_val = previous.get("cpu_limit", "not set")
                lines.append(f"    cpu: {new['cpu_limit']}  # was: {prev_val}")
            if "memory_limit" in new:
                prev_val = previous.get("memory_limit", "not set")
                lines.append(f"    memory: {new['memory_limit']}  # was: {prev_val}")

        return "\n".join(lines)

    def generate_yaml_patch(
        self,
        resource_kind: str,
        resource_name: str,
        namespace: str,
        container_name: str,
        cpu_request: Optional[str] = None,
        memory_request: Optional[str] = None,
        cpu_limit: Optional[str] = None,
        memory_limit: Optional[str] = None,
    ) -> str:
        """Generate a YAML patch that can be applied with kubectl."""
        patch = {
            "apiVersion": "apps/v1",
            "kind": resource_kind,
            "metadata": {
                "name": resource_name,
                "namespace": namespace,
            },
            "spec": {
                "template": {
                    "spec": {
                        "containers": [
                            {
                                "name": container_name,
                                "resources": {},
                            }
                        ]
                    }
                }
            },
        }

        resources = patch["spec"]["template"]["spec"]["containers"][0]["resources"]

        if cpu_request or memory_request:
            resources["requests"] = {}
            if cpu_request:
                resources["requests"]["cpu"] = cpu_request
            if memory_request:
                resources["requests"]["memory"] = memory_request

        if cpu_limit or memory_limit:
            resources["limits"] = {}
            if cpu_limit:
                resources["limits"]["cpu"] = cpu_limit
            if memory_limit:
                resources["limits"]["memory"] = memory_limit

        import yaml
        return yaml.dump(patch, default_flow_style=False)


# Singleton instance
optimization_service = OptimizationService()
