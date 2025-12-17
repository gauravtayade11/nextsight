import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { kubernetesApi } from '../../services/api';
import { logger } from '../../utils/logger';
import { useNamespace } from '../../contexts/NamespaceContext';
import { useAuth } from '../../contexts/AuthContext';
import type { ConfigMap, ConfigMapDetail, Secret, SecretDetail, Namespace } from '../../types';
import {
  ArrowPathIcon,
  DocumentDuplicateIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../common/PageHeader';

// Types
interface ConfigStats {
  configMaps: number;
  secrets: number;
  opaqueSecrets: number;
  tlsSecrets: number;
  totalKeys: number;
}

// Stats Card
function StatsCard({
  title,
  value,
  icon: Icon,
  color,
  index,
}: {
  title: string;
  value: number;
  icon: typeof DocumentDuplicateIcon;
  color: 'blue' | 'yellow' | 'green' | 'purple';
  index: number;
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Modal Component
function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Secret Type Badge
function SecretTypeBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    'Opaque': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Opaque' },
    'kubernetes.io/tls': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'TLS' },
    'kubernetes.io/dockerconfigjson': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Docker' },
    'kubernetes.io/service-account-token': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'SA Token' },
    'kubernetes.io/basic-auth': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Basic Auth' },
    'kubernetes.io/ssh-auth': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', label: 'SSH' },
  };
  const style = config[type] || { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400', label: type };
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

// ConfigMaps Table
function ConfigMapsTable({
  configMaps,
  loading,
  onEdit,
  onDelete,
}: {
  configMaps: ConfigMap[];
  loading: boolean;
  onEdit: (cm: ConfigMap) => void;
  onDelete: (namespace: string, name: string) => void;
}) {
  const { hasRole } = useAuth();
  const canManage = hasRole('operator');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCM, setExpandedCM] = useState<string | null>(null);
  const [cmData, setCmData] = useState<ConfigMapDetail | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  const filteredCMs = configMaps.filter((cm) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return cm.name.toLowerCase().includes(query) || cm.namespace.toLowerCase().includes(query);
    }
    return true;
  });

  const toggleExpand = async (cm: ConfigMap) => {
    const key = `${cm.namespace}/${cm.name}`;
    if (expandedCM === key) {
      setExpandedCM(null);
      setCmData(null);
    } else {
      setExpandedCM(key);
      setLoadingData(true);
      try {
        const response = await kubernetesApi.getConfigMap(cm.namespace, cm.name);
        setCmData(response.data);
      } catch (err) {
        logger.error('Failed to fetch configmap', err);
      } finally {
        setLoadingData(false);
      }
    }
  };

  const copyToClipboard = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-gray-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <DocumentDuplicateIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">ConfigMaps</h3>
            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-full">
              {filteredCMs.length}
            </span>
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search configmaps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-white/50 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100/50 dark:divide-slate-700/50">
        {loading ? (
          <div className="px-5 py-8 text-center">
            <ArrowPathIcon className="h-5 w-5 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">Loading ConfigMaps...</p>
          </div>
        ) : filteredCMs.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500">
            <DocumentDuplicateIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No ConfigMaps found</p>
            <p className="text-sm mt-1">Try adjusting your search or namespace filter</p>
          </div>
        ) : (
          filteredCMs.map((cm, index) => {
            const cmKey = `${cm.namespace}/${cm.name}`;
            const isExpanded = expandedCM === cmKey;

            return (
              <motion.div
                key={cmKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <DocumentDuplicateIcon className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{cm.name}</p>
                      <p className="text-xs text-gray-500">{cm.namespace} &bull; {cm.data_count} keys &bull; {cm.age}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(cm)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title={isExpanded ? 'Hide data' : 'View data'}
                    >
                      {isExpanded ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                    {canManage && (
                      <>
                        <button
                          onClick={() => onEdit(cm)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(cm.namespace, cm.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Data */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-slate-700/50 space-y-3">
                        {loadingData ? (
                          <div className="flex items-center gap-2 text-gray-400">
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Loading data...</span>
                          </div>
                        ) : !cmData || Object.entries(cmData.data).length === 0 ? (
                          <p className="text-gray-400 text-sm italic">No data keys in this ConfigMap</p>
                        ) : (
                          Object.entries(cmData.data).map(([key, value]) => (
                            <div key={key} className="p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50">
                              <div className="flex items-center justify-between mb-2">
                                <code className="text-sm text-blue-600 dark:text-blue-400 font-mono font-medium">{key}</code>
                                <button
                                  onClick={() => copyToClipboard(value, `${cmKey}-${key}`)}
                                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                                  title="Copy value"
                                >
                                  {copiedKey === `${cmKey}-${key}` ? (
                                    <CheckIcon className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <ClipboardDocumentIcon className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                              <pre className="text-xs text-gray-600 dark:text-gray-300 font-mono bg-gray-100 dark:bg-slate-800 p-2 rounded overflow-x-auto max-h-32">
                                {value}
                              </pre>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// Secrets Table
function SecretsTable({
  secrets,
  loading,
  onEdit,
  onDelete,
}: {
  secrets: Secret[];
  loading: boolean;
  onEdit: (secret: Secret) => void;
  onDelete: (namespace: string, name: string) => void;
}) {
  const { hasRole } = useAuth();
  const canManage = hasRole('operator');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedSecret, setExpandedSecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const secretTypes = useMemo(() => {
    const types = new Set(secrets.map(s => s.type));
    return ['all', ...Array.from(types).sort()];
  }, [secrets]);

  const filteredSecrets = secrets.filter((secret) => {
    if (typeFilter !== 'all' && secret.type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return secret.name.toLowerCase().includes(query) || secret.namespace.toLowerCase().includes(query);
    }
    return true;
  });

  const toggleExpand = (secret: Secret) => {
    const key = `${secret.namespace}/${secret.name}`;
    setExpandedSecret(expandedSecret === key ? null : key);
  };

  const copyToClipboard = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 overflow-hidden"
    >
      {/* Security Warning */}
      <div className="px-5 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <span className="text-xs">Secret values are sensitive. Access is logged for audit purposes.</span>
        </div>
      </div>

      <div className="px-5 py-4 border-b border-gray-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <KeyIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Secrets</h3>
            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-full">
              {filteredSecrets.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search secrets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-white/50 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700/50 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent backdrop-blur-sm"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm bg-white/50 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700/50 rounded-xl px-3 py-2 focus:ring-2 focus:ring-yellow-500"
            >
              {secretTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.replace('kubernetes.io/', '')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100/50 dark:divide-slate-700/50">
        {loading ? (
          <div className="px-5 py-8 text-center">
            <ArrowPathIcon className="h-5 w-5 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">Loading Secrets...</p>
          </div>
        ) : filteredSecrets.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500">
            <KeyIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No Secrets found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          filteredSecrets.map((secret, index) => {
            const secretKey = `${secret.namespace}/${secret.name}`;
            const isExpanded = expandedSecret === secretKey;

            return (
              <motion.div
                key={secretKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <KeyIcon className="h-4 w-4 text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{secret.name}</p>
                      <p className="text-xs text-gray-500">{secret.namespace} &bull; {secret.data_count} keys &bull; {secret.age}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SecretTypeBadge type={secret.type} />
                    <button
                      onClick={() => toggleExpand(secret)}
                      className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                      title={isExpanded ? 'Hide keys' : 'View keys'}
                    >
                      {isExpanded ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                    {canManage && (
                      <>
                        <button
                          onClick={() => onEdit(secret)}
                          className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(secret.namespace, secret.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Data - Show keys only for security */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-slate-700/50 space-y-2">
                        <p className="text-xs text-gray-500 mb-3">Data Keys (click to copy key name):</p>
                        {secret.data_keys.length === 0 ? (
                          <p className="text-gray-400 text-sm italic">No data keys</p>
                        ) : (
                          secret.data_keys.map((key) => (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-900/50"
                            >
                              <code className="text-sm text-yellow-600 dark:text-yellow-400 font-mono">{key}</code>
                              <button
                                onClick={() => copyToClipboard(key, `${secretKey}-${key}`)}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                              >
                                {copiedKey === `${secretKey}-${key}` ? (
                                  <CheckIcon className="w-4 h-4 text-green-400" />
                                ) : (
                                  <ClipboardDocumentIcon className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  resourceType,
  resourceName,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  resourceType: string;
  resourceName: string;
  loading: boolean;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Delete ${resourceType}`}>
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">
          Are you sure you want to delete <span className="font-semibold text-red-600">{resourceName}</span>?
        </p>
        <p className="text-sm text-gray-500">This action cannot be undone. Applications depending on this resource will fail.</p>
        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Create ConfigMap Modal
function CreateConfigMapModal({
  isOpen,
  onClose,
  onSuccess,
  namespaces,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  namespaces: Namespace[];
}) {
  const [formData, setFormData] = useState({
    name: '',
    namespace: 'default',
    data: [{ key: '', value: '' }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const data: Record<string, string> = {};
      formData.data.forEach(item => {
        if (item.key) data[item.key] = item.value;
      });

      await kubernetesApi.createConfigMap({
        name: formData.name,
        namespace: formData.namespace,
        data,
      });
      onSuccess();
      onClose();
      setFormData({ name: '', namespace: 'default', data: [{ key: '', value: '' }] });
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create ConfigMap';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addDataField = () => {
    setFormData(prev => ({ ...prev, data: [...prev.data, { key: '', value: '' }] }));
  };

  const removeDataField = (index: number) => {
    setFormData(prev => ({ ...prev, data: prev.data.filter((_, i) => i !== index) }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create ConfigMap">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
              placeholder="my-configmap"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Namespace</label>
            <select
              value={formData.namespace}
              onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              {namespaces.map((ns) => (
                <option key={ns.name} value={ns.name}>{ns.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data (Key-Value Pairs)</label>
          <div className="space-y-2">
            {formData.data.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder="KEY"
                  value={item.key}
                  onChange={(e) => {
                    const newData = [...formData.data];
                    newData[index].key = e.target.value;
                    setFormData({ ...formData, data: newData });
                  }}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-mono"
                />
                <textarea
                  placeholder="Value"
                  value={item.value}
                  onChange={(e) => {
                    const newData = [...formData.data];
                    newData[index].value = e.target.value;
                    setFormData({ ...formData, data: newData });
                  }}
                  rows={1}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-mono resize-y"
                />
                {formData.data.length > 1 && (
                  <button type="button" onClick={() => removeDataField(index)} className="p-2 text-gray-400 hover:text-red-500">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addDataField} className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600">
              <PlusIcon className="h-4 w-4" />
              Add Key-Value
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2">
            {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            Create ConfigMap
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit ConfigMap Modal
function EditConfigMapModal({
  isOpen,
  onClose,
  onSuccess,
  configMap,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  configMap: ConfigMap | null;
}) {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && configMap) {
      setFetchLoading(true);
      setError(null);
      kubernetesApi.getConfigMap(configMap.namespace, configMap.name)
        .then(res => {
          setData(res.data.data || {});
        })
        .catch((err: any) => {
          const errorMessage = err.response?.data?.detail || err.message || 'Failed to load ConfigMap data';
          setError(errorMessage);
        })
        .finally(() => setFetchLoading(false));
    }
  }, [isOpen, configMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configMap) return;
    setLoading(true);
    setError(null);

    try {
      await kubernetesApi.updateConfigMap(configMap.namespace, configMap.name, { data });
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update ConfigMap';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateValue = (key: string, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const addKey = () => {
    const newKey = `key_${Object.keys(data).length + 1}`;
    setData(prev => ({ ...prev, [newKey]: '' }));
  };

  const removeKey = (key: string) => {
    setData(prev => {
      const newData = { ...prev };
      delete newData[key];
      return newData;
    });
  };

  if (!configMap) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit ConfigMap: ${configMap.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="text-sm text-gray-500 dark:text-gray-400">
          Namespace: <span className="font-medium text-gray-700 dark:text-gray-300">{configMap.namespace}</span>
        </div>

        {fetchLoading ? (
          <div className="flex items-center justify-center py-8">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data (Key-Value Pairs)</label>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.entries(data).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-blue-600 dark:text-blue-400 font-mono">{key}</code>
                    <button type="button" onClick={() => removeKey(key)} className="text-xs text-red-500 hover:text-red-600">
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={value}
                    onChange={(e) => updateValue(key, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-mono resize-y"
                  />
                </div>
              ))}
              {Object.keys(data).length === 0 && (
                <p className="text-gray-400 text-sm italic">No data keys</p>
              )}
            </div>
            <button type="button" onClick={addKey} className="mt-3 flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600">
              <PlusIcon className="h-4 w-4" />
              Add Key
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">
            Cancel
          </button>
          <button type="submit" disabled={loading || fetchLoading} className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2">
            {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create Secret Modal
function CreateSecretModal({
  isOpen,
  onClose,
  onSuccess,
  namespaces,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  namespaces: Namespace[];
}) {
  const [formData, setFormData] = useState({
    name: '',
    namespace: 'default',
    type: 'Opaque',
    data: [{ key: '', value: '' }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const data: Record<string, string> = {};
      formData.data.forEach(item => {
        if (item.key) data[item.key] = item.value;
      });

      await kubernetesApi.createSecret({
        name: formData.name,
        namespace: formData.namespace,
        type: formData.type,
        data,
      });
      onSuccess();
      onClose();
      setFormData({ name: '', namespace: 'default', type: 'Opaque', data: [{ key: '', value: '' }] });
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create Secret';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addDataField = () => {
    setFormData(prev => ({ ...prev, data: [...prev.data, { key: '', value: '' }] }));
  };

  const removeDataField = (index: number) => {
    setFormData(prev => ({ ...prev, data: prev.data.filter((_, i) => i !== index) }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Secret">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-yellow-500"
              placeholder="my-secret"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Namespace</label>
            <select
              value={formData.namespace}
              onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-yellow-500"
            >
              {namespaces.map((ns) => (
                <option key={ns.name} value={ns.name}>{ns.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-yellow-500"
          >
            <option value="Opaque">Opaque</option>
            <option value="kubernetes.io/tls">TLS</option>
            <option value="kubernetes.io/dockerconfigjson">Docker Registry</option>
            <option value="kubernetes.io/basic-auth">Basic Auth</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data (Key-Value Pairs)</label>
          <div className="space-y-2">
            {formData.data.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder="KEY"
                  value={item.key}
                  onChange={(e) => {
                    const newData = [...formData.data];
                    newData[index].key = e.target.value;
                    setFormData({ ...formData, data: newData });
                  }}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-mono"
                />
                <textarea
                  placeholder="Value (plain text - auto encoded)"
                  value={item.value}
                  onChange={(e) => {
                    const newData = [...formData.data];
                    newData[index].value = e.target.value;
                    setFormData({ ...formData, data: newData });
                  }}
                  rows={1}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-mono resize-y"
                />
                {formData.data.length > 1 && (
                  <button type="button" onClick={() => removeDataField(index)} className="p-2 text-gray-400 hover:text-red-500">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addDataField} className="flex items-center gap-1 text-sm text-yellow-500 hover:text-yellow-600">
              <PlusIcon className="h-4 w-4" />
              Add Key-Value
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-yellow-500 text-black rounded-xl hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2">
            {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            Create Secret
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Secret Modal
function EditSecretModal({
  isOpen,
  onClose,
  onSuccess,
  secret,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  secret: Secret | null;
}) {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && secret) {
      setFetchLoading(true);
      setError(null);
      kubernetesApi.getSecret(secret.namespace, secret.name)
        .then(res => {
          setData(res.data.data || {});
        })
        .catch((err: any) => {
          const errorMessage = err.response?.data?.detail || err.message || 'Failed to load Secret data';
          setError(errorMessage);
        })
        .finally(() => setFetchLoading(false));
    }
  }, [isOpen, secret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret) return;
    setLoading(true);
    setError(null);

    try {
      await kubernetesApi.updateSecret(secret.namespace, secret.name, { data });
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update Secret';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateValue = (key: string, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const addKey = () => {
    const newKey = `key_${Object.keys(data).length + 1}`;
    setData(prev => ({ ...prev, [newKey]: '' }));
  };

  const removeKey = (key: string) => {
    setData(prev => {
      const newData = { ...prev };
      delete newData[key];
      return newData;
    });
  };

  if (!secret) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Secret: ${secret.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <span className="text-xs">Editing secret values. Changes will be base64 encoded automatically.</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="text-sm text-gray-500 dark:text-gray-400">
          Namespace: <span className="font-medium text-gray-700 dark:text-gray-300">{secret.namespace}</span>
          <span className="mx-2">&bull;</span>
          Type: <span className="font-medium text-gray-700 dark:text-gray-300">{secret.type}</span>
        </div>

        {fetchLoading ? (
          <div className="flex items-center justify-center py-8">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data (Key-Value Pairs)</label>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.entries(data).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-yellow-600 dark:text-yellow-400 font-mono">{key}</code>
                    <button type="button" onClick={() => removeKey(key)} className="text-xs text-red-500 hover:text-red-600">
                      Remove
                    </button>
                  </div>
                  <textarea
                    value={value}
                    onChange={(e) => updateValue(key, e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-mono resize-y"
                    placeholder="Enter plain text value (auto encoded)"
                  />
                </div>
              ))}
              {Object.keys(data).length === 0 && (
                <p className="text-gray-400 text-sm italic">No data keys</p>
              )}
            </div>
            <button type="button" onClick={addKey} className="mt-3 flex items-center gap-1 text-sm text-yellow-500 hover:text-yellow-600">
              <PlusIcon className="h-4 w-4" />
              Add Key
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">
            Cancel
          </button>
          <button type="submit" disabled={loading || fetchLoading} className="px-4 py-2 bg-yellow-500 text-black rounded-xl hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2">
            {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Main Component
type TabType = 'configmaps' | 'secrets';

export default function ConfigurationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedNamespace } = useNamespace();
  const { hasRole } = useAuth();
  const canManage = hasRole('operator');

  const getInitialTab = (): TabType => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'secrets') return 'secrets';
    return 'configmaps';
  };

  const [configMaps, setConfigMaps] = useState<ConfigMap[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());

  // Modals
  const [showCreateConfigMapModal, setShowCreateConfigMapModal] = useState(false);
  const [showCreateSecretModal, setShowCreateSecretModal] = useState(false);
  const [editConfigMap, setEditConfigMap] = useState<ConfigMap | null>(null);
  const [editSecret, setEditSecret] = useState<Secret | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: string; namespace: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['configmaps', 'secrets'].includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    loadData();
  }, [selectedNamespace]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const ns = selectedNamespace || undefined;
      const [configMapsRes, secretsRes, namespacesRes] = await Promise.all([
        kubernetesApi.getConfigMaps(ns),
        kubernetesApi.getSecrets(ns),
        kubernetesApi.getNamespaces(),
      ]);
      setConfigMaps(configMapsRes.data || []);
      setSecrets(secretsRes.data || []);
      setNamespaces(namespacesRes.data || []);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load configuration data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      if (deleteModal.type === 'ConfigMap') {
        await kubernetesApi.deleteConfigMap(deleteModal.namespace, deleteModal.name);
      } else {
        await kubernetesApi.deleteSecret(deleteModal.namespace, deleteModal.name);
      }
      loadData();
      setDeleteModal(null);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to delete resource';
      setError(errorMessage);
    } finally {
      setDeleteLoading(false);
    }
  };

  const stats: ConfigStats = {
    configMaps: configMaps.length,
    secrets: secrets.length,
    opaqueSecrets: secrets.filter(s => s.type === 'Opaque').length,
    tlsSecrets: secrets.filter(s => s.type === 'kubernetes.io/tls').length,
    totalKeys: configMaps.reduce((acc, cm) => acc + cm.data_count, 0) + secrets.reduce((acc, s) => acc + s.data_count, 0),
  };

  const tabs = [
    { id: 'configmaps', label: 'ConfigMaps', icon: DocumentDuplicateIcon, count: stats.configMaps },
    { id: 'secrets', label: 'Secrets', icon: KeyIcon, count: stats.secrets },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration"
        description="Manage ConfigMaps and Secrets for your applications"
        icon={Cog6ToothIcon}
        iconColor="blue"
        actions={
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>
            {canManage && activeTab === 'configmaps' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateConfigMapModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25"
              >
                <PlusIcon className="h-4 w-4" />
                Create ConfigMap
              </motion.button>
            )}
            {canManage && activeTab === 'secrets' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateSecretModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-xl text-sm font-medium shadow-lg shadow-yellow-500/25"
              >
                <PlusIcon className="h-4 w-4" />
                Create Secret
              </motion.button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="ConfigMaps" value={stats.configMaps} icon={DocumentDuplicateIcon} color="blue" index={0} />
        <StatsCard title="Secrets" value={stats.secrets} icon={KeyIcon} color="yellow" index={1} />
        <StatsCard title="TLS Certificates" value={stats.tlsSecrets} icon={KeyIcon} color="green" index={2} />
        <StatsCard title="Total Keys" value={stats.totalKeys} icon={Cog6ToothIcon} color="purple" index={3} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? tab.id === 'configmaps'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/25'
                : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
              activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400"
        >
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <p>{error}</p>
          </div>
          <button onClick={loadData} className="mt-2 text-sm underline hover:no-underline">Retry</button>
        </motion.div>
      )}

      {/* Tab Content */}
      {activeTab === 'configmaps' && (
        <ConfigMapsTable
          configMaps={configMaps}
          loading={loading}
          onEdit={(cm) => setEditConfigMap(cm)}
          onDelete={(namespace, name) => setDeleteModal({ isOpen: true, type: 'ConfigMap', namespace, name })}
        />
      )}
      {activeTab === 'secrets' && (
        <SecretsTable
          secrets={secrets}
          loading={loading}
          onEdit={(secret) => setEditSecret(secret)}
          onDelete={(namespace, name) => setDeleteModal({ isOpen: true, type: 'Secret', namespace, name })}
        />
      )}

      {/* Modals */}
      <CreateConfigMapModal
        isOpen={showCreateConfigMapModal}
        onClose={() => setShowCreateConfigMapModal(false)}
        onSuccess={loadData}
        namespaces={namespaces}
      />

      <CreateSecretModal
        isOpen={showCreateSecretModal}
        onClose={() => setShowCreateSecretModal(false)}
        onSuccess={loadData}
        namespaces={namespaces}
      />

      <EditConfigMapModal
        isOpen={!!editConfigMap}
        onClose={() => setEditConfigMap(null)}
        onSuccess={loadData}
        configMap={editConfigMap}
      />

      <EditSecretModal
        isOpen={!!editSecret}
        onClose={() => setEditSecret(null)}
        onSuccess={loadData}
        secret={editSecret}
      />

      {deleteModal && (
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDelete}
          resourceType={deleteModal.type}
          resourceName={`${deleteModal.namespace}/${deleteModal.name}`}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
