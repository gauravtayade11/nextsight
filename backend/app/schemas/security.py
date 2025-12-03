from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SeverityLevel(str, Enum):
    """Vulnerability severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"


class SecurityFindingType(str, Enum):
    """Types of security findings."""

    VULNERABILITY = "vulnerability"
    MISCONFIGURATION = "misconfiguration"
    COMPLIANCE = "compliance"
    SECRET = "secret"
    POLICY_VIOLATION = "policy_violation"


class SecurityFinding(BaseModel):
    """A security finding/issue."""

    id: str
    type: SecurityFindingType
    severity: SeverityLevel
    title: str
    description: str
    resource_type: str  # pod, deployment, service, etc.
    resource_name: str
    namespace: str
    recommendation: Optional[str] = None
    cve_id: Optional[str] = None
    cvss_score: Optional[float] = None
    fixed_version: Optional[str] = None
    detected_at: datetime
    can_auto_remediate: bool = False


class VulnerabilitySummary(BaseModel):
    """Summary of vulnerabilities by severity."""

    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    unknown: int = 0
    total: int = 0


class VulnerabilityDetail(BaseModel):
    """Detailed information about a specific vulnerability."""

    vulnerability_id: str  # CVE-2023-1234 or GHSA-xxx
    pkg_name: str  # Package name
    installed_version: str
    fixed_version: Optional[str] = None
    severity: SeverityLevel
    title: Optional[str] = None
    description: Optional[str] = None
    cvss_score: Optional[float] = None
    published_date: Optional[str] = None
    references: List[str] = []


class ImageScanResult(BaseModel):
    """Result of scanning a container image."""

    image: str
    tag: str
    digest: Optional[str] = None
    vulnerabilities: VulnerabilitySummary
    vulnerability_details: List[VulnerabilityDetail] = []  # NEW: Actual CVE details
    scan_date: datetime
    os_family: Optional[str] = None
    os_name: Optional[str] = None


class PodSecurityCheck(BaseModel):
    """Pod security standard check result."""

    pod_name: str
    namespace: str
    runs_as_root: bool = False
    privileged_containers: List[str] = []
    host_network: bool = False
    host_pid: bool = False
    host_ipc: bool = False
    capabilities_added: List[str] = []
    read_only_root_filesystem: bool = True
    security_score: int = 100


class ComplianceCheck(BaseModel):
    """Compliance check result."""

    check_id: str
    category: str
    description: str
    passed: bool
    severity: SeverityLevel
    remediation: Optional[str] = None
    affected_resources: List[str] = []


class SecurityScore(BaseModel):
    """Overall security score."""

    score: int = Field(..., ge=0, le=100, description="Security score from 0-100")
    grade: str = Field(..., description="Letter grade: A, B, C, D, F")
    total_findings: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    last_scan: datetime

    @staticmethod
    def calculate_grade(score: int) -> str:
        """Calculate letter grade from score."""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"


class SecurityPosture(BaseModel):
    """Complete security posture for a cluster."""

    cluster_id: str
    security_score: SecurityScore
    vulnerabilities: VulnerabilitySummary
    findings: List[SecurityFinding]
    pod_security_checks: List[PodSecurityCheck]
    compliance_checks: List[ComplianceCheck]
    image_scans: List[ImageScanResult]
    recommendations: List[str]
    last_updated: datetime


class SecurityDashboardResponse(BaseModel):
    """Security dashboard summary."""

    security_score: SecurityScore
    vulnerability_summary: VulnerabilitySummary
    top_findings: List[SecurityFinding]
    compliance_summary: Dict[str, int]
    risky_namespaces: List[str]
    total_images_scanned: int
    last_scan: datetime


class RemediationRequest(BaseModel):
    """Request to remediate a security finding."""

    finding_id: str
    auto_apply: bool = False
    approved_by: Optional[str] = None


# ============== RBAC Analysis ==============


class RBACRiskLevel(str, Enum):
    """RBAC risk levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ServiceAccountRisk(BaseModel):
    """Service account security risk analysis."""

    name: str
    namespace: str
    risk_level: RBACRiskLevel
    issues: List[str]
    has_cluster_admin: bool = False
    has_secrets_access: bool = False
    has_wildcard_permissions: bool = False
    bound_roles: List[str] = []
    pods_using: List[str] = []


class RoleBindingRisk(BaseModel):
    """Role binding security risk analysis."""

    name: str
    namespace: Optional[str]  # None for ClusterRoleBinding
    binding_type: str  # RoleBinding or ClusterRoleBinding
    role_name: str
    role_kind: str  # Role or ClusterRole
    subjects: List[Dict[str, str]]  # kind, name, namespace
    risk_level: RBACRiskLevel
    issues: List[str]
    is_cluster_admin: bool = False
    grants_secrets_access: bool = False
    grants_wildcard: bool = False


class RBACAnalysis(BaseModel):
    """Complete RBAC security analysis."""

    total_service_accounts: int
    risky_service_accounts: int
    total_role_bindings: int
    risky_role_bindings: int
    cluster_admin_bindings: int
    wildcard_permissions: int
    service_account_risks: List[ServiceAccountRisk]
    role_binding_risks: List[RoleBindingRisk]
    recommendations: List[str]
    analyzed_at: datetime


# ============== Network Policy Coverage ==============


class NetworkPolicyStatus(str, Enum):
    """Network policy coverage status."""

    PROTECTED = "protected"
    PARTIAL = "partial"
    UNPROTECTED = "unprotected"


class NamespaceNetworkPolicy(BaseModel):
    """Network policy coverage for a namespace."""

    namespace: str
    status: NetworkPolicyStatus
    policy_count: int
    policies: List[str]
    pods_total: int
    pods_covered: int
    pods_uncovered: List[str]
    has_default_deny_ingress: bool = False
    has_default_deny_egress: bool = False


class NetworkPolicyCoverage(BaseModel):
    """Complete network policy coverage analysis."""

    total_namespaces: int
    protected_namespaces: int
    partial_namespaces: int
    unprotected_namespaces: int
    total_pods: int
    covered_pods: int
    coverage_percentage: float
    namespaces: List[NamespaceNetworkPolicy]
    recommendations: List[str]
    analyzed_at: datetime


# ============== Security Trends ==============


class SecurityTrendPoint(BaseModel):
    """A single point in security trend data."""

    timestamp: datetime
    security_score: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    total_vulnerabilities: int
    images_scanned: int


class SecurityTrends(BaseModel):
    """Security trends over time."""

    trend_data: List[SecurityTrendPoint]
    score_change_7d: int  # Change in last 7 days
    score_change_30d: int  # Change in last 30 days
    vulnerabilities_fixed_7d: int
    vulnerabilities_new_7d: int
    trend_direction: str  # improving, stable, declining
    generated_at: datetime


# ============== Extended Dashboard Response ==============


class SecurityDashboardExtended(BaseModel):
    """Extended security dashboard with all features."""

    security_score: SecurityScore
    vulnerability_summary: VulnerabilitySummary
    top_findings: List[SecurityFinding]
    compliance_summary: Dict[str, int]
    risky_namespaces: List[str]
    total_images_scanned: int
    last_scan: datetime
    # New fields
    rbac_summary: Optional[Dict[str, Any]] = None
    network_policy_summary: Optional[Dict[str, Any]] = None
    trends_summary: Optional[Dict[str, Any]] = None
