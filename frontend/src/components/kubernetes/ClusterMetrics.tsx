import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowPathIcon, ChartBarIcon, CpuChipIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import GlassCard from '../common/GlassCard';
import type { ClusterMetrics as ClusterMetricsType, PodMetrics, Namespace } from '../../types';

// Import shared constants
import { containerVariants, itemVariants, formatBytes } from '../../utils/constants';

// Progress bar component
function Progress({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-red-500' : value >= 70 ? 'bg-amber-500' : 'bg-primary-500';
  return (
    <div className="h-1.5 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

function parseMemoryToMi(mem: string): number {
  if (!mem) return 0;
  const value = parseInt(mem);
  if (mem.includes('Gi')) return value * 1024;
  if (mem.includes('Mi')) return value;
  if (mem.includes('Ki')) return value / 1024;
  return value / (1024 * 1024);
}

function parseCpuToMillicores(cpu: string): number {
  if (!cpu) return 0;
  return parseInt(cpu.replace('m', '')) || 0;
}

export default function ClusterMetrics() {
  const [clusterMetrics, setClusterMetrics] = useState<ClusterMetricsType | null>(null);
  const [podMetrics, setPodMetrics] = useState<PodMetrics[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [selectedNamespace]);

  async function fetchData() {
    setLoading(true);
    try {
      const [metricsRes, podMetricsRes, nsRes] = await Promise.all([
        kubernetesApi.getClusterMetrics().catch(() => null),
        kubernetesApi.getPodMetrics(selectedNamespace || undefined).catch(() => ({ data: [] })),
        kubernetesApi.getNamespaces().catch(() => ({ data: [] })),
      ]);
      if (metricsRes?.data) setClusterMetrics(metricsRes.data);
      setPodMetrics(podMetricsRes.data);
      setNamespaces(nsRes.data);
      setError(null);
    } catch {
      setError('Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }

  const topPodsByCpu = [...podMetrics]
    .sort((a, b) => parseCpuToMillicores(b.total_cpu) - parseCpuToMillicores(a.total_cpu))
    .slice(0, 5);

  const topPodsByMemory = [...podMetrics]
    .sort((a, b) => parseMemoryToMi(b.total_memory) - parseMemoryToMi(a.total_memory))
    .slice(0, 5);

  const namespaceStats = Object.entries(
    podMetrics.reduce((acc, pod) => {
      if (!acc[pod.namespace]) acc[pod.namespace] = { cpu: 0, memory: 0, pods: 0 };
      acc[pod.namespace].cpu += parseCpuToMillicores(pod.total_cpu);
      acc[pod.namespace].memory += parseMemoryToMi(pod.total_memory);
      acc[pod.namespace].pods += 1;
      return acc;
    }, {} as Record<string, { cpu: number; memory: number; pods: number }>)
  ).sort((a, b) => b[1].cpu - a[1].cpu).slice(0, 6);

  const maxCpu = topPodsByCpu[0] ? parseCpuToMillicores(topPodsByCpu[0].total_cpu) : 1;
  const maxMem = topPodsByMemory[0] ? parseMemoryToMi(topPodsByMemory[0].total_memory) : 1;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Sticky Header */}
      <motion.div
        variants={itemVariants}
        className="sticky top-16 z-30 -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-slate-700/50"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30">
              <ChartBarIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Cluster Metrics
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Resource usage and performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Namespace Selector */}
            <div className="relative">
              <select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-gray-700 dark:text-gray-300 shadow-sm hover:border-primary-300 dark:hover:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all cursor-pointer"
              >
                <option value="">All namespaces</option>
                {namespaces.map((ns) => (
                  <option key={ns.name} value={ns.name}>{ns.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-300 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GlassCard className="border-amber-200 dark:border-amber-500/20 p-4">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {error}. Make sure metrics-server is installed.
              </p>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview Stats */}
      {clusterMetrics && (
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/10">
                  <CpuChipIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPU</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{clusterMetrics.cpu_percent}%</p>
              <Progress value={clusterMetrics.cpu_percent} />
              <p className="text-xs text-gray-400 mt-2">{clusterMetrics.total_cpu_usage} / {clusterMetrics.total_cpu_capacity}</p>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-500/10">
                  <ChartBarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Memory</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{clusterMetrics.memory_percent}%</p>
              <Progress value={clusterMetrics.memory_percent} />
              <p className="text-xs text-gray-400 mt-2">{clusterMetrics.total_memory_usage} / {clusterMetrics.total_memory_capacity}</p>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-green-100 dark:bg-green-500/10">
                  <ServerStackIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nodes</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{clusterMetrics.nodes?.length || 0}</p>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-500/10">
                  <svg className="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pods</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{podMetrics.length}</p>
            </GlassCard>
          </div>
        </motion.div>
      )}

      {/* Top Consumers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU */}
        <motion.div variants={itemVariants}>
          <GlassCard variant="hover">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-500/10">
                <CpuChipIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top CPU Consumers</h2>
            </div>
            {topPodsByCpu.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-800 w-fit mx-auto mb-3">
                  <CpuChipIcon className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topPodsByCpu.map((pod, index) => {
                  const cpu = parseCpuToMillicores(pod.total_cpu);
                  return (
                    <motion.div
                      key={pod.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50"
                    >
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[70%] font-medium" title={pod.name}>
                          {pod.name}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg">{cpu}m</span>
                      </div>
                      <Progress value={(cpu / maxCpu) * 100} />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Memory */}
        <motion.div variants={itemVariants}>
          <GlassCard variant="hover">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-500/10">
                <ChartBarIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top Memory Consumers</h2>
            </div>
            {topPodsByMemory.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-800 w-fit mx-auto mb-3">
                  <ChartBarIcon className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topPodsByMemory.map((pod, index) => {
                  const mem = parseMemoryToMi(pod.total_memory);
                  return (
                    <motion.div
                      key={pod.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50"
                    >
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[70%] font-medium" title={pod.name}>
                          {pod.name}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg">{Math.round(mem)} Mi</span>
                      </div>
                      <Progress value={(mem / maxMem) * 100} />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* Namespace breakdown */}
      {namespaceStats.length > 0 && (
        <motion.div variants={itemVariants}>
          <GlassCard variant="hover">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-500/10">
                <svg className="h-4 w-4 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resource Usage by Namespace</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-700">
                    <th className="pb-3 font-semibold">Namespace</th>
                    <th className="pb-3 font-semibold text-right">CPU</th>
                    <th className="pb-3 font-semibold text-right">Memory</th>
                    <th className="pb-3 font-semibold text-right">Pods</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {namespaceStats.map(([name, stats], index) => (
                    <motion.tr
                      key={name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 font-medium">{name}</td>
                      <td className="py-3 text-right">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg">{stats.cpu}m</span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg">{Math.round(stats.memory)} Mi</span>
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-xs bg-primary-100 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-lg font-medium">{stats.pods}</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Loading state */}
      <AnimatePresence>
        {loading && !clusterMetrics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin text-primary-500" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading metrics...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!loading && !clusterMetrics && podMetrics.length === 0 && !error && (
        <motion.div variants={itemVariants}>
          <GlassCard className="text-center py-12">
            <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-800 w-fit mx-auto mb-3">
              <ChartBarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">No metrics available. Install metrics-server.</p>
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  );
}
