import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { kubernetesApi } from '../../services/api';
import { useNamespace } from '../../contexts/NamespaceContext';
import type { K8sService, Ingress, Namespace, ServiceCreateRequest, IngressCreateRequest } from '../../types';
import {
  ArrowPathIcon,
  GlobeAltIcon,
  ServerStackIcon,
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  LinkIcon,
  CloudIcon,
  ComputerDesktopIcon,
  CubeIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../common/PageHeader';

// Import shared constants
import { containerVariants, itemVariants, COLOR_PALETTE } from '../../utils/constants';

// Types
interface NetworkStats {
  services: number;
  ingresses: number;
  loadBalancers: number;
  clusterIPs: number;
  nodePort: number;
  externalName: number;
}

// Service Type Badge
function ServiceTypeBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    ClusterIP: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
    NodePort: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
    LoadBalancer: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    ExternalName: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  };
  const style = config[type] || config.ClusterIP;
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${style.bg} ${style.text}`}>
      {type}
    </span>
  );
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
  icon: typeof ServerStackIcon;
  color: 'blue' | 'green' | 'purple' | 'orange';
  index: number;
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
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

// Create Service Modal
function CreateServiceModal({
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
  const [formData, setFormData] = useState<ServiceCreateRequest>({
    name: '',
    namespace: 'default',
    type: 'ClusterIP',
    selector: {},
    ports: [{ port: 80, target_port: 80, protocol: 'TCP' }],
    labels: {},
  });
  const [selectorInput, setSelectorInput] = useState('app=');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Parse selector from string
      const selector: Record<string, string> = {};
      selectorInput.split(',').forEach(pair => {
        const [key, value] = pair.trim().split('=');
        if (key && value) selector[key] = value;
      });

      await kubernetesApi.createService({ ...formData, selector });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    } finally {
      setLoading(false);
    }
  };

  const addPort = () => {
    setFormData({
      ...formData,
      ports: [...formData.ports, { port: 80, target_port: 80, protocol: 'TCP' }],
    });
  };

  const removePort = (index: number) => {
    setFormData({
      ...formData,
      ports: formData.ports.filter((_, i) => i !== index),
    });
  };

  const updatePort = (index: number, field: string, value: string | number) => {
    const newPorts = [...formData.ports];
    newPorts[index] = { ...newPorts[index], [field]: value };
    setFormData({ ...formData, ports: newPorts });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Service">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
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
              placeholder="my-service"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
          <div className="flex gap-3">
            {['ClusterIP', 'NodePort', 'LoadBalancer'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, type })}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  formData.type === type
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selector</label>
          <input
            type="text"
            value={selectorInput}
            onChange={(e) => setSelectorInput(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
            placeholder="app=my-app,tier=frontend"
          />
          <p className="mt-1 text-xs text-gray-500">Comma-separated key=value pairs</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ports</label>
            <button
              type="button"
              onClick={addPort}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <PlusIcon className="h-4 w-4" /> Add Port
            </button>
          </div>
          <div className="space-y-3">
            {formData.ports.map((port, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Port</label>
                  <input
                    type="number"
                    value={port.port}
                    onChange={(e) => updatePort(index, 'port', parseInt(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Target Port</label>
                  <input
                    type="number"
                    value={port.target_port}
                    onChange={(e) => updatePort(index, 'target_port', parseInt(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Protocol</label>
                  <select
                    value={port.protocol}
                    onChange={(e) => updatePort(index, 'protocol', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                  >
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                  </select>
                </div>
                {formData.ports.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePort(index)}
                    className="mt-5 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            Create Service
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create Ingress Modal
function CreateIngressModal({
  isOpen,
  onClose,
  onSuccess,
  namespaces,
  services,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  namespaces: Namespace[];
  services: K8sService[];
}) {
  const [formData, setFormData] = useState<IngressCreateRequest>({
    name: '',
    namespace: 'default',
    ingress_class_name: 'nginx',
    rules: [{ host: '', paths: [{ path: '/', path_type: 'Prefix', service_name: '', service_port: 80 }] }],
    tls: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await kubernetesApi.createIngress(formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ingress');
    } finally {
      setLoading(false);
    }
  };

  const updateRule = (ruleIndex: number, field: string, value: string) => {
    const newRules = [...formData.rules];
    newRules[ruleIndex] = { ...newRules[ruleIndex], [field]: value };
    setFormData({ ...formData, rules: newRules });
  };

  const updatePath = (ruleIndex: number, pathIndex: number, field: string, value: string | number) => {
    const newRules = [...formData.rules];
    const newPaths = [...newRules[ruleIndex].paths];
    newPaths[pathIndex] = { ...newPaths[pathIndex], [field]: value };
    newRules[ruleIndex] = { ...newRules[ruleIndex], paths: newPaths };
    setFormData({ ...formData, rules: newRules });
  };

  const filteredServices = services.filter(s => s.namespace === formData.namespace);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Ingress">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
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
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500"
              placeholder="my-ingress"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Namespace</label>
            <select
              value={formData.namespace}
              onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500"
            >
              {namespaces.map((ns) => (
                <option key={ns.name} value={ns.name}>{ns.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ingress Class</label>
          <input
            type="text"
            value={formData.ingress_class_name || ''}
            onChange={(e) => setFormData({ ...formData, ingress_class_name: e.target.value })}
            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500"
            placeholder="nginx"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rules</label>
          {formData.rules.map((rule, ruleIndex) => (
            <div key={ruleIndex} className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl space-y-4 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Host</label>
                <input
                  type="text"
                  value={rule.host || ''}
                  onChange={(e) => updateRule(ruleIndex, 'host', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                  placeholder="example.com"
                />
              </div>
              {rule.paths.map((path, pathIndex) => (
                <div key={pathIndex} className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Path</label>
                    <input
                      type="text"
                      value={path.path}
                      onChange={(e) => updatePath(ruleIndex, pathIndex, 'path', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Path Type</label>
                    <select
                      value={path.path_type}
                      onChange={(e) => updatePath(ruleIndex, pathIndex, 'path_type', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                    >
                      <option value="Prefix">Prefix</option>
                      <option value="Exact">Exact</option>
                      <option value="ImplementationSpecific">ImplementationSpecific</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Service</label>
                    <select
                      value={path.service_name}
                      onChange={(e) => updatePath(ruleIndex, pathIndex, 'service_name', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                    >
                      <option value="">Select service</option>
                      {filteredServices.map((svc) => (
                        <option key={svc.name} value={svc.name}>{svc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Port</label>
                    <input
                      type="number"
                      value={path.service_port}
                      onChange={(e) => updatePath(ruleIndex, pathIndex, 'service_port', parseInt(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            Create Ingress
          </button>
        </div>
      </form>
    </Modal>
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
        <p className="text-sm text-gray-500">This action cannot be undone.</p>
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

// Services Table
function ServicesTable({
  services,
  loading,
  onRefresh,
  onDelete,
  onViewYAML,
}: {
  services: K8sService[];
  loading: boolean;
  onRefresh: () => void;
  onDelete: (namespace: string, name: string) => void;
  onViewYAML: (namespace: string, name: string, kind: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredServices = services.filter((svc) => {
    if (typeFilter !== 'all' && svc.type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        svc.name.toLowerCase().includes(query) ||
        svc.namespace.toLowerCase().includes(query)
      );
    }
    return true;
  });

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
              <ServerStackIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Services</h3>
            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-full">
              {filteredServices.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-white/50 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm bg-white/50 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700/50 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="ClusterIP">ClusterIP</option>
              <option value="NodePort">NodePort</option>
              <option value="LoadBalancer">LoadBalancer</option>
              <option value="ExternalName">ExternalName</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-900/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cluster IP</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">External IP</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ports</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/50 dark:divide-slate-700/50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center">
                  <ArrowPathIcon className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : filteredServices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                  No services found
                </td>
              </tr>
            ) : (
              filteredServices.map((svc, index) => (
                <motion.tr
                  key={`${svc.namespace}/${svc.name}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <CubeIcon className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{svc.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{svc.namespace}</td>
                  <td className="px-5 py-4">
                    <ServiceTypeBadge type={svc.type} />
                  </td>
                  <td className="px-5 py-4">
                    <code className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-lg text-gray-700 dark:text-gray-300">
                      {svc.cluster_ip || '-'}
                    </code>
                  </td>
                  <td className="px-5 py-4">
                    {svc.external_ip ? (
                      <code className="text-xs bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-lg text-green-700 dark:text-green-400">
                        {svc.external_ip}
                      </code>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {svc.ports?.map((port: any, idx: number) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg text-gray-600 dark:text-gray-400"
                        >
                          {port.port}/{port.protocol}
                          {port.nodePort && `:${port.nodePort}`}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onViewYAML(svc.namespace, svc.name, 'Service')}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="View YAML"
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(svc.namespace, svc.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// Ingresses Table
function IngressesTable({
  ingresses,
  loading,
  onDelete,
  onViewYAML,
}: {
  ingresses: Ingress[];
  loading: boolean;
  onDelete: (namespace: string, name: string) => void;
  onViewYAML: (namespace: string, name: string, kind: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredIngresses = ingresses.filter((ing) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        ing.name.toLowerCase().includes(query) ||
        ing.namespace.toLowerCase().includes(query) ||
        ing.hosts?.some((h: string) => h.toLowerCase().includes(query))
      );
    }
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-gray-200/50 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <GlobeAltIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Ingresses</h3>
            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-full">
              {filteredIngresses.length}
            </span>
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ingresses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-white/50 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-900/50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hosts</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TLS</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/50 dark:divide-slate-700/50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center">
                  <ArrowPathIcon className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : filteredIngresses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                  No ingresses found
                </td>
              </tr>
            ) : (
              filteredIngresses.map((ing, index) => (
                <motion.tr
                  key={`${ing.namespace}/${ing.name}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{ing.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{ing.namespace}</td>
                  <td className="px-5 py-4">
                    <span className="px-2.5 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                      {ing.class_name || 'default'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {ing.hosts?.map((host: string, idx: number) => (
                        <a
                          key={idx}
                          href={`https://${host}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-lg text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          <LinkIcon className="h-3 w-3" />
                          {host}
                        </a>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {ing.address ? (
                      <code className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-lg text-gray-700 dark:text-gray-300">
                        {ing.address}
                      </code>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg">Pending</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {ing.tls && ing.tls.length > 0 ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <ExclamationCircleIcon className="h-5 w-5 text-amber-500 mx-auto" />
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onViewYAML(ing.namespace, ing.name, 'Ingress')}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                        title="View YAML"
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(ing.namespace, ing.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// Network Topology Visual
function NetworkTopology({ services, ingresses }: { services: K8sService[]; ingresses: Ingress[] }) {
  const lbServices = services.filter(s => s.type === 'LoadBalancer');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-green-100 dark:bg-green-900/30">
          <ArrowsRightLeftIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Network Topology</h3>
      </div>

      <div className="relative py-8">
        {/* Internet */}
        <div className="flex justify-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/25"
          >
            <CloudIcon className="h-5 w-5 text-white" />
            <span className="text-sm font-medium text-white">Internet</span>
          </motion.div>
        </div>

        {/* Connector */}
        <div className="absolute left-1/2 top-24 w-px h-8 bg-gradient-to-b from-blue-500 to-purple-500" />

        {/* Ingress Layer */}
        {ingresses.length > 0 && (
          <>
            <div className="flex justify-center mb-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4 px-6 py-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-800"
              >
                <GlobeAltIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <div>
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-400">Ingress Controller</span>
                  <p className="text-xs text-purple-600 dark:text-purple-500">{ingresses.length} ingress rules</p>
                </div>
              </motion.div>
            </div>
            <div className="absolute left-1/2 top-44 w-px h-8 bg-gradient-to-b from-purple-500 to-green-500" />
          </>
        )}

        {/* Load Balancers */}
        {lbServices.length > 0 && (
          <div className="flex justify-center gap-3 mb-8 flex-wrap">
            {lbServices.slice(0, 4).map((svc, index) => (
              <motion.div
                key={svc.name}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-xl border border-green-200 dark:border-green-800"
              >
                <ServerStackIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">{svc.name}</span>
              </motion.div>
            ))}
            {lbServices.length > 4 && (
              <span className="text-xs text-gray-500 self-center">+{lbServices.length - 4} more</span>
            )}
          </div>
        )}

        {/* Services Layer */}
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-4 px-6 py-3 bg-gray-100 dark:bg-slate-700 rounded-xl border border-gray-200 dark:border-slate-600"
          >
            <CubeIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cluster Services</span>
              <p className="text-xs text-gray-500 dark:text-gray-500">{services.length} services</p>
            </div>
          </motion.div>
        </div>

        {/* Connector */}
        <div className="absolute left-1/2 bottom-20 w-px h-8 bg-gradient-to-b from-gray-400 to-orange-500" />

        {/* Pods Layer */}
        <div className="flex justify-center mt-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-4 px-6 py-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl border border-orange-200 dark:border-orange-800"
          >
            <ComputerDesktopIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div>
              <span className="text-sm font-medium text-orange-700 dark:text-orange-400">Pods</span>
              <p className="text-xs text-orange-600 dark:text-orange-500">Application workloads</p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// YAML Viewer Modal
function YAMLViewerModal({
  isOpen,
  onClose,
  yaml,
  resourceName,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  yaml: string;
  resourceName: string;
  loading: boolean;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`YAML: ${resourceName}`}>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-sm overflow-x-auto font-mono max-h-[60vh] overflow-y-auto">
          {yaml}
        </pre>
      )}
    </Modal>
  );
}

// Main Component
type TabType = 'services' | 'ingresses' | 'topology';

export default function NetworkingDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedNamespace } = useNamespace();

  // Get initial tab from URL
  const getInitialTab = (): TabType => {
    const tabParam = searchParams.get('tab');
    const validTabs: TabType[] = ['services', 'ingresses', 'topology'];
    if (tabParam && validTabs.includes(tabParam as TabType)) {
      return tabParam as TabType;
    }
    return 'services';
  };

  const [services, setServices] = useState<K8sService[]>([]);
  const [ingresses, setIngresses] = useState<Ingress[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());

  // Modals
  const [showCreateServiceModal, setShowCreateServiceModal] = useState(false);
  const [showCreateIngressModal, setShowCreateIngressModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: string; namespace: string; name: string } | null>(null);
  const [yamlModal, setYamlModal] = useState<{ isOpen: boolean; yaml: string; name: string; loading: boolean } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Sync URL when tab changes
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  // Sync with URL params when they change
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const validTabs: TabType[] = ['services', 'ingresses', 'topology'];
    if (tabParam && validTabs.includes(tabParam as TabType) && tabParam !== activeTab) {
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
      const [servicesRes, ingressesRes, namespacesRes] = await Promise.all([
        kubernetesApi.getServices(ns),
        kubernetesApi.getIngresses(ns),
        kubernetesApi.getNamespaces(),
      ]);
      setServices(servicesRes.data || []);
      setIngresses(ingressesRes.data || []);
      setNamespaces(namespacesRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load networking data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      if (deleteModal.type === 'Service') {
        await kubernetesApi.deleteService(deleteModal.namespace, deleteModal.name);
      } else {
        await kubernetesApi.deleteIngress(deleteModal.namespace, deleteModal.name);
      }
      loadData();
      setDeleteModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete resource');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleViewYAML = async (namespace: string, name: string, kind: string) => {
    setYamlModal({ isOpen: true, yaml: '', name: `${kind}/${name}`, loading: true });
    try {
      const res = await kubernetesApi.getResourceYAML({ kind, name, namespace });
      setYamlModal({ isOpen: true, yaml: res.data.yaml_content, name: `${kind}/${name}`, loading: false });
    } catch (err) {
      setYamlModal({ isOpen: true, yaml: `Error: ${err instanceof Error ? err.message : 'Failed to fetch YAML'}`, name: `${kind}/${name}`, loading: false });
    }
  };

  // Calculate stats
  const stats: NetworkStats = {
    services: services.length,
    ingresses: ingresses.length,
    loadBalancers: services.filter((s) => s.type === 'LoadBalancer').length,
    clusterIPs: services.filter((s) => s.type === 'ClusterIP').length,
    nodePort: services.filter((s) => s.type === 'NodePort').length,
    externalName: services.filter((s) => s.type === 'ExternalName').length,
  };

  const tabs = [
    { id: 'services', label: 'Services', icon: ServerStackIcon, count: stats.services },
    { id: 'ingresses', label: 'Ingresses', icon: GlobeAltIcon, count: stats.ingresses },
    { id: 'topology', label: 'Topology', icon: ArrowsRightLeftIcon },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Networking"
        description="Manage services, ingresses, and network policies"
        icon={GlobeAltIcon}
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
            {activeTab === 'services' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateServiceModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25"
              >
                <PlusIcon className="h-4 w-4" />
                Create Service
              </motion.button>
            )}
            {activeTab === 'ingresses' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateIngressModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-purple-500/25"
              >
                <PlusIcon className="h-4 w-4" />
                Create Ingress
              </motion.button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Services" value={stats.services} icon={ServerStackIcon} color="blue" index={0} />
        <StatsCard title="Ingresses" value={stats.ingresses} icon={GlobeAltIcon} color="purple" index={1} />
        <StatsCard title="Load Balancers" value={stats.loadBalancers} icon={CloudIcon} color="green" index={2} />
        <StatsCard title="NodePorts" value={stats.nodePort} icon={ArrowsRightLeftIcon} color="orange" index={3} />
      </div>

      {/* Tabs - Sticky below header */}
      <div className="sticky top-[72px] z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 bg-gradient-to-r from-slate-50/95 via-white/95 to-slate-50/95 dark:from-slate-900/95 dark:via-slate-900/95 dark:to-slate-900/95 backdrop-blur-md border-b border-gray-200/50 dark:border-slate-700/50">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700/50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                  activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400"
        >
          <p>{error}</p>
          <button onClick={loadData} className="mt-2 text-sm underline hover:no-underline">
            Retry
          </button>
        </motion.div>
      )}

      {/* Tab Content */}
      {activeTab === 'services' && (
        <ServicesTable
          services={services}
          loading={loading}
          onRefresh={loadData}
          onDelete={(namespace, name) => setDeleteModal({ isOpen: true, type: 'Service', namespace, name })}
          onViewYAML={handleViewYAML}
        />
      )}
      {activeTab === 'ingresses' && (
        <IngressesTable
          ingresses={ingresses}
          loading={loading}
          onDelete={(namespace, name) => setDeleteModal({ isOpen: true, type: 'Ingress', namespace, name })}
          onViewYAML={handleViewYAML}
        />
      )}
      {activeTab === 'topology' && (
        <NetworkTopology services={services} ingresses={ingresses} />
      )}

      {/* Modals */}
      <CreateServiceModal
        isOpen={showCreateServiceModal}
        onClose={() => setShowCreateServiceModal(false)}
        onSuccess={loadData}
        namespaces={namespaces}
      />

      <CreateIngressModal
        isOpen={showCreateIngressModal}
        onClose={() => setShowCreateIngressModal(false)}
        onSuccess={loadData}
        namespaces={namespaces}
        services={services}
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

      {yamlModal && (
        <YAMLViewerModal
          isOpen={yamlModal.isOpen}
          onClose={() => setYamlModal(null)}
          yaml={yamlModal.yaml}
          resourceName={yamlModal.name}
          loading={yamlModal.loading}
        />
      )}
    </div>
  );
}
