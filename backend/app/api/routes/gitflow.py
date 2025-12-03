from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.gitflow import (
    BranchType,
    CreateReleaseRequest,
    GitFlowBranch,
    GitFlowConfig,
    PromoteRequest,
    ReleaseCandidate,
    ReleaseHistory,
    ReleaseStatus,
)
from app.services.gitflow_service import gitflow_service

router = APIRouter()


@router.get("/config", response_model=GitFlowConfig)
async def get_gitflow_config():
    """Get current GitFlow configuration."""
    return gitflow_service.config


@router.put("/config", response_model=GitFlowConfig)
async def update_gitflow_config(config: GitFlowConfig):
    """Update GitFlow configuration."""
    gitflow_service.config = config
    return config


@router.get("/branches", response_model=List[GitFlowBranch])
async def list_branches(branch_type: Optional[BranchType] = Query(None)):
    """List branches, optionally filtered by type."""
    return await gitflow_service.get_branches(branch_type)


@router.get("/branches/{branch_type}", response_model=List[GitFlowBranch])
async def list_branches_by_type(branch_type: BranchType):
    """List branches of a specific type."""
    return await gitflow_service.get_branches(branch_type)


@router.post("/releases", response_model=ReleaseCandidate)
async def create_release(request: CreateReleaseRequest):
    """Create a new release from develop branch."""
    try:
        return await gitflow_service.create_release(
            version=request.version,
            source_branch=request.source_branch,
            changelog=request.changelog,
            auto_create_branch=request.auto_create_branch,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/releases", response_model=ReleaseHistory)
async def list_releases(status: Optional[ReleaseStatus] = Query(None), limit: int = Query(20, ge=1, le=100)):
    """List all releases."""
    return await gitflow_service.get_releases(status, limit)


@router.get("/releases/{release_id}", response_model=ReleaseCandidate)
async def get_release(release_id: str):
    """Get details of a specific release."""
    release = await gitflow_service.get_release(release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    return release


@router.post("/releases/{release_id}/approve", response_model=ReleaseCandidate)
async def approve_release(release_id: str, approved_by: str = Query(...)):
    """Approve a release for deployment."""
    try:
        return await gitflow_service.approve_release(release_id, approved_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/releases/{release_id}/finish", response_model=ReleaseCandidate)
async def finish_release(release_id: str):
    """Finish a release - merge to main, tag, and merge back to develop."""
    try:
        return await gitflow_service.finish_release(release_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hotfix", response_model=ReleaseCandidate)
async def create_hotfix(
    version: str = Query(..., pattern=r"^\d+\.\d+\.\d+(-hotfix\.\d+)?$"), description: str = Query(..., min_length=10)
):
    """Create a hotfix branch from main."""
    try:
        return await gitflow_service.create_hotfix(version, description)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hotfix/{release_id}/finish", response_model=ReleaseCandidate)
async def finish_hotfix(release_id: str):
    """Finish a hotfix - merge to main and develop, create tag."""
    try:
        return await gitflow_service.finish_hotfix(release_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/versions")
async def get_current_versions():
    """Get current version tags."""
    return await gitflow_service.get_current_versions()


@router.post("/promote")
async def promote_release(request: PromoteRequest):
    """Promote a release from one environment to another."""
    release = await gitflow_service.get_release(request.release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    return {
        "release_id": request.release_id,
        "from_environment": request.from_environment.value,
        "to_environment": request.to_environment.value,
        "approval_required": request.approval_required,
        "status": "pending_approval" if request.approval_required else "ready",
        "message": f"Release {release.version} ready for promotion",
    }
