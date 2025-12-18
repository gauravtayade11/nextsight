import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ArrowPathIcon,
  XMarkIcon,
  CommandLineIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  DocumentDuplicateIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  AdjustmentsHorizontalIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';
import usePipelineStore from '../../stores/pipelineStore';
import { streamRunLogs } from '../../services/pipelineAPI';
import { pipelineLogger as logger } from '../../utils/logger';

type LogLevel = 'all' | 'info' | 'warn' | 'error' | 'debug' | 'success';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  stage?: string;
  lineNumber: number;
}

interface Stage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
}

export default function PipelineLogs() {
  const { id: pipelineId, runId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialStage = searchParams.get('stage');

  const {
    selectedPipeline,
    selectedRun,
    logs: rawLogs,
    isLoading,
    fetchPipelineById,
    fetchRun,
    fetchLogs,
    appendLog,
    clearLogs,
  } = usePipelineStore();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogLevel, setSelectedLogLevel] = useState<LogLevel>('all');
  const [selectedStageId, setSelectedStageId] = useState<string | null>(initialStage);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wrapLines, setWrapLines] = useState(false);
  const [bookmarkedLines, setBookmarkedLines] = useState<Set<number>>(new Set());
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  // Refs
  const logContainerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse logs into structured entries
  const parsedLogs: LogEntry[] = rawLogs.map((log, index) => {
    const lowerLog = log.toLowerCase();
    let level: LogLevel = 'info';

    if (lowerLog.includes('error') || lowerLog.includes('fail') || lowerLog.includes('fatal')) {
      level = 'error';
    } else if (lowerLog.includes('warn') || lowerLog.includes('warning')) {
      level = 'warn';
    } else if (lowerLog.includes('debug') || lowerLog.includes('trace')) {
      level = 'debug';
    } else if (lowerLog.includes('success') || lowerLog.includes('✔') || lowerLog.includes('passed')) {
      level = 'success';
    }

    // Extract timestamp if present
    const timestampMatch = log.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\]?/);
    const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();

    return {
      timestamp,
      level,
      message: log,
      lineNumber: index + 1,
    };
  });

  // Filter logs
  const filteredLogs = parsedLogs.filter(log => {
    // Level filter
    if (selectedLogLevel !== 'all' && log.level !== selectedLogLevel) {
      return false;
    }
    // Search filter
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Stage filter
    if (selectedStageId && !log.message.toLowerCase().includes(selectedStageId.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Stats
  const logStats = {
    total: parsedLogs.length,
    errors: parsedLogs.filter(l => l.level === 'error').length,
    warnings: parsedLogs.filter(l => l.level === 'warn').length,
    filtered: filteredLogs.length,
  };

  // Fetch data on mount
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
    if (selectedRun?.status === 'running' && pipelineId && runId) {
      setIsStreaming(true);
      cleanupRef.current = streamRunLogs(
        pipelineId,
        runId,
        (log) => appendLog(log),
        (error) => {
          logger.error('Log streaming error', error);
          setIsStreaming(false);
        }
      );
    } else {
      setIsStreaming(false);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    }
  }, [selectedRun?.status, pipelineId, runId, appendLog]);

  // Auto-refresh run status
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

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [rawLogs, autoScroll]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchQuery('');
        setIsFullscreen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        scrollToNextMatch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, filteredLogs]);

  const scrollToNextMatch = useCallback(() => {
    if (!searchQuery || filteredLogs.length === 0) return;
    const currentIndex = highlightedLine
      ? filteredLogs.findIndex(l => l.lineNumber === highlightedLine)
      : -1;
    const nextIndex = (currentIndex + 1) % filteredLogs.length;
    setHighlightedLine(filteredLogs[nextIndex].lineNumber);
    // Scroll to the line
    const element = document.getElementById(`log-line-${filteredLogs[nextIndex].lineNumber}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchQuery, filteredLogs, highlightedLine]);

  const handleDownloadLogs = () => {
    const content = filteredLogs.map(l =>
      `${showTimestamps ? `[${l.timestamp}] ` : ''}${l.message}`
    ).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${pipelineId}-run-${runId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyLogs = async () => {
    const content = filteredLogs.map(l => l.message).join('\n');
    await navigator.clipboard.writeText(content);
  };

  const toggleBookmark = (lineNumber: number) => {
    setBookmarkedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineNumber)) {
        next.delete(lineNumber);
      } else {
        next.add(lineNumber);
      }
      return next;
    });
  };

  const getLogLevelConfig = (level: LogLevel) => {
    const config = {
      error: {
        bg: 'bg-red-500/10',
        border: 'border-l-red-500',
        text: 'text-red-400',
        icon: <ExclamationCircleIcon className="h-4 w-4" />,
        label: 'Error',
      },
      warn: {
        bg: 'bg-amber-500/10',
        border: 'border-l-amber-500',
        text: 'text-amber-400',
        icon: <ExclamationTriangleIcon className="h-4 w-4" />,
        label: 'Warning',
      },
      info: {
        bg: 'bg-blue-500/5',
        border: 'border-l-blue-500',
        text: 'text-blue-400',
        icon: <InformationCircleIcon className="h-4 w-4" />,
        label: 'Info',
      },
      debug: {
        bg: 'bg-purple-500/5',
        border: 'border-l-purple-500',
        text: 'text-purple-400',
        icon: <CommandLineIcon className="h-4 w-4" />,
        label: 'Debug',
      },
      success: {
        bg: 'bg-emerald-500/10',
        border: 'border-l-emerald-500',
        text: 'text-emerald-400',
        icon: <CheckCircleIcon className="h-4 w-4" />,
        label: 'Success',
      },
      all: {
        bg: '',
        border: 'border-l-transparent',
        text: 'text-gray-300',
        icon: <FunnelIcon className="h-4 w-4" />,
        label: 'All',
      },
    };
    return config[level];
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { gradient: string; text: string; icon: JSX.Element }> = {
      success: {
        gradient: 'from-emerald-500 to-green-600',
        text: 'text-emerald-400',
        icon: <CheckCircleIcon className="h-5 w-5" />,
      },
      failed: {
        gradient: 'from-red-500 to-rose-600',
        text: 'text-red-400',
        icon: <ExclamationCircleIcon className="h-5 w-5" />,
      },
      running: {
        gradient: 'from-blue-500 to-indigo-600',
        text: 'text-blue-400',
        icon: <ArrowPathIcon className="h-5 w-5 animate-spin" />,
      },
      pending: {
        gradient: 'from-amber-500 to-yellow-600',
        text: 'text-amber-400',
        icon: <ClockIcon className="h-5 w-5" />,
      },
      cancelled: {
        gradient: 'from-gray-500 to-slate-600',
        text: 'text-gray-400',
        icon: <PauseCircleIcon className="h-5 w-5" />,
      },
    };
    return config[status] || config.pending;
  };

  const stages: Stage[] = selectedRun?.stages || [];
  const statusConfig = getStatusConfig(selectedRun?.status || 'pending');

  // Loading state
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
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading pipeline logs...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
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
              onClick={() => navigate(`/pipelines/${pipelineId}/runs/${runId}`)}
              className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </motion.button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25">
                  <CommandLineIcon className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Pipeline Logs
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedPipeline?.name || 'Pipeline'} • Run #{runId?.slice(-4) || '0000'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${statusConfig.gradient} text-white text-sm font-medium shadow-lg`}>
              {statusConfig.icon}
              <span className="capitalize">{selectedRun?.status || 'Pending'}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCopyLogs}
                className="flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 text-sm font-medium border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all backdrop-blur-sm"
                title="Copy logs"
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadLogs}
                className="flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 text-sm font-medium border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all backdrop-blur-sm"
                title="Download logs"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 text-sm font-medium border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all backdrop-blur-sm"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="h-4 w-4" />
                ) : (
                  <ArrowsPointingOutIcon className="h-4 w-4" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Fixed Stats Bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-white/50 dark:bg-slate-800/50 border-b border-gray-100/50 dark:border-slate-700/50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 dark:bg-slate-700/60 rounded-lg">
            <CommandLineIcon className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{logStats.total.toLocaleString()}</span>
            <span className="text-xs text-gray-500">lines</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50/60 dark:bg-red-500/10 rounded-lg">
            <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">{logStats.errors}</span>
            <span className="text-xs text-red-500/70">errors</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50/60 dark:bg-amber-500/10 rounded-lg">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{logStats.warnings}</span>
            <span className="text-xs text-amber-500/70">warnings</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50/60 dark:bg-emerald-500/10 rounded-lg">
            <FunnelIcon className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{logStats.filtered.toLocaleString()}</span>
            <span className="text-xs text-emerald-500/70">shown</span>
          </div>
        </div>
      </div>

      {/* Fixed Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 border-b border-gray-100/50 dark:border-slate-700/50"
          >
            <div className="px-4 py-3 bg-gray-50/50 dark:bg-slate-900/30">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="flex-1 min-w-[250px]">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search logs... (⌘F)"
                        className="w-full pl-9 pr-9 py-2 bg-white/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-slate-600/50 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Log Level Filter */}
                  <div className="flex items-center gap-1.5 bg-white/50 dark:bg-slate-700/50 rounded-lg p-0.5 border border-gray-200/50 dark:border-slate-600/50">
                    {(['all', 'error', 'warn', 'info', 'success'] as LogLevel[]).map((level) => {
                      const config = getLogLevelConfig(level);
                      return (
                        <button
                          key={level}
                          onClick={() => setSelectedLogLevel(level)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                            selectedLogLevel === level
                              ? `bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm`
                              : `hover:bg-white/80 dark:hover:bg-slate-600/50 ${config.text}`
                          }`}
                        >
                          {config.icon}
                          <span className="capitalize hidden sm:inline">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Stage Filter */}
                  {stages.length > 0 && (
                    <select
                      value={selectedStageId || ''}
                      onChange={(e) => setSelectedStageId(e.target.value || null)}
                      className="px-2.5 py-2 bg-white/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-slate-600/50 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">All Stages</option>
                      {stages.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* View Options - Compact toggles */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowTimestamps(!showTimestamps)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                        showTimestamps
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      Time
                    </button>
                    <button
                      onClick={() => setShowLineNumbers(!showLineNumbers)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                        showLineNumbers
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      Line#
                    </button>
                    <button
                      onClick={() => setWrapLines(!wrapLines)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                        wrapLines
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      Wrap
                    </button>
                    <button
                      onClick={() => setAutoScroll(!autoScroll)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                        autoScroll
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      Auto↓
                    </button>
                  </div>
                </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Log Viewer - Takes remaining space */}
      <div className="flex-1 min-h-0 p-4 pb-6">
        <div className="h-full backdrop-blur-xl bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden flex flex-col">
          {/* Log Header - Fixed */}
          <div className="flex-shrink-0 px-4 py-2 bg-slate-900/90 border-b border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CommandLineIcon className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-white">Log Output</span>
              </div>
              {isStreaming && (
                <span className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live
                </span>
              )}
              {searchQuery && (
                <span className="text-xs text-gray-400">
                  {filteredLogs.length} matches
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showFilters
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
                title="Toggle filters"
              >
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
              </motion.button>
              {bookmarkedLines.size > 0 && (
                <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                  {bookmarkedLines.size}
                </span>
              )}
            </div>
          </div>

          {/* Log Content - Scrollable */}
          <div
            ref={logContainerRef}
            className={`flex-1 overflow-y-auto code-scrollbar bg-gradient-to-b from-slate-900 to-slate-950 p-4 font-mono text-sm ${
              wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
            }`}
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
                        <p className="text-gray-600 text-xs mt-1">Logs will appear here in real-time</p>
                      </>
                    ) : searchQuery ? (
                      <>
                        <MagnifyingGlassIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 font-medium">No matching logs found</p>
                        <p className="text-gray-600 text-xs mt-1">Try adjusting your search query</p>
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
                  {filteredLogs.map((log) => {
                    const levelConfig = getLogLevelConfig(log.level);
                    const isBookmarked = bookmarkedLines.has(log.lineNumber);
                    const isHighlighted = highlightedLine === log.lineNumber;
                    const hasSearchMatch = searchQuery && log.message.toLowerCase().includes(searchQuery.toLowerCase());

                    return (
                      <motion.div
                        key={log.lineNumber}
                        id={`log-line-${log.lineNumber}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`group flex items-start gap-2 py-0.5 px-2 -mx-2 rounded transition-colors border-l-2 ${
                          levelConfig.border
                        } ${levelConfig.bg} ${
                          isHighlighted ? 'ring-2 ring-yellow-500/50 bg-yellow-500/10' : ''
                        } ${isBookmarked ? 'bg-amber-500/5' : ''} hover:bg-white/5`}
                      >
                        {/* Bookmark button */}
                        <button
                          onClick={() => toggleBookmark(log.lineNumber)}
                          className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                            isBookmarked ? '!opacity-100 text-amber-400' : 'text-gray-600 hover:text-amber-400'
                          }`}
                        >
                          <BookmarkIcon className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                        </button>

                        {/* Line number */}
                        {showLineNumbers && (
                          <span className="flex-shrink-0 w-12 text-right text-slate-600 select-none">
                            {log.lineNumber}
                          </span>
                        )}

                        {/* Timestamp */}
                        {showTimestamps && (
                          <span className="flex-shrink-0 text-slate-500 select-none text-xs">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        )}

                        {/* Log message */}
                        <span className={`flex-1 ${levelConfig.text}`}>
                          {hasSearchMatch ? (
                            <HighlightedText text={log.message} highlight={searchQuery} />
                          ) : (
                            log.message
                          )}
                        </span>
                      </motion.div>
                    );
                  })}

                  {/* Streaming cursor */}
                  {isStreaming && (
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="flex items-center gap-2 py-0.5 px-2 text-blue-400"
                    >
                      {showLineNumbers && (
                        <span className="w-12 text-right text-slate-600 select-none">
                          {filteredLogs.length + 1}
                        </span>
                      )}
                      <span className="bg-blue-400 text-transparent">█</span>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

          {/* Log Footer */}
          <div className="flex-shrink-0 px-4 py-2 bg-slate-900/90 border-t border-slate-700/50 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>{filteredLogs.length} lines</span>
              {bookmarkedLines.size > 0 && (
                <span className="text-amber-400">{bookmarkedLines.size} bookmarked</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>⌘F Search</span>
              <span>•</span>
              <span>⌘G Next</span>
              <span>•</span>
              <span>ESC Clear</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for highlighting search matches
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight) return <>{text}</>;

  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));

  return (
    <>
      {parts.map((part, i) => (
        <span
          key={i}
          className={
            part.toLowerCase() === highlight.toLowerCase()
              ? 'bg-yellow-500/40 text-yellow-200 px-0.5 rounded'
              : ''
          }
        >
          {part}
        </span>
      ))}
    </>
  );
}
