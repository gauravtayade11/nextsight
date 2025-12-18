/**
 * Dashboard data hook with React Query caching
 *
 * This hook fetches all dashboard data and caches it to prevent
 * refetching when navigating between pages.
 *
 * IMPORTANT: The cache is keyed by cluster ID to ensure data is
 * refetched when the user switches clusters.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kubernetesApi, costApi, optimizationApi, aiApi } from '../services/api';
import { prometheusApi } from '../services/prometheusApi';
import { k8sLogger as logger } from '../utils/logger';
import type {
  ClusterHealth,
  Deployment,
  K8sEvent,
  ClusterMetrics,
  CostDashboardResponse,
  OptimizationRecommendation,
  ProactiveInsight,
} from '../types';

interface DashboardData {
  clusterHealth: ClusterHealth | null;
  deployments: Deployment[];
  events: K8sEvent[];
  metrics: ClusterMetrics | null;
  costData: CostDashboardResponse | null;
  recommendations: OptimizationRecommendation[];
  proactiveInsights: ProactiveInsight[];
  prometheusAvailable: boolean;
  cpuHistory: number[];
  memoryHistory: number[];
}

// Query key factory to include cluster ID for proper cache isolation
const getDashboardQueryKey = (clusterId: string | null) => ['dashboard', 'combined', clusterId ?? 'default'];

async function fetchDashboardData(): Promise<DashboardData> {
  // Check Prometheus status first
  const promStatus = await prometheusApi.getStackStatus().catch((err) => {
    console.debug('[Dashboard] Prometheus status check failed:', err?.message || err);
    return null;
  });
  const prometheusAvailable = promStatus?.data?.status === 'running';

  // Fetch all data in parallel with error logging
  const [healthRes, deploymentsRes, eventsRes, metricsRes, costRes, recommendationsRes, insightsRes] =
    await Promise.all([
      kubernetesApi.getHealth().catch((err) => {
        logger.warn('Failed to fetch cluster health', err?.response?.status, err?.message);
        return null;
      }),
      kubernetesApi.getDeployments().catch((err) => {
        logger.warn('Failed to fetch deployments', err?.response?.status, err?.message);
        return { data: [] };
      }),
      kubernetesApi.getEvents(undefined, 10).catch((err) => {
        logger.warn('Failed to fetch events', err?.response?.status, err?.message);
        return { data: [] };
      }),
      kubernetesApi.getClusterMetrics().catch((err) => {
        logger.warn('Failed to fetch cluster metrics', err?.response?.status, err?.message);
        return null;
      }),
      costApi.getDashboard().catch((err) => {
        console.debug('[Dashboard] Cost API unavailable:', err?.response?.status);
        return null;
      }),
      optimizationApi.getRecommendations(undefined, undefined, 10).catch((err) => {
        console.debug('[Dashboard] Optimization API unavailable:', err?.response?.status);
        return { data: [] };
      }),
      aiApi.getProactiveInsights().catch((err) => {
        console.debug('[Dashboard] Proactive Insights unavailable:', err?.response?.status);
        return { data: { insights: [], cluster_health_score: 100, total_issues: 0, critical_count: 0, high_count: 0, last_analyzed: new Date().toISOString(), success: false } };
      }),
    ]);

  // Log successful data fetches for debugging
  if (process.env.NODE_ENV === 'development') {
    console.debug('[Dashboard] Data fetch results:', {
      health: healthRes?.data ? 'OK' : 'NULL',
      deployments: deploymentsRes?.data?.length ?? 0,
      events: eventsRes?.data?.length ?? 0,
      metrics: metricsRes?.data ? 'OK' : 'NULL',
      cost: costRes?.data ? 'OK' : 'NULL',
      recommendations: recommendationsRes?.data?.length ?? 0,
      proactiveInsights: insightsRes?.data?.insights?.length ?? 0,
      prometheus: prometheusAvailable,
    });
  }

  let cpuHistory: number[] = [];
  let memoryHistory: number[] = [];

  // Fetch Prometheus metrics if available
  if (prometheusAvailable) {
    const now = new Date();
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const [cpuRes, memRes] = await Promise.all([
      prometheusApi
        .queryRange({
          query: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)',
          start: fifteenMinsAgo.toISOString(),
          end: now.toISOString(),
          step: '60s',
        })
        .catch(() => null),
      prometheusApi
        .queryRange({
          query:
            '(1 - (sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))) * 100',
          start: fifteenMinsAgo.toISOString(),
          end: now.toISOString(),
          step: '60s',
        })
        .catch(() => null),
    ]);

    if (cpuRes?.data?.result?.[0]?.values) {
      cpuHistory = cpuRes.data.result[0].values
        .map((v: { value: string }) => Math.round(parseFloat(v.value)))
        .slice(-15);
    }

    if (memRes?.data?.result?.[0]?.values) {
      memoryHistory = memRes.data.result[0].values
        .map((v: { value: string }) => Math.round(parseFloat(v.value)))
        .slice(-15);
    }
  } else if (metricsRes?.data) {
    // Use K8s metrics for history (simulated)
    const cpuPercent = Math.round(metricsRes.data.cpu_percent || 0);
    const memPercent = Math.round(metricsRes.data.memory_percent || 0);
    cpuHistory = [cpuPercent];
    memoryHistory = [memPercent];
  }

  return {
    clusterHealth: healthRes?.data || null,
    deployments: deploymentsRes?.data || [],
    events: eventsRes?.data || [],
    metrics: metricsRes?.data || null,
    costData: costRes?.data || null,
    recommendations: recommendationsRes?.data || [],
    proactiveInsights: insightsRes?.data?.insights || [],
    prometheusAvailable,
    cpuHistory,
    memoryHistory,
  };
}

/**
 * Dashboard data hook with cluster-aware caching
 * @param clusterId - The active cluster ID to use for cache isolation
 *
 * When clusterId changes, React Query automatically fetches fresh data
 * because the query key includes the cluster ID.
 */
export function useDashboardData(clusterId?: string | null) {
  const queryClient = useQueryClient();
  const effectiveClusterId = clusterId ?? 'default';
  const queryKey = getDashboardQueryKey(effectiveClusterId);

  const query = useQuery({
    queryKey,
    queryFn: fetchDashboardData,
    // Keep data fresh for 15 seconds (reduced from 30s for faster updates)
    staleTime: 15 * 1000,
    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Refetch every 30 seconds in background when component is mounted
    refetchInterval: 30 * 1000,
    // Refetch on window focus to get fresh data when user returns
    refetchOnWindowFocus: true,
    // Retry failed requests
    retry: 2,
    retryDelay: 1000,
  });

  // Force refresh - invalidates cache and refetches immediately
  const refresh = async () => {
    // Remove the cached data to force a fresh fetch
    await queryClient.removeQueries({ queryKey });
    // Then refetch
    await queryClient.refetchQueries({ queryKey });
  };

  // Hard reset - clears all dashboard caches (useful when cluster connection changes)
  const hardReset = async () => {
    await queryClient.removeQueries({ queryKey: ['dashboard'] });
    await queryClient.refetchQueries({ queryKey });
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error,
    refresh,
    hardReset,
  };
}

export default useDashboardData;
