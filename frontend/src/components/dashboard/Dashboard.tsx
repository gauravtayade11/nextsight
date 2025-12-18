import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ServerStackIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  BoltIcon,
  CloudIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  CpuChipIcon,
  CircleStackIcon,
  ClockIcon,
  ExclamationCircleIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  RocketLaunchIcon,
  ChevronRightIcon,
  PlayIcon,
  PauseIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';
import { useCluster } from '../../contexts/ClusterContext';
import GlassCard from '../common/GlassCard';
import ActionableInsightsCard from './ActionableInsightsCard';
import useDashboardData from '../../hooks/useDashboardData';
import { logger } from '../../utils/logger';

// Import shared animation variants and utilities
import { containerVariants, itemVariants, COLOR_PALETTE } from '../../utils/constants';

// Enhanced Donut Chart Component with glow effects and animations
function DonutChart({
  data,
  size = 180,
  strokeWidth = 20
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const innerRadius = radius - strokeWidth;

  // Calculate the main percentage (running pods)
  const mainPercentage = total > 0 ? Math.round((data[0]?.value / total) * 100) : 0;

  let currentOffset = 0;

  return (
    <div className="relative group" style={{ width: size, height: size }}>
      {/* Glow effect behind chart */}
      <div
        className="absolute inset-4 rounded-full opacity-30 blur-xl transition-opacity duration-300 group-hover:opacity-50"
        style={{ background: `conic-gradient(${data.map((d, i) => `${d.color} ${i * 33}%`).join(', ')})` }}
      />

      <svg width={size} height={size} className="transform -rotate-90 relative z-10">
        {/* Filters for glow effect */}
        <defs>
          <filter id="donutGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feComponentTransfer in="SourceAlpha">
              <feFuncA type="table" tableValues="1 0" />
            </feComponentTransfer>
            <feGaussianBlur stdDeviation="3" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feFlood floodColor="#000" floodOpacity="0.15" result="color" />
            <feComposite in2="offsetblur" operator="in" />
            <feComposite in2="SourceAlpha" operator="in" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-gray-200 dark:text-slate-700/50"
          strokeWidth={strokeWidth}
        />

        {/* Data segments with glow */}
        {data.map((item, index) => {
          const percentage = total > 0 ? item.value / total : 0;
          const segmentLength = circumference * percentage;
          const offset = currentOffset;
          currentOffset += segmentLength;
          const isHovered = hoveredIndex === index;

          return (
            <motion.circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              filter={isHovered ? "url(#donutGlow)" : undefined}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{
                strokeDasharray: `${segmentLength} ${circumference - segmentLength}`,
                strokeWidth: isHovered ? strokeWidth + 4 : strokeWidth,
              }}
              transition={{ duration: 0.8, delay: index * 0.15, ease: "easeOut" }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer transition-all duration-200"
              style={{ filter: isHovered ? `drop-shadow(0 0 8px ${item.color})` : undefined }}
            />
          );
        })}

        {/* Inner decorative ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerRadius + 8}
          fill="none"
          stroke="currentColor"
          className="text-gray-100 dark:text-slate-800"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </svg>

      {/* Center content with glass effect */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <div className="relative">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center"
          >
            <span className="text-3xl font-bold bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              {mainPercentage}%
            </span>
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              Healthy
            </p>
          </motion.div>
        </div>
      </div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredIndex !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-xl z-30 whitespace-nowrap"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data[hoveredIndex].color }} />
              <span className="font-medium">{data[hoveredIndex].label}:</span>
              <span>{data[hoveredIndex].value} pods</span>
            </div>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-slate-700 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Enhanced Area Chart with smooth curves, data points, and tooltips
function AreaChart({
  cpuData,
  memoryData,
  height = 200
}: {
  cpuData: number[];
  memoryData: number[];
  height?: number;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; type: 'cpu' | 'memory' } | null>(null);

  // Use standard SVG dimensions that scale well
  const padding = { top: 25, right: 60, bottom: 30, left: 45 };
  const chartWidth = 500;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...cpuData, ...memoryData, 100);

  // Create smooth bezier curve path
  const createSmoothPath = (data: number[], fill = false) => {
    if (data.length < 2) return '';

    const points = data.map((value, index) => ({
      x: padding.left + (index / (data.length - 1)) * (chartWidth - padding.left - padding.right),
      y: padding.top + chartHeight - (value / maxValue) * chartHeight,
    }));

    // Create smooth curve using bezier
    let path = `M${points[0].x},${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const tension = 0.3;

      const cp1x = current.x + (next.x - (points[i - 1]?.x ?? current.x)) * tension;
      const cp1y = current.y + (next.y - (points[i - 1]?.y ?? current.y)) * tension;
      const cp2x = next.x - (points[i + 2]?.x ?? next.x - current.x) * tension + (current.x) * tension;
      const cp2y = next.y - ((points[i + 2]?.y ?? next.y) - current.y) * tension;

      path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
    }

    if (fill) {
      path += ` L${points[points.length - 1].x},${padding.top + chartHeight}`;
      path += ` L${points[0].x},${padding.top + chartHeight} Z`;
    }

    return path;
  };

  // Get point coordinates
  const getPointCoords = (data: number[], index: number) => ({
    x: padding.left + (index / (data.length - 1)) * (chartWidth - padding.left - padding.right),
    y: padding.top + chartHeight - (data[index] / maxValue) * chartHeight,
  });

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox={`0 0 ${chartWidth} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        {/* Definitions */}
        <defs>
          {/* Enhanced CPU gradient */}
          <linearGradient id="cpuGradientEnhanced" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
          </linearGradient>

          {/* Enhanced Memory gradient */}
          <linearGradient id="memoryGradientEnhanced" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.02" />
          </linearGradient>

          {/* Glow filters */}
          <filter id="cpuGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feFlood floodColor="#3B82F6" floodOpacity="0.5" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="memoryGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feFlood floodColor="#8B5CF6" floodOpacity="0.5" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Dot glow */}
          <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Y-axis labels and grid lines */}
        {[0, 25, 50, 75, 100].map((percent) => {
          const y = padding.top + chartHeight - (percent / maxValue) * chartHeight;
          return (
            <g key={percent}>
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-gray-400 dark:fill-gray-500"
                style={{ fontSize: '10px', fontWeight: 500 }}
              >
                {percent}
              </text>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="currentColor"
                className="text-gray-200/80 dark:text-slate-700/30"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
            </g>
          );
        })}

        {/* CPU Area with enhanced gradient */}
        <motion.path
          d={createSmoothPath(cpuData, true)}
          fill="url(#cpuGradientEnhanced)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />

        {/* Memory Area with enhanced gradient */}
        <motion.path
          d={createSmoothPath(memoryData, true)}
          fill="url(#memoryGradientEnhanced)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />

        {/* CPU Line with glow */}
        <motion.path
          d={createSmoothPath(cpuData)}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#cpuGlow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />

        {/* Memory Line with glow */}
        <motion.path
          d={createSmoothPath(memoryData)}
          fill="none"
          stroke="#8B5CF6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#memoryGlow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: "easeInOut" }}
        />

        {/* CPU Data points */}
        {cpuData.map((_, index) => {
          const coords = getPointCoords(cpuData, index);
          const isHovered = hoveredPoint?.index === index && hoveredPoint?.type === 'cpu';
          const isLast = index === cpuData.length - 1;

          return (
            <motion.g key={`cpu-${index}`}>
              {(isLast || isHovered) && (
                <>
                  <motion.circle
                    cx={coords.x}
                    cy={coords.y}
                    r={isHovered ? 6 : 5}
                    fill="#3B82F6"
                    stroke="white"
                    strokeWidth="2"
                    filter="url(#dotGlow)"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    onMouseEnter={() => setHoveredPoint({ index, type: 'cpu' })}
                    className="cursor-pointer"
                  />
                  {isLast && (
                    <motion.circle
                      cx={coords.x}
                      cy={coords.y}
                      r="8"
                      fill="transparent"
                      stroke="#3B82F6"
                      strokeWidth="1"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </>
              )}
            </motion.g>
          );
        })}

        {/* Memory Data points */}
        {memoryData.map((_, index) => {
          const coords = getPointCoords(memoryData, index);
          const isHovered = hoveredPoint?.index === index && hoveredPoint?.type === 'memory';
          const isLast = index === memoryData.length - 1;

          return (
            <motion.g key={`memory-${index}`}>
              {(isLast || isHovered) && (
                <>
                  <motion.circle
                    cx={coords.x}
                    cy={coords.y}
                    r={isHovered ? 6 : 5}
                    fill="#8B5CF6"
                    stroke="white"
                    strokeWidth="2"
                    filter="url(#dotGlow)"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.05 + 0.2 }}
                    onMouseEnter={() => setHoveredPoint({ index, type: 'memory' })}
                    className="cursor-pointer"
                  />
                  {isLast && (
                    <motion.circle
                      cx={coords.x}
                      cy={coords.y}
                      r="8"
                      fill="transparent"
                      stroke="#8B5CF6"
                      strokeWidth="1"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    />
                  )}
                </>
              )}
            </motion.g>
          );
        })}

        {/* Current value indicators at the end */}
        <g>
          {/* CPU current value badge */}
          <motion.g
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.2 }}
          >
            <rect
              x={chartWidth - padding.right + 5}
              y={getPointCoords(cpuData, cpuData.length - 1).y - 10}
              width="40"
              height="20"
              rx="4"
              fill="#3B82F6"
              className="drop-shadow-md"
            />
            <text
              x={chartWidth - padding.right + 25}
              y={getPointCoords(cpuData, cpuData.length - 1).y + 2}
              textAnchor="middle"
              fill="white"
              style={{ fontSize: '11px', fontWeight: 700 }}
            >
              {Math.round(cpuData[cpuData.length - 1])}%
            </text>
          </motion.g>

          {/* Memory current value badge */}
          <motion.g
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.4 }}
          >
            <rect
              x={chartWidth - padding.right + 5}
              y={getPointCoords(memoryData, memoryData.length - 1).y - 10}
              width="40"
              height="20"
              rx="4"
              fill="#8B5CF6"
              className="drop-shadow-md"
            />
            <text
              x={chartWidth - padding.right + 25}
              y={getPointCoords(memoryData, memoryData.length - 1).y + 2}
              textAnchor="middle"
              fill="white"
              style={{ fontSize: '11px', fontWeight: 700 }}
            >
              {Math.round(memoryData[memoryData.length - 1])}%
            </text>
          </motion.g>
        </g>
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredPoint && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900/95 dark:bg-slate-800/95 backdrop-blur-sm text-white text-xs rounded-xl shadow-xl z-30 border border-gray-700/50"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: hoveredPoint.type === 'cpu' ? '#3B82F6' : '#8B5CF6' }}
              />
              <span className="font-medium capitalize">{hoveredPoint.type}:</span>
              <span className="font-bold">
                {Math.round(hoveredPoint.type === 'cpu' ? cpuData[hoveredPoint.index] : memoryData[hoveredPoint.index])}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// KPI Card Component - Uses shared COLOR_PALETTE
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  index
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'green' | 'blue' | 'purple' | 'amber' | 'red' | 'cyan';
  trend?: { value: number; isPositive: boolean };
  index: number;
}) {
  // Use shared COLOR_PALETTE for consistent colors
  const colors = COLOR_PALETTE[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <GlassCard padding="sm" className={`hover:shadow-lg ${colors.glow} transition-shadow`}>
        <div className="flex items-center justify-between mb-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Icon className={`h-4 w-4 ${colors.icon}`} />
          </div>
          {trend && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              trend.isPositive
                ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'
            }`}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          )}
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{title}</p>
          {subtitle && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// Deployment Row Component
function DeploymentRow({
  name,
  namespace,
  status,
  replicas,
  time
}: {
  name: string;
  namespace: string;
  status: 'running' | 'pending' | 'failed';
  replicas: string;
  time: string;
}) {
  const statusConfig = {
    running: { icon: PlayIcon, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
    pending: { icon: PauseIcon, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-500/10' },
    failed: { icon: XCircleIcon, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-500/10' },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
    >
      <div className={`p-1 rounded ${config.bg}`}>
        <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{namespace}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{replicas}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{time}</p>
      </div>
    </motion.div>
  );
}

// Event Item Component
function EventItem({
  type,
  message,
  resource,
  time
}: {
  type: 'normal' | 'warning' | 'error';
  message: string;
  resource: string;
  time: string;
}) {
  const typeConfig = {
    normal: { color: 'border-blue-500', dot: 'bg-blue-500' },
    warning: { color: 'border-amber-500', dot: 'bg-amber-500' },
    error: { color: 'border-red-500', dot: 'bg-red-500' },
  };

  const config = typeConfig[type];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative pl-4 pb-4 border-l-2 ${config.color} last:pb-0`}
    >
      <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${config.dot}`} />
      <div className="ml-2">
        <p className="text-sm text-gray-900 dark:text-white">{message}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{resource}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{time}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const { clusters, activeCluster, setActiveCluster } = useCluster();

  // Use cached dashboard data with cluster-aware caching
  // Passing activeCluster?.id ensures data is refetched when cluster changes
  const { data, isLoading: initialLoading, isRefetching: refreshing, hardReset, error } = useDashboardData(activeCluster?.id);

  // Log errors for debugging
  if (error) {
    logger.error('[Dashboard] Query error', error);
  }

  // Destructure data from cache
  const clusterHealth = data?.clusterHealth ?? null;
  const deployments = data?.deployments ?? [];
  const events = data?.events ?? [];
  const metrics = data?.metrics ?? null;
  const costData = data?.costData ?? null;
  const recommendations = data?.recommendations ?? [];
  const proactiveInsights = data?.proactiveInsights ?? [];
  const cpuHistory = data?.cpuHistory ?? [];
  const memoryHistory = data?.memoryHistory ?? [];

  // Pod status data for donut chart (using hex colors for SVG stroke)
  // Show sample data when no cluster health is available for better UX
  const podStatusData = useMemo(() => {
    if (!clusterHealth) {
      // Sample data to show chart structure when no data available
      return [
        { label: 'Running', value: 24, color: '#10B981' },  // emerald-500
        { label: 'Pending', value: 3, color: '#F59E0B' },   // amber-500
        { label: 'Failed', value: 1, color: '#EF4444' },    // red-500
      ];
    }
    const running = clusterHealth.running_pods || 0;
    const total = clusterHealth.total_pods || 0;
    const pending = Math.floor((total - running) * 0.6);
    const failed = total - running - pending;
    return [
      { label: 'Running', value: running, color: '#10B981' },  // emerald-500
      { label: 'Pending', value: pending, color: '#F59E0B' },  // amber-500
      { label: 'Failed', value: failed, color: '#EF4444' },    // red-500
    ];
  }, [clusterHealth]);

  // Transform deployments for display
  const recentDeployments = useMemo(() => {
    return deployments.slice(0, 5).map(dep => {
      const isHealthy = dep.ready_replicas === dep.replicas;
      const isPending = dep.ready_replicas < dep.replicas && dep.ready_replicas > 0;
      let status: 'running' | 'pending' | 'failed' = 'running';
      if (!isHealthy) status = isPending ? 'pending' : 'failed';
      if (dep.ready_replicas === 0 && dep.replicas > 0) status = 'failed';

      return {
        name: dep.name,
        namespace: dep.namespace,
        status,
        replicas: `${dep.ready_replicas}/${dep.replicas}`,
        time: dep.age || 'N/A',
      };
    });
  }, [deployments]);

  // Transform events for display
  const recentEvents = useMemo(() => {
    return events.slice(0, 5).map(event => {
      let type: 'normal' | 'warning' | 'error' = 'normal';
      if (event.type === 'Warning') type = 'warning';
      if (event.reason?.toLowerCase().includes('fail') || event.reason?.toLowerCase().includes('error')) {
        type = 'error';
      }

      return {
        type,
        message: event.message || event.reason || 'No message',
        resource: `${event.involved_object?.kind || 'Resource'}/${event.involved_object?.name || 'unknown'}`,
        time: event.last_timestamp || event.first_timestamp || 'N/A',
      };
    });
  }, [events]);


  // Get current metrics for chart display
  // Use sample data when no real metrics are available for better UX
  const displayCpuHistory = useMemo(() => {
    if (cpuHistory.length === 0) {
      // Generate deterministic sample data based on current metrics or defaults
      const baseCpu = metrics?.cpu_percent ?? 45;
      return [32, 35, 38, 42, 45, 48, 52, 48, 45, 50, 55, 52, 48, baseCpu, baseCpu];
    }
    if (cpuHistory.length < 15) {
      return [...Array(15 - cpuHistory.length).fill(cpuHistory[0] || 30), ...cpuHistory];
    }
    return cpuHistory;
  }, [cpuHistory, metrics?.cpu_percent]);

  const displayMemoryHistory = useMemo(() => {
    if (memoryHistory.length === 0) {
      // Generate deterministic sample data based on current metrics or defaults
      const baseMem = metrics?.memory_percent ?? 60;
      return [55, 58, 62, 65, 63, 60, 58, 62, 65, 68, 65, 62, 60, baseMem, baseMem];
    }
    if (memoryHistory.length < 15) {
      return [...Array(15 - memoryHistory.length).fill(memoryHistory[0] || 50), ...memoryHistory];
    }
    return memoryHistory;
  }, [memoryHistory, metrics?.memory_percent]);

  // Handle manual refresh - use hardReset for thorough cache clearing
  const handleRefresh = async () => {
    try {
      await hardReset();
      toast.success('Data Refreshed', 'Dashboard data has been updated');
    } catch (err) {
      logger.error('[Dashboard] Refresh failed', err);
      toast.error('Refresh Failed', 'Could not refresh dashboard data');
    }
  };

  // Calculate health score
  const healthScore = useMemo(() => {
    if (!clusterHealth) return 0;
    const nodeHealth = clusterHealth.node_count > 0 ? (clusterHealth.ready_nodes / clusterHealth.node_count) * 100 : 0;
    const podHealth = clusterHealth.total_pods > 0 ? (clusterHealth.running_pods / clusterHealth.total_pods) * 100 : 0;
    return Math.round((nodeHealth + podHealth) / 2);
  }, [clusterHealth]);

  // Show loading skeleton on initial load
  if (initialLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-12 w-48 bg-gray-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-slate-700 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-slate-700 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 bg-gray-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-64 bg-gray-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Header with Cluster Selector */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <BoltIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Real-time cluster overview and insights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Cluster Selector */}
            <div className="relative">
              <select
                value={activeCluster?.id || ''}
                onChange={(e) => {
                  const cluster = clusters.find(c => c.id === e.target.value);
                  if (cluster) setActiveCluster(cluster.id);
                }}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl text-sm font-medium text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
              >
                {clusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {cluster.name}
                  </option>
                ))}
              </select>
              <CloudIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100/50 dark:bg-slate-800/50 px-3 py-2 rounded-xl">
              <ClockIcon className="h-4 w-4" />
              <span>Auto-refresh: 30s</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Actionable Insights Card */}
      <motion.div variants={itemVariants}>
        <ActionableInsightsCard insights={proactiveInsights} loading={initialLoading} />
      </motion.div>

      {/* KPI Cards Grid (6 cards) */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            title="Cluster Health"
            value={`${healthScore}%`}
            subtitle={clusterHealth?.healthy ? 'All systems operational' : 'Issues detected'}
            icon={clusterHealth?.healthy ? CheckCircleIcon : ExclamationTriangleIcon}
            color={healthScore >= 80 ? 'green' : healthScore >= 60 ? 'amber' : 'red'}
            index={0}
          />
          <KPICard
            title="Nodes"
            value={clusterHealth ? `${clusterHealth.ready_nodes}/${clusterHealth.node_count}` : '-/-'}
            subtitle="Ready / Total"
            icon={ServerStackIcon}
            color="blue"
            index={1}
          />
          <KPICard
            title="Pods"
            value={clusterHealth ? `${clusterHealth.running_pods}/${clusterHealth.total_pods}` : '-/-'}
            subtitle="Running / Total"
            icon={CubeIcon}
            color="purple"
            index={2}
          />
          <KPICard
            title="Deployments"
            value={deployments.length || 0}
            subtitle="Active deployments"
            icon={RocketLaunchIcon}
            color="cyan"
            index={3}
          />
          <KPICard
            title="Est. Monthly"
            value={costData?.total_monthly_estimate ? `$${costData.total_monthly_estimate.toFixed(0)}` : '$--'}
            subtitle={costData?.summary?.total_cost ? `Current: $${costData.summary.total_cost.total.toFixed(0)}` : 'Loading...'}
            icon={CurrencyDollarIcon}
            color="amber"
            index={4}
          />
          <KPICard
            title="AI Insights"
            value={recommendations.length || 0}
            subtitle="Optimization recommendations"
            icon={SparklesIcon}
            color="purple"
            index={5}
          />
        </div>
      </motion.div>

      {/* Middle Section: Charts */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Node CPU/Memory Graph */}
          <GlassCard padding="md" className="h-[300px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CpuChipIcon className="h-4 w-4 text-blue-500" />
                Resource Utilization
              </h2>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                  <span className="text-gray-600 dark:text-gray-400">CPU <span className="font-semibold text-blue-600 dark:text-blue-400">{metrics?.cpu_percent?.toFixed(1) || 0}%</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50" />
                  <span className="text-gray-600 dark:text-gray-400">Memory <span className="font-semibold text-purple-600 dark:text-purple-400">{metrics?.memory_percent?.toFixed(1) || 0}%</span></span>
                </div>
              </div>
            </div>
            <div className="h-[210px] w-full">
              <AreaChart cpuData={displayCpuHistory} memoryData={displayMemoryHistory} height={210} />
            </div>
            <div className="flex justify-between px-6 text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              <span>15m ago</span>
              <span>10m ago</span>
              <span>5m ago</span>
              <span>Now</span>
            </div>
          </GlassCard>

          {/* Pod Status Donut Chart */}
          <GlassCard padding="md" className="h-[300px] overflow-visible">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CircleStackIcon className="h-4 w-4 text-emerald-500" />
                Pod Status Distribution
              </h2>
              <Link
                to="/kubernetes"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View all
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex items-center justify-center gap-10 py-6">
              <DonutChart data={podStatusData} size={170} strokeWidth={18} />
              <div className="space-y-4">
                {podStatusData.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full shadow-lg"
                      style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}50` }}
                    />
                    <div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{item.value}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </motion.div>

      {/* Lower Section: Tables */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Deployments */}
          <GlassCard padding="md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <RocketLaunchIcon className="h-4 w-4 text-gray-500" />
                Recent Deployments
              </h2>
              <Link
                to="/deploy"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View all
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-1">
              {recentDeployments.length > 0 ? (
                recentDeployments.map((deployment, index) => (
                  <DeploymentRow key={index} {...deployment} />
                ))
              ) : (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                  No deployments found
                </div>
              )}
            </div>
          </GlassCard>

          {/* Events Timeline */}
          <GlassCard padding="md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ExclamationCircleIcon className="h-4 w-4 text-gray-500" />
                Events Timeline
              </h2>
              <Link
                to="/events"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View all
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-0">
              {recentEvents.length > 0 ? (
                recentEvents.map((event, index) => (
                  <EventItem key={index} {...event} />
                ))
              ) : (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                  No recent events
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </motion.div>


      {/* Quick Actions Hint */}
      <motion.div variants={itemVariants} className="text-center text-xs text-gray-400 dark:text-gray-500">
        Press <kbd className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 font-mono text-xs font-medium">Cmd+K</kbd> for quick actions
      </motion.div>
    </motion.div>
  );
}
