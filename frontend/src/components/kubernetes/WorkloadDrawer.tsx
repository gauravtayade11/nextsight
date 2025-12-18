import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CubeIcon,
  ServerStackIcon,
  CpuChipIcon,
  CircleStackIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  TagIcon,
  KeyIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

interface Container {
  name: string;
  image: string;
  status: 'running' | 'waiting' | 'terminated';
  restartCount: number;
  cpu: { request: string; limit: string; usage: string };
  memory: { request: string; limit: string; usage: string };
}

interface Pod {
  name: string;
  status: 'Running' | 'Pending' | 'Failed' | 'Succeeded';
  ip: string;
  node: string;
  restarts: number;
  age: string;
}

interface Workload {
  name: string;
  namespace: string;
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'ReplicaSet';
  replicas: { ready: number; desired: number };
  status: 'Healthy' | 'Degraded' | 'Progressing' | 'Failed';
  age: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  containers: Container[];
  pods: Pod[];
  events: { type: string; reason: string; message: string; time: string }[];
  conditions: { type: string; status: string; reason: string; message: string; lastTransition: string }[];
}

interface WorkloadDrawerProps {
  workload: Workload | null;
  isOpen: boolean;
  onClose: () => void;
}

// No mock data - workload must be provided via props

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'pods', label: 'Pods' },
  { id: 'containers', label: 'Containers' },
  { id: 'events', label: 'Events' },
  { id: 'yaml', label: 'YAML' },
];

export default function WorkloadDrawer({ workload, isOpen, onClose }: WorkloadDrawerProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState<string[]>(['labels', 'conditions']);

  // Return empty drawer if no workload provided
  if (!workload) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-screen w-[600px] max-w-full bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Workload Details</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              No workload selected
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'running':
      case 'succeeded':
      case 'true':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'degraded':
      case 'failed':
      case 'terminated':
      case 'false':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'progressing':
      case 'pending':
      case 'waiting':
        return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const getResourcePercentage = (usage: string, limit: string) => {
    const parseValue = (val: string) => {
      if (val.endsWith('m')) return parseInt(val) / 1000;
      if (val.endsWith('Mi')) return parseInt(val);
      if (val.endsWith('Gi')) return parseInt(val) * 1024;
      return parseInt(val);
    };
    const usageVal = parseValue(usage);
    const limitVal = parseValue(limit);
    return Math.round((usageVal / limitVal) * 100);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <ServerStackIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{workload.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>{workload.kind}</span>
                    <span>/</span>
                    <span>{workload.namespace}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400"
                  title="Refresh"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400"
                  title="Open in new tab"
                >
                  <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400"
                >
                  <XMarkIcon className="h-5 w-5" />
                </motion.button>
              </div>
            </div>

            {/* Status Banner */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(workload.status)}`}>
                    {workload.status === 'Healthy' ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (
                      <ExclamationTriangleIcon className="h-4 w-4" />
                    )}
                    {workload.status}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {workload.replicas.ready}/{workload.replicas.desired} replicas ready
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                  >
                    Scale
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                  >
                    Restart
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 border-b border-gray-200 dark:border-slate-700">
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'overview' && (
                <>
                  {/* Quick Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{workload.replicas.ready}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ready Pods</p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{workload.containers.length}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Containers</p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{workload.pods.reduce((acc, p) => acc + p.restarts, 0)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Restarts</p>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{workload.age}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Age</p>
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('labels')}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <TagIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Labels</span>
                        <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400">
                          {Object.keys(workload.labels).length}
                        </span>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expandedSections.includes('labels') ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {expandedSections.includes('labels') && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 flex flex-wrap gap-2">
                            {Object.entries(workload.labels).map(([key, value]) => (
                              <span key={key} className="inline-flex items-center px-2 py-1 text-xs rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                <span className="font-medium">{key}</span>
                                <span className="mx-1">=</span>
                                <span>{value}</span>
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Conditions */}
                  <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <button
                      onClick={() => toggleSection('conditions')}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Conditions</span>
                      </div>
                      <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${expandedSections.includes('conditions') ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {expandedSections.includes('conditions') && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 space-y-2">
                            {workload.conditions.map((condition, index) => (
                              <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50 dark:bg-slate-800/30">
                                <span className={`mt-0.5 px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(condition.status)}`}>
                                  {condition.status}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{condition.type}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{condition.message}</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{condition.lastTransition}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {activeTab === 'pods' && (
                <div className="space-y-3">
                  {workload.pods.map((pod) => (
                    <div
                      key={pod.name}
                      className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CubeIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{pod.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(pod.status)}`}>
                          {pod.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div>
                          <p className="text-gray-400 dark:text-gray-500">IP</p>
                          <p className="font-mono">{pod.ip}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 dark:text-gray-500">Node</p>
                          <p>{pod.node}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 dark:text-gray-500">Restarts</p>
                          <p>{pod.restarts}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 dark:text-gray-500">Age</p>
                          <p>{pod.age}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'containers' && (
                <div className="space-y-4">
                  {workload.containers.map((container) => (
                    <div
                      key={container.name}
                      className="p-4 rounded-xl border border-gray-200 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <CubeIcon className="h-5 w-5 text-blue-500" />
                          <span className="font-medium text-gray-900 dark:text-white">{container.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusColor(container.status)}`}>
                          {container.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-mono bg-gray-50 dark:bg-slate-800/50 p-2 rounded-lg truncate">
                        {container.image}
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">CPU</span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {container.cpu.usage} / {container.cpu.limit}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${getResourcePercentage(container.cpu.usage, container.cpu.limit)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Memory</span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {container.memory.usage} / {container.memory.limit}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${getResourcePercentage(container.memory.usage, container.memory.limit)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'events' && (
                <div className="space-y-2">
                  {workload.events.map((event, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-xl border ${
                        event.type === 'Warning'
                          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                          : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {event.type === 'Warning' ? (
                          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
                        ) : (
                          <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{event.reason}</span>
                            <span className="text-xs text-gray-400">{event.time}</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'yaml' && (
                <div className="rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-700 overflow-hidden">
                  <div className="p-3 bg-slate-800 dark:bg-slate-900 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">YAML Manifest</span>
                    <button className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400">
                      <DocumentDuplicateIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <pre className="p-4 text-xs text-slate-300 overflow-x-auto font-mono">
{`apiVersion: apps/v1
kind: ${workload.kind}
metadata:
  name: ${workload.name}
  namespace: ${workload.namespace}
  labels:
${Object.entries(workload.labels).map(([k, v]) => `    ${k}: ${v}`).join('\n')}
spec:
  replicas: ${workload.replicas.desired}
  selector:
    matchLabels:
      app: ${workload.labels.app || workload.name}
  template:
    spec:
      containers:
${workload.containers.map(c => `      - name: ${c.name}
        image: ${c.image}
        resources:
          requests:
            cpu: ${c.cpu.request}
            memory: ${c.memory.request}
          limits:
            cpu: ${c.cpu.limit}
            memory: ${c.memory.limit}`).join('\n')}`}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export { WorkloadDrawer };
