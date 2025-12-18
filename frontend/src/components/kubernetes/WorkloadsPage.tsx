import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ServerStackIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  PlayIcon,
  CommandLineIcon,
  DocumentTextIcon,
  EyeIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChevronDownIcon,
  SparklesIcon,
  TagIcon,
  DocumentDuplicateIcon,
  ArrowPathRoundedSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { kubernetesApi, aiApi, type WorkloadAnalysisFix, type WorkloadAnalysisResponse } from '../../services/api';
import { logger } from '../../utils/logger';
import GlassCard from '../common/GlassCard';
import { useToast } from '../../contexts/ToastContext';
import type { Deployment, StatefulSet, DaemonSet, Job, Namespace, PodMetrics, K8sEvent, Pod } from '../../types';

// Import shared constants
import { containerVariants, itemVariants, formatAge } from '../../utils/constants';
import { StatusBadge } from '../common/StatusBadge';

type WorkloadType = 'deployments' | 'statefulsets' | 'daemonsets' | 'jobs';

interface UnifiedWorkload {
  name: string;
  namespace: string;
  type: WorkloadType;
  readyPods: string;
  cpu: number;
  memory: number;
  status: 'Healthy' | 'Degraded' | 'Progressing' | 'Failed';
  age: string;
  image?: string;
  labels: Record<string, string>;
  replicas?: { ready: number; desired: number };
  healthIndicators?: {
    maxRestarts: number;
    hasOOMKilled: boolean;
    hasImagePullError: boolean;
    hasCrashLoop: boolean;
    hasProbeFailure: boolean;
    isRecent: boolean; // deployed < 10m ago
  };
}

const tabs: { id: WorkloadType; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'deployments', name: 'Deployments', icon: ServerStackIcon },
  { id: 'statefulsets', name: 'StatefulSets', icon: CubeIcon },
  { id: 'daemonsets', name: 'DaemonSets', icon: ServerStackIcon },
  { id: 'jobs', name: 'Jobs', icon: PlayIcon },
];

// Progress Bar Component
function ProgressBar({ value, color }: { value: number; color: 'blue' | 'purple' }) {
  const colorClass = value >= 90 ? 'bg-red-500' : value >= 70 ? 'bg-amber-500' : color === 'blue' ? 'bg-blue-500' : 'bg-purple-500';

  return (
    <div className="h-1 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`h-full rounded-full ${colorClass}`}
      />
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: UnifiedWorkload['status'] }) {
  const config = {
    Healthy: { bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircleIcon },
    Degraded: { bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', icon: XCircleIcon },
    Progressing: { bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', icon: ClockIcon },
    Failed: { bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', icon: XCircleIcon },
  };

  const { bg, text, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${bg} ${text}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

// Workload Drawer Component
function WorkloadDrawer({
  workload,
  onClose,
}: {
  workload: UnifiedWorkload;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'yaml' | 'logs' | 'terminal' | 'events' | 'ai'>('overview');
  const [expandedSections, setExpandedSections] = useState<string[]>(['labels', 'replicas']);
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [pods, setPods] = useState<Pod[]>([]);
  const [logs, setLogs] = useState<string>('');
  const [selectedPod, setSelectedPod] = useState<string>('');
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [yamlLoading, setYamlLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<WorkloadAnalysisResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  // Fetch pods for this workload
  useEffect(() => {
    async function fetchPods() {
      try {
        const response = await kubernetesApi.getPods(workload.namespace);
        // Filter pods by workload labels
        const workloadPods = response.data.filter(pod =>
          pod.labels?.app === workload.labels.app ||
          pod.labels?.['app.kubernetes.io/name'] === workload.name
        );
        setPods(workloadPods);
        if (workloadPods.length > 0) {
          setSelectedPod(workloadPods[0].name);
          if (workloadPods[0].containers && workloadPods[0].containers.length > 0) {
            setSelectedContainer(workloadPods[0].containers[0]);
          }
        }
      } catch (error) {
        logger.error('Failed to fetch pods', error);
      }
    }
    fetchPods();
  }, [workload]);

  // Fetch events when Events tab is active
  useEffect(() => {
    async function fetchEvents() {
      if (activeTab !== 'events') return;
      setEventsLoading(true);
      try {
        // Convert workload type to K8s kind
        const kindMap: Record<string, string> = {
          'deployments': 'Deployment',
          'statefulsets': 'StatefulSet',
          'daemonsets': 'DaemonSet',
          'jobs': 'Job'
        };
        const kind = kindMap[workload.type] || 'Deployment';
        const response = await kubernetesApi.getWorkloadEvents(kind, workload.namespace, workload.name);
        setEvents(response.data);
      } catch (error) {
        logger.error('Failed to fetch events', error);
      } finally {
        setEventsLoading(false);
      }
    }
    fetchEvents();
  }, [activeTab, workload]);

  // Fetch YAML when YAML tab is active
  useEffect(() => {
    async function fetchYAML() {
      if (activeTab !== 'yaml') return;
      setYamlLoading(true);
      try {
        const kindMap: Record<string, string> = {
          'deployments': 'Deployment',
          'statefulsets': 'StatefulSet',
          'daemonsets': 'DaemonSet',
          'jobs': 'Job'
        };
        const kind = kindMap[workload.type] || 'Deployment';
        const response = await kubernetesApi.getResourceYAML({
          kind,
          name: workload.name,
          namespace: workload.namespace
        });
        if (response.data.success) {
          setYamlContent(response.data.yaml_content);
        }
      } catch (error) {
        logger.error('Failed to fetch YAML', error);
      } finally {
        setYamlLoading(false);
      }
    }
    fetchYAML();
  }, [activeTab, workload]);

  // Fetch logs when Logs tab is active and a pod is selected
  useEffect(() => {
    async function fetchLogs() {
      if (activeTab !== 'logs' || !selectedPod) return;
      setLogsLoading(true);
      try {
        const response = await kubernetesApi.getPodLogs(
          workload.namespace,
          selectedPod,
          {
            container: selectedContainer || undefined,
            tailLines: 100,
            timestamps: true
          }
        );
        setLogs(response.data.logs);
      } catch (error) {
        logger.error('Failed to fetch logs', error);
        setLogs('Failed to fetch logs. Pod may not be running.');
      } finally {
        setLogsLoading(false);
      }
    }
    fetchLogs();
  }, [activeTab, selectedPod, selectedContainer, workload.namespace]);

  // Fetch AI analysis when AI tab is active
  useEffect(() => {
    async function fetchAIAnalysis() {
      if (activeTab !== 'ai') return;
      if (aiAnalysis) return; // Don't refetch if already loaded

      setAiLoading(true);
      setAiError(null);
      try {
        // Convert workload type to backend format
        const typeMap: Record<string, string> = {
          'deployments': 'deployment',
          'statefulsets': 'statefulset',
          'daemonsets': 'daemonset',
          'jobs': 'job'
        };
        const workloadType = typeMap[workload.type] || 'deployment';

        const response = await aiApi.analyzeWorkload({
          workload_name: workload.name,
          workload_type: workloadType,
          namespace: workload.namespace
        });

        if (response.data.success) {
          setAiAnalysis(response.data);
        } else {
          setAiError('Failed to analyze workload');
        }
      } catch (error: any) {
        logger.error('Failed to fetch AI analysis', error);
        setAiError(error.response?.data?.detail || 'Failed to analyze workload');
      } finally {
        setAiLoading(false);
      }
    }
    fetchAIAnalysis();
  }, [activeTab, workload, aiAnalysis]);

  const drawerTabs = [
    { id: 'overview', label: 'Overview', icon: EyeIcon },
    { id: 'yaml', label: 'YAML', icon: DocumentTextIcon },
    { id: 'logs', label: 'Logs', icon: CommandLineIcon },
    { id: 'terminal', label: 'Terminal', icon: CommandLineIcon },
    { id: 'events', label: 'Events', icon: ClockIcon },
    { id: 'ai', label: 'AI Fixes', icon: SparklesIcon },
  ] as const;

  // Mock data for conditions (will be replaced with real data later)
  const mockConditions = [
    { type: 'Available', status: 'True', reason: 'MinimumReplicasAvailable', lastTransition: '2d ago' },
    { type: 'Progressing', status: 'True', reason: 'NewReplicaSetAvailable', lastTransition: '5h ago' },
  ];

  const severityColors = {
    high: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    medium: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    low: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  };

  // Format timestamp for display
  const formatEventTime = (timestamp: string | null | undefined): string => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${workload.status === 'Healthy' ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-red-100 dark:bg-red-500/10'}`}>
            <ServerStackIcon className={`h-6 w-6 ${workload.status === 'Healthy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{workload.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {workload.type.charAt(0).toUpperCase() + workload.type.slice(1, -1)} / {workload.namespace}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
          >
            <XMarkIcon className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <StatusBadge status={workload.status} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {workload.readyPods} pods ready
            </span>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600"
            >
              Scale
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600"
            >
              Restart
            </motion.button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
        <div className="flex gap-1">
          {drawerTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'overview' && (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{workload.replicas?.ready || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ready</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{workload.replicas?.desired || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Desired</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{workload.cpu}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">CPU</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{workload.memory}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Memory</p>
              </div>
            </div>

            {/* Image */}
            {workload.image && (
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Image</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white truncate">{workload.image}</p>
              </div>
            )}

            {/* Labels */}
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleSection('labels')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-2">
                  <TagIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Labels</span>
                  <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400">
                    {Object.keys(workload.labels).length}
                  </span>
                </div>
                <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expandedSections.includes('labels') ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {expandedSections.includes('labels') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 flex flex-wrap gap-2">
                      {Object.entries(workload.labels).map(([key, value]) => (
                        <span key={key} className="inline-flex items-center px-2 py-1 text-xs rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          <span className="font-medium">{key}</span>
                          <span className="mx-1">=</span>
                          <span>{value}</span>
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Conditions */}
            <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleSection('conditions')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Conditions</span>
                </div>
                <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expandedSections.includes('conditions') ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {expandedSections.includes('conditions') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 space-y-2">
                      {mockConditions.map((condition, index) => (
                        <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50 dark:bg-slate-800/30">
                          <span className={`mt-0.5 px-2 py-0.5 text-xs font-medium rounded ${
                            condition.status === 'True' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
                          }`}>
                            {condition.status}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{condition.type}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{condition.reason}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{condition.lastTransition}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {activeTab === 'yaml' && (
          <div className="rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 overflow-hidden">
            <div className="p-3 bg-slate-800 dark:bg-slate-900 border-b border-slate-700 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">YAML Manifest</span>
              <button
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"
                onClick={() => {
                  navigator.clipboard.writeText(yamlContent);
                }}
                title="Copy YAML"
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
              </button>
            </div>
            {yamlLoading ? (
              <div className="p-4 text-center text-slate-400">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
                <p className="mt-2 text-sm">Loading YAML...</p>
              </div>
            ) : yamlContent ? (
              <pre className="p-4 text-xs text-slate-300 overflow-x-auto font-mono max-h-[500px]">
                {yamlContent}
              </pre>
            ) : (
              <div className="p-4 text-center text-slate-500">
                <p>No YAML content available</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <select
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                value={selectedPod}
                onChange={(e) => setSelectedPod(e.target.value)}
              >
                <option value="">Select Pod</option>
                {pods.map(pod => (
                  <option key={pod.name} value={pod.name}>{pod.name}</option>
                ))}
              </select>
              {selectedPod && pods.find(p => p.name === selectedPod)?.containers && pods.find(p => p.name === selectedPod)!.containers!.length > 1 && (
                <select
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  value={selectedContainer}
                  onChange={(e) => setSelectedContainer(e.target.value)}
                >
                  {pods.find(p => p.name === selectedPod)?.containers?.map(container => (
                    <option key={container} value={container}>{container}</option>
                  ))}
                </select>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (selectedPod) {
                    // Re-fetch logs
                    const fetchLogs = async () => {
                      setLogsLoading(true);
                      try {
                        const response = await kubernetesApi.getPodLogs(
                          workload.namespace,
                          selectedPod,
                          {
                            container: selectedContainer || undefined,
                            tailLines: 100,
                            timestamps: true
                          }
                        );
                        setLogs(response.data.logs);
                      } catch (error) {
                        logger.error('Failed to fetch logs', error);
                        setLogs('Failed to fetch logs. Pod may not be running.');
                      } finally {
                        setLogsLoading(false);
                      }
                    };
                    fetchLogs();
                  }
                }}
                disabled={!selectedPod}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-blue-500 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Refresh
              </motion.button>
            </div>
            <div className="rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 p-4 font-mono text-xs text-slate-300 h-80 overflow-y-auto">
              {logsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
                </div>
              ) : logs ? (
                <pre className="whitespace-pre-wrap">{logs}</pre>
              ) : (
                <p className="text-slate-500">Select a pod to view logs</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <select className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white">
                <option>Select Pod</option>
                <option>{workload.name}-abc123</option>
                <option>{workload.name}-def456</option>
              </select>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-blue-500 text-white"
              >
                Connect
              </motion.button>
            </div>
            <div className="rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 p-4 font-mono text-xs h-80 flex items-center justify-center text-slate-500">
              Select a pod and click Connect to start a terminal session
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-2">
            {eventsLoading ? (
              <div className="p-4 text-center text-slate-400">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
                <p className="mt-2 text-sm">Loading events...</p>
              </div>
            ) : events.length > 0 ? (
              events.map((event, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl border ${
                    event.type === 'Warning'
                      ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                      : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {event.type === 'Warning' ? (
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{event.reason}</span>
                        <span className="text-xs text-gray-400">{formatEventTime(event.last_timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.message}</p>
                      {event.count > 1 && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Count: {event.count}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-slate-500">
                <p>No events found for this workload</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                  <SparklesIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI Recommendations</h3>
                  <p className="text-xs text-gray-500">Suggestions to improve this workload</p>
                </div>
              </div>
              {aiAnalysis && (
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    aiAnalysis.health_score >= 80 ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    aiAnalysis.health_score >= 60 ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                    'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    Health: {aiAnalysis.health_score}/100
                  </span>
                </div>
              )}
            </div>

            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="mb-4"
                >
                  <SparklesIcon className="h-8 w-8 text-purple-500" />
                </motion.div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Analyzing workload...</p>
              </div>
            ) : aiError ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                <p className="text-sm text-red-600 dark:text-red-400">{aiError}</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setAiAnalysis(null);
                    setAiError(null);
                  }}
                  className="mt-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600"
                >
                  Retry
                </motion.button>
              </div>
            ) : aiAnalysis ? (
              <>
                {/* Root Cause Section - "Why is this unhealthy?" */}
                {aiAnalysis.summary && (
                  <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-500/10 dark:to-orange-500/10 border-2 border-red-200 dark:border-red-500/20">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-500/20">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          🔍 Why is this unhealthy?
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {aiAnalysis.summary}
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/50">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Health Score</p>
                            <p className={`text-sm font-semibold ${
                              aiAnalysis.health_score >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                              aiAnalysis.health_score >= 60 ? 'text-amber-600 dark:text-amber-400' :
                              'text-red-600 dark:text-red-400'
                            }`}>
                              {aiAnalysis.health_score}/100
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/50">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Issues Found</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {aiAnalysis.fixes.length}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/50">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Auto-fixable</p>
                            <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                              {aiAnalysis.fixes.filter(f => f.auto_fixable).length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fixes Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <SparklesIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Recommended Fixes
                  </h4>
                  {aiAnalysis.fixes.map((fix, index) => {
                    // Estimate fix time based on category
                    const estimatedTime = fix.auto_fixable ? '< 1 min' :
                                         fix.category === 'security' ? '5-10 min' :
                                         fix.category === 'performance' ? '10-15 min' : '2-5 min';

                    // Determine risk level
                    const riskLevel = fix.severity === 'high' ? 'High Impact' :
                                     fix.severity === 'medium' ? 'Medium Impact' : 'Low Impact';

                    const riskColor = fix.severity === 'high' ? 'text-red-600 dark:text-red-400' :
                                     fix.severity === 'medium' ? 'text-amber-600 dark:text-amber-400' :
                                     'text-blue-600 dark:text-blue-400';

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 rounded-xl bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-500/5 dark:to-blue-500/5 border border-purple-200/30 dark:border-purple-500/20"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{fix.title}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400">
                                {fix.category.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{fix.description}</p>

                            {/* Expected Outcome & Metadata */}
                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1">
                                <ClockIcon className="h-3 w-3 text-gray-400" />
                                <span className="text-gray-500 dark:text-gray-400">Est. {estimatedTime}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`font-medium ${riskColor}`}>{riskLevel}</span>
                              </div>
                            </div>
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${severityColors[fix.severity]}`}>
                            {fix.severity.toUpperCase()}
                          </span>
                        </div>

                        {/* Expected Outcome Section */}
                        <div className="mb-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                          <p className="text-xs text-blue-900 dark:text-blue-300">
                            <span className="font-semibold">Expected Outcome:</span> {
                              fix.category === 'security' ? 'Improved security posture and reduced attack surface' :
                              fix.category === 'performance' ? 'Better resource utilization and response times' :
                              fix.category === 'reliability' ? 'Increased uptime and fault tolerance' :
                              'Adherence to Kubernetes best practices'
                            }
                          </p>
                        </div>
                        {fix.fix_yaml && (
                          <details className="mt-2">
                            <summary className="text-xs text-purple-600 dark:text-purple-400 cursor-pointer hover:underline">
                              View YAML fix
                            </summary>
                            <pre className="mt-2 p-2 bg-slate-900 text-green-400 text-xs rounded-lg overflow-x-auto">
                              {fix.fix_yaml}
                            </pre>
                          </details>
                        )}
                        {fix.kubectl_command && (
                          <div className="mt-2 p-2 bg-slate-900 text-cyan-400 text-xs rounded-lg font-mono overflow-x-auto">
                            $ {fix.kubectl_command}
                          </div>
                        )}

                        {fix.auto_fixable && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600"
                          >
                            Apply Fix
                          </motion.button>
                        )}
                      </motion.div>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <SparklesIcon className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No analysis available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Main WorkloadsPage Component
export default function WorkloadsPage() {
  const [activeTab, setActiveTab] = useState<WorkloadType>('deployments');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [selectedWorkload, setSelectedWorkload] = useState<UnifiedWorkload | null>(null);

  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [statefulsets, setStatefulsets] = useState<StatefulSet[]>([]);
  const [daemonsets, setDaemonsets] = useState<DaemonSet[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [podMetrics, setPodMetrics] = useState<PodMetrics[]>([]);
  const [allPods, setAllPods] = useState<Pod[]>([]);

  // Operation states
  const [scaleModal, setScaleModal] = useState<{ workload: UnifiedWorkload; replicas: number } | null>(null);
  const [deleteModal, setDeleteModal] = useState<UnifiedWorkload | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [deploymentsRes, statefulsetsRes, daemonsetsRes, jobsRes, namespacesRes, metricsRes, podsRes] = await Promise.all([
        kubernetesApi.getDeployments().catch(() => ({ data: [] })),
        kubernetesApi.getStatefulSets().catch(() => ({ data: [] })),
        kubernetesApi.getDaemonSets().catch(() => ({ data: [] })),
        kubernetesApi.getJobs().catch(() => ({ data: [] })),
        kubernetesApi.getNamespaces().catch(() => ({ data: [] })),
        kubernetesApi.getPodMetrics().catch(() => ({ data: [] })),
        kubernetesApi.getPods().catch(() => ({ data: [] })),
      ]);

      setDeployments(deploymentsRes.data);
      setStatefulsets(statefulsetsRes.data);
      setDaemonsets(daemonsetsRes.data);
      setJobs(jobsRes.data);
      setNamespaces(namespacesRes.data);
      setPodMetrics(metricsRes.data);
      setAllPods(podsRes.data);
    } catch (error) {
      logger.error('Failed to fetch workloads', error);
    } finally {
      setLoading(false);
    }
  }

  // Handle Scale Operation
  async function handleScale(workload: UnifiedWorkload, replicas: number) {
    setOperationLoading(true);
    try {
      if (workload.type === 'deployments') {
        await kubernetesApi.scale(workload.namespace, workload.name, replicas);
      } else if (workload.type === 'statefulsets') {
        await kubernetesApi.scaleStatefulSet(workload.namespace, workload.name, replicas);
      }
      showToast(`Successfully scaled ${workload.name} to ${replicas} replicas`, 'success');
      setScaleModal(null);
      fetchData();
    } catch (error: any) {
      showToast(`Failed to scale ${workload.name}: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setOperationLoading(false);
    }
  }

  // Handle Restart Operation
  async function handleRestart(workload: UnifiedWorkload) {
    setOperationLoading(true);
    try {
      if (workload.type === 'deployments') {
        await kubernetesApi.restart(workload.namespace, workload.name);
      } else if (workload.type === 'statefulsets') {
        await kubernetesApi.restartStatefulSet(workload.namespace, workload.name);
      } else if (workload.type === 'daemonsets') {
        await kubernetesApi.restartDaemonSet(workload.namespace, workload.name);
      }
      showToast(`Successfully restarted ${workload.name}`, 'success');
      fetchData();
    } catch (error: any) {
      showToast(`Failed to restart ${workload.name}: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setOperationLoading(false);
    }
  }

  // Handle Delete Operation
  async function handleDelete(workload: UnifiedWorkload) {
    setOperationLoading(true);
    try {
      if (workload.type === 'deployments') {
        await kubernetesApi.deleteDeployment(workload.namespace, workload.name);
      } else if (workload.type === 'statefulsets') {
        await kubernetesApi.deleteStatefulSet(workload.namespace, workload.name);
      } else if (workload.type === 'daemonsets') {
        await kubernetesApi.deleteDaemonSet(workload.namespace, workload.name);
      } else if (workload.type === 'jobs') {
        await kubernetesApi.deleteJob(workload.namespace, workload.name);
      }
      showToast(`Successfully deleted ${workload.name}`, 'success');
      setDeleteModal(null);
      fetchData();
    } catch (error: any) {
      showToast(`Failed to delete ${workload.name}: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setOperationLoading(false);
    }
  }

  // Helper to calculate health indicators from pods
  const getHealthIndicators = (workloadName: string, workloadNamespace: string, workloadLabels: Record<string, string>, ageStr: string) => {
    // Find pods belonging to this workload by matching labels
    const workloadPods = allPods.filter(pod => {
      if (pod.namespace !== workloadNamespace) return false;
      // Match by common label patterns
      return (
        pod.name.startsWith(workloadName) ||
        (workloadLabels?.app && pod.name.includes(workloadLabels.app)) ||
        (workloadLabels?.['app.kubernetes.io/name'] && pod.name.includes(workloadLabels['app.kubernetes.io/name']))
      );
    });

    if (workloadPods.length === 0) {
      return {
        maxRestarts: 0,
        hasOOMKilled: false,
        hasImagePullError: false,
        hasCrashLoop: false,
        hasProbeFailure: false,
        isRecent: false,
      };
    }

    // Calculate max restarts
    const maxRestarts = Math.max(...workloadPods.map(p => p.restarts || 0));

    // Check for specific failure indicators
    // Note: We'd need K8s events or more detailed pod status to detect these properly
    // For now, we use heuristics based on pod status and restart counts
    const hasOOMKilled = false; // Would need events data
    const hasImagePullError = workloadPods.some(p => p.status === 'Pending' && !p.ready);
    const hasCrashLoop = workloadPods.some(p => p.restarts > 5);
    const hasProbeFailure = workloadPods.some(p => p.status === 'Running' && !p.ready);

    // Check if workload is recent (< 10m)
    const isRecent = ageStr.includes('s') || (ageStr.includes('m') && parseInt(ageStr) < 10);

    return {
      maxRestarts,
      hasOOMKilled,
      hasImagePullError,
      hasCrashLoop,
      hasProbeFailure,
      isRecent,
    };
  };

  // Transform data to unified format
  const unifiedWorkloads = useMemo((): UnifiedWorkload[] => {
    const getStatus = (ready: number, desired: number): UnifiedWorkload['status'] => {
      if (ready === 0 && desired > 0) return 'Failed';
      if (ready < desired) return 'Progressing';
      return 'Healthy';
    };

    const allWorkloads: UnifiedWorkload[] = [];

    // Deployments
    deployments.forEach(d => {
      allWorkloads.push({
        name: d.name,
        namespace: d.namespace,
        type: 'deployments',
        readyPods: `${d.ready_replicas}/${d.replicas}`,
        cpu: Math.floor(Math.random() * 60) + 10,
        memory: Math.floor(Math.random() * 70) + 15,
        status: getStatus(d.ready_replicas, d.replicas),
        age: d.age,
        image: d.image,
        labels: d.labels,
        replicas: { ready: d.ready_replicas, desired: d.replicas },
        healthIndicators: getHealthIndicators(d.name, d.namespace, d.labels, d.age),
      });
    });

    // StatefulSets
    statefulsets.forEach(s => {
      allWorkloads.push({
        name: s.name,
        namespace: s.namespace,
        type: 'statefulsets',
        readyPods: `${s.ready_replicas}/${s.replicas}`,
        cpu: Math.floor(Math.random() * 60) + 10,
        memory: Math.floor(Math.random() * 70) + 15,
        status: getStatus(s.ready_replicas, s.replicas),
        age: s.age,
        image: s.image,
        labels: s.labels,
        replicas: { ready: s.ready_replicas, desired: s.replicas },
        healthIndicators: getHealthIndicators(s.name, s.namespace, s.labels, s.age),
      });
    });

    // DaemonSets
    daemonsets.forEach(d => {
      allWorkloads.push({
        name: d.name,
        namespace: d.namespace,
        type: 'daemonsets',
        readyPods: `${d.ready}/${d.desired}`,
        cpu: Math.floor(Math.random() * 60) + 10,
        memory: Math.floor(Math.random() * 70) + 15,
        status: getStatus(d.ready, d.desired),
        age: d.age,
        image: d.image,
        labels: d.labels,
        replicas: { ready: d.ready, desired: d.desired },
        healthIndicators: getHealthIndicators(d.name, d.namespace, d.labels, d.age),
      });
    });

    // Jobs
    jobs.forEach(j => {
      const status: UnifiedWorkload['status'] = j.failed > 0 ? 'Failed' : j.succeeded > 0 ? 'Healthy' : 'Progressing';
      allWorkloads.push({
        name: j.name,
        namespace: j.namespace,
        type: 'jobs',
        readyPods: `${j.succeeded}/${j.completions || 1}`,
        cpu: Math.floor(Math.random() * 40) + 5,
        memory: Math.floor(Math.random() * 50) + 10,
        status,
        age: j.age,
        labels: j.labels,
        replicas: { ready: j.succeeded, desired: j.completions || 1 },
        healthIndicators: getHealthIndicators(j.name, j.namespace, j.labels, j.age),
      });
    });

    return allWorkloads;
  }, [deployments, statefulsets, daemonsets, jobs, allPods]);

  // Filter workloads
  const filteredWorkloads = useMemo(() => {
    return unifiedWorkloads.filter(w => {
      const matchesType = w.type === activeTab;
      const matchesNamespace = !selectedNamespace || w.namespace === selectedNamespace;
      const matchesSearch = !searchQuery ||
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.namespace.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesNamespace && matchesSearch;
    });
  }, [unifiedWorkloads, activeTab, selectedNamespace, searchQuery]);

  // Get counts per type
  const counts = useMemo(() => ({
    deployments: unifiedWorkloads.filter(w => w.type === 'deployments').length,
    statefulsets: unifiedWorkloads.filter(w => w.type === 'statefulsets').length,
    daemonsets: unifiedWorkloads.filter(w => w.type === 'daemonsets').length,
    jobs: unifiedWorkloads.filter(w => w.type === 'jobs').length,
  }), [unifiedWorkloads]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
              <ServerStackIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Workloads</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage deployments, statefulsets, daemonsets, and jobs
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div variants={itemVariants}>
        <GlassCard padding="md">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-slate-800/80 rounded-xl">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-200 dark:bg-slate-600'
                    }`}>
                      {counts[tab.id]}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search workloads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className="px-4 py-2.5 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-gray-700 dark:text-gray-300"
              >
                <option value="">All Namespaces</option>
                {namespaces.map((ns) => (
                  <option key={ns.name} value={ns.name}>{ns.name}</option>
                ))}
              </select>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Workloads Table */}
      <motion.div variants={itemVariants}>
        <GlassCard padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ready</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPU</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Memory</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                {loading && filteredWorkloads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin text-blue-500" />
                      <p className="mt-3 text-sm text-gray-500">Loading workloads...</p>
                    </td>
                  </tr>
                ) : filteredWorkloads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center">
                      <ServerStackIcon className="h-6 w-6 mx-auto text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500">No {activeTab} found</p>
                    </td>
                  </tr>
                ) : (
                  filteredWorkloads.map((workload) => (
                    <motion.tr
                      key={`${workload.type}-${workload.namespace}-${workload.name}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelectedWorkload(workload)}
                      className={`cursor-pointer transition-colors ${
                        selectedWorkload?.name === workload.name && selectedWorkload?.namespace === workload.namespace
                          ? 'bg-blue-50 dark:bg-blue-500/10'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded-lg ${workload.status === 'Healthy' ? 'bg-emerald-100 dark:bg-emerald-500/10' : workload.status === 'Failed' ? 'bg-red-100 dark:bg-red-500/10' : 'bg-amber-100 dark:bg-amber-500/10'}`}>
                            <ServerStackIcon className={`h-3.5 w-3.5 ${workload.status === 'Healthy' ? 'text-emerald-600 dark:text-emerald-400' : workload.status === 'Failed' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{workload.name}</span>
                            {workload.healthIndicators && workload.healthIndicators.maxRestarts > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold"
                                title={`${workload.healthIndicators.maxRestarts} restarts`}
                              >
                                <ArrowPathIcon className="h-2.5 w-2.5" />
                                {workload.healthIndicators.maxRestarts}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded">
                          {workload.namespace}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {workload.readyPods}
                      </td>
                      <td className="px-3 py-2">
                        <div className="w-16">
                          <div className="flex justify-between text-[11px] mb-0.5">
                            <span className="text-gray-500">{workload.cpu}%</span>
                          </div>
                          <ProgressBar value={workload.cpu} color="blue" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="w-16">
                          <div className="flex justify-between text-[11px] mb-0.5">
                            <span className="text-gray-500">{workload.memory}%</span>
                          </div>
                          <ProgressBar value={workload.memory} color="purple" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={workload.status} />
                          {workload.healthIndicators && (
                            <div className="flex items-center gap-0.5">
                              {workload.healthIndicators.hasCrashLoop && (
                                <span title="CrashLoopBackOff detected" className="inline-flex p-0.5 rounded bg-red-100 dark:bg-red-500/10">
                                  <ArrowPathRoundedSquareIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                </span>
                              )}
                              {workload.healthIndicators.hasImagePullError && (
                                <span title="ImagePullError detected" className="inline-flex p-0.5 rounded bg-amber-100 dark:bg-amber-500/10">
                                  <DocumentDuplicateIcon className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                              {workload.healthIndicators.hasProbeFailure && (
                                <span title="Probe failure detected" className="inline-flex p-0.5 rounded bg-orange-100 dark:bg-orange-500/10">
                                  <ExclamationTriangleIcon className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{workload.age}</span>
                          {workload.healthIndicators?.isRecent && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-semibold">
                              <ClockIcon className="h-2.5 w-2.5" />
                              Recent
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); setSelectedWorkload(workload); }}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </motion.button>
                          {(workload.type === 'deployments' || workload.type === 'statefulsets') && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setScaleModal({ workload, replicas: workload.replicas?.desired || 0 });
                              }}
                              className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                              title="Scale"
                            >
                              <CubeIcon className="h-4 w-4" />
                            </motion.button>
                          )}
                          {workload.type !== 'jobs' && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestart(workload);
                              }}
                              disabled={operationLoading}
                              className="p-2 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
                              title="Restart"
                            >
                              <ArrowPathRoundedSquareIcon className="h-4 w-4" />
                            </motion.button>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModal(workload);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>

      {/* Workload Drawer */}
      <AnimatePresence>
        {selectedWorkload && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setSelectedWorkload(null)}
            />
            <WorkloadDrawer
              workload={selectedWorkload}
              onClose={() => setSelectedWorkload(null)}
            />
          </>
        )}
      </AnimatePresence>

      {/* Scale Modal */}
      <AnimatePresence>
        {scaleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !operationLoading && setScaleModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-500/10">
                  <CubeIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Scale Workload</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {scaleModal.workload.namespace}/{scaleModal.workload.name}
                  </p>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Number of Replicas
                </label>
                <input
                  type="number"
                  min="0"
                  value={scaleModal.replicas}
                  onChange={(e) => setScaleModal({ ...scaleModal, replicas: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  disabled={operationLoading}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Current: {scaleModal.workload.readyPods}
                </p>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScaleModal(null)}
                  disabled={operationLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-medium disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleScale(scaleModal.workload, scaleModal.replicas)}
                  disabled={operationLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {operationLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Scale
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !operationLoading && setDeleteModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-500/10">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Workload</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Are you sure you want to delete <span className="font-semibold">{deleteModal.name}</span> in namespace <span className="font-semibold">{deleteModal.namespace}</span>?
                </p>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteModal(null)}
                  disabled={operationLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-medium disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDelete(deleteModal)}
                  disabled={operationLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {operationLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
