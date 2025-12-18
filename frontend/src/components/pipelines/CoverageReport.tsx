import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  FolderIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface FileCoverage {
  file: string;
  lineCoverage: number;
  branchCoverage?: number;
  uncoveredLines?: number[];
}

interface CoverageData {
  id: string;
  runId: string;
  stageId?: string;
  coverageTool: string;
  lineCoverage?: number;
  branchCoverage?: number;
  statementCoverage?: number;
  functionCoverage?: number;
  totalLines?: number;
  coveredLines?: number;
  missingLines?: number;
  totalBranches?: number;
  coveredBranches?: number;
  fileCoverage?: Record<string, FileCoverage>;
  lowestCoverageFiles?: FileCoverage[];
  reportUrl?: string;
  lcovUrl?: string;
  coverageChange?: number;
}

interface CoverageSummary {
  lineCoverage?: number;
  branchCoverage?: number;
  coverageChange?: number;
  coverageTool?: string;
}

interface CoverageReportProps {
  coverageData?: CoverageData[];
  coverageSummary?: CoverageSummary | null;
  isLoading?: boolean;
}

export default function CoverageReport({ coverageData, coverageSummary, isLoading }: CoverageReportProps) {
  const getCoverageColor = (coverage?: number) => {
    if (coverage === undefined || coverage === null) return 'text-gray-400';
    if (coverage >= 80) return 'text-emerald-500';
    if (coverage >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getCoverageBg = (coverage?: number) => {
    if (coverage === undefined || coverage === null) return 'bg-gray-300 dark:bg-gray-600';
    if (coverage >= 80) return 'bg-emerald-500';
    if (coverage >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getCoverageRingColor = (coverage?: number) => {
    if (coverage === undefined || coverage === null) return 'stroke-gray-300 dark:stroke-gray-600';
    if (coverage >= 80) return 'stroke-emerald-500';
    if (coverage >= 60) return 'stroke-amber-500';
    return 'stroke-red-500';
  };

  const getChangeIcon = (change?: number) => {
    if (!change || change === 0) return <MinusIcon className="h-4 w-4 text-gray-400" />;
    if (change > 0) return <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-500" />;
    return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
  };

  const getChangeColor = (change?: number) => {
    if (!change || change === 0) return 'text-gray-500';
    if (change > 0) return 'text-emerald-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-500 dark:text-gray-400">Loading coverage data...</p>
        </div>
      </div>
    );
  }

  // Use coverageData or fallback to coverageSummary
  const coverage = coverageData?.[0] || coverageSummary;

  if (!coverage) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ChartBarIcon className="h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No coverage data available</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Coverage data will appear here after tests run
        </p>
      </div>
    );
  }

  const lineCoverage = coverage.lineCoverage;
  const branchCoverage = coverage.branchCoverage;
  const coverageChange = coverage.coverageChange;

  // Calculate circumference for circular progress
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const lineOffset = lineCoverage !== undefined ? circumference - (lineCoverage / 100) * circumference : circumference;
  const branchOffset = branchCoverage !== undefined ? circumference - (branchCoverage / 100) * circumference : circumference;

  return (
    <div className="space-y-6">
      {/* Main Coverage Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Line Coverage Circle */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-6 border border-white/20 dark:border-slate-700/50 flex flex-col items-center"
        >
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            Line Coverage
          </span>
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="fill-none stroke-gray-200 dark:stroke-gray-700"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                className={`fill-none ${getCoverageRingColor(lineCoverage)} transition-all duration-1000`}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={lineOffset}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${getCoverageColor(lineCoverage)}`}>
                {lineCoverage !== undefined ? `${lineCoverage.toFixed(1)}%` : '-'}
              </span>
            </div>
          </div>
          {coverageChange !== undefined && coverageChange !== null && (
            <div className={`flex items-center gap-1 mt-3 text-sm ${getChangeColor(coverageChange)}`}>
              {getChangeIcon(coverageChange)}
              <span>{coverageChange > 0 ? '+' : ''}{coverageChange.toFixed(1)}%</span>
            </div>
          )}
        </motion.div>

        {/* Branch Coverage Circle */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-6 border border-white/20 dark:border-slate-700/50 flex flex-col items-center"
        >
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
            Branch Coverage
          </span>
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="fill-none stroke-gray-200 dark:stroke-gray-700"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                className={`fill-none ${getCoverageRingColor(branchCoverage)} transition-all duration-1000`}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={branchOffset}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xl font-bold ${getCoverageColor(branchCoverage)}`}>
                {branchCoverage !== undefined ? `${branchCoverage.toFixed(1)}%` : '-'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Lines Stats */}
        {'totalLines' in coverage && coverage.totalLines !== undefined && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-6 border border-white/20 dark:border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Lines
              </span>
              <CodeBracketIcon className="h-4 w-4 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {coverage.totalLines?.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Covered</span>
                <span className="font-semibold text-emerald-500">
                  {coverage.coveredLines?.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Missing</span>
                <span className="font-semibold text-red-500">
                  {coverage.missingLines?.toLocaleString()}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Coverage Tool Info */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-6 border border-white/20 dark:border-slate-700/50"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Tool
            </span>
            <ChartBarIcon className="h-4 w-4 text-gray-400" />
          </div>
          <div className="space-y-3">
            <div className="px-3 py-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400 capitalize">
                {coverage.coverageTool || 'Unknown'}
              </span>
            </div>
            {'statementCoverage' in coverage && coverage.statementCoverage !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Statements</span>
                <span className={`font-semibold ${getCoverageColor(coverage.statementCoverage)}`}>
                  {coverage.statementCoverage?.toFixed(1)}%
                </span>
              </div>
            )}
            {'functionCoverage' in coverage && coverage.functionCoverage !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Functions</span>
                <span className={`font-semibold ${getCoverageColor(coverage.functionCoverage)}`}>
                  {coverage.functionCoverage?.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Low Coverage Files */}
      {coverageData?.[0]?.lowestCoverageFiles && coverageData[0].lowestCoverageFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl border border-amber-200/50 dark:border-amber-500/30 overflow-hidden"
        >
          <div className="px-4 py-3 bg-amber-50/50 dark:bg-amber-500/10 border-b border-amber-200/50 dark:border-amber-500/30 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-amber-700 dark:text-amber-400">
              Files Needing Attention
            </h3>
            <span className="text-xs text-amber-600 dark:text-amber-500">
              (Lowest coverage)
            </span>
          </div>
          <div className="divide-y divide-gray-200/50 dark:divide-slate-700/50">
            {coverageData[0].lowestCoverageFiles.slice(0, 10).map((file, index) => (
              <div
                key={file.file || index}
                className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-slate-700/30"
              >
                <FolderIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate font-mono">
                    {file.file}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${getCoverageColor(file.lineCoverage)}`}>
                      {file.lineCoverage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">lines</div>
                  </div>
                  <div className="w-24">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getCoverageBg(file.lineCoverage)} transition-all duration-500`}
                        style={{ width: `${file.lineCoverage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Report Links */}
      {coverageData?.[0] && (coverageData[0].reportUrl || coverageData[0].lcovUrl) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 rounded-xl p-4 border border-white/20 dark:border-slate-700/50"
        >
          <div className="flex items-center gap-4">
            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Coverage Reports:
            </span>
            {coverageData[0].reportUrl && (
              <a
                href={coverageData[0].reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                HTML Report
              </a>
            )}
            {coverageData[0].lcovUrl && (
              <a
                href={coverageData[0].lcovUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                LCOV File
              </a>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
