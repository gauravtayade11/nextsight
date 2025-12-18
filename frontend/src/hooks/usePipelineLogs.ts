// frontend/src/hooks/usePipelineLogs.ts
import { useEffect, useState, useRef } from 'react';
import { wsLogger as logger } from '../utils/logger';

interface UsePipelineLogsOptions {
  pipelineId: string;
  runId: string;
  stageId?: string;
  enabled?: boolean;
}

interface UsePipelineLogsReturn {
  logs: string[];
  connected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function usePipelineLogs({
  pipelineId,
  runId,
  stageId,
  enabled = true,
}: UsePipelineLogsOptions): UsePipelineLogsReturn {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const connect = () => {
    if (!enabled || !pipelineId || !runId) return;

    try {
      // Clear any existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const stagePath = stageId ? `/${stageId}` : '';
      const wsUrl = `${protocol}//${host}/ws/pipelines/${pipelineId}/runs/${runId}${stagePath}`;

      logger.debug('Connecting to WebSocket', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        logger.debug('WebSocket connected');
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types
          if (data.type === 'log') {
            setLogs((prev) => [...prev, data.message]);
          } else if (data.type === 'logs') {
            // Batch logs
            setLogs((prev) => [...prev, ...data.messages]);
          } else if (data.type === 'clear') {
            setLogs([]);
          } else if (data.type === 'complete') {
            logger.debug('Pipeline run completed');
            // Keep connection open to receive final logs
          }
        } catch (err) {
          // If not JSON, treat as plain text log
          setLogs((prev) => [...prev, event.data]);
        }
      };

      ws.onerror = (event) => {
        logger.error('WebSocket error', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        logger.debug('WebSocket closed', event.code, event.reason);
        setConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          setError(
            `Connection lost. Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Failed to reconnect after multiple attempts. Please refresh the page.');
        }
      };
    } catch (err) {
      logger.error('Failed to create WebSocket', err);
      setError('Failed to establish WebSocket connection');
    }
  };

  const reconnect = () => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    setLogs([]);
    connect();
  };

  useEffect(() => {
    if (enabled && pipelineId && runId) {
      // Reset logs when stage changes
      setLogs([]);
      connect();
    }

    return () => {
      // Cleanup on unmount or when dependencies change
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [pipelineId, runId, stageId, enabled]);

  return {
    logs,
    connected,
    error,
    reconnect,
  };
}