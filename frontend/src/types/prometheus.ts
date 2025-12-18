// Prometheus Stack Types

// Enums
export type StackStatus = 'not_installed' | 'installing' | 'running' | 'degraded' | 'failed' | 'upgrading' | 'uninstalling';
export type AlertState = 'firing' | 'pending' | 'inactive';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type TargetHealth = 'up' | 'down' | 'unknown';

// Resource Configuration
export interface ResourceRequirements {
  cpu_request: string;
  cpu_limit: string;
  memory_request: string;
  memory_limit: string;
}

// Prometheus Config
export interface PrometheusConfig {
  retention: string;
  storage_size: string;
  storage_class?: string;
  replicas: number;
  resources: ResourceRequirements;
  external_labels: Record<string, string>;
  scrape_interval: string;
  evaluation_interval: string;
}

// Notification Receivers
export interface SlackReceiver {
  webhook_url: string;
  channel?: string;
  username: string;
  send_resolved: boolean;
}

export interface EmailReceiver {
  to: string[];
  from_address: string;
  smarthost: string;
  auth_username?: string;
  auth_password?: string;
  require_tls: boolean;
}

export interface PagerDutyReceiver {
  service_key: string;
  send_resolved: boolean;
}

export interface WebhookReceiver {
  url: string;
  send_resolved: boolean;
}

export interface NotificationReceiver {
  name: string;
  slack?: SlackReceiver;
  email?: EmailReceiver;
  pagerduty?: PagerDutyReceiver;
  webhook?: WebhookReceiver;
}

export interface AlertRoute {
  receiver: string;
  match: Record<string, string>;
  match_re: Record<string, string>;
  group_by: string[];
  group_wait: string;
  group_interval: string;
  repeat_interval: string;
}

export interface AlertmanagerConfig {
  enabled: boolean;
  replicas: number;
  storage_size: string;
  storage_class?: string;
  receivers: NotificationReceiver[];
  routes: AlertRoute[];
}

export interface GrafanaConfig {
  enabled: boolean;
  admin_password?: string;
  persistence_enabled: boolean;
  storage_size: string;
  storage_class?: string;
  ingress_enabled: boolean;
  ingress_host?: string;
  ingress_class?: string;
}

export interface NodeExporterConfig {
  enabled: boolean;
}

export interface KubeStateMetricsConfig {
  enabled: boolean;
}

export interface ScrapeConfig {
  job_name: string;
  static_configs: Record<string, unknown>[];
  metrics_path: string;
  scheme: string;
  scrape_interval?: string;
}

// Main Stack Config
export interface PrometheusStackConfig {
  namespace: string;
  release_name: string;
  prometheus: PrometheusConfig;
  alertmanager: AlertmanagerConfig;
  grafana: GrafanaConfig;
  node_exporter: NodeExporterConfig;
  kube_state_metrics: KubeStateMetricsConfig;
  additional_scrape_configs: ScrapeConfig[];
}

// Default config factory
export const getDefaultStackConfig = (): PrometheusStackConfig => ({
  namespace: 'monitoring',
  release_name: 'prometheus-stack',
  prometheus: {
    retention: '15d',
    storage_size: '50Gi',
    storage_class: undefined,
    replicas: 1,
    resources: {
      cpu_request: '100m',
      cpu_limit: '1000m',
      memory_request: '256Mi',
      memory_limit: '2Gi',
    },
    external_labels: {},
    scrape_interval: '30s',
    evaluation_interval: '30s',
  },
  alertmanager: {
    enabled: true,
    replicas: 1,
    storage_size: '10Gi',
    storage_class: undefined,
    receivers: [],
    routes: [],
  },
  grafana: {
    enabled: false,  // Disabled by default - NextSight AI has native dashboards
    admin_password: undefined,
    persistence_enabled: true,
    storage_size: '10Gi',
    storage_class: undefined,
    ingress_enabled: false,
    ingress_host: undefined,
    ingress_class: undefined,
  },
  node_exporter: {
    enabled: true,
  },
  kube_state_metrics: {
    enabled: true,
  },
  additional_scrape_configs: [],
});

// Stack Status
export interface ComponentStatus {
  name: string;
  ready: boolean;
  replicas: number;
  ready_replicas: number;
  message?: string;
}

export interface PrometheusStackStatus {
  status: StackStatus;
  namespace: string;
  release_name: string;
  version?: string;
  components: ComponentStatus[];
  prometheus_url?: string;
  alertmanager_url?: string;
  grafana_url?: string;
  installed_at?: string;
  updated_at?: string;
}

// Query Types
export interface InstantQueryRequest {
  query: string;
  time?: string;
}

export interface RangeQueryRequest {
  query: string;
  start: string;
  end: string;
  step: string;
}

export interface MetricValue {
  timestamp: number;
  value: string;
}

export interface MetricSample {
  metric: Record<string, string>;
  value?: MetricValue;
  values?: MetricValue[];
}

export interface QueryResult {
  status: string;
  result_type: string;
  result: MetricSample[];
  error?: string;
  error_type?: string;
}

// Alert Types
export interface Alert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  state: AlertState;
  active_at?: string;
  value?: string;
  fingerprint?: string;
}

export interface AlertRule {
  name: string;
  query: string;
  duration: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  state?: AlertState;
  alerts: Alert[];
}

export interface AlertGroup {
  name: string;
  file: string;
  rules: AlertRule[];
}

export interface AlertRuleCreate {
  name: string;
  namespace: string;
  group_name: string;
  query: string;
  duration: string;
  severity: AlertSeverity;
  summary: string;
  description?: string;
  runbook_url?: string;
  labels: Record<string, string>;
}

// Silence Types
export interface SilenceMatcher {
  name: string;
  value: string;
  isRegex?: boolean;
}

export interface SilenceCreate {
  matchers: SilenceMatcher[];
  starts_at: string;
  ends_at: string;
  created_by: string;
  comment: string;
}

export interface Silence {
  id: string;
  matchers: SilenceMatcher[];
  starts_at: string;
  ends_at: string;
  created_by: string;
  comment: string;
  status: Record<string, string>;
}

// Target Types
export interface ScrapeTarget {
  job: string;
  instance: string;
  health: TargetHealth;
  labels: Record<string, string>;
  last_scrape?: string;
  last_scrape_duration?: number;
  last_error?: string;
  scrape_url?: string;
}

export interface TargetGroup {
  job: string;
  targets: ScrapeTarget[];
  active_count: number;
  down_count: number;
}

// ServiceMonitor Types
export interface ServiceMonitorEndpoint {
  port?: string;
  target_port?: string | number;
  path: string;
  scheme: string;
  interval?: string;
  scrape_timeout?: string;
}

export interface ServiceMonitorSelector {
  match_labels: Record<string, string>;
}

export interface ServiceMonitorCreate {
  name: string;
  namespace: string;
  target_namespace?: string;
  selector: ServiceMonitorSelector;
  endpoints: ServiceMonitorEndpoint[];
  labels: Record<string, string>;
}

export interface ServiceMonitor {
  name: string;
  namespace: string;
  selector: ServiceMonitorSelector;
  endpoints: ServiceMonitorEndpoint[];
  labels: Record<string, string>;
  created_at?: string;
}

// Metric Metadata
export interface MetricMetadata {
  metric_name: string;
  type: string;
  help: string;
  unit?: string;
}

// Response Types
export interface DeploymentResult {
  success: boolean;
  message: string;
  status?: PrometheusStackStatus;
  notes?: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
}

export interface RulesResponse {
  groups: AlertGroup[];
}

export interface TargetsResponse {
  targets: TargetGroup[];
  active_count: number;
  down_count: number;
}

export interface ServiceMonitorsResponse {
  service_monitors: ServiceMonitor[];
  total: number;
}

export interface SilencesResponse {
  silences: Silence[];
  total: number;
}

export interface MetricsMetadataResponse {
  metrics: MetricMetadata[];
}

export interface LabelsResponse {
  labels: string[];
}

export interface LabelValuesResponse {
  label: string;
  values: string[];
}
