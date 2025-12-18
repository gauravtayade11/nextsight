"""
Prometheus-related Pydantic models for metrics, alerting, and stack management.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


# =============================================================================
# Enums
# =============================================================================


class StackStatus(str, Enum):
    """Prometheus stack deployment status."""

    NOT_INSTALLED = "not_installed"
    INSTALLING = "installing"
    RUNNING = "running"
    DEGRADED = "degraded"
    FAILED = "failed"
    UPGRADING = "upgrading"
    UNINSTALLING = "uninstalling"


class AlertState(str, Enum):
    """Alert state in Prometheus/Alertmanager."""

    FIRING = "firing"
    PENDING = "pending"
    INACTIVE = "inactive"


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class TargetHealth(str, Enum):
    """Scrape target health status."""

    UP = "up"
    DOWN = "down"
    UNKNOWN = "unknown"


# =============================================================================
# Stack Configuration Models
# =============================================================================


class ResourceRequirements(BaseModel):
    """Kubernetes resource requirements."""

    cpu_request: str = "100m"
    cpu_limit: str = "1000m"
    memory_request: str = "256Mi"
    memory_limit: str = "2Gi"


class PrometheusConfig(BaseModel):
    """Prometheus server configuration."""

    retention: str = Field(default="15d", description="Data retention period")
    storage_size: str = Field(default="50Gi", description="PVC size for data")
    storage_class: Optional[str] = Field(default=None, description="StorageClass name")
    replicas: int = Field(default=1, ge=1, le=3, description="Number of replicas")
    resources: ResourceRequirements = Field(default_factory=ResourceRequirements)
    external_labels: Dict[str, str] = Field(default_factory=dict)
    scrape_interval: str = Field(default="30s", description="Global scrape interval")
    evaluation_interval: str = Field(default="30s", description="Rule evaluation interval")


class SlackReceiver(BaseModel):
    """Slack notification receiver."""

    webhook_url: str
    channel: Optional[str] = None
    username: str = "Alertmanager"
    send_resolved: bool = True


class EmailReceiver(BaseModel):
    """Email notification receiver."""

    to: List[str]
    from_address: str
    smarthost: str
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None
    require_tls: bool = True


class PagerDutyReceiver(BaseModel):
    """PagerDuty notification receiver."""

    service_key: str
    send_resolved: bool = True


class WebhookReceiver(BaseModel):
    """Generic webhook receiver."""

    url: str
    send_resolved: bool = True


class NotificationReceiver(BaseModel):
    """Notification receiver configuration."""

    name: str
    slack: Optional[SlackReceiver] = None
    email: Optional[EmailReceiver] = None
    pagerduty: Optional[PagerDutyReceiver] = None
    webhook: Optional[WebhookReceiver] = None


class AlertRoute(BaseModel):
    """Alert routing configuration."""

    receiver: str
    match: Dict[str, str] = Field(default_factory=dict)
    match_re: Dict[str, str] = Field(default_factory=dict)
    group_by: List[str] = Field(default_factory=lambda: ["alertname"])
    group_wait: str = "30s"
    group_interval: str = "5m"
    repeat_interval: str = "4h"


class AlertmanagerConfig(BaseModel):
    """Alertmanager configuration."""

    enabled: bool = True
    replicas: int = Field(default=1, ge=1, le=3)
    storage_size: str = "10Gi"
    storage_class: Optional[str] = None
    receivers: List[NotificationReceiver] = Field(default_factory=list)
    routes: List[AlertRoute] = Field(default_factory=list)


class GrafanaConfig(BaseModel):
    """Grafana configuration. Disabled by default - NextSight AI has native dashboards."""

    enabled: bool = False  # NextSight AI has its own dashboards
    admin_password: Optional[str] = Field(default=None, description="Auto-generated if not set")
    persistence_enabled: bool = True
    storage_size: str = "10Gi"
    storage_class: Optional[str] = None
    ingress_enabled: bool = False
    ingress_host: Optional[str] = None
    ingress_class: Optional[str] = None


class NodeExporterConfig(BaseModel):
    """Node Exporter configuration."""

    enabled: bool = True


class KubeStateMetricsConfig(BaseModel):
    """kube-state-metrics configuration."""

    enabled: bool = True


class ScrapeConfig(BaseModel):
    """Additional scrape configuration."""

    job_name: str
    static_configs: List[Dict[str, Any]] = Field(default_factory=list)
    metrics_path: str = "/metrics"
    scheme: str = "http"
    scrape_interval: Optional[str] = None


class PrometheusStackConfig(BaseModel):
    """Complete Prometheus stack configuration."""

    namespace: str = Field(default="monitoring", description="Deployment namespace")
    release_name: str = Field(default="prometheus-stack", description="Helm release name")

    prometheus: PrometheusConfig = Field(default_factory=PrometheusConfig)
    alertmanager: AlertmanagerConfig = Field(default_factory=AlertmanagerConfig)
    grafana: GrafanaConfig = Field(default_factory=GrafanaConfig)
    node_exporter: NodeExporterConfig = Field(default_factory=NodeExporterConfig)
    kube_state_metrics: KubeStateMetricsConfig = Field(default_factory=KubeStateMetricsConfig)

    additional_scrape_configs: List[ScrapeConfig] = Field(default_factory=list)


# =============================================================================
# Stack Status Models
# =============================================================================


class ComponentStatus(BaseModel):
    """Individual component status."""

    name: str
    ready: bool
    replicas: int = 0
    ready_replicas: int = 0
    message: Optional[str] = None


class PrometheusStackStatus(BaseModel):
    """Overall Prometheus stack status."""

    status: StackStatus
    namespace: str
    release_name: str
    version: Optional[str] = None
    components: List[ComponentStatus] = Field(default_factory=list)
    prometheus_url: Optional[str] = None
    alertmanager_url: Optional[str] = None
    grafana_url: Optional[str] = None
    installed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# =============================================================================
# PromQL Query Models
# =============================================================================


class InstantQueryRequest(BaseModel):
    """Request for instant PromQL query."""

    query: str = Field(..., description="PromQL expression")
    time: Optional[datetime] = Field(default=None, description="Evaluation timestamp")


class RangeQueryRequest(BaseModel):
    """Request for range PromQL query."""

    query: str = Field(..., description="PromQL expression")
    start: datetime = Field(..., description="Start timestamp")
    end: datetime = Field(..., description="End timestamp")
    step: str = Field(default="60s", description="Query resolution step")


class MetricValue(BaseModel):
    """Single metric value."""

    timestamp: float
    value: str


class MetricSample(BaseModel):
    """Metric sample with labels."""

    metric: Dict[str, str] = Field(default_factory=dict)
    value: Optional[MetricValue] = None
    values: List[MetricValue] = Field(default_factory=list)


class QueryResult(BaseModel):
    """PromQL query result."""

    status: str
    result_type: str  # "vector", "matrix", "scalar", "string"
    result: List[MetricSample] = Field(default_factory=list)
    error: Optional[str] = None
    error_type: Optional[str] = None


# =============================================================================
# Alert Models
# =============================================================================


class AlertLabel(BaseModel):
    """Alert labels."""

    alertname: str
    severity: AlertSeverity = AlertSeverity.WARNING
    namespace: Optional[str] = None
    pod: Optional[str] = None
    instance: Optional[str] = None
    job: Optional[str] = None
    additional: Dict[str, str] = Field(default_factory=dict)


class AlertAnnotation(BaseModel):
    """Alert annotations."""

    summary: Optional[str] = None
    description: Optional[str] = None
    runbook_url: Optional[str] = None
    additional: Dict[str, str] = Field(default_factory=dict)


class Alert(BaseModel):
    """Active alert."""

    labels: Dict[str, str]
    annotations: Dict[str, str] = Field(default_factory=dict)
    state: AlertState
    active_at: Optional[datetime] = None
    value: Optional[str] = None
    fingerprint: Optional[str] = None


class AlertGroup(BaseModel):
    """Group of alerts from a rule."""

    name: str
    file: str
    rules: List["AlertRule"] = Field(default_factory=list)


class AlertRule(BaseModel):
    """Prometheus alerting rule."""

    name: str
    query: str  # PromQL expression
    duration: str = "0s"  # for condition
    labels: Dict[str, str] = Field(default_factory=dict)
    annotations: Dict[str, str] = Field(default_factory=dict)
    state: Optional[AlertState] = None
    alerts: List[Alert] = Field(default_factory=list)


class AlertRuleCreate(BaseModel):
    """Request to create an alert rule."""

    name: str = Field(..., description="Rule name")
    namespace: str = Field(default="monitoring", description="Namespace for PrometheusRule CRD")
    group_name: str = Field(default="custom-rules", description="Rule group name")
    query: str = Field(..., description="PromQL expression")
    duration: str = Field(default="5m", description="Duration before firing")
    severity: AlertSeverity = Field(default=AlertSeverity.WARNING)
    summary: str = Field(..., description="Alert summary")
    description: Optional[str] = None
    runbook_url: Optional[str] = None
    labels: Dict[str, str] = Field(default_factory=dict)


class AlertRuleUpdate(BaseModel):
    """Request to update an alert rule."""

    query: Optional[str] = None
    duration: Optional[str] = None
    severity: Optional[AlertSeverity] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    runbook_url: Optional[str] = None
    labels: Optional[Dict[str, str]] = None


# =============================================================================
# Silence Models
# =============================================================================


class SilenceCreate(BaseModel):
    """Request to create an alert silence."""

    matchers: List[Dict[str, str]] = Field(..., description="Label matchers")
    starts_at: datetime
    ends_at: datetime
    created_by: str
    comment: str


class Silence(BaseModel):
    """Alert silence."""

    id: str
    matchers: List[Dict[str, str]]
    starts_at: datetime
    ends_at: datetime
    created_by: str
    comment: str
    status: Dict[str, str] = Field(default_factory=dict)


# =============================================================================
# Target Models
# =============================================================================


class ScrapeTarget(BaseModel):
    """Scrape target information."""

    job: str
    instance: str
    health: TargetHealth
    labels: Dict[str, str] = Field(default_factory=dict)
    last_scrape: Optional[datetime] = None
    last_scrape_duration: Optional[float] = None
    last_error: Optional[str] = None
    scrape_url: Optional[str] = None


class TargetGroup(BaseModel):
    """Group of scrape targets."""

    job: str
    targets: List[ScrapeTarget] = Field(default_factory=list)
    active_count: int = 0
    down_count: int = 0


# =============================================================================
# ServiceMonitor Models
# =============================================================================


class ServiceMonitorEndpoint(BaseModel):
    """ServiceMonitor endpoint configuration."""

    port: Optional[str] = None
    target_port: Optional[Union[int, str]] = None
    path: str = "/metrics"
    scheme: str = "http"
    interval: Optional[str] = None
    scrape_timeout: Optional[str] = None


class ServiceMonitorSelector(BaseModel):
    """ServiceMonitor label selector."""

    match_labels: Dict[str, str] = Field(default_factory=dict)


class ServiceMonitorCreate(BaseModel):
    """Request to create a ServiceMonitor."""

    name: str
    namespace: str = "monitoring"
    target_namespace: Optional[str] = None  # Namespace of services to monitor
    selector: ServiceMonitorSelector
    endpoints: List[ServiceMonitorEndpoint] = Field(default_factory=list)
    labels: Dict[str, str] = Field(default_factory=dict)


class ServiceMonitor(BaseModel):
    """ServiceMonitor resource."""

    name: str
    namespace: str
    selector: ServiceMonitorSelector
    endpoints: List[ServiceMonitorEndpoint] = Field(default_factory=list)
    labels: Dict[str, str] = Field(default_factory=dict)
    created_at: Optional[datetime] = None


# =============================================================================
# Metric Metadata Models
# =============================================================================


class MetricMetadata(BaseModel):
    """Metric metadata."""

    metric_name: str
    type: str  # counter, gauge, histogram, summary
    help: str
    unit: Optional[str] = None


class LabelInfo(BaseModel):
    """Label information."""

    name: str
    values: List[str] = Field(default_factory=list)


# =============================================================================
# Response Models
# =============================================================================


class DeploymentResult(BaseModel):
    """Result of stack deployment/upgrade."""

    success: bool
    message: str
    status: Optional[PrometheusStackStatus] = None
    notes: Optional[str] = None


class OperationResult(BaseModel):
    """Generic operation result."""

    success: bool
    message: str


class AlertsResponse(BaseModel):
    """Response containing alerts."""

    alerts: List[Alert]
    total: int


class RulesResponse(BaseModel):
    """Response containing alert rules."""

    groups: List[AlertGroup]


class TargetsResponse(BaseModel):
    """Response containing scrape targets."""

    targets: List[TargetGroup]
    active_count: int
    down_count: int


class ServiceMonitorsResponse(BaseModel):
    """Response containing ServiceMonitors."""

    service_monitors: List[ServiceMonitor]
    total: int


class SilencesResponse(BaseModel):
    """Response containing silences."""

    silences: List[Silence]
    total: int


class MetricsMetadataResponse(BaseModel):
    """Response containing metrics metadata."""

    metrics: List[MetricMetadata]


class LabelsResponse(BaseModel):
    """Response containing label names."""

    labels: List[str]


class LabelValuesResponse(BaseModel):
    """Response containing label values."""

    label: str
    values: List[str]
