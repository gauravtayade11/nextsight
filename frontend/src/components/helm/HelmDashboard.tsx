import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { helmApi } from '../../services/api';
import { logger } from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';
import { useHelmReleases } from '../../hooks/useHelmData';
import type { HelmRelease, HelmReleaseStatus } from '../../types';
import {
  CubeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
  EyeIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

// Import shared utilities
import { formatAge, itemVariants } from '../../utils/constants';
import { StatusBadge } from '../common/StatusBadge';

// Helm-specific status label mapping
const helmStatusLabels: Record<string, string> = {
  deployed: 'Deployed',
  failed: 'Failed',
  'pending-install': 'Installing',
  'pending-upgrade': 'Upgrading',
  'pending-rollback': 'Rolling back',
  uninstalling: 'Uninstalling',
  superseded: 'Superseded',
  unknown: 'Unknown',
};

// Helper to map Helm status to standard status
function getHelmStatusType(status: HelmReleaseStatus): string {
  const statusMap: Record<string, string> = {
    deployed: 'deployed',
    failed: 'failed',
    'pending-install': 'pending',
    'pending-upgrade': 'progressing',
    'pending-rollback': 'warning',
    uninstalling: 'warning',
    superseded: 'unknown',
    unknown: 'unknown',
  };
  return statusMap[status] || 'unknown';
}

// Helm Status Badge using shared StatusBadge
function HelmStatusBadge({ status }: { status: HelmReleaseStatus }) {
  return (
    <StatusBadge
      status={getHelmStatusType(status)}
      label={helmStatusLabels[status] || status}
      size="sm"
      animate={status.startsWith('pending') || status === 'uninstalling'}
    />
  );
}

// Dropdown Component
function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="text-sm text-gray-500 dark:text-gray-400 mb-1.5 block">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 px-4 py-2.5 min-w-[180px] text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-primary-500 transition-colors"
      >
        <span className="text-gray-900 dark:text-white">{value}</span>
        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden"
          >
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                  option === value ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {option}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main Component
export default function HelmDashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Use cached hook for releases
  const { releases, isLoading: initialLoading, isRefetching: loading, error, refresh } = useHelmReleases(selectedNamespace);

  // Extract unique namespaces from releases
  const namespaces = useMemo(() => {
    const uniqueNamespaces = new Set(['all', 'default']);
    releases.forEach(r => uniqueNamespaces.add(r.namespace));
    return Array.from(uniqueNamespaces);
  }, [releases]);

  // Filter releases based on search and namespace
  const filteredReleases = releases.filter((release) => {
    const matchesSearch =
      release.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      release.chart.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesNamespace = selectedNamespace === 'all' || release.namespace === selectedNamespace;
    return matchesSearch && matchesNamespace;
  });

  const handleRefresh = async () => {
    await refresh();
    toast.success('Refreshed', 'Helm releases updated');
  };

  const handleUpgrade = async (release: HelmRelease) => {
    try {
      const response = await helmApi.upgradeRelease(release.namespace, release.name, {
        chart: release.chart,
        reuse_values: true,
      });
      if (response.data.success) {
        toast.success('Upgrade Started', `Upgrading ${release.name}`);
        refresh();
      } else {
        toast.error('Upgrade Failed', response.data.message || `Failed to upgrade ${release.name}`);
      }
    } catch (err: any) {
      logger.error('Failed to upgrade release', err);
      const errorMessage = err.response?.data?.detail || err.message || `Failed to upgrade ${release.name}`;
      toast.error('Upgrade Failed', errorMessage);
    }
  };

  const handleDelete = async (release: HelmRelease) => {
    if (!confirm(`Are you sure you want to delete release "${release.name}"?`)) return;
    try {
      const response = await helmApi.uninstallRelease(release.namespace, release.name);
      if (response.data.success) {
        toast.success('Deleted', `Release ${release.name} deleted`);
        refresh();
      } else {
        toast.error('Delete Failed', response.data.message || `Failed to delete ${release.name}`);
      }
    } catch (err: any) {
      logger.error('Failed to delete release', err);
      const errorMessage = err.response?.data?.detail || err.message || `Failed to delete ${release.name}`;
      toast.error('Delete Failed', errorMessage);
    }
  };


  // Calculate stats
  const stats = {
    total: filteredReleases.length,
    deployed: filteredReleases.filter(r => r.status === 'deployed').length,
    failed: filteredReleases.filter(r => r.status === 'failed').length,
    pending: filteredReleases.filter(r => r.status.startsWith('pending')).length,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] overflow-hidden bg-gray-50 dark:bg-slate-900">
      {/* Header Section */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
            <CubeIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Helm Releases</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage and monitor your deployments
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/deploy/helm/catalog')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg hover:shadow-lg transition-all"
        >
          <PlusIcon className="h-5 w-5" />
          Install Chart
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">Total</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{stats.total}</p>
            </div>
            <CubeIcon className="h-8 w-8 text-blue-500 opacity-50" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase">Deployed</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">{stats.deployed}</p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-500 opacity-50" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-lg bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Failed</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">{stats.failed}</p>
            </div>
            <XCircleIcon className="h-8 w-8 text-red-500 opacity-50" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">Pending</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">{stats.pending}</p>
            </div>
            <ClockIcon className="h-8 w-8 text-amber-500 opacity-50" />
          </div>
        </motion.div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search releases by name or chart..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          <Dropdown
            label=""
            value={selectedNamespace}
            options={namespaces}
            onChange={setSelectedNamespace}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={loading}
            className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex-shrink-0">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Main Content - Card Grid */}
      <div className="flex-1 overflow-auto p-6">
        {loading && filteredReleases.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ArrowPathIcon className="h-12 w-12 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading releases...</p>
            </div>
          </div>
        ) : filteredReleases.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CubeIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No releases found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Get started by installing a chart'}
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/deploy/helm/catalog')}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg hover:shadow-lg transition-all"
              >
                Install Your First Chart
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReleases.map((release, index) => (
              <motion.div
                key={`${release.namespace}/${release.name}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-all"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{release.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{release.chart}</p>
                  </div>
                  <HelmStatusBadge status={release.status} />
                </div>

                {/* Card Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Namespace</span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium">
                      {release.namespace}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Version</span>
                    <span className="text-gray-900 dark:text-white font-medium">{release.chart_version}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Updated</span>
                    <span className="text-gray-900 dark:text-white font-medium">{formatAge(release.updated)}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-slate-700">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/deploy/helm/workspace/${release.namespace}/${release.name}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <EyeIcon className="h-3.5 w-3.5" />
                    View
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleUpgrade(release)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                  >
                    <ArrowUpTrayIcon className="h-3.5 w-3.5" />
                    Upgrade
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(release)}
                    className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
