"""Agent repository for database operations."""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline import (
    AgentJobAssignment,
    AgentStatus,
    PipelineAgent,
)

logger = logging.getLogger(__name__)


class AgentRepository:
    """Repository for agent database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ============ Agent CRUD ============

    async def create_agent(
        self,
        name: str,
        host: str,
        port: int = 8080,
        description: Optional[str] = None,
        api_key: Optional[str] = None,
        ssh_user: Optional[str] = None,
        ssh_key_id: Optional[str] = None,
        labels: Optional[List[str]] = None,
        max_concurrent_jobs: int = 2,
        workspace_path: str = "/tmp/nextsight-agent",
        pool: str = "default",
    ) -> PipelineAgent:
        """Create a new agent."""
        # Generate API key if not provided
        if not api_key:
            api_key = secrets.token_urlsafe(32)

        agent = PipelineAgent(
            name=name,
            description=description,
            host=host,
            port=port,
            api_key=api_key,
            ssh_user=ssh_user,
            ssh_key_id=ssh_key_id,
            labels=labels or [],
            max_concurrent_jobs=max_concurrent_jobs,
            workspace_path=workspace_path,
            pool=pool,
            status=AgentStatus.OFFLINE,
        )
        self.db.add(agent)
        await self.db.commit()
        await self.db.refresh(agent)
        logger.info(f"Created agent: {name} ({host}:{port})")
        return agent

    async def get_agent(self, agent_id: str) -> Optional[PipelineAgent]:
        """Get an agent by ID."""
        result = await self.db.execute(
            select(PipelineAgent).where(PipelineAgent.id == agent_id)
        )
        return result.scalar_one_or_none()

    async def get_agent_by_name(self, name: str) -> Optional[PipelineAgent]:
        """Get an agent by name."""
        result = await self.db.execute(
            select(PipelineAgent).where(PipelineAgent.name == name)
        )
        return result.scalar_one_or_none()

    async def get_agent_by_api_key(self, api_key: str) -> Optional[PipelineAgent]:
        """Get an agent by API key (for authentication)."""
        result = await self.db.execute(
            select(PipelineAgent).where(PipelineAgent.api_key == api_key)
        )
        return result.scalar_one_or_none()

    async def list_agents(
        self,
        status: Optional[str] = None,
        pool: Optional[str] = None,
        labels: Optional[List[str]] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """List agents with filtering and pagination."""
        query = select(PipelineAgent)

        # Apply filters
        conditions = []
        if status:
            conditions.append(PipelineAgent.status == status)
        if pool:
            conditions.append(PipelineAgent.pool == pool)

        if conditions:
            query = query.where(and_(*conditions))

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(PipelineAgent.name)

        result = await self.db.execute(query)
        agents = result.scalars().all()

        # Filter by labels in Python (JSON column)
        if labels:
            agents = [
                agent for agent in agents
                if agent.labels and all(label in agent.labels for label in labels)
            ]

        return {
            "agents": [agent.to_dict() for agent in agents],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size,
        }

    async def update_agent(
        self,
        agent_id: str,
        **kwargs,
    ) -> Optional[PipelineAgent]:
        """Update an agent."""
        agent = await self.get_agent(agent_id)
        if not agent:
            return None

        for key, value in kwargs.items():
            if hasattr(agent, key) and value is not None:
                setattr(agent, key, value)

        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def delete_agent(self, agent_id: str) -> bool:
        """Delete an agent."""
        agent = await self.get_agent(agent_id)
        if not agent:
            return False

        await self.db.delete(agent)
        await self.db.commit()
        logger.info(f"Deleted agent: {agent.name}")
        return True

    # ============ Agent Status Management ============

    async def update_heartbeat(
        self,
        agent_id: str,
        version: Optional[str] = None,
        status: AgentStatus = AgentStatus.ONLINE,
        current_jobs: int = 0,
        os_type: Optional[str] = None,
        os_version: Optional[str] = None,
        cpu_cores: Optional[int] = None,
        memory_gb: Optional[float] = None,
        disk_gb: Optional[float] = None,
        docker_available: bool = False,
        kubernetes_available: bool = False,
    ) -> Optional[PipelineAgent]:
        """Update agent heartbeat and system info."""
        agent = await self.get_agent(agent_id)
        if not agent:
            return None

        agent.last_heartbeat = datetime.utcnow()
        agent.status = status
        agent.current_jobs = current_jobs

        if version:
            agent.version = version
        if os_type:
            agent.os_type = os_type
        if os_version:
            agent.os_version = os_version
        if cpu_cores:
            agent.cpu_cores = cpu_cores
        if memory_gb:
            agent.memory_gb = memory_gb
        if disk_gb:
            agent.disk_gb = disk_gb

        agent.docker_available = docker_available
        agent.kubernetes_available = kubernetes_available

        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def mark_offline_agents(self, timeout_seconds: int = 60) -> int:
        """Mark agents as offline if no heartbeat received within timeout."""
        threshold = datetime.utcnow() - timedelta(seconds=timeout_seconds)

        result = await self.db.execute(
            select(PipelineAgent).where(
                and_(
                    PipelineAgent.status == AgentStatus.ONLINE,
                    or_(
                        PipelineAgent.last_heartbeat < threshold,
                        PipelineAgent.last_heartbeat.is_(None),
                    ),
                )
            )
        )
        agents = result.scalars().all()

        for agent in agents:
            agent.status = AgentStatus.OFFLINE
            logger.warning(f"Agent {agent.name} marked as offline (no heartbeat)")

        await self.db.commit()
        return len(agents)

    # ============ Agent Selection ============

    async def get_available_agent(
        self,
        pool: Optional[str] = None,
        labels: Optional[List[str]] = None,
        preferred_agent_id: Optional[str] = None,
    ) -> Optional[PipelineAgent]:
        """Get an available agent for job execution."""
        # Try preferred agent first
        if preferred_agent_id:
            agent = await self.get_agent(preferred_agent_id)
            if agent and agent.is_available:
                return agent

        # Build query for available agents
        query = select(PipelineAgent).where(
            and_(
                PipelineAgent.status == AgentStatus.ONLINE,
                PipelineAgent.current_jobs < PipelineAgent.max_concurrent_jobs,
            )
        )

        if pool:
            query = query.where(PipelineAgent.pool == pool)

        # Order by least busy (fewest current jobs)
        query = query.order_by(PipelineAgent.current_jobs.asc())

        result = await self.db.execute(query)
        agents = result.scalars().all()

        # Filter by labels
        if labels:
            agents = [
                agent for agent in agents
                if agent.labels and all(label in agent.labels for label in labels)
            ]

        return agents[0] if agents else None

    async def get_agents_by_pool(self, pool: str) -> List[PipelineAgent]:
        """Get all agents in a pool."""
        result = await self.db.execute(
            select(PipelineAgent).where(PipelineAgent.pool == pool)
        )
        return list(result.scalars().all())

    # ============ Job Assignment ============

    async def create_job_assignment(
        self,
        agent_id: str,
        run_id: str,
        remote_workspace: Optional[str] = None,
    ) -> AgentJobAssignment:
        """Create a job assignment for an agent."""
        assignment = AgentJobAssignment(
            agent_id=agent_id,
            run_id=run_id,
            remote_workspace=remote_workspace,
        )
        self.db.add(assignment)

        # Increment agent's current jobs
        agent = await self.get_agent(agent_id)
        if agent:
            agent.current_jobs += 1

        await self.db.commit()
        await self.db.refresh(assignment)
        return assignment

    async def get_job_assignment(self, run_id: str) -> Optional[AgentJobAssignment]:
        """Get job assignment by run ID."""
        result = await self.db.execute(
            select(AgentJobAssignment).where(AgentJobAssignment.run_id == run_id)
        )
        return result.scalar_one_or_none()

    async def complete_job_assignment(
        self,
        run_id: str,
        success: bool = True,
        duration_seconds: int = 0,
    ) -> Optional[AgentJobAssignment]:
        """Mark a job assignment as completed."""
        assignment = await self.get_job_assignment(run_id)
        if not assignment:
            return None

        assignment.completed_at = datetime.utcnow()

        # Update agent stats
        if assignment.agent_id:
            agent = await self.get_agent(assignment.agent_id)
            if agent:
                agent.current_jobs = max(0, agent.current_jobs - 1)
                agent.total_jobs += 1
                if success:
                    agent.successful_jobs += 1
                else:
                    agent.failed_jobs += 1

                # Update average duration
                if duration_seconds > 0:
                    total_duration = agent.avg_job_duration_seconds * (agent.total_jobs - 1)
                    agent.avg_job_duration_seconds = (total_duration + duration_seconds) // agent.total_jobs

        await self.db.commit()
        await self.db.refresh(assignment)
        return assignment

    async def get_agent_active_jobs(self, agent_id: str) -> List[AgentJobAssignment]:
        """Get active job assignments for an agent."""
        result = await self.db.execute(
            select(AgentJobAssignment).where(
                and_(
                    AgentJobAssignment.agent_id == agent_id,
                    AgentJobAssignment.completed_at.is_(None),
                )
            )
        )
        return list(result.scalars().all())

    # ============ Pool Statistics ============

    async def get_pool_summary(self, pool: str) -> Dict[str, Any]:
        """Get summary statistics for an agent pool."""
        agents = await self.get_agents_by_pool(pool)

        online = sum(1 for a in agents if a.status == AgentStatus.ONLINE)
        busy = sum(1 for a in agents if a.status == AgentStatus.BUSY)
        offline = sum(1 for a in agents if a.status == AgentStatus.OFFLINE)
        total_capacity = sum(a.max_concurrent_jobs for a in agents)
        used_capacity = sum(a.current_jobs for a in agents)

        return {
            "pool": pool,
            "total_agents": len(agents),
            "online_agents": online,
            "busy_agents": busy,
            "offline_agents": offline,
            "total_capacity": total_capacity,
            "available_capacity": total_capacity - used_capacity,
        }

    async def get_all_pools(self) -> List[Dict[str, Any]]:
        """Get summary for all pools."""
        result = await self.db.execute(
            select(PipelineAgent.pool).distinct()
        )
        pools = [row[0] for row in result.all()]

        summaries = []
        for pool in pools:
            summary = await self.get_pool_summary(pool)
            summaries.append(summary)

        return summaries

    # ============ Agent Registration ============

    async def register_agent(
        self,
        name: str,
        host: str,
        port: int,
        version: str,
        labels: List[str],
        max_concurrent_jobs: int,
        os_type: Optional[str] = None,
        os_version: Optional[str] = None,
        cpu_cores: Optional[int] = None,
        memory_gb: Optional[float] = None,
        disk_gb: Optional[float] = None,
        docker_available: bool = False,
        kubernetes_available: bool = False,
        workspace_path: str = "/tmp/nextsight-agent",
    ) -> tuple[PipelineAgent, str]:
        """Register a new agent and return agent with API key."""
        # Check if agent already exists
        existing = await self.get_agent_by_name(name)
        if existing:
            # Update existing agent
            api_key = existing.api_key
            await self.update_heartbeat(
                agent_id=existing.id,
                version=version,
                status=AgentStatus.ONLINE,
                os_type=os_type,
                os_version=os_version,
                cpu_cores=cpu_cores,
                memory_gb=memory_gb,
                disk_gb=disk_gb,
                docker_available=docker_available,
                kubernetes_available=kubernetes_available,
            )
            existing.host = host
            existing.port = port
            existing.labels = labels
            existing.max_concurrent_jobs = max_concurrent_jobs
            existing.workspace_path = workspace_path
            await self.db.commit()
            await self.db.refresh(existing)
            return existing, api_key

        # Create new agent
        api_key = secrets.token_urlsafe(32)
        agent = PipelineAgent(
            name=name,
            host=host,
            port=port,
            api_key=api_key,
            version=version,
            labels=labels,
            max_concurrent_jobs=max_concurrent_jobs,
            os_type=os_type,
            os_version=os_version,
            cpu_cores=cpu_cores,
            memory_gb=memory_gb,
            disk_gb=disk_gb,
            docker_available=docker_available,
            kubernetes_available=kubernetes_available,
            workspace_path=workspace_path,
            status=AgentStatus.ONLINE,
            last_heartbeat=datetime.utcnow(),
        )
        self.db.add(agent)
        await self.db.commit()
        await self.db.refresh(agent)
        logger.info(f"Registered new agent: {name} ({host}:{port})")
        return agent, api_key
