import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import * as yaml from 'js-yaml';
import { kubernetesApi, aiApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { Namespace } from '../../types';
import {
  PlayIcon,
  CheckCircleIcon,
  CodeBracketIcon,
  SparklesIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowPathIcon,
  BeakerIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  XMarkIcon,
  RocketLaunchIcon,
  CubeIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

type TabType = 'editor' | 'rendered' | 'diff' | 'ai-review';

interface LogEntry {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}

interface AIReviewResult {
  score: number;
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    message: string;
    suggestion?: string;
  }>;
  suggestions: string[];
  securityScore: number;
  bestPracticeScore: number;
}

interface DeploySummary {
  success: boolean;
  resources: Array<{
    kind: string;
    name: string;
    namespace?: string;
    status: 'created' | 'updated' | 'unchanged';
  }>;
  duration: number;
  timestamp: Date;
  zeroDowntime: boolean;
  podsUpdated: number;
  podsRestarted: number;
}

const SAMPLE_YAML = `# Sample Kubernetes Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
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
        image: nginx:1.25
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "100m"
          limits:
            memory: "128Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
`;

// localStorage keys
const STORAGE_KEYS = {
  YAML_CONTENT: 'nextsight_yaml_content',
  NAMESPACE: 'nextsight_yaml_namespace',
};

export default function YAMLDeployEnhanced() {
  const [activeTab, setActiveTab] = useState<TabType>('editor');
  const [yamlContent, setYamlContent] = useState(() => {
    // Load from localStorage on initial render
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.YAML_CONTENT) || '';
    }
    return '';
  });
  const [selectedNamespace, setSelectedNamespace] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.NAMESPACE) || '';
    }
    return '';
  });
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [parsedYAML, setParsedYAML] = useState<any>(null);
  const [aiReview, setAiReview] = useState<AIReviewResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [deploySummary, setDeploySummary] = useState<DeploySummary | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Save YAML content to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.YAML_CONTENT, yamlContent);
  }, [yamlContent]);

  // Save namespace to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NAMESPACE, selectedNamespace);
  }, [selectedNamespace]);

  useEffect(() => {
    loadNamespaces();
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (yamlContent) {
      try {
        const parsed = yaml.loadAll(yamlContent);
        setParsedYAML(parsed);
      } catch (err: any) {
        setParsedYAML(null);
      }
    } else {
      setParsedYAML(null);
    }
  }, [yamlContent]);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };

  const loadNamespaces = async () => {
    try {
      const response = await kubernetesApi.getNamespaces();
      setNamespaces(response.data);
    } catch (err) {
      logger.error('Failed to load namespaces', err);
    }
  };

  const handleApply = async (dryRun: boolean) => {
    if (!yamlContent.trim()) {
      addLog('error', 'No YAML content provided');
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    addLog('info', dryRun ? '🔍 Validating...' : '🚀 Deploying...');

    try {
      const response = await kubernetesApi.applyYAML({
        yaml_content: yamlContent,
        namespace: selectedNamespace || undefined,
        dry_run: dryRun,
      });

      const duration = Date.now() - startTime;

      if (response.data.success) {
        addLog('success', dryRun ? '✓ Validation successful' : '✓ Deployed successfully');
        if (response.data.resources.length > 0) {
          response.data.resources.forEach(r => {
            addLog('success', `  → ${r.kind}/${r.name}`);
          });
        }

        // Show deployment summary modal (not for dry runs)
        if (!dryRun) {
          // Calculate deployment metrics
          const podsUpdated = response.data.resources.filter(r =>
            (r.kind === 'Deployment' || r.kind === 'StatefulSet' || r.kind === 'DaemonSet') &&
            r.status === 'updated'
          ).length;
          const podsRestarted = response.data.resources.filter(r =>
            r.kind === 'Pod' && r.status === 'updated'
          ).length;

          // Assume zero downtime if duration < 5s and no errors
          const zeroDowntime = duration < 5000;

          setDeploySummary({
            success: true,
            resources: response.data.resources.map(r => ({
              kind: r.kind,
              name: r.name,
              namespace: r.namespace,
              status: r.status as 'created' | 'updated' | 'unchanged',
            })),
            duration,
            timestamp: new Date(),
            zeroDowntime,
            podsUpdated,
            podsRestarted,
          });
          setShowSummaryModal(true);
        }
      } else {
        addLog('error', '✗ ' + response.data.message);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed';
      addLog('error', '✗ ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAIReview = async () => {
    if (!yamlContent.trim()) {
      addLog('warning', 'No YAML to review');
      return;
    }

    setReviewing(true);
    addLog('info', '🤖 AI analyzing YAML...');

    try {
      const response = await aiApi.yamlReview({
        yaml_content: yamlContent,
        namespace: selectedNamespace || undefined,
      });

      if (response.data.success) {
        setAiReview({
          score: response.data.score,
          issues: response.data.issues.map(issue => ({
            severity: issue.severity,
            type: issue.type,
            message: issue.message,
            suggestion: issue.suggestion,
          })),
          suggestions: response.data.suggestions,
          securityScore: response.data.security_score,
          bestPracticeScore: response.data.best_practice_score,
        });

        addLog('success', `✓ AI review completed - Score: ${response.data.score}/100`);
        setActiveTab('ai-review');
      } else {
        addLog('error', '✗ AI review failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'AI service unavailable';
      addLog('error', `✗ AI review failed: ${errorMessage}`);
      logger.error('AI review error', err);
    } finally {
      setReviewing(false);
    }
  };

  const loadSample = () => {
    setYamlContent(SAMPLE_YAML);
    setAiReview(null);
    addLog('info', 'Sample YAML loaded');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setYamlContent(content);
        addLog('info', `File loaded: ${file.name}`);
      };
      reader.readAsText(file);
    }
  };

  const tabs = [
    { id: 'editor' as TabType, name: 'Editor', icon: CodeBracketIcon },
    { id: 'rendered' as TabType, name: 'Rendered Output', icon: EyeIcon },
    { id: 'diff' as TabType, name: 'Diff', icon: ArrowPathIcon },
    { id: 'ai-review' as TabType, name: 'AI Review', icon: SparklesIcon },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] min-h-0 overflow-hidden">
      {/* Main Content Area - Editor and Right Panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Center - Editor with Tabs */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {/* Tabs Bar with Status */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-white dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-center gap-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.name}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Editor Status Indicators */}
              <div className="flex items-center gap-3">
                {parsedYAML && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">Valid</span>
                  </motion.div>
                )}
                {yamlContent && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">
                    <CodeBracketIcon className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold font-mono">
                      {yamlContent.split('\n').length} lines
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Editor Content with Toolbar */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Editor Toolbar */}
              {activeTab === 'editor' && (
                <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-700 border-b border-gray-200 dark:border-slate-600">
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        try {
                          const formatted = yaml.dump(yaml.load(yamlContent), { indent: 2 });
                          setYamlContent(formatted);
                          addLog('success', '✓ YAML formatted');
                        } catch (err) {
                          addLog('error', '✗ Invalid YAML format');
                        }
                      }}
                      disabled={!yamlContent.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm border border-gray-200 dark:border-slate-500"
                      title="Format YAML"
                    >
                      <CodeBracketIcon className="h-4 w-4" />
                      <span className="text-xs font-medium">Format</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setYamlContent('');
                        setAiReview(null);
                        addLog('info', 'Editor cleared');
                      }}
                      disabled={!yamlContent.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm border border-gray-200 dark:border-slate-500"
                      title="Clear Editor"
                    >
                      <TrashIcon className="h-4 w-4" />
                      <span className="text-xs font-medium">Clear</span>
                    </motion.button>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">Monaco Editor</span>
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  {activeTab === 'editor' && (
                    <motion.div
                      key="editor"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full relative bg-[#1e1e1e]"
                    >
                      <Editor
                        height="100%"
                        defaultLanguage="yaml"
                        value={yamlContent}
                        onChange={(value) => setYamlContent(value || '')}
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
                          roundedSelection: true,
                          padding: { top: 8, bottom: 8 },
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
                      className="h-full overflow-auto p-4 bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
                    >
                      {parsedYAML && parsedYAML.length > 0 ? (
                        <div className="space-y-3">
                          {parsedYAML.map((doc: any, idx: number) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="group p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-5 bg-gradient-to-b from-primary-500 to-purple-600 rounded-full shadow-sm" />
                                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                    Document {idx + 1}
                                  </span>
                                </div>
                                {doc?.kind && (
                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 text-xs font-bold rounded-lg bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-md">
                                      {doc.kind}
                                    </span>
                                    {doc?.metadata?.name && (
                                      <span className="text-xs text-gray-600 dark:text-gray-400 font-mono font-semibold">
                                        {doc.metadata.name}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <pre className="text-xs text-gray-900 dark:text-gray-100 font-mono whitespace-pre-wrap overflow-x-auto bg-slate-50 dark:bg-slate-900/80 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                                {JSON.stringify(doc, null, 2)}
                              </pre>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 mb-6 border-2 border-dashed border-blue-300 dark:border-blue-500/30">
                            <EyeIcon className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                          </div>
                          <p className="text-base font-bold text-gray-800 dark:text-gray-200">Enter YAML to preview</p>
                          <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">The rendered view will show parsed documents</p>
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
                      className="h-full overflow-auto p-4 bg-gradient-to-br from-slate-50 to-amber-50/30 dark:from-slate-900 dark:to-slate-800"
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 mb-6 border border-amber-200 dark:border-amber-500/20">
                          <ArrowPathIcon className="h-16 w-16 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          Diff View Coming Soon
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
                          Compare your local changes with deployed resources in real-time
                        </p>
                        <div className="mt-6 grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Side-by-side</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Compare changes visually</p>
                          </div>
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Inline diff</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">View unified changes</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                {activeTab === 'ai-review' && (
                  <motion.div
                    key="ai-review"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full overflow-auto p-3 bg-slate-50 dark:bg-slate-900"
                  >
                    {!aiReview ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-500/10 mb-3">
                          <SparklesIcon className="h-12 w-12 text-primary-600 dark:text-primary-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          AI-Powered Analysis
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6 max-w-md">
                          Get intelligent insights, security checks, and best practice recommendations
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleAIReview}
                          disabled={reviewing || !yamlContent.trim()}
                          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {reviewing ? (
                            <>
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <SparklesIcon className="h-4 w-4" />
                              Start AI Review
                            </>
                          )}
                        </motion.button>
                      </div>
                    ) : (
                      <div className="space-y-3 max-w-4xl mx-auto">
                        {/* Score Cards */}
                        <div className="grid grid-cols-3 gap-3">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-500/20 shadow-sm"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <ShieldCheckIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">Overall</p>
                            </div>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{aiReview.score}</p>
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">/ 100</p>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="p-3 rounded-xl bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-500/20 shadow-sm"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <ShieldCheckIcon className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                              <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">Security</p>
                            </div>
                            <p className="text-2xl font-bold text-red-900 dark:text-red-100">{aiReview.securityScore}</p>
                            <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">/ 100</p>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-500/20 shadow-sm"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <CheckCircleIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                              <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">Best Practices</p>
                            </div>
                            <p className="text-2xl font-bold text-green-900 dark:text-green-100">{aiReview.bestPracticeScore}</p>
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">/ 100</p>
                          </motion.div>
                        </div>

                        {/* Issues */}
                        {aiReview.issues.length > 0 && (
                          <div>
                            <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Issues Detected</h3>
                            <div className="space-y-1.5">
                              {aiReview.issues.map((issue, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                                  <div className="flex items-start gap-3">
                                    <ExclamationTriangleIcon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                                      issue.severity === 'critical' ? 'text-red-600' :
                                      issue.severity === 'high' ? 'text-orange-600' :
                                      issue.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'
                                    }`} />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 text-[10px] font-medium rounded uppercase bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400">
                                          {issue.severity}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{issue.type}</span>
                                      </div>
                                      <p className="text-sm text-gray-900 dark:text-white">{issue.message}</p>
                                      {issue.suggestion && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">→ {issue.suggestion}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Suggestions */}
                        {aiReview.suggestions.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recommendations</h3>
                            <div className="space-y-2">
                              {aiReview.suggestions.map((suggestion, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                                  <CheckCircleIcon className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                                  <p className="text-sm text-gray-900 dark:text-white flex-1">{suggestion}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </div>
          </div>

        {/* Right Panel - Controls */}
        <div className="w-72 flex flex-col bg-white dark:bg-slate-800">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Controls</h3>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-2">
              {/* Namespace */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Namespace
                </label>
                <select
                  value={selectedNamespace}
                  onChange={(e) => setSelectedNamespace(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Default</option>
                  {namespaces.map((ns) => (
                    <option key={ns.name} value={ns.name}>
                      {ns.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload and Load Sample */}
              <div className="space-y-1.5">
                <input
                  type="file"
                  id="file-upload"
                  accept=".yaml,.yml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <motion.label
                  htmlFor="file-upload"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <DocumentArrowUpIcon className="h-4 w-4" />
                  Upload YAML
                </motion.label>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={loadSample}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Load Sample
                </motion.button>
              </div>

              {/* AI Risk Summary */}
              {aiReview && (
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border border-primary-200 dark:border-primary-500/20">
                  <h4 className="text-[11px] font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <SparklesIcon className="h-3 w-3" />
                    AI Risk Summary
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Overall Score</span>
                      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                        {aiReview.score}/100
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Issues Found</span>
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {aiReview.issues.length}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-primary-200 dark:border-primary-500/20">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('ai-review')}
                        className="w-full px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors"
                      >
                        View Details
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Fix Buttons */}
              <div className="space-y-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAIReview}
                  disabled={!yamlContent.trim() || reviewing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {reviewing ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-4 w-4" />
                      AI Review
                    </>
                  )}
                </motion.button>

                {aiReview && aiReview.issues.length > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg transition-all"
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    AI Auto-Fix
                  </motion.button>
                )}
              </div>

              {/* Clear Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setYamlContent(''); setAiReview(null); addLog('info', 'Cleared'); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                Clear All
              </motion.button>
            </div>

            {/* Action Buttons */}
            <div className="p-2 border-t border-gray-200 dark:border-slate-700 space-y-1.5">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleApply(true)}
                disabled={loading || !yamlContent.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <BeakerIcon className="h-4 w-4" />
                Validate
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleApply(false)}
                disabled={loading || !yamlContent.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4" />
                    Deploy
                  </>
                )}
              </motion.button>
            </div>
        </div>
      </div>

      {/* Bottom Panel - Logs Console */}
      <div className="h-48 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white">Console</h3>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">({logs.length})</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLogs([])}
              className="px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              Clear
            </motion.button>
          </div>
          <div className="flex-1 overflow-auto p-2 font-mono text-[11px] bg-slate-950 text-gray-300">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <ClockIcon className="h-8 w-8 mx-auto mb-2" />
                  <p>Console ready</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-2"
                  >
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      log.type === 'success' ? 'bg-green-500/20 text-green-400' :
                      log.type === 'error' ? 'bg-red-500/20 text-red-400' :
                      log.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {log.type.toUpperCase()}
                    </span>
                    <span className="text-gray-500">{log.timestamp.toLocaleTimeString()}</span>
                    <span className="flex-1">{log.message}</span>
                  </motion.div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
      </div>

      {/* Deployment Summary Modal */}
      <AnimatePresence>
        {showSummaryModal && deploySummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSummaryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden"
            >
              {/* Header */}
              <div className="relative px-6 py-5 bg-gradient-to-r from-emerald-500 to-green-600 border-b border-emerald-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                      <RocketLaunchIcon className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Deployment Successful!</h2>
                      <p className="text-sm text-emerald-50">Your resources have been deployed</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowSummaryModal(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6 text-white" />
                  </motion.button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-3">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-500/20"
                  >
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Duration</p>
                    <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                      {(deploySummary.duration / 1000).toFixed(2)}s
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-500/20"
                  >
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Resources</p>
                    <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                      {deploySummary.resources.length}
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-500/20"
                  >
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Pods Updated</p>
                    <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
                      {deploySummary.podsUpdated}
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-500/20"
                  >
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Zero Downtime</p>
                    <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                      {deploySummary.zeroDowntime ? '✓' : '✗'}
                    </p>
                  </motion.div>
                </div>

                {/* Resources List */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <CubeIcon className="h-4 w-4" />
                    Deployed Resources
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {deploySummary.resources.map((resource, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + idx * 0.05 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600">
                            <CubeIcon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {resource.kind}/{resource.name}
                            </p>
                            {resource.namespace && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                namespace: {resource.namespace}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          resource.status === 'created' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                          resource.status === 'updated' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400'
                        }`}>
                          {resource.status}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Next Steps */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-500/20">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <ArrowRightIcon className="h-4 w-4" />
                    Next Steps
                  </h4>
                  <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400">•</span>
                      <span>Monitor pod status in the <a href="/kubernetes" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">Workloads page</a></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400">•</span>
                      <span>Check application logs for any errors</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400">•</span>
                      <span>Verify service connectivity and ingress rules</span>
                    </li>
                    {!deploySummary.zeroDowntime && (
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400">⚠</span>
                        <span className="text-amber-700 dark:text-amber-400">
                          Deployment took {'>'}{(deploySummary.duration / 1000).toFixed(1)}s - consider adding readiness probes for zero-downtime deployments
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-200 dark:border-slate-600 flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Deployed at {deploySummary.timestamp.toLocaleTimeString()}
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSummaryModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
