"""Pipeline service with database persistence."""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline import (
    Pipeline,
    PipelineRun,
    PipelineStatus,
    PipelineTemplate,
    Provider,
    StageStatus,
)
from app.repositories.pipeline_repository import PipelineRepository
from app.schemas.pipelines import (
    Pipeline as PipelineSchema,
    PipelineCreate,
    PipelineRun as PipelineRunSchema,
    PipelineRunCreate,
    PipelineStatistics,
    PipelineUpdate,
)

logger = logging.getLogger(__name__)


class PipelineServiceDB:
    """Database-backed pipeline service."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PipelineRepository(db)

    # ============ Pipeline CRUD ============

    async def list_pipelines(
        self,
        search: Optional[str] = None,
        provider: Optional[str] = None,
        is_active: Optional[bool] = None,
        tags: Optional[List[str]] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """List all pipelines with filtering and pagination."""
        return await self.repo.list_pipelines(
            search=search,
            provider=provider,
            is_active=is_active,
            tags=tags,
            page=page,
            page_size=page_size,
        )

    async def get_pipeline(self, pipeline_id: str) -> Optional[Dict[str, Any]]:
        """Get a pipeline by ID."""
        pipeline = await self.repo.get_pipeline(pipeline_id)
        if pipeline:
            return pipeline.to_dict()
        return None

    async def create_pipeline(self, pipeline_create: PipelineCreate) -> Dict[str, Any]:
        """Create a new pipeline."""
        pipeline = await self.repo.create_pipeline(
            name=pipeline_create.name,
            description=pipeline_create.description,
            repository=pipeline_create.repository,
            branch=pipeline_create.branch,
            provider=pipeline_create.provider,
            file_path=pipeline_create.file_path,
            yaml_config=pipeline_create.yaml,
            tags=pipeline_create.tags,
            execution_mode=pipeline_create.execution_mode.value if pipeline_create.execution_mode else "local",
            kubernetes_namespace=pipeline_create.kubernetes_namespace,
            preferred_agent_id=pipeline_create.preferred_agent_id,
        )
        return pipeline.to_dict()

    async def update_pipeline(
        self,
        pipeline_id: str,
        pipeline_update: PipelineUpdate,
    ) -> Optional[Dict[str, Any]]:
        """Update a pipeline."""
        # Handle Pydantic v1 and v2
        if hasattr(pipeline_update, 'model_dump'):
            update_data = pipeline_update.model_dump(exclude_unset=True)
        else:
            update_data = pipeline_update.dict(exclude_unset=True)

        # Handle yaml -> yaml_config mapping
        if "yaml" in update_data:
            update_data["yaml_config"] = update_data.pop("yaml")

        # Handle execution_mode enum conversion
        if "execution_mode" in update_data and update_data["execution_mode"] is not None:
            exec_mode = update_data["execution_mode"]
            # Handle both enum and string values
            if hasattr(exec_mode, 'value'):
                update_data["execution_mode"] = exec_mode.value
            elif isinstance(exec_mode, str):
                # Already a string, use as-is (will be validated by repository)
                update_data["execution_mode"] = exec_mode
            else:
                # Try to convert to string
                update_data["execution_mode"] = str(exec_mode)

        pipeline = await self.repo.update_pipeline(pipeline_id, **update_data)
        if pipeline:
            return pipeline.to_dict()
        return None

    async def delete_pipeline(self, pipeline_id: str) -> bool:
        """Delete a pipeline."""
        return await self.repo.delete_pipeline(pipeline_id)

    async def get_pipeline_yaml(self, pipeline_id: str) -> Optional[str]:
        """Get pipeline YAML configuration."""
        pipeline = await self.repo.get_pipeline(pipeline_id)
        if pipeline:
            return pipeline.yaml_config
        return None

    async def update_pipeline_yaml(
        self,
        pipeline_id: str,
        yaml_content: str,
    ) -> Optional[Dict[str, Any]]:
        """Update pipeline YAML configuration."""
        # Get pipeline first to ensure it exists
        pipeline = await self.repo.get_pipeline(pipeline_id)
        if not pipeline:
            return None
        
        # Update yaml_config directly
        pipeline.yaml_config = yaml_content
        await self.repo.db.flush()
        await self.repo.db.commit()
        
        # Re-fetch to get updated timestamps, or build dict from current object
        # Build dict manually to avoid any session/lazy loading issues
        execution_mode_value = pipeline.execution_mode.value if pipeline.execution_mode else "local"
        return {
            "id": pipeline.id,
            "name": pipeline.name,
            "description": pipeline.description or "",
            "repository": pipeline.repository,
            "branch": pipeline.branch or "main",
            "provider": pipeline.provider.value if pipeline.provider else "manual",
            "file_path": pipeline.file_path,
            "yaml": pipeline.yaml_config,
            "is_active": pipeline.is_active,
            "tags": pipeline.tags or [],
            "executionMode": execution_mode_value,
            "execution_mode": execution_mode_value,
            "preferredAgentId": pipeline.preferred_agent_id,
            "preferred_agent_id": pipeline.preferred_agent_id,
            "kubernetesNamespace": pipeline.kubernetes_namespace,
            "kubernetes_namespace": pipeline.kubernetes_namespace,
            "status": pipeline.last_run_status.value if pipeline.last_run_status else "pending",
            "lastRun": pipeline.last_run_at.isoformat() if pipeline.last_run_at else "Never",
            "duration": pipeline.last_run_duration or "-",
            "trigger": "manual",
            "successRate": round(pipeline.success_rate, 1) if pipeline.success_rate else 0,
            "totalRuns": pipeline.total_runs,
            "createdAt": pipeline.created_at.isoformat() if pipeline.created_at else None,
            "updatedAt": pipeline.updated_at.isoformat() if pipeline.updated_at else None,
        }

    # ============ Pipeline Runs ============

    async def trigger_pipeline(
        self,
        pipeline_id: str,
        run_create: PipelineRunCreate,
        triggered_by: str,
    ) -> Optional[Dict[str, Any]]:
        """Trigger a pipeline run."""
        run = await self.repo.create_run(
            pipeline_id=pipeline_id,
            branch=run_create.branch,
            trigger_type="manual",
            triggered_by=triggered_by,
            variables=run_create.variables,
        )

        if run:
            # Start the first stage
            if run.stages:
                first_stage = run.stages[0]
                first_stage.status = StageStatus.RUNNING
                first_stage.started_at = datetime.utcnow()

            # Update run status to running
            await self.repo.update_run_status(run.id, "running")

            # Add initial log
            await self.repo.add_log(
                run_id=run.id,
                message="Pipeline execution started",
                level="info",
            )

            return run.to_dict()
        return None

    async def list_runs(
        self,
        pipeline_id: Optional[str] = None,
        status: Optional[str] = None,
        branch: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """List pipeline runs with filtering and pagination."""
        return await self.repo.list_runs(
            pipeline_id=pipeline_id,
            status=status,
            branch=branch,
            page=page,
            page_size=page_size,
        )

    async def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get a pipeline run by ID."""
        run = await self.repo.get_run(run_id)
        if run:
            return run.to_dict()
        return None

    async def cancel_run(self, run_id: str) -> bool:
        """Cancel a running pipeline."""
        return await self.repo.cancel_run(run_id)

    async def retry_run(self, run_id: str, triggered_by: str) -> Optional[Dict[str, Any]]:
        """Retry a failed pipeline run."""
        original_run = await self.repo.get_run(run_id)
        if not original_run:
            return None

        # Create new run based on original
        new_run = await self.repo.create_run(
            pipeline_id=original_run.pipeline_id,
            branch=original_run.branch,
            commit_sha=original_run.commit_sha,
            commit_message=original_run.commit_message,
            trigger_type="manual",
            triggered_by=triggered_by,
            environment=original_run.environment,
            variables=original_run.variables,
        )

        if new_run:
            await self.repo.update_run_status(new_run.id, "running")
            await self.repo.add_log(
                run_id=new_run.id,
                message=f"Retry of run {run_id}",
                level="info",
            )
            return new_run.to_dict()
        return None

    # ============ Logs ============

    async def get_run_logs(
        self,
        run_id: str,
        stage_id: Optional[str] = None,
        limit: int = 500,
    ) -> Dict[str, Any]:
        """Get logs for a pipeline run."""
        return await self.repo.get_logs(
            run_id=run_id,
            stage_id=stage_id,
            limit=limit,
        )

    async def add_log(
        self,
        run_id: str,
        message: str,
        level: str = "info",
        stage_id: Optional[str] = None,
    ) -> None:
        """Add a log entry."""
        await self.repo.add_log(
            run_id=run_id,
            message=message,
            level=level,
            stage_id=stage_id,
        )

    # ============ Statistics ============

    async def get_pipeline_statistics(
        self,
        pipeline_id: str,
        days: int = 30,
    ) -> Optional[Dict[str, Any]]:
        """Get statistics for a pipeline."""
        return await self.repo.get_pipeline_statistics(pipeline_id, days)

    async def get_global_statistics(self) -> Dict[str, Any]:
        """Get global pipeline statistics."""
        return await self.repo.get_global_statistics()

    # ============ Templates ============

    async def list_templates(
        self,
        category: Optional[str] = None,
        featured_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """List pipeline templates."""
        return await self.repo.list_templates(
            category=category,
            featured_only=featured_only,
        )

    async def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get a template by ID."""
        template = await self.repo.get_template(template_id)
        if template:
            return template.to_dict()
        return None

    async def create_pipeline_from_template(
        self,
        template_id: str,
        name: str,
        description: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a pipeline from a template."""
        yaml_content = await self.repo.use_template(template_id)
        if not yaml_content:
            return None

        template = await self.repo.get_template(template_id)

        pipeline = await self.repo.create_pipeline(
            name=name,
            description=description or template.description,
            yaml_config=yaml_content,
            tags=[template.category] if template else [],
        )

        return pipeline.to_dict()


# ============ Dependency injection ============

async def get_pipeline_service_db(db: AsyncSession) -> PipelineServiceDB:
    """Factory function for dependency injection."""
    return PipelineServiceDB(db)
