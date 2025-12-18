/**
 * Shared UI Constants
 * Centralizes animation variants, status mappings, and color configurations
 * to ensure consistency across all components.
 */

// =============================================================================
// ANIMATION VARIANTS (Framer Motion)
// =============================================================================

/**
 * Container animation for staggered children
 * Usage: <motion.div variants={containerVariants} initial="hidden" animate="visible">
 */
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

/**
 * Item animation for list items / cards
 * Usage: <motion.div variants={itemVariants}>
 */
export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/**
 * Fade in animation
 * Usage: <motion.div variants={fadeInVariants} initial="hidden" animate="visible">
 */
export const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

/**
 * Slide up animation
 */
export const slideUpVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

/**
 * Scale animation for modals/dialogs
 */
export const scaleVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

/**
 * Slide from right animation for drawers/panels
 */
export const slideRightVariants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.2 } },
};

/**
 * Standard animation transition timing
 */
export const TRANSITION_DURATION = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
} as const;

// =============================================================================
// STATUS CONFIGURATIONS
// =============================================================================

export type StatusType =
  | 'success' | 'running' | 'healthy' | 'deployed' | 'active' | 'connected' | 'synced'
  | 'warning' | 'pending' | 'progressing' | 'degraded' | 'installing' | 'upgrading'
  | 'error' | 'failed' | 'critical' | 'disconnected' | 'terminated'
  | 'info' | 'unknown' | 'default';

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  darkBgColor: string;
  borderColor: string;
  textColor: string;
  darkTextColor: string;
}

/**
 * Unified status configuration for consistent styling across all components
 * Usage: const config = STATUS_CONFIG[status] || STATUS_CONFIG.default;
 */
export const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  // Success states (green/emerald)
  success: {
    label: 'Success',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    darkBgColor: 'dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-600',
    darkTextColor: 'dark:text-emerald-400',
  },
  running: {
    label: 'Running',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    darkBgColor: 'dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-600',
    darkTextColor: 'dark:text-emerald-400',
  },
  healthy: {
    label: 'Healthy',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    darkBgColor: 'dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-600',
    darkTextColor: 'dark:text-emerald-400',
  },
  deployed: {
    label: 'Deployed',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    darkBgColor: 'dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-600',
    darkTextColor: 'dark:text-emerald-400',
  },
  active: {
    label: 'Active',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    darkBgColor: 'dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-600',
    darkTextColor: 'dark:text-emerald-400',
  },
  connected: {
    label: 'Connected',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    darkBgColor: 'dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-600',
    darkTextColor: 'dark:text-emerald-400',
  },
  synced: {
    label: 'Synced',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    darkBgColor: 'dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-600',
    darkTextColor: 'dark:text-emerald-400',
  },

  // Warning states (amber/yellow)
  warning: {
    label: 'Warning',
    color: 'amber',
    bgColor: 'bg-amber-100',
    darkBgColor: 'dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-600',
    darkTextColor: 'dark:text-amber-400',
  },
  pending: {
    label: 'Pending',
    color: 'amber',
    bgColor: 'bg-amber-100',
    darkBgColor: 'dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-600',
    darkTextColor: 'dark:text-amber-400',
  },
  progressing: {
    label: 'Progressing',
    color: 'blue',
    bgColor: 'bg-blue-100',
    darkBgColor: 'dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-600',
    darkTextColor: 'dark:text-blue-400',
  },
  degraded: {
    label: 'Degraded',
    color: 'amber',
    bgColor: 'bg-amber-100',
    darkBgColor: 'dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-600',
    darkTextColor: 'dark:text-amber-400',
  },
  installing: {
    label: 'Installing',
    color: 'amber',
    bgColor: 'bg-amber-100',
    darkBgColor: 'dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-600',
    darkTextColor: 'dark:text-amber-400',
  },
  upgrading: {
    label: 'Upgrading',
    color: 'blue',
    bgColor: 'bg-blue-100',
    darkBgColor: 'dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-600',
    darkTextColor: 'dark:text-blue-400',
  },

  // Error states (red)
  error: {
    label: 'Error',
    color: 'red',
    bgColor: 'bg-red-100',
    darkBgColor: 'dark:bg-red-500/10',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-600',
    darkTextColor: 'dark:text-red-400',
  },
  failed: {
    label: 'Failed',
    color: 'red',
    bgColor: 'bg-red-100',
    darkBgColor: 'dark:bg-red-500/10',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-600',
    darkTextColor: 'dark:text-red-400',
  },
  critical: {
    label: 'Critical',
    color: 'red',
    bgColor: 'bg-red-100',
    darkBgColor: 'dark:bg-red-500/10',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-600',
    darkTextColor: 'dark:text-red-400',
  },
  disconnected: {
    label: 'Disconnected',
    color: 'red',
    bgColor: 'bg-red-100',
    darkBgColor: 'dark:bg-red-500/10',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-600',
    darkTextColor: 'dark:text-red-400',
  },
  terminated: {
    label: 'Terminated',
    color: 'red',
    bgColor: 'bg-red-100',
    darkBgColor: 'dark:bg-red-500/10',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-600',
    darkTextColor: 'dark:text-red-400',
  },

  // Neutral states (gray)
  info: {
    label: 'Info',
    color: 'blue',
    bgColor: 'bg-blue-100',
    darkBgColor: 'dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-600',
    darkTextColor: 'dark:text-blue-400',
  },
  unknown: {
    label: 'Unknown',
    color: 'gray',
    bgColor: 'bg-gray-100',
    darkBgColor: 'dark:bg-gray-500/10',
    borderColor: 'border-gray-200 dark:border-gray-700',
    textColor: 'text-gray-600',
    darkTextColor: 'dark:text-gray-400',
  },
  default: {
    label: 'Unknown',
    color: 'gray',
    bgColor: 'bg-gray-100',
    darkBgColor: 'dark:bg-gray-500/10',
    borderColor: 'border-gray-200 dark:border-gray-700',
    textColor: 'text-gray-600',
    darkTextColor: 'dark:text-gray-400',
  },
};

/**
 * Get status configuration with fallback to default
 */
export function getStatusConfig(status: string): StatusConfig {
  const normalizedStatus = status.toLowerCase().replace(/[_-]/g, '') as StatusType;
  return STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.default;
}

/**
 * Get full status class string for badges
 */
export function getStatusClasses(status: string): string {
  const config = getStatusConfig(status);
  return `${config.bgColor} ${config.darkBgColor} ${config.textColor} ${config.darkTextColor}`;
}

// =============================================================================
// SEVERITY CONFIGURATIONS
// =============================================================================

export type SeverityType = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_CONFIG: Record<SeverityType, StatusConfig> = {
  critical: STATUS_CONFIG.critical,
  high: {
    label: 'High',
    color: 'orange',
    bgColor: 'bg-orange-100',
    darkBgColor: 'dark:bg-orange-500/10',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-600',
    darkTextColor: 'dark:text-orange-400',
  },
  medium: STATUS_CONFIG.warning,
  low: {
    label: 'Low',
    color: 'blue',
    bgColor: 'bg-blue-100',
    darkBgColor: 'dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-600',
    darkTextColor: 'dark:text-blue-400',
  },
  info: STATUS_CONFIG.info,
};

/**
 * Get severity configuration
 */
export function getSeverityConfig(severity: string): StatusConfig {
  const normalizedSeverity = severity.toLowerCase() as SeverityType;
  return SEVERITY_CONFIG[normalizedSeverity] || STATUS_CONFIG.default;
}

// =============================================================================
// COLOR PALETTE (KPI Cards, Stat Cards, etc.)
// =============================================================================

export type ColorVariant = 'green' | 'blue' | 'purple' | 'amber' | 'red' | 'cyan' | 'gray';

export interface ColorConfig {
  bg: string;
  icon: string;
  glow: string;
  gradient: string;
}

export const COLOR_PALETTE: Record<ColorVariant, ColorConfig> = {
  green: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    glow: 'shadow-emerald-500/20',
    gradient: 'from-emerald-500 to-emerald-600',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-500/10',
    icon: 'text-blue-600 dark:text-blue-400',
    glow: 'shadow-blue-500/20',
    gradient: 'from-blue-500 to-blue-600',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-500/10',
    icon: 'text-purple-600 dark:text-purple-400',
    glow: 'shadow-purple-500/20',
    gradient: 'from-purple-500 to-purple-600',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
    glow: 'shadow-amber-500/20',
    gradient: 'from-amber-500 to-amber-600',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-500/10',
    icon: 'text-red-600 dark:text-red-400',
    glow: 'shadow-red-500/20',
    gradient: 'from-red-500 to-red-600',
  },
  cyan: {
    bg: 'bg-cyan-100 dark:bg-cyan-500/10',
    icon: 'text-cyan-600 dark:text-cyan-400',
    glow: 'shadow-cyan-500/20',
    gradient: 'from-cyan-500 to-cyan-600',
  },
  gray: {
    bg: 'bg-gray-100 dark:bg-gray-500/10',
    icon: 'text-gray-600 dark:text-gray-400',
    glow: 'shadow-gray-500/20',
    gradient: 'from-gray-500 to-gray-600',
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format relative time (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatAge(dateString?: string | null): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMins > 0) return `${diffMins}m`;
  return 'now';
}

/**
 * Format bytes to human readable (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format number with commas (e.g., 1000 -> "1,000")
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format currency (e.g., 1234.56 -> "$1,234.56")
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage (e.g., 0.856 -> "85.6%")
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
