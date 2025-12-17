import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import usePipelineStore from '../pipelineStore';
import PipelineAPI from '../../services/pipelineAPI';

// Mock API
vi.mock('../../services/pipelineAPI');

const mockAPI = PipelineAPI as jest.Mocked<typeof PipelineAPI>;

describe('Pipeline Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('initializes with empty arrays and false states', () => {
      const store = usePipelineStore.getState();

      expect(store.pipelines).toEqual([]);
      expect(store.selectedPipeline).toBeNull();
      expect(store.selectedRun).toBeNull();
      expect(store.logs).toEqual({});
      expect(store.variables).toEqual([]);
      expect(store.secrets).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('Pipeline Actions', () => {
    const mockPipeline = {
      id: '1',
      name: 'Test Pipeline',
      description: 'Test',
      repository: 'https://github.com/test/repo',
      branch: 'main',
      stages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
    };

    it('fetches pipelines', async () => {
      mockAPI.getPipelines.mockResolvedValue([mockPipeline]);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.fetchPipelines();
      });

      await waitFor(() => {
        expect(result.current.pipelines).toHaveLength(1);
        expect(result.current.pipelines[0].name).toEqual('Test Pipeline');
      });
    });

    it('sets loading state while fetching', async () => {
      mockAPI.getPipelines.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([mockPipeline]), 100))
      );

      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        result.current.fetchPipelines();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('creates new pipeline', async () => {
      mockAPI.createPipeline.mockResolvedValue(mockPipeline);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.createPipeline(mockPipeline as any);
      });

      await waitFor(() => {
        expect(result.current.pipelines).toHaveLength(1);
      });
    });

    it('updates pipeline', async () => {
      const updated = { ...mockPipeline, name: 'Updated' };
      mockAPI.updatePipeline.mockResolvedValue(updated);

      const { result } = renderHook(() => usePipelineStore());

      // Set initial pipeline
      act(() => {
        usePipelineStore.setState({ pipelines: [mockPipeline] });
      });

      await act(async () => {
        await result.current.updatePipeline('1', { name: 'Updated' });
      });

      await waitFor(() => {
        expect(result.current.pipelines[0].name).toEqual('Updated');
      });
    });

    it('deletes pipeline', async () => {
      mockAPI.deletePipeline.mockResolvedValue();

      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        usePipelineStore.setState({ pipelines: [mockPipeline] });
      });

      await act(async () => {
        await result.current.deletePipeline('1');
      });

      await waitFor(() => {
        expect(result.current.pipelines).toHaveLength(0);
      });
    });
  });

  describe('Run Actions', () => {
    const mockRun = {
      id: 'run-1',
      pipelineId: '1',
      status: 'SUCCESS',
      triggeredBy: 'user@example.com',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 60,
      stageResults: [],
    };

    it('fetches pipeline runs', async () => {
      mockAPI.getPipelineRuns.mockResolvedValue([mockRun]);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.fetchRuns('1');
      });

      await waitFor(() => {
        expect(result.current.runs).toHaveLength(1);
      });
    });

    it('triggers new run', async () => {
      mockAPI.triggerPipeline.mockResolvedValue(mockRun);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.triggerPipeline('1');
      });

      await waitFor(() => {
        expect(mockAPI.triggerPipeline).toHaveBeenCalledWith('1', undefined);
      });
    });

    it('cancels run', async () => {
      mockAPI.cancelRun.mockResolvedValue();

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.cancelRun('1', 'run-1');
      });

      expect(mockAPI.cancelRun).toHaveBeenCalledWith('1', 'run-1');
    });

    it('retries run', async () => {
      mockAPI.retryRun.mockResolvedValue({ ...mockRun, id: 'run-2' });

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.retryRun('1', 'run-1');
      });

      expect(mockAPI.retryRun).toHaveBeenCalledWith('1', 'run-1');
    });
  });

  describe('Logs Actions', () => {
    const mockLogs = [
      { timestamp: '2024-01-01T00:00:00Z', message: 'Starting build...' },
      { timestamp: '2024-01-01T00:00:01Z', message: 'Build complete' },
    ];

    it('fetches logs', async () => {
      mockAPI.getRunLogs.mockResolvedValue(mockLogs);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.fetchLogs('1', 'run-1');
      });

      await waitFor(() => {
        expect(result.current.logs['run-1']).toBeDefined();
      });
    });

    it('adds log entry', () => {
      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        result.current.addLog('run-1', {
          timestamp: new Date().toISOString(),
          message: 'New log',
        });
      });

      expect(result.current.logs['run-1']).toBeDefined();
      expect(result.current.logs['run-1'].length).toBeGreaterThan(0);
    });

    it('clears logs', () => {
      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        usePipelineStore.setState({ logs: { 'run-1': mockLogs } });
      });

      act(() => {
        result.current.clearLogs('run-1');
      });

      expect(result.current.logs['run-1']).toBeUndefined();
    });
  });

  describe('Variables Actions', () => {
    const mockVariable = {
      id: 'var-1',
      name: 'DATABASE_URL',
      value: 'postgres://localhost',
      scope: 'Global' as const,
      environments: ['dev', 'staging'],
    };

    it('fetches variables', async () => {
      mockAPI.getVariables.mockResolvedValue([mockVariable]);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.fetchVariables('1');
      });

      await waitFor(() => {
        expect(result.current.variables).toHaveLength(1);
      });
    });

    it('adds variable', async () => {
      mockAPI.createVariable.mockResolvedValue(mockVariable);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.addVariable('1', mockVariable);
      });

      await waitFor(() => {
        expect(result.current.variables).toHaveLength(1);
      });
    });

    it('removes variable', async () => {
      mockAPI.deleteVariable.mockResolvedValue();

      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        usePipelineStore.setState({ variables: [mockVariable] });
      });

      await act(async () => {
        await result.current.removeVariable('1', 'var-1');
      });

      await waitFor(() => {
        expect(result.current.variables).toHaveLength(0);
      });
    });
  });

  describe('Secrets Actions', () => {
    const mockSecret = {
      id: 'sec-1',
      name: 'GITHUB_TOKEN',
      value: '***hidden***',
      scope: 'Pipeline' as const,
      environments: ['dev', 'prod'],
    };

    it('fetches secrets', async () => {
      mockAPI.getSecrets.mockResolvedValue([mockSecret]);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.fetchSecrets('1');
      });

      await waitFor(() => {
        expect(result.current.secrets).toHaveLength(1);
      });
    });

    it('adds secret', async () => {
      mockAPI.createSecret.mockResolvedValue(mockSecret);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.addSecret('1', mockSecret);
      });

      await waitFor(() => {
        expect(result.current.secrets).toHaveLength(1);
      });
    });

    it('removes secret', async () => {
      mockAPI.deleteSecret.mockResolvedValue();

      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        usePipelineStore.setState({ secrets: [mockSecret] });
      });

      await act(async () => {
        await result.current.removeSecret('1', 'sec-1');
      });

      await waitFor(() => {
        expect(result.current.secrets).toHaveLength(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('sets error on fetch failure', async () => {
      mockAPI.getPipelines.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.fetchPipelines().catch(() => {});
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });

    it('clears error', () => {
      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        usePipelineStore.setState({ error: 'Test error' });
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Selection Actions', () => {
    const mockPipeline = {
      id: '1',
      name: 'Test Pipeline',
      description: 'Test',
      repository: 'https://github.com/test/repo',
      branch: 'main',
      stages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
    };

    const mockRun = {
      id: 'run-1',
      pipelineId: '1',
      status: 'SUCCESS' as const,
      triggeredBy: 'user@example.com',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 60,
      stageResults: [],
    };

    it('selects pipeline', () => {
      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        result.current.selectPipeline(mockPipeline);
      });

      expect(result.current.selectedPipeline).toEqual(mockPipeline);
    });

    it('selects run', () => {
      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        result.current.selectRun(mockRun);
      });

      expect(result.current.selectedRun).toEqual(mockRun);
    });

    it('clears selection', () => {
      const { result } = renderHook(() => usePipelineStore());

      act(() => {
        usePipelineStore.setState({
          selectedPipeline: mockPipeline,
          selectedRun: mockRun,
        });
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedPipeline).toBeNull();
      expect(result.current.selectedRun).toBeNull();
    });
  });
});
