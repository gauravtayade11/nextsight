"""Pipeline API routes for CI/CD pipeline management."""

import logging
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import StreamingResponse

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.security import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.utils.security import sanitize_log_input
from app.schemas.auth import UserInfo
from app.schemas.pipelines import (
    Pipeline,
    PipelineCreate,
    PipelineRun as PipelineRunSchema,
    PipelineRunCreate,
    PipelineRunStatus,
    PipelineStatistics,
    PipelineUpdate,
)
from app.models.pipeline import (
    PipelineApproval,
    ApprovalStatus,
    PipelineStage,
    PipelineRun as PipelineRunModel,
    StageStatus,
    PipelineStatus,
)
from app.services.pipeline_service import get_pipeline_service, PipelineService
from app.services.github_service import GitHubService, github_service
from app.services.pipeline_executor import pipeline_executor
from app.services.pipeline_execution_service import (
    PipelineExecutionService,
    get_pipeline_execution_service,
)


# Flag to use database-backed pipeline service with real execution
USE_DATABASE_PIPELINES = getattr(settings, 'USE_DATABASE_AUTH', False)


async def get_pipeline_service_dependency(db: AsyncSession = Depends(get_db)):
    """Get the appropriate pipeline service based on configuration."""
    if USE_DATABASE_PIPELINES:
        from app.services.pipeline_service_db import PipelineServiceDB
        return PipelineServiceDB(db)
    return get_pipeline_service()


async def get_execution_service_dependency(db: AsyncSession = Depends(get_db)):
    """Get the pipeline execution service for triggering runs."""
    return PipelineExecutionService(db)


async def call_service_method(service, method_name: str, *args, **kwargs):
    """Helper to call service methods that may be sync or async."""
    import asyncio
    import inspect
    method = getattr(service, method_name)
    if inspect.iscoroutinefunction(method):
        return await method(*args, **kwargs)
    else:
        # Run sync method in thread pool to avoid blocking
        return await asyncio.to_thread(method, *args, **kwargs)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipelines", tags=["Pipelines"])


# ============== Pipeline CRUD Endpoints ==============

@router.get("", response_model=List[Pipeline])
async def list_pipelines(
    search: Optional[str] = Query(None, description="Search by name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """List all configured pipelines."""
    result = await call_service_method(service, 'list_pipelines', search=search, page=page, page_size=page_size)
    # Handle both dict response (DB) and list response (in-memory)
    if isinstance(result, dict):
        return result.get("items", [])
    return result


@router.post("", response_model=Pipeline)
async def create_pipeline(
    pipeline: PipelineCreate,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Create a new pipeline."""
    return await call_service_method(service, 'create_pipeline', pipeline)


@router.get("/{pipeline_id}", response_model=Pipeline)
async def get_pipeline(
    pipeline_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get pipeline details."""
    pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.put("/{pipeline_id}", response_model=Pipeline)
async def update_pipeline(
    pipeline_id: str,
    pipeline_update: PipelineUpdate,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Update pipeline configuration."""
    pipeline = await call_service_method(service, 'update_pipeline', pipeline_id, pipeline_update)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.delete("/{pipeline_id}")
async def delete_pipeline(
    pipeline_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Delete a pipeline."""
    result = await call_service_method(service, 'delete_pipeline', pipeline_id)
    if not result:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return {"message": "Pipeline deleted"}


# ============== Pipeline YAML Endpoints ==============

@router.get("/{pipeline_id}/yaml")
async def get_pipeline_yaml(
    pipeline_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get pipeline YAML configuration."""
    pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    # Handle both dict and object response
    yaml_content = pipeline.get("yaml_config", "") if isinstance(pipeline, dict) else getattr(pipeline, 'yaml', '')
    return {"yaml": yaml_content or ""}


@router.put("/{pipeline_id}/yaml")
async def update_pipeline_yaml(
    pipeline_id: str,
    request: dict,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Update pipeline YAML configuration."""
    try:
        pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        yaml_content = request.get("yaml", "")
        if not yaml_content:
            raise HTTPException(status_code=400, detail="YAML content is required")
        
        # Use the dedicated update_yaml method if available (for DB service)
        if hasattr(service, 'update_pipeline_yaml'):
            try:
                result = await call_service_method(service, 'update_pipeline_yaml', pipeline_id, yaml_content)
                if result:
                    return {"message": "YAML updated", "yaml": yaml_content}
            except Exception as e:
                logger.warning(f"update_pipeline_yaml method failed: {e}, trying fallback")
        
        # Fallback to full update using PipelineUpdate
        try:
            update = PipelineUpdate(yaml=yaml_content)
            result = await call_service_method(service, 'update_pipeline', pipeline_id, update)
            if not result:
                raise HTTPException(status_code=404, detail="Pipeline not found")
            return {"message": "YAML updated", "yaml": yaml_content}
        except Exception as e:
            logger.error(f"PipelineUpdate failed: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to update pipeline: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating pipeline YAML: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update pipeline YAML: {str(e)}")


@router.patch("/{pipeline_id}", response_model=Pipeline)
async def patch_pipeline(
    pipeline_id: str,
    pipeline_update: PipelineUpdate,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Partially update pipeline configuration."""
    pipeline = await call_service_method(service, 'update_pipeline', pipeline_id, pipeline_update)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


# ============== Pipeline Run Endpoints ==============

@router.post("/{pipeline_id}/runs", response_model=PipelineRunSchema)
async def create_pipeline_run(
    pipeline_id: str,
    request: PipelineRunCreate,
    current_user: UserInfo = Depends(get_current_user),
    execution_service: PipelineExecutionService = Depends(get_execution_service_dependency),
):
    """Create and trigger a new pipeline run with real execution."""
    # Use execution service for real pipeline execution
    run = await execution_service.trigger_pipeline(
        pipeline_id=pipeline_id,
        triggered_by=current_user.username,
        branch=request.branch,
        commit_sha=request.commit,
        trigger_type=request.trigger or "manual",
        variables=request.variables,
    )

    if not run:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    return run


@router.post("/{pipeline_id}/trigger", response_model=PipelineRunSchema)
async def trigger_pipeline(
    pipeline_id: str,
    request: PipelineRunCreate,
    current_user: UserInfo = Depends(get_current_user),
    execution_service: PipelineExecutionService = Depends(get_execution_service_dependency),
):
    """Trigger a pipeline run with real execution (alias for POST /runs)."""
    # Use execution service for real pipeline execution
    run = await execution_service.trigger_pipeline(
        pipeline_id=pipeline_id,
        triggered_by=current_user.username,
        branch=request.branch,
        commit_sha=request.commit,
        trigger_type=request.trigger or "manual",
        variables=request.variables,
    )

    if not run:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    return run


@router.get("/{pipeline_id}/runs", response_model=List[PipelineRunSchema])
async def list_pipeline_runs(
    pipeline_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """List all runs for a pipeline."""
    pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    result = await call_service_method(service, 'list_runs', pipeline_id, status=status, page=page, page_size=page_size)
    # Handle both dict response (DB) and list response (in-memory)
    if isinstance(result, dict):
        return result.get("items", [])
    return result


@router.get("/{pipeline_id}/runs/{run_id}", response_model=PipelineRunSchema)
async def get_pipeline_run(
    pipeline_id: str,
    run_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get details of a specific pipeline run."""
    pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    run = await call_service_method(service, 'get_run', run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    # Handle both dict and object response
    run_pipeline_id = run.get("pipeline_id") if isinstance(run, dict) else run.pipeline_id
    if run_pipeline_id != pipeline_id:
        raise HTTPException(status_code=404, detail="Run not found")

    return run


@router.get("/{pipeline_id}/runs/{run_id}/status", response_model=PipelineRunStatus)
async def get_pipeline_run_status(
    pipeline_id: str,
    run_id: str,
    current_user: UserInfo = Depends(get_current_user),
    execution_service: PipelineExecutionService = Depends(get_execution_service_dependency),
):
    """Get real-time status of a pipeline run including background task status."""
    status_info = await execution_service.get_run_status(run_id)
    if not status_info:
        raise HTTPException(status_code=404, detail="Run not found")

    # Calculate progress
    stages = status_info.get("stages", [])
    completed_stages = [s for s in stages if s.get("status") in ["success", "failed"]]
    progress = int((len(completed_stages) / len(stages) * 100)) if stages else 0

    return PipelineRunStatus(
        pipeline_run_id=run_id,
        status=status_info.get("status", "pending"),
        progress_percentage=progress,
    )


@router.post("/{pipeline_id}/runs/{run_id}/cancel")
async def cancel_pipeline_run(
    pipeline_id: str,
    run_id: str,
    current_user: UserInfo = Depends(get_current_user),
    execution_service: PipelineExecutionService = Depends(get_execution_service_dependency),
):
    """Cancel an in-progress pipeline run."""
    result = await execution_service.cancel_run(run_id)
    if not result:
        raise HTTPException(status_code=404, detail="Run not found or not running")
    return {"message": "Run cancelled"}


@router.post("/{pipeline_id}/runs/{run_id}/retry", response_model=PipelineRunSchema)
async def retry_pipeline_run(
    pipeline_id: str,
    run_id: str,
    current_user: UserInfo = Depends(get_current_user),
    execution_service: PipelineExecutionService = Depends(get_execution_service_dependency),
):
    """Retry a failed pipeline run."""
    new_run = await execution_service.retry_run(
        run_id=run_id,
        triggered_by=current_user.username,
    )

    if not new_run:
        raise HTTPException(status_code=404, detail="Run not found or cannot be retried")

    return new_run


# ============== Approval Endpoints ==============

@router.get("/{pipeline_id}/runs/{run_id}/stages/{stage_id}/approvals")
async def get_stage_approvals(
    pipeline_id: str,
    run_id: str,
    stage_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all approvals for a pipeline stage."""
    from app.repositories.pipeline_repository import PipelineRepository
    
    repo = PipelineRepository(db)
    run = await repo.get_run(run_id)
    
    if not run or run.pipeline_id != pipeline_id:
        raise HTTPException(status_code=404, detail="Run not found")
    
    stage = next((s for s in run.stages if s.id == stage_id), None)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    approvals = list(stage.approvals) if stage.approvals else []
    return [a.to_dict() for a in approvals]


@router.post("/{pipeline_id}/runs/{run_id}/stages/{stage_id}/approve")
async def approve_stage(
    pipeline_id: str,
    run_id: str,
    stage_id: str,
    request: dict,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pipeline stage for production deployment."""
    from app.repositories.pipeline_repository import PipelineRepository
    
    repo = PipelineRepository(db)
    run = await repo.get_run(run_id)
    
    if not run or run.pipeline_id != pipeline_id:
        raise HTTPException(status_code=404, detail="Run not found")
    
    stage = next((s for s in run.stages if s.id == stage_id), None)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    if not getattr(stage, 'requires_approval', False):
        raise HTTPException(status_code=400, detail="This stage does not require approval")
    
    # Check if already approved by this user
    existing = await db.execute(
        select(PipelineApproval).where(
            PipelineApproval.stage_id == stage_id,
            PipelineApproval.approver_username == current_user.username,
            PipelineApproval.status == ApprovalStatus.APPROVED
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already approved this stage")
    
    # Create approval
    approval = PipelineApproval(
        stage_id=stage_id,
        run_id=run_id,
        status=ApprovalStatus.APPROVED,
        approver_username=current_user.username,
        approver_email=getattr(current_user, 'email', None),
        approver_role=getattr(current_user, 'role', None),
        comment=request.get("comment"),
        environment=run.environment,
        is_production=run.environment and run.environment.lower() in ["production", "prod"],
    )
    
    db.add(approval)
    await db.commit()
    await db.refresh(approval)

    logger.info(f"Stage {sanitize_log_input(str(stage_id))} approved by {sanitize_log_input(current_user.username)}")

    return approval.to_dict()


@router.post("/{pipeline_id}/runs/{run_id}/stages/{stage_id}/reject")
async def reject_stage(
    pipeline_id: str,
    run_id: str,
    stage_id: str,
    request: dict,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pipeline stage (stops deployment)."""
    from app.repositories.pipeline_repository import PipelineRepository
    
    repo = PipelineRepository(db)
    run = await repo.get_run(run_id)
    
    if not run or run.pipeline_id != pipeline_id:
        raise HTTPException(status_code=404, detail="Run not found")
    
    stage = next((s for s in run.stages if s.id == stage_id), None)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    if not getattr(stage, 'requires_approval', False):
        raise HTTPException(status_code=400, detail="This stage does not require approval")
    
    # Create rejection
    approval = PipelineApproval(
        stage_id=stage_id,
        run_id=run_id,
        status=ApprovalStatus.REJECTED,
        approver_username=current_user.username,
        approver_email=getattr(current_user, 'email', None),
        approver_role=getattr(current_user, 'role', None),
        comment=request.get("comment", "Deployment rejected"),
        environment=run.environment,
        is_production=run.environment and run.environment.lower() in ["production", "prod"],
    )
    
    # Mark stage as failed
    stage.status = StageStatus.FAILED
    stage.error_message = f"Rejected by {current_user.username}: {approval.comment}"
    run.status = PipelineStatus.FAILED
    
    db.add(approval)
    await db.commit()
    await db.refresh(approval)

    logger.info(f"Stage {sanitize_log_input(str(stage_id))} rejected by {sanitize_log_input(current_user.username)}")

    return approval.to_dict()


@router.get("/approvals/pending")
async def get_pending_approvals(
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all pending approvals for the current user."""
    from sqlalchemy.orm import selectinload, joinedload

    # Get stages waiting for approval where user can approve
    # Use eager loading to avoid lazy loading issues in async context
    query = (
        select(PipelineStage)
        .join(PipelineRunModel)
        .options(
            selectinload(PipelineStage.approvals),
            joinedload(PipelineStage.run).joinedload(PipelineRunModel.pipeline),
        )
        .where(
            and_(
                PipelineStage.requires_approval.is_(True),
                PipelineStage.status == StageStatus.PENDING,
                PipelineRunModel.status == PipelineStatus.RUNNING,
            )
        )
    )

    result = await db.execute(query)
    stages = result.unique().scalars().all()

    pending_approvals = []
    for stage in stages:
        # Count current approvals
        approvals = list(stage.approvals) if stage.approvals else []
        approved_count = sum(1 for a in approvals if a.status == ApprovalStatus.APPROVED)
        rejected_count = sum(1 for a in approvals if a.status == ApprovalStatus.REJECTED)

        if rejected_count == 0 and approved_count < stage.required_approvers:
            # Check if user has already approved
            user_approved = any(
                a.approver_username == current_user.username and a.status == ApprovalStatus.APPROVED
                for a in approvals
            )

            if not user_approved:
                pending_approvals.append({
                    "stageId": stage.id,
                    "stageName": stage.name,
                    "runId": stage.run_id,
                    "pipelineId": stage.run.pipeline_id if stage.run else None,
                    "pipelineName": stage.run.pipeline.name if stage.run and stage.run.pipeline else None,
                    "environment": stage.run.environment if stage.run else None,
                    "requiredApprovers": getattr(stage, 'required_approvers', 1) or 1,
                    "currentApprovals": approved_count,
                    "approverRoles": getattr(stage, 'approver_roles', None) or [],
                    "branch": stage.run.branch if stage.run else None,
                    "commit": stage.run.commit_sha if stage.run else None,
                })

    return {"pendingApprovals": pending_approvals}


@router.get("/{pipeline_id}/runs/{run_id}/logs")
async def get_pipeline_run_logs(
    pipeline_id: str,
    run_id: str,
    stage_id: Optional[str] = Query(None, description="Filter by stage"),
    limit: int = Query(100, ge=1, le=1000),
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get logs for a pipeline run."""
    run = await call_service_method(service, 'get_run', run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return await call_service_method(service, 'get_run_logs', run_id, stage_id=stage_id, limit=limit)


@router.get("/{pipeline_id}/runs/{run_id}/logs/stream")
async def stream_pipeline_run_logs(
    pipeline_id: str,
    run_id: str,
    request: Request,
    stage_id: Optional[str] = Query(None, description="Filter by stage"),
    token: Optional[str] = Query(None, description="Auth token (for SSE - EventSource doesn't support headers)"),
    service = Depends(get_pipeline_service_dependency),
):
    """Stream logs for a pipeline run using Server-Sent Events (SSE)."""
    import asyncio
    import json
    from app.core.security import decode_access_token
    from app.core.config import settings
    
    # Authenticate user (supports both header and query param for SSE)
    # EventSource doesn't support custom headers, so we check query param first
    auth_token = None
    if token:
        auth_token = token
    elif request.headers.get("Authorization"):
        # Try to extract from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            auth_token = auth_header[7:]
    
    if not auth_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Decode and validate token
    payload = decode_access_token(auth_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get user - use async context manager properly
    if settings.USE_DATABASE_AUTH:
        from app.core.database import async_session_maker
        from app.services.auth_service_db import DatabaseAuthService
        # Use async context manager to ensure proper session lifecycle
        async with async_session_maker() as session:
            db_auth_service = DatabaseAuthService(session)
            current_user = await db_auth_service.get_user_by_id(user_id)
    else:
        from app.services.auth_service import auth_service
        current_user = await auth_service.get_user_by_id(user_id)
    
    if not current_user or not current_user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    run = await call_service_method(service, 'get_run', run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    async def log_generator():
        """Generate log events as SSE."""
        last_log_count = 0
        max_retries = 300  # 5 minutes with 1-second intervals

        for _ in range(max_retries):
            try:
                logs_data = await call_service_method(
                    service, 'get_run_logs', run_id, stage_id=stage_id, limit=1000
                )
                logs = logs_data.get("logs", []) if isinstance(logs_data, dict) else []

                # Send only new logs
                if len(logs) > last_log_count:
                    new_logs = logs[last_log_count:]
                    for log in new_logs:
                        log_message = log.get("message", str(log)) if isinstance(log, dict) else str(log)
                        event_data = json.dumps({"message": log_message, "stage_id": stage_id})
                        yield f"data: {event_data}\n\n"
                    last_log_count = len(logs)

                # Check if run is complete
                current_run = await call_service_method(service, 'get_run', run_id)
                run_status = current_run.get("status") if isinstance(current_run, dict) else current_run.status
                if run_status in ["success", "failed", "cancelled"]:
                    yield f"data: {json.dumps({'message': '[Run completed]', 'status': run_status})}\n\n"
                    break

                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Error streaming logs: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                break

    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============== Pipeline-specific AI Endpoints ==============

@router.post("/{pipeline_id}/ai/chat")
async def ai_chat_pipeline(
    pipeline_id: str,
    request: dict,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Chat with AI about a specific pipeline."""
    pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    try:
        from app.api.routes.ai import get_gemini_model

        model = get_gemini_model()
        message = request.get("message", "")

        # Handle both dict and object response
        pipeline_name = pipeline.get("name") if isinstance(pipeline, dict) else pipeline.name
        pipeline_yaml = pipeline.get("yaml_config", "") if isinstance(pipeline, dict) else getattr(pipeline, 'yaml', '')

        prompt = f"""You are a CI/CD pipeline expert. The user is asking about pipeline "{pipeline_name}".
Pipeline YAML: {pipeline_yaml or 'Not configured'}
User question: {message}

Provide a helpful, concise response."""

        response = model.generate_content(prompt)
        return {"response": response.text, "success": True}

    except ValueError:
        return {
            "response": "AI assistant is not configured. Please set GEMINI_API_KEY.",
            "success": False,
        }
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        return {"response": f"Error: {str(e)}", "success": False}


@router.post("/{pipeline_id}/ai/optimize")
async def ai_optimize_single_pipeline(
    pipeline_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get AI optimization suggestions for a specific pipeline."""
    pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    try:
        from app.api.routes.ai import get_gemini_model

        model = get_gemini_model()
        # Handle both dict and object response
        pipeline_name = pipeline.get("name") if isinstance(pipeline, dict) else pipeline.name
        pipeline_yaml = pipeline.get("yaml_config", "") if isinstance(pipeline, dict) else getattr(pipeline, 'yaml', '')

        prompt = f"""Analyze this CI/CD pipeline and provide optimization suggestions:

Pipeline: {pipeline_name}
YAML: {pipeline_yaml or 'Not configured'}

Provide 3-5 specific suggestions to improve:
1. Build speed
2. Resource efficiency
3. Security
4. Best practices

Format as a JSON array of suggestion strings."""

        response = model.generate_content(prompt)

        # Try to parse as JSON, fallback to text
        try:
            import json
            suggestions = json.loads(response.text)
        except:
            suggestions = [response.text]

        return {"suggestions": suggestions, "success": True}

    except ValueError:
        return {
            "suggestions": ["Configure GEMINI_API_KEY to use AI optimization"],
            "success": False,
        }
    except Exception as e:
        logger.error(f"AI optimize error: {e}")
        return {"suggestions": [f"Error: {str(e)}"], "success": False}


@router.post("/{pipeline_id}/runs/{run_id}/ai/analyze")
async def ai_analyze_run(
    pipeline_id: str,
    run_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get AI analysis of a pipeline run (especially for failures)."""
    run = await call_service_method(service, 'get_run', run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    logs_data = await call_service_method(service, 'get_run_logs', run_id)
    logs = logs_data.get("logs", [])

    try:
        from app.api.routes.ai import get_gemini_model

        model = get_gemini_model()
        log_text = "\n".join([l.get("message", str(l)) if isinstance(l, dict) else str(l) for l in logs[-50:]])

        # Handle both dict and object response
        pipeline_name = run.get("pipeline_name", "") if isinstance(run, dict) else getattr(run, 'pipeline_name', '')
        run_status = run.get("status") if isinstance(run, dict) else run.status
        run_branch = run.get("branch") if isinstance(run, dict) else run.branch

        prompt = f"""Analyze this CI/CD pipeline run and provide insights:

Pipeline: {pipeline_name}
Status: {run_status}
Branch: {run_branch}
Recent logs:
{log_text}

Provide:
1. A brief summary of what happened
2. If failed, the likely root cause
3. Suggested next steps

Format as JSON with keys: summary, suggestion"""

        response = model.generate_content(prompt)

        try:
            import json
            result = json.loads(response.text)
            return {
                "summary": result.get("summary", response.text),
                "suggestion": result.get("suggestion", ""),
                "success": True,
            }
        except:
            return {
                "summary": response.text,
                "suggestion": "",
                "success": True,
            }

    except ValueError:
        return {
            "summary": f"Pipeline run {run.status}. Configure GEMINI_API_KEY for AI analysis.",
            "suggestion": "",
            "success": False,
        }
    except Exception as e:
        logger.error(f"AI analyze error: {e}")
        return {
            "summary": f"Error analyzing run: {str(e)}",
            "suggestion": "",
            "success": False,
        }


@router.post("/{pipeline_id}/runs/{run_id}/ai/fix")
async def ai_fix_run(
    pipeline_id: str,
    run_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get AI-generated fix suggestions for a failed run."""
    run = await call_service_method(service, 'get_run', run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Handle both dict and object response
    run_status = run.get("status") if isinstance(run, dict) else run.status
    if run_status != "failed":
        return {"fix": "Run is not in failed state", "success": False}

    logs_data = await call_service_method(service, 'get_run_logs', run_id)
    logs = logs_data.get("logs", [])

    try:
        from app.api.routes.ai import get_gemini_model

        model = get_gemini_model()
        log_text = "\n".join([l.get("message", str(l)) if isinstance(l, dict) else str(l) for l in logs[-50:]])

        # Handle both dict and object response
        pipeline_name = run.get("pipeline_name", "") if isinstance(run, dict) else getattr(run, 'pipeline_name', '')

        prompt = f"""A CI/CD pipeline failed. Analyze the logs and provide a fix:

Pipeline: {pipeline_name}
Error logs:
{log_text}

Provide a specific, actionable fix that can be applied. Include code snippets if relevant.
Be concise and practical."""

        response = model.generate_content(prompt)
        return {"fix": response.text, "success": True}

    except ValueError:
        return {
            "fix": "Configure GEMINI_API_KEY to use AI troubleshooting",
            "success": False,
        }
    except Exception as e:
        logger.error(f"AI fix error: {e}")
        return {"fix": f"Error generating fix: {str(e)}", "success": False}


# ============== Statistics ==============

@router.get("/{pipeline_id}/statistics", response_model=PipelineStatistics)
async def get_pipeline_statistics(
    pipeline_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get execution statistics for a pipeline."""
    stats = await call_service_method(service, 'get_pipeline_statistics', pipeline_id, days=days)
    if not stats:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return stats


@router.get("/global/statistics", response_model=dict)
async def get_global_statistics(
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get global pipeline statistics."""
    return await call_service_method(service, 'get_global_statistics')


@router.get("/global/running")
async def get_running_pipelines(
    current_user: UserInfo = Depends(get_current_user),
    execution_service: PipelineExecutionService = Depends(get_execution_service_dependency),
):
    """Get list of currently running pipeline runs."""
    running_ids = await execution_service.get_running_pipelines()
    return {
        "running_count": len(running_ids),
        "run_ids": running_ids,
    }


# ============== AI-Powered Endpoints ==============

@router.post("/ai/generate")
async def ai_generate_pipeline(
    request: dict,
    current_user: UserInfo = Depends(get_current_user),
):
    """Generate pipeline YAML using AI."""
    try:
        from app.api.routes.ai import get_gemini_model

        model = get_gemini_model()
        description = request.get("description", "")
        deployment_target = request.get("deployment_target", "Kubernetes")

        prompt = f"""Generate a GitHub Actions CI/CD pipeline YAML for:
Description: {description}
Target: {deployment_target}

Include: checkout, build, test, deploy stages.
Return ONLY valid YAML."""

        response = model.generate_content(prompt)

        return {
            "yaml": response.text,
            "success": True,
        }
    except ValueError:
        return {
            "yaml": "# AI not configured\nname: CI\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest",
            "success": False,
            "note": "AI generation not available. Configure GEMINI_API_KEY.",
        }
    except Exception as e:
        logger.error(f"AI generation error: {e}")
        raise HTTPException(status_code=500, detail="AI generation failed")


@router.post("/ai/optimize")
async def ai_optimize_pipeline(
    request: dict,
    current_user: UserInfo = Depends(get_current_user),
):
    """Optimize pipeline using AI."""
    try:
        from app.api.routes.ai import get_gemini_model

        model = get_gemini_model()
        pipeline_id = request.get("pipeline_id")

        prompt = f"Optimize this CI/CD pipeline for speed and efficiency: {pipeline_id}"
        response = model.generate_content(prompt)

        return {
            "recommendations": response.text,
            "success": True,
        }
    except ValueError:
        return {
            "recommendations": "Configure GEMINI_API_KEY to use AI optimization",
            "success": False,
        }
    except Exception as e:
        logger.error(f"AI optimization error: {e}")
        raise HTTPException(status_code=500, detail="Optimization failed")


@router.post("/ai/fix")
async def ai_fix_pipeline(
    request: dict,
    current_user: UserInfo = Depends(get_current_user),
):
    """Fix failing pipeline using AI."""
    try:
        from app.api.routes.ai import get_gemini_model

        model = get_gemini_model()
        error_message = request.get("error_message", "")

        prompt = f"How to fix this CI/CD error: {error_message}"
        response = model.generate_content(prompt)

        return {
            "fix": response.text,
            "success": True,
        }
    except ValueError:
        return {
            "fix": "Configure GEMINI_API_KEY to use AI troubleshooting",
            "success": False,
        }
    except Exception as e:
        logger.error(f"AI fix error: {e}")
        raise HTTPException(status_code=500, detail="Fix generation failed")


# ============== GitHub Integration Endpoints ==============

@router.get("/github/repos")
async def list_github_repos(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    current_user: UserInfo = Depends(get_current_user),
):
    """List GitHub repositories for connected account."""
    try:
        repos = await github_service.get_user_repos(page=page, per_page=per_page)
        return {"repositories": [repo.dict() for repo in repos]}
    except Exception as e:
        logger.error(f"GitHub repos error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch repositories")


@router.get("/github/repos/{owner}/{repo}")
async def get_github_repo(
    owner: str,
    repo: str,
    current_user: UserInfo = Depends(get_current_user),
):
    """Get GitHub repository details."""
    try:
        repository = await github_service.get_repo(owner, repo)
        return repository.dict()
    except Exception as e:
        logger.error(f"GitHub repo error: {e}")
        raise HTTPException(status_code=404, detail="Repository not found")


@router.get("/github/repos/{owner}/{repo}/branches")
async def list_github_branches(
    owner: str,
    repo: str,
    current_user: UserInfo = Depends(get_current_user),
):
    """List branches for a GitHub repository."""
    try:
        branches = await github_service.get_branches(owner, repo)
        return {"branches": [b.dict() for b in branches]}
    except Exception as e:
        logger.error(f"GitHub branches error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch branches")


@router.get("/github/repos/{owner}/{repo}/commits")
async def list_github_commits(
    owner: str,
    repo: str,
    branch: Optional[str] = None,
    limit: int = Query(10, ge=1, le=100),
    current_user: UserInfo = Depends(get_current_user),
):
    """List recent commits for a GitHub repository."""
    try:
        commits = await github_service.get_commits(owner, repo, branch=branch, limit=limit)
        return {"commits": [c.dict() for c in commits]}
    except Exception as e:
        logger.error(f"GitHub commits error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch commits")


@router.get("/github/repos/{owner}/{repo}/pipeline-file")
async def get_github_pipeline_file(
    owner: str,
    repo: str,
    ref: Optional[str] = None,
    current_user: UserInfo = Depends(get_current_user),
):
    """Try to find pipeline configuration file in repository."""
    try:
        content = await github_service.get_pipeline_file(owner, repo, ref=ref)
        if content:
            return {"found": True, "content": content}
        return {"found": False, "content": None}
    except Exception as e:
        logger.error(f"GitHub pipeline file error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch pipeline file")


@router.post("/github/repos/{owner}/{repo}/webhook")
async def create_github_webhook(
    owner: str,
    repo: str,
    current_user: UserInfo = Depends(get_current_user),
):
    """Create webhook for GitHub repository."""
    try:
        # Generate webhook secret
        webhook_secret = secrets.token_hex(32)

        # Build webhook URL
        base_url = getattr(settings, 'API_BASE_URL', 'http://localhost:8000')
        webhook_url = f"{base_url}/api/v1/pipelines/webhook/github"

        webhook = await github_service.create_webhook(
            owner, repo, webhook_url, webhook_secret
        )

        return {
            "webhook_id": webhook.id,
            "webhook_url": webhook_url,
            "secret": webhook_secret,
            "events": webhook.events,
            "message": "Webhook created successfully"
        }
    except Exception as e:
        logger.error(f"GitHub webhook creation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create webhook")


@router.delete("/github/repos/{owner}/{repo}/webhook/{hook_id}")
async def delete_github_webhook(
    owner: str,
    repo: str,
    hook_id: int,
    current_user: UserInfo = Depends(get_current_user),
):
    """Delete webhook from GitHub repository."""
    try:
        success = await github_service.delete_webhook(owner, repo, hook_id)
        if success:
            return {"message": "Webhook deleted"}
        raise HTTPException(status_code=404, detail="Webhook not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GitHub webhook deletion error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete webhook")


@router.post("/webhook/github")
async def github_webhook_handler(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Handle incoming GitHub webhooks."""
    try:
        # Get webhook payload
        payload = await request.body()
        headers = dict(request.headers)

        # Parse event
        event_type = headers.get("x-github-event", "")
        signature = headers.get("x-hub-signature-256", "")
        delivery_id = headers.get("x-github-delivery", "")
        data = await request.json()

        logger.info(f"Received GitHub webhook: {event_type} (delivery: {delivery_id})")

        # Get appropriate service
        if USE_DATABASE_PIPELINES:
            from app.services.pipeline_service_db import PipelineServiceDB
            service = PipelineServiceDB(db)
        else:
            service = get_pipeline_service()

        if event_type == "push":
            # Extract push details
            repo_url = data.get("repository", {}).get("clone_url", "")
            repo_name = data.get("repository", {}).get("full_name", "")
            branch = data.get("ref", "").replace("refs/heads/", "")
            commit_sha = data.get("after", "")
            commit_message = data.get("head_commit", {}).get("message", "")[:100] if data.get("head_commit") else ""
            pusher = data.get("pusher", {}).get("name", "webhook")

            logger.info(f"Push to {sanitize_log_input(repo_name)}/{sanitize_log_input(branch)} - commit {sanitize_log_input(commit_sha[:7])}")

            # Find pipelines that match this repository and branch
            pipelines = await call_service_method(service, 'list_pipelines')
            items = pipelines.get("items", []) if isinstance(pipelines, dict) else pipelines

            triggered_runs = []
            for pipeline in items:
                p_repo = pipeline.get("repository") if isinstance(pipeline, dict) else getattr(pipeline, 'repository', '')
                p_branch = pipeline.get("branch") if isinstance(pipeline, dict) else getattr(pipeline, 'branch', 'main')
                p_id = pipeline.get("id") if isinstance(pipeline, dict) else pipeline.id

                # Check if repository matches (compare URLs or names)
                repo_match = (
                    p_repo and (
                        repo_url in p_repo or
                        p_repo in repo_url or
                        repo_name in p_repo or
                        p_repo.endswith(f"/{repo_name}") or
                        p_repo.endswith(f"/{repo_name}.git")
                    )
                )

                # Check branch match (support wildcards like "main", "*", "feature/*")
                branch_match = (
                    p_branch == branch or
                    p_branch == "*" or
                    (p_branch.endswith("/*") and branch.startswith(p_branch[:-2]))
                )

                if repo_match and branch_match:
                    # Verify webhook signature if secret is stored
                    p_webhook_secret = pipeline.get("webhook_secret") if isinstance(pipeline, dict) else getattr(pipeline, 'webhook_secret', None)
                    if p_webhook_secret and signature:
                        if not GitHubService.verify_webhook_signature(payload, signature, p_webhook_secret):
                            logger.warning(f"Invalid webhook signature for pipeline {p_id}")
                            continue

                    # Trigger the pipeline
                    run_request = PipelineRunCreate(
                        pipeline_id=p_id,
                        branch=branch,
                        commit=commit_sha[:7],
                        trigger="push",
                    )
                    run = await call_service_method(
                        service, 'trigger_pipeline',
                        p_id,
                        run_request,
                        triggered_by=f"github:{pusher}",
                    )
                    run_id = run.get("id") if isinstance(run, dict) else run.id
                    triggered_runs.append({"pipeline_id": p_id, "run_id": run_id})
                    logger.info(f"Triggered pipeline {p_id} run {run_id}")

            return {
                "status": "processed",
                "event": event_type,
                "repository": repo_name,
                "branch": branch,
                "commit": commit_sha[:7],
                "triggered_runs": triggered_runs,
            }

        elif event_type == "pull_request":
            action = data.get("action", "")
            pr_number = data.get("number", 0)
            pr_branch = data.get("pull_request", {}).get("head", {}).get("ref", "")
            repo_name = data.get("repository", {}).get("full_name", "")
            repo_url = data.get("repository", {}).get("clone_url", "")
            commit_sha = data.get("pull_request", {}).get("head", {}).get("sha", "")
            author = data.get("pull_request", {}).get("user", {}).get("login", "webhook")

            logger.info(f"PR #{sanitize_log_input(str(pr_number))} {sanitize_log_input(action)} on {sanitize_log_input(repo_name)}")

            # Only trigger on specific actions
            if action not in ["opened", "synchronize", "reopened"]:
                return {"status": "ignored", "event": event_type, "action": action}

            # Find matching pipelines with PR trigger
            pipelines = await call_service_method(service, 'list_pipelines')
            items = pipelines.get("items", []) if isinstance(pipelines, dict) else pipelines

            triggered_runs = []
            for pipeline in items:
                p_repo = pipeline.get("repository") if isinstance(pipeline, dict) else getattr(pipeline, 'repository', '')
                p_id = pipeline.get("id") if isinstance(pipeline, dict) else pipeline.id

                # Check repository match
                repo_match = (
                    p_repo and (
                        repo_url in p_repo or
                        p_repo in repo_url or
                        repo_name in p_repo
                    )
                )

                if repo_match:
                    # Trigger the pipeline
                    run_request = PipelineRunCreate(
                        pipeline_id=p_id,
                        branch=pr_branch,
                        commit=commit_sha[:7] if commit_sha else None,
                        trigger="pull_request",
                    )
                    run = await call_service_method(
                        service, 'trigger_pipeline',
                        p_id,
                        run_request,
                        triggered_by=f"github:pr#{pr_number}:{author}",
                    )
                    run_id = run.get("id") if isinstance(run, dict) else run.id
                    triggered_runs.append({"pipeline_id": p_id, "run_id": run_id})
                    logger.info(f"Triggered pipeline {sanitize_log_input(str(p_id))} run {sanitize_log_input(str(run_id))} for PR #{sanitize_log_input(str(pr_number))}")

            return {
                "status": "processed",
                "event": event_type,
                "action": action,
                "pr_number": pr_number,
                "repository": repo_name,
                "branch": pr_branch,
                "triggered_runs": triggered_runs,
            }

        elif event_type == "ping":
            # GitHub sends ping when webhook is first created
            return {
                "status": "pong",
                "event": event_type,
                "zen": data.get("zen", ""),
                "hook_id": data.get("hook_id"),
            }

        return {"status": "received", "event": event_type}

    except Exception as e:
        logger.error(f"Webhook handler error: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")


# ============== Pipeline Execution Endpoints ==============

@router.post("/{pipeline_id}/execute")
async def execute_pipeline(
    pipeline_id: str,
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Execute pipeline using Kubernetes Jobs."""
    pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    # Get pipeline YAML - handle both dict and object response
    pipeline_yaml = pipeline.get("yaml_config", "") if isinstance(pipeline, dict) else getattr(pipeline, 'yaml', '')
    yaml_content = request.get("yaml") or pipeline_yaml
    branch = request.get("branch", "main")
    commit = request.get("commit")

    if not yaml_content:
        raise HTTPException(status_code=400, detail="No pipeline YAML configured")

    # Start execution in background
    async def run_pipeline():
        async for result in pipeline_executor.execute_pipeline(
            yaml_content,
            trigger="manual",
            branch=branch,
            commit=commit
        ):
            # Store intermediate results
            logger.info(f"Pipeline {pipeline_id} - {result.status}")

    background_tasks.add_task(run_pipeline)

    return {
        "message": "Pipeline execution started",
        "pipeline_id": pipeline_id,
        "branch": branch,
    }


@router.get("/{pipeline_id}/webhook-url")
async def get_pipeline_webhook_url(
    pipeline_id: str,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get webhook URL for pipeline triggers."""
    pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    base_url = getattr(settings, 'API_BASE_URL', 'http://localhost:8000')
    webhook_url = f"{base_url}/api/v1/pipelines/{pipeline_id}/webhook"

    return {
        "webhook_url": webhook_url,
        "events": ["push", "pull_request"],
        "instructions": "Add this URL to your Git provider's webhook settings"
    }


@router.post("/{pipeline_id}/webhook")
async def pipeline_webhook_trigger(
    pipeline_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Generic webhook endpoint for pipeline triggers."""
    try:
        data = await request.json()
        headers = dict(request.headers)

        # Detect webhook source
        if "x-github-event" in headers:
            source = "github"
        elif "x-gitlab-event" in headers:
            source = "gitlab"
        else:
            source = "generic"

        logger.info(f"Pipeline webhook triggered: {sanitize_log_input(str(pipeline_id))} from {sanitize_log_input(source)}")

        # TODO: Trigger pipeline execution

        return {"status": "received", "pipeline_id": pipeline_id, "source": source}

    except Exception as e:
        logger.error(f"Pipeline webhook error: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")


# ============== Pipeline Templates ==============

@router.get("/templates/list")
async def list_pipeline_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    featured_only: bool = Query(False, description="Show featured templates only"),
    current_user: UserInfo = Depends(get_current_user),
):
    """List available pipeline templates."""
    # Import templates from seed file
    from app.services.seed_templates import PIPELINE_TEMPLATES

    templates = PIPELINE_TEMPLATES

    if category:
        templates = [t for t in templates if t.get("category") == category]

    if featured_only:
        templates = [t for t in templates if t.get("is_featured", False)]

    return {
        "templates": templates,
        "total": len(templates),
        "categories": list(set(t.get("category", "other") for t in PIPELINE_TEMPLATES)),
    }


@router.get("/templates/{template_name}")
async def get_pipeline_template(
    template_name: str,
    current_user: UserInfo = Depends(get_current_user),
):
    """Get a specific pipeline template."""
    from app.services.seed_templates import PIPELINE_TEMPLATES

    template = next(
        (t for t in PIPELINE_TEMPLATES if t["name"].lower().replace(" ", "-") == template_name.lower()
         or t["name"].lower() == template_name.lower()),
        None
    )

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.post("/templates/{template_name}/use")
async def use_pipeline_template(
    template_name: str,
    request: dict,
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Create a new pipeline from a template."""
    from app.services.seed_templates import PIPELINE_TEMPLATES

    template = next(
        (t for t in PIPELINE_TEMPLATES if t["name"].lower().replace(" ", "-") == template_name.lower()
         or t["name"].lower() == template_name.lower()),
        None
    )

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Create pipeline from template
    pipeline_data = PipelineCreate(
        name=request.get("name", template["name"]),
        description=request.get("description", template["description"]),
        repository=request.get("repository", ""),
        branch=request.get("branch", "main"),
        provider=request.get("provider", "github"),
        yaml=template["yaml_template"],
    )

    pipeline = await call_service_method(service, 'create_pipeline', pipeline_data)
    return pipeline


# ============== Pipeline Analytics ==============

@router.get("/{pipeline_id}/analytics")
async def get_pipeline_analytics(
    pipeline_id: str,
    days: int = Query(14, ge=1, le=90, description="Number of days for analytics"),
    current_user: UserInfo = Depends(get_current_user),
    service = Depends(get_pipeline_service_dependency),
):
    """Get detailed analytics for a pipeline."""
    pipeline = await call_service_method(service, 'get_pipeline', pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    stats = await call_service_method(service, 'get_pipeline_statistics', pipeline_id, days=days)

    # Generate daily breakdown (mock for now, would come from DB in production)
    import random
    from datetime import datetime, timedelta

    daily_stats = []
    today = datetime.now()

    for i in range(days - 1, -1, -1):
        date = today - timedelta(days=i)
        total = random.randint(5, 20)
        success = int(total * (0.7 + random.random() * 0.25))
        daily_stats.append({
            "date": date.strftime("%Y-%m-%d"),
            "success": success,
            "failed": total - success,
            "total": total,
        })

    total_runs = sum(d["total"] for d in daily_stats)
    successful_runs = sum(d["success"] for d in daily_stats)

    # Handle both dict and object response
    pipeline_name = pipeline.get("name") if isinstance(pipeline, dict) else pipeline.name

    return {
        "pipeline_id": pipeline_id,
        "pipeline_name": pipeline_name,
        "period_days": days,
        "stats": {
            "total_runs": total_runs,
            "successful_runs": successful_runs,
            "failed_runs": total_runs - successful_runs,
            "success_rate": round((successful_runs / total_runs * 100) if total_runs > 0 else 0, 1),
            "avg_duration": stats.avg_duration if stats else "3m 45s",
            "trend": "up" if random.random() > 0.3 else "down",
            "trend_value": random.randint(1, 15),
        },
        "daily_stats": daily_stats,
    }

