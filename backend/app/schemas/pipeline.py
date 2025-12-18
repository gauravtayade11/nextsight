"""Pipeline schemas for CI/CD pipeline management."""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any

from pydantic import BaseModel, Field


class PipelineStatus(str, Enum):
    """Pipeline run status."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class StageStatus(str, Enum):
    """Stage execution status."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class TriggerType(str, Enum):
    """Pipeline trigger types."""
    PUSH = "push"
    PULL_REQUEST = "pull_request"
    TAG = "tag"
    SCHEDULE = "schedule"
    MANUAL = "manual"
    WEBHOOK = "webhook"


class RunnerType(str, Enum):
    """Pipeline runner types."""
    DOCKER = "docker"
    KUBERNETES = "kubernetes"
    BARE_METAL = "bare_metal"
    GITHUB_ACTIONS = "github_actions"
    GITLAB_CI = "gitlab_ci"


# Pipeline Stage Models
class PipelineStep(BaseModel):
    """A single step in a pipeline stage."""
    name: str
    command: str
    working_dir: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)
    timeout: Optional[int] = None  # seconds
    retry: int = 0
    condition: Optional[str] = None  # e.g., "branch == 'main'"


class PipelineStage(BaseModel):
    """A stage in a pipeline."""
    name: str
    steps: List[PipelineStep] = Field(default_factory=list)
    parallel: bool = False
    depends_on: List[str] = Field(default_factory=list)
    condition: Optional[str] = None
    timeout: Optional[int] = None
    runner: Optional[RunnerType] = None


class PipelineTrigger(BaseModel):
    """Pipeline trigger configuration."""
    type: TriggerType
    branches: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    paths: List[str] = Field(default_factory=list)
    schedule: Optional[str] = None  # CRON expression
    events: List[str] = Field(default_factory=list)  # GitHub webhook events


# Pipeline Models
class PipelineBase(BaseModel):
    """Base pipeline model."""
    name: str
    description: Optional[str] = None
    repository: Optional[str] = None
    branch: str = "main"
    triggers: List[PipelineTrigger] = Field(default_factory=list)
    stages: List[PipelineStage] = Field(default_factory=list)
    variables: Dict[str, str] = Field(default_factory=dict)
    secrets: List[str] = Field(default_factory=list)  # Secret names
    enabled: bool = True


class PipelineCreate(PipelineBase):
    """Create pipeline request."""
    stages: List[PipelineStage] = []


class PipelineUpdate(BaseModel):
    """Update pipeline request."""
    name: Optional[str] = None
    description: Optional[str] = None
    repository: Optional[str] = None
    branch: Optional[str] = None
    triggers: Optional[List[PipelineTrigger]] = None
    stages: Optional[List[PipelineStage]] = None
    variables: Optional[Dict[str, str]] = None
    secrets: Optional[List[str]] = None
    enabled: Optional[bool] = None


class PipelineResponse(PipelineBase):
    """Pipeline response model."""
    id: str
    created_at: datetime
    updated_at: datetime
    last_run_id: Optional[str] = None
    last_run_status: Optional[PipelineStatus] = None
    last_run_at: Optional[datetime] = None
    total_runs: int = 0
    success_runs: int = 0
    failed_runs: int = 0
    avg_duration: Optional[float] = None  # seconds

    class Config:
        from_attributes = True


# Pipeline Run Models
class StageExecution(BaseModel):
    """Stage execution details."""
    stage_name: str
    status: StageStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration: Optional[float] = None  # seconds
    steps: List[Dict[str, Any]] = Field(default_factory=list)  # Step execution details


class PipelineRunBase(BaseModel):
    """Base pipeline run model."""
    pipeline_id: str
    commit: str
    commit_message: Optional[str] = None
    branch: str
    triggered_by: str
    trigger_type: TriggerType
    ref: Optional[str] = None  # Git ref (tag, branch, etc.)


class PipelineRunCreate(PipelineRunBase):
    """Create pipeline run request."""
    pass


class PipelineRunResponse(PipelineRunBase):
    """Pipeline run response model."""
    id: str
    status: PipelineStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration: Optional[float] = None  # seconds
    stages: List[StageExecution] = Field(default_factory=list)
    artifacts: List[Dict[str, Any]] = Field(default_factory=list)
    logs_url: Optional[str] = None

    class Config:
        from_attributes = True


# Statistics Models
class PipelineStatistics(BaseModel):
    """Pipeline statistics."""
    total_pipelines: int
    active_pipelines: int
    total_runs: int
    running_runs: int
    success_rate: float
    avg_duration: float
    failed_runs_24h: int
    success_runs_24h: int


class PipelineTrend(BaseModel):
    """Pipeline trend data."""
    date: datetime
    success_count: int
    failed_count: int
    avg_duration: float


# Log Models
class PipelineLog(BaseModel):
    """Pipeline log entry."""
    stage: str
    step: Optional[str] = None
    timestamp: datetime
    level: str  # info, warning, error
    message: str


class PipelineLogResponse(BaseModel):
    """Pipeline logs response."""
    run_id: str
    logs: List[PipelineLog]
    total_lines: int
    has_more: bool = False


# Artifact Models
class Artifact(BaseModel):
    """Pipeline artifact."""
    name: str
    type: str  # build, test-report, docker-image, helm-chart, etc.
    size: Optional[int] = None  # bytes
    url: Optional[str] = None
    created_at: datetime


# Agent/Runner Models
class PipelineAgent(BaseModel):
    """Pipeline execution agent/runner."""
    id: str
    name: str
    type: RunnerType
    status: str  # online, offline, busy
    cpu: Optional[str] = None
    memory: Optional[str] = None
    platform: Optional[str] = None
    version: Optional[str] = None
    last_seen: Optional[datetime] = None
    current_jobs: int = 0
    max_jobs: int = 1


# Template Models
class PipelineTemplate(BaseModel):
    """Pipeline template."""
    id: str
    name: str
    description: str
    category: str  # nodejs, python, docker, kubernetes, etc.
    stages: List[PipelineStage]
    variables: Dict[str, str] = Field(default_factory=dict)
    icon: Optional[str] = None
    usage_count: int = 0


# AI Assistant Models
class PipelineAIGenerateRequest(BaseModel):
    """AI pipeline generation request."""
    description: str
    repository_type: Optional[str] = None  # nodejs, python, go, etc.
    deployment_target: Optional[str] = None  # kubernetes, docker, etc.
    include_tests: bool = True
    include_security: bool = True


class PipelineAIOptimizeRequest(BaseModel):
    """AI pipeline optimization request."""
    pipeline_id: str
    optimization_goal: str  # speed, cost, reliability
    target_improvement: Optional[float] = None  # percentage


class PipelineAIFixRequest(BaseModel):
    """AI pipeline fix request."""
    run_id: str
    error_message: Optional[str] = None


# List Responses
class PipelineListResponse(BaseModel):
    """Pipeline list response."""
    pipelines: List[PipelineResponse]
    total: int
    page: int = 1
    page_size: int = 50


class PipelineRunListResponse(BaseModel):
    """Pipeline run list response."""
    runs: List[PipelineRunResponse]
    total: int
    page: int = 1
    page_size: int = 50


class Step(BaseModel):
    name: str
    image: Optional[str] = None
    commands: List[str] = []


class Stage(BaseModel):
    name: str
    steps: List[Step] = []


class Pipeline(PipelineBase):
    id: str
    stages: List[Stage] = []
    created_at: datetime
    updated_at: datetime


class PipelineRun(BaseModel):
    id: str
    pipeline_id: str
    status: str = Field(default="pending")  # pending, running, success, failed
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    logs_url: Optional[str] = None
    metadata: Dict[str, Any] = {}

