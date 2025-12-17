"""
Prometheus API routes for stack management and metrics querying.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_user, require_permission
from app.schemas.auth import UserInfo
from app.schemas.prometheus import (
    Alert,
    AlertGroup,
    AlertRuleCreate,
    AlertsResponse,
    DeploymentResult,
    InstantQueryRequest,
    LabelValuesResponse,
    LabelsResponse,
    MetricsMetadataResponse,
    OperationResult,
    PrometheusStackConfig,
    PrometheusStackStatus,
    QueryResult,
    RangeQueryRequest,
    RulesResponse,
    ServiceMonitor,
    ServiceMonitorCreate,
    ServiceMonitorsResponse,
    Silence,
    SilenceCreate,
    SilencesResponse,
    TargetGroup,
    TargetsResponse,
)
from app.services.prometheus_service import prometheus_service

router = APIRouter(prefix="/prometheus", tags=["prometheus"])


# =============================================================================
# Stack Management
# =============================================================================


@router.post("/deploy", response_model=DeploymentResult)
async def deploy_stack(
    config: PrometheusStackConfig,
    current_user: UserInfo = Depends(require_permission("prometheus:deploy")),
):
    """
    Deploy the Prometheus stack (kube-prometheus-stack) to the cluster.

    This will install:
    - Prometheus server
    - Alertmanager
    - Grafana (optional)
    - Node Exporter
    - kube-state-metrics
    """
    return await prometheus_service.deploy_stack(config)


@router.put("/upgrade", response_model=DeploymentResult)
async def upgrade_stack(
    config: PrometheusStackConfig,
    current_user: UserInfo = Depends(require_permission("prometheus:deploy")),
):
    """Upgrade the Prometheus stack configuration."""
    return await prometheus_service.upgrade_stack(config)


@router.delete("/uninstall", response_model=OperationResult)
async def uninstall_stack(
    namespace: str = Query("monitoring", description="Namespace where stack is installed"),
    release_name: str = Query("prometheus-stack", description="Helm release name"),
    current_user: UserInfo = Depends(require_permission("prometheus:deploy")),
):
    """Uninstall the Prometheus stack from the cluster."""
    return await prometheus_service.uninstall_stack(namespace, release_name)


@router.get("/status", response_model=PrometheusStackStatus)
async def get_stack_status(
    namespace: str = Query("monitoring", description="Namespace to check"),
    release_name: str = Query("prometheus-stack", description="Helm release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get the current status of the Prometheus stack."""
    return await prometheus_service.get_stack_status(namespace, release_name)


# =============================================================================
# PromQL Queries
# =============================================================================


@router.post("/query", response_model=QueryResult)
async def instant_query(
    request: InstantQueryRequest,
    namespace: str = Query("monitoring", description="Prometheus namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Execute an instant PromQL query.

    Returns the current value of the expression at a single point in time.
    """
    return await prometheus_service.query(request, namespace, release_name)


@router.post("/query_range", response_model=QueryResult)
async def range_query(
    request: RangeQueryRequest,
    namespace: str = Query("monitoring", description="Prometheus namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Execute a range PromQL query.

    Returns the value of the expression over a range of time.
    """
    return await prometheus_service.query_range(request, namespace, release_name)


@router.get("/targets", response_model=TargetsResponse)
async def get_targets(
    namespace: str = Query("monitoring", description="Prometheus namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get all scrape targets and their status."""
    targets = await prometheus_service.get_targets(namespace, release_name)
    active_count = sum(t.active_count for t in targets)
    down_count = sum(t.down_count for t in targets)
    return TargetsResponse(targets=targets, active_count=active_count, down_count=down_count)


@router.get("/metadata", response_model=MetricsMetadataResponse)
async def get_metric_metadata(
    namespace: str = Query("monitoring", description="Prometheus namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get metadata for all available metrics."""
    return await prometheus_service.get_metric_metadata(namespace, release_name)


@router.get("/labels", response_model=LabelsResponse)
async def get_labels(
    namespace: str = Query("monitoring", description="Prometheus namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get all label names."""
    return await prometheus_service.get_label_names(namespace, release_name)


@router.get("/label/{label_name}/values", response_model=LabelValuesResponse)
async def get_label_values(
    label_name: str,
    namespace: str = Query("monitoring", description="Prometheus namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get all values for a specific label."""
    return await prometheus_service.get_label_values(label_name, namespace, release_name)


# =============================================================================
# Alert Rules (PrometheusRule CRD)
# =============================================================================


@router.get("/rules", response_model=RulesResponse)
async def get_rules(
    namespace: str = Query("monitoring", description="Prometheus namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get all alerting rules from Prometheus."""
    groups = await prometheus_service.get_rules(namespace, release_name)
    return RulesResponse(groups=groups)


@router.post("/rules", response_model=OperationResult)
async def create_alert_rule(
    rule: AlertRuleCreate,
    current_user: UserInfo = Depends(require_permission("prometheus:manage_rules")),
):
    """
    Create a new alert rule via PrometheusRule CRD.

    The rule will be automatically picked up by Prometheus.
    """
    return await prometheus_service.create_alert_rule(rule)


@router.delete("/rules/{namespace}/{name}", response_model=OperationResult)
async def delete_alert_rule(
    namespace: str,
    name: str,
    current_user: UserInfo = Depends(require_permission("prometheus:manage_rules")),
):
    """Delete an alert rule."""
    return await prometheus_service.delete_alert_rule(name, namespace)


# =============================================================================
# Active Alerts
# =============================================================================


@router.get("/alerts", response_model=AlertsResponse)
async def get_alerts(
    namespace: str = Query("monitoring", description="Prometheus namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get all active alerts from Prometheus."""
    alerts = await prometheus_service.get_alerts(namespace, release_name)
    return AlertsResponse(alerts=alerts, total=len(alerts))


@router.get("/alertmanager/alerts", response_model=AlertsResponse)
async def get_alertmanager_alerts(
    namespace: str = Query("monitoring", description="Alertmanager namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get all alerts from Alertmanager."""
    alerts = await prometheus_service.get_alertmanager_alerts(namespace, release_name)
    return AlertsResponse(alerts=alerts, total=len(alerts))


# =============================================================================
# Silences
# =============================================================================


@router.get("/alertmanager/silences", response_model=SilencesResponse)
async def get_silences(
    namespace: str = Query("monitoring", description="Alertmanager namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get all silences from Alertmanager."""
    silences = await prometheus_service.get_silences(namespace, release_name)
    return SilencesResponse(silences=silences, total=len(silences))


@router.post("/alertmanager/silences", response_model=OperationResult)
async def create_silence(
    silence: SilenceCreate,
    namespace: str = Query("monitoring", description="Alertmanager namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(require_permission("prometheus:manage_silences")),
):
    """Create a new silence in Alertmanager."""
    return await prometheus_service.create_silence(silence, namespace, release_name)


@router.delete("/alertmanager/silences/{silence_id}", response_model=OperationResult)
async def delete_silence(
    silence_id: str,
    namespace: str = Query("monitoring", description="Alertmanager namespace"),
    release_name: str = Query("prometheus-stack", description="Release name"),
    current_user: UserInfo = Depends(require_permission("prometheus:manage_silences")),
):
    """Delete a silence from Alertmanager."""
    return await prometheus_service.delete_silence(silence_id, namespace, release_name)


# =============================================================================
# ServiceMonitor Management
# =============================================================================


@router.get("/servicemonitors", response_model=ServiceMonitorsResponse)
async def list_service_monitors(
    namespace: Optional[str] = Query(None, description="Filter by namespace"),
    current_user: UserInfo = Depends(get_current_user),
):
    """List all ServiceMonitors."""
    monitors = await prometheus_service.list_service_monitors(namespace)
    return ServiceMonitorsResponse(service_monitors=monitors, total=len(monitors))


@router.post("/servicemonitors", response_model=OperationResult)
async def create_service_monitor(
    monitor: ServiceMonitorCreate,
    current_user: UserInfo = Depends(require_permission("prometheus:manage_servicemonitors")),
):
    """Create a new ServiceMonitor."""
    return await prometheus_service.create_service_monitor(monitor)


@router.delete("/servicemonitors/{namespace}/{name}", response_model=OperationResult)
async def delete_service_monitor(
    namespace: str,
    name: str,
    current_user: UserInfo = Depends(require_permission("prometheus:manage_servicemonitors")),
):
    """Delete a ServiceMonitor."""
    return await prometheus_service.delete_service_monitor(name, namespace)
