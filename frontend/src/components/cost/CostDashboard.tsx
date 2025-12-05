import { useState, useEffect } from 'react';
import { costApi } from '../../services/api';
import type { CostDashboardResponse, CostBreakdown } from '../../types';
import {
  CurrencyDollarIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  LightBulbIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
    low: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  };

  const { bg, text } = config[severity] || config.low;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {severity}
    </span>
  );
}

function CostBreakdownBar({ costs, total }: { costs: CostBreakdown; total: number }) {
  const colors: Record<string, string> = {
    cpu: 'bg-blue-500',
    memory: 'bg-green-500',
    storage: 'bg-purple-500',
    network: 'bg-orange-500',
    gpu: 'bg-pink-500',
  };

  const segments = Object.entries(costs)
    .filter(([key, value]) => key !== 'total' && value > 0)
    .map(([key, value]) => ({
      key,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
      color: colors[key] || 'bg-gray-500',
    }));

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`${seg.color}`}
            style={{ width: `${seg.percentage}%` }}
            title={`${seg.key}: ${formatCurrency(seg.value)} (${seg.percentage.toFixed(1)}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${seg.color}`} />
            <span className="text-gray-600 dark:text-gray-400 capitalize">{seg.key}</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(seg.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CostDashboard() {
  const [dashboardData, setDashboardData] = useState<CostDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'namespaces' | 'recommendations'>('overview');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await costApi.getDashboard();
      setDashboardData(response.data);
    } catch (err) {
      console.error('Failed to load cost dashboard:', err);
      setError('Failed to load cost data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg">
        <p>{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { summary, namespace_breakdown, recommendations, total_monthly_estimate, total_annual_estimate } = dashboardData;
  const totalSavings = recommendations.reduce((sum, r) => sum + r.estimated_savings, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Cost Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Resource cost analysis and optimization recommendations
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Hourly Cost</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary.total_cost.total)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Estimate</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(total_monthly_estimate)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Annual Estimate</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(total_annual_estimate)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <LightBulbIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Potential Savings</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalSavings)}/mo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex -mb-px">
          {(['overview', 'namespaces', 'recommendations'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 capitalize ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost Breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cost Breakdown by Resource
            </h3>
            <CostBreakdownBar costs={summary.total_cost} total={summary.total_cost.total} />

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">CPU</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.total_cost.cpu)}/hr
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Memory</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.total_cost.memory)}/hr
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Storage</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.total_cost.storage)}/hr
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Network</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(summary.total_cost.network)}/hr
                </p>
              </div>
            </div>
          </div>

          {/* Top Costly Pods */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top Costly Pods
            </h3>
            <div className="space-y-3">
              {summary.top_costly_pods.slice(0, 5).map((pod, idx) => (
                <div
                  key={`${pod.namespace}-${pod.name}`}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-5">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {pod.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {pod.namespace}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(pod.costs.total)}/hr
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'namespaces' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Namespace
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Hourly Cost
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  % of Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Pods
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Breakdown
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {namespace_breakdown.map((ns) => (
                <tr key={ns.namespace} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {ns.namespace}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(ns.costs.total)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-gray-600 dark:text-gray-400">
                      {ns.percentage_of_total.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-gray-600 dark:text-gray-400">
                      {ns.pod_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-48">
                      <div className="flex h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-600">
                        <div
                          className="bg-blue-500"
                          style={{ width: `${ns.costs.total > 0 ? (ns.costs.cpu / ns.costs.total) * 100 : 0}%` }}
                          title={`CPU: ${formatCurrency(ns.costs.cpu)}`}
                        />
                        <div
                          className="bg-green-500"
                          style={{ width: `${ns.costs.total > 0 ? (ns.costs.memory / ns.costs.total) * 100 : 0}%` }}
                          title={`Memory: ${formatCurrency(ns.costs.memory)}`}
                        />
                        <div
                          className="bg-purple-500"
                          style={{ width: `${ns.costs.total > 0 ? (ns.costs.storage / ns.costs.total) * 100 : 0}%` }}
                          title={`Storage: ${formatCurrency(ns.costs.storage)}`}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
              <CheckCircleIcon className="h-12 w-12 mx-auto text-green-500" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                No Optimization Recommendations
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Your resources appear to be well-optimized.
              </p>
            </div>
          ) : (
            recommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      rec.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30' :
                      rec.severity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {rec.severity === 'high' ? (
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                      ) : rec.severity === 'medium' ? (
                        <LightBulbIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <InformationCircleIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {rec.title}
                        </h4>
                        <SeverityBadge severity={rec.severity} />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {rec.description}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          Resource: <span className="font-medium">{rec.resource_type}/{rec.resource_name}</span>
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          Namespace: <span className="font-medium">{rec.namespace}</span>
                        </span>
                      </div>
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Recommended Action:
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {rec.action}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Current Cost</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(rec.current_cost)}/hr
                    </p>
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/30 rounded">
                      <p className="text-xs text-green-600 dark:text-green-400">Potential Savings</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(rec.estimated_savings)}/hr
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ({rec.percentage_savings.toFixed(1)}% reduction)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
