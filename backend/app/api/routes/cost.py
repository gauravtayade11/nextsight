"""
Cost analysis API routes.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_user
from app.schemas.auth import UserInfo
from app.schemas.cost import (
    CostBreakdown,
    CostConfig,
    CostDashboardResponse,
    CostRecommendation,
    CostTrend,
    NamespaceCost,
    PodCost,
    ResourceEfficiency,
)
from app.services.cost_service import cost_service

router = APIRouter(prefix="/cost", tags=["cost"])


@router.get("/dashboard", response_model=CostDashboardResponse)
async def get_cost_dashboard(
    current_user: UserInfo = Depends(get_current_user),
):
    """Get complete cost dashboard data including summary, trends, and recommendations."""
    return await cost_service.get_cost_dashboard()


@router.get("/namespaces", response_model=List[NamespaceCost])
async def get_namespace_costs(
    current_user: UserInfo = Depends(get_current_user),
):
    """Get cost breakdown by namespace."""
    return await cost_service.get_namespace_costs()


@router.get("/pods", response_model=List[PodCost])
async def get_pod_costs(
    limit: int = Query(10, ge=1, le=100, description="Maximum number of pods to return"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get most expensive pods."""
    return await cost_service.get_top_costly_pods(limit)


@router.get("/trends", response_model=List[CostTrend])
async def get_cost_trends(
    days: int = Query(30, ge=1, le=365, description="Number of days of trend data"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get cost trends over time."""
    return await cost_service.get_cost_trends(days)


@router.get("/recommendations", response_model=List[CostRecommendation])
async def get_recommendations(
    current_user: UserInfo = Depends(get_current_user),
):
    """Get cost optimization recommendations."""
    return await cost_service.get_recommendations()


@router.get("/efficiency", response_model=List[ResourceEfficiency])
async def get_efficiency_metrics(
    current_user: UserInfo = Depends(get_current_user),
):
    """Get resource efficiency metrics."""
    return await cost_service.get_efficiency_metrics()


@router.get("/config", response_model=CostConfig)
async def get_cost_config(
    current_user: UserInfo = Depends(get_current_user),
):
    """Get current cost configuration/pricing."""
    return cost_service.config


@router.put("/config", response_model=CostConfig)
async def update_cost_config(
    config: CostConfig,
    current_user: UserInfo = Depends(get_current_user),
):
    """Update cost configuration/pricing."""
    # In production, this would validate user permissions
    cost_service.config = config
    return cost_service.config
