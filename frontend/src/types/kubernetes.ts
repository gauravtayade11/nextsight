// Kubernetes Core Types

export interface Namespace {
  name: string;
  status: string;
  created_at?: string;
  labels: Record<string, string>;
}

export interface NamespaceDetail {
  name: string;
  status: string;
  created_at?: string;
  labels: Record<string, string>;
  age: string;
  pods: number;
  deployments: number;
  services: number;
  configmaps: number;
  secrets: number;
}

export interface NamespaceCreateRequest {
  name: string;
  labels?: Record<string, string>;
}

export interface Pod {
  name: string;
  namespace: string;
  status: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
  ready: boolean;
  restarts: number;
  age: string;
  node?: string;
  ip?: string;
  containers: string[];
}

export interface Deployment {
  name: string;
  namespace: string;
  replicas: number;
  ready_replicas: number;
  available_replicas: number;
  image?: string;
  age: string;
  labels: Record<string, string>;
}

export interface K8sEvent {
  name: string;
  namespace: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  first_timestamp?: string;
  last_timestamp?: string;
  involved_object: Record<string, string>;
}

export interface ClusterHealth {
  healthy: boolean;
  node_count: number;
  ready_nodes: number;
  total_pods: number;
  running_pods: number;
  namespaces: number;
  warnings: string[];
}

// Node types
export interface NodeCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface NodeResources {
  cpu: string;
  memory: string;
  pods: string;
  storage?: string;
}

export interface NodeInfo {
  name: string;
  status: string;
  roles: string[];
  age: string;
  version: string;
  os_image: string;
  kernel_version: string;
  container_runtime: string;
  internal_ip?: string;
  external_ip?: string;
  conditions: NodeCondition[];
  capacity: NodeResources;
  allocatable: NodeResources;
  labels: Record<string, string>;
  taints: Array<{ key: string; value: string; effect: string }>;
}

// Metrics types
export interface ContainerMetrics {
  name: string;
  cpu_usage: string;
  cpu_percent: number;
  memory_usage: string;
  memory_percent: number;
}

export interface PodMetrics {
  name: string;
  namespace: string;
  containers: ContainerMetrics[];
  total_cpu: string;
  total_memory: string;
  timestamp: string;
}

export interface NodeMetrics {
  name: string;
  cpu_usage: string;
  cpu_percent: number;
  memory_usage: string;
  memory_percent: number;
  timestamp: string;
}

export interface ClusterMetrics {
  total_cpu_capacity: string;
  total_cpu_usage: string;
  cpu_percent: number;
  total_memory_capacity: string;
  total_memory_usage: string;
  memory_percent: number;
  nodes: NodeMetrics[];
  timestamp: string;
}

// Pod Logs types
export interface PodLogs {
  namespace: string;
  pod_name: string;
  container: string;
  logs: string;
  truncated: boolean;
}

// Pod Exec types
export interface PodExecResult {
  namespace: string;
  pod_name: string;
  container: string;
  command: string[];
  stdout: string;
  stderr: string;
  exit_code: number;
}

// Service types
export interface K8sService {
  name: string;
  namespace: string;
  type: string;
  cluster_ip?: string;
  external_ip?: string;
  ports: Array<{ port: number; targetPort: number; protocol: string; nodePort?: number }>;
}

export interface ServicePort {
  name?: string;
  port: number;
  target_port: number;
  protocol: string;
  node_port?: number;
}

export interface ServiceCreateRequest {
  name: string;
  namespace: string;
  type: string;
  selector: Record<string, string>;
  ports: ServicePort[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ServiceUpdateRequest {
  type?: string;
  selector?: Record<string, string>;
  ports?: ServicePort[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

// Ingress types
export interface IngressRule {
  host?: string;
  paths: Array<{ path: string; pathType: string; backend: string }>;
}

export interface Ingress {
  name: string;
  namespace: string;
  class_name?: string;
  hosts: string[];
  address?: string;
  rules: IngressRule[];
  tls: Array<{ hosts: string[]; secretName: string }>;
  age: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export interface IngressPath {
  path: string;
  path_type: string;
  service_name: string;
  service_port: number;
}

export interface IngressRuleSpec {
  host?: string;
  paths: IngressPath[];
}

export interface IngressTLSSpec {
  hosts: string[];
  secret_name?: string;
}

export interface IngressCreateRequest {
  name: string;
  namespace: string;
  ingress_class_name?: string;
  rules: IngressRuleSpec[];
  tls?: IngressTLSSpec[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface IngressUpdateRequest {
  ingress_class_name?: string;
  rules?: IngressRuleSpec[];
  tls?: IngressTLSSpec[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ResourceDeleteResponse {
  success: boolean;
  message: string;
  kind: string;
  name: string;
  namespace: string;
}

// ConfigMap types
export interface ConfigMap {
  name: string;
  namespace: string;
  data_keys: string[];
  data_count: number;
  age: string;
  labels: Record<string, string>;
}

export interface ConfigMapDetail {
  name: string;
  namespace: string;
  data: Record<string, string>;
  binary_data_keys: string[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  created_at?: string;
}

export interface ConfigMapCreateRequest {
  name: string;
  namespace: string;
  data: Record<string, string>;
  labels?: Record<string, string>;
}

export interface ConfigMapUpdateRequest {
  data: Record<string, string>;
  labels?: Record<string, string>;
}

// Secret types
export interface Secret {
  name: string;
  namespace: string;
  type: string;
  data_keys: string[];
  data_count: number;
  age: string;
  labels: Record<string, string>;
}

export interface SecretDetail {
  name: string;
  namespace: string;
  type: string;
  data: Record<string, string>;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  created_at?: string;
}

export interface SecretCreateRequest {
  name: string;
  namespace: string;
  type?: string;
  data: Record<string, string>;
  labels?: Record<string, string>;
}

export interface SecretUpdateRequest {
  data: Record<string, string>;
  labels?: Record<string, string>;
}

// Storage types
export interface PVC {
  name: string;
  namespace: string;
  status: string;
  volume?: string;
  capacity?: string;
  access_modes: string[];
  storage_class?: string;
  age: string;
  labels: Record<string, string>;
}

export interface PVCCreateRequest {
  name: string;
  namespace: string;
  storage_class_name?: string;
  access_modes: string[];
  storage: string;
  volume_mode?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PVCUpdateRequest {
  storage?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PV {
  name: string;
  capacity: string;
  access_modes: string[];
  reclaim_policy: string;
  status: string;
  claim?: string;
  storage_class?: string;
  volume_mode?: string;
  age: string;
  labels: Record<string, string>;
}

export interface PVCreateRequest {
  name: string;
  capacity: string;
  access_modes: string[];
  reclaim_policy?: string;
  storage_class_name?: string;
  volume_mode?: string;
  host_path?: string;
  nfs_server?: string;
  nfs_path?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface StorageClass {
  name: string;
  provisioner: string;
  reclaim_policy: string;
  volume_binding_mode: string;
  allow_volume_expansion: boolean;
  is_default: boolean;
  parameters: Record<string, string>;
  age: string;
}

export interface StorageClassCreateRequest {
  name: string;
  provisioner: string;
  reclaim_policy?: string;
  volume_binding_mode?: string;
  allow_volume_expansion?: boolean;
  is_default?: boolean;
  parameters?: Record<string, string>;
  mount_options?: string[];
}

// Workload types
export interface StatefulSet {
  name: string;
  namespace: string;
  replicas: number;
  ready_replicas: number;
  current_replicas: number;
  image?: string;
  service_name?: string;
  age: string;
  labels: Record<string, string>;
}

export interface DaemonSet {
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  available: number;
  node_selector: Record<string, string>;
  image?: string;
  age: string;
  labels: Record<string, string>;
}

export interface Job {
  name: string;
  namespace: string;
  completions?: number;
  succeeded: number;
  failed: number;
  active: number;
  duration?: string;
  age: string;
  labels: Record<string, string>;
}

export interface CronJob {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  active: number;
  last_schedule?: string;
  age: string;
  labels: Record<string, string>;
}

export interface HPA {
  name: string;
  namespace: string;
  reference: string;
  min_replicas: number;
  max_replicas: number;
  current_replicas: number;
  target_cpu?: string;
  current_cpu?: string;
  target_memory?: string;
  current_memory?: string;
  age: string;
}

// YAML and Command types
export interface YAMLApplyRequest {
  yaml_content: string;
  namespace?: string;
  dry_run?: boolean;
}

export interface AppliedResource {
  kind: string;
  name: string;
  namespace?: string;
  action: string;
  message?: string;
}

export interface YAMLApplyResponse {
  success: boolean;
  message: string;
  resources: AppliedResource[];
  errors: string[];
  dry_run: boolean;
}

export interface ResourceYAMLRequest {
  kind: string;
  name: string;
  namespace?: string;
}

export interface ResourceYAMLResponse {
  success: boolean;
  kind: string;
  name: string;
  namespace?: string;
  yaml_content: string;
  error?: string;
}

export interface KubectlRequest {
  command: string;
  timeout?: number;
}

export interface KubectlResponse {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time: number;
}

export interface ShellRequest {
  command: string;
  timeout?: number;
  working_directory?: string;
}

export interface ShellResponse {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time: number;
  working_directory: string;
}
