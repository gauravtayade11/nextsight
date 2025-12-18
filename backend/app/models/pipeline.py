"""Pipeline database models."""
import enum
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base, TimestampMixin, generate_uuid


class PipelineStatus(str, enum.Enum):
    """Pipeline execution status."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StageStatus(str, enum.Enum):
    """Individual stage status."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class TriggerType(str, enum.Enum):
    """Pipeline trigger types."""
    MANUAL = "manual"
    PUSH = "push"
    PULL_REQUEST = "pull_request"
    TAG = "tag"
    SCHEDULE = "schedule"
    WEBHOOK = "webhook"


class Provider(str, enum.Enum):
    """Git provider types."""
    GITHUB = "github"
    GITLAB = "gitlab"
    BITBUCKET = "bitbucket"
    MANUAL = "manual"


class ExecutionMode(str, enum.Enum):
    """Pipeline execution mode."""
    LOCAL = "local"  # Run on API server (default)
    KUBERNETES = "kubernetes"  # Run as Kubernetes Job
    AGENT = "agent"  # Run on remote VM agent


class AgentStatus(str, enum.Enum):
    """Agent status."""
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"
    MAINTENANCE = "maintenance"


class Pipeline(Base, TimestampMixin):
    """Pipeline definition model."""
    __tablename__ = "pipelines"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Repository configuration
    repository = Column(String(500), nullable=True)
    branch = Column(String(100), default="main")
    provider = Column(Enum(Provider), default=Provider.MANUAL)
    file_path = Column(String(500), nullable=True)  # Path to pipeline config file

    # Pipeline configuration
    yaml_config = Column(Text, nullable=True)  # YAML configuration
    is_active = Column(Boolean, default=True)
    tags = Column(JSON, default=list)

    # Execution configuration
    execution_mode = Column(
        Enum(ExecutionMode, values_callable=lambda x: [e.value for e in x]),
        default=ExecutionMode.LOCAL
    )
    preferred_agent_id = Column(String(36), nullable=True)  # Preferred agent for execution
    kubernetes_namespace = Column(String(100), nullable=True)  # For K8s execution

    # Statistics (cached for performance)
    total_runs = Column(Integer, default=0)
    successful_runs = Column(Integer, default=0)
    failed_runs = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)
    avg_duration_seconds = Column(Integer, default=0)

    # Last run info (cached)
    last_run_id = Column(String(36), nullable=True)
    last_run_status = Column(Enum(PipelineStatus), nullable=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    last_run_duration = Column(String(50), nullable=True)

    # Relationships
    runs = relationship("PipelineRun", back_populates="pipeline", cascade="all, delete-orphan")
    variables = relationship("PipelineVariable", back_populates="pipeline", cascade="all, delete-orphan")
    secrets = relationship("PipelineSecret", back_populates="pipeline", cascade="all, delete-orphan")
    triggers = relationship("PipelineTrigger", back_populates="pipeline", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index("ix_pipelines_name_provider", "name", "provider"),
        Index("ix_pipelines_is_active", "is_active"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        execution_mode_value = self.execution_mode.value if self.execution_mode else "local"
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "repository": self.repository,
            "branch": self.branch,
            "provider": self.provider.value if self.provider else "manual",
            "file_path": self.file_path,
            "yaml": self.yaml_config,
            "is_active": self.is_active,
            "tags": self.tags or [],
            # Execution mode - both camelCase (frontend) and snake_case (Pydantic schema)
            "executionMode": execution_mode_value,
            "execution_mode": execution_mode_value,
            "preferredAgentId": self.preferred_agent_id,
            "preferred_agent_id": self.preferred_agent_id,
            "kubernetesNamespace": self.kubernetes_namespace,
            "kubernetes_namespace": self.kubernetes_namespace,
            "status": self.last_run_status.value if self.last_run_status else "pending",
            "lastRun": self.last_run_at.isoformat() if self.last_run_at else "Never",
            "duration": self.last_run_duration or "-",
            "trigger": "manual",
            "successRate": round(self.success_rate, 1),
            "totalRuns": self.total_runs,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class PipelineRun(Base):
    """Pipeline execution run model."""
    __tablename__ = "pipeline_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    pipeline_id = Column(String(36), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)

    # Run information
    status = Column(Enum(PipelineStatus), default=PipelineStatus.PENDING)
    branch = Column(String(100), default="main")
    commit_sha = Column(String(40), nullable=True)
    commit_message = Column(Text, nullable=True)

    # Trigger info
    trigger_type = Column(Enum(TriggerType), default=TriggerType.MANUAL)
    triggered_by = Column(String(100), nullable=True)

    # Timing
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Error information
    error_message = Column(Text, nullable=True)

    # Artifacts
    artifacts = Column(JSON, default=list)

    # Environment
    environment = Column(String(50), nullable=True)
    variables = Column(JSON, default=dict)

    # Execution configuration
    execution_mode = Column(
        Enum(ExecutionMode, values_callable=lambda x: [e.value for e in x]),
        default=ExecutionMode.LOCAL
    )
    agent_id = Column(String(36), nullable=True)  # Agent used for execution

    # Relationships
    pipeline = relationship("Pipeline", back_populates="runs")
    stages = relationship("PipelineStage", back_populates="run", cascade="all, delete-orphan", order_by="PipelineStage.order")
    logs = relationship("PipelineLog", back_populates="run", cascade="all, delete-orphan")
    test_results = relationship("PipelineTestResult", back_populates="run", cascade="all, delete-orphan")
    coverage_data = relationship("PipelineCoverage", back_populates="run", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index("ix_pipeline_runs_pipeline_id", "pipeline_id"),
        Index("ix_pipeline_runs_status", "status"),
        Index("ix_pipeline_runs_started_at", "started_at"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        # Get test results summary (handle lazy loading errors)
        test_summary = None
        try:
            if self.test_results:
                latest_test = self.test_results[0] if self.test_results else None
                if latest_test:
                    test_summary = {
                        "totalTests": latest_test.total_tests,
                        "passedTests": latest_test.passed_tests,
                        "failedTests": latest_test.failed_tests,
                        "skippedTests": latest_test.skipped_tests,
                        "passRate": round(latest_test.pass_rate, 1) if latest_test.pass_rate else 0,
                        "framework": latest_test.framework,
                    }
        except Exception:
            pass  # Catch MissingGreenlet, DetachedInstanceError, etc.

        # Get coverage summary (handle lazy loading errors)
        coverage_summary = None
        try:
            if self.coverage_data:
                latest_coverage = self.coverage_data[0] if self.coverage_data else None
                if latest_coverage:
                    coverage_summary = {
                        "lineCoverage": round(latest_coverage.line_coverage, 1) if latest_coverage.line_coverage else None,
                        "branchCoverage": round(latest_coverage.branch_coverage, 1) if latest_coverage.branch_coverage else None,
                        "coverageChange": round(latest_coverage.coverage_change, 1) if latest_coverage.coverage_change else None,
                        "coverageTool": latest_coverage.coverage_tool,
                    }
        except Exception:
            pass  # Catch MissingGreenlet, DetachedInstanceError, etc.

        # Get pipeline name (handle lazy loading errors)
        pipeline_name = None
        try:
            if self.pipeline:
                pipeline_name = self.pipeline.name
        except Exception:
            pass  # Catch MissingGreenlet, DetachedInstanceError, etc.

        # Get stages (handle lazy loading errors)
        stages_list = []
        try:
            if self.stages:
                stages_list = [s.to_dict() for s in self.stages]
        except Exception:
            pass

        return {
            "id": self.id,
            # Include both camelCase (frontend) and snake_case (Pydantic schema) versions
            "pipelineId": self.pipeline_id,
            "pipeline_id": self.pipeline_id,
            "pipelineName": pipeline_name,
            "pipeline_name": pipeline_name,
            "status": self.status.value if self.status else "pending",
            "branch": self.branch,
            "commit": self.commit_sha,
            "commit_sha": self.commit_sha,
            "commitMessage": self.commit_message,
            "commit_message": self.commit_message,
            "trigger": self.trigger_type.value if self.trigger_type else "manual",
            "triggeredBy": self.triggered_by,
            "triggered_by": self.triggered_by,
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "started_at": self.started_at,  # Pydantic handles datetime serialization
            "completedAt": self.finished_at.isoformat() if self.finished_at else None,
            "finished_at": self.finished_at,
            "duration": self._format_duration(),
            "duration_seconds": self.duration_seconds,
            "stages": stages_list,
            "logs": None,
            "artifacts": self.artifacts or [],
            "environment": self.environment,
            "errorMessage": self.error_message,
            "error_message": self.error_message,
            "executionMode": self.execution_mode.value if self.execution_mode else "local",
            "agentId": self.agent_id,
            # Test and coverage summaries
            "testSummary": test_summary,
            "coverageSummary": coverage_summary,
        }

    def _format_duration(self):
        """Format duration as human-readable string."""
        if not self.duration_seconds:
            if self.started_at and not self.finished_at:
                # Still running
                delta = datetime.utcnow() - self.started_at.replace(tzinfo=None)
                seconds = int(delta.total_seconds())
            else:
                return "-"
        else:
            seconds = self.duration_seconds

        if seconds < 60:
            return f"{seconds}s"
        minutes = seconds // 60
        secs = seconds % 60
        if minutes < 60:
            return f"{minutes}m {secs}s"
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours}h {mins}m"


class PipelineStage(Base):
    """Pipeline stage model."""
    __tablename__ = "pipeline_stages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(100), nullable=False)
    order = Column(Integer, default=0)
    status = Column(Enum(StageStatus), default=StageStatus.PENDING)

    # Approval configuration (nullable for backward compatibility)
    requires_approval = Column(Boolean, default=False, nullable=True)
    approval_type = Column(String(50), nullable=True)  # 'manual', 'auto', 'scheduled'
    required_approvers = Column(Integer, default=1, nullable=True)  # Number of approvals needed
    approver_roles = Column(JSON, default=list, nullable=True)  # Roles that can approve (e.g., ['admin', 'lead'])

    # Timing
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # Error information
    error_message = Column(Text, nullable=True)

    # Relationships
    run = relationship("PipelineRun", back_populates="stages")
    approvals = relationship("PipelineApproval", back_populates="stage", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_pipeline_stages_run_id", "run_id"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        approval_status = None
        requires_approval = getattr(self, 'requires_approval', False)
        if requires_approval:
            approvals = list(self.approvals) if hasattr(self, 'approvals') and self.approvals else []
            approved_count = sum(1 for a in approvals if a.status == "approved")
            required_approvers = getattr(self, 'required_approvers', 1) or 1
            if approved_count >= required_approvers:
                approval_status = "approved"
            elif any(a.status == "rejected" for a in approvals):
                approval_status = "rejected"
            else:
                approval_status = "pending"

        return {
            "id": self.id,
            "name": self.name,
            "status": self.status.value if self.status else "pending",
            "requiresApproval": self.requires_approval,
            "approvalStatus": approval_status,
            "requiredApprovers": self.required_approvers,
            "approverRoles": self.approver_roles or [],
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "completedAt": self.finished_at.isoformat() if self.finished_at else None,
            "duration": f"{self.duration_seconds}s" if self.duration_seconds else None,
            "errorMessage": self.error_message,
        }


class PipelineLog(Base):
    """Pipeline log entry model."""
    __tablename__ = "pipeline_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(String(36), nullable=True)

    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    level = Column(String(20), default="info")  # info, warn, error, debug
    message = Column(Text, nullable=False)

    # Relationships
    run = relationship("PipelineRun", back_populates="logs")

    __table_args__ = (
        Index("ix_pipeline_logs_run_id", "run_id"),
        Index("ix_pipeline_logs_timestamp", "timestamp"),
    )


class PipelineVariable(Base, TimestampMixin):
    """Pipeline variable model."""
    __tablename__ = "pipeline_variables"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    pipeline_id = Column(String(36), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(100), nullable=False)
    value = Column(Text, nullable=False)
    scope = Column(String(20), default="pipeline")  # global, pipeline, stage
    environment = Column(String(50), nullable=True)  # dev, staging, production
    is_secret = Column(Boolean, default=False)

    # Relationships
    pipeline = relationship("Pipeline", back_populates="variables")

    __table_args__ = (
        Index("ix_pipeline_variables_pipeline_id", "pipeline_id"),
        Index("ix_pipeline_variables_name", "name"),
    )


class PipelineSecret(Base, TimestampMixin):
    """Pipeline secret model (encrypted values)."""
    __tablename__ = "pipeline_secrets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    pipeline_id = Column(String(36), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(100), nullable=False)
    encrypted_value = Column(Text, nullable=False)  # Encrypted value
    scope = Column(String(20), default="pipeline")

    # Relationships
    pipeline = relationship("Pipeline", back_populates="secrets")

    __table_args__ = (
        Index("ix_pipeline_secrets_pipeline_id", "pipeline_id"),
    )


class PipelineTrigger(Base, TimestampMixin):
    """Pipeline trigger configuration model."""
    __tablename__ = "pipeline_triggers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    pipeline_id = Column(String(36), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)

    trigger_type = Column(Enum(TriggerType), nullable=False)
    is_enabled = Column(Boolean, default=True)

    # Configuration (varies by trigger type)
    branches = Column(JSON, default=list)  # For push/PR triggers
    tags = Column(JSON, default=list)  # For tag triggers
    paths = Column(JSON, default=list)  # Path filters
    cron_expression = Column(String(100), nullable=True)  # For schedule triggers

    # Webhook configuration
    webhook_secret = Column(String(100), nullable=True)

    # Relationships
    pipeline = relationship("Pipeline", back_populates="triggers")

    __table_args__ = (
        Index("ix_pipeline_triggers_pipeline_id", "pipeline_id"),
    )


class PipelineTemplate(Base, TimestampMixin):
    """Pre-built pipeline template model."""
    __tablename__ = "pipeline_templates"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)  # nodejs, python, docker, kubernetes, etc.
    icon = Column(String(50), nullable=True)  # Icon name/path

    yaml_template = Column(Text, nullable=False)
    default_stages = Column(JSON, default=list)

    # Popularity tracking
    usage_count = Column(Integer, default=0)
    is_featured = Column(Boolean, default=False)

    __table_args__ = (
        Index("ix_pipeline_templates_category", "category"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "icon": self.icon,
            "yaml": self.yaml_template,
            "stages": self.default_stages or [],
            "usageCount": self.usage_count,
            "isFeatured": self.is_featured,
        }


class PipelineAgent(Base, TimestampMixin):
    """Pipeline execution agent (VM/remote runner)."""
    __tablename__ = "pipeline_agents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    # Connection info
    host = Column(String(255), nullable=False)  # IP or hostname
    port = Column(Integer, default=8080)  # Agent API port
    api_key = Column(String(255), nullable=True)  # API key for authentication
    ssh_user = Column(String(100), nullable=True)  # SSH username for direct connection
    ssh_key_id = Column(String(36), nullable=True)  # Reference to stored SSH key

    # Agent status
    status = Column(
        Enum(AgentStatus, values_callable=lambda x: [e.value for e in x]),
        default=AgentStatus.OFFLINE
    )
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)
    version = Column(String(50), nullable=True)  # Agent software version

    # Capabilities
    labels = Column(JSON, default=list)  # Labels for agent selection (e.g., ["linux", "docker", "gpu"])
    max_concurrent_jobs = Column(Integer, default=2)
    current_jobs = Column(Integer, default=0)

    # System info (populated by agent heartbeat)
    os_type = Column(String(50), nullable=True)  # linux, windows, darwin
    os_version = Column(String(100), nullable=True)
    cpu_cores = Column(Integer, nullable=True)
    memory_gb = Column(Float, nullable=True)
    disk_gb = Column(Float, nullable=True)

    # Workspace configuration
    workspace_path = Column(String(500), default="/tmp/nextsight-agent")
    docker_available = Column(Boolean, default=False)
    kubernetes_available = Column(Boolean, default=False)

    # Pool assignment
    pool = Column(String(100), default="default")  # Agent pool for grouping

    # Statistics
    total_jobs = Column(Integer, default=0)
    successful_jobs = Column(Integer, default=0)
    failed_jobs = Column(Integer, default=0)
    avg_job_duration_seconds = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_pipeline_agents_status", "status"),
        Index("ix_pipeline_agents_pool", "pool"),
        Index("ix_pipeline_agents_name", "name"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "host": self.host,
            "port": self.port,
            "status": self.status.value if self.status else "offline",
            "lastHeartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "version": self.version,
            "labels": self.labels or [],
            "maxConcurrentJobs": self.max_concurrent_jobs,
            "currentJobs": self.current_jobs,
            "osType": self.os_type,
            "osVersion": self.os_version,
            "cpuCores": self.cpu_cores,
            "memoryGb": self.memory_gb,
            "diskGb": self.disk_gb,
            "workspacePath": self.workspace_path,
            "dockerAvailable": self.docker_available,
            "kubernetesAvailable": self.kubernetes_available,
            "pool": self.pool,
            "totalJobs": self.total_jobs,
            "successfulJobs": self.successful_jobs,
            "failedJobs": self.failed_jobs,
            "avgJobDurationSeconds": self.avg_job_duration_seconds,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

    @property
    def is_available(self) -> bool:
        """Check if agent is available for new jobs."""
        return (
            self.status == AgentStatus.ONLINE
            and self.current_jobs < self.max_concurrent_jobs
        )


class AgentJobAssignment(Base, TimestampMixin):
    """Track which agent is running which pipeline run."""
    __tablename__ = "agent_job_assignments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    agent_id = Column(String(36), ForeignKey("pipeline_agents.id", ondelete="SET NULL"), nullable=True)
    run_id = Column(String(36), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Assignment info
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Remote execution details
    remote_workspace = Column(String(500), nullable=True)
    remote_log_path = Column(String(500), nullable=True)

    __table_args__ = (
        Index("ix_agent_job_assignments_agent_id", "agent_id"),
        Index("ix_agent_job_assignments_run_id", "run_id"),
    )


class TestFramework(str, enum.Enum):
    """Supported test frameworks."""
    PYTEST = "pytest"
    JEST = "jest"
    VITEST = "vitest"
    MOCHA = "mocha"
    JUNIT = "junit"
    RSPEC = "rspec"
    GO_TEST = "go_test"
    OTHER = "other"


class PipelineTestResult(Base, TimestampMixin):
    """Test results for a pipeline run."""
    __tablename__ = "pipeline_test_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(String(36), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True)

    # Test framework and configuration
    framework = Column(String(50), default="other")
    test_file_pattern = Column(String(255), nullable=True)

    # Summary metrics
    total_tests = Column(Integer, default=0)
    passed_tests = Column(Integer, default=0)
    failed_tests = Column(Integer, default=0)
    skipped_tests = Column(Integer, default=0)
    error_tests = Column(Integer, default=0)

    # Timing
    duration_seconds = Column(Float, nullable=True)

    # Calculated metrics
    pass_rate = Column(Float, default=0.0)  # Percentage

    # Detailed test results (JSON array of test cases)
    # Format: [{name, suite, status, duration, error_message, stack_trace}]
    test_details = Column(JSON, default=list)

    # Failed test summary for quick display
    failed_test_names = Column(JSON, default=list)

    # Report artifacts
    report_url = Column(String(500), nullable=True)  # Link to full HTML report
    junit_xml_url = Column(String(500), nullable=True)  # Link to JUnit XML

    # Relationships
    run = relationship("PipelineRun", back_populates="test_results")

    __table_args__ = (
        Index("ix_pipeline_test_results_run_id", "run_id"),
        Index("ix_pipeline_test_results_stage_id", "stage_id"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "runId": self.run_id,
            "stageId": self.stage_id,
            "framework": self.framework,
            "totalTests": self.total_tests,
            "passedTests": self.passed_tests,
            "failedTests": self.failed_tests,
            "skippedTests": self.skipped_tests,
            "errorTests": self.error_tests,
            "durationSeconds": self.duration_seconds,
            "passRate": round(self.pass_rate, 1) if self.pass_rate else 0,
            "testDetails": self.test_details or [],
            "failedTestNames": self.failed_test_names or [],
            "reportUrl": self.report_url,
            "junitXmlUrl": self.junit_xml_url,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class PipelineCoverage(Base, TimestampMixin):
    """Code coverage data for a pipeline run."""
    __tablename__ = "pipeline_coverage"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    run_id = Column(String(36), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False)
    stage_id = Column(String(36), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True)

    # Coverage tool info
    coverage_tool = Column(String(50), default="unknown")  # coverage.py, istanbul, lcov, jacoco

    # Overall coverage metrics (percentages)
    line_coverage = Column(Float, nullable=True)
    branch_coverage = Column(Float, nullable=True)
    statement_coverage = Column(Float, nullable=True)
    function_coverage = Column(Float, nullable=True)

    # Line counts
    total_lines = Column(Integer, nullable=True)
    covered_lines = Column(Integer, nullable=True)
    missing_lines = Column(Integer, nullable=True)

    # Branch counts
    total_branches = Column(Integer, nullable=True)
    covered_branches = Column(Integer, nullable=True)

    # File-level coverage breakdown (JSON)
    # Format: {file_path: {coverage: %, lines_covered: int, lines_total: int, missing_lines: [...]}}
    file_coverage = Column(JSON, default=dict)

    # Files with lowest coverage (for quick display)
    lowest_coverage_files = Column(JSON, default=list)

    # Uncovered lines summary
    uncovered_lines_summary = Column(JSON, default=dict)

    # Report artifacts
    report_url = Column(String(500), nullable=True)  # Link to HTML coverage report
    lcov_url = Column(String(500), nullable=True)  # Link to LCOV file

    # Comparison with previous run
    coverage_change = Column(Float, nullable=True)  # +/- from previous run

    # Relationships
    run = relationship("PipelineRun", back_populates="coverage_data")

    __table_args__ = (
        Index("ix_pipeline_coverage_run_id", "run_id"),
        Index("ix_pipeline_coverage_stage_id", "stage_id"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "runId": self.run_id,
            "stageId": self.stage_id,
            "coverageTool": self.coverage_tool,
            "lineCoverage": round(self.line_coverage, 1) if self.line_coverage else None,
            "branchCoverage": round(self.branch_coverage, 1) if self.branch_coverage else None,
            "statementCoverage": round(self.statement_coverage, 1) if self.statement_coverage else None,
            "functionCoverage": round(self.function_coverage, 1) if self.function_coverage else None,
            "totalLines": self.total_lines,
            "coveredLines": self.covered_lines,
            "missingLines": self.missing_lines,
            "totalBranches": self.total_branches,
            "coveredBranches": self.covered_branches,
            "fileCoverage": self.file_coverage or {},
            "lowestCoverageFiles": self.lowest_coverage_files or [],
            "uncoveredLinesSummary": self.uncovered_lines_summary or {},
            "reportUrl": self.report_url,
            "lcovUrl": self.lcov_url,
            "coverageChange": round(self.coverage_change, 1) if self.coverage_change else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class CoverageTrend(Base, TimestampMixin):
    """Historical coverage trends for a pipeline."""
    __tablename__ = "coverage_trends"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    pipeline_id = Column(String(36), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    run_id = Column(String(36), ForeignKey("pipeline_runs.id", ondelete="SET NULL"), nullable=True)

    # Snapshot date
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    branch = Column(String(100), default="main")

    # Coverage metrics
    line_coverage = Column(Float, nullable=True)
    branch_coverage = Column(Float, nullable=True)

    # Test metrics
    total_tests = Column(Integer, nullable=True)
    passed_tests = Column(Integer, nullable=True)
    test_pass_rate = Column(Float, nullable=True)

    __table_args__ = (
        Index("ix_coverage_trends_pipeline_id", "pipeline_id"),
        Index("ix_coverage_trends_recorded_at", "recorded_at"),
        Index("ix_coverage_trends_branch", "branch"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "pipelineId": self.pipeline_id,
            "runId": self.run_id,
            "recordedAt": self.recorded_at.isoformat() if self.recorded_at else None,
            "branch": self.branch,
            "lineCoverage": round(self.line_coverage, 1) if self.line_coverage else None,
            "branchCoverage": round(self.branch_coverage, 1) if self.branch_coverage else None,
            "totalTests": self.total_tests,
            "passedTests": self.passed_tests,
            "testPassRate": round(self.test_pass_rate, 1) if self.test_pass_rate else None,
        }


class ApprovalStatus(str, enum.Enum):
    """Approval status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PipelineApproval(Base, TimestampMixin):
    """Pipeline stage approval model for production deployments."""
    __tablename__ = "pipeline_approvals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    stage_id = Column(String(36), ForeignKey("pipeline_stages.id", ondelete="CASCADE"), nullable=False)
    run_id = Column(String(36), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False)

    # Approval details
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    approver_username = Column(String(100), nullable=True)
    approver_email = Column(String(255), nullable=True)
    approver_role = Column(String(50), nullable=True)
    
    # Approval metadata
    comment = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Auto-expire after timeout
    
    # Environment context
    environment = Column(String(50), nullable=True)  # dev, staging, production
    deployment_target = Column(String(100), nullable=True)  # kubernetes, docker, etc.
    
    # Approval requirements
    is_production = Column(Boolean, default=False)
    requires_multi_approval = Column(Boolean, default=False)

    # Relationships
    stage = relationship("PipelineStage", back_populates="approvals")
    run = relationship("PipelineRun")

    __table_args__ = (
        Index("ix_pipeline_approvals_stage_id", "stage_id"),
        Index("ix_pipeline_approvals_run_id", "run_id"),
        Index("ix_pipeline_approvals_status", "status"),
    )

    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "stageId": self.stage_id,
            "runId": self.run_id,
            "status": self.status.value if self.status else "pending",
            "approverUsername": self.approver_username,
            "approverEmail": self.approver_email,
            "approverRole": self.approver_role,
            "comment": self.comment,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "environment": self.environment,
            "deploymentTarget": self.deployment_target,
            "isProduction": self.is_production,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
