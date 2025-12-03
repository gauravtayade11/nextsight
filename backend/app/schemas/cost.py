"""
Cost analysis related Pydantic models.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ResourceType(str, Enum):
    """Types of Kubernetes resources for cost tracking."""

    CPU = "cpu"
    MEMORY = "memory"
    STORAGE = "storage"
    NETWORK = "network"
    GPU = "gpu"


class TimeGranularity(str, Enum):
    """Time granularity for cost aggregation."""

    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class CostBreakdown(BaseModel):
    """Cost breakdown by resource type."""

    cpu: float = 0.0
    memory: float = 0.0
    storage: float = 0.0
    network: float = 0.0
    gpu: float = 0.0
    total: float = 0.0


class NamespaceCost(BaseModel):
    """Cost information for a namespace."""

    namespace: str
    costs: CostBreakdown
    pod_count: int = 0
    deployment_count: int = 0
    percentage_of_total: float = 0.0


class PodCost(BaseModel):
    """Cost information for a pod."""

    name: str
    namespace: str
    costs: CostBreakdown
    cpu_request: str
    cpu_limit: str
    memory_request: str
    memory_limit: str
    age: str
    owner_kind: Optional[str] = None
    owner_name: Optional[str] = None


class CostTrend(BaseModel):
    """Cost trend data point."""

    timestamp: datetime
    costs: CostBreakdown


class CostRecommendation(BaseModel):
    """Cost optimization recommendation."""

    id: str
    type: str  # e.g., "rightsizing", "unused_resource", "reserved_instance"
    severity: str  # "low", "medium", "high"
    title: str
    description: str
    resource_type: str
    resource_name: str
    namespace: str
    current_cost: float
    estimated_savings: float
    percentage_savings: float
    action: str


class CostConfig(BaseModel):
    """Cost configuration including pricing."""

    cpu_hourly_cost: float = 0.031611  # per vCPU per hour (average cloud pricing)
    memory_gb_hourly_cost: float = 0.004237  # per GB per hour
    storage_gb_monthly_cost: float = 0.10  # per GB per month
    network_gb_cost: float = 0.01  # per GB egress
    gpu_hourly_cost: float = 0.50  # per GPU per hour
    currency: str = "USD"


class ClusterCostSummary(BaseModel):
    """Summary of cluster-wide costs."""

    total_cost: CostBreakdown
    cost_by_namespace: List[NamespaceCost]
    cost_trend: List[CostTrend]
    recommendations: List[CostRecommendation]
    top_costly_pods: List[PodCost]
    config: CostConfig
    period_start: datetime
    period_end: datetime


class CostAllocationResponse(BaseModel):
    """Response for cost allocation by team/project."""

    allocations: Dict[str, CostBreakdown]  # key: team/project name
    total: CostBreakdown
    unallocated: CostBreakdown


class CostComparisonResponse(BaseModel):
    """Response for cost comparison between periods."""

    current_period: CostBreakdown
    previous_period: CostBreakdown
    change_absolute: CostBreakdown
    change_percentage: CostBreakdown


class ResourceEfficiency(BaseModel):
    """Resource efficiency metrics for a resource."""

    name: str
    namespace: str
    resource_type: str
    requested: float
    used: float
    limit: float
    efficiency_percentage: float
    waste_cost: float


class CostDashboardResponse(BaseModel):
    """Full cost dashboard response."""

    summary: ClusterCostSummary
    namespace_breakdown: List[NamespaceCost]
    recommendations: List[CostRecommendation]
    efficiency_metrics: List[ResourceEfficiency]
    total_monthly_estimate: float
    total_annual_estimate: float
