import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ServerIcon,
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { prometheusApi, getTargetHealthColor, getRelativeTime } from '../../services/prometheusApi';
import { logger } from '../../utils/logger';
import type { TargetGroup, ScrapeTarget, TargetsResponse } from '../../types/prometheus';

const healthIcon = (health: string) => {
  switch (health.toLowerCase()) {
    case 'up':
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    case 'down':
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    default:
      return <QuestionMarkCircleIcon className="h-5 w-5 text-gray-500" />;
  }
};

export default function TargetsView() {
  const [targetGroups, setTargetGroups] = useState<TargetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [downCount, setDownCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const response = await prometheusApi.getTargets();
      const data = response.data as TargetsResponse;
      setTargetGroups(data.targets || []);
      setActiveCount(data.active_count || 0);
      setDownCount(data.down_count || 0);
      setError(null);

      // Auto-expand all jobs on first load
      if (expandedJobs.size === 0 && data.targets.length > 0) {
        setExpandedJobs(new Set(data.targets.map(t => t.job)));
      }
    } catch (err: unknown) {
      logger.error('Failed to fetch targets', err);
      setError('Failed to load scrape targets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [expandedJobs.size]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const toggleJob = (jobName: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobName)) {
        newSet.delete(jobName);
      } else {
        newSet.add(jobName);
      }
      return newSet;
    });
  };

  // Filter targets
  const filteredGroups = targetGroups.map(group => {
    const filteredTargets = group.targets.filter(target => {
      const matchesSearch = searchQuery === '' ||
        target.instance.toLowerCase().includes(searchQuery.toLowerCase()) ||
        target.job.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Object.values(target.labels).some(v => v.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesHealth = healthFilter === 'all' || target.health === healthFilter;

      return matchesSearch && matchesHealth;
    });

    return {
      ...group,
      targets: filteredTargets,
      active_count: filteredTargets.filter(t => t.health === 'up').length,
      down_count: filteredTargets.filter(t => t.health === 'down').length,
    };
  }).filter(group => group.targets.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ServerIcon className="h-7 w-7 text-purple-500" />
            Scrape Targets
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor Prometheus scrape targets and their health status
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20"
        >
          <div className="flex items-center gap-3">
            <ServerIcon className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {targetGroups.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Jobs</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20"
        >
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Targets Up</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20"
        >
          <div className="flex items-center gap-3">
            <XCircleIcon className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{downCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Targets Down</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search targets..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Health</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Target Groups */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <ServerIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">No Targets Found</p>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || healthFilter !== 'all'
                ? 'No targets match your filters'
                : 'Prometheus is not scraping any targets'}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div
              key={group.job}
              className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleJob(group.job)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  {expandedJobs.has(group.job) ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                  )}
                  <ServerIcon className="h-5 w-5 text-purple-500" />
                  <span className="font-medium text-gray-900 dark:text-white">{group.job}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                    <CheckCircleIcon className="h-3 w-3" />
                    {group.active_count} up
                  </span>
                  {group.down_count > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                      <XCircleIcon className="h-3 w-3" />
                      {group.down_count} down
                    </span>
                  )}
                </div>
              </button>

              <AnimatePresence>
                {expandedJobs.has(group.job) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-gray-200 dark:divide-slate-700">
                      {group.targets.map((target, idx) => (
                        <TargetRow key={`${target.instance}-${idx}`} target={target} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface TargetRowProps {
  target: ScrapeTarget;
}

function TargetRow({ target }: TargetRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-800">
      <div
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 ${
          target.health === 'down' ? 'bg-red-50/50 dark:bg-red-900/5' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          {healthIcon(target.health)}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">{target.instance}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTargetHealthColor(target.health)}`}>
                {target.health}
              </span>
            </div>
            {target.last_error && (
              <p className="text-sm text-red-500 mt-0.5 flex items-center gap-1">
                <ExclamationTriangleIcon className="h-4 w-4" />
                {target.last_error}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          {target.last_scrape && (
            <span className="flex items-center gap-1">
              <ClockIcon className="h-4 w-4" />
              {getRelativeTime(target.last_scrape)}
            </span>
          )}
          {target.last_scrape_duration && (
            <span>{(target.last_scrape_duration * 1000).toFixed(0)}ms</span>
          )}
          {expanded ? (
            <ChevronDownIcon className="h-5 w-5" />
          ) : (
            <ChevronRightIcon className="h-5 w-5" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 dark:border-slate-700"
          >
            <div className="p-4 bg-gray-50/50 dark:bg-slate-900/30 space-y-3">
              {/* Scrape URL */}
              {target.scrape_url && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Scrape URL</p>
                  <div className="flex items-center gap-2">
                    <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                    <code className="text-sm text-gray-900 dark:text-white font-mono">
                      {target.scrape_url}
                    </code>
                  </div>
                </div>
              )}

              {/* Labels */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Labels</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(target.labels).map(([key, value]) => (
                    <span
                      key={key}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 rounded text-gray-700 dark:text-gray-300"
                    >
                      <span className="text-purple-600 dark:text-purple-400">{key}</span>
                      <span className="text-gray-400 mx-1">=</span>
                      <span>{value}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-slate-700">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Last Scrape</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {target.last_scrape ? new Date(target.last_scrape).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Scrape Duration</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {target.last_scrape_duration
                      ? `${(target.last_scrape_duration * 1000).toFixed(2)}ms`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
