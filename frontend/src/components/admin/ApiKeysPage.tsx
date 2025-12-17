import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyIcon,
  PlusIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../common/PageHeader';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  permissions: string[];
  status: 'active' | 'expired' | 'revoked';
}

// API Keys are not yet implemented in the backend
// This page will show an empty state until the feature is available

export default function ApiKeysPage() {
  const [apiKeys] = useState<ApiKey[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (status: ApiKey['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
            <CheckCircleIcon className="h-3 w-3" />
            Active
          </span>
        );
      case 'expired':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <ExclamationTriangleIcon className="h-3 w-3" />
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            <ExclamationTriangleIcon className="h-3 w-3" />
            Revoked
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Manage API keys for programmatic access to NextSight AI"
        icon={KeyIcon}
        iconColor="purple"
        actions={
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Create API Key
          </motion.button>
        }
      />

      {/* Security Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50"
      >
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
              Security Notice
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              API keys provide programmatic access to your NextSight AI account. Keep them secure and never share them publicly.
              Rotate keys regularly and revoke any that may have been compromised.
            </p>
          </div>
        </div>
      </motion.div>

      {/* API Keys List */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Your API Keys
        </h3>

        {apiKeys.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-8 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 text-center"
          >
            <div className="p-4 rounded-2xl bg-gray-100 dark:bg-slate-700 w-fit mx-auto mb-4">
              <KeyIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No API keys yet
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Create your first API key to start integrating with NextSight AI
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium"
            >
              Create API Key
            </motion.button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <motion.div
                key={apiKey.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                      <KeyIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {apiKey.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Created on {apiKey.createdAt}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(apiKey.status)}
                  </div>
                </div>

                {/* Key Display */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-100 dark:bg-slate-700/50 mb-3">
                  <code className="flex-1 text-sm font-mono text-gray-700 dark:text-gray-300">
                    {visibleKeys.has(apiKey.id) ? apiKey.key : '••••••••••••••••••••••••'}
                  </code>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleKeyVisibility(apiKey.id)}
                    className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-500"
                    title={visibleKeys.has(apiKey.id) ? 'Hide key' : 'Show key'}
                  >
                    {visibleKeys.has(apiKey.id) ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                    className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-500"
                    title="Copy to clipboard"
                  >
                    {copiedKey === apiKey.id ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    )}
                  </motion.button>
                </div>

                {/* Permissions and Meta */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {apiKey.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    {apiKey.lastUsed && <span>Last used: {apiKey.lastUsed}</span>}
                    {apiKey.expiresAt && <span>Expires: {apiKey.expiresAt}</span>}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500"
                      title="Revoke key"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal Placeholder */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Create New API Key
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Key Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Production API Key"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Expiration
                    </label>
                    <select className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                      <option>Never</option>
                      <option>30 days</option>
                      <option>90 days</option>
                      <option>1 year</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-medium"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-2 rounded-xl bg-purple-500 text-white font-medium"
                    >
                      Create Key
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
