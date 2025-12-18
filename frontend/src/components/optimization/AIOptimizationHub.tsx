import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  SparklesIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  BoltIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../common/PageHeader';
import { optimizationApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { AIOptimizationAnalysisResponse, OptimizationDashboardResponse } from '../../types';

type FocusArea = 'efficiency' | 'performance' | 'reliability';

const focusTabs = [
  { id: 'efficiency' as FocusArea, label: 'Resource Efficiency', icon: ChartBarIcon, description: 'Right-size workloads' },
  { id: 'performance' as FocusArea, label: 'Performance Risk', icon: ExclamationTriangleIcon, description: 'Prevent throttling & OOM' },
  { id: 'reliability' as FocusArea, label: 'Reliability Risk', icon: ShieldCheckIcon, description: 'Improve stability' },
];

const priorityColors: Record<string, string> = {
  high: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  medium: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
};

export default function AIOptimizationHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFocus = (searchParams.get('focus') as FocusArea) || 'efficiency';

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIOptimizationAnalysisResponse | null>(null);
  const [dashboardData, setDashboardData] = useState<OptimizationDashboardResponse | null>(null);
  const [appliedActions, setAppliedActions] = useState<Set<number>>(new Set());

  // Load dashboard data and AI analysis on mount
  useEffect(() => {
    loadData();
  }, []);

  // Re-analyze when focus area changes
  useEffect(() => {
    if (dashboardData) {
      analyzeWithAI(activeFocus);
    }
  }, [activeFocus]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // First get the optimization dashboard data
      const dashRes = await optimizationApi.getDashboard();
      setDashboardData(dashRes.data);

      // Then get AI analysis
      await analyzeWithAI(activeFocus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load optimization data');
    } finally {
      setLoading(false);
    }
  };

  const analyzeWithAI = async (focus: FocusArea) => {
    setAnalyzing(true);
    try {
      // Show progress message after 5 seconds
      const timeoutId = setTimeout(() => {
        logger.info('AI analysis taking longer than expected - may take 30-60 seconds');
      }, 5000);

      const res = await optimizationApi.getAIAnalysis({
        focus_area: focus,
      });

      clearTimeout(timeoutId);

      if (res.data.success) {
        setAiAnalysis(res.data);
        setAppliedActions(new Set()); // Reset applied actions on new analysis
        logger.info('AI analysis completed successfully');
      } else {
        logger.warn('AI analysis returned unsuccessful response');
        setError('AI analysis failed - using cached or fallback data');
      }
    } catch (err) {
      logger.error('AI analysis error', err);
      // Show user-friendly error message but keep dashboard visible
      if ((err as any)?.code === 'ECONNABORTED' || (err as any)?.message?.includes('timeout')) {
        logger.warn('AI analysis timed out - this is normal for first-time analysis. Results will be cached for future use.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFocusChange = (focus: FocusArea) => {
    setSearchParams({ focus });
  };

  const handleApplyAction = (index: number) => {
    // Mark action as applied (in real implementation, this would call backend)
    setAppliedActions(prev => new Set([...prev, index]));
  };

  const handleRefresh = () => {
    loadData();
  };

  // Calculate stats
  const stats = {
    totalFindings: aiAnalysis?.key_findings?.length || 0,
    pendingActions: (aiAnalysis?.priority_actions?.length || 0) - appliedActions.size,
    appliedActions: appliedActions.size,
    efficiencyImprovement: aiAnalysis?.efficiency_improvement_percent || 0,
    estimatedImpact: aiAnalysis?.estimated_monthly_impact || 0,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Optimization Hub"
          description="AI-powered recommendations to optimize your Kubernetes cluster"
          icon={SparklesIcon}
          iconColor="purple"
          badge={{ text: 'AI', color: 'purple' }}
        />
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Loading optimization data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Optimization Hub"
          description="AI-powered recommendations to optimize your Kubernetes cluster"
          icon={SparklesIcon}
          iconColor="purple"
          badge={{ text: 'AI', color: 'purple' }}
        />
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-6 rounded-xl text-center">
          <ExclamationCircleIcon className="h-12 w-12 mx-auto mb-3" />
          <p className="font-medium mb-2">Failed to load optimization data</p>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Optimization Hub"
        description="AI-powered recommendations to optimize your Kubernetes cluster"
        icon={SparklesIcon}
        iconColor="purple"
        badge={{ text: 'AI', color: 'purple' }}
        actions={
          <button
            onClick={handleRefresh}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Key Findings', value: stats.totalFindings, icon: LightBulbIcon, color: 'purple' },
          { label: 'Pending Actions', value: stats.pendingActions, icon: ExclamationTriangleIcon, color: 'amber' },
          { label: 'Applied', value: stats.appliedActions, icon: CheckCircleIcon, color: 'green' },
          { label: 'Efficiency Opportunity', value: `${stats.efficiencyImprovement.toFixed(1)}%`, subtext: `~$${stats.estimatedImpact.toLocaleString()}/mo`, icon: ChartBarIcon, color: 'blue' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30`}>
                <stat.icon className={`h-5 w-5 text-${stat.color}-500`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                {'subtext' in stat && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">{stat.subtext}</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Focus Area Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {focusTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleFocusChange(tab.id)}
            disabled={analyzing}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeFocus === tab.id
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700/50'
            } disabled:opacity-50`}
          >
            <tab.icon className="h-5 w-5" />
            <div className="text-left">
              <div>{tab.label}</div>
              <div className={`text-xs ${activeFocus === tab.id ? 'text-purple-200' : 'text-gray-400'}`}>
                {tab.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* AI Analysis Content */}
      {analyzing ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-8 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 text-center"
        >
          <div className="p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30 w-fit mx-auto mb-4">
            <SparklesIcon className="h-8 w-8 text-purple-500 animate-pulse" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            AI is analyzing your cluster...
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Examining resource usage patterns and generating {activeFocus} recommendations
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400">
            ⏱️ First analysis takes 30-60s • Future analyses are instant (10-min cache)
          </p>
        </motion.div>
      ) : aiAnalysis ? (
        <div className="space-y-6">
          {/* Trust Disclaimer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30"
          >
            <p className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
              <span>
                Recommendations based on recent usage patterns. Always validate in staging before production.
                Cost estimates are approximate and not billing-accurate.
              </span>
            </p>
          </motion.div>

          {/* AI Analysis Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200/50 dark:border-purple-700/50"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/50">
                <SparklesIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  AI Analysis Summary
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3 mt-4" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 mt-4" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-3" {...props} />,
                      h4: ({ node, ...props }) => <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-2" {...props} />,
                      p: ({ node, ...props }) => <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-gray-700 dark:text-gray-300" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-gray-700 dark:text-gray-300" {...props} />,
                      li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900 dark:text-white" {...props} />,
                      em: ({ node, ...props }) => <em className="italic text-gray-800 dark:text-gray-200" {...props} />,
                      code: ({ node, inline, ...props }: any) =>
                        inline ? (
                          <code className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-purple-600 dark:text-purple-400 text-xs font-mono" {...props} />
                        ) : (
                          <code className="block p-3 rounded-lg bg-gray-900 dark:bg-gray-800 text-gray-100 text-xs font-mono overflow-x-auto mb-3" {...props} />
                        ),
                      pre: ({ node, ...props }) => <pre className="mb-3" {...props} />,
                      blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-600 dark:text-gray-400 mb-3" {...props} />,
                    }}
                  >
                    {aiAnalysis.analysis}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Key Findings */}
          {aiAnalysis.key_findings && aiAnalysis.key_findings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
            >
              <div className="flex items-center gap-3 mb-4">
                <ChartBarIcon className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Key Findings
                </h3>
              </div>
              <div className="space-y-3">
                {aiAnalysis.key_findings.map((finding, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50"
                  >
                    <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5">
                      <LightBulbIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{finding}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Priority Actions */}
          {aiAnalysis.priority_actions && aiAnalysis.priority_actions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
            >
              <div className="flex items-center gap-3 mb-4">
                <BoltIcon className="h-5 w-5 text-amber-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Priority Actions
                </h3>
              </div>
              <div className="space-y-3">
                {aiAnalysis.priority_actions.map((action, index) => {
                  const isApplied = appliedActions.has(index);
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-all ${
                        isApplied
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50'
                          : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600/50'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          priorityColors[action.priority.toLowerCase()] || priorityColors.medium
                        }`}>
                          {action.priority}
                        </span>
                        <p className={`text-sm flex-1 ${
                          isApplied
                            ? 'text-green-700 dark:text-green-400 line-through'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {action.action}
                        </p>
                      </div>
                      {!isApplied ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleApplyAction(index)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium shadow-lg shadow-green-500/25 whitespace-nowrap"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Mark Done
                        </motion.button>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 text-green-600 dark:text-green-400 text-sm font-medium">
                          <CheckCircleIcon className="h-4 w-4" />
                          Completed
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Efficiency Impact */}
          {aiAnalysis.estimated_monthly_impact > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-700/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/50">
                    <ArrowTrendingUpIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                      Resource Efficiency Impact
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      Potential waste reduction from right-sizing
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    ~${aiAnalysis.estimated_monthly_impact.toLocaleString()}
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-400">per month (est., non-billing)</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-8 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 text-center"
        >
          <div className="p-4 rounded-2xl bg-gray-100 dark:bg-slate-700 w-fit mx-auto mb-4">
            <SparklesIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No AI Analysis Available
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Click "Refresh Analysis" to generate AI-powered optimization recommendations
          </p>
          <button
            onClick={() => analyzeWithAI(activeFocus)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Generate Analysis
          </button>
        </motion.div>
      )}
    </div>
  );
}
