from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ClusterStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    UNKNOWN = "unknown"


class ClusterConfig(BaseModel):
    """Configuration for a Kubernetes cluster."""

    id: str = Field(..., description="Unique cluster identifier")
    name: str = Field(..., description="Display name for the cluster")
    context: Optional[str] = Field(None, description="Kubeconfig context name")
    kubeconfig_path: Optional[str] = Field(None, description="Path to kubeconfig file")
    in_cluster: bool = Field(False, description="Whether running in-cluster")
    host_override: Optional[str] = Field(None, description="Host override for Docker Desktop")
    is_default: bool = Field(False, description="Whether this is the default cluster")


class ClusterInfo(BaseModel):
    """Basic cluster information."""

    id: str
    name: str
    context: Optional[str] = None
    status: ClusterStatus = ClusterStatus.UNKNOWN
    is_active: bool = False
    is_default: bool = False
    version: Optional[str] = None
    platform: Optional[str] = None
    node_count: int = 0
    namespace_count: int = 0


class ClusterHealth(BaseModel):
    """Cluster health status."""

    cluster_id: str
    healthy: bool
    status: ClusterStatus
    node_count: int = 0
    ready_nodes: int = 0
    total_pods: int = 0
    running_pods: int = 0
    namespaces: int = 0
    warnings: List[str] = []
    error: Optional[str] = None
    checked_at: datetime


class ClusterMetricsSummary(BaseModel):
    """Summary of cluster resource metrics."""

    cluster_id: str
    cpu_capacity: str
    cpu_usage: str
    cpu_percent: float
    memory_capacity: str
    memory_usage: str
    memory_percent: float
    storage_capacity: Optional[str] = None
    storage_usage: Optional[str] = None


class SetActiveClusterRequest(BaseModel):
    """Request to set the active cluster."""

    cluster_id: str = Field(..., description="ID of the cluster to set as active")


class ClusterListResponse(BaseModel):
    """Response containing list of clusters."""

    clusters: List[ClusterInfo]
    active_cluster_id: Optional[str] = None
    total: int


class AddClusterRequest(BaseModel):
    """Request to add a new cluster configuration."""

    id: str = Field(..., min_length=1, max_length=50, description="Unique cluster ID")
    name: str = Field(..., min_length=1, max_length=100, description="Display name")
    context: Optional[str] = Field(None, description="Kubeconfig context name")
    kubeconfig_path: Optional[str] = Field(None, description="Path to kubeconfig file")
    is_default: bool = Field(False, description="Set as default cluster")


class ClusterContextInfo(BaseModel):
    """Information about a kubeconfig context."""

    name: str
    cluster: str
    user: str
    namespace: Optional[str] = None
