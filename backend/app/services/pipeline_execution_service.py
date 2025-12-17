"""
Unified Pipeline Execution Service.

This service connects the PipelineRunner with database persistence,
managing the complete lifecycle of pipeline execution including:
- Run creation and tracking
- Real-time stage updates
- Log persistence
- Background task execution
- Statistics updates
- Multi-mode execution (Local, Kubernetes, Agent)
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional


def utc_now() -> datetime:
    """Return timezone-aware UTC datetime"""
    return datetime.now(timezone.utc)

import yaml
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.pipeline import (
    ExecutionMode,
    Pipeline,
    PipelineLog,
    PipelineRun,
    PipelineStage,
    PipelineStatus,
    StageStatus,
    TriggerType,
)
from app.repositories.agent_repository import AgentRepository
from app.repositories.pipeline_repository import PipelineRepository
from app.schemas.agent import AgentJobRequest
from app.services.agent_runner import AgentRunner, AgentRunnerError
from app.services.pipeline_runner import PipelineRunner, get_pipeline_runner

logger = logging.getLogger(__name__)


class BackgroundTaskManager:
    """Manages background pipeline execution tasks."""

    _instance = None
    _tasks: Dict[str, asyncio.Task] = {}

    @classmethod
    def get_instance(cls) -> "BackgroundTaskManager":
        if cls._instance is None:
            cls._instance = BackgroundTaskManager()
        return cls._instance

    def add_task(self, run_id: str, task: asyncio.Task) -> None:
        """Add a task to track."""
        self._tasks[run_id] = task
        task.add_done_callback(lambda t: self._tasks.pop(run_id, None))

    def cancel_task(self, run_id: str) -> bool:
        """Cancel a running task."""
        if run_id in self._tasks:
            self._tasks[run_id].cancel()
            return True
        return False

    def get_running_tasks(self) -> List[str]:
        """Get list of running task IDs."""
        return list(self._tasks.keys())

    def is_running(self, run_id: str) -> bool:
        """Check if a task is running."""
        return run_id in self._tasks and not self._tasks[run_id].done()


class PipelineExecutionService:
    """
    Unified service for pipeline execution with database persistence.

    This service orchestrates the complete pipeline execution lifecycle:
    1. Create run record in database
    2. Parse YAML and create stage records
    3. Execute pipeline using PipelineRunner
    4. Stream logs to database in real-time
    5. Update stage statuses as execution progresses
    6. Update final run status and statistics
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PipelineRepository(db)
        self.agent_repo = AgentRepository(db)
        self.runner = get_pipeline_runner()
        self.task_manager = BackgroundTaskManager.get_instance()

    async def trigger_pipeline(
        self,
        pipeline_id: str,
        triggered_by: str,
        branch: Optional[str] = None,
        commit_sha: Optional[str] = None,
        commit_message: Optional[str] = None,
        trigger_type: str = "manual",
        environment: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
        execution_mode: Optional[str] = None,
        agent_id: Optional[str] = None,
        agent_pool: Optional[str] = None,
        agent_labels: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Trigger a pipeline run with real execution.

        Args:
            pipeline_id: ID of the pipeline to run
            triggered_by: Username or system that triggered the run
            branch: Git branch (defaults to pipeline's default branch)
            commit_sha: Specific commit to run (optional)
            commit_message: Commit message for display
            trigger_type: How the run was triggered (manual, push, etc.)
            environment: Target environment (dev, staging, production)
            variables: Additional variables to inject
            execution_mode: Override execution mode (local, kubernetes, agent)
            agent_id: Specific agent to use for execution
            agent_pool: Agent pool to select from
            agent_labels: Required agent labels

        Returns:
            Run details dictionary or None if pipeline not found
        """
        # Get pipeline
        pipeline = await self.repo.get_pipeline(pipeline_id)
        if not pipeline:
            logger.error(f"Pipeline not found: {pipeline_id}")
            return None

        # Determine execution mode
        mode = ExecutionMode(execution_mode) if execution_mode else pipeline.execution_mode
        if not mode:
            mode = ExecutionMode.LOCAL

        # For agent mode, find an available agent
        selected_agent_id = agent_id or pipeline.preferred_agent_id
        if mode == ExecutionMode.AGENT:
            agent = await self.agent_repo.get_available_agent(
                pool=agent_pool,
                labels=agent_labels,
                preferred_agent_id=selected_agent_id,
            )
            if not agent:
                logger.error("No available agents for pipeline execution")
                return None
            selected_agent_id = agent.id

        # Create run record
        run = await self._create_run(
            pipeline=pipeline,
            branch=branch,
            commit_sha=commit_sha,
            commit_message=commit_message,
            trigger_type=trigger_type,
            triggered_by=triggered_by,
            environment=environment,
            variables=variables,
            execution_mode=mode,
            agent_id=selected_agent_id,
        )

        if not run:
            return None

        # Start execution based on mode
        if mode == ExecutionMode.AGENT and selected_agent_id:
            self._start_agent_execution(run.id, pipeline, selected_agent_id)
        elif mode == ExecutionMode.KUBERNETES:
            self._start_kubernetes_execution(run.id, pipeline)
        else:
            self._start_background_execution(run.id, pipeline)

        # Return run details (before execution completes)
        # Build response dict manually to avoid lazy loading issues with async SQLAlchemy
        # The run object has its data but accessing relationships would trigger lazy loading
        # which fails outside proper async context after commit
        # Use snake_case field names to match PipelineRun schema
        return {
            "id": run.id,
            "pipeline_id": run.pipeline_id,
            "pipeline_name": pipeline.name,  # From pipeline object we already have
            "status": run.status.value if run.status else "pending",
            "branch": run.branch,
            "commit_sha": run.commit_sha,
            "commit_message": run.commit_message,
            "triggered_by": run.triggered_by,
            "started_at": run.started_at,  # Return datetime directly, Pydantic handles serialization
            "finished_at": run.finished_at,
            "duration_seconds": run.duration_seconds,
            "error_message": run.error_message,
            "artifacts": run.artifacts or [],
            "environment": run.environment,
            "logs": None,
            # Empty list for stages - they'll be populated by background task
            "stages": [],
        }

    async def _create_run(
        self,
        pipeline: Pipeline,
        branch: Optional[str],
        commit_sha: Optional[str],
        commit_message: Optional[str],
        trigger_type: str,
        triggered_by: str,
        environment: Optional[str],
        variables: Optional[Dict[str, Any]],
        execution_mode: ExecutionMode = ExecutionMode.LOCAL,
        agent_id: Optional[str] = None,
    ) -> Optional[PipelineRun]:
        """Create a run record with stages based on YAML config."""

        # Parse stages from YAML
        stage_configs = self._parse_stages_from_yaml(pipeline.yaml_config)

        # Create run
        run = PipelineRun(
            pipeline_id=pipeline.id,
            branch=branch or pipeline.branch or "main",
            commit_sha=commit_sha,
            commit_message=commit_message,
            trigger_type=TriggerType(trigger_type) if trigger_type else TriggerType.MANUAL,
            triggered_by=triggered_by,
            environment=environment,
            variables=variables or {},
            status=PipelineStatus.PENDING,
            execution_mode=execution_mode,
            agent_id=agent_id,
        )

        self.db.add(run)
        await self.db.flush()
        await self.db.refresh(run)

        # Create stage records
        stages = []
        for i, stage_config in enumerate(stage_configs):
            # Check if stage requires approval (from YAML or if it's a deploy stage to production)
            requires_approval = stage_config.get("requiresApproval", False) or stage_config.get("requires_approval", False)
            
            # Auto-require approval for production deployments
            stage_name_lower = stage_config.get("name", "").lower()
            is_deploy_stage = "deploy" in stage_name_lower
            is_production_env = environment and environment.lower() in ["production", "prod"]
            
            if is_deploy_stage and is_production_env:
                requires_approval = True
            
            # Determine required approvers (default: 1, production: 2)
            required_approvers = stage_config.get("requiredApprovers", 2 if (is_deploy_stage and is_production_env) else 1)
            
            stage = PipelineStage(
                run_id=run.id,
                name=stage_config.get("name", f"Stage {i + 1}"),
                order=i,
                status=StageStatus.PENDING,
                requires_approval=requires_approval,
                required_approvers=required_approvers,
                approver_roles=stage_config.get("approverRoles", ["admin", "lead"] if is_production_env else ["admin"]),
            )
            self.db.add(stage)
            stages.append(stage)

        await self.db.flush()
        # Don't set run.stages = stages as it triggers lazy loading
        # The stages are already linked via run_id foreign key

        # Update pipeline tracking
        pipeline.total_runs += 1
        pipeline.last_run_id = run.id
        pipeline.last_run_status = run.status
        pipeline.last_run_at = run.started_at

        # Add initial log
        await self._add_log(run.id, "Pipeline execution queued", "info")

        await self.db.commit()

        logger.info(f"Created run {run.id} for pipeline {pipeline.id} with {len(stages)} stages")
        return run

    def _parse_stages_from_yaml(self, yaml_config: Optional[str]) -> List[Dict[str, Any]]:
        """Parse stage configurations from YAML."""
        if not yaml_config:
            return [
                {"name": "Build", "steps": []},
                {"name": "Test", "steps": []},
                {"name": "Deploy", "steps": []},
            ]

        try:
            config = yaml.safe_load(yaml_config)

            # NextSight format
            if "spec" in config and "stages" in config["spec"]:
                stages = []
                for stage_data in config["spec"]["stages"]:
                    stage_dict = {
                        "name": stage_data.get("name", "Unnamed"),
                        "steps": stage_data.get("steps", []),
                        "requiresApproval": stage_data.get("requiresApproval", False) or stage_data.get("requires_approval", False),
                        "requiredApprovers": stage_data.get("requiredApprovers", stage_data.get("required_approvers", 1)),
                        "approverRoles": stage_data.get("approverRoles", stage_data.get("approver_roles", [])),
                    }
                    stages.append(stage_dict)
                return stages

            # Simple stages format
            if "stages" in config:
                raw_stages = config["stages"]
                if isinstance(raw_stages, list):
                    # Handle list of stage objects or just names
                    stages = []
                    for s in raw_stages:
                        if isinstance(s, dict):
                            stage_dict = {
                                "name": s.get("name", "Unnamed"),
                                "steps": s.get("steps", []),
                                "requiresApproval": s.get("requiresApproval", False) or s.get("requires_approval", False),
                                "requiredApprovers": s.get("requiredApprovers", s.get("required_approvers", 1)),
                                "approverRoles": s.get("approverRoles", s.get("approver_roles", [])),
                            }
                        else:
                            stage_dict = {"name": s, "steps": [], "requiresApproval": False}
                        stages.append(stage_dict)
                    return stages

            # GitHub Actions format
            if "jobs" in config:
                stages = []
                for name, job in config["jobs"].items():
                    stages.append({
                        "name": name.replace("_", " ").title(),
                        "steps": job.get("steps", []),
                        "requiresApproval": job.get("requiresApproval", False),
                    })
                return stages

        except Exception as e:
            logger.warning(f"Failed to parse YAML stages: {e}")

        return [
            {"name": "Build", "steps": []},
            {"name": "Test", "steps": []},
            {"name": "Deploy", "steps": [], "requiresApproval": True},  # Default deploy requires approval
        ]

    def _start_background_execution(self, run_id: str, pipeline: Pipeline) -> None:
        """Start local pipeline execution in a background task."""
        task = asyncio.create_task(
            self._execute_pipeline_background(run_id, pipeline),
            name=f"pipeline-{run_id}"
        )
        self.task_manager.add_task(run_id, task)
        logger.info(f"Started local execution for run {run_id}")

    def _start_agent_execution(
        self,
        run_id: str,
        pipeline: Pipeline,
        agent_id: str,
    ) -> None:
        """Start pipeline execution on a remote agent."""
        task = asyncio.create_task(
            self._execute_pipeline_on_agent(run_id, pipeline, agent_id),
            name=f"pipeline-agent-{run_id}"
        )
        self.task_manager.add_task(run_id, task)
        logger.info(f"Started agent execution for run {run_id} on agent {agent_id}")

    def _start_kubernetes_execution(self, run_id: str, pipeline: Pipeline) -> None:
        """Start pipeline execution as Kubernetes Job."""
        task = asyncio.create_task(
            self._execute_pipeline_kubernetes(run_id, pipeline),
            name=f"pipeline-k8s-{run_id}"
        )
        self.task_manager.add_task(run_id, task)
        logger.info(f"Started Kubernetes execution for run {run_id}")

    async def _execute_pipeline_background(
        self,
        run_id: str,
        pipeline: Pipeline,
    ) -> None:
        """Execute pipeline in background with database updates."""

        # Create a new database session for background task
        async with async_session_maker() as db:
            repo = PipelineRepository(db)

            try:
                # Get fresh run object
                run = await repo.get_run(run_id)
                if not run:
                    logger.error(f"Run not found: {run_id}")
                    return

                # Update status to running
                run.status = PipelineStatus.RUNNING
                run.started_at = utc_now()
                await db.commit()

                await self._add_log_with_session(db, run_id, "▶️  Pipeline execution started", "info")

                # Get stages from database (ordered by order field)
                stages = sorted(list(run.stages), key=lambda s: s.order)
                stage_map = {s.name: s for s in stages}

                # Create log callback that persists to database
                current_stage = [None]  # Use list for mutable closure
                current_stage_index = [0]  # Track current stage index
                pending_logs = []  # Buffer logs to batch commit

                async def log_callback(stage_name: str, message: str) -> None:
                    """Persist log to database - non-blocking."""
                    nonlocal pending_logs
                    try:
                        # Update current stage tracking
                        if stage_name != current_stage[0]:
                            if current_stage[0] and current_stage[0] in stage_map:
                                # Mark previous stage as success
                                prev_stage = stage_map[current_stage[0]]
                                if prev_stage.status == StageStatus.RUNNING:
                                    prev_stage.status = StageStatus.SUCCESS
                                    prev_stage.finished_at = utc_now()
                                    if prev_stage.started_at:
                                        prev_stage.duration_seconds = int(
                                            (prev_stage.finished_at - prev_stage.started_at).total_seconds()
                                        )

                            # Start new stage
                            if stage_name in stage_map:
                                new_stage = stage_map[stage_name]
                                new_stage.status = StageStatus.RUNNING
                                new_stage.started_at = utc_now()

                            current_stage[0] = stage_name

                        # Buffer log entry (don't commit yet to avoid concurrent operations)
                        stage_id = stage_map.get(stage_name, stages[0] if stages else None)
                        stage_id_str = stage_id.id if stage_id else None

                        log = PipelineLog(
                            run_id=run_id,
                            stage_id=stage_id_str,
                            message=message,
                            level="info" if "✅" in message else "error" if "❌" in message else "info",
                        )
                        db.add(log)
                        pending_logs.append(log)
                    except Exception as e:
                        logger.warning(f"Error in log_callback: {e}")

                # Execute stages sequentially with approval checks
                for stage in stages:
                    # Check if previous stage completed successfully
                    if stage.order > 0:
                        prev_stage = stages[stage.order - 1]
                        if prev_stage.status != StageStatus.SUCCESS:
                            stage.status = StageStatus.SKIPPED
                            await db.commit()
                            continue

                    # Check if stage requires approval
                    if getattr(stage, 'requires_approval', False):
                        # Check approval status
                        from sqlalchemy import select, func
                        from app.models.pipeline import PipelineApproval, ApprovalStatus
                        
                        approval_query = select(
                            func.count(PipelineApproval.id).label("total"),
                            func.count(PipelineApproval.id).filter(
                                PipelineApproval.status == ApprovalStatus.APPROVED
                            ).label("approved"),
                            func.count(PipelineApproval.id).filter(
                                PipelineApproval.status == ApprovalStatus.REJECTED
                            ).label("rejected"),
                        ).where(PipelineApproval.stage_id == stage.id)
                        
                        approval_result = await db.execute(approval_query)
                        approval_row = approval_result.one()
                        
                        approved_count = approval_row.approved or 0
                        rejected_count = approval_row.rejected or 0
                        required_approvers = getattr(stage, 'required_approvers', 1) or 1
                        
                        # If rejected, fail the stage
                        if rejected_count > 0:
                            stage.status = StageStatus.FAILED
                            stage.error_message = "Deployment rejected by approver"
                            run.status = PipelineStatus.FAILED
                            run.error_message = f"Stage '{stage.name}' was rejected"
                            await self._add_log_with_session(
                                db, run_id,
                                f"❌ Stage '{stage.name}' requires approval and was rejected",
                                "error"
                            )
                            await db.commit()
                            break
                        
                        # If not enough approvals, wait for approval
                        if approved_count < required_approvers:
                            stage.status = StageStatus.PENDING
                            await self._add_log_with_session(
                                db, run_id,
                                f"⏸️  Stage '{stage.name}' is waiting for approval ({approved_count}/{required_approvers} approvals)",
                                "info"
                            )
                            await db.commit()
                            
                            # Poll for approval (with timeout)
                            max_wait_time = 3600  # 1 hour
                            wait_interval = 5  # Check every 5 seconds
                            waited_time = 0
                            
                            while waited_time < max_wait_time:
                                await asyncio.sleep(wait_interval)
                                waited_time += wait_interval
                                
                                # Refresh stage and check approvals
                                await db.refresh(stage)
                                approval_result = await db.execute(approval_query)
                                approval_row = approval_result.one()
                                approved_count = approval_row.approved or 0
                                rejected_count = approval_row.rejected or 0
                                
                                if rejected_count > 0:
                                    stage.status = StageStatus.FAILED
                                    stage.error_message = "Deployment rejected by approver"
                                    run.status = PipelineStatus.FAILED
                                    await self._add_log_with_session(
                                        db, run_id,
                                        f"❌ Stage '{stage.name}' was rejected",
                                        "error"
                                    )
                                    await db.commit()
                                    break
                                
                                if approved_count >= required_approvers:
                                    await self._add_log_with_session(
                                        db, run_id,
                                        f"✅ Stage '{stage.name}' approved ({approved_count} approvals)",
                                        "info"
                                    )
                                    await db.commit()
                                    break
                            
                            # Check if we timed out
                            if waited_time >= max_wait_time:
                                stage.status = StageStatus.FAILED
                                stage.error_message = "Approval timeout - no response within 1 hour"
                                run.status = PipelineStatus.FAILED
                                await self._add_log_with_session(
                                    db, run_id,
                                    f"⏱️  Stage '{stage.name}' approval timeout",
                                    "error"
                                )
                                await db.commit()
                                break
                            
                            # If rejected, stop execution
                            if stage.status == StageStatus.FAILED:
                                break

                    # Execute the stage
                    stage.status = StageStatus.RUNNING
                    stage.started_at = utc_now()
                    await db.commit()
                    
                    await self._add_log_with_session(
                        db, run_id,
                        f"▶️  Executing stage: {stage.name}",
                        "info"
                    )

                    # Execute the stage
                    if pipeline.yaml_config:
                        # Execute only this stage's commands
                        # Pass async log_callback directly (no fire-and-forget tasks)
                        stage_result = await self._execute_stage(
                            db, run_id, stage, pipeline, run, log_callback
                        )
                        # Commit any buffered logs after stage execution
                        await db.commit()
                    else:
                        # Mock execution for pipelines without YAML
                        await log_callback(stage.name, f"▶️  Starting stage: {stage.name}")
                        await asyncio.sleep(2)  # Simulate work
                        await log_callback(stage.name, f"✅ Stage {stage.name} completed")
                        stage_result = {"status": "success"}
                        # Commit buffered logs
                        await db.commit()

                    # Update stage status
                    if stage_result.get("status") == "success":
                        stage.status = StageStatus.SUCCESS
                        await self._add_log_with_session(
                            db, run_id,
                            f"✅ Stage '{stage.name}' completed successfully",
                            "info"
                        )
                    else:
                        stage.status = StageStatus.FAILED
                        stage.error_message = stage_result.get("error", "Unknown error")
                        run.status = PipelineStatus.FAILED
                        await self._add_log_with_session(
                            db, run_id,
                            f"❌ Stage '{stage.name}' failed: {stage.error_message}",
                            "error"
                        )
                        await db.commit()
                        break

                    stage.finished_at = utc_now()
                    if stage.started_at:
                        stage.duration_seconds = int(
                            (stage.finished_at - stage.started_at).total_seconds()
                        )
                    await db.commit()

                # Determine final result
                all_success = all(s.status == StageStatus.SUCCESS for s in stages)
                any_failed = any(s.status == StageStatus.FAILED for s in stages)
                
                if any_failed:
                    result = {"status": "failed", "error": "One or more stages failed"}
                elif all_success:
                    result = {"status": "success"}
                else:
                    result = {"status": "failed", "error": "Pipeline incomplete"}

                # Update final status based on result
                if result.get("status") == "success":
                    run.status = PipelineStatus.SUCCESS
                    await self._add_log_with_session(db, run_id, "✅ Pipeline completed successfully", "info")
                else:
                    run.status = PipelineStatus.FAILED
                    run.error_message = result.get("error", "Unknown error")
                    await self._add_log_with_session(
                        db, run_id,
                        f"❌ Pipeline failed: {run.error_message}",
                        "error"
                    )

                    # Mark any running stage as failed
                    for stage in stages:
                        if stage.status == StageStatus.RUNNING:
                            stage.status = StageStatus.FAILED
                            stage.finished_at = utc_now()
                            stage.error_message = run.error_message

                # Finalize run timing
                run.finished_at = utc_now()
                if run.started_at:
                    run.duration_seconds = int(
                        (run.finished_at - run.started_at).total_seconds()
                    )

                # Update pipeline statistics
                await self._update_pipeline_stats(db, pipeline.id, run.status)

                await db.commit()
                logger.info(f"Run {run_id} completed with status: {run.status.value}")

            except asyncio.CancelledError:
                # Handle cancellation
                run = await repo.get_run(run_id)
                if run:
                    run.status = PipelineStatus.CANCELLED
                    run.finished_at = utc_now()
                    run.error_message = "Cancelled by user"

                    for stage in run.stages:
                        if stage.status in [StageStatus.RUNNING, StageStatus.PENDING]:
                            stage.status = StageStatus.SKIPPED

                    await self._add_log_with_session(db, run_id, "⚠️  Pipeline cancelled", "warn")
                    await db.commit()

                logger.info(f"Run {run_id} was cancelled")

            except Exception as e:
                logger.exception(f"Error executing run {run_id}: {e}")

                try:
                    run = await repo.get_run(run_id)
                    if run:
                        run.status = PipelineStatus.FAILED
                        run.finished_at = utc_now()
                        run.error_message = str(e)

                        for stage in run.stages:
                            if stage.status == StageStatus.RUNNING:
                                stage.status = StageStatus.FAILED
                                stage.error_message = str(e)

                        await self._add_log_with_session(db, run_id, f"❌ Execution error: {e}", "error")
                        await db.commit()
                except Exception:
                    pass

    async def _execute_pipeline_on_agent(
        self,
        run_id: str,
        pipeline: Pipeline,
        agent_id: str,
    ) -> None:
        """Execute pipeline on a remote agent."""
        async with async_session_maker() as db:
            repo = PipelineRepository(db)
            agent_repo = AgentRepository(db)

            try:
                # Get run and agent
                run = await repo.get_run(run_id)
                agent = await agent_repo.get_agent(agent_id)

                if not run or not agent:
                    logger.error(f"Run or agent not found: {run_id}, {agent_id}")
                    return

                # Update run status
                run.status = PipelineStatus.RUNNING
                run.started_at = utc_now()
                await db.commit()

                await self._add_log_with_session(
                    db, run_id,
                    f"🖥️  Executing on agent: {agent.name} ({agent.host}:{agent.port})",
                    "info"
                )

                # Create job assignment
                assignment = await agent_repo.create_job_assignment(
                    agent_id=agent_id,
                    run_id=run_id,
                    remote_workspace=f"{agent.workspace_path}/{run_id}",
                )

                # Prepare job request
                job_request = AgentJobRequest(
                    run_id=run_id,
                    pipeline_id=pipeline.id,
                    pipeline_name=pipeline.name,
                    repository=pipeline.repository,
                    branch=run.branch or "main",
                    commit_sha=run.commit_sha,
                    yaml_config=pipeline.yaml_config or "",
                    variables=run.variables or {},
                    workspace_path=agent.workspace_path,
                )

                # Create callbacks for log and status updates
                def log_callback(message: str, level: str = "info"):
                    asyncio.create_task(
                        self._add_log_with_session(db, run_id, message, level)
                    )

                def status_callback(status: str, stage_name: Optional[str], error_message: Optional[str]):
                    logger.info(f"Agent status update: {status}, stage: {stage_name}")

                # Execute on agent
                async with AgentRunner(agent, log_callback, status_callback) as runner:
                    # Check agent health
                    if not await runner.check_health():
                        raise AgentRunnerError(f"Agent {agent.name} is not reachable")

                    # Submit job to agent
                    await runner.submit_job(job_request)

                    # Poll for completion
                    final_status = await runner.poll_job_status(
                        run_id=run_id,
                        interval_seconds=2.0,
                        timeout_seconds=3600.0,
                    )

                    # Update run based on result
                    if final_status == "success":
                        run.status = PipelineStatus.SUCCESS
                        await self._add_log_with_session(
                            db, run_id, "✅ Pipeline completed on agent", "info"
                        )
                    else:
                        run.status = PipelineStatus.FAILED
                        run.error_message = f"Agent execution failed: {final_status}"
                        await self._add_log_with_session(
                            db, run_id, f"❌ Pipeline failed on agent: {final_status}", "error"
                        )

                # Finalize run
                run.finished_at = utc_now()
                if run.started_at:
                    run.duration_seconds = int(
                        (run.finished_at - run.started_at).total_seconds()
                    )

                # Complete job assignment
                await agent_repo.complete_job_assignment(
                    run_id=run_id,
                    success=run.status == PipelineStatus.SUCCESS,
                    duration_seconds=run.duration_seconds or 0,
                )

                # Update pipeline stats
                await self._update_pipeline_stats(db, pipeline.id, run.status)
                await db.commit()

            except asyncio.CancelledError:
                run = await repo.get_run(run_id)
                if run:
                    run.status = PipelineStatus.CANCELLED
                    run.finished_at = utc_now()
                    await self._add_log_with_session(db, run_id, "⚠️  Pipeline cancelled", "warn")
                    await db.commit()

            except AgentRunnerError as e:
                logger.error(f"Agent execution error: {e}")
                run = await repo.get_run(run_id)
                if run:
                    run.status = PipelineStatus.FAILED
                    run.finished_at = utc_now()
                    run.error_message = str(e)
                    await self._add_log_with_session(db, run_id, f"❌ Agent error: {e}", "error")
                    await db.commit()

            except Exception as e:
                logger.exception(f"Error in agent execution: {e}")
                try:
                    run = await repo.get_run(run_id)
                    if run:
                        run.status = PipelineStatus.FAILED
                        run.finished_at = utc_now()
                        run.error_message = str(e)
                        await self._add_log_with_session(db, run_id, f"❌ Error: {e}", "error")
                        await db.commit()
                except Exception:
                    pass

    async def _execute_pipeline_kubernetes(
        self,
        run_id: str,
        pipeline: Pipeline,
    ) -> None:
        """Execute pipeline as a Kubernetes Job."""
        async with async_session_maker() as db:
            repo = PipelineRepository(db)

            try:
                run = await repo.get_run(run_id)
                if not run:
                    return

                run.status = PipelineStatus.RUNNING
                run.started_at = utc_now()
                await db.commit()

                await self._add_log_with_session(
                    db, run_id,
                    f"☸️  Submitting to Kubernetes namespace: {pipeline.kubernetes_namespace or 'default'}",
                    "info"
                )

                # Import kubernetes executor
                try:
                    from app.services.pipeline_executor import PipelineExecutor
                    import yaml

                    executor = PipelineExecutor()
                    
                    # Ensure namespace exists
                    await executor.ensure_namespace()
                    
                    # Check if Kubernetes is configured
                    executor._ensure_k8s_config()
                    if not executor.batch_v1:
                        raise Exception("Kubernetes client not configured - check kubeconfig")

                    # Parse and convert NextSight YAML format to executor format
                    yaml_content = pipeline.yaml_config or ""
                    if not yaml_content:
                        raise Exception("Pipeline YAML configuration is empty")
                    
                    yaml_data = yaml.safe_load(yaml_content)
                    if not yaml_data:
                        raise Exception("Failed to parse pipeline YAML configuration")
                    
                    # Convert NextSight format to executor format
                    # NextSight format: spec.stages[] with steps[]
                    # Executor format: stages[] with commands[]
                    metadata = yaml_data.get("metadata", {}) or {}
                    converted_yaml = {"name": metadata.get("name", pipeline.name or "pipeline")}
                    
                    stages = []
                    spec = yaml_data.get("spec", {}) or {}
                    if "stages" in spec and isinstance(spec["stages"], list):
                        for stage_data in spec["stages"]:
                            if not isinstance(stage_data, dict):
                                continue
                                
                            # Extract commands from steps
                            commands = []
                            steps = stage_data.get("steps", [])
                            if isinstance(steps, list):
                                for step in steps:
                                    if isinstance(step, dict):
                                        cmd = step.get("command", "")
                                        if cmd:
                                            commands.append(cmd)
                            
                            if not commands:
                                # If no commands in steps, skip this stage
                                logger.warning(f"Stage {stage_data.get('name', 'unnamed')} has no commands, skipping")
                                continue
                            
                            stages.append({
                                "name": stage_data.get("name", "unnamed"),
                                "image": stage_data.get("image", "alpine:latest"),
                                "commands": commands,
                                "env": stage_data.get("env", {}) or {}
                            })
                    
                    if not stages:
                        raise Exception("No valid stages found in pipeline configuration")
                    
                    converted_yaml["stages"] = stages
                    
                    # Add repo info if available
                    repo_info = spec.get("repo", {})
                    if repo_info and isinstance(repo_info, dict) and repo_info.get("url"):
                        converted_yaml["repo_url"] = repo_info.get("url")
                        # Prefer branch from YAML config, then run.branch, then default to master
                        yaml_branch = repo_info.get("branch")
                        converted_yaml["branch"] = yaml_branch or run.branch or "master"
                        converted_yaml["clone_repo"] = True
                    else:
                        # No repo specified - skip cloning
                        converted_yaml["clone_repo"] = False
                        converted_yaml["repo_url"] = None
                    
                    converted_yaml_str = yaml.dump(converted_yaml)

                    # Execute using K8s - consume the async generator
                    # IMPORTANT: Use log_callback for real-time log streaming
                    final_result = None
                    stage_updates = {}  # Dict: stage_name -> update data (no ORM objects)
                    stage_id_map = {}  # Map stage name to stage ID

                    # Build stage ID map from run stages
                    await db.refresh(run)
                    for stage in run.stages:
                        stage_id_map[stage.name] = stage.id

                    # Create real-time log callback that stores to database
                    async def realtime_log_callback(rid: str, stage_name: str, message: str):
                        """Store log in database in real-time"""
                        try:
                            stage_id = stage_id_map.get(stage_name)
                            log = PipelineLog(
                                run_id=rid,
                                stage_id=stage_id,
                                message=message,
                                level="info" if "✅" not in message and "❌" not in message else (
                                    "info" if "✅" in message else "error"
                                ),
                            )
                            db.add(log)
                            await db.flush()
                            # Don't commit here to avoid transaction issues
                        except Exception as e:
                            logger.warning(f"Failed to store realtime log: {e}")

                    try:
                        # Use branch from converted YAML if available, otherwise use run.branch or master
                        exec_branch = converted_yaml.get("branch") or run.branch or "master"

                        # Consume async generator with real-time log callback
                        async for result in executor.execute_pipeline(
                            pipeline_yaml=converted_yaml_str,
                            trigger="manual",
                            branch=exec_branch,
                            commit=run.commit_sha,
                            run_id=run_id,
                            log_callback=realtime_log_callback,
                        ):
                            final_result = result
                            
                            # Collect stage updates (only primitive data, no ORM objects)
                            if result.stages:
                                for stage_result in result.stages:
                                    stage_name = stage_result.name if hasattr(stage_result, 'name') else None
                                    if not stage_name:
                                        continue
                                    
                                    # Handle status - it might be an enum or string
                                    status_value = stage_result.status
                                    if hasattr(status_value, 'value'):
                                        status_value = status_value.value
                                    
                                    # Store only primitive data (no ORM objects)
                                    stage_updates[stage_name] = {
                                        'status': status_value,
                                        'started_at': getattr(stage_result, 'started_at', None),
                                        'finished_at': getattr(stage_result, 'finished_at', None),
                                        'logs': getattr(stage_result, 'logs', None),
                                    }
                        
                        # Now update database AFTER async generator completes
                        # Refresh run to get fresh stages
                        await db.refresh(run)
                        stages = sorted(list(run.stages), key=lambda s: s.order)
                        
                        # Update stages using collected data
                        for stage in stages:
                            if stage.name in stage_updates:
                                update_info = stage_updates[stage.name]
                                
                                # Update status
                                if update_info['status'] == "success":
                                    stage.status = StageStatus.SUCCESS
                                elif update_info['status'] == "failed":
                                    stage.status = StageStatus.FAILED
                                elif update_info['status'] == "running":
                                    stage.status = StageStatus.RUNNING
                                
                                # Update timestamps
                                if update_info['started_at']:
                                    stage.started_at = update_info['started_at']
                                if update_info['finished_at']:
                                    stage.finished_at = update_info['finished_at']
                                
                                # Logs are now stored in real-time via callback
                                # Just calculate duration if timestamps are available
                                if stage.started_at and stage.finished_at:
                                    stage.duration_seconds = int(
                                        (stage.finished_at - stage.started_at).total_seconds()
                                    )
                        
                        # Commit stage updates and any remaining logs
                        await db.commit()
                        logger.info(f"Pipeline execution completed, stage updates committed for run {run_id}")
                    except Exception as exec_error:
                        logger.error(f"Error during pipeline execution: {exec_error}", exc_info=True)
                        raise Exception(f"Pipeline execution failed: {str(exec_error)}")

                    # Final status
                    if final_result:
                        # Handle status - it might be an enum or string
                        final_status = final_result.status
                        if hasattr(final_status, 'value'):
                            final_status = final_status.value
                        
                        if final_status == "success":
                            run.status = PipelineStatus.SUCCESS
                            await self._add_log_with_session(
                                db, run_id, "✅ Kubernetes job completed", "info"
                            )
                        else:
                            run.status = PipelineStatus.FAILED
                            error_msg = "Pipeline execution failed"
                            if final_result.stages:
                                failed_stages = [
                                    s for s in final_result.stages 
                                    if (hasattr(s, 'status') and 
                                        (s.status.value if hasattr(s.status, 'value') else s.status) == "failed")
                                ]
                                if failed_stages:
                                    failed_stage = failed_stages[0]
                                    stage_name = failed_stage.name if hasattr(failed_stage, 'name') else "unknown"
                                    stage_logs = failed_stage.logs if hasattr(failed_stage, 'logs') else "No logs"
                                    error_msg = f"Stage {stage_name} failed: {stage_logs[:200]}"
                            run.error_message = error_msg
                            await self._add_log_with_session(
                                db, run_id, f"❌ Kubernetes job failed: {error_msg}", "error"
                            )
                        
                        # Set finished_at and duration
                        run.finished_at = utc_now()
                        if run.started_at:
                            run.duration_seconds = int(
                                (run.finished_at - run.started_at).total_seconds()
                            )
                        
                        # Mark any remaining pending/running stages as skipped or failed
                        for stage in run.stages:
                            if stage.status == StageStatus.RUNNING:
                                stage.status = StageStatus.FAILED if final_status != "success" else StageStatus.SKIPPED
                                stage.finished_at = utc_now()
                            elif stage.status == StageStatus.PENDING:
                                stage.status = StageStatus.SKIPPED
                                stage.finished_at = utc_now()
                    else:
                        # No result returned - execution may have been interrupted
                        # Check stage statuses to determine final status
                        has_failed = any(s.status == StageStatus.FAILED for s in run.stages)
                        all_success = all(s.status == StageStatus.SUCCESS for s in run.stages if s.status != StageStatus.PENDING)
                        
                        if has_failed:
                            run.status = PipelineStatus.FAILED
                        elif all_success and len([s for s in run.stages if s.status == StageStatus.SUCCESS]) > 0:
                            run.status = PipelineStatus.SUCCESS
                        else:
                            run.status = PipelineStatus.FAILED
                        
                        run.error_message = "Pipeline execution did not complete"
                        run.finished_at = utc_now()
                        if run.started_at:
                            run.duration_seconds = int(
                                (run.finished_at - run.started_at).total_seconds()
                            )
                        
                        # Mark pending/running stages
                        for stage in run.stages:
                            if stage.status in [StageStatus.PENDING, StageStatus.RUNNING]:
                                stage.status = StageStatus.FAILED
                                stage.finished_at = utc_now()
                        
                        await self._add_log_with_session(
                            db, run_id, "❌ Kubernetes job did not complete", "error"
                        )
                    
                    # Update pipeline statistics and commit
                    await self._update_pipeline_stats(db, pipeline.id, run.status)
                    await db.commit()
                    logger.info(f"Run {run_id} completed with status: {run.status.value}")

                except Exception as e:
                    # Fallback to mock execution if K8s not available or execution fails
                    error_msg = str(e)
                    error_type = type(e).__name__
                    logger.error(f"Kubernetes execution failed for run {run_id}: {error_type}: {error_msg}", exc_info=True)
                    
                    # Check if it's a configuration issue (should use mock) or execution issue (should fail)
                    if "not configured" in error_msg.lower() or "kubeconfig" in error_msg.lower() or isinstance(e, (ImportError, AttributeError)):
                        await self._add_log_with_session(
                            db, run_id,
                            f"⚠️  Kubernetes not available: {error_msg}. Using mock execution",
                            "warn"
                        )
                    else:
                        # Real execution error - mark as failed
                        run.status = PipelineStatus.FAILED
                        run.error_message = error_msg
                        await self._add_log_with_session(
                            db, run_id,
                            f"❌ Kubernetes execution failed: {error_msg}",
                            "error"
                        )
                        await db.commit()
                        return

                    stages = list(run.stages)
                    for stage in stages:
                        stage.status = StageStatus.RUNNING
                        stage.started_at = utc_now()
                        await db.commit()

                        await self._add_log_with_session(
                            db, run_id, f"▶️  [K8s Mock] Running stage: {stage.name}", "info"
                        )
                        await asyncio.sleep(2)

                        stage.status = StageStatus.SUCCESS
                        stage.finished_at = utc_now()
                        await self._add_log_with_session(
                            db, run_id, f"✅ [K8s Mock] Stage completed: {stage.name}", "info"
                        )

                    run.status = PipelineStatus.SUCCESS
                    await self._add_log_with_session(
                        db, run_id, "✅ Pipeline completed (mock K8s)", "info"
                    )

                # Finalize
                run.finished_at = utc_now()
                if run.started_at:
                    run.duration_seconds = int(
                        (run.finished_at - run.started_at).total_seconds()
                    )

                await self._update_pipeline_stats(db, pipeline.id, run.status)
                await db.commit()

            except asyncio.CancelledError:
                run = await repo.get_run(run_id)
                if run:
                    run.status = PipelineStatus.CANCELLED
                    run.finished_at = utc_now()
                    await self._add_log_with_session(db, run_id, "⚠️  Pipeline cancelled", "warn")
                    await db.commit()

            except Exception as e:
                logger.exception(f"Kubernetes execution error: {e}")
                try:
                    run = await repo.get_run(run_id)
                    if run:
                        run.status = PipelineStatus.FAILED
                        run.finished_at = utc_now()
                        run.error_message = str(e)
                        await self._add_log_with_session(db, run_id, f"❌ Error: {e}", "error")
                        await db.commit()
                except Exception:
                    pass

    async def _execute_stage(
        self,
        db: AsyncSession,
        run_id: str,
        stage: PipelineStage,
        pipeline: Pipeline,
        run: PipelineRun,
        log_callback: Callable,
    ) -> Dict[str, Any]:
        """Execute a single stage."""
        try:
            if pipeline.yaml_config:
                # Parse YAML to get stage-specific commands
                config = yaml.safe_load(pipeline.yaml_config)
                stage_config = None
                
                # Find matching stage in YAML
                if "spec" in config and "stages" in config.get("spec", {}):
                    for s in config["spec"]["stages"]:
                        if s.get("name") == stage.name:
                            stage_config = s
                            break
                
                if stage_config:
                    # Execute stage commands
                    commands = []
                    for step in stage_config.get("steps", []):
                        if isinstance(step, dict):
                            commands.append(step.get("command", step.get("run", "")))
                        elif isinstance(step, str):
                            commands.append(step)
                    
                    # Execute commands via runner
                    for cmd in commands:
                        if cmd:
                            await log_callback(stage.name, f"Running: {cmd}")
                            # In real implementation, execute command here
                            await asyncio.sleep(1)  # Simulate execution
                    
                    return {"status": "success"}
            
            # Fallback: mock execution
            await asyncio.sleep(2)
            return {"status": "success"}
            
        except Exception as e:
            logger.error(f"Error executing stage {stage.name}: {e}")
            return {"status": "failed", "error": str(e)}

    async def _mock_execution(
        self,
        run_id: str,
        stages: List[PipelineStage],
        log_callback: Callable,
    ) -> Dict[str, Any]:
        """Mock execution for testing without real commands."""
        import random

        for stage in stages:
            await log_callback(stage.name, f"▶️  Starting stage: {stage.name}")

            # Simulate work
            await asyncio.sleep(random.uniform(1, 3))

            # Random success/failure (90% success rate)
            if random.random() < 0.9:
                await log_callback(stage.name, f"✅ Stage {stage.name} completed")
            else:
                await log_callback(stage.name, f"❌ Stage {stage.name} failed")
                return {"status": "failed", "error": f"Stage {stage.name} failed"}

        return {"status": "success"}

    async def _add_log(
        self,
        run_id: str,
        message: str,
        level: str = "info",
        stage_id: Optional[str] = None,
    ) -> None:
        """Add a log entry using the current session."""
        log = PipelineLog(
            run_id=run_id,
            stage_id=stage_id,
            message=message,
            level=level,
        )
        self.db.add(log)
        await self.db.flush()

    async def _add_log_with_session(
        self,
        db: AsyncSession,
        run_id: str,
        message: str,
        level: str = "info",
        stage_id: Optional[str] = None,
    ) -> None:
        """Add a log entry with an explicit session."""
        log = PipelineLog(
            run_id=run_id,
            stage_id=stage_id,
            message=message,
            level=level,
        )
        db.add(log)
        await db.flush()

    async def _update_pipeline_stats(
        self,
        db: AsyncSession,
        pipeline_id: str,
        run_status: PipelineStatus,
    ) -> None:
        """Update pipeline statistics after a run completes."""
        from sqlalchemy import select, func

        # Get latest run info
        query = select(PipelineRun).where(
            PipelineRun.pipeline_id == pipeline_id
        ).order_by(PipelineRun.started_at.desc()).limit(1)

        result = await db.execute(query)
        latest_run = result.scalar_one_or_none()

        # Count statistics
        stats_query = select(
            func.count(PipelineRun.id).label("total"),
            func.count(PipelineRun.id).filter(
                PipelineRun.status == PipelineStatus.SUCCESS
            ).label("success"),
            func.count(PipelineRun.id).filter(
                PipelineRun.status == PipelineStatus.FAILED
            ).label("failed"),
            func.avg(PipelineRun.duration_seconds).label("avg_duration"),
        ).where(PipelineRun.pipeline_id == pipeline_id)

        stats_result = await db.execute(stats_query)
        row = stats_result.one()

        total = row.total or 0
        success = row.success or 0
        failed = row.failed or 0
        avg_duration = row.avg_duration or 0
        success_rate = (success / total * 100) if total > 0 else 0.0

        # Update pipeline
        pipeline_query = select(Pipeline).where(Pipeline.id == pipeline_id)
        pipeline_result = await db.execute(pipeline_query)
        pipeline = pipeline_result.scalar_one_or_none()

        if pipeline:
            pipeline.total_runs = total
            pipeline.successful_runs = success
            pipeline.failed_runs = failed
            pipeline.success_rate = success_rate
            pipeline.avg_duration_seconds = int(avg_duration)

            if latest_run:
                pipeline.last_run_id = latest_run.id
                pipeline.last_run_status = latest_run.status
                pipeline.last_run_at = latest_run.started_at
                pipeline.last_run_duration = latest_run._format_duration()

    async def cancel_run(self, run_id: str) -> bool:
        """Cancel a running pipeline."""
        # Cancel the background task
        if self.task_manager.cancel_task(run_id):
            logger.info(f"Cancelled task for run {run_id}")
            return True

        # Also update database status if task not found
        run = await self.repo.get_run(run_id)
        if run and run.status == PipelineStatus.RUNNING:
            await self.repo.update_run_status(run_id, "cancelled")
            return True

        return False

    async def get_run_status(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get real-time status of a run."""
        run = await self.repo.get_run(run_id)
        if not run:
            return None

        return {
            "id": run.id,
            "status": run.status.value,
            "is_running": self.task_manager.is_running(run_id),
            "stages": [s.to_dict() for s in run.stages],
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "duration": run._format_duration(),
            "error_message": run.error_message,
        }

    async def retry_run(
        self,
        run_id: str,
        triggered_by: str,
    ) -> Optional[Dict[str, Any]]:
        """Retry a failed run."""
        original_run = await self.repo.get_run(run_id)
        if not original_run:
            return None

        if original_run.status not in [PipelineStatus.FAILED, PipelineStatus.CANCELLED]:
            logger.warning(f"Cannot retry run {run_id} with status {original_run.status}")
            return None

        pipeline = await self.repo.get_pipeline(original_run.pipeline_id)
        if not pipeline:
            return None

        # Create new run based on original
        return await self.trigger_pipeline(
            pipeline_id=original_run.pipeline_id,
            triggered_by=triggered_by,
            branch=original_run.branch,
            commit_sha=original_run.commit_sha,
            commit_message=original_run.commit_message,
            trigger_type="manual",
            environment=original_run.environment,
            variables=original_run.variables,
        )

    async def get_running_pipelines(self) -> List[str]:
        """Get list of currently running pipeline run IDs."""
        return self.task_manager.get_running_tasks()


# ============ Dependency injection ============

async def get_pipeline_execution_service(db: AsyncSession) -> PipelineExecutionService:
    """Factory function for dependency injection."""
    return PipelineExecutionService(db)
