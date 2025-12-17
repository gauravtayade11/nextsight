import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../../utils/logger';
import {
  ServerStackIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  CloudIcon,
  XMarkIcon,
  KeyIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  SignalIcon,
  PencilSquareIcon,
  HeartIcon,
  ClockIcon,
  CpuChipIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline';
import { clustersApi, ClusterTestResult } from '../../services/api';
import { useCluster } from '../../contexts/ClusterContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import GlassCard, { SectionHeader } from '../common/GlassCard';
import type { ClusterInfo } from '../../types';

// Import shared constants
import { containerVariants, itemVariants, scaleVariants } from '../../utils/constants';
import { StatusBadge, HealthIndicator } from '../common/StatusBadge';

type AuthType = 'kubeconfig' | 'kubeconfig_file' | 'token';

interface ClusterHealthData {
  cluster_id: string;
  healthy: boolean;
  status: string;
  node_count: number;
  ready_nodes: number;
  total_pods: number;
  running_pods: number;
  namespaces: number;
  warnings: string[];
  error?: string;
  checked_at: string;
}

interface KubeContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
}

// Modal variants (extends shared scaleVariants)
const modalVariants = {
  ...scaleVariants,
  visible: { opacity: 1, scale: 1, transition: { type: 'spring' as const, duration: 0.3 } },
};

export default function ClusterManagement() {
  const { clusters, setActiveCluster, refreshClusters } = useCluster();
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [contexts, setContexts] = useState<KubeContext[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    id: '',
    name: '',
    context: '',
    kubeconfig_path: '',
    kubeconfig_content: '',
    is_default: false,
    auth_type: 'kubeconfig' as AuthType,
    api_server: '',
    bearer_token: '',
    ca_cert: '',
    skip_tls_verify: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New state for enhanced features
  const [testingCluster, setTestingCluster] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ClusterTestResult | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCluster, setEditingCluster] = useState<ClusterInfo | null>(null);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthData, setHealthData] = useState<ClusterHealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadContexts();
  }, []);

  const loadContexts = async () => {
    try {
      const response = await clustersApi.getContexts();
      setContexts(response.data);
    } catch (err) {
      logger.error('Failed to load contexts', err);
    }
  };

  const handleSetActive = async (clusterId: string) => {
    try {
      setLoading(true);
      setError(null);
      await setActiveCluster(clusterId);
      setSuccess(`Switched to cluster: ${clusterId}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to switch cluster');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const payload: Record<string, unknown> = {
        id: addForm.id.toLowerCase().replace(/\s+/g, '-'),
        name: addForm.name,
        is_default: addForm.is_default,
        auth_type: addForm.auth_type === 'kubeconfig_file' ? 'kubeconfig' : addForm.auth_type,
      };

      if (addForm.auth_type === 'kubeconfig') {
        payload.context = addForm.context || undefined;
        payload.kubeconfig_path = addForm.kubeconfig_path || undefined;
      } else if (addForm.auth_type === 'kubeconfig_file') {
        payload.kubeconfig_content = addForm.kubeconfig_content;
        payload.context = addForm.context || undefined;
      } else {
        payload.api_server = addForm.api_server;
        payload.bearer_token = addForm.bearer_token;
        payload.ca_cert = addForm.ca_cert || undefined;
        payload.skip_tls_verify = addForm.skip_tls_verify;
      }

      await clustersApi.create(payload);

      setSuccess('Cluster added successfully');
      setShowAddModal(false);
      setAddForm({
        id: '',
        name: '',
        context: '',
        kubeconfig_path: '',
        kubeconfig_content: '',
        is_default: false,
        auth_type: 'kubeconfig',
        api_server: '',
        bearer_token: '',
        ca_cert: '',
        skip_tls_verify: false,
      });
      await refreshClusters();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to add cluster');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCluster = async (clusterId: string) => {
    if (!confirm(`Are you sure you want to delete cluster "${clusterId}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await clustersApi.delete(clusterId);
      setSuccess('Cluster deleted successfully');
      await refreshClusters();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to delete cluster');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (clusterId: string) => {
    try {
      setTestingCluster(clusterId);
      setTestResult(null);
      const response = await clustersApi.testConnection(clusterId);
      setTestResult(response.data);
      if (response.data.success) {
        setSuccess(`Connection to ${clusterId} successful! Latency: ${response.data.latency_ms}ms`);
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setTestResult({
        success: false,
        cluster_id: clusterId,
        error: error.response?.data?.detail || 'Connection test failed',
        latency_ms: 0,
      });
    } finally {
      setTestingCluster(null);
    }
  };

  const handleEditCluster = (cluster: ClusterInfo) => {
    setEditingCluster(cluster);
    setAddForm({
      id: cluster.id,
      name: cluster.name,
      context: cluster.context || '',
      kubeconfig_path: '',
      kubeconfig_content: '',
      is_default: cluster.is_default,
      auth_type: 'kubeconfig',
      api_server: '',
      bearer_token: '',
      ca_cert: '',
      skip_tls_verify: false,
    });
    setShowEditModal(true);
  };

  const handleUpdateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCluster) return;

    try {
      setLoading(true);
      setError(null);

      const payload: Record<string, unknown> = {
        id: addForm.id.toLowerCase().replace(/\s+/g, '-'),
        name: addForm.name,
        is_default: addForm.is_default,
        auth_type: addForm.auth_type === 'kubeconfig_file' ? 'kubeconfig' : addForm.auth_type,
      };

      if (addForm.auth_type === 'kubeconfig') {
        payload.context = addForm.context || undefined;
        payload.kubeconfig_path = addForm.kubeconfig_path || undefined;
      } else if (addForm.auth_type === 'kubeconfig_file') {
        payload.kubeconfig_content = addForm.kubeconfig_content;
        payload.context = addForm.context || undefined;
      } else {
        payload.api_server = addForm.api_server;
        payload.bearer_token = addForm.bearer_token;
        payload.ca_cert = addForm.ca_cert || undefined;
        payload.skip_tls_verify = addForm.skip_tls_verify;
      }

      await clustersApi.update(editingCluster.id, payload);

      setSuccess('Cluster updated successfully');
      setShowEditModal(false);
      setEditingCluster(null);
      setAddForm({
        id: '',
        name: '',
        context: '',
        kubeconfig_path: '',
        kubeconfig_content: '',
        is_default: false,
        auth_type: 'kubeconfig',
        api_server: '',
        bearer_token: '',
        ca_cert: '',
        skip_tls_verify: false,
      });
      await refreshClusters();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to update cluster');
    } finally {
      setLoading(false);
    }
  };

  const handleViewHealth = async (clusterId: string) => {
    try {
      setLoadingHealth(true);
      setShowHealthModal(true);
      const response = await clustersApi.getHealth(clusterId);
      setHealthData(response.data as unknown as ClusterHealthData);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setHealthData({
        cluster_id: clusterId,
        healthy: false,
        status: 'error',
        node_count: 0,
        ready_nodes: 0,
        total_pods: 0,
        running_pods: 0,
        namespaces: 0,
        warnings: [],
        error: error.response?.data?.detail || 'Failed to fetch health data',
        checked_at: new Date().toISOString(),
      });
    } finally {
      setLoadingHealth(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-success-500';
      case 'disconnected':
        return 'text-warning-500';
      case 'error':
        return 'text-danger-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-success-500/10';
      case 'disconnected':
        return 'bg-warning-500/10';
      case 'error':
        return 'bg-danger-500/10';
      default:
        return 'bg-gray-500/10';
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Sticky Header */}
      <motion.div
        variants={itemVariants}
        className="sticky top-16 z-30 -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-slate-700/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30">
              <ServerStackIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Cluster Management
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {clusters.length} cluster{clusters.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => refreshClusters()}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-white/20 dark:border-slate-700/50 hover:bg-white/90 dark:hover:bg-slate-800/90 disabled:opacity-50 transition-all"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 text-sm font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-300"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Cluster
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-danger-500/10 backdrop-blur-sm border border-danger-500/20 rounded-xl p-4"
          >
            <div className="flex items-center">
              <ExclamationCircleIcon className="h-5 w-5 text-danger-500 mr-2" />
              <span className="text-danger-600 dark:text-danger-400 text-sm">{error}</span>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-success-500/10 backdrop-blur-sm border border-success-500/20 rounded-xl p-4"
          >
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-success-500 mr-2" />
              <span className="text-success-600 dark:text-success-400 text-sm">{success}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clusters Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clusters.map((cluster, index) => (
          <motion.div
            key={cluster.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <GlassCard
              hover
              variant={cluster.is_active ? 'glow' : 'hover'}
              className={`${cluster.is_active ? 'ring-2 ring-primary-500/50' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className={`p-2.5 rounded-xl ${getStatusBg(cluster.status)}`}>
                    <ServerStackIcon className={`h-6 w-6 ${getStatusColor(cluster.status)}`} />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {cluster.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{cluster.id}</p>
                  </div>
                </div>
                {cluster.is_active && (
                  <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400">
                    Active
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Status</span>
                  <span className={`font-medium capitalize ${getStatusColor(cluster.status)}`}>
                    {cluster.status}
                  </span>
                </div>

                {cluster.version && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Version</span>
                    <span className="font-medium text-gray-900 dark:text-white">{cluster.version}</span>
                  </div>
                )}

                {cluster.context && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Context</span>
                    <span className="font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                      {cluster.context}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Nodes</span>
                  <span className="font-medium text-gray-900 dark:text-white">{cluster.node_count}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Namespaces</span>
                  <span className="font-medium text-gray-900 dark:text-white">{cluster.namespace_count}</span>
                </div>
              </div>

              {/* Test Result Display */}
              <AnimatePresence>
                {testResult && testResult.cluster_id === cluster.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mt-3 p-2.5 rounded-xl text-xs ${
                      testResult.success
                        ? 'bg-success-500/10 border border-success-500/20'
                        : 'bg-danger-500/10 border border-danger-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircleIcon className="h-4 w-4 text-success-500 flex-shrink-0" />
                      ) : (
                        <ExclamationCircleIcon className="h-4 w-4 text-danger-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {testResult.success ? (
                          <div className="space-y-0.5">
                            <p className="text-success-600 dark:text-success-400 font-medium">Connected</p>
                            <p className="text-gray-500 dark:text-gray-400">
                              {testResult.version} • {testResult.latency_ms}ms
                            </p>
                          </div>
                        ) : (
                          <p className="text-danger-600 dark:text-danger-400 truncate">{testResult.error}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setTestResult(null)}
                        className="text-gray-400 hover:text-gray-500"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-slate-700/50 space-y-3">
                {/* Primary action row */}
                <div className="flex items-center justify-between">
                  {!cluster.is_active ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSetActive(cluster.id)}
                      disabled={loading}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 disabled:opacity-50"
                    >
                      Switch to this cluster
                    </motion.button>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Currently active</span>
                  )}
                </div>

                {/* Secondary action buttons */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTestConnection(cluster.id)}
                    disabled={testingCluster === cluster.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100/50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-slate-600/50 disabled:opacity-50 transition-all"
                    title="Test connection"
                  >
                    {testingCluster === cluster.id ? (
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <SignalIcon className="h-3.5 w-3.5" />
                    )}
                    <span>Test</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleViewHealth(cluster.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100/50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-slate-600/50 transition-all"
                    title="View health details"
                  >
                    <HeartIcon className="h-3.5 w-3.5" />
                    <span>Health</span>
                  </motion.button>

                  {isAdmin && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleEditCluster(cluster)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100/50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-slate-600/50 transition-all"
                      title="Edit cluster"
                    >
                      <PencilSquareIcon className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </motion.button>
                  )}

                  {isAdmin && !cluster.is_default && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDeleteCluster(cluster.id)}
                      disabled={loading || cluster.is_active}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-danger-500 hover:bg-danger-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      title={cluster.is_active ? 'Cannot delete active cluster' : 'Delete cluster'}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </motion.button>
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}

        {clusters.length === 0 && (
          <motion.div
            variants={itemVariants}
            className="col-span-full"
          >
            <GlassCard className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-2xl bg-gray-500/10 mb-4">
                <CloudIcon className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 dark:text-white">No clusters configured</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Add a cluster to get started
              </p>
              {isAdmin && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 text-sm font-medium shadow-lg shadow-primary-500/25"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Cluster
                </motion.button>
              )}
            </GlassCard>
          </motion.div>
        )}
      </motion.div>

      {/* Available Contexts */}
      {contexts.length > 0 && (
        <motion.div variants={itemVariants}>
          <GlassCard>
            <SectionHeader
              title="Available Kubeconfig Contexts"
              subtitle="Contexts found in your kubeconfig file"
            />
            <div className="overflow-x-auto -mx-4 lg:-mx-6">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200/50 dark:border-slate-700/50">
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Context Name
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Cluster
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      User
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Namespace
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50 dark:divide-slate-700/30">
                  {contexts.map((ctx, index) => (
                    <motion.tr
                      key={ctx.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 lg:px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {ctx.name}
                      </td>
                      <td className="px-4 lg:px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{ctx.cluster}</td>
                      <td className="px-4 lg:px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{ctx.user}</td>
                      <td className="px-4 lg:px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {ctx.namespace || 'default'}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Add Cluster Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowAddModal(false)}
              />
              <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/20 dark:border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add New Cluster</h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowAddModal(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                  </motion.button>
                </div>

                <form onSubmit={handleAddCluster} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cluster ID *
                    </label>
                    <input
                      type="text"
                      value={addForm.id}
                      onChange={(e) => setAddForm({ ...addForm, id: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                      placeholder="my-cluster"
                      required
                    />
                    <p className="mt-1 text-[10px] text-gray-500">Unique identifier for this cluster</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                      placeholder="My Production Cluster"
                      required
                    />
                  </div>

                  {/* Authentication Type Selector */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Authentication Method
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAddForm({ ...addForm, auth_type: 'kubeconfig' })}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${
                          addForm.auth_type === 'kubeconfig'
                            ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                            : 'border-gray-200/50 dark:border-slate-600/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                      >
                        <DocumentTextIcon className="h-5 w-5" />
                        <span className="text-xs font-medium">Context</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddForm({ ...addForm, auth_type: 'kubeconfig_file' })}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${
                          addForm.auth_type === 'kubeconfig_file'
                            ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                            : 'border-gray-200/50 dark:border-slate-600/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                      >
                        <ArrowUpTrayIcon className="h-5 w-5" />
                        <span className="text-xs font-medium">Upload File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddForm({ ...addForm, auth_type: 'token' })}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all ${
                          addForm.auth_type === 'token'
                            ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                            : 'border-gray-200/50 dark:border-slate-600/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                      >
                        <KeyIcon className="h-5 w-5" />
                        <span className="text-xs font-medium">Token</span>
                      </button>
                    </div>
                  </div>

                  {/* Kubeconfig Context Fields */}
                  {addForm.auth_type === 'kubeconfig' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Kubeconfig Context
                        </label>
                        <select
                          value={addForm.context}
                          onChange={(e) => setAddForm({ ...addForm, context: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                        >
                          <option value="">Select a context...</option>
                          {contexts.map((ctx) => (
                            <option key={ctx.name} value={ctx.name}>
                              {ctx.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10px] text-gray-500">Select from available kubeconfig contexts</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Kubeconfig Path
                        </label>
                        <input
                          type="text"
                          value={addForm.kubeconfig_path}
                          onChange={(e) => setAddForm({ ...addForm, kubeconfig_path: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                          placeholder="~/.kube/config"
                        />
                        <p className="mt-1 text-[10px] text-gray-500">Leave empty to use default kubeconfig</p>
                      </div>
                    </>
                  )}

                  {/* Kubeconfig File Upload/Paste Fields */}
                  {addForm.auth_type === 'kubeconfig_file' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Upload Kubeconfig File
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            accept=".yaml,.yml,.config,*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const content = event.target?.result as string;
                                  setAddForm({ ...addForm, kubeconfig_content: content });
                                };
                                reader.readAsText(file);
                              }
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary-500/10 file:text-primary-600 dark:file:text-primary-400 hover:file:bg-primary-500/20"
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-gray-500">Upload your kubeconfig file from your machine</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Or Paste Kubeconfig Content
                        </label>
                        <textarea
                          value={addForm.kubeconfig_content}
                          onChange={(e) => setAddForm({ ...addForm, kubeconfig_content: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all font-mono text-xs"
                          placeholder="apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://..."
                          rows={6}
                        />
                        <p className="mt-1 text-[10px] text-gray-500">Paste the full kubeconfig YAML content</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Context Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={addForm.context}
                          onChange={(e) => setAddForm({ ...addForm, context: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                          placeholder="my-cluster-context"
                        />
                        <p className="mt-1 text-[10px] text-gray-500">Specify which context to use (leave empty for default)</p>
                      </div>
                    </>
                  )}

                  {/* Token-based Fields */}
                  {addForm.auth_type === 'token' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          API Server URL *
                        </label>
                        <input
                          type="text"
                          value={addForm.api_server}
                          onChange={(e) => setAddForm({ ...addForm, api_server: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                          placeholder="https://kubernetes.example.com:6443"
                          required={addForm.auth_type === 'token'}
                        />
                        <p className="mt-1 text-[10px] text-gray-500">Kubernetes API server endpoint</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Bearer Token *
                        </label>
                        <textarea
                          value={addForm.bearer_token}
                          onChange={(e) => setAddForm({ ...addForm, bearer_token: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all font-mono"
                          placeholder="eyJhbGciOiJSUzI1NiIsImtpZCI6..."
                          rows={3}
                          required={addForm.auth_type === 'token'}
                        />
                        <p className="mt-1 text-[10px] text-gray-500">Service account token from the cluster</p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          CA Certificate (Base64)
                        </label>
                        <textarea
                          value={addForm.ca_cert}
                          onChange={(e) => setAddForm({ ...addForm, ca_cert: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all font-mono"
                          placeholder="LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS..."
                          rows={2}
                        />
                        <p className="mt-1 text-[10px] text-gray-500">Optional: Base64-encoded CA certificate</p>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="skip_tls"
                          checked={addForm.skip_tls_verify}
                          onChange={(e) => setAddForm({ ...addForm, skip_tls_verify: e.target.checked })}
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="skip_tls" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Skip TLS verification <span className="text-amber-500">(not recommended)</span>
                        </label>
                      </div>
                    </>
                  )}

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_default"
                      checked={addForm.is_default}
                      onChange={(e) => setAddForm({ ...addForm, is_default: e.target.checked })}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="is_default" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Set as default cluster
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100/50 dark:bg-slate-700/50 rounded-xl hover:bg-gray-200/50 dark:hover:bg-slate-600/50 transition-all"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading || !addForm.id || !addForm.name || (addForm.auth_type === 'token' && (!addForm.api_server || !addForm.bearer_token)) || (addForm.auth_type === 'kubeconfig_file' && !addForm.kubeconfig_content)}
                      className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 shadow-lg shadow-primary-500/25 transition-all"
                    >
                      {loading ? 'Adding...' : 'Add Cluster'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Cluster Modal */}
      <AnimatePresence>
        {showEditModal && editingCluster && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => { setShowEditModal(false); setEditingCluster(null); }}
              />
              <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/20 dark:border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Cluster</h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { setShowEditModal(false); setEditingCluster(null); }}
                    className="p-1.5 rounded-lg hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                  </motion.button>
                </div>

                <form onSubmit={handleUpdateCluster} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cluster ID
                    </label>
                    <input
                      type="text"
                      value={addForm.id}
                      onChange={(e) => setAddForm({ ...addForm, id: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Context
                    </label>
                    <select
                      value={addForm.context}
                      onChange={(e) => setAddForm({ ...addForm, context: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                    >
                      <option value="">Select a context...</option>
                      {contexts.map((ctx) => (
                        <option key={ctx.name} value={ctx.name}>
                          {ctx.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="edit_is_default"
                      checked={addForm.is_default}
                      onChange={(e) => setAddForm({ ...addForm, is_default: e.target.checked })}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="edit_is_default" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Set as default cluster
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => { setShowEditModal(false); setEditingCluster(null); }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100/50 dark:bg-slate-700/50 rounded-xl hover:bg-gray-200/50 dark:hover:bg-slate-600/50 transition-all"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading || !addForm.id || !addForm.name}
                      className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 shadow-lg shadow-primary-500/25 transition-all"
                    >
                      {loading ? 'Updating...' : 'Update Cluster'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Health Details Modal */}
      <AnimatePresence>
        {showHealthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => { setShowHealthModal(false); setHealthData(null); }}
              />
              <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-white/20 dark:border-slate-700/50"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${healthData?.healthy ? 'bg-success-500/10' : 'bg-danger-500/10'}`}>
                      <HeartIcon className={`h-6 w-6 ${healthData?.healthy ? 'text-success-500' : 'text-danger-500'}`} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cluster Health</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{healthData?.cluster_id}</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { setShowHealthModal(false); setHealthData(null); }}
                    className="p-1.5 rounded-lg hover:bg-gray-100/50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                  </motion.button>
                </div>

                {loadingHealth ? (
                  <div className="flex items-center justify-center py-12">
                    <ArrowPathIcon className="h-8 w-8 text-primary-500 animate-spin" />
                  </div>
                ) : healthData ? (
                  <div className="space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-center">
                      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                        healthData.healthy
                          ? 'bg-success-500/10 text-success-600 dark:text-success-400'
                          : 'bg-danger-500/10 text-danger-600 dark:text-danger-400'
                      }`}>
                        {healthData.healthy ? (
                          <CheckCircleIcon className="h-5 w-5" />
                        ) : (
                          <ExclamationCircleIcon className="h-5 w-5" />
                        )}
                        {healthData.healthy ? 'Healthy' : 'Unhealthy'}
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-slate-700/30 border border-gray-100/50 dark:border-slate-600/30">
                        <div className="flex items-center gap-2 mb-2">
                          <CpuChipIcon className="h-4 w-4 text-primary-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Nodes</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {healthData.ready_nodes}/{healthData.node_count}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Ready</p>
                      </div>

                      <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-slate-700/30 border border-gray-100/50 dark:border-slate-600/30">
                        <div className="flex items-center gap-2 mb-2">
                          <CircleStackIcon className="h-4 w-4 text-secondary-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Pods</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {healthData.running_pods}/{healthData.total_pods}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Running</p>
                      </div>

                      <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-slate-700/30 border border-gray-100/50 dark:border-slate-600/30">
                        <div className="flex items-center gap-2 mb-2">
                          <ServerStackIcon className="h-4 w-4 text-accent-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Namespaces</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {healthData.namespaces}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                      </div>

                      <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-slate-700/30 border border-gray-100/50 dark:border-slate-600/30">
                        <div className="flex items-center gap-2 mb-2">
                          <ClockIcon className="h-4 w-4 text-warning-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Checked</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(healthData.checked_at).toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(healthData.checked_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Warnings */}
                    {healthData.warnings && healthData.warnings.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Warnings</h3>
                        <div className="space-y-2">
                          {healthData.warnings.map((warning, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-2 p-3 rounded-xl bg-warning-500/10 border border-warning-500/20"
                            >
                              <ExclamationCircleIcon className="h-4 w-4 text-warning-500 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-warning-600 dark:text-warning-400">{warning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {healthData.error && (
                      <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/20">
                        <div className="flex items-start gap-2">
                          <ExclamationCircleIcon className="h-4 w-4 text-danger-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-danger-600 dark:text-danger-400">{healthData.error}</span>
                        </div>
                      </div>
                    )}

                    {/* Refresh Button */}
                    <div className="flex justify-center pt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => healthData && handleViewHealth(healthData.cluster_id)}
                        disabled={loadingHealth}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100/50 dark:bg-slate-700/50 rounded-xl hover:bg-gray-200/50 dark:hover:bg-slate-600/50 disabled:opacity-50 transition-all"
                      >
                        <ArrowPathIcon className={`h-4 w-4 ${loadingHealth ? 'animate-spin' : ''}`} />
                        Refresh
                      </motion.button>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
