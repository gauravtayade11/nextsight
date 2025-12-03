"""
Cost analysis service for Kubernetes resource cost tracking.
Calculates costs based on resource usage and configurable pricing.
"""

import logging
import random
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from kubernetes import client
from kubernetes.client import ApiException

from app.schemas.cost import (
    ClusterCostSummary,
    CostBreakdown,
    CostConfig,
    CostDashboardResponse,
    CostRecommendation,
    CostTrend,
    NamespaceCost,
    PodCost,
    ResourceEfficiency,
)

logger = logging.getLogger(__name__)


class CostService:
    """Service for calculating and analyzing Kubernetes resource costs."""

    def __init__(self, config: Optional[CostConfig] = None):
        """Initialize cost service with optional custom pricing config."""
        self.config = config or CostConfig()
        self._k8s_core_v1 = None
        self._k8s_apps_v1 = None
        self._metrics_api = None

    def _get_core_api(self) -> client.CoreV1Api:
        """Get or create CoreV1Api client."""
        if not self._k8s_core_v1:
            try:
                client.Configuration.set_default(client.Configuration())
                self._k8s_core_v1 = client.CoreV1Api()
            except Exception as e:
                logger.warning(f"Failed to create CoreV1Api: {e}")
                self._k8s_core_v1 = client.CoreV1Api()
        return self._k8s_core_v1

    def _parse_resource_value(self, value: str, resource_type: str) -> float:
        """
        Parse Kubernetes resource value to a numeric value.

        For CPU: returns cores (e.g., "100m" -> 0.1, "1" -> 1.0)
        For Memory: returns bytes (e.g., "256Mi" -> 268435456)
        """
        if not value:
            return 0.0

        value = str(value).strip()

        if resource_type == "cpu":
            if value.endswith("m"):
                return float(value[:-1]) / 1000
            elif value.endswith("n"):
                return float(value[:-1]) / 1000000000
            else:
                return float(value)

        elif resource_type == "memory":
            multipliers = {
                "Ki": 1024,
                "Mi": 1024**2,
                "Gi": 1024**3,
                "Ti": 1024**4,
                "K": 1000,
                "M": 1000**2,
                "G": 1000**3,
                "T": 1000**4,
            }

            for suffix, mult in multipliers.items():
                if value.endswith(suffix):
                    return float(value[: -len(suffix)]) * mult

            # Plain bytes
            try:
                return float(value)
            except ValueError:
                return 0.0

        return 0.0

    def _bytes_to_gb(self, bytes_value: float) -> float:
        """Convert bytes to gigabytes."""
        return bytes_value / (1024**3)

    def _calculate_pod_hourly_cost(
        self, cpu_request: float, memory_bytes: float, storage_bytes: float = 0, gpu_count: int = 0
    ) -> CostBreakdown:
        """Calculate hourly cost for a pod based on resource requests."""
        cpu_cost = cpu_request * self.config.cpu_hourly_cost
        memory_cost = self._bytes_to_gb(memory_bytes) * self.config.memory_gb_hourly_cost
        storage_cost = (
            self._bytes_to_gb(storage_bytes) * self.config.storage_gb_monthly_cost
        ) / 720  # Monthly to hourly
        gpu_cost = gpu_count * self.config.gpu_hourly_cost

        total = cpu_cost + memory_cost + storage_cost + gpu_cost

        return CostBreakdown(
            cpu=round(cpu_cost, 4),
            memory=round(memory_cost, 4),
            storage=round(storage_cost, 4),
            gpu=round(gpu_cost, 4),
            total=round(total, 4),
        )

    async def get_namespace_costs(self) -> List[NamespaceCost]:
        """Get costs broken down by namespace."""
        try:
            core_api = self._get_core_api()

            # Get all namespaces
            namespaces = core_api.list_namespace()

            # Get all pods
            pods = core_api.list_pod_for_all_namespaces()

            # Calculate costs by namespace
            namespace_costs: Dict[str, Dict] = {}

            for pod in pods.items:
                ns = pod.metadata.namespace
                if ns not in namespace_costs:
                    namespace_costs[ns] = {"costs": CostBreakdown(), "pod_count": 0, "deployments": set()}

                # Sum up container resources
                cpu_request = 0.0
                memory_request = 0.0

                if pod.spec.containers:
                    for container in pod.spec.containers:
                        if container.resources and container.resources.requests:
                            cpu_request += self._parse_resource_value(
                                container.resources.requests.get("cpu", "0"), "cpu"
                            )
                            memory_request += self._parse_resource_value(
                                container.resources.requests.get("memory", "0"), "memory"
                            )

                # Calculate hourly cost
                pod_cost = self._calculate_pod_hourly_cost(cpu_request, memory_request)

                # Aggregate to namespace
                ns_cost = namespace_costs[ns]["costs"]
                namespace_costs[ns]["costs"] = CostBreakdown(
                    cpu=ns_cost.cpu + pod_cost.cpu,
                    memory=ns_cost.memory + pod_cost.memory,
                    storage=ns_cost.storage + pod_cost.storage,
                    gpu=ns_cost.gpu + pod_cost.gpu,
                    total=ns_cost.total + pod_cost.total,
                )
                namespace_costs[ns]["pod_count"] += 1

                # Track deployments
                if pod.metadata.owner_references:
                    for owner in pod.metadata.owner_references:
                        if owner.kind == "ReplicaSet":
                            namespace_costs[ns]["deployments"].add(owner.name.rsplit("-", 1)[0])

            # Calculate total
            total_cost = sum(nc["costs"].total for nc in namespace_costs.values())

            # Build response
            result = []
            for ns, data in namespace_costs.items():
                result.append(
                    NamespaceCost(
                        namespace=ns,
                        costs=data["costs"],
                        pod_count=data["pod_count"],
                        deployment_count=len(data["deployments"]),
                        percentage_of_total=round((data["costs"].total / total_cost * 100) if total_cost > 0 else 0, 2),
                    )
                )

            # Sort by cost descending
            result.sort(key=lambda x: x.costs.total, reverse=True)

            return result

        except ApiException as e:
            logger.error(f"Kubernetes API error: {e}")
            return self._get_demo_namespace_costs()
        except Exception as e:
            logger.error(f"Error getting namespace costs: {e}")
            return self._get_demo_namespace_costs()

    def _get_demo_namespace_costs(self) -> List[NamespaceCost]:
        """Return demo namespace costs when K8s API is unavailable."""
        namespaces = [
            ("production", 45.23, 12, 5),
            ("staging", 23.45, 8, 4),
            ("development", 15.67, 15, 6),
            ("monitoring", 8.90, 5, 3),
            ("kube-system", 5.34, 12, 8),
            ("default", 2.10, 3, 1),
        ]

        total = sum(cost for _, cost, _, _ in namespaces)

        return [
            NamespaceCost(
                namespace=ns,
                costs=CostBreakdown(
                    cpu=cost * 0.6, memory=cost * 0.3, storage=cost * 0.08, network=cost * 0.02, total=cost
                ),
                pod_count=pods,
                deployment_count=deps,
                percentage_of_total=round(cost / total * 100, 2),
            )
            for ns, cost, pods, deps in namespaces
        ]

    async def get_top_costly_pods(self, limit: int = 10) -> List[PodCost]:
        """Get the most expensive pods."""
        try:
            core_api = self._get_core_api()
            pods = core_api.list_pod_for_all_namespaces()

            pod_costs = []

            for pod in pods.items:
                cpu_request = 0.0
                cpu_limit = 0.0
                memory_request = 0.0
                memory_limit = 0.0

                if pod.spec.containers:
                    for container in pod.spec.containers:
                        if container.resources:
                            if container.resources.requests:
                                cpu_request += self._parse_resource_value(
                                    container.resources.requests.get("cpu", "0"), "cpu"
                                )
                                memory_request += self._parse_resource_value(
                                    container.resources.requests.get("memory", "0"), "memory"
                                )
                            if container.resources.limits:
                                cpu_limit += self._parse_resource_value(
                                    container.resources.limits.get("cpu", "0"), "cpu"
                                )
                                memory_limit += self._parse_resource_value(
                                    container.resources.limits.get("memory", "0"), "memory"
                                )

                costs = self._calculate_pod_hourly_cost(cpu_request, memory_request)

                # Get owner info
                owner_kind = None
                owner_name = None
                if pod.metadata.owner_references:
                    owner = pod.metadata.owner_references[0]
                    owner_kind = owner.kind
                    owner_name = owner.name

                # Calculate age
                if pod.metadata.creation_timestamp:
                    age_delta = datetime.now(pod.metadata.creation_timestamp.tzinfo) - pod.metadata.creation_timestamp
                    age = f"{age_delta.days}d" if age_delta.days > 0 else f"{age_delta.seconds // 3600}h"
                else:
                    age = "Unknown"

                pod_costs.append(
                    PodCost(
                        name=pod.metadata.name,
                        namespace=pod.metadata.namespace,
                        costs=costs,
                        cpu_request=f"{cpu_request:.2f}",
                        cpu_limit=f"{cpu_limit:.2f}",
                        memory_request=f"{self._bytes_to_gb(memory_request):.2f}Gi",
                        memory_limit=f"{self._bytes_to_gb(memory_limit):.2f}Gi",
                        age=age,
                        owner_kind=owner_kind,
                        owner_name=owner_name,
                    )
                )

            # Sort by cost and return top N
            pod_costs.sort(key=lambda x: x.costs.total, reverse=True)
            return pod_costs[:limit]

        except Exception as e:
            logger.error(f"Error getting pod costs: {e}")
            return self._get_demo_pod_costs(limit)

    def _get_demo_pod_costs(self, limit: int = 10) -> List[PodCost]:
        """Return demo pod costs."""
        demo_pods = [
            (
                "api-server-7d8b9c6f-xk2p3",
                "production",
                2.34,
                "500m",
                "1",
                "1Gi",
                "2Gi",
                "15d",
                "ReplicaSet",
                "api-server-7d8b9c6f",
            ),
            (
                "web-frontend-5c4d3e2f-lm9n8",
                "production",
                1.87,
                "250m",
                "500m",
                "512Mi",
                "1Gi",
                "15d",
                "ReplicaSet",
                "web-frontend-5c4d3e2f",
            ),
            ("postgres-0", "production", 1.56, "1", "2", "2Gi", "4Gi", "30d", "StatefulSet", "postgres"),
            (
                "redis-master-0",
                "production",
                0.98,
                "200m",
                "500m",
                "256Mi",
                "512Mi",
                "30d",
                "StatefulSet",
                "redis-master",
            ),
            (
                "worker-6f5e4d3c-ab1c2",
                "production",
                0.87,
                "400m",
                "800m",
                "512Mi",
                "1Gi",
                "10d",
                "ReplicaSet",
                "worker-6f5e4d3c",
            ),
            ("prometheus-0", "monitoring", 0.76, "500m", "1", "1Gi", "2Gi", "45d", "StatefulSet", "prometheus"),
            (
                "grafana-7a8b9c0d-xy1z2",
                "monitoring",
                0.54,
                "100m",
                "200m",
                "256Mi",
                "512Mi",
                "45d",
                "ReplicaSet",
                "grafana-7a8b9c0d",
            ),
            ("elasticsearch-0", "monitoring", 0.89, "500m", "1", "2Gi", "4Gi", "20d", "StatefulSet", "elasticsearch"),
            (
                "test-app-1a2b3c4d-ef5g6",
                "staging",
                0.45,
                "100m",
                "200m",
                "128Mi",
                "256Mi",
                "5d",
                "ReplicaSet",
                "test-app-1a2b3c4d",
            ),
            (
                "dev-service-8h9i0j1k-mn2o3",
                "development",
                0.32,
                "50m",
                "100m",
                "64Mi",
                "128Mi",
                "2d",
                "ReplicaSet",
                "dev-service-8h9i0j1k",
            ),
        ]

        return [
            PodCost(
                name=name,
                namespace=ns,
                costs=CostBreakdown(cpu=cost * 0.6, memory=cost * 0.35, storage=cost * 0.05, total=cost),
                cpu_request=cpu_req,
                cpu_limit=cpu_lim,
                memory_request=mem_req,
                memory_limit=mem_lim,
                age=age,
                owner_kind=owner_kind,
                owner_name=owner_name,
            )
            for name, ns, cost, cpu_req, cpu_lim, mem_req, mem_lim, age, owner_kind, owner_name in demo_pods[:limit]
        ]

    async def get_cost_trends(self, days: int = 30) -> List[CostTrend]:
        """Get cost trends over time."""
        # Generate trend data (in production, this would come from stored metrics)
        trends = []
        base_cost = 100.0
        now = datetime.utcnow()

        for i in range(days, -1, -1):
            timestamp = now - timedelta(days=i)
            # Add some variation to simulate real costs
            variation = random.uniform(0.85, 1.15)
            daily_cost = base_cost * variation

            trends.append(
                CostTrend(
                    timestamp=timestamp,
                    costs=CostBreakdown(
                        cpu=daily_cost * 0.55,
                        memory=daily_cost * 0.30,
                        storage=daily_cost * 0.10,
                        network=daily_cost * 0.05,
                        total=daily_cost,
                    ),
                )
            )

        return trends

    async def get_recommendations(self) -> List[CostRecommendation]:
        """Generate cost optimization recommendations."""
        # In production, these would be based on actual resource analysis
        recommendations = [
            CostRecommendation(
                id=str(uuid.uuid4()),
                type="rightsizing",
                severity="high",
                title="Over-provisioned pods in production",
                description="Several pods in the production namespace have CPU requests significantly higher than actual usage. Consider reducing CPU requests to match actual needs.",
                resource_type="Deployment",
                resource_name="api-server",
                namespace="production",
                current_cost=45.23,
                estimated_savings=12.50,
                percentage_savings=27.6,
                action="Reduce CPU requests from 500m to 200m",
            ),
            CostRecommendation(
                id=str(uuid.uuid4()),
                type="unused_resource",
                severity="medium",
                title="Idle development pods",
                description="Multiple pods in the development namespace have been running with near-zero utilization for over 7 days.",
                resource_type="Namespace",
                resource_name="development",
                namespace="development",
                current_cost=15.67,
                estimated_savings=10.00,
                percentage_savings=63.8,
                action="Scale down or terminate unused pods",
            ),
            CostRecommendation(
                id=str(uuid.uuid4()),
                type="rightsizing",
                severity="medium",
                title="Memory over-allocation in staging",
                description="Pods in staging namespace have memory limits set 3x higher than peak usage.",
                resource_type="Deployment",
                resource_name="web-frontend",
                namespace="staging",
                current_cost=23.45,
                estimated_savings=8.20,
                percentage_savings=35.0,
                action="Reduce memory limits from 2Gi to 768Mi",
            ),
            CostRecommendation(
                id=str(uuid.uuid4()),
                type="reserved_instance",
                severity="low",
                title="Consider reserved capacity",
                description="Your cluster has consistent baseline usage. Consider using reserved capacity or committed use discounts.",
                resource_type="Cluster",
                resource_name="main-cluster",
                namespace="*",
                current_cost=100.69,
                estimated_savings=20.14,
                percentage_savings=20.0,
                action="Purchase reserved node capacity",
            ),
        ]

        return recommendations

    async def get_efficiency_metrics(self) -> List[ResourceEfficiency]:
        """Get resource efficiency metrics."""
        # Demo efficiency metrics
        metrics = [
            ResourceEfficiency(
                name="api-server",
                namespace="production",
                resource_type="cpu",
                requested=0.5,
                used=0.18,
                limit=1.0,
                efficiency_percentage=36.0,
                waste_cost=7.50,
            ),
            ResourceEfficiency(
                name="api-server",
                namespace="production",
                resource_type="memory",
                requested=1073741824,  # 1Gi
                used=429496729,  # ~400Mi
                limit=2147483648,  # 2Gi
                efficiency_percentage=40.0,
                waste_cost=3.20,
            ),
            ResourceEfficiency(
                name="postgres",
                namespace="production",
                resource_type="cpu",
                requested=1.0,
                used=0.65,
                limit=2.0,
                efficiency_percentage=65.0,
                waste_cost=8.10,
            ),
            ResourceEfficiency(
                name="web-frontend",
                namespace="staging",
                resource_type="memory",
                requested=536870912,  # 512Mi
                used=134217728,  # ~128Mi
                limit=1073741824,  # 1Gi
                efficiency_percentage=25.0,
                waste_cost=4.50,
            ),
        ]

        return metrics

    async def get_cost_dashboard(self) -> CostDashboardResponse:
        """Get complete cost dashboard data."""
        namespace_costs = await self.get_namespace_costs()
        top_pods = await self.get_top_costly_pods(10)
        trends = await self.get_cost_trends(30)
        recommendations = await self.get_recommendations()
        efficiency = await self.get_efficiency_metrics()

        # Calculate totals
        total_hourly = sum(ns.costs.total for ns in namespace_costs)
        total_monthly = total_hourly * 720  # hours in a month
        total_annual = total_monthly * 12

        total_costs = CostBreakdown(
            cpu=sum(ns.costs.cpu for ns in namespace_costs),
            memory=sum(ns.costs.memory for ns in namespace_costs),
            storage=sum(ns.costs.storage for ns in namespace_costs),
            network=sum(ns.costs.network for ns in namespace_costs),
            gpu=sum(ns.costs.gpu for ns in namespace_costs),
            total=total_hourly,
        )

        summary = ClusterCostSummary(
            total_cost=total_costs,
            cost_by_namespace=namespace_costs,
            cost_trend=trends,
            recommendations=recommendations,
            top_costly_pods=top_pods,
            config=self.config,
            period_start=datetime.utcnow() - timedelta(days=30),
            period_end=datetime.utcnow(),
        )

        return CostDashboardResponse(
            summary=summary,
            namespace_breakdown=namespace_costs,
            recommendations=recommendations,
            efficiency_metrics=efficiency,
            total_monthly_estimate=round(total_monthly, 2),
            total_annual_estimate=round(total_annual, 2),
        )


# Singleton instance
cost_service = CostService()
