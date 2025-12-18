// Cost Management Types

export interface CostBreakdown {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  gpu: number;
  total: number;
}

export interface NamespaceCost {
  namespace: string;
  costs: CostBreakdown;
  pod_count: number;
  deployment_count: number;
  percentage_of_total: number;
}

export interface PodCost {
  name: string;
  namespace: string;
  costs: CostBreakdown;
  cpu_request: string;
  cpu_limit: string;
  memory_request: string;
  memory_limit: string;
  age: string;
  owner_kind?: string;
  owner_name?: string;
}

export interface CostTrend {
  timestamp: string;
  costs: CostBreakdown;
}

export interface CostRecommendation {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  resource_type: string;
  resource_name: string;
  namespace: string;
  current_cost: number;
  estimated_savings: number;
  percentage_savings: number;
  action: string;
}

export interface ResourceEfficiency {
  name: string;
  namespace: string;
  resource_type: string;
  requested: number;
  used: number;
  limit: number;
  efficiency_percentage: number;
  waste_cost: number;
}

export interface CostDashboardResponse {
  summary: {
    total_cost: CostBreakdown;
    cost_by_namespace: NamespaceCost[];
    cost_trend: CostTrend[];
    recommendations: CostRecommendation[];
    top_costly_pods: PodCost[];
  };
  namespace_breakdown: NamespaceCost[];
  recommendations: CostRecommendation[];
  efficiency_metrics: ResourceEfficiency[];
  total_monthly_estimate: number;
  total_annual_estimate: number;
}
