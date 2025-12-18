import { useEffect, useRef, useState } from 'react';
import { subscribeToLogs, subscribeToPipelineStatus } from '../services/pipelineAPI';
import usePipelineStore from '../stores/pipelineStore';
import { pipelineLogger as logger } from '../utils/logger';

export function useLogStream(
  pipelineId: string,
  runId: string,
  stageId: string,
  enabled: boolean = true
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const addLog = usePipelineStore((state) => state.addLog);

  useEffect(() => {
    if (!enabled || !pipelineId || !runId || !stageId) {
      return;
    }

    let shouldReconnect = true;

    const connect = () => {
      if (!shouldReconnect) return;

      try {
        setConnectionError(null);
        wsRef.current = subscribeToLogs(
          pipelineId,
          runId,
          stageId,
          (log: string) => {
            addLog(stageId, log);
          }
        );

        wsRef.current.onopen = () => {
          setIsConnected(true);
          setConnectionError(null);
        };

        wsRef.current.onclose = () => {
          setIsConnected(false);
          // Attempt to reconnect after 3 seconds if still enabled
          if (shouldReconnect) {
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        wsRef.current.onerror = (error) => {
          logger.error('WebSocket error', error);
          setIsConnected(false);
          setConnectionError('Failed to connect to log stream');
        };
      } catch (error) {
        logger.error('Failed to connect to log stream', error);
        setIsConnected(false);
        setConnectionError('Failed to connect to log stream');
      }
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pipelineId, runId, stageId, enabled, addLog]);

  return { isConnected, connectionError };
}

export function usePipelineStatus(pipelineId: string, enabled: boolean = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [run, setRun] = useState<any>(null);

  useEffect(() => {
    if (!enabled || !pipelineId) {
      return;
    }

    let shouldReconnect = true;

    const connect = () => {
      if (!shouldReconnect) return;

      try {
        setConnectionError(null);
        wsRef.current = subscribeToPipelineStatus(pipelineId, (status) => {
          setRun(status);
        });

        wsRef.current.onopen = () => {
          setIsConnected(true);
          setConnectionError(null);
        };

        wsRef.current.onclose = () => {
          setIsConnected(false);
          // Attempt to reconnect after 3 seconds if still enabled
          if (shouldReconnect) {
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        wsRef.current.onerror = (error) => {
          logger.error('WebSocket error', error);
          setIsConnected(false);
          setConnectionError('Failed to connect to pipeline status');
        };
      } catch (error) {
        logger.error('Failed to connect to pipeline status', error);
        setIsConnected(false);
        setConnectionError('Failed to connect to pipeline status');
      }
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pipelineId, enabled]);

  return { isConnected, connectionError, run };
}

export function useAutoRefresh<T>(
  fetchFn: () => Promise<T>,
  interval: number = 5000,
  enabled: boolean = true
): [T | null, boolean] {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const refetch = async () => {
      setLoading(true);
      try {
        const result = await fetchFn();
        setData(result);
      } catch (error) {
        logger.error('Error fetching data', error);
      } finally {
        setLoading(false);
        timeoutId = setTimeout(refetch, interval);
      }
    };

    refetch();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fetchFn, interval, enabled]);

  return [data, loading];
}
