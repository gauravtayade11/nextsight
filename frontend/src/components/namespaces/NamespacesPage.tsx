import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  TrashIcon,
  XMarkIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  KeyIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  AdjustmentsHorizontalIcon,
  Squares2X2Icon,
  ListBulletIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { NamespaceDetail } from '../../types';

// Compact Modal Component
function Modal({ isOpen, onClose, title, children }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200/50 dark:border-slate-700/50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              <XMarkIcon className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Create Namespace Modal
function CreateNamespaceModal({ isOpen, onClose, onSuccess }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [labels, setLabels] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { setError('Name is required'); return; }

    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!nameRegex.test(name)) {
      setError('Name must be lowercase, start/end with alphanumeric, and can contain hyphens');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const labelsObj: Record<string, string> = {};
      labels.forEach(l => { if (l.key) labelsObj[l.key] = l.value; });

      await kubernetesApi.createNamespace({
        name,
        labels: Object.keys(labelsObj).length > 0 ? labelsObj : undefined,
      });
      onSuccess();
      onClose();
      setName('');
      setLabels([{ key: '', value: '' }]);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to create namespace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Namespace">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <ExclamationCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
            placeholder="my-namespace"
          />
          <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
            <InformationCircleIcon className="h-3 w-3" />
            Lowercase alphanumeric with hyphens
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Labels <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <div className="space-y-2">
            {labels.map((label, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Key"
                  value={label.key}
                  onChange={(e) => {
                    const newLabels = [...labels];
                    newLabels[index].key = e.target.value;
                    setLabels(newLabels);
                  }}
                  className="flex-1 px-2.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={label.value}
                  onChange={(e) => {
                    const newLabels = [...labels];
                    newLabels[index].value = e.target.value;
                    setLabels(newLabels);
                  }}
                  className="flex-1 px-2.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                />
                {labels.length > 1 && (
                  <button type="button" onClick={() => setLabels(prev => prev.filter((_, i) => i !== index))} className="p-2 text-gray-400 hover:text-red-500">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setLabels(prev => [...prev, { key: '', value: '' }])} className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600 font-medium">
              <PlusIcon className="h-3 w-3" /> Add Label
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-700">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
            {loading && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({ isOpen, onClose, onConfirm, namespaceName, loading }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  namespaceName: string;
  loading: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Namespace">
      <div className="space-y-4">
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400 text-sm">This action cannot be undone</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                All resources in <code className="font-mono bg-red-100 dark:bg-red-900/50 px-1 rounded">{namespaceName}</code> will be permanently deleted.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Type <code className="text-red-500">{namespaceName}</code> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
            placeholder="Enter namespace name"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <button onClick={onClose} className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || confirmText !== namespaceName}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
          >
            {loading && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Compact Namespace Details Drawer
function NamespaceDrawer({ namespace, onClose, onDelete, canManage, isProtected }: {
  namespace: NamespaceDetail;
  onClose: () => void;
  onDelete: () => void;
  canManage: boolean;
  isProtected: boolean;
}) {
  const resources = [
    { label: 'Pods', value: namespace.pods, icon: CubeIcon, color: 'blue' },
    { label: 'Deployments', value: namespace.deployments, icon: ServerStackIcon, color: 'purple' },
    { label: 'Services', value: namespace.services, icon: ChartBarIcon, color: 'green' },
    { label: 'ConfigMaps', value: namespace.configmaps, icon: Cog6ToothIcon, color: 'amber' },
    { label: 'Secrets', value: namespace.secrets, icon: KeyIcon, color: 'red' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200/50 dark:border-slate-700/50 overflow-hidden h-fit"
    >
      <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b border-gray-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <FolderIcon className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{namespace.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                  namespace.status === 'Active'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                }`}>
                  <span className={`w-1 h-1 rounded-full ${namespace.status === 'Active' ? 'bg-green-500' : 'bg-amber-500'}`} />
                  {namespace.status}
                </span>
                {isProtected && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <ShieldCheckIcon className="h-2.5 w-2.5" /> System
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <XMarkIcon className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <ClockIcon className="h-3.5 w-3.5" />
          <span>Age: {namespace.age}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {resources.map((item) => (
            <div key={item.label} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <item.icon className={`h-3.5 w-3.5 ${
                  item.color === 'blue' ? 'text-blue-500' :
                  item.color === 'purple' ? 'text-purple-500' :
                  item.color === 'green' ? 'text-green-500' :
                  item.color === 'amber' ? 'text-amber-500' : 'text-red-500'
                }`} />
                <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}</span>
            </div>
          ))}
        </div>

        {Object.keys(namespace.labels).length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Labels</h4>
            <div className="flex flex-wrap gap-1">
              {Object.entries(namespace.labels).map(([key, value]) => (
                <span key={key} className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400">
                  {key.split('/').pop()}: {value}
                </span>
              ))}
            </div>
          </div>
        )}

        {canManage && !isProtected && (
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-sm font-medium"
          >
            <TrashIcon className="h-3.5 w-3.5" /> Delete
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Main Component
export default function NamespacesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('operator');

  const [namespaces, setNamespaces] = useState<NamespaceDetail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<NamespaceDetail | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'system' | 'user'>('all');

  const protectedNamespaces = ['default', 'kube-system', 'kube-public', 'kube-node-lease'];

  const loadNamespaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await kubernetesApi.getNamespacesWithDetails();
      const uniqueNamespaces = Array.from(
        new Map((response.data || []).map((ns: NamespaceDetail) => [ns.name, ns])).values()
      ) as NamespaceDetail[];
      setNamespaces(uniqueNamespaces);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load namespaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNamespaces(); }, [loadNamespaces]);

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      await kubernetesApi.deleteNamespace(deleteModal.name);
      loadNamespaces();
      setDeleteModal(null);
      setSelectedNamespace(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete namespace');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredNamespaces = useMemo(() => {
    return namespaces.filter(ns => {
      const matchesSearch = ns.name.toLowerCase().includes(searchQuery.toLowerCase());
      const isSystem = protectedNamespaces.includes(ns.name);
      const matchesFilter = filterStatus === 'all' ||
        (filterStatus === 'active' && ns.status === 'Active') ||
        (filterStatus === 'system' && isSystem) ||
        (filterStatus === 'user' && !isSystem);
      return matchesSearch && matchesFilter;
    });
  }, [namespaces, searchQuery, filterStatus]);

  const stats = useMemo(() => ({
    total: namespaces.length,
    active: namespaces.filter(ns => ns.status === 'Active').length,
    system: namespaces.filter(ns => protectedNamespaces.includes(ns.name)).length,
    user: namespaces.filter(ns => !protectedNamespaces.includes(ns.name)).length,
    pods: namespaces.reduce((acc, ns) => acc + ns.pods, 0),
    deployments: namespaces.reduce((acc, ns) => acc + ns.deployments, 0),
    services: namespaces.reduce((acc, ns) => acc + ns.services, 0),
  }), [namespaces]);

  return (
    <div className="space-y-4">
      {/* Compact Header with Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-transparent border border-purple-500/20 dark:border-purple-500/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20">
            <FolderIcon className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Namespaces</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Manage Kubernetes namespace isolation</p>
          </div>
        </div>

        {/* Inline Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-gray-200/50 dark:border-slate-700/50">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{loading ? '-' : stats.total}</p>
              <p className="text-[10px] text-gray-500 uppercase">Total</p>
            </div>
            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{loading ? '-' : stats.active}</p>
              <p className="text-[10px] text-gray-500 uppercase">Active</p>
            </div>
            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-lg font-bold text-blue-600">{loading ? '-' : stats.pods}</p>
              <p className="text-[10px] text-gray-500 uppercase">Pods</p>
            </div>
            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-lg font-bold text-purple-600">{loading ? '-' : stats.deployments}</p>
              <p className="text-[10px] text-gray-500 uppercase">Deploys</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadNamespaces}
              disabled={loading}
              className="p-2 bg-white/60 dark:bg-slate-800/60 border border-gray-200/50 dark:border-slate-700/50 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {canManage && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium shadow-sm"
              >
                <PlusIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
            <XMarkIcon className="h-3.5 w-3.5 text-red-500" />
          </button>
        </div>
      )}

      {/* Search & Filters Row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search namespaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
          {(['all', 'active', 'system', 'user'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                filterStatus === filter
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-purple-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Squares2X2Icon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-purple-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ListBulletIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && namespaces.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="h-6 w-6 animate-spin text-purple-500" />
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="flex gap-4">
          <div className={`flex-1 min-w-0 ${selectedNamespace ? 'lg:w-2/3' : 'w-full'}`}>
            {filteredNamespaces.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                <FolderIcon className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {searchQuery ? 'No matches found' : 'No namespaces'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {filteredNamespaces.map((ns) => {
                  const isProtected = protectedNamespaces.includes(ns.name);
                  const isSelected = selectedNamespace?.name === ns.name;

                  return (
                    <motion.div
                      key={ns.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelectedNamespace(isSelected ? null : ns)}
                      className={`relative p-3 rounded-lg bg-white dark:bg-slate-800 border cursor-pointer transition-all group ${
                        isSelected
                          ? 'border-purple-500 ring-1 ring-purple-500/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-purple-400'
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg ${isProtected ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
                          <FolderIcon className={`h-4 w-4 ${isProtected ? 'text-blue-500' : 'text-purple-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">{ns.name}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${ns.status === 'Active' ? 'bg-green-500' : 'bg-amber-500'}`} />
                          {isProtected && <ShieldCheckIcon className="h-3 w-3 text-blue-500" />}
                        </div>
                      </div>

                      {/* Compact Stats Row */}
                      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/50 rounded px-2 py-1.5">
                        <span><b className="text-gray-900 dark:text-white">{ns.pods}</b> pods</span>
                        <span><b className="text-gray-900 dark:text-white">{ns.deployments}</b> deploy</span>
                        <span><b className="text-gray-900 dark:text-white">{ns.services}</b> svc</span>
                        <span className="text-gray-400">{ns.age}</span>
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                        {canManage && !isProtected && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, name: ns.name }); }}
                            className="p-1 rounded bg-white dark:bg-slate-700 shadow-sm text-gray-400 hover:text-red-500"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* Table View */
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Pods</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Deploy</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Svc</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">CM</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Sec</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Age</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                      {filteredNamespaces.map((ns) => {
                        const isProtected = protectedNamespaces.includes(ns.name);
                        const isSelected = selectedNamespace?.name === ns.name;

                        return (
                          <tr
                            key={ns.name}
                            onClick={() => setSelectedNamespace(isSelected ? null : ns)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'}`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <FolderIcon className={`h-4 w-4 ${isProtected ? 'text-blue-500' : 'text-purple-500'}`} />
                                <span className="font-medium text-gray-900 dark:text-white">{ns.name}</span>
                                {isProtected && <ShieldCheckIcon className="h-3 w-3 text-blue-500" />}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full ${
                                ns.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${ns.status === 'Active' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                {ns.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center font-medium">{ns.pods}</td>
                            <td className="px-3 py-2 text-center font-medium">{ns.deployments}</td>
                            <td className="px-3 py-2 text-center font-medium">{ns.services}</td>
                            <td className="px-3 py-2 text-center font-medium">{ns.configmaps}</td>
                            <td className="px-3 py-2 text-center font-medium">{ns.secrets}</td>
                            <td className="px-3 py-2 text-gray-500">{ns.age}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedNamespace(ns); }}
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-purple-500"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </button>
                                {canManage && !isProtected && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, name: ns.name }); }}
                                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Details Drawer */}
          <AnimatePresence>
            {selectedNamespace && (
              <div className="hidden lg:block w-72 flex-shrink-0">
                <NamespaceDrawer
                  namespace={selectedNamespace}
                  onClose={() => setSelectedNamespace(null)}
                  onDelete={() => setDeleteModal({ isOpen: true, name: selectedNamespace.name })}
                  canManage={canManage}
                  isProtected={protectedNamespaces.includes(selectedNamespace.name)}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <CreateNamespaceModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSuccess={loadNamespaces} />
      {deleteModal && (
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDelete}
          namespaceName={deleteModal.name}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
