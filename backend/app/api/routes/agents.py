"""Agent management API routes."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.repositories.agent_repository import AgentRepository
from app.schemas.agent import (
    AgentCreate,
    AgentHeartbeat,
    AgentHeartbeatResponse,
    AgentJobUpdate,
    AgentListResponse,
    AgentPoolListResponse,
    AgentPoolSummary,
    AgentRegistration,
    AgentRegistrationResponse,
    AgentResponse,
    AgentUpdate,
)
from app.services.agent_runner import AgentRunner

router = APIRouter(prefix="/agents", tags=["Agents"])


# ============ Dependency ============

async def get_agent_repo(db: AsyncSession = Depends(get_db)) -> AgentRepository:
    """Get agent repository instance."""
    return AgentRepository(db)


# ============ Agent CRUD ============

@router.get("", response_model=AgentListResponse)
async def list_agents(
    status: Optional[str] = Query(None, description="Filter by agent status"),
    pool: Optional[str] = Query(None, description="Filter by agent pool"),
    labels: Optional[str] = Query(None, description="Comma-separated labels to filter by"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(get_current_user),
):
    """List all registered agents with optional filtering."""
    label_list = labels.split(",") if labels else None
    result = await repo.list_agents(
        status=status,
        pool=pool,
        labels=label_list,
        page=page,
        page_size=page_size,
    )
    return result


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_create: AgentCreate,
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(require_role("admin")),
):
    """Create a new agent (admin only)."""
    # Check if name already exists
    existing = await repo.get_agent_by_name(agent_create.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent with name '{agent_create.name}' already exists",
        )

    agent = await repo.create_agent(
        name=agent_create.name,
        host=agent_create.host,
        port=agent_create.port,
        description=agent_create.description,
        api_key=agent_create.api_key,
        ssh_user=agent_create.ssh_user,
        ssh_key_id=agent_create.ssh_key_id,
        labels=agent_create.labels,
        max_concurrent_jobs=agent_create.max_concurrent_jobs,
        workspace_path=agent_create.workspace_path,
        pool=agent_create.pool,
    )
    return agent.to_dict()


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(get_current_user),
):
    """Get agent details by ID."""
    agent = await repo.get_agent(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return agent.to_dict()


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    agent_update: AgentUpdate,
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(require_role("admin")),
):
    """Update an agent (admin only)."""
    update_data = agent_update.dict(exclude_unset=True)
    agent = await repo.update_agent(agent_id, **update_data)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return agent.to_dict()


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(require_role("admin")),
):
    """Delete an agent (admin only)."""
    success = await repo.delete_agent(agent_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )


# ============ Agent Status ============

@router.get("/{agent_id}/status")
async def get_agent_status(
    agent_id: str,
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(get_current_user),
):
    """Get agent status and health information."""
    agent = await repo.get_agent(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    # Try to get live status from agent
    try:
        async with AgentRunner(agent) as runner:
            is_healthy = await runner.check_health()
            info = await runner.get_agent_info() if is_healthy else None
    except Exception:
        is_healthy = False
        info = None

    return {
        "id": agent.id,
        "name": agent.name,
        "status": agent.status.value,
        "isHealthy": is_healthy,
        "lastHeartbeat": agent.last_heartbeat.isoformat() if agent.last_heartbeat else None,
        "currentJobs": agent.current_jobs,
        "maxConcurrentJobs": agent.max_concurrent_jobs,
        "systemInfo": info,
    }


@router.post("/{agent_id}/test-connection")
async def test_agent_connection(
    agent_id: str,
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(require_role("admin")),
):
    """Test connection to an agent."""
    agent = await repo.get_agent(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    try:
        async with AgentRunner(agent) as runner:
            is_healthy = await runner.check_health()
            info = await runner.get_agent_info() if is_healthy else None

        if is_healthy:
            # Update agent status
            await repo.update_heartbeat(
                agent_id=agent.id,
                version=info.get("version") if info else None,
            )

        return {
            "success": is_healthy,
            "message": "Connection successful" if is_healthy else "Connection failed",
            "agentInfo": info,
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}",
            "agentInfo": None,
        }


# ============ Agent Pools ============

@router.get("/pools/summary", response_model=AgentPoolListResponse)
async def get_agent_pools(
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(get_current_user),
):
    """Get summary of all agent pools."""
    pools = await repo.get_all_pools()
    return {"pools": pools}


@router.get("/pools/{pool_name}")
async def get_pool_details(
    pool_name: str,
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(get_current_user),
):
    """Get details of a specific agent pool."""
    summary = await repo.get_pool_summary(pool_name)
    agents = await repo.get_agents_by_pool(pool_name)

    return {
        **summary,
        "agents": [agent.to_dict() for agent in agents],
    }


# ============ Agent Jobs ============

@router.get("/{agent_id}/jobs")
async def get_agent_jobs(
    agent_id: str,
    repo: AgentRepository = Depends(get_agent_repo),
    current_user: User = Depends(get_current_user),
):
    """Get active jobs assigned to an agent."""
    agent = await repo.get_agent(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    assignments = await repo.get_agent_active_jobs(agent_id)
    return {
        "agentId": agent_id,
        "agentName": agent.name,
        "activeJobs": len(assignments),
        "maxJobs": agent.max_concurrent_jobs,
        "jobs": [
            {
                "runId": a.run_id,
                "assignedAt": a.assigned_at.isoformat() if a.assigned_at else None,
                "startedAt": a.started_at.isoformat() if a.started_at else None,
                "workspace": a.remote_workspace,
            }
            for a in assignments
        ],
    }


# ============ Agent Self-Registration ============

@router.post("/register", response_model=AgentRegistrationResponse)
async def register_agent(
    registration: AgentRegistration,
    repo: AgentRepository = Depends(get_agent_repo),
):
    """
    Agent self-registration endpoint.

    Agents can call this to register themselves with the server.
    Returns API key for subsequent authentication.
    """
    agent, api_key = await repo.register_agent(
        name=registration.name,
        host=registration.host,
        port=registration.port,
        version=registration.version,
        labels=registration.labels,
        max_concurrent_jobs=registration.max_concurrent_jobs,
        os_type=registration.os_type,
        os_version=registration.os_version,
        cpu_cores=registration.cpu_cores,
        memory_gb=registration.memory_gb,
        disk_gb=registration.disk_gb,
        docker_available=registration.docker_available,
        kubernetes_available=registration.kubernetes_available,
        workspace_path=registration.workspace_path,
    )

    return {
        "agent_id": agent.id,
        "api_key": api_key,
        "registered_at": datetime.utcnow(),
        "heartbeat_interval_seconds": 30,
    }


# ============ Agent Heartbeat ============

@router.post("/{agent_id}/heartbeat", response_model=AgentHeartbeatResponse)
async def agent_heartbeat(
    agent_id: str,
    heartbeat: AgentHeartbeat,
    x_agent_api_key: str = Header(..., alias="X-Agent-API-Key"),
    repo: AgentRepository = Depends(get_agent_repo),
):
    """
    Agent heartbeat endpoint.

    Agents should call this periodically to report their status.
    """
    # Verify API key
    agent = await repo.get_agent(agent_id)
    if not agent or agent.api_key != x_agent_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent credentials",
        )

    # Update heartbeat
    await repo.update_heartbeat(
        agent_id=agent_id,
        version=heartbeat.version,
        status=heartbeat.status,
        current_jobs=heartbeat.current_jobs,
        os_type=heartbeat.os_type,
        os_version=heartbeat.os_version,
        cpu_cores=heartbeat.cpu_cores,
        memory_gb=heartbeat.memory_gb,
        disk_gb=heartbeat.disk_gb,
        docker_available=heartbeat.docker_available,
        kubernetes_available=heartbeat.kubernetes_available,
    )

    # Get pending jobs for this agent
    # (In a real implementation, you'd query for jobs assigned but not yet started)
    pending_jobs: List[str] = []

    return {
        "acknowledged": True,
        "server_time": datetime.utcnow(),
        "pending_jobs": pending_jobs,
    }


# ============ Job Status Updates (from agent) ============

@router.post("/jobs/{run_id}/update")
async def update_job_status(
    run_id: str,
    update: AgentJobUpdate,
    x_agent_api_key: str = Header(..., alias="X-Agent-API-Key"),
    repo: AgentRepository = Depends(get_agent_repo),
    db: AsyncSession = Depends(get_db),
):
    """
    Receive job status update from agent.

    Agents call this to report job progress, logs, and completion.
    """
    # Verify agent via API key
    agent = await repo.get_agent_by_api_key(x_agent_api_key)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent credentials",
        )

    # Get job assignment
    assignment = await repo.get_job_assignment(run_id)
    if not assignment or assignment.agent_id != agent.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not assigned to this agent",
        )

    # Update pipeline run status
    from app.repositories.pipeline_repository import PipelineRepository
    pipeline_repo = PipelineRepository(db)

    # Update run status
    await pipeline_repo.update_run_status(
        run_id=run_id,
        status=update.status,
    )

    # Add log if provided
    if update.log_message:
        await pipeline_repo.add_log(
            run_id=run_id,
            message=update.log_message,
            level=update.log_level,
            stage_id=None,
        )

    # Update stage status if provided
    if update.stage_name and update.stage_status:
        run = await pipeline_repo.get_run(run_id)
        if run:
            for stage in run.stages:
                if stage.name == update.stage_name:
                    stage.status = update.stage_status
                    if update.stage_status == "running" and not stage.started_at:
                        stage.started_at = datetime.utcnow()
                    elif update.stage_status in ("success", "failed"):
                        stage.finished_at = datetime.utcnow()
                        if stage.started_at:
                            delta = stage.finished_at - stage.started_at
                            stage.duration_seconds = int(delta.total_seconds())
                    break

    # Handle completion
    if update.status in ("success", "failed"):
        await repo.complete_job_assignment(
            run_id=run_id,
            success=update.status == "success",
            duration_seconds=update.duration_seconds or 0,
        )

        # Update run completion
        await pipeline_repo.complete_run(
            run_id=run_id,
            status=update.status,
            error_message=update.error_message,
        )

    await db.commit()

    return {"acknowledged": True}
