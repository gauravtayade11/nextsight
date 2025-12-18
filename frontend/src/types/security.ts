// Security Types

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';
export type SecurityFindingType = 'vulnerability' | 'misconfiguration' | 'compliance' | 'secret' | 'policy_violation';

export interface SecurityScore {
  score: number;
  grade: string;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  last_updated: string;
}

export interface SecurityFinding {
  id: string;
  type: SecurityFindingType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  namespace?: string;
  resource_type?: string;
  resource_name?: string;
  cve_id?: string;
  recommendation: string;
  created_at: string;
}

export interface PodSecurityCheck {
  pod_name: string;
  namespace: string;
  runs_as_root: boolean;
  privileged: boolean;
  host_network: boolean;
  host_pid: boolean;
  host_ipc: boolean;
  capabilities_added: string[];
  read_only_root_fs: boolean;
  security_score: number;
  issues: string[];
}

export interface ComplianceCheck {
  id: string;
  category: string;
  name: string;
  description: string;
  passed: boolean;
  severity: SecuritySeverity;
  recommendation?: string;
}

export interface ImageScanResult {
  image: string;
  registry: string;
  tag: string;
  scanned_at: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  vulnerabilities: Array<{
    cve_id: string;
    severity: SecuritySeverity;
    package: string;
    installed_version: string;
    fixed_version?: string;
    title: string;
  }>;
}

export interface RiskyNamespace {
  namespace: string;
  critical_count: number;
  high_count: number;
  medium_count: number;
  total_issues: number;
  risk_score: number;
}

export interface SecurityDashboardResponse {
  security_score: SecurityScore;
  vulnerability_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  top_findings: SecurityFinding[];
  compliance_summary: {
    passed: number;
    failed: number;
    total: number;
    percentage: number;
  };
  risky_namespaces: RiskyNamespace[];
  images_scanned: number;
  last_scan: string;
}

export interface SecurityPosture {
  security_score: SecurityScore;
  findings: SecurityFinding[];
  pod_security_checks: PodSecurityCheck[];
  compliance_checks: ComplianceCheck[];
  image_scans: ImageScanResult[];
  recommendations: string[];
  last_updated: string;
}

export interface RBACAnalysis {
  total_service_accounts: number;
  risky_service_accounts: number;
  total_role_bindings: number;
  risky_role_bindings: number;
  cluster_admin_bindings: number;
  wildcard_permissions: number;
  service_accounts: Array<{
    name: string;
    namespace: string;
    has_cluster_admin: boolean;
    has_wildcard: boolean;
    has_secrets_access: boolean;
    risk_level: string;
  }>;
  recommendations: string[];
  analyzed_at: string;
}

export interface NetworkPolicyCoverage {
  total_namespaces: number;
  protected_namespaces: number;
  partial_namespaces: number;
  unprotected_namespaces: number;
  total_pods: number;
  covered_pods: number;
  coverage_percentage: number;
  namespaces: Array<{
    namespace: string;
    policy_count: number;
    pod_count: number;
    covered_pods: number;
    status: string;
  }>;
  recommendations: string[];
  analyzed_at: string;
}

export interface SecurityTrendPoint {
  timestamp: string;
  security_score: number;
  total_vulnerabilities: number;
  critical_count: number;
  high_count: number;
}

export interface SecurityTrends {
  trend_data: SecurityTrendPoint[];
  score_change_7d: number;
  score_change_30d: number;
  vulnerabilities_fixed_7d: number;
  vulnerabilities_new_7d: number;
  trend_direction: 'improving' | 'stable' | 'declining';
  generated_at: string;
}
