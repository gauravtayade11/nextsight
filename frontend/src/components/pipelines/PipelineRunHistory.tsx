import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  PauseCircleIcon,
  FunnelIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import GlassCard, { StatCard } from '../common/GlassCard';
import usePipelineStore from '../../stores/pipelineStore';

type StatusFilter = 'all' | 'success' | 'failed' | 'running' | 'pending' | 'cancelled';
type TriggerFilter = 'all' | 'manual' | 'push' | 'pull_request' | 'schedule';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function PipelineRunHistory() {
  const { id: pipelineId } = useParams();
  const navigate = useNavigate();
  const {
    selectedPipeline,
    runs,
    isLoading,
    fetchPipelineById,
    fetchRuns,
  } = usePipelineStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    if (pipelineId) {
      fetchPipelineById(pipelineId);
      fetchRuns(pipelineId);
    }
  }, [pipelineId, fetchPipelineById, fetchRuns]);

  // Auto-refresh runs every 10 seconds if there are running pipelines
  useEffect(() => {
    if (!autoRefresh || !pipelineId) return;

    const hasRunningPipelines = runs.some(r => r.status === 'running');
    const interval = hasRunningPipelines ? 5000 : 30000; // 5s if running, 30s otherwise

    const refreshInterval = setInterval(() => {
      fetchRuns(pipelineId);
    }, interval);

    return () => clearInterval(refreshInterval);
  }, [autoRefresh, pipelineId, runs, fetchRuns]);

  // Get unique branches from runs
  const uniqueBranches = [...new Set(runs.map(r => r.branch || 'main'))];

  // Filter runs
  const filteredRuns = runs.filter(run => {
    const matchesStatus = statusFilter === 'all' || run.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || run.branch === branchFilter;
    const matchesTrigger = triggerFilter === 'all' || run.trigger === triggerFilter;
    return matchesStatus && matchesBranch && matchesTrigger;
  });

  // Calculate stats
  const totalRuns = runs.length;
  const successRuns = runs.filter(r => r.status === 'success').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;

  const getStatusConfig = (status: string) => {
    const config: Record<string, {
      bg: string;
      text: string;
      dot: string;
      icon: JSX.Element;
      gradient: string;
      border: string;
    }> = {
      success: {
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        gradient: 'from-emerald-500 to-green-600',
        border: 'border-emerald-200 dark:border-emerald-500/30',
        icon: <CheckCircleIcon className="h-4 w-4" />,
      },
      failed: {
        bg: 'bg-red-50 dark:bg-red-500/10',
        text: 'text-red-700 dark:text-red-400',
        dot: 'bg-red-500',
        gradient: 'from-red-500 to-rose-600',
        border: 'border-red-200 dark:border-red-500/30',
        icon: <XCircleIcon className="h-4 w-4" />,
      },
      running: {
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        text: 'text-blue-700 dark:text-blue-400',
        dot: 'bg-blue-500',
        gradient: 'from-blue-500 to-indigo-600',
        border: 'border-blue-200 dark:border-blue-500/30',
        icon: <ArrowPathIcon className="h-4 w-4 animate-spin" />,
      },
      cancelled: {
        bg: 'bg-gray-50 dark:bg-gray-500/10',
        text: 'text-gray-700 dark:text-gray-400',
        dot: 'bg-gray-500',
        gradient: 'from-gray-500 to-slate-600',
        border: 'border-gray-200 dark:border-gray-500/30',
        icon: <PauseCircleIcon className="h-4 w-4" />,
      },
      pending: {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
        gradient: 'from-amber-500 to-yellow-600',
        border: 'border-amber-200 dark:border-amber-500/30',
        icon: <ClockIcon className="h-4 w-4" />,
      },
    };
    return config[status] || config.pending;
  };

  const formatDuration = (duration?: string) => {
    if (!duration || duration === '-') return '-';
    return duration;
  };

  const formatTrigger = (trigger?: string) => {
    switch (trigger) {
      case 'push':
        return 'Push';
      case 'pull_request':
        return 'PR';
      case 'manual':
        return 'Manual';
      case 'schedule':
        return 'Schedule';
      default:
        return trigger || 'Manual';
    }
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (isLoading && !selectedPipeline) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading run history...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border-b border-white/20 dark:border-slate-700/50 px-6 py-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/pipelines/${pipelineId}`)}
              className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </motion.button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarDaysIcon className="h-6 w-6 text-blue-500" />
                Run History
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Pipeline: {selectedPipeline?.name || 'Loading...'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 pt-6 grid grid-cols-4 gap-4"
      >
        <StatCard
          title="Total Runs"
          value={totalRuns}
          icon={ListBulletIcon}
          color="primary"
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          icon={CheckCircleIcon}
          color="success"
        />
        <StatCard
          title="Successful"
          value={successRuns}
          icon={CheckCircleIcon}
          color="success"
        />
        <StatCard
          title="Failed"
          value={failedRuns}
          icon={XCircleIcon}
          color="danger"
        />
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-6 py-4"
      >
        <GlassCard padding="md">
          <div className="flex items-center gap-4">
            <FunnelIcon className="h-5 w-5 text-gray-400" />

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Branch Filter */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
            >
              <option value="all">All Branches</option>
              {uniqueBranches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>

            {/* Trigger Filter */}
            <select
              value={triggerFilter}
              onChange={(e) => setTriggerFilter(e.target.value as TriggerFilter)}
              className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
            >
              <option value="all">All Triggers</option>
              <option value="manual">Manual</option>
              <option value="push">Push</option>
              <option value="pull_request">Pull Request</option>
              <option value="schedule">Schedule</option>
            </select>

            {/* Results count */}
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto font-medium">
              {filteredRuns.length} run{filteredRuns.length !== 1 ? 's' : ''}
            </span>
          </div>
        </GlassCard>
      </motion.div>

      {/* Run List */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
              <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        ) : filteredRuns.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <ClockIcon className="h-10 w-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No runs found</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
              {statusFilter !== 'all' || branchFilter !== 'all' || triggerFilter !== 'all'
                ? 'No runs match your current filters. Try adjusting your filter criteria.'
                : 'This pipeline has no runs yet. Trigger a new run to get started.'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {filteredRuns.map((run, index) => {
              const statusConfig = getStatusConfig(run.status);
              return (
                <motion.div
                  key={run.id}
                  variants={itemVariants}
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <GlassCard
                    variant="hover"
                    padding="md"
                    className="cursor-pointer"
                    onClick={() => navigate(`/pipelines/${pipelineId}/runs/${run.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Run number and status */}
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                            #{run.id?.slice(-4) || String(runs.length - index).padStart(2, '0')}
                          </span>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusConfig.bg} ${statusConfig.border} border`}>
                            <span className={statusConfig.text}>{statusConfig.icon}</span>
                            <span className={`text-xs font-semibold capitalize ${statusConfig.text}`}>
                              {run.status}
                            </span>
                          </div>
                        </div>

                        {/* Branch */}
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-mono">
                          {run.branch || 'main'}
                        </span>

                        {/* Commit */}
                        {run.commit && (
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded">
                            {run.commit.slice(0, 7)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                        {/* Duration */}
                        <div className="flex items-center gap-1.5 min-w-[80px]">
                          <ClockIcon className="h-4 w-4" />
                          <span className="font-medium">{formatDuration(run.duration)}</span>
                        </div>

                        {/* Time ago */}
                        <div className="min-w-[100px] text-right font-medium">
                          {formatTimeAgo(run.startedAt)}
                        </div>

                        {/* Trigger */}
                        <div className="min-w-[70px] text-right">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded text-xs font-medium">
                            {formatTrigger(run.trigger)}
                          </span>
                        </div>

                        {/* Details button */}
                        <motion.div
                          whileHover={{ x: 3 }}
                          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium"
                        >
                          Details
                          <ChevronRightIcon className="h-4 w-4" />
                        </motion.div>
                      </div>
                    </div>

                    {/* Stage Progress (if run has stages) */}
                    <AnimatePresence>
                      {run.stages && run.stages.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/50"
                        >
                          <div className="flex items-center gap-2">
                            {run.stages.map((stage, stageIndex) => {
                              const stageStatusConfig = getStatusConfig(stage.status);
                              return (
                                <div key={stage.id || stageIndex} className="flex items-center">
                                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${stageStatusConfig.bg} ${stageStatusConfig.border} border ${stageStatusConfig.text}`}>
                                    {stageStatusConfig.icon}
                                    {stage.name}
                                  </div>
                                  {stageIndex < run.stages.length - 1 && (
                                    <div className={`h-0.5 w-4 mx-1 rounded-full ${
                                      stage.status === 'success' ? 'bg-emerald-400' :
                                      stage.status === 'failed' ? 'bg-red-400' :
                                      stage.status === 'running' ? 'bg-blue-400' :
                                      'bg-gray-200 dark:bg-gray-700'
                                    }`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
