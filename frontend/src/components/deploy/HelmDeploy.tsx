import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import * as yaml from 'js-yaml';
import type {
  HelmChartSearchResult,
} from '../../types';
import {
  CubeIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
  ArrowUpTrayIcon,
  ArrowUturnLeftIcon,
  DocumentTextIcon,
  EyeIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CodeBracketIcon,
  SparklesIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';

type TabType = 'values' | 'rendered' | 'diff' | 'history';
type ChartSourceType = 'repository' | 'uploaded' | 'private';

interface ChartMetadata {
  name: string;
  version: string;
  appVersion: string;
  description: string;
  maintainers: string;
}

interface ReleaseHistoryItem {
  version: string;
  status: 'Success' | 'Failed' | 'Pending';
  time: string;
}

export default function HelmDeploy() {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('values');
  const [chartSource, setChartSource] = useState<ChartSourceType>('repository');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartSearchResults, setChartSearchResults] = useState<HelmChartSearchResult[]>([]);
  const [selectedChart, setSelectedChart] = useState<HelmChartSearchResult | null>(null);
  const [valuesYaml, setValuesYaml] = useState(`# Default values for the chart
replicaCount: 2

image:
  repository: nginx
  tag: stable
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

resources:
  limits:
    cpu: 100m
    memory: 128Mi
  requests:
    cpu: 100m
    memory: 128Mi
`);
  const [renderedOutput, setRenderedOutput] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchingCharts, setSearchingCharts] = useState(false);

  // Mock data for demonstration
  const mockCharts: HelmChartSearchResult[] = [
    {
      name: 'nginx',
      version: '15.0.2',
      app_version: '1.25.1',
      repository: 'bitnami',
      description: 'Fast, reliable NGINX chart for web serving and reverse proxy',
    },
    {
      name: 'postgresql',
      version: '12.2.3',
      app_version: '15.2.0',
      repository: 'bitnami',
      description: 'PostgreSQL database chart with replication support',
    },
    {
      name: 'kube-prometheus-stack',
      version: '56.2.3',
      app_version: '0.72.0',
      repository: 'prometheus-community',
      description: 'Complete monitoring stack with Prometheus, Grafana, and Alert Manager',
    },
    {
      name: 'redis',
      version: '17.9.4',
      app_version: '7.0.11',
      repository: 'bitnami',
      description: 'Redis in-memory data structure store',
    },
    {
      name: 'mysql',
      version: '9.7.1',
      app_version: '8.0.32',
      repository: 'bitnami',
      description: 'MySQL relational database management system',
    },
  ];

  const mockMetadata: ChartMetadata = {
    name: 'nginx',
    version: '15.0.2',
    appVersion: '1.23.1',
    description: 'NGINX Open Source is a web server that can be also used as a reverse proxy, load balancer, and HTTP cache',
    maintainers: 'Bitnami',
  };

  const mockReleaseHistory: ReleaseHistoryItem[] = [
    { version: 'v1.0.3', status: 'Success', time: '5h ago' },
    { version: 'v1.0.2', status: 'Failed', time: '1d ago' },
    { version: 'v1.0.1', status: 'Success', time: '3d ago' },
  ];

  useEffect(() => {
    setChartSearchResults(mockCharts);
  }, []);

  useEffect(() => {
    // Parse YAML when it changes
    try {
      const parsed = yaml.loadAll(valuesYaml);
      setRenderedOutput(parsed);
    } catch (error) {
      setRenderedOutput([]);
    }
  }, [valuesYaml]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setChartSearchResults(mockCharts);
      return;
    }

    setSearchingCharts(true);
    // Simulate search
    setTimeout(() => {
      const filtered = mockCharts.filter(chart =>
        chart.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chart.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setChartSearchResults(filtered);
      setSearchingCharts(false);
    }, 500);
  };

  const handleInstall = async () => {
    if (!selectedChart) return;
    setLoading(true);
    // Simulate installation
    setTimeout(() => {
      setLoading(false);
      alert(`Installing ${selectedChart.name} v${selectedChart.version}`);
    }, 1500);
  };

  const handleUpgrade = async () => {
    if (!selectedChart) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert(`Upgrading ${selectedChart.name}`);
    }, 1500);
  };

  const handleRollback = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert('Rolling back to previous version');
    }, 1500);
  };

  const tabs = [
    { id: 'values' as TabType, name: 'Values.yaml', icon: DocumentTextIcon },
    { id: 'rendered' as TabType, name: 'Rendered Templates', icon: EyeIcon },
    { id: 'diff' as TabType, name: 'Diff', icon: CodeBracketIcon },
    { id: 'history' as TabType, name: 'History', icon: ClockIcon },
  ];

  const chartSourceTabs = [
    { id: 'repository' as ChartSourceType, name: 'Repository' },
    { id: 'uploaded' as ChartSourceType, name: 'Uploaded' },
    { id: 'private' as ChartSourceType, name: 'Private' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header Section */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-white dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
            <CubeIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Helm Deploy</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Manage and deploy Helm charts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleInstall}
            disabled={!selectedChart || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <RocketLaunchIcon className="h-4 w-4" />
            Install
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleUpgrade}
            disabled={!selectedChart || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            Upgrade
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRollback}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ArrowUturnLeftIcon className="h-4 w-4" />
            Rollback
          </motion.button>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
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
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </motion.button>
          );
        })}
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Chart List */}
        <div className="w-80 flex flex-col border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {/* Search Bar */}
          <div className="p-3 border-b border-gray-200 dark:border-slate-700">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search charts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
          </div>

          {/* Chart Source Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
            {chartSourceTabs.map((tab) => {
              const isActive = chartSource === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setChartSource(tab.id)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>

          {/* Charts List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {searchingCharts ? (
              <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-6 w-6 animate-spin text-primary-500" />
              </div>
            ) : chartSearchResults.length === 0 ? (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No charts found</p>
              </div>
            ) : (
              chartSearchResults.map((chart, index) => (
                <motion.div
                  key={`${chart.repository}-${chart.name}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedChart(chart)}
                  className={`p-3 rounded-lg cursor-pointer transition-all border ${
                    selectedChart?.name === chart.name
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700 shadow-sm'
                      : 'bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-gradient-to-br from-blue-500 to-purple-600">
                          <CubeIcon className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {chart.repository}/{chart.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                        v{chart.version}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {chart.description}
                  </p>
                </motion.div>
              ))
            )}
          </div>

          {/* Upload Chart Button */}
          <div className="p-3 border-t border-gray-200 dark:border-slate-700">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
            >
              <CloudArrowUpIcon className="h-4 w-4" />
              Upload Chart (.tgz)
            </motion.button>
          </div>
        </div>

        {/* Center Column - Values Editor */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          <AnimatePresence mode="wait">
            {activeTab === 'values' && (
              <motion.div
                key="values"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <Editor
                  height="100%"
                  defaultLanguage="yaml"
                  value={valuesYaml}
                  onChange={(value) => setValuesYaml(value || '')}
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
                className="h-full overflow-auto p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
              >
                {renderedOutput.length > 0 ? (
                  <div className="space-y-4">
                    {renderedOutput.map((doc: any, idx: number) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="p-4 rounded-xl bg-slate-800/50 border border-slate-700"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-gray-200">Document {idx + 1}</span>
                          <span className="px-3 py-1 text-xs font-bold rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                            Rendered
                          </span>
                        </div>
                        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto bg-slate-900/80 p-3 rounded-lg border border-slate-700">
                          {JSON.stringify(doc, null, 2)}
                        </pre>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <EyeIcon className="h-16 w-16 text-slate-600 mb-4" />
                    <p className="text-base font-bold text-gray-300">No rendered output</p>
                    <p className="text-sm text-gray-500 mt-2">Enter valid YAML in Values.yaml tab</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'diff' && (
              <motion.div
                key="diff"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-8"
              >
                <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 mb-6 border border-amber-500/20">
                  <CodeBracketIcon className="h-16 w-16 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Diff View</h3>
                <p className="text-sm text-gray-400 text-center max-w-md">
                  Compare your local values with deployed chart values
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700">
                    <p className="text-xs font-medium text-gray-300">Side-by-side comparison</p>
                  </div>
                  <div className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700">
                    <p className="text-xs font-medium text-gray-300">Line-by-line diff</p>
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
                className="h-full overflow-auto p-4 bg-gradient-to-br from-slate-900 to-slate-800"
              >
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <ClockIcon className="h-5 w-5 text-gray-400" />
                    <h3 className="text-base font-semibold text-white">Deployment History</h3>
                  </div>
                  {mockReleaseHistory.map((release, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {release.status === 'Success' && (
                          <CheckCircleIcon className="h-5 w-5 text-green-400" />
                        )}
                        {release.status === 'Failed' && (
                          <XCircleIcon className="h-5 w-5 text-red-400" />
                        )}
                        {release.status === 'Pending' && (
                          <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-200">{release.version}</p>
                          <p className="text-xs text-gray-500">{release.time}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-lg ${
                        release.status === 'Success'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : release.status === 'Failed'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {release.status}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column - Metadata Panel */}
        <div className="w-72 flex flex-col border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Chart Metadata</h3>
          </div>

          {/* Chart Info */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedChart ? (
              <>
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/10 dark:to-purple-900/10 border border-primary-200 dark:border-primary-800/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
                      <CubeIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">{mockMetadata.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">v{mockMetadata.version}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">App Version:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{mockMetadata.appVersion}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Maintainers:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{mockMetadata.maintainers}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {mockMetadata.description}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Release History
                  </h4>
                  <div className="space-y-2">
                    {mockReleaseHistory.map((release, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-2">
                          {release.status === 'Success' && (
                            <CheckCircleIcon className="h-3.5 w-3.5 text-green-500" />
                          )}
                          {release.status === 'Failed' && (
                            <XCircleIcon className="h-3.5 w-3.5 text-red-500" />
                          )}
                          {release.status === 'Pending' && (
                            <ArrowPathIcon className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                          )}
                          <span className="text-xs font-medium text-gray-900 dark:text-white">
                            {release.version}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {release.time}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30">
                  <div className="flex items-start gap-2">
                    <SparklesIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
                        AI Recommendations
                      </p>
                      <p className="text-[10px] text-blue-700 dark:text-blue-300">
                        Optimize resource limits for production workload
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="p-4 rounded-xl bg-gray-100 dark:bg-slate-900/50 mb-3">
                  <CubeIcon className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Select a chart to view metadata
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
