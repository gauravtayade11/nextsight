from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import require_role
from app.schemas.cluster import (
    AddClusterRequest,
    ClusterConfig,
    ClusterContextInfo,
    ClusterHealth,
    ClusterInfo,
    ClusterListResponse,
    SetActiveClusterRequest,
)
from app.services.cluster_service import cluster_service

router = APIRouter()


@router.get("", response_model=ClusterListResponse)
async def list_clusters():
    """List all configured Kubernetes clusters."""
    clusters = await cluster_service.list_clusters()
    active_id = await cluster_service.get_active_cluster()
    return ClusterListResponse(clusters=clusters, active_cluster_id=active_id, total=len(clusters))


@router.get("/active")
async def get_active_cluster():
    """Get the currently active cluster."""
    active_id = await cluster_service.get_active_cluster()
    if not active_id:
        raise HTTPException(status_code=404, detail="No active cluster set")

    cluster = await cluster_service.get_cluster(active_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Active cluster not found")

    return cluster


@router.put("/active")
async def set_active_cluster(request: SetActiveClusterRequest):
    """Set the active cluster for operations."""
    success = await cluster_service.set_active_cluster(request.cluster_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Cluster not found: {request.cluster_id}")

    return {"message": f"Active cluster set to: {request.cluster_id}", "cluster_id": request.cluster_id}


@router.get("/contexts", response_model=List[ClusterContextInfo])
async def list_contexts():
    """List all available kubeconfig contexts."""
    return await cluster_service.list_kubeconfig_contexts()


@router.get("/{cluster_id}", response_model=ClusterInfo)
async def get_cluster(cluster_id: str):
    """Get details for a specific cluster."""
    cluster = await cluster_service.get_cluster(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail=f"Cluster not found: {cluster_id}")
    return cluster


@router.get("/{cluster_id}/health", response_model=ClusterHealth)
async def get_cluster_health(cluster_id: str):
    """Get health status for a specific cluster."""
    health = await cluster_service.get_cluster_health(cluster_id)
    return health


@router.post("/{cluster_id}/test")
async def test_cluster_connection(cluster_id: str):
    """Test connection to a specific cluster."""
    result = await cluster_service.test_connection(cluster_id)
    return result


@router.put("/{cluster_id}")
async def update_cluster(cluster_id: str, request: AddClusterRequest, current_user=Depends(require_role("admin"))):
    """Update a cluster configuration. Admin only."""
    cluster_config = ClusterConfig(
        id=request.id,
        name=request.name,
        context=request.context,
        kubeconfig_path=request.kubeconfig_path,
        kubeconfig_content=request.kubeconfig_content,
        is_default=request.is_default,
        auth_type=request.auth_type,
        api_server=request.api_server,
        bearer_token=request.bearer_token,
        ca_cert=request.ca_cert,
        skip_tls_verify=request.skip_tls_verify,
    )

    success = await cluster_service.update_cluster(cluster_id, cluster_config)
    if not success:
        raise HTTPException(status_code=404, detail=f"Cluster not found: {cluster_id}")

    cluster = await cluster_service.get_cluster(request.id)
    if not cluster:
        raise HTTPException(status_code=500, detail="Failed to retrieve updated cluster")

    return cluster


@router.post("", response_model=ClusterInfo)
async def add_cluster(request: AddClusterRequest, current_user=Depends(require_role("admin"))):
    """Add a new cluster configuration. Admin only."""
    cluster_config = ClusterConfig(
        id=request.id,
        name=request.name,
        context=request.context,
        kubeconfig_path=request.kubeconfig_path,
        kubeconfig_content=request.kubeconfig_content,
        is_default=request.is_default,
        auth_type=request.auth_type,
        api_server=request.api_server,
        bearer_token=request.bearer_token,
        ca_cert=request.ca_cert,
        skip_tls_verify=request.skip_tls_verify,
    )

    success = await cluster_service.add_cluster(cluster_config)
    if not success:
        raise HTTPException(status_code=400, detail=f"Cluster already exists: {request.id}")

    cluster = await cluster_service.get_cluster(request.id)
    if not cluster:
        raise HTTPException(status_code=500, detail="Failed to retrieve created cluster")

    return cluster


@router.delete("/{cluster_id}")
async def delete_cluster(cluster_id: str, current_user=Depends(require_role("admin"))):
    """Delete a cluster configuration. Admin only."""
    success = await cluster_service.remove_cluster(cluster_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Cluster not found: {cluster_id}")

    return {"message": f"Cluster deleted: {cluster_id}"}
