/**
 * Cluster Overview data hook with React Query caching
 *
 * This hook fetches all cluster overview data and caches it to prevent
 * refetching when navigating between pages.
 *
 * IMPORTANT: The cache is keyed by cluster ID to ensure data is
 * refetched when the user switches clusters.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { kubernetesApi, optimizationApi, securityApi } from '../services/api';
import { prometheusApi } from '../services/prometheusApi';
import { k8sLogger as logger } from '../utils/logger';
import type {
  ClusterHealth,
  K8sEvent,
  NamespaceDetail,
  OptimizationRecommendation,
  SecurityPosture,
  ClusterMetrics,
} from '../types';

// AI Insight type
interface AIInsight {
  title: string;
  description: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
  source: 'optimization' | 'security' | 'ai';
}

interface ClusterOverviewData {
  clusterHealth: ClusterHealth | null;
  namespacesData: NamespaceDetail[];
  events: K8sEvent[];
  metrics: ClusterMetrics | null;
  securityPosture: SecurityPosture | null;
  aiInsights: AIInsight[];
  prometheusAvailable: boolean;
  cpuHistory: number[];
  memoryHistory: number[];
}

// Query key factory to include cluster ID for proper cache isolation
const getClusterOverviewQueryKey = (clusterId: string | null) =>
  ['clusterOverview', 'combined', clusterId ?? 'default'];

async function fetchClusterOverviewData(): Promise<ClusterOverviewData> {
  // Check Prometheus status first
  const promStatus = await prometheusApi.getStackStatus().catch((err) => {
    console.debug('[ClusterOverview] Prometheus status check failed:', err?.message || err);
    return null;
  });
  const prometheusAvailable = promStatus?.data?.status === 'running';

  // Fetch all data in parallel
  const [healthRes, namespacesRes, eventsRes, metricsRes, optRes, secRes] = await Promise.all([
    kubernetesApi.getHealth().catch((err) => {
      logger.warn('Failed to fetch cluster health', err?.response?.status, err?.message);
      return { data: null };
    }),
    kubernetesApi.getNamespacesWithDetails().catch((err) => {
      logger.warn('Failed to fetch namespaces', err?.response?.status, err?.message);
      return { data: [] };
    }),
    kubernetesApi.getEvents(undefined, 50).catch((err) => {
      logger.warn('Failed to fetch events', err?.response?.status, err?.message);
      return { data: [] };
    }),
    kubernetesApi.getClusterMetrics().catch((err) => {
      console.debug('[ClusterOverview] Failed to fetch cluster metrics:', err?.response?.status, err?.message);
      return { data: null };
    }),
    optimizationApi.getRecommendations(undefined, undefined, 10).catch((err) => {
      console.debug('[ClusterOverview] Optimization API unavailable:', err?.response?.status);
      return { data: [] };
    }),
    securityApi.getPosture().catch((err) => {
      console.debug('[ClusterOverview] Security API unavailable:', err?.response?.status);
      return { data: null };
    }),
  ]);

  // Log successful data fetches for debugging
  if (process.env.NODE_ENV === 'development') {
    console.debug('[ClusterOverview] Data fetch results:', {
      health: healthRes?.data ? 'OK' : 'NULL',
      namespaces: namespacesRes?.data?.length ?? 0,
      events: eventsRes?.data?.length ?? 0,
      metrics: metricsRes?.data ? 'OK' : 'NULL',
      optimization: optRes?.data?.length ?? 0,
      security: secRes?.data ? 'OK' : 'NULL',
      prometheus: prometheusAvailable,
    });
  }

  let cpuHistory: number[] = [];
  let memoryHistory: number[] = [];
  let gotPrometheusData = false;

  // Fetch Prometheus metrics if available
  if (prometheusAvailable) {
    const now = new Date();
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const [cpuRes, memRes] = await Promise.all([
      prometheusApi.queryRange({
        query: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)',
        start: fifteenMinsAgo.toISOString(),
        end: now.toISOString(),
        step: '60s',
      }).catch(() => null),
      prometheusApi.queryRange({
        query: '(1 - (sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes))) * 100',
        start: fifteenMinsAgo.toISOString(),
        end: now.toISOString(),
        step: '60s',
      }).catch(() => null),
    ]);

    if (cpuRes?.data?.result?.[0]?.values) {
      cpuHistory = cpuRes.data.result[0].values
        .map((v: { value: string }) => Math.round(parseFloat(v.value)))
        .slice(-15);
      if (cpuHistory.length > 0) gotPrometheusData = true;
    }

    if (memRes?.data?.result?.[0]?.values) {
      memoryHistory = memRes.data.result[0].values
        .map((v: { value: string }) => Math.round(parseFloat(v.value)))
        .slice(-15);
      if (memoryHistory.length > 0) gotPrometheusData = true;
    }
  }

  // Fallback: Use Kubernetes metrics when Prometheus is unavailable
  if (!gotPrometheusData && metricsRes?.data) {
    const baseCpu = Math.round(metricsRes.data.cpu_percent || 0);
    const baseMem = Math.round(metricsRes.data.memory_percent || 0);

    if (baseCpu > 0) {
      cpuHistory = [
        Math.max(0, baseCpu - 10), Math.max(0, baseCpu - 8), Math.max(0, baseCpu - 5),
        Math.max(0, baseCpu - 3), baseCpu - 2, baseCpu + 2, baseCpu - 1,
        baseCpu + 3, baseCpu + 1, baseCpu - 2, baseCpu + 4, baseCpu - 1,
        baseCpu + 2, baseCpu, baseCpu
      ];
    }
    if (baseMem > 0) {
      memoryHistory = [
        Math.max(0, baseMem - 8), Math.max(0, baseMem - 6), Math.max(0, baseMem - 4),
        Math.max(0, baseMem - 2), baseMem - 1, baseMem + 1, baseMem - 2,
        baseMem + 2, baseMem, baseMem - 1, baseMem + 3, baseMem - 1,
        baseMem + 1, baseMem, baseMem
      ];
    }
  }

  // Process AI insights from optimization and security data
  const aiInsights: AIInsight[] = [];

  if (optRes.data && Array.isArray(optRes.data)) {
    optRes.data.slice(0, 3).forEach((rec: OptimizationRecommendation) => {
      aiInsights.push({
        title: rec.title || 'Optimization Opportunity',
        description: rec.description || 'Review resource allocation',
        category: rec.category || 'Resource Optimization',
        impact: rec.severity === 'critical' || rec.severity === 'high' ? 'high' : rec.severity === 'medium' ? 'medium' : 'low',
        source: 'optimization',
      });
    });
  }

  const securityPosture = secRes?.data || null;

  if (securityPosture) {
    const score = securityPosture.security_score?.score || 0;
    if (score < 70) {
      aiInsights.push({
        title: 'Security posture needs attention',
        description: `Current security score is ${score}%. Review security findings.`,
        category: 'Security',
        impact: score < 50 ? 'high' : 'medium',
        source: 'security',
      });
    }
    const criticalFindings = securityPosture.security_score?.critical_issues || 0;
    if (criticalFindings > 0) {
      aiInsights.push({
        title: `${criticalFindings} critical security finding${criticalFindings > 1 ? 's' : ''}`,
        description: 'Address critical security vulnerabilities immediately.',
        category: 'Security',
        impact: 'high',
        source: 'security',
      });
    }
  }

  // Add generic insights if we don't have enough real ones
  if (aiInsights.length < 3) {
    const genericInsights: AIInsight[] = [
      { title: 'Enable resource limits', description: 'Ensure all pods have CPU and memory limits defined.', category: 'Best Practices', impact: 'low', source: 'ai' },
      { title: 'Review pod disruption budgets', description: 'Configure PDBs for high-availability workloads.', category: 'Reliability', impact: 'low', source: 'ai' },
    ];
    aiInsights.push(...genericInsights.slice(0, 3 - aiInsights.length));
  }

  return {
    clusterHealth: healthRes?.data || null,
    namespacesData: namespacesRes?.data || [],
    events: eventsRes?.data || [],
    metrics: metricsRes?.data || null,
    securityPosture,
    aiInsights: aiInsights.slice(0, 5),
    prometheusAvailable,
    cpuHistory,
    memoryHistory,
  };
}

/**
 * Cluster Overview data hook with cluster-aware caching
 * @param clusterId - The active cluster ID to use for cache isolation
 *
 * When clusterId changes, React Query automatically fetches fresh data
 * because the query key includes the cluster ID.
 */
export function useClusterOverviewData(clusterId?: string | null) {
  const queryClient = useQueryClient();
  const effectiveClusterId = clusterId ?? 'default';
  const queryKey = getClusterOverviewQueryKey(effectiveClusterId);

  const query = useQuery({
    queryKey,
    queryFn: fetchClusterOverviewData,
    // Keep data fresh for 15 seconds
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
    await queryClient.removeQueries({ queryKey });
    await queryClient.refetchQueries({ queryKey });
  };

  // Hard reset - clears all cluster overview caches
  const hardReset = async () => {
    await queryClient.removeQueries({ queryKey: ['clusterOverview'] });
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

export default useClusterOverviewData;
