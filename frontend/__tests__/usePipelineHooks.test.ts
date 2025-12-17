import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLogStream, usePipelineStatus, useAutoRefresh } from '../usePipelineHooks';
import usePipelineStore from '../../stores/pipelineStore';

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock global WebSocket
(global as any).WebSocket = vi.fn(() => mockWebSocket);

describe('Pipeline Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useLogStream Hook', () => {
    it('initializes without connecting when disabled', () => {
      const { result } = renderHook(() =>
        useLogStream('pipeline-1', 'run-1', 'checkout', false)
      );

      expect(result.current.isConnected).toBe(false);
    });

    it('connects to WebSocket when enabled', () => {
      renderHook(() => useLogStream('pipeline-1', 'run-1', 'checkout', true));

      expect(global.WebSocket).toHaveBeenCalled();
    });

    it('constructs correct WebSocket URL', () => {
      renderHook(() => useLogStream('pipeline-1', 'run-1', 'checkout', true));

      const callArgs = (global.WebSocket as any).mock.calls[0];
      const url = callArgs[0];

      expect(url).toContain('pipeline-1');
      expect(url).toContain('run-1');
      expect(url).toContain('checkout');
    });

    it('uses wss protocol for https', () => {
      // Mock window.location.protocol
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { protocol: 'https:' };

      renderHook(() => useLogStream('pipeline-1', 'run-1', 'checkout', true));

      const callArgs = (global.WebSocket as any).mock.calls[0];
      const url = callArgs[0];

      expect(url).toContain('wss://');

      (window as any).location = originalLocation;
    });

    it('uses ws protocol for http', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { protocol: 'http:' };

      renderHook(() => useLogStream('pipeline-1', 'run-1', 'checkout', true));

      const callArgs = (global.WebSocket as any).mock.calls[0];
      const url = callArgs[0];

      expect(url).toContain('ws://');

      (window as any).location = originalLocation;
    });

    it('handles incoming log messages', () => {
      const addLogSpy = vi.spyOn(usePipelineStore.getState(), 'addLog');

      renderHook(() => useLogStream('pipeline-1', 'run-1', 'checkout', true));

      // Simulate message event
      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        act(() => {
          messageHandler({
            data: JSON.stringify({
              timestamp: '2024-01-01T00:00:00Z',
              message: 'Test log',
            }),
          });
        });

        expect(addLogSpy).toHaveBeenCalled();
      }
    });

    it('reconnects on connection close', async () => {
      renderHook(() => useLogStream('pipeline-1', 'run-1', 'checkout', true));

      const initialCallCount = (global.WebSocket as any).mock.calls.length;

      // Simulate close event
      const closeHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        call => call[0] === 'close'
      )?.[1];

      if (closeHandler) {
        act(() => {
          closeHandler();
        });

        // Wait for reconnection timeout
        act(() => {
          vi.advanceTimersByTime(3000);
        });

        await waitFor(() => {
          expect((global.WebSocket as any).mock.calls.length).toBeGreaterThan(initialCallCount);
        });
      }
    });

    it('cleans up on unmount', () => {
      const { unmount } = renderHook(() =>
        useLogStream('pipeline-1', 'run-1', 'checkout', true)
      );

      unmount();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('usePipelineStatus Hook', () => {
    it('initializes without connecting when disabled', () => {
      const { result } = renderHook(() => usePipelineStatus('pipeline-1', false));

      expect(result.current.isConnected).toBe(false);
      expect(result.current.run).toBeUndefined();
    });

    it('connects to WebSocket when enabled', () => {
      renderHook(() => usePipelineStatus('pipeline-1', true));

      expect(global.WebSocket).toHaveBeenCalled();
    });

    it('updates run status from messages', () => {
      const { result } = renderHook(() => usePipelineStatus('pipeline-1', true));

      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      const mockRun = {
        id: 'run-1',
        pipelineId: 'pipeline-1',
        status: 'RUNNING',
        triggeredBy: 'user@example.com',
        startedAt: new Date().toISOString(),
        completedAt: null,
        duration: 0,
        stageResults: [],
      };

      if (messageHandler) {
        act(() => {
          messageHandler({
            data: JSON.stringify(mockRun),
          });
        });

        expect(result.current.run).toEqual(mockRun);
      }
    });

    it('handles reconnection on close', async () => {
      renderHook(() => usePipelineStatus('pipeline-1', true));

      const initialCallCount = (global.WebSocket as any).mock.calls.length;

      const closeHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        call => call[0] === 'close'
      )?.[1];

      if (closeHandler) {
        act(() => {
          closeHandler();
        });

        act(() => {
          vi.advanceTimersByTime(3000);
        });

        await waitFor(() => {
          expect((global.WebSocket as any).mock.calls.length).toBeGreaterThan(initialCallCount);
        });
      }
    });

    it('cleans up on unmount', () => {
      const { unmount } = renderHook(() => usePipelineStatus('pipeline-1', true));

      unmount();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('useAutoRefresh Hook', () => {
    it('initializes with undefined data', () => {
      const mockFetch = vi.fn();

      const { result } = renderHook(() => useAutoRefresh(mockFetch, 5000, false));

      expect(result.current[0]).toBeUndefined();
      expect(result.current[1]).toBe(false);
    });

    it('does not fetch when disabled', () => {
      const mockFetch = vi.fn().mockResolvedValue([]);

      renderHook(() => useAutoRefresh(mockFetch, 5000, false));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches data when enabled', async () => {
      const mockData = [{ id: '1', name: 'Pipeline' }];
      const mockFetch = vi.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() => useAutoRefresh(mockFetch, 5000, true));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current[0]).toEqual(mockData);
      });
    });

    it('sets loading state during fetch', async () => {
      const mockFetch = vi.fn(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      const { result } = renderHook(() => useAutoRefresh(mockFetch, 5000, true));

      await waitFor(() => {
        expect(result.current[1]).toBe(true);
      });

      await waitFor(() => {
        expect(result.current[1]).toBe(false);
      });
    });

    it('refetches at specified interval', async () => {
      const mockFetch = vi.fn().mockResolvedValue([]);

      renderHook(() => useAutoRefresh(mockFetch, 5000, true));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const firstCallCount = mockFetch.mock.calls.length;

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThan(firstCallCount);
      });
    });

    it('stops refetching when disabled', async () => {
      const mockFetch = vi.fn().mockResolvedValue([]);

      const { rerender } = renderHook(
        ({ enabled }) => useAutoRefresh(mockFetch, 5000, enabled),
        { initialProps: { enabled: true } }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const initialCallCount = mockFetch.mock.calls.length;

      rerender({ enabled: false });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockFetch.mock.calls.length).toBe(initialCallCount);
    });

    it('handles fetch errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Fetch failed'));

      const { result } = renderHook(() => useAutoRefresh(mockFetch, 5000, true));

      await waitFor(() => {
        expect(result.current[1]).toBe(false);
      });

      // Should not throw, data should remain undefined
      expect(result.current[0]).toBeUndefined();
    });

    it('cleans up interval on unmount', () => {
      const mockFetch = vi.fn().mockResolvedValue([]);

      const { unmount } = renderHook(() => useAutoRefresh(mockFetch, 5000, true));

      unmount();

      const initialCallCount = mockFetch.mock.calls.length;

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not fetch after unmount
      expect(mockFetch.mock.calls.length).toBe(initialCallCount);
    });

    it('respects interval parameter changes', async () => {
      const mockFetch = vi.fn().mockResolvedValue([]);

      const { rerender } = renderHook(
        ({ interval }) => useAutoRefresh(mockFetch, interval, true),
        { initialProps: { interval: 5000 } }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const initialCallCount = mockFetch.mock.calls.length;

      rerender({ interval: 1000 });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Hook Integration', () => {
    it('hooks work together without conflicts', () => {
      const mockFetch = vi.fn().mockResolvedValue([]);

      renderHook(() => {
        useLogStream('pipeline-1', 'run-1', 'checkout', true);
        usePipelineStatus('pipeline-1', true);
        useAutoRefresh(mockFetch, 5000, true);
      });

      expect(global.WebSocket).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('hooks cleanup properly when component unmounts', () => {
      const mockFetch = vi.fn().mockResolvedValue([]);

      const { unmount } = renderHook(() => {
        useLogStream('pipeline-1', 'run-1', 'checkout', true);
        usePipelineStatus('pipeline-1', true);
        useAutoRefresh(mockFetch, 5000, true);
      });

      unmount();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('logs handle connection errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      renderHook(() => useLogStream('pipeline-1', 'run-1', 'checkout', true));

      const errorHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        act(() => {
          errorHandler(new Error('WebSocket error'));
        });

        expect(consoleSpy).toHaveBeenCalled();
      }

      consoleSpy.mockRestore();
    });

    it('handles malformed JSON in messages', () => {
      renderHook(() => useLogStream('pipeline-1', 'run-1', 'checkout', true));

      const messageHandler = (mockWebSocket.addEventListener as any).mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      if (messageHandler) {
        expect(() => {
          act(() => {
            messageHandler({
              data: 'invalid json',
            });
          });
        }).not.toThrow();
      }
    });
  });
});
