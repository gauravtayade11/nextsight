from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExecutionMode(str, Enum):
    """Pipeline execution mode."""
    LOCAL = "local"
    KUBERNETES = "kubernetes"
    AGENT = "agent"


class PipelineStatus(str, Enum):
    """Pipeline execution status."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class StageStatus(str, Enum):
    """Individual stage status."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class PipelineStage(BaseModel):
    """Pipeline execution stage."""
    id: str
    name: str
    status: StageStatus
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    error_message: Optional[str] = None
    logs: Optional[str] = None


class PipelineRun(BaseModel):
    """Single pipeline execution run."""
    id: str
    pipeline_id: str
    pipeline_name: str
    status: PipelineStatus
    started_at: datetime
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    triggered_by: Optional[str] = None
    branch: Optional[str] = None
    commit_sha: Optional[str] = None
    commit_message: Optional[str] = None
    stages: List[PipelineStage] = Field(default_factory=list)
    logs: Optional[str] = None
    error_message: Optional[str] = None
    artifacts: List[str] = Field(default_factory=list)
    environment: Optional[str] = None

    class Config:
        from_attributes = True


class PipelineRunCreate(BaseModel):
    """Request to trigger a pipeline run."""
    pipeline_id: Optional[str] = None  # Optional - can come from URL path
    branch: Optional[str] = None
    commit: Optional[str] = None  # Commit SHA
    trigger: Optional[str] = None  # manual, push, pull_request, etc.
    variables: Dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = False


class PipelineRunFilter(BaseModel):
    """Filter for querying pipeline runs."""
    pipeline_id: Optional[str] = None
    status: Optional[PipelineStatus] = None
    branch: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


class PipelineStageLog(BaseModel):
    """Logs for a pipeline stage."""
    stage_id: str
    stage_name: str
    pipeline_run_id: str
    logs: str
    status: StageStatus
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class Pipeline(BaseModel):
    """Pipeline definition."""
    id: str
    name: str
    description: Optional[str] = None
    branch: str = "main"

    # Frontend-expected fields (using camelCase to match frontend)
    status: PipelineStatus = PipelineStatus.PENDING  # Current pipeline status
    lastRun: Optional[str] = None  # Last run timestamp as string
    duration: Optional[str] = None  # Duration string (e.g., "5m 30s")
    trigger: Optional[str] = "manual"  # Trigger type
    successRate: float = 0.0  # Success rate percentage
    yaml: Optional[str] = None  # YAML configuration
    createdAt: str = Field(default_factory=lambda: datetime.now().isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now().isoformat())

    # Backend fields (kept for compatibility)
    repository: Optional[str] = None
    file_path: Optional[str] = None  # Path to pipeline config
    provider: Optional[str] = "manual"  # github, gitlab, jenkins, circleci, etc.
    is_active: bool = True
    last_run_obj: Optional[PipelineRun] = Field(None, alias="last_run")  # Full run object
    last_run_status: Optional[PipelineStatus] = None
    last_run_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    tags: List[str] = Field(default_factory=list)

    # Execution mode configuration
    execution_mode: ExecutionMode = ExecutionMode.LOCAL
    kubernetes_namespace: Optional[str] = None
    preferred_agent_id: Optional[str] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class PipelineCreate(BaseModel):
    """Request to create a pipeline."""
    name: str
    description: Optional[str] = None
    repository: Optional[str] = None
    branch: str = "main"
    file_path: Optional[str] = None
    provider: str = "manual"
    is_active: bool = True
    tags: List[str] = Field(default_factory=list)
    yaml: Optional[str] = None
    # Execution mode configuration
    execution_mode: ExecutionMode = ExecutionMode.LOCAL
    kubernetes_namespace: Optional[str] = None
    preferred_agent_id: Optional[str] = None


class PipelineUpdate(BaseModel):
    """Request to update a pipeline."""
    name: Optional[str] = None
    description: Optional[str] = None
    branch: Optional[str] = None
    is_active: Optional[bool] = None
    tags: Optional[List[str]] = None
    yaml: Optional[str] = None
    repository: Optional[str] = None
    trigger: Optional[str] = None
    status: Optional[str] = None
    duration: Optional[str] = None
    successRate: Optional[float] = None
    # Execution mode configuration
    execution_mode: Optional[ExecutionMode] = None
    kubernetes_namespace: Optional[str] = None
    preferred_agent_id: Optional[str] = None


class PipelineStatistics(BaseModel):
    """Pipeline execution statistics."""
    total_runs: int
    successful_runs: int
    failed_runs: int
    skipped_runs: int
    average_duration_seconds: float
    success_rate: float
    last_30_days_stats: Dict[str, Any] = Field(default_factory=dict)


class PipelineRunStatus(BaseModel):
    """Real-time pipeline run status."""
    pipeline_run_id: str
    status: PipelineStatus
    current_stage: Optional[str] = None
    progress_percentage: int
    estimated_remaining_seconds: Optional[int] = None
    logs_url: Optional[str] = None
