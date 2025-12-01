import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketMessage {
  type: 'log' | 'status' | 'error' | 'pong';
  content?: string;
  status?: string;
  message?: string;
  error?: string;
  code?: number;
}

interface UseWebSocketLogsOptions {
  namespace: string;
  podName: string;
  container?: string;
  tailLines?: number;
  timestamps?: boolean;
  enabled?: boolean;
  maxLines?: number;
}

interface UseWebSocketLogsReturn {
  logs: string[];
  connected: boolean;
  error: string | null;
  status: string;
  connect: () => void;
  disconnect: () => void;
  clearLogs: () => void;
}

const getWebSocketUrl = (
  namespace: string,
  podName: string,
  container?: string,
  tailLines?: number,
  timestamps?: boolean
): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // includes port

  const params = new URLSearchParams();
  if (container) params.append('container', container);
  if (tailLines) params.append('tail_lines', tailLines.toString());
  if (timestamps) params.append('timestamps', 'true');

  const queryString = params.toString();
  return `${protocol}//${host}/api/v1/ws/pods/${namespace}/${podName}/logs${queryString ? '?' + queryString : ''}`;
};

export function useWebSocketLogs({
  namespace,
  podName,
  container,
  tailLines = 100,
  timestamps = false,
  enabled = true,
  maxLines = 10000,
}: UseWebSocketLogsOptions): UseWebSocketLogsReturn {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setStatus('disconnected');
  }, []);

  const connect = useCallback(() => {
    // Clean up existing connection
    disconnect();
    setError(null);
    setStatus('connecting');

    const url = getWebSocketUrl(namespace, podName, container, tailLines, timestamps);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setStatus('connected');
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'log':
              if (message.content) {
                setLogs(prev => {
                  const newLogs = [...prev, message.content!];
                  // Keep only the last maxLines
                  if (newLogs.length > maxLines) {
                    return newLogs.slice(-maxLines);
                  }
                  return newLogs;
                });
              }
              break;
            case 'status':
              setStatus(message.status || 'connected');
              break;
            case 'error':
              setError(message.error || 'Unknown error');
              setStatus('error');
              break;
            case 'pong':
              // Heartbeat response
              break;
          }
        } catch (e) {
          // Handle non-JSON messages (raw log lines)
          setLogs(prev => {
            const newLogs = [...prev, event.data];
            if (newLogs.length > maxLines) {
              return newLogs.slice(-maxLines);
            }
            return newLogs;
          });
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection failed');
        setStatus('error');
      };

      ws.onclose = (event) => {
        setConnected(false);
        if (event.code !== 1000) {
          // Abnormal close, could implement reconnection here
          setStatus('disconnected');
        }
      };
    } catch (e) {
      setError(`Failed to create WebSocket: ${e}`);
      setStatus('error');
    }
  }, [namespace, podName, container, tailLines, timestamps, maxLines, disconnect]);

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled && namespace && podName) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [enabled, namespace, podName, container, tailLines, timestamps]);

  return {
    logs,
    connected,
    error,
    status,
    connect,
    disconnect,
    clearLogs,
  };
}

export default useWebSocketLogs;
