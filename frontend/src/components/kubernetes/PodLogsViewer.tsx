import { useState, useEffect, useRef } from 'react';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  SignalIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../services/api';
import { useWebSocketLogs } from '../../hooks/useWebSocketLogs';
import type { Pod, PodLogs } from '../../types';

interface PodLogsViewerProps {
  pod: Pod;
  onClose: () => void;
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
  const logsEndRef = useRef<HTMLDivElement>(null);

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
    if (!streamingMode) {
      fetchLogs();
    }
  }, [selectedContainer, tailLines, showTimestamps, showPrevious, streamingMode]);

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pod Logs</h2>
              <p className="text-sm text-gray-500">
                {pod.namespace}/{pod.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Streaming status indicator */}
            {streamingMode && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                wsConnected
                  ? 'bg-green-100 text-green-700'
                  : wsStatus === 'connecting'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}>
                {wsConnected ? (
                  <SignalIcon className="h-4 w-4" />
                ) : (
                  <SignalSlashIcon className="h-4 w-4" />
                )}
                {wsConnected ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </div>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 p-4 border-b border-gray-100 bg-gray-50">
          {/* Container selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Container:</label>
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
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
            <label className="text-sm text-gray-600">Lines:</label>
            <select
              value={tailLines}
              onChange={(e) => setTailLines(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
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
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {/* Options */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showTimestamps}
              onChange={(e) => setShowTimestamps(e.target.checked)}
              className="rounded"
              disabled={streamingMode}
            />
            Timestamps
          </label>

          <label className="flex items-center gap-2 text-sm">
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
          <label className="flex items-center gap-2 text-sm font-medium text-primary-600">
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
            <label className="flex items-center gap-2 text-sm">
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
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">
                {streamingMode ? 'Connecting to log stream...' : 'Loading logs...'}
              </div>
            </div>
          ) : currentError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-400">{currentError}</div>
            </div>
          ) : (
            <pre
              className="text-sm text-gray-100 font-mono whitespace-pre-wrap break-all"
              dangerouslySetInnerHTML={{ __html: highlightSearch(filteredLogs) }}
            />
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
          <div className="flex items-center gap-4">
            {streamingMode ? (
              <span className="text-primary-600">
                {wsLogs.length} lines streamed
              </span>
            ) : (
              logs?.truncated && (
                <span className="text-warning-600">
                  Logs truncated - showing last {tailLines} lines
                </span>
              )
            )}
          </div>
          <button onClick={scrollToBottom} className="text-primary-600 hover:underline">
            Scroll to bottom
          </button>
        </div>
      </div>
    </div>
  );
}
