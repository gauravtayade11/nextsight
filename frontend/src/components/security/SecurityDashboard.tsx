import React, { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

interface VulnerabilityDetail {
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

interface ImageScanResult {
  image: string;
  vulnerabilities: VulnerabilitySummary;
  vulnerability_details: VulnerabilityDetail[];
  scan_time: string;
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

// RBAC Analysis interfaces
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

// Detailed RBAC interfaces
interface ServiceAccountRisk {
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

interface RoleBindingRisk {
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

interface RBACAnalysisDetail {
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

// Network Policy interfaces
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

// Detailed Network Policy interfaces
interface NamespaceNetworkPolicy {
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

interface NetworkPolicyDetail {
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

// Security Trends interfaces
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

// Detailed Security Trends interface
interface SecurityTrendPoint {
  timestamp: string;
  security_score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_vulnerabilities: number;
  images_scanned: number;
}

interface SecurityTrendsDetail {
  trend_data: SecurityTrendPoint[];
  score_change_7d: number;
  score_change_30d: number;
  vulnerabilities_fixed_7d: number;
  vulnerabilities_new_7d: number;
  trend_direction: string;
  generated_at: string;
}

// AI Remediation interface - matches backend response structure
interface AIRemediationResponse {
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
    // For rule-based remediation
    priority?: string;
    steps?: string[];
    commands?: string[];
    yaml_example?: string;
    prevention?: string[];
    generated_at: string;
    // For AI-powered remediation
    analysis?: string;
  };
  note?: string;
}

export default function SecurityDashboard() {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [data, setData] = useState<SecurityDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [imageScans, setImageScans] = useState<ImageScanResult[]>([]);
  const [showImageScans, setShowImageScans] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // New security features state
  const [rbacSummary, setRbacSummary] = useState<RBACSummary | null>(null);
  const [networkPolicySummary, setNetworkPolicySummary] = useState<NetworkPolicySummary | null>(null);
  const [trendsSummary, setTrendsSummary] = useState<TrendsSummary | null>(null);
  const [loadingRbac, setLoadingRbac] = useState(false);
  const [loadingNetPol, setLoadingNetPol] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);

  // Detailed data for modals
  const [rbacDetail, setRbacDetail] = useState<RBACAnalysisDetail | null>(null);
  const [networkPolicyDetail, setNetworkPolicyDetail] = useState<NetworkPolicyDetail | null>(null);
  const [trendsDetail, setTrendsDetail] = useState<SecurityTrendsDetail | null>(null);
  const [showRbacModal, setShowRbacModal] = useState(false);
  const [showNetPolModal, setShowNetPolModal] = useState(false);
  const [showTrendsModal, setShowTrendsModal] = useState(false);
  const [loadingRbacDetail, setLoadingRbacDetail] = useState(false);
  const [loadingNetPolDetail, setLoadingNetPolDetail] = useState(false);
  const [loadingTrendsDetail, setLoadingTrendsDetail] = useState(false);

  // AI Remediation state
  const [aiRemediation, setAiRemediation] = useState<AIRemediationResponse | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [loadingAiRemediation, setLoadingAiRemediation] = useState<string | null>(null); // Track by item ID
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showInlineAi, setShowInlineAi] = useState(false); // Show AI response inline in detail modals

  // Copy code to clipboard with feedback
  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Custom code block component for markdown rendering
  const CodeBlock = ({ node, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    const isInline = !match && !codeString.includes('\n') && codeString.length < 50;

    if (!isInline) {
      const language = match ? match[1] : 'bash';
      return (
        <div className="relative group my-4">
          {/* Language badge with gradient */}
          <div className="absolute left-3 top-0 transform -translate-y-1/2 z-10">
            <span className="px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-md shadow-lg shadow-violet-500/20">
              {language.toUpperCase()}
            </span>
          </div>
          {/* Copy button with modern styling */}
          <div className="absolute right-2 top-2 z-10">
            <button
              onClick={() => copyToClipboard(codeString)}
              className={`p-2 rounded-lg transition-all duration-300 flex items-center gap-1.5 ${
                copiedCode === codeString
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-slate-700/80 hover:bg-gradient-to-r hover:from-violet-600 hover:to-cyan-600 text-slate-300 hover:text-white'
              }`}
              title={copiedCode === codeString ? "Copied!" : "Copy code"}
            >
              {copiedCode === codeString ? (
                <>
                  <ClipboardDocumentCheckIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">Copied!</span>
                </>
              ) : (
                <ClipboardDocumentIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          <SyntaxHighlighter
            style={oneDark}
            language={language}
            PreTag="div"
            className="rounded-xl !bg-slate-900 !mt-2 !pt-6 border border-slate-700/50"
            showLineNumbers={codeString.split('\n').length > 3}
            customStyle={{
              margin: 0,
              padding: '1.5rem 1rem 1rem 1rem',
              paddingRight: '4rem',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
            }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }

    // Inline code with gradient background
    return (
      <code className="bg-gradient-to-r from-violet-100 to-cyan-100 dark:from-violet-900/40 dark:to-cyan-900/40 text-violet-800 dark:text-violet-300 px-1.5 py-0.5 rounded-md text-sm font-mono border border-violet-200/50 dark:border-violet-700/50" {...props}>
        {children}
      </code>
    );
  };

  // Custom pre component to handle code blocks properly
  const PreBlock = ({ children }: any) => {
    // Just pass through - the code component handles the styling
    return <>{children}</>;
  };

  // Custom markdown components with modern AI-themed colors
  const markdownComponents = {
    code: CodeBlock,
    pre: PreBlock,
    // H1 - Primary heading with gradient text (AI purple/cyan theme)
    h1: ({ children }: any) => (
      <h1 className="text-xl font-bold mt-6 mb-3 pb-2 border-b-2 border-gradient-to-r from-violet-500 to-cyan-500">
        <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 dark:from-violet-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent">
          {children}
        </span>
      </h1>
    ),
    // H2 - Section headers with cyan/teal (Remediation, Best Practices)
    h2: ({ children }: any) => (
      <h2 className="text-lg font-semibold mt-5 mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-teal-500 rounded-full"></span>
        <span className="text-cyan-700 dark:text-cyan-400">{children}</span>
      </h2>
    ),
    // H3 - Sub-sections with amber/orange
    h3: ({ children }: any) => (
      <h3 className="text-base font-semibold mt-4 mb-2 text-amber-600 dark:text-amber-400 flex items-center gap-2">
        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
        {children}
      </h3>
    ),
    // H4 - Detail headers with pink/rose
    h4: ({ children }: any) => (
      <h4 className="text-sm font-semibold mt-3 mb-1 text-rose-600 dark:text-rose-400">
        {children}
      </h4>
    ),
    // Paragraphs
    p: ({ children }: any) => (
      <p className="text-slate-700 dark:text-slate-300 my-2 leading-relaxed">{children}</p>
    ),
    // Unordered list with gradient bullets
    ul: ({ children }: any) => (
      <ul className="my-3 space-y-2 text-slate-700 dark:text-slate-300">{children}</ul>
    ),
    // Ordered list with gradient numbers
    ol: ({ children }: any) => (
      <ol className="my-3 space-y-2 text-slate-700 dark:text-slate-300 list-none counter-reset-item">{children}</ol>
    ),
    // List items with custom styling
    li: ({ children, ordered }: any) => (
      <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
        <span className="flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"></span>
        <span>{children}</span>
      </li>
    ),
    // Strong/bold with gradient highlight
    strong: ({ children }: any) => (
      <strong className="font-semibold text-violet-700 dark:text-violet-300">{children}</strong>
    ),
    // Emphasis with cyan
    em: ({ children }: any) => (
      <em className="italic text-cyan-600 dark:text-cyan-400 not-italic font-medium">{children}</em>
    ),
    // Blockquote with AI gradient border
    blockquote: ({ children }: any) => (
      <blockquote className="relative my-4 pl-4 py-3 bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-900/20 dark:to-cyan-900/20 rounded-r-lg border-l-4 border-gradient">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 via-purple-500 to-cyan-500 rounded-l"></div>
        <div className="text-slate-600 dark:text-slate-300 italic">{children}</div>
      </blockquote>
    ),
    // Links with gradient hover
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-600 dark:text-violet-400 hover:text-cyan-600 dark:hover:text-cyan-400 underline decoration-violet-300 dark:decoration-violet-600 hover:decoration-cyan-400 transition-colors"
      >
        {children}
      </a>
    ),
    // Horizontal rule with gradient
    hr: () => (
      <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-violet-300 dark:via-violet-600 to-transparent" />
    ),
    // Table with modern styling
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          {children}
        </table>
      </div>
    ),
    // Table header with gradient background
    th: ({ children }: any) => (
      <th className="px-4 py-3 bg-gradient-to-r from-violet-100 to-cyan-100 dark:from-violet-900/40 dark:to-cyan-900/40 text-left text-sm font-semibold text-slate-800 dark:text-slate-200">
        {children}
      </th>
    ),
    // Table cells
    td: ({ children }: any) => (
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
        {children}
      </td>
    ),
  };

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<SecurityDashboardData>('/security/dashboard');
      setData(response.data);
    } catch (err: any) {
      console.error('Error fetching security data:', err);
      setError(err.response?.data?.detail || 'Failed to fetch security data');
    } finally {
      setLoading(false);
    }
  };

  const triggerScan = async () => {
    try {
      setScanning(true);
      await api.post('/security/scan');
      await fetchSecurityData();
    } catch (err: any) {
      console.error('Error triggering scan:', err);
      setError(err.response?.data?.detail || 'Failed to trigger security scan');
    } finally {
      setScanning(false);
    }
  };

  const fetchImageScans = async () => {
    try {
      setLoadingImages(true);
      const response = await api.get<ImageScanResult[]>('/security/image-scans');
      setImageScans(response.data);
      setShowImageScans(true);
    } catch (err: any) {
      console.error('Error fetching image scans:', err);
      setError(err.response?.data?.detail || 'Failed to fetch image scans');
    } finally {
      setLoadingImages(false);
    }
  };

  // Fetch RBAC Analysis
  const fetchRbacSummary = async () => {
    try {
      setLoadingRbac(true);
      const response = await api.get<RBACSummary>('/security/rbac/summary');
      setRbacSummary(response.data);
    } catch (err: any) {
      console.error('Error fetching RBAC summary:', err);
    } finally {
      setLoadingRbac(false);
    }
  };

  // Fetch Network Policy Coverage
  const fetchNetworkPolicySummary = async () => {
    try {
      setLoadingNetPol(true);
      const response = await api.get<NetworkPolicySummary>('/security/network-policies/summary');
      setNetworkPolicySummary(response.data);
    } catch (err: any) {
      console.error('Error fetching network policy summary:', err);
    } finally {
      setLoadingNetPol(false);
    }
  };

  // Fetch Security Trends
  const fetchTrendsSummary = async () => {
    try {
      setLoadingTrends(true);
      const response = await api.get<TrendsSummary>('/security/trends/summary');
      setTrendsSummary(response.data);
    } catch (err: any) {
      console.error('Error fetching trends summary:', err);
    } finally {
      setLoadingTrends(false);
    }
  };

  // Fetch detailed RBAC data for modal
  const fetchRbacDetail = async () => {
    try {
      setLoadingRbacDetail(true);
      const response = await api.get<RBACAnalysisDetail>('/security/rbac');
      setRbacDetail(response.data);
      setShowRbacModal(true);
    } catch (err: any) {
      console.error('Error fetching RBAC details:', err);
      setError(err.response?.data?.detail || 'Failed to fetch RBAC details');
    } finally {
      setLoadingRbacDetail(false);
    }
  };

  // Fetch detailed Network Policy data for modal
  const fetchNetworkPolicyDetail = async () => {
    try {
      setLoadingNetPolDetail(true);
      const response = await api.get<NetworkPolicyDetail>('/security/network-policies');
      setNetworkPolicyDetail(response.data);
      setShowNetPolModal(true);
    } catch (err: any) {
      console.error('Error fetching network policy details:', err);
      setError(err.response?.data?.detail || 'Failed to fetch network policy details');
    } finally {
      setLoadingNetPolDetail(false);
    }
  };

  // Fetch detailed Security Trends data for modal
  const fetchTrendsDetail = async () => {
    try {
      setLoadingTrendsDetail(true);
      const response = await api.get<SecurityTrendsDetail>('/security/trends?days=30');
      setTrendsDetail(response.data);
      setShowTrendsModal(true);
    } catch (err: any) {
      console.error('Error fetching trends details:', err);
      setError(err.response?.data?.detail || 'Failed to fetch trends details');
    } finally {
      setLoadingTrendsDetail(false);
    }
  };

  // Fetch AI remediation for a security finding (shows inline in detail modal)
  const fetchAiRemediation = async (finding: SecurityFinding) => {
    // Prevent multiple requests
    if (loadingAiRemediation) return;

    const loadingId = `finding-${finding.id}`;
    try {
      // Clear previous data and show inline AI section
      setShowAiModal(false);
      setAiRemediation(null);
      setLoadingAiRemediation(loadingId);
      setAiError(null);
      setShowInlineAi(true); // Show inline in detail modal

      const response = await api.post<AIRemediationResponse>('/security/ai-remediate', {
        finding_type: finding.type,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        resource_type: finding.resource_type,
        resource_name: finding.resource_name,
        namespace: finding.namespace,
        cve_id: finding.cve_id,
      });
      setAiRemediation(response.data);
      // Don't open separate modal - show inline in detail modal
    } catch (err: any) {
      console.error('Error fetching AI remediation:', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  // Fetch AI remediation for RBAC service account issues
  const fetchAiRemediationForServiceAccount = async (sa: ServiceAccountRisk) => {
    // Prevent multiple requests
    if (loadingAiRemediation) return;

    const loadingId = `sa-${sa.namespace}-${sa.name}`;
    try {
      // Close any existing modal and clear previous data
      setShowAiModal(false);
      setAiRemediation(null);
      setLoadingAiRemediation(loadingId);
      setAiError(null);

      const response = await api.post<AIRemediationResponse>('/security/ai-remediate', {
        finding_type: 'rbac',
        severity: sa.risk_level,
        title: `Risky Service Account: ${sa.name}`,
        description: `Service account ${sa.name} in namespace ${sa.namespace} has security issues: ${sa.issues.join(', ')}`,
        resource_type: 'ServiceAccount',
        resource_name: sa.name,
        namespace: sa.namespace,
        additional_context: `Has cluster-admin: ${sa.has_cluster_admin}, Has secrets access: ${sa.has_secrets_access}, Has wildcard: ${sa.has_wildcard_permissions}. Bound roles: ${sa.bound_roles.join(', ')}`,
      });
      setAiRemediation(response.data);
      setShowAiModal(true);
    } catch (err: any) {
      console.error('Error fetching AI remediation:', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  // Fetch AI remediation for RBAC role binding issues
  const fetchAiRemediationForRoleBinding = async (rb: RoleBindingRisk) => {
    // Prevent multiple requests
    if (loadingAiRemediation) return;

    const loadingId = `rb-${rb.namespace || 'cluster'}-${rb.name}`;
    try {
      // Close any existing modal and clear previous data
      setShowAiModal(false);
      setAiRemediation(null);
      setLoadingAiRemediation(loadingId);
      setAiError(null);

      const response = await api.post<AIRemediationResponse>('/security/ai-remediate', {
        finding_type: 'rbac',
        severity: rb.risk_level,
        title: `Risky Role Binding: ${rb.name}`,
        description: `${rb.binding_type} ${rb.name} binding ${rb.role_kind}/${rb.role_name} has security issues: ${rb.issues.join(', ')}`,
        resource_type: rb.binding_type,
        resource_name: rb.name,
        namespace: rb.namespace || 'cluster-wide',
        additional_context: `Is cluster-admin: ${rb.is_cluster_admin}, Grants secrets: ${rb.grants_secrets_access}, Grants wildcard: ${rb.grants_wildcard}. Subjects: ${rb.subjects.map(s => `${s.kind}:${s.name}`).join(', ')}`,
      });
      setAiRemediation(response.data);
      setShowAiModal(true);
    } catch (err: any) {
      console.error('Error fetching AI remediation:', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  // Fetch AI remediation for Network Policy issues
  const fetchAiRemediationForNetworkPolicy = async (ns: NamespaceNetworkPolicy) => {
    // Prevent multiple requests
    if (loadingAiRemediation) return;

    const loadingId = `netpol-${ns.namespace}`;
    try {
      // Close any existing modal and clear previous data
      setShowAiModal(false);
      setAiRemediation(null);
      setLoadingAiRemediation(loadingId);
      setAiError(null);

      const response = await api.post<AIRemediationResponse>('/security/ai-remediate', {
        finding_type: 'network_policy',
        severity: ns.status === 'unprotected' ? 'high' : 'medium',
        title: `Namespace lacks network policy: ${ns.namespace}`,
        description: `Namespace ${ns.namespace} has ${ns.policy_count} network policies. Status: ${ns.status}. ${ns.pods_uncovered.length} pods are not covered by any network policy.`,
        resource_type: 'Namespace',
        resource_name: ns.namespace,
        namespace: ns.namespace,
        additional_context: `Default deny ingress: ${ns.has_default_deny_ingress}, Default deny egress: ${ns.has_default_deny_egress}. Uncovered pods: ${ns.pods_uncovered.slice(0, 5).join(', ')}${ns.pods_uncovered.length > 5 ? '...' : ''}`,
      });
      setAiRemediation(response.data);
      setShowAiModal(true);
    } catch (err: any) {
      console.error('Error fetching AI remediation:', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  // Fetch AI remediation for Image Vulnerability
  const fetchAiRemediationForVulnerability = async (vuln: VulnerabilityDetail, imageName: string) => {
    // Prevent multiple requests
    if (loadingAiRemediation) return;

    const loadingId = `vuln-${vuln.vulnerability_id}`;
    try {
      // Close any existing modal and clear previous data
      setShowAiModal(false);
      setAiRemediation(null);
      setLoadingAiRemediation(loadingId);
      setAiError(null);

      const response = await api.post<AIRemediationResponse>('/security/ai-remediate', {
        finding_type: 'vulnerability',
        severity: vuln.severity,
        title: vuln.title || `Vulnerability in ${vuln.pkg_name}`,
        description: vuln.description || `${vuln.vulnerability_id} found in package ${vuln.pkg_name} version ${vuln.installed_version}`,
        resource_type: 'Container Image',
        resource_name: imageName,
        cve_id: vuln.vulnerability_id,
        additional_context: `Package: ${vuln.pkg_name}, Installed: ${vuln.installed_version}, Fixed in: ${vuln.fixed_version || 'No fix available'}${vuln.cvss_score ? `, CVSS: ${vuln.cvss_score}` : ''}`,
      });
      setAiRemediation(response.data);
      setShowAiModal(true);
    } catch (err: any) {
      console.error('Error fetching AI remediation:', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    // Also fetch the new security data
    fetchRbacSummary();
    fetchNetworkPolicySummary();
    fetchTrendsSummary();
  }, []);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 dark:text-green-400';
      case 'B': return 'text-blue-600 dark:text-blue-400';
      case 'C': return 'text-yellow-600 dark:text-yellow-400';
      case 'D': return 'text-orange-600 dark:text-orange-400';
      case 'F': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
          <XCircleIcon className="h-5 w-5" />
          <span>{error || 'Failed to load security data'}</span>
        </div>
      </div>
    );
  }

  const { security_score, vulnerability_summary, top_findings, compliance_summary, risky_namespaces } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Posture Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time security analysis of your Kubernetes cluster
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg transition-colors"
          >
            <InformationCircleIcon className="h-5 w-5" />
            Help
          </button>
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            <ArrowPathIcon className={`h-5 w-5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Run New Scan'}
          </button>
        </div>
      </div>

      {/* Quick Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900 dark:text-blue-300">
            <p className="font-semibold mb-1">What is Security Posture?</p>
            <p>
              This dashboard shows your cluster's security health by scanning for misconfigurations, vulnerabilities,
              and compliance issues. A score of 100 (Grade A) means perfect security. Lower scores indicate security
              risks that need attention. Click on any finding for detailed remediation steps.
            </p>
          </div>
        </div>
      </div>

      {/* Security Score Card */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Overall Security Score</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your cluster's security health rated from 0-100 based on detected issues
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`text-7xl font-bold ${getGradeColor(security_score.grade)}`}>
                {security_score.grade}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Grade</div>
            </div>
            <div className="border-l border-gray-200 dark:border-slate-700 pl-6">
              <div className="flex items-center gap-2 mb-2">
                <div className={`text-4xl font-bold ${
                  security_score.score >= 90 ? 'text-green-600 dark:text-green-400' :
                  security_score.score >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {security_score.score}
                </div>
                <span className="text-2xl text-gray-400 dark:text-gray-500">/100</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {security_score.total_findings} security {security_score.total_findings === 1 ? 'issue' : 'issues'} detected
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <ClockIcon className="h-4 w-4" />
                <span>Scanned {new Date(security_score.last_scan).toLocaleString()}</span>
              </div>
              {security_score.score < 70 && (
                <div className="mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-400">
                  ⚠️ Action needed: Your cluster has critical security issues
                </div>
              )}
              {security_score.score >= 70 && security_score.score < 90 && (
                <div className="mt-3 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-400">
                  💡 Good progress: Address remaining issues to improve security
                </div>
              )}
              {security_score.score >= 90 && (
                <div className="mt-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-800 dark:text-green-400">
                  ✅ Excellent: Your cluster security is in great shape!
                </div>
              )}
            </div>
          </div>

          {/* Issue Breakdown */}
          <div className="border-l border-gray-200 dark:border-slate-700 pl-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Issues by Severity</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Critical</span>
                </div>
                <span className="text-xl font-bold text-red-600 dark:text-red-400 min-w-[3rem] text-right">
                  {security_score.critical_issues}
                </span>
              </div>
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">High</span>
                </div>
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400 min-w-[3rem] text-right">
                  {security_score.high_issues}
                </span>
              </div>
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Medium</span>
                </div>
                <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400 min-w-[3rem] text-right">
                  {security_score.medium_issues}
                </span>
              </div>
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Low</span>
                </div>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400 min-w-[3rem] text-right">
                  {security_score.low_issues}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Vulnerabilities */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Vulnerabilities</h3>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
            Security flaws in container images (CVEs) that could be exploited
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Critical</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {vulnerability_summary.critical}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">High</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {vulnerability_summary.high}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Medium</span>
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                {vulnerability_summary.medium}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Low</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {vulnerability_summary.low}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-gray-900 dark:text-white">{vulnerability_summary.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Compliance</h3>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
            CIS Kubernetes Benchmark checks for security best practices
          </p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Compliance Rate</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {compliance_summary.total > 0
                    ? Math.round((compliance_summary.passed / compliance_summary.total) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      compliance_summary.total > 0
                        ? (compliance_summary.passed / compliance_summary.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-green-600 dark:text-green-400">Passed</span>
                <span className="font-semibold">{compliance_summary.passed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-600 dark:text-red-400">Failed</span>
                <span className="font-semibold">{compliance_summary.failed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total Checks</span>
                <span className="font-semibold">{compliance_summary.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Risky Namespaces */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldExclamationIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Risky Namespaces</h3>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
            Namespaces with the most security issues requiring attention
          </p>
          <div className="space-y-2">
            {risky_namespaces.length > 0 ? (
              risky_namespaces.map((ns, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded text-sm"
                >
                  <span className="text-gray-900 dark:text-white font-mono">{ns}</span>
                  <span className="text-red-600 dark:text-red-400 text-xs">High Risk</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
                No high-risk namespaces detected
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={fetchImageScans}
              disabled={loadingImages}
              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1 group"
            >
              <span>Images Scanned: <span className="font-semibold">{data.total_images_scanned}</span></span>
              <InformationCircleIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* New Security Features Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* RBAC Analysis Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <ShieldCheckIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">RBAC Analysis</h3>
            </div>
            <button
              onClick={fetchRbacSummary}
              disabled={loadingRbac}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loadingRbac ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingRbac ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : rbacSummary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Risk Level</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded ${
                  rbacSummary.risk_level === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                  rbacSummary.risk_level === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                  rbacSummary.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {rbacSummary.risk_level.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
                  <div className="text-lg font-bold text-red-600 dark:text-red-400">{rbacSummary.cluster_admin_bindings}</div>
                  <div className="text-xs text-gray-500">Cluster Admin</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{rbacSummary.wildcard_permissions}</div>
                  <div className="text-xs text-gray-500">Wildcards</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{rbacSummary.risky_service_accounts}</div>
                  <div className="text-xs text-gray-500">Risky SAs</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
                  <div className="text-lg font-bold text-gray-600 dark:text-gray-400">{rbacSummary.total_service_accounts}</div>
                  <div className="text-xs text-gray-500">Total SAs</div>
                </div>
              </div>
              {rbacSummary.recommendations.length > 0 && (
                <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {rbacSummary.recommendations[0]}
                  </p>
                </div>
              )}
              <button
                onClick={fetchRbacDetail}
                disabled={loadingRbacDetail}
                className="w-full mt-3 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center justify-center gap-2"
              >
                {loadingRbacDetail ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>View Detailed Issues</span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-sm">Click refresh to analyze RBAC</p>
            </div>
          )}
        </div>

        {/* Network Policy Coverage Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Network Policies</h3>
            </div>
            <button
              onClick={fetchNetworkPolicySummary}
              disabled={loadingNetPol}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loadingNetPol ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingNetPol ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : networkPolicySummary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Coverage</span>
                <span className={`text-lg font-bold ${
                  networkPolicySummary.coverage_percentage >= 80 ? 'text-green-600 dark:text-green-400' :
                  networkPolicySummary.coverage_percentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {networkPolicySummary.coverage_percentage}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    networkPolicySummary.coverage_percentage >= 80 ? 'bg-green-500' :
                    networkPolicySummary.coverage_percentage >= 50 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${networkPolicySummary.coverage_percentage}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="font-bold text-green-600 dark:text-green-400">{networkPolicySummary.protected_namespaces}</div>
                  <div className="text-xs text-gray-500">Protected</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <div className="font-bold text-yellow-600 dark:text-yellow-400">{networkPolicySummary.partial_namespaces}</div>
                  <div className="text-xs text-gray-500">Partial</div>
                </div>
                <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="font-bold text-red-600 dark:text-red-400">{networkPolicySummary.unprotected_namespaces}</div>
                  <div className="text-xs text-gray-500">Unprotected</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {networkPolicySummary.covered_pods} of {networkPolicySummary.total_pods} pods covered
              </div>
              <button
                onClick={fetchNetworkPolicyDetail}
                disabled={loadingNetPolDetail}
                className="w-full mt-3 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2"
              >
                {loadingNetPolDetail ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>View Namespace Details</span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-sm">Click refresh to analyze policies</p>
            </div>
          )}
        </div>

        {/* Security Trends Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <ClockIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Security Trends</h3>
            </div>
            <button
              onClick={fetchTrendsSummary}
              disabled={loadingTrends}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loadingTrends ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingTrends ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : trendsSummary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Trend</span>
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                  trendsSummary.trend_direction === 'improving' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                  trendsSummary.trend_direction === 'declining' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                }`}>
                  {trendsSummary.trend_direction === 'improving' ? '↑' : trendsSummary.trend_direction === 'declining' ? '↓' : '→'}
                  <span className="ml-1">{trendsSummary.trend_direction.charAt(0).toUpperCase() + trendsSummary.trend_direction.slice(1)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
                  <div className={`text-lg font-bold ${trendsSummary.score_change_7d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {trendsSummary.score_change_7d >= 0 ? '+' : ''}{trendsSummary.score_change_7d}
                  </div>
                  <div className="text-xs text-gray-500">7-Day Change</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
                  <div className={`text-lg font-bold ${trendsSummary.score_change_30d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {trendsSummary.score_change_30d >= 0 ? '+' : ''}{trendsSummary.score_change_30d}
                  </div>
                  <div className="text-xs text-gray-500">30-Day Change</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">{trendsSummary.vulnerabilities_fixed_7d}</div>
                  <div className="text-xs text-gray-500">Fixed (7d)</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
                  <div className="text-lg font-bold text-red-600 dark:text-red-400">{trendsSummary.vulnerabilities_new_7d}</div>
                  <div className="text-xs text-gray-500">New (7d)</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {trendsSummary.data_points} data points tracked
              </div>
              <button
                onClick={fetchTrendsDetail}
                disabled={loadingTrendsDetail}
                className="w-full mt-3 px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors flex items-center justify-center gap-2"
              >
                {loadingTrendsDetail ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>View Trend History</span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-sm">Click refresh to load trends</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Security Findings */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Top Security Findings</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Most critical security issues requiring immediate attention
          </p>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {top_findings.length > 0 ? (
            top_findings.map((finding) => (
              <div
                key={finding.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                onClick={() => setSelectedFinding(finding)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(
                          finding.severity
                        )}`}
                      >
                        {finding.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 uppercase">
                        {finding.type}
                      </span>
                      {finding.cve_id && (
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                          {finding.cve_id}
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {finding.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {finding.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        Resource: <span className="font-mono">{finding.resource_name}</span>
                      </span>
                      <span>
                        Namespace: <span className="font-mono">{finding.namespace}</span>
                      </span>
                      <span>
                        Type: <span className="font-mono">{finding.resource_type}</span>
                      </span>
                    </div>
                  </div>
                  <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                    <InformationCircleIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-600 dark:text-gray-400">
              <ShieldCheckIcon className="h-12 w-12 mx-auto mb-2 text-green-600 dark:text-green-400" />
              <p>No security findings detected. Your cluster is secure!</p>
            </div>
          )}
        </div>
      </div>

      {/* Finding Detail Modal */}
      {selectedFinding && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => { setSelectedFinding(null); setShowInlineAi(false); setAiRemediation(null); }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-3xl w-full m-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(
                        selectedFinding.severity
                      )}`}
                    >
                      {selectedFinding.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400 uppercase">
                      {selectedFinding.type}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedFinding.title}
                  </h3>
                </div>
                <button
                  onClick={() => { setSelectedFinding(null); setShowInlineAi(false); setAiRemediation(null); }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                  <p className="text-gray-600 dark:text-gray-400">{selectedFinding.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Resource</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {selectedFinding.resource_name}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Namespace</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {selectedFinding.namespace}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Type</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {selectedFinding.resource_type}
                    </p>
                  </div>
                  {selectedFinding.cve_id && (
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">CVE ID</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                        {selectedFinding.cve_id}
                      </p>
                    </div>
                  )}
                </div>

                {selectedFinding.recommendation && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                      Recommendation
                    </h4>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-900 dark:text-blue-300">
                        {selectedFinding.recommendation}
                      </p>
                    </div>
                  </div>
                )}

                {/* Inline AI Analysis Section */}
                {showInlineAi && (
                  <div className="mt-4">
                    {loadingAiRemediation === `finding-${selectedFinding.id}` ? (
                      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/50 to-cyan-50/50 dark:from-slate-900 dark:via-violet-900/20 dark:to-cyan-900/20 border border-violet-200/50 dark:border-violet-700/50 rounded-2xl p-6">
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-violet-400/20 to-cyan-400/20 rounded-full blur-3xl animate-pulse"></div>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg shadow-lg shadow-violet-500/30">
                            <ArrowPathIcon className="h-5 w-5 text-white animate-spin" />
                          </div>
                          <div>
                            <h4 className="font-bold text-lg bg-gradient-to-r from-violet-700 via-purple-600 to-cyan-600 dark:from-violet-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent">
                              AI Analyzing...
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Generating remediation advice</p>
                          </div>
                        </div>
                      </div>
                    ) : aiRemediation && (
                      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/50 to-cyan-50/50 dark:from-slate-900 dark:via-violet-900/20 dark:to-cyan-900/20 border border-violet-200/50 dark:border-violet-700/50 rounded-2xl p-6 shadow-xl shadow-violet-500/5">
                        {/* Decorative gradient orbs */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-violet-400/20 to-cyan-400/20 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-cyan-400/20 to-violet-400/20 rounded-full blur-3xl"></div>

                        {/* Header with collapse button */}
                        <div className="relative flex items-center justify-between mb-5 pb-4 border-b border-violet-200/50 dark:border-violet-700/50">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg shadow-lg shadow-violet-500/30">
                              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-bold text-lg bg-gradient-to-r from-violet-700 via-purple-600 to-cyan-600 dark:from-violet-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                AI-Powered Analysis
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Powered by Google Gemini</p>
                            </div>
                          </div>
                          <button
                            onClick={() => { setShowInlineAi(false); setAiRemediation(null); }}
                            className="p-1.5 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
                            title="Close AI analysis"
                          >
                            <XCircleIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                          </button>
                        </div>

                        {/* AI Analysis Content */}
                        {aiRemediation.ai_powered && aiRemediation.remediation?.analysis && (
                          <div className="relative prose prose-sm max-w-none max-h-[300px] overflow-y-auto">
                            <ReactMarkdown components={markdownComponents}>
                              {aiRemediation.remediation.analysis}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* Remediation Steps (for rule-based responses) */}
                        {!aiRemediation.ai_powered && aiRemediation.remediation?.steps && aiRemediation.remediation.steps.length > 0 && (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            <h5 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <CheckCircleIcon className="h-4 w-4 text-green-600" />
                              Remediation Steps
                            </h5>
                            {aiRemediation.remediation.steps.map((step, index) => (
                              <div key={index} className="flex gap-3 p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-600 text-white text-xs font-semibold rounded-full">
                                  {index + 1}
                                </span>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{step}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Note */}
                        {aiRemediation.note && (
                          <div className="mt-4 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-3">
                            <p className="text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                              <InformationCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              {aiRemediation.note}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedFinding.can_auto_remediate ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ Auto-remediation available
                      </span>
                    ) : (
                      <span>Manual remediation required</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchAiRemediation(selectedFinding)}
                      disabled={loadingAiRemediation === `finding-${selectedFinding.id}`}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      {loadingAiRemediation === `finding-${selectedFinding.id}` ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                          </svg>
                          Ask AI
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => { setSelectedFinding(null); setShowInlineAi(false); setAiRemediation(null); }}
                      className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Remediation Modal - Higher z-index to appear above other modals */}
      {showAiModal && aiRemediation && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]"
          onClick={() => setShowAiModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {aiRemediation.ai_powered ? 'AI-Powered' : 'Rule-Based'} Remediation
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {aiRemediation.ai_powered ? 'Powered by Google Gemini' : 'Based on security best practices'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      aiRemediation.finding?.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      aiRemediation.finding?.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                      aiRemediation.finding?.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {aiRemediation.finding?.severity?.toUpperCase() || 'UNKNOWN'}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {aiRemediation.finding?.type}
                    </span>
                    {aiRemediation.remediation?.priority && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                        {aiRemediation.remediation.priority}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowAiModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Finding Title */}
                {aiRemediation.finding?.title && (
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Finding</h4>
                    <p className="text-gray-700 dark:text-gray-300">{aiRemediation.finding.title}</p>
                    {aiRemediation.finding.resource && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
                        Resource: {aiRemediation.finding.resource}
                        {aiRemediation.finding.namespace && ` (${aiRemediation.finding.namespace})`}
                      </p>
                    )}
                  </div>
                )}

                {/* AI Analysis (for AI-powered responses) */}
                {aiRemediation.ai_powered && aiRemediation.remediation?.analysis && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/50 to-cyan-50/50 dark:from-slate-900 dark:via-violet-900/20 dark:to-cyan-900/20 border border-violet-200/50 dark:border-violet-700/50 rounded-2xl p-6 shadow-xl shadow-violet-500/5">
                    {/* Decorative gradient orbs */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-violet-400/20 to-cyan-400/20 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-cyan-400/20 to-violet-400/20 rounded-full blur-3xl"></div>

                    {/* Header */}
                    <div className="relative flex items-center gap-3 mb-5 pb-4 border-b border-violet-200/50 dark:border-violet-700/50">
                      <div className="p-2 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg shadow-lg shadow-violet-500/30">
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg bg-gradient-to-r from-violet-700 via-purple-600 to-cyan-600 dark:from-violet-400 dark:via-purple-400 dark:to-cyan-400 bg-clip-text text-transparent">
                          AI-Powered Analysis
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Powered by Google Gemini</p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="relative prose prose-sm max-w-none">
                      <ReactMarkdown components={markdownComponents}>
                        {aiRemediation.remediation.analysis}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Remediation Steps (for rule-based responses) */}
                {!aiRemediation.ai_powered && aiRemediation.remediation?.steps && aiRemediation.remediation.steps.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      Remediation Steps
                    </h4>
                    <div className="space-y-2">
                      {aiRemediation.remediation.steps.map((step, index) => (
                        <div key={index} className="flex gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-600 text-white text-sm font-semibold rounded-full">
                            {index + 1}
                          </span>
                          <p className="text-gray-700 dark:text-gray-300">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commands */}
                {!aiRemediation.ai_powered && aiRemediation.remediation?.commands && aiRemediation.remediation.commands.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Commands to Execute
                    </h4>
                    <div className="space-y-2">
                      {aiRemediation.remediation.commands.map((cmd, index) => (
                        <div key={index} className="relative group">
                          <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-sm overflow-x-auto">
                            <code>{cmd}</code>
                          </pre>
                          <button
                            onClick={() => navigator.clipboard.writeText(cmd)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-slate-700 rounded text-gray-300 hover:text-white"
                            title="Copy to clipboard"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* YAML Example */}
                {!aiRemediation.ai_powered && aiRemediation.remediation?.yaml_example && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      YAML Configuration Example
                    </h4>
                    <div className="relative group">
                      <pre className="bg-slate-900 text-yellow-300 p-3 rounded-lg text-sm overflow-x-auto max-h-64">
                        <code>{aiRemediation.remediation.yaml_example}</code>
                      </pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(aiRemediation.remediation?.yaml_example || '')}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-slate-700 rounded text-gray-300 hover:text-white"
                        title="Copy to clipboard"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Prevention / Best Practices */}
                {!aiRemediation.ai_powered && aiRemediation.remediation?.prevention && aiRemediation.remediation.prevention.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <ShieldCheckIcon className="h-5 w-5 text-primary-600" />
                      Prevention & Best Practices
                    </h4>
                    <ul className="space-y-2">
                      {aiRemediation.remediation.prevention.map((practice, index) => (
                        <li key={index} className="flex gap-2 text-gray-700 dark:text-gray-300">
                          <span className="text-primary-600">•</span>
                          {practice}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Note about AI */}
                {aiRemediation.note && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
                      <InformationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      {aiRemediation.note}
                    </p>
                  </div>
                )}

                {/* Close Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-700">
                  <button
                    onClick={() => setShowAiModal(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Error Toast */}
      {aiError && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <span>{aiError}</span>
          <button onClick={() => setAiError(null)} className="ml-2 hover:text-red-200">
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-3xl w-full m-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Security Dashboard Guide
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Understanding your cluster's security posture
                  </p>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Security Score Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <ShieldCheckIcon className="h-5 w-5 text-primary-600" />
                    Security Score (0-100)
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Your overall security health is calculated by starting at 100 and deducting points for each security issue found:
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-disc">
                    <li><strong className="text-red-600 dark:text-red-400">Critical Issues:</strong> -10 points each (immediate action required)</li>
                    <li><strong className="text-orange-600 dark:text-orange-400">High Issues:</strong> -5 points each (should be fixed soon)</li>
                    <li><strong className="text-yellow-600 dark:text-yellow-400">Medium Issues:</strong> -2 points each (plan to fix)</li>
                    <li><strong className="text-blue-600 dark:text-blue-400">Low Issues:</strong> -1 point each (optional fixes)</li>
                  </ul>
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <strong>Grade Scale:</strong> A (90-100), B (80-89), C (70-79), D (60-69), F (0-59)
                    </p>
                  </div>
                </div>

                {/* Severity Levels */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
                    Severity Levels Explained
                  </h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                      <p className="text-sm font-semibold text-red-900 dark:text-red-400">Critical</p>
                      <p className="text-xs text-red-800 dark:text-red-300">
                        Severe vulnerabilities or misconfigurations that can be easily exploited and lead to system compromise. Fix immediately.
                      </p>
                    </div>
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded">
                      <p className="text-sm font-semibold text-orange-900 dark:text-orange-400">High</p>
                      <p className="text-xs text-orange-800 dark:text-orange-300">
                        Significant security risks that should be addressed soon. May require specific conditions to exploit.
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                      <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-400">Medium</p>
                      <p className="text-xs text-yellow-800 dark:text-yellow-300">
                        Moderate risks that should be fixed but are not immediately exploitable. Plan remediation.
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-400">Low</p>
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        Minor issues or best practice violations. Low impact on security but good to fix when possible.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Finding Types */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Types of Security Findings
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Vulnerability</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Known security flaws (CVEs) in your container images
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Misconfiguration</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Insecure Kubernetes resource configurations
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Compliance</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Violations of CIS Kubernetes Benchmark standards
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Secret Exposure</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Hardcoded secrets or sensitive data in configs
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Policy Violation</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Violations of Pod Security Standards
                      </p>
                    </div>
                  </div>
                </div>

                {/* Common Issues */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Common Security Issues
                  </h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 dark:text-red-400 mt-0.5">•</span>
                      <div>
                        <strong>Running as root:</strong> Containers running with root privileges can compromise the entire node
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 dark:text-red-400 mt-0.5">•</span>
                      <div>
                        <strong>Privileged containers:</strong> Full access to host resources, major security risk
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-600 dark:text-orange-400 mt-0.5">•</span>
                      <div>
                        <strong>No resource limits:</strong> Can lead to resource exhaustion and denial of service
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-600 dark:text-orange-400 mt-0.5">•</span>
                      <div>
                        <strong>HostPath volumes:</strong> Direct access to host filesystem, potential for escape
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                      <div>
                        <strong>No network policies:</strong> Pods can communicate freely, increasing attack surface
                      </div>
                    </li>
                  </ul>
                </div>

                {/* How to Fix */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    How to Fix Issues
                  </h4>
                  <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4 list-decimal">
                    <li><strong>Click on any finding</strong> to see detailed information and remediation steps</li>
                    <li><strong>Review the recommendation</strong> section for specific fixes</li>
                    <li><strong>Apply fixes to your YAML manifests</strong> or Helm charts</li>
                    <li><strong>Redeploy affected resources</strong> using kubectl or your CI/CD pipeline</li>
                    <li><strong>Run a new scan</strong> to verify the issue is resolved</li>
                  </ol>
                </div>

                {/* CTA */}
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                  <p className="text-sm text-primary-900 dark:text-primary-300">
                    <strong>Pro Tip:</strong> Run security scans regularly (daily or after each deployment) to catch issues early.
                    Focus on fixing Critical and High severity issues first for maximum security improvement.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Scans Modal */}
      {showImageScans && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowImageScans(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full m-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Container Image Vulnerability Scans
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Trivy scan results for all container images in your cluster
                  </p>
                </div>
                <button
                  onClick={() => setShowImageScans(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              {loadingImages ? (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : imageScans.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                      <tr>
                        <th className="px-4 py-3 w-8"></th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Image</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Critical</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">High</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Medium</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Low</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                      {imageScans.map((scan, idx) => {
                        const isExpanded = expandedImage === scan.image;
                        const hasVulnerabilities = scan.vulnerability_details && scan.vulnerability_details.length > 0;

                        return (
                          <React.Fragment key={idx}>
                            <tr
                              className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 ${hasVulnerabilities ? 'cursor-pointer' : ''}`}
                              onClick={() => hasVulnerabilities && setExpandedImage(isExpanded ? null : scan.image)}
                            >
                              <td className="px-4 py-3">
                                {hasVulnerabilities && (
                                  <ChevronDownIcon
                                    className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono text-xs text-gray-900 dark:text-white break-all">
                                  {scan.image}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Scanned: {new Date(scan.scan_time).toLocaleString()}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold ${scan.vulnerabilities.critical > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                                  {scan.vulnerabilities.critical}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold ${scan.vulnerabilities.high > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>
                                  {scan.vulnerabilities.high}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold ${scan.vulnerabilities.medium > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}`}>
                                  {scan.vulnerabilities.medium}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold ${scan.vulnerabilities.low > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                                  {scan.vulnerabilities.low}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {scan.vulnerabilities.total}
                                </span>
                              </td>
                            </tr>

                            {/* Expanded row showing CVE details */}
                            {isExpanded && hasVulnerabilities && (
                              <tr>
                                <td colSpan={7} className="px-4 py-4 bg-gray-50 dark:bg-slate-900/50">
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                                      Vulnerability Details ({scan.vulnerability_details.length} CVEs)
                                    </h4>

                                    <div className="max-h-96 overflow-y-auto space-y-2">
                                      {scan.vulnerability_details
                                        .sort((a, b) => {
                                          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
                                          return (severityOrder[a.severity as keyof typeof severityOrder] || 4) -
                                                 (severityOrder[b.severity as keyof typeof severityOrder] || 4);
                                        })
                                        .map((vuln, vIdx) => (
                                          <div
                                            key={vIdx}
                                            className="p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded"
                                          >
                                            <div className="flex items-start justify-between">
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className="font-mono font-semibold text-sm text-gray-900 dark:text-white">
                                                    {vuln.vulnerability_id}
                                                  </span>
                                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                                    vuln.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                    vuln.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                                                    vuln.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    vuln.severity === 'low' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                                  }`}>
                                                    {vuln.severity.toUpperCase()}
                                                  </span>
                                                  {vuln.cvss_score && (
                                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                                      CVSS: {vuln.cvss_score.toFixed(1)}
                                                    </span>
                                                  )}
                                                </div>

                                                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                                  <span className="font-semibold">Package:</span> {vuln.pkg_name} ({vuln.installed_version})
                                                  {vuln.fixed_version && (
                                                    <span className="ml-2">
                                                      <span className="font-semibold">Fix:</span> {vuln.fixed_version}
                                                    </span>
                                                  )}
                                                </div>

                                                {vuln.title && (
                                                  <div className="text-sm text-gray-900 dark:text-white mb-1">
                                                    {vuln.title}
                                                  </div>
                                                )}

                                                {vuln.description && (
                                                  <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                                    {vuln.description}
                                                  </div>
                                                )}

                                                {/* Ask AI Button */}
                                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      fetchAiRemediationForVulnerability(vuln, scan.image);
                                                    }}
                                                    disabled={loadingAiRemediation === `vuln-${vuln.vulnerability_id}`}
                                                    className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded transition-colors flex items-center gap-1"
                                                  >
                                                    {loadingAiRemediation === `vuln-${vuln.vulnerability_id}` ? (
                                                      <>
                                                        <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                                        Analyzing...
                                                      </>
                                                    ) : (
                                                      <>
                                                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                                        </svg>
                                                        Ask AI
                                                      </>
                                                    )}
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      }
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                  No image scan results available
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-300">
                    <strong>Note:</strong> Vulnerability data is sourced from Trivy, which scans container images for known CVEs.
                    High and Critical vulnerabilities should be addressed by updating to patched image versions.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowImageScans(false)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RBAC Details Modal */}
      {showRbacModal && rbacDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowRbacModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full m-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    RBAC Security Analysis
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Detailed breakdown of RBAC security issues in your cluster
                  </p>
                </div>
                <button
                  onClick={() => setShowRbacModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{rbacDetail.total_service_accounts}</div>
                  <div className="text-xs text-gray-500">Total SAs</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{rbacDetail.risky_service_accounts}</div>
                  <div className="text-xs text-gray-500">Risky SAs</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{rbacDetail.total_role_bindings}</div>
                  <div className="text-xs text-gray-500">Total Bindings</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{rbacDetail.risky_role_bindings}</div>
                  <div className="text-xs text-gray-500">Risky Bindings</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{rbacDetail.cluster_admin_bindings}</div>
                  <div className="text-xs text-gray-500">Cluster Admin</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{rbacDetail.wildcard_permissions}</div>
                  <div className="text-xs text-gray-500">Wildcards</div>
                </div>
              </div>

              {/* Risky Service Accounts */}
              {rbacDetail.service_account_risks.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <ShieldExclamationIcon className="h-5 w-5 text-red-500" />
                    Risky Service Accounts ({rbacDetail.service_account_risks.length})
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {rbacDetail.service_account_risks.map((sa, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border-l-4 border-red-500"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-mono font-semibold text-gray-900 dark:text-white">{sa.name}</span>
                            <span className="text-gray-500 dark:text-gray-400 mx-2">/</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{sa.namespace}</span>
                          </div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            sa.risk_level === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                            sa.risk_level === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                            sa.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}>
                            {sa.risk_level.toUpperCase()}
                          </span>
                        </div>

                        {/* Risk Indicators */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          {sa.has_cluster_admin && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded">
                              Cluster Admin
                            </span>
                          )}
                          {sa.has_secrets_access && (
                            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 rounded">
                              Secrets Access
                            </span>
                          )}
                          {sa.has_wildcard_permissions && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
                              Wildcard Permissions
                            </span>
                          )}
                        </div>

                        {/* Issues */}
                        {sa.issues.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Issues:</p>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                              {sa.issues.map((issue, iIdx) => (
                                <li key={iIdx} className="flex items-start gap-2">
                                  <span className="text-red-500 mt-0.5">•</span>
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Bound Roles */}
                        {sa.bound_roles.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Bound Roles:</p>
                            <div className="flex flex-wrap gap-1">
                              {sa.bound_roles.map((role, rIdx) => (
                                <span key={rIdx} className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded font-mono">
                                  {role}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pods Using */}
                        {sa.pods_using.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Used by Pods:</p>
                            <div className="flex flex-wrap gap-1">
                              {sa.pods_using.slice(0, 5).map((pod, pIdx) => (
                                <span key={pIdx} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded font-mono">
                                  {pod}
                                </span>
                              ))}
                              {sa.pods_using.length > 5 && (
                                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded">
                                  +{sa.pods_using.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Ask AI Button */}
                        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-slate-600">
                          <button
                            onClick={() => fetchAiRemediationForServiceAccount(sa)}
                            disabled={loadingAiRemediation === `sa-${sa.namespace}-${sa.name}`}
                            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            {loadingAiRemediation === `sa-${sa.namespace}-${sa.name}` ? (
                              <>
                                <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                </svg>
                                Ask AI How to Fix
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risky Role Bindings */}
              {rbacDetail.role_binding_risks.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <ShieldExclamationIcon className="h-5 w-5 text-orange-500" />
                    Risky Role Bindings ({rbacDetail.role_binding_risks.length})
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {rbacDetail.role_binding_risks.map((rb, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border-l-4 border-orange-500"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-mono font-semibold text-gray-900 dark:text-white">{rb.name}</span>
                            {rb.namespace && (
                              <>
                                <span className="text-gray-500 dark:text-gray-400 mx-2">/</span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">{rb.namespace}</span>
                              </>
                            )}
                            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded">
                              {rb.binding_type}
                            </span>
                          </div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            rb.risk_level === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                            rb.risk_level === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                            rb.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}>
                            {rb.risk_level.toUpperCase()}
                          </span>
                        </div>

                        {/* Role Reference */}
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Binds: <span className="font-mono">{rb.role_kind}/{rb.role_name}</span>
                        </div>

                        {/* Risk Indicators */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          {rb.is_cluster_admin && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded">
                              Cluster Admin
                            </span>
                          )}
                          {rb.grants_secrets_access && (
                            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 rounded">
                              Grants Secrets Access
                            </span>
                          )}
                          {rb.grants_wildcard && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
                              Grants Wildcard
                            </span>
                          )}
                        </div>

                        {/* Issues */}
                        {rb.issues.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Issues:</p>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                              {rb.issues.map((issue, iIdx) => (
                                <li key={iIdx} className="flex items-start gap-2">
                                  <span className="text-orange-500 mt-0.5">•</span>
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Subjects */}
                        {rb.subjects.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Subjects:</p>
                            <div className="flex flex-wrap gap-1">
                              {rb.subjects.map((subject, sIdx) => (
                                <span key={sIdx} className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 rounded font-mono">
                                  {subject.kind}: {subject.name}
                                  {subject.namespace && ` (${subject.namespace})`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Ask AI Button */}
                        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-slate-600">
                          <button
                            onClick={() => fetchAiRemediationForRoleBinding(rb)}
                            disabled={loadingAiRemediation === `rb-${rb.namespace || 'cluster'}-${rb.name}`}
                            className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            {loadingAiRemediation === `rb-${rb.namespace || 'cluster'}-${rb.name}` ? (
                              <>
                                <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                </svg>
                                Ask AI How to Fix
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {rbacDetail.recommendations.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                    Recommendations
                  </h4>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <ul className="space-y-2 text-sm text-blue-900 dark:text-blue-300">
                      {rbacDetail.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">→</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* No Issues State */}
              {rbacDetail.service_account_risks.length === 0 && rbacDetail.role_binding_risks.length === 0 && (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  <ShieldCheckIcon className="h-12 w-12 mx-auto mb-2 text-green-600 dark:text-green-400" />
                  <p>No risky RBAC configurations detected. Your cluster has good RBAC hygiene!</p>
                </div>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Analyzed at: {new Date(rbacDetail.analyzed_at).toLocaleString()}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowRbacModal(false)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Network Policy Details Modal */}
      {showNetPolModal && networkPolicyDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowNetPolModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full m-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Network Policy Coverage
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Detailed breakdown of network policy protection across namespaces
                  </p>
                </div>
                <button
                  onClick={() => setShowNetPolModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">{networkPolicyDetail.total_namespaces}</div>
                  <div className="text-sm text-gray-500">Total Namespaces</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{networkPolicyDetail.protected_namespaces}</div>
                  <div className="text-sm text-gray-500">Protected</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{networkPolicyDetail.partial_namespaces}</div>
                  <div className="text-sm text-gray-500">Partial</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">{networkPolicyDetail.unprotected_namespaces}</div>
                  <div className="text-sm text-gray-500">Unprotected</div>
                </div>
              </div>

              {/* Coverage Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pod Coverage</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {networkPolicyDetail.covered_pods} / {networkPolicyDetail.total_pods} pods ({networkPolicyDetail.coverage_percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      networkPolicyDetail.coverage_percentage >= 80 ? 'bg-green-500' :
                      networkPolicyDetail.coverage_percentage >= 50 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${networkPolicyDetail.coverage_percentage}%` }}
                  />
                </div>
              </div>

              {/* Namespace Details */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Namespace Details
                </h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {networkPolicyDetail.namespaces
                    .sort((a, b) => {
                      const statusOrder = { unprotected: 0, partial: 1, protected: 2 };
                      return (statusOrder[a.status as keyof typeof statusOrder] || 2) -
                             (statusOrder[b.status as keyof typeof statusOrder] || 2);
                    })
                    .map((ns, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border-l-4 ${
                          ns.status === 'protected' ? 'bg-green-50 dark:bg-green-900/10 border-green-500' :
                          ns.status === 'partial' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-500' :
                          'bg-red-50 dark:bg-red-900/10 border-red-500'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-gray-900 dark:text-white">{ns.namespace}</span>
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${
                              ns.status === 'protected' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                              ns.status === 'partial' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {ns.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {ns.pods_covered}/{ns.pods_total} pods
                          </div>
                        </div>

                        {/* Policy Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-sm">
                          <div className="bg-white/50 dark:bg-slate-800/50 rounded p-2">
                            <div className="font-semibold text-gray-900 dark:text-white">{ns.policy_count}</div>
                            <div className="text-xs text-gray-500">Policies</div>
                          </div>
                          <div className="bg-white/50 dark:bg-slate-800/50 rounded p-2">
                            <div className={`font-semibold ${ns.has_default_deny_ingress ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {ns.has_default_deny_ingress ? 'Yes' : 'No'}
                            </div>
                            <div className="text-xs text-gray-500">Deny Ingress</div>
                          </div>
                          <div className="bg-white/50 dark:bg-slate-800/50 rounded p-2">
                            <div className={`font-semibold ${ns.has_default_deny_egress ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {ns.has_default_deny_egress ? 'Yes' : 'No'}
                            </div>
                            <div className="text-xs text-gray-500">Deny Egress</div>
                          </div>
                          <div className="bg-white/50 dark:bg-slate-800/50 rounded p-2">
                            <div className={`font-semibold ${ns.pods_uncovered.length === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {ns.pods_uncovered.length}
                            </div>
                            <div className="text-xs text-gray-500">Uncovered</div>
                          </div>
                        </div>

                        {/* Policies Applied */}
                        {ns.policies.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Network Policies:</p>
                            <div className="flex flex-wrap gap-1">
                              {ns.policies.map((policy, pIdx) => (
                                <span key={pIdx} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded font-mono">
                                  {policy}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Uncovered Pods */}
                        {ns.pods_uncovered.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                              Uncovered Pods ({ns.pods_uncovered.length}):
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {ns.pods_uncovered.slice(0, 10).map((pod, pIdx) => (
                                <span key={pIdx} className="px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded font-mono">
                                  {pod}
                                </span>
                              ))}
                              {ns.pods_uncovered.length > 10 && (
                                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded">
                                  +{ns.pods_uncovered.length - 10} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Ask AI Button - only for unprotected/partial namespaces */}
                        {ns.status !== 'protected' && (
                          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-slate-600">
                            <button
                              onClick={() => fetchAiRemediationForNetworkPolicy(ns)}
                              disabled={loadingAiRemediation === `netpol-${ns.namespace}`}
                              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              {loadingAiRemediation === `netpol-${ns.namespace}` ? (
                                <>
                                  <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                                  </svg>
                                  Ask AI How to Protect
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Recommendations */}
              {networkPolicyDetail.recommendations.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                    Recommendations
                  </h4>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <ul className="space-y-2 text-sm text-blue-900 dark:text-blue-300">
                      {networkPolicyDetail.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">→</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Analyzed at: {new Date(networkPolicyDetail.analyzed_at).toLocaleString()}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowNetPolModal(false)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Trends Details Modal */}
      {showTrendsModal && trendsDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowTrendsModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full m-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Security Trend History
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Historical security posture data over the last 30 days
                  </p>
                </div>
                <button
                  onClick={() => setShowTrendsModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className={`rounded-lg p-4 text-center ${
                  trendsDetail.score_change_7d >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <div className={`text-3xl font-bold ${
                    trendsDetail.score_change_7d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {trendsDetail.score_change_7d >= 0 ? '+' : ''}{trendsDetail.score_change_7d}
                  </div>
                  <div className="text-sm text-gray-500">7-Day Change</div>
                </div>
                <div className={`rounded-lg p-4 text-center ${
                  trendsDetail.score_change_30d >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <div className={`text-3xl font-bold ${
                    trendsDetail.score_change_30d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {trendsDetail.score_change_30d >= 0 ? '+' : ''}{trendsDetail.score_change_30d}
                  </div>
                  <div className="text-sm text-gray-500">30-Day Change</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{trendsDetail.vulnerabilities_fixed_7d}</div>
                  <div className="text-sm text-gray-500">Fixed (7d)</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">{trendsDetail.vulnerabilities_new_7d}</div>
                  <div className="text-sm text-gray-500">New (7d)</div>
                </div>
              </div>

              {/* Trend Direction */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Overall Trend</span>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
                    trendsDetail.trend_direction === 'improving' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    trendsDetail.trend_direction === 'declining' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {trendsDetail.trend_direction === 'improving' ? '↑ Improving' :
                     trendsDetail.trend_direction === 'declining' ? '↓ Declining' : '→ Stable'}
                  </div>
                </div>
              </div>

              {/* Historical Data Table */}
              {trendsDetail.trend_data.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-indigo-500" />
                    Historical Data ({trendsDetail.trend_data.length} data points)
                  </h4>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Date</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Score</th>
                          <th className="px-4 py-3 text-center font-semibold text-red-600 dark:text-red-400">Critical</th>
                          <th className="px-4 py-3 text-center font-semibold text-orange-600 dark:text-orange-400">High</th>
                          <th className="px-4 py-3 text-center font-semibold text-yellow-600 dark:text-yellow-400">Medium</th>
                          <th className="px-4 py-3 text-center font-semibold text-blue-600 dark:text-blue-400">Low</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Total Vulns</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Images</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                        {trendsDetail.trend_data
                          .slice()
                          .reverse()
                          .map((point, idx) => {
                            const prevPoint = idx < trendsDetail.trend_data.length - 1
                              ? trendsDetail.trend_data[trendsDetail.trend_data.length - 2 - idx]
                              : null;
                            const scoreChange = prevPoint ? point.security_score - prevPoint.security_score : 0;

                            return (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 text-gray-900 dark:text-white">
                                  {new Date(point.timestamp).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className={`font-bold ${
                                      point.security_score >= 90 ? 'text-green-600 dark:text-green-400' :
                                      point.security_score >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-red-600 dark:text-red-400'
                                    }`}>
                                      {point.security_score}
                                    </span>
                                    {scoreChange !== 0 && (
                                      <span className={`text-xs ${scoreChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {scoreChange > 0 ? '↑' : '↓'}{Math.abs(scoreChange)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    point.critical_count > 0 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'text-gray-400'
                                  }`}>
                                    {point.critical_count}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    point.high_count > 0 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' : 'text-gray-400'
                                  }`}>
                                    {point.high_count}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    point.medium_count > 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : 'text-gray-400'
                                  }`}>
                                    {point.medium_count}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    point.low_count > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400'
                                  }`}>
                                    {point.low_count}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
                                  {point.total_vulnerabilities}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                                  {point.images_scanned}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Visual Trend Chart (Simple Bar Chart) */}
              {trendsDetail.trend_data.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Score Trend (Last {trendsDetail.trend_data.length} Data Points)
                  </h4>
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                    <div className="flex items-end gap-1 h-32">
                      {trendsDetail.trend_data.map((point, idx) => {
                        const height = (point.security_score / 100) * 100;
                        return (
                          <div
                            key={idx}
                            className="flex-1 flex flex-col items-center group relative"
                          >
                            <div
                              className={`w-full rounded-t transition-all cursor-pointer ${
                                point.security_score >= 90 ? 'bg-green-500 hover:bg-green-400' :
                                point.security_score >= 70 ? 'bg-yellow-500 hover:bg-yellow-400' :
                                'bg-red-500 hover:bg-red-400'
                              }`}
                              style={{ height: `${height}%` }}
                              title={`${new Date(point.timestamp).toLocaleDateString()}: Score ${point.security_score}`}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                              <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                {new Date(point.timestamp).toLocaleDateString()}: {point.security_score}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>{new Date(trendsDetail.trend_data[0]?.timestamp).toLocaleDateString()}</span>
                      <span>{new Date(trendsDetail.trend_data[trendsDetail.trend_data.length - 1]?.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* No Data State */}
              {trendsDetail.trend_data.length === 0 && (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  <ClockIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No historical trend data available yet.</p>
                  <p className="text-sm mt-1">Run security scans regularly to build trend data.</p>
                </div>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Generated at: {new Date(trendsDetail.generated_at).toLocaleString()}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowTrendsModal(false)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
