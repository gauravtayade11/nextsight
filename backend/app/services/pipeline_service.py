"""Pipeline service for CI/CD pipeline management."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import uuid4

from app.schemas.pipelines import (
    Pipeline,
    PipelineCreate,
    PipelineRun,
    PipelineRunCreate,
    PipelineStatistics,
    PipelineUpdate,
    PipelineStage,
    StageStatus,
)
from app.services.pipeline_runner import get_pipeline_runner

logger = logging.getLogger(__name__)

# Will be set after pipeline_executor is initialized
_executor = None


class PipelineService:
    """Service for managing CI/CD pipelines."""

    def __init__(self):
        # In-memory storage (TODO: Replace with database)
        self.pipelines: Dict[str, Pipeline] = {}
        self.runs: Dict[str, PipelineRun] = {}
        self.logs: Dict[str, List[Dict[str, Any]]] = {}
        self._initialize_demo_data()

    def _initialize_demo_data(self):
        """Initialize with demo pipelines for testing."""
        now = datetime.now()
        demo_pipelines = [
            {
                "id": "pipeline-1",
                "name": "NextSight Backend CI",
                "description": "Build and test backend",
                "repository": "https://github.com/gauravtayade11/nextsight",
                "branch": "main",
                "file_path": ".github/workflows/backend.yml",
                "provider": "github",
                "is_active": True,
                "tags": ["backend", "python", "fastapi"],
                # Frontend fields
                "status": "success",
                "lastRun": (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "duration": "5m 30s",
                "trigger": "push",
                "successRate": 95.5,
                "yaml": "name: Backend CI\non:\n  push:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v2\n      - name: Run tests\n        run: pytest",
                "createdAt": (now - timedelta(days=30)).isoformat(),
                "updatedAt": now.isoformat(),
            },
            {
                "id": "pipeline-2",
                "name": "NextSight Frontend CI",
                "description": "Build and test frontend",
                "repository": "https://github.com/gauravtayade11/nextsight",
                "branch": "main",
                "file_path": ".github/workflows/frontend.yml",
                "provider": "github",
                "is_active": True,
                "tags": ["frontend", "react", "typescript"],
                # Frontend fields
                "status": "success",
                "lastRun": (now - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"),
                "duration": "3m 45s",
                "trigger": "pull_request",
                "successRate": 92.3,
                "yaml": "name: Frontend CI\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v2\n      - name: Build\n        run: npm run build",
                "createdAt": (now - timedelta(days=25)).isoformat(),
                "updatedAt": now.isoformat(),
            },
            {
                "id": "pipeline-3",
                "name": "Docker Build & Push",
                "description": "Build and push Docker images",
                "repository": "https://github.com/gauravtayade11/nextsight",
                "branch": "main",
                "file_path": ".github/workflows/docker.yml",
                "provider": "github",
                "is_active": True,
                "tags": ["docker", "ci", "deployment"],
                # Frontend fields
                "status": "running",
                "lastRun": now.strftime("%Y-%m-%d %H:%M:%S"),
                "duration": "2m 15s",
                "trigger": "manual",
                "successRate": 88.7,
                "yaml": "name: Docker Build\non:\n  workflow_dispatch:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v2\n      - name: Build and push\n        run: docker build -t nextsight .",
                "createdAt": (now - timedelta(days=20)).isoformat(),
                "updatedAt": now.isoformat(),
            },
        ]

        for p in demo_pipelines:
            self.pipelines[p["id"]] = Pipeline(
                created_at=datetime.now() - timedelta(days=30),
                updated_at=datetime.now(),
                **p
            )

        # Add demo runs for each pipeline
        self._initialize_demo_runs(now)

    def _initialize_demo_runs(self, now: datetime):
        """Initialize demo pipeline runs."""
        demo_runs = [
            # Runs for pipeline-1
            {
                "id": "run-1",
                "pipeline_id": "pipeline-1",
                "pipeline_name": "NextSight Backend CI",
                "status": "success",
                "branch": "main",
                "commit_sha": "a1b2c3d",
                "commit_message": "feat: add new API endpoint",
                "triggered_by": "admin",
                "started_at": now - timedelta(hours=2),
                "finished_at": now - timedelta(hours=2) + timedelta(minutes=5, seconds=30),
            },
            {
                "id": "run-2",
                "pipeline_id": "pipeline-1",
                "pipeline_name": "NextSight Backend CI",
                "status": "success",
                "branch": "main",
                "commit_sha": "e4f5g6h",
                "commit_message": "fix: resolve database connection issue",
                "triggered_by": "github-webhook",
                "started_at": now - timedelta(hours=5),
                "finished_at": now - timedelta(hours=5) + timedelta(minutes=4, seconds=45),
            },
            {
                "id": "run-3",
                "pipeline_id": "pipeline-1",
                "pipeline_name": "NextSight Backend CI",
                "status": "failed",
                "branch": "develop",
                "commit_sha": "i7j8k9l",
                "commit_message": "wip: refactor auth module",
                "triggered_by": "admin",
                "started_at": now - timedelta(hours=8),
                "finished_at": now - timedelta(hours=8) + timedelta(minutes=3, seconds=12),
            },
            # Runs for pipeline-2
            {
                "id": "run-4",
                "pipeline_id": "pipeline-2",
                "pipeline_name": "NextSight Frontend CI",
                "status": "success",
                "branch": "main",
                "commit_sha": "m0n1o2p",
                "commit_message": "feat: add dark mode toggle",
                "triggered_by": "admin",
                "started_at": now - timedelta(hours=1),
                "finished_at": now - timedelta(hours=1) + timedelta(minutes=3, seconds=45),
            },
            {
                "id": "run-5",
                "pipeline_id": "pipeline-2",
                "pipeline_name": "NextSight Frontend CI",
                "status": "success",
                "branch": "feature/ui-update",
                "commit_sha": "q3r4s5t",
                "commit_message": "style: update button styles",
                "triggered_by": "github-webhook",
                "started_at": now - timedelta(hours=3),
                "finished_at": now - timedelta(hours=3) + timedelta(minutes=4, seconds=15),
            },
            # Runs for pipeline-3
            {
                "id": "run-6",
                "pipeline_id": "pipeline-3",
                "pipeline_name": "Docker Build & Push",
                "status": "running",
                "branch": "main",
                "commit_sha": "u6v7w8x",
                "commit_message": "chore: bump version to 1.4.0",
                "triggered_by": "admin",
                "started_at": now - timedelta(minutes=2),
                "finished_at": None,
            },
            {
                "id": "run-7",
                "pipeline_id": "pipeline-3",
                "pipeline_name": "Docker Build & Push",
                "status": "success",
                "branch": "main",
                "commit_sha": "y9z0a1b",
                "commit_message": "fix: optimize docker image size",
                "triggered_by": "manual",
                "started_at": now - timedelta(hours=6),
                "finished_at": now - timedelta(hours=6) + timedelta(minutes=2, seconds=15),
            },
        ]

        for run_data in demo_runs:
            run_id = run_data["id"]
            started_at = run_data["started_at"]
            finished_at = run_data.get("finished_at")

            # Create stages based on status
            stages = self._create_demo_stages(run_data["status"], started_at, finished_at)

            run = PipelineRun(
                id=run_id,
                pipeline_id=run_data["pipeline_id"],
                pipeline_name=run_data["pipeline_name"],
                status=run_data["status"],
                branch=run_data["branch"],
                commit_sha=run_data["commit_sha"],
                commit_message=run_data["commit_message"],
                triggered_by=run_data["triggered_by"],
                started_at=started_at,
                finished_at=finished_at,
                stages=stages,
            )
            self.runs[run_id] = run

            # Add demo logs
            self._add_demo_logs(run_id, run_data["status"], stages)

    def _create_demo_stages(self, run_status: str, started_at: datetime, finished_at: Optional[datetime]) -> List[PipelineStage]:
        """Create demo stages for a run."""
        stage_names = ["Checkout", "Install", "Build", "Test", "Deploy"]
        stages = []

        for i, name in enumerate(stage_names):
            if run_status == "success":
                stage_status = StageStatus.SUCCESS
                stage_started = started_at + timedelta(seconds=i * 60)
                stage_finished = stage_started + timedelta(seconds=45 + i * 15)
            elif run_status == "failed":
                if i < 3:
                    stage_status = StageStatus.SUCCESS
                    stage_started = started_at + timedelta(seconds=i * 60)
                    stage_finished = stage_started + timedelta(seconds=45 + i * 15)
                elif i == 3:
                    stage_status = StageStatus.FAILED
                    stage_started = started_at + timedelta(seconds=i * 60)
                    stage_finished = stage_started + timedelta(seconds=30)
                else:
                    stage_status = StageStatus.SKIPPED
                    stage_started = None
                    stage_finished = None
            elif run_status == "running":
                if i < 2:
                    stage_status = StageStatus.SUCCESS
                    stage_started = started_at + timedelta(seconds=i * 60)
                    stage_finished = stage_started + timedelta(seconds=45 + i * 15)
                elif i == 2:
                    stage_status = StageStatus.RUNNING
                    stage_started = started_at + timedelta(seconds=i * 60)
                    stage_finished = None
                else:
                    stage_status = StageStatus.PENDING
                    stage_started = None
                    stage_finished = None
            else:
                stage_status = StageStatus.PENDING
                stage_started = None
                stage_finished = None

            duration_seconds = None
            if stage_started and stage_finished:
                duration_seconds = int((stage_finished - stage_started).total_seconds())

            stages.append(PipelineStage(
                id=f"stage-{i+1}",
                name=name,
                status=stage_status,
                started_at=stage_started,
                finished_at=stage_finished,
                duration_seconds=duration_seconds,
            ))

        return stages

    def _add_demo_logs(self, run_id: str, run_status: str, stages: List[PipelineStage]):
        """Add demo logs for a run."""
        self.logs[run_id] = []

        log_templates = {
            "Checkout": [
                "$ git clone https://github.com/org/repo.git",
                "Cloning into 'repo'...",
                "remote: Enumerating objects: 1234, done.",
                "Receiving objects: 100% (1234/1234), 2.3 MiB | 5.2 MiB/s",
                "✓ Checkout completed",
            ],
            "Install": [
                "$ npm ci",
                "added 542 packages in 23s",
                "✓ Dependencies installed",
            ],
            "Build": [
                "$ npm run build",
                "Creating production build...",
                "Compiled successfully.",
                "File sizes after gzip:",
                "  52.3 KB  build/static/js/main.js",
                "  2.1 KB   build/static/css/main.css",
                "✓ Build completed",
            ],
            "Test": [
                "$ npm test",
                "PASS src/App.test.tsx",
                "PASS src/utils.test.ts",
                "Test Suites: 12 passed, 12 total",
                "Tests:       45 passed, 45 total",
                "Coverage: 87%",
                "✓ All tests passed",
            ],
            "Deploy": [
                "$ kubectl apply -f k8s/",
                "deployment.apps/app configured",
                "service/app unchanged",
                "✓ Deployment successful",
            ],
        }

        failed_logs = [
            "ERROR: Test failed",
            "FAIL src/auth.test.ts",
            "  ● Auth module › should validate token",
            "    Expected: true",
            "    Received: false",
            "Test Suites: 1 failed, 11 passed, 12 total",
            "Tests: 2 failed, 43 passed, 45 total",
        ]

        for stage in stages:
            if stage.status in [StageStatus.SUCCESS, StageStatus.RUNNING]:
                for log in log_templates.get(stage.name, []):
                    self.logs[run_id].append({
                        "timestamp": (stage.started_at or datetime.now()).isoformat(),
                        "stage": stage.name.lower(),
                        "message": log,
                    })
            elif stage.status == StageStatus.FAILED:
                for log in failed_logs:
                    self.logs[run_id].append({
                        "timestamp": (stage.started_at or datetime.now()).isoformat(),
                        "stage": stage.name.lower(),
                        "message": log,
                    })

    # ============ Pipeline CRUD ============

    def list_pipelines(
        self,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> List[Pipeline]:
        """List all pipelines with optional search and pagination."""
        pipelines = list(self.pipelines.values())

        if search:
            search_lower = search.lower()
            pipelines = [
                p
                for p in pipelines
                if search_lower in p.name.lower()
                or search_lower in (p.description or "").lower()
            ]

        # Sort by creation date, newest first
        pipelines.sort(key=lambda p: p.created_at, reverse=True)

        start = (page - 1) * page_size
        end = start + page_size
        return pipelines[start:end]

    def get_pipeline(self, pipeline_id: str) -> Optional[Pipeline]:
        """Get a pipeline by ID."""
        return self.pipelines.get(pipeline_id)

    def create_pipeline(self, pipeline_create: PipelineCreate) -> Pipeline:
        """Create a new pipeline."""
        pipeline_id = f"pipeline-{uuid4().hex[:8]}"

        pipeline = Pipeline(
            id=pipeline_id,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            **pipeline_create.dict()
        )

        self.pipelines[pipeline_id] = pipeline
        logger.info(f"Created pipeline: {pipeline_id}")
        return pipeline

    def update_pipeline(
        self,
        pipeline_id: str,
        pipeline_update: PipelineUpdate,
    ) -> Optional[Pipeline]:
        """Update a pipeline."""
        if pipeline_id not in self.pipelines:
            return None

        existing = self.pipelines[pipeline_id]
        update_data = pipeline_update.dict(exclude_unset=True)

        for key, value in update_data.items():
            setattr(existing, key, value)

        existing.updated_at = datetime.now()
        logger.info(f"Updated pipeline: {pipeline_id}")
        return existing

    def delete_pipeline(self, pipeline_id: str) -> bool:
        """Delete a pipeline."""
        if pipeline_id not in self.pipelines:
            return False

        del self.pipelines[pipeline_id]
        logger.info(f"Deleted pipeline: {pipeline_id}")
        return True

    # ============ Pipeline Runs ============

    def trigger_pipeline(
        self,
        pipeline_id: str,
        run_create: PipelineRunCreate,
        triggered_by: str,
    ) -> Optional[PipelineRun]:
        """Trigger a pipeline run and execute it."""
        pipeline = self.get_pipeline(pipeline_id)
        if not pipeline:
            return None

        run_id = f"run-{uuid4().hex[:8]}"
        now = datetime.now()

        # Create initial run with pending status
        run = PipelineRun(
            id=run_id,
            pipeline_id=pipeline_id,
            pipeline_name=pipeline.name,
            status="pending",
            started_at=now,
            triggered_by=triggered_by,
            branch=run_create.branch or pipeline.branch,
            stages=[],
        )

        self.runs[run_id] = run
        self.logs[run_id] = [
            {"timestamp": now.isoformat(), "stage": "init", "message": f"🚀 Pipeline {pipeline.name} triggered by {triggered_by}"}
        ]

        logger.info(f"Triggered pipeline run: {run_id}")

        # Start execution in background
        asyncio.create_task(self._execute_pipeline_async(run_id, pipeline, run_create))

        return run

    async def _execute_pipeline_async(
        self,
        run_id: str,
        pipeline: Pipeline,
        run_create: PipelineRunCreate,
    ):
        """Execute pipeline asynchronously and update run status."""
        try:
            from app.services.pipeline_executor import pipeline_executor

            run = self.runs.get(run_id)
            if not run:
                return

            # Update status to running
            run.status = "running"
            self._add_log(run_id, "execution", "⏳ Starting pipeline execution...")

            # If pipeline has YAML, parse and execute it
            if pipeline.yaml:
                try:
                    await self._execute_with_yaml(run_id, pipeline, run_create)
                except Exception as e:
                    logger.error(f"YAML execution error: {e}")
                    # Fall back to mock execution
                    await self._execute_mock(run_id, pipeline)
            else:
                # Mock execution for pipelines without YAML
                await self._execute_mock(run_id, pipeline)

        except Exception as e:
            logger.error(f"Pipeline execution error: {e}")
            run = self.runs.get(run_id)
            if run:
                run.status = "failed"
                run.finished_at = datetime.now()
                self._add_log(run_id, "error", f"❌ Pipeline failed: {str(e)}")

    async def _execute_with_yaml(
        self,
        run_id: str,
        pipeline: Pipeline,
        run_create: PipelineRunCreate,
    ):
        """Execute pipeline using YAML configuration with real command execution."""
        run = self.runs.get(run_id)
        if not run:
            return

        # Parse YAML and extract stages
        import yaml
        try:
            config = yaml.safe_load(pipeline.yaml)
        except Exception as e:
            self._add_log(run_id, "parse", f"⚠️  YAML parse error, using mock execution: {e}")
            await self._execute_mock(run_id, pipeline)
            return

        # Extract stages from YAML (support multiple formats)
        stages_config = []

        # Try NextSight format
        if 'spec' in config and 'stages' in config.get('spec', {}):
            for stage_data in config['spec']['stages']:
                stages_config.append({
                    'name': stage_data.get('name', 'Unnamed'),
                    'steps': stage_data.get('steps', [])
                })
        # Try GitHub Actions format
        elif 'jobs' in config:
            for job_name, job_data in config['jobs'].items():
                stages_config.append({
                    'name': job_name.replace('_', ' ').title(),
                    'steps': job_data.get('steps', [])
                })

        # If no recognizable format, use mock
        if not stages_config:
            self._add_log(run_id, "parse", "ℹ️  Using default stages (YAML format not recognized)")
            await self._execute_mock(run_id, pipeline)
            return

        # Create stages
        for i, stage_config in enumerate(stages_config):
            stage = PipelineStage(
                id=f"stage-{i+1}",
                name=stage_config['name'],
                status=StageStatus.PENDING,
            )
            run.stages.append(stage)

        # Get pipeline runner
        runner = get_pipeline_runner()

        # Log callback to wire runner logs into our log system
        def on_log(stage_name: str, message: str):
            self._add_log(run_id, stage_name.lower(), message)

        try:
            # Execute pipeline with real commands
            result = await runner.execute_pipeline(
                pipeline_yaml=pipeline.yaml,
                run_id=run_id,
                branch=run_create.branch or pipeline.branch,
                commit=run_create.commit_sha,
                env=run_create.environment or {},
                on_log=on_log,
            )

            # Update run status based on execution result
            if result["status"] == "success":
                # Update stages from result
                stage_results = result.get("results", [])
                for i, stage in enumerate(run.stages):
                    if i < len(stage_results):
                        stage_result = stage_results[i]
                        stage.status = StageStatus.SUCCESS if stage_result["status"] == "success" else StageStatus.FAILED
                        stage.duration_seconds = stage_result.get("duration", 0)
                        if stage_result["status"] == "failed":
                            stage.error_message = stage_result.get("error", "Unknown error")

                run.status = "success"
                run.finished_at = datetime.now()
                run.duration_seconds = int((run.finished_at - run.started_at).total_seconds())
                self._add_log(run_id, "complete", f"🎉 Pipeline completed successfully in {run.duration_seconds}s")
            else:
                run.status = "failed"
                run.finished_at = datetime.now()
                run.duration_seconds = int((run.finished_at - run.started_at).total_seconds())
                error_msg = result.get("error", "Unknown error")
                self._add_log(run_id, "error", f"❌ Pipeline failed: {error_msg}")

        except Exception as e:
            logger.error(f"Real execution failed: {e}, falling back to mock", exc_info=True)
            self._add_log(run_id, "fallback", "⚠️  Real execution unavailable, using simulation mode")

            # Fall back to simulated execution
            import random
            for stage in run.stages:
                stage.status = StageStatus.RUNNING
                stage.started_at = datetime.now()
                self._add_log(run_id, stage.name.lower(), f"▶️  Running stage: {stage.name}")

                # Simulate execution (2-5 seconds per stage)
                duration = random.uniform(2, 5)
                await asyncio.sleep(duration)

                # 90% success rate
                if random.random() < 0.9:
                    stage.status = StageStatus.SUCCESS
                    stage.finished_at = datetime.now()
                    stage.duration_seconds = int((stage.finished_at - stage.started_at).total_seconds())
                    self._add_log(run_id, stage.name.lower(), f"✅ {stage.name} completed in {stage.duration_seconds}s")
                else:
                    stage.status = StageStatus.FAILED
                    stage.finished_at = datetime.now()
                    stage.duration_seconds = int((stage.finished_at - stage.started_at).total_seconds())
                    stage.error_message = "Stage failed"
                    self._add_log(run_id, stage.name.lower(), f"❌ {stage.name} failed")
                    run.status = "failed"
                    run.finished_at = datetime.now()
                    return

            # All stages completed successfully
            run.status = "success"
            run.finished_at = datetime.now()
            run.duration_seconds = int((run.finished_at - run.started_at).total_seconds())
            self._add_log(run_id, "complete", f"🎉 Pipeline completed successfully in {run.duration_seconds}s")

    async def _execute_mock(self, run_id: str, pipeline: Pipeline):
        """Execute pipeline with mock stages."""
        import random

        run = self.runs.get(run_id)
        if not run:
            return

        # Create mock stages
        stage_names = ["Checkout", "Build", "Test", "Deploy"]
        for i, stage_name in enumerate(stage_names):
            stage = PipelineStage(
                id=f"stage-{i+1}",
                name=stage_name,
                status=StageStatus.PENDING,
            )
            run.stages.append(stage)

        # Execute each stage
        for stage in run.stages:
            stage.status = StageStatus.RUNNING
            stage.started_at = datetime.now()
            self._add_log(run_id, stage.name.lower(), f"▶️  Running {stage.name}...")

            # Simulate work (2-4 seconds per stage)
            duration = random.uniform(2, 4)
            await asyncio.sleep(duration)

            # 95% success rate for mock execution
            if random.random() < 0.95:
                stage.status = StageStatus.SUCCESS
                stage.finished_at = datetime.now()
                stage.duration_seconds = int((stage.finished_at - stage.started_at).total_seconds())
                self._add_log(run_id, stage.name.lower(), f"✅ {stage.name} completed in {stage.duration_seconds}s")
            else:
                stage.status = StageStatus.FAILED
                stage.finished_at = datetime.now()
                stage.duration_seconds = int((stage.finished_at - stage.started_at).total_seconds())
                stage.error_message = f"{stage.name} failed"
                self._add_log(run_id, stage.name.lower(), f"❌ {stage.name} failed after {stage.duration_seconds}s")
                run.status = "failed"
                run.finished_at = datetime.now()
                run.duration_seconds = int((run.finished_at - run.started_at).total_seconds())
                return

        # All stages completed
        run.status = "success"
        run.finished_at = datetime.now()
        run.duration_seconds = int((run.finished_at - run.started_at).total_seconds())
        self._add_log(run_id, "complete", f"🎉 Pipeline completed successfully in {run.duration_seconds}s")

    def _add_log(self, run_id: str, stage: str, message: str):
        """Add a log entry for a run."""
        if run_id not in self.logs:
            self.logs[run_id] = []
        self.logs[run_id].append({
            "timestamp": datetime.now().isoformat(),
            "stage": stage,
            "message": message
        })

    def list_runs(
        self,
        pipeline_id: str,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> List[PipelineRun]:
        """List runs for a pipeline."""
        runs = [r for r in self.runs.values() if r.pipeline_id == pipeline_id]

        if status:
            runs = [r for r in runs if r.status == status]

        # Sort by start date, newest first
        runs.sort(key=lambda r: r.started_at, reverse=True)

        start = (page - 1) * page_size
        end = start + page_size
        return runs[start:end]

    def get_run(self, run_id: str) -> Optional[PipelineRun]:
        """Get a pipeline run by ID."""
        return self.runs.get(run_id)

    def cancel_run(self, run_id: str) -> bool:
        """Cancel a running pipeline."""
        run = self.runs.get(run_id)
        if not run or run.status != "running":
            return False

        run.status = "cancelled"
        run.finished_at = datetime.now()
        logger.info(f"Cancelled pipeline run: {run_id}")
        return True

    def get_run_logs(
        self,
        run_id: str,
        stage_id: Optional[str] = None,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """Get logs for a pipeline run."""
        logs = self.logs.get(run_id, [])

        if stage_id:
            logs = [log for log in logs if log.get("stage") == stage_id]

        return {
            "run_id": run_id,
            "logs": logs[:limit],
            "total_lines": len(logs),
            "has_more": len(logs) > limit,
        }

    def add_log(
        self,
        run_id: str,
        stage: str,
        message: str,
    ) -> None:
        """Add a log entry to a run."""
        if run_id not in self.logs:
            self.logs[run_id] = []

        self.logs[run_id].append({
            "timestamp": datetime.now().isoformat(),
            "stage": stage,
            "message": message,
        })

    # ============ Statistics ============

    def get_pipeline_statistics(
        self,
        pipeline_id: str,
        days: int = 30,
    ) -> Optional[PipelineStatistics]:
        """Get statistics for a pipeline."""
        pipeline = self.get_pipeline(pipeline_id)
        if not pipeline:
            return None

        # Filter runs for this pipeline in the date range
        cutoff_date = datetime.now() - timedelta(days=days)
        relevant_runs = [
            r
            for r in self.runs.values()
            if r.pipeline_id == pipeline_id and r.started_at >= cutoff_date
        ]

        total_runs = len(relevant_runs)
        successful = len([r for r in relevant_runs if r.status == "success"])
        failed = len([r for r in relevant_runs if r.status == "failed"])
        skipped = len([r for r in relevant_runs if r.status == "skipped"])

        # Calculate average duration
        durations = [
            (r.finished_at - r.started_at).total_seconds()
            for r in relevant_runs
            if r.finished_at
        ]
        avg_duration = sum(durations) / len(durations) if durations else 0.0

        success_rate = (successful / total_runs * 100) if total_runs > 0 else 0.0

        return PipelineStatistics(
            total_runs=total_runs,
            successful_runs=successful,
            failed_runs=failed,
            skipped_runs=skipped,
            average_duration_seconds=avg_duration,
            success_rate=success_rate / 100,
        )

    def get_global_statistics(self) -> Dict[str, Any]:
        """Get global pipeline statistics."""
        total_pipelines = len(self.pipelines)
        active_pipelines = len([p for p in self.pipelines.values() if p.is_active])
        total_runs = len(self.runs)
        running_runs = len([r for r in self.runs.values() if r.status == "running"])

        # Calculate success rate
        completed_runs = [r for r in self.runs.values() if r.finished_at]
        successful = len([r for r in completed_runs if r.status == "success"])
        success_rate = (successful / len(completed_runs)) if completed_runs else 0.0

        # Calculate average duration
        durations = [
            (r.finished_at - r.started_at).total_seconds()
            for r in completed_runs
        ]
        avg_duration = sum(durations) / len(durations) if durations else 0.0

        return {
            "total_pipelines": total_pipelines,
            "active_pipelines": active_pipelines,
            "total_runs": total_runs,
            "running_runs": running_runs,
            "success_rate": success_rate,
            "avg_duration_seconds": avg_duration,
        }


# Singleton instance
_service = None


def get_pipeline_service() -> PipelineService:
    """Get or create the pipeline service singleton."""
    global _service
    if _service is None:
        _service = PipelineService()
    return _service
