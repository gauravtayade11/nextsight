import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { optimizationApi, kubernetesApi } from '../../services/api';
import { logger } from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';
import type {
  OptimizationDashboardResponse,
  OptimizationRecommendation,
  PodOptimization,
  AIOptimizationAnalysisResponse,
  ApplyOptimizationRequest,
  ApplyOptimizationResponse,
} from '../../types';
import {
  ArrowPathIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  CpuChipIcon,
  CircleStackIcon,
  ArrowsPointingOutIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  XMarkIcon,
  LightBulbIcon,
  BoltIcon,
  WrenchScrewdriverIcon,
  PlayIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

// Import shared utilities
import { formatBytes, formatCurrency, containerVariants, itemVariants } from '../../utils/constants';
import { SeverityBadge } from '../common/StatusBadge';

// Local utility for millicores formatting
function formatMillicores(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} cores`;
  return `${m}m`;
}

// Copy Button
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Copy">
      {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardDocumentIcon className="h-4 w-4 text-gray-400" />}
    </button>
  );
}

// Action Button
function ActionButton({ command, label, onExecuted }: { command: string; label: string; onExecuted?: () => void }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleExecute = async () => {
    setStatus('loading');
    try {
      const res = await kubernetesApi.executeKubectl({ command });
      if (res.data.success) {
        setStatus('success');
        onExecuted?.();
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <button
      onClick={handleExecute}
      disabled={status === 'loading' || status === 'success'}
      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
        status === 'success' ? 'bg-green-500 text-white' :
        status === 'error' ? 'bg-red-500 text-white' :
        'bg-primary-600 hover:bg-primary-700 text-white'
      } disabled:opacity-50`}
    >
      {status === 'loading' ? 'Applying...' : status === 'success' ? 'Done!' : status === 'error' ? 'Failed' : label}
    </button>
  );
}

// Severity Badge
function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    info: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[severity] || colors.info}`}>
      {severity.toUpperCase()}
    </span>
  );
}

// Optimization Category Card
function CategoryCard({
  icon: Icon,
  title,
  count,
  status,
  onClick,
  active,
}: {
  icon: typeof CpuChipIcon;
  title: string;
  count: number;
  status: 'good' | 'warning' | 'critical' | 'info';
  onClick: () => void;
  active: boolean;
}) {
  const statusColors = {
    good: 'border-green-500 bg-green-50 dark:bg-green-900/20',
    warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    critical: 'border-red-500 bg-red-50 dark:bg-red-900/20',
    info: 'border-gray-300 bg-gray-50 dark:bg-slate-700 dark:border-slate-600',
  };

  const iconColors = {
    good: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    critical: 'text-red-600 dark:text-red-400',
    info: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border-2 text-left transition-all ${
        active ? 'ring-2 ring-primary-500 border-primary-500' : statusColors[status]
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 ${iconColors[status]}`} />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {count} {count === 1 ? 'issue' : 'issues'}
          </p>
        </div>
      </div>
    </button>
  );
}

// AI Analysis Panel Component
function AIAnalysisPanel({
  isOpen,
  onClose,
  analysis,
  loading,
  onRefresh,
}: {
  isOpen: boolean;
  onClose: () => void;
  analysis: AIOptimizationAnalysisResponse | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-slate-800 shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <SparklesIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Analysis</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI-powered optimization insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <SparklesIcon className="h-12 w-12 text-purple-500 animate-pulse mb-4" />
              <p className="text-gray-600 dark:text-gray-400">AI is analyzing your cluster...</p>
            </div>
          ) : analysis ? (
            <>
              {/* Analysis Summary */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200/50 dark:border-purple-700/50">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Summary</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {analysis.analysis}
                </p>
              </div>

              {/* Key Findings */}
              {analysis.key_findings && analysis.key_findings.length > 0 && (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
                  <div className="flex items-center gap-2 mb-3">
                    <LightBulbIcon className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Key Findings</h3>
                  </div>
                  <ul className="space-y-2">
                    {analysis.key_findings.map((finding, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="text-blue-500 mt-1">•</span>
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Priority Actions */}
              {analysis.priority_actions && analysis.priority_actions.length > 0 && (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
                  <div className="flex items-center gap-2 mb-3">
                    <BoltIcon className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Priority Actions</h3>
                  </div>
                  <div className="space-y-2">
                    {analysis.priority_actions.map((action, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-600/50">
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          action.priority.toLowerCase() === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          action.priority.toLowerCase() === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {action.priority}
                        </span>
                        <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{action.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Efficiency Impact */}
              {analysis.estimated_monthly_impact > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Efficiency Impact</h3>
                      <p className="text-xs text-blue-600 dark:text-blue-400">per month (est.)</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      ~${analysis.estimated_monthly_impact.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Link to full AI Hub */}
              <Link
                to="/optimization/ai"
                className="block w-full p-3 text-center text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                Open AI Optimization Hub for detailed analysis →
              </Link>
            </>
          ) : (
            <div className="text-center py-12">
              <SparklesIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">No analysis available</p>
              <button
                onClick={onRefresh}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Generate Analysis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Apply Optimization Modal Component
interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  pod: PodOptimization | null;
  onSuccess: () => void;
}

function ApplyOptimizationModal({ isOpen, onClose, pod, onSuccess }: ApplyModalProps) {
  const [mode, setMode] = useState<'preview' | 'apply'>('preview');
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ApplyOptimizationResponse | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyOptimizationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && pod) {
      handlePreview();
    }
  }, [isOpen, pod]);

  if (!isOpen || !pod) return null;

  const container = pod.containers[0];
  if (!container) return null;

  const cpuRecommendation = container.cpu_recommendation_millicores
    ? `${container.cpu_recommendation_millicores}m`
    : undefined;
  const memoryRecommendation = container.memory_recommendation_bytes
    ? `${Math.ceil(container.memory_recommendation_bytes / (1024 * 1024))}Mi`
    : undefined;

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const request: ApplyOptimizationRequest = {
        namespace: pod.namespace,
        resource_kind: pod.owner_kind || 'Deployment',
        resource_name: pod.owner_name || pod.name,
        container_name: container.container_name,
        cpu_request: cpuRecommendation,
        memory_request: memoryRecommendation,
        dry_run: true,
      };
      const res = await optimizationApi.previewOptimization(request);
      setPreviewResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview changes');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    try {
      const request: ApplyOptimizationRequest = {
        namespace: pod.namespace,
        resource_kind: pod.owner_kind || 'Deployment',
        resource_name: pod.owner_name || pod.name,
        container_name: container.container_name,
        cpu_request: cpuRecommendation,
        memory_request: memoryRecommendation,
        dry_run: false,
      };
      const res = await optimizationApi.applyOptimization(request);
      setApplyResult(res.data);
      if (res.data.success) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPreviewResult(null);
    setApplyResult(null);
    setError(null);
    setMode('preview');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="absolute inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <WrenchScrewdriverIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Apply Optimization</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {pod.owner_name || pod.name} / {pod.namespace}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Resource Changes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">Current Values</h4>
              <div className="space-y-1 text-sm">
                <p className="text-red-700 dark:text-red-400">
                  CPU Request: <span className="font-mono">{formatMillicores(pod.total_cpu_request_millicores)}</span>
                </p>
                <p className="text-red-700 dark:text-red-400">
                  Memory Request: <span className="font-mono">{formatBytes(pod.total_memory_request_bytes)}</span>
                </p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">Recommended Values</h4>
              <div className="space-y-1 text-sm">
                <p className="text-green-700 dark:text-green-400">
                  CPU Request: <span className="font-mono">{cpuRecommendation || 'N/A'}</span>
                </p>
                <p className="text-green-700 dark:text-green-400">
                  Memory Request: <span className="font-mono">{memoryRecommendation || 'N/A'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Savings Estimate */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Estimated Monthly Savings</p>
                <p className="text-xs text-green-600 dark:text-green-400">After applying this optimization</p>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(pod.potential_savings * 720)}
              </p>
            </div>
          </div>

          {/* Preview Result */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400 mr-2" />
              <span className="text-gray-600 dark:text-gray-400">
                {mode === 'preview' ? 'Previewing changes...' : 'Applying changes...'}
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {previewResult && !applyResult && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50">
              <div className="flex items-center gap-2 mb-2">
                <EyeIcon className="h-4 w-4 text-blue-600" />
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">Preview Result</h4>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-400">{previewResult.message}</p>
              {previewResult.changes_applied && Object.keys(previewResult.changes_applied).length > 0 && (
                <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <pre className="text-xs text-blue-800 dark:text-blue-300 overflow-x-auto">
                    {JSON.stringify(previewResult.changes_applied, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {applyResult && (
            <div className={`p-4 rounded-xl border ${
              applyResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {applyResult.success ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-red-600" />
                )}
                <h4 className={`text-sm font-medium ${
                  applyResult.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                }`}>
                  {applyResult.success ? 'Successfully Applied!' : 'Failed to Apply'}
                </h4>
              </div>
              <p className={`text-sm ${
                applyResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
              }`}>
                {applyResult.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {applyResult?.success ? 'Close' : 'Cancel'}
          </button>
          {!applyResult?.success && (
            <button
              onClick={handleApply}
              disabled={loading || !previewResult}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg shadow-lg shadow-green-500/25 disabled:opacity-50 transition-all"
            >
              <PlayIcon className="h-4 w-4" />
              Apply Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function ResourceOptimizationDashboard() {
  const [dashboardData, setDashboardData] = useState<OptimizationDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('compute');

  // AI Analysis state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIOptimizationAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await optimizationApi.getDashboard();
      setDashboardData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAIAnalysis = async () => {
    setAiLoading(true);
    try {
      const res = await optimizationApi.getAIAnalysis({ focus_area: 'efficiency' });
      if (res.data.success) {
        setAiAnalysis(res.data);
      }
    } catch (err) {
      logger.error('Failed to load AI analysis', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenAIPanel = () => {
    setShowAIPanel(true);
    if (!aiAnalysis) {
      loadAIAnalysis();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg">
        <p>{error}</p>
        <button onClick={loadData} className="mt-2 text-sm underline">Retry</button>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { summary, recommendations, idle_resources, top_wasteful_pods, top_underprovisioned_pods } = dashboardData;
  const totalMonthlySavings = summary.total_potential_savings * 720;

  // Categorize recommendations
  const computeIssues = recommendations.filter(r => ['over_provisioned', 'under_provisioned', 'idle_resource'].includes(r.type));
  const deploymentIssues = recommendations.filter(r => ['no_limits', 'no_requests'].includes(r.type));

  // Scaling issues: workloads at high utilization that may need HPA/VPA
  const scalingCandidates = top_underprovisioned_pods.length;

  // Storage optimization is not yet implemented in backend
  const storageIssueCount = 0;

  const categories = [
    { id: 'compute', icon: CpuChipIcon, title: 'Compute & Memory', count: computeIssues.length, status: computeIssues.length > 5 ? 'critical' : computeIssues.length > 0 ? 'warning' : 'good' },
    { id: 'scaling', icon: ArrowsPointingOutIcon, title: 'Scaling', count: scalingCandidates, status: scalingCandidates > 0 ? 'warning' : 'good' },
    { id: 'storage', icon: CircleStackIcon, title: 'Storage', count: storageIssueCount, status: 'info' },
    { id: 'deployment', icon: CubeIcon, title: 'Deployment', count: deploymentIssues.length, status: deploymentIssues.length > 5 ? 'critical' : deploymentIssues.length > 0 ? 'warning' : 'good' },
    { id: 'cost', icon: CurrencyDollarIcon, title: 'Cost', count: 0, status: totalMonthlySavings > 100 ? 'warning' : 'good' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Optimization</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Analyze and optimize your Kubernetes resources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAIPanel}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/25 transition-all"
          >
            <SparklesIcon className="h-4 w-4" />
            AI Analysis
          </button>
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pods Analyzed</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.analyzed_pods}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Optimal</p>
          <p className="text-2xl font-bold text-green-600">{summary.optimal_pods}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Issues Found</p>
          <p className="text-2xl font-bold text-orange-600">
            {summary.over_provisioned_pods + summary.under_provisioned_pods + summary.idle_pods}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Efficiency</p>
          <p className="text-2xl font-bold text-primary-600">{summary.cluster_efficiency_score.score.toFixed(0)}%</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Potential Savings</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalMonthlySavings)}/mo</p>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-5 gap-4">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            icon={cat.icon}
            title={cat.title}
            count={cat.count}
            status={cat.status as 'good' | 'warning' | 'critical'}
            onClick={() => setActiveCategory(cat.id)}
            active={activeCategory === cat.id}
          />
        ))}
      </div>

      {/* Content based on active category */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        {activeCategory === 'compute' && (
          <ComputeOptimization
            idleResources={idle_resources}
            wastefulPods={top_wasteful_pods}
            underprovisionedPods={top_underprovisioned_pods}
            onRefresh={loadData}
          />
        )}
        {activeCategory === 'scaling' && (
          <ScalingOptimization pods={top_underprovisioned_pods} />
        )}
        {activeCategory === 'storage' && (
          <StorageOptimization />
        )}
        {activeCategory === 'deployment' && (
          <DeploymentOptimization recommendations={deploymentIssues} />
        )}
        {activeCategory === 'cost' && (
          <CostOptimization
            summary={summary}
            recommendations={recommendations}
            totalSavings={totalMonthlySavings}
          />
        )}
      </div>

      {/* AI Analysis Panel */}
      <AIAnalysisPanel
        isOpen={showAIPanel}
        onClose={() => setShowAIPanel(false)}
        analysis={aiAnalysis}
        loading={aiLoading}
        onRefresh={loadAIAnalysis}
      />
    </div>
  );
}

// Compute Optimization Panel
function ComputeOptimization({
  idleResources,
  wastefulPods,
  underprovisionedPods,
  onRefresh,
}: {
  idleResources: PodOptimization[];
  wastefulPods: PodOptimization[];
  underprovisionedPods: PodOptimization[];
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<'idle' | 'over' | 'under'>('idle');

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4">
        <CpuChipIcon className="h-5 w-5 text-primary-600" />
        <h2 className="font-semibold text-gray-900 dark:text-white">Compute & Memory Optimization</h2>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-2 border-b border-gray-200 dark:border-slate-700">
        {[
          { id: 'idle', label: 'Idle Resources', count: idleResources.length, color: 'text-orange-600' },
          { id: 'over', label: 'Over-Provisioned', count: wastefulPods.length, color: 'text-yellow-600' },
          { id: 'under', label: 'Under-Provisioned', count: underprovisionedPods.length, color: 'text-red-600' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'idle' | 'over' | 'under')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${t.color} bg-opacity-10`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {tab === 'idle' && <IdleResourcesList resources={idleResources} onRefresh={onRefresh} />}
        {tab === 'over' && <WastefulPodsList pods={wastefulPods} onRefresh={onRefresh} />}
        {tab === 'under' && <UnderprovisionedPodsList pods={underprovisionedPods} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}

// Idle Resources List
function IdleResourcesList({ resources, onRefresh }: { resources: PodOptimization[]; onRefresh: () => void }) {
  if (resources.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-500" />
        <p>No idle resources detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-sm text-orange-700 dark:text-orange-400">
        <ExclamationTriangleIcon className="h-4 w-4 inline mr-2" />
        These resources are using less than 5% of allocated capacity. Consider scaling down or removing.
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
            <th className="pb-2 font-medium">Resource</th>
            <th className="pb-2 font-medium">Namespace</th>
            <th className="pb-2 font-medium">CPU Usage</th>
            <th className="pb-2 font-medium">Memory Usage</th>
            <th className="pb-2 font-medium">Est. Savings</th>
            <th className="pb-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
          {resources.map((res) => {
            const scaleCmd = `scale ${res.owner_kind?.toLowerCase() || 'deployment'} ${res.owner_name || res.name} --replicas=0 -n ${res.namespace}`;
            const displayCmd = `kubectl ${scaleCmd}`;
            return (
              <tr key={res.name} className="text-sm">
                <td className="py-3">
                  <div className="font-medium text-gray-900 dark:text-white">{res.owner_name || res.name}</div>
                  <div className="text-xs text-gray-500">{res.owner_kind || 'Pod'}</div>
                </td>
                <td className="py-3 text-gray-600 dark:text-gray-400">{res.namespace}</td>
                <td className="py-3">
                  <span className="text-orange-600">{res.cpu_efficiency.score.toFixed(1)}%</span>
                  <span className="text-gray-400 text-xs ml-1">
                    ({formatMillicores(res.total_cpu_usage_millicores)}/{formatMillicores(res.total_cpu_request_millicores)})
                  </span>
                </td>
                <td className="py-3">
                  <span className="text-orange-600">{res.memory_efficiency.score.toFixed(1)}%</span>
                  <span className="text-gray-400 text-xs ml-1">
                    ({formatBytes(res.total_memory_usage_bytes)}/{formatBytes(res.total_memory_request_bytes)})
                  </span>
                </td>
                <td className="py-3 text-green-600 font-medium">
                  {formatCurrency(res.current_hourly_cost * 720)}/mo
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <CopyButton text={displayCmd} />
                    <ActionButton command={scaleCmd} label="Scale Down" onExecuted={onRefresh} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Wasteful Pods List
function WastefulPodsList({ pods, onRefresh }: { pods: PodOptimization[]; onRefresh: () => void }) {
  const [selectedPod, setSelectedPod] = useState<PodOptimization | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  if (pods.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-500" />
        <p>No over-provisioned resources detected</p>
      </div>
    );
  }

  const handleApplyClick = (pod: PodOptimization) => {
    setSelectedPod(pod);
    setShowApplyModal(true);
  };

  const handleApplySuccess = () => {
    setShowApplyModal(false);
    setSelectedPod(null);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-400">
        <ExclamationTriangleIcon className="h-4 w-4 inline mr-2" />
        These resources are using less than 30% of requested capacity. Right-size to reduce costs.
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
            <th className="pb-2 font-medium">Resource</th>
            <th className="pb-2 font-medium">Namespace</th>
            <th className="pb-2 font-medium">CPU Efficiency</th>
            <th className="pb-2 font-medium">Memory Efficiency</th>
            <th className="pb-2 font-medium">Recommendation</th>
            <th className="pb-2 font-medium">Savings</th>
            <th className="pb-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
          {pods.map((pod) => (
            <tr key={pod.name} className="text-sm">
              <td className="py-3">
                <div className="font-medium text-gray-900 dark:text-white">{pod.owner_name || pod.name}</div>
                <div className="text-xs text-gray-500">{pod.owner_kind || 'Pod'}</div>
              </td>
              <td className="py-3 text-gray-600 dark:text-gray-400">{pod.namespace}</td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${Math.min(pod.cpu_efficiency.score, 100)}%` }}
                    />
                  </div>
                  <span className="text-yellow-600">{pod.cpu_efficiency.score.toFixed(0)}%</span>
                </div>
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${Math.min(pod.memory_efficiency.score, 100)}%` }}
                    />
                  </div>
                  <span className="text-yellow-600">{pod.memory_efficiency.score.toFixed(0)}%</span>
                </div>
              </td>
              <td className="py-3 text-xs">
                {pod.containers[0] && (
                  <span className="text-gray-600 dark:text-gray-400">
                    CPU: {formatMillicores(pod.total_cpu_request_millicores)} → {formatMillicores(pod.containers[0].cpu_recommendation_millicores || 0)}
                    <br />
                    Mem: {formatBytes(pod.total_memory_request_bytes)} → {formatBytes(pod.containers[0].memory_recommendation_bytes || 0)}
                  </span>
                )}
              </td>
              <td className="py-3 text-green-600 font-medium">
                {formatCurrency(pod.potential_savings * 720)}/mo
              </td>
              <td className="py-3">
                <button
                  onClick={() => handleApplyClick(pod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg shadow-sm transition-all"
                >
                  <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
                  Apply Fix
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Apply Optimization Modal */}
      <ApplyOptimizationModal
        isOpen={showApplyModal}
        onClose={() => {
          setShowApplyModal(false);
          setSelectedPod(null);
        }}
        pod={selectedPod}
        onSuccess={handleApplySuccess}
      />
    </div>
  );
}

// Underprovisioned Pods List
function UnderprovisionedPodsList({ pods, onRefresh }: { pods: PodOptimization[]; onRefresh: () => void }) {
  const [selectedPod, setSelectedPod] = useState<PodOptimization | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  if (pods.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-500" />
        <p>No under-provisioned resources detected</p>
      </div>
    );
  }

  const handleApplyClick = (pod: PodOptimization) => {
    setSelectedPod(pod);
    setShowApplyModal(true);
  };

  const handleApplySuccess = () => {
    setShowApplyModal(false);
    setSelectedPod(null);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
        <ExclamationCircleIcon className="h-4 w-4 inline mr-2" />
        These resources are at risk of throttling or OOM kills. Consider increasing limits.
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-slate-700">
            <th className="pb-2 font-medium">Resource</th>
            <th className="pb-2 font-medium">Namespace</th>
            <th className="pb-2 font-medium">CPU Usage</th>
            <th className="pb-2 font-medium">Memory Usage</th>
            <th className="pb-2 font-medium">Risk Level</th>
            <th className="pb-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
          {pods.map((pod) => (
            <tr key={pod.name} className="text-sm">
              <td className="py-3">
                <div className="font-medium text-gray-900 dark:text-white">{pod.owner_name || pod.name}</div>
                <div className="text-xs text-gray-500">{pod.owner_kind || 'Pod'}</div>
              </td>
              <td className="py-3 text-gray-600 dark:text-gray-400">{pod.namespace}</td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${Math.min(pod.cpu_efficiency.score, 100)}%` }}
                    />
                  </div>
                  <span className="text-red-600">{pod.cpu_efficiency.score.toFixed(0)}%</span>
                </div>
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${Math.min(pod.memory_efficiency.score, 100)}%` }}
                    />
                  </div>
                  <span className="text-red-600">{pod.memory_efficiency.score.toFixed(0)}%</span>
                </div>
              </td>
              <td className="py-3">
                <SeverityBadge severity="high" />
              </td>
              <td className="py-3">
                <button
                  onClick={() => handleApplyClick(pod)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg shadow-sm transition-all"
                >
                  <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
                  Increase
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Apply Optimization Modal */}
      <ApplyOptimizationModal
        isOpen={showApplyModal}
        onClose={() => {
          setShowApplyModal(false);
          setSelectedPod(null);
        }}
        pod={selectedPod}
        onSuccess={handleApplySuccess}
      />
    </div>
  );
}

// Scaling Optimization Panel
function ScalingOptimization({ pods }: { pods: PodOptimization[] }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4">
        <ArrowsPointingOutIcon className="h-5 w-5 text-primary-600" />
        <h2 className="font-semibold text-gray-900 dark:text-white">Scaling Optimization</h2>
      </div>
      <div className="p-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-400">
          <SparklesIcon className="h-4 w-4 inline mr-2" />
          <strong>AI Recommendation:</strong> Based on usage patterns, consider adding HPA to high-traffic deployments.
        </div>

        <div className="mt-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Scaling Recommendations</h3>

          {pods.length > 0 ? (
            <div className="space-y-2">
              {pods.slice(0, 5).map((pod) => (
                <div key={pod.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{pod.owner_name || pod.name}</p>
                    <p className="text-xs text-gray-500">{pod.namespace}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      CPU at {pod.cpu_efficiency.score.toFixed(0)}% capacity
                    </p>
                    <p className="text-xs text-primary-600">Consider HPA with minReplicas: 2</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No scaling issues detected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Storage Optimization Panel
function StorageOptimization() {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4">
        <CircleStackIcon className="h-5 w-5 text-primary-600" />
        <h2 className="font-semibold text-gray-900 dark:text-white">Storage Optimization</h2>
      </div>
      <div className="p-4">
        <div className="text-center py-8 text-gray-500">
          <CircleStackIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p>Storage analysis coming soon</p>
          <p className="text-xs mt-1">Will detect unused PVCs, over-allocated storage, and optimization opportunities</p>
        </div>
      </div>
    </div>
  );
}

// Deployment Optimization Panel
function DeploymentOptimization({
  recommendations,
}: {
  recommendations: OptimizationRecommendation[];
}) {
  const noLimits = recommendations.filter(r => r.type === 'no_limits');
  const noRequests = recommendations.filter(r => r.type === 'no_requests');

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4">
        <CubeIcon className="h-5 w-5 text-primary-600" />
        <h2 className="font-semibold text-gray-900 dark:text-white">Deployment Optimization</h2>
      </div>
      <div className="p-4 space-y-4">
        {/* No Limits Warning */}
        {noLimits.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <XCircleIcon className="h-4 w-4 text-purple-600" />
              Missing Resource Limits ({noLimits.length})
            </h3>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-sm text-purple-700 dark:text-purple-400 mb-3">
              These containers have no resource limits set, which can cause resource exhaustion.
            </div>
            <div className="space-y-2">
              {noLimits.slice(0, 5).map((rec) => (
                <div key={rec.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{rec.resource_name}</span>
                    <span className="text-gray-500 ml-2">/ {rec.container_name}</span>
                    <span className="text-gray-400 ml-2 text-xs">{rec.namespace}</span>
                  </div>
                  <SeverityBadge severity="medium" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Requests Warning */}
        {noRequests.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <XCircleIcon className="h-4 w-4 text-blue-600" />
              Missing Resource Requests ({noRequests.length})
            </h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-400 mb-3">
              These containers have no resource requests set, which can cause scheduling issues.
            </div>
            <div className="space-y-2">
              {noRequests.slice(0, 5).map((rec) => (
                <div key={rec.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{rec.resource_name}</span>
                    <span className="text-gray-500 ml-2">/ {rec.container_name}</span>
                    <span className="text-gray-400 ml-2 text-xs">{rec.namespace}</span>
                  </div>
                  <SeverityBadge severity="high" />
                </div>
              ))}
            </div>
          </div>
        )}

        {noLimits.length === 0 && noRequests.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <CheckCircleIcon className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>All deployments have proper resource configurations</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Cost Optimization Panel
function CostOptimization({
  summary,
  recommendations,
  totalSavings,
}: {
  summary: OptimizationDashboardResponse['summary'];
  recommendations: OptimizationRecommendation[];
  totalSavings: number;
}) {
  const topSavings = [...recommendations]
    .sort((a, b) => b.estimated_savings - a.estimated_savings)
    .slice(0, 10);

  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4">
        <CurrencyDollarIcon className="h-5 w-5 text-primary-600" />
        <h2 className="font-semibold text-gray-900 dark:text-white">Cost Optimization</h2>
      </div>
      <div className="p-4 space-y-4">
        {/* Savings Summary */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Total Potential Savings</p>
              <p className="text-xs text-green-600 dark:text-green-400">If all recommendations are applied</p>
            </div>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(totalSavings)}/mo</p>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Current Monthly Cost</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(summary.total_current_hourly_cost * 720)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Idle Resource Cost</p>
            <p className="text-lg font-bold text-orange-600">
              {formatCurrency(summary.idle_pods * 30)} {/* Rough estimate */}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Savings Percentage</p>
            <p className="text-lg font-bold text-green-600">{summary.total_savings_percentage.toFixed(0)}%</p>
          </div>
        </div>

        {/* Top Savings Opportunities */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Top Savings Opportunities</h3>
          <div className="space-y-2">
            {topSavings.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  {rec.type === 'idle_resource' ? (
                    <ArrowTrendingDownIcon className="h-4 w-4 text-orange-500" />
                  ) : (
                    <ArrowTrendingUpIcon className="h-4 w-4 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{rec.resource_name}</p>
                    <p className="text-xs text-gray-500">{rec.namespace} • {rec.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className="font-bold text-green-600">{formatCurrency(rec.estimated_savings * 720)}/mo</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
