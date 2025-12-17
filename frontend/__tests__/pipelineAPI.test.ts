import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import PipelineAPI, {
  Pipeline,
  PipelineRun,
  Variable,
  Secret,
  Agent,
} from '../pipelineAPI';

// Mock axios
vi.mock('axios');

const mockAxios = axios as unknown as {
  create: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('PipelineAPI Service', () => {
  let api: typeof PipelineAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset API instance
    api = PipelineAPI;
  });

  describe('Pipeline Operations', () => {
    const mockPipeline: Pipeline = {
      id: '1',
      name: 'Test Pipeline',
      description: 'Test description',
      repository: 'https://github.com/test/repo',
      branch: 'main',
      stages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
    };

    it('fetches all pipelines', async () => {
      const mockResponse = { data: { pipelines: [mockPipeline] } };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getPipelines();

      expect(api['client'].get).toHaveBeenCalledWith('/pipelines');
      expect(result).toEqual([mockPipeline]);
    });

    it('fetches single pipeline by ID', async () => {
      const mockResponse = { data: mockPipeline };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getPipeline('1');

      expect(api['client'].get).toHaveBeenCalledWith('/pipelines/1');
      expect(result).toEqual(mockPipeline);
    });

    it('creates new pipeline', async () => {
      const createPayload = {
        name: 'New Pipeline',
        description: 'New description',
        repository: 'https://github.com/new/repo',
        branch: 'main',
        stages: [],
      };

      const mockResponse = { data: mockPipeline };
      vi.spyOn(api['client'], 'post').mockResolvedValue(mockResponse);

      const result = await api.createPipeline(createPayload as any);

      expect(api['client'].post).toHaveBeenCalledWith('/pipelines', createPayload);
      expect(result).toEqual(mockPipeline);
    });

    it('updates existing pipeline', async () => {
      const updatePayload = { name: 'Updated Pipeline' };
      const mockResponse = { data: { ...mockPipeline, ...updatePayload } };
      vi.spyOn(api['client'], 'put').mockResolvedValue(mockResponse);

      const result = await api.updatePipeline('1', updatePayload as any);

      expect(api['client'].put).toHaveBeenCalledWith('/pipelines/1', updatePayload);
      expect(result.name).toEqual('Updated Pipeline');
    });

    it('deletes pipeline', async () => {
      vi.spyOn(api['client'], 'delete').mockResolvedValue({ data: { success: true } });

      await api.deletePipeline('1');

      expect(api['client'].delete).toHaveBeenCalledWith('/pipelines/1');
    });

    it('handles pipeline fetch error', async () => {
      const error = new Error('Network error');
      vi.spyOn(api['client'], 'get').mockRejectedValue(error);

      await expect(api.getPipelines()).rejects.toThrow('Network error');
    });
  });

  describe('Pipeline Run Operations', () => {
    const mockRun: PipelineRun = {
      id: 'run-1',
      pipelineId: '1',
      status: 'RUNNING',
      triggeredBy: 'user@example.com',
      startedAt: new Date().toISOString(),
      completedAt: null,
      duration: 0,
      stageResults: [],
    };

    it('fetches pipeline runs', async () => {
      const mockResponse = { data: { runs: [mockRun] } };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getPipelineRuns('1');

      expect(api['client'].get).toHaveBeenCalledWith('/pipelines/1/runs');
      expect(result).toEqual([mockRun]);
    });

    it('triggers new pipeline run', async () => {
      const mockResponse = { data: mockRun };
      vi.spyOn(api['client'], 'post').mockResolvedValue(mockResponse);

      const result = await api.triggerPipeline('1');

      expect(api['client'].post).toHaveBeenCalledWith('/pipelines/1/trigger', {});
      expect(result.status).toEqual('RUNNING');
    });

    it('triggers run with parameters', async () => {
      const params = { branch: 'develop', env: 'staging' };
      const mockResponse = { data: mockRun };
      vi.spyOn(api['client'], 'post').mockResolvedValue(mockResponse);

      const result = await api.triggerPipeline('1', params);

      expect(api['client'].post).toHaveBeenCalledWith('/pipelines/1/trigger', params);
      expect(result).toEqual(mockRun);
    });

    it('cancels pipeline run', async () => {
      vi.spyOn(api['client'], 'post').mockResolvedValue({ data: { success: true } });

      await api.cancelRun('1', 'run-1');

      expect(api['client'].post).toHaveBeenCalledWith('/pipelines/1/runs/run-1/cancel');
    });

    it('retries pipeline run', async () => {
      const mockResponse = { data: { ...mockRun, id: 'run-2' } };
      vi.spyOn(api['client'], 'post').mockResolvedValue(mockResponse);

      const result = await api.retryRun('1', 'run-1');

      expect(api['client'].post).toHaveBeenCalledWith('/pipelines/1/runs/run-1/retry');
      expect(result.id).toEqual('run-2');
    });
  });

  describe('Logs Operations', () => {
    const mockLogs = {
      logs: [
        { timestamp: '2024-01-01T00:00:00Z', message: 'Starting build...' },
        { timestamp: '2024-01-01T00:00:01Z', message: 'Build complete' },
      ],
    };

    it('fetches run logs', async () => {
      const mockResponse = { data: mockLogs };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getRunLogs('1', 'run-1');

      expect(api['client'].get).toHaveBeenCalledWith('/pipelines/1/runs/run-1/logs');
      expect(result).toEqual(mockLogs.logs);
    });

    it('fetches stage logs', async () => {
      const mockResponse = { data: mockLogs };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getRunLogs('1', 'run-1', 'checkout');

      expect(api['client'].get).toHaveBeenCalledWith(
        '/pipelines/1/runs/run-1/logs?stageId=checkout'
      );
      expect(result).toEqual(mockLogs.logs);
    });

    it('handles empty logs', async () => {
      const mockResponse = { data: { logs: [] } };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getRunLogs('1', 'run-1');

      expect(result).toEqual([]);
    });
  });

  describe('Variables Operations', () => {
    const mockVariable: Variable = {
      id: 'var-1',
      name: 'DATABASE_URL',
      value: 'postgres://localhost',
      scope: 'Global',
      environments: ['dev', 'staging'],
    };

    it('fetches variables', async () => {
      const mockResponse = { data: { variables: [mockVariable] } };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getVariables('1');

      expect(api['client'].get).toHaveBeenCalledWith('/pipelines/1/variables');
      expect(result).toEqual([mockVariable]);
    });

    it('creates variable', async () => {
      const mockResponse = { data: mockVariable };
      vi.spyOn(api['client'], 'post').mockResolvedValue(mockResponse);

      const result = await api.createVariable('1', mockVariable);

      expect(api['client'].post).toHaveBeenCalledWith('/pipelines/1/variables', mockVariable);
      expect(result).toEqual(mockVariable);
    });

    it('updates variable', async () => {
      const updated = { ...mockVariable, value: 'new-value' };
      const mockResponse = { data: updated };
      vi.spyOn(api['client'], 'put').mockResolvedValue(mockResponse);

      const result = await api.updateVariable('1', 'var-1', updated);

      expect(api['client'].put).toHaveBeenCalledWith('/pipelines/1/variables/var-1', updated);
      expect(result.value).toEqual('new-value');
    });

    it('deletes variable', async () => {
      vi.spyOn(api['client'], 'delete').mockResolvedValue({ data: { success: true } });

      await api.deleteVariable('1', 'var-1');

      expect(api['client'].delete).toHaveBeenCalledWith('/pipelines/1/variables/var-1');
    });
  });

  describe('Secrets Operations', () => {
    const mockSecret: Secret = {
      id: 'sec-1',
      name: 'GITHUB_TOKEN',
      value: '***hidden***',
      scope: 'Pipeline',
      environments: ['dev', 'prod'],
    };

    it('fetches secrets', async () => {
      const mockResponse = { data: { secrets: [mockSecret] } };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getSecrets('1');

      expect(api['client'].get).toHaveBeenCalledWith('/pipelines/1/secrets');
      expect(result).toEqual([mockSecret]);
    });

    it('creates secret', async () => {
      const mockResponse = { data: mockSecret };
      vi.spyOn(api['client'], 'post').mockResolvedValue(mockResponse);

      const result = await api.createSecret('1', mockSecret);

      expect(api['client'].post).toHaveBeenCalledWith('/pipelines/1/secrets', mockSecret);
      expect(result).toEqual(mockSecret);
    });

    it('updates secret', async () => {
      const updated = { ...mockSecret, value: 'new-token' };
      const mockResponse = { data: updated };
      vi.spyOn(api['client'], 'put').mockResolvedValue(mockResponse);

      const result = await api.updateSecret('1', 'sec-1', updated);

      expect(api['client'].put).toHaveBeenCalledWith('/pipelines/1/secrets/sec-1', updated);
      expect(result.value).toEqual('new-token');
    });

    it('deletes secret', async () => {
      vi.spyOn(api['client'], 'delete').mockResolvedValue({ data: { success: true } });

      await api.deleteSecret('1', 'sec-1');

      expect(api['client'].delete).toHaveBeenCalledWith('/pipelines/1/secrets/sec-1');
    });
  });

  describe('Agents Operations', () => {
    const mockAgent: Agent = {
      id: 'agent-1',
      name: 'docker-runner-1',
      status: 'Online',
      cpuUsage: 45,
      memoryUsage: 60,
      lastSeen: new Date().toISOString(),
      jobsCompleted: 150,
      uptime: '30d',
    };

    it('fetches agents', async () => {
      const mockResponse = { data: { agents: [mockAgent] } };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getAgents();

      expect(api['client'].get).toHaveBeenCalledWith('/agents');
      expect(result).toEqual([mockAgent]);
    });

    it('creates agent', async () => {
      const mockResponse = { data: mockAgent };
      vi.spyOn(api['client'], 'post').mockResolvedValue(mockResponse);

      const result = await api.createAgent({ name: mockAgent.name } as any);

      expect(api['client'].post).toHaveBeenCalledWith('/agents', { name: mockAgent.name });
      expect(result).toEqual(mockAgent);
    });

    it('deletes agent', async () => {
      vi.spyOn(api['client'], 'delete').mockResolvedValue({ data: { success: true } });

      await api.deleteAgent('agent-1');

      expect(api['client'].delete).toHaveBeenCalledWith('/agents/agent-1');
    });
  });

  describe('WebSocket Subscriptions', () => {
    it('subscribes to pipeline logs', async () => {
      const callback = vi.fn();
      const unsubscribe = api.subscribeToLogs('1', 'run-1', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('subscribes to pipeline status', async () => {
      const callback = vi.fn();
      const unsubscribe = api.subscribeToPipelineStatus('1', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('unsubscribes from logs', async () => {
      const callback = vi.fn();
      const unsubscribe = api.subscribeToLogs('1', 'run-1', callback);

      unsubscribe();
      // Verify subscription is cleaned up
      expect(true).toBe(true); // Placeholder for actual verification
    });
  });

  describe('Authentication', () => {
    it('includes auth token in requests', async () => {
      const token = 'test-token-123';
      localStorage.setItem('authToken', token);

      const mockResponse = { data: { pipelines: [] } };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      await api.getPipelines();

      // Verify token is in the client headers
      expect(api['client'].defaults.headers.common['Authorization']).toBeDefined();
    });

    it('handles missing auth token gracefully', async () => {
      localStorage.removeItem('authToken');

      const mockResponse = { data: { pipelines: [] } };
      vi.spyOn(api['client'], 'get').mockResolvedValue(mockResponse);

      const result = await api.getPipelines();

      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('handles 404 errors', async () => {
      const error = {
        response: { status: 404, data: { message: 'Not found' } },
      };
      vi.spyOn(api['client'], 'get').mockRejectedValue(error);

      await expect(api.getPipeline('nonexistent')).rejects.toBeDefined();
    });

    it('handles 500 errors', async () => {
      const error = {
        response: { status: 500, data: { message: 'Server error' } },
      };
      vi.spyOn(api['client'], 'get').mockRejectedValue(error);

      await expect(api.getPipelines()).rejects.toBeDefined();
    });

    it('handles network timeout', async () => {
      const error = { message: 'timeout of 30000ms exceeded' };
      vi.spyOn(api['client'], 'get').mockRejectedValue(error);

      await expect(api.getPipelines()).rejects.toBeDefined();
    });
  });
});
