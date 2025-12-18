import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LinkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  TrashIcon,
  XMarkIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../common/PageHeader';
import { settingsApi, Integration as ApiIntegration } from '../../services/api';
import { logger } from '../../utils/logger';

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  endpoint?: string;
}

export default function IntegrationPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectForm, setConnectForm] = useState({ endpoint: '', apiToken: '' });

  const integrationName = type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown';

  useEffect(() => {
    fetchIntegration();
  }, [type]);

  const fetchIntegration = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingsApi.listIntegrations();

      // Find the integration matching the type
      const found = response.data.find(
        (i: ApiIntegration) => i.name.toLowerCase() === type?.toLowerCase() || i.icon?.toLowerCase() === type?.toLowerCase()
      );

      if (found) {
        setIntegration({
          id: found.id,
          name: found.name,
          description: found.description || '',
          status: found.status,
          lastSync: found.last_sync ? new Date(found.last_sync).toLocaleString() : undefined,
        });
      } else {
        setError(`Integration "${type}" not found`);
      }
    } catch (err: any) {
      logger.error('Failed to fetch integration', err);
      setError(err.response?.data?.detail || 'Failed to load integration');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    setConnectForm({ endpoint: '', apiToken: '' });
    setShowConnectModal(true);
  };

  const handleSubmitConnect = async () => {
    if (!integration || !connectForm.endpoint) return;

    try {
      setIsConnecting(true);
      await settingsApi.connectIntegration(integration.id, {
        endpoint: connectForm.endpoint,
        api_token: connectForm.apiToken || undefined,
      });
      await fetchIntegration();
      setShowConnectModal(false);
    } catch (err: any) {
      logger.error('Failed to connect integration', err);
      setError(err.response?.data?.detail || 'Failed to connect integration');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;

    try {
      setIsConnecting(true);
      await settingsApi.disconnectIntegration(integration.id);
      await fetchIntegration();
    } catch (err: any) {
      logger.error('Failed to disconnect integration', err);
      setError(err.response?.data?.detail || 'Failed to disconnect integration');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!integration) return;

    try {
      setIsConnecting(true);
      await settingsApi.checkIntegrationStatus(integration.id);
      await fetchIntegration();
    } catch (err: any) {
      logger.error('Failed to sync integration', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationCircleIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${integrationName} Integration`}
        description={`Manage your ${integrationName} connection and settings`}
        icon={LinkIcon}
        iconColor="blue"
        actions={
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/integrations')}
              className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </motion.button>
            {integration?.status === 'disconnected' ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50"
              >
                {isConnecting ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusIcon className="h-4 w-4" />
                )}
                {isConnecting ? 'Connecting...' : `Connect ${integrationName}`}
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSync}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isConnecting ? 'animate-spin' : ''}`} />
                Sync Now
              </motion.button>
            )}
          </div>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Integration Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 via-primary-500/5 to-purple-500/10 border border-blue-500/20"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/20">
            <LinkIcon className="h-6 w-6 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {integrationName} Integration
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {integration?.description || `Connect your ${integrationName} account to enable CI/CD pipelines, automation, and GitOps workflows.`}
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                Auto sync
              </div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                Webhook events
              </div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                API integration
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Connection Status */}
      {integration && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Connection Status
          </h3>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border ${
              integration.status === 'error'
                ? 'border-red-500/50'
                : integration.status === 'connected'
                ? 'border-green-500/50'
                : 'border-gray-200/50 dark:border-slate-700/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-700">
                  <LinkIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {integration.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {integration.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(integration.status)}
                  <span className={`text-sm font-medium ${
                    integration.status === 'connected'
                      ? 'text-green-600 dark:text-green-400'
                      : integration.status === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500'
                  }`}>
                    {getStatusText(integration.status)}
                  </span>
                </div>
                {integration.lastSync && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Synced {integration.lastSync}
                  </span>
                )}
                {integration.status !== 'disconnected' && (
                  <div className="flex items-center gap-1">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleSync}
                      disabled={isConnecting}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 disabled:opacity-50"
                      title="Sync now"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${isConnecting ? 'animate-spin' : ''}`} />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500"
                      title="Settings"
                    >
                      <Cog6ToothIcon className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleDisconnect}
                      disabled={isConnecting}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 disabled:opacity-50"
                      title="Disconnect"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Webhooks Section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Webhook Configuration
        </h3>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                Webhook URL
              </h4>
              <code className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                {window.location.origin}/api/webhooks/{type}
              </code>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/${type}`)}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            >
              Copy URL
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Connect {integrationName}
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <XMarkIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Endpoint URL *
                </label>
                <input
                  type="url"
                  value={connectForm.endpoint}
                  onChange={(e) => setConnectForm(f => ({ ...f, endpoint: e.target.value }))}
                  placeholder={`https://api.${type?.toLowerCase()}.com`}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Token (optional)
                </label>
                <input
                  type="password"
                  value={connectForm.apiToken}
                  onChange={(e) => setConnectForm(f => ({ ...f, apiToken: e.target.value }))}
                  placeholder="Enter API token"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConnectModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitConnect}
                disabled={!connectForm.endpoint || isConnecting}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
