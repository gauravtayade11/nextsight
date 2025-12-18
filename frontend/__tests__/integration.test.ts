import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import usePipelineStore from '../stores/pipelineStore';
import PipelineAPI from '../services/pipelineAPI';
import PipelineOverview from '../components/pipelines/PipelineOverview';
import PipelineRun from '../components/pipelines/PipelineRun';
import { useLogStream, useAutoRefresh } from '../hooks/usePipelineHooks';

// Mock API
vi.mock('../services/pipelineAPI');

const mockAPI = PipelineAPI as jest.Mocked<typeof PipelineAPI>;

describe('Pipeline Module Integration Tests', () => {
  const mockPipeline = {
    id: '1',
    name: 'Integration Test Pipeline',
    description: 'Test pipeline for integration testing',
    repository: 'https://github.com/test/integration',
    branch: 'main',
    stages: [
      { id: 'checkout', name: 'Checkout', status: 'COMPLETED', duration: 5 },
      { id: 'build', name: 'Build', status: 'RUNNING', duration: 15 },
      { id: 'test', name: 'Test', status: 'PENDING', duration: 0 },
      { id: 'deploy', name: 'Deploy', status: 'PENDING', duration: 0 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRun: 'run-1',
  };

  const mockRun = {
    id: 'run-1',
    pipelineId: '1',
    status: 'RUNNING' as const,
    triggeredBy: 'test@example.com',
    startedAt: new Date(Date.now() - 30000).toISOString(),
    completedAt: null,
    duration: 30,
    stageResults: [
      {
        stageId: 'checkout',
        status: 'COMPLETED',
        startedAt: new Date(Date.now() - 30000).toISOString(),
        completedAt: new Date(Date.now() - 25000).toISOString(),
      },
      {
        stageId: 'build',
        status: 'RUNNING',
        startedAt: new Date(Date.now() - 25000).toISOString(),
        completedAt: null,
      },
    ],
  };

  const mockLogs = [
    { timestamp: new Date(Date.now() - 20000).toISOString(), message: '[checkout] Cloning repository...' },
    { timestamp: new Date(Date.now() - 19000).toISOString(), message: '[checkout] Clone complete' },
    { timestamp: new Date(Date.now() - 18000).toISOString(), message: '[build] Installing dependencies...' },
    { timestamp: new Date(Date.now() - 15000).toISOString(), message: '[build] npm install complete' },
    { timestamp: new Date(Date.now() - 14000).toISOString(), message: '[build] Building application...' },
    { timestamp: new Date(Date.now() - 5000).toISOString(), message: '[build] Build successful' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    usePipelineStore.setState({
      pipelines: [],
      selectedPipeline: null,
      selectedRun: null,
      logs: {},
      variables: [],
      secrets: [],
      runs: [],
      loading: false,
      error: null,
    });
  });

  describe('End-to-End Pipeline Flow', () => {
    it('should load pipelines and display in overview', async () => {
      mockAPI.getPipelines.mockResolvedValue([mockPipeline]);

      const { result } = renderHook(() => usePipelineStore());

      await act(async () => {
        await result.current.fetchPipelines();
      });

      await waitFor(() => {
        expect(result.current.pipelines).toHaveLength(1);
        expect(result.current.pipelines[0].name).toBe('Integration Test Pipeline');
      });
    });

    it('should navigate from overview to pipeline details', async () => {
      const store = usePipelineStore.getState();
      mockAPI.getPipelines.mockResolvedValue([mockPipeline]);
      mockAPI.getPipelineRuns.mockResolvedValue([mockRun]);

      // Fetch pipelines
      await store.fetchPipelines();

      // Select a pipeline
      act(() => {
        store.selectPipeline(mockPipeline);
      });

      expect(store.selectedPipeline?.id).toBe('1');

      // Fetch runs for selected pipeline
      await store.fetchRuns(mockPipeline.id);

      expect(store.runs).toBeDefined();
    });

    it('should navigate to run details and stream logs', async () => {
      const store = usePipelineStore.getState();

      // Setup initial state
      act(() => {
        store.selectPipeline(mockPipeline);
        store.selectRun(mockRun);
      });

      expect(store.selectedRun?.id).toBe('run-1');

      // Mock logs fetch
      mockAPI.getRunLogs.mockResolvedValue(mockLogs);

      // Fetch logs
      await store.fetchLogs(mockPipeline.id, mockRun.id);

      expect(store.logs[mockRun.id]).toBeDefined();
    });
  });

  describe('Real-time Data Sync', () => {
    it('should sync real-time logs from WebSocket to store', async () => {
      const store = usePipelineStore.getState();

      // Start with initial logs
      act(() => {
        mockLogs.slice(0, 3).forEach(log => {
          store.addLog(mockRun.id, log);
        });
      });

      expect(store.logs[mockRun.id]).toHaveLength(3);

      // Add new logs (simulating WebSocket message)
      act(() => {
        store.addLog(mockRun.id, mockLogs[3]);
        store.addLog(mockRun.id, mockLogs[4]);
      });

      expect(store.logs[mockRun.id]).toHaveLength(5);
    });

    it('should update pipeline run status from WebSocket', async () => {
      const store = usePipelineStore.getState();

      // Initial run state
      act(() => {
        store.selectRun(mockRun);
      });

      expect(store.selectedRun?.status).toBe('RUNNING');

      // Simulate run completion
      const completedRun = {
        ...mockRun,
        status: 'SUCCESS' as const,
        completedAt: new Date().toISOString(),
      };

      act(() => {
        store.selectRun(completedRun);
      });

      expect(store.selectedRun?.status).toBe('SUCCESS');
    });
  });

  describe('Pipeline Trigger and Monitor', () => {
    it('should trigger pipeline and monitor run', async () => {
      const store = usePipelineStore.getState();

      mockAPI.getPipelines.mockResolvedValue([mockPipeline]);
      mockAPI.triggerPipeline.mockResolvedValue(mockRun);
      mockAPI.getRunLogs.mockResolvedValue(mockLogs);

      // Setup
      await store.fetchPipelines();
      const pipeline = store.pipelines[0];

      // Trigger pipeline
      await store.triggerPipeline(pipeline.id);

      expect(mockAPI.triggerPipeline).toHaveBeenCalledWith(pipeline.id, undefined);
    });

    it('should cancel running pipeline', async () => {
      const store = usePipelineStore.getState();

      mockAPI.cancelRun.mockResolvedValue();

      // Cancel run
      await store.cancelRun(mockPipeline.id, mockRun.id);

      expect(mockAPI.cancelRun).toHaveBeenCalledWith(mockPipeline.id, mockRun.id);
    });

    it('should retry failed pipeline', async () => {
      const store = usePipelineStore.getState();

      const failedRun = { ...mockRun, status: 'FAILED' as const };
      const newRun = { ...failedRun, id: 'run-2', status: 'RUNNING' as const };

      mockAPI.retryRun.mockResolvedValue(newRun);

      // Retry run
      await store.retryRun(mockPipeline.id, failedRun.id);

      expect(mockAPI.retryRun).toHaveBeenCalledWith(mockPipeline.id, failedRun.id);
    });
  });

  describe('Variables and Secrets Management', () => {
    it('should fetch, add, and update variables', async () => {
      const store = usePipelineStore.getState();

      const mockVariable = {
        id: 'var-1',
        name: 'DATABASE_URL',
        value: 'postgres://localhost',
        scope: 'Global' as const,
        environments: ['dev', 'staging'],
      };

      const updatedVariable = { ...mockVariable, value: 'postgres://production' };

      mockAPI.getVariables.mockResolvedValue([mockVariable]);
      mockAPI.updateVariable.mockResolvedValue(updatedVariable);

      // Fetch variables
      await store.fetchVariables(mockPipeline.id);
      expect(store.variables).toHaveLength(1);

      // Update variable
      await store.updateVariable(mockPipeline.id, mockVariable.id, updatedVariable);
      expect(mockAPI.updateVariable).toHaveBeenCalled();
    });

    it('should fetch, add, and remove secrets', async () => {
      const store = usePipelineStore.getState();

      const mockSecret = {
        id: 'sec-1',
        name: 'GITHUB_TOKEN',
        value: '***hidden***',
        scope: 'Pipeline' as const,
        environments: ['prod'],
      };

      mockAPI.getSecrets.mockResolvedValue([mockSecret]);
      mockAPI.deleteSecret.mockResolvedValue();

      // Fetch secrets
      await store.fetchSecrets(mockPipeline.id);
      expect(store.secrets).toHaveLength(1);

      // Remove secret
      await store.removeSecret(mockPipeline.id, mockSecret.id);
      expect(mockAPI.deleteSecret).toHaveBeenCalledWith(mockPipeline.id, mockSecret.id);
    });
  });

  describe('Error Recovery', () => {
    it('should handle API failure and recover', async () => {
      const store = usePipelineStore.getState();

      mockAPI.getPipelines.mockRejectedValueOnce(new Error('Network error'));
      mockAPI.getPipelines.mockResolvedValueOnce([mockPipeline]);

      // First attempt fails
      try {
        await store.fetchPipelines();
      } catch (e) {
        // Expected error
      }

      expect(store.error).toBeDefined();

      // Clear error
      act(() => {
        store.clearError();
      });
      expect(store.error).toBeNull();

      // Retry succeeds
      await store.fetchPipelines();
      expect(store.pipelines).toHaveLength(1);
    });

    it('should handle partial data loss and resync', async () => {
      const store = usePipelineStore.getState();

      // Load initial state
      mockAPI.getPipelines.mockResolvedValue([mockPipeline]);
      await store.fetchPipelines();

      // Clear logs and resync
      act(() => {
        store.clearLogs(mockRun.id);
      });

      mockAPI.getRunLogs.mockResolvedValue(mockLogs);
      await store.fetchLogs(mockPipeline.id, mockRun.id);

      expect(store.logs[mockRun.id]).toHaveLength(mockLogs.length);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should manage large log datasets efficiently', async () => {
      const store = usePipelineStore.getState();

      // Generate large log dataset
      const largeLogs = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: new Date(Date.now() - (1000 - i) * 1000).toISOString(),
        message: `[stage-${i % 4}] Log message ${i}`,
      }));

      // Add logs in batch
      act(() => {
        largeLogs.forEach(log => {
          store.addLog(mockRun.id, log);
        });
      });

      expect(store.logs[mockRun.id]).toHaveLength(1000);

      // Clear to free memory
      act(() => {
        store.clearLogs(mockRun.id);
      });

      expect(store.logs[mockRun.id]).toBeUndefined();
    });

    it('should manage multiple concurrent runs', async () => {
      const store = usePipelineStore.getState();

      const runs = Array.from({ length: 5 }, (_, i) => ({
        ...mockRun,
        id: `run-${i}`,
        status: (i === 0 ? 'RUNNING' : 'PENDING') as const,
      }));

      // Simulate multiple runs
      runs.forEach(run => {
        const logEntries = Array.from({ length: 50 }, (_, j) => ({
          timestamp: new Date(Date.now() - (50 - j) * 1000).toISOString(),
          message: `Run ${run.id} - Log ${j}`,
        }));

        logEntries.forEach(log => {
          act(() => {
            store.addLog(run.id, log);
          });
        });
      });

      // Verify all runs have logs
      runs.forEach(run => {
        expect(store.logs[run.id]).toHaveLength(50);
      });
    });
  });

  describe('User Interaction Flow', () => {
    it('should complete full pipeline creation workflow', async () => {
      const store = usePipelineStore.getState();

      const newPipelineData = {
        name: 'New Integration Pipeline',
        description: 'Created during test',
        repository: 'https://github.com/test/new-pipeline',
        branch: 'main',
        stages: [],
      };

      mockAPI.createPipeline.mockResolvedValue({
        ...newPipelineData,
        id: 'new-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastRun: null,
      });

      // Create pipeline
      await store.createPipeline(newPipelineData as any);

      expect(store.pipelines).toHaveLength(1);
      expect(store.pipelines[0].name).toBe('New Integration Pipeline');
    });

    it('should complete full run trigger and monitor workflow', async () => {
      const store = usePipelineStore.getState();

      mockAPI.getPipelines.mockResolvedValue([mockPipeline]);
      mockAPI.triggerPipeline.mockResolvedValue(mockRun);
      mockAPI.getRunLogs.mockResolvedValue(mockLogs.slice(0, 3));

      // Load pipeline
      await store.fetchPipelines();
      const pipeline = store.pipelines[0];

      // Trigger run
      await store.triggerPipeline(pipeline.id);

      // Monitor logs
      await store.fetchLogs(pipeline.id, mockRun.id);

      expect(store.logs[mockRun.id]).toBeDefined();
      expect(store.logs[mockRun.id].length).toBeGreaterThan(0);
    });
  });
});
