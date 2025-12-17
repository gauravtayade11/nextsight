"""Agent runner service for remote pipeline execution on VM agents."""

import asyncio
import logging
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

import httpx

from app.models.pipeline import AgentStatus, PipelineAgent
from app.schemas.agent import AgentJobRequest, AgentJobUpdate

logger = logging.getLogger(__name__)


class AgentRunnerError(Exception):
    """Custom exception for agent runner errors."""
    pass


class AgentRunner:
    """
    Handles pipeline execution on remote VM agents.

    Communication modes:
    1. HTTP API - Agent runs an HTTP server, we send jobs via REST API
    2. SSH - Direct SSH connection to execute commands (fallback)
    """

    def __init__(
        self,
        agent: PipelineAgent,
        log_callback: Optional[Callable[[str, str], None]] = None,
        status_callback: Optional[Callable[[str, str, Optional[str]], None]] = None,
    ):
        """
        Initialize agent runner.

        Args:
            agent: The agent to run jobs on
            log_callback: Callback for log messages (message, level)
            status_callback: Callback for status updates (status, stage_name, error_message)
        """
        self.agent = agent
        self.log_callback = log_callback
        self.status_callback = status_callback
        self.base_url = f"http://{agent.host}:{agent.port}"
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        """Async context manager entry."""
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(30.0, connect=10.0),
            headers={"X-Agent-API-Key": self.agent.api_key or ""},
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()

    def _log(self, message: str, level: str = "info"):
        """Send log message via callback."""
        if self.log_callback:
            self.log_callback(message, level)
        logger.log(
            getattr(logging, level.upper(), logging.INFO),
            f"[Agent:{self.agent.name}] {message}"
        )

    def _update_status(
        self,
        status: str,
        stage_name: Optional[str] = None,
        error_message: Optional[str] = None,
    ):
        """Update status via callback."""
        if self.status_callback:
            self.status_callback(status, stage_name, error_message)

    # ============ Health Check ============

    async def check_health(self) -> bool:
        """Check if agent is healthy and reachable."""
        try:
            if not self._client:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{self.base_url}/health")
                    return response.status_code == 200
            else:
                response = await self._client.get("/health")
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"Agent {self.agent.name} health check failed: {e}")
            return False

    async def get_agent_info(self) -> Optional[Dict[str, Any]]:
        """Get agent system information."""
        try:
            if not self._client:
                return None
            response = await self._client.get("/info")
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Failed to get agent info: {e}")
            return None

    # ============ Job Execution ============

    async def submit_job(self, job_request: AgentJobRequest) -> Dict[str, Any]:
        """
        Submit a job to the agent for execution.

        Args:
            job_request: Job request with pipeline details

        Returns:
            Job submission response from agent
        """
        if not self._client:
            raise AgentRunnerError("Client not initialized. Use async context manager.")

        self._log(f"Submitting job {job_request.run_id} to agent")

        try:
            response = await self._client.post(
                "/api/v1/jobs",
                json=job_request.dict(),
            )

            if response.status_code == 202:
                result = response.json()
                self._log(f"Job submitted successfully: {result.get('message', 'Accepted')}")
                return result
            else:
                error_msg = response.text
                self._log(f"Job submission failed: {error_msg}", "error")
                raise AgentRunnerError(f"Job submission failed: {error_msg}")

        except httpx.RequestError as e:
            self._log(f"Connection error: {e}", "error")
            raise AgentRunnerError(f"Failed to connect to agent: {e}")

    async def cancel_job(self, run_id: str) -> bool:
        """Cancel a running job on the agent."""
        if not self._client:
            raise AgentRunnerError("Client not initialized")

        try:
            response = await self._client.delete(f"/api/v1/jobs/{run_id}")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to cancel job on agent: {e}")
            return False

    async def get_job_status(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a job running on the agent."""
        if not self._client:
            return None

        try:
            response = await self._client.get(f"/api/v1/jobs/{run_id}/status")
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"Failed to get job status: {e}")
            return None

    async def get_job_logs(
        self,
        run_id: str,
        since: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get logs for a job running on the agent."""
        if not self._client:
            return []

        try:
            params = {"limit": limit}
            if since:
                params["since"] = since.isoformat()

            response = await self._client.get(
                f"/api/v1/jobs/{run_id}/logs",
                params=params,
            )
            if response.status_code == 200:
                return response.json().get("logs", [])
            return []
        except Exception as e:
            logger.error(f"Failed to get job logs: {e}")
            return []

    # ============ Polling for Updates ============

    async def poll_job_status(
        self,
        run_id: str,
        interval_seconds: float = 2.0,
        timeout_seconds: float = 3600.0,
    ) -> str:
        """
        Poll for job completion status.

        Args:
            run_id: The run ID to poll
            interval_seconds: Polling interval
            timeout_seconds: Maximum time to wait

        Returns:
            Final job status (success, failed, cancelled)
        """
        start_time = asyncio.get_event_loop().time()
        last_log_count = 0

        while True:
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > timeout_seconds:
                self._log("Job execution timed out", "error")
                raise AgentRunnerError("Job execution timed out")

            # Get status
            status_data = await self.get_job_status(run_id)
            if not status_data:
                await asyncio.sleep(interval_seconds)
                continue

            status = status_data.get("status", "unknown")
            stage_name = status_data.get("current_stage")

            # Update callbacks
            self._update_status(status, stage_name)

            # Get new logs
            logs = await self.get_job_logs(run_id)
            if len(logs) > last_log_count:
                for log in logs[last_log_count:]:
                    self._log(log.get("message", ""), log.get("level", "info"))
                last_log_count = len(logs)

            # Check if completed
            if status in ("success", "failed", "cancelled"):
                if status == "failed":
                    error_msg = status_data.get("error_message", "Unknown error")
                    self._update_status(status, stage_name, error_msg)
                return status

            await asyncio.sleep(interval_seconds)

    # ============ SSH Fallback Execution ============

    async def execute_via_ssh(
        self,
        job_request: AgentJobRequest,
    ) -> str:
        """
        Execute job via SSH (fallback when agent API not available).

        This creates a workspace on the remote VM, clones the repo,
        and executes the pipeline stages.
        """
        if not self.agent.ssh_user:
            raise AgentRunnerError("SSH user not configured for agent")

        import asyncssh

        self._log("Connecting via SSH...")

        try:
            # Connect to agent via SSH
            async with asyncssh.connect(
                self.agent.host,
                username=self.agent.ssh_user,
                known_hosts=None,  # In production, use proper host key verification
            ) as conn:
                workspace = f"{self.agent.workspace_path}/{job_request.run_id}"

                # Create workspace
                await conn.run(f"mkdir -p {workspace}")
                self._log(f"Created workspace: {workspace}")

                # Clone repository if specified
                if job_request.repository:
                    self._log(f"Cloning repository: {job_request.repository}")
                    clone_cmd = f"cd {workspace} && git clone --branch {job_request.branch} --depth 1 {job_request.repository} ."
                    result = await conn.run(clone_cmd)
                    if result.exit_status != 0:
                        raise AgentRunnerError(f"Git clone failed: {result.stderr}")

                # Parse and execute stages from YAML
                import yaml
                config = yaml.safe_load(job_request.yaml_config)
                stages = config.get("stages", [])

                for stage in stages:
                    stage_name = stage.get("name", "unnamed")
                    self._update_status("running", stage_name)
                    self._log(f"Executing stage: {stage_name}")

                    for step in stage.get("steps", []):
                        command = step.get("run", "")
                        if command:
                            # Execute command
                            full_cmd = f"cd {workspace} && {command}"
                            result = await conn.run(full_cmd)

                            # Log output
                            if result.stdout:
                                for line in result.stdout.split("\n"):
                                    if line.strip():
                                        self._log(line)

                            if result.exit_status != 0:
                                self._log(f"Stage failed: {result.stderr}", "error")
                                raise AgentRunnerError(f"Stage {stage_name} failed")

                    self._log(f"Stage completed: {stage_name}")

                # Cleanup
                await conn.run(f"rm -rf {workspace}")
                self._log("Workspace cleaned up")

                return "success"

        except asyncssh.Error as e:
            self._log(f"SSH error: {e}", "error")
            raise AgentRunnerError(f"SSH execution failed: {e}")


class AgentManager:
    """
    Manages multiple agents and job distribution.
    """

    def __init__(self):
        self._agents: Dict[str, PipelineAgent] = {}
        self._active_jobs: Dict[str, str] = {}  # run_id -> agent_id

    def register_agent(self, agent: PipelineAgent):
        """Register an agent."""
        self._agents[agent.id] = agent

    def unregister_agent(self, agent_id: str):
        """Unregister an agent."""
        self._agents.pop(agent_id, None)

    def get_available_agent(
        self,
        labels: Optional[List[str]] = None,
        pool: Optional[str] = None,
    ) -> Optional[PipelineAgent]:
        """Get an available agent matching criteria."""
        for agent in self._agents.values():
            if agent.status != AgentStatus.ONLINE:
                continue
            if agent.current_jobs >= agent.max_concurrent_jobs:
                continue
            if pool and agent.pool != pool:
                continue
            if labels and not all(l in (agent.labels or []) for l in labels):
                continue
            return agent
        return None

    async def submit_to_best_agent(
        self,
        job_request: AgentJobRequest,
        labels: Optional[List[str]] = None,
        pool: Optional[str] = None,
    ) -> tuple[PipelineAgent, Dict[str, Any]]:
        """Submit job to the best available agent."""
        agent = self.get_available_agent(labels=labels, pool=pool)
        if not agent:
            raise AgentRunnerError("No available agents")

        async with AgentRunner(agent) as runner:
            result = await runner.submit_job(job_request)
            self._active_jobs[job_request.run_id] = agent.id
            return agent, result

    async def cancel_job(self, run_id: str) -> bool:
        """Cancel a job on its assigned agent."""
        agent_id = self._active_jobs.get(run_id)
        if not agent_id:
            return False

        agent = self._agents.get(agent_id)
        if not agent:
            return False

        async with AgentRunner(agent) as runner:
            return await runner.cancel_job(run_id)

    def mark_job_completed(self, run_id: str):
        """Mark a job as completed."""
        self._active_jobs.pop(run_id, None)
