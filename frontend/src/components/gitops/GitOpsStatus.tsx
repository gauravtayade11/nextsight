import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  CodeBracketIcon,
  CloudIcon,
  FolderIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { argocdApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { ArgoCDApplicationSummary, ArgoCDStatus, ArgoCDSyncStatus, ArgoCDHealthStatus } from '../../types';

// Import shared constants
import { containerVariants, itemVariants } from '../../utils/constants';

export default function GitOpsStatus() {
  const [applications, setApplications] = useState<ArgoCDApplicationSummary[]>([]);
  const [argocdStatus, setArgocdStatus] = useState<ArgoCDStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [syncFilter, setSyncFilter] = useState<string>('all');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [syncingApps, setSyncingApps] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch ArgoCD status and applications
  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // First check ArgoCD connection status
      const statusResponse = await argocdApi.getStatus();
      setArgocdStatus(statusResponse.data);

      if (statusResponse.data.connected) {
        // Fetch applications
        const appsResponse = await argocdApi.listApplications(
          projectFilter !== 'all' ? projectFilter : undefined
        );
        setApplications(appsResponse.data.applications || []);
      }
    } catch (err) {
      logger.error('Failed to fetch ArgoCD data', err);
      setError('Failed to connect to ArgoCD. Please check your ArgoCD configuration in Deploy settings.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [projectFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get unique projects
  const projects = useMemo(() => {
    const projectSet = new Set(applications.map(a => a.project));
    return ['all', ...Array.from(projectSet).sort()];
  }, [applications]);

  // Filter applications
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const matchesSearch =
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.repoURL.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProject = projectFilter === 'all' || app.project === projectFilter;
      const matchesSync = syncFilter === 'all' ||
        (syncFilter === 'synced' && app.syncStatus === 'Synced') ||
        (syncFilter === 'out_of_sync' && app.syncStatus === 'OutOfSync');
      return matchesSearch && matchesProject && matchesSync;
    });
  }, [applications, searchQuery, projectFilter, syncFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: applications.length,
      synced: applications.filter(a => a.syncStatus === 'Synced').length,
      outOfSync: applications.filter(a => a.syncStatus === 'OutOfSync').length,
      healthy: applications.filter(a => a.healthStatus === 'Healthy').length,
      degraded: applications.filter(a => a.healthStatus === 'Degraded').length,
      progressing: applications.filter(a => a.healthStatus === 'Progressing').length,
    };
  }, [applications]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  const handleSync = async (appName: string) => {
    setSyncingApps(prev => new Set(prev).add(appName));
    try {
      await argocdApi.syncApplication(appName);
      // Refresh after sync
      await fetchData();
    } catch (err) {
      logger.error('Failed to sync application', err);
    } finally {
      setSyncingApps(prev => {
        const next = new Set(prev);
        next.delete(appName);
        return next;
      });
    }
  };

  const getSyncStatusColor = (status: ArgoCDSyncStatus): string => {
    const colors: Record<ArgoCDSyncStatus, string> = {
      'Synced': 'bg-green-500/20 text-green-400 border-green-500/30',
      'OutOfSync': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Unknown': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return colors[status] || colors['Unknown'];
  };

  const getHealthStatusColor = (status: ArgoCDHealthStatus): string => {
    const colors: Record<ArgoCDHealthStatus, string> = {
      'Healthy': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Degraded': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Progressing': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Suspended': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      'Missing': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Unknown': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return colors[status] || colors['Unknown'];
  };

  const getSyncStatusIcon = (status: ArgoCDSyncStatus) => {
    switch (status) {
      case 'Synced':
        return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
      case 'OutOfSync':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getHealthStatusIcon = (status: ArgoCDHealthStatus) => {
    switch (status) {
      case 'Healthy':
        return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
      case 'Degraded':
        return <XCircleIcon className="w-4 h-4 text-red-400" />;
      case 'Progressing':
        return <ArrowPathIcon className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <ClockIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <ArrowPathIcon className="w-6 h-6 animate-spin" />
          <span>Loading ArgoCD applications...</span>
        </div>
      </div>
    );
  }

  // Show connection required message if ArgoCD is not configured
  if (!argocdStatus?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CloudIcon className="w-7 h-7 text-orange-400" />
            GitOps Status
          </h1>
          <p className="text-gray-400 mt-1">
            ArgoCD application sync and health status
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 px-8 rounded-xl bg-gray-800 border border-gray-700"
        >
          <div className="p-4 rounded-full bg-orange-500/20 mb-4">
            <LinkIcon className="w-12 h-12 text-orange-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">ArgoCD Not Connected</h2>
          <p className="text-gray-400 text-center max-w-md mb-6">
            To view GitOps status, you need to configure and connect to your ArgoCD instance.
            Go to the Deploy page to set up ArgoCD integration.
          </p>
          <Link
            to="/deploy"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
          >
            <CloudIcon className="w-5 h-5" />
            Configure ArgoCD
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CloudIcon className="w-7 h-7 text-orange-400" />
            GitOps Status
          </h1>
          <p className="text-gray-400 mt-1">
            ArgoCD application sync and health status
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
          <Link
            to="/deploy"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
          >
            <CloudIcon className="w-5 h-5" />
            Manage ArgoCD
          </Link>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
        >
          <ExclamationTriangleIcon className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-400/80 text-sm mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {/* ArgoCD Connection Status */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-800 border border-gray-700">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-400 font-medium">Connected to ArgoCD</span>
        </div>
        {argocdStatus?.serverUrl && (
          <a
            href={argocdStatus.serverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <span className="font-mono">{argocdStatus.serverUrl}</span>
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Apps</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Synced</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.synced}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Out of Sync</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.outOfSync}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Healthy</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.healthy}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Degraded</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.degraded}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Progressing</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{stats.progressing}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        >
          {projects.map(project => (
            <option key={project} value={project}>
              {project === 'all' ? 'All Projects' : project}
            </option>
          ))}
        </select>
        <select
          value={syncFilter}
          onChange={(e) => setSyncFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        >
          <option value="all">All Status</option>
          <option value="synced">Synced</option>
          <option value="out_of_sync">Out of Sync</option>
        </select>
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredApplications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-gray-400"
            >
              <CloudIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{applications.length === 0 ? 'No applications found in ArgoCD' : 'No applications match your filters'}</p>
            </motion.div>
          ) : (
            filteredApplications.map((app) => {
              const isExpanded = expandedApp === app.name;
              const isSyncing = syncingApps.has(app.name);

              return (
                <motion.div
                  key={app.name}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  {/* App Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {getSyncStatusIcon(app.syncStatus)}
                      <div>
                        <h3 className="text-lg font-semibold text-white">{app.name}</h3>
                        <p className="text-sm text-gray-400">
                          {app.namespace} &bull; {app.project}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border ${getSyncStatusColor(app.syncStatus)}`}>
                        {app.syncStatus}
                      </span>
                      <span className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border ${getHealthStatusColor(app.healthStatus)}`}>
                        {getHealthStatusIcon(app.healthStatus)}
                        {app.healthStatus}
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSync(app.name)}
                        disabled={isSyncing}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-sm transition-colors disabled:opacity-50"
                      >
                        <ArrowPathIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync'}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setExpandedApp(isExpanded ? null : app.name)}
                        className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      >
                        <ChevronRightIcon className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </motion.button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="flex items-start gap-2">
                              <CodeBracketIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-gray-500">Repository</p>
                                <a
                                  href={app.repoURL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-cyan-400 hover:underline flex items-center gap-1"
                                >
                                  {app.repoURL}
                                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <FolderIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-gray-500">Path</p>
                                <p className="text-sm text-white font-mono">{app.path || '/'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-start gap-2">
                              <CloudIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-gray-500">Target Revision</p>
                                <p className="text-sm text-white font-mono">{app.targetRevision}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <CloudIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-gray-500">Destination</p>
                                <p className="text-sm text-white">{app.destNamespace} @ {app.destServer}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Sync Revision */}
                        {app.syncRevision && (
                          <div className="mt-4 flex items-center gap-4">
                            <span className="text-xs text-gray-500">Current Revision:</span>
                            <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 font-mono">
                              {app.syncRevision.substring(0, 8)}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
