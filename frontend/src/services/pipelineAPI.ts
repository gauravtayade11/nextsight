// services/pipelineAPI.ts
// Pipeline API - Real backend integration

import api from '../utils/axios';
import { pipelineLogger as logger } from '../utils/logger';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  branch: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  lastRun: string;
  duration: string;
  trigger: string;
  successRate: number;
  yaml?: string;
  repository?: string;
  provider?: string;
  execution_mode?: 'local' | 'kubernetes' | 'agent';
  executionMode?: 'local' | 'kubernetes' | 'agent';
  createdAt: string;
  updatedAt: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineName?: string;
  status: 'success' | 'failed' | 'running' | 'pending' | 'cancelled';
  branch: string;
  commit: string;
  trigger: string;
  startedAt: string;
  completedAt?: string;
  duration: string;
  stages: Stage[];
  artifacts?: Artifact[];
  triggeredBy?: string;
}

export interface Stage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: string;
  logs?: string[];
  requiresApproval?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  requiredApprovers?: number;
  approverRoles?: string[];
}

export interface Artifact {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
}

export interface Variable {
  id: string;
  name: string;
  value: string;
  scope: 'global' | 'pipeline' | 'stage';
  environment?: string;
  pipelineId?: string;
}

export interface Secret {
  id: string;
  name: string;
  scope: 'global' | 'pipeline' | 'stage';
  masked: boolean;
  pipelineId?: string;
}

export interface Trigger {
  id: string;
  pipelineId: string;
  type: 'push' | 'pull_request' | 'tag' | 'schedule' | 'manual';
  branches?: string[];
  tags?: string[];
  paths?: string[];
  schedule?: string;
  events?: string[];
  enabled: boolean;
}

export interface PipelineStatistics {
  trends: Array<{
    date: string;
    success_count: number;
    failed_count: number;
    avg_duration: number;
  }>;
  successRate: number;
  avgDuration: number;
  totalRuns: number;
  stageBottlenecks: Array<{
    stage: string;
    avgTime: number;
  }>;
}

export interface CreatePipelineRequest {
  name: string;
  description: string;
  branch?: string;
  yaml?: string;
  repository?: string;
  provider?: string;
  templateId?: string;
  execution_mode?: 'local' | 'kubernetes' | 'agent';
}

export interface UpdatePipelineRequest {
  name?: string;
  description?: string;
  branch?: string;
  yaml?: string;
}

// Note: All mock data has been removed. This service now uses only real backend API.

// ============================================
// HELPER FUNCTIONS
// ============================================

// Transform backend response to frontend format
function transformPipeline(backendPipeline: any): Pipeline {
  // Handle both snake_case and camelCase from backend
  // Ensure name has a proper fallback - use ID if name is missing
  const name = backendPipeline.name || backendPipeline.id || 'Unnamed Pipeline';

  return {
    id: backendPipeline.id,
    name,
    description: backendPipeline.description || '',
    branch: backendPipeline.branch || 'main',
    status: (backendPipeline.status || backendPipeline.last_run_status || 'pending').toLowerCase(),
    lastRun: backendPipeline.lastRun || backendPipeline.last_run_at || 'Never',
    duration: backendPipeline.duration || backendPipeline.last_run_duration || '-',
    trigger: backendPipeline.trigger || 'manual',
    successRate: backendPipeline.successRate || backendPipeline.success_rate || 0,
    yaml: backendPipeline.yaml || backendPipeline.yaml_config, // Handle both field names
    repository: backendPipeline.repository,
    provider: backendPipeline.provider,
    execution_mode: backendPipeline.execution_mode,
    executionMode: backendPipeline.execution_mode || backendPipeline.executionMode,
    createdAt: backendPipeline.createdAt || backendPipeline.created_at,
    updatedAt: backendPipeline.updatedAt || backendPipeline.updated_at,
  };
}

function transformPipelineRun(backendRun: any): PipelineRun {
  // Handle both dict and object responses
  const run = backendRun || {};
  
  // Extract stages - handle various formats
  let stages: Stage[] = [];
  if (run.stages && Array.isArray(run.stages)) {
    stages = run.stages.map((s: any) => {
      const stage = typeof s === 'object' ? s : {};
      return {
        id: stage.id || stage.stage_id || String(Math.random()),
        name: stage.name || stage.stage_name || 'Unknown',
        status: (stage.status || 'pending')?.toLowerCase() || 'pending',
        startedAt: stage.started_at || stage.startedAt,
        completedAt: stage.finished_at || stage.completed_at || stage.finishedAt || stage.completedAt,
        duration: stage.duration_seconds ? `${Math.round(stage.duration_seconds)}s` : (stage.duration || '-'),
        logs: stage.logs ? (Array.isArray(stage.logs) ? stage.logs : [stage.logs]) : [],
        requiresApproval: stage.requiresApproval || stage.requires_approval || false,
        approvalStatus: stage.approvalStatus || stage.approval_status,
        requiredApprovers: stage.requiredApprovers || stage.required_approvers || 1,
        approverRoles: stage.approverRoles || stage.approver_roles || [],
      };
    });
  }

  // Calculate duration
  let duration = backendRun.duration || '-';
  if (backendRun.started_at && backendRun.finished_at) {
    const start = new Date(backendRun.started_at);
    const end = new Date(backendRun.finished_at);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  return {
    id: backendRun.id,
    pipelineId: backendRun.pipeline_id,
    pipelineName: backendRun.pipeline_name,
    status: backendRun.status?.toLowerCase() || 'pending',
    branch: backendRun.branch || 'main',
    commit: backendRun.commit_sha || backendRun.commit || '',
    trigger: backendRun.triggered_by || 'manual',
    startedAt: backendRun.started_at,
    completedAt: backendRun.finished_at,
    duration,
    stages,
    artifacts: backendRun.artifacts || [],
    triggeredBy: backendRun.triggered_by,
  };
}

// ============================================
// PIPELINE CRUD
// ============================================

export const getPipelines = async (): Promise<Pipeline[]> => {
  try {
    const response = await api.get('/pipelines');
    const pipelines = response.data.pipelines || response.data || [];
    return pipelines.map(transformPipeline);
  } catch (error: any) {
    logger.error('Failed to fetch pipelines', error);
    throw error;
  }
};

export const getPipeline = async (id: string): Promise<Pipeline> => {
  try {
    const response = await api.get(`/pipelines/${id}`);
    if (!response.data) {
      throw new Error(`Pipeline ${id} not found - no data returned`);
    }
    return transformPipeline(response.data);
  } catch (error: any) {
    logger.error('Failed to fetch pipeline', error);
    if (error.response?.status === 404) {
      throw new Error(`Pipeline ${id} not found`);
    }
    throw error;
  }
};

export const createPipeline = async (data: CreatePipelineRequest): Promise<Pipeline> => {
  try {
    const payload = {
      name: data.name,
      description: data.description,
      repository: data.repository || '',
      branch: data.branch || 'main',
      file_path: '.nextsight/pipeline.yaml',
      provider: data.provider || 'manual',
      is_active: true,
      tags: [],
      yaml: data.yaml,
    };
    const response = await api.post('/pipelines', payload);
    return transformPipeline(response.data);
  } catch (error: any) {
    logger.error('Failed to create pipeline', error);
    throw error;
  }
};

export const updatePipeline = async (id: string, data: UpdatePipelineRequest): Promise<Pipeline> => {
  try {
    const response = await api.patch(`/pipelines/${id}`, data);
    return transformPipeline(response.data);
  } catch (error: any) {
    logger.error('Failed to update pipeline', error);
    throw error;
  }
};

export const deletePipeline = async (id: string): Promise<void> => {
  try {
    await api.delete(`/pipelines/${id}`);
  } catch (error: any) {
    logger.error('Failed to delete pipeline', error);
    throw error;
  }
};

// ============================================
// PIPELINE RUNS
// ============================================

export const getPipelineRuns = async (pipelineId: string): Promise<PipelineRun[]> => {
  try {
    const response = await api.get(`/pipelines/${pipelineId}/runs`);
    const runs = response.data.runs || response.data || [];
    return runs.map(transformPipelineRun);
  } catch (error: any) {
    logger.error('Failed to fetch pipeline runs', error);
    throw error;
  }
};

export const getPipelineRun = async (pipelineId: string, runId: string): Promise<PipelineRun> => {
  try {
    const response = await api.get(`/pipelines/${pipelineId}/runs/${runId}`);
    if (!response.data) {
      throw new Error(`Run ${runId} not found - no data returned`);
    }
    return transformPipelineRun(response.data);
  } catch (error: any) {
    logger.error('Failed to fetch pipeline run', error);
    throw error;
  }
};

export const triggerPipeline = async (pipelineId: string, branch?: string): Promise<PipelineRun> => {
  try {
    const response = await api.post(`/pipelines/${pipelineId}/runs`, {
      pipeline_id: pipelineId,
      branch: branch || 'main',
      variables: {},
      dry_run: false,
    });
    return transformPipelineRun(response.data);
  } catch (error: any) {
    logger.error('Failed to trigger pipeline', error);
    throw error;
  }
};

export const retryRun = async (pipelineId: string, runId: string): Promise<PipelineRun> => {
  try {
    const response = await api.post(`/pipelines/${pipelineId}/runs/${runId}/retry`);
    return transformPipelineRun(response.data);
  } catch (error: any) {
    logger.error('Failed to retry run', error);
    throw error;
  }
};

export const cancelRun = async (pipelineId: string, runId: string): Promise<void> => {
  try {
    await api.post(`/pipelines/${pipelineId}/runs/${runId}/cancel`);
  } catch (error: any) {
    logger.error('Failed to cancel run', error);
    throw error;
  }
};

// ============================================
// LOGS
// ============================================

export const getRunLogs = async (
  pipelineId: string,
  runId: string,
  stageId?: string
): Promise<string[]> => {
  try {
    const params: Record<string, string> = {};
    if (stageId) params.stage_id = stageId;

    const response = await api.get(`/pipelines/${pipelineId}/runs/${runId}/logs`, { params });
    const logData = response.data;

    // Handle different response formats
    if (Array.isArray(logData.logs)) {
      return logData.logs.map((l: any) =>
        typeof l === 'string' ? l : `[${l.timestamp}] ${l.stage}: ${l.message}`
      );
    }
    if (typeof logData.logs === 'string') {
      return logData.logs.split('\n');
    }
    return [];
  } catch (error: any) {
    logger.error('Failed to fetch logs', error);
    throw error;
  }
};

// Stream logs via SSE
export const streamRunLogs = (
  pipelineId: string,
  runId: string,
  onLog: (log: string) => void,
  onError?: (error: any) => void
): (() => void) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
  // Get auth token for query parameter (EventSource doesn't support custom headers)
  const token = localStorage.getItem("nextsight_token") || 
                localStorage.getItem("access_token") || 
                localStorage.getItem("token");
  const url = `${baseUrl}/pipelines/${pipelineId}/runs/${runId}/logs/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onLog(data.message || data);
    } catch {
      onLog(event.data);
    }
  };

  eventSource.onerror = (error) => {
    if (onError) onError(error);
    eventSource.close();
  };

  // Return cleanup function
  return () => eventSource.close();
};

// ============================================
// YAML EDITOR
// ============================================

export const getPipelineYaml = async (pipelineId: string): Promise<string> => {
  try {
    const response = await api.get(`/pipelines/${pipelineId}/yaml`);
    return response.data.yaml || response.data || '';
  } catch (error: any) {
    logger.error('Failed to fetch YAML', error);
    // Return default YAML if not found
    return `name: my-pipeline
description: A new pipeline

triggers:
  - push:
      branches: [main]

stages:
  - name: Build
    steps:
      - run: echo "Building..."

  - name: Test
    steps:
      - run: echo "Testing..."

  - name: Deploy
    needs: [Build, Test]
    steps:
      - run: echo "Deploying..."
`;
  }
};

export const updatePipelineYaml = async (pipelineId: string, yaml: string): Promise<void> => {
  try {
    await api.put(`/pipelines/${pipelineId}/yaml`, { yaml });
  } catch (error: any) {
    logger.error('Failed to update YAML', error);
    throw error;
  }
};

// ============================================
// VARIABLES
// ============================================

export const getVariables = async (pipelineId?: string): Promise<Variable[]> => {
  try {
    const params = pipelineId ? { pipeline_id: pipelineId } : {};
    const response = await api.get('/pipelines/variables', { params });
    return response.data.variables || response.data || [];
  } catch (error: any) {
    logger.error('Failed to fetch variables', error);
    return [];
  }
};

export const createVariable = async (
  variable: Omit<Variable, 'id'>,
  pipelineId?: string
): Promise<Variable> => {
  try {
    const payload = { ...variable, pipeline_id: pipelineId };
    const response = await api.post('/pipelines/variables', payload);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to create variable', error);
    throw error;
  }
};

export const updateVariable = async (
  id: string,
  variable: Partial<Variable>,
  pipelineId?: string
): Promise<Variable> => {
  try {
    const response = await api.patch(`/pipelines/variables/${id}`, variable);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to update variable', error);
    throw error;
  }
};

export const deleteVariable = async (id: string, pipelineId?: string): Promise<void> => {
  try {
    await api.delete(`/pipelines/variables/${id}`);
  } catch (error: any) {
    logger.error('Failed to delete variable', error);
    throw error;
  }
};

// ============================================
// SECRETS
// ============================================

export const getSecrets = async (pipelineId?: string): Promise<Secret[]> => {
  try {
    const params = pipelineId ? { pipeline_id: pipelineId } : {};
    const response = await api.get('/pipelines/secrets', { params });
    return response.data.secrets || response.data || [];
  } catch (error: any) {
    logger.error('Failed to fetch secrets', error);
    return [];
  }
};

export const createSecret = async (
  secret: Omit<Secret, 'id'> & { value: string },
  pipelineId?: string
): Promise<Secret> => {
  try {
    const payload = { ...secret, pipeline_id: pipelineId };
    const response = await api.post('/pipelines/secrets', payload);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to create secret', error);
    throw error;
  }
};

export const updateSecret = async (
  id: string,
  secret: { value?: string; scope?: string },
  pipelineId?: string
): Promise<Secret> => {
  try {
    const response = await api.patch(`/pipelines/secrets/${id}`, secret);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to update secret', error);
    throw error;
  }
};

export const deleteSecret = async (id: string, pipelineId?: string): Promise<void> => {
  try {
    await api.delete(`/pipelines/secrets/${id}`);
  } catch (error: any) {
    logger.error('Failed to delete secret', error);
    throw error;
  }
};

// ============================================
// TRIGGERS
// ============================================

export const getTriggers = async (pipelineId: string): Promise<Trigger[]> => {
  try {
    const response = await api.get(`/pipelines/${pipelineId}/triggers`);
    return response.data.triggers || response.data || [];
  } catch (error: any) {
    logger.error('Failed to fetch triggers', error);
    return [];
  }
};

export const createTrigger = async (
  pipelineId: string,
  trigger: Omit<Trigger, 'id' | 'pipelineId'>
): Promise<Trigger> => {
  try {
    const response = await api.post(`/pipelines/${pipelineId}/triggers`, trigger);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to create trigger', error);
    throw error;
  }
};

export const updateTrigger = async (
  pipelineId: string,
  triggerId: string,
  trigger: Partial<Trigger>
): Promise<Trigger> => {
  try {
    const response = await api.patch(`/pipelines/${pipelineId}/triggers/${triggerId}`, trigger);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to update trigger', error);
    throw error;
  }
};

export const deleteTrigger = async (pipelineId: string, triggerId: string): Promise<void> => {
  try {
    await api.delete(`/pipelines/${pipelineId}/triggers/${triggerId}`);
  } catch (error: any) {
    logger.error('Failed to delete trigger', error);
    throw error;
  }
};

// ============================================
// STATISTICS
// ============================================

export const getPipelineStatistics = async (pipelineId: string): Promise<PipelineStatistics> => {
  try {
    const response = await api.get(`/pipelines/${pipelineId}/statistics`);
    const stats = response.data;

    return {
      trends: stats.trends || stats.last_30_days_stats?.trends || [],
      successRate: stats.success_rate * 100 || stats.successRate || 0,
      avgDuration: stats.average_duration_seconds || stats.avgDuration || 0,
      totalRuns: stats.total_runs || stats.totalRuns || 0,
      stageBottlenecks: stats.stage_bottlenecks || stats.stageBottlenecks || [],
    };
  } catch (error: any) {
    logger.error('Failed to fetch statistics', error);
    throw error;
  }
};

// ============================================
// AI ASSISTANT
// ============================================

export const aiChatPipeline = async (pipelineId: string, message: string): Promise<string> => {
  try {
    const response = await api.post(`/pipelines/${pipelineId}/ai/chat`, { message });
    return response.data.response || response.data;
  } catch (error: any) {
    logger.error('AI chat failed', error);
    throw error;
  }
};

export const aiOptimizePipeline = async (pipelineId: string): Promise<{ suggestions: string[] }> => {
  try {
    const response = await api.post(`/pipelines/${pipelineId}/ai/optimize`);
    return response.data;
  } catch (error: any) {
    logger.error('AI optimize failed', error);
    throw error;
  }
};

export const aiAnalyzeFailure = async (
  pipelineId: string,
  runId: string
): Promise<{ summary: string; suggestion: string }> => {
  try {
    const response = await api.post(`/pipelines/${pipelineId}/runs/${runId}/ai/analyze`);
    return response.data;
  } catch (error: any) {
    logger.error('AI analyze failed', error);
    throw error;
  }
};

export const aiGenerateFix = async (
  pipelineId: string,
  runId: string
): Promise<{ fix: string; success: boolean }> => {
  try {
    const response = await api.post(`/pipelines/${pipelineId}/runs/${runId}/ai/fix`);
    return response.data;
  } catch (error: any) {
    logger.error('AI fix generation failed', error);
    throw error;
  }
};

// ============================================
// WEBHOOKS
// ============================================

export interface Webhook {
  id: string;
  name: string;
  type: 'incoming' | 'outgoing';
  url: string;
  secret?: string;
  events: string[];
  service?: 'slack' | 'discord' | 'teams' | 'custom';
  enabled: boolean;
  lastTriggered?: string;
  lastStatus?: 'success' | 'failed';
}

export const getWebhooks = async (pipelineId: string): Promise<Webhook[]> => {
  try {
    const response = await api.get(`/pipelines/${pipelineId}/webhooks`);
    return response.data.webhooks || response.data || [];
  } catch (error: any) {
    logger.error('Failed to fetch webhooks', error);
    return [];
  }
};

export const createWebhook = async (
  pipelineId: string,
  webhook: Omit<Webhook, 'id'>
): Promise<Webhook> => {
  try {
    const response = await api.post(`/pipelines/${pipelineId}/webhooks`, webhook);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to create webhook', error);
    throw error;
  }
};

export const updateWebhook = async (
  pipelineId: string,
  webhookId: string,
  webhook: Partial<Webhook>
): Promise<Webhook> => {
  try {
    const response = await api.patch(`/pipelines/${pipelineId}/webhooks/${webhookId}`, webhook);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to update webhook', error);
    throw error;
  }
};

export const deleteWebhook = async (pipelineId: string, webhookId: string): Promise<void> => {
  try {
    await api.delete(`/pipelines/${pipelineId}/webhooks/${webhookId}`);
  } catch (error: any) {
    logger.error('Failed to delete webhook', error);
    throw error;
  }
};

export const testWebhook = async (pipelineId: string, webhookId: string): Promise<boolean> => {
  try {
    const response = await api.post(`/pipelines/${pipelineId}/webhooks/${webhookId}/test`);
    return response.data.success;
  } catch (error: any) {
    logger.error('Failed to test webhook', error);
    return false;
  }
};

export const getWebhookUrl = async (pipelineId: string): Promise<{ url: string; secret: string }> => {
  try {
    const response = await api.get(`/pipelines/${pipelineId}/webhook-url`);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to get webhook URL', error);
    throw error;
  }
};

// ============================================
// GITHUB INTEGRATION
// ============================================

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  description?: string;
  url: string;
  default_branch: string;
  private: boolean;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
}

export const getGitHubRepos = async (): Promise<GitHubRepo[]> => {
  try {
    const response = await api.get('/pipelines/github/repos');
    return response.data.repositories || [];
  } catch (error: any) {
    logger.error('Failed to fetch GitHub repos', error);
    throw error;
  }
};

export const getGitHubBranches = async (owner: string, repo: string): Promise<GitHubBranch[]> => {
  try {
    const response = await api.get(`/pipelines/github/repos/${owner}/${repo}/branches`);
    return response.data.branches || [];
  } catch (error: any) {
    logger.error('Failed to fetch GitHub branches', error);
    throw error;
  }
};

export const createGitHubWebhook = async (
  owner: string,
  repo: string
): Promise<{ webhook_id: number; webhook_url: string; secret: string }> => {
  try {
    const response = await api.post(`/pipelines/github/repos/${owner}/${repo}/webhook`);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to create GitHub webhook', error);
    throw error;
  }
};

export const getGitHubPipelineFile = async (
  owner: string,
  repo: string,
  ref?: string
): Promise<{ found: boolean; content?: string }> => {
  try {
    const params = ref ? { ref } : {};
    const response = await api.get(`/pipelines/github/repos/${owner}/${repo}/pipeline-file`, { params });
    return response.data;
  } catch (error: any) {
    logger.error('Failed to fetch pipeline file', error);
    return { found: false };
  }
};

// ============================================
// WEBSOCKET SUBSCRIPTIONS
// ============================================

export const subscribeToLogs = (
  pipelineId: string,
  runId: string,
  stageId: string,
  onLog: (log: string) => void
): WebSocket => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}`;
  const wsUrl = `${wsHost}/api/v1/pipelines/${pipelineId}/runs/${runId}/logs/ws?stage_id=${stageId}`;

  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onLog(data.message || data.log || event.data);
    } catch {
      onLog(event.data);
    }
  };

  return ws;
};

export const subscribeToPipelineStatus = (
  pipelineId: string,
  onStatus: (status: any) => void
): WebSocket => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}`;
  const wsUrl = `${wsHost}/api/v1/pipelines/${pipelineId}/status/ws`;

  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onStatus(data);
    } catch {
      logger.error('Failed to parse pipeline status', event.data);
    }
  };

  return ws;
};

// ============================================
// APPROVALS
// ============================================

export interface Approval {
  id: string;
  stageId: string;
  runId: string;
  status: 'pending' | 'approved' | 'rejected';
  approverUsername?: string;
  approverEmail?: string;
  approverRole?: string;
  comment?: string;
  expiresAt?: string;
  environment?: string;
  deploymentTarget?: string;
  isProduction: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getStageApprovals = async (
  pipelineId: string,
  runId: string,
  stageId: string
): Promise<Approval[]> => {
  try {
    const response = await api.get(
      `/pipelines/${pipelineId}/runs/${runId}/stages/${stageId}/approvals`
    );
    return response.data || [];
  } catch (error: any) {
    logger.error('Failed to fetch approvals', error);
    return [];
  }
};

export const approveStage = async (
  pipelineId: string,
  runId: string,
  stageId: string,
  comment?: string
): Promise<Approval> => {
  try {
    const response = await api.post(
      `/pipelines/${pipelineId}/runs/${runId}/stages/${stageId}/approve`,
      { comment }
    );
    return response.data;
  } catch (error: any) {
    logger.error('Failed to approve stage', error);
    throw error;
  }
};

export const rejectStage = async (
  pipelineId: string,
  runId: string,
  stageId: string,
  comment?: string
): Promise<Approval> => {
  try {
    const response = await api.post(
      `/pipelines/${pipelineId}/runs/${runId}/stages/${stageId}/reject`,
      { comment: comment || 'Deployment rejected' }
    );
    return response.data;
  } catch (error: any) {
    logger.error('Failed to reject stage', error);
    throw error;
  }
};

export interface PendingApproval {
  stageId: string;
  stageName: string;
  runId: string;
  pipelineId?: string;
  pipelineName?: string;
  environment?: string;
  requiredApprovers: number;
  currentApprovals: number;
  approverRoles: string[];
  branch?: string;
  commit?: string;
}

export const getPendingApprovals = async (): Promise<PendingApproval[]> => {
  try {
    const response = await api.get('/pipelines/approvals/pending');
    return response.data.pendingApprovals || [];
  } catch (error: any) {
    logger.error('Failed to fetch pending approvals', error);
    return [];
  }
};

// ============================================
// DEFAULT EXPORT
// ============================================

const pipelineAPI = {
  // Pipeline CRUD
  getPipelines,
  getPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  // Pipeline Runs
  getPipelineRuns,
  getPipelineRun,
  triggerPipeline,
  retryRun,
  cancelRun,
  // Logs
  getRunLogs,
  streamRunLogs,
  // YAML
  getPipelineYaml,
  updatePipelineYaml,
  // Variables
  getVariables,
  createVariable,
  updateVariable,
  deleteVariable,
  // Secrets
  getSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
  // Triggers
  getTriggers,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  // Statistics
  getPipelineStatistics,
  // AI
  aiChatPipeline,
  aiOptimizePipeline,
  aiAnalyzeFailure,
  aiGenerateFix,
  // Webhooks
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookUrl,
  // GitHub
  getGitHubRepos,
  getGitHubBranches,
  createGitHubWebhook,
  getGitHubPipelineFile,
  // WebSocket
  subscribeToLogs,
  subscribeToPipelineStatus,
  // Approvals
  getStageApprovals,
  approveStage,
  rejectStage,
  getPendingApprovals,
};

export default pipelineAPI;
