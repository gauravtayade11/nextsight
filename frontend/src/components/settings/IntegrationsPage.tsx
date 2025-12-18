import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LinkIcon,
  PlusIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  TrashIcon,
  CloudIcon,
  BeakerIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  BellIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../common/PageHeader';
import { settingsApi, Integration as ApiIntegration } from '../../services/api';
import { logger } from '../../utils/logger';

interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  config?: Record<string, string>;
  isManaged?: boolean;
  setupUrl?: string;
}

// Map API categories to display categories
const categoryMap: Record<string, string> = {
  'source-control': 'Source Control',
  'ci-cd': 'CI/CD',
  'monitoring': 'Monitoring',
  'logging': 'Logging',
  'cloud': 'Cloud',
  'notification': 'Notifications',
};

// Icon mapping for integrations
const iconMap: Record<string, string> = {
  'github': '🐙',
  'gitlab': '🦊',
  'argocd': '🔄',
  'helm': '⎈',
  'jenkins': '🔧',
  'grafana': '📈',
  'prometheus': '📊',
  'loki': '📝',
  'aws': '☁️',
  'azure': '🌐',
  'gcp': '🔷',
  'slack': '💬',
};

// Tab configuration
const tabs = [
  { id: 'all', label: 'All', icon: LinkIcon },
  { id: 'source-control', label: 'Source Control', icon: LinkIcon },
  { id: 'ci-cd', label: 'CI/CD', icon: BeakerIcon },
  { id: 'monitoring', label: 'Monitoring', icon: ChartBarIcon },
  { id: 'logging', label: 'Logging', icon: ChartBarIcon },
  { id: 'cloud', label: 'Cloud', icon: CloudIcon },
  { id: 'notification', label: 'Notifications', icon: BellIcon },
];

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [connectForm, setConnectForm] = useState({ endpoint: '', apiToken: '' });

  // Fetch integrations from API
  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await settingsApi.listIntegrations();

      // Transform API response to local format
      const transformed = response.data.map((item: ApiIntegration) => ({
        id: item.id,
        name: item.name,
        category: categoryMap[item.category] || item.category,
        description: item.description || '',
        icon: iconMap[item.icon?.toLowerCase() || ''] || '🔗',
        status: item.status,
        lastSync: item.last_sync ? new Date(item.last_sync).toLocaleString() : undefined,
        isManaged: item.is_managed,
        setupUrl: item.setup_url,
        config: item.config as Record<string, string> | undefined,
      }));

      setIntegrations(transformed);
    } catch (err: any) {
      logger.error('Failed to fetch integrations', err);
      setError(err.response?.data?.detail || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (integration: Integration) => {
    // For managed integrations, navigate to the setup wizard
    if (integration.isManaged && integration.setupUrl) {
      navigate(integration.setupUrl);
      return;
    }
    // For external integrations, show connect modal
    setSelectedIntegration(integration);
    setConnectForm({ endpoint: '', apiToken: '' });
    setShowConnectModal(true);
  };

  const handleSubmitConnect = async () => {
    if (!selectedIntegration || !connectForm.endpoint) return;

    try {
      setConnectingId(selectedIntegration.id);
      await settingsApi.connectIntegration(selectedIntegration.id, {
        endpoint: connectForm.endpoint,
        api_token: connectForm.apiToken || undefined,
      });
      await fetchIntegrations();
      setShowConnectModal(false);
    } catch (err: any) {
      logger.error('Failed to connect integration', err);
      setError(err.response?.data?.detail || 'Failed to connect integration');
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      setConnectingId(id);
      await settingsApi.disconnectIntegration(id);
      await fetchIntegrations();
    } catch (err: any) {
      logger.error('Failed to disconnect integration', err);
      setError(err.response?.data?.detail || 'Failed to disconnect integration');
    } finally {
      setConnectingId(null);
    }
  };

  const handleSync = async (id: string) => {
    try {
      setConnectingId(id);
      await settingsApi.checkIntegrationStatus(id);
      await fetchIntegrations();
    } catch (err: any) {
      logger.error('Failed to sync integration', err);
    } finally {
      setConnectingId(null);
    }
  };

  const handleEdit = (integration: Integration) => {
    setSelectedIntegration(integration);
    setConnectForm({
      endpoint: integration.config?.endpoint || '',
      apiToken: integration.config?.api_token || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedIntegration) return;

    try {
      setConnectingId(selectedIntegration.id);
      await settingsApi.connectIntegration(selectedIntegration.id, {
        endpoint: connectForm.endpoint,
        api_token: connectForm.apiToken || undefined,
      });
      await fetchIntegrations();
      setShowEditModal(false);
    } catch (err: any) {
      logger.error('Failed to update integration', err);
      setError(err.response?.data?.detail || 'Failed to update integration');
    } finally {
      setConnectingId(null);
    }
  };

  // Map tab id to category name
  const tabToCategory: Record<string, string | null> = {
    'all': null,
    'source-control': 'Source Control',
    'ci-cd': 'CI/CD',
    'monitoring': 'Monitoring',
    'logging': 'Logging',
    'cloud': 'Cloud',
    'notification': 'Notifications',
  };

  const selectedCategory = tabToCategory[activeTab];

  const connectedIntegrations = integrations.filter(i => i.status === 'connected' || i.status === 'error');
  const availableIntegrations = integrations.filter(i => i.status === 'disconnected');

  const filteredConnected = connectedIntegrations.filter(
    i => !selectedCategory || i.category === selectedCategory
  );

  const filteredAvailable = availableIntegrations.filter(
    i => !selectedCategory || i.category === selectedCategory
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Source Control': return LinkIcon;
      case 'CI/CD': return BeakerIcon;
      case 'Monitoring': return ChartBarIcon;
      case 'Logging': return ChartBarIcon;
      case 'Notifications': return BellIcon;
      case 'Cloud': return CloudIcon;
      default: return LinkIcon;
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
        title="Integrations"
        description="Connect external services and tools to NextSight AI"
        icon={LinkIcon}
        iconColor="blue"
        actions={
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchIntegrations}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </motion.button>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 pb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Connected Integrations */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Connected Integrations ({filteredConnected.length})
        </h3>

        {filteredConnected.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-8 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 text-center"
          >
            <div className="p-4 rounded-2xl bg-gray-100 dark:bg-slate-700 w-fit mx-auto mb-4">
              <LinkIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {selectedCategory ? `No ${selectedCategory} Integrations` : 'No Integrations Connected'}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Connect an integration below to get started
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConnected.map((integration, index) => (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border ${
                  integration.status === 'error'
                    ? 'border-red-500/50'
                    : 'border-gray-200/50 dark:border-slate-700/50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{integration.icon}</span>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{integration.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{integration.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {integration.status === 'connected' ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{integration.description}</p>
                {integration.lastSync && (
                  <p className="text-xs text-gray-400 mb-3">Last synced: {integration.lastSync}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    integration.status === 'connected'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  }`}>
                    {integration.status === 'connected' ? 'Connected' : 'Error'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSync(integration.id)}
                      disabled={connectingId === integration.id}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-4 w-4 ${connectingId === integration.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleEdit(integration)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400"
                      title="Configure"
                    >
                      <Cog6ToothIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      disabled={connectingId === integration.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Available Integrations */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Available Integrations ({filteredAvailable.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredAvailable.map((integration, index) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border transition-colors ${
                integration.isManaged
                  ? 'border-purple-500/30 hover:border-purple-500/50'
                  : 'border-gray-200/50 dark:border-slate-700/50 hover:border-blue-500/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{integration.icon}</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{integration.name}</h4>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{integration.category}</p>
                  </div>
                </div>
                {integration.isManaged && (
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                    Managed
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{integration.description}</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleConnect(integration)}
                disabled={connectingId === integration.id}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 ${
                  integration.isManaged
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                    : 'border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                {connectingId === integration.id ? (
                  <ArrowPathIcon className="h-3 w-3 animate-spin" />
                ) : integration.isManaged ? (
                  <Cog6ToothIcon className="h-3 w-3" />
                ) : (
                  <PlusIcon className="h-3 w-3" />
                )}
                {integration.isManaged ? 'Setup' : 'Connect'}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Connect {selectedIntegration.name}
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
                  placeholder="https://api.example.com"
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
                disabled={!connectForm.endpoint || connectingId !== null}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {connectingId ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit/Configure Modal */}
      {showEditModal && selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedIntegration.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Configure {selectedIntegration.name}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedIntegration.status === 'connected'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  }`}>
                    {selectedIntegration.status === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <XMarkIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Show current config info */}
            {selectedIntegration.config?.auto_detected && (
              <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Auto-detected</strong> in namespace: {selectedIntegration.config?.namespace || 'unknown'}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Service: {selectedIntegration.config?.service || 'unknown'}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  value={connectForm.endpoint}
                  onChange={(e) => setConnectForm(f => ({ ...f, endpoint: e.target.value }))}
                  placeholder="https://api.example.com"
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

              {selectedIntegration.lastSync && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last synced: {selectedIntegration.lastSync}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!connectForm.endpoint || connectingId !== null}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {connectingId ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
