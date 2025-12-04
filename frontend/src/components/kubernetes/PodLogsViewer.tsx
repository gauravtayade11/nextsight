import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
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
} from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../services/api';
import { useWebSocketLogs } from '../../hooks/useWebSocketLogs';
import type { Pod, PodLogs, K8sEvent } from '../../types';

// Pod status type
type PodStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

// Status configurations for non-running pods
const NON_RUNNING_STATUS_INFO: Record<PodStatus, { icon: typeof ClockIcon; color: string; title: string; message: string }> = {
  Pending: {
    icon: ClockIcon,
    color: 'text-yellow-500',
    title: 'Pod is Pending',
    message: 'The pod is waiting to be scheduled or containers are being created. Logs will be available once the container starts running.',
  },
  Running: {
    icon: InformationCircleIcon,
    color: 'text-green-500',
    title: 'Pod is Running',
    message: 'The pod is running normally.',
  },
  Succeeded: {
    icon: InformationCircleIcon,
    color: 'text-blue-500',
    title: 'Pod Completed',
    message: 'The pod has completed successfully. View the logs from when it was running.',
  },
  Failed: {
    icon: ExclamationTriangleIcon,
    color: 'text-red-500',
    title: 'Pod Failed',
    message: 'The pod has failed. Try viewing "Previous" logs to see the error output. Check pod events for more details.',
  },
  Unknown: {
    icon: InformationCircleIcon,
    color: 'text-gray-500',
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
        console.error('Failed to fetch pod events:', err);
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
      console.error('Failed to fetch logs:', err);
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
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-300">$1</mark>');
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

  // Use React Portal to render panel at document.body level
  // Non-blocking slide-in panel from the right, positioned below main header
  return createPortal(
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`fixed top-16 right-0 bottom-0 z-[9999] flex flex-col bg-white dark:bg-slate-800 shadow-2xl border-l border-gray-200 dark:border-slate-700 ${
        isExpanded ? 'w-full left-0' : 'w-[55%] min-w-[600px]'
      }`}
    >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pod Logs</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  pod.status === 'Running' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' :
                  pod.status === 'Pending' ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                  pod.status === 'Succeeded' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                  pod.status === 'Failed' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                  'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400'
                }`}>
                  {pod.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pod.namespace}/{pod.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Streaming status indicator */}
            {streamingMode && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                wsConnected
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : wsStatus === 'connecting'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}>
                {wsConnected ? (
                  <SignalIcon className="h-4 w-4" />
                ) : (
                  <SignalSlashIcon className="h-4 w-4" />
                )}
                {wsConnected ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </div>
            )}
            {/* Expand/Collapse button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              title={isExpanded ? 'Collapse panel' : 'Expand to full screen'}
            >
              {isExpanded ? (
                <ArrowsPointingInIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              ) : (
                <ArrowsPointingOutIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              )}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
          {/* Container selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">Container:</label>
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
            <label className="text-sm text-gray-600 dark:text-gray-300">Lines:</label>
            <select
              value={tailLines}
              onChange={(e) => setTailLines(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Options */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showTimestamps}
              onChange={(e) => setShowTimestamps(e.target.checked)}
              className="rounded"
              disabled={streamingMode}
            />
            Timestamps
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showPrevious}
              onChange={(e) => setShowPrevious(e.target.checked)}
              className="rounded"
              disabled={streamingMode}
            />
            Previous
          </label>

          {/* Streaming mode toggle */}
          <label className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400">
            <input
              type="checkbox"
              checked={streamingMode}
              onChange={(e) => handleStreamingModeChange(e.target.checked)}
              className="rounded text-primary-600"
            />
            Real-time
          </label>

          {/* Auto-refresh (only when not streaming) */}
          {!streamingMode && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
          )}

          {/* Actions */}
          {!streamingMode && (
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}

          {streamingMode && (
            <button
              onClick={clearWsLogs}
              className="btn-secondary flex items-center gap-2"
            >
              Clear
            </button>
          )}

          <button
            onClick={downloadLogs}
            disabled={streamingMode ? wsLogs.length === 0 : !logs}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Download
          </button>
        </div>

        {/* Logs content */}
        <div className="flex-1 overflow-auto bg-gray-900 p-4">
          {/* Show status message for non-running pods */}
          {!podCanHaveLogs && !tryFetchAnyway && !loading ? (
            <div className="h-full overflow-auto">
              <div className="max-w-2xl mx-auto py-4">
                {/* Status Header */}
                <div className="text-center mb-6">
                  <statusInfo.icon className={`h-12 w-12 mx-auto mb-3 ${statusInfo.color}`} />
                  <h3 className="text-lg font-semibold text-gray-100 mb-1">{statusInfo.title}</h3>
                  <p className="text-gray-400 text-sm">{statusInfo.message}</p>
                  <div className="flex items-center justify-center gap-2 mt-3 text-sm">
                    <span className="text-gray-500">Current Status:</span>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      pod.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      pod.status === 'Failed' ? 'bg-red-500/20 text-red-400' :
                      pod.status === 'Unknown' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {pod.status}
                    </span>
                  </div>
                </div>

                {/* Events Section */}
                <div className="bg-gray-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BellAlertIcon className="h-5 w-5 text-blue-400" />
                    <h4 className="text-sm font-medium text-gray-200">Pod Events</h4>
                    {eventsLoading && (
                      <ArrowPathIcon className="h-4 w-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                  {events.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {events.map((event, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded text-sm ${
                            event.type === 'Warning'
                              ? 'bg-yellow-900/30 border border-yellow-700/50'
                              : 'bg-gray-700/50 border border-gray-600/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className={`font-medium ${
                              event.type === 'Warning' ? 'text-yellow-400' : 'text-blue-400'
                            }`}>
                              {event.reason}
                            </span>
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {event.count > 1 && `(${event.count}x) `}
                              {event.last_timestamp && new Date(event.last_timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-gray-300 text-xs">{event.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : eventsLoading ? (
                    <p className="text-gray-500 text-sm">Loading events...</p>
                  ) : (
                    <p className="text-gray-500 text-sm">No events found for this pod.</p>
                  )}
                </div>

                {/* Tips and Actions */}
                <div className="text-center space-y-3">
                  {pod.status === 'Failed' && (
                    <p className="text-sm text-blue-400">
                      Tip: Enable "Previous" checkbox to view logs from the container before it failed.
                    </p>
                  )}
                  <button
                    onClick={() => setTryFetchAnyway(true)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm transition-colors"
                  >
                    Try Fetching Logs Anyway
                  </button>
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">
                {streamingMode ? 'Connecting to log stream...' : 'Loading logs...'}
              </div>
            </div>
          ) : currentError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-400 mb-4">{currentError}</p>
                {!podCanHaveLogs && (
                  <p className="text-gray-500 text-sm">
                    This is expected for pods in "{pod.status}" state.
                  </p>
                )}
              </div>
            </div>
          ) : filteredLogs ? (
            <pre
              className="text-sm text-gray-100 font-mono whitespace-pre-wrap break-all"
              dangerouslySetInnerHTML={{ __html: highlightSearch(filteredLogs) }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">No logs available</div>
            </div>
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            {streamingMode ? (
              <span className="text-primary-600 dark:text-primary-400">
                {wsLogs.length} lines streamed
              </span>
            ) : (
              logs?.truncated && (
                <span className="text-warning-600">
                  Logs truncated - showing last {tailLines} lines
                </span>
              )
            )}
            <span className="text-xs">Press Esc to close</span>
          </div>
          <button onClick={scrollToBottom} className="text-primary-600 dark:text-primary-400 hover:underline">
            Scroll to bottom
          </button>
        </div>
    </motion.div>,
    document.body
  );
}
