import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  BellAlertIcon,
  DocumentTextIcon,
  CpuChipIcon,
  CircleStackIcon,
  GlobeAltIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  Cog6ToothIcon,
  RocketLaunchIcon,
  ServerIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import PageHeader from '../common/PageHeader';
import { kubernetesApi, aiApi } from '../../services/api';
import { prometheusApi } from '../../services/prometheusApi';
import { logger } from '../../utils/logger';
import { useWebSocketLogs } from '../../hooks/useWebSocketLogs';
import type { ClusterMetrics, K8sEvent, NodeMetrics, Pod } from '../../types';
import type { PrometheusStackStatus, QueryResult, Alert as PrometheusAlert } from '../../types/prometheus';

// Import shared constants
import { SEVERITY_CONFIG, getSeverityConfig } from '../../utils/constants';

interface MetricCard {
  name: string;
  value: string;
  unit: string;
  change: number;
  trend: number[];
  status: 'healthy' | 'warning' | 'critical';
  clickable?: boolean;  // NEW - for Active Alerts
  onClick?: () => void;  // NEW - for navigation
}

interface Alert {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  timestamp: string;
  status: 'firing' | 'resolved' | 'acknowledged';
  description: string;
  workloadName?: string;  // For navigation to workload
  namespace?: string;      // For filtering
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  source: string;
  message: string;
  namespace: string;
}

// Helper to convert K8s event to Alert
function eventToAlert(event: K8sEvent): Alert {
  const severity = event.type === 'Warning' ?
    (event.reason?.includes('Failed') || event.reason?.includes('Error') || event.reason?.includes('Kill') ? 'critical' : 'warning') : 'info';

  const isResolved = event.reason?.includes('Pulled') || event.reason?.includes('Started') ||
    event.reason?.includes('Created') || event.reason?.includes('Scheduled');

  return {
    id: event.name,
    title: `${event.reason}: ${event.involved_object?.name || 'Unknown'}`,
    severity,
    source: event.involved_object?.kind || 'Kubernetes',
    timestamp: event.last_timestamp || event.first_timestamp || 'Unknown',
    status: isResolved ? 'resolved' : 'firing',
    description: event.message,
    workloadName: event.involved_object?.name,
    namespace: event.namespace,
  };
}

// Helper to convert K8s event to LogEntry
function eventToLog(event: K8sEvent, index: number): LogEntry {
  const level = event.type === 'Warning' ?
    (event.reason?.includes('Failed') || event.reason?.includes('Error') ? 'error' : 'warn') : 'info';

  return {
    id: `${event.name}-${index}`,
    timestamp: event.last_timestamp || event.first_timestamp || new Date().toISOString(),
    level,
    source: event.involved_object?.name || 'Unknown',
    message: event.message,
    namespace: event.namespace,
  };
}

// Helper to format timestamp
function formatTimestamp(timestamp: string): string {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  return date.toLocaleDateString();
}

// Mini Sparkline Component
function MiniSparkline({ data, color = 'blue' }: { data: number[]; color?: string }) {
  const height = 24;

  const colorMap: Record<string, string> = {
    blue: 'stroke-blue-500',
    green: 'stroke-green-500',
    amber: 'stroke-amber-500',
    red: 'stroke-red-500',
  };

  // Filter out NaN/undefined values and ensure we have valid data
  const validData = data.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));

  // Need at least 2 points to draw a line
  if (validData.length < 2) {
    return (
      <svg width="60" height={height} className="overflow-visible">
        <line x1="0" y1={height / 2} x2="60" y2={height / 2} className={colorMap[color]} strokeWidth="1.5" strokeDasharray="4 2" />
      </svg>
    );
  }

  const max = Math.max(...validData);
  const min = Math.min(...validData);
  const range = max - min || 1;

  const points = validData.map((value, index) => {
    const x = (index / (validData.length - 1)) * 60;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="60" height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        className={colorMap[color]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Chart data types
interface ChartDataPoint {
  time: string;
  timestamp: number;
  cpu?: number;
  memory?: number;
  value?: number;
}

export default function MonitoringDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'metrics';
  const [alertFilter, setAlertFilter] = useState<'all' | 'firing' | 'resolved'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [logLevel, setLogLevel] = useState<'all' | 'error' | 'warn' | 'info' | 'debug'>('all');

  // Real data state
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Prometheus state
  const [prometheusStatus, setPrometheusStatus] = useState<PrometheusStackStatus | null>(null);
  const [prometheusAvailable, setPrometheusAvailable] = useState(false);
  const [cpuChartData, setCpuChartData] = useState<ChartDataPoint[]>([]);
  const [memoryChartData, setMemoryChartData] = useState<ChartDataPoint[]>([]);
  const [prometheusAlerts, setPrometheusAlerts] = useState<PrometheusAlert[]>([]);

  // Chart controls (NEW)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h'>('1h');
  const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory'>('cpu');

  // Pod Logs state (NEW)
  const [logSource, setLogSource] = useState<'events' | 'pods'>('events');
  const [pods, setPods] = useState<Pod[]>([]);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('default');
  const [podLogsStreaming, setPodLogsStreaming] = useState(false);

  // AI Log Summary state (NEW)
  const [aiSummary, setAiSummary] = useState<{
    summary: string;
    error_count: number;
    time_window: string;
    key_issues: string[];
  } | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [lastSummaryTime, setLastSummaryTime] = useState<Date | null>(null);

  // WebSocket logs hook (only enabled when viewing pod logs)
  const {
    logs: wsLogs,
    connected: wsConnected,
    error: wsError,
    status: wsStatus,
    connect: wsConnect,
    disconnect: wsDisconnect,
    clearLogs: wsClearLogs,
  } = useWebSocketLogs({
    namespace: selectedNamespace,
    podName: selectedPod?.name || '',
    container: selectedContainer,
    tailLines: 500,
    timestamps: true,
    enabled: logSource === 'pods' && !!selectedPod && podLogsStreaming,
  });

  // Check Prometheus status
  const checkPrometheusStatus = useCallback(async () => {
    try {
      const response = await prometheusApi.getStackStatus();
      setPrometheusStatus(response.data);
      setPrometheusAvailable(response.data.status === 'running');
      return response.data.status === 'running';
    } catch {
      setPrometheusAvailable(false);
      return false;
    }
  }, []);

  // Fetch Prometheus metrics for charts
  const fetchPrometheusData = useCallback(async () => {
    try {
      const now = new Date();

      // Calculate time range and step based on selection
      const timeRangeConfig = {
        '1h': { milliseconds: 60 * 60 * 1000, step: '60s' },
        '6h': { milliseconds: 6 * 60 * 60 * 1000, step: '5m' },
        '24h': { milliseconds: 24 * 60 * 60 * 1000, step: '15m' },
      };

      const config = timeRangeConfig[selectedTimeRange];
      const startTime = new Date(now.getTime() - config.milliseconds);

      // Query based on selected metric
      const query = selectedMetric === 'cpu'
        ? '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
        : '(1 - (sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))) * 100';

      // Fetch metric data and alerts in parallel
      const [metricRes, alertsRes] = await Promise.all([
        prometheusApi.queryRange({
          query,
          start: startTime.toISOString(),
          end: now.toISOString(),
          step: config.step,
        }).catch(() => null),
        prometheusApi.getAlerts().catch(() => null),
      ]);

      // Process metric data
      if (metricRes?.data?.result?.[0]?.values) {
        const data = metricRes.data.result[0].values.map((v: { timestamp: number; value: string }) => ({
          timestamp: v.timestamp,
          time: new Date(v.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          [selectedMetric]: parseFloat(v.value),
        }));

        // Store in appropriate state based on metric type
        if (selectedMetric === 'cpu') {
          setCpuChartData(data);
        } else {
          setMemoryChartData(data);
        }
      }

      // Process Prometheus alerts
      if (alertsRes?.data?.alerts) {
        setPrometheusAlerts(alertsRes.data.alerts);
      }
    } catch (err) {
      logger.error('Failed to fetch Prometheus data', err);
    }
  }, [selectedTimeRange, selectedMetric]);

  // Fetch data from APIs
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      // Check Prometheus status first
      const promAvailable = await checkPrometheusStatus();

      // Fetch cluster metrics, events, and pods
      const [metricsRes, eventsRes, podsRes] = await Promise.all([
        kubernetesApi.getClusterMetrics().catch(() => null),
        kubernetesApi.getEvents(undefined, 100).catch(() => null),
        kubernetesApi.getPods().catch(() => null),
      ]);

      // Process metrics
      if (metricsRes?.data && podsRes?.data) {
        const m = metricsRes.data;
        const pods = podsRes.data;

        // Calculate pod restarts
        const totalRestarts = pods.reduce((sum, pod) => sum + (pod.restarts || 0), 0);
        const problematicPods = pods.filter(pod => (pod.restarts || 0) > 3).length;
        const restartsStatus = problematicPods > 10 ? 'critical' : problematicPods > 3 ? 'warning' : 'healthy';

        // Calculate firing alerts (will be updated after events are processed)
        const firingAlertsCount = alerts.filter(a => a.status === 'firing').length;

        const newMetrics: MetricCard[] = [
          {
            name: 'CPU Usage',
            value: Math.round(m.cpu_percent).toString(),
            unit: '%',
            change: 0,
            trend: m.nodes.map(n => n.cpu_percent),
            status: m.cpu_percent > 85 ? 'critical' : m.cpu_percent > 70 ? 'warning' : 'healthy',
          },
          {
            name: 'Memory Usage',
            value: Math.round(m.memory_percent).toString(),
            unit: '%',
            change: 0,
            trend: m.nodes.map(n => n.memory_percent),
            status: m.memory_percent > 85 ? 'critical' : m.memory_percent > 70 ? 'warning' : 'healthy',
          },
          {
            name: 'Pod Restarts',
            value: `${totalRestarts} total`,
            unit: `(${problematicPods} pods with issues)`,
            change: 0,
            trend: pods.slice(0, 9).map(p => p.restarts || 0),
            status: restartsStatus,
          },
          {
            name: 'Active Alerts',
            value: firingAlertsCount.toString(),
            unit: 'firing',
            change: 0,
            trend: Array(9).fill(firingAlertsCount),
            status: firingAlertsCount > 5 ? 'critical' : firingAlertsCount > 0 ? 'warning' : 'healthy',
            clickable: true,
            onClick: () => {
              setSearchParams({ tab: 'alerts' });
            },
          },
        ];
        setMetrics(newMetrics);

        // Store pods for pod selector dropdown
        setPods(pods);
      }

      // Process events into alerts and logs
      if (eventsRes?.data) {
        const events = eventsRes.data;

        // Convert to alerts (filter Warning events)
        const newAlerts = events
          .filter(e => e.type === 'Warning' || e.count > 1)
          .slice(0, 20)
          .map(eventToAlert);
        setAlerts(newAlerts);

        // Convert to logs (all events)
        const newLogs = events.slice(0, 50).map(eventToLog);
        setLogs(newLogs);
      }

      // Fetch Prometheus data if available
      if (promAvailable) {
        await fetchPrometheusData();
      }
    } catch (err) {
      logger.error('Failed to fetch monitoring data', err);
      setError('Failed to fetch monitoring data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [checkPrometheusStatus, fetchPrometheusData]);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch AI Summary
  const fetchAISummary = useCallback(async () => {
    try {
      setAiSummaryLoading(true);
      const response = await aiApi.summarizeLogs(undefined, 10);
      if (response.data && response.data.success) {
        setAiSummary({
          summary: response.data.summary,
          error_count: response.data.error_count,
          time_window: response.data.time_window,
          key_issues: response.data.key_issues,
        });
        setLastSummaryTime(new Date());
      }
    } catch (error) {
      logger.error('Failed to fetch AI summary:', error);
    } finally {
      setAiSummaryLoading(false);
    }
  }, []);

  // Auto-refresh AI summary when Logs tab is active
  useEffect(() => {
    if (activeTab === 'logs' && logSource === 'events') {
      fetchAISummary();
      const interval = setInterval(fetchAISummary, 2 * 60 * 1000); // 2 minutes
      return () => clearInterval(interval);
    }
  }, [activeTab, logSource, fetchAISummary]);

  // Tab badge for alerts
  const firingAlerts = alerts.filter(a => a.status === 'firing').length;
  const tabs = [
    { id: 'metrics', label: 'Metrics', icon: ChartBarIcon },
    { id: 'alerts', label: 'Alerts', icon: BellAlertIcon, badge: firingAlerts },
    { id: 'logs', label: 'Logs', icon: DocumentTextIcon },
  ];

  const getMetricIcon = (name: string) => {
    if (name.includes('CPU')) return CpuChipIcon;
    if (name.includes('Memory') || name.includes('Disk')) return CircleStackIcon;
    if (name.includes('Network')) return GlobeAltIcon;
    return SignalIcon;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-amber-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' };
      case 'warning': return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' };
      case 'info': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' };
      default: return { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-800' };
    }
  };

  const getLogLevelStyles = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
      case 'warn': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
      case 'info': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
      case 'debug': return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (alertFilter === 'all') return true;
    if (alertFilter === 'firing') return alert.status === 'firing';
    if (alertFilter === 'resolved') return alert.status === 'resolved';
    return true;
  });

  const filteredLogs = logs.filter(log => {
    const matchesSearch = logSearch === '' || log.message.toLowerCase().includes(logSearch.toLowerCase()) || log.source.toLowerCase().includes(logSearch.toLowerCase());
    const matchesLevel = logLevel === 'all' || log.level === logLevel;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring & Logs"
        description="Real-time metrics, alerts, and log aggregation"
        icon={SignalIcon}
        iconColor="green"
        actions={
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </motion.button>
        }
      />

      {/* Tabs - Sticky below header */}
      <div className="sticky top-[72px] z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 bg-gradient-to-r from-slate-50/95 via-white/95 to-slate-50/95 dark:from-slate-900/95 dark:via-slate-900/95 dark:to-slate-900/95 backdrop-blur-md border-b border-gray-200/50 dark:border-slate-700/50">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ tab: tab.id })}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                  : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700/50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                  activeTab === tab.id ? 'bg-white/20' : 'bg-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <ArrowPathIcon className="h-8 w-8 text-green-500 animate-spin" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Loading monitoring data...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">{error}</span>
            <button
              onClick={() => fetchData()}
              className="mt-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-600"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Metrics Tab */}
      {!loading && !error && activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
                No metrics available. Connect to a Kubernetes cluster to view metrics.
              </div>
            ) : null}
            {metrics.map((metric, index) => {
              const Icon = getMetricIcon(metric.name);
              const isPositive = metric.change >= 0;
              return (
                <motion.div
                  key={metric.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={metric.clickable ? metric.onClick : undefined}
                  className={`p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 ${
                    metric.clickable ? 'cursor-pointer hover:shadow-lg hover:scale-105 transition-all' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-700">
                        <Icon className="h-4 w-4 text-gray-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{metric.name}</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      metric.status === 'healthy' ? 'bg-green-500' : metric.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{metric.unit}</span>
                    </div>
                    <MiniSparkline data={metric.trend} color={metric.status === 'healthy' ? 'green' : metric.status === 'warning' ? 'amber' : 'red'} />
                  </div>
                  <div className={`flex items-center gap-1 mt-2 text-xs ${
                    isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {isPositive ? (
                      <ArrowTrendingUpIcon className="h-3 w-3" />
                    ) : (
                      <ArrowTrendingDownIcon className="h-3 w-3" />
                    )}
                    <span>{Math.abs(metric.change)}% vs last hour</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Prometheus Status Banner */}
          {!prometheusAvailable && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <RocketLaunchIcon className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Enable Advanced Monitoring</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Deploy Prometheus for detailed metrics, historical charts, and alerting
                    </p>
                  </div>
                </div>
                <Link
                  to="/monitoring/prometheus"
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                  Setup Prometheus
                </Link>
              </div>
            </motion.div>
          )}

          {/* Unified Chart Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
          >
            {/* Chart Header with Controls */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Cluster {selectedMetric === 'cpu' ? 'CPU' : 'Memory'} Usage - Last {selectedTimeRange}
                </h3>
                {prometheusAvailable && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                    Live from Prometheus
                  </span>
                )}
              </div>

              {/* Time Range Selector */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedTimeRange}
                  onChange={(e) => setSelectedTimeRange(e.target.value as '1h' | '6h' | '24h')}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="1h">Last 1h</option>
                  <option value="6h">Last 6h</option>
                  <option value="24h">Last 24h</option>
                </select>

                {/* Metric Type Selector */}
                <select
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value as 'cpu' | 'memory')}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="cpu">CPU</option>
                  <option value="memory">Memory</option>
                </select>
              </div>
            </div>

            {/* Unified Chart Display */}
            {prometheusAvailable && (selectedMetric === 'cpu' ? cpuChartData.length > 0 : memoryChartData.length > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedMetric === 'cpu' ? cpuChartData : memoryChartData}>
                    <defs>
                      <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selectedMetric === 'cpu' ? '#3b82f6' : '#10b981'} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={selectedMetric === 'cpu' ? '#3b82f6' : '#10b981'} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      tickLine={{ stroke: '#4b5563' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      tickLine={{ stroke: '#4b5563' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: '#e2e8f0' }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, selectedMetric === 'cpu' ? 'CPU' : 'Memory']}
                    />
                    <Area
                      type="monotone"
                      dataKey={selectedMetric}
                      stroke={selectedMetric === 'cpu' ? '#3b82f6' : '#10b981'}
                      strokeWidth={2}
                      fill="url(#metricGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
                {prometheusAvailable ? 'Loading chart data...' : 'Deploy Prometheus for real-time charts'}
              </div>
            )}
          </motion.div>

          {/* Prometheus Alerts Section */}
          {prometheusAvailable && prometheusAlerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Prometheus Alerts</h3>
                <Link
                  to="/monitoring/prometheus/alerts"
                  className="text-xs text-primary-500 hover:text-primary-600"
                >
                  View All Alerts
                </Link>
              </div>
              <div className="space-y-2">
                {prometheusAlerts.slice(0, 5).map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      alert.labels.severity === 'critical'
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : alert.labels.severity === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                        : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          alert.labels.severity === 'critical' ? 'text-red-700 dark:text-red-400' :
                          alert.labels.severity === 'warning' ? 'text-amber-700 dark:text-amber-400' :
                          'text-blue-700 dark:text-blue-400'
                        }`}>
                          {alert.labels.alertname}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          alert.state === 'firing'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        }`}>
                          {alert.state}
                        </span>
                      </div>
                    </div>
                    {alert.annotations.summary && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {alert.annotations.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Prometheus Quick Links */}
          {prometheusAvailable && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Prometheus Tools</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link
                  to="/monitoring/prometheus"
                  className="flex items-center gap-2 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-gray-200/50 dark:border-slate-700/50 transition-colors"
                >
                  <Cog6ToothIcon className="h-5 w-5 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Setup</span>
                </Link>
                <Link
                  to="/monitoring/prometheus/explorer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-gray-200/50 dark:border-slate-700/50 transition-colors"
                >
                  <ChartBarIcon className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Explorer</span>
                </Link>
                <Link
                  to="/monitoring/prometheus/alerts"
                  className="flex items-center gap-2 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-gray-200/50 dark:border-slate-700/50 transition-colors"
                >
                  <BellAlertIcon className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Alerts</span>
                </Link>
                <Link
                  to="/monitoring/prometheus/targets"
                  className="flex items-center gap-2 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-gray-200/50 dark:border-slate-700/50 transition-colors"
                >
                  <ServerIcon className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Targets</span>
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {!loading && !error && activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Alert Filters */}
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {(['all', 'firing', 'resolved'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAlertFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                    alertFilter === filter
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {filter}
                  {filter === 'firing' && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
                      {alerts.filter(a => a.status === 'firing').length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Alert List */}
          <div className="space-y-3">
            {filteredAlerts.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <CheckCircleIcon className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>No alerts found. Your cluster is healthy!</p>
              </div>
            )}
            {filteredAlerts.map((alert, index) => {
              const styles = getSeverityStyles(alert.severity);
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-xl border ${styles.border} ${
                    alert.status === 'resolved' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${styles.bg}`}>
                        {alert.severity === 'critical' ? (
                          <ExclamationTriangleIcon className={`h-5 w-5 ${styles.text}`} />
                        ) : alert.severity === 'warning' ? (
                          <ExclamationTriangleIcon className={`h-5 w-5 ${styles.text}`} />
                        ) : (
                          <BellAlertIcon className={`h-5 w-5 ${styles.text}`} />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{alert.title}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{alert.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{alert.source}</span>
                          <span>{alert.timestamp}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                        alert.status === 'firing' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                        alert.status === 'resolved' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                        'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      }`}>
                        {alert.status}
                      </span>
                      {alert.status === 'firing' && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                        >
                          Acknowledge
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* Context Links - Show if workload name is available */}
                  {alert.workloadName && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                      <Link
                        to={`/kubernetes/workloads?search=${alert.workloadName}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View Workload
                      </Link>

                      <button
                        onClick={() => {
                          setSearchParams({ tab: 'logs' });
                          setLogSearch(alert.workloadName || '');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View Logs
                      </button>

                      <button
                        onClick={() => setSearchParams({ tab: 'logs' })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View Events
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {!loading && !error && activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Log Source Toggle */}
          <div className="flex items-center gap-4 p-1 rounded-xl bg-gray-100 dark:bg-slate-800 w-fit">
            <button
              onClick={() => {
                setLogSource('events');
                setPodLogsStreaming(false);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                logSource === 'events'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4" />
                Events
              </div>
            </button>
            <button
              onClick={() => setLogSource('pods')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                logSource === 'pods'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-4 w-4" />
                Pod Logs
              </div>
            </button>
          </div>

          {/* Pod Selector (when in 'pods' mode) */}
          {logSource === 'pods' && (
            <div className="flex items-center gap-3">
              <select
                value={selectedNamespace}
                onChange={(e) => {
                  setSelectedNamespace(e.target.value);
                  setSelectedPod(null);
                  setPodLogsStreaming(false);
                }}
                className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">All Namespaces</option>
                {Array.from(new Set(pods.map(p => p.namespace))).map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
              </select>

              <select
                value={selectedPod?.name || ''}
                onChange={(e) => {
                  const pod = pods.find(p => p.name === e.target.value);
                  setSelectedPod(pod || null);
                  setSelectedContainer(pod?.containers?.[0] || '');
                  setPodLogsStreaming(false);
                  wsClearLogs();
                }}
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select a pod...</option>
                {pods
                  .filter(p => !selectedNamespace || p.namespace === selectedNamespace)
                  .map(pod => (
                    <option key={`${pod.namespace}-${pod.name}`} value={pod.name}>
                      {pod.name} ({pod.namespace}) - {pod.status}
                    </option>
                  ))}
              </select>

              {selectedPod && selectedPod.containers.length > 1 && (
                <select
                  value={selectedContainer}
                  onChange={(e) => {
                    setSelectedContainer(e.target.value);
                    setPodLogsStreaming(false);
                    wsClearLogs();
                  }}
                  className="px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {selectedPod.containers.map(container => (
                    <option key={container} value={container}>{container}</option>
                  ))}
                </select>
              )}

              {selectedPod && (
                <button
                  onClick={() => {
                    if (podLogsStreaming) {
                      setPodLogsStreaming(false);
                      wsDisconnect();
                    } else {
                      setPodLogsStreaming(true);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    podLogsStreaming
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {podLogsStreaming ? 'Stop' : 'Start'} Streaming
                </button>
              )}
            </div>
          )}

          {/* Log Filters (for Events only) */}
          {logSource === 'events' && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'error', 'warn', 'info', 'debug'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setLogLevel(level)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                      logLevel === level
                        ? level === 'error' ? 'bg-red-500 text-white' :
                          level === 'warn' ? 'bg-amber-500 text-white' :
                          level === 'info' ? 'bg-blue-500 text-white' :
                          level === 'debug' ? 'bg-gray-500 text-white' :
                          'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Log Summary Card (for Events only) */}
          {logSource === 'events' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 border border-purple-200 dark:border-purple-500/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  AI Log Summary - Last 10 Minutes
                </h3>
                <button
                  onClick={fetchAISummary}
                  disabled={aiSummaryLoading}
                  className="ml-auto p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50"
                  title="Refresh summary"
                >
                  <ArrowPathIcon className={`h-4 w-4 text-purple-600 dark:text-purple-400 ${aiSummaryLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {aiSummaryLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <ArrowPathIcon className="h-5 w-5 text-purple-500 animate-spin" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Analyzing logs...</span>
                </div>
              ) : aiSummary ? (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-line">
                    {aiSummary.summary}
                  </p>
                  {aiSummary.key_issues && aiSummary.key_issues.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-500/20">
                      <h4 className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">Key Issues:</h4>
                      <ul className="space-y-1">
                        {aiSummary.key_issues.map((issue, idx) => (
                          <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <span className="text-purple-500 mt-0.5">•</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{aiSummary.error_count} errors analyzed</span>
                    {lastSummaryTime && (
                      <span>Updated: {lastSummaryTime.toLocaleTimeString()}</span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">Click refresh to generate AI summary</p>
              )}
            </motion.div>
          )}

          {/* Log Entries - Events View */}
          {logSource === 'events' && (
            <div className="rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 overflow-hidden">
              <div className="p-3 bg-slate-800 dark:bg-slate-900 border-b border-slate-700 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Kubernetes Events</span>
                <span className="text-xs text-slate-500">{filteredLogs.length} entries</span>
              </div>
              <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
                {filteredLogs.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No log entries found</p>
                  </div>
                )}
                {filteredLogs.map((log) => (
                  <div key={log.id} className="px-4 py-2 hover:bg-slate-800/50 transition-colors font-mono text-xs">
                    <div className="flex items-start gap-3">
                      <span className="text-slate-500 whitespace-nowrap">{formatTimestamp(log.timestamp)}</span>
                      <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${getLogLevelStyles(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-cyan-400">[{log.source}]</span>
                      <span className="text-slate-300 flex-1">{log.message}</span>
                      <span className="text-slate-600">{log.namespace}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Log Entries - Pod Logs View */}
          {logSource === 'pods' && (
            <div className="rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 overflow-hidden">
              <div className="p-3 bg-slate-800 dark:bg-slate-900 border-b border-slate-700 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">
                  {selectedPod ? `${selectedPod.name} - ${selectedContainer || 'default'}` : 'Pod Logs'}
                </span>
                <div className="flex items-center gap-3">
                  {podLogsStreaming && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-xs text-green-400">Live</span>
                    </div>
                  )}
                  {wsError && (
                    <span className="text-xs text-red-400">{wsError}</span>
                  )}
                  <span className="text-xs text-slate-500">{wsLogs.length} lines</span>
                </div>
              </div>
              <div className="p-4 font-mono text-xs max-h-[600px] overflow-y-auto bg-slate-950">
                {!selectedPod && (
                  <div className="text-center py-8 text-slate-400">
                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Select a pod to view logs</p>
                  </div>
                )}
                {selectedPod && wsLogs.length === 0 && !podLogsStreaming && (
                  <div className="text-center py-8 text-slate-400">
                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Click "Start Streaming" to view logs</p>
                  </div>
                )}
                {selectedPod && wsLogs.length === 0 && podLogsStreaming && (
                  <div className="text-center py-8 text-slate-400">
                    <ArrowPathIcon className="h-12 w-12 mx-auto mb-3 opacity-50 animate-spin" />
                    <p>Waiting for logs...</p>
                  </div>
                )}
                {wsLogs.map((logLine, idx) => (
                  <div key={idx} className="py-0.5 text-slate-300 hover:bg-slate-800/30">
                    {logLine}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
