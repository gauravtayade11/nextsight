// Resource Optimization Types

export type OptimizationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type OptimizationType = 'over_provisioned' | 'under_provisioned' | 'idle_resource' | 'no_limits' | 'no_requests' | 'memory_leak_risk' | 'cpu_throttling' | 'right_sizing';

export interface EfficiencyScore {
  score: number;
  grade: string;
  status: string;
}

export interface ContainerOptimization {
  container_name: string;
  cpu_usage_millicores: number;
  cpu_request_millicores: number;
  cpu_limit_millicores: number;
  memory_usage_bytes: number;
  memory_request_bytes: number;
  memory_limit_bytes: number;
  cpu_efficiency: number;
  memory_efficiency: number;
  cpu_recommendation_millicores?: number;
  memory_recommendation_bytes?: number;
}

export interface PodOptimization {
  name: string;
  namespace: string;
  owner_kind?: string;
  owner_name?: string;
  containers: ContainerOptimization[];
  total_cpu_usage_millicores: number;
  total_cpu_request_millicores: number;
  total_cpu_limit_millicores: number;
  total_memory_usage_bytes: number;
  total_memory_request_bytes: number;
  total_memory_limit_bytes: number;
  cpu_efficiency: EfficiencyScore;
  memory_efficiency: EfficiencyScore;
  overall_efficiency: EfficiencyScore;
  recommendations: string[];
  optimization_type?: OptimizationType;
  severity: OptimizationSeverity;
  current_hourly_cost: number;
  optimized_hourly_cost: number;
  potential_savings: number;
  savings_percentage: number;
}

export interface NamespaceOptimization {
  namespace: string;
  pod_count: number;
  optimized_pods: number;
  over_provisioned_pods: number;
  under_provisioned_pods: number;
  idle_pods: number;
  avg_cpu_efficiency: number;
  avg_memory_efficiency: number;
  overall_efficiency: EfficiencyScore;
  current_hourly_cost: number;
  potential_hourly_savings: number;
  savings_percentage: number;
}

export interface OptimizationRecommendation {
  id: string;
  type: OptimizationType;
  severity: OptimizationSeverity;
  title: string;
  description: string;
  resource_kind: string;
  resource_name: string;
  namespace: string;
  container_name?: string;
  current_cpu_request?: string;
  current_cpu_limit?: string;
  current_memory_request?: string;
  current_memory_limit?: string;
  recommended_cpu_request?: string;
  recommended_cpu_limit?: string;
  recommended_memory_request?: string;
  recommended_memory_limit?: string;
  current_cost: number;
  estimated_savings: number;
  savings_percentage: number;
  risk_level: string;
  action: string;
  yaml_patch?: string;
  created_at: string;
}

export interface ClusterOptimizationSummary {
  total_pods: number;
  analyzed_pods: number;
  optimal_pods: number;
  over_provisioned_pods: number;
  under_provisioned_pods: number;
  idle_pods: number;
  no_limits_pods: number;
  no_requests_pods: number;
  avg_cpu_efficiency: number;
  avg_memory_efficiency: number;
  cluster_efficiency_score: EfficiencyScore;
  total_current_hourly_cost: number;
  total_potential_savings: number;
  total_savings_percentage: number;
  total_cpu_requested_millicores: number;
  total_cpu_used_millicores: number;
  total_memory_requested_bytes: number;
  total_memory_used_bytes: number;
}

export interface OptimizationDashboardResponse {
  summary: ClusterOptimizationSummary;
  namespace_breakdown: NamespaceOptimization[];
  top_wasteful_pods: PodOptimization[];
  top_underprovisioned_pods: PodOptimization[];
  recommendations: OptimizationRecommendation[];
  idle_resources: PodOptimization[];
  analyzed_at: string;
}

// Apply Optimization types
export interface ApplyOptimizationRequest {
  namespace: string;
  resource_kind: string;
  resource_name: string;
  container_name: string;
  cpu_request?: string;
  cpu_limit?: string;
  memory_request?: string;
  memory_limit?: string;
  dry_run?: boolean;
}

export interface ApplyOptimizationResponse {
  success: boolean;
  message: string;
  dry_run: boolean;
  resource_kind: string;
  resource_name: string;
  namespace: string;
  changes_applied: Record<string, Record<string, string>>;
  previous_values: Record<string, Record<string, string>>;
  yaml_diff?: string;
}

// AI Optimization Analysis types
export interface AIOptimizationAnalysisRequest {
  namespace?: string;
  focus_area?: 'efficiency' | 'performance' | 'reliability';
}

export interface AIOptimizationAnalysisResponse {
  analysis: string;
  key_findings: string[];
  priority_actions: Array<{ action: string; priority: string }>;
  efficiency_improvement_percent: number;  // Waste reduction percentage (primary metric)
  estimated_monthly_impact: number;  // Cost impact estimate (non-billing)
  success: boolean;
}
