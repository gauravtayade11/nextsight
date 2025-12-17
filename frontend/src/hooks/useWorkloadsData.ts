/**
 * Workloads data hooks with React Query caching
 *
 * These hooks cache Kubernetes resource data to prevent refetching
 * when navigating between pages or switching tabs.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kubernetesApi } from '../services/api';

// Cache times in milliseconds
const CACHE_TIMES = {
  FAST: { staleTime: 30 * 1000, gcTime: 2 * 60 * 1000 },      // 30s stale, 2min cache
  MEDIUM: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },    // 1min stale, 5min cache
  SLOW: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 }, // 5min stale, 30min cache
};

// ============= Workload Resources =============

export function useDeployments(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['deployments', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getDeployments(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

export function usePods(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['pods', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getPods(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.FAST,
  });
}

export function useStatefulSets(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['statefulsets', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getStatefulSets(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

export function useDaemonSets(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['daemonsets', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getDaemonSets(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

export function useJobs(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['jobs', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getJobs(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.FAST,
  });
}

export function useCronJobs(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['cronjobs', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getCronJobs(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

// ============= Networking Resources =============

export function useServices(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['services', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getServices(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

export function useIngresses(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['ingresses', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getIngresses(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

// ============= Config Resources =============

export function useConfigMaps(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['configmaps', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getConfigMaps(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

export function useSecrets(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['secrets', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getSecrets(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

// ============= Storage Resources =============

export function usePVCs(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['pvcs', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getPVCs(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

// ============= Scaling Resources =============

export function useHPAs(namespace?: string, enabled = true) {
  return useQuery({
    queryKey: ['hpas', namespace],
    queryFn: async () => {
      const res = await kubernetesApi.getHPAs(namespace);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.MEDIUM,
  });
}

// ============= Cluster Resources =============

export function useNamespaces() {
  return useQuery({
    queryKey: ['namespaces'],
    queryFn: async () => {
      const res = await kubernetesApi.getNamespaces();
      return res.data;
    },
    ...CACHE_TIMES.SLOW,
  });
}

export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: async () => {
      const res = await kubernetesApi.getNodes();
      return res.data;
    },
    ...CACHE_TIMES.MEDIUM,
  });
}

export function useEvents(namespace?: string, limit?: number, enabled = true) {
  return useQuery({
    queryKey: ['events', namespace, limit],
    queryFn: async () => {
      const res = await kubernetesApi.getEvents(namespace, limit);
      return res.data;
    },
    enabled,
    ...CACHE_TIMES.FAST,
  });
}

// ============= Metrics =============

export function useClusterMetrics() {
  return useQuery({
    queryKey: ['clusterMetrics'],
    queryFn: async () => {
      const res = await kubernetesApi.getClusterMetrics();
      return res.data;
    },
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 60 * 1000,     // 1 minute
  });
}

export function useClusterHealth() {
  return useQuery({
    queryKey: ['clusterHealth'],
    queryFn: async () => {
      const res = await kubernetesApi.getHealth();
      return res.data;
    },
    ...CACHE_TIMES.FAST,
  });
}

// ============= Cache Invalidation =============

export function useInvalidateWorkloads() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries(),
    invalidateDeployments: (namespace?: string) =>
      queryClient.invalidateQueries({ queryKey: ['deployments', namespace] }),
    invalidatePods: (namespace?: string) =>
      queryClient.invalidateQueries({ queryKey: ['pods', namespace] }),
    invalidateServices: (namespace?: string) =>
      queryClient.invalidateQueries({ queryKey: ['services', namespace] }),
    invalidateByNamespace: (namespace: string) => {
      queryClient.invalidateQueries({ queryKey: ['deployments', namespace] });
      queryClient.invalidateQueries({ queryKey: ['pods', namespace] });
      queryClient.invalidateQueries({ queryKey: ['services', namespace] });
      queryClient.invalidateQueries({ queryKey: ['ingresses', namespace] });
      queryClient.invalidateQueries({ queryKey: ['configmaps', namespace] });
      queryClient.invalidateQueries({ queryKey: ['secrets', namespace] });
      queryClient.invalidateQueries({ queryKey: ['pvcs', namespace] });
      queryClient.invalidateQueries({ queryKey: ['hpas', namespace] });
    },
  };
}
