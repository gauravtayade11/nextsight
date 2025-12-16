import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChartBarIcon,
  LockClosedIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { logger } from '../../utils/logger';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import GlassCard, { SectionHeader } from '../common/GlassCard';
import { Spinner, ProgressBar, CircularProgress, SecuritySkeleton, ConnectionError } from '../common/LoadingStates';
import { useToast } from '../../contexts/ToastContext';
import { useCluster } from '../../contexts/ClusterContext';
import { useSecurityDashboard } from '../../hooks/useSecurityData';

// Import shared constants
import { containerVariants, itemVariants, scaleVariants, SEVERITY_CONFIG, getSeverityConfig } from '../../utils/constants';
import { SeverityBadge } from '../common/StatusBadge';

// Types and Interfaces
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

// Modal variants (uses shared scaleVariants as base)
const modalVariants = {
  ...scaleVariants,
  visible: { opacity: 1, scale: 1, transition: { type: 'spring' as const, duration: 0.3 } },
};

export default function SecurityDashboard() {
  const toast = useToast();
  const { activeCluster } = useCluster();

  // Use cached hook for main security data - cluster-aware caching
  const {
    dashboard: data,
    rbacSummary,
    networkPolicySummary,
    trendsSummary,
    isLoading: loading,
    isRefetching,
    error: queryError,
    refresh: refreshSecurityData,
    hardReset,
  } = useSecurityDashboard(activeCluster?.id);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [imageScans, setImageScans] = useState<ImageScanResult[]>([]);
  const [showImageScans, setShowImageScans] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [showAllFindings, setShowAllFindings] = useState(false);

  // Loading states are now handled by the useSecurityDashboard hook (isRefetching)

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
  const [loadingAiRemediation, setLoadingAiRemediation] = useState<string | null>(null);
  const [, setAiError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showInlineAi, setShowInlineAi] = useState(false);

  // Copy code to clipboard
  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Custom code block component
  const CodeBlock = ({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    const isInline = !match && !codeString.includes('\n') && codeString.length < 50;

    if (!isInline) {
      const language = match ? match[1] : 'bash';
      return (
        <div className="relative group my-4">
          <div className="absolute left-3 top-0 transform -translate-y-1/2 z-10">
            <span className="px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-md shadow-lg">
              {language.toUpperCase()}
            </span>
          </div>
          <div className="absolute right-2 top-2 z-10">
            <button
              onClick={() => copyToClipboard(codeString)}
              className={`p-2 rounded-lg transition-all duration-300 flex items-center gap-1.5 ${
                copiedCode === codeString
                  ? 'bg-success-500 text-white shadow-lg'
                  : 'bg-slate-700/80 hover:bg-primary-600 text-slate-300 hover:text-white'
              }`}
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

    return (
      <code className="bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-300 px-1.5 py-0.5 rounded-md text-sm font-mono" {...props}>
        {children}
      </code>
    );
  };

  const PreBlock = ({ children }: any) => <>{children}</>;

  const markdownComponents = {
    code: CodeBlock,
    pre: PreBlock,
    h1: ({ children }: any) => (
      <h1 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-primary-500/30">
        <span className="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
          {children}
        </span>
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-lg font-semibold mt-5 mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-gradient-to-b from-primary-500 to-primary-400 rounded-full"></span>
        <span className="text-primary-700 dark:text-primary-400">{children}</span>
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-base font-semibold mt-4 mb-2 text-warning-600 dark:text-warning-400 flex items-center gap-2">
        <span className="w-2 h-2 bg-warning-500 rounded-full"></span>
        {children}
      </h3>
    ),
    p: ({ children }: any) => (
      <p className="text-slate-700 dark:text-slate-300 my-2 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="my-3 space-y-2 text-slate-700 dark:text-slate-300">{children}</ul>
    ),
    li: ({ children }: any) => (
      <li className="flex items-start gap-2">
        <span className="flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-primary-500"></span>
        <span>{children}</span>
      </li>
    ),
    strong: ({ children }: any) => (
      <strong className="font-semibold text-primary-700 dark:text-primary-300">{children}</strong>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="relative my-4 pl-4 py-3 bg-primary-50 dark:bg-primary-900/20 rounded-r-lg border-l-4 border-primary-500">
        <div className="text-slate-600 dark:text-slate-300 italic">{children}</div>
      </blockquote>
    ),
    a: ({ href, children }: any) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">
        {children}
      </a>
    ),
  };

  // API Functions
  const triggerScan = async () => {
    try {
      setScanning(true);
      await api.post('/security/scan');
      await refreshSecurityData();
    } catch (err: any) {
      logger.error('Error triggering scan', err);
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
      logger.error('Error fetching image scans', err);
      setError(err.response?.data?.detail || 'Failed to fetch image scans');
    } finally {
      setLoadingImages(false);
    }
  };

  const fetchRbacDetail = async () => {
    try {
      setLoadingRbacDetail(true);
      const response = await api.get<RBACAnalysisDetail>('/security/rbac');
      setRbacDetail(response.data);
      setShowRbacModal(true);
    } catch (err: any) {
      logger.error('Error fetching RBAC details', err);
      setError(err.response?.data?.detail || 'Failed to fetch RBAC details');
    } finally {
      setLoadingRbacDetail(false);
    }
  };

  const fetchNetworkPolicyDetail = async () => {
    try {
      setLoadingNetPolDetail(true);
      const response = await api.get<NetworkPolicyDetail>('/security/network-policies');
      setNetworkPolicyDetail(response.data);
      setShowNetPolModal(true);
    } catch (err: any) {
      logger.error('Error fetching network policy details', err);
      setError(err.response?.data?.detail || 'Failed to fetch network policy details');
    } finally {
      setLoadingNetPolDetail(false);
    }
  };

  const fetchTrendsDetail = async () => {
    try {
      setLoadingTrendsDetail(true);
      const response = await api.get<SecurityTrendsDetail>('/security/trends?days=30');
      setTrendsDetail(response.data);
      setShowTrendsModal(true);
    } catch (err: any) {
      logger.error('Error fetching trends details', err);
      setError(err.response?.data?.detail || 'Failed to fetch trends details');
    } finally {
      setLoadingTrendsDetail(false);
    }
  };

  const fetchAiRemediation = async (finding: SecurityFinding) => {
    if (loadingAiRemediation) return;
    const loadingId = `finding-${finding.id}`;
    try {
      setShowAiModal(false);
      setAiRemediation(null);
      setLoadingAiRemediation(loadingId);
      setAiError(null);
      setShowInlineAi(true);

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
    } catch (err: any) {
      logger.error('Error fetching AI remediation', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  const fetchAiRemediationForServiceAccount = async (sa: ServiceAccountRisk) => {
    if (loadingAiRemediation) return;
    const loadingId = `sa-${sa.namespace}-${sa.name}`;
    try {
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
      logger.error('Error fetching AI remediation', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  const fetchAiRemediationForRoleBinding = async (rb: RoleBindingRisk) => {
    if (loadingAiRemediation) return;
    const loadingId = `rb-${rb.namespace || 'cluster'}-${rb.name}`;
    try {
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
      logger.error('Error fetching AI remediation', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  const fetchAiRemediationForNetworkPolicy = async (ns: NamespaceNetworkPolicy) => {
    if (loadingAiRemediation) return;
    const loadingId = `netpol-${ns.namespace}`;
    try {
      setShowAiModal(false);
      setAiRemediation(null);
      setLoadingAiRemediation(loadingId);
      setAiError(null);

      const response = await api.post<AIRemediationResponse>('/security/ai-remediate', {
        finding_type: 'network_policy',
        severity: ns.status === 'unprotected' ? 'high' : 'medium',
        title: `Namespace lacks network policy: ${ns.namespace}`,
        description: `Namespace ${ns.namespace} has ${ns.policy_count} network policies. Status: ${ns.status}. ${ns.pods_uncovered.length} pods are not covered.`,
        resource_type: 'Namespace',
        resource_name: ns.namespace,
        namespace: ns.namespace,
        additional_context: `Default deny ingress: ${ns.has_default_deny_ingress}, Default deny egress: ${ns.has_default_deny_egress}. Uncovered pods: ${ns.pods_uncovered.slice(0, 5).join(', ')}${ns.pods_uncovered.length > 5 ? '...' : ''}`,
      });
      setAiRemediation(response.data);
      setShowAiModal(true);
    } catch (err: any) {
      logger.error('Error fetching AI remediation', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  const fetchAiRemediationForVulnerability = async (vuln: VulnerabilityDetail, imageName: string) => {
    if (loadingAiRemediation) return;
    const loadingId = `vuln-${vuln.vulnerability_id}`;
    try {
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
      logger.error('Error fetching AI remediation', err);
      setAiError(err.response?.data?.detail || 'Failed to get AI remediation advice');
    } finally {
      setLoadingAiRemediation(null);
    }
  };

  // Helper functions
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-success-500';
      case 'B': return 'text-primary-500';
      case 'C': return 'text-warning-500';
      case 'D': return 'text-warning-600';
      case 'F': return 'text-danger-500';
      default: return 'text-gray-500';
    }
  };

  const getScoreColor = (score: number): 'success' | 'warning' | 'danger' | 'primary' => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'danger';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400';
      case 'high': return 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  // Generate plain English explanations for security findings
  const getPlainEnglishExplanation = (finding: SecurityFinding) => {
    const typeExplanations: Record<string, { explanation: string; businessImpact: string; complianceRisk: string }> = {
      'vulnerability': {
        explanation: `This container image has a known security vulnerability (${finding.cve_id || 'CVE'}). Think of it like running software with a known bug that hackers can exploit to break into your system.`,
        businessImpact: 'Attackers could use this vulnerability to steal data, disrupt services, or gain unauthorized access to your applications.',
        complianceRisk: 'May violate PCI-DSS, SOC 2, HIPAA, and ISO 27001 requirements for vulnerability management.'
      },
      'misconfiguration': {
        explanation: 'This resource is configured in a way that creates security risks. It\'s like leaving a door unlocked or a window open in your house.',
        businessImpact: 'Increases the attack surface and makes it easier for malicious actors to compromise your infrastructure.',
        complianceRisk: 'May violate CIS Kubernetes Benchmarks and security configuration standards required by major compliance frameworks.'
      },
      'rbac': {
        explanation: 'This resource has excessive permissions that violate the principle of least privilege. It\'s like giving a janitor the master key to every office.',
        businessImpact: 'If compromised, attackers could gain elevated privileges and access sensitive resources they shouldn\'t have access to.',
        complianceRisk: 'Violates SOC 2, ISO 27001, and PCI-DSS requirements for access control and least privilege.'
      },
      'network_policy': {
        explanation: 'This workload lacks proper network segmentation. It\'s like having no doors or walls between rooms in a building.',
        businessImpact: 'Attackers who compromise one component can easily move laterally to access other services and data.',
        complianceRisk: 'May violate PCI-DSS network segmentation requirements and zero-trust architecture principles.'
      },
      'secrets': {
        explanation: 'Sensitive information (passwords, API keys, tokens) is exposed or improperly stored. It\'s like writing your password on a sticky note.',
        businessImpact: 'Exposed credentials can lead to data breaches, unauthorized access, and complete system compromise.',
        complianceRisk: 'Critical violation of SOC 2, HIPAA, PCI-DSS, and GDPR requirements for secrets management.'
      },
      'default': {
        explanation: 'This security issue could put your cluster and applications at risk. It represents a gap between your current configuration and security best practices.',
        businessImpact: 'May allow unauthorized access, data breaches, or service disruptions if exploited by malicious actors.',
        complianceRisk: 'Could violate security requirements in major compliance frameworks including SOC 2, ISO 27001, and industry-specific regulations.'
      }
    };

    const findingType = finding.type.toLowerCase();
    const matchedType = Object.keys(typeExplanations).find(key => findingType.includes(key));
    return typeExplanations[matchedType || 'default'];
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical': return 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400';
      case 'high': return 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400';
    }
  };

  // Debug logging - check console if page is blank
  logger.debug('[SecurityDashboard] Render state', {
    loading,
    isRefetching,
    queryError: queryError ? String(queryError) : null,
    hasData: !!data,
    dataContent: data,
  });

  // Loading State
  if (loading) {
    logger.debug('[SecurityDashboard] Showing loading skeleton');
    return (
      <div className="p-6">
        <SecuritySkeleton />
      </div>
    );
  }

  // Error State - check for query error or missing/incomplete dashboard data
  const hasValidData = data && data.security_score && data.vulnerability_summary;
  if (queryError || !hasValidData) {
    logger.debug('[SecurityDashboard] Showing error state - data invalid or error');
    return (
      <div className="p-6">
        <ConnectionError
          service="Security API"
          onRetry={refreshSecurityData}
          retrying={loading || isRefetching}
        />
      </div>
    );
  }

  // Safely destructure with defaults to prevent crashes
  const {
    security_score = { score: 0, grade: 'N/A', total_findings: 0, critical_issues: 0, high_issues: 0, medium_issues: 0, low_issues: 0, last_scan: '' },
    vulnerability_summary = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0, total: 0 },
    top_findings = [],
    compliance_summary = { passed: 0, failed: 0, total: 0 },
    risky_namespaces = []
  } = data;
  const complianceRate = compliance_summary.total > 0 ? Math.round((compliance_summary.passed / compliance_summary.total) * 100) : 0;

  // Filter and sort findings to show TOP 3 critical/high risks by default
  const sortedFindings = [...top_findings].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (severityOrder[a.severity.toLowerCase() as keyof typeof severityOrder] || 99) -
           (severityOrder[b.severity.toLowerCase() as keyof typeof severityOrder] || 99);
  });

  // Show only top 3 critical/high findings unless "View All" is clicked
  const displayedFindings = showAllFindings ? sortedFindings : sortedFindings.slice(0, 3);
  const hasMoreFindings = sortedFindings.length > 3;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Sticky Header */}
      <motion.div
        variants={itemVariants}
        className="sticky top-16 z-30 -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-slate-700/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30">
              <ShieldCheckIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Security
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Cluster security analysis and compliance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowHelp(true)}
              className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <InformationCircleIcon className="h-5 w-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={triggerScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 disabled:opacity-50 transition-all duration-300"
            >
              <ArrowPathIcon className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Scan Now'}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Security Score Card */}
      <motion.div variants={itemVariants}>
        <GlassCard variant="gradient" padding="lg">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Score Display */}
            <div className="flex items-center gap-8">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className={`text-7xl font-bold ${getGradeColor(security_score.grade)}`}
                >
                  {security_score.grade}
                </motion.div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Grade</div>
              </div>
              <div className="border-l border-gray-200 dark:border-slate-700 pl-8">
                <div className="flex items-baseline gap-2 mb-2">
                  <CircularProgress
                    progress={security_score.score}
                    size={80}
                    color={getScoreColor(security_score.score)}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  {security_score.total_findings} security {security_score.total_findings === 1 ? 'issue' : 'issues'} detected
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <ClockIcon className="h-4 w-4" />
                  <span>Scanned {new Date(security_score.last_scan).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Issue Breakdown */}
            <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4 min-w-[200px]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Issues by Severity</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-danger-500"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Critical</span>
                  </div>
                  <span className="text-lg font-bold text-danger-600 dark:text-danger-400">{security_score.critical_issues}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-warning-500"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">High</span>
                  </div>
                  <span className="text-lg font-bold text-warning-600 dark:text-warning-400">{security_score.high_issues}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Medium</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{security_score.medium_issues}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-500"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Low</span>
                  </div>
                  <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{security_score.low_issues}</span>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className="flex-shrink-0">
              {security_score.score < 70 && (
                <div className="px-4 py-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl">
                  <p className="text-sm text-danger-700 dark:text-danger-400 font-medium">
                    Action needed: Critical security issues detected
                  </p>
                </div>
              )}
              {security_score.score >= 70 && security_score.score < 90 && (
                <div className="px-4 py-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl">
                  <p className="text-sm text-warning-700 dark:text-warning-400 font-medium">
                    Good progress: Address remaining issues
                  </p>
                </div>
              )}
              {security_score.score >= 90 && (
                <div className="px-4 py-3 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-xl">
                  <p className="text-sm text-success-700 dark:text-success-400 font-medium">
                    Excellent security posture!
                  </p>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Vulnerabilities */}
        <GlassCard hover>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-danger-100 dark:bg-danger-900/30 rounded-xl">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-600 dark:text-danger-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Vulnerabilities</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">CVEs in container images</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Critical</span>
              <span className="font-semibold text-danger-600 dark:text-danger-400">{vulnerability_summary.critical}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">High</span>
              <span className="font-semibold text-warning-600 dark:text-warning-400">{vulnerability_summary.high}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Medium</span>
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">{vulnerability_summary.medium}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Low</span>
              <span className="font-semibold text-primary-600 dark:text-primary-400">{vulnerability_summary.low}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-gray-900 dark:text-white">{vulnerability_summary.total}</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Compliance */}
        <GlassCard hover>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-success-100 dark:bg-success-900/30 rounded-xl">
              <CheckCircleIcon className="h-5 w-5 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Compliance</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">CIS Kubernetes Benchmark</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Compliance Rate</span>
                <span className="font-semibold text-gray-900 dark:text-white">{complianceRate}%</span>
              </div>
              <ProgressBar
                progress={complianceRate}
                color={complianceRate >= 80 ? 'success' : complianceRate >= 50 ? 'warning' : 'danger'}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-success-600 dark:text-success-400">Passed</span>
                <span className="font-semibold">{compliance_summary.passed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-danger-600 dark:text-danger-400">Failed</span>
                <span className="font-semibold">{compliance_summary.failed}</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Risky Namespaces */}
        <GlassCard hover>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-warning-100 dark:bg-warning-900/30 rounded-xl">
              <ShieldExclamationIcon className="h-5 w-5 text-warning-600 dark:text-warning-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Risky Namespaces</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Require attention</p>
            </div>
          </div>
          <div className="space-y-2">
            {risky_namespaces.length > 0 ? (
              risky_namespaces.slice(0, 4).map((ns, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-sm">
                  <span className="text-gray-900 dark:text-white font-mono text-xs">{ns}</span>
                  <span className="text-danger-600 dark:text-danger-400 text-xs font-medium">High Risk</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
                <ShieldCheckIcon className="h-8 w-8 mx-auto mb-2 text-success-500" />
                No high-risk namespaces
              </div>
            )}
          </div>
          <button
            onClick={fetchImageScans}
            disabled={loadingImages}
            className="mt-4 w-full text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium flex items-center justify-center gap-1"
          >
            <span>Images Scanned: <span className="font-semibold">{data.total_images_scanned}</span></span>
            {loadingImages ? <Spinner size="sm" /> : <InformationCircleIcon className="h-4 w-4" />}
          </button>
        </GlassCard>
      </motion.div>

      {/* Security Features Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* RBAC Analysis */}
        <GlassCard hover>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <LockClosedIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">RBAC Analysis</h3>
            </div>
            <button onClick={refreshSecurityData} disabled={isRefetching} className="text-gray-400 hover:text-gray-600">
              <ArrowPathIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {rbacSummary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Risk Level</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${getRiskBadgeColor(rbacSummary.risk_level)}`}>
                  {rbacSummary.risk_level.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-danger-600 dark:text-danger-400">{rbacSummary.cluster_admin_bindings}</div>
                  <div className="text-xs text-gray-500">Cluster Admin</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-warning-600 dark:text-warning-400">{rbacSummary.wildcard_permissions}</div>
                  <div className="text-xs text-gray-500">Wildcards</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{rbacSummary.risky_service_accounts}</div>
                  <div className="text-xs text-gray-500">Risky SAs</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-gray-600 dark:text-gray-400">{rbacSummary.total_service_accounts}</div>
                  <div className="text-xs text-gray-500">Total SAs</div>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchRbacDetail}
                disabled={loadingRbacDetail}
                className="w-full px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center justify-center gap-2"
              >
                {loadingRbacDetail ? <Spinner size="sm" /> : <>View Details <ChevronDownIcon className="h-4 w-4" /></>}
              </motion.button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Click refresh to analyze</div>
          )}
        </GlassCard>

        {/* Network Policies */}
        <GlassCard hover>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <GlobeAltIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Network Policies</h3>
            </div>
            <button onClick={refreshSecurityData} disabled={isRefetching} className="text-gray-400 hover:text-gray-600">
              <ArrowPathIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {networkPolicySummary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Coverage</span>
                <span className={`text-lg font-bold ${
                  networkPolicySummary.coverage_percentage >= 80 ? 'text-success-600' :
                  networkPolicySummary.coverage_percentage >= 50 ? 'text-warning-600' : 'text-danger-600'
                }`}>
                  {networkPolicySummary.coverage_percentage}%
                </span>
              </div>
              <ProgressBar
                progress={networkPolicySummary.coverage_percentage}
                color={networkPolicySummary.coverage_percentage >= 80 ? 'success' : networkPolicySummary.coverage_percentage >= 50 ? 'warning' : 'danger'}
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-success-50 dark:bg-success-900/20 rounded-lg">
                  <div className="font-bold text-success-600">{networkPolicySummary.protected_namespaces}</div>
                  <div className="text-xs text-gray-500">Protected</div>
                </div>
                <div className="text-center p-2 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
                  <div className="font-bold text-warning-600">{networkPolicySummary.partial_namespaces}</div>
                  <div className="text-xs text-gray-500">Partial</div>
                </div>
                <div className="text-center p-2 bg-danger-50 dark:bg-danger-900/20 rounded-lg">
                  <div className="font-bold text-danger-600">{networkPolicySummary.unprotected_namespaces}</div>
                  <div className="text-xs text-gray-500">Unprotected</div>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchNetworkPolicyDetail}
                disabled={loadingNetPolDetail}
                className="w-full px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2"
              >
                {loadingNetPolDetail ? <Spinner size="sm" /> : <>View Details <ChevronDownIcon className="h-4 w-4" /></>}
              </motion.button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Click refresh to analyze</div>
          )}
        </GlassCard>

        {/* Security Trends */}
        <GlassCard hover>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                <ChartBarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Security Trends</h3>
            </div>
            <button onClick={refreshSecurityData} disabled={isRefetching} className="text-gray-400 hover:text-gray-600">
              <ArrowPathIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {trendsSummary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Trend</span>
                <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                  trendsSummary.trend_direction === 'improving' ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
                  trendsSummary.trend_direction === 'declining' ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                }`}>
                  {trendsSummary.trend_direction === 'improving' ? '↑' : trendsSummary.trend_direction === 'declining' ? '↓' : '→'}
                  <span className="ml-1 capitalize">{trendsSummary.trend_direction}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
                  <div className={`text-lg font-bold ${trendsSummary.score_change_7d >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {trendsSummary.score_change_7d >= 0 ? '+' : ''}{trendsSummary.score_change_7d}
                  </div>
                  <div className="text-xs text-gray-500">7-Day Change</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
                  <div className={`text-lg font-bold ${trendsSummary.score_change_30d >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {trendsSummary.score_change_30d >= 0 ? '+' : ''}{trendsSummary.score_change_30d}
                  </div>
                  <div className="text-xs text-gray-500">30-Day Change</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-success-600">{trendsSummary.vulnerabilities_fixed_7d}</div>
                  <div className="text-xs text-gray-500">Fixed (7d)</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-danger-600">{trendsSummary.vulnerabilities_new_7d}</div>
                  <div className="text-xs text-gray-500">New (7d)</div>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchTrendsDetail}
                disabled={loadingTrendsDetail}
                className="w-full px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors flex items-center justify-center gap-2"
              >
                {loadingTrendsDetail ? <Spinner size="sm" /> : <>View History <ChevronDownIcon className="h-4 w-4" /></>}
              </motion.button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Click refresh to load</div>
          )}
        </GlassCard>
      </motion.div>

      {/* Top Security Findings */}
      <motion.div variants={itemVariants}>
        <GlassCard padding="none">
          <div className="p-4 lg:p-6 border-b border-gray-100/50 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <SectionHeader
                title={showAllFindings ? "All Security Findings" : "Top 3 Security Risks"}
                subtitle={showAllFindings
                  ? "All security issues sorted by severity"
                  : "Most critical security issues requiring immediate attention"}
              />
              {hasMoreFindings && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAllFindings(!showAllFindings)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all shadow-sm"
                >
                  {showAllFindings ? 'Show Top 3' : `View All (${sortedFindings.length})`}
                </motion.button>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100/50 dark:divide-slate-700/50">
            {displayedFindings.length > 0 ? (
              displayedFindings.map((finding, index) => (
                <motion.div
                  key={finding.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 lg:p-6 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedFinding(finding)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${getSeverityColor(finding.severity)}`}>
                          {finding.severity.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 uppercase">{finding.type}</span>
                        {finding.cve_id && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">{finding.cve_id}</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{finding.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{finding.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Resource: <span className="font-mono">{finding.resource_name}</span></span>
                        <span>Namespace: <span className="font-mono">{finding.namespace}</span></span>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      className="text-primary-600 dark:text-primary-400 p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    >
                      <InformationCircleIcon className="h-5 w-5" />
                    </motion.button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-8 text-center">
                <ShieldCheckIcon className="h-12 w-12 mx-auto mb-3 text-success-500" />
                <p className="text-gray-600 dark:text-gray-400">No security findings detected. Your cluster is secure!</p>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Finding Detail Modal */}
      <AnimatePresence>
        {selectedFinding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => { setSelectedFinding(null); setShowInlineAi(false); setAiRemediation(null); }}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${getSeverityColor(selectedFinding.severity)}`}>
                        {selectedFinding.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 uppercase">{selectedFinding.type}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedFinding.title}</h3>
                  </div>
                  <button
                    onClick={() => { setSelectedFinding(null); setShowInlineAi(false); setAiRemediation(null); }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <XCircleIcon className="h-6 w-6 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Plain English Explanation */}
                  {(() => {
                    const plainEnglish = getPlainEnglishExplanation(selectedFinding);
                    return (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-500/20">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
                            <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                              💡 What does this mean?
                            </h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                              {plainEnglish.explanation}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2 mt-3 pt-3 border-t border-blue-200 dark:border-blue-500/20">
                          <div>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">📊 Business Impact:</p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                              {plainEnglish.businessImpact}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">📋 Compliance Risk:</p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                              {plainEnglish.complianceRisk}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Technical Details</h4>
                    <p className="text-gray-600 dark:text-gray-400">{selectedFinding.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">Resource</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{selectedFinding.resource_name}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">Namespace</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{selectedFinding.namespace}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">Type</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{selectedFinding.resource_type}</p>
                    </div>
                    {selectedFinding.cve_id && (
                      <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">CVE ID</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{selectedFinding.cve_id}</p>
                      </div>
                    )}
                  </div>

                  {selectedFinding.recommendation && (
                    <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4">
                      <h4 className="font-semibold text-primary-900 dark:text-primary-300 mb-2">Recommendation</h4>
                      <p className="text-sm text-primary-800 dark:text-primary-400">{selectedFinding.recommendation}</p>
                    </div>
                  )}

                  {/* Inline AI Analysis */}
                  {showInlineAi && (
                    <div className="mt-4">
                      {loadingAiRemediation === `finding-${selectedFinding.id}` ? (
                        <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border border-primary-200 dark:border-primary-700 rounded-xl p-6">
                          <div className="flex items-center gap-3">
                            <Spinner />
                            <div>
                              <h4 className="font-bold text-primary-700 dark:text-primary-300">AI Analyzing...</h4>
                              <p className="text-xs text-primary-600 dark:text-primary-400">Generating remediation advice</p>
                            </div>
                          </div>
                        </div>
                      ) : aiRemediation && (
                        <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border border-primary-200 dark:border-primary-700 rounded-xl p-6">
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-primary-200 dark:border-primary-700">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary-500 rounded-lg">
                                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-bold text-primary-700 dark:text-primary-300">AI-Powered Analysis</h4>
                                <p className="text-xs text-primary-600 dark:text-primary-400">Powered by Google Gemini</p>
                              </div>
                            </div>
                            <button
                              onClick={() => { setShowInlineAi(false); setAiRemediation(null); }}
                              className="p-1.5 hover:bg-primary-200 dark:hover:bg-primary-800 rounded-lg transition-colors"
                            >
                              <XCircleIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                            </button>
                          </div>

                          {aiRemediation.ai_powered && aiRemediation.remediation?.analysis && (
                            <div className="prose prose-sm max-w-none max-h-[300px] overflow-y-auto">
                              <ReactMarkdown components={markdownComponents}>
                                {aiRemediation.remediation.analysis}
                              </ReactMarkdown>
                            </div>
                          )}

                          {!aiRemediation.ai_powered && aiRemediation.remediation?.steps && (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              <h5 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <CheckCircleIcon className="h-4 w-4 text-success-500" />
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

                          {aiRemediation.note && (
                            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
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
                        <span className="text-success-600 dark:text-success-400">Auto-remediation available</span>
                      ) : (
                        <span>Manual remediation required</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => fetchAiRemediation(selectedFinding)}
                        disabled={loadingAiRemediation === `finding-${selectedFinding.id}`}
                        className="px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-primary-500/25"
                      >
                        {loadingAiRemediation === `finding-${selectedFinding.id}` ? (
                          <><Spinner size="sm" color="white" /> Analyzing...</>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                            </svg>
                            Ask AI
                          </>
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setSelectedFinding(null); setShowInlineAi(false); setAiRemediation(null); }}
                        className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-xl transition-colors"
                      >
                        Close
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Security Dashboard Help</h3>
                  <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                    <XCircleIcon className="h-6 w-6 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-6 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Security Score</h4>
                    <p>Your cluster's overall security health rated from 0-100. Grade A (90-100) is excellent, F (below 50) needs immediate attention.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Vulnerabilities</h4>
                    <p>CVEs found in container images. Critical and High severity vulnerabilities should be addressed first.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">RBAC Analysis</h4>
                    <p>Analyzes Role-Based Access Control for overly permissive access like cluster-admin bindings and wildcard permissions.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Network Policies</h4>
                    <p>Shows how many pods are protected by NetworkPolicies. Unprotected pods can communicate freely, which is a security risk.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">AI Remediation</h4>
                    <p>Click "Ask AI" on any finding to get AI-powered remediation advice with specific commands and best practices.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Scans Modal */}
      <AnimatePresence>
        {showImageScans && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowImageScans(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Container Image Scans</h3>
                  <button onClick={() => setShowImageScans(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                    <XCircleIcon className="h-6 w-6 text-gray-500" />
                  </button>
                </div>
                <div className="space-y-4">
                  {imageScans.map((scan, idx) => (
                    <div key={idx} className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedImage(expandedImage === scan.image ? null : scan.image)}
                      >
                        <div className="flex-1">
                          <h4 className="font-mono text-sm text-gray-900 dark:text-white truncate">{scan.image}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Scanned: {new Date(scan.scan_time).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-lg font-bold text-danger-600">{scan.vulnerabilities.critical}</div>
                            <div className="text-xs text-gray-500">Critical</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-warning-600">{scan.vulnerabilities.high}</div>
                            <div className="text-xs text-gray-500">High</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-600">{scan.vulnerabilities.total}</div>
                            <div className="text-xs text-gray-500">Total</div>
                          </div>
                          <ChevronDownIcon className={`h-5 w-5 transition-transform ${expandedImage === scan.image ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <AnimatePresence>
                        {expandedImage === scan.image && scan.vulnerability_details.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-4 overflow-hidden"
                          >
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {scan.vulnerability_details.slice(0, 10).map((vuln, vIdx) => (
                                <div key={vIdx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg text-sm">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getSeverityColor(vuln.severity)}`}>
                                        {vuln.severity}
                                      </span>
                                      <span className="font-mono text-xs">{vuln.vulnerability_id}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {vuln.pkg_name} {vuln.installed_version} → {vuln.fixed_version || 'No fix'}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => fetchAiRemediationForVulnerability(vuln, scan.image)}
                                    disabled={loadingAiRemediation === `vuln-${vuln.vulnerability_id}`}
                                    className="px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200"
                                  >
                                    {loadingAiRemediation === `vuln-${vuln.vulnerability_id}` ? <Spinner size="sm" /> : 'Ask AI'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RBAC Detail Modal */}
      <AnimatePresence>
        {showRbacModal && rbacDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowRbacModal(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">RBAC Analysis Details</h3>
                  <button onClick={() => setShowRbacModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                    <XCircleIcon className="h-6 w-6 text-gray-500" />
                  </button>
                </div>

                {rbacDetail.service_account_risks.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Risky Service Accounts</h4>
                    <div className="space-y-2">
                      {rbacDetail.service_account_risks.map((sa, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono text-sm text-gray-900 dark:text-white">{sa.name}</span>
                              <span className="text-xs text-gray-500 ml-2">({sa.namespace})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(sa.risk_level)}`}>
                                {sa.risk_level.toUpperCase()}
                              </span>
                              <button
                                onClick={() => fetchAiRemediationForServiceAccount(sa)}
                                disabled={loadingAiRemediation === `sa-${sa.namespace}-${sa.name}`}
                                className="px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200"
                              >
                                {loadingAiRemediation === `sa-${sa.namespace}-${sa.name}` ? <Spinner size="sm" /> : 'Ask AI'}
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                            {sa.issues.join(' • ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rbacDetail.role_binding_risks.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Risky Role Bindings</h4>
                    <div className="space-y-2">
                      {rbacDetail.role_binding_risks.map((rb, idx) => (
                        <div key={idx} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono text-sm text-gray-900 dark:text-white">{rb.name}</span>
                              <span className="text-xs text-gray-500 ml-2">({rb.binding_type})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityColor(rb.risk_level)}`}>
                                {rb.risk_level.toUpperCase()}
                              </span>
                              <button
                                onClick={() => fetchAiRemediationForRoleBinding(rb)}
                                disabled={loadingAiRemediation === `rb-${rb.namespace || 'cluster'}-${rb.name}`}
                                className="px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200"
                              >
                                {loadingAiRemediation === `rb-${rb.namespace || 'cluster'}-${rb.name}` ? <Spinner size="sm" /> : 'Ask AI'}
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                            {rb.issues.join(' • ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rbacDetail.recommendations.length > 0 && (
                  <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
                    <h4 className="font-semibold text-primary-900 dark:text-primary-300 mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {rbacDetail.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-primary-800 dark:text-primary-400 flex items-start gap-2">
                          <span className="text-primary-500">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Network Policy Detail Modal */}
      <AnimatePresence>
        {showNetPolModal && networkPolicyDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowNetPolModal(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Network Policy Coverage</h3>
                  <button onClick={() => setShowNetPolModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                    <XCircleIcon className="h-6 w-6 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-3">
                  {networkPolicyDetail.namespaces.map((ns, idx) => (
                    <div key={idx} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-sm text-gray-900 dark:text-white">{ns.namespace}</span>
                          <span className="text-xs text-gray-500 ml-2">({ns.pods_covered}/{ns.pods_total} pods)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            ns.status === 'protected' ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
                            ns.status === 'partial' ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400' :
                            'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                          }`}>
                            {ns.status.toUpperCase()}
                          </span>
                          {ns.status !== 'protected' && (
                            <button
                              onClick={() => fetchAiRemediationForNetworkPolicy(ns)}
                              disabled={loadingAiRemediation === `netpol-${ns.namespace}`}
                              className="px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200"
                            >
                              {loadingAiRemediation === `netpol-${ns.namespace}` ? <Spinner size="sm" /> : 'Ask AI'}
                            </button>
                          )}
                        </div>
                      </div>
                      {ns.pods_uncovered.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          Uncovered: {ns.pods_uncovered.slice(0, 3).join(', ')}{ns.pods_uncovered.length > 3 && `... (+${ns.pods_uncovered.length - 3})`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {networkPolicyDetail.recommendations.length > 0 && (
                  <div className="mt-6 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
                    <h4 className="font-semibold text-primary-900 dark:text-primary-300 mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {networkPolicyDetail.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-primary-800 dark:text-primary-400 flex items-start gap-2">
                          <span className="text-primary-500">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trends Detail Modal */}
      <AnimatePresence>
        {showTrendsModal && trendsDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowTrendsModal(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Security Trends (30 Days)</h3>
                  <button onClick={() => setShowTrendsModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                    <XCircleIcon className="h-6 w-6 text-gray-500" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Score</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Critical</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">High</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {trendsDetail.trend_data.map((point, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {new Date(point.timestamp).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{point.security_score}</td>
                          <td className="px-4 py-3 text-sm text-danger-600 dark:text-danger-400">{point.critical_count}</td>
                          <td className="px-4 py-3 text-sm text-warning-600 dark:text-warning-400">{point.high_count}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{point.total_vulnerabilities}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Remediation Modal */}
      <AnimatePresence>
        {showAiModal && aiRemediation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => setShowAiModal(false)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                        <svg className="h-6 w-6 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 24 24">
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
                      <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${getSeverityColor(aiRemediation.finding?.severity || 'medium')}`}>
                        {aiRemediation.finding?.severity?.toUpperCase() || 'UNKNOWN'}
                      </span>
                      <span className="text-sm text-gray-500">{aiRemediation.finding?.type}</span>
                    </div>
                  </div>
                  <button onClick={() => setShowAiModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                    <XCircleIcon className="h-6 w-6 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-6">
                  {aiRemediation.finding?.title && (
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Finding</h4>
                      <p className="text-gray-700 dark:text-gray-300">{aiRemediation.finding.title}</p>
                      {aiRemediation.finding.resource && (
                        <p className="text-sm text-gray-500 mt-1 font-mono">
                          Resource: {aiRemediation.finding.resource}
                          {aiRemediation.finding.namespace && ` (${aiRemediation.finding.namespace})`}
                        </p>
                      )}
                    </div>
                  )}

                  {aiRemediation.ai_powered && aiRemediation.remediation?.analysis && (
                    <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border border-primary-200 dark:border-primary-700 rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-primary-200 dark:border-primary-700">
                        <div className="p-2 bg-primary-500 rounded-lg">
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-bold text-primary-700 dark:text-primary-300">AI Analysis</h4>
                          <p className="text-xs text-primary-600 dark:text-primary-400">Detailed remediation guidance</p>
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown components={markdownComponents}>
                          {aiRemediation.remediation.analysis}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {!aiRemediation.ai_powered && aiRemediation.remediation?.steps && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white">Remediation Steps</h4>
                      {aiRemediation.remediation.steps.map((step, index) => (
                        <div key={index} className="flex gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary-600 text-white text-xs font-semibold rounded-full">
                            {index + 1}
                          </span>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiRemediation.note && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <p className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                        <InformationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        {aiRemediation.note}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
