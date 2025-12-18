"""
Prometheus service for managing the Prometheus stack and querying metrics.
Handles deployment via Helm and queries via Prometheus/Alertmanager APIs.
"""

import asyncio
import hashlib
import json
import logging
import secrets
import string
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
import yaml
from kubernetes import client, config
from kubernetes.client.rest import ApiException

from app.core.cache import cache_service
from app.utils.security import validate_kubernetes_name, sanitize_log_input

from app.schemas.prometheus import (
    Alert,
    AlertGroup,
    AlertRule,
    AlertRuleCreate,
    AlertRuleUpdate,
    AlertSeverity,
    AlertState,
    ComponentStatus,
    DeploymentResult,
    InstantQueryRequest,
    LabelValuesResponse,
    LabelsResponse,
    MetricMetadata,
    MetricSample,
    MetricValue,
    MetricsMetadataResponse,
    OperationResult,
    PrometheusStackConfig,
    PrometheusStackStatus,
    QueryResult,
    RangeQueryRequest,
    ScrapeTarget,
    ServiceMonitor,
    ServiceMonitorCreate,
    ServiceMonitorEndpoint,
    ServiceMonitorSelector,
    Silence,
    SilenceCreate,
    StackStatus,
    TargetGroup,
    TargetHealth,
)
from app.services.helm_service import HelmService

logger = logging.getLogger(__name__)


class PrometheusService:
    """Service for managing Prometheus stack and querying metrics."""

    CHART_REPO = "prometheus-community"
    CHART_NAME = "kube-prometheus-stack"
    CHART_REPO_URL = "https://prometheus-community.github.io/helm-charts"

    def __init__(self, kubeconfig: Optional[str] = None, context: Optional[str] = None):
        """Initialize Prometheus service."""
        self.kubeconfig = kubeconfig
        self.context = context
        self.helm_service = HelmService(kubeconfig=kubeconfig, context=context)
        self._k8s_client: Optional[client.ApiClient] = None
        self._custom_api: Optional[client.CustomObjectsApi] = None
        self._core_api: Optional[client.CoreV1Api] = None
        self._apps_api: Optional[client.AppsV1Api] = None

    def _init_k8s_client(self):
        """Initialize Kubernetes client."""
        if self._k8s_client is None:
            try:
                if self.kubeconfig:
                    config.load_kube_config(config_file=self.kubeconfig, context=self.context)
                else:
                    try:
                        config.load_incluster_config()
                    except config.ConfigException:
                        config.load_kube_config(context=self.context)

                self._k8s_client = client.ApiClient()
                self._custom_api = client.CustomObjectsApi(self._k8s_client)
                self._core_api = client.CoreV1Api(self._k8s_client)
                self._apps_api = client.AppsV1Api(self._k8s_client)
            except Exception as e:
                logger.error(f"Failed to initialize Kubernetes client: {e}")
                raise

    def _get_prometheus_url(self, namespace: str, release_name: str) -> str:
        """Get Prometheus server URL with validated inputs."""
        # Validate inputs to prevent SSRF
        namespace = validate_kubernetes_name(namespace, "namespace")
        release_name = validate_kubernetes_name(release_name, "release_name")
        # Only allow cluster-local URLs to prevent SSRF attacks
        return f"http://{release_name}-prometheus.{namespace}.svc.cluster.local:9090"

    def _get_alertmanager_url(self, namespace: str, release_name: str) -> str:
        """Get Alertmanager URL with validated inputs."""
        # Validate inputs to prevent SSRF
        namespace = validate_kubernetes_name(namespace, "namespace")
        release_name = validate_kubernetes_name(release_name, "release_name")
        return f"http://{release_name}-alertmanager.{namespace}.svc.cluster.local:9093"

    def _get_grafana_url(self, namespace: str, release_name: str) -> str:
        """Get Grafana URL with validated inputs."""
        # Validate inputs to prevent SSRF
        namespace = validate_kubernetes_name(namespace, "namespace")
        release_name = validate_kubernetes_name(release_name, "release_name")
        return f"http://{release_name}-grafana.{namespace}.svc.cluster.local:80"

    def _generate_password(self, length: int = 16) -> str:
        """Generate a random password."""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def _build_helm_values(self, config: PrometheusStackConfig) -> Dict[str, Any]:
        """Build Helm values from configuration."""
        values: Dict[str, Any] = {}

        # Prometheus configuration
        values["prometheus"] = {
            "prometheusSpec": {
                "retention": config.prometheus.retention,
                "scrapeInterval": config.prometheus.scrape_interval,
                "evaluationInterval": config.prometheus.evaluation_interval,
                "replicas": config.prometheus.replicas,
                "resources": {
                    "requests": {
                        "cpu": config.prometheus.resources.cpu_request,
                        "memory": config.prometheus.resources.memory_request,
                    },
                    "limits": {
                        "cpu": config.prometheus.resources.cpu_limit,
                        "memory": config.prometheus.resources.memory_limit,
                    },
                },
            }
        }

        # Storage configuration
        if config.prometheus.storage_size:
            values["prometheus"]["prometheusSpec"]["storageSpec"] = {
                "volumeClaimTemplate": {
                    "spec": {
                        "resources": {
                            "requests": {
                                "storage": config.prometheus.storage_size
                            }
                        }
                    }
                }
            }
            if config.prometheus.storage_class:
                values["prometheus"]["prometheusSpec"]["storageSpec"]["volumeClaimTemplate"]["spec"]["storageClassName"] = config.prometheus.storage_class

        # External labels
        if config.prometheus.external_labels:
            values["prometheus"]["prometheusSpec"]["externalLabels"] = config.prometheus.external_labels

        # Alertmanager configuration
        values["alertmanager"] = {
            "enabled": config.alertmanager.enabled,
        }

        if config.alertmanager.enabled:
            values["alertmanager"]["alertmanagerSpec"] = {
                "replicas": config.alertmanager.replicas,
            }

            if config.alertmanager.storage_size:
                values["alertmanager"]["alertmanagerSpec"]["storage"] = {
                    "volumeClaimTemplate": {
                        "spec": {
                            "resources": {
                                "requests": {
                                    "storage": config.alertmanager.storage_size
                                }
                            }
                        }
                    }
                }
                if config.alertmanager.storage_class:
                    values["alertmanager"]["alertmanagerSpec"]["storage"]["volumeClaimTemplate"]["spec"]["storageClassName"] = config.alertmanager.storage_class

            # Build Alertmanager config for receivers
            if config.alertmanager.receivers:
                am_config = self._build_alertmanager_config(config)
                values["alertmanager"]["config"] = am_config

        # Grafana configuration
        values["grafana"] = {
            "enabled": config.grafana.enabled,
        }

        if config.grafana.enabled:
            # Set admin password
            admin_password = config.grafana.admin_password or self._generate_password()
            values["grafana"]["adminPassword"] = admin_password

            values["grafana"]["persistence"] = {
                "enabled": config.grafana.persistence_enabled,
                "size": config.grafana.storage_size,
            }
            if config.grafana.storage_class:
                values["grafana"]["persistence"]["storageClassName"] = config.grafana.storage_class

            if config.grafana.ingress_enabled:
                values["grafana"]["ingress"] = {
                    "enabled": True,
                    "hosts": [config.grafana.ingress_host] if config.grafana.ingress_host else [],
                }
                if config.grafana.ingress_class:
                    values["grafana"]["ingress"]["ingressClassName"] = config.grafana.ingress_class

        # Node Exporter
        values["nodeExporter"] = {
            "enabled": config.node_exporter.enabled,
        }

        # kube-state-metrics
        values["kubeStateMetrics"] = {
            "enabled": config.kube_state_metrics.enabled,
        }

        # Additional scrape configs
        if config.additional_scrape_configs:
            values["prometheus"]["prometheusSpec"]["additionalScrapeConfigs"] = [
                {
                    "job_name": sc.job_name,
                    "static_configs": sc.static_configs,
                    "metrics_path": sc.metrics_path,
                    "scheme": sc.scheme,
                    **({"scrape_interval": sc.scrape_interval} if sc.scrape_interval else {}),
                }
                for sc in config.additional_scrape_configs
            ]

        return values

    def _build_alertmanager_config(self, config: PrometheusStackConfig) -> Dict[str, Any]:
        """Build Alertmanager configuration from receivers."""
        receivers_config = []
        routes_config = []

        for receiver in config.alertmanager.receivers:
            receiver_config: Dict[str, Any] = {"name": receiver.name}

            if receiver.slack:
                receiver_config["slack_configs"] = [{
                    "api_url": receiver.slack.webhook_url,
                    "send_resolved": receiver.slack.send_resolved,
                    **({"channel": receiver.slack.channel} if receiver.slack.channel else {}),
                    "username": receiver.slack.username,
                }]

            if receiver.email:
                receiver_config["email_configs"] = [{
                    "to": ", ".join(receiver.email.to),
                    "from": receiver.email.from_address,
                    "smarthost": receiver.email.smarthost,
                    "require_tls": receiver.email.require_tls,
                    **({"auth_username": receiver.email.auth_username} if receiver.email.auth_username else {}),
                    **({"auth_password": receiver.email.auth_password} if receiver.email.auth_password else {}),
                }]

            if receiver.pagerduty:
                receiver_config["pagerduty_configs"] = [{
                    "service_key": receiver.pagerduty.service_key,
                    "send_resolved": receiver.pagerduty.send_resolved,
                }]

            if receiver.webhook:
                receiver_config["webhook_configs"] = [{
                    "url": receiver.webhook.url,
                    "send_resolved": receiver.webhook.send_resolved,
                }]

            receivers_config.append(receiver_config)

        # Build routes
        for route in config.alertmanager.routes:
            route_config: Dict[str, Any] = {
                "receiver": route.receiver,
                "group_by": route.group_by,
                "group_wait": route.group_wait,
                "group_interval": route.group_interval,
                "repeat_interval": route.repeat_interval,
            }
            if route.match:
                route_config["match"] = route.match
            if route.match_re:
                route_config["match_re"] = route.match_re

            routes_config.append(route_config)

        # Default receiver (first one or 'null')
        default_receiver = receivers_config[0]["name"] if receivers_config else "null"

        return {
            "global": {
                "resolve_timeout": "5m",
            },
            "route": {
                "receiver": default_receiver,
                "group_by": ["alertname", "namespace"],
                "group_wait": "30s",
                "group_interval": "5m",
                "repeat_interval": "4h",
                "routes": routes_config,
            },
            "receivers": receivers_config or [{"name": "null"}],
        }

    # =========================================================================
    # Stack Deployment Methods
    # =========================================================================

    async def deploy_stack(self, config: PrometheusStackConfig) -> DeploymentResult:
        """Deploy the Prometheus stack using Helm."""
        logger.info(f"Deploying Prometheus stack to namespace {config.namespace}")

        try:
            # Ensure prometheus-community repo is added
            repos = await self.helm_service.list_repositories()
            repo_names = [r.name for r in repos]

            if self.CHART_REPO not in repo_names:
                logger.info(f"Adding {self.CHART_REPO} Helm repository")
                added = await self.helm_service.add_repository(self.CHART_REPO, self.CHART_REPO_URL)
                if not added:
                    return DeploymentResult(
                        success=False,
                        message=f"Failed to add {self.CHART_REPO} repository"
                    )

            # Build Helm values
            values = self._build_helm_values(config)
            logger.debug(f"Helm values: {yaml.dump(values)}")

            # Install chart
            from app.schemas.helm import InstallRequest

            install_request = InstallRequest(
                release_name=config.release_name,
                chart=f"{self.CHART_REPO}/{self.CHART_NAME}",
                namespace=config.namespace,
                values=values,
                create_namespace=True,
                wait=True,
                timeout=600,  # 10 minutes for full stack
            )

            result = await self.helm_service.install(install_request)

            if not result.success:
                return DeploymentResult(
                    success=False,
                    message=f"Helm installation failed: {result.message}"
                )

            # Get stack status
            status = await self.get_stack_status(config.namespace, config.release_name)

            return DeploymentResult(
                success=True,
                message="Prometheus stack deployed successfully",
                status=status,
                notes=result.notes,
            )

        except Exception as e:
            logger.error(f"Failed to deploy Prometheus stack: {e}")
            return DeploymentResult(
                success=False,
                message=f"Deployment failed: {str(e)}"
            )

    async def upgrade_stack(self, config: PrometheusStackConfig) -> DeploymentResult:
        """Upgrade the Prometheus stack configuration."""
        logger.info(f"Upgrading Prometheus stack in namespace {config.namespace}")

        try:
            values = self._build_helm_values(config)

            from app.schemas.helm import UpgradeRequest

            upgrade_request = UpgradeRequest(
                chart=f"{self.CHART_REPO}/{self.CHART_NAME}",
                values=values,
                reuse_values=True,
                wait=True,
                timeout=600,
            )

            result = await self.helm_service.upgrade(
                config.release_name,
                config.namespace,
                upgrade_request
            )

            if not result.success:
                return DeploymentResult(
                    success=False,
                    message=f"Helm upgrade failed: {result.message}"
                )

            status = await self.get_stack_status(config.namespace, config.release_name)

            return DeploymentResult(
                success=True,
                message="Prometheus stack upgraded successfully",
                status=status,
                notes=result.notes,
            )

        except Exception as e:
            logger.error(f"Failed to upgrade Prometheus stack: {e}")
            return DeploymentResult(
                success=False,
                message=f"Upgrade failed: {str(e)}"
            )

    async def uninstall_stack(self, namespace: str, release_name: str) -> OperationResult:
        """Uninstall the Prometheus stack."""
        logger.info(f"Uninstalling Prometheus stack {release_name} from namespace {namespace}")

        try:
            from app.schemas.helm import UninstallRequest

            uninstall_request = UninstallRequest(
                keep_history=False,
                timeout=300,
            )

            result = await self.helm_service.uninstall(release_name, namespace, uninstall_request)

            return OperationResult(
                success=result.success,
                message=result.message
            )

        except Exception as e:
            logger.error(f"Failed to uninstall Prometheus stack: {e}")
            return OperationResult(
                success=False,
                message=f"Uninstall failed: {str(e)}"
            )

    async def get_stack_status(self, namespace: str = "monitoring", release_name: str = "prometheus-stack") -> PrometheusStackStatus:
        """Get the status of the Prometheus stack."""
        self._init_k8s_client()

        try:
            # Check Helm release
            release = await self.helm_service.get_release(release_name, namespace)

            if not release:
                return PrometheusStackStatus(
                    status=StackStatus.NOT_INSTALLED,
                    namespace=namespace,
                    release_name=release_name,
                )

            components: List[ComponentStatus] = []
            overall_status = StackStatus.RUNNING

            # Check Prometheus deployment/statefulset
            # kube-prometheus-stack uses pattern: prometheus-{release}-kube-prom-prometheus
            try:
                prometheus_sts = self._apps_api.read_namespaced_stateful_set(
                    f"prometheus-{release_name}-kube-prom-prometheus",
                    namespace
                )
                components.append(ComponentStatus(
                    name="prometheus",
                    ready=prometheus_sts.status.ready_replicas == prometheus_sts.status.replicas,
                    replicas=prometheus_sts.status.replicas or 0,
                    ready_replicas=prometheus_sts.status.ready_replicas or 0,
                ))
                if prometheus_sts.status.ready_replicas != prometheus_sts.status.replicas:
                    overall_status = StackStatus.DEGRADED
            except ApiException as e:
                if e.status != 404:
                    logger.warning(f"Error checking Prometheus: {e}")
                components.append(ComponentStatus(
                    name="prometheus",
                    ready=False,
                    message="Not found"
                ))
                overall_status = StackStatus.DEGRADED

            # Check Alertmanager
            # kube-prometheus-stack uses pattern: alertmanager-{release}-kube-prom-alertmanager
            try:
                alertmanager_sts = self._apps_api.read_namespaced_stateful_set(
                    f"alertmanager-{release_name}-kube-prom-alertmanager",
                    namespace
                )
                components.append(ComponentStatus(
                    name="alertmanager",
                    ready=alertmanager_sts.status.ready_replicas == alertmanager_sts.status.replicas,
                    replicas=alertmanager_sts.status.replicas or 0,
                    ready_replicas=alertmanager_sts.status.ready_replicas or 0,
                ))
            except ApiException:
                # Alertmanager might be disabled
                pass

            # Check Grafana
            try:
                grafana_deploy = self._apps_api.read_namespaced_deployment(
                    f"{release_name}-grafana",
                    namespace
                )
                components.append(ComponentStatus(
                    name="grafana",
                    ready=grafana_deploy.status.ready_replicas == grafana_deploy.status.replicas,
                    replicas=grafana_deploy.status.replicas or 0,
                    ready_replicas=grafana_deploy.status.ready_replicas or 0,
                ))
            except ApiException:
                # Grafana might be disabled
                pass

            # Check node-exporter
            try:
                node_exporter_ds = self._apps_api.read_namespaced_daemon_set(
                    f"{release_name}-prometheus-node-exporter",
                    namespace
                )
                components.append(ComponentStatus(
                    name="node-exporter",
                    ready=node_exporter_ds.status.number_ready == node_exporter_ds.status.desired_number_scheduled,
                    replicas=node_exporter_ds.status.desired_number_scheduled or 0,
                    ready_replicas=node_exporter_ds.status.number_ready or 0,
                ))
            except ApiException:
                pass

            # Check kube-state-metrics
            try:
                ksm_deploy = self._apps_api.read_namespaced_deployment(
                    f"{release_name}-kube-state-metrics",
                    namespace
                )
                components.append(ComponentStatus(
                    name="kube-state-metrics",
                    ready=ksm_deploy.status.ready_replicas == ksm_deploy.status.replicas,
                    replicas=ksm_deploy.status.replicas or 0,
                    ready_replicas=ksm_deploy.status.ready_replicas or 0,
                ))
            except ApiException:
                pass

            return PrometheusStackStatus(
                status=overall_status,
                namespace=namespace,
                release_name=release_name,
                version=release.chart_version,
                components=components,
                prometheus_url=self._get_prometheus_url(namespace, release_name),
                alertmanager_url=self._get_alertmanager_url(namespace, release_name),
                grafana_url=self._get_grafana_url(namespace, release_name),
                updated_at=release.updated,
            )

        except Exception as e:
            logger.error(f"Failed to get stack status: {e}")
            return PrometheusStackStatus(
                status=StackStatus.FAILED,
                namespace=namespace,
                release_name=release_name,
                components=[ComponentStatus(name="error", ready=False, message=str(e))],
            )

    # =========================================================================
    # PromQL Query Methods
    # =========================================================================

    async def _get_prometheus_base_url(self, namespace: str = "monitoring", release_name: str = "prometheus-stack") -> str:
        """Get Prometheus base URL, trying port-forward if in-cluster fails."""
        # For now, use internal service URL
        # In production, you might want to use port-forward or ingress
        return self._get_prometheus_url(namespace, release_name)

    async def query(
        self,
        request: InstantQueryRequest,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> QueryResult:
        """Execute an instant PromQL query."""
        base_url = await self._get_prometheus_base_url(namespace, release_name)

        params: Dict[str, Any] = {"query": request.query}
        if request.time:
            params["time"] = request.time.timestamp()

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{base_url}/api/v1/query", params=params)
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "success":
                    return QueryResult(
                        status="error",
                        result_type="",
                        error=data.get("error", "Unknown error"),
                        error_type=data.get("errorType"),
                    )

                result_data = data.get("data", {})
                samples = self._parse_query_result(result_data)

                return QueryResult(
                    status="success",
                    result_type=result_data.get("resultType", ""),
                    result=samples,
                )

        except httpx.HTTPError as e:
            logger.error(f"Prometheus query failed: {e}")
            return QueryResult(
                status="error",
                result_type="",
                error=str(e),
            )

    async def query_range(
        self,
        request: RangeQueryRequest,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> QueryResult:
        """Execute a range PromQL query."""
        base_url = await self._get_prometheus_base_url(namespace, release_name)

        params = {
            "query": request.query,
            "start": request.start.timestamp(),
            "end": request.end.timestamp(),
            "step": request.step,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(f"{base_url}/api/v1/query_range", params=params)
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "success":
                    return QueryResult(
                        status="error",
                        result_type="",
                        error=data.get("error", "Unknown error"),
                        error_type=data.get("errorType"),
                    )

                result_data = data.get("data", {})
                samples = self._parse_query_result(result_data)

                return QueryResult(
                    status="success",
                    result_type=result_data.get("resultType", ""),
                    result=samples,
                )

        except httpx.HTTPError as e:
            logger.error(f"Prometheus range query failed: {e}")
            return QueryResult(
                status="error",
                result_type="",
                error=str(e),
            )

    def _parse_query_result(self, data: Dict[str, Any]) -> List[MetricSample]:
        """Parse Prometheus query result into MetricSample objects."""
        result_type = data.get("resultType", "")
        results = data.get("result", [])
        samples = []

        for item in results:
            metric = item.get("metric", {})

            if result_type == "vector":
                # Instant query result
                value = item.get("value", [])
                if len(value) >= 2:
                    samples.append(MetricSample(
                        metric=metric,
                        value=MetricValue(timestamp=float(value[0]), value=str(value[1])),
                    ))
            elif result_type == "matrix":
                # Range query result
                values = item.get("values", [])
                samples.append(MetricSample(
                    metric=metric,
                    values=[MetricValue(timestamp=float(v[0]), value=str(v[1])) for v in values],
                ))

        return samples

    async def get_targets(
        self,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> List[TargetGroup]:
        """Get all scrape targets with caching."""
        # Try cache first
        cache_key = f"prometheus:targets:{namespace}:{release_name}"
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.debug(f"Cache hit for Prometheus targets: {cache_key}")
            return [TargetGroup(**tg) for tg in cached_data]

        base_url = await self._get_prometheus_base_url(namespace, release_name)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{base_url}/api/v1/targets")
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "success":
                    return []

                active_targets = data.get("data", {}).get("activeTargets", [])
                groups: Dict[str, TargetGroup] = {}

                for target in active_targets:
                    job = target.get("labels", {}).get("job", "unknown")

                    if job not in groups:
                        groups[job] = TargetGroup(job=job, targets=[], active_count=0, down_count=0)

                    health_str = target.get("health", "unknown")
                    health = TargetHealth.UP if health_str == "up" else (
                        TargetHealth.DOWN if health_str == "down" else TargetHealth.UNKNOWN
                    )

                    groups[job].targets.append(ScrapeTarget(
                        job=job,
                        instance=target.get("labels", {}).get("instance", ""),
                        health=health,
                        labels=target.get("labels", {}),
                        last_scrape=datetime.fromisoformat(target["lastScrape"].replace("Z", "+00:00")) if target.get("lastScrape") else None,
                        last_scrape_duration=target.get("lastScrapeDuration"),
                        last_error=target.get("lastError"),
                        scrape_url=target.get("scrapeUrl"),
                    ))

                    if health == TargetHealth.UP:
                        groups[job].active_count += 1
                    else:
                        groups[job].down_count += 1

                result = list(groups.values())

                # Cache for 30 seconds (target status changes frequently)
                await cache_service.set(
                    cache_key,
                    [tg.model_dump() for tg in result],
                    ttl=30
                )
                logger.debug(f"Cached Prometheus targets: {sanitize_log_input(cache_key)}")

                return result

        except httpx.HTTPError as e:
            logger.error(f"Failed to get targets: {e}")
            return []

    async def get_alerts(
        self,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> List[Alert]:
        """Get all active alerts from Prometheus with caching."""
        # Try cache first
        cache_key = f"prometheus:alerts:{namespace}:{release_name}"
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.debug(f"Cache hit for Prometheus alerts: {sanitize_log_input(cache_key)}")
            return [Alert(**a) for a in cached_data]

        base_url = await self._get_prometheus_base_url(namespace, release_name)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{base_url}/api/v1/alerts")
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "success":
                    return []

                alerts_data = data.get("data", {}).get("alerts", [])
                alerts = []

                for alert in alerts_data:
                    state_str = alert.get("state", "inactive")
                    state = AlertState.FIRING if state_str == "firing" else (
                        AlertState.PENDING if state_str == "pending" else AlertState.INACTIVE
                    )

                    alerts.append(Alert(
                        labels=alert.get("labels", {}),
                        annotations=alert.get("annotations", {}),
                        state=state,
                        active_at=datetime.fromisoformat(alert["activeAt"].replace("Z", "+00:00")) if alert.get("activeAt") else None,
                        value=alert.get("value"),
                    ))

                # Cache for 15 seconds (alerts need frequent updates)
                await cache_service.set(
                    cache_key,
                    [a.model_dump() for a in alerts],
                    ttl=15
                )
                logger.debug(f"Cached Prometheus alerts: {sanitize_log_input(cache_key)}")

                return alerts

        except httpx.HTTPError as e:
            logger.error(f"Failed to get alerts: {e}")
            return []

    async def get_rules(
        self,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> List[AlertGroup]:
        """Get all alerting rules."""
        base_url = await self._get_prometheus_base_url(namespace, release_name)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{base_url}/api/v1/rules", params={"type": "alert"})
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "success":
                    return []

                groups_data = data.get("data", {}).get("groups", [])
                groups = []

                for group in groups_data:
                    rules = []
                    for rule in group.get("rules", []):
                        if rule.get("type") == "alerting":
                            state_str = rule.get("state", "inactive")
                            state = AlertState.FIRING if state_str == "firing" else (
                                AlertState.PENDING if state_str == "pending" else AlertState.INACTIVE
                            )

                            alerts = []
                            for alert in rule.get("alerts", []):
                                alert_state = AlertState.FIRING if alert.get("state") == "firing" else AlertState.PENDING
                                alerts.append(Alert(
                                    labels=alert.get("labels", {}),
                                    annotations=alert.get("annotations", {}),
                                    state=alert_state,
                                    active_at=datetime.fromisoformat(alert["activeAt"].replace("Z", "+00:00")) if alert.get("activeAt") else None,
                                    value=alert.get("value"),
                                ))

                            rules.append(AlertRule(
                                name=rule.get("name", ""),
                                query=rule.get("query", ""),
                                duration=rule.get("duration", "0s"),
                                labels=rule.get("labels", {}),
                                annotations=rule.get("annotations", {}),
                                state=state,
                                alerts=alerts,
                            ))

                    groups.append(AlertGroup(
                        name=group.get("name", ""),
                        file=group.get("file", ""),
                        rules=rules,
                    ))

                return groups

        except httpx.HTTPError as e:
            logger.error(f"Failed to get rules: {e}")
            return []

    async def get_label_names(
        self,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> LabelsResponse:
        """Get all label names."""
        base_url = await self._get_prometheus_base_url(namespace, release_name)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{base_url}/api/v1/labels")
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "success":
                    return LabelsResponse(labels=[])

                return LabelsResponse(labels=data.get("data", []))

        except httpx.HTTPError as e:
            logger.error(f"Failed to get labels: {e}")
            return LabelsResponse(labels=[])

    async def get_label_values(
        self,
        label_name: str,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> LabelValuesResponse:
        """Get all values for a specific label."""
        base_url = await self._get_prometheus_base_url(namespace, release_name)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{base_url}/api/v1/label/{label_name}/values")
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "success":
                    return LabelValuesResponse(label=label_name, values=[])

                return LabelValuesResponse(label=label_name, values=data.get("data", []))

        except httpx.HTTPError as e:
            logger.error(f"Failed to get label values: {e}")
            return LabelValuesResponse(label=label_name, values=[])

    async def get_metric_metadata(
        self,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> MetricsMetadataResponse:
        """Get metadata for all metrics."""
        base_url = await self._get_prometheus_base_url(namespace, release_name)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{base_url}/api/v1/metadata")
                response.raise_for_status()
                data = response.json()

                if data.get("status") != "success":
                    return MetricsMetadataResponse(metrics=[])

                metadata_data = data.get("data", {})
                metrics = []

                for metric_name, meta_list in metadata_data.items():
                    if meta_list:
                        meta = meta_list[0]
                        metrics.append(MetricMetadata(
                            metric_name=metric_name,
                            type=meta.get("type", "unknown"),
                            help=meta.get("help", ""),
                            unit=meta.get("unit"),
                        ))

                return MetricsMetadataResponse(metrics=metrics)

        except httpx.HTTPError as e:
            logger.error(f"Failed to get metric metadata: {e}")
            return MetricsMetadataResponse(metrics=[])

    # =========================================================================
    # Alert Rules Management (PrometheusRule CRD)
    # =========================================================================

    async def create_alert_rule(
        self,
        rule: AlertRuleCreate,
    ) -> OperationResult:
        """Create a new alert rule via PrometheusRule CRD."""
        self._init_k8s_client()

        prometheus_rule = {
            "apiVersion": "monitoring.coreos.com/v1",
            "kind": "PrometheusRule",
            "metadata": {
                "name": f"nextsight-{rule.name}",
                "namespace": rule.namespace,
                "labels": {
                    "app": "nextsight",
                    "prometheus": "prometheus-stack-prometheus",
                    "role": "alert-rules",
                },
            },
            "spec": {
                "groups": [{
                    "name": rule.group_name,
                    "rules": [{
                        "alert": rule.name,
                        "expr": rule.query,
                        "for": rule.duration,
                        "labels": {
                            "severity": rule.severity.value,
                            **rule.labels,
                        },
                        "annotations": {
                            "summary": rule.summary,
                            **({"description": rule.description} if rule.description else {}),
                            **({"runbook_url": rule.runbook_url} if rule.runbook_url else {}),
                        },
                    }],
                }],
            },
        }

        try:
            self._custom_api.create_namespaced_custom_object(
                group="monitoring.coreos.com",
                version="v1",
                namespace=rule.namespace,
                plural="prometheusrules",
                body=prometheus_rule,
            )

            return OperationResult(
                success=True,
                message=f"Alert rule '{rule.name}' created successfully"
            )

        except ApiException as e:
            logger.error(f"Failed to create alert rule: {e}")
            return OperationResult(
                success=False,
                message=f"Failed to create alert rule: {e.reason}"
            )

    async def delete_alert_rule(
        self,
        name: str,
        namespace: str = "monitoring"
    ) -> OperationResult:
        """Delete an alert rule."""
        self._init_k8s_client()

        try:
            self._custom_api.delete_namespaced_custom_object(
                group="monitoring.coreos.com",
                version="v1",
                namespace=namespace,
                plural="prometheusrules",
                name=f"nextsight-{name}",
            )

            return OperationResult(
                success=True,
                message=f"Alert rule '{name}' deleted successfully"
            )

        except ApiException as e:
            logger.error(f"Failed to delete alert rule: {e}")
            return OperationResult(
                success=False,
                message=f"Failed to delete alert rule: {e.reason}"
            )

    # =========================================================================
    # ServiceMonitor Management
    # =========================================================================

    async def list_service_monitors(
        self,
        namespace: Optional[str] = None
    ) -> List[ServiceMonitor]:
        """List all ServiceMonitors."""
        self._init_k8s_client()

        try:
            if namespace:
                result = self._custom_api.list_namespaced_custom_object(
                    group="monitoring.coreos.com",
                    version="v1",
                    namespace=namespace,
                    plural="servicemonitors",
                )
            else:
                result = self._custom_api.list_cluster_custom_object(
                    group="monitoring.coreos.com",
                    version="v1",
                    plural="servicemonitors",
                )

            monitors = []
            for item in result.get("items", []):
                spec = item.get("spec", {})
                metadata = item.get("metadata", {})

                endpoints = []
                for ep in spec.get("endpoints", []):
                    endpoints.append(ServiceMonitorEndpoint(
                        port=ep.get("port"),
                        target_port=ep.get("targetPort"),
                        path=ep.get("path", "/metrics"),
                        scheme=ep.get("scheme", "http"),
                        interval=ep.get("interval"),
                        scrape_timeout=ep.get("scrapeTimeout"),
                    ))

                selector = spec.get("selector", {})
                monitors.append(ServiceMonitor(
                    name=metadata.get("name", ""),
                    namespace=metadata.get("namespace", ""),
                    selector=ServiceMonitorSelector(
                        match_labels=selector.get("matchLabels", {})
                    ),
                    endpoints=endpoints,
                    labels=metadata.get("labels", {}),
                    created_at=datetime.fromisoformat(metadata["creationTimestamp"].replace("Z", "+00:00")) if metadata.get("creationTimestamp") else None,
                ))

            return monitors

        except ApiException as e:
            logger.error(f"Failed to list ServiceMonitors: {e}")
            return []

    async def create_service_monitor(
        self,
        monitor: ServiceMonitorCreate
    ) -> OperationResult:
        """Create a ServiceMonitor."""
        self._init_k8s_client()

        service_monitor = {
            "apiVersion": "monitoring.coreos.com/v1",
            "kind": "ServiceMonitor",
            "metadata": {
                "name": monitor.name,
                "namespace": monitor.namespace,
                "labels": {
                    "app": "nextsight",
                    **monitor.labels,
                },
            },
            "spec": {
                "selector": {
                    "matchLabels": monitor.selector.match_labels,
                },
                "endpoints": [
                    {
                        **({"port": ep.port} if ep.port else {}),
                        **({"targetPort": ep.target_port} if ep.target_port else {}),
                        "path": ep.path,
                        "scheme": ep.scheme,
                        **({"interval": ep.interval} if ep.interval else {}),
                        **({"scrapeTimeout": ep.scrape_timeout} if ep.scrape_timeout else {}),
                    }
                    for ep in monitor.endpoints
                ],
            },
        }

        if monitor.target_namespace:
            service_monitor["spec"]["namespaceSelector"] = {
                "matchNames": [monitor.target_namespace]
            }

        try:
            self._custom_api.create_namespaced_custom_object(
                group="monitoring.coreos.com",
                version="v1",
                namespace=monitor.namespace,
                plural="servicemonitors",
                body=service_monitor,
            )

            return OperationResult(
                success=True,
                message=f"ServiceMonitor '{monitor.name}' created successfully"
            )

        except ApiException as e:
            logger.error(f"Failed to create ServiceMonitor: {e}")
            return OperationResult(
                success=False,
                message=f"Failed to create ServiceMonitor: {e.reason}"
            )

    async def delete_service_monitor(
        self,
        name: str,
        namespace: str = "monitoring"
    ) -> OperationResult:
        """Delete a ServiceMonitor."""
        self._init_k8s_client()

        try:
            self._custom_api.delete_namespaced_custom_object(
                group="monitoring.coreos.com",
                version="v1",
                namespace=namespace,
                plural="servicemonitors",
                name=name,
            )

            return OperationResult(
                success=True,
                message=f"ServiceMonitor '{name}' deleted successfully"
            )

        except ApiException as e:
            logger.error(f"Failed to delete ServiceMonitor: {e}")
            return OperationResult(
                success=False,
                message=f"Failed to delete ServiceMonitor: {e.reason}"
            )

    # =========================================================================
    # Alertmanager Methods
    # =========================================================================

    async def get_alertmanager_alerts(
        self,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> List[Alert]:
        """Get alerts from Alertmanager."""
        base_url = self._get_alertmanager_url(namespace, release_name)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{base_url}/api/v2/alerts")
                response.raise_for_status()
                data = response.json()

                alerts = []
                for alert in data:
                    state = AlertState.FIRING if alert.get("status", {}).get("state") == "active" else AlertState.INACTIVE

                    alerts.append(Alert(
                        labels=alert.get("labels", {}),
                        annotations=alert.get("annotations", {}),
                        state=state,
                        active_at=datetime.fromisoformat(alert["startsAt"].replace("Z", "+00:00")) if alert.get("startsAt") else None,
                        fingerprint=alert.get("fingerprint"),
                    ))

                return alerts

        except httpx.HTTPError as e:
            logger.error(f"Failed to get Alertmanager alerts: {e}")
            return []

    async def get_silences(
        self,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> List[Silence]:
        """Get all silences from Alertmanager."""
        base_url = self._get_alertmanager_url(namespace, release_name)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{base_url}/api/v2/silences")
                response.raise_for_status()
                data = response.json()

                silences = []
                for silence in data:
                    silences.append(Silence(
                        id=silence.get("id", ""),
                        matchers=[
                            {
                                "name": m.get("name", ""),
                                "value": m.get("value", ""),
                                "isRegex": m.get("isRegex", False),
                            }
                            for m in silence.get("matchers", [])
                        ],
                        starts_at=datetime.fromisoformat(silence["startsAt"].replace("Z", "+00:00")),
                        ends_at=datetime.fromisoformat(silence["endsAt"].replace("Z", "+00:00")),
                        created_by=silence.get("createdBy", ""),
                        comment=silence.get("comment", ""),
                        status=silence.get("status", {}),
                    ))

                return silences

        except httpx.HTTPError as e:
            logger.error(f"Failed to get silences: {e}")
            return []

    async def create_silence(
        self,
        silence: SilenceCreate,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> OperationResult:
        """Create a new silence in Alertmanager."""
        base_url = self._get_alertmanager_url(namespace, release_name)

        payload = {
            "matchers": [
                {
                    "name": m.get("name", ""),
                    "value": m.get("value", ""),
                    "isRegex": m.get("isRegex", False),
                }
                for m in silence.matchers
            ],
            "startsAt": silence.starts_at.isoformat(),
            "endsAt": silence.ends_at.isoformat(),
            "createdBy": silence.created_by,
            "comment": silence.comment,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{base_url}/api/v2/silences",
                    json=payload
                )
                response.raise_for_status()

                return OperationResult(
                    success=True,
                    message="Silence created successfully"
                )

        except httpx.HTTPError as e:
            logger.error(f"Failed to create silence: {e}")
            return OperationResult(
                success=False,
                message=f"Failed to create silence: {str(e)}"
            )

    async def delete_silence(
        self,
        silence_id: str,
        namespace: str = "monitoring",
        release_name: str = "prometheus-stack"
    ) -> OperationResult:
        """Delete a silence from Alertmanager."""
        base_url = self._get_alertmanager_url(namespace, release_name)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(f"{base_url}/api/v2/silence/{silence_id}")
                response.raise_for_status()

                return OperationResult(
                    success=True,
                    message="Silence deleted successfully"
                )

        except httpx.HTTPError as e:
            logger.error(f"Failed to delete silence: {e}")
            return OperationResult(
                success=False,
                message=f"Failed to delete silence: {str(e)}"
            )


# Singleton instance
prometheus_service = PrometheusService()
