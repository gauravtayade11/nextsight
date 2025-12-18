/**
 * React Query hooks for frontend caching
 *
 * This provides stale-while-revalidate caching to prevent
 * data refetching when navigating between pages.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import api from '../services/api';

// Cache time configurations (in milliseconds)
const CACHE_TIMES = {
  // Fast-changing data (30 seconds stale, 2 minutes cache)
  PODS: { staleTime: 30 * 1000, gcTime: 2 * 60 * 1000 },
  EVENTS: { staleTime: 15 * 1000, gcTime: 1 * 60 * 1000 },
  METRICS: { staleTime: 10 * 1000, gcTime: 1 * 60 * 1000 },

  // Medium-changing data (1 minute stale, 5 minutes cache)
  DEPLOYMENTS: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
  SERVICES: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
  NODES: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
  HELM_RELEASES: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },

  // Slow-changing data (5 minutes stale, 30 minutes cache)
  NAMESPACES: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  CONFIGMAPS: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  SECRETS: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },

  // Dashboard data (30 seconds stale for real-time feel)
  DASHBOARD: { staleTime: 30 * 1000, gcTime: 5 * 60 * 1000 },

  // Security/Optimization (2 minutes stale - computed data)
  SECURITY: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  OPTIMIZATION: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
};

// Query Keys for cache invalidation
export const queryKeys = {
  // Kubernetes resources
  pods: (namespace?: string) => ['pods', namespace] as const,
  deployments: (namespace?: string) => ['deployments', namespace] as const,
  services: (namespace?: string) => ['services', namespace] as const,
  nodes: () => ['nodes'] as const,
  namespaces: () => ['namespaces'] as const,
  events: (namespace?: string) => ['events', namespace] as const,
  configmaps: (namespace?: string) => ['configmaps', namespace] as const,
  secrets: (namespace?: string) => ['secrets', namespace] as const,
  ingresses: (namespace?: string) => ['ingresses', namespace] as const,
  pvcs: (namespace?: string) => ['pvcs', namespace] as const,

  // Workloads
  workloads: (namespace?: string, resourceType?: string) => ['workloads', namespace, resourceType] as const,

  // Metrics
  clusterMetrics: () => ['clusterMetrics'] as const,
  nodeMetrics: () => ['nodeMetrics'] as const,
  podMetrics: (namespace?: string) => ['podMetrics', namespace] as const,

  // Dashboard
  dashboard: () => ['dashboard'] as const,

  // Helm
  helmReleases: (namespace?: string) => ['helmReleases', namespace] as const,
  helmCharts: () => ['helmCharts'] as const,
  helmRepos: () => ['helmRepos'] as const,

  // Security
  securityDashboard: () => ['securityDashboard'] as const,
  vulnerabilities: () => ['vulnerabilities'] as const,

  // Optimization
  optimization: () => ['optimization'] as const,

  // Prometheus
  prometheusStatus: () => ['prometheusStatus'] as const,
  prometheusAlerts: () => ['prometheusAlerts'] as const,
  prometheusTargets: () => ['prometheusTargets'] as const,

  // Pipelines
  pipelines: () => ['pipelines'] as const,
  pipelineRuns: (pipelineId?: string) => ['pipelineRuns', pipelineId] as const,
};

// ============= Kubernetes Resource Hooks =============

export function useNodes() {
  return useQuery({
    queryKey: queryKeys.nodes(),
    queryFn: async () => {
      const response = await api.get('/api/v1/kubernetes/nodes');
      return response.data;
    },
    ...CACHE_TIMES.NODES,
  });
}

export function useNamespaces() {
  return useQuery({
    queryKey: queryKeys.namespaces(),
    queryFn: async () => {
      const response = await api.get('/api/v1/kubernetes/namespaces');
      return response.data;
    },
    ...CACHE_TIMES.NAMESPACES,
  });
}

export function usePods(namespace?: string) {
  return useQuery({
    queryKey: queryKeys.pods(namespace),
    queryFn: async () => {
      const url = namespace
        ? `/api/v1/kubernetes/pods?namespace=${namespace}`
        : '/api/v1/kubernetes/pods';
      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.PODS,
  });
}

export function useDeployments(namespace?: string) {
  return useQuery({
    queryKey: queryKeys.deployments(namespace),
    queryFn: async () => {
      const url = namespace
        ? `/api/v1/kubernetes/deployments?namespace=${namespace}`
        : '/api/v1/kubernetes/deployments';
      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.DEPLOYMENTS,
  });
}

export function useServices(namespace?: string) {
  return useQuery({
    queryKey: queryKeys.services(namespace),
    queryFn: async () => {
      const url = namespace
        ? `/api/v1/kubernetes/services?namespace=${namespace}`
        : '/api/v1/kubernetes/services';
      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.SERVICES,
  });
}

export function useEvents(namespace?: string) {
  return useQuery({
    queryKey: queryKeys.events(namespace),
    queryFn: async () => {
      const url = namespace
        ? `/api/v1/kubernetes/events?namespace=${namespace}`
        : '/api/v1/kubernetes/events';
      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.EVENTS,
  });
}

export function useConfigMaps(namespace?: string) {
  return useQuery({
    queryKey: queryKeys.configmaps(namespace),
    queryFn: async () => {
      const url = namespace
        ? `/api/v1/kubernetes/configmaps?namespace=${namespace}`
        : '/api/v1/kubernetes/configmaps';
      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.CONFIGMAPS,
  });
}

export function useSecrets(namespace?: string) {
  return useQuery({
    queryKey: queryKeys.secrets(namespace),
    queryFn: async () => {
      const url = namespace
        ? `/api/v1/kubernetes/secrets?namespace=${namespace}`
        : '/api/v1/kubernetes/secrets';
      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.SECRETS,
  });
}

export function useIngresses(namespace?: string) {
  return useQuery({
    queryKey: queryKeys.ingresses(namespace),
    queryFn: async () => {
      const url = namespace
        ? `/api/v1/kubernetes/ingresses?namespace=${namespace}`
        : '/api/v1/kubernetes/ingresses';
      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.SERVICES,
  });
}

export function usePVCs(namespace?: string) {
  return useQuery({
    queryKey: queryKeys.pvcs(namespace),
    queryFn: async () => {
      const url = namespace
        ? `/api/v1/kubernetes/pvcs?namespace=${namespace}`
        : '/api/v1/kubernetes/pvcs';
      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.SERVICES,
  });
}

// ============= Workloads Hook =============

export function useWorkloads(namespace?: string, resourceType?: string) {
  return useQuery({
    queryKey: queryKeys.workloads(namespace, resourceType),
    queryFn: async () => {
      let url = '/api/v1/kubernetes/workloads';
      const params = new URLSearchParams();
      if (namespace) params.append('namespace', namespace);
      if (resourceType) params.append('resource_type', resourceType);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.DEPLOYMENTS,
  });
}

// ============= Metrics Hooks =============

export function useClusterMetrics() {
  return useQuery({
    queryKey: queryKeys.clusterMetrics(),
    queryFn: async () => {
      const response = await api.get('/api/v1/kubernetes/metrics/cluster');
      return response.data;
    },
    ...CACHE_TIMES.METRICS,
  });
}

export function useNodeMetrics() {
  return useQuery({
    queryKey: queryKeys.nodeMetrics(),
    queryFn: async () => {
      const response = await api.get('/api/v1/kubernetes/metrics/nodes');
      return response.data;
    },
    ...CACHE_TIMES.METRICS,
  });
}

// ============= Dashboard Hook =============

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard(),
    queryFn: async () => {
      const response = await api.get('/api/v1/kubernetes/dashboard');
      return response.data;
    },
    ...CACHE_TIMES.DASHBOARD,
  });
}

// ============= Helm Hooks =============

export function useHelmReleases(namespace?: string) {
  return useQuery({
    queryKey: queryKeys.helmReleases(namespace),
    queryFn: async () => {
      const url = namespace
        ? `/api/v1/helm/releases?namespace=${namespace}`
        : '/api/v1/helm/releases';
      const response = await api.get(url);
      return response.data;
    },
    ...CACHE_TIMES.HELM_RELEASES,
  });
}

export function useHelmRepos() {
  return useQuery({
    queryKey: queryKeys.helmRepos(),
    queryFn: async () => {
      const response = await api.get('/api/v1/helm/repos');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
  });
}

// ============= Security Hooks =============

export function useSecurityDashboard() {
  return useQuery({
    queryKey: queryKeys.securityDashboard(),
    queryFn: async () => {
      const response = await api.get('/api/v1/security/dashboard');
      return response.data;
    },
    ...CACHE_TIMES.SECURITY,
  });
}

// ============= Prometheus Hooks =============

export function usePrometheusStatus() {
  return useQuery({
    queryKey: queryKeys.prometheusStatus(),
    queryFn: async () => {
      const response = await api.get('/api/v1/prometheus/status');
      return response.data;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function usePrometheusAlerts() {
  return useQuery({
    queryKey: queryKeys.prometheusAlerts(),
    queryFn: async () => {
      const response = await api.get('/api/v1/prometheus/alerts');
      return response.data;
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

export function usePrometheusTargets() {
  return useQuery({
    queryKey: queryKeys.prometheusTargets(),
    queryFn: async () => {
      const response = await api.get('/api/v1/prometheus/targets');
      return response.data;
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

// ============= Pipelines Hooks =============

export function usePipelines() {
  return useQuery({
    queryKey: queryKeys.pipelines(),
    queryFn: async () => {
      const response = await api.get('/api/v1/pipelines');
      return response.data;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function usePipelineRuns(pipelineId?: string) {
  return useQuery({
    queryKey: queryKeys.pipelineRuns(pipelineId),
    queryFn: async () => {
      const url = pipelineId
        ? `/api/v1/pipelines/${pipelineId}/runs`
        : '/api/v1/pipelines/runs';
      const response = await api.get(url);
      return response.data;
    },
    enabled: !!pipelineId,
    staleTime: 15 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

// ============= Cache Invalidation Helpers =============

export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries(),
    invalidatePods: (namespace?: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.pods(namespace) }),
    invalidateDeployments: (namespace?: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.deployments(namespace) }),
    invalidateServices: (namespace?: string) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.services(namespace) }),
    invalidateNodes: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.nodes() }),
    invalidateNamespaces: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.namespaces() }),
    invalidateWorkloads: () =>
      queryClient.invalidateQueries({ queryKey: ['workloads'] }),
    invalidateHelmReleases: () =>
      queryClient.invalidateQueries({ queryKey: ['helmReleases'] }),
    invalidateDashboard: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
    invalidateSecurity: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.securityDashboard() }),
  };
}
