import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { kubernetesApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { Secret } from '../../types';

export default function SecretsManagement() {
  const { hasRole } = useAuth();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedSecret, setExpandedSecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Secret | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canManageSecrets = hasRole('operator');

  // Fetch secrets from K8s cluster
  const fetchSecrets = useCallback(async () => {
    try {
      setError(null);
      const response = await kubernetesApi.getSecrets(
        namespaceFilter !== 'all' ? namespaceFilter : undefined
      );
      setSecrets(response.data);
    } catch (err) {
      logger.error('Failed to fetch secrets', err);
      setError('Failed to fetch secrets from cluster. Make sure you have a cluster connected.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [namespaceFilter]);

  useEffect(() => {
    fetchSecrets();
  }, [fetchSecrets]);

  // Get unique namespaces
  const namespaces = useMemo(() => {
    const ns = new Set(secrets.map(s => s.namespace));
    return ['all', ...Array.from(ns).sort()];
  }, [secrets]);

  // Get unique types
  const secretTypes = useMemo(() => {
    const types = new Set(secrets.map(s => s.type));
    return ['all', ...Array.from(types).sort()];
  }, [secrets]);

  // Filter secrets
  const filteredSecrets = useMemo(() => {
    return secrets.filter(secret => {
      const matchesSearch =
        secret.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        secret.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
        secret.data_keys.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesNamespace = namespaceFilter === 'all' || secret.namespace === namespaceFilter;
      const matchesType = typeFilter === 'all' || secret.type === typeFilter;
      return matchesSearch && matchesNamespace && matchesType;
    });
  }, [secrets, searchQuery, namespaceFilter, typeFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSecrets();
  };

  const toggleExpand = (secretKey: string) => {
    if (expandedSecret === secretKey) {
      setExpandedSecret(null);
    } else {
      setExpandedSecret(secretKey);
    }
  };

  const copyToClipboard = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDelete = async (secret: Secret) => {
    try {
      // In real implementation: await kubernetesApi.deleteSecret(secret.namespace, secret.name);
      setSecrets(prev => prev.filter(s => !(s.name === secret.name && s.namespace === secret.namespace)));
      setShowDeleteConfirm(null);
    } catch (err) {
      logger.error('Failed to delete secret', err);
    }
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'Opaque': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'kubernetes.io/tls': 'bg-green-500/20 text-green-400 border-green-500/30',
      'kubernetes.io/dockerconfigjson': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'kubernetes.io/service-account-token': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'kubernetes.io/basic-auth': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'kubernetes.io/ssh-auth': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getTypeDisplayName = (type: string): string => {
    const names: Record<string, string> = {
      'Opaque': 'Opaque',
      'kubernetes.io/tls': 'TLS',
      'kubernetes.io/dockerconfigjson': 'Docker Registry',
      'kubernetes.io/service-account-token': 'Service Account',
      'kubernetes.io/basic-auth': 'Basic Auth',
      'kubernetes.io/ssh-auth': 'SSH Auth',
    };
    return names[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <ArrowPathIcon className="w-6 h-6 animate-spin" />
          <span>Loading secrets from cluster...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <KeyIcon className="w-7 h-7 text-yellow-400" />
            Kubernetes Secrets
          </h1>
          <p className="text-gray-400 mt-1">
            View and manage secrets from your Kubernetes cluster
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
          {canManageSecrets && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-medium transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Create Secret
            </motion.button>
          )}
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

      {/* Security Warning */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
      >
        <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-yellow-400 font-medium">Security Notice</p>
          <p className="text-yellow-400/80 text-sm mt-1">
            Secret values are sensitive. Access to secret data is logged for audit purposes.
            Secret values are base64 encoded in Kubernetes.
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search secrets by name, namespace, or key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-400" />
            <select
              value={namespaceFilter}
              onChange={(e) => setNamespaceFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
            >
              {namespaces.map(ns => (
                <option key={ns} value={ns}>
                  {ns === 'all' ? 'All Namespaces' : ns}
                </option>
              ))}
            </select>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
          >
            {secretTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : getTypeDisplayName(type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Secrets</p>
          <p className="text-2xl font-bold text-white mt-1">{secrets.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Namespaces</p>
          <p className="text-2xl font-bold text-white mt-1">{namespaces.length - 1}</p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">TLS Certificates</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {secrets.filter(s => s.type === 'kubernetes.io/tls').length}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Keys</p>
          <p className="text-2xl font-bold text-white mt-1">
            {secrets.reduce((acc, s) => acc + s.data_count, 0)}
          </p>
        </div>
      </div>

      {/* Secrets List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredSecrets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-gray-400"
            >
              <KeyIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{secrets.length === 0 ? 'No secrets found in the cluster' : 'No secrets match your filters'}</p>
            </motion.div>
          ) : (
            filteredSecrets.map((secret) => {
              const secretKey = `${secret.namespace}/${secret.name}`;
              const isExpanded = expandedSecret === secretKey;

              return (
                <motion.div
                  key={secretKey}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  {/* Secret Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-yellow-500/20">
                        <KeyIcon className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{secret.name}</h3>
                        <p className="text-sm text-gray-400">
                          {secret.namespace} &bull; {secret.data_count} key{secret.data_count !== 1 ? 's' : ''} &bull; {secret.age}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 text-xs rounded-full border ${getTypeColor(secret.type)}`}>
                        {getTypeDisplayName(secret.type)}
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleExpand(secretKey)}
                        className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title={isExpanded ? 'Hide keys' : 'Show keys'}
                      >
                        {isExpanded ? (
                          <EyeSlashIcon className="w-4 h-4" />
                        ) : (
                          <EyeIcon className="w-4 h-4" />
                        )}
                      </motion.button>
                      {canManageSecrets && (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                            title="Edit secret"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setShowDeleteConfirm(secret)}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete secret"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </motion.button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Secret Keys */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
                          <p className="text-xs text-gray-500 mb-3">
                            Data Keys (values are base64 encoded in Kubernetes):
                          </p>
                          {secret.data_keys.map((key) => (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-900/50"
                            >
                              <code className="text-sm text-cyan-400 font-mono">
                                {key}
                              </code>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => copyToClipboard(key, `${secretKey}-${key}`)}
                                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                                title="Copy key name"
                              >
                                {copiedKey === `${secretKey}-${key}` ? (
                                  <CheckIcon className="w-4 h-4 text-green-400" />
                                ) : (
                                  <ClipboardDocumentIcon className="w-4 h-4" />
                                )}
                              </motion.button>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Secret Labels */}
                  {Object.keys(secret.labels).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap gap-2">
                      {Object.entries(secret.labels).slice(0, 4).map(([k, v]) => (
                        <span
                          key={k}
                          className="px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-400 font-mono"
                        >
                          {k}={v}
                        </span>
                      ))}
                      {Object.keys(secret.labels).length > 4 && (
                        <span className="px-2 py-1 text-xs text-gray-500">
                          +{Object.keys(secret.labels).length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-full bg-red-500/20">
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Delete Secret</h3>
              </div>
              <p className="text-gray-300 mb-2">
                Are you sure you want to delete <span className="font-mono text-red-400">{showDeleteConfirm.name}</span> from <span className="font-mono text-yellow-400">{showDeleteConfirm.namespace}</span>?
              </p>
              <p className="text-gray-400 text-sm mb-6">
                This action cannot be undone. Applications depending on this secret will fail.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                >
                  Delete Secret
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full border border-gray-700"
            >
              <h3 className="text-xl font-bold text-white mb-4">Create Secret</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Secret Name
                  </label>
                  <input
                    type="text"
                    placeholder="my-secret"
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Namespace
                    </label>
                    <select className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50">
                      {namespaces.filter(n => n !== 'all').map(ns => (
                        <option key={ns} value={ns}>{ns}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Type
                    </label>
                    <select className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50">
                      <option value="Opaque">Opaque</option>
                      <option value="kubernetes.io/tls">TLS</option>
                      <option value="kubernetes.io/dockerconfigjson">Docker Registry</option>
                      <option value="kubernetes.io/basic-auth">Basic Auth</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Data (Key-Value pairs)
                  </label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="KEY"
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 font-mono text-sm"
                      />
                      <input
                        type="password"
                        placeholder="Value"
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 font-mono text-sm"
                      />
                    </div>
                    <button className="flex items-center gap-2 text-sm text-yellow-400 hover:text-yellow-300">
                      <PlusIcon className="w-4 h-4" />
                      Add Key-Value Pair
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-medium transition-colors">
                  Create Secret
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
