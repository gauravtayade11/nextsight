import api from '../utils/axios';
import type {
  PrometheusStackConfig,
  PrometheusStackStatus,
  DeploymentResult,
  OperationResult,
  InstantQueryRequest,
  RangeQueryRequest,
  QueryResult,
  AlertsResponse,
  RulesResponse,
  TargetsResponse,
  ServiceMonitorsResponse,
  SilencesResponse,
  MetricsMetadataResponse,
  LabelsResponse,
  LabelValuesResponse,
  AlertRuleCreate,
  SilenceCreate,
  ServiceMonitorCreate,
} from '../types/prometheus';

// Prometheus API
export const prometheusApi = {
  // ==========================================================================
  // Stack Management
  // ==========================================================================

  /**
   * Deploy the Prometheus stack to the cluster
   */
  deployStack: (config: PrometheusStackConfig) =>
    api.post<DeploymentResult>('/prometheus/deploy', config),

  /**
   * Upgrade the Prometheus stack configuration
   */
  upgradeStack: (config: PrometheusStackConfig) =>
    api.put<DeploymentResult>('/prometheus/upgrade', config),

  /**
   * Uninstall the Prometheus stack
   */
  uninstallStack: (namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.delete<OperationResult>('/prometheus/uninstall', {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Get the current status of the Prometheus stack
   */
  getStackStatus: (namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.get<PrometheusStackStatus>('/prometheus/status', {
      params: { namespace, release_name: releaseName },
    }),

  // ==========================================================================
  // PromQL Queries
  // ==========================================================================

  /**
   * Execute an instant PromQL query
   */
  query: (request: InstantQueryRequest, namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.post<QueryResult>('/prometheus/query', request, {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Execute a range PromQL query
   */
  queryRange: (request: RangeQueryRequest, namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.post<QueryResult>('/prometheus/query_range', request, {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Get all scrape targets
   */
  getTargets: (namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.get<TargetsResponse>('/prometheus/targets', {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Get metric metadata
   */
  getMetricMetadata: (namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.get<MetricsMetadataResponse>('/prometheus/metadata', {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Get all label names
   */
  getLabels: (namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.get<LabelsResponse>('/prometheus/labels', {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Get values for a specific label
   */
  getLabelValues: (labelName: string, namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.get<LabelValuesResponse>(`/prometheus/label/${labelName}/values`, {
      params: { namespace, release_name: releaseName },
    }),

  // ==========================================================================
  // Alert Rules
  // ==========================================================================

  /**
   * Get all alerting rules
   */
  getRules: (namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.get<RulesResponse>('/prometheus/rules', {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Create a new alert rule
   */
  createAlertRule: (rule: AlertRuleCreate) =>
    api.post<OperationResult>('/prometheus/rules', rule),

  /**
   * Delete an alert rule
   */
  deleteAlertRule: (namespace: string, name: string) =>
    api.delete<OperationResult>(`/prometheus/rules/${namespace}/${name}`),

  // ==========================================================================
  // Active Alerts
  // ==========================================================================

  /**
   * Get all active alerts from Prometheus
   */
  getAlerts: (namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.get<AlertsResponse>('/prometheus/alerts', {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Get all alerts from Alertmanager
   */
  getAlertmanagerAlerts: (namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.get<AlertsResponse>('/prometheus/alertmanager/alerts', {
      params: { namespace, release_name: releaseName },
    }),

  // ==========================================================================
  // Silences
  // ==========================================================================

  /**
   * Get all silences
   */
  getSilences: (namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.get<SilencesResponse>('/prometheus/alertmanager/silences', {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Create a new silence
   */
  createSilence: (silence: SilenceCreate, namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.post<OperationResult>('/prometheus/alertmanager/silences', silence, {
      params: { namespace, release_name: releaseName },
    }),

  /**
   * Delete a silence
   */
  deleteSilence: (silenceId: string, namespace = 'monitoring', releaseName = 'prometheus-stack') =>
    api.delete<OperationResult>(`/prometheus/alertmanager/silences/${silenceId}`, {
      params: { namespace, release_name: releaseName },
    }),

  // ==========================================================================
  // ServiceMonitors
  // ==========================================================================

  /**
   * List all ServiceMonitors
   */
  getServiceMonitors: (namespace?: string) =>
    api.get<ServiceMonitorsResponse>('/prometheus/servicemonitors', {
      params: namespace ? { namespace } : {},
    }),

  /**
   * Create a new ServiceMonitor
   */
  createServiceMonitor: (monitor: ServiceMonitorCreate) =>
    api.post<OperationResult>('/prometheus/servicemonitors', monitor),

  /**
   * Delete a ServiceMonitor
   */
  deleteServiceMonitor: (namespace: string, name: string) =>
    api.delete<OperationResult>(`/prometheus/servicemonitors/${namespace}/${name}`),
};

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Format duration in seconds to human readable string
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};

/**
 * Parse Prometheus duration string to seconds
 */
export const parseDuration = (duration: string): number => {
  const match = duration.match(/^(\d+)(s|m|h|d|w|y)$/);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
    y: 31536000,
  };

  return value * (multipliers[unit] || 1);
};

/**
 * Get relative time string from date
 */
export const getRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

/**
 * Get severity color class
 */
export const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'text-red-500 bg-red-500/10';
    case 'warning':
      return 'text-amber-500 bg-amber-500/10';
    case 'info':
      return 'text-blue-500 bg-blue-500/10';
    default:
      return 'text-gray-500 bg-gray-500/10';
  }
};

/**
 * Get target health color class
 */
export const getTargetHealthColor = (health: string): string => {
  switch (health.toLowerCase()) {
    case 'up':
      return 'text-green-500 bg-green-500/10';
    case 'down':
      return 'text-red-500 bg-red-500/10';
    default:
      return 'text-gray-500 bg-gray-500/10';
  }
};

export default prometheusApi;
