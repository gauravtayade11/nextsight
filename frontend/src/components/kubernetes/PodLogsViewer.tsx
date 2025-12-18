import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  SignalIcon,
  SignalSlashIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  BellAlertIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  CommandLineIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../services/api';
import { logger } from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';
import { useWebSocketLogs } from '../../hooks/useWebSocketLogs';
import type { Pod, PodLogs, K8sEvent } from '../../types';

// Import shared constants
import { scaleVariants, STATUS_CONFIG, getStatusConfig } from '../../utils/constants';
import { StatusBadge } from '../common/StatusBadge';

// Pod status type
type PodStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

// Status configurations for non-running pods
const NON_RUNNING_STATUS_INFO: Record<PodStatus, { icon: typeof ClockIcon; color: string; gradient: string; title: string; message: string }> = {
  Pending: {
    icon: ClockIcon,
    color: 'text-amber-500',
    gradient: 'from-amber-500 to-yellow-600',
    title: 'Pod is Pending',
    message: 'The pod is waiting to be scheduled or containers are being created. Logs will be available once the container starts running.',
  },
  Running: {
    icon: CheckCircleIcon,
    color: 'text-emerald-500',
    gradient: 'from-emerald-500 to-green-600',
    title: 'Pod is Running',
    message: 'The pod is running normally.',
  },
  Succeeded: {
    icon: CheckCircleIcon,
    color: 'text-blue-500',
    gradient: 'from-blue-500 to-indigo-600',
    title: 'Pod Completed',
    message: 'The pod has completed successfully. View the logs from when it was running.',
  },
  Failed: {
    icon: XCircleIcon,
    color: 'text-red-500',
    gradient: 'from-red-500 to-rose-600',
    title: 'Pod Failed',
    message: 'The pod has failed. Try viewing "Previous" logs to see the error output. Check pod events for more details.',
  },
  Unknown: {
    icon: InformationCircleIcon,
    color: 'text-gray-500',
    gradient: 'from-gray-500 to-slate-600',
    title: 'Unknown Status',
    message: 'The pod status is unknown. Logs may not be available.',
  },
};

interface PodLogsViewerProps {
  pod: Pod;
  onClose: () => void;
}

// Check if pod can have logs
function canHaveLogs(status: PodStatus): boolean {
  return status === 'Running' || status === 'Succeeded' || status === 'Failed';
}

// Get status info for non-running pods
function getStatusInfo(status: PodStatus) {
  return NON_RUNNING_STATUS_INFO[status];
}

export default function PodLogsViewer({ pod, onClose }: PodLogsViewerProps) {
  const [logs, setLogs] = useState<PodLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState(pod.containers[0] || '');
  const [tailLines, setTailLines] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);
  const [streamingMode, setStreamingMode] = useState(false);
  const [tryFetchAnyway, setTryFetchAnyway] = useState(false);
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Check if logs can be fetched based on pod status
  const podCanHaveLogs = canHaveLogs(pod.status);
  const statusInfo = getStatusInfo(pod.status);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // WebSocket streaming hook
  const {
    logs: wsLogs,
    connected: wsConnected,
    error: wsError,
    status: wsStatus,
    clearLogs: clearWsLogs,
  } = useWebSocketLogs({
    namespace: pod.namespace,
    podName: pod.name,
    container: selectedContainer,
    tailLines,
    timestamps: showTimestamps,
    enabled: streamingMode,
  });

  useEffect(() => {
    if (!streamingMode && (podCanHaveLogs || tryFetchAnyway)) {
      fetchLogs();
    } else if (!podCanHaveLogs && !tryFetchAnyway) {
      setLoading(false);
    }
  }, [selectedContainer, tailLines, showTimestamps, showPrevious, streamingMode, podCanHaveLogs, tryFetchAnyway]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh && !streamingMode) {
      interval = setInterval(fetchLogs, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, selectedContainer, tailLines, streamingMode]);

  // Auto-scroll when new logs arrive in streaming mode
  useEffect(() => {
    if (streamingMode && wsLogs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [wsLogs.length, streamingMode]);

  // Fetch pod events (useful for debugging pending/failed pods)
  useEffect(() => {
    async function fetchEvents() {
      setEventsLoading(true);
      try {
        const response = await kubernetesApi.getPodEvents(pod.namespace, pod.name);
        setEvents(response.data);
      } catch (err) {
        logger.error('Failed to fetch pod events', err);
      } finally {
        setEventsLoading(false);
      }
    }
    fetchEvents();
  }, [pod.namespace, pod.name]);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const response = await kubernetesApi.getPodLogs(pod.namespace, pod.name, {
        container: selectedContainer || undefined,
        tailLines,
        timestamps: showTimestamps,
        previous: showPrevious,
      });
      setLogs(response.data);
    } catch (err: unknown) {
      let errorMessage = 'Failed to fetch logs';
      if (err && typeof err === 'object') {
        const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
        if (axiosErr.response?.data?.detail) {
          errorMessage = axiosErr.response.data.detail;
        } else if (axiosErr.message) {
          errorMessage = axiosErr.message;
        }
      }
      setError(errorMessage);
      logger.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  }

  function scrollToBottom() {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function downloadLogs() {
    const logsContent = streamingMode ? wsLogs.join('\n') : logs?.logs || '';
    if (!logsContent) return;
    const blob = new Blob([logsContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pod.namespace}-${pod.name}-${selectedContainer}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getFilteredLogs(): string {
    if (streamingMode) {
      const logsText = wsLogs.join('\n');
      if (!searchTerm) return logsText;
      return wsLogs
        .filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()))
        .join('\n');
    }
    if (!logs || !searchTerm) return logs?.logs || '';
    return logs.logs
      .split('\n')
      .filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()))
      .join('\n');
  }

  function highlightSearch(text: string) {
    // Escape HTML entities to prevent XSS
    const escapeHtml = (str: string) =>
      str.replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#039;');

    const escapedText = escapeHtml(text);
    if (!searchTerm) return escapedText;

    // Escape regex special characters in search term
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeSearchTerm = escapeRegex(escapeHtml(searchTerm));

    const regex = new RegExp(`(${safeSearchTerm})`, 'gi');
    return escapedText.replace(regex, '<mark class="bg-yellow-300 text-yellow-900 rounded px-0.5">$1</mark>');
  }

  function handleStreamingModeChange(enabled: boolean) {
    setStreamingMode(enabled);
    if (enabled) {
      setAutoRefresh(false);
      clearWsLogs();
    }
  }

  const filteredLogs = getFilteredLogs();
  const currentError = streamingMode ? wsError : error;
  const isLoading = streamingMode ? !wsConnected && wsStatus === 'connecting' : loading && !logs;

  const getStatusBadgeConfig = (status: PodStatus) => {
    const config: Record<PodStatus, { bg: string; text: string; border: string }> = {
      Running: {
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-500/30',
      },
      Pending: {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-500/30',
      },
      Succeeded: {
        bg: 'bg-blue-50 dark:bg-blue-500/10',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-500/30',
      },
      Failed: {
        bg: 'bg-red-50 dark:bg-red-500/10',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-500/30',
      },
      Unknown: {
        bg: 'bg-gray-50 dark:bg-gray-500/10',
        text: 'text-gray-700 dark:text-gray-400',
        border: 'border-gray-200 dark:border-gray-500/30',
      },
    };
    return config[status] || config.Unknown;
  };

  const statusBadgeConfig = getStatusBadgeConfig(pod.status);

  // Use React Portal to render panel at document.body level
  // Non-blocking slide-in panel from the right, positioned below main header
  return createPortal(
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`fixed top-16 right-0 bottom-0 z-[9999] flex flex-col backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 shadow-2xl border-l border-white/20 dark:border-slate-700/50 ${
        isExpanded ? 'w-full left-0' : 'w-[55%] min-w-[600px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700/50 backdrop-blur-xl bg-white/80 dark:bg-slate-800/80">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
            <CommandLineIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pod Logs</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeConfig.bg} ${statusBadgeConfig.text} ${statusBadgeConfig.border}`}>
                {pod.status === 'Running' && <CheckCircleIcon className="h-3.5 w-3.5" />}
                {pod.status === 'Pending' && <ClockIcon className="h-3.5 w-3.5" />}
                {pod.status === 'Failed' && <XCircleIcon className="h-3.5 w-3.5" />}
                {pod.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
              {pod.namespace}/{pod.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Streaming status indicator */}
          <AnimatePresence>
            {streamingMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
                  wsConnected
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                    : wsStatus === 'connecting'
                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                      : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30'
                }`}
              >
                {wsConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live
                  </>
                ) : wsStatus === 'connecting' ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <SignalSlashIcon className="h-4 w-4" />
                    Disconnected
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {/* Expand/Collapse button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            title={isExpanded ? 'Collapse panel' : 'Expand to full screen'}
          >
            {isExpanded ? (
              <ArrowsPointingInIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            ) : (
              <ArrowsPointingOutIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            )}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </motion.button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 border-b border-gray-100 dark:border-slate-700/50 backdrop-blur-xl bg-white/50 dark:bg-slate-800/50">
        {/* Container selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Container:</label>
          <select
            value={selectedContainer}
            onChange={(e) => setSelectedContainer(e.target.value)}
            className="px-3 py-2 bg-white/50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all backdrop-blur-sm"
          >
            {pod.containers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Tail lines */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Lines:</label>
          <select
            value={tailLines}
            onChange={(e) => setTailLines(Number(e.target.value))}
            className="px-3 py-2 bg-white/50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all backdrop-blur-sm"
            disabled={streamingMode}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
            <option value={5000}>5000</option>
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 bg-white/50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all backdrop-blur-sm"
          />
        </div>

        {/* Options */}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showTimestamps}
            onChange={(e) => setShowTimestamps(e.target.checked)}
            className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            disabled={streamingMode}
          />
          Timestamps
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showPrevious}
            onChange={(e) => setShowPrevious(e.target.checked)}
            className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            disabled={streamingMode}
          />
          Previous
        </label>

        {/* Streaming mode toggle */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleStreamingModeChange(!streamingMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            streamingMode
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25'
              : 'bg-white/50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-slate-700/80'
          }`}
        >
          {streamingMode ? (
            <>
              <PauseIcon className="h-4 w-4" />
              Stop Stream
            </>
          ) : (
            <>
              <PlayIcon className="h-4 w-4" />
              Real-time
            </>
          )}
        </motion.button>

        {/* Auto-refresh (only when not streaming) */}
        {!streamingMode && (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            Auto-refresh
          </label>
        )}

        {/* Actions */}
        {!streamingMode && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all backdrop-blur-sm disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
        )}

        {streamingMode && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={clearWsLogs}
            className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all backdrop-blur-sm"
          >
            Clear
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={downloadLogs}
          disabled={streamingMode ? wsLogs.length === 0 : !logs}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Download
        </motion.button>
      </div>

      {/* Logs content */}
      <div className="flex-1 overflow-auto bg-gradient-to-b from-slate-900 to-slate-950">
        {/* Show status message for non-running pods */}
        {!podCanHaveLogs && !tryFetchAnyway && !loading ? (
          <div className="h-full overflow-auto p-6">
            <div className="max-w-2xl mx-auto py-8">
              {/* Status Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
              >
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${statusInfo.gradient} shadow-lg mb-4`}>
                  <statusInfo.icon className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-100 mb-2">{statusInfo.title}</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">{statusInfo.message}</p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <span className="text-gray-500 text-sm">Current Status:</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${statusBadgeConfig.bg} ${statusBadgeConfig.text} ${statusBadgeConfig.border}`}>
                    {pod.status}
                  </span>
                </div>
              </motion.div>

              {/* Events Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="backdrop-blur-xl bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 mb-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                    <BellAlertIcon className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-200">Pod Events</h4>
                  {eventsLoading && (
                    <ArrowPathIcon className="h-4 w-4 text-gray-400 animate-spin ml-2" />
                  )}
                </div>
                {events.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {events.map((event, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`p-3 rounded-xl text-sm border ${
                          event.type === 'Warning'
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-slate-700/50 border-slate-600/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className={`font-semibold ${
                            event.type === 'Warning' ? 'text-amber-400' : 'text-blue-400'
                          }`}>
                            {event.reason}
                          </span>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {event.count > 1 && `(${event.count}x) `}
                            {event.last_timestamp && new Date(event.last_timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-300 text-xs">{event.message}</p>
                      </motion.div>
                    ))}
                  </div>
                ) : eventsLoading ? (
                  <p className="text-gray-500 text-sm">Loading events...</p>
                ) : (
                  <p className="text-gray-500 text-sm">No events found for this pod.</p>
                )}
              </motion.div>

              {/* Tips and Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center space-y-4"
              >
                {pod.status === 'Failed' && (
                  <p className="text-sm text-blue-400">
                    Tip: Enable "Previous" checkbox to view logs from the container before it failed.
                  </p>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setTryFetchAnyway(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg"
                >
                  Try Fetching Logs Anyway
                </motion.button>
              </motion.div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-800 rounded-full"></div>
                <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-400 font-medium">
                {streamingMode ? 'Connecting to log stream...' : 'Loading logs...'}
              </p>
            </motion.div>
          </div>
        ) : currentError ? (
          <div className="flex items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center max-w-md p-6"
            >
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25 mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-white" />
              </div>
              <p className="text-red-400 mb-4 font-medium">{currentError}</p>
              {!podCanHaveLogs && (
                <p className="text-gray-500 text-sm">
                  This is expected for pods in "{pod.status}" state.
                </p>
              )}
            </motion.div>
          </div>
        ) : filteredLogs ? (
          <div className="p-4">
            <pre
              className="text-sm text-gray-100 font-mono whitespace-pre-wrap break-all leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightSearch(filteredLogs) }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="inline-flex p-4 rounded-2xl bg-slate-700/50 mb-4">
                <DocumentTextIcon className="h-8 w-8 text-gray-500" />
              </div>
              <p className="text-gray-500">No logs available</p>
            </motion.div>
          </div>
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-slate-700/50 backdrop-blur-xl bg-white/50 dark:bg-slate-800/50 text-sm">
        <div className="flex items-center gap-4">
          {streamingMode ? (
            <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {wsLogs.length} lines streamed
            </span>
          ) : (
            logs?.truncated && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Logs truncated - showing last {tailLines} lines
              </span>
            )
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-xs">Esc</kbd>
            to close
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={scrollToBottom}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
        >
          Scroll to bottom
        </motion.button>
      </div>
    </motion.div>,
    document.body
  );
}
