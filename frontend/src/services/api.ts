import api from '../utils/axios';
import type {
  Namespace, NamespaceDetail, NamespaceCreateRequest, Pod, Deployment, K8sEvent, ClusterHealth,
  Incident, IncidentAnalysis,
  TimelineEvent,
  Release, DeploymentStatus,
  SelfServiceAction, ServiceCatalogItem,
  JenkinsJob, JenkinsBuild,
  NodeInfo, NodeMetrics, PodMetrics, ClusterMetrics,
  PodLogs, PodExecResult,
  K8sService, Ingress, ConfigMap, ConfigMapDetail, ConfigMapCreateRequest, ConfigMapUpdateRequest,
  Secret, SecretDetail, SecretCreateRequest, SecretUpdateRequest,
  PVC, PVCCreateRequest, PVCUpdateRequest,
  PV, PVCreateRequest,
  StorageClass, StorageClassCreateRequest,
  ServiceCreateRequest, ServiceUpdateRequest,
  IngressCreateRequest, IngressUpdateRequest, ResourceDeleteResponse,
  StatefulSet, DaemonSet, Job, CronJob, HPA,
  YAMLApplyRequest, YAMLApplyResponse,
  ResourceYAMLRequest, ResourceYAMLResponse,
  KubectlRequest, KubectlResponse,
  ShellRequest, ShellResponse,
  ClusterInfo, ClusterListResponse, ClusterHealthInfo,
  User, LoginResponse, RefreshTokenResponse, PasswordChangeRequest, PasswordResetRequest,
  HelmRelease, HelmReleaseHistory, HelmReleaseValues,
  HelmChartInfo, HelmChartSearchResult,
  HelmInstallRequest, HelmUpgradeRequest, HelmOperationResult,
  HelmReleaseListResponse, HelmRepositoryListResponse,
  CostDashboardResponse, NamespaceCost, PodCost, CostTrend, CostRecommendation, ResourceEfficiency,
  ArgoCDConfig, ArgoCDStatus, ArgoCDApplication,
  ArgoCDApplicationListResponse, ArgoCDSyncRequest, ArgoCDSyncResult,
  ArgoCDRevisionHistoryResponse, ArgoCDRollbackRequest, ArgoCDCreateApplicationRequest,
  ArgoCDApplicationEventsResponse, ArgoCDProjectListResponse,
  ArgoCDDeployRequest, ArgoCDDeploymentStatus, ArgoCDDeployResult,
  OptimizationDashboardResponse, ClusterOptimizationSummary, NamespaceOptimization,
  OptimizationRecommendation, PodOptimization,
  ApplyOptimizationRequest, ApplyOptimizationResponse,
  AIOptimizationAnalysisRequest, AIOptimizationAnalysisResponse,
  SecurityDashboardResponse, SecurityPosture, SecurityFinding, SecurityScore,
  PodSecurityCheck, ComplianceCheck, ImageScanResult, RBACAnalysis, NetworkPolicyCoverage, SecurityTrends
} from '../types';

// Kubernetes API
export const kubernetesApi = {
  getHealth: () => api.get<ClusterHealth>('/kubernetes/health'),
  getNamespaces: () => api.get<Namespace[]>('/kubernetes/namespaces'),
  getNamespacesWithDetails: () => api.get<NamespaceDetail[]>('/kubernetes/namespaces/details'),
  createNamespace: (request: NamespaceCreateRequest) =>
    api.post<Namespace>('/kubernetes/namespaces', request),
  deleteNamespace: (name: string) =>
    api.delete(`/kubernetes/namespaces/${name}`),
  getPods: (namespace?: string) =>
    api.get<Pod[]>('/kubernetes/pods', { params: { namespace } }),
  getDeployments: (namespace?: string) =>
    api.get<Deployment[]>('/kubernetes/deployments', { params: { namespace } }),
  getDeployment: (namespace: string, name: string) =>
    api.get<Deployment>(`/kubernetes/deployments/${namespace}/${name}`),
  deleteDeployment: (namespace: string, name: string) =>
    api.delete<ResourceDeleteResponse>(`/kubernetes/deployments/${namespace}/${name}`),
  getEvents: (namespace?: string, limit = 100) =>
    api.get<K8sEvent[]>('/kubernetes/events', { params: { namespace, limit } }),
  getPodEvents: (namespace: string, podName: string) =>
    api.get<K8sEvent[]>(`/kubernetes/pods/${namespace}/${podName}/events`),
  getWorkloadEvents: (kind: string, namespace: string, name: string) =>
    api.get<K8sEvent[]>(`/kubernetes/workloads/${kind}/${namespace}/${name}/events`),
  scale: (namespace: string, deploymentName: string, replicas: number) =>
    api.post('/kubernetes/scale', { namespace, deployment_name: deploymentName, replicas }),
  restart: (namespace: string, deploymentName: string) =>
    api.post('/kubernetes/restart', { namespace, deployment_name: deploymentName }),
  deploy: (releaseId: string, environment: string, namespace: string, services: string[]) =>
    api.post<DeploymentStatus>('/kubernetes/deploy', {
      release_id: releaseId,
      environment,
      namespace,
      services,
    }),
  rollback: (deploymentId: string, reason: string, targetVersion?: string) =>
    api.post<DeploymentStatus>('/kubernetes/rollback', {
      deployment_id: deploymentId,
      target_version: targetVersion,
      reason,
    }),
  // Nodes
  getNodes: () => api.get<NodeInfo[]>('/kubernetes/nodes'),
  getNode: (name: string) => api.get<NodeInfo>(`/kubernetes/nodes/${name}`),
  getPodsOnNode: (nodeName: string) => api.get<Pod[]>(`/kubernetes/nodes/${nodeName}/pods`),
  // Metrics
  getClusterMetrics: () => api.get<ClusterMetrics>('/kubernetes/metrics'),
  getNodeMetrics: () => api.get<NodeMetrics[]>('/kubernetes/metrics/nodes'),
  getPodMetrics: (namespace?: string) =>
    api.get<PodMetrics[]>('/kubernetes/metrics/pods', { params: { namespace } }),
  // Logs
  getPodLogs: (
    namespace: string,
    podName: string,
    options?: {
      container?: string;
      tailLines?: number;
      sinceSeconds?: number;
      timestamps?: boolean;
      previous?: boolean;
    }
  ) => {
    // Build params object, excluding undefined/null values
    const params: Record<string, string | number | boolean> = {};
    if (options?.container) params.container = options.container;
    if (options?.tailLines) params.tail_lines = options.tailLines;
    if (options?.sinceSeconds) params.since_seconds = options.sinceSeconds;
    if (options?.timestamps) params.timestamps = options.timestamps;
    if (options?.previous) params.previous = options.previous;

    return api.get<PodLogs>(`/kubernetes/pods/${namespace}/${podName}/logs`, { params });
  },
  // Exec
  execPodCommand: (namespace: string, podName: string, command: string[], container?: string) =>
    api.post<PodExecResult>(`/kubernetes/pods/${namespace}/${podName}/exec`, {
      namespace,
      pod_name: podName,
      command,
      container,
    }),
  // Services
  getServices: (namespace?: string) =>
    api.get<K8sService[]>('/kubernetes/services', { params: { namespace } }),
  createService: (request: ServiceCreateRequest) =>
    api.post<K8sService>('/kubernetes/services', request),
  updateService: (namespace: string, name: string, request: ServiceUpdateRequest) =>
    api.put<K8sService>(`/kubernetes/services/${namespace}/${name}`, request),
  deleteService: (namespace: string, name: string) =>
    api.delete<ResourceDeleteResponse>(`/kubernetes/services/${namespace}/${name}`),
  // Ingresses
  getIngresses: (namespace?: string) =>
    api.get<Ingress[]>('/kubernetes/ingresses', { params: { namespace } }),
  createIngress: (request: IngressCreateRequest) =>
    api.post<Ingress>('/kubernetes/ingresses', request),
  updateIngress: (namespace: string, name: string, request: IngressUpdateRequest) =>
    api.put<Ingress>(`/kubernetes/ingresses/${namespace}/${name}`, request),
  deleteIngress: (namespace: string, name: string) =>
    api.delete<ResourceDeleteResponse>(`/kubernetes/ingresses/${namespace}/${name}`),
  // ConfigMaps
  getConfigMaps: (namespace?: string) =>
    api.get<ConfigMap[]>('/kubernetes/configmaps', { params: { namespace } }),
  getConfigMap: (namespace: string, name: string) =>
    api.get<ConfigMapDetail>(`/kubernetes/configmaps/${namespace}/${name}`),
  createConfigMap: (request: ConfigMapCreateRequest) =>
    api.post<ConfigMapDetail>('/kubernetes/configmaps', request),
  updateConfigMap: (namespace: string, name: string, request: ConfigMapUpdateRequest) =>
    api.put<ConfigMapDetail>(`/kubernetes/configmaps/${namespace}/${name}`, request),
  deleteConfigMap: (namespace: string, name: string) =>
    api.delete(`/kubernetes/configmaps/${namespace}/${name}`),
  // Secrets
  getSecrets: (namespace?: string) =>
    api.get<Secret[]>('/kubernetes/secrets', { params: { namespace } }),
  getSecret: (namespace: string, name: string) =>
    api.get<SecretDetail>(`/kubernetes/secrets/${namespace}/${name}`),
  createSecret: (request: SecretCreateRequest) =>
    api.post<SecretDetail>('/kubernetes/secrets', request),
  updateSecret: (namespace: string, name: string, request: SecretUpdateRequest) =>
    api.put<SecretDetail>(`/kubernetes/secrets/${namespace}/${name}`, request),
  deleteSecret: (namespace: string, name: string) =>
    api.delete(`/kubernetes/secrets/${namespace}/${name}`),
  // PVCs
  getPVCs: (namespace?: string) =>
    api.get<PVC[]>('/kubernetes/pvcs', { params: { namespace } }),
  createPVC: (request: PVCCreateRequest) =>
    api.post<PVC>('/kubernetes/pvcs', request),
  updatePVC: (namespace: string, name: string, request: PVCUpdateRequest) =>
    api.put<PVC>(`/kubernetes/pvcs/${namespace}/${name}`, request),
  deletePVC: (namespace: string, name: string) =>
    api.delete<ResourceDeleteResponse>(`/kubernetes/pvcs/${namespace}/${name}`),
  // PVs
  getPVs: () =>
    api.get<PV[]>('/kubernetes/pvs'),
  createPV: (request: PVCreateRequest) =>
    api.post<PV>('/kubernetes/pvs', request),
  deletePV: (name: string) =>
    api.delete<ResourceDeleteResponse>(`/kubernetes/pvs/${name}`),
  // StorageClasses
  getStorageClasses: () =>
    api.get<StorageClass[]>('/kubernetes/storageclasses'),
  createStorageClass: (request: StorageClassCreateRequest) =>
    api.post<StorageClass>('/kubernetes/storageclasses', request),
  deleteStorageClass: (name: string) =>
    api.delete<ResourceDeleteResponse>(`/kubernetes/storageclasses/${name}`),
  // StatefulSets
  getStatefulSets: (namespace?: string) =>
    api.get<StatefulSet[]>('/kubernetes/statefulsets', { params: { namespace } }),
  getStatefulSet: (namespace: string, name: string) =>
    api.get<StatefulSet>(`/kubernetes/statefulsets/${namespace}/${name}`),
  deleteStatefulSet: (namespace: string, name: string) =>
    api.delete<ResourceDeleteResponse>(`/kubernetes/statefulsets/${namespace}/${name}`),
  scaleStatefulSet: (namespace: string, name: string, replicas: number) =>
    api.post(`/kubernetes/statefulsets/${namespace}/${name}/scale`, null, { params: { replicas } }),
  restartStatefulSet: (namespace: string, name: string) =>
    api.post(`/kubernetes/statefulsets/${namespace}/${name}/restart`),
  // DaemonSets
  getDaemonSets: (namespace?: string) =>
    api.get<DaemonSet[]>('/kubernetes/daemonsets', { params: { namespace } }),
  getDaemonSet: (namespace: string, name: string) =>
    api.get<DaemonSet>(`/kubernetes/daemonsets/${namespace}/${name}`),
  deleteDaemonSet: (namespace: string, name: string) =>
    api.delete<ResourceDeleteResponse>(`/kubernetes/daemonsets/${namespace}/${name}`),
  restartDaemonSet: (namespace: string, name: string) =>
    api.post(`/kubernetes/daemonsets/${namespace}/${name}/restart`),
  // Jobs
  getJobs: (namespace?: string) =>
    api.get<Job[]>('/kubernetes/jobs', { params: { namespace } }),
  getJob: (namespace: string, name: string) =>
    api.get<Job>(`/kubernetes/jobs/${namespace}/${name}`),
  deleteJob: (namespace: string, name: string) =>
    api.delete<ResourceDeleteResponse>(`/kubernetes/jobs/${namespace}/${name}`),
  // CronJobs
  getCronJobs: (namespace?: string) =>
    api.get<CronJob[]>('/kubernetes/cronjobs', { params: { namespace } }),
  // HPAs
  getHPAs: (namespace?: string) =>
    api.get<HPA[]>('/kubernetes/hpas', { params: { namespace } }),
  // YAML Apply
  applyYAML: (request: YAMLApplyRequest) =>
    api.post<YAMLApplyResponse>('/kubernetes/apply', request),
  // Kubectl
  executeKubectl: (request: KubectlRequest) =>
    api.post<KubectlResponse>('/kubernetes/kubectl', request),
  // Shell
  executeShell: (request: ShellRequest) =>
    api.post<ShellResponse>('/kubernetes/shell', request),
  // Deployment Revisions & Rollback
  getDeploymentRevisions: (namespace: string, deploymentName: string) =>
    api.get<DeploymentRevision[]>(`/kubernetes/deployments/${namespace}/${deploymentName}/revisions`),
  rollbackDeployment: (namespace: string, deploymentName: string, revision: number) =>
    api.post(`/kubernetes/deployments/${namespace}/${deploymentName}/rollback`, null, { params: { revision } }),
  // Resource YAML operations
  getResourceYAML: (request: ResourceYAMLRequest) =>
    api.post<ResourceYAMLResponse>('/kubernetes/resource/yaml', request),
  updateResourceYAML: (yamlContent: string, namespace?: string, dryRun = false) =>
    api.put<YAMLApplyResponse>('/kubernetes/resource/yaml', {
      yaml_content: yamlContent,
      namespace,
      dry_run: dryRun
    }),
};

// Deployment Revision type
export interface DeploymentRevision {
  revision: number;
  name: string;
  replicas: number;
  ready_replicas: number;
  image: string | null;
  change_cause: string;
  created_at: string | null;
  age: string;
}

// Incidents API
export const incidentsApi = {
  list: (params?: { status?: string; severity?: string; namespace?: string }) =>
    api.get<Incident[]>('/incidents', { params }),
  get: (id: string) => api.get<Incident>(`/incidents/${id}`),
  create: (data: Partial<Incident>) => api.post<Incident>('/incidents', data),
  update: (id: string, data: Partial<Incident>) => api.patch<Incident>(`/incidents/${id}`, data),
  analyze: (id: string, options?: { include_k8s_context?: boolean; additional_context?: string }) =>
    api.post<IncidentAnalysis>(`/incidents/${id}/analyze`, {
      incident_id: id,
      include_k8s_context: options?.include_k8s_context ?? true,
      include_jenkins_context: true,
      additional_context: options?.additional_context,
    }),
  getRunbook: (id: string) => api.post(`/incidents/${id}/runbook`),
  getTimeline: (id: string) => api.get(`/incidents/${id}/timeline`),
  delete: (id: string) => api.delete(`/incidents/${id}`),
};

// Timeline API
export const timelineApi = {
  list: (params?: {
    start_date?: string;
    end_date?: string;
    event_types?: string[];
    sources?: string[];
    namespaces?: string[];
    limit?: number;
  }) => api.get<TimelineEvent[]>('/timeline', { params }),
  create: (event: Partial<TimelineEvent>) => api.post<TimelineEvent>('/timeline', event),
  getStats: (hours = 24) => api.get('/timeline/stats', { params: { hours } }),
  correlate: (incidentId: string, incidentTimestamp: string) =>
    api.get(`/timeline/correlate/${incidentId}`, { params: { incident_timestamp: incidentTimestamp } }),
};

// GitFlow API
export const gitflowApi = {
  getConfig: () => api.get('/gitflow/config'),
  getBranches: (branchType?: string) =>
    api.get('/gitflow/branches', { params: { branch_type: branchType } }),
  createRelease: (version: string, sourceBranch = 'develop', changelog?: string) =>
    api.post<Release>('/gitflow/releases', {
      version,
      source_branch: sourceBranch,
      changelog,
      auto_create_branch: true,
    }),
  listReleases: (status?: string, limit = 20) =>
    api.get<{ releases: Release[]; total_count: number }>('/gitflow/releases', { params: { status, limit } }),
  getRelease: (id: string) => api.get<Release>(`/gitflow/releases/${id}`),
  approveRelease: (id: string, approvedBy: string) =>
    api.post<Release>(`/gitflow/releases/${id}/approve`, null, { params: { approved_by: approvedBy } }),
  finishRelease: (id: string) => api.post<Release>(`/gitflow/releases/${id}/finish`),
  createHotfix: (version: string, description: string) =>
    api.post<Release>('/gitflow/hotfix', null, { params: { version, description } }),
  finishHotfix: (id: string) => api.post<Release>(`/gitflow/hotfix/${id}/finish`),
  getVersions: () => api.get('/gitflow/versions'),
  promote: (releaseId: string, fromEnv: string, toEnv: string) =>
    api.post('/gitflow/promote', {
      release_id: releaseId,
      from_environment: fromEnv,
      to_environment: toEnv,
    }),
};

// Self-Service API
export const selfServiceApi = {
  getCatalog: (namespace?: string, environment?: string) =>
    api.get<ServiceCatalogItem[]>('/selfservice/catalog', { params: { namespace, environment } }),
  getService: (namespace: string, serviceName: string) =>
    api.get<ServiceCatalogItem>(`/selfservice/catalog/${namespace}/${serviceName}`),
  getEnvironments: () => api.get('/selfservice/environments'),
  getQuickActions: () => api.get('/selfservice/quick-actions'),
  createAction: (action: Partial<SelfServiceAction>) =>
    api.post<SelfServiceAction>('/selfservice/actions', action),
  listActions: (status?: string, limit = 50) =>
    api.get<SelfServiceAction[]>('/selfservice/actions', { params: { status, limit } }),
  getAction: (id: string) => api.get<SelfServiceAction>(`/selfservice/actions/${id}`),
  approveAction: (id: string, approvedBy: string) =>
    api.post<SelfServiceAction>(`/selfservice/actions/${id}/approve`, null, { params: { approved_by: approvedBy } }),
  rejectAction: (id: string, reason: string) =>
    api.post<SelfServiceAction>(`/selfservice/actions/${id}/reject`, null, { params: { reason } }),
};

// Jenkins API
export const jenkinsApi = {
  getHealth: () => api.get('/jenkins/health'),
  listJobs: (folder?: string) => api.get<JenkinsJob[]>('/jenkins/jobs', { params: { folder } }),
  getJob: (name: string) => api.get<JenkinsJob>(`/jenkins/jobs/${name}`),
  getBuild: (jobName: string, buildNumber: number) =>
    api.get<JenkinsBuild>(`/jenkins/jobs/${jobName}/builds/${buildNumber}`),
  getBuildLog: (jobName: string, buildNumber: number) =>
    api.get(`/jenkins/jobs/${jobName}/builds/${buildNumber}/log`),
  triggerBuild: (jobName: string, parameters?: Record<string, string>) =>
    api.post(`/jenkins/jobs/${jobName}/build`, { parameters }),
  stopBuild: (jobName: string, buildNumber: number) =>
    api.post(`/jenkins/jobs/${jobName}/builds/${buildNumber}/stop`),
  getQueue: () => api.get('/jenkins/queue'),
};

// Permission types
export interface PermissionInfo {
  key: string;
  label: string;
  category: string;
}

export interface PermissionCategory {
  name: string;
  category: string;
  permissions: PermissionInfo[];
}

export interface AvailablePermissionsResponse {
  categories: PermissionCategory[];
}

export interface UserPermissionsResponse {
  user_id: string;
  username: string;
  role: string;
  use_custom_permissions: boolean;
  permissions: string[];
  role_default_permissions: string[];
}

export interface SetUserPermissionsRequest {
  use_custom_permissions: boolean;
  permissions: string[];
}

export interface SetUserPermissionsResponse {
  user_id: string;
  use_custom_permissions: boolean;
  permissions: string[];
  message: string;
}

export interface RoleDefaultPermissions {
  admin: string[];
  developer: string[];
  operator: string[];
  viewer: string[];
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }),
  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refresh_token: refreshToken }),
  refreshToken: (refreshToken: string) =>
    api.post<RefreshTokenResponse>('/auth/refresh', { refresh_token: refreshToken }),
  getCurrentUser: () => api.get<User>('/auth/me'),
  changePassword: (data: PasswordChangeRequest) =>
    api.post('/auth/me/password', data),
  listUsers: () => api.get<User[]>('/auth/users'),
  createUser: (data: { username: string; password: string; email?: string; full_name?: string; role: string }) =>
    api.post<User>('/auth/users', data),
  updateUser: (userId: string, data: { email?: string; full_name?: string; role?: string; is_active?: boolean }) =>
    api.patch<User>(`/auth/users/${userId}`, data),
  deleteUser: (userId: string) => api.delete(`/auth/users/${userId}`),
  resetUserPassword: (userId: string, data: PasswordResetRequest) =>
    api.post(`/auth/users/${userId}/reset-password`, data),
  // Permission management
  getAvailablePermissions: () =>
    api.get<AvailablePermissionsResponse>('/auth/permissions/available'),
  getUserPermissions: (userId: string) =>
    api.get<UserPermissionsResponse>(`/auth/users/${userId}/permissions`),
  setUserPermissions: (userId: string, data: SetUserPermissionsRequest) =>
    api.put<SetUserPermissionsResponse>(`/auth/users/${userId}/permissions`, data),
  getRoleDefaultPermissions: () =>
    api.get<RoleDefaultPermissions>('/auth/roles/permissions'),
};

// Cluster test connection response type
export interface ClusterTestResult {
  success: boolean;
  cluster_id: string;
  message?: string;
  error?: string;
  version?: string;
  platform?: string;
  latency_ms: number;
  status_code?: number;
}

// Clusters API
export const clustersApi = {
  list: () => api.get<ClusterListResponse>('/clusters'),
  getActive: () => api.get<ClusterInfo>('/clusters/active'),
  setActive: (clusterId: string) => api.put('/clusters/active', { cluster_id: clusterId }),
  get: (clusterId: string) => api.get<ClusterInfo>(`/clusters/${clusterId}`),
  getHealth: (clusterId: string) => api.get<ClusterHealthInfo>(`/clusters/${clusterId}/health`),
  getContexts: () => api.get<{ name: string; cluster: string; user: string; namespace?: string }[]>('/clusters/contexts'),
  create: (data: Record<string, unknown>) =>
    api.post<ClusterInfo>('/clusters', data),
  update: (clusterId: string, data: Record<string, unknown>) =>
    api.put<ClusterInfo>(`/clusters/${clusterId}`, data),
  delete: (clusterId: string) => api.delete(`/clusters/${clusterId}`),
  testConnection: (clusterId: string) => api.post<ClusterTestResult>(`/clusters/${clusterId}/test`),
};

// Helm API
export const helmApi = {
  // Releases
  listReleases: (namespace?: string, allNamespaces = true) =>
    api.get<HelmReleaseListResponse>('/helm/releases', {
      params: { namespace, all_namespaces: allNamespaces }
    }),
  getRelease: (namespace: string, name: string) =>
    api.get<HelmRelease>(`/helm/releases/${namespace}/${name}`),
  getReleaseHistory: (namespace: string, name: string) =>
    api.get<HelmReleaseHistory[]>(`/helm/releases/${namespace}/${name}/history`),
  getReleaseValues: (namespace: string, name: string, allValues = false) =>
    api.get<HelmReleaseValues>(`/helm/releases/${namespace}/${name}/values`, {
      params: { all_values: allValues }
    }),
  getManifest: (namespace: string, name: string) =>
    api.get<{ manifest: string }>(`/helm/releases/${namespace}/${name}/manifest`),
  installRelease: (request: HelmInstallRequest) =>
    api.post<HelmOperationResult>('/helm/releases', request),
  upgradeRelease: (namespace: string, name: string, request: HelmUpgradeRequest) =>
    api.put<HelmOperationResult>(`/helm/releases/${namespace}/${name}`, request),
  rollbackRelease: (namespace: string, name: string, revision: number, options?: { wait?: boolean; dry_run?: boolean }) =>
    api.post<HelmOperationResult>(`/helm/releases/${namespace}/${name}/rollback`, {
      revision,
      ...options
    }),
  uninstallRelease: (namespace: string, name: string, keepHistory = false, dryRun = false) =>
    api.delete<HelmOperationResult>(`/helm/releases/${namespace}/${name}`, {
      params: { keep_history: keepHistory, dry_run: dryRun }
    }),
  testRelease: (namespace: string, name: string, timeout = 300) =>
    api.post<HelmOperationResult>(`/helm/releases/${namespace}/${name}/test`, null, {
      params: { timeout }
    }),
  getReleaseHealth: (namespace: string, name: string) =>
    api.get<{
      healthy: boolean;
      total_pods: number;
      ready_pods: number;
      pods: Array<{
        name: string;
        namespace: string;
        phase: string;
        ready: boolean;
        containers: Array<{
          name: string;
          ready: boolean;
          restartCount: number;
          state: string;
          image: string;
        }>;
        node: string;
        created: string;
      }>;
      events: Array<{
        type: string;
        reason: string;
        message: string;
        timestamp: string;
        count: number;
      }>;
      error?: string;
    }>(`/helm/releases/${namespace}/${name}/health`),

  // Repositories
  listRepositories: () => api.get<HelmRepositoryListResponse>('/helm/repositories'),
  addRepository: (name: string, url: string) =>
    api.post('/helm/repositories', null, { params: { name, url } }),
  removeRepository: (name: string) =>
    api.delete(`/helm/repositories/${name}`),
  updateRepositories: () =>
    api.post('/helm/repositories/update'),

  // Charts
  searchCharts: (query: string, repository?: string) =>
    api.get<HelmChartSearchResult[]>('/helm/charts/search', {
      params: { query, repository }
    }),
  getChartInfo: (chart: string, repository?: string) =>
    api.get<HelmChartInfo>(`/helm/charts/${chart}/info`, {
      params: { repository }
    }),
  getChartValues: (chart: string, repository?: string) =>
    api.get<Record<string, unknown>>(`/helm/charts/${chart}/values`, {
      params: { repository }
    }),
  getChartVersions: (chart: string, repository?: string) =>
    api.get<HelmChartSearchResult[]>(`/helm/charts/${chart}/versions`, {
      params: { repository }
    }),

  // AI Analysis
  analyzeConfig: (valuesYaml: string, chartName?: string, namespace?: string) =>
    api.post<{
      analysis: string;
      issues: Array<{
        severity: string;
        issue: string;
        category: string;
        auto_fixable: boolean;
      }>;
      recommendations: Array<{
        title: string;
        priority: string;
        description: string;
      }>;
      security_score: number;
      production_ready: boolean;
      success: boolean;
    }>('/ai/helm/analyze-config', {
      values_yaml: valuesYaml,
      chart_name: chartName,
      namespace: namespace
    }),
  troubleshoot: (releaseName: string, namespace: string, healthData: any, manifest?: string) =>
    api.post<{
      diagnosis: string;
      root_causes: string[];
      fixes: Array<{
        description: string;
        type: string;
        priority: string;
      }>;
      severity: string;
      success: boolean;
    }>('/ai/helm/troubleshoot', {
      release_name: releaseName,
      namespace: namespace,
      health_data: healthData,
      manifest: manifest
    }),
};

// ArgoCD API
export const argocdApi = {
  // Configuration
  configure: (config: ArgoCDConfig) =>
    api.post<ArgoCDStatus>('/argocd/config', config),
  getStatus: () =>
    api.get<ArgoCDStatus>('/argocd/config/status'),
  disconnect: () =>
    api.delete('/argocd/config'),

  // Applications
  listApplications: (project?: string, selector?: string) =>
    api.get<ArgoCDApplicationListResponse>('/argocd/applications', {
      params: { project, selector }
    }),
  getApplication: (name: string) =>
    api.get<ArgoCDApplication>(`/argocd/applications/${name}`),
  createApplication: (request: ArgoCDCreateApplicationRequest) =>
    api.post<ArgoCDApplication>('/argocd/applications', request),
  deleteApplication: (name: string, cascade = true) =>
    api.delete(`/argocd/applications/${name}`, { params: { cascade } }),

  // Sync Operations
  syncApplication: (name: string, request?: ArgoCDSyncRequest) =>
    api.post<ArgoCDSyncResult>(`/argocd/applications/${name}/sync`, request || {}),
  refreshApplication: (name: string) =>
    api.post(`/argocd/applications/${name}/refresh`),
  terminateOperation: (name: string) =>
    api.delete(`/argocd/applications/${name}/operation`),

  // History & Rollback
  getApplicationHistory: (name: string) =>
    api.get<ArgoCDRevisionHistoryResponse>(`/argocd/applications/${name}/history`),
  rollbackApplication: (name: string, request: ArgoCDRollbackRequest) =>
    api.post(`/argocd/applications/${name}/rollback`, request),

  // Events & Resources
  getApplicationEvents: (name: string) =>
    api.get<ArgoCDApplicationEventsResponse>(`/argocd/applications/${name}/events`),
  getResourceTree: (name: string) =>
    api.get(`/argocd/applications/${name}/resource-tree`),

  // Projects
  listProjects: () =>
    api.get<ArgoCDProjectListResponse>('/argocd/projects'),

  // Deployment Management (install/manage ArgoCD itself)
  getDeploymentStatus: (namespace = 'argocd', releaseName = 'argocd') =>
    api.get<ArgoCDDeploymentStatus>('/argocd/deployment/status', {
      params: { namespace, release_name: releaseName }
    }),
  deployArgoCD: (request: ArgoCDDeployRequest) =>
    api.post<ArgoCDDeployResult>('/argocd/deployment/deploy', request),
  upgradeArgoCD: (namespace = 'argocd', releaseName = 'argocd', version?: string) =>
    api.post<ArgoCDDeployResult>('/argocd/deployment/upgrade', null, {
      params: { namespace, release_name: releaseName, version }
    }),
  uninstallArgoCD: (namespace = 'argocd', releaseName = 'argocd', deleteNamespace = false) =>
    api.delete('/argocd/deployment/uninstall', {
      params: { namespace, release_name: releaseName, delete_namespace: deleteNamespace }
    }),
  getAdminPassword: (namespace = 'argocd') =>
    api.get<{ password: string }>('/argocd/deployment/password', {
      params: { namespace }
    }),
};

// Cost API
export const costApi = {
  getDashboard: () => api.get<CostDashboardResponse>('/cost/dashboard'),
  getNamespaceCosts: () => api.get<NamespaceCost[]>('/cost/namespaces'),
  getPodCosts: (limit = 10) => api.get<PodCost[]>('/cost/pods', { params: { limit } }),
  getCostTrends: (days = 30) => api.get<CostTrend[]>('/cost/trends', { params: { days } }),
  getRecommendations: () => api.get<CostRecommendation[]>('/cost/recommendations'),
  getEfficiencyMetrics: () => api.get<ResourceEfficiency[]>('/cost/efficiency'),
};

// Optimization API
export const optimizationApi = {
  getDashboard: (namespace?: string) =>
    api.get<OptimizationDashboardResponse>('/optimization/dashboard', { params: { namespace } }),
  getSummary: (namespace?: string) =>
    api.get<ClusterOptimizationSummary>('/optimization/summary', { params: { namespace } }),
  getNamespaces: () =>
    api.get<NamespaceOptimization[]>('/optimization/namespaces'),
  getRecommendations: (namespace?: string, severity?: string, limit = 50) =>
    api.get<OptimizationRecommendation[]>('/optimization/recommendations', {
      params: { namespace, severity, limit }
    }),
  getWastefulPods: (namespace?: string, limit = 10) =>
    api.get<PodOptimization[]>('/optimization/wasteful', { params: { namespace, limit } }),
  getUnderprovisionedPods: (namespace?: string, limit = 10) =>
    api.get<PodOptimization[]>('/optimization/underprovisioned', { params: { namespace, limit } }),
  getIdleResources: (namespace?: string, limit = 10) =>
    api.get<PodOptimization[]>('/optimization/idle', { params: { namespace, limit } }),
  getPodOptimization: (namespace: string, podName: string) =>
    api.get<PodOptimization>(`/optimization/pods/${namespace}/${podName}`),
  applyOptimization: (request: ApplyOptimizationRequest) =>
    api.post<ApplyOptimizationResponse>('/optimization/apply', request),
  previewOptimization: (request: ApplyOptimizationRequest) =>
    api.post<ApplyOptimizationResponse>('/optimization/preview', request),
  getYamlPatch: (params: {
    namespace: string;
    resource_kind: string;
    resource_name: string;
    container_name: string;
    cpu_request?: string;
    memory_request?: string;
    cpu_limit?: string;
    memory_limit?: string;
  }) => api.get<{ yaml: string }>('/optimization/yaml-patch', { params }),
  getAIAnalysis: (request: AIOptimizationAnalysisRequest) =>
    api.post<AIOptimizationAnalysisResponse>('/ai/optimization/analyze', request),
};

// Health API
export const healthApi = {
  check: () => api.get('/health'),
  ready: () => api.get('/ready'),
  live: () => api.get('/live'),
};

// AI Chat API
export interface YAMLReviewIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  suggestion?: string;
}

export interface YAMLReviewResponse {
  score: number;
  issues: YAMLReviewIssue[];
  suggestions: string[];
  security_score: number;
  best_practice_score: number;
  success: boolean;
}

export interface WorkloadAnalysisFix {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  category: 'performance' | 'security' | 'reliability' | 'best_practice';
  fix_yaml?: string;
  kubectl_command?: string;
  auto_fixable: boolean;
}

export interface WorkloadAnalysisResponse {
  workload_name: string;
  workload_type: string;
  health_score: number;
  fixes: WorkloadAnalysisFix[];
  summary: string;
  success: boolean;
}

export const aiApi = {
  chat: (request: { message: string; context?: string }) =>
    api.post<{ response: string; success: boolean }>('/ai/chat', request),
  yamlReview: (request: { yaml_content: string; namespace?: string }) =>
    api.post<YAMLReviewResponse>('/ai/yaml-review', request),
  analyzeWorkload: (request: {
    workload_name: string;
    workload_type: string;
    namespace: string;
    spec?: Record<string, any>;
  }) => api.post<WorkloadAnalysisResponse>('/ai/workload/analyze', request),
  getProactiveInsights: () =>
    api.get<import('../types').ProactiveInsightsResponse>('/ai/insights/proactive'),
  summarizeLogs: (namespace?: string, timeWindowMinutes = 10) =>
    api.post<{ summary: string; error_count: number; time_window: string; key_issues: string[]; success: boolean }>('/ai/summarize-logs', {
      namespace,
      time_window_minutes: timeWindowMinutes,
    }),
};

// Settings & Integrations API
export interface Integration {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: 'source-control' | 'ci-cd' | 'monitoring' | 'logging' | 'cloud' | 'notification';
  status: 'connected' | 'disconnected' | 'error';
  auto_sync: boolean;
  sync_interval_seconds: number;
  last_sync: string | null;
  last_error: string | null;
  is_managed: boolean;
  setup_url: string | null;
  config: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationStatusResponse {
  id: string;
  name: string;
  status: string;
  last_sync: string | null;
  last_error: string | null;
  is_healthy: boolean;
  response_time_ms: number | null;
}

export interface IntegrationConnectRequest {
  endpoint: string;
  api_token?: string;
  username?: string;
  password?: string;
  additional_config?: Record<string, any>;
}

export interface APIToken {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  expires_at: string;
  last_used: string | null;
  status: 'active' | 'expired' | 'revoked';
}

export interface APITokenCreated extends APIToken {
  token: string;
}

export interface UserSettingsResponse {
  id: string;
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    slack: boolean;
    inApp: boolean;
    deployments: boolean;
    alerts: boolean;
    security: boolean;
  };
  default_namespace: string;
  auto_refresh: boolean;
  refresh_interval_seconds: number;
  timezone: string;
  date_format: string;
  created_at: string;
  updated_at: string;
}

export interface SettingsUserResponse {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  role: 'admin' | 'developer' | 'operator' | 'viewer';
  is_active: boolean;
  auth_provider: 'local' | 'google' | 'github' | 'gitlab';
  avatar_url: string | null;
  last_login: string | null;
  created_at: string;
}

export const settingsApi = {
  // Integrations
  listIntegrations: () =>
    api.get<Integration[]>('/settings/integrations'),
  getIntegration: (id: string) =>
    api.get<Integration>(`/settings/integrations/${id}`),
  createIntegration: (data: {
    name: string;
    description?: string;
    icon?: string;
    category: string;
    config?: Record<string, any>;
    auto_sync?: boolean;
    sync_interval_seconds?: number;
    health_check_url?: string;
  }) => api.post<Integration>('/settings/integrations', data),
  updateIntegration: (id: string, data: Partial<{
    name: string;
    description: string;
    config: Record<string, any>;
    auto_sync: boolean;
    sync_interval_seconds: number;
    health_check_url: string;
  }>) => api.put<Integration>(`/settings/integrations/${id}`, data),
  deleteIntegration: (id: string) =>
    api.delete(`/settings/integrations/${id}`),
  connectIntegration: (id: string, data: IntegrationConnectRequest) =>
    api.post<Integration>(`/settings/integrations/${id}/connect`, data),
  disconnectIntegration: (id: string) =>
    api.post<Integration>(`/settings/integrations/${id}/disconnect`),
  checkIntegrationStatus: (id: string) =>
    api.get<IntegrationStatusResponse>(`/settings/integrations/${id}/status`),
  checkAllIntegrationsStatus: () =>
    api.get<IntegrationStatusResponse[]>('/settings/integrations/status/all'),

  // API Tokens
  listTokens: () =>
    api.get<APIToken[]>('/settings/tokens'),
  createToken: (data: { name: string; scopes?: string[]; expires_in_days?: number }) =>
    api.post<APITokenCreated>('/settings/tokens', data),
  revokeToken: (id: string) =>
    api.post<{ message: string }>(`/settings/tokens/${id}/revoke`),
  deleteToken: (id: string) =>
    api.delete(`/settings/tokens/${id}`),

  // User Settings (Preferences)
  getUserSettings: () =>
    api.get<UserSettingsResponse>('/settings/settings'),
  updateUserSettings: (data: Partial<{
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email?: boolean;
      slack?: boolean;
      inApp?: boolean;
      deployments?: boolean;
      alerts?: boolean;
      security?: boolean;
    };
    default_namespace: string;
    auto_refresh: boolean;
    refresh_interval_seconds: number;
    timezone: string;
    date_format: string;
  }>) => api.put<UserSettingsResponse>('/settings/settings', data),
  resetUserSettings: () =>
    api.post<UserSettingsResponse>('/settings/settings/reset'),

  // User Management (Admin)
  listUsers: () =>
    api.get<SettingsUserResponse[]>('/settings/users'),
  getUser: (id: string) =>
    api.get<SettingsUserResponse>(`/settings/users/${id}`),
  createUser: (data: {
    username: string;
    email?: string;
    full_name?: string;
    password: string;
    role?: string;
  }) => api.post<SettingsUserResponse>('/settings/users', data),
  updateUser: (id: string, data: Partial<{
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
  }>) => api.put<SettingsUserResponse>(`/settings/users/${id}`, data),
  deleteUser: (id: string) =>
    api.delete(`/settings/users/${id}`),
  toggleUserStatus: (id: string) =>
    api.post<SettingsUserResponse>(`/settings/users/${id}/toggle-status`),
};

// Security API
export const securityApi = {
  getDashboard: (clusterId = 'default') =>
    api.get<SecurityDashboardResponse>('/security/dashboard', { params: { cluster_id: clusterId } }),
  getPosture: (clusterId = 'default') =>
    api.get<SecurityPosture>('/security/posture', { params: { cluster_id: clusterId } }),
  getFindings: (params?: { cluster_id?: string; severity?: string; finding_type?: string; namespace?: string }) =>
    api.get<SecurityFinding[]>('/security/findings', { params }),
  getScore: (clusterId = 'default') =>
    api.get<SecurityScore>('/security/score', { params: { cluster_id: clusterId } }),
  triggerScan: (clusterId = 'default') =>
    api.post('/security/scan', null, { params: { cluster_id: clusterId } }),
  getPodSecurityChecks: (params?: { cluster_id?: string; namespace?: string; min_score?: number }) =>
    api.get<PodSecurityCheck[]>('/security/pod-security', { params }),
  getComplianceChecks: (params?: { cluster_id?: string; category?: string; passed?: boolean }) =>
    api.get<ComplianceCheck[]>('/security/compliance', { params }),
  getImageScans: (clusterId = 'default') =>
    api.get<ImageScanResult[]>('/security/image-scans', { params: { cluster_id: clusterId } }),
  getRBACAnalysis: () =>
    api.get<RBACAnalysis>('/security/rbac'),
  getRBACSummary: () =>
    api.get('/security/rbac/summary'),
  getNetworkPolicyCoverage: () =>
    api.get<NetworkPolicyCoverage>('/security/network-policies'),
  getNetworkPolicySummary: () =>
    api.get('/security/network-policies/summary'),
  getTrends: (days = 30) =>
    api.get<SecurityTrends>('/security/trends', { params: { days } }),
  getTrendsSummary: () =>
    api.get('/security/trends/summary'),
  getRecommendations: (clusterId = 'default') =>
    api.get('/security/recommendations', { params: { cluster_id: clusterId } }),
  getRiskyNamespaces: (clusterId = 'default', limit = 10) =>
    api.get('/security/namespaces/risky', { params: { cluster_id: clusterId, limit } }),
  getAIRemediation: (request: {
    finding_type: string;
    severity: string;
    title: string;
    description: string;
    resource_type?: string;
    resource_name?: string;
    namespace?: string;
    cve_id?: string;
    additional_context?: string;
  }) => api.post('/security/ai-remediate', request),
};

export default api;
