// Cluster Management Types

export type ClusterStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

export interface ClusterInfo {
  id: string;
  name: string;
  context?: string;
  status: ClusterStatus;
  is_active: boolean;
  is_default: boolean;
  version?: string;
  platform?: string;
  node_count: number;
  namespace_count: number;
}

export interface ClusterListResponse {
  clusters: ClusterInfo[];
  active_cluster_id?: string;
  total: number;
}

export interface ClusterHealthInfo {
  cluster_id: string;
  healthy: boolean;
  status: ClusterStatus;
  node_count: number;
  ready_nodes: number;
  total_pods: number;
  running_pods: number;
  namespaces: number;
  warnings: string[];
  error?: string;
  checked_at: string;
}
