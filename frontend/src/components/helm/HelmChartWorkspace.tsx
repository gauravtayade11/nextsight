import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import GlassCard from '../common/GlassCard';
import { helmApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { HelmRelease, HelmReleaseHistory, HelmChartSearchResult } from '../../types';
import {
  CubeIcon,
  RocketLaunchIcon,
  ArrowUpTrayIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
  DocumentTextIcon,
  EyeIcon,
  CodeBracketIcon,
  ClockIcon,
  SparklesIcon,
  FolderIcon,
  DocumentIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  LightBulbIcon,
  WrenchScrewdriverIcon,
  ServerStackIcon,
  DocumentDuplicateIcon,
  BeakerIcon,
  MagnifyingGlassCircleIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';

// Types
type TabType = 'values' | 'rendered' | 'diff' | 'history' | 'resources' | 'ai' | 'health';

interface TemplateFile {
  name: string;
  type: 'file' | 'folder';
  children?: TemplateFile[];
}

interface AIInsight {
  type: 'warning' | 'suggestion' | 'info';
  message: string;
  fix?: string;
}

// Default values template
const DEFAULT_VALUES = `# Default values for chart
replicaCount: 3

image:
  repository: nginx
  tag: stable
  pullPolicy: IfNotPresent

service:
  type: LoadBalancer
  port: 80

ingress:
  enabled: false
  className: ""
  annotations: {}
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: ImplementationSpecific

resources:
  limits:
    cpu: 200m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

nodeSelector: {}
tolerations: []
affinity: {}
`;

// Mock template files structure
const mockTemplateFiles: TemplateFile[] = [
  { name: 'values.yaml', type: 'file' },
  { name: 'values-production.yaml', type: 'file' },
  {
    name: 'templates',
    type: 'folder',
    children: [
      { name: 'deployment.yaml', type: 'file' },
      { name: 'service.yaml', type: 'file' },
      { name: 'ingress.yaml', type: 'file' },
      { name: 'configmap.yaml', type: 'file' },
      { name: 'secret.yaml', type: 'file' },
      { name: 'hpa.yaml', type: 'file' },
      { name: 'serviceaccount.yaml', type: 'file' },
      { name: '_helpers.tpl', type: 'file' },
      { name: 'NOTES.txt', type: 'file' },
    ],
  },
  { name: 'Chart.yaml', type: 'file' },
  { name: 'README.md', type: 'file' },
];


// Template Tree Component
function TemplateTree({
  files,
  selectedFile,
  onSelectFile,
  level = 0,
}: {
  files: TemplateFile[];
  selectedFile: string | null;
  onSelectFile: (name: string) => void;
  level?: number;
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['templates']));

  const toggleFolder = (name: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  return (
    <div className="space-y-0.5">
      {files.map((file) => (
        <div key={file.name}>
          <motion.button
            whileHover={{ x: 2 }}
            onClick={() => {
              if (file.type === 'folder') {
                toggleFolder(file.name);
              } else {
                onSelectFile(file.name);
              }
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
              selectedFile === file.name
                ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                : 'hover:bg-gray-100 dark:hover:bg-slate-700/50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            {file.type === 'folder' ? (
              <>
                {expandedFolders.has(file.name) ? (
                  <ChevronDownIcon className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                )}
                <FolderIcon className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </>
            ) : (
              <>
                <span className="w-3" />
                <DocumentIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              </>
            )}
            <span className="text-xs truncate">{file.name}</span>
          </motion.button>
          {file.type === 'folder' && expandedFolders.has(file.name) && file.children && (
            <TemplateTree
              files={file.children}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const isHealthy = status === 'deployed';
  const isFailed = status === 'failed';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isHealthy
          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : isFailed
          ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
      }`}
    >
      {isHealthy ? (
        <CheckCircleIcon className="h-3.5 w-3.5" />
      ) : isFailed ? (
        <XCircleIcon className="h-3.5 w-3.5" />
      ) : (
        <ClockIcon className="h-3.5 w-3.5 animate-pulse" />
      )}
      {isHealthy ? 'Healthy' : isFailed ? 'Failed' : 'Pending'}
    </span>
  );
}

// AI Insight Component
function AIInsightCard({ insight, onApplyFix }: { insight: AIInsight; onApplyFix?: () => void }) {
  const iconConfig = {
    warning: { icon: ExclamationTriangleIcon, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
    suggestion: { icon: LightBulbIcon, color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20' },
    info: { icon: SparklesIcon, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' },
  };

  const config = iconConfig[insight.type];
  const Icon = config.icon;

  return (
    <div className={`p-2 rounded-lg ${config.bg} border ${config.border}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-3.5 w-3.5 ${config.color} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-700 dark:text-gray-300">{insight.message}</p>
          {insight.fix && onApplyFix && (
            <button
              onClick={onApplyFix}
              className="mt-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
            >
              Apply Fix
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function HelmChartWorkspace() {
  const navigate = useNavigate();
  const { namespace, releaseName } = useParams<{ namespace: string; releaseName: string }>();
  const [searchParams] = useSearchParams();
  const chartParam = searchParams.get('chart');
  const modeParam = searchParams.get('mode') || 'edit'; // 'install' | 'edit' | 'upgrade'

  // State
  const [activeTab, setActiveTab] = useState<TabType>('values');
  const [selectedFile, setSelectedFile] = useState<string>('values.yaml');
  const [valuesContent, setValuesContent] = useState(DEFAULT_VALUES);
  const [release, setRelease] = useState<HelmRelease | null>(null);
  const [history, setHistory] = useState<HelmReleaseHistory[]>([]);
  const [chartInfo, setChartInfo] = useState<{ name: string; version: string; repository: string; description?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deploymentProgress, setDeploymentProgress] = useState<{
    show: boolean;
    message: string;
    stage: 'validating' | 'deploying' | 'verifying' | 'success' | 'error';
    error?: string;
    isRepoError?: boolean;
    missingRepo?: string;
  }>({ show: false, message: '', stage: 'validating' });

  // Installation config state (for install mode only)
  const [installNamespace, setInstallNamespace] = useState('default');
  const [installReleaseName, setInstallReleaseName] = useState('');

  // Resources state
  const [manifest, setManifest] = useState<string>('');
  const [loadingManifest, setLoadingManifest] = useState(false);

  // Test state
  const [testInProgress, setTestInProgress] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; notes?: string } | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  // Preview/dry-run state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewManifest, setPreviewManifest] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Health monitoring state
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [troubleshootData, setTroubleshootData] = useState<any>(null);
  const [troubleshootLoading, setTroubleshootLoading] = useState(false);

  // Parse chart info from param or release
  useEffect(() => {
    if (chartParam) {
      const parts = chartParam.split('/');
      if (parts.length >= 2) {
        const chartName = parts[1];
        setChartInfo({
          repository: parts[0],
          name: chartName,
          version: searchParams.get('version') || 'latest',
          description: 'Helm chart',
        });
        // Set default release name for installation
        setInstallReleaseName(chartName);
      }
    }
  }, [chartParam, searchParams]);

  // Fetch release data if editing existing release
  const fetchRelease = useCallback(async () => {
    if (!namespace || !releaseName) return;

    logger.debug('[FetchRelease] Fetching release data for', { releaseName, namespace });
    setLoading(true);
    setError(null);
    try {
      const [releaseRes, valuesRes, historyRes] = await Promise.all([
        helmApi.getRelease(namespace, releaseName),
        helmApi.getReleaseValues(namespace, releaseName),
        helmApi.getReleaseHistory(namespace, releaseName),
      ]);

      logger.debug('[FetchRelease] Release data', releaseRes.data);
      logger.debug('[FetchRelease] Values data', valuesRes.data);
      logger.debug('[FetchRelease] History data', historyRes.data);

      setRelease(releaseRes.data);
      setHistory(historyRes.data || []);

      // Set chart info from release
      setChartInfo({
        name: releaseRes.data.chart,
        version: releaseRes.data.chart_version,
        repository: 'installed',
        description: releaseRes.data.description,
      });

      // Set values content from user_supplied or computed values
      const values = valuesRes.data?.user_supplied || valuesRes.data?.computed || {};
      if (Object.keys(values).length > 0) {
        const yaml = await import('js-yaml');
        const yamlString = yaml.dump(values, { indent: 2, lineWidth: -1 });
        logger.debug('[FetchRelease] Setting values content, length', yamlString.length);
        setValuesContent(yamlString);
      } else {
        logger.debug('[FetchRelease] No values found, keeping current content');
      }
    } catch (err) {
      logger.error('[FetchRelease] Failed to fetch release', err);
      setError('Failed to fetch release details');
    } finally {
      setLoading(false);
      logger.debug('[FetchRelease] Fetch completed');
    }
  }, [namespace, releaseName]);

  // Fetch manifest (all Kubernetes resources)
  const fetchManifest = useCallback(async () => {
    if (!namespace || !releaseName) return;

    setLoadingManifest(true);
    try {
      const res = await helmApi.getManifest(namespace, releaseName);
      setManifest(res.data.manifest || '');
    } catch (err) {
      logger.error('Failed to fetch manifest', err);
      setError('Failed to fetch manifest');
    } finally {
      setLoadingManifest(false);
    }
  }, [namespace, releaseName]);

  // Fetch health data
  const fetchHealth = useCallback(async () => {
    if (!namespace || !releaseName) return;

    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await helmApi.getReleaseHealth(namespace, releaseName);
      setHealthData(res.data);
    } catch (err: any) {
      logger.error('Failed to fetch health', err);
      setHealthError(err.response?.data?.detail || 'Failed to fetch health data');
    } finally {
      setHealthLoading(false);
    }
  }, [namespace, releaseName]);

  // AI Configuration Analysis
  const analyzeConfig = useCallback(async () => {
    if (!valuesContent) {
      setAiError('No configuration to analyze');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await helmApi.analyzeConfig(
        valuesContent,
        chartInfo?.name,
        namespace || installNamespace
      );
      setAiAnalysis(res.data);
      // Auto-switch to AI tab to show results
      setActiveTab('ai');
    } catch (err: any) {
      logger.error('Failed to analyze config', err);
      setAiError(err.response?.data?.detail || 'Failed to analyze configuration');
    } finally {
      setAiLoading(false);
    }
  }, [valuesContent, chartInfo?.name, namespace, installNamespace]);

  // AI Troubleshooting
  const troubleshootRelease = useCallback(async () => {
    if (!namespace || !releaseName || !healthData) {
      setAiError('Health data required for troubleshooting');
      return;
    }

    setTroubleshootLoading(true);
    setAiError(null);
    try {
      const res = await helmApi.troubleshoot(
        releaseName,
        namespace,
        healthData,
        manifest || undefined
      );
      setTroubleshootData(res.data);
      setAiAnalysis(null); // Clear config analysis when showing troubleshooting
      // Auto-switch to AI tab to show results
      setActiveTab('ai');
    } catch (err: any) {
      logger.error('Failed to troubleshoot', err);
      setAiError(err.response?.data?.detail || 'Failed to troubleshoot release');
    } finally {
      setTroubleshootLoading(false);
    }
  }, [namespace, releaseName, healthData, manifest]);

  useEffect(() => {
    if (namespace && releaseName) {
      fetchRelease();
    }
  }, [fetchRelease, namespace, releaseName]);

  // Fetch chart default values when in install mode
  useEffect(() => {
    const fetchChartValues = async () => {
      if (modeParam !== 'install' || !chartInfo) return;

      logger.debug('[FetchChartValues] Fetching default values for chart', chartInfo);
      setLoading(true);
      try {
        const chartFullName = `${chartInfo.repository}/${chartInfo.name}`;
        logger.debug('[FetchChartValues] Requesting values for', chartFullName);

        const response = await helmApi.getChartValues(chartFullName);
        logger.debug('[FetchChartValues] Received values', response.data);

        if (response.data && Object.keys(response.data).length > 0) {
          const yaml = await import('js-yaml');
          const yamlString = yaml.dump(response.data, { indent: 2, lineWidth: -1 });
          logger.debug('[FetchChartValues] Setting values content, length', yamlString.length);
          setValuesContent(yamlString);
        } else {
          logger.debug('[FetchChartValues] No values returned, keeping default template');
        }
      } catch (err) {
        logger.error('[FetchChartValues] Failed to fetch chart values', err);
        // Keep the default values template if fetch fails
        logger.debug('[FetchChartValues] Using default values template due to error');
      } finally {
        setLoading(false);
      }
    };

    fetchChartValues();
  }, [modeParam, chartInfo]);

  // Handlers
  const handleInstall = async () => {
    logger.debug('[Deploy] Install button clicked');
    logger.debug('[Deploy] Chart Info', chartInfo);
    logger.debug('[Deploy] Namespace', installNamespace);
    logger.debug('[Deploy] Release Name', installReleaseName);

    if (!chartInfo) {
      logger.error('[Deploy] No chart info available');
      setError('No chart information available. Please go back and select a chart.');
      return;
    }

    if (!installReleaseName.trim()) {
      setError('Please enter a release name.');
      return;
    }

    // Show progress modal
    logger.debug('[Deploy] Showing progress modal - Validating');
    setDeploymentProgress({
      show: true,
      message: 'Validating YAML configuration...',
      stage: 'validating',
    });

    setSaving(true);
    setError(null);

    try {
      // Parse values YAML to object
      let valuesObj = {};
      try {
        const yaml = await import('js-yaml');
        valuesObj = yaml.load(valuesContent) as Record<string, unknown>;
        logger.debug('[Deploy] YAML parsed successfully');
      } catch (yamlErr) {
        logger.error('[Deploy] YAML parse error', yamlErr);
        throw new Error('Invalid YAML syntax. Please fix the configuration and try again.');
      }

      // Update progress
      logger.debug('[Deploy] Showing progress modal - Deploying');
      setDeploymentProgress({
        show: true,
        message: `Installing ${chartInfo.name} to ${installNamespace} namespace...`,
        stage: 'deploying',
      });

      const installRequest = {
        release_name: installReleaseName,
        chart: `${chartInfo.repository}/${chartInfo.name}`,
        namespace: installNamespace,
        version: chartInfo.version,
        values: valuesObj,
      };
      logger.debug('[Deploy] Sending install request', installRequest);

      const response = await helmApi.installRelease(installRequest);
      logger.debug('[Deploy] Install response', response);

      // Show success
      logger.debug('[Deploy] Installation successful');
      setDeploymentProgress({
        show: true,
        message: `Successfully installed ${chartInfo.name}!`,
        stage: 'success',
      });

      // Navigate after brief success display
      setTimeout(() => {
        navigate('/deploy/helm');
      }, 1500);
    } catch (err: any) {
      logger.error('[Deploy] Installation failed', err);
      logger.error('[Deploy] Error response', err.response);
      logger.error('[Deploy] Error data', err.response?.data);

      const errorMessage = err.response?.data?.detail || err.message || 'Failed to install chart';
      const clusterError = errorMessage.includes('cluster unreachable') ||
                          errorMessage.includes('connection refused') ||
                          errorMessage.includes('Kubernetes cluster unreachable');

      // Check for repository not found error
      const repoError = errorMessage.includes('repo') && errorMessage.includes('not found');
      const repoMatch = errorMessage.match(/repo ([a-zA-Z0-9-]+) not found/);
      const missingRepoName = repoMatch ? repoMatch[1] : chartInfo?.repository;

      logger.debug('[Deploy] Error message', errorMessage);
      logger.debug('[Deploy] Is cluster error', clusterError);
      logger.debug('[Deploy] Is repo error', repoError);
      logger.debug('[Deploy] Missing repo', missingRepoName);

      setDeploymentProgress({
        show: true,
        message: 'Installation failed',
        stage: 'error',
        error: clusterError
          ? 'Kubernetes cluster is not running. Please start your cluster (Docker Desktop, minikube, etc.) and try again.'
          : repoError
          ? `The repository "${missingRepoName}" is not configured on your system. You need to add it before installing charts from this repository.`
          : errorMessage,
        isRepoError: repoError,
        missingRepo: missingRepoName,
      });
      setError(errorMessage);
    } finally {
      setSaving(false);
      logger.debug('[Deploy] Install process completed');
    }
  };

  const handleUpgrade = async () => {
    if (!namespace || !releaseName) return;

    logger.debug('[Upgrade] Upgrade button clicked');
    logger.debug('[Upgrade] Release', { releaseName, namespace });

    // Show progress modal
    setDeploymentProgress({
      show: true,
      message: 'Validating YAML configuration...',
      stage: 'validating',
    });

    setSaving(true);
    setError(null);

    try {
      let valuesObj = {};
      try {
        const yaml = await import('js-yaml');
        valuesObj = yaml.load(valuesContent) as Record<string, unknown>;
        logger.debug('[Upgrade] YAML parsed successfully');
      } catch (yamlErr) {
        logger.error('[Upgrade] YAML parse error', yamlErr);
        throw new Error('Invalid YAML syntax. Please fix the configuration and try again.');
      }

      // Update progress
      logger.debug('[Upgrade] Showing progress modal - Deploying');
      setDeploymentProgress({
        show: true,
        message: `Upgrading ${releaseName} in ${namespace} namespace...`,
        stage: 'deploying',
      });

      const upgradeRequest = {
        values: valuesObj,
        reuse_values: false,
      };
      logger.debug('[Upgrade] Sending upgrade request', upgradeRequest);

      const response = await helmApi.upgradeRelease(namespace, releaseName, upgradeRequest);
      logger.debug('[Upgrade] Upgrade response', response);

      // Check if upgrade actually succeeded
      if (!response.data.success) {
        throw new Error(response.data.message || 'Upgrade failed');
      }

      // Show success
      logger.debug('[Upgrade] Upgrade successful');
      setDeploymentProgress({
        show: true,
        message: `Successfully upgraded ${releaseName}!`,
        stage: 'success',
      });

      // Refresh and close modal after success
      setTimeout(async () => {
        logger.debug('[Upgrade] Closing modal and refreshing data...');
        setDeploymentProgress({ show: false, message: '', stage: 'validating' });

        // Refetch release data and history
        logger.debug('[Upgrade] Fetching updated release data...');
        await fetchRelease();
        logger.debug('[Upgrade] Data refresh completed');
      }, 1500);
    } catch (err: any) {
      logger.error('[Upgrade] Upgrade failed', err);
      logger.error('[Upgrade] Error response', err.response);
      logger.error('[Upgrade] Error data', err.response?.data);

      const errorMessage = err.response?.data?.detail || err.message || 'Failed to upgrade release';
      const clusterError = errorMessage.includes('cluster unreachable') || errorMessage.includes('connection refused');

      logger.debug('[Upgrade] Error message', errorMessage);
      logger.debug('[Upgrade] Is cluster error', clusterError);

      setDeploymentProgress({
        show: true,
        message: 'Upgrade failed',
        stage: 'error',
        error: clusterError
          ? 'Kubernetes cluster is not running. Please start your cluster (Docker Desktop, minikube, etc.) and try again.'
          : errorMessage,
      });
      setError(errorMessage);
    } finally {
      setSaving(false);
      logger.debug('[Upgrade] Upgrade process completed');
    }
  };

  const handleTest = async () => {
    if (!namespace || !releaseName) return;

    setTestInProgress(true);
    setTestResult(null);
    setShowTestModal(true);

    try {
      const response = await helmApi.testRelease(namespace, releaseName);

      if (!response.data.success) {
        setTestResult({
          success: false,
          message: response.data.message || 'Tests failed',
          notes: response.data.notes,
        });
      } else {
        setTestResult({
          success: true,
          message: response.data.message || 'All tests passed',
          notes: response.data.notes,
        });
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to run tests';
      setTestResult({
        success: false,
        message: errorMessage,
        notes: err.response?.data?.notes,
      });
    } finally {
      setTestInProgress(false);
    }
  };

  const handlePreviewUpgrade = async () => {
    if (!namespace || !releaseName) return;

    setPreviewLoading(true);
    setPreviewError(null);
    setShowPreviewModal(true);
    setPreviewManifest('');

    try {
      // Parse YAML values
      let valuesObj = {};
      try {
        const yaml = await import('js-yaml');
        valuesObj = yaml.load(valuesContent) as Record<string, unknown>;
      } catch (yamlErr) {
        throw new Error('Invalid YAML syntax. Please fix the configuration and try again.');
      }

      // Call upgrade with dry_run=true
      const upgradeRequest = {
        values: valuesObj,
        reuse_values: false,
        dry_run: true,
      };

      const response = await helmApi.upgradeRelease(namespace, releaseName, upgradeRequest);

      if (!response.data.success) {
        setPreviewError(response.data.message || 'Preview failed');
      } else {
        setPreviewManifest(response.data.manifest || 'No manifest returned');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to preview changes';
      setPreviewError(errorMessage);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewInstall = async () => {
    if (!installNamespace || !installReleaseName || !chartInfo) return;

    setPreviewLoading(true);
    setPreviewError(null);
    setShowPreviewModal(true);
    setPreviewManifest('');

    try {
      // Parse YAML values
      let valuesObj = {};
      try {
        const yaml = await import('js-yaml');
        valuesObj = yaml.load(valuesContent) as Record<string, unknown>;
      } catch (yamlErr) {
        throw new Error('Invalid YAML syntax. Please fix the configuration and try again.');
      }

      // Call install with dry_run=true
      const installRequest = {
        release_name: installReleaseName,
        chart: `${chartInfo.repository}/${chartInfo.name}`,
        namespace: installNamespace,
        version: chartInfo.version !== 'latest' ? chartInfo.version : undefined,
        values: valuesObj,
        create_namespace: true,
        dry_run: true,
      };

      const response = await helmApi.installRelease(installRequest);

      if (!response.data.success) {
        setPreviewError(response.data.message || 'Preview failed');
      } else {
        setPreviewManifest(response.data.manifest || 'No manifest returned');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to preview installation';
      setPreviewError(errorMessage);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRollback = async (targetRevision?: number) => {
    if (!namespace || !releaseName || !release) return;

    // If no target revision specified, rollback to previous
    const revision = targetRevision || (release.revision - 1);

    if (revision < 1) return;

    // Confirm rollback
    const revisionInfo = history.find(h => h.revision === revision);
    const confirmMessage = targetRevision
      ? `Are you sure you want to rollback to revision ${revision}?\n\nChart: ${revisionInfo?.chart} v${revisionInfo?.chart_version}\nDeployed: ${revisionInfo?.updated}`
      : `Are you sure you want to rollback to the previous revision?`;

    if (!confirm(confirmMessage)) return;

    setSaving(true);
    setError(null);
    try {
      await helmApi.rollbackRelease(namespace, releaseName, revision);
      await fetchRelease();
    } catch (err) {
      logger.error('Failed to rollback', err);
      setError('Failed to rollback release');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!namespace || !releaseName) return;
    if (!confirm(`Are you sure you want to delete release "${releaseName}"?`)) return;

    setSaving(true);
    setError(null);
    try {
      await helmApi.uninstallRelease(namespace, releaseName);
      navigate('/deploy/helm');
    } catch (err) {
      logger.error('Failed to delete', err);
      setError('Failed to delete release');
    } finally {
      setSaving(false);
    }
  };

  const isInstallMode = modeParam === 'install' || (!namespace && !releaseName);

  // Different tabs for install vs edit mode
  const tabs = isInstallMode
    ? [
        { id: 'values' as TabType, label: 'Configure', icon: DocumentTextIcon },
        { id: 'ai' as TabType, label: 'AI Assistant', icon: SparklesIcon },
      ]
    : [
        { id: 'values' as TabType, label: 'Values', icon: DocumentTextIcon },
        { id: 'diff' as TabType, label: 'Preview Changes', icon: CodeBracketIcon },
        { id: 'resources' as TabType, label: 'Resources', icon: ServerStackIcon },
        { id: 'health' as TabType, label: 'Health', icon: HeartIcon },
        { id: 'history' as TabType, label: 'History', icon: ClockIcon },
        { id: 'ai' as TabType, label: 'AI Review', icon: SparklesIcon },
      ];

  // Tabs that use their own 3-column layout (hide default sidebars)
  const fullWidthTabs = ['diff'];
  const useFullWidth = fullWidthTabs.includes(activeTab);

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-white dark:from-slate-900 dark:to-slate-800 flex-shrink-0">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/deploy/helm')}
            className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </motion.button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
              <CubeIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {chartInfo ? `${chartInfo.repository}/${chartInfo.name}` : 'Helm Chart Workspace'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isInstallMode ? 'Install new chart' : `Editing ${releaseName}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInstallMode ? (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePreviewInstall}
                disabled={saving || previewLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-all"
              >
                {previewLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <MagnifyingGlassCircleIcon className="h-5 w-5" />}
                Preview
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleInstall}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {saving ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <RocketLaunchIcon className="h-5 w-5" />}
                Install
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePreviewUpgrade}
                disabled={saving || previewLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-all"
              >
                {previewLoading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <MagnifyingGlassCircleIcon className="h-5 w-5" />}
                Preview
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUpgrade}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {saving ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <ArrowUpTrayIcon className="h-5 w-5" />}
                Upgrade
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRollback}
                disabled={saving || !release || release.revision <= 1}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-all"
              >
                <ArrowUturnLeftIcon className="h-5 w-5" />
                Rollback
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleTest}
                disabled={saving || testInProgress}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 disabled:opacity-50 transition-all"
              >
                {testInProgress ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <BeakerIcon className="h-5 w-5" />}
                Test
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 transition-all"
              >
                <TrashIcon className="h-5 w-5" />
                Delete
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </motion.button>
          );
        })}
      </div>

      {/* Main Content - 2 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Hidden for diff tab */}
        {!useFullWidth && (
        <div className="w-64 flex flex-col border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {/* Chart Info */}
          <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Chart Info
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500 dark:text-gray-400">Name:</span>
                  <span className="text-gray-900 dark:text-gray-300 font-medium">{chartInfo?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500 dark:text-gray-400">Version:</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-medium">{chartInfo?.version || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Repo:</span>
                  <span className="text-gray-900 dark:text-gray-300 font-medium">{chartInfo?.repository || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-3 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.yaml,.yml';
                  input.onchange = (e: any) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setValuesContent(e.target?.result as string);
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
              >
                <CloudArrowUpIcon className="h-4 w-4" />
                Import Values
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const blob = new Blob([valuesContent], { type: 'text/yaml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${chartInfo?.name || 'chart'}-values.yaml`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Export Values
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setValuesContent(DEFAULT_VALUES)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Reset to Default
              </motion.button>
            </div>
          </div>

          {/* YAML Validation */}
          <div className="flex-1 p-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              YAML Status
            </h3>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300">Valid YAML</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">No syntax errors detected</p>
            </div>
          </div>
        </div>
        )}

        {/* Center Column - Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'values' && (
              <motion.div
                key="values"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1"
              >
                <Editor
                  height="100%"
                  defaultLanguage="yaml"
                  value={valuesContent}
                  onChange={(value) => setValuesContent(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: true },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    fontLigatures: true,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    renderLineHighlight: 'all',
                    padding: { top: 16, bottom: 16 },
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'rendered' && (
              <motion.div
                key="rendered"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex overflow-hidden"
              >
                {/* Left Column - Rendered Template List */}
                <div className="w-64 flex flex-col border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Rendered Templates
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="p-3 space-y-1">
                      {['deployment.yaml', 'service.yaml', 'ingress.yaml', 'configmap.yaml', 'hpa.yaml', 'secret.yaml'].map((template, idx) => (
                        <motion.button
                          key={template}
                          whileHover={{ x: 2 }}
                          onClick={() => setSelectedFile(template)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                            selectedFile === template
                              ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                              : 'hover:bg-gray-100 dark:hover:bg-slate-700/50 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <DocumentIcon className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                            <span className="text-sm truncate">{template}</span>
                          </div>
                          {template === 'deployment.yaml' && (
                            <span className="text-xs text-gray-400">2 docs</span>
                          )}
                          {template === 'hpa.yaml' && (
                            <span className="text-xs text-purple-500">AI</span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded" />
                      Show empty manifests
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      Collapse YAML sections
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      Highlight changes
                    </label>
                  </div>
                </div>

                {/* Center Column - YAML Viewer */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      FILE: {selectedFile || 'deployment.yaml'}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-3 py-1 text-xs font-medium bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600"
                    >
                      Copy YAML
                    </motion.button>
                  </div>
                  <Editor
                    height="100%"
                    defaultLanguage="yaml"
                    value={`apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-prod
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:stable
          ports:
            - containerPort: 80`}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: 'on',
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                      fontLigatures: true,
                      smoothScrolling: true,
                      renderLineHighlight: 'none',
                      padding: { top: 16, bottom: 16 },
                    }}
                  />
                </div>

                {/* Right Column - AI Template Analysis */}
                <div className="w-80 flex flex-col border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        AI Insights (Rendered Output)
                      </h3>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {aiLoading ? (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="mb-3"
                        >
                          <SparklesIcon className="h-6 w-6 text-purple-500" />
                        </motion.div>
                        <p className="text-sm">Analyzing rendered output...</p>
                      </div>
                    ) : aiAnalysis?.issues && aiAnalysis.issues.length > 0 ? (
                      aiAnalysis.issues.map((issue: any, idx: number) => (
                        <AIInsightCard
                          key={idx}
                          insight={{
                            type: issue.severity === 'critical' || issue.severity === 'high' ? 'warning' :
                                  issue.severity === 'medium' ? 'suggestion' : 'info',
                            message: `[${issue.severity?.toUpperCase() || 'INFO'}] ${issue.issue || issue.description || issue.message}`,
                            fix: issue.fix || issue.suggestion || 'See AI tab for details'
                          }}
                          onApplyFix={issue.auto_fixable ? () => {
                            logger.debug('Applying fix', issue.fix);
                          } : undefined}
                        />
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                        <SparklesIcon className="h-8 w-8 mb-3 opacity-50" />
                        <p className="text-sm text-center">Click "Analyze Config" to get AI insights on your rendered templates</p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-gray-200 dark:border-slate-700 flex-shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={analyzeConfig}
                      disabled={aiLoading || !valuesContent}
                      className="w-full px-3 py-2 text-sm font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <SparklesIcon className="h-4 w-4" />
                      {aiLoading ? 'Analyzing...' : 'Analyze Config'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'diff' && (
              <motion.div
                key="diff"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex overflow-hidden"
              >
                {/* Left Column - Diff Files List */}
                <div className="w-64 flex flex-col border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Diff Files
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="p-3 space-y-1">
                      {[
                        { name: 'deployment.yaml', changes: 4, type: 'modified' },
                        { name: 'service.yaml', changes: 0, type: 'unchanged' },
                        { name: 'ingress.yaml', changes: 1, type: 'modified' },
                        { name: 'configmap.yaml', changes: 2, type: 'modified' },
                        { name: 'hpa.yaml', changes: 0, type: 'added' },
                        { name: 'pdb.yaml', changes: 0, type: 'added-ai' },
                      ].map((file) => (
                        <motion.button
                          key={file.name}
                          whileHover={{ x: 2 }}
                          onClick={() => setSelectedFile(file.name)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                            selectedFile === file.name
                              ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                              : 'hover:bg-gray-100 dark:hover:bg-slate-700/50 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <DocumentIcon className={`h-4 w-4 flex-shrink-0 ${
                              file.type === 'added' || file.type === 'added-ai' ? 'text-green-500' :
                              file.type === 'modified' ? 'text-amber-500' : 'text-gray-400'
                            }`} />
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {file.type === 'added-ai' && (
                              <span className="text-xs text-purple-500 mr-1">AI</span>
                            )}
                            {file.changes > 0 ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">{file.changes}</span>
                            ) : file.type === 'unchanged' ? (
                              <span className="text-xs text-gray-400">—</span>
                            ) : (
                              <span className="text-xs text-green-600 dark:text-green-400">new</span>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 space-y-2">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded" />
                      Show only changed files
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      Group by resource
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input type="checkbox" className="rounded" />
                      Hide added/removed
                    </label>
                  </div>
                </div>

                {/* Center Column - Diff Viewer */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      FILE: {selectedFile || 'deployment.yaml'}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded-lg">
                        <button className="px-2 py-0.5 text-xs font-medium bg-white dark:bg-slate-800 rounded text-gray-700 dark:text-gray-300">
                          Unified
                        </button>
                        <button className="px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                          Split
                        </button>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-3 py-1 text-xs font-medium bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600"
                      >
                        Copy Diff
                      </motion.button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto bg-slate-900 p-4">
                    <div className="font-mono text-sm">
                      <div className="text-gray-400 mb-4">
                        <div>--- BEFORE (running)</div>
                        <div>+++ AFTER (new update)</div>
                      </div>

                      <div className="mb-4">
                        <div className="text-cyan-400 mb-2">@@ spec.replicas @@</div>
                        <div className="text-red-400">- replicas: 2</div>
                        <div className="text-green-400">+ replicas: 3</div>
                      </div>

                      <div className="mb-4">
                        <div className="text-cyan-400 mb-2">@@ container resources @@</div>
                        <div className="text-gray-300">            resources:</div>
                        <div className="text-red-400">-              limits: {'{}'}</div>
                        <div className="text-green-400">+              limits:</div>
                        <div className="text-green-400">+                cpu: 200m</div>
                        <div className="text-green-400">+                memory: 256Mi</div>
                      </div>

                      <div className="mb-4">
                        <div className="text-cyan-400 mb-2">@@ livenessProbe @@</div>
                        <div className="text-red-400">- # livenessProbe missing</div>
                        <div className="text-green-400">+ livenessProbe:</div>
                        <div className="text-green-400">+   httpGet: {'{ path: "/", port: 80 }'}</div>
                        <div className="text-green-400">+   initialDelaySeconds: 10</div>
                        <div className="text-green-400">+   periodSeconds: 10</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - AI Diff Summary */}
                <div className="w-80 flex flex-col border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        AI Summary of Changes
                      </h3>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                        <div className="flex items-start gap-2">
                          <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            Increased replicas from 2 → 3 to improve resilience
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                        <div className="flex items-start gap-2">
                          <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            Added CPU/Mem limits (200m / 256Mi) to prevent overuse
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                        <div className="flex items-start gap-2">
                          <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            Added missing livenessProbe for better health monitoring
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                        <div className="flex items-start gap-2">
                          <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            Added PodDisruptionBudget (recommended for HA)
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Risk Impact Assessment:
                        </h4>
                        <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500">•</span>
                            <span>No breaking changes detected</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500">•</span>
                            <span>Deployment may restart pods during rollout</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-gray-500">•</span>
                            <span>Expected rollout duration: ~10 seconds</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 space-y-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full px-3 py-2 text-sm font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                    >
                      Explain Each Change
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full px-3 py-2 text-sm font-medium bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors"
                    >
                      Suggest Optimal Config
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-auto p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Release History
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Current: Revision {release?.revision}
                  </span>
                </div>
                {history.length > 0 ? (
                  <div className="space-y-2">
                    {history.map((rev, idx) => {
                      const isCurrent = rev.revision === release?.revision;
                      // Allow rollback to any past revision that was deployed or superseded
                      const canRollback = !isCurrent && (rev.status === 'deployed' || rev.status === 'superseded');

                      return (
                        <motion.div
                          key={rev.revision}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`p-3 rounded-xl border transition-all ${
                            isCurrent
                              ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30 ring-2 ring-cyan-200 dark:ring-cyan-500/30'
                              : 'bg-white dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${isCurrent ? 'text-cyan-700 dark:text-cyan-300' : 'text-gray-900 dark:text-white'}`}>
                                Revision {rev.revision}
                              </span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-cyan-600 text-white rounded-full">
                                  Current
                                </span>
                              )}
                              <StatusBadge status={rev.status} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">{rev.updated}</span>
                              {canRollback && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleRollback(rev.revision)}
                                  disabled={saving}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                                  Rollback
                                </motion.button>
                              )}
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>Chart: {rev.chart} v{rev.chart_version}</span>
                            {rev.description && (
                              <span className="text-gray-500 dark:text-gray-500 italic">{rev.description}</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ClockIcon className="h-12 w-12 text-gray-300 dark:text-slate-600 mb-4" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No revision history available</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'resources' && (
              <motion.div
                key="resources"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-auto p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ServerStackIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Kubernetes Resources
                    </h3>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={fetchManifest}
                    disabled={loadingManifest}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ArrowPathIcon className={`h-3.5 w-3.5 ${loadingManifest ? 'animate-spin' : ''}`} />
                    Refresh
                  </motion.button>
                </div>
                {loadingManifest ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ArrowPathIcon className="h-12 w-12 text-gray-300 dark:text-slate-600 mb-4 animate-spin" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading resources...</p>
                  </div>
                ) : manifest ? (
                  <div className="bg-slate-900 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                    <div className="bg-slate-800 px-4 py-2 border-b border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-300">manifest.yaml</span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            navigator.clipboard.writeText(manifest);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white transition-colors"
                        >
                          <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                          Copy
                        </motion.button>
                      </div>
                    </div>
                    <div className="p-4 overflow-auto max-h-[600px]">
                      <pre className="text-xs font-mono text-slate-100 whitespace-pre">
                        {manifest}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ServerStackIcon className="h-12 w-12 text-gray-300 dark:text-slate-600 mb-4" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No resources loaded</p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={fetchManifest}
                      className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
                    >
                      Load Resources
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'health' && (
              <motion.div
                key="health"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-auto p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <HeartIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Release Health Status
                    </h3>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={fetchHealth}
                    disabled={healthLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ArrowPathIcon className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </motion.button>
                </div>

                {healthLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ArrowPathIcon className="h-12 w-12 text-gray-300 dark:text-slate-600 mb-4 animate-spin" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading health data...</p>
                  </div>
                ) : healthError ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <XCircleIcon className="h-12 w-12 text-red-300 dark:text-red-600 mb-4" />
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">{healthError}</p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={fetchHealth}
                      className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      Retry
                    </motion.button>
                  </div>
                ) : healthData ? (
                  <div className="space-y-6">
                    {/* Health Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className={`p-4 rounded-xl border ${
                        healthData.healthy
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                          : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {healthData.healthy ? (
                            <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )}
                          <span className={`text-xs font-semibold uppercase tracking-wider ${
                            healthData.healthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {healthData.healthy ? 'Healthy' : 'Unhealthy'}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {healthData.ready_pods}/{healthData.total_pods}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Pods Ready</p>
                      </div>

                      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <CubeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                            Total Pods
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{healthData.total_pods}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Running</p>
                      </div>

                      <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <ClockIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                            Events
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{healthData.events?.length || 0}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Recent</p>
                      </div>
                    </div>

                    {/* Pod Status Cards */}
                    {healthData.pods && healthData.pods.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                          Pod Details
                        </h4>
                        <div className="space-y-3">
                          {healthData.pods.map((pod: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-4 rounded-xl border ${
                                pod.ready
                                  ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                                  : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {pod.ready ? (
                                      <CheckCircleIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                    ) : (
                                      <XCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
                                    )}
                                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {pod.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                    <span>Phase: <span className="font-medium">{pod.phase}</span></span>
                                    <span>Node: <span className="font-medium">{pod.node || 'N/A'}</span></span>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  pod.phase === 'Running'
                                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                    : pod.phase === 'Pending'
                                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                                    : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                                }`}>
                                  {pod.phase}
                                </span>
                              </div>

                              {/* Container Status */}
                              {pod.containers && pod.containers.length > 0 && (
                                <div className="space-y-2">
                                  {pod.containers.map((container: any, cIdx: number) => (
                                    <div
                                      key={cIdx}
                                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                                    >
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                          container.ready ? 'bg-emerald-500' : 'bg-red-500'
                                        }`} />
                                        <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                          {container.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                        <span>State: <span className="font-medium">{container.state}</span></span>
                                        <span>Restarts: <span className="font-medium">{container.restartCount}</span></span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Events Timeline */}
                    {healthData.events && healthData.events.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                          Recent Events
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {healthData.events.map((event: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border ${
                                event.type === 'Warning'
                                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
                                  : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {event.type === 'Warning' ? (
                                  <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <CheckCircleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                      {event.reason}
                                    </span>
                                    {event.count > 1 && (
                                      <span className="px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-slate-600 text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {event.count}x
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">{event.message}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{event.timestamp}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {healthData.error && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                        <div className="flex items-start gap-2">
                          <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-red-900 dark:text-red-300 mb-1">Error</p>
                            <p className="text-xs text-red-700 dark:text-red-400">{healthData.error}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <HeartIcon className="h-12 w-12 text-gray-300 dark:text-slate-600 mb-4" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No health data loaded</p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={fetchHealth}
                      className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      Load Health Status
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-auto p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      AI-Powered Analysis
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={analyzeConfig}
                      disabled={aiLoading || troubleshootLoading}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-500/20 dark:to-blue-500/20 border border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 text-xs font-medium hover:from-purple-200 hover:to-blue-200 dark:hover:from-purple-500/30 dark:hover:to-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
                      Analyze Config
                    </motion.button>
                    {healthData && !healthData.healthy && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={troubleshootRelease}
                        disabled={aiLoading || troubleshootLoading}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-500/20 dark:to-orange-500/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium hover:from-red-200 hover:to-orange-200 dark:hover:from-red-500/30 dark:hover:to-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                        Diagnose Issues
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Loading State */}
                {(aiLoading || troubleshootLoading) && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {aiLoading ? 'Analyzing configuration...' : 'Diagnosing issues...'}
                    </p>
                  </div>
                )}

                {/* Error State */}
                {!aiLoading && !troubleshootLoading && aiError && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                    <div className="flex items-start gap-2">
                      <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-900 dark:text-red-300 mb-1">Analysis Error</p>
                        <p className="text-xs text-red-700 dark:text-red-400">{aiError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Configuration Analysis Results */}
                {!aiLoading && !troubleshootLoading && !aiError && aiAnalysis && (
                  <div className="space-y-4">
                    {/* Security Score & Production Ready */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 border border-blue-200 dark:border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Security Score</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {aiAnalysis.security_score}/100
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-500/10 dark:to-emerald-500/10 border border-green-200 dark:border-green-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Production Ready</span>
                        </div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {aiAnalysis.production_ready ? 'Yes' : 'No'}
                        </div>
                      </div>
                    </div>

                    {/* Analysis Text */}
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Analysis</h4>
                      <div className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
                        {aiAnalysis.analysis}
                      </div>
                    </div>

                    {/* Issues */}
                    {aiAnalysis.issues && aiAnalysis.issues.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Issues Found</h4>
                        <div className="space-y-2">
                          {aiAnalysis.issues.map((issue: any, idx: number) => (
                            <AIInsightCard
                              key={idx}
                              insight={{
                                type: issue.severity === 'critical' || issue.severity === 'high' ? 'warning' :
                                      issue.severity === 'medium' ? 'suggestion' : 'info',
                                message: `[${issue.severity.toUpperCase()}] ${issue.issue}`,
                                fix: issue.fix || 'See analysis for details'
                              }}
                              onApplyFix={issue.auto_fixable ? () => {
                                logger.debug('Applying fix', issue.fix);
                              } : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recommendations</h4>
                        <div className="space-y-2">
                          {aiAnalysis.recommendations.map((rec: any, idx: number) => (
                            <div key={idx} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                              <div className="flex items-start gap-2">
                                <LightBulbIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-blue-900 dark:text-blue-300">{rec.title}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                                      {rec.priority}
                                    </span>
                                  </div>
                                  <p className="text-xs text-blue-700 dark:text-blue-400">{rec.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Troubleshooting Results */}
                {!aiLoading && !troubleshootLoading && !aiError && troubleshootData && (
                  <div className="space-y-4">
                    {/* Severity Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        troubleshootData.severity === 'critical' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                        troubleshootData.severity === 'high' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' :
                        troubleshootData.severity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                        'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                      }`}>
                        {troubleshootData.severity?.toUpperCase() || 'UNKNOWN'} SEVERITY
                      </span>
                    </div>

                    {/* Diagnosis */}
                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Diagnosis</h4>
                      <div className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none">
                        {troubleshootData.diagnosis}
                      </div>
                    </div>

                    {/* Root Causes */}
                    {troubleshootData.root_causes && troubleshootData.root_causes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Root Causes</h4>
                        <div className="space-y-2">
                          {troubleshootData.root_causes.map((cause: string, idx: number) => (
                            <div key={idx} className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                              <div className="flex items-start gap-2">
                                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-red-700 dark:text-red-400 flex-1">{cause}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fixes */}
                    {troubleshootData.fixes && troubleshootData.fixes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recommended Fixes</h4>
                        <div className="space-y-2">
                          {troubleshootData.fixes.map((fix: any, idx: number) => (
                            <div key={idx} className="p-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                              <div className="flex items-start gap-2">
                                <WrenchScrewdriverIcon className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-green-900 dark:text-green-300">
                                      {fix.type || 'Fix'}
                                    </span>
                                    {fix.priority && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                                        {fix.priority}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-green-700 dark:text-green-400">{fix.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty State */}
                {!aiLoading && !troubleshootLoading && !aiError && !aiAnalysis && !troubleshootData && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <SparklesIcon className="h-16 w-16 text-purple-300 dark:text-purple-600 mb-4" />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Analysis Yet</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
                      Click "Analyze Config" to get AI-powered insights on your Helm chart configuration, or "Diagnose Issues" to troubleshoot deployment problems.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column - Metadata & Context (hidden for full-width tabs) */}
        {!useFullWidth && (
        <div className="w-72 flex flex-col border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
          {/* Installation Config (Install Mode) or Chart Metadata (Edit Mode) */}
          {isInstallMode ? (
            <>
              <div className="p-3 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Installation Config
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Release Name
                    </label>
                    <input
                      type="text"
                      value={installReleaseName}
                      onChange={(e) => setInstallReleaseName(e.target.value)}
                      placeholder="my-release"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unique name for this deployment</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Namespace
                    </label>
                    <input
                      type="text"
                      value={installNamespace}
                      onChange={(e) => setInstallNamespace(e.target.value)}
                      placeholder="default"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Kubernetes namespace</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Chart Details
                    </label>
                    <div className="space-y-1.5 text-xs p-2 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Chart:</span>
                        <span className="text-gray-900 dark:text-gray-300 font-medium">{chartInfo?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Version:</span>
                        <span className="text-cyan-600 dark:text-cyan-400 font-medium">{chartInfo?.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Repo:</span>
                        <span className="text-gray-900 dark:text-gray-300 font-medium">{chartInfo?.repository}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-2 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Chart Metadata
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Chart Name:</span>
                  <span className="text-gray-900 dark:text-gray-300">{chartInfo?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Version:</span>
                  <span className="text-cyan-600 dark:text-cyan-400">{chartInfo?.version || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">App Version:</span>
                  <span className="text-gray-900 dark:text-gray-300">{release?.app_version || '1.25.3'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Maintainers:</span>
                  <span className="text-gray-900 dark:text-gray-300">Bitnami</span>
                </div>
              </div>
              {chartInfo?.description && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {chartInfo.description}
                </p>
              )}
            </div>
          )}

          {/* Release Info (if editing) */}
          {release && (
            <div className="p-2 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Release Info
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Release:</span>
                  <span className="text-gray-900 dark:text-gray-300">{release.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <StatusBadge status={release.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Last Updated:</span>
                  <span className="text-gray-900 dark:text-gray-300">{release.updated || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Revision:</span>
                  <span className="text-cyan-600 dark:text-cyan-400">{release.revision}</span>
                </div>
              </div>
            </div>
          )}

          {/* AI Insights (contextual) */}
          <div className="p-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              AI Insights
            </h3>
            <div className="space-y-1.5">
              {aiLoading ? (
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <SparklesIcon className="h-3 w-3" />
                  </motion.div>
                  Analyzing configuration...
                </div>
              ) : aiAnalysis ? (
                <>
                  {aiAnalysis.issues?.slice(0, 2).map((issue: any, idx: number) => (
                    <div
                      key={`issue-${idx}`}
                      className={`p-2 rounded-lg text-xs ${
                        issue.severity === 'critical' || issue.severity === 'high'
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                          : issue.severity === 'medium'
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                          : 'bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span className="font-medium">{issue.severity?.toUpperCase()}:</span> {issue.description || issue.message}
                    </div>
                  ))}
                  {aiAnalysis.recommendations?.slice(0, 2).map((rec: any, idx: number) => (
                    <div
                      key={`rec-${idx}`}
                      className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-xs text-cyan-600 dark:text-cyan-400"
                    >
                      <span className="font-medium">TIP:</span> {typeof rec === 'string' ? rec : rec.description || rec.message}
                    </div>
                  ))}
                </>
              ) : (
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-xs text-gray-500 dark:text-gray-400 text-center">
                  Click "Analyze Config" to get AI insights
                </div>
              )}
            </div>
            <div className="mt-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={analyzeConfig}
                disabled={aiLoading || !valuesContent}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <SparklesIcon className="h-3 w-3" />
                {aiLoading ? 'Analyzing...' : 'Analyze Config'}
              </motion.button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Deployment Progress Modal */}
      <AnimatePresence>
        {deploymentProgress.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (deploymentProgress.stage === 'error') {
                setDeploymentProgress({ show: false, message: '', stage: 'validating' });
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-8 max-w-md w-full mx-4"
            >
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className="mb-6">
                  {deploymentProgress.stage === 'success' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', bounce: 0.5 }}
                      className="p-4 rounded-full bg-green-100 dark:bg-green-900/30"
                    >
                      <CheckCircleIcon className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </motion.div>
                  ) : deploymentProgress.stage === 'error' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', bounce: 0.5 }}
                      className="p-4 rounded-full bg-red-100 dark:bg-red-900/30"
                    >
                      <XCircleIcon className="h-12 w-12 text-red-600 dark:text-red-400" />
                    </motion.div>
                  ) : (
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="p-4 rounded-full bg-cyan-100 dark:bg-cyan-900/30"
                      >
                        <RocketLaunchIcon className="h-12 w-12 text-cyan-600 dark:text-cyan-400" />
                      </motion.div>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-cyan-400/30"
                      />
                    </div>
                  )}
                </div>

                {/* Message */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {deploymentProgress.message}
                </h3>

                {/* Error Details */}
                {deploymentProgress.error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 w-full">
                    <p className="text-sm text-red-700 dark:text-red-300 text-left">
                      {deploymentProgress.error}
                    </p>
                  </div>
                )}

                {/* Stage Description */}
                {deploymentProgress.stage !== 'error' && deploymentProgress.stage !== 'success' && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {deploymentProgress.stage === 'validating' && 'Checking configuration syntax...'}
                    {deploymentProgress.stage === 'deploying' && 'Applying changes to cluster...'}
                    {deploymentProgress.stage === 'verifying' && 'Verifying deployment status...'}
                  </p>
                )}

                {/* Progress Bar */}
                {deploymentProgress.stage !== 'error' && deploymentProgress.stage !== 'success' && (
                  <div className="w-full mt-6">
                    <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{
                          width: deploymentProgress.stage === 'validating' ? '33%' : deploymentProgress.stage === 'deploying' ? '66%' : '100%',
                        }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons for Error State */}
                {deploymentProgress.stage === 'error' && (
                  <div className="flex flex-col gap-2 mt-6 w-full">
                    {deploymentProgress.isRepoError ? (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setDeploymentProgress({ show: false, message: '', stage: 'validating' });
                            navigate('/deploy/helm/catalog');
                          }}
                          className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg transition-all"
                        >
                          <ServerStackIcon className="h-4 w-4" />
                          Add Repository
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setDeploymentProgress({ show: false, message: '', stage: 'validating' })}
                          className="w-full px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                        >
                          Close
                        </motion.button>
                      </>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setDeploymentProgress({ show: false, message: '', stage: 'validating' })}
                        className="w-full px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg transition-all"
                      >
                        Close
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Result Modal */}
      <AnimatePresence>
        {showTestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTestModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className={`p-3 rounded-full ${testResult?.success ? 'bg-green-100 dark:bg-green-900/30' : testInProgress ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {testInProgress ? (
                      <ArrowPathIcon className="h-8 w-8 text-purple-600 dark:text-purple-400 animate-spin" />
                    ) : testResult?.success ? (
                      <CheckCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {testInProgress ? 'Running Tests...' : 'Test Results'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {releaseName} in {namespace}
                    </p>
                  </div>
                </div>

                {/* Test Result */}
                {testResult && (
                  <>
                    <div className={`p-4 rounded-lg border mb-4 ${testResult.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                      <p className={`text-sm font-medium ${testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {testResult.message}
                      </p>
                    </div>

                    {/* Test Output */}
                    {testResult.notes && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Test Output:</h4>
                        <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                            {testResult.notes}
                          </pre>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {testInProgress && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Running Helm tests... This may take a few minutes.
                    </p>
                  </div>
                )}

                {/* Close Button */}
                {!testInProgress && (
                  <div className="flex justify-end mt-6">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowTestModal(false)}
                      className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg transition-all"
                    >
                      Close
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPreviewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-8 max-w-6xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6 flex-shrink-0">
                  <div className={`p-3 rounded-full ${previewError ? 'bg-red-100 dark:bg-red-900/30' : previewLoading ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                    {previewLoading ? (
                      <ArrowPathIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
                    ) : previewError ? (
                      <XCircleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
                    ) : (
                      <MagnifyingGlassCircleIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {previewLoading ? 'Generating Preview...' : 'Preview Changes'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isInstallMode ? `Installing ${installReleaseName} in ${installNamespace}` : `Upgrading ${releaseName} in ${namespace}`}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  {previewLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Running dry-run to preview changes...
                        </p>
                      </div>
                    </div>
                  ) : previewError ? (
                    <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                      <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Preview Failed:</p>
                      <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>
                    </div>
                  ) : (
                    <div className="h-full overflow-auto">
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Generated Kubernetes Manifests
                          </h4>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              navigator.clipboard.writeText(previewManifest);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                            Copy
                          </motion.button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          These resources will be created or updated when you proceed with the {isInstallMode ? 'installation' : 'upgrade'}.
                        </p>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-[calc(85vh-16rem)]">
                        <pre className="text-xs text-green-400 font-mono whitespace-pre">
                          {previewManifest}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {!previewLoading && (
                  <div className="flex justify-end gap-3 mt-6 flex-shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowPreviewModal(false)}
                      className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                    >
                      Close
                    </motion.button>
                    {!previewError && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setShowPreviewModal(false);
                          if (isInstallMode) {
                            handleInstall();
                          } else {
                            handleUpgrade();
                          }
                        }}
                        className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg transition-all"
                      >
                        {isInstallMode ? 'Proceed with Install' : 'Proceed with Upgrade'}
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
