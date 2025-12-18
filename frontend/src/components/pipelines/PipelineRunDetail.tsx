import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  StopIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  PauseCircleIcon,
  CommandLineIcon,
  UserCircleIcon,
  BeakerIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import usePipelineStore from '../../stores/pipelineStore';
import { streamRunLogs } from '../../services/pipelineAPI';
import { pipelineLogger as logger } from '../../utils/logger';
import TestResultsPanel from './TestResultsPanel';
import CoverageReport from './CoverageReport';
import PipelineApprovalGate from './PipelineApprovalGate';

interface StageStatus {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: string;
  requiresApproval?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  requiredApprovers?: number;
  approverRoles?: string[];
  approvals?: Array<{
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    approverUsername?: string;
    approverRole?: string;
    comment?: string;
    createdAt: string;
  }>;
}

export default function PipelineRunDetail() {
  const { id: pipelineId, runId } = useParams();
  const navigate = useNavigate();
  const {
    selectedPipeline,
    selectedRun,
    logs,
    isLoading,
    error,
    fetchPipelineById,
    fetchRun,
    fetchLogs,
    cancelRun,
    appendLog,
    clearLogs,
  } = usePipelineStore();

  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeTab, setActiveTab] = useState<'logs' | 'tests' | 'coverage'>('logs');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Fetch pipeline and run data
  useEffect(() => {
    if (pipelineId) {
      fetchPipelineById(pipelineId);
    }
    if (pipelineId && runId) {
      fetchRun(pipelineId, runId);
      fetchLogs(pipelineId, runId);
    }
    return () => {
      clearLogs();
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [pipelineId, runId, fetchPipelineById, fetchRun, fetchLogs, clearLogs]);

  // Stream logs for running pipelines
  useEffect(() => {
    // Cleanup previous stream first
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (selectedRun?.status === 'running' && pipelineId && runId) {
      setIsStreaming(true);
      setStreamError(null);
      cleanupRef.current = streamRunLogs(
        pipelineId,
        runId,
        (log) => {
          appendLog(log);
        },
        (error) => {
          logger.error('Log streaming error', error);
          setStreamError('Failed to stream logs. Retrying...');
          setIsStreaming(false);
        }
      );
    } else {
      setIsStreaming(false);
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setIsStreaming(false);
    };
  }, [selectedRun?.status, pipelineId, runId, appendLog]);

  // Auto-refresh run status for running pipelines
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (selectedRun?.status === 'running' && pipelineId && runId) {
      interval = setInterval(() => {
        fetchRun(pipelineId, runId);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedRun?.status, pipelineId, runId, fetchRun]);

  // Auto scroll logs
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCancel = async () => {
    if (pipelineId && runId) {
      await cancelRun(pipelineId, runId);
      fetchRun(pipelineId, runId);
    }
  };

  const handleDownloadLogs = () => {
    const logContent = logs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-run-${runId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
        icon: <CheckCircleIcon className="h-5 w-5" />,
      },
      failed: {
        bg: 'bg-red-50 dark:bg-red-500/10',
        text: 'text-red-700 dark:text-red-400',
        dot: 'bg-red-500',
        gradient: 'from-red-500 to-rose-600',
        border: 'border-red-200 dark:border-red-500/30',
        icon: <XCircleIcon className="h-5 w-5" />,
      },
      running: {
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        text: 'text-blue-700 dark:text-blue-400',
        dot: 'bg-blue-500',
        gradient: 'from-blue-500 to-indigo-600',
        border: 'border-blue-200 dark:border-blue-500/30',
        icon: <ArrowPathIcon className="h-5 w-5 animate-spin" />,
      },
      cancelled: {
        bg: 'bg-gray-50 dark:bg-gray-500/10',
        text: 'text-gray-700 dark:text-gray-400',
        dot: 'bg-gray-500',
        gradient: 'from-gray-500 to-slate-600',
        border: 'border-gray-200 dark:border-gray-500/30',
        icon: <PauseCircleIcon className="h-5 w-5" />,
      },
      skipped: {
        bg: 'bg-slate-50 dark:bg-slate-500/10',
        text: 'text-slate-700 dark:text-slate-400',
        dot: 'bg-slate-400',
        gradient: 'from-slate-400 to-gray-500',
        border: 'border-slate-200 dark:border-slate-500/30',
        icon: <PauseCircleIcon className="h-5 w-5" />,
      },
      pending: {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
        gradient: 'from-amber-500 to-yellow-600',
        border: 'border-amber-200 dark:border-amber-500/30',
        icon: <ClockIcon className="h-5 w-5" />,
      },
    };
    return config[status] || config.pending;
  };

  const formatDuration = (startedAt?: string, completedAt?: string, duration?: string) => {
    if (duration) return duration;
    if (!startedAt) return '-';

    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);

      if (diffSecs < 60) return `${diffSecs} seconds ago`;
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} minutes ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} hours ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Get stages from run or use defaults
  const stages: StageStatus[] = selectedRun?.stages || [
    { id: '1', name: 'Build', status: 'pending' },
    { id: '2', name: 'Test', status: 'pending' },
    { id: '3', name: 'Deploy', status: 'pending' },
  ];

  // Filter logs by stage if one is selected
  // Use multiple matching patterns for better stage detection
  const filteredLogs = selectedStageId
    ? logs.filter(log => {
        const lowerLog = log.toLowerCase();
        const stageName = stages.find(s => s.id === selectedStageId)?.name?.toLowerCase() || '';

        // Match various patterns:
        // - [Stage: Build], [BUILD], Stage: Build
        // - Stage name at start of line
        // - Log messages containing stage name as a word
        return (
          lowerLog.includes(`[${stageName}]`) ||
          lowerLog.includes(`[stage: ${stageName}]`) ||
          lowerLog.includes(`stage: ${stageName}`) ||
          lowerLog.includes(`stage=${stageName}`) ||
          lowerLog.startsWith(`${stageName}:`) ||
          new RegExp(`\\b${stageName}\\b`, 'i').test(log)
        );
      })
    : logs;

  // Calculate completed stages
  const completedStages = stages.filter(s => s.status === 'success').length;

  // Show error if there's an error and no run data
  if (error && !selectedRun && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4 max-w-md text-center"
        >
          <XCircleIcon className="h-16 w-16 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Failed to Load Run</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => {
              if (pipelineId && runId) {
                fetchRun(pipelineId, runId);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  if (isLoading && !selectedRun) {
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
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading run details...</p>
        </motion.div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(selectedRun?.status || 'pending');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Compact Header */}
      <div className="flex-shrink-0 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border-b border-white/20 dark:border-slate-700/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/pipelines/${pipelineId}`)}
              className="p-1.5 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </motion.button>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                Run #{runId?.slice(-4) || '0000'}
              </h1>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.border} border ${statusConfig.text}`}>
                {statusConfig.icon}
                <span className="capitalize">{selectedRun?.status || 'Pending'}</span>
              </div>
            </div>

            {/* Inline Stats */}
            <div className="hidden md:flex items-center gap-3 pl-3 border-l border-gray-200/50 dark:border-slate-600/50">
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-3.5 w-3.5" />
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatDuration(selectedRun?.startedAt, selectedRun?.completedAt, selectedRun?.duration)}
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-semibold text-gray-700 dark:text-gray-300">{completedStages}/{stages.length}</span>
                stages
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <UserCircleIcon className="h-3.5 w-3.5" />
                {selectedRun?.triggeredBy || 'User'}
              </span>
              {selectedRun?.branch && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-600 dark:text-gray-400">
                  {selectedRun.branch}
                </span>
              )}
              {selectedRun?.commit && (
                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-500/20 rounded text-xs font-mono text-purple-700 dark:text-purple-400">
                  {selectedRun.commit.slice(0, 7)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedRun?.status === 'running' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-medium rounded-lg hover:from-red-600 hover:to-rose-700 transition-all"
              >
                <StopIcon className="h-3.5 w-3.5" />
                Stop
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/pipelines/${pipelineId}/runs/${runId}/logs`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-medium rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all"
            >
              <CommandLineIcon className="h-3.5 w-3.5" />
              Full Logs
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadLogs}
              className="p-1.5 bg-white/50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all"
              title="Download Logs"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Fixed Stage Progress Bar */}
      <div className="flex-shrink-0 px-6 py-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-gray-100/50 dark:border-slate-700/50">
        <div className="flex items-center gap-2 overflow-x-auto">
          {stages.map((stage, index) => {
            const stageConfig = getStatusConfig(stage.status);
            return (
              <div key={stage.id || index} className="flex items-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedStageId(selectedStageId === stage.id ? null : stage.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-medium ${
                    selectedStageId === stage.id
                      ? `bg-gradient-to-r ${stageConfig.gradient} text-white shadow-md`
                      : `${stageConfig.bg} ${stageConfig.border} border ${stageConfig.text}`
                  }`}
                >
                  <span className={`h-4 w-4 ${selectedStageId === stage.id ? 'text-white' : ''}`}>
                    {stageConfig.icon}
                  </span>
                  <span className="whitespace-nowrap">{stage.name}</span>
                  {stage.requiresApproval && (
                    <ShieldCheckIcon className={`h-3 w-3 ${selectedStageId === stage.id ? 'text-white' : 'text-amber-500'}`} />
                  )}
                  {stage.duration && (
                    <span className={`text-[10px] opacity-75 ${selectedStageId === stage.id ? 'text-white/80' : ''}`}>
                      {stage.duration}
                    </span>
                  )}
                </motion.button>
                {index < stages.length - 1 && (
                  <div className={`h-0.5 w-4 mx-1 rounded-full ${
                    stage.status === 'success' ? 'bg-emerald-500' :
                    stage.status === 'failed' ? 'bg-red-500' :
                    stage.status === 'running' ? 'bg-blue-500' :
                    'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>
            );
          })}
          {selectedRun?.status === 'running' && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 ml-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Running
            </span>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 px-6 py-3 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'logs'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <CommandLineIcon className="h-4 w-4" />
            Logs
            {isStreaming && activeTab === 'logs' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
            )}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('tests')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'tests'
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <BeakerIcon className="h-4 w-4" />
            Tests
            {selectedRun?.testSummary && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                activeTab === 'tests' ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              }`}>
                {selectedRun.testSummary.passRate?.toFixed(0) || 0}%
              </span>
            )}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('coverage')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'coverage'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            <ChartBarIcon className="h-4 w-4" />
            Coverage
            {selectedRun?.coverageSummary && selectedRun.coverageSummary.lineCoverage !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                activeTab === 'coverage' ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
              }`}>
                {selectedRun.coverageSummary.lineCoverage?.toFixed(0)}%
              </span>
            )}
          </motion.button>
        </div>
        {activeTab === 'logs' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            Auto-scroll
          </label>
        )}
      </div>

      {/* Stage Selector Tabs - Fixed (only for logs tab) */}
      {activeTab === 'logs' && (
      <div className="flex-shrink-0 px-6 py-2 bg-gray-50/90 dark:bg-slate-900/70 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center gap-2 overflow-x-auto">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedStageId(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            selectedStageId === null
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-800/50'
          }`}
        >
          All Stages
        </motion.button>
        {stages.map((stage) => {
          const stageConfig = getStatusConfig(stage.status);
          return (
            <motion.button
              key={stage.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedStageId(stage.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                selectedStageId === stage.id
                  ? `bg-gradient-to-r ${stageConfig.gradient} text-white shadow-md`
                  : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-700 bg-white/50 dark:bg-slate-800/50'
              }`}
            >
              <span className={`h-3.5 w-3.5 ${selectedStageId === stage.id ? 'text-white' : stageConfig.text}`}>
                {stageConfig.icon}
              </span>
              {stage.name}
            </motion.button>
          );
        })}
      </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <>
            {/* Stream Error Banner */}
            {streamError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 mb-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-400 text-sm"
              >
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                <span>{streamError}</span>
                <button
                  onClick={() => setStreamError(null)}
                  className="ml-auto text-amber-500 hover:text-amber-300"
                >
                  <XCircleIcon className="h-4 w-4" />
                </button>
              </motion.div>
            )}

            {/* Log Content */}
            <div className="h-full p-4 pb-6">
              <div
                ref={logContainerRef}
                className="h-full overflow-y-auto code-scrollbar bg-slate-950 rounded-xl border border-slate-700/50 p-6 font-mono text-sm"
              >
                {filteredLogs.length === 0 ? (
                  <div className="flex items-center justify-center min-h-[200px]">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center"
                    >
                      {selectedRun?.status === 'running' ? (
                        <>
                          <div className="relative inline-block mb-4">
                            <div className="w-12 h-12 border-4 border-blue-800 rounded-full"></div>
                            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                          <p className="text-gray-400 font-medium">Waiting for logs...</p>
                          <p className="text-gray-600 text-xs mt-1">Logs will appear here when available</p>
                        </>
                      ) : selectedRun?.status === 'pending' ? (
                        <>
                          <ClockIcon className="h-12 w-12 text-amber-500/50 mx-auto mb-4" />
                          <p className="text-gray-400 font-medium">Pipeline is queued</p>
                          <p className="text-gray-600 text-xs mt-1">Waiting for available runner</p>
                        </>
                      ) : (
                        <>
                          <CommandLineIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                          <p className="text-gray-500">No logs available</p>
                        </>
                      )}
                    </motion.div>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {filteredLogs.map((log, index) => {
                      const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('failed') || log.toLowerCase().includes('fatal');
                      const isWarning = log.toLowerCase().includes('warn') || log.toLowerCase().includes('warning');
                      const isSuccess = log.toLowerCase().includes('success') || log.includes('✔') || log.includes('✅');
                      const isInfo = log.toLowerCase().includes('info') || log.startsWith('[');
                      
                      return (
                        <div
                          key={index}
                          className={`py-1 px-2 hover:bg-slate-900/50 transition-colors ${
                            isError ? 'text-red-400 bg-red-500/5 border-l-2 border-red-500' :
                            isWarning ? 'text-yellow-400 bg-yellow-500/5 border-l-2 border-yellow-500' :
                            isSuccess ? 'text-emerald-400 bg-emerald-500/5 border-l-2 border-emerald-500' :
                            isInfo ? 'text-blue-400' :
                            'text-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-slate-600 select-none text-xs font-medium min-w-[3rem] text-right">
                              {String(index + 1).padStart(4, '0')}
                            </span>
                            <span className="flex-1 break-words whitespace-pre-wrap leading-relaxed">
                              {log}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {isStreaming && (
                      <div className="py-1 px-2 text-blue-400">
                        <div className="flex items-start gap-3">
                          <span className="text-slate-600 select-none text-xs font-medium min-w-[3rem] text-right">
                            {String(filteredLogs.length + 1).padStart(4, '0')}
                          </span>
                          <span className="flex-1">
                            <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse">█</span>
                            <span className="ml-2 text-slate-500">Streaming...</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tests Tab */}
        {activeTab === 'tests' && (
          <div className="h-full overflow-y-auto p-4 pb-6">
            <TestResultsPanel
              testSummary={selectedRun?.testSummary}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Coverage Tab */}
        {activeTab === 'coverage' && (
          <div className="h-full overflow-y-auto p-4 pb-6">
            <CoverageReport
              coverageSummary={selectedRun?.coverageSummary}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
