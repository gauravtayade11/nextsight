import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { pipelineLogger as logger } from '../../utils/logger';
import {
  ArrowLeftIcon,
  PlayIcon,
  PencilSquareIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  CodeBracketIcon,
  RocketLaunchIcon,
  ChartBarIcon,
  CommandLineIcon,
  UserCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import usePipelineStore from '../../stores/pipelineStore';
import GlassCard from '../common/GlassCard';
import { DashboardSkeleton } from '../common/LoadingStates';

interface PipelineStage {
  id?: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
}

export default function PipelineDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    selectedPipeline,
    runs,
    isLoading,
    error,
    fetchPipelineById,
    fetchRuns,
    triggerPipeline,
    clearError,
  } = usePipelineStore();

  const [actionError, setActionError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPipelineById(id);
      fetchRuns(id);
    }
  }, [id, fetchPipelineById, fetchRuns]);

  // Auto-dismiss action error after 5 seconds
  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  const handleRun = async () => {
    if (!id || isRunning) return;
    try {
      setIsRunning(true);
      setActionError(null);
      const run = await triggerPipeline(id);
      navigate(`/pipelines/${id}/runs/${run.id}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to trigger pipeline');
      logger.error('Failed to trigger pipeline', err);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusConfig = (status?: string) => {
    const configs: Record<string, { bg: string; text: string; dot: string; icon: React.ReactNode; gradient: string }> = {
      success: {
        bg: 'bg-emerald-100 dark:bg-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        icon: <CheckCircleIcon className="h-4 w-4" />,
        gradient: 'from-emerald-500 to-emerald-600',
      },
      failed: {
        bg: 'bg-red-100 dark:bg-red-500/20',
        text: 'text-red-700 dark:text-red-400',
        dot: 'bg-red-500',
        icon: <XCircleIcon className="h-4 w-4" />,
        gradient: 'from-red-500 to-red-600',
      },
      running: {
        bg: 'bg-blue-100 dark:bg-blue-500/20',
        text: 'text-blue-700 dark:text-blue-400',
        dot: 'bg-blue-500 animate-pulse',
        icon: <ArrowPathIcon className="h-4 w-4 animate-spin" />,
        gradient: 'from-blue-500 to-blue-600',
      },
      pending: {
        bg: 'bg-amber-100 dark:bg-amber-500/20',
        text: 'text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
        icon: <ClockIcon className="h-4 w-4" />,
        gradient: 'from-amber-500 to-amber-600',
      },
    };
    return configs[status || 'pending'] || configs.pending;
  };

  const parseStagesFromYaml = (): PipelineStage[] => {
    if (!selectedPipeline?.yaml) {
      return [
        { name: 'Build', status: 'pending' },
        { name: 'Test', status: 'pending' },
        { name: 'Deploy', status: 'pending' },
      ];
    }

    try {
      const stagesMatch = selectedPipeline.yaml.match(/stages:\s*\n([\s\S]*?)(?=\n[a-z]|\n$|$)/i);
      if (stagesMatch) {
        const stagesText = stagesMatch[1];
        const stageNames = stagesText.match(/- name:\s*["']?([^"'\n]+)["']?/g);
        if (stageNames) {
          return stageNames.map(s => ({
            name: s.replace(/- name:\s*["']?([^"'\n]+)["']?/, '$1').trim(),
            status: 'pending' as const,
          }));
        }
      }
    } catch (e) {
      logger.error('Failed to parse stages', e);
    }

    return [
      { name: 'Build', status: 'pending' },
      { name: 'Test', status: 'pending' },
      { name: 'Deploy', status: 'pending' },
    ];
  };

  const lastRun = runs.length > 0 ? runs[0] : null;
  const stages = lastRun?.stages || parseStagesFromYaml();
  const successRate = runs.length > 0
    ? Math.round((runs.filter(r => r.status === 'success').length / runs.length) * 100)
    : 0;

  const formatDuration = (duration?: string) => {
    if (!duration || duration === '-') return '-';
    return duration;
  };

  const formatTrigger = (trigger?: string) => {
    switch (trigger) {
      case 'push': return 'Git Push';
      case 'pull_request': return 'Pull Request';
      case 'manual': return 'Manual';
      case 'schedule': return 'Scheduled';
      default: return trigger || 'Manual';
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

  if (isLoading) {
    return (
      <div className="p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!selectedPipeline) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <GlassCard className="text-center p-8">
          <RocketLaunchIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Pipeline not found</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/pipelines')}
            className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
          >
            Back to Pipelines
          </motion.button>
        </GlassCard>
      </div>
    );
  }

  const statusConfig = getStatusConfig(selectedPipeline.status);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Error Banner */}
      <AnimatePresence>
        {(error || actionError) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-shrink-0 px-6 py-3 bg-red-50 dark:bg-red-500/10 border-b border-red-200/50 dark:border-red-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <ExclamationTriangleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">{error || actionError}</span>
              </div>
              <button
                onClick={() => {
                  clearError();
                  setActionError(null);
                }}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <XCircleIcon className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-slate-700/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/pipelines')}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </motion.button>
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${statusConfig.gradient} text-white`}>
                <RocketLaunchIcon className="h-4 w-4" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedPipeline.name}
              </h1>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs font-mono text-gray-600 dark:text-gray-400">
                {selectedPipeline.branch || 'main'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                {selectedPipeline.status || 'pending'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: isRunning ? 1 : 1.02 }}
              whileTap={{ scale: isRunning ? 1 : 0.98 }}
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-medium rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayIcon className="h-3.5 w-3.5" />
                  Run
                </>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/pipelines/${id}/edit`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-700 dark:text-gray-300 text-xs font-medium bg-white/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-slate-600/50 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all"
            >
              <PencilSquareIcon className="h-3.5 w-3.5" />
              Edit
            </motion.button>
          </div>
        </div>
      </div>

      {/* Fixed Summary Section */}
      <div className="flex-shrink-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-gray-100/50 dark:border-slate-700/50 px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          {/* Stats Row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 dark:bg-slate-700/60 rounded-lg">
              <RocketLaunchIcon className="h-4 w-4 text-primary-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{runs.length}</span>
              <span className="text-xs text-gray-500">runs</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/60 dark:bg-emerald-500/10 rounded-lg">
              <ChartBarIcon className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{successRate}%</span>
              <span className="text-xs text-emerald-600/70">success</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 dark:bg-slate-700/60 rounded-lg">
              <ClockIcon className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedPipeline.duration || '-'}</span>
              <span className="text-xs text-gray-500">avg</span>
            </div>
          </div>

          {/* Last Run Info */}
          {lastRun && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">Last run:</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusConfig(lastRun.status).bg} ${getStatusConfig(lastRun.status).text}`}>
                {getStatusConfig(lastRun.status).icon}
                {lastRun.status}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDuration(lastRun.duration)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimeAgo(lastRun.startedAt)}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <UserCircleIcon className="h-3.5 w-3.5" />
                {lastRun.triggeredBy || 'User'}
              </span>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/pipelines/${id}/runs/${lastRun.id}`)}
                className="px-2.5 py-1 bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded text-xs font-medium transition-colors"
              >
                Details
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/pipelines/${id}/runs/${lastRun.id}/logs`)}
                className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded text-xs font-medium transition-colors"
              >
                <CommandLineIcon className="h-3 w-3" />
                Logs
              </motion.button>
            </div>
          )}
        </div>

        {/* Pipeline Stages - Compact */}
        {lastRun && stages.length > 0 && (
          <div className="flex items-center gap-2 mt-3 overflow-x-auto">
            {stages.map((stage, index) => {
              const stageConfig = getStatusConfig(stage.status);
              return (
                <div key={stage.name || index} className="flex items-center">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${stageConfig.bg} ${stageConfig.text}`}>
                    {stageConfig.icon}
                    <span className="whitespace-nowrap">{stage.name}</span>
                  </div>
                  {index < stages.length - 1 && (
                    <div className={`h-0.5 w-3 mx-1 rounded-full ${
                      stage.status === 'success' ? 'bg-emerald-500' :
                      stage.status === 'failed' ? 'bg-red-500' :
                      stage.status === 'running' ? 'bg-blue-500' :
                      'bg-gray-200 dark:bg-gray-700'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scrollable Runs List */}
      <div className="flex-1 min-h-0 overflow-hidden p-4 pb-6">
        {!lastRun ? (
          <div className="h-full flex items-center justify-center">
            <GlassCard className="text-center p-8 max-w-md">
              <div className="mx-auto w-14 h-14 bg-gradient-to-br from-primary-500/20 to-primary-600/20 rounded-2xl flex items-center justify-center mb-4">
                <PlayIcon className="h-7 w-7 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No runs yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Click "Run" to start your first pipeline execution.
              </p>
              <motion.button
                whileHover={{ scale: isRunning ? 1 : 1.02 }}
                whileTap={{ scale: isRunning ? 1 : 0.98 }}
                onClick={handleRun}
                disabled={isRunning}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-lg shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 inline mr-1.5 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4 inline mr-1.5" />
                    Run Pipeline
                  </>
                )}
              </motion.button>
            </GlassCard>
          </div>
        ) : (
          <div className="h-full backdrop-blur-xl bg-white/60 dark:bg-slate-800/60 rounded-xl border border-white/20 dark:border-slate-700/50 overflow-hidden flex flex-col">
            {/* Runs Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100/50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Pipeline Runs ({runs.length})
              </h3>
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={() => navigate(`/pipelines/${id}/history`)}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                View Full History
              </motion.button>
            </div>

            {/* Scrollable Runs */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AnimatePresence>
                {runs.map((run, index) => {
                  const runConfig = getStatusConfig(run.status);
                  return (
                    <motion.div
                      key={run.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="px-4 py-3 border-b border-gray-50/50 dark:border-slate-700/30 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/pipelines/${id}/runs/${run.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${runConfig.bg} ${runConfig.text}`}>
                            {runConfig.icon}
                            {run.status}
                          </span>
                          <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                            #{run.id?.slice(-6) || '000000'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-slate-700/80 px-1.5 py-0.5 rounded font-mono">
                            {run.branch || 'main'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <ClockIcon className="h-3.5 w-3.5" />
                            {formatDuration(run.duration)}
                          </span>
                          <span>{formatTimeAgo(run.startedAt)}</span>
                          <span className="uppercase tracking-wider">{formatTrigger(run.trigger)}</span>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pipelines/${id}/runs/${run.id}/logs`);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded text-xs font-medium transition-colors"
                          >
                            <CommandLineIcon className="h-3 w-3" />
                            Logs
                          </motion.button>
                          <ChevronRightIcon className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
