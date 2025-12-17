import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  PlayIcon,
  ClockIcon,
  ChartBarIcon,
  TableCellsIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import GlassCard from '../common/GlassCard';
import { prometheusApi, getRelativeTime } from '../../services/prometheusApi';
import type { QueryResult, MetricSample, MetricMetadata, StackStatus } from '../../types/prometheus';

// Time range options
const TIME_RANGES = [
  { label: '15m', value: 15 * 60 },
  { label: '1h', value: 60 * 60 },
  { label: '3h', value: 3 * 60 * 60 },
  { label: '6h', value: 6 * 60 * 60 },
  { label: '12h', value: 12 * 60 * 60 },
  { label: '24h', value: 24 * 60 * 60 },
  { label: '2d', value: 2 * 24 * 60 * 60 },
  { label: '7d', value: 7 * 24 * 60 * 60 },
];

// Common PromQL queries
const EXAMPLE_QUERIES = [
  { label: 'CPU Usage by Pod', query: 'sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (pod)' },
  { label: 'Memory Usage by Pod', query: 'sum(container_memory_usage_bytes{container!=""}) by (pod)' },
  { label: 'Node CPU Usage', query: '100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)' },
  { label: 'Node Memory Usage', query: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100' },
  { label: 'HTTP Request Rate', query: 'sum(rate(http_requests_total[5m])) by (method, status)' },
  { label: 'Pod Restart Count', query: 'sum(kube_pod_container_status_restarts_total) by (pod)' },
];

// Color palette for chart lines
const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

interface ChartData {
  timestamp: number;
  [key: string]: number | string;
}

export default function MetricsExplorer() {
  const [query, setQuery] = useState('');
  const [timeRange, setTimeRange] = useState(TIME_RANGES[1].value); // Default 1h
  const [step, setStep] = useState('60s');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [stackStatus, setStackStatus] = useState<StackStatus | null>(null);
  const [metrics, setMetrics] = useState<MetricMetadata[]>([]);
  const [showMetricBrowser, setShowMetricBrowser] = useState(false);
  const [metricSearch, setMetricSearch] = useState('');

  // Check Prometheus status on mount
  useEffect(() => {
    checkPrometheusStatus();
    loadMetrics();
  }, []);

  const checkPrometheusStatus = async () => {
    try {
      const response = await prometheusApi.getStackStatus();
      setStackStatus(response.data.status);
    } catch {
      setStackStatus('not_installed');
    }
  };

  const loadMetrics = async () => {
    try {
      const response = await prometheusApi.getMetricMetadata();
      setMetrics(response.data.metrics);
    } catch {
      // Ignore error
    }
  };

  const executeQuery = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const now = new Date();
      const start = new Date(now.getTime() - timeRange * 1000);

      const response = await prometheusApi.queryRange({
        query: query.trim(),
        start: start.toISOString(),
        end: now.toISOString(),
        step,
      });

      setResult(response.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Query execution failed';
      setResult({
        status: 'error',
        result_type: '',
        result: [],
        error: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  }, [query, timeRange, step]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      executeQuery();
    }
  };

  const selectMetric = (metricName: string) => {
    setQuery(metricName);
    setShowMetricBrowser(false);
  };

  const selectExampleQuery = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  // Transform query result to chart data
  const getChartData = (): ChartData[] => {
    if (!result || result.result_type !== 'matrix' || result.result.length === 0) {
      return [];
    }

    // Get all unique timestamps
    const timestampSet = new Set<number>();
    result.result.forEach((sample) => {
      sample.values?.forEach((v) => {
        timestampSet.add(v.timestamp);
      });
    });

    const timestamps = Array.from(timestampSet).sort((a, b) => a - b);

    // Build chart data
    return timestamps.map((ts) => {
      const dataPoint: ChartData = {
        timestamp: ts,
        time: new Date(ts * 1000).toLocaleTimeString(),
      };

      result.result.forEach((sample, idx) => {
        const label = getMetricLabel(sample, idx);
        const value = sample.values?.find((v) => v.timestamp === ts);
        dataPoint[label] = value ? parseFloat(value.value) : 0;
      });

      return dataPoint;
    });
  };

  // Get a label for a metric series
  const getMetricLabel = (sample: MetricSample, index: number): string => {
    const labels = sample.metric;
    if (Object.keys(labels).length === 0) {
      return `series-${index}`;
    }

    // Try common label combinations
    const labelParts: string[] = [];
    ['pod', 'container', 'instance', 'job', 'namespace', 'method', 'status'].forEach((key) => {
      if (labels[key]) {
        labelParts.push(`${key}=${labels[key]}`);
      }
    });

    if (labelParts.length === 0) {
      // Use first available label
      const firstKey = Object.keys(labels).find((k) => k !== '__name__');
      if (firstKey) {
        labelParts.push(`${firstKey}=${labels[firstKey]}`);
      }
    }

    return labelParts.join(', ') || `series-${index}`;
  };

  // Filter metrics for browser
  const filteredMetrics = metrics.filter((m) =>
    m.metric_name.toLowerCase().includes(metricSearch.toLowerCase()) ||
    m.help.toLowerCase().includes(metricSearch.toLowerCase())
  );

  // If Prometheus is not installed, show message
  if (stackStatus === 'not_installed') {
    return (
      <GlassCard>
        <div className="p-8 text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Prometheus Not Installed
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Please deploy the Prometheus stack first to use the Metrics Explorer.
          </p>
          <a
            href="/monitoring/prometheus/setup"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            Deploy Prometheus
          </a>
        </div>
      </GlassCard>
    );
  }

  const chartData = getChartData();
  const seriesLabels = result?.result.map((sample, idx) => getMetricLabel(sample, idx)) || [];

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <GlassCard>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">PromQL Query</h3>
          </div>

          {/* Query Editor */}
          <div className="relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter PromQL query... (Ctrl+Enter to execute)"
              className="w-full h-24 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
            <button
              onClick={() => setShowMetricBrowser(!showMetricBrowser)}
              className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Browse metrics"
            >
              <ChartBarIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Controls Row */}
          <div className="flex flex-wrap items-center gap-4 mt-4">
            {/* Time Range */}
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-gray-400" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                {TIME_RANGES.map((range) => (
                  <option key={range.label} value={range.value}>
                    Last {range.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Step */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Step:</span>
              <select
                value={step}
                onChange={(e) => setStep(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="15s">15s</option>
                <option value="30s">30s</option>
                <option value="60s">1m</option>
                <option value="300s">5m</option>
              </select>
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-700 rounded-lg">
              <button
                onClick={() => setViewMode('chart')}
                className={`p-1.5 rounded ${viewMode === 'chart' ? 'bg-white dark:bg-slate-600 shadow' : ''}`}
              >
                <ChartBarIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow' : ''}`}
              >
                <TableCellsIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1" />

            {/* Execute Button */}
            <button
              onClick={executeQuery}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <PlayIcon className="w-4 h-4" />
              )}
              Execute
            </button>
          </div>

          {/* Example Queries */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Example queries:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((eq) => (
                <button
                  key={eq.label}
                  onClick={() => selectExampleQuery(eq.query)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600"
                >
                  {eq.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Metric Browser Modal */}
      {showMetricBrowser && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowMetricBrowser(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Metric Browser</h3>
              <input
                type="text"
                value={metricSearch}
                onChange={(e) => setMetricSearch(e.target.value)}
                placeholder="Search metrics..."
                className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-sm"
                autoFocus
              />
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {filteredMetrics.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No metrics found</p>
              ) : (
                <div className="space-y-2">
                  {filteredMetrics.slice(0, 100).map((metric) => (
                    <button
                      key={metric.metric_name}
                      onClick={() => selectMetric(metric.metric_name)}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                      <p className="font-mono text-sm text-gray-900 dark:text-white">
                        {metric.metric_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{metric.help}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                        metric.type === 'counter' ? 'bg-blue-100 text-blue-700' :
                        metric.type === 'gauge' ? 'bg-green-100 text-green-700' :
                        metric.type === 'histogram' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {metric.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Results */}
      {result && (
        <GlassCard>
          <div className="p-4">
            {result.status === 'error' ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-300">Query Error</p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{result.error}</p>
                  </div>
                </div>
              </div>
            ) : result.result.length === 0 ? (
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-center">
                <InformationCircleIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No data returned for this query</p>
              </div>
            ) : viewMode === 'chart' ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {result.result.length} series returned
                  </h4>
                  <span className="text-xs text-gray-500">
                    {chartData.length} data points
                  </span>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        tickLine={{ stroke: '#4b5563' }}
                      />
                      <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        tickLine={{ stroke: '#4b5563' }}
                        tickFormatter={(value) => {
                          if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}G`;
                          if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                          if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                          return value.toFixed(2);
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(30, 41, 59, 0.95)',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#e2e8f0' }}
                        itemStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      {seriesLabels.slice(0, 10).map((label, idx) => (
                        <Line
                          key={label}
                          type="monotone"
                          dataKey={label}
                          stroke={COLORS[idx % COLORS.length]}
                          strokeWidth={1.5}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {seriesLabels.length > 10 && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Showing first 10 of {seriesLabels.length} series
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 font-medium text-gray-500">Labels</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Value</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-500">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.result.map((sample, idx) => {
                      const lastValue = sample.values?.[sample.values.length - 1] || sample.value;
                      return (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-3">
                            <code className="text-xs text-gray-600 dark:text-gray-300">
                              {JSON.stringify(sample.metric)}
                            </code>
                          </td>
                          <td className="text-right py-2 px-3 font-mono text-gray-900 dark:text-white">
                            {lastValue ? parseFloat(lastValue.value).toFixed(4) : '-'}
                          </td>
                          <td className="text-right py-2 px-3 text-gray-500">
                            {lastValue ? getRelativeTime(new Date(lastValue.timestamp * 1000)) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
