"""Agent schemas for API requests/responses."""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    """Agent status enum."""
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"
    MAINTENANCE = "maintenance"


class ExecutionMode(str, Enum):
    """Pipeline execution mode."""
    LOCAL = "local"
    KUBERNETES = "kubernetes"
    AGENT = "agent"


# ============ Agent Schemas ============

class AgentBase(BaseModel):
    """Base agent schema."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(default=8080, ge=1, le=65535)
    labels: List[str] = Field(default_factory=list)
    max_concurrent_jobs: int = Field(default=2, ge=1, le=100)
    workspace_path: str = Field(default="/tmp/nextsight-agent")  # nosec B108 - Default value, user-configurable
    pool: str = Field(default="default", max_length=100)


class AgentCreate(AgentBase):
    """Schema for creating an agent."""
    api_key: Optional[str] = None
    ssh_user: Optional[str] = None
    ssh_key_id: Optional[str] = None


class AgentUpdate(BaseModel):
    """Schema for updating an agent."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    host: Optional[str] = Field(None, min_length=1, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    api_key: Optional[str] = None
    ssh_user: Optional[str] = None
    ssh_key_id: Optional[str] = None
    labels: Optional[List[str]] = None
    max_concurrent_jobs: Optional[int] = Field(None, ge=1, le=100)
    workspace_path: Optional[str] = None
    pool: Optional[str] = None
    status: Optional[AgentStatus] = None


class AgentResponse(BaseModel):
    """Agent response schema."""
    id: str
    name: str
    description: Optional[str]
    host: str
    port: int
    status: AgentStatus
    lastHeartbeat: Optional[datetime]
    version: Optional[str]
    labels: List[str]
    maxConcurrentJobs: int
    currentJobs: int
    osType: Optional[str]
    osVersion: Optional[str]
    cpuCores: Optional[int]
    memoryGb: Optional[float]
    diskGb: Optional[float]
    workspacePath: str
    dockerAvailable: bool
    kubernetesAvailable: bool
    pool: str
    totalJobs: int
    successfulJobs: int
    failedJobs: int
    avgJobDurationSeconds: int
    createdAt: Optional[datetime]
    updatedAt: Optional[datetime]

    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    """Response for listing agents."""
    agents: List[AgentResponse]
    total: int
    page: int
    pageSize: int
    totalPages: int


# ============ Agent Heartbeat ============

class AgentHeartbeat(BaseModel):
    """Agent heartbeat payload."""
    version: str
    status: AgentStatus = AgentStatus.ONLINE
    current_jobs: int = 0
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    cpu_cores: Optional[int] = None
    memory_gb: Optional[float] = None
    disk_gb: Optional[float] = None
    docker_available: bool = False
    kubernetes_available: bool = False


class AgentHeartbeatResponse(BaseModel):
    """Response to agent heartbeat."""
    acknowledged: bool
    server_time: datetime
    pending_jobs: List[str] = Field(default_factory=list)


# ============ Agent Job Schemas ============

class AgentJobRequest(BaseModel):
    """Job request sent to agent."""
    run_id: str
    pipeline_id: str
    pipeline_name: str
    repository: Optional[str] = None
    branch: str = "main"
    commit_sha: Optional[str] = None
    yaml_config: str
    variables: dict = Field(default_factory=dict)
    secrets: dict = Field(default_factory=dict)
    workspace_path: Optional[str] = None


class AgentJobUpdate(BaseModel):
    """Job status update from agent."""
    run_id: str
    status: str  # pending, running, success, failed
    stage_name: Optional[str] = None
    stage_status: Optional[str] = None
    log_message: Optional[str] = None
    log_level: str = "info"
    error_message: Optional[str] = None
    artifacts: List[str] = Field(default_factory=list)
    duration_seconds: Optional[int] = None


class AgentJobResponse(BaseModel):
    """Response after job assignment."""
    accepted: bool
    run_id: str
    message: str
    workspace: Optional[str] = None


# ============ Agent Registration ============

class AgentRegistration(BaseModel):
    """Agent self-registration payload."""
    name: str
    host: str
    port: int = 8080
    version: str
    labels: List[str] = Field(default_factory=list)
    max_concurrent_jobs: int = 2
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    cpu_cores: Optional[int] = None
    memory_gb: Optional[float] = None
    disk_gb: Optional[float] = None
    docker_available: bool = False
    kubernetes_available: bool = False
    workspace_path: str = "/tmp/nextsight-agent"  # nosec B108 - Default value, user-configurable


class AgentRegistrationResponse(BaseModel):
    """Response to agent registration."""
    agent_id: str
    api_key: str
    registered_at: datetime
    heartbeat_interval_seconds: int = 30


# ============ Agent Pool Schemas ============

class AgentPoolSummary(BaseModel):
    """Summary of an agent pool."""
    pool: str
    total_agents: int
    online_agents: int
    busy_agents: int
    offline_agents: int
    total_capacity: int
    available_capacity: int


class AgentPoolListResponse(BaseModel):
    """Response for listing agent pools."""
    pools: List[AgentPoolSummary]


# ============ Execution Mode Schemas ============

class ExecutionModeConfig(BaseModel):
    """Configuration for execution mode."""
    mode: ExecutionMode = ExecutionMode.LOCAL
    agent_id: Optional[str] = None  # For agent mode
    agent_pool: Optional[str] = None  # Select from pool
    agent_labels: Optional[List[str]] = None  # Required labels
    kubernetes_namespace: Optional[str] = None  # For K8s mode
    kubernetes_service_account: Optional[str] = None


class PipelineExecutionConfig(BaseModel):
    """Pipeline execution configuration update."""
    execution_mode: ExecutionMode
    preferred_agent_id: Optional[str] = None
    kubernetes_namespace: Optional[str] = None
