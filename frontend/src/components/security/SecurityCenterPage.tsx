import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  UserGroupIcon,
  LockClosedIcon,
  KeyIcon,
  BugAntIcon,
  CubeIcon,
  EyeIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import GlassCard from '../common/GlassCard';

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

// Types
interface SecurityViolation {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'rbac' | 'network' | 'container' | 'secret' | 'compliance';
  resource: string;
  namespace: string;
  detected: string;
}

interface ImageVulnerability {
  image: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  lastScanned: string;
}

interface RBACNode {
  id: string;
  type: 'user' | 'group' | 'serviceAccount' | 'role' | 'clusterRole';
  name: string;
  namespace?: string;
  bindings: string[];
}

// Security Score Gauge Component
function SecurityScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: '#10B981', bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' };
    if (s >= 60) return { stroke: '#F59E0B', bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' };
    return { stroke: '#EF4444', bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' };
  };

  const color = getColor(score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="45"
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          className="text-gray-200 dark:text-slate-700"
        />
        <motion.circle
          cx="64"
          cy="64"
          r="45"
          stroke={color.stroke}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${color.text}`}>{score}</span>
        <span className="text-xs text-gray-500">Score</span>
      </div>
    </div>
  );
}

// KPI Card Component
function SecurityKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
  index,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; direction: 'up' | 'down' };
  color: 'red' | 'amber' | 'green' | 'blue' | 'purple';
  index: number;
}) {
  const colorClasses = {
    red: { bg: 'bg-red-100 dark:bg-red-500/10', icon: 'text-red-600 dark:text-red-400', value: 'text-red-600 dark:text-red-400' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-500/10', icon: 'text-amber-600 dark:text-amber-400', value: 'text-amber-600 dark:text-amber-400' },
    green: { bg: 'bg-emerald-100 dark:bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', value: 'text-emerald-600 dark:text-emerald-400' },
    blue: { bg: 'bg-blue-100 dark:bg-blue-500/10', icon: 'text-blue-600 dark:text-blue-400', value: 'text-blue-600 dark:text-blue-400' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-500/10', icon: 'text-purple-600 dark:text-purple-400', value: 'text-purple-600 dark:text-purple-400' },
  };

  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <GlassCard className="p-4 h-full">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-xl ${colors.bg}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
          {trend && (
            <span className={`text-xs font-medium ${trend.direction === 'down' ? 'text-emerald-500' : 'text-red-500'}`}>
              {trend.direction === 'down' ? '↓' : '↑'} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        <div className="mt-3">
          <p className={`text-2xl font-bold ${colors.value}`}>{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
          {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// Severity Badge
function SeverityBadge({ severity }: { severity: SecurityViolation['severity'] }) {
  const config = {
    critical: { bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
    high: { bg: 'bg-orange-100 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
    medium: { bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
    low: { bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  };

  const { bg, text } = config[severity];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {severity.toUpperCase()}
    </span>
  );
}

// Simple RBAC Visualization
function RBACVisualization({ nodes }: { nodes: RBACNode[] }) {
  const typeColors: Record<RBACNode['type'], string> = {
    user: 'bg-blue-500',
    group: 'bg-purple-500',
    serviceAccount: 'bg-emerald-500',
    role: 'bg-amber-500',
    clusterRole: 'bg-red-500',
  };

  const typeIcons: Record<RBACNode['type'], React.ElementType> = {
    user: UserGroupIcon,
    group: UserGroupIcon,
    serviceAccount: KeyIcon,
    role: LockClosedIcon,
    clusterRole: ShieldCheckIcon,
  };

  return (
    <div className="space-y-3">
      {nodes.map((node, idx) => {
        const Icon = typeIcons[node.type];
        return (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <div className={`p-2 rounded-lg ${typeColors[node.type]}/10`}>
              <Icon className={`h-4 w-4 ${typeColors[node.type].replace('bg-', 'text-')}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{node.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 capitalize">{node.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                {node.namespace && (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 rounded text-gray-500">
                    {node.namespace}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">{node.bindings.length} bindings</span>
              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Image Vulnerability Chart
function ImageVulnerabilityChart({ images }: { images: ImageVulnerability[] }) {
  const maxTotal = Math.max(...images.map(i => i.critical + i.high + i.medium + i.low));

  return (
    <div className="space-y-3">
      {images.map((image, idx) => {
        const total = image.critical + image.high + image.medium + image.low;
        const criticalWidth = (image.critical / maxTotal) * 100;
        const highWidth = (image.high / maxTotal) * 100;
        const mediumWidth = (image.medium / maxTotal) * 100;
        const lowWidth = (image.low / maxTotal) * 100;

        return (
          <motion.div
            key={image.image}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[70%]">{image.image}</p>
              <span className="text-xs text-gray-400">{total} issues</span>
            </div>
            <div className="h-2 flex rounded-full overflow-hidden bg-gray-200 dark:bg-slate-700">
              {image.critical > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${criticalWidth}%` }}
                  className="bg-red-500"
                  title={`${image.critical} critical`}
                />
              )}
              {image.high > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${highWidth}%` }}
                  className="bg-orange-500"
                  title={`${image.high} high`}
                />
              )}
              {image.medium > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${mediumWidth}%` }}
                  className="bg-amber-500"
                  title={`${image.medium} medium`}
                />
              )}
              {image.low > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${lowWidth}%` }}
                  className="bg-blue-500"
                  title={`${image.low} low`}
                />
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {image.critical} Critical</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> {image.high} High</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {image.medium} Med</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> {image.low} Low</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// AI Security Suggestion Component
function AISecuritySuggestion({
  title,
  description,
  priority,
  action,
  index,
}: {
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium';
  action: string;
  index: number;
}) {
  const priorityColors = {
    critical: 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5',
    high: 'border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5',
    medium: 'border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5',
  };

  const badgeColors = {
    critical: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400',
    high: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    medium: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`p-4 rounded-xl border ${priorityColors[priority]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
            <SparklesIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          </div>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColors[priority]}`}>
          {priority.toUpperCase()}
        </span>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors"
      >
        {action}
      </motion.button>
    </motion.div>
  );
}

export default function SecurityCenterPage() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Mock data
  const [violations] = useState<SecurityViolation[]>([
    { id: '1', title: 'Privileged container detected', description: 'Pod running with privileged: true', severity: 'critical', category: 'container', resource: 'monitoring/prometheus-0', namespace: 'monitoring', detected: '2h ago' },
    { id: '2', title: 'No network policy', description: 'Namespace has no network policies configured', severity: 'high', category: 'network', resource: 'production', namespace: 'production', detected: '1d ago' },
    { id: '3', title: 'Secret exposed in env', description: 'Database password visible in environment variables', severity: 'critical', category: 'secret', resource: 'api-server', namespace: 'production', detected: '4h ago' },
    { id: '4', title: 'Over-permissive RBAC', description: 'Service account has cluster-admin role', severity: 'high', category: 'rbac', resource: 'default/jenkins-sa', namespace: 'default', detected: '3d ago' },
    { id: '5', title: 'Missing resource limits', description: 'Container has no CPU/memory limits set', severity: 'medium', category: 'container', resource: 'worker-deployment', namespace: 'batch', detected: '5h ago' },
    { id: '6', title: 'Pod security policy violation', description: 'Host network access enabled', severity: 'high', category: 'compliance', resource: 'ingress-nginx', namespace: 'ingress', detected: '12h ago' },
  ]);

  const [rbacNodes] = useState<RBACNode[]>([
    { id: '1', type: 'serviceAccount', name: 'default', namespace: 'kube-system', bindings: ['cluster-admin'] },
    { id: '2', type: 'serviceAccount', name: 'jenkins-sa', namespace: 'default', bindings: ['edit', 'view'] },
    { id: '3', type: 'user', name: 'admin@example.com', bindings: ['cluster-admin'] },
    { id: '4', type: 'group', name: 'developers', bindings: ['edit'] },
    { id: '5', type: 'clusterRole', name: 'cluster-admin', bindings: ['*'] },
  ]);

  const [imageVulnerabilities] = useState<ImageVulnerability[]>([
    { image: 'nginx:1.19', critical: 3, high: 12, medium: 25, low: 8, lastScanned: '2h ago' },
    { image: 'postgres:13', critical: 1, high: 5, medium: 18, low: 12, lastScanned: '4h ago' },
    { image: 'redis:6', critical: 0, high: 2, medium: 8, low: 15, lastScanned: '1h ago' },
    { image: 'node:16', critical: 5, high: 18, medium: 42, low: 23, lastScanned: '6h ago' },
  ]);

  const [aiSuggestions] = useState([
    { title: 'Remove privileged containers', description: 'Drop CAP_SYS_ADMIN and use specific capabilities instead', priority: 'critical' as const, action: 'Apply Fix' },
    { title: 'Enable Pod Security Standards', description: 'Enforce restricted PSS profile across production namespaces', priority: 'high' as const, action: 'Configure' },
    { title: 'Implement network segmentation', description: 'Create network policies to isolate workloads by tier', priority: 'medium' as const, action: 'Generate Policies' },
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Calculate stats
  const stats = useMemo(() => ({
    securityScore: 72,
    criticalViolations: violations.filter(v => v.severity === 'critical').length,
    highViolations: violations.filter(v => v.severity === 'high').length,
    privilegedPods: 3,
    totalVulnerabilities: imageVulnerabilities.reduce((acc, i) => acc + i.critical + i.high, 0),
  }), [violations, imageVulnerabilities]);

  // Filter violations
  const filteredViolations = violations.filter(v => {
    const matchesSearch = !searchQuery || v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.resource.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || v.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

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
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-orange-600">
              <ShieldCheckIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Security Center</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Monitor and manage cluster security posture
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Scan Now
          </motion.button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Security Score */}
          <GlassCard className="col-span-2 lg:col-span-1 p-4 flex flex-col items-center justify-center">
            <SecurityScoreGauge score={stats.securityScore} />
            <p className="text-xs text-gray-500 mt-2">Security Score</p>
          </GlassCard>

          <SecurityKPICard
            title="Critical Issues"
            value={stats.criticalViolations}
            icon={ShieldExclamationIcon}
            color="red"
            trend={{ value: 15, direction: 'down' }}
            index={1}
          />
          <SecurityKPICard
            title="High Issues"
            value={stats.highViolations}
            icon={ExclamationTriangleIcon}
            color="amber"
            index={2}
          />
          <SecurityKPICard
            title="Privileged Pods"
            value={stats.privilegedPods}
            icon={LockClosedIcon}
            color="purple"
            index={3}
          />
          <SecurityKPICard
            title="Vulnerabilities"
            value={stats.totalVulnerabilities}
            subtitle="Critical + High"
            icon={BugAntIcon}
            color="blue"
            index={4}
          />
        </div>
      </motion.div>

      {/* RBAC & Image Scans */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* RBAC Visualization */}
          <GlassCard className="overflow-hidden">
            <div className="p-4 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">RBAC Overview</h2>
              </div>
              <button className="text-xs text-primary-600 dark:text-primary-400 hover:underline">View Graph</button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              <RBACVisualization nodes={rbacNodes} />
            </div>
          </GlassCard>

          {/* Image Scan Summary */}
          <GlassCard className="overflow-hidden">
            <div className="p-4 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CubeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Image Vulnerabilities</h2>
              </div>
              <button className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Full Report</button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              <ImageVulnerabilityChart images={imageVulnerabilities} />
            </div>
          </GlassCard>
        </div>
      </motion.div>

      {/* Violations Table */}
      <motion.div variants={itemVariants}>
        <GlassCard className="overflow-hidden">
          <div className="p-4 border-b border-gray-200/50 dark:border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Security Violations</h2>
              <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full">
                {filteredViolations.length}
              </span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search violations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80"
                />
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Violation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Severity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Resource</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Detected</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                {filteredViolations.map((violation) => (
                  <motion.tr
                    key={violation.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{violation.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{violation.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={violation.severity} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-lg capitalize">
                        {violation.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">{violation.resource}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {violation.detected}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>

      {/* AI Security Suggestions */}
      <motion.div variants={itemVariants}>
        <GlassCard className="overflow-hidden">
          <div className="p-4 border-b border-gray-200/50 dark:border-slate-700/50 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
              <SparklesIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">AI Security Recommendations</h2>
          </div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {aiSuggestions.map((suggestion, idx) => (
              <AISecuritySuggestion key={idx} {...suggestion} index={idx} />
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
