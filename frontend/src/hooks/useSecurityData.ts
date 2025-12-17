/**
 * Security data hooks with React Query caching
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// Types for security data
interface SecurityScore {
  score: number;
  grade: string;
  total_findings: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  last_scan: string;
}

interface VulnerabilitySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unknown: number;
  total: number;
}

interface SecurityFinding {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  resource_type: string;
  resource_name: string;
  namespace: string;
  recommendation?: string;
  cve_id?: string;
  can_auto_remediate: boolean;
}

interface SecurityDashboardData {
  security_score: SecurityScore;
  vulnerability_summary: VulnerabilitySummary;
  top_findings: SecurityFinding[];
  compliance_summary: {
    passed: number;
    failed: number;
    total: number;
  };
  risky_namespaces: string[];
  total_images_scanned: number;
  last_scan: string;
}

interface RBACSummary {
  total_service_accounts: number;
  risky_service_accounts: number;
  total_role_bindings: number;
  risky_role_bindings: number;
  cluster_admin_bindings: number;
  wildcard_permissions: number;
  risk_level: string;
  recommendations: string[];
  analyzed_at: string;
}

interface NetworkPolicySummary {
  total_namespaces: number;
  protected_namespaces: number;
  partial_namespaces: number;
  unprotected_namespaces: number;
  total_pods: number;
  covered_pods: number;
  coverage_percentage: number;
  status: string;
  recommendations: string[];
  analyzed_at: string;
}

interface TrendsSummary {
  current_score: number;
  current_vulnerabilities: number;
  score_change_7d: number;
  score_change_30d: number;
  vulnerabilities_fixed_7d: number;
  vulnerabilities_new_7d: number;
  trend_direction: string;
  trend_icon: string;
  data_points: number;
  generated_at: string;
}

interface CombinedSecurityData {
  dashboard: SecurityDashboardData | null;
  rbacSummary: RBACSummary | null;
  networkPolicySummary: NetworkPolicySummary | null;
  trendsSummary: TrendsSummary | null;
}

// Query key factory to include cluster ID for proper cache isolation
const getSecurityQueryKey = (clusterId: string | null) =>
  ['security', 'combined', clusterId ?? 'default'];

async function fetchSecurityData(): Promise<CombinedSecurityData> {
  // Fetch all security data in parallel with debug logging
  const [dashboardRes, rbacRes, netPolRes, trendsRes] = await Promise.all([
    api.get<SecurityDashboardData>('/security/dashboard').catch((err) => {
      console.debug('[Security] Dashboard fetch failed:', err?.response?.status, err?.message);
      return { data: null };
    }),
    api.get<RBACSummary>('/security/rbac/summary').catch((err) => {
      console.debug('[Security] RBAC summary fetch failed:', err?.response?.status, err?.message);
      return { data: null };
    }),
    api.get<NetworkPolicySummary>('/security/network-policies/summary').catch((err) => {
      console.debug('[Security] Network policies fetch failed:', err?.response?.status, err?.message);
      return { data: null };
    }),
    api.get<TrendsSummary>('/security/trends/summary').catch((err) => {
      console.debug('[Security] Trends fetch failed:', err?.response?.status, err?.message);
      return { data: null };
    }),
  ]);

  // Log results for debugging
  if (process.env.NODE_ENV === 'development') {
    console.debug('[Security] Data fetch results:', {
      dashboard: dashboardRes.data ? 'OK' : 'NULL',
      rbac: rbacRes.data ? 'OK' : 'NULL',
      networkPolicy: netPolRes.data ? 'OK' : 'NULL',
      trends: trendsRes.data ? 'OK' : 'NULL',
    });
  }

  return {
    dashboard: dashboardRes.data,
    rbacSummary: rbacRes.data,
    networkPolicySummary: netPolRes.data,
    trendsSummary: trendsRes.data,
  };
}

/**
 * Security dashboard data hook with cluster-aware caching
 * @param clusterId - The active cluster ID to use for cache isolation
 */
export function useSecurityDashboard(clusterId?: string | null) {
  const queryClient = useQueryClient();
  const effectiveClusterId = clusterId ?? 'default';
  const queryKey = getSecurityQueryKey(effectiveClusterId);

  const query = useQuery({
    queryKey,
    queryFn: fetchSecurityData,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });

  const refresh = async () => {
    await queryClient.removeQueries({ queryKey });
    await queryClient.refetchQueries({ queryKey });
  };

  // Hard reset - clears all security caches
  const hardReset = async () => {
    await queryClient.removeQueries({ queryKey: ['security'] });
    await queryClient.refetchQueries({ queryKey });
  };

  return {
    data: query.data,
    dashboard: query.data?.dashboard ?? null,
    rbacSummary: query.data?.rbacSummary ?? null,
    networkPolicySummary: query.data?.networkPolicySummary ?? null,
    trendsSummary: query.data?.trendsSummary ?? null,
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error,
    refresh,
    hardReset,
  };
}

export default useSecurityDashboard;

// Export types for use in components
export type {
  SecurityDashboardData,
  SecurityScore,
  VulnerabilitySummary,
  SecurityFinding,
  RBACSummary,
  NetworkPolicySummary,
  TrendsSummary,
  CombinedSecurityData,
};
