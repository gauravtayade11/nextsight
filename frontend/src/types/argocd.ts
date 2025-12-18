// ArgoCD Types

export type ArgoCDHealthStatus = 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
export type ArgoCDSyncStatus = 'Synced' | 'OutOfSync' | 'Unknown';
export type ArgoCDOperationPhase = 'Running' | 'Succeeded' | 'Failed' | 'Error' | 'Terminating';

export interface ArgoCDConfig {
  serverUrl: string;
  token?: string;
  username?: string;
  password?: string;
  insecure?: boolean;
}

export interface ArgoCDStatus {
  connected: boolean;
  serverUrl?: string;
  version?: string;
  message?: string;
}

export interface ArgoCDResourceStatus {
  group?: string;
  version: string;
  kind: string;
  namespace?: string;
  name: string;
  status?: string;
  health?: ArgoCDHealthStatus;
  hook?: boolean;
  requiresPruning?: boolean;
}

export interface ArgoCDApplicationSource {
  repoURL: string;
  path?: string;
  targetRevision: string;
  chart?: string;
  helm?: Record<string, unknown>;
  kustomize?: Record<string, unknown>;
  directory?: Record<string, unknown>;
}

export interface ArgoCDApplicationDestination {
  server: string;
  namespace: string;
  name?: string;
}

export interface ArgoCDSyncPolicy {
  automated?: {
    selfHeal?: boolean;
    prune?: boolean;
  };
  syncOptions?: string[];
  retry?: Record<string, unknown>;
}

export interface ArgoCDHealthInfo {
  status: ArgoCDHealthStatus;
  message?: string;
}

export interface ArgoCDSyncInfo {
  status: ArgoCDSyncStatus;
  revision?: string;
  comparedTo?: Record<string, unknown>;
}

export interface ArgoCDOperationState {
  phase: ArgoCDOperationPhase;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
  syncResult?: Record<string, unknown>;
}

export interface ArgoCDApplicationSpec {
  source: ArgoCDApplicationSource;
  destination: ArgoCDApplicationDestination;
  project: string;
  syncPolicy?: ArgoCDSyncPolicy;
}

export interface ArgoCDApplicationStatus {
  health: ArgoCDHealthInfo;
  sync: ArgoCDSyncInfo;
  operationState?: ArgoCDOperationState;
  resources: ArgoCDResourceStatus[];
  summary?: Record<string, unknown>;
  conditions?: Array<Record<string, unknown>>;
}

export interface ArgoCDApplication {
  name: string;
  namespace: string;
  project: string;
  spec: ArgoCDApplicationSpec;
  status: ArgoCDApplicationStatus;
  createdAt?: string;
}

export interface ArgoCDApplicationSummary {
  name: string;
  namespace: string;
  project: string;
  repoURL: string;
  path?: string;
  targetRevision: string;
  destServer: string;
  destNamespace: string;
  healthStatus: ArgoCDHealthStatus;
  syncStatus: ArgoCDSyncStatus;
  syncRevision?: string;
  createdAt?: string;
}

export interface ArgoCDApplicationListResponse {
  applications: ArgoCDApplicationSummary[];
  total: number;
}

export interface ArgoCDSyncRequest {
  revision?: string;
  dryRun?: boolean;
  prune?: boolean;
  force?: boolean;
  strategy?: Record<string, unknown>;
  resources?: Array<Record<string, string>>;
}

export interface ArgoCDSyncResult {
  success: boolean;
  message: string;
  revision?: string;
  resources: ArgoCDResourceStatus[];
}

export interface ArgoCDRollbackRequest {
  id: number;
  dryRun?: boolean;
  prune?: boolean;
}

export interface ArgoCDRevisionHistory {
  id: number;
  revision: string;
  deployedAt?: string;
  source: ArgoCDApplicationSource;
  deployStartedAt?: string;
}

export interface ArgoCDRevisionHistoryResponse {
  history: ArgoCDRevisionHistory[];
}

export interface ArgoCDCreateApplicationRequest {
  name: string;
  project?: string;
  repoURL: string;
  path?: string;
  targetRevision?: string;
  chart?: string;
  destServer: string;
  destNamespace: string;
  autoSync?: boolean;
  selfHeal?: boolean;
  prune?: boolean;
  helmValues?: Record<string, unknown>;
}

export interface ArgoCDApplicationEvent {
  type: string;
  reason: string;
  message: string;
  firstTimestamp?: string;
  lastTimestamp?: string;
  count: number;
}

export interface ArgoCDApplicationEventsResponse {
  events: ArgoCDApplicationEvent[];
}

export interface ArgoCDProjectSummary {
  name: string;
  description?: string;
  sourceRepos: string[];
  destinations: Array<{ server: string; namespace: string }>;
}

export interface ArgoCDProjectListResponse {
  projects: ArgoCDProjectSummary[];
}

// ArgoCD Deployment types
export interface ArgoCDDeployRequest {
  namespace?: string;
  release_name?: string;
  version?: string;
  expose_type?: 'ClusterIP' | 'LoadBalancer' | 'NodePort';
  admin_password?: string;
  ha_enabled?: boolean;
  insecure?: boolean;
  values?: Record<string, unknown>;
}

export interface ArgoCDDeploymentStatus {
  deployed: boolean;
  release_name?: string;
  namespace?: string;
  status?: string;
  chart_version?: string;
  app_version?: string;
  server_url?: string;
  updated?: string;
  message?: string;
  error?: string;
}

export interface ArgoCDDeployResult {
  success: boolean;
  message: string;
  release_name?: string;
  namespace?: string;
  server_url?: string;
  admin_username?: string;
  admin_password?: string;
  chart_version?: string;
  notes?: string;
}
