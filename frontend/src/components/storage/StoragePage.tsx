import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CircleStackIcon,
  DocumentTextIcon,
  FolderIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../common/PageHeader';
import { kubernetesApi } from '../../services/api';
import { logger } from '../../utils/logger';
import { useNamespace } from '../../contexts/NamespaceContext';
import type { PV, PVC, StorageClass, PVCreateRequest, PVCCreateRequest, StorageClassCreateRequest } from '../../types';

// Modal component
function Modal({ isOpen, onClose, title, children, size = 'md' }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full ${sizeClasses[size]} bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Create PV Modal
function CreatePVModal({ isOpen, onClose, onCreated }: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [formData, setFormData] = useState<PVCreateRequest>({
    name: '',
    capacity: '10Gi',
    access_modes: ['ReadWriteOnce'],
    reclaim_policy: 'Retain',
    storage_class_name: '',
    volume_mode: 'Filesystem',
    host_path: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await kubernetesApi.createPV(formData);
      onCreated();
      onClose();
      setFormData({ name: '', capacity: '10Gi', access_modes: ['ReadWriteOnce'], reclaim_policy: 'Retain', storage_class_name: '', volume_mode: 'Filesystem', host_path: '' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create PV';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Persistent Volume" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="my-pv"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity *</label>
            <input
              type="text"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="10Gi"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Mode</label>
            <select
              value={formData.access_modes[0]}
              onChange={(e) => setFormData({ ...formData, access_modes: [e.target.value] })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              <option value="ReadWriteOnce">ReadWriteOnce</option>
              <option value="ReadOnlyMany">ReadOnlyMany</option>
              <option value="ReadWriteMany">ReadWriteMany</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reclaim Policy</label>
            <select
              value={formData.reclaim_policy}
              onChange={(e) => setFormData({ ...formData, reclaim_policy: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              <option value="Retain">Retain</option>
              <option value="Delete">Delete</option>
              <option value="Recycle">Recycle</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Storage Class</label>
            <input
              type="text"
              value={formData.storage_class_name || ''}
              onChange={(e) => setFormData({ ...formData, storage_class_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="standard"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host Path</label>
            <input
              type="text"
              value={formData.host_path || ''}
              onChange={(e) => setFormData({ ...formData, host_path: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="/mnt/data"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create PV'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create PVC Modal
function CreatePVCModal({ isOpen, onClose, onCreated, namespaces }: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  namespaces: string[];
}) {
  const [formData, setFormData] = useState<PVCCreateRequest>({
    name: '',
    namespace: 'default',
    storage_class_name: '',
    access_modes: ['ReadWriteOnce'],
    storage: '10Gi',
    volume_mode: 'Filesystem',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await kubernetesApi.createPVC(formData);
      onCreated();
      onClose();
      setFormData({ name: '', namespace: 'default', storage_class_name: '', access_modes: ['ReadWriteOnce'], storage: '10Gi', volume_mode: 'Filesystem' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create PVC';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Persistent Volume Claim" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="my-pvc"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Namespace *</label>
            <select
              value={formData.namespace}
              onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              {namespaces.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Storage Size *</label>
            <input
              type="text"
              value={formData.storage}
              onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="10Gi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Storage Class</label>
            <input
              type="text"
              value={formData.storage_class_name || ''}
              onChange={(e) => setFormData({ ...formData, storage_class_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="standard"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Mode</label>
            <select
              value={formData.access_modes[0]}
              onChange={(e) => setFormData({ ...formData, access_modes: [e.target.value] })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              <option value="ReadWriteOnce">ReadWriteOnce</option>
              <option value="ReadOnlyMany">ReadOnlyMany</option>
              <option value="ReadWriteMany">ReadWriteMany</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Volume Mode</label>
            <select
              value={formData.volume_mode}
              onChange={(e) => setFormData({ ...formData, volume_mode: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              <option value="Filesystem">Filesystem</option>
              <option value="Block">Block</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create PVC'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create StorageClass Modal
function CreateStorageClassModal({ isOpen, onClose, onCreated }: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [formData, setFormData] = useState<StorageClassCreateRequest>({
    name: '',
    provisioner: 'kubernetes.io/no-provisioner',
    reclaim_policy: 'Delete',
    volume_binding_mode: 'WaitForFirstConsumer',
    allow_volume_expansion: true,
    is_default: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await kubernetesApi.createStorageClass(formData);
      onCreated();
      onClose();
      setFormData({ name: '', provisioner: 'kubernetes.io/no-provisioner', reclaim_policy: 'Delete', volume_binding_mode: 'WaitForFirstConsumer', allow_volume_expansion: true, is_default: false });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create StorageClass';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Storage Class" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="my-storage-class"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provisioner *</label>
            <input
              type="text"
              value={formData.provisioner}
              onChange={(e) => setFormData({ ...formData, provisioner: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="kubernetes.io/gce-pd"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reclaim Policy</label>
            <select
              value={formData.reclaim_policy}
              onChange={(e) => setFormData({ ...formData, reclaim_policy: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              <option value="Delete">Delete</option>
              <option value="Retain">Retain</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Volume Binding Mode</label>
            <select
              value={formData.volume_binding_mode}
              onChange={(e) => setFormData({ ...formData, volume_binding_mode: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              <option value="WaitForFirstConsumer">WaitForFirstConsumer</option>
              <option value="Immediate">Immediate</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.allow_volume_expansion}
              onChange={(e) => setFormData({ ...formData, allow_volume_expansion: e.target.checked })}
              className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Allow Volume Expansion</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Set as Default</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create StorageClass'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({ isOpen, onClose, onConfirm, resourceType, resourceName, loading }: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  resourceType: string;
  resourceName: string;
  loading: boolean;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Delete ${resourceType}`} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
          <p className="text-sm text-red-600 dark:text-red-400">
            Are you sure you want to delete <span className="font-semibold">{resourceName}</span>? This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// YAML Viewer Modal
function YAMLViewerModal({ isOpen, onClose, resourceType, resourceName, namespace }: {
  isOpen: boolean;
  onClose: () => void;
  resourceType: string;
  resourceName: string;
  namespace?: string;
}) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      kubernetesApi.getResourceYAML({ kind: resourceType, name: resourceName, namespace })
        .then(res => setYaml(res.data.yaml_content || 'No YAML content available'))
        .catch(() => setYaml('Failed to load YAML'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, resourceType, resourceName, namespace]);

  const handleCopy = () => {
    navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${resourceType}: ${resourceName}`} size="xl">
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <pre className="p-4 rounded-lg bg-gray-900 text-gray-100 text-sm overflow-auto max-h-[60vh] font-mono">
            {yaml}
          </pre>
        )}
      </div>
    </Modal>
  );
}

// Tab definitions
const tabs = [
  { id: 'pv', label: 'Persistent Volumes', icon: CircleStackIcon },
  { id: 'pvc', label: 'PV Claims', icon: DocumentTextIcon },
  { id: 'classes', label: 'Storage Classes', icon: FolderIcon },
];

export default function StoragePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedNamespace } = useNamespace();
  const activeTab = searchParams.get('tab') || 'pv';
  const [search, setSearch] = useState('');

  // Data states
  const [pvs, setPVs] = useState<PV[]>([]);
  const [pvcs, setPVCs] = useState<PVC[]>([]);
  const [storageClasses, setStorageClasses] = useState<StorageClass[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreatePV, setShowCreatePV] = useState(false);
  const [showCreatePVC, setShowCreatePVC] = useState(false);
  const [showCreateSC, setShowCreateSC] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ type: string; name: string; namespace?: string } | null>(null);
  const [yamlModal, setYamlModal] = useState<{ type: string; name: string; namespace?: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ns = selectedNamespace || undefined;
      const [pvsRes, pvcsRes, scsRes, nsRes] = await Promise.all([
        kubernetesApi.getPVs(),
        kubernetesApi.getPVCs(ns),
        kubernetesApi.getStorageClasses(),
        kubernetesApi.getNamespaces(),
      ]);
      setPVs(pvsRes.data);
      setPVCs(pvcsRes.data);
      setStorageClasses(scsRes.data);
      setNamespaces(nsRes.data.map(ns => ns.name));
    } catch (error) {
      logger.error('Error fetching storage data', error);
    } finally {
      setLoading(false);
    }
  }, [selectedNamespace]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered data
  const filteredPVs = pvs.filter(pv =>
    pv.name.toLowerCase().includes(search.toLowerCase()) ||
    (pv.storage_class && pv.storage_class.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredPVCs = pvcs.filter(pvc =>
    pvc.name.toLowerCase().includes(search.toLowerCase()) ||
    pvc.namespace.toLowerCase().includes(search.toLowerCase()) ||
    (pvc.storage_class && pvc.storage_class.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredSCs = storageClasses.filter(sc =>
    sc.name.toLowerCase().includes(search.toLowerCase()) ||
    sc.provisioner.toLowerCase().includes(search.toLowerCase())
  );

  // Delete handlers
  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      if (deleteModal.type === 'PersistentVolume') {
        await kubernetesApi.deletePV(deleteModal.name);
      } else if (deleteModal.type === 'PersistentVolumeClaim') {
        await kubernetesApi.deletePVC(deleteModal.namespace!, deleteModal.name);
      } else if (deleteModal.type === 'StorageClass') {
        await kubernetesApi.deleteStorageClass(deleteModal.name);
      }
      fetchData();
      setDeleteModal(null);
    } catch (error) {
      logger.error('Delete failed', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Bound':
      case 'Available':
        return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
      case 'Pending':
      case 'Released':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
      case 'Failed':
      case 'Lost':
        return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400';
    }
  };

  // Calculate storage stats
  const parseCapacity = (cap: string): number => {
    const match = cap.match(/^(\d+)(Gi|Mi|Ti|G|M|T)?$/);
    if (!match) return 0;
    const value = parseInt(match[1]);
    const unit = match[2] || 'Gi';
    switch (unit) {
      case 'Ti': case 'T': return value * 1024;
      case 'Gi': case 'G': return value;
      case 'Mi': case 'M': return value / 1024;
      default: return value;
    }
  };

  const totalStorage = {
    total: pvs.reduce((acc, pv) => acc + parseCapacity(pv.capacity), 0),
    used: pvs.filter(pv => pv.status === 'Bound').reduce((acc, pv) => acc + parseCapacity(pv.capacity), 0),
    available: pvs.filter(pv => pv.status === 'Available').reduce((acc, pv) => acc + parseCapacity(pv.capacity), 0),
  };

  // Get create button based on tab
  const getCreateButton = () => {
    switch (activeTab) {
      case 'pv':
        return (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreatePV(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-amber-500/25"
          >
            <PlusIcon className="h-4 w-4" />
            Create PV
          </motion.button>
        );
      case 'pvc':
        return (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreatePVC(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-amber-500/25"
          >
            <PlusIcon className="h-4 w-4" />
            Create PVC
          </motion.button>
        );
      case 'classes':
        return (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateSC(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-amber-500/25"
          >
            <PlusIcon className="h-4 w-4" />
            Create StorageClass
          </motion.button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage"
        description="Manage persistent volumes, claims, and storage classes"
        icon={CircleStackIcon}
        iconColor="amber"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {getCreateButton()}
          </div>
        }
      />

      {/* Storage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Storage', value: `${totalStorage.total}Gi`, color: 'blue', icon: CircleStackIcon },
          { label: 'Used', value: `${totalStorage.used}Gi`, color: 'purple', icon: CheckCircleIcon },
          { label: 'Available', value: `${totalStorage.available}Gi`, color: 'green', icon: FolderIcon },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' : stat.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                <stat.icon className={`h-5 w-5 ${stat.color === 'blue' ? 'text-blue-500' : stat.color === 'purple' ? 'text-purple-500' : 'text-green-500'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search and Tabs */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const count = tab.id === 'pv' ? pvs.length : tab.id === 'pvc' ? pvcs.length : storageClasses.length;
            return (
              <button
                key={tab.id}
                onClick={() => setSearchParams({ tab: tab.id })}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25'
                    : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700/50'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                  activeTab === tab.id ? 'bg-white/20' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm w-64"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      )}

      {/* PV Tab - Table Structure */}
      {!loading && activeTab === 'pv' && (
        <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Capacity</th>
                <th className="py-3 px-4">Access Modes</th>
                <th className="py-3 px-4">Reclaim Policy</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Claim</th>
                <th className="py-3 px-4">Storage Class</th>
                <th className="py-3 px-4">Age</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredPVs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">No persistent volumes found</td>
                </tr>
              ) : (
                filteredPVs.map((pv) => (
                  <tr key={pv.name} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <CircleStackIcon className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{pv.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{pv.capacity}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400">
                        {pv.access_modes[0]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{pv.reclaim_policy}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(pv.status)}`}>
                        {pv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{pv.claim || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{pv.storage_class || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{pv.age}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setYamlModal({ type: 'PersistentVolume', name: pv.name })}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ type: 'PersistentVolume', name: pv.name })}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PVC Tab - Table Structure (consistent with PV) */}
      {!loading && activeTab === 'pvc' && (
        <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Namespace</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Volume</th>
                <th className="py-3 px-4">Capacity</th>
                <th className="py-3 px-4">Access Modes</th>
                <th className="py-3 px-4">Storage Class</th>
                <th className="py-3 px-4">Age</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredPVCs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">No persistent volume claims found</td>
                </tr>
              ) : (
                filteredPVCs.map((pvc) => (
                  <tr key={`${pvc.namespace}/${pvc.name}`} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{pvc.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        {pvc.namespace}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(pvc.status)}`}>
                        {pvc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{pvc.volume || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{pvc.capacity || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400">
                        {pvc.access_modes[0]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{pvc.storage_class || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{pvc.age}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setYamlModal({ type: 'PersistentVolumeClaim', name: pvc.name, namespace: pvc.namespace })}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ type: 'PersistentVolumeClaim', name: pvc.name, namespace: pvc.namespace })}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* StorageClasses Tab - Table Structure (consistent with PV) */}
      {!loading && activeTab === 'classes' && (
        <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Provisioner</th>
                <th className="py-3 px-4">Reclaim Policy</th>
                <th className="py-3 px-4">Volume Binding Mode</th>
                <th className="py-3 px-4">Volume Expansion</th>
                <th className="py-3 px-4">Default</th>
                <th className="py-3 px-4">Age</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredSCs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">No storage classes found</td>
                </tr>
              ) : (
                filteredSCs.map((sc) => (
                  <tr key={sc.name} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FolderIcon className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{sc.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-gray-600 dark:text-gray-400">{sc.provisioner}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{sc.reclaim_policy}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{sc.volume_binding_mode}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sc.allow_volume_expansion ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'}`}>
                        {sc.allow_volume_expansion ? 'Allowed' : 'Not Allowed'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {sc.is_default ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          Default
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{sc.age}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setYamlModal({ type: 'StorageClass', name: sc.name })}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ type: 'StorageClass', name: sc.name })}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreatePVModal
        isOpen={showCreatePV}
        onClose={() => setShowCreatePV(false)}
        onCreated={fetchData}
      />
      <CreatePVCModal
        isOpen={showCreatePVC}
        onClose={() => setShowCreatePVC(false)}
        onCreated={fetchData}
        namespaces={namespaces}
      />
      <CreateStorageClassModal
        isOpen={showCreateSC}
        onClose={() => setShowCreateSC(false)}
        onCreated={fetchData}
      />

      {deleteModal && (
        <DeleteConfirmModal
          isOpen={!!deleteModal}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDelete}
          resourceType={deleteModal.type}
          resourceName={deleteModal.name}
          loading={deleteLoading}
        />
      )}

      {yamlModal && (
        <YAMLViewerModal
          isOpen={!!yamlModal}
          onClose={() => setYamlModal(null)}
          resourceType={yamlModal.type}
          resourceName={yamlModal.name}
          namespace={yamlModal.namespace}
        />
      )}
    </div>
  );
}
