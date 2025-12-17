"""
API routes for Kubernetes resource optimization.
Provides endpoints for analyzing resource usage and getting optimization recommendations.
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.optimization import (
    ApplyOptimizationRequest,
    ApplyOptimizationResponse,
    ClusterOptimizationSummary,
    NamespaceOptimization,
    OptimizationDashboardResponse,
    OptimizationRecommendation,
    PodOptimization,
)
from app.services.optimization_service import optimization_service

router = APIRouter()


@router.get("/dashboard", response_model=OptimizationDashboardResponse)
async def get_optimization_dashboard(
    namespace: Optional[str] = Query(None, description="Filter by namespace")
):
    """
    Get the complete resource optimization dashboard.

    Returns cluster-wide optimization analysis including:
    - Efficiency summary and scores
    - Namespace breakdown
    - Top wasteful/underprovisioned pods
    - Actionable recommendations
    - Potential cost savings
    """
    try:
        return await optimization_service.get_optimization_dashboard(namespace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get optimization dashboard: {str(e)}")


@router.get("/summary", response_model=ClusterOptimizationSummary)
async def get_optimization_summary(
    namespace: Optional[str] = Query(None, description="Filter by namespace")
):
    """
    Get cluster optimization summary.

    Returns high-level metrics including:
    - Total vs analyzed pods
    - Efficiency scores
    - Cost savings potential
    """
    try:
        dashboard = await optimization_service.get_optimization_dashboard(namespace)
        return dashboard.summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get optimization summary: {str(e)}")


@router.get("/namespaces", response_model=List[NamespaceOptimization])
async def get_namespace_optimization():
    """
    Get optimization breakdown by namespace.

    Returns efficiency metrics and savings potential for each namespace.
    """
    try:
        dashboard = await optimization_service.get_optimization_dashboard()
        return dashboard.namespace_breakdown
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get namespace optimization: {str(e)}")


@router.get("/recommendations", response_model=List[OptimizationRecommendation])
async def get_recommendations(
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    severity: Optional[str] = Query(None, description="Filter by severity: critical, high, medium, low"),
    limit: int = Query(50, ge=1, le=100, description="Maximum recommendations to return"),
):
    """
    Get actionable optimization recommendations.

    Returns specific recommendations for:
    - Over-provisioned resources (reduce requests)
    - Under-provisioned resources (increase requests)
    - Idle resources (scale down/remove)
    - Missing requests/limits
    """
    try:
        dashboard = await optimization_service.get_optimization_dashboard(namespace)
        recommendations = dashboard.recommendations

        if severity:
            recommendations = [r for r in recommendations if r.severity.value == severity]

        return recommendations[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")


@router.get("/wasteful", response_model=List[PodOptimization])
async def get_wasteful_pods(
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    limit: int = Query(10, ge=1, le=50, description="Maximum pods to return"),
):
    """
    Get top over-provisioned (wasteful) pods.

    These pods are using significantly less resources than requested,
    representing cost savings opportunities.
    """
    try:
        dashboard = await optimization_service.get_optimization_dashboard(namespace)
        return dashboard.top_wasteful_pods[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get wasteful pods: {str(e)}")


@router.get("/underprovisioned", response_model=List[PodOptimization])
async def get_underprovisioned_pods(
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    limit: int = Query(10, ge=1, le=50, description="Maximum pods to return"),
):
    """
    Get under-provisioned pods at risk of throttling/OOM.

    These pods are using close to or exceeding their resource requests,
    requiring immediate attention to prevent issues.
    """
    try:
        dashboard = await optimization_service.get_optimization_dashboard(namespace)
        return dashboard.top_underprovisioned_pods[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get underprovisioned pods: {str(e)}")


@router.get("/idle", response_model=List[PodOptimization])
async def get_idle_resources(
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    limit: int = Query(10, ge=1, le=50, description="Maximum pods to return"),
):
    """
    Get idle/unused resources.

    These pods have near-zero resource utilization and may be candidates
    for removal or scale-down.
    """
    try:
        dashboard = await optimization_service.get_optimization_dashboard(namespace)
        return dashboard.idle_resources[:limit]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get idle resources: {str(e)}")


@router.get("/pods/{namespace}/{pod_name}", response_model=PodOptimization)
async def get_pod_optimization(namespace: str, pod_name: str):
    """
    Get optimization analysis for a specific pod.
    """
    try:
        dashboard = await optimization_service.get_optimization_dashboard(namespace)

        # Find the specific pod
        for pod in (
            dashboard.top_wasteful_pods +
            dashboard.top_underprovisioned_pods +
            dashboard.idle_resources
        ):
            if pod.name == pod_name and pod.namespace == namespace:
                return pod

        # If not in special lists, search all pods
        # Re-analyze just this pod
        raise HTTPException(status_code=404, detail=f"Pod {pod_name} not found or not analyzed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pod optimization: {str(e)}")


@router.post("/apply", response_model=ApplyOptimizationResponse)
async def apply_optimization(request: ApplyOptimizationRequest):
    """
    Apply an optimization recommendation to a Kubernetes workload.

    Supports Deployments, StatefulSets, and DaemonSets.
    Use dry_run=true (default) to preview changes before applying.

    This endpoint updates the resource requests/limits for the specified container.
    """
    try:
        result = await optimization_service.apply_optimization(request)

        if not result.success and not request.dry_run:
            raise HTTPException(status_code=400, detail=result.message)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply optimization: {str(e)}")


@router.post("/preview", response_model=ApplyOptimizationResponse)
async def preview_optimization(request: ApplyOptimizationRequest):
    """
    Preview an optimization without applying it.

    Returns what changes would be made, including a YAML diff.
    This is equivalent to calling /apply with dry_run=true.
    """
    request.dry_run = True
    try:
        return await optimization_service.apply_optimization(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview optimization: {str(e)}")


@router.get("/yaml-patch")
async def get_yaml_patch(
    namespace: str = Query(..., description="Resource namespace"),
    resource_kind: str = Query(..., description="Resource kind (Deployment, StatefulSet, DaemonSet)"),
    resource_name: str = Query(..., description="Resource name"),
    container_name: str = Query(..., description="Container name"),
    cpu_request: Optional[str] = Query(None, description="New CPU request (e.g., 100m, 0.5)"),
    memory_request: Optional[str] = Query(None, description="New memory request (e.g., 128Mi, 1Gi)"),
    cpu_limit: Optional[str] = Query(None, description="New CPU limit"),
    memory_limit: Optional[str] = Query(None, description="New memory limit"),
):
    """
    Generate a YAML patch that can be applied with kubectl.

    Returns a YAML document that can be saved and applied with:
    kubectl apply -f patch.yaml
    """
    try:
        yaml_content = optimization_service.generate_yaml_patch(
            resource_kind=resource_kind,
            resource_name=resource_name,
            namespace=namespace,
            container_name=container_name,
            cpu_request=cpu_request,
            memory_request=memory_request,
            cpu_limit=cpu_limit,
            memory_limit=memory_limit,
        )
        return {"yaml": yaml_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate YAML patch: {str(e)}")
