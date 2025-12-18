import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CircleStackIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  ServerIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../services/api';
import { logger } from '../../utils/logger';
import GlassCard from '../common/GlassCard';
import type { PVC, Namespace } from '../../types';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Mock PV type since it's not in the types file
interface PV {
  name: string;
  capacity: string;
  accessModes: string[];
  reclaimPolicy: string;
  status: 'Available' | 'Bound' | 'Released' | 'Failed';
  claim?: string;
  storageClass?: string;
  age: string;
}

// Mock Storage Class type
interface StorageClass {
  name: string;
  provisioner: string;
  reclaimPolicy: string;
  volumeBindingMode: string;
  isDefault: boolean;
  allowVolumeExpansion: boolean;
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    Bound: { bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircleIcon },
    Available: { bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', icon: CheckCircleIcon },
    Pending: { bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', icon: ClockIcon },
    Released: { bg: 'bg-gray-100 dark:bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400', icon: ExclamationTriangleIcon },
    Failed: { bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', icon: XCircleIcon },
  };

  const { bg, text, icon: Icon } = config[status] || config.Pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

// Access Mode Badge
function AccessModeBadge({ mode }: { mode: string }) {
  const shortMode = mode === 'ReadWriteOnce' ? 'RWO' : mode === 'ReadOnlyMany' ? 'ROX' : mode === 'ReadWriteMany' ? 'RWX' : mode;

  return (
    <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
      {shortMode}
    </span>
  );
}

// KPI Card Component
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  index,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'amber' | 'purple';
  index: number;
}) {
  const colorClasses = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-500/10', icon: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-emerald-100 dark:bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-500/10', icon: 'text-amber-600 dark:text-amber-400' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-500/10', icon: 'text-purple-600 dark:text-purple-400' },
  };

  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${colors.bg}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
            {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export default function StoragePage() {
  const [loading, setLoading] = useState(true);
  const [pvcs, setPVCs] = useState<PVC[]>([]);
  const [pvs, setPVs] = useState<PV[]>([]);
  const [storageClasses, setStorageClasses] = useState<StorageClass[]>([]);
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [pvcsRes, pvsRes, storageClassesRes, namespacesRes] = await Promise.all([
        kubernetesApi.getPVCs().catch(() => ({ data: [] })),
        kubernetesApi.getPVs().catch(() => ({ data: [] })),
        kubernetesApi.getStorageClasses().catch(() => ({ data: [] })),
        kubernetesApi.getNamespaces().catch(() => ({ data: [] })),
      ]);

      setPVCs(pvcsRes.data);
      setNamespaces(namespacesRes.data);

      // Transform PV data from backend format
      const transformedPVs: PV[] = (pvsRes.data || []).map((pv: any) => ({
        name: pv.name,
        capacity: pv.capacity || pv.storage || '0Gi',
        accessModes: pv.access_modes || pv.accessModes || [],
        reclaimPolicy: pv.reclaim_policy || pv.reclaimPolicy || 'Delete',
        status: pv.status || 'Available',
        claim: pv.claim || pv.claim_ref,
        storageClass: pv.storage_class || pv.storageClass,
        age: pv.age || calculateAge(pv.created_at || pv.createdAt),
      }));
      setPVs(transformedPVs);

      // Transform Storage Class data from backend format
      const transformedStorageClasses: StorageClass[] = (storageClassesRes.data || []).map((sc: any) => ({
        name: sc.name,
        provisioner: sc.provisioner || 'unknown',
        reclaimPolicy: sc.reclaim_policy || sc.reclaimPolicy || 'Delete',
        volumeBindingMode: sc.volume_binding_mode || sc.volumeBindingMode || 'Immediate',
        isDefault: sc.is_default || sc.isDefault || false,
        allowVolumeExpansion: sc.allow_volume_expansion || sc.allowVolumeExpansion || false,
      }));
      setStorageClasses(transformedStorageClasses);
    } catch (error) {
      logger.error('Failed to fetch storage data', error);
    } finally {
      setLoading(false);
    }
  }

  // Helper to calculate age from timestamp
  function calculateAge(timestamp?: string): string {
    if (!timestamp) return 'Unknown';
    const created = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return '1d';
    if (diffDays < 30) return `${diffDays}d`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
  }

  // Filter PVCs
  const filteredPVCs = pvcs.filter(pvc => {
    const matchesNamespace = !selectedNamespace || pvc.namespace === selectedNamespace;
    const matchesSearch = !searchQuery || pvc.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesNamespace && matchesSearch;
  });

  // Calculate stats
  const totalCapacity = pvs.reduce((acc, pv) => {
    const sizeMatch = pv.capacity.match(/(\d+)/);
    return acc + (sizeMatch ? parseInt(sizeMatch[1]) : 0);
  }, 0);

  const boundPVCs = pvcs.filter(p => p.status === 'Bound').length;
  const availablePVs = pvs.filter(p => p.status === 'Available').length;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
              <CircleStackIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Storage</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage persistent volumes and claims
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search storage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-64"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total PVCs" value={pvcs.length} icon={CubeIcon} color="blue" index={0} />
          <KPICard title="Bound PVCs" value={boundPVCs} subtitle={`${pvcs.length - boundPVCs} pending`} icon={CheckCircleIcon} color="green" index={1} />
          <KPICard title="Persistent Volumes" value={pvs.length} subtitle={`${availablePVs} available`} icon={ServerIcon} color="purple" index={2} />
          <KPICard title="Total Capacity" value={`${totalCapacity}Gi`} icon={CircleStackIcon} color="amber" index={3} />
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* PVC List (60%) */}
          <div className="lg:col-span-3">
            <GlassCard className="overflow-hidden">
              <div className="p-4 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CubeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Persistent Volume Claims</h2>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                    {filteredPVCs.length}
                  </span>
                </div>
                <select
                  value={selectedNamespace}
                  onChange={(e) => setSelectedNamespace(e.target.value)}
                  className="text-xs px-3 py-1.5 border border-gray-200/50 dark:border-slate-700/50 rounded-lg bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300"
                >
                  <option value="">All Namespaces</option>
                  {namespaces.map((ns) => (
                    <option key={ns.name} value={ns.name}>{ns.name}</option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mode</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                    {loading && filteredPVCs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin text-blue-500" />
                          <p className="mt-3 text-sm text-gray-500">Loading PVCs...</p>
                        </td>
                      </tr>
                    ) : filteredPVCs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <CubeIcon className="h-8 w-8 mx-auto text-gray-400" />
                          <p className="mt-3 text-sm text-gray-500">No PVCs found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredPVCs.map((pvc) => (
                        <motion.tr
                          key={`${pvc.namespace}-${pvc.name}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CubeIcon className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{pvc.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-lg">
                              {pvc.namespace}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {pvc.capacity || '10Gi'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {pvc.access_modes.map((mode, idx) => (
                                <AccessModeBadge key={idx} mode={mode} />
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={pvc.status} />
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>

          {/* PV List (40%) */}
          <div className="lg:col-span-2">
            <GlassCard className="overflow-hidden">
              <div className="p-4 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center gap-2">
                <ServerIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Persistent Volumes</h2>
                <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full">
                  {pvs.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reclaim</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                    {pvs.map((pv) => (
                      <motion.tr
                        key={pv.name}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ServerIcon className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{pv.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {pv.capacity}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-lg ${
                            pv.reclaimPolicy === 'Retain'
                              ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {pv.reclaimPolicy}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={pv.status} />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        </div>
      </motion.div>

      {/* Storage Classes (Full Width) */}
      <motion.div variants={itemVariants}>
        <GlassCard className="overflow-hidden">
          <div className="p-4 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Storage Classes</h2>
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-full">
              {storageClasses.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provisioner</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reclaim Policy</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Binding Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expansion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                {storageClasses.map((sc) => (
                  <motion.tr
                    key={sc.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Cog6ToothIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{sc.name}</span>
                        {sc.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full font-medium">
                            DEFAULT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                        {sc.provisioner}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-lg ${
                        sc.reclaimPolicy === 'Retain'
                          ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {sc.reclaimPolicy}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {sc.volumeBindingMode}
                    </td>
                    <td className="px-4 py-3">
                      {sc.allowVolumeExpansion ? (
                        <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
