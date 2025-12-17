import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface TestCase {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration?: number;
  errorMessage?: string;
  file?: string;
}

interface TestResult {
  id: string;
  runId: string;
  stageId?: string;
  framework: string;
  testFilePattern?: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  errorTests: number;
  durationSeconds?: number;
  passRate: number;
  testDetails?: TestCase[];
  failedTestNames?: string[];
  reportUrl?: string;
  junitXmlUrl?: string;
}

interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  passRate: number;
  framework: string;
}

interface TestResultsPanelProps {
  testResults?: TestResult[];
  testSummary?: TestSummary | null;
  isLoading?: boolean;
}

export default function TestResultsPanel({ testResults, testSummary, isLoading }: TestResultsPanelProps) {
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [showFailedOnly, setShowFailedOnly] = useState(false);

  const toggleTest = (testId: string) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(testId)) {
      newExpanded.delete(testId);
    } else {
      newExpanded.add(testId);
    }
    setExpandedTests(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircleIcon className="h-5 w-5 text-emerald-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'skipped':
        return <MinusCircleIcon className="h-5 w-5 text-gray-400" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPassRateColor = (rate: number) => {
    if (rate >= 90) return 'text-emerald-500';
    if (rate >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  const getPassRateBg = (rate: number) => {
    if (rate >= 90) return 'bg-emerald-500';
    if (rate >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-500 dark:text-gray-400">Loading test results...</p>
        </div>
      </div>
    );
  }

  // Use testSummary if testResults not available
  const summary = testResults?.[0] || testSummary;

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <BeakerIcon className="h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No test results available</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Tests will appear here after the pipeline runs
        </p>
      </div>
    );
  }

  const passRate = summary.passRate || 0;
  const totalTests = summary.totalTests || 0;
  const passedTests = summary.passedTests || 0;
  const failedTests = summary.failedTests || 0;
  const skippedTests = summary.skippedTests || 0;
  const errorTests = 'errorTests' in summary ? summary.errorTests : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Pass Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-2 md:col-span-1 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-white/20 dark:border-slate-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pass Rate</span>
            <BeakerIcon className="h-4 w-4 text-gray-400" />
          </div>
          <div className={`text-2xl font-bold ${getPassRateColor(passRate)}`}>
            {passRate.toFixed(1)}%
          </div>
          <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getPassRateBg(passRate)} transition-all duration-500`}
              style={{ width: `${passRate}%` }}
            />
          </div>
        </motion.div>

        {/* Total Tests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-white/20 dark:border-slate-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</span>
            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalTests}</div>
        </motion.div>

        {/* Passed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-white/20 dark:border-slate-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Passed</span>
            <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-500">{passedTests}</div>
        </motion.div>

        {/* Failed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-white/20 dark:border-slate-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Failed</span>
            <XCircleIcon className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-500">{failedTests}</div>
        </motion.div>

        {/* Skipped */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-white/20 dark:border-slate-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Skipped</span>
            <MinusCircleIcon className="h-4 w-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-500 dark:text-gray-400">{skippedTests + errorTests}</div>
        </motion.div>
      </div>

      {/* Test Results Header */}
      {testResults?.[0]?.testDetails && testResults[0].testDetails.length > 0 && (
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Test Details</h3>
              {summary.framework && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs rounded-full font-medium">
                  {summary.framework}
                </span>
              )}
              {'durationSeconds' in summary && summary.durationSeconds && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {formatDuration(summary.durationSeconds)}
                </span>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showFailedOnly}
                onChange={(e) => setShowFailedOnly(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-red-500 focus:ring-red-500 focus:ring-offset-0"
              />
              Show failed only
            </label>
          </div>

          {/* Test List */}
          <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50 max-h-96 overflow-y-auto">
            {testResults[0].testDetails
              .filter((test) => !showFailedOnly || test.status === 'failed' || test.status === 'error')
              .map((test, index) => (
                <motion.div
                  key={`${test.name}-${index}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30"
                >
                  <div
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                    onClick={() => test.errorMessage && toggleTest(`${test.name}-${index}`)}
                  >
                    {getStatusIcon(test.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {test.name}
                      </p>
                      {test.file && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {test.file}
                        </p>
                      )}
                    </div>
                    {test.duration !== undefined && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDuration(test.duration / 1000)}
                      </span>
                    )}
                    {test.errorMessage && (
                      <span className="text-gray-400">
                        {expandedTests.has(`${test.name}-${index}`) ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </div>
                  <AnimatePresence>
                    {test.errorMessage && expandedTests.has(`${test.name}-${index}`) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 pl-12">
                          <pre className="text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 text-red-700 dark:text-red-400 overflow-x-auto whitespace-pre-wrap">
                            {test.errorMessage}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
          </div>

          {/* Report Links */}
          {(testResults[0].reportUrl || testResults[0].junitXmlUrl) && (
            <div className="px-4 py-3 border-t border-gray-200/50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">Reports:</span>
                {testResults[0].reportUrl && (
                  <a
                    href={testResults[0].reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    HTML Report
                  </a>
                )}
                {testResults[0].junitXmlUrl && (
                  <a
                    href={testResults[0].junitXmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    JUnit XML
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Failed Tests Summary */}
      {testResults?.[0]?.failedTestNames && testResults[0].failedTestNames.length > 0 && !testResults[0].testDetails?.length && (
        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl border border-red-200/50 dark:border-red-500/30 overflow-hidden">
          <div className="px-4 py-3 bg-red-50/50 dark:bg-red-500/10 border-b border-red-200/50 dark:border-red-500/30">
            <h3 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
              <XCircleIcon className="h-5 w-5" />
              Failed Tests ({testResults[0].failedTestNames.length})
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {testResults[0].failedTestNames.map((name, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <XCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
                <span className="font-mono truncate">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
