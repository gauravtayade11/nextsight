import { useState, useEffect } from 'react';
import { kubernetesApi } from '../../services/api';
import {
  CurrencyDollarIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ServerStackIcon,
  CubeIcon,
  FolderIcon,
  CalendarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

// Types
interface NamespaceCost {
  namespace: string;
  cpu_cost: number;
  memory_cost: number;
  storage_cost: number;
  total_cost: number;
  pod_count: number;
  trend: number; // percentage change
}

interface NodeCost {
  name: string;
  instance_type: string;
  hourly_cost: number;
  monthly_cost: number;
  cpu_utilization: number;
  memory_utilization: number;
}

interface CostAnomaly {
  id: string;
  resource: string;
  namespace: string;
  type: 'spike' | 'unusual' | 'waste';
  message: string;
  estimated_impact: number;
  detected_at: string;
}

interface CostSummary {
  total_monthly: number;
  total_daily: number;
  compute_cost: number;
  storage_cost: number;
  network_cost: number;
  trend_monthly: number;
  efficiency_score: number;
}

// Utility functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyDecimal(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Mock data generator (in real implementation, this would come from backend)
function generateMockData() {
  const namespaces: NamespaceCost[] = [
    { namespace: 'production', cpu_cost: 450, memory_cost: 280, storage_cost: 120, total_cost: 850, pod_count: 45, trend: 5.2 },
    { namespace: 'staging', cpu_cost: 180, memory_cost: 95, storage_cost: 45, total_cost: 320, pod_count: 22, trend: -2.1 },
    { namespace: 'development', cpu_cost: 120, memory_cost: 65, storage_cost: 30, total_cost: 215, pod_count: 18, trend: 12.5 },
    { namespace: 'monitoring', cpu_cost: 85, memory_cost: 120, storage_cost: 200, total_cost: 405, pod_count: 8, trend: 0.5 },
    { namespace: 'logging', cpu_cost: 65, memory_cost: 180, storage_cost: 350, total_cost: 595, pod_count: 5, trend: 8.3 },
    { namespace: 'devtroncd', cpu_cost: 95, memory_cost: 75, storage_cost: 25, total_cost: 195, pod_count: 12, trend: -1.2 },
  ];

  const nodes: NodeCost[] = [
    { name: 'node-1', instance_type: 'm5.xlarge', hourly_cost: 0.192, monthly_cost: 138.24, cpu_utilization: 72, memory_utilization: 65 },
    { name: 'node-2', instance_type: 'm5.xlarge', hourly_cost: 0.192, monthly_cost: 138.24, cpu_utilization: 58, memory_utilization: 71 },
    { name: 'node-3', instance_type: 'm5.2xlarge', hourly_cost: 0.384, monthly_cost: 276.48, cpu_utilization: 45, memory_utilization: 52 },
  ];

  const anomalies: CostAnomaly[] = [
    { id: '1', resource: 'data-processor', namespace: 'production', type: 'spike', message: 'CPU usage increased 150% in the last 24h', estimated_impact: 120, detected_at: '2h ago' },
    { id: '2', resource: 'cache-redis', namespace: 'staging', type: 'waste', message: 'Resource is idle 85% of the time', estimated_impact: 45, detected_at: '1d ago' },
    { id: '3', resource: 'log-aggregator', namespace: 'logging', type: 'unusual', message: 'Storage growth 3x normal rate', estimated_impact: 80, detected_at: '4h ago' },
  ];

  const summary: CostSummary = {
    total_monthly: 2580,
    total_daily: 86,
    compute_cost: 1580,
    storage_cost: 770,
    network_cost: 230,
    trend_monthly: 4.2,
    efficiency_score: 73,
  };

  return { namespaces, nodes, anomalies, summary };
}

// Components
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'blue'
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof CurrencyDollarIcon;
  trend?: number;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend >= 0 ? 'text-red-500' : 'text-green-500'}`}>
            {trend >= 0 ? <ArrowTrendingUpIcon className="h-4 w-4" /> : <ArrowTrendingDownIcon className="h-4 w-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function CostBreakdownChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Cost Breakdown</h3>
      <div className="flex items-center gap-6">
        {/* Donut Chart Visual */}
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            {data.reduce((acc, item, index) => {
              const percentage = (item.value / total) * 100;
              const previousPercentage = acc.offset;
              acc.elements.push(
                <circle
                  key={index}
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeDasharray={`${percentage} ${100 - percentage}`}
                  strokeDashoffset={-previousPercentage}
                  className="transition-all duration-500"
                />
              );
              acc.offset += percentage;
              return acc;
            }, { elements: [] as JSX.Element[], offset: 0 }).elements}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(total)}</p>
              <p className="text-xs text-gray-500">Monthly</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NamespaceCostTable({ namespaces }: { namespaces: NamespaceCost[] }) {
  const [sortBy, setSortBy] = useState<'total_cost' | 'trend'>('total_cost');
  const sorted = [...namespaces].sort((a, b) =>
    sortBy === 'total_cost' ? b.total_cost - a.total_cost : b.trend - a.trend
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderIcon className="h-5 w-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Cost by Namespace</h3>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'total_cost' | 'trend')}
          className="text-sm bg-gray-100 dark:bg-slate-700 border-0 rounded-lg px-3 py-1.5 text-gray-700 dark:text-gray-300"
        >
          <option value="total_cost">Sort by Cost</option>
          <option value="trend">Sort by Trend</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPU</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Memory</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Storage</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {sorted.map((ns) => (
              <tr key={ns.namespace} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary-500" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{ns.namespace}</p>
                      <p className="text-xs text-gray-500">{ns.pod_count} pods</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatCurrency(ns.cpu_cost)}</td>
                <td className="px-5 py-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatCurrency(ns.memory_cost)}</td>
                <td className="px-5 py-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatCurrency(ns.storage_cost)}</td>
                <td className="px-5 py-4 text-right">
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(ns.total_cost)}</span>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${ns.trend >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {ns.trend >= 0 ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
                    {Math.abs(ns.trend)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NodeCostTable({ nodes }: { nodes: NodeCost[] }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3">
        <ServerStackIcon className="h-5 w-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Cost by Node</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-900/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Node</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Instance Type</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hourly</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monthly</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {nodes.map((node) => (
              <tr key={node.name} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="px-5 py-4">
                  <p className="font-medium text-gray-900 dark:text-white">{node.name}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded">
                    {node.instance_type}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-sm text-gray-600 dark:text-gray-400">{formatCurrencyDecimal(node.hourly_cost)}</td>
                <td className="px-5 py-4 text-right">
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(node.monthly_cost)}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${node.cpu_utilization}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">CPU {node.cpu_utilization}%</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${node.memory_utilization}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Mem {node.memory_utilization}%</p>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CostAnomalies({ anomalies }: { anomalies: CostAnomaly[] }) {
  const typeConfig = {
    spike: { color: 'red', label: 'Cost Spike' },
    waste: { color: 'orange', label: 'Potential Waste' },
    unusual: { color: 'yellow', label: 'Unusual Activity' },
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3">
        <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Cost Anomalies</h3>
        <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
          {anomalies.length} detected
        </span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {anomalies.map((anomaly) => {
          const config = typeConfig[anomaly.type];
          return (
            <div key={anomaly.id} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded bg-${config.color}-100 text-${config.color}-700 dark:bg-${config.color}-900/30 dark:text-${config.color}-400`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-500">{anomaly.detected_at}</span>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">{anomaly.resource}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{anomaly.message}</p>
                  <p className="text-xs text-gray-400 mt-1">Namespace: {anomaly.namespace}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-600">+{formatCurrency(anomaly.estimated_impact)}</p>
                  <p className="text-xs text-gray-500">Est. Impact/mo</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyTrendChart() {
  // Mock daily data for the last 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cost: 75 + Math.random() * 30,
    };
  });

  const maxCost = Math.max(...days.map(d => d.cost));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ChartBarIcon className="h-5 w-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Daily Cost Trend</h3>
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Last 14 days</span>
        </div>
      </div>
      <div className="h-48 flex items-end justify-between gap-1">
        {days.map((day, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-gradient-to-t from-primary-500 to-primary-400 rounded-t hover:from-primary-600 hover:to-primary-500 transition-colors cursor-pointer"
              style={{ height: `${(day.cost / maxCost) * 100}%` }}
              title={`${day.date}: ${formatCurrencyDecimal(day.cost)}`}
            />
            <span className="text-xs text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">
              {index % 2 === 0 ? day.date : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Component
export default function ClusterCostDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReturnType<typeof generateMockData> | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setData(generateMockData());
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <ArrowPathIcon className="h-5 w-5 animate-spin" />
          <span>Loading cost data...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { namespaces, nodes, anomalies, summary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cluster Cost</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor and optimize your Kubernetes infrastructure costs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard
          title="Monthly Cost"
          value={formatCurrency(summary.total_monthly)}
          subtitle="Estimated"
          icon={CurrencyDollarIcon}
          trend={summary.trend_monthly}
          color="blue"
        />
        <StatCard
          title="Daily Cost"
          value={formatCurrency(summary.total_daily)}
          subtitle="Average"
          icon={CalendarIcon}
          color="purple"
        />
        <StatCard
          title="Compute Cost"
          value={formatCurrency(summary.compute_cost)}
          subtitle="CPU + Memory"
          icon={CubeIcon}
          color="orange"
        />
        <StatCard
          title="Storage Cost"
          value={formatCurrency(summary.storage_cost)}
          subtitle="PVCs + Images"
          icon={FolderIcon}
          color="green"
        />
        <StatCard
          title="Efficiency Score"
          value={`${summary.efficiency_score}%`}
          subtitle="Resource utilization"
          icon={ChartBarIcon}
          color="blue"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <DailyTrendChart />
        </div>
        <CostBreakdownChart
          data={[
            { label: 'Compute', value: summary.compute_cost, color: '#3B82F6' },
            { label: 'Storage', value: summary.storage_cost, color: '#10B981' },
            { label: 'Network', value: summary.network_cost, color: '#8B5CF6' },
          ]}
        />
      </div>

      {/* Cost Tables */}
      <div className="grid grid-cols-2 gap-6">
        <NamespaceCostTable namespaces={namespaces} />
        <CostAnomalies anomalies={anomalies} />
      </div>

      {/* Node Costs */}
      <NodeCostTable nodes={nodes} />
    </div>
  );
}
