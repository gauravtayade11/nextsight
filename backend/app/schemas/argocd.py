"""
ArgoCD schemas for API requests and responses.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class HealthStatus(str, Enum):
    """ArgoCD application health status."""
    HEALTHY = "Healthy"
    PROGRESSING = "Progressing"
    DEGRADED = "Degraded"
    SUSPENDED = "Suspended"
    MISSING = "Missing"
    UNKNOWN = "Unknown"


class SyncStatus(str, Enum):
    """ArgoCD application sync status."""
    SYNCED = "Synced"
    OUT_OF_SYNC = "OutOfSync"
    UNKNOWN = "Unknown"


class OperationPhase(str, Enum):
    """ArgoCD operation phase."""
    RUNNING = "Running"
    SUCCEEDED = "Succeeded"
    FAILED = "Failed"
    ERROR = "Error"
    TERMINATING = "Terminating"


class ResourceStatus(BaseModel):
    """Status of a Kubernetes resource managed by ArgoCD."""
    group: Optional[str] = None
    version: str = ""
    kind: str = ""
    namespace: Optional[str] = None
    name: str = ""
    status: Optional[str] = None
    health: Optional[HealthStatus] = None
    hook: Optional[bool] = None
    requires_pruning: bool = Field(default=False, alias="requiresPruning")

    class Config:
        populate_by_name = True


class ApplicationSource(BaseModel):
    """ArgoCD application source configuration."""
    repo_url: str = Field(alias="repoURL")
    path: Optional[str] = None
    target_revision: str = Field(default="HEAD", alias="targetRevision")
    chart: Optional[str] = None
    helm: Optional[Dict[str, Any]] = None
    kustomize: Optional[Dict[str, Any]] = None
    directory: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True


class ApplicationDestination(BaseModel):
    """ArgoCD application destination configuration."""
    server: str = ""
    namespace: str = ""
    name: Optional[str] = None


class SyncPolicy(BaseModel):
    """ArgoCD sync policy configuration."""
    automated: Optional[Dict[str, Any]] = None
    sync_options: Optional[List[str]] = Field(default=None, alias="syncOptions")
    retry: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True


class ApplicationSpec(BaseModel):
    """ArgoCD application spec."""
    source: ApplicationSource
    destination: ApplicationDestination
    project: str = "default"
    sync_policy: Optional[SyncPolicy] = Field(default=None, alias="syncPolicy")

    class Config:
        populate_by_name = True


class HealthInfo(BaseModel):
    """ArgoCD health information."""
    status: HealthStatus = HealthStatus.UNKNOWN
    message: Optional[str] = None


class SyncInfo(BaseModel):
    """ArgoCD sync information."""
    status: SyncStatus = SyncStatus.UNKNOWN
    revision: Optional[str] = None
    compared_to: Optional[Dict[str, Any]] = Field(default=None, alias="comparedTo")

    class Config:
        populate_by_name = True


class OperationState(BaseModel):
    """ArgoCD operation state."""
    phase: OperationPhase = OperationPhase.RUNNING
    message: Optional[str] = None
    started_at: Optional[datetime] = Field(default=None, alias="startedAt")
    finished_at: Optional[datetime] = Field(default=None, alias="finishedAt")
    sync_result: Optional[Dict[str, Any]] = Field(default=None, alias="syncResult")

    class Config:
        populate_by_name = True


class ApplicationStatus(BaseModel):
    """ArgoCD application status."""
    health: HealthInfo = Field(default_factory=HealthInfo)
    sync: SyncInfo = Field(default_factory=SyncInfo)
    operation_state: Optional[OperationState] = Field(default=None, alias="operationState")
    resources: List[ResourceStatus] = Field(default_factory=list)
    summary: Optional[Dict[str, Any]] = None
    conditions: Optional[List[Dict[str, Any]]] = None

    class Config:
        populate_by_name = True


class Application(BaseModel):
    """ArgoCD application."""
    name: str
    namespace: str = "argocd"
    project: str = "default"
    spec: ApplicationSpec
    status: ApplicationStatus = Field(default_factory=ApplicationStatus)
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")

    class Config:
        populate_by_name = True


class ApplicationSummary(BaseModel):
    """Summary of an ArgoCD application for listing."""
    name: str
    namespace: str = "argocd"
    project: str = "default"
    repo_url: str = Field(alias="repoURL")
    path: Optional[str] = None
    target_revision: str = Field(default="HEAD", alias="targetRevision")
    dest_server: str = Field(alias="destServer")
    dest_namespace: str = Field(alias="destNamespace")
    health_status: HealthStatus = Field(default=HealthStatus.UNKNOWN, alias="healthStatus")
    sync_status: SyncStatus = Field(default=SyncStatus.UNKNOWN, alias="syncStatus")
    sync_revision: Optional[str] = Field(default=None, alias="syncRevision")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")

    class Config:
        populate_by_name = True


class ApplicationListResponse(BaseModel):
    """Response for listing applications."""
    applications: List[ApplicationSummary] = Field(default_factory=list)
    total: int = 0


class SyncRequest(BaseModel):
    """Request to sync an application."""
    revision: Optional[str] = None
    dry_run: bool = Field(default=False, alias="dryRun")
    prune: bool = False
    force: bool = False
    strategy: Optional[Dict[str, Any]] = None
    resources: Optional[List[Dict[str, str]]] = None

    class Config:
        populate_by_name = True


class SyncResult(BaseModel):
    """Result of a sync operation."""
    success: bool
    message: str
    revision: Optional[str] = None
    resources: List[ResourceStatus] = Field(default_factory=list)


class RollbackRequest(BaseModel):
    """Request to rollback an application."""
    id: int = Field(..., description="Revision ID to rollback to")
    dry_run: bool = Field(default=False, alias="dryRun")
    prune: bool = False

    class Config:
        populate_by_name = True


class RevisionHistory(BaseModel):
    """Application revision history entry."""
    id: int
    revision: str
    deployed_at: Optional[datetime] = Field(default=None, alias="deployedAt")
    source: ApplicationSource
    deploy_started_at: Optional[datetime] = Field(default=None, alias="deployStartedAt")

    class Config:
        populate_by_name = True


class RevisionHistoryResponse(BaseModel):
    """Response for revision history."""
    history: List[RevisionHistory] = Field(default_factory=list)


class CreateApplicationRequest(BaseModel):
    """Request to create a new application."""
    name: str
    project: str = "default"
    repo_url: str = Field(alias="repoURL")
    path: Optional[str] = None
    target_revision: str = Field(default="HEAD", alias="targetRevision")
    chart: Optional[str] = None
    dest_server: str = Field(alias="destServer")
    dest_namespace: str = Field(alias="destNamespace")
    auto_sync: bool = Field(default=False, alias="autoSync")
    self_heal: bool = Field(default=False, alias="selfHeal")
    prune: bool = False
    helm_values: Optional[Dict[str, Any]] = Field(default=None, alias="helmValues")

    class Config:
        populate_by_name = True


class ApplicationEvent(BaseModel):
    """ArgoCD application event."""
    type: str
    reason: str
    message: str
    first_timestamp: Optional[datetime] = Field(default=None, alias="firstTimestamp")
    last_timestamp: Optional[datetime] = Field(default=None, alias="lastTimestamp")
    count: int = 1

    class Config:
        populate_by_name = True


class ApplicationEventsResponse(BaseModel):
    """Response for application events."""
    events: List[ApplicationEvent] = Field(default_factory=list)


class ArgoCDConfig(BaseModel):
    """ArgoCD server configuration."""
    server_url: str = Field(alias="serverUrl")
    token: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    insecure: bool = False

    class Config:
        populate_by_name = True


class ArgoCDStatus(BaseModel):
    """ArgoCD connection status."""
    connected: bool
    server_url: Optional[str] = Field(default=None, alias="serverUrl")
    version: Optional[str] = None
    message: Optional[str] = None

    class Config:
        populate_by_name = True


class ProjectSummary(BaseModel):
    """ArgoCD project summary."""
    name: str
    description: Optional[str] = None
    source_repos: List[str] = Field(default_factory=list, alias="sourceRepos")
    destinations: List[Dict[str, str]] = Field(default_factory=list)

    class Config:
        populate_by_name = True


class ProjectListResponse(BaseModel):
    """Response for listing projects."""
    projects: List[ProjectSummary] = Field(default_factory=list)
