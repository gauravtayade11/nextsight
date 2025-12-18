import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../common/GlassCard';
import { argocdApi } from '../../services/api';
import type {
  ArgoCDStatus,
  ArgoCDApplicationSummary,
  ArgoCDApplication,
  ArgoCDRevisionHistory,
  ArgoCDProjectSummary,
  ArgoCDDeploymentStatus,
} from '../../types';
import {
  ArrowPathRoundedSquareIcon,
  CodeBracketSquareIcon,
  CloudArrowUpIcon,
  CheckBadgeIcon,
  ClockIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUturnLeftIcon,
  EyeIcon,
  ServerStackIcon,
  LinkIcon,
  XMarkIcon,
  FolderIcon,
  RocketLaunchIcon,
  CubeIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

// Import shared constants
import { containerVariants, itemVariants } from '../../utils/constants';
import { logger } from '../../utils/logger';

// Health status colors
const healthStatusColors: Record<string, string> = {
  Healthy: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20',
  Progressing: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20',
  Degraded: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20',
  Suspended: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/20',
  Missing: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/20',
  Unknown: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/20',
};

// Sync status colors
const syncStatusColors: Record<string, string> = {
  Synced: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20',
  OutOfSync: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20',
  Unknown: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/20',
};

// Health status icons
const HealthIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'Healthy':
      return <CheckCircleIcon className="h-4 w-4" />;
    case 'Progressing':
      return <ArrowPathIcon className="h-4 w-4 animate-spin" />;
    case 'Degraded':
      return <XCircleIcon className="h-4 w-4" />;
    case 'Suspended':
      return <ClockIcon className="h-4 w-4" />;
    default:
      return <ExclamationTriangleIcon className="h-4 w-4" />;
  }
};

export default function ArgoCDDeploy() {
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ArgoCDStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    serverUrl: '',
    token: '',
    username: '',
    password: '',
    insecure: false,
    authMethod: 'token' as 'token' | 'basic',
  });

  // Deployment state (for deploying ArgoCD itself)
  const [deploymentStatus, setDeploymentStatus] = useState<ArgoCDDeploymentStatus | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployForm, setDeployForm] = useState({
    namespace: 'argocd',
    release_name: 'argocd',
    expose_type: 'ClusterIP' as 'ClusterIP' | 'LoadBalancer' | 'NodePort',
    ha_enabled: false,
    insecure: true,
  });
  const [deployResult, setDeployResult] = useState<{
    success: boolean;
    admin_password?: string;
    server_url?: string;
  } | null>(null);

  // Application state
  const [applications, setApplications] = useState<ArgoCDApplicationSummary[]>([]);
  const [selectedApp, setSelectedApp] = useState<ArgoCDApplication | null>(null);
  const [selectedAppHistory, setSelectedAppHistory] = useState<ArgoCDRevisionHistory[]>([]);
  const [projects, setProjects] = useState<ArgoCDProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');

  // Create application form
  const [createForm, setCreateForm] = useState({
    name: '',
    project: 'default',
    repoURL: '',
    path: '',
    targetRevision: 'HEAD',
    destServer: 'https://kubernetes.default.svc',
    destNamespace: 'default',
    autoSync: false,
    selfHeal: false,
    prune: false,
  });

  // Check connection and deployment status on mount
  useEffect(() => {
    const initialize = async () => {
      await Promise.all([
        checkConnectionStatus(),
        checkDeploymentStatus(),
      ]);
    };
    initialize();
  }, []);

  // Auto-connect when ArgoCD is deployed but not connected
  useEffect(() => {
    logger.debug('[ArgoCDDeploy] Auto-connect check', {
      deployed: deploymentStatus?.deployed,
      connected: connectionStatus?.connected,
      serverUrl: deploymentStatus?.server_url,
    });

    if (deploymentStatus?.deployed && !connectionStatus?.connected && deploymentStatus.server_url) {
      logger.debug('[ArgoCDDeploy] Conditions met - triggering auto-connect modal');
      // Try to auto-connect with the deployed ArgoCD
      const autoConnect = async () => {
        try {
          // Check if it's an internal cluster URL and convert to localhost
          let serverUrl = deploymentStatus.server_url;
          if (serverUrl.includes('.svc.cluster.local')) {
            // Internal cluster URL - use localhost with port-forward
            serverUrl = 'http://localhost:8080';
            logger.debug('[ArgoCDDeploy] Detected internal cluster URL, using localhost:8080 instead');
          }

          // Pre-fill the config form with detected values
          setConfigForm(prev => ({
            ...prev,
            serverUrl: serverUrl,
            username: 'admin',
            authMethod: 'basic',
            insecure: true,
          }));
          logger.debug('[ArgoCDDeploy] Config form pre-filled, showing modal');
          // Show the config modal to let user enter password
          setShowConfigModal(true);
        } catch (err) {
          logger.error('Auto-connect setup failed', err);
        }
      };
      autoConnect();
    } else {
      logger.debug('[ArgoCDDeploy] Auto-connect conditions NOT met');
    }
  }, [deploymentStatus, connectionStatus]);

  const checkConnectionStatus = async () => {
    try {
      const response = await argocdApi.getStatus();
      logger.debug('[ArgoCDDeploy] Connection status response', response.data);
      setConnectionStatus(response.data);
      if (response.data.connected) {
        loadApplications();
        loadProjects();
      }
    } catch (error) {
      logger.error('[ArgoCDDeploy] Failed to check connection status', error);
      setConnectionStatus({ connected: false, message: 'Unable to check status' });
    }
  };

  const checkDeploymentStatus = async () => {
    try {
      const response = await argocdApi.getDeploymentStatus();
      logger.debug('[ArgoCDDeploy] Deployment status response', response.data);
      setDeploymentStatus(response.data);
    } catch (error) {
      logger.error('[ArgoCDDeploy] Failed to check deployment status', error);
      setDeploymentStatus({ deployed: false });
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setError(null);

    try {
      const response = await argocdApi.deployArgoCD(deployForm);
      if (response.data.success) {
        setDeployResult({
          success: true,
          admin_password: response.data.admin_password,
          server_url: response.data.server_url,
        });

        // Auto-configure connection after successful deployment
        if (response.data.server_url && response.data.admin_password) {
          try {
            const configResponse = await argocdApi.configure({
              serverUrl: response.data.server_url,
              username: 'admin',
              password: response.data.admin_password,
              insecure: deployForm.insecure,
            });
            setConnectionStatus(configResponse.data);

            // Load applications and projects if connected
            if (configResponse.data.connected) {
              await Promise.all([
                loadApplications(),
                loadProjects(),
              ]);
            }
          } catch (configErr) {
            logger.warn('Auto-configuration failed, but deployment succeeded', configErr);
          }
        }

        // Refresh statuses
        await checkDeploymentStatus();
        await checkConnectionStatus();
      } else {
        setError(response.data.message);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Deployment failed';
      setError(errorMessage);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleUninstall = async () => {
    if (!confirm('Are you sure you want to uninstall ArgoCD? This will remove all applications and data.')) {
      return;
    }

    try {
      await argocdApi.uninstallArgoCD(deployForm.namespace, deployForm.release_name, true);
      setDeploymentStatus({ deployed: false });
      setConnectionStatus({ connected: false, message: 'ArgoCD uninstalled' });
      setApplications([]);
      setProjects([]);
    } catch (err) {
      logger.error('Failed to uninstall ArgoCD', err);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const config = {
        serverUrl: configForm.serverUrl,
        token: configForm.authMethod === 'token' ? configForm.token : undefined,
        username: configForm.authMethod === 'basic' ? configForm.username : undefined,
        password: configForm.authMethod === 'basic' ? configForm.password : undefined,
        insecure: configForm.insecure,
      };

      const response = await argocdApi.configure(config);
      setConnectionStatus(response.data);

      if (response.data.connected) {
        setShowConfigModal(false);
        loadApplications();
        loadProjects();
      } else {
        setError(response.data.message || 'Failed to connect');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await argocdApi.disconnect();
      setConnectionStatus({ connected: false, message: 'Disconnected' });
      setApplications([]);
      setProjects([]);
    } catch (err) {
      logger.error('Failed to disconnect', err);
    }
  };

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Safety timeout - force loading to false after 35 seconds
    const timeoutId = setTimeout(() => {
      logger.warn('[ArgoCDDeploy] Loading timeout - forcing loading state to false');
      setLoading(false);
      setError('Request timed out. Please try again.');
    }, 35000);

    try {
      const response = await argocdApi.listApplications(selectedProject || undefined);
      clearTimeout(timeoutId);
      setApplications(response.data.applications);
      setError(null);
    } catch (err: any) {
      clearTimeout(timeoutId);
      logger.error('Failed to load applications', err);
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to load applications';
      setError(errorMessage);
      setApplications([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const response = await argocdApi.listProjects();
      setProjects(response.data.projects);
    } catch (err) {
      logger.error('Failed to load projects', err);
    }
  };

  useEffect(() => {
    if (connectionStatus?.connected) {
      loadApplications();
    }
  }, [selectedProject, connectionStatus?.connected, loadApplications]);

  const handleViewApplication = async (name: string) => {
    try {
      const [appResponse, historyResponse] = await Promise.all([
        argocdApi.getApplication(name),
        argocdApi.getApplicationHistory(name),
      ]);
      setSelectedApp(appResponse.data);
      setSelectedAppHistory(historyResponse.data.history);
      setShowDetailModal(true);
    } catch (err) {
      logger.error('Failed to load application', err);
    }
  };

  const handleSyncApplication = async (name: string) => {
    setSyncing(name);
    try {
      await argocdApi.syncApplication(name);
      await loadApplications();
    } catch (err) {
      logger.error('Failed to sync application', err);
    } finally {
      setSyncing(null);
    }
  };

  const handleRefreshApplication = async (name: string) => {
    setRefreshing(name);
    try {
      await argocdApi.refreshApplication(name);
      await loadApplications();
    } catch (err) {
      logger.error('Failed to refresh application', err);
    } finally {
      setRefreshing(null);
    }
  };

  const handleDeleteApplication = async (name: string) => {
    if (!confirm(`Are you sure you want to delete application "${name}"?`)) {
      return;
    }

    try {
      await argocdApi.deleteApplication(name);
      await loadApplications();
      setShowDetailModal(false);
    } catch (err) {
      logger.error('Failed to delete application', err);
    }
  };

  const handleRollback = async (name: string, revisionId: number) => {
    if (!confirm(`Rollback "${name}" to revision ${revisionId}?`)) {
      return;
    }

    try {
      await argocdApi.rollbackApplication(name, { id: revisionId });
      await loadApplications();
      if (selectedApp?.name === name) {
        handleViewApplication(name);
      }
    } catch (err) {
      logger.error('Failed to rollback application', err);
    }
  };

  const handleCreateApplication = async () => {
    try {
      await argocdApi.createApplication(createForm);
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        project: 'default',
        repoURL: '',
        path: '',
        targetRevision: 'HEAD',
        destServer: 'https://kubernetes.default.svc',
        destNamespace: 'default',
        autoSync: false,
        selfHeal: false,
        prune: false,
      });
      await loadApplications();
    } catch (err) {
      logger.error('Failed to create application', err);
    }
  };

  // Not connected - show configuration options
  if (!connectionStatus?.connected) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Deployment Success Result */}
        {deployResult?.success && (
          <motion.div variants={itemVariants}>
            <GlassCard className="p-6 border-2 border-green-500/30 bg-green-50/50 dark:bg-green-500/10">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-xl bg-green-100 dark:bg-green-500/20">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">
                    ArgoCD Deployed Successfully!
                  </h3>
                  <div className="space-y-2 text-sm">
                    {deployResult.server_url && (
                      <p className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Server URL:</span> {deployResult.server_url}
                      </p>
                    )}
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Username:</span> admin
                    </p>
                    {deployResult.admin_password && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-600 dark:text-gray-400">Password:</span>
                        <code className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded text-xs">
                          {deployResult.admin_password}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(deployResult.admin_password!)}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                    Save these credentials - the password won't be shown again after you close this.
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Main Banner */}
        <motion.div variants={itemVariants}>
          <GlassCard className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-purple-500/5 to-pink-500/5" />
            <div className="relative p-8 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 mb-6"
              >
                <ArrowPathRoundedSquareIcon className="h-10 w-10 text-primary-600 dark:text-primary-400" />
              </motion.div>

              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-2xl font-bold text-gray-900 dark:text-white mb-3"
              >
                ArgoCD Integration
              </motion.h2>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-6"
              >
                Deploy a new ArgoCD instance or connect to an existing one to manage GitOps deployments.
              </motion.p>

              {/* Two options: Deploy New or Connect Existing */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <button
                  onClick={() => setShowDeployModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
                >
                  <RocketLaunchIcon className="h-5 w-5" />
                  Deploy ArgoCD
                </button>
                <span className="text-gray-400">or</span>
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 font-medium transition-colors"
                >
                  <LinkIcon className="h-5 w-5" />
                  Connect Existing
                </button>
              </motion.div>

              {/* Deployment status indicator */}
              {deploymentStatus?.deployed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-sm"
                >
                  <CubeIcon className="h-4 w-4" />
                  ArgoCD is deployed (v{deploymentStatus.app_version || deploymentStatus.chart_version})
                  <span className="mx-2">•</span>
                  <button
                    onClick={() => {
                      if (deploymentStatus.server_url) {
                        setConfigForm(prev => ({
                          ...prev,
                          serverUrl: deploymentStatus.server_url!,
                          authMethod: 'basic',
                          username: 'admin',
                        }));
                        setShowConfigModal(true);
                      }
                    }}
                    className="underline hover:no-underline"
                  >
                    Connect
                  </button>
                </motion.div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Features Preview */}
        <motion.div variants={itemVariants}>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: CodeBracketSquareIcon,
                title: 'GitOps Workflows',
                description: 'Declarative continuous delivery with Git as the source of truth',
              },
              {
                icon: ArrowPathRoundedSquareIcon,
                title: 'Automated Sync',
                description: 'Automatic synchronization of application state with Git repository',
              },
              {
                icon: CheckBadgeIcon,
                title: 'Health Monitoring',
                description: 'Real-time health status and drift detection for all applications',
              },
              {
                icon: ClockIcon,
                title: 'Rollback & History',
                description: 'Easy rollback to any previous version with full deployment history',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <GlassCard className="p-5 h-full" variant="hover">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-primary-100 dark:bg-primary-500/10 flex-shrink-0">
                      <feature.icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Configuration Modal */}
        <AnimatePresence>
          {showConfigModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              onClick={() => setShowConfigModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <GlassCard className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Connect to ArgoCD
                    </h3>
                    <button
                      onClick={() => setShowConfigModal(false)}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Server URL
                      </label>
                      <input
                        type="url"
                        value={configForm.serverUrl}
                        onChange={(e) => setConfigForm({ ...configForm, serverUrl: e.target.value })}
                        placeholder="https://argocd.example.com"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Authentication Method
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            value="token"
                            checked={configForm.authMethod === 'token'}
                            onChange={(e) => setConfigForm({ ...configForm, authMethod: e.target.value as 'token' | 'basic' })}
                            className="text-primary-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">API Token</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            value="basic"
                            checked={configForm.authMethod === 'basic'}
                            onChange={(e) => setConfigForm({ ...configForm, authMethod: e.target.value as 'token' | 'basic' })}
                            className="text-primary-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Username/Password</span>
                        </label>
                      </div>
                    </div>

                    {configForm.authMethod === 'token' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          API Token
                        </label>
                        <input
                          type="password"
                          value={configForm.token}
                          onChange={(e) => setConfigForm({ ...configForm, token: e.target.value })}
                          placeholder="Enter API token"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Username
                          </label>
                          <input
                            type="text"
                            value={configForm.username}
                            onChange={(e) => setConfigForm({ ...configForm, username: e.target.value })}
                            placeholder="admin"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Password
                          </label>
                          <input
                            type="password"
                            value={configForm.password}
                            onChange={(e) => setConfigForm({ ...configForm, password: e.target.value })}
                            placeholder="Enter password"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                      </>
                    )}

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={configForm.insecure}
                        onChange={(e) => setConfigForm({ ...configForm, insecure: e.target.checked })}
                        className="rounded text-primary-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Skip TLS verification (insecure)
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowConfigModal(false)}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConnect}
                      disabled={isConnecting || !configForm.serverUrl}
                      className="flex-1 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isConnecting ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect'
                      )}
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Deploy Modal */}
        <AnimatePresence>
          {showDeployModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              onClick={() => setShowDeployModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <GlassCard className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Deploy ArgoCD
                    </h3>
                    <button
                      onClick={() => setShowDeployModal(false)}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Namespace
                        </label>
                        <input
                          type="text"
                          value={deployForm.namespace}
                          onChange={(e) => setDeployForm({ ...deployForm, namespace: e.target.value })}
                          placeholder="argocd"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Release Name
                        </label>
                        <input
                          type="text"
                          value={deployForm.release_name}
                          onChange={(e) => setDeployForm({ ...deployForm, release_name: e.target.value })}
                          placeholder="argocd"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Service Type
                      </label>
                      <select
                        value={deployForm.expose_type}
                        onChange={(e) => setDeployForm({ ...deployForm, expose_type: e.target.value as 'ClusterIP' | 'LoadBalancer' | 'NodePort' })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      >
                        <option value="ClusterIP">ClusterIP (Internal only)</option>
                        <option value="LoadBalancer">LoadBalancer (External IP)</option>
                        <option value="NodePort">NodePort</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={deployForm.ha_enabled}
                          onChange={(e) => setDeployForm({ ...deployForm, ha_enabled: e.target.checked })}
                          className="rounded text-primary-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Enable High Availability
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={deployForm.insecure}
                          onChange={(e) => setDeployForm({ ...deployForm, insecure: e.target.checked })}
                          className="rounded text-primary-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Disable TLS (for development)
                        </span>
                      </label>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-sm text-blue-700 dark:text-blue-400">
                      <p className="font-medium mb-1">What this will do:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Install ArgoCD via Helm chart</li>
                        <li>Create namespace "{deployForm.namespace}"</li>
                        <li>Generate admin credentials</li>
                        <li>Auto-connect after deployment</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowDeployModal(false)}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeploy}
                      disabled={isDeploying}
                      className="flex-1 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isDeploying ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          Deploying...
                        </>
                      ) : (
                        <>
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          Deploy
                        </>
                      )}
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Connected - show applications dashboard
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <GlassCard className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-start gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-green-100 dark:bg-green-500/20">
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  ArgoCD Connected
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {connectionStatus.serverUrl} • v{connectionStatus.version}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadApplications()}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400"
                title="Refresh"
              >
                <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
              >
                <PlusIcon className="h-4 w-4" />
                New App
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Disconnect
              </button>
              {deploymentStatus?.deployed && (
                <button
                  onClick={handleUninstall}
                  className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  title="Uninstall ArgoCD from cluster"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Project Filter */}
      {projects.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-3">
            <FolderIcon className="h-5 w-5 text-gray-500" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.name} value={project.name}>
                  {project.name}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {applications.length} application{applications.length !== 1 ? 's' : ''}
            </span>
          </div>
        </motion.div>
      )}

      {/* Applications Grid */}
      <motion.div variants={itemVariants}>
        {loading && applications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : applications.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Applications
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create your first ArgoCD application to get started
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
            >
              <PlusIcon className="h-4 w-4" />
              Create Application
            </button>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {applications.map((app) => (
              <motion.div
                key={app.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <GlassCard className="p-4 h-full" variant="hover">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ServerStackIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {app.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${healthStatusColors[app.healthStatus] || healthStatusColors.Unknown}`}>
                        <HealthIcon status={app.healthStatus} />
                        {app.healthStatus}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <LinkIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{app.repoURL}</span>
                    </div>
                    {app.path && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <FolderIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{app.path}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${syncStatusColors[app.syncStatus] || syncStatusColors.Unknown}`}>
                        {app.syncStatus}
                      </span>
                      {app.syncRevision && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          @ {app.syncRevision.substring(0, 7)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                    <button
                      onClick={() => handleViewApplication(app.name)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View
                    </button>
                    <button
                      onClick={() => handleSyncApplication(app.name)}
                      disabled={syncing === app.name}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${syncing === app.name ? 'animate-spin' : ''}`} />
                      Sync
                    </button>
                    <button
                      onClick={() => handleRefreshApplication(app.name)}
                      disabled={refreshing === app.name}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50"
                      title="Refresh"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${refreshing === app.name ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Create Application Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Create Application
                  </h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Application Name
                      </label>
                      <input
                        type="text"
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        placeholder="my-app"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Project
                      </label>
                      <select
                        value={createForm.project}
                        onChange={(e) => setCreateForm({ ...createForm, project: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      >
                        <option value="default">default</option>
                        {projects.map((p) => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Repository URL
                    </label>
                    <input
                      type="url"
                      value={createForm.repoURL}
                      onChange={(e) => setCreateForm({ ...createForm, repoURL: e.target.value })}
                      placeholder="https://github.com/org/repo"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Path
                      </label>
                      <input
                        type="text"
                        value={createForm.path}
                        onChange={(e) => setCreateForm({ ...createForm, path: e.target.value })}
                        placeholder="./manifests"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Target Revision
                      </label>
                      <input
                        type="text"
                        value={createForm.targetRevision}
                        onChange={(e) => setCreateForm({ ...createForm, targetRevision: e.target.value })}
                        placeholder="HEAD"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Destination Server
                    </label>
                    <input
                      type="text"
                      value={createForm.destServer}
                      onChange={(e) => setCreateForm({ ...createForm, destServer: e.target.value })}
                      placeholder="https://kubernetes.default.svc"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Destination Namespace
                    </label>
                    <input
                      type="text"
                      value={createForm.destNamespace}
                      onChange={(e) => setCreateForm({ ...createForm, destNamespace: e.target.value })}
                      placeholder="default"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm.autoSync}
                        onChange={(e) => setCreateForm({ ...createForm, autoSync: e.target.checked })}
                        className="rounded text-primary-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Enable Auto-Sync
                      </span>
                    </label>
                    {createForm.autoSync && (
                      <>
                        <label className="flex items-center gap-2 ml-6">
                          <input
                            type="checkbox"
                            checked={createForm.selfHeal}
                            onChange={(e) => setCreateForm({ ...createForm, selfHeal: e.target.checked })}
                            className="rounded text-primary-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Self Heal
                          </span>
                        </label>
                        <label className="flex items-center gap-2 ml-6">
                          <input
                            type="checkbox"
                            checked={createForm.prune}
                            onChange={(e) => setCreateForm({ ...createForm, prune: e.target.checked })}
                            className="rounded text-primary-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Prune Resources
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateApplication}
                    disabled={!createForm.name || !createForm.repoURL}
                    className="flex-1 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Application Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <ServerStackIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedApp.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {/* Status */}
                <div className="flex items-center gap-4 mb-6">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${healthStatusColors[selectedApp.status.health.status] || healthStatusColors.Unknown}`}>
                    <HealthIcon status={selectedApp.status.health.status} />
                    {selectedApp.status.health.status}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${syncStatusColors[selectedApp.status.sync.status] || syncStatusColors.Unknown}`}>
                    {selectedApp.status.sync.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Project</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedApp.project}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Namespace</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedApp.spec.destination.namespace}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Repository</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                        {selectedApp.spec.source.repoURL}
                      </p>
                    </div>
                    {selectedApp.spec.source.path && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Path</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedApp.spec.source.path}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Target Revision</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedApp.spec.source.targetRevision}
                      </p>
                    </div>
                  </div>
                </div>

                {/* History */}
                {selectedAppHistory.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Revision History
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedAppHistory.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-800"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              Revision {entry.id}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {entry.revision.substring(0, 7)} • {entry.deployedAt || 'N/A'}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRollback(selectedApp.name, entry.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                          >
                            <ArrowUturnLeftIcon className="h-3 w-3" />
                            Rollback
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resources */}
                {selectedApp.status.resources.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Resources ({selectedApp.status.resources.length})
                    </h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {selectedApp.status.resources.map((resource, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-900 dark:text-white">
                              {resource.kind}/{resource.name}
                            </span>
                            {resource.namespace && (
                              <span className="text-xs text-gray-500">
                                ({resource.namespace})
                              </span>
                            )}
                          </div>
                          {resource.health && (
                            <span className={`text-xs px-2 py-0.5 rounded ${healthStatusColors[resource.health] || ''}`}>
                              {resource.health}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                  <button
                    onClick={() => handleSyncApplication(selectedApp.name)}
                    disabled={syncing === selectedApp.name}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${syncing === selectedApp.name ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                  <button
                    onClick={() => handleRefreshApplication(selectedApp.name)}
                    disabled={refreshing === selectedApp.name}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${refreshing === selectedApp.name ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDeleteApplication(selectedApp.name)}
                    className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
