// stores/pipelineStore.ts
import { create } from 'zustand';
import * as api from '../services/pipelineAPI';

// Log entry type for structured logs
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  message: string;
  stage?: string;
  lineNumber: number;
}

// Stage logs map type
export type StageLogs = Record<string, string[]>;

interface PipelineStore {
  // State
  pipelines: api.Pipeline[];
  selectedPipeline: api.Pipeline | null;
  runs: api.PipelineRun[];
  selectedRun: api.PipelineRun | null;
  logs: string[];
  stageLogs: StageLogs;
  yaml: string;
  variables: api.Variable[];
  secrets: api.Secret[];
  triggers: api.Trigger[];
  statistics: api.PipelineStatistics | null;
  isLoading: boolean;
  error: string | null;

  // Pipeline CRUD
  fetchPipelines: () => Promise<void>;
  fetchPipelineById: (id: string) => Promise<void>;
  createPipeline: (data: api.CreatePipelineRequest) => Promise<api.Pipeline>;
  updatePipeline: (id: string, data: api.UpdatePipelineRequest) => Promise<void>;
  deletePipeline: (id: string) => Promise<void>;

  // Pipeline Runs
  fetchRuns: (pipelineId: string) => Promise<void>;
  fetchRun: (pipelineId: string, runId: string) => Promise<void>;
  triggerPipeline: (pipelineId: string, branch?: string) => Promise<api.PipelineRun>;
  runPipeline: (pipelineId: string, branch?: string) => Promise<api.PipelineRun>; // Alias
  retryRun: (pipelineId: string, runId: string) => Promise<void>;
  cancelRun: (pipelineId: string, runId: string) => Promise<void>;

  // Logs
  fetchLogs: (pipelineId: string, runId: string, stageId?: string) => Promise<void>;
  addLog: (stageId: string, log: string) => void;
  appendLog: (log: string) => void;
  clearLogs: () => void;
  clearStageLogs: (stageId?: string) => void;
  getStageLogs: (stageId: string) => string[];
  getParsedLogs: () => LogEntry[];

  // YAML
  fetchPipelineYaml: (pipelineId: string) => Promise<void>;
  updatePipelineYaml: (pipelineId: string, yaml: string) => Promise<void>;

  // Variables
  fetchVariables: (pipelineId?: string) => Promise<void>;
  addVariable: (variable: Omit<api.Variable, 'id'>, pipelineId?: string) => Promise<void>;
  updateVariable: (id: string, variable: Partial<api.Variable>, pipelineId?: string) => Promise<void>;
  removeVariable: (id: string, pipelineId?: string) => Promise<void>;

  // Secrets
  fetchSecrets: (pipelineId?: string) => Promise<void>;
  addSecret: (secret: Omit<api.Secret, 'id'> & { value: string }, pipelineId?: string) => Promise<void>;
  updateSecret: (id: string, secret: { value?: string; scope?: string }, pipelineId?: string) => Promise<void>;
  removeSecret: (id: string, pipelineId?: string) => Promise<void>;

  // Triggers
  fetchTriggers: (pipelineId: string) => Promise<void>;
  addTrigger: (pipelineId: string, trigger: Omit<api.Trigger, 'id' | 'pipelineId'>) => Promise<void>;
  updateTrigger: (pipelineId: string, triggerId: string, trigger: Partial<api.Trigger>) => Promise<void>;
  removeTrigger: (pipelineId: string, triggerId: string) => Promise<void>;

  // Statistics
  fetchStatistics: (pipelineId: string) => Promise<void>;

  // Utility
  clearError: () => void;
  setSelectedPipeline: (pipeline: api.Pipeline | null) => void;
  setSelectedRun: (run: api.PipelineRun | null) => void;
}

const usePipelineStore = create<PipelineStore>((set, get) => ({
  // Initial State
  pipelines: [],
  selectedPipeline: null,
  runs: [],
  selectedRun: null,
  logs: [],
  stageLogs: {},
  yaml: '',
  variables: [],
  secrets: [],
  triggers: [],
  statistics: null,
  isLoading: false,
  error: null,

  // ============================================
  // PIPELINE CRUD
  // ============================================

  fetchPipelines: async () => {
    set({ isLoading: true, error: null });
    try {
      const pipelines = await api.getPipelines();
      set({ pipelines, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch pipelines',
        isLoading: false,
      });
    }
  },

  fetchPipelineById: async (id: string) => {
    set({ isLoading: true, error: null, selectedPipeline: null });
    try {
      const pipeline = await api.getPipeline(id);
      set({ selectedPipeline: pipeline, isLoading: false, error: null });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to fetch pipeline';
      console.error('Failed to fetch pipeline:', error);
      set({
        error: errorMessage,
        selectedPipeline: null,
        isLoading: false,
      });
    }
  },

  createPipeline: async (data: api.CreatePipelineRequest) => {
    set({ isLoading: true, error: null });
    try {
      const pipeline = await api.createPipeline(data);
      set((state) => ({
        pipelines: [...state.pipelines, pipeline],
        isLoading: false,
      }));
      return pipeline;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to create pipeline',
        isLoading: false,
      });
      throw error;
    }
  },

  updatePipeline: async (id: string, data: api.UpdatePipelineRequest) => {
    set({ isLoading: true, error: null });
    try {
      const updatedPipeline = await api.updatePipeline(id, data);
      set((state) => ({
        pipelines: state.pipelines.map((p) => (p.id === id ? updatedPipeline : p)),
        selectedPipeline: state.selectedPipeline?.id === id ? updatedPipeline : state.selectedPipeline,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to update pipeline',
        isLoading: false,
      });
      throw error;
    }
  },

  deletePipeline: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deletePipeline(id);
      set((state) => ({
        pipelines: state.pipelines.filter((p) => p.id !== id),
        selectedPipeline: state.selectedPipeline?.id === id ? null : state.selectedPipeline,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to delete pipeline',
        isLoading: false,
      });
      throw error;
    }
  },

  // ============================================
  // PIPELINE RUNS
  // ============================================

  fetchRuns: async (pipelineId: string) => {
    set({ isLoading: true, error: null });
    try {
      const runs = await api.getPipelineRuns(pipelineId);
      set({ runs, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch runs',
        isLoading: false,
      });
    }
  },

  fetchRun: async (pipelineId: string, runId: string) => {
    set({ isLoading: true, error: null });
    try {
      const run = await api.getPipelineRun(pipelineId, runId);
      set({ selectedRun: run, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch run',
        isLoading: false,
      });
    }
  },

  triggerPipeline: async (pipelineId: string, branch?: string) => {
    set({ isLoading: true, error: null });
    try {
      const run = await api.triggerPipeline(pipelineId, branch);
      set((state) => ({
        runs: [run, ...state.runs],
        isLoading: false,
      }));
      return run;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to trigger pipeline',
        isLoading: false,
      });
      throw error;
    }
  },

  // Alias for backward compatibility
  runPipeline: async (pipelineId: string, branch?: string) => {
    return get().triggerPipeline(pipelineId, branch);
  },

  retryRun: async (pipelineId: string, runId: string) => {
    set({ isLoading: true, error: null });
    try {
      const run = await api.retryRun(pipelineId, runId);
      set((state) => ({
        runs: [run, ...state.runs],
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to retry run',
        isLoading: false,
      });
      throw error;
    }
  },

  cancelRun: async (pipelineId: string, runId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.cancelRun(pipelineId, runId);
      set((state) => ({
        runs: state.runs.map((r) =>
          r.id === runId ? { ...r, status: 'cancelled' as const } : r
        ),
        selectedRun:
          state.selectedRun?.id === runId
            ? { ...state.selectedRun, status: 'cancelled' as const }
            : state.selectedRun,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to cancel run',
        isLoading: false,
      });
      throw error;
    }
  },

  // ============================================
  // LOGS
  // ============================================

  fetchLogs: async (pipelineId: string, runId: string, stageId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const logs = await api.getRunLogs(pipelineId, runId, stageId);
      set({ logs, isLoading: false });
      // Also store in stageLogs if stageId provided
      if (stageId) {
        set((state) => ({
          stageLogs: { ...state.stageLogs, [stageId]: logs },
        }));
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch logs',
        isLoading: false,
      });
    }
  },

  addLog: (stageId: string, log: string) => {
    set((state) => ({
      logs: [...state.logs, log],
      stageLogs: {
        ...state.stageLogs,
        [stageId]: [...(state.stageLogs[stageId] || []), log],
      },
    }));
  },

  appendLog: (log: string) => {
    set((state) => ({
      logs: [...state.logs, log],
    }));
  },

  clearLogs: () => {
    set({ logs: [], stageLogs: {} });
  },

  clearStageLogs: (stageId?: string) => {
    if (stageId) {
      set((state) => {
        const newStageLogs = { ...state.stageLogs };
        delete newStageLogs[stageId];
        return { stageLogs: newStageLogs };
      });
    } else {
      set({ stageLogs: {} });
    }
  },

  getStageLogs: (stageId: string) => {
    return get().stageLogs[stageId] || [];
  },

  getParsedLogs: () => {
    const logs = get().logs;
    return logs.map((log, index) => {
      const lowerLog = log.toLowerCase();
      let level: LogEntry['level'] = 'info';

      if (lowerLog.includes('error') || lowerLog.includes('fail') || lowerLog.includes('✗')) {
        level = 'error';
      } else if (lowerLog.includes('warn')) {
        level = 'warn';
      } else if (lowerLog.includes('debug')) {
        level = 'debug';
      } else if (lowerLog.includes('success') || lowerLog.includes('✓') || lowerLog.includes('✅')) {
        level = 'success';
      }

      // Try to extract timestamp from log line
      const timestampMatch = log.match(/\[(\d{4}-\d{2}-\d{2}T[\d:]+Z?)\]/);
      const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();

      // Try to extract stage name
      const stageMatch = log.match(/Stage:\s*(\w+)/i);
      const stage = stageMatch ? stageMatch[1] : undefined;

      return {
        timestamp,
        level,
        message: log,
        stage,
        lineNumber: index + 1,
      };
    });
  },

  // ============================================
  // YAML
  // ============================================

  fetchPipelineYaml: async (pipelineId: string) => {
    set({ isLoading: true, error: null });
    try {
      const yaml = await api.getPipelineYaml(pipelineId);
      set({ yaml, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch YAML',
        isLoading: false,
      });
    }
  },

  updatePipelineYaml: async (pipelineId: string, yaml: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.updatePipelineYaml(pipelineId, yaml);
      set({ yaml, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to update YAML',
        isLoading: false,
      });
      throw error;
    }
  },

  // ============================================
  // VARIABLES
  // ============================================

  fetchVariables: async (pipelineId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const variables = await api.getVariables(pipelineId);
      set({ variables, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch variables',
        isLoading: false,
      });
    }
  },

  addVariable: async (variable: Omit<api.Variable, 'id'>, pipelineId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const newVariable = await api.createVariable(variable, pipelineId);
      set((state) => ({
        variables: [...state.variables, newVariable],
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to add variable',
        isLoading: false,
      });
      throw error;
    }
  },

  updateVariable: async (id: string, variable: Partial<api.Variable>, pipelineId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await api.updateVariable(id, variable, pipelineId);
      set((state) => ({
        variables: state.variables.map((v) => (v.id === id ? updated : v)),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to update variable',
        isLoading: false,
      });
      throw error;
    }
  },

  removeVariable: async (id: string, pipelineId?: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteVariable(id, pipelineId);
      set((state) => ({
        variables: state.variables.filter((v) => v.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to delete variable',
        isLoading: false,
      });
      throw error;
    }
  },

  // ============================================
  // SECRETS
  // ============================================

  fetchSecrets: async (pipelineId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const secrets = await api.getSecrets(pipelineId);
      set({ secrets, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch secrets',
        isLoading: false,
      });
    }
  },

  addSecret: async (secret: Omit<api.Secret, 'id'> & { value: string }, pipelineId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const newSecret = await api.createSecret(secret, pipelineId);
      set((state) => ({
        secrets: [...state.secrets, newSecret],
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to add secret',
        isLoading: false,
      });
      throw error;
    }
  },

  updateSecret: async (id: string, secret: { value?: string; scope?: string }, pipelineId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await api.updateSecret(id, secret, pipelineId);
      set((state) => ({
        secrets: state.secrets.map((s) => (s.id === id ? updated : s)),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to update secret',
        isLoading: false,
      });
      throw error;
    }
  },

  removeSecret: async (id: string, pipelineId?: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteSecret(id, pipelineId);
      set((state) => ({
        secrets: state.secrets.filter((s) => s.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to delete secret',
        isLoading: false,
      });
      throw error;
    }
  },

  // ============================================
  // TRIGGERS
  // ============================================

  fetchTriggers: async (pipelineId: string) => {
    set({ isLoading: true, error: null });
    try {
      const triggers = await api.getTriggers(pipelineId);
      set({ triggers, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch triggers',
        isLoading: false,
      });
    }
  },

  addTrigger: async (pipelineId: string, trigger: Omit<api.Trigger, 'id' | 'pipelineId'>) => {
    set({ isLoading: true, error: null });
    try {
      const newTrigger = await api.createTrigger(pipelineId, trigger);
      set((state) => ({
        triggers: [...state.triggers, newTrigger],
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to add trigger',
        isLoading: false,
      });
      throw error;
    }
  },

  updateTrigger: async (pipelineId: string, triggerId: string, trigger: Partial<api.Trigger>) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await api.updateTrigger(pipelineId, triggerId, trigger);
      set((state) => ({
        triggers: state.triggers.map((t) => (t.id === triggerId ? updated : t)),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to update trigger',
        isLoading: false,
      });
      throw error;
    }
  },

  removeTrigger: async (pipelineId: string, triggerId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteTrigger(pipelineId, triggerId);
      set((state) => ({
        triggers: state.triggers.filter((t) => t.id !== triggerId),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to delete trigger',
        isLoading: false,
      });
      throw error;
    }
  },

  // ============================================
  // STATISTICS
  // ============================================

  fetchStatistics: async (pipelineId: string) => {
    set({ isLoading: true, error: null });
    try {
      const statistics = await api.getPipelineStatistics(pipelineId);
      set({ statistics, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || error.message || 'Failed to fetch statistics',
        isLoading: false,
      });
    }
  },

  // ============================================
  // UTILITY
  // ============================================

  clearError: () => set({ error: null }),

  setSelectedPipeline: (pipeline: api.Pipeline | null) => set({ selectedPipeline: pipeline }),

  setSelectedRun: (run: api.PipelineRun | null) => set({ selectedRun: run }),
}));

export default usePipelineStore;