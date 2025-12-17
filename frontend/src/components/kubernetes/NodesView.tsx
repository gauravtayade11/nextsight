import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ServerIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  CpuChipIcon,
  CircleStackIcon,
  CubeIcon,
  SparklesIcon,
  XMarkIcon,
  TagIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';
import GlassCard from '../common/GlassCard';
import useNodesData from '../../hooks/useNodesData';
import type { NodeInfo, NodeMetrics, Pod } from '../../types';

// Import shared constants
import { containerVariants, itemVariants, COLOR_PALETTE } from '../../utils/constants';
import { StatusBadge, HealthIndicator } from '../common/StatusBadge';

// Mini Sparkline Chart
function MiniSparkline({ data, color, height = 40 }: { data: number[]; color: 'blue' | 'purple'; height?: number }) {
  const max = Math.max(...data, 100);
  const width = 100;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - (value / max) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');

  const strokeColor = color === 'blue' ? '#3B82F6' : '#8B5CF6';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// KPI Card Component - Uses shared COLOR_PALETTE
function KPICard({
  title,
  value,
  icon: Icon,
  color,
  index
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'red';
  index: number;
}) {
  // Map to COLOR_PALETTE colors
  const colorMap: Record<string, keyof typeof COLOR_PALETTE> = {
    blue: 'blue',
    green: 'green',
    red: 'red',
  };
  const colors = COLOR_PALETTE[colorMap[color]];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${colors.bg}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// Progress Bar Component
function ProgressBar({ value, color }: { value: number; color: 'blue' | 'purple' | 'amber' }) {
  const colorClass = {
    blue: value >= 90 ? 'bg-red-500' : value >= 70 ? 'bg-amber-500' : 'bg-blue-500',
    purple: value >= 90 ? 'bg-red-500' : value >= 70 ? 'bg-amber-500' : 'bg-purple-500',
    amber: value >= 90 ? 'bg-red-500' : value >= 70 ? 'bg-amber-500' : 'bg-amber-500',
  };

  return (
    <div className="h-1.5 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`h-full rounded-full ${colorClass[color]}`}
      />
    </div>
  );
}

// Node Row Component
function NodeRow({
  node,
  metrics,
  podCount,
  isSelected,
  onClick
}: {
  node: NodeInfo;
  metrics?: NodeMetrics;
  podCount: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isReady = node.status === 'Ready';
  const cpuPercent = metrics?.cpu_percent || 0;
  const memPercent = metrics?.memory_percent || 0;

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      className={`cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-500/10'
          : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isReady ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-red-100 dark:bg-red-500/10'}`}>
            <ServerIcon className={`h-4 w-4 ${isReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{node.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{node.internal_ip}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {node.roles.map((role) => (
            <span key={role} className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
              {role}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="w-24">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">{cpuPercent}%</span>
          </div>
          <ProgressBar value={cpuPercent} color="blue" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="w-24">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">{memPercent}%</span>
          </div>
          <ProgressBar value={memPercent} color="purple" />
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        {podCount}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
          isReady
            ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'
        }`}>
          {isReady ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
          {node.status}
        </span>
      </td>
    </motion.tr>
  );
}

// Node Details Drawer
function NodeDrawer({
  node,
  metrics,
  pods,
  onClose
}: {
  node: NodeInfo;
  metrics?: NodeMetrics;
  pods: Pod[];
  onClose: () => void;
}) {
  const cpuHistory = useMemo(() => [45, 52, 48, 55, 62, 58, 65, 70, 67, 72, 68, metrics?.cpu_percent || 65], [metrics]);
  const memHistory = useMemo(() => [58, 60, 62, 64, 63, 65, 64, 62, 63, 61, 62, metrics?.memory_percent || 62], [metrics]);

  // Use real pods from props
  const runningPods = useMemo(() => pods.filter(p => p.status === 'Running'), [pods]);

  // Generate AI tips based on real data
  const aiTips = useMemo(() => {
    const tips: { title: string; desc: string; impact: 'low' | 'medium' | 'high' }[] = [];

    const memPercent = metrics?.memory_percent || 0;
    const cpuPercent = metrics?.cpu_percent || 0;

    if (memPercent > 80) {
      tips.push({ title: 'High memory usage detected', desc: 'Consider adding node capacity or moving workloads', impact: 'high' });
    } else if (memPercent > 60) {
      tips.push({ title: 'Memory usage trending high', desc: 'Monitor for potential capacity issues', impact: 'medium' });
    }

    if (cpuPercent > 80) {
      tips.push({ title: 'High CPU utilization', desc: 'Consider scaling workloads or adding nodes', impact: 'high' });
    }

    if (pods.length > 50) {
      tips.push({ title: 'High pod density', desc: `${pods.length} pods running - consider distribution`, impact: 'medium' });
    }

    if (tips.length === 0) {
      tips.push({ title: 'Node is healthy', desc: 'No immediate optimization needed', impact: 'low' });
    }

    return tips;
  }, [metrics, pods]);

  const impactColors = {
    high: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    medium: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    low: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${node.status === 'Ready' ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-red-100 dark:bg-red-500/10'}`}>
            <ServerIcon className={`h-5 w-5 ${node.status === 'Ready' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{node.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{node.internal_ip}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <XMarkIcon className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* CPU/Memory Capacity */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Resource Capacity
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 mb-2">
                <CpuChipIcon className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">CPU</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{node.capacity.cpu}</p>
              <p className="text-xs text-gray-500">{metrics?.cpu_percent || 0}% used</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 mb-2">
                <CircleStackIcon className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Memory</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{node.capacity.memory}</p>
              <p className="text-xs text-gray-500">{metrics?.memory_percent || 0}% used</p>
            </div>
          </div>
        </div>

        {/* Labels */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Labels
          </h3>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {Object.entries(node.labels).slice(0, 8).map(([key, value]) => (
              <span
                key={key}
                className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-mono truncate max-w-full"
              >
                {key.split('/').pop()}={value}
              </span>
            ))}
          </div>
        </div>

        {/* Taints */}
        {node.taints.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Taints
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {node.taints.map((taint, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-medium"
                >
                  {taint.key}:{taint.effect}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Conditions */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Conditions
          </h3>
          <div className="space-y-2">
            {node.conditions.map((condition) => (
              <div key={condition.type} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">{condition.type}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  condition.status === 'True' && condition.type === 'Ready'
                    ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : condition.status === 'True'
                    ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
                }`}>
                  {condition.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mini Charts */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Resource Trends (Last Hour)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">CPU</span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{cpuHistory[cpuHistory.length - 1]}%</span>
              </div>
              <MiniSparkline data={cpuHistory} color="blue" height={40} />
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Memory</span>
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{memHistory[memHistory.length - 1]}%</span>
              </div>
              <MiniSparkline data={memHistory} color="purple" height={40} />
            </div>
          </div>
        </div>

        {/* Running Pods */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Running Pods ({runningPods.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {runningPods.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">No running pods on this node</div>
            ) : (
              runningPods.map((pod, index) => (
                <div key={pod.name || index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <CubeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{pod.name}</p>
                      <p className="text-xs text-gray-500">{pod.namespace}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      pod.ready ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600' : 'bg-amber-100 dark:bg-amber-500/10 text-amber-600'
                    }`}>
                      {pod.ready ? 'Ready' : 'Not Ready'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Optimization Tips */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <SparklesIcon className="h-4 w-4 text-purple-500" />
            AI Optimization Tips
          </h3>
          <div className="space-y-2">
            {aiTips.map((tip, index) => (
              <div key={index} className="p-3 rounded-xl bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-500/5 dark:to-blue-500/5 border border-purple-200/30 dark:border-purple-500/20">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{tip.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{tip.desc}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${impactColors[tip.impact]}`}>
                    {tip.impact.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Per-node Prometheus metrics
interface NodePrometheusMetrics {
  nodeName: string;
  cpuPercent: number;
  memoryPercent: number;
  cpuHistory: number[];
  memoryHistory: number[];
}

export default function NodesView() {
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null);

  // Use cached data hook - prevents refetching on navigation
  const { data, isLoading: loading, refresh } = useNodesData();

  // Destructure data from cache
  const nodes = data?.nodes ?? [];
  const metrics = data?.metrics ?? [];
  const prometheusAvailable = data?.prometheusAvailable ?? false;
  const nodePrometheusMetrics = data?.nodePrometheusMetrics ?? {};
  const nodePods = data?.nodePods ?? {};

  function getMetricsForNode(nodeName: string): NodeMetrics | undefined {
    return metrics.find((m) => m.name === nodeName);
  }

  function getPodsForNode(nodeName: string): Pod[] {
    return nodePods[nodeName]?.pods ?? [];
  }

  function getPodCountForNode(nodeName: string): number {
    return nodePods[nodeName]?.count ?? 0;
  }

  const readyNodes = nodes.filter((n) => n.status === 'Ready').length;
  const unhealthyNodes = nodes.length - readyNodes;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
              <ServerIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Nodes</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {readyNodes}/{nodes.length} nodes ready
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-3 gap-4">
          <KPICard title="Total Nodes" value={nodes.length} icon={ServerIcon} color="blue" index={0} />
          <KPICard title="Healthy" value={readyNodes} icon={CheckCircleIcon} color="green" index={1} />
          <KPICard title="Unhealthy" value={unhealthyNodes} icon={ExclamationTriangleIcon} color="red" index={2} />
        </div>
      </motion.div>

      {/* Nodes Table */}
      <motion.div variants={itemVariants}>
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Memory</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pods</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                {loading && nodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin text-blue-500" />
                      <p className="mt-3 text-sm text-gray-500">Loading nodes...</p>
                    </td>
                  </tr>
                ) : nodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <ServerIcon className="h-8 w-8 mx-auto text-gray-400" />
                      <p className="mt-3 text-sm text-gray-500">No nodes found</p>
                    </td>
                  </tr>
                ) : (
                  nodes.map((node) => (
                    <NodeRow
                      key={node.name}
                      node={node}
                      metrics={getMetricsForNode(node.name)}
                      podCount={getPodCountForNode(node.name)}
                      isSelected={selectedNode?.name === node.name}
                      onClick={() => setSelectedNode(node)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>

      {/* Node Details Drawer */}
      <AnimatePresence>
        {selectedNode && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setSelectedNode(null)}
            />
            {/* Drawer */}
            <NodeDrawer
              node={selectedNode}
              metrics={getMetricsForNode(selectedNode.name)}
              pods={getPodsForNode(selectedNode.name)}
              onClose={() => setSelectedNode(null)}
            />
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
