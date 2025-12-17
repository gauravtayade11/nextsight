import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentDuplicateIcon,
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
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { kubernetesApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { ConfigMap, ConfigMapDetail } from '../../types';

export default function ConfigMapsManagement() {
  const { hasRole } = useAuth();
  const [configMaps, setConfigMaps] = useState<ConfigMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [expandedConfigMap, setExpandedConfigMap] = useState<string | null>(null);
  const [expandedConfigMapData, setExpandedConfigMapData] = useState<ConfigMapDetail | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<ConfigMap | null>(null);
  const [editData, setEditData] = useState<ConfigMapDetail | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<ConfigMap | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    namespace: 'default',
    data: [{ key: '', value: '' }],
  });

  const canManageConfigMaps = hasRole('operator');

  // Fetch configmaps from K8s cluster
  const fetchConfigMaps = useCallback(async () => {
    try {
      setError(null);
      const response = await kubernetesApi.getConfigMaps(
        namespaceFilter !== 'all' ? namespaceFilter : undefined
      );
      setConfigMaps(response.data);
    } catch (err) {
      logger.error('Failed to fetch configmaps', err);
      setError('Failed to fetch ConfigMaps from cluster. Make sure you have a cluster connected.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [namespaceFilter]);

  useEffect(() => {
    fetchConfigMaps();
  }, [fetchConfigMaps]);

  // Get unique namespaces
  const namespaces = useMemo(() => {
    const ns = new Set(configMaps.map(c => c.namespace));
    return ['all', ...Array.from(ns).sort()];
  }, [configMaps]);

  // Filter configmaps
  const filteredConfigMaps = useMemo(() => {
    return configMaps.filter(cm => {
      const matchesSearch =
        cm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cm.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cm.data_keys.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesNamespace = namespaceFilter === 'all' || cm.namespace === namespaceFilter;
      return matchesSearch && matchesNamespace;
    });
  }, [configMaps, searchQuery, namespaceFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchConfigMaps();
  };

  const toggleExpand = async (cmKey: string, cm: ConfigMap) => {
    if (expandedConfigMap === cmKey) {
      setExpandedConfigMap(null);
      setExpandedConfigMapData(null);
    } else {
      setExpandedConfigMap(cmKey);
      // Fetch full configmap data
      try {
        const response = await kubernetesApi.getConfigMap(cm.namespace, cm.name);
        setExpandedConfigMapData(response.data);
      } catch (err) {
        logger.error('Failed to fetch configmap details', err);
      }
    }
  };

  const copyToClipboard = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDelete = async (cm: ConfigMap) => {
    try {
      await kubernetesApi.deleteConfigMap(cm.namespace, cm.name);
      setConfigMaps(prev => prev.filter(c => !(c.name === cm.name && c.namespace === cm.namespace)));
      setShowDeleteConfirm(null);
    } catch (err) {
      logger.error('Failed to delete configmap', err);
      setError('Failed to delete ConfigMap');
    }
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.namespace) {
      setError('Name and namespace are required');
      return;
    }

    setIsSaving(true);
    try {
      const data: Record<string, string> = {};
      createForm.data.forEach(item => {
        if (item.key) {
          data[item.key] = item.value;
        }
      });

      await kubernetesApi.createConfigMap({
        name: createForm.name,
        namespace: createForm.namespace,
        data,
      });

      setShowCreateModal(false);
      setCreateForm({ name: '', namespace: 'default', data: [{ key: '', value: '' }] });
      await fetchConfigMaps();
    } catch (err) {
      logger.error('Failed to create configmap', err);
      setError('Failed to create ConfigMap');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (cm: ConfigMap) => {
    try {
      const response = await kubernetesApi.getConfigMap(cm.namespace, cm.name);
      setEditData(response.data);
      setShowEditModal(cm);
    } catch (err) {
      logger.error('Failed to fetch configmap for editing', err);
      setError('Failed to fetch ConfigMap data');
    }
  };

  const handleUpdate = async () => {
    if (!showEditModal || !editData) return;

    setIsSaving(true);
    try {
      await kubernetesApi.updateConfigMap(showEditModal.namespace, showEditModal.name, {
        data: editData.data,
      });

      setShowEditModal(null);
      setEditData(null);
      await fetchConfigMaps();
    } catch (err) {
      logger.error('Failed to update configmap', err);
      setError('Failed to update ConfigMap');
    } finally {
      setIsSaving(false);
    }
  };

  const addDataField = () => {
    setCreateForm(prev => ({
      ...prev,
      data: [...prev.data, { key: '', value: '' }],
    }));
  };

  const removeDataField = (index: number) => {
    setCreateForm(prev => ({
      ...prev,
      data: prev.data.filter((_, i) => i !== index),
    }));
  };

  const updateDataField = (index: number, field: 'key' | 'value', value: string) => {
    setCreateForm(prev => ({
      ...prev,
      data: prev.data.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <ArrowPathIcon className="w-6 h-6 animate-spin" />
          <span>Loading ConfigMaps from cluster...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DocumentDuplicateIcon className="w-7 h-7 text-blue-500" />
            Kubernetes ConfigMaps
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            View and manage ConfigMaps from your Kubernetes cluster
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </motion.button>
          {canManageConfigMaps && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Create ConfigMap
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
          <div className="flex-1">
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-400/80 text-sm mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search ConfigMaps by name, namespace, or key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-5 h-5 text-gray-400" />
          <select
            value={namespaceFilter}
            onChange={(e) => setNamespaceFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {namespaces.map(ns => (
              <option key={ns} value={ns}>
                {ns === 'all' ? 'All Namespaces' : ns}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Total ConfigMaps</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{configMaps.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Namespaces</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{namespaces.length - 1}</p>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Filtered Results</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">{filteredConfigMaps.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Total Keys</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {configMaps.reduce((acc, c) => acc + c.data_count, 0)}
          </p>
        </div>
      </div>

      {/* ConfigMaps List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredConfigMaps.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-gray-400"
            >
              <DocumentDuplicateIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{configMaps.length === 0 ? 'No ConfigMaps found in the cluster' : 'No ConfigMaps match your filters'}</p>
            </motion.div>
          ) : (
            filteredConfigMaps.map((cm) => {
              const cmKey = `${cm.namespace}/${cm.name}`;
              const isExpanded = expandedConfigMap === cmKey;

              return (
                <motion.div
                  key={cmKey}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  {/* ConfigMap Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <DocumentDuplicateIcon className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{cm.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {cm.namespace} &bull; {cm.data_count} key{cm.data_count !== 1 ? 's' : ''} &bull; {cm.age}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleExpand(cmKey, cm)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                        title={isExpanded ? 'Hide data' : 'Show data'}
                      >
                        {isExpanded ? (
                          <EyeSlashIcon className="w-4 h-4" />
                        ) : (
                          <EyeIcon className="w-4 h-4" />
                        )}
                      </motion.button>
                      {canManageConfigMaps && (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleEdit(cm)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                            title="Edit ConfigMap"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setShowDeleteConfirm(cm)}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete ConfigMap"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </motion.button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded ConfigMap Data */}
                  <AnimatePresence>
                    {isExpanded && expandedConfigMapData && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                          {Object.entries(expandedConfigMapData.data).length === 0 ? (
                            <p className="text-gray-400 text-sm italic">No data keys in this ConfigMap</p>
                          ) : (
                            Object.entries(expandedConfigMapData.data).map(([key, value]) => (
                              <div
                                key={key}
                                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <code className="text-sm text-blue-600 dark:text-blue-400 font-mono font-medium">
                                    {key}
                                  </code>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => copyToClipboard(value, `${cmKey}-${key}`)}
                                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                                    title="Copy value"
                                  >
                                    {copiedKey === `${cmKey}-${key}` ? (
                                      <CheckIcon className="w-4 h-4 text-green-400" />
                                    ) : (
                                      <ClipboardDocumentIcon className="w-4 h-4" />
                                    )}
                                  </motion.button>
                                </div>
                                <pre className="text-xs text-gray-600 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto max-h-40">
                                  {value}
                                </pre>
                              </div>
                            ))
                          )}
                          {expandedConfigMapData.binary_data_keys.length > 0 && (
                            <div className="pt-2">
                              <p className="text-xs text-gray-500 mb-2">Binary data keys (values not shown):</p>
                              <div className="flex flex-wrap gap-2">
                                {expandedConfigMapData.binary_data_keys.map(key => (
                                  <span key={key} className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono">
                                    {key}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ConfigMap Labels */}
                  {Object.keys(cm.labels).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
                      {Object.entries(cm.labels).slice(0, 4).map(([k, v]) => (
                        <span
                          key={k}
                          className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 font-mono"
                        >
                          {k}={v}
                        </span>
                      ))}
                      {Object.keys(cm.labels).length > 4 && (
                        <span className="px-2 py-1 text-xs text-gray-500">
                          +{Object.keys(cm.labels).length - 4} more
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
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-full bg-red-500/20">
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Delete ConfigMap</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Are you sure you want to delete <span className="font-mono text-red-500">{showDeleteConfirm.name}</span> from <span className="font-mono text-blue-500">{showDeleteConfirm.namespace}</span>?
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                This action cannot be undone. Applications depending on this ConfigMap will fail.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                >
                  Delete ConfigMap
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
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create ConfigMap</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ConfigMap Name
                  </label>
                  <input
                    type="text"
                    placeholder="my-configmap"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Namespace
                  </label>
                  <select
                    value={createForm.namespace}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, namespace: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    {namespaces.filter(n => n !== 'all').map(ns => (
                      <option key={ns} value={ns}>{ns}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data (Key-Value pairs)
                  </label>
                  <div className="space-y-2">
                    {createForm.data.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="KEY"
                          value={item.key}
                          onChange={(e) => updateDataField(index, 'key', e.target.value)}
                          className="flex-1 px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm"
                        />
                        <textarea
                          placeholder="Value"
                          value={item.value}
                          onChange={(e) => updateDataField(index, 'value', e.target.value)}
                          rows={1}
                          className="flex-1 px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm resize-y"
                        />
                        {createForm.data.length > 1 && (
                          <button
                            onClick={() => removeDataField(index)}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addDataField}
                      className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-400"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Key-Value Pair
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Creating...' : 'Create ConfigMap'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && editData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => { setShowEditModal(null); setEditData(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Edit ConfigMap: <span className="text-blue-500">{showEditModal.name}</span>
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Namespace: {showEditModal.namespace}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data (Key-Value pairs)
                  </label>
                  <div className="space-y-3">
                    {Object.entries(editData.data).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400 font-mono">{key}</label>
                        <textarea
                          value={value}
                          onChange={(e) => setEditData(prev => prev ? {
                            ...prev,
                            data: { ...prev.data, [key]: e.target.value }
                          } : null)}
                          rows={3}
                          className="w-full px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm resize-y"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowEditModal(null); setEditData(null); }}
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
