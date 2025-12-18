"""
ArgoCD API routes for GitOps deployment management.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.schemas.argocd import (
    Application,
    ApplicationEventsResponse,
    ApplicationListResponse,
    ArgoCDConfig,
    ArgoCDStatus,
    CreateApplicationRequest,
    ProjectListResponse,
    RevisionHistoryResponse,
    RollbackRequest,
    SyncRequest,
    SyncResult,
)
from app.schemas.auth import UserInfo
from app.services.argocd_service import ArgoCDService, get_argocd_service
from app.services.argocd_deployment_service import get_argocd_deployment_service


# Request/Response models for deployment
class ArgoCDDeployRequest(BaseModel):
    """Request to deploy ArgoCD."""
    namespace: str = Field(default="argocd", description="Namespace for ArgoCD")
    release_name: str = Field(default="argocd", description="Helm release name")
    version: Optional[str] = Field(default=None, description="Chart version")
    expose_type: str = Field(default="ClusterIP", description="Service type: ClusterIP, LoadBalancer, NodePort")
    admin_password: Optional[str] = Field(default=None, description="Admin password (auto-generated if not provided)")
    ha_enabled: bool = Field(default=False, description="Enable high availability")
    insecure: bool = Field(default=True, description="Run without TLS (for development)")
    values: Optional[Dict[str, Any]] = Field(default=None, description="Custom Helm values")


class ArgoCDDeploymentStatus(BaseModel):
    """ArgoCD deployment status."""
    deployed: bool
    release_name: Optional[str] = None
    namespace: Optional[str] = None
    status: Optional[str] = None
    chart_version: Optional[str] = None
    app_version: Optional[str] = None
    server_url: Optional[str] = None
    updated: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


class ArgoCDDeployResult(BaseModel):
    """Result of ArgoCD deployment."""
    success: bool
    message: str
    release_name: Optional[str] = None
    namespace: Optional[str] = None
    server_url: Optional[str] = None
    admin_username: Optional[str] = None
    admin_password: Optional[str] = None
    chart_version: Optional[str] = None
    notes: Optional[str] = None

router = APIRouter(prefix="/argocd", tags=["argocd"])

# In-memory storage for ArgoCD configuration (can be moved to database later)
_argocd_config: Optional[ArgoCDConfig] = None


def get_argocd_config() -> Optional[ArgoCDConfig]:
    """Get current ArgoCD configuration."""
    return _argocd_config


async def get_configured_service() -> ArgoCDService:
    """Get configured ArgoCD service or raise error if not configured."""
    config = get_argocd_config()
    if not config:
        raise HTTPException(
            status_code=400,
            detail="ArgoCD is not configured. Please configure ArgoCD server connection first.",
        )
    return get_argocd_service(config)


# ============== Configuration ==============


@router.post("/config", response_model=ArgoCDStatus)
async def configure_argocd(
    config: ArgoCDConfig,
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Configure ArgoCD server connection.
    Requires admin role.
    """
    global _argocd_config

    service = ArgoCDService(
        server_url=config.server_url,
        token=config.token,
        username=config.username,
        password=config.password,
        insecure=config.insecure,
    )

    # Verify connection
    status = await service.check_connection()

    if status.connected:
        _argocd_config = config

    return status


@router.get("/config/status", response_model=ArgoCDStatus)
async def get_argocd_status(
    current_user: UserInfo = Depends(get_current_user),
):
    """Get ArgoCD connection status."""
    config = get_argocd_config()

    if not config:
        return ArgoCDStatus(
            connected=False,
            message="ArgoCD not configured",
        )

    service = get_argocd_service(config)
    return await service.check_connection()


@router.delete("/config")
async def disconnect_argocd(
    current_user: UserInfo = Depends(get_current_user),
):
    """Disconnect from ArgoCD server."""
    global _argocd_config
    _argocd_config = None
    return {"message": "ArgoCD configuration removed"}


# ============== Applications ==============


@router.get("/applications", response_model=ApplicationListResponse)
async def list_applications(
    project: Optional[str] = Query(None, description="Filter by project"),
    selector: Optional[str] = Query(None, description="Label selector"),
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """List all ArgoCD applications."""
    return await service.list_applications(project=project, selector=selector)


@router.get("/applications/{name}", response_model=Application)
async def get_application(
    name: str,
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Get details of a specific application."""
    app = await service.get_application(name)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application '{name}' not found")
    return app


@router.post("/applications", response_model=Application)
async def create_application(
    request: CreateApplicationRequest,
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Create a new ArgoCD application."""
    success, app, error = await service.create_application(request)
    if not success:
        raise HTTPException(status_code=400, detail=error)
    if not app:
        raise HTTPException(status_code=500, detail="Application created but failed to retrieve details")
    return app


@router.delete("/applications/{name}")
async def delete_application(
    name: str,
    cascade: bool = Query(True, description="Delete application resources"),
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Delete an ArgoCD application."""
    success, message = await service.delete_application(name, cascade=cascade)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


# ============== Sync Operations ==============


@router.post("/applications/{name}/sync", response_model=SyncResult)
async def sync_application(
    name: str,
    request: Optional[SyncRequest] = None,
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Sync an application to its target state."""
    return await service.sync_application(name, request)


@router.post("/applications/{name}/refresh")
async def refresh_application(
    name: str,
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Refresh application to get latest status from Git."""
    success, message = await service.refresh_application(name)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@router.delete("/applications/{name}/operation")
async def terminate_operation(
    name: str,
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Terminate a running operation on an application."""
    success, message = await service.terminate_operation(name)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


# ============== History & Rollback ==============


@router.get("/applications/{name}/history", response_model=RevisionHistoryResponse)
async def get_application_history(
    name: str,
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Get application revision history."""
    return await service.get_application_history(name)


@router.post("/applications/{name}/rollback")
async def rollback_application(
    name: str,
    request: RollbackRequest,
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Rollback application to a previous revision."""
    success, message = await service.rollback_application(name, request)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


# ============== Events & Resources ==============


@router.get("/applications/{name}/events", response_model=ApplicationEventsResponse)
async def get_application_events(
    name: str,
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Get application events."""
    return await service.get_application_events(name)


@router.get("/applications/{name}/resource-tree")
async def get_resource_tree(
    name: str,
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """Get application resource tree."""
    tree = await service.get_application_resource_tree(name)
    if not tree:
        raise HTTPException(status_code=404, detail="Resource tree not available")
    return tree


# ============== Projects ==============


@router.get("/projects", response_model=ProjectListResponse)
async def list_projects(
    current_user: UserInfo = Depends(get_current_user),
    service: ArgoCDService = Depends(get_configured_service),
):
    """List all ArgoCD projects."""
    return await service.list_projects()


# ============== Deployment Management ==============


@router.get("/deployment/status", response_model=ArgoCDDeploymentStatus)
async def get_deployment_status(
    namespace: str = Query("argocd", description="ArgoCD namespace"),
    release_name: str = Query("argocd", description="Helm release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Check if ArgoCD is deployed and get its status."""
    try:
        deployment_service = get_argocd_deployment_service()
        result = await deployment_service.get_deployment_status(
            namespace=namespace,
            release_name=release_name,
        )

        # Convert datetime to string if present
        if result.get("updated") and hasattr(result["updated"], "isoformat"):
            result["updated"] = result["updated"].isoformat()

        return ArgoCDDeploymentStatus(**result)
    except Exception as e:
        # Return a proper error response instead of 500
        return ArgoCDDeploymentStatus(
            deployed=False,
            message=f"Failed to check deployment status: {str(e)}",
            error=str(e),
        )


@router.post("/deployment/deploy", response_model=ArgoCDDeployResult)
async def deploy_argocd(
    request: ArgoCDDeployRequest,
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Deploy ArgoCD to the cluster using Helm.
    This will install a new ArgoCD instance managed by NextSight AI.
    """
    deployment_service = get_argocd_deployment_service()
    result = await deployment_service.deploy(
        namespace=request.namespace,
        release_name=request.release_name,
        version=request.version,
        values=request.values,
        expose_type=request.expose_type,
        admin_password=request.admin_password,
        ha_enabled=request.ha_enabled,
        insecure=request.insecure,
    )

    # If deployment successful, auto-configure connection
    if result.get("success") and result.get("server_url"):
        global _argocd_config
        _argocd_config = ArgoCDConfig(
            server_url=result["server_url"],
            username="admin",
            password=result.get("admin_password"),
            insecure=request.insecure,
        )

    return ArgoCDDeployResult(**result)


@router.post("/deployment/upgrade", response_model=ArgoCDDeployResult)
async def upgrade_argocd(
    namespace: str = Query("argocd", description="ArgoCD namespace"),
    release_name: str = Query("argocd", description="Helm release name"),
    version: Optional[str] = Query(None, description="Target chart version"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Upgrade ArgoCD to a new version."""
    deployment_service = get_argocd_deployment_service()
    result = await deployment_service.upgrade(
        namespace=namespace,
        release_name=release_name,
        version=version,
    )
    return ArgoCDDeployResult(**result)


@router.delete("/deployment/uninstall")
async def uninstall_argocd(
    namespace: str = Query("argocd", description="ArgoCD namespace"),
    release_name: str = Query("argocd", description="Helm release name"),
    delete_namespace: bool = Query(False, description="Also delete namespace"),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Uninstall ArgoCD from the cluster.
    Warning: This will remove all ArgoCD applications and data.
    """
    global _argocd_config

    deployment_service = get_argocd_deployment_service()
    result = await deployment_service.uninstall(
        namespace=namespace,
        release_name=release_name,
        delete_namespace=delete_namespace,
    )

    # Clear configuration if uninstall successful
    if result.get("success"):
        _argocd_config = None

    return result


@router.get("/deployment/password")
async def get_admin_password(
    namespace: str = Query("argocd", description="ArgoCD namespace"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get the ArgoCD admin password from Kubernetes secret."""
    deployment_service = get_argocd_deployment_service()
    password = await deployment_service.get_admin_password(namespace=namespace)

    if password:
        return {"password": password}

    raise HTTPException(
        status_code=404,
        detail="Admin password not found. It may have been deleted after first login.",
    )
