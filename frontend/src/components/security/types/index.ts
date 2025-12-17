// Security Dashboard Types

export interface SecurityScore {
  score: number;
  grade: string;
  total_findings: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  last_scan: string;
}

export interface VulnerabilitySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unknown: number;
  total: number;
}

export interface SecurityFinding {
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

export interface VulnerabilityDetail {
  vulnerability_id: string;
  pkg_name: string;
  installed_version: string;
  fixed_version?: string;
  severity: string;
  title?: string;
  description?: string;
  cvss_score?: number;
  published_date?: string;
  references?: string[];
}

export interface ImageScanResult {
  image: string;
  vulnerabilities: VulnerabilitySummary;
  vulnerability_details: VulnerabilityDetail[];
  scan_time: string;
}

export interface SecurityDashboardData {
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

export interface RBACSummary {
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

export interface ServiceAccountRisk {
  name: string;
  namespace: string;
  risk_level: string;
  issues: string[];
  has_cluster_admin: boolean;
  has_secrets_access: boolean;
  has_wildcard_permissions: boolean;
  bound_roles: string[];
  pods_using: string[];
}

export interface RoleBindingRisk {
  name: string;
  namespace: string | null;
  binding_type: string;
  role_name: string;
  role_kind: string;
  subjects: { kind: string; name: string; namespace: string }[];
  risk_level: string;
  issues: string[];
  is_cluster_admin: boolean;
  grants_secrets_access: boolean;
  grants_wildcard: boolean;
}

export interface RBACAnalysisDetail {
  total_service_accounts: number;
  risky_service_accounts: number;
  total_role_bindings: number;
  risky_role_bindings: number;
  cluster_admin_bindings: number;
  wildcard_permissions: number;
  service_account_risks: ServiceAccountRisk[];
  role_binding_risks: RoleBindingRisk[];
  recommendations: string[];
  analyzed_at: string;
}

export interface NetworkPolicySummary {
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

export interface NamespaceNetworkPolicy {
  namespace: string;
  status: string;
  policy_count: number;
  policies: string[];
  pods_total: number;
  pods_covered: number;
  pods_uncovered: string[];
  has_default_deny_ingress: boolean;
  has_default_deny_egress: boolean;
}

export interface NetworkPolicyDetail {
  total_namespaces: number;
  protected_namespaces: number;
  partial_namespaces: number;
  unprotected_namespaces: number;
  total_pods: number;
  covered_pods: number;
  coverage_percentage: number;
  namespaces: NamespaceNetworkPolicy[];
  recommendations: string[];
  analyzed_at: string;
}

export interface TrendsSummary {
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

export interface SecurityTrendPoint {
  timestamp: string;
  security_score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_vulnerabilities: number;
  images_scanned: number;
}

export interface SecurityTrendsDetail {
  trend_data: SecurityTrendPoint[];
  score_change_7d: number;
  score_change_30d: number;
  vulnerabilities_fixed_7d: number;
  vulnerabilities_new_7d: number;
  trend_direction: string;
  generated_at: string;
}

export interface AIRemediationResponse {
  status: string;
  ai_powered: boolean;
  finding: {
    type: string;
    severity: string;
    title: string;
    resource?: string;
    namespace?: string;
  };
  remediation: {
    priority?: string;
    steps?: string[];
    commands?: string[];
    yaml_example?: string;
    prevention?: string[];
    generated_at: string;
    analysis?: string;
  };
  note?: string;
}
