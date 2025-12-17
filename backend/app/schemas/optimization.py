"""
Resource optimization related Pydantic models.
Schemas for analyzing and recommending Kubernetes resource optimizations.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class OptimizationSeverity(str, Enum):
    """Severity level of optimization recommendation."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class OptimizationType(str, Enum):
    """Type of optimization recommendation."""
    OVER_PROVISIONED = "over_provisioned"
    UNDER_PROVISIONED = "under_provisioned"
    IDLE_RESOURCE = "idle_resource"
    NO_LIMITS = "no_limits"
    NO_REQUESTS = "no_requests"
    MEMORY_LEAK_RISK = "memory_leak_risk"
    CPU_THROTTLING = "cpu_throttling"
    RIGHT_SIZING = "right_sizing"


class ResourceUsage(BaseModel):
    """Current resource usage metrics."""
    cpu_usage_millicores: int = 0
    cpu_request_millicores: int = 0
    cpu_limit_millicores: int = 0
    memory_usage_bytes: int = 0
    memory_request_bytes: int = 0
    memory_limit_bytes: int = 0


class EfficiencyScore(BaseModel):
    """Efficiency score for a resource."""
    score: float = Field(ge=0, le=100, description="Efficiency score 0-100")
    grade: str = Field(description="Letter grade A-F")
    status: str = Field(description="optimal, review, wasteful, critical")


class ContainerOptimization(BaseModel):
    """Optimization data for a single container."""
    container_name: str
    cpu_usage_millicores: int = 0
    cpu_request_millicores: int = 0
    cpu_limit_millicores: int = 0
    memory_usage_bytes: int = 0
    memory_request_bytes: int = 0
    memory_limit_bytes: int = 0
    cpu_efficiency: float = 0.0
    memory_efficiency: float = 0.0
    cpu_recommendation_millicores: Optional[int] = None
    memory_recommendation_bytes: Optional[int] = None


class PodOptimization(BaseModel):
    """Optimization analysis for a single pod."""
    name: str
    namespace: str
    owner_kind: Optional[str] = None
    owner_name: Optional[str] = None
    containers: List[ContainerOptimization] = []

    # Aggregated metrics
    total_cpu_usage_millicores: int = 0
    total_cpu_request_millicores: int = 0
    total_cpu_limit_millicores: int = 0
    total_memory_usage_bytes: int = 0
    total_memory_request_bytes: int = 0
    total_memory_limit_bytes: int = 0

    # Efficiency scores
    cpu_efficiency: EfficiencyScore
    memory_efficiency: EfficiencyScore
    overall_efficiency: EfficiencyScore

    # Recommendations
    recommendations: List[str] = []
    optimization_type: Optional[OptimizationType] = None
    severity: OptimizationSeverity = OptimizationSeverity.INFO

    # Cost impact
    current_hourly_cost: float = 0.0
    optimized_hourly_cost: float = 0.0
    potential_savings: float = 0.0
    savings_percentage: float = 0.0


class NamespaceOptimization(BaseModel):
    """Optimization summary for a namespace."""
    namespace: str
    pod_count: int = 0
    optimized_pods: int = 0
    over_provisioned_pods: int = 0
    under_provisioned_pods: int = 0
    idle_pods: int = 0

    # Aggregated efficiency
    avg_cpu_efficiency: float = 0.0
    avg_memory_efficiency: float = 0.0
    overall_efficiency: EfficiencyScore

    # Cost impact
    current_hourly_cost: float = 0.0
    potential_hourly_savings: float = 0.0
    savings_percentage: float = 0.0


class OptimizationRecommendation(BaseModel):
    """A specific optimization recommendation."""
    id: str
    type: OptimizationType
    severity: OptimizationSeverity
    title: str
    description: str

    # Resource details
    resource_kind: str  # Pod, Deployment, StatefulSet, etc.
    resource_name: str
    namespace: str
    container_name: Optional[str] = None

    # Current vs Recommended
    current_cpu_request: Optional[str] = None
    current_cpu_limit: Optional[str] = None
    current_memory_request: Optional[str] = None
    current_memory_limit: Optional[str] = None

    recommended_cpu_request: Optional[str] = None
    recommended_cpu_limit: Optional[str] = None
    recommended_memory_request: Optional[str] = None
    recommended_memory_limit: Optional[str] = None

    # Impact
    current_cost: float = 0.0
    estimated_savings: float = 0.0
    savings_percentage: float = 0.0
    risk_level: str = "low"  # low, medium, high

    # Action
    action: str
    yaml_patch: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)


class ClusterOptimizationSummary(BaseModel):
    """Overall cluster optimization summary."""
    total_pods: int = 0
    analyzed_pods: int = 0

    # Categories
    optimal_pods: int = 0
    over_provisioned_pods: int = 0
    under_provisioned_pods: int = 0
    idle_pods: int = 0
    no_limits_pods: int = 0
    no_requests_pods: int = 0

    # Efficiency
    avg_cpu_efficiency: float = 0.0
    avg_memory_efficiency: float = 0.0
    cluster_efficiency_score: EfficiencyScore

    # Cost
    total_current_hourly_cost: float = 0.0
    total_potential_savings: float = 0.0
    total_savings_percentage: float = 0.0

    # Totals
    total_cpu_requested_millicores: int = 0
    total_cpu_used_millicores: int = 0
    total_memory_requested_bytes: int = 0
    total_memory_used_bytes: int = 0


class OptimizationDashboardResponse(BaseModel):
    """Full optimization dashboard response."""
    summary: ClusterOptimizationSummary
    namespace_breakdown: List[NamespaceOptimization]
    top_wasteful_pods: List[PodOptimization]
    top_underprovisioned_pods: List[PodOptimization]
    recommendations: List[OptimizationRecommendation]
    idle_resources: List[PodOptimization]

    # Timestamp
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)


class OptimizationHistoryPoint(BaseModel):
    """Historical optimization data point."""
    timestamp: datetime
    cluster_efficiency: float
    total_pods: int
    optimized_pods: int
    potential_savings: float


class ResourceTrendData(BaseModel):
    """Resource usage trend data."""
    timestamp: datetime
    cpu_usage_percent: float
    memory_usage_percent: float
    cpu_request_percent: float
    memory_request_percent: float


class ApplyOptimizationRequest(BaseModel):
    """Request to apply an optimization recommendation."""
    namespace: str
    resource_kind: str  # Deployment, StatefulSet, DaemonSet
    resource_name: str
    container_name: str
    cpu_request: Optional[str] = None
    cpu_limit: Optional[str] = None
    memory_request: Optional[str] = None
    memory_limit: Optional[str] = None
    dry_run: bool = True  # Default to dry-run for safety


class ApplyOptimizationResponse(BaseModel):
    """Response after applying optimization."""
    success: bool
    message: str
    dry_run: bool
    resource_kind: str
    resource_name: str
    namespace: str
    changes_applied: Dict[str, Dict[str, str]] = {}  # container -> {cpu_request, memory_request, etc}
    previous_values: Dict[str, Dict[str, str]] = {}
    yaml_diff: Optional[str] = None


class BatchApplyRequest(BaseModel):
    """Request to apply multiple optimizations."""
    recommendation_ids: List[str]
    dry_run: bool = True


class BatchApplyResponse(BaseModel):
    """Response after batch applying optimizations."""
    success: bool
    total: int
    applied: int
    failed: int
    dry_run: bool
    results: List[ApplyOptimizationResponse]
