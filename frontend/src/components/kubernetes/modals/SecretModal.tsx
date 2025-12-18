import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  KeyIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckIcon,
  TrashIcon,
  PlusIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { logger } from '../../../utils/logger';
import type { Secret, SecretDetail, Namespace } from '../../../types';

interface SecretModalProps {
  secret: Secret | null;
  mode: 'view' | 'edit' | 'create';
  namespaces: Namespace[];
  onClose: () => void;
  onSaved: () => void;
}

export function SecretModal({
  secret,
  mode,
  namespaces,
  onClose,
  onSaved,
}: SecretModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [secretDetail, setSecretDetail] = useState<SecretDetail | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    namespace: namespaces[0]?.name || 'default',
    type: 'Opaque',
  });

  useEffect(() => {
    if (mode !== 'create' && secret) {
      loadSecretDetail();
    }
  }, [secret, mode]);

  const loadSecretDetail = async () => {
    if (!secret) return;
    setLoading(true);
    try {
      const response = await kubernetesApi.getSecret(secret.namespace, secret.name);
      setSecretDetail(response.data);
      setEditData({ ...response.data.data });
    } catch (err) {
      toast.error('Failed to load secret details');
      logger.error('Failed to load secret details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (mode === 'create') {
        await kubernetesApi.createSecret({
          name: createForm.name,
          namespace: createForm.namespace,
          type: createForm.type,
          data: editData,
        });
        toast.success('Secret created successfully');
      } else if (mode === 'edit' && secret) {
        await kubernetesApi.updateSecret(secret.namespace, secret.name, {
          data: editData,
        });
        toast.success('Secret updated successfully');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(`Failed to ${mode === 'create' ? 'create' : 'update'} secret`);
      logger.error(`Failed to ${mode === 'create' ? 'create' : 'update'} secret`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = () => {
    if (newKey && !editData[newKey]) {
      setEditData({ ...editData, [newKey]: newValue });
      setNewKey('');
      setNewValue('');
    }
  };

  const handleRemoveKey = (key: string) => {
    const newData = { ...editData };
    delete newData[key];
    setEditData(newData);
  };

  const toggleShowValue = (key: string) => {
    setShowValues({ ...showValues, [key]: !showValues[key] });
  };

  const isEditable = mode === 'edit' || mode === 'create';

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <KeyIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {mode === 'create' ? 'Create Secret' : mode === 'edit' ? 'Edit Secret' : 'View Secret'}
              </h3>
              {secret && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {secret.namespace}/{secret.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {!loading && mode === 'create' && (
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    placeholder="my-secret"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Namespace
                  </label>
                  <select
                    value={createForm.namespace}
                    onChange={(e) => setCreateForm({ ...createForm, namespace: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    {namespaces.map((ns) => (
                      <option key={ns.name} value={ns.name}>{ns.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Opaque">Opaque</option>
                  <option value="kubernetes.io/tls">kubernetes.io/tls</option>
                  <option value="kubernetes.io/dockerconfigjson">kubernetes.io/dockerconfigjson</option>
                  <option value="kubernetes.io/basic-auth">kubernetes.io/basic-auth</option>
                  <option value="kubernetes.io/ssh-auth">kubernetes.io/ssh-auth</option>
                </select>
              </div>
            </div>
          )}

          {!loading && (mode === 'view' || mode === 'edit') && secretDetail && (
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Type:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{secretDetail.type}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Created:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {secretDetail.created_at ? new Date(secretDetail.created_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Keys:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{Object.keys(editData).length}</span>
                </div>
              </div>
            </div>
          )}

          {!loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Data</h4>
                {isEditable && (
                  <button
                    onClick={() => setShowValues(Object.keys(editData).reduce((acc, k) => ({ ...acc, [k]: true }), {}))}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Show all values
                  </button>
                )}
              </div>

              {Object.entries(editData).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{key}</span>
                      <button
                        onClick={() => toggleShowValue(key)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showValues[key] ? (
                          <EyeSlashIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {isEditable ? (
                      <textarea
                        value={value}
                        onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
                        rows={showValues[key] ? 3 : 1}
                        style={{ WebkitTextSecurity: showValues[key] ? 'none' : 'disc' } as React.CSSProperties}
                      />
                    ) : (
                      <div
                        className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all"
                        style={{ WebkitTextSecurity: showValues[key] ? 'none' : 'disc' } as React.CSSProperties}
                      >
                        {value || '(empty)'}
                      </div>
                    )}
                  </div>
                  {isEditable && (
                    <button
                      onClick={() => handleRemoveKey(key)}
                      className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              {Object.keys(editData).length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No data keys
                </div>
              )}

              {isEditable && (
                <div className="flex items-end gap-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Key</label>
                    <input
                      type="text"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="new-key"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Value</label>
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="value"
                    />
                  </div>
                  <button
                    onClick={handleAddKey}
                    disabled={!newKey}
                    className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded disabled:opacity-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            {isEditable ? 'Cancel' : 'Close'}
          </button>
          {isEditable && (
            <button
              onClick={handleSave}
              disabled={loading || (mode === 'create' && !createForm.name)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4" />
                  {mode === 'create' ? 'Create' : 'Save Changes'}
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
