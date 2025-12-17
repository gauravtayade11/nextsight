"""Pipeline repository with database operations and caching."""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.pipeline import (
    Pipeline,
    PipelineLog,
    PipelineRun,
    PipelineSecret,
    PipelineStage,
    PipelineStatus,
    PipelineTemplate,
    PipelineTrigger,
    PipelineVariable,
    Provider,
    StageStatus,
    TriggerType,
)

logger = logging.getLogger(__name__)


class InMemoryCache:
    """Simple in-memory cache with TTL support."""

    def __init__(self, default_ttl: int = 300):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if key in self._cache:
            entry = self._cache[key]
            if datetime.now() < entry["expires_at"]:
                return entry["value"]
            else:
                del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with TTL."""
        expires_at = datetime.now() + timedelta(seconds=ttl or self._default_ttl)
        self._cache[key] = {"value": value, "expires_at": expires_at}

    def delete(self, key: str) -> None:
        """Delete value from cache."""
        self._cache.pop(key, None)

    def delete_pattern(self, pattern: str) -> None:
        """Delete all keys matching pattern (simple prefix match)."""
        prefix = pattern.rstrip("*")
        keys_to_delete = [k for k in self._cache.keys() if k.startswith(prefix)]
        for key in keys_to_delete:
            del self._cache[key]

    def clear(self) -> None:
        """Clear all cache."""
        self._cache.clear()


# Global cache instance
_cache = InMemoryCache(default_ttl=300)


class PipelineRepository:
    """Repository for pipeline database operations with caching."""

    CACHE_TTL_PIPELINE = 300  # 5 minutes
    CACHE_TTL_RUNS = 60  # 1 minute
    CACHE_TTL_STATS = 120  # 2 minutes

    def __init__(self, db: AsyncSession):
        self.db = db
        self.cache = _cache

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
        """List pipelines with filtering and pagination."""
        cache_key = f"pipelines:list:{search}:{provider}:{is_active}:{tags}:{page}:{page_size}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        # Build query
        query = select(Pipeline)
        conditions = []

        if search:
            search_pattern = f"%{search}%"
            conditions.append(
                or_(
                    Pipeline.name.ilike(search_pattern),
                    Pipeline.description.ilike(search_pattern),
                    Pipeline.repository.ilike(search_pattern),
                )
            )

        if provider:
            conditions.append(Pipeline.provider == provider)

        if is_active is not None:
            conditions.append(Pipeline.is_active == is_active)

        if tags:
            # JSON contains check for tags
            for tag in tags:
                conditions.append(Pipeline.tags.contains([tag]))

        if conditions:
            query = query.where(and_(*conditions))

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination and ordering
        query = (
            query
            .order_by(desc(Pipeline.updated_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        result = await self.db.execute(query)
        pipelines = result.scalars().all()

        response = {
            "items": [p.to_dict() for p in pipelines],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

        self.cache.set(cache_key, response, self.CACHE_TTL_PIPELINE)
        return response

    async def get_pipeline(self, pipeline_id: str) -> Optional[Pipeline]:
        """Get a pipeline by ID with caching."""
        cache_key = f"pipeline:{pipeline_id}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        query = (
            select(Pipeline)
            .options(
                selectinload(Pipeline.runs).selectinload(PipelineRun.stages),
                selectinload(Pipeline.variables),
                selectinload(Pipeline.triggers),
            )
            .where(Pipeline.id == pipeline_id)
        )

        result = await self.db.execute(query)
        pipeline = result.scalar_one_or_none()

        if pipeline:
            self.cache.set(cache_key, pipeline, self.CACHE_TTL_PIPELINE)

        return pipeline

    async def create_pipeline(
        self,
        name: str,
        description: Optional[str] = None,
        repository: Optional[str] = None,
        branch: str = "main",
        provider: str = "manual",
        file_path: Optional[str] = None,
        yaml_config: Optional[str] = None,
        tags: Optional[List[str]] = None,
        execution_mode: Optional[str] = None,
        kubernetes_namespace: Optional[str] = None,
        preferred_agent_id: Optional[str] = None,
    ) -> Pipeline:
        """Create a new pipeline."""
        from app.models.pipeline import ExecutionMode

        pipeline = Pipeline(
            name=name,
            description=description,
            repository=repository,
            branch=branch,
            provider=Provider(provider) if provider else Provider.MANUAL,
            file_path=file_path,
            yaml_config=yaml_config,
            tags=tags or [],
            is_active=True,
            execution_mode=ExecutionMode(execution_mode) if execution_mode else ExecutionMode.LOCAL,
            kubernetes_namespace=kubernetes_namespace,
            preferred_agent_id=preferred_agent_id,
        )

        self.db.add(pipeline)
        await self.db.flush()
        await self.db.refresh(pipeline)

        # Invalidate list cache
        self.cache.delete_pattern("pipelines:list:*")

        logger.info(f"Created pipeline: {pipeline.id}")
        return pipeline

    async def update_pipeline(
        self,
        pipeline_id: str,
        **kwargs
    ) -> Optional[Pipeline]:
        """Update a pipeline."""
        from app.models.pipeline import ExecutionMode

        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return None

        # Update fields
        for key, value in kwargs.items():
            if hasattr(pipeline, key) and value is not None:
                if key == "provider" and isinstance(value, str):
                    value = Provider(value)
                elif key == "execution_mode" and isinstance(value, str):
                    value = ExecutionMode(value)
                setattr(pipeline, key, value)

        await self.db.flush()  # Flush changes to database
        # Refresh to get updated timestamps, but do it before commit
        try:
            await self.db.refresh(pipeline)
        except Exception as e:
            # If refresh fails, it's okay - we'll commit anyway
            logger.debug(f"Refresh failed (non-critical): {e}")
        
        await self.db.commit()  # Commit transaction

        # Invalidate caches
        self.cache.delete(f"pipeline:{pipeline_id}")
        self.cache.delete_pattern("pipelines:list:*")

        logger.info(f"Updated pipeline: {pipeline_id}")
        return pipeline

    async def delete_pipeline(self, pipeline_id: str) -> bool:
        """Delete a pipeline."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return False

        await self.db.delete(pipeline)

        # Invalidate caches
        self.cache.delete(f"pipeline:{pipeline_id}")
        self.cache.delete_pattern("pipelines:list:*")
        self.cache.delete_pattern(f"pipeline:{pipeline_id}:*")

        logger.info(f"Deleted pipeline: {pipeline_id}")
        return True

    # ============ Pipeline Runs ============

    async def create_run(
        self,
        pipeline_id: str,
        branch: Optional[str] = None,
        commit_sha: Optional[str] = None,
        commit_message: Optional[str] = None,
        trigger_type: str = "manual",
        triggered_by: Optional[str] = None,
        environment: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
    ) -> Optional[PipelineRun]:
        """Create a new pipeline run."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return None

        run = PipelineRun(
            pipeline_id=pipeline_id,
            branch=branch or pipeline.branch,
            commit_sha=commit_sha,
            commit_message=commit_message,
            trigger_type=TriggerType(trigger_type) if trigger_type else TriggerType.MANUAL,
            triggered_by=triggered_by,
            environment=environment,
            variables=variables or {},
            status=PipelineStatus.PENDING,
        )

        self.db.add(run)
        await self.db.flush()
        await self.db.refresh(run)

        # Create default stages based on pipeline configuration
        stages = await self._create_default_stages(run.id, pipeline.yaml_config)
        run.stages = stages

        # Update pipeline statistics
        pipeline.total_runs += 1
        pipeline.last_run_id = run.id
        pipeline.last_run_status = run.status
        pipeline.last_run_at = run.started_at

        # Invalidate caches
        self.cache.delete(f"pipeline:{pipeline_id}")
        self.cache.delete_pattern(f"pipeline:{pipeline_id}:runs:*")
        self.cache.delete_pattern("pipelines:list:*")

        logger.info(f"Created pipeline run: {run.id}")
        return run

    async def _create_default_stages(
        self,
        run_id: str,
        yaml_config: Optional[str] = None,
    ) -> List[PipelineStage]:
        """Create default stages for a run."""
        # Parse stages from YAML or use defaults
        stage_names = ["Checkout", "Build", "Test", "Deploy"]

        if yaml_config:
            try:
                import yaml
                config = yaml.safe_load(yaml_config)
                if "stages" in config:
                    stage_names = config["stages"]
                elif "jobs" in config:
                    stage_names = list(config["jobs"].keys())
            except Exception:
                pass  # Use defaults

        stages = []
        for i, name in enumerate(stage_names):
            stage = PipelineStage(
                run_id=run_id,
                name=name,
                order=i,
                status=StageStatus.PENDING,
            )
            self.db.add(stage)
            stages.append(stage)

        await self.db.flush()
        return stages

    async def list_runs(
        self,
        pipeline_id: Optional[str] = None,
        status: Optional[str] = None,
        branch: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        """List pipeline runs with filtering and pagination."""
        cache_key = f"runs:list:{pipeline_id}:{status}:{branch}:{page}:{page_size}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        query = select(PipelineRun).options(
            selectinload(PipelineRun.stages),
            selectinload(PipelineRun.test_results),
            selectinload(PipelineRun.coverage_data),
            joinedload(PipelineRun.pipeline),
        )

        conditions = []
        if pipeline_id:
            conditions.append(PipelineRun.pipeline_id == pipeline_id)
        if status:
            conditions.append(PipelineRun.status == status)
        if branch:
            conditions.append(PipelineRun.branch == branch)

        if conditions:
            query = query.where(and_(*conditions))

        # Get total count
        count_query = select(func.count()).select_from(
            select(PipelineRun.id).where(and_(*conditions) if conditions else True).subquery()
        )
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination and ordering
        query = (
            query
            .order_by(desc(PipelineRun.started_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        result = await self.db.execute(query)
        runs = result.scalars().unique().all()

        response = {
            "items": [r.to_dict() for r in runs],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

        self.cache.set(cache_key, response, self.CACHE_TTL_RUNS)
        return response

    async def get_run(self, run_id: str) -> Optional[PipelineRun]:
        """Get a pipeline run by ID."""
        cache_key = f"run:{run_id}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        query = (
            select(PipelineRun)
            .options(
                selectinload(PipelineRun.stages),
                selectinload(PipelineRun.logs),
                joinedload(PipelineRun.pipeline),
            )
            .where(PipelineRun.id == run_id)
        )

        result = await self.db.execute(query)
        run = result.scalar_one_or_none()

        if run:
            self.cache.set(cache_key, run, self.CACHE_TTL_RUNS)

        return run

    async def update_run_status(
        self,
        run_id: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> Optional[PipelineRun]:
        """Update a run's status."""
        run = await self.get_run(run_id)
        if not run:
            return None

        run.status = PipelineStatus(status)

        if status in ["success", "failed", "cancelled"]:
            run.finished_at = datetime.utcnow()
            if run.started_at:
                delta = run.finished_at - run.started_at
                run.duration_seconds = int(delta.total_seconds())

        if error_message:
            run.error_message = error_message

        await self.db.flush()

        # Update pipeline statistics
        await self._update_pipeline_stats(run.pipeline_id)

        # Invalidate caches
        self.cache.delete(f"run:{run_id}")
        self.cache.delete_pattern(f"runs:list:{run.pipeline_id}:*")
        self.cache.delete(f"pipeline:{run.pipeline_id}")
        self.cache.delete_pattern("pipelines:list:*")

        return run

    async def _update_pipeline_stats(self, pipeline_id: str) -> None:
        """Update cached statistics on a pipeline."""
        # Count runs
        count_query = select(
            func.count(PipelineRun.id).label("total"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.SUCCESS).label("success"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.FAILED).label("failed"),
            func.avg(PipelineRun.duration_seconds).label("avg_duration"),
        ).where(PipelineRun.pipeline_id == pipeline_id)

        result = await self.db.execute(count_query)
        row = result.one()

        total = row.total or 0
        success = row.success or 0
        failed = row.failed or 0
        avg_duration = row.avg_duration or 0

        success_rate = (success / total * 100) if total > 0 else 0.0

        # Update pipeline
        update_stmt = (
            update(Pipeline)
            .where(Pipeline.id == pipeline_id)
            .values(
                total_runs=total,
                successful_runs=success,
                failed_runs=failed,
                success_rate=success_rate,
                avg_duration_seconds=int(avg_duration),
            )
        )
        await self.db.execute(update_stmt)

    async def cancel_run(self, run_id: str) -> bool:
        """Cancel a running pipeline."""
        run = await self.get_run(run_id)
        if not run or run.status != PipelineStatus.RUNNING:
            return False

        await self.update_run_status(run_id, "cancelled")

        # Update pending stages to skipped
        for stage in run.stages:
            if stage.status == StageStatus.PENDING:
                stage.status = StageStatus.SKIPPED

        await self.db.flush()
        return True

    # ============ Logs ============

    async def add_log(
        self,
        run_id: str,
        message: str,
        level: str = "info",
        stage_id: Optional[str] = None,
    ) -> PipelineLog:
        """Add a log entry to a run."""
        log = PipelineLog(
            run_id=run_id,
            stage_id=stage_id,
            message=message,
            level=level,
        )
        self.db.add(log)
        await self.db.flush()

        # Invalidate log cache
        self.cache.delete_pattern(f"logs:{run_id}:*")

        return log

    async def get_logs(
        self,
        run_id: str,
        stage_id: Optional[str] = None,
        level: Optional[str] = None,
        limit: int = 500,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Get logs for a run with pagination."""
        cache_key = f"logs:{run_id}:{stage_id}:{level}:{limit}:{offset}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        query = select(PipelineLog).where(PipelineLog.run_id == run_id)

        if stage_id:
            query = query.where(PipelineLog.stage_id == stage_id)
        if level:
            query = query.where(PipelineLog.level == level)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination and ordering
        query = (
            query
            .order_by(PipelineLog.timestamp)
            .offset(offset)
            .limit(limit)
        )

        result = await self.db.execute(query)
        logs = result.scalars().all()

        response = {
            "run_id": run_id,
            "logs": [
                {
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "level": log.level,
                    "stage_id": log.stage_id,
                    "message": log.message,
                }
                for log in logs
            ],
            "total": total,
            "has_more": offset + limit < total,
        }

        self.cache.set(cache_key, response, self.CACHE_TTL_RUNS)
        return response

    # ============ Statistics ============

    async def get_pipeline_statistics(
        self,
        pipeline_id: str,
        days: int = 30,
    ) -> Optional[Dict[str, Any]]:
        """Get statistics for a pipeline."""
        cache_key = f"stats:{pipeline_id}:{days}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return None

        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Get run statistics
        stats_query = select(
            func.count(PipelineRun.id).label("total"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.SUCCESS).label("success"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.FAILED).label("failed"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.CANCELLED).label("cancelled"),
            func.avg(PipelineRun.duration_seconds).label("avg_duration"),
        ).where(
            and_(
                PipelineRun.pipeline_id == pipeline_id,
                PipelineRun.started_at >= cutoff_date,
            )
        )

        result = await self.db.execute(stats_query)
        row = result.one()

        total = row.total or 0
        success = row.success or 0
        failed = row.failed or 0
        cancelled = row.cancelled or 0
        avg_duration = row.avg_duration or 0

        # Get daily breakdown for trend chart
        daily_query = select(
            func.date(PipelineRun.started_at).label("date"),
            func.count(PipelineRun.id).label("total"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.SUCCESS).label("success"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.FAILED).label("failed"),
        ).where(
            and_(
                PipelineRun.pipeline_id == pipeline_id,
                PipelineRun.started_at >= cutoff_date,
            )
        ).group_by(func.date(PipelineRun.started_at)).order_by(func.date(PipelineRun.started_at))

        daily_result = await self.db.execute(daily_query)
        daily_rows = daily_result.all()

        daily_stats = [
            {
                "date": str(row.date),
                "total": row.total,
                "success": row.success,
                "failed": row.failed,
            }
            for row in daily_rows
        ]

        response = {
            "pipeline_id": pipeline_id,
            "period_days": days,
            "total_runs": total,
            "successful_runs": success,
            "failed_runs": failed,
            "cancelled_runs": cancelled,
            "success_rate": (success / total * 100) if total > 0 else 0.0,
            "average_duration_seconds": int(avg_duration),
            "daily_stats": daily_stats,
        }

        self.cache.set(cache_key, response, self.CACHE_TTL_STATS)
        return response

    async def get_global_statistics(self) -> Dict[str, Any]:
        """Get global pipeline statistics."""
        cache_key = "stats:global"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        # Pipeline counts
        pipeline_query = select(
            func.count(Pipeline.id).label("total"),
            func.count(Pipeline.id).filter(Pipeline.is_active == True).label("active"),
        )
        pipeline_result = await self.db.execute(pipeline_query)
        pipeline_row = pipeline_result.one()

        # Run counts
        run_query = select(
            func.count(PipelineRun.id).label("total"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.RUNNING).label("running"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.SUCCESS).label("success"),
            func.count(PipelineRun.id).filter(PipelineRun.status == PipelineStatus.FAILED).label("failed"),
            func.avg(PipelineRun.duration_seconds).filter(PipelineRun.duration_seconds.isnot(None)).label("avg_duration"),
        )
        run_result = await self.db.execute(run_query)
        run_row = run_result.one()

        total_runs = run_row.total or 0
        success_runs = run_row.success or 0

        response = {
            "total_pipelines": pipeline_row.total or 0,
            "active_pipelines": pipeline_row.active or 0,
            "total_runs": total_runs,
            "running_runs": run_row.running or 0,
            "success_rate": (success_runs / total_runs * 100) if total_runs > 0 else 0.0,
            "avg_duration_seconds": int(run_row.avg_duration or 0),
        }

        self.cache.set(cache_key, response, self.CACHE_TTL_STATS)
        return response

    # ============ Templates ============

    async def list_templates(
        self,
        category: Optional[str] = None,
        featured_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """List pipeline templates."""
        cache_key = f"templates:{category}:{featured_only}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        query = select(PipelineTemplate)

        conditions = []
        if category:
            conditions.append(PipelineTemplate.category == category)
        if featured_only:
            conditions.append(PipelineTemplate.is_featured == True)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.order_by(desc(PipelineTemplate.usage_count))

        result = await self.db.execute(query)
        templates = result.scalars().all()

        response = [t.to_dict() for t in templates]

        self.cache.set(cache_key, response, self.CACHE_TTL_PIPELINE)
        return response

    async def get_template(self, template_id: str) -> Optional[PipelineTemplate]:
        """Get a template by ID."""
        query = select(PipelineTemplate).where(PipelineTemplate.id == template_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def use_template(self, template_id: str) -> Optional[str]:
        """Increment usage count and return YAML."""
        template = await self.get_template(template_id)
        if not template:
            return None

        template.usage_count += 1
        await self.db.flush()

        # Invalidate template cache
        self.cache.delete_pattern("templates:*")

        return template.yaml_template


# ============ Dependency injection helper ============

def get_pipeline_repository(db: AsyncSession) -> PipelineRepository:
    """Factory function for dependency injection."""
    return PipelineRepository(db)
