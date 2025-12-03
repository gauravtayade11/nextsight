"""
Helm API routes for chart deployment management.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_user, require_permission
from app.schemas.auth import UserInfo
from app.schemas.helm import (
    ChartInfo,
    ChartListResponse,
    ChartSearchResult,
    HelmOperationResult,
    InstallRequest,
    ReleaseHistory,
    ReleaseInfo,
    ReleaseListResponse,
    ReleaseValues,
    Repository,
    RepositoryListResponse,
    RollbackRequest,
    UninstallRequest,
    UpgradeRequest,
)
from app.services.helm_service import helm_service

router = APIRouter(prefix="/helm", tags=["helm"])


# ============== Releases ==============


@router.get("/releases", response_model=ReleaseListResponse)
async def list_releases(
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    all_namespaces: bool = Query(True, description="List releases in all namespaces"),
    current_user: UserInfo = Depends(get_current_user),
):
    """List all Helm releases."""
    releases = await helm_service.list_releases(namespace=namespace, all_namespaces=all_namespaces)
    return ReleaseListResponse(releases=releases, total=len(releases))


@router.get("/releases/{namespace}/{name}", response_model=ReleaseInfo)
async def get_release(
    namespace: str,
    name: str,
    current_user: UserInfo = Depends(get_current_user),
):
    """Get details of a specific release."""
    release = await helm_service.get_release(name, namespace)
    if not release:
        raise HTTPException(status_code=404, detail=f"Release {name} not found in namespace {namespace}")
    return release


@router.get("/releases/{namespace}/{name}/history", response_model=List[ReleaseHistory])
async def get_release_history(
    namespace: str,
    name: str,
    current_user: UserInfo = Depends(get_current_user),
):
    """Get revision history for a release."""
    return await helm_service.get_release_history(name, namespace)


@router.get("/releases/{namespace}/{name}/values", response_model=ReleaseValues)
async def get_release_values(
    namespace: str,
    name: str,
    all_values: bool = Query(False, description="Include computed values"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get values for a release."""
    return await helm_service.get_release_values(name, namespace, all_values)


@router.post("/releases", response_model=HelmOperationResult)
async def install_release(
    request: InstallRequest,
    current_user: UserInfo = Depends(require_permission("helm:install")),
):
    """Install a new Helm release."""
    return await helm_service.install(request)


@router.put("/releases/{namespace}/{name}", response_model=HelmOperationResult)
async def upgrade_release(
    namespace: str,
    name: str,
    request: UpgradeRequest,
    current_user: UserInfo = Depends(require_permission("helm:upgrade")),
):
    """Upgrade an existing Helm release."""
    return await helm_service.upgrade(name, namespace, request)


@router.post("/releases/{namespace}/{name}/rollback", response_model=HelmOperationResult)
async def rollback_release(
    namespace: str,
    name: str,
    request: RollbackRequest,
    current_user: UserInfo = Depends(require_permission("helm:rollback")),
):
    """Rollback a release to a specific revision."""
    return await helm_service.rollback(name, namespace, request)


@router.delete("/releases/{namespace}/{name}", response_model=HelmOperationResult)
async def uninstall_release(
    namespace: str,
    name: str,
    keep_history: bool = Query(False),
    dry_run: bool = Query(False),
    current_user: UserInfo = Depends(require_permission("helm:uninstall")),
):
    """Uninstall a Helm release."""
    request = UninstallRequest(keep_history=keep_history, dry_run=dry_run)
    return await helm_service.uninstall(name, namespace, request)


# ============== Repositories ==============


@router.get("/repositories", response_model=RepositoryListResponse)
async def list_repositories(
    current_user: UserInfo = Depends(get_current_user),
):
    """List configured Helm repositories."""
    repos = await helm_service.list_repositories()
    return RepositoryListResponse(repositories=repos)


@router.post("/repositories")
async def add_repository(
    name: str = Query(..., description="Repository name"),
    url: str = Query(..., description="Repository URL"),
    current_user: UserInfo = Depends(require_permission("helm:manage_repos")),
):
    """Add a Helm repository."""
    success = await helm_service.add_repository(name, url)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to add repository {name}")
    return {"success": True, "message": f"Repository {name} added successfully"}


@router.delete("/repositories/{name}")
async def remove_repository(
    name: str,
    current_user: UserInfo = Depends(require_permission("helm:manage_repos")),
):
    """Remove a Helm repository."""
    success = await helm_service.remove_repository(name)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to remove repository {name}")
    return {"success": True, "message": f"Repository {name} removed successfully"}


# ============== Charts ==============


@router.get("/charts/search", response_model=List[ChartSearchResult])
async def search_charts(
    query: str = Query(..., description="Search query"),
    repository: Optional[str] = Query(None, description="Filter by repository"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Search for charts in repositories."""
    return await helm_service.search_charts(query, repository)


@router.get("/charts/{chart}/info", response_model=ChartInfo)
async def get_chart_info(
    chart: str,
    repository: Optional[str] = Query(None, description="Repository URL"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get detailed information about a chart."""
    info = await helm_service.get_chart_info(chart, repository)
    if not info:
        raise HTTPException(status_code=404, detail=f"Chart {chart} not found")
    return info


@router.get("/charts/{chart}/values", response_model=Dict[str, Any])
async def get_chart_values(
    chart: str,
    repository: Optional[str] = Query(None, description="Repository URL"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get default values for a chart."""
    return await helm_service.get_chart_values(chart, repository)
