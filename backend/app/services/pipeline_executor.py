# =============================================================================
# Pipeline Executor Service - Execute pipelines via Kubernetes Jobs
# =============================================================================
import asyncio
import uuid
import yaml
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, AsyncGenerator, Callable
from enum import Enum
from pydantic import BaseModel


def utc_now() -> datetime:
    """Return timezone-aware UTC datetime"""
    return datetime.now(timezone.utc)

from kubernetes import client, config, watch
from kubernetes.client.rest import ApiException

logger = logging.getLogger(__name__)


class StageStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class TestResult(BaseModel):
    """Test execution result"""
    name: str
    classname: str
    time: float = 0.0
    status: str = "passed"  # passed, failed, skipped, error
    failure_message: Optional[str] = None
    failure_type: Optional[str] = None


class TestSummary(BaseModel):
    """Summary of test results"""
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    errors: int = 0
    time: float = 0.0
    tests: List[TestResult] = []
    coverage_percent: Optional[float] = None


class PipelineStage(BaseModel):
    name: str
    image: str = "alpine:latest"
    commands: List[str] = []
    env: Dict[str, str] = {}
    depends_on: List[str] = []
    timeout: int = 600  # 10 minutes default
    allow_failure: bool = False


class PipelineConfig(BaseModel):
    name: str
    stages: List[PipelineStage]
    env: Dict[str, str] = {}
    clone_repo: bool = True
    repo_url: Optional[str] = None
    branch: str = "main"


class StageResult(BaseModel):
    name: str
    status: StageStatus
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    logs: str = ""
    exit_code: Optional[int] = None
    test_summary: Optional[TestSummary] = None


class PipelineRunResult(BaseModel):
    run_id: str
    pipeline_name: str
    status: StageStatus
    started_at: datetime
    finished_at: Optional[datetime] = None
    stages: List[StageResult] = []
    trigger: str = "manual"
    branch: str = "main"
    commit: Optional[str] = None
    test_summary: Optional[TestSummary] = None


class PipelineExecutor:
    """Execute pipeline stages as Kubernetes Jobs with shared workspace"""

    NAMESPACE = "nextsight-pipelines"
    JOB_TTL = 3600  # Keep completed jobs for 1 hour
    PVC_SIZE = "5Gi"
    LOG_POLL_INTERVAL = 2  # seconds

    def __init__(self):
        self._k8s_configured = False
        self.batch_v1 = None
        self.core_v1 = None
        self._log_callbacks: Dict[str, List[Callable]] = {}

    def _ensure_k8s_config(self):
        """Initialize Kubernetes client"""
        if self._k8s_configured:
            return

        try:
            # Try in-cluster config first
            config.load_incluster_config()
        except config.ConfigException:
            # Fall back to kubeconfig
            try:
                config.load_kube_config()
            except config.ConfigException as e:
                logger.warning(f"Could not configure Kubernetes client: {e}")
                return

        self.batch_v1 = client.BatchV1Api()
        self.core_v1 = client.CoreV1Api()
        self._k8s_configured = True

    async def ensure_namespace(self):
        """Ensure pipeline namespace exists"""
        self._ensure_k8s_config()
        if not self.core_v1:
            return

        try:
            await asyncio.to_thread(
                self.core_v1.read_namespace,
                self.NAMESPACE
            )
        except ApiException as e:
            if e.status == 404:
                namespace = client.V1Namespace(
                    metadata=client.V1ObjectMeta(
                        name=self.NAMESPACE,
                        labels={"app": "nextsight", "component": "pipelines"}
                    )
                )
                await asyncio.to_thread(
                    self.core_v1.create_namespace,
                    namespace
                )
                logger.info(f"Created namespace: {self.NAMESPACE}")

    async def _create_workspace_pvc(self, run_id: str) -> str:
        """Create a shared PVC for all stages in a pipeline run"""
        self._ensure_k8s_config()
        if not self.core_v1:
            raise Exception("Kubernetes not configured")

        pvc_name = f"pipeline-workspace-{run_id[:8]}"

        pvc = client.V1PersistentVolumeClaim(
            api_version="v1",
            kind="PersistentVolumeClaim",
            metadata=client.V1ObjectMeta(
                name=pvc_name,
                namespace=self.NAMESPACE,
                labels={
                    "app": "nextsight",
                    "component": "pipeline-workspace",
                    "run-id": run_id
                }
            ),
            spec=client.V1PersistentVolumeClaimSpec(
                access_modes=["ReadWriteOnce"],
                resources=client.V1ResourceRequirements(
                    requests={"storage": self.PVC_SIZE}
                )
            )
        )

        try:
            await asyncio.to_thread(
                self.core_v1.create_namespaced_persistent_volume_claim,
                self.NAMESPACE,
                pvc
            )
            logger.info(f"Created workspace PVC: {pvc_name}")
        except ApiException as e:
            if e.status == 409:  # Already exists
                logger.info(f"Workspace PVC already exists: {pvc_name}")
            else:
                raise

        return pvc_name

    async def _delete_workspace_pvc(self, pvc_name: str):
        """Delete workspace PVC after pipeline completes"""
        self._ensure_k8s_config()
        if not self.core_v1:
            return

        try:
            await asyncio.to_thread(
                self.core_v1.delete_namespaced_persistent_volume_claim,
                pvc_name,
                self.NAMESPACE
            )
            logger.info(f"Deleted workspace PVC: {pvc_name}")
        except ApiException as e:
            if e.status != 404:
                logger.warning(f"Failed to delete PVC {pvc_name}: {e}")

    def parse_pipeline_yaml(self, yaml_content: str) -> PipelineConfig:
        """Parse pipeline YAML configuration"""
        data = yaml.safe_load(yaml_content)

        stages = []
        for stage_data in data.get("stages", []):
            stage = PipelineStage(
                name=stage_data.get("name", "unnamed"),
                image=stage_data.get("image", "alpine:latest"),
                commands=stage_data.get("commands", stage_data.get("script", [])),
                env=stage_data.get("env", {}),
                depends_on=stage_data.get("depends_on", []),
                timeout=stage_data.get("timeout", 600),
                allow_failure=stage_data.get("allow_failure", False)
            )
            stages.append(stage)

        return PipelineConfig(
            name=data.get("name", "pipeline"),
            stages=stages,
            env=data.get("env", {}),
            clone_repo=data.get("clone_repo", True),
            repo_url=data.get("repo_url"),
            branch=data.get("branch", "main")
        )

    def _create_job_spec(
        self,
        full_run_id: str,
        short_run_id: str,
        stage: PipelineStage,
        pipeline_config: PipelineConfig,
        pvc_name: str,
        is_first_stage: bool = False,
        commit: Optional[str] = None
    ) -> client.V1Job:
        """Create Kubernetes Job specification for a stage with shared workspace"""
        # Sanitize stage name for K8s
        safe_stage_name = re.sub(r'[^a-z0-9-]', '-', stage.name.lower())[:20]
        job_name = f"pipeline-{short_run_id}-{safe_stage_name}"[:63]

        # Build environment variables
        env_vars = [
            client.V1EnvVar(name="NEXTSIGHT_RUN_ID", value=full_run_id),
            client.V1EnvVar(name="NEXTSIGHT_STAGE", value=stage.name),
            client.V1EnvVar(name="NEXTSIGHT_PIPELINE", value=pipeline_config.name),
            client.V1EnvVar(name="NEXTSIGHT_BRANCH", value=pipeline_config.branch),
        ]

        if commit:
            env_vars.append(client.V1EnvVar(name="NEXTSIGHT_COMMIT", value=commit))

        # Add pipeline-level env vars
        for key, value in pipeline_config.env.items():
            env_vars.append(client.V1EnvVar(name=key, value=str(value)))

        # Add stage-level env vars
        for key, value in stage.env.items():
            env_vars.append(client.V1EnvVar(name=key, value=str(value)))

        # Build command script
        script = "#!/bin/sh\nset -e\n"
        script += "cd /workspace\n"

        # Only clone on first stage
        if is_first_stage and pipeline_config.clone_repo and pipeline_config.repo_url:
            script += f"""
echo "=== Cloning repository ==="
if [ ! -d ".git" ]; then
    # Clone to temp and move contents
    git clone --branch {pipeline_config.branch} --single-branch {pipeline_config.repo_url} /tmp/repo 2>&1 || {{
        echo "Branch {pipeline_config.branch} not found, cloning default branch..."
        git clone {pipeline_config.repo_url} /tmp/repo
        cd /tmp/repo
        git checkout {pipeline_config.branch} 2>/dev/null || git checkout master 2>/dev/null || git checkout main 2>/dev/null || true
    }}
    cp -r /tmp/repo/. /workspace/
    rm -rf /tmp/repo
    cd /workspace
fi
"""
            if commit:
                script += f"git checkout {commit} 2>/dev/null || echo 'Commit {commit} not found, using current branch'\n"

        script += f"\necho '=== Running stage: {stage.name} ==='\n"
        for cmd in stage.commands:
            script += f"{cmd}\n"

        # Volume mount for shared workspace
        volume_mounts = [
            client.V1VolumeMount(
                name="workspace",
                mount_path="/workspace"
            )
        ]

        # Add Maven cache volume for faster builds
        if "maven" in stage.image.lower():
            volume_mounts.append(
                client.V1VolumeMount(
                    name="maven-cache",
                    mount_path="/root/.m2"
                )
            )

        container = client.V1Container(
            name="stage",
            image=stage.image,
            command=["/bin/sh", "-c", script],
            env=env_vars,
            resources=client.V1ResourceRequirements(
                requests={"cpu": "500m", "memory": "1Gi"},
                limits={"cpu": "2", "memory": "4Gi"}
            ),
            working_dir="/workspace",
            volume_mounts=volume_mounts
        )

        # Volumes
        volumes = [
            client.V1Volume(
                name="workspace",
                persistent_volume_claim=client.V1PersistentVolumeClaimVolumeSource(
                    claim_name=pvc_name
                )
            )
        ]

        # Add Maven cache as emptyDir (shared within node)
        if "maven" in stage.image.lower():
            volumes.append(
                client.V1Volume(
                    name="maven-cache",
                    empty_dir=client.V1EmptyDirVolumeSource()
                )
            )

        job = client.V1Job(
            api_version="batch/v1",
            kind="Job",
            metadata=client.V1ObjectMeta(
                name=job_name,
                namespace=self.NAMESPACE,
                labels={
                    "app": "nextsight",
                    "component": "pipeline",
                    "pipeline": pipeline_config.name[:63],
                    "run-id": full_run_id,
                    "stage": safe_stage_name
                }
            ),
            spec=client.V1JobSpec(
                template=client.V1PodTemplateSpec(
                    metadata=client.V1ObjectMeta(
                        labels={
                            "app": "nextsight",
                            "component": "pipeline-stage",
                            "run-id": full_run_id,
                            "stage": safe_stage_name
                        }
                    ),
                    spec=client.V1PodSpec(
                        containers=[container],
                        volumes=volumes,
                        restart_policy="Never"
                    )
                ),
                backoff_limit=0,
                ttl_seconds_after_finished=self.JOB_TTL,
                active_deadline_seconds=stage.timeout
            )
        )

        return job

    async def _stream_pod_logs(
        self,
        pod_name: str,
        run_id: str,
        stage_name: str,
        log_callback: Optional[Callable] = None
    ) -> str:
        """Stream logs from a pod in real-time"""
        self._ensure_k8s_config()
        if not self.core_v1:
            return ""

        all_logs = []

        try:
            # Wait for pod to be running
            for _ in range(30):  # 30 second timeout
                try:
                    pod = await asyncio.to_thread(
                        self.core_v1.read_namespaced_pod,
                        pod_name,
                        self.NAMESPACE
                    )
                    if pod.status.phase in ["Running", "Succeeded", "Failed"]:
                        break
                except ApiException:
                    pass
                await asyncio.sleep(1)

            # Stream logs using follow
            w = watch.Watch()

            # Use sync API with watch in a thread
            def watch_logs():
                logs = []
                try:
                    for line in w.stream(
                        self.core_v1.read_namespaced_pod_log,
                        name=pod_name,
                        namespace=self.NAMESPACE,
                        follow=True,
                        timestamps=True,
                        _request_timeout=600
                    ):
                        logs.append(line)
                        if log_callback:
                            # Extract timestamp and message
                            parts = line.split(" ", 1)
                            message = parts[1] if len(parts) > 1 else line
                            try:
                                asyncio.get_event_loop().call_soon_threadsafe(
                                    lambda m=message: asyncio.create_task(
                                        self._safe_callback(log_callback, run_id, stage_name, m)
                                    )
                                )
                            except RuntimeError:
                                pass  # Event loop closed
                except ApiException as e:
                    if e.status != 404:
                        logger.warning(f"Error streaming logs: {e}")
                finally:
                    w.stop()
                return logs

            all_logs = await asyncio.to_thread(watch_logs)

        except Exception as e:
            logger.warning(f"Failed to stream logs from pod {pod_name}: {e}")
            # Fallback: get all logs at once
            try:
                logs = await asyncio.to_thread(
                    self.core_v1.read_namespaced_pod_log,
                    pod_name,
                    self.NAMESPACE,
                    timestamps=True
                )
                all_logs = logs.split("\n") if logs else []
            except ApiException:
                pass

        return "\n".join(all_logs)

    async def _safe_callback(self, callback: Callable, run_id: str, stage_name: str, message: str):
        """Safely invoke log callback"""
        try:
            if asyncio.iscoroutinefunction(callback):
                await callback(run_id, stage_name, message)
            else:
                callback(run_id, stage_name, message)
        except Exception as e:
            logger.warning(f"Log callback error: {e}")

    async def run_stage(
        self,
        full_run_id: str,
        short_run_id: str,
        stage: PipelineStage,
        pipeline_config: PipelineConfig,
        pvc_name: str,
        is_first_stage: bool = False,
        commit: Optional[str] = None,
        log_callback: Optional[Callable] = None
    ) -> StageResult:
        """Execute a single pipeline stage with real-time log streaming"""
        self._ensure_k8s_config()

        result = StageResult(
            name=stage.name,
            status=StageStatus.RUNNING,
            started_at=utc_now()
        )

        if not self.batch_v1:
            # Mock execution for development without K8s
            logger.info(f"[MOCK] Running stage: {stage.name}")
            await asyncio.sleep(2)
            result.status = StageStatus.SUCCESS
            result.finished_at = utc_now()
            result.duration_seconds = 2.0
            result.logs = f"[MOCK] Stage {stage.name} completed successfully\n"
            result.exit_code = 0
            return result

        try:
            job = self._create_job_spec(
                full_run_id, short_run_id, stage, pipeline_config,
                pvc_name, is_first_stage, commit
            )

            # Create the job
            await asyncio.to_thread(
                self.batch_v1.create_namespaced_job,
                self.NAMESPACE,
                job
            )
            job_name = job.metadata.name
            logger.info(f"Created job: {job_name}")

            # Notify log callback that stage started
            if log_callback:
                await self._safe_callback(
                    log_callback, full_run_id, stage.name,
                    f"▶️ Starting stage: {stage.name}"
                )

            # Wait for pod to be created and get its name
            pod_name = None
            for _ in range(30):
                pods = await asyncio.to_thread(
                    self.core_v1.list_namespaced_pod,
                    self.NAMESPACE,
                    label_selector=f"job-name={job_name}"
                )
                if pods.items:
                    pod_name = pods.items[0].metadata.name
                    break
                await asyncio.sleep(1)

            if pod_name:
                # Stream logs in real-time
                result.logs = await self._stream_pod_logs(
                    pod_name, full_run_id, stage.name, log_callback
                )

            # Wait for job completion
            while True:
                await asyncio.sleep(2)

                job_status = await asyncio.to_thread(
                    self.batch_v1.read_namespaced_job_status,
                    job_name,
                    self.NAMESPACE
                )

                if job_status.status.succeeded:
                    result.status = StageStatus.SUCCESS
                    result.exit_code = 0
                    break
                elif job_status.status.failed:
                    result.status = StageStatus.FAILED
                    result.exit_code = 1
                    break

            # Get final logs if streaming failed
            if not result.logs and pod_name:
                result.logs = await self._get_pod_logs(pod_name)

            # Parse test results if this is a test stage
            if "test" in stage.name.lower():
                result.test_summary = await self._parse_test_results(pvc_name)

        except ApiException as e:
            logger.error(f"Failed to run stage {stage.name}: {e}")
            result.status = StageStatus.FAILED
            result.logs = f"Error: {e.reason}"
            result.exit_code = 1

        result.finished_at = utc_now()
        if result.started_at:
            result.duration_seconds = (result.finished_at - result.started_at).total_seconds()

        # Notify completion
        if log_callback:
            status_emoji = "✅" if result.status == StageStatus.SUCCESS else "❌"
            await self._safe_callback(
                log_callback, full_run_id, stage.name,
                f"{status_emoji} Stage '{stage.name}' {result.status.value}"
            )

        return result

    async def _get_pod_logs(self, pod_name: str) -> str:
        """Get logs from a pod (fallback method)"""
        if not self.core_v1:
            return ""

        try:
            logs = await asyncio.to_thread(
                self.core_v1.read_namespaced_pod_log,
                pod_name,
                self.NAMESPACE,
                timestamps=True,
                tail_lines=1000
            )
            return logs or ""
        except ApiException as e:
            logger.warning(f"Failed to get logs from pod {pod_name}: {e}")
            return ""

    async def _parse_test_results(self, pvc_name: str) -> Optional[TestSummary]:
        """Parse JUnit XML test results from workspace"""
        # This would need a helper pod to read from PVC
        # For now, return None - test results parsing can be done
        # by parsing the logs for Maven Surefire output
        return None

    def parse_maven_test_output(self, logs: str) -> TestSummary:
        """Parse Maven Surefire test output from logs"""
        summary = TestSummary()

        # Parse "Tests run: X, Failures: Y, Errors: Z, Skipped: W"
        pattern = r"Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)"
        matches = re.findall(pattern, logs)

        for match in matches:
            summary.total += int(match[0])
            summary.failed += int(match[1])
            summary.errors += int(match[2])
            summary.skipped += int(match[3])

        summary.passed = summary.total - summary.failed - summary.errors - summary.skipped

        # Parse individual test results
        test_pattern = r"\[INFO\] Running ([\w.]+)"
        test_names = re.findall(test_pattern, logs)

        for test_name in test_names:
            parts = test_name.rsplit(".", 1)
            classname = parts[0] if len(parts) > 1 else ""
            name = parts[-1]

            # Determine if test passed or failed
            status = "passed"
            if f"{test_name}" in logs and "FAILURE" in logs[logs.find(test_name):logs.find(test_name)+500]:
                status = "failed"

            summary.tests.append(TestResult(
                name=name,
                classname=classname,
                status=status
            ))

        return summary

    async def execute_pipeline(
        self,
        pipeline_yaml: str,
        trigger: str = "manual",
        branch: str = "main",
        commit: Optional[str] = None,
        run_id: Optional[str] = None,
        log_callback: Optional[Callable] = None
    ) -> AsyncGenerator[PipelineRunResult, None]:
        """Execute full pipeline with shared workspace and real-time logging"""

        full_run_id = run_id if run_id else str(uuid.uuid4())
        short_run_id = full_run_id.replace("-", "")[:8]

        config = self.parse_pipeline_yaml(pipeline_yaml)
        config.branch = branch

        result = PipelineRunResult(
            run_id=full_run_id,
            pipeline_name=config.name,
            status=StageStatus.RUNNING,
            started_at=utc_now(),
            trigger=trigger,
            branch=branch,
            commit=commit
        )

        yield result

        # Create shared workspace PVC
        pvc_name = None
        try:
            if self.core_v1:
                pvc_name = await self._create_workspace_pvc(full_run_id)
                if log_callback:
                    await self._safe_callback(
                        log_callback, full_run_id, "",
                        f"📁 Created shared workspace: {pvc_name}"
                    )
        except Exception as e:
            logger.warning(f"Failed to create PVC, stages will clone separately: {e}")

        # Build dependency graph and execute stages
        completed_stages = set()
        failed = False
        all_test_results = TestSummary()

        for i, stage in enumerate(config.stages):
            is_first_stage = (i == 0)

            # Check dependencies
            if stage.depends_on:
                deps_met = all(dep in completed_stages for dep in stage.depends_on)
                if not deps_met and failed:
                    stage_result = StageResult(
                        name=stage.name,
                        status=StageStatus.SKIPPED,
                        logs="Skipped due to failed dependency"
                    )
                    result.stages.append(stage_result)
                    yield result
                    continue

            # Execute stage with real-time logging
            stage_result = await self.run_stage(
                full_run_id, short_run_id, stage, config,
                pvc_name or f"no-pvc-{short_run_id}",
                is_first_stage, commit, log_callback
            )
            result.stages.append(stage_result)

            # Aggregate test results
            if stage_result.test_summary:
                all_test_results.total += stage_result.test_summary.total
                all_test_results.passed += stage_result.test_summary.passed
                all_test_results.failed += stage_result.test_summary.failed
                all_test_results.errors += stage_result.test_summary.errors
                all_test_results.skipped += stage_result.test_summary.skipped
                all_test_results.tests.extend(stage_result.test_summary.tests)

            if stage_result.status == StageStatus.SUCCESS:
                completed_stages.add(stage.name)
            elif not stage.allow_failure:
                failed = True

            yield result

        # Final status
        result.finished_at = utc_now()
        if failed:
            result.status = StageStatus.FAILED
        elif all(s.status in [StageStatus.SUCCESS, StageStatus.SKIPPED] for s in result.stages):
            result.status = StageStatus.SUCCESS
        else:
            result.status = StageStatus.FAILED

        # Add test summary to result
        if all_test_results.total > 0:
            result.test_summary = all_test_results

        # Cleanup workspace PVC (keep for debugging if failed)
        if pvc_name and result.status == StageStatus.SUCCESS:
            try:
                await self._delete_workspace_pvc(pvc_name)
            except Exception as e:
                logger.warning(f"Failed to cleanup PVC: {e}")

        yield result

    async def cancel_run(self, run_id: str) -> bool:
        """Cancel a running pipeline"""
        self._ensure_k8s_config()
        if not self.batch_v1:
            return False

        try:
            jobs = await asyncio.to_thread(
                self.batch_v1.list_namespaced_job,
                self.NAMESPACE,
                label_selector=f"run-id={run_id}"
            )

            for job in jobs.items:
                await asyncio.to_thread(
                    self.batch_v1.delete_namespaced_job,
                    job.metadata.name,
                    self.NAMESPACE,
                    propagation_policy="Background"
                )

            return True
        except ApiException as e:
            logger.error(f"Failed to cancel run {run_id}: {e}")
            return False

    async def get_run_logs(self, run_id: str, stage: Optional[str] = None) -> str:
        """Get logs for a pipeline run"""
        self._ensure_k8s_config()
        if not self.core_v1:
            return "[Mock] Pipeline logs not available without Kubernetes"

        try:
            selector = f"run-id={run_id}"
            if stage:
                selector += f",stage={stage}"

            pods = await asyncio.to_thread(
                self.core_v1.list_namespaced_pod,
                self.NAMESPACE,
                label_selector=selector
            )

            logs = []
            for pod in pods.items:
                try:
                    pod_logs = await asyncio.to_thread(
                        self.core_v1.read_namespaced_pod_log,
                        pod.metadata.name,
                        self.NAMESPACE,
                        timestamps=True
                    )
                    stage_label = pod.metadata.labels.get('stage', 'unknown')
                    logs.append(f"=== {stage_label} ===\n{pod_logs}")
                except ApiException:
                    pass

            return "\n\n".join(logs) if logs else "No logs available"
        except ApiException:
            return "Error fetching logs"


# Singleton instance
pipeline_executor = PipelineExecutor()
