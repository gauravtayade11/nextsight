import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CircleStackIcon,
  FolderIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  PlayIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  CodeBracketIcon,
  DocumentDuplicateIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CubeIcon,
  CloudArrowUpIcon,
  ArrowDownTrayIcon,
  TagIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  BookOpenIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import GlassCard from '../common/GlassCard';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Types
interface HelmChart {
  name: string;
  version: string;
  appVersion: string;
  description: string;
  icon?: string;
  repo: string;
}

interface HelmRelease {
  name: string;
  namespace: string;
  chart: string;
  version: string;
  status: 'deployed' | 'pending' | 'failed' | 'uninstalling';
  revision: number;
  updated: string;
}

interface ChartNode {
  name: string;
  type: 'folder' | 'chart';
  children?: ChartNode[];
  chart?: HelmChart;
}

// Mock data for Helm charts
const mockChartTree: ChartNode[] = [
  {
    name: 'bitnami',
    type: 'folder',
    children: [
      { name: 'nginx', type: 'chart', chart: { name: 'nginx', version: '15.4.4', appVersion: '1.25.3', description: 'NGINX Open Source for high-performance web serving', repo: 'bitnami' } },
      { name: 'postgresql', type: 'chart', chart: { name: 'postgresql', version: '13.2.24', appVersion: '16.1.0', description: 'PostgreSQL is an object-relational database', repo: 'bitnami' } },
      { name: 'redis', type: 'chart', chart: { name: 'redis', version: '18.4.0', appVersion: '7.2.3', description: 'Redis is an in-memory data structure store', repo: 'bitnami' } },
      { name: 'mongodb', type: 'chart', chart: { name: 'mongodb', version: '14.3.2', appVersion: '7.0.4', description: 'MongoDB is a document-oriented NoSQL database', repo: 'bitnami' } },
    ],
  },
  {
    name: 'stable',
    type: 'folder',
    children: [
      { name: 'grafana', type: 'chart', chart: { name: 'grafana', version: '7.0.17', appVersion: '10.2.2', description: 'The leading observability platform', repo: 'stable' } },
      { name: 'prometheus', type: 'chart', chart: { name: 'prometheus', version: '25.8.2', appVersion: '2.48.0', description: 'Prometheus monitoring system', repo: 'stable' } },
    ],
  },
  {
    name: 'local',
    type: 'folder',
    children: [
      { name: 'nextsight-api', type: 'chart', chart: { name: 'nextsight-api', version: '1.4.0', appVersion: '1.4.0', description: 'NextSight AI API Server', repo: 'local' } },
      { name: 'nextsight-frontend', type: 'chart', chart: { name: 'nextsight-frontend', version: '1.4.0', appVersion: '1.4.0', description: 'NextSight AI Frontend Application', repo: 'local' } },
    ],
  },
];

const mockReleases: HelmRelease[] = [
  { name: 'api-server', namespace: 'production', chart: 'nextsight-api', version: '1.4.0', status: 'deployed', revision: 5, updated: '2024-01-15T10:30:00Z' },
  { name: 'web-frontend', namespace: 'production', chart: 'nextsight-frontend', version: '1.4.0', status: 'deployed', revision: 3, updated: '2024-01-15T10:30:00Z' },
  { name: 'redis-cache', namespace: 'production', chart: 'redis', version: '18.4.0', status: 'deployed', revision: 2, updated: '2024-01-10T08:00:00Z' },
  { name: 'monitoring', namespace: 'monitoring', chart: 'prometheus', version: '25.8.2', status: 'deployed', revision: 1, updated: '2024-01-05T12:00:00Z' },
  { name: 'failed-release', namespace: 'staging', chart: 'nginx', version: '15.4.4', status: 'failed', revision: 1, updated: '2024-01-14T15:00:00Z' },
];

const mockDefaultValues = `# Default values for nginx
replicaCount: 3

image:
  repository: nginx
  pullPolicy: IfNotPresent
  tag: "1.25.3"

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    kubernetes.io/tls-acme: "true"
  hosts:
    - host: app.example.com
      paths:
        - path: /
          pathType: Prefix

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

nodeSelector: {}
tolerations: []
affinity: {}
`;

// Chart Tree Component
function ChartTree({
  nodes,
  selectedChart,
  onSelectChart,
  level = 0,
}: {
  nodes: ChartNode[];
  selectedChart: string | null;
  onSelectChart: (node: ChartNode) => void;
  level?: number;
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['bitnami', 'stable', 'local']));

  const toggleFolder = (name: string) => {
    setExpandedFolders(prev => {
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
      {nodes.map((node) => (
        <div key={node.name}>
          <motion.button
            whileHover={{ x: 2 }}
            onClick={() => {
              if (node.type === 'folder') {
                toggleFolder(node.name);
              } else {
                onSelectChart(node);
              }
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
              selectedChart === node.name
                ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
                : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300'
            }`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            {node.type === 'folder' ? (
              <>
                <ChevronRightIcon className={`h-3 w-3 text-gray-400 transition-transform ${expandedFolders.has(node.name) ? 'rotate-90' : ''}`} />
                {expandedFolders.has(node.name) ? (
                  <FolderOpenIcon className="h-4 w-4 text-amber-500" />
                ) : (
                  <FolderIcon className="h-4 w-4 text-amber-500" />
                )}
              </>
            ) : (
              <>
                <span className="w-3" />
                <CircleStackIcon className="h-4 w-4 text-blue-500" />
              </>
            )}
            <span className="text-xs truncate">{node.name}</span>
            {node.chart && (
              <span className="ml-auto text-xs text-gray-400">{node.chart.version}</span>
            )}
          </motion.button>
          {node.type === 'folder' && expandedFolders.has(node.name) && node.children && (
            <ChartTree
              nodes={node.children}
              selectedChart={selectedChart}
              onSelectChart={onSelectChart}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// AI Values Analysis Component
function AIValuesAnalysis({ valuesContent }: { valuesContent: string }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    riskLevel: 'low' | 'medium' | 'high';
    issues: { severity: 'warning' | 'error' | 'info'; message: string }[];
    suggestions: string[];
    optimizations: string[];
  } | null>(null);

  const analyzeValues = async () => {
    if (!valuesContent.trim()) return;

    setAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    setAnalysis({
      riskLevel: 'low',
      issues: [
        { severity: 'info', message: 'Using recommended resource limits' },
        { severity: 'warning', message: 'Consider enabling PodDisruptionBudget for HA' },
        { severity: 'info', message: 'Autoscaling is properly configured' },
      ],
      suggestions: [
        'Add PodDisruptionBudget for high availability',
        'Consider adding pod anti-affinity rules',
        'Review ingress TLS configuration',
      ],
      optimizations: [
        'Right-size CPU requests based on usage patterns',
        'Enable horizontal pod autoscaling metrics',
      ],
    });
    setAnalyzing(false);
  };

  const riskColors = {
    low: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
    medium: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    high: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
  };

  const severityIcons = {
    error: <XCircleIcon className="h-4 w-4 text-red-500" />,
    warning: <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />,
    info: <CheckCircleIcon className="h-4 w-4 text-blue-500" />,
  };

  return (
    <div className="space-y-4">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={analyzeValues}
        disabled={analyzing || !valuesContent.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-200/50 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 font-medium text-sm hover:from-purple-500/30 hover:to-blue-500/30 disabled:opacity-50 transition-all"
      >
        {analyzing ? (
          <ArrowPathIcon className="h-4 w-4 animate-spin" />
        ) : (
          <SparklesIcon className="h-4 w-4" />
        )}
        {analyzing ? 'Analyzing...' : 'AI Values Analysis'}
      </motion.button>

      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* Risk Level */}
            <div className={`p-3 rounded-xl border ${riskColors[analysis.riskLevel]}`}>
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase">
                  {analysis.riskLevel} Risk
                </span>
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Analysis</p>
              {analysis.issues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                  {severityIcons[issue.severity]}
                  <span className="text-xs text-gray-700 dark:text-gray-300">{issue.message}</span>
                </div>
              ))}
            </div>

            {/* Suggestions */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Suggestions</p>
              {analysis.suggestions.map((suggestion, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-500/5">
                  <CheckCircleIcon className="h-4 w-4 text-purple-500 flex-shrink-0" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{suggestion}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Status Badge Component
function ReleaseBadge({ status }: { status: HelmRelease['status'] }) {
  const statusConfig = {
    deployed: { color: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Deployed' },
    pending: { color: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Pending' },
    failed: { color: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400', label: 'Failed' },
    uninstalling: { color: 'bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400', label: 'Uninstalling' },
  };

  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function HelmDeployEnhanced() {
  const [valuesContent, setValuesContent] = useState(mockDefaultValues);
  const [selectedChart, setSelectedChart] = useState<ChartNode | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<HelmRelease | null>(null);
  const [releaseName, setReleaseName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [activeEditorTab, setActiveEditorTab] = useState<'values' | 'chart' | 'templates' | 'ai'>('values');
  const [activeLeftTab, setActiveLeftTab] = useState<'charts' | 'releases'>('charts');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const namespaces = ['default', 'production', 'staging', 'development', 'monitoring', 'kube-system'];

  const handleChartSelect = (node: ChartNode) => {
    if (node.type === 'chart' && node.chart) {
      setSelectedChart(node);
      setReleaseName(node.chart.name + '-release');
      addLog(`Selected chart: ${node.chart.name} v${node.chart.version}`);
    }
  };

  const handleReleaseSelect = (release: HelmRelease) => {
    setSelectedRelease(release);
    setReleaseName(release.name);
    setNamespace(release.namespace);
    addLog(`Selected release: ${release.name} (rev ${release.revision})`);
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleInstall = async (dryRun: boolean) => {
    if (!selectedChart) {
      addLog('Error: No chart selected');
      return;
    }

    setLoading(true);
    setResult(null);
    addLog(`Starting ${dryRun ? 'dry run' : 'installation'} of ${selectedChart.chart?.name}...`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (dryRun) {
      addLog('Dry run completed successfully');
      addLog('Resources to be created: Deployment, Service, Ingress, ConfigMap');
      setResult({ success: true, message: 'Dry run completed - 4 resources would be created' });
    } else {
      addLog(`Installing ${selectedChart.chart?.name} as ${releaseName}...`);
      addLog('Creating resources...');
      addLog('Release installed successfully!');
      setResult({ success: true, message: `Release ${releaseName} installed successfully` });
    }

    setLoading(false);
  };

  const handleUpgrade = async () => {
    if (!selectedRelease) {
      addLog('Error: No release selected');
      return;
    }

    setLoading(true);
    setResult(null);
    addLog(`Upgrading release ${selectedRelease.name}...`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    addLog('Upgrade completed successfully!');
    setResult({ success: true, message: `Release ${selectedRelease.name} upgraded to revision ${selectedRelease.revision + 1}` });

    setLoading(false);
  };

  const handleRollback = async () => {
    if (!selectedRelease) {
      addLog('Error: No release selected');
      return;
    }

    setLoading(true);
    setResult(null);
    addLog(`Rolling back release ${selectedRelease.name} to revision ${selectedRelease.revision - 1}...`);

    await new Promise(resolve => setTimeout(resolve, 1500));

    addLog('Rollback completed successfully!');
    setResult({ success: true, message: `Release ${selectedRelease.name} rolled back to revision ${selectedRelease.revision - 1}` });

    setLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(valuesContent);
    addLog('Values copied to clipboard');
  };

  const editorTabs = [
    { id: 'values', label: 'Values', icon: DocumentTextIcon },
    { id: 'chart', label: 'Chart Info', icon: BookOpenIcon },
    { id: 'templates', label: 'Templates', icon: ListBulletIcon },
    { id: 'ai', label: 'AI Review', icon: SparklesIcon },
  ] as const;

  const filteredReleases = mockReleases.filter(release =>
    release.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    release.chart.toLowerCase().includes(searchQuery.toLowerCase()) ||
    release.namespace.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-50 dark:bg-slate-950 p-4' : ''}`}
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
            <CircleStackIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Helm Deploy</h2>
            <p className="text-xs text-gray-500">Install and manage Helm charts</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500"
        >
          {isFullscreen ? (
            <ArrowsPointingInIcon className="h-5 w-5" />
          ) : (
            <ArrowsPointingOutIcon className="h-5 w-5" />
          )}
        </motion.button>
      </motion.div>

      {/* Main Content - 3 Panel Layout */}
      <motion.div variants={itemVariants} className="grid grid-cols-5 gap-4 h-[calc(100vh-280px)] min-h-[500px]">
        {/* Left Panel - Chart Explorer / Releases (20%) */}
        <GlassCard className="col-span-1 overflow-hidden flex flex-col">
          {/* Tab Switcher */}
          <div className="p-2 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center gap-1">
            <button
              onClick={() => setActiveLeftTab('charts')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeLeftTab === 'charts'
                  ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <CubeIcon className="h-3.5 w-3.5" />
              Charts
            </button>
            <button
              onClick={() => setActiveLeftTab('releases')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeLeftTab === 'releases'
                  ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <CloudArrowUpIcon className="h-3.5 w-3.5" />
              Releases
            </button>
          </div>

          {/* Search */}
          {activeLeftTab === 'releases' && (
            <div className="p-2 border-b border-gray-200/50 dark:border-slate-700/50">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search releases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200/50 dark:border-slate-700/50 rounded-lg bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300 placeholder-gray-400"
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2">
            {activeLeftTab === 'charts' ? (
              <ChartTree
                nodes={mockChartTree}
                selectedChart={selectedChart?.name || null}
                onSelectChart={handleChartSelect}
              />
            ) : (
              <div className="space-y-1">
                {filteredReleases.map((release) => (
                  <motion.button
                    key={release.name}
                    whileHover={{ x: 2 }}
                    onClick={() => handleReleaseSelect(release)}
                    className={`w-full p-2 rounded-lg text-left transition-colors ${
                      selectedRelease?.name === release.name
                        ? 'bg-primary-100 dark:bg-primary-500/20'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{release.name}</span>
                      <ReleaseBadge status={release.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{release.chart}</span>
                      <span>•</span>
                      <span>{release.namespace}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Center Panel - Editor (60%) */}
        <GlassCard className="col-span-3 overflow-hidden flex flex-col">
          {/* Editor Tabs */}
          <div className="p-2 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {editorTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveEditorTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeEditorTab === tab.id
                      ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={copyToClipboard}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400"
                title="Copy to clipboard"
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-hidden">
            {activeEditorTab === 'values' && (
              <textarea
                value={valuesContent}
                onChange={(e) => setValuesContent(e.target.value)}
                placeholder="Enter your values.yaml content here..."
                className="w-full h-full font-mono text-sm p-4 resize-none bg-slate-900 dark:bg-slate-950 text-slate-300 placeholder-slate-500 focus:outline-none"
                spellCheck="false"
              />
            )}
            {activeEditorTab === 'chart' && (
              <div className="h-full p-4 overflow-auto">
                {selectedChart?.chart ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                        <CircleStackIcon className="h-8 w-8 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedChart.chart.name}</h3>
                        <p className="text-sm text-gray-500">{selectedChart.chart.description}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                        <p className="text-xs text-gray-500 mb-1">Chart Version</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                          <TagIcon className="h-4 w-4 text-gray-400" />
                          {selectedChart.chart.version}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                        <p className="text-xs text-gray-500 mb-1">App Version</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                          <CubeIcon className="h-4 w-4 text-gray-400" />
                          {selectedChart.chart.appVersion}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                        <p className="text-xs text-gray-500 mb-1">Repository</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                          <FolderIcon className="h-4 w-4 text-gray-400" />
                          {selectedChart.chart.repo}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                        <p className="text-xs text-gray-500 mb-1">Maintainers</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Bitnami Team</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <p className="text-sm">Select a chart to view details</p>
                  </div>
                )}
              </div>
            )}
            {activeEditorTab === 'templates' && (
              <div className="h-full p-4 overflow-auto">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Templates</p>
                  {['deployment.yaml', 'service.yaml', 'ingress.yaml', 'configmap.yaml', 'secrets.yaml', 'hpa.yaml', 'pdb.yaml', 'serviceaccount.yaml'].map((template) => (
                    <div key={template} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-700/50 cursor-pointer">
                      <DocumentTextIcon className="h-4 w-4 text-blue-500" />
                      <span className="text-xs text-gray-700 dark:text-gray-300">{template}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeEditorTab === 'ai' && (
              <div className="h-full p-4 overflow-auto">
                <AIValuesAnalysis valuesContent={valuesContent} />
              </div>
            )}
          </div>

          {/* Editor Footer */}
          <div className="px-4 py-2 border-t border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between text-xs text-gray-500">
            <span>{selectedChart?.chart?.name || selectedRelease?.chart || 'values.yaml'}</span>
            <span>{valuesContent.split('\n').length} lines</span>
          </div>
        </GlassCard>

        {/* Right Panel - Settings & Actions (20%) */}
        <GlassCard className="col-span-1 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center gap-2">
            <Cog6ToothIcon className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Settings</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Release Name */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Release Name</label>
              <input
                type="text"
                value={releaseName}
                onChange={(e) => setReleaseName(e.target.value)}
                placeholder="my-release"
                className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300 placeholder-gray-400"
              />
            </div>

            {/* Namespace Selector */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Namespace</label>
              <select
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300"
              >
                {namespaces.map((ns) => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
              </select>
            </div>

            {/* Selected Release Info */}
            {selectedRelease && (
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Release Info</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Revision</span>
                  <span className="font-medium text-gray-900 dark:text-white">{selectedRelease.revision}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Status</span>
                  <ReleaseBadge status={selectedRelease.status} />
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <ClockIcon className="h-3 w-3" />
                  <span>{new Date(selectedRelease.updated).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {activeLeftTab === 'charts' ? (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleInstall(true)}
                    disabled={loading || !selectedChart}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-all"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Dry Run
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleInstall(false)}
                    disabled={loading || !selectedChart}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                    {loading ? 'Installing...' : 'Install'}
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUpgrade}
                    disabled={loading || !selectedRelease}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <CloudArrowUpIcon className="h-4 w-4" />
                    )}
                    {loading ? 'Upgrading...' : 'Upgrade'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRollback}
                    disabled={loading || !selectedRelease || selectedRelease.revision <= 1}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-all"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Rollback
                  </motion.button>
                </>
              )}
            </div>

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="pt-4 border-t border-gray-200/50 dark:border-slate-700/50"
                >
                  <div className={`p-3 rounded-xl border ${result.success ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className={`text-xs font-medium ${result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {result.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 ${result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {result.message}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI Analysis */}
            <div className="pt-4 border-t border-gray-200/50 dark:border-slate-700/50">
              <AIValuesAnalysis valuesContent={valuesContent} />
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Bottom Panel - Logs */}
      <motion.div variants={itemVariants}>
        <GlassCard className="overflow-hidden">
          <div className="p-3 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CodeBracketIcon className="h-4 w-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Helm Output</span>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Clear
            </button>
          </div>
          <div className="h-32 overflow-y-auto bg-slate-900 dark:bg-slate-950 p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-slate-500">No logs yet...</p>
            ) : (
              logs.map((log, idx) => (
                <p key={idx} className="text-slate-400">{log}</p>
              ))
            )}
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
