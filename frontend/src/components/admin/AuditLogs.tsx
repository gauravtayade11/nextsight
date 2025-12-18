import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../../utils/logger';
import {
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  UserIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
  KeyIcon,
  TrashIcon,
  PencilIcon,
  PlusIcon,
  ArrowRightOnRectangleIcon,
  DocumentTextIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { PermissionDenied } from '../common/LoadingStates';
import GlassCard, { StatCard } from '../common/GlassCard';
import { authApi } from '../../services/api';

// Import shared constants
import { containerVariants, itemVariants } from '../../utils/constants';

type AuditAction =
  | 'login' | 'logout' | 'create' | 'update' | 'delete'
  | 'view' | 'deploy' | 'sync' | 'rollback' | 'scale'
  | 'secret_access' | 'permission_change' | 'config_change';

type AuditResource =
  | 'user' | 'deployment' | 'pod' | 'service' | 'secret'
  | 'configmap' | 'cluster' | 'namespace' | 'role' | 'session';

interface AuditLog {
  id: string;
  timestamp: Date;
  user: {
    id: string;
    username: string;
    role: string;
  };
  action: AuditAction;
  resource: AuditResource;
  resourceName: string;
  resourceNamespace?: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

// Transform backend audit log to frontend format
function transformAuditLog(backendLog: any): AuditLog {
  return {
    id: backendLog.id || String(Math.random()),
    timestamp: new Date(backendLog.timestamp),
    user: {
      id: backendLog.user_id || '',
      username: backendLog.username || 'unknown',
      role: backendLog.user_role || 'unknown',
    },
    action: (backendLog.action || 'view') as AuditAction,
    resource: (backendLog.resource_type || 'session') as AuditResource,
    resourceName: backendLog.resource_name || '',
    resourceNamespace: backendLog.namespace,
    details: backendLog.details || '',
    ipAddress: backendLog.ip_address || '',
    userAgent: backendLog.user_agent || '',
    status: backendLog.status === 'success' ? 'success' : 'failure',
    metadata: backendLog.metadata,
  };
}

const actionIcons: Record<AuditAction, typeof UserIcon> = {
  login: ArrowRightOnRectangleIcon,
  logout: ArrowRightOnRectangleIcon,
  create: PlusIcon,
  update: PencilIcon,
  delete: TrashIcon,
  view: EyeIcon,
  deploy: RocketLaunchIcon,
  sync: ArrowPathIcon,
  rollback: ArrowPathIcon,
  scale: ServerStackIcon,
  secret_access: KeyIcon,
  permission_change: ShieldCheckIcon,
  config_change: DocumentTextIcon,
};

const actionConfig: Record<AuditAction, { gradient: string; bg: string; text: string }> = {
  login: { gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  logout: { gradient: 'from-gray-500 to-slate-600', bg: 'bg-gray-50 dark:bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400' },
  create: { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  update: { gradient: 'from-amber-500 to-yellow-600', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  delete: { gradient: 'from-red-500 to-rose-600', bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  view: { gradient: 'from-gray-500 to-slate-600', bg: 'bg-gray-50 dark:bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400' },
  deploy: { gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  sync: { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  rollback: { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
  scale: { gradient: 'from-cyan-500 to-teal-600', bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400' },
  secret_access: { gradient: 'from-amber-500 to-yellow-600', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  permission_change: { gradient: 'from-red-500 to-rose-600', bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  config_change: { gradient: 'from-indigo-500 to-purple-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
};

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function AuditLogs() {
  const { hasRole } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [totalLogs, setTotalLogs] = useState(0);
  const logsPerPage = 10;

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.getAuditLogs(currentPage, logsPerPage);
      const transformedLogs = (response.data.logs || []).map(transformAuditLog);
      setLogs(transformedLogs);
      setTotalLogs(response.data.total || transformedLogs.length);
    } catch (err: any) {
      logger.error('Failed to fetch audit logs', err);
      setError(err?.response?.data?.detail || 'Failed to fetch audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchQuery === '' ||
      log.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

    return matchesSearch && matchesAction && matchesStatus;
  });

  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * logsPerPage,
    currentPage * logsPerPage
  );

  // Calculate stats
  const stats = {
    total: totalLogs,
    success: logs.filter(l => l.status === 'success').length,
    failure: logs.filter(l => l.status === 'failure').length,
    today: logs.filter(l => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return l.timestamp >= today;
    }).length,
  };

  // Show error if any
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-6">
        <GlassCard className="p-8 text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to Load Audit Logs
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchAuditLogs}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Try Again
          </motion.button>
        </GlassCard>
      </div>
    );
  }

  if (!hasRole('admin')) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 min-h-screen">
        <PermissionDenied resource="Audit Logs" requiredRole="Administrator" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div className="p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/25">
              <ClipboardDocumentListIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track all user actions and system events
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchAuditLogs}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-4 gap-4"
        >
          <StatCard
            title="Total Events"
            value={stats.total}
            icon={ClipboardDocumentListIcon}
            color="primary"
          />
          <StatCard
            title="Successful"
            value={stats.success}
            icon={CheckCircleIcon}
            color="success"
          />
          <StatCard
            title="Failed"
            value={stats.failure}
            icon={XCircleIcon}
            color="danger"
          />
          <StatCard
            title="Today"
            value={stats.today}
            icon={ClockIcon}
            color="warning"
          />
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard padding="md">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px] relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs by user, resource, or details..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all backdrop-blur-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-5 w-5 text-gray-400" />
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all backdrop-blur-sm"
                >
                  <option value="all">All Actions</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="deploy">Deploy</option>
                  <option value="sync">Sync</option>
                  <option value="rollback">Rollback</option>
                  <option value="secret_access">Secret Access</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all backdrop-blur-sm"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                </select>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Results Info */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            Showing {paginatedLogs.length} of {filteredLogs.length} logs
          </span>
        </div>

        {/* Logs Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard padding="none" className="overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">Loading audit logs...</p>
                </div>
              </div>
            ) : paginatedLogs.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClockIcon className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">No audit logs found</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="backdrop-blur-xl bg-white/50 dark:bg-slate-800/50 border-b border-white/20 dark:border-slate-700/50">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Details
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <motion.tbody
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="divide-y divide-gray-100 dark:divide-slate-700/50"
                  >
                    {paginatedLogs.map((log) => {
                      const ActionIcon = actionIcons[log.action];
                      const config = actionConfig[log.action];
                      return (
                        <motion.tr
                          key={log.id}
                          variants={itemVariants}
                          whileHover={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
                          className="cursor-pointer transition-colors dark:hover:bg-slate-700/30"
                          onClick={() => setSelectedLog(log)}
                        >
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm">
                              <ClockIcon className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-gray-900 dark:text-white font-medium">
                                  {formatTimeAgo(log.timestamp)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatTimestamp(log.timestamp)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center">
                                <UserIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {log.user.username}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{log.user.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`p-2 rounded-xl bg-gradient-to-br ${config.gradient} shadow-lg`}>
                                <ActionIcon className="h-4 w-4 text-white" />
                              </div>
                              <span className={`text-sm font-semibold capitalize ${config.text}`}>
                                {log.action.replace('_', ' ')}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {log.resourceName}
                              </p>
                              {log.resourceNamespace && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded inline-block mt-1">
                                  {log.resourceNamespace}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                              {log.details}
                            </p>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                log.status === 'success'
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                  : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                              }`}
                            >
                              {log.status === 'success' ? (
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                              ) : (
                                <XCircleIcon className="h-3.5 w-3.5" />
                              )}
                              {log.status}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </motion.tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-slate-700/50 backdrop-blur-xl bg-white/30 dark:bg-slate-800/30">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {(currentPage - 1) * logsPerPage + 1} to{' '}
                  {Math.min(currentPage * logsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
                </p>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 bg-white/50 dark:bg-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-600/50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                  >
                    <ChevronLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </motion.button>
                  <span className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-slate-700/50 rounded-xl backdrop-blur-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-white/50 dark:bg-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-600/50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                  >
                    <ChevronRightIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </motion.button>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Log Detail Modal */}
        <AnimatePresence>
          {selectedLog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedLog(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="backdrop-blur-xl bg-white/90 dark:bg-slate-800/90 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-white/20 dark:border-slate-700/50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 backdrop-blur-xl bg-white/80 dark:bg-slate-800/80 px-6 py-4 border-b border-gray-100 dark:border-slate-700/50 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-blue-500" />
                    Audit Log Details
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedLog(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </motion.button>
                </div>
                <div className="p-6 space-y-6">
                  {/* Status Badge */}
                  <div className="flex justify-center">
                    <span
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                        selectedLog.status === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                      }`}
                    >
                      {selectedLog.status === 'success' ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : (
                        <XCircleIcon className="h-5 w-5" />
                      )}
                      {selectedLog.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Timestamp
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white font-medium">
                        {selectedLog.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white font-medium">
                        {selectedLog.user.username}
                        <span className="text-gray-500 dark:text-gray-400 ml-1">({selectedLog.user.role})</span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Action
                      </label>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const ActionIcon = actionIcons[selectedLog.action];
                          const config = actionConfig[selectedLog.action];
                          return (
                            <>
                              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${config.gradient}`}>
                                <ActionIcon className="h-4 w-4 text-white" />
                              </div>
                              <span className={`text-sm font-semibold capitalize ${config.text}`}>
                                {selectedLog.action.replace('_', ' ')}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Resource
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white font-medium">
                        {selectedLog.resource}: {selectedLog.resourceName}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Namespace
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white font-medium">
                        {selectedLog.resourceNamespace || 'N/A'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        IP Address
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded inline-block">
                        {selectedLog.ipAddress}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Details
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-700/50 p-4 rounded-xl">
                      {selectedLog.details}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User Agent
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-slate-700/50 p-3 rounded-xl break-all">
                      {selectedLog.userAgent}
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
