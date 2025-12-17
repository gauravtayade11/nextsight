import { motion } from 'framer-motion';

// Spinner variants
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
}

const spinnerSizes = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const spinnerColors = {
  primary: 'border-primary-500',
  white: 'border-white',
  gray: 'border-gray-400',
};

export function Spinner({ size = 'md', color = 'primary' }: SpinnerProps) {
  return (
    <div
      className={`${spinnerSizes[size]} border-2 border-t-transparent rounded-full animate-spin ${spinnerColors[color]}`}
    />
  );
}

// Pulse dot loading
export function PulseDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-primary-500 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// Shimmer effect loading bar
export function ShimmerBar({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-gray-200 dark:bg-slate-700 rounded-lg ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// Full page loading screen
export function PageLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800"
    >
      <div className="text-center">
        <motion.div
          className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-500/30"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <span className="text-white font-bold text-2xl">N</span>
        </motion.div>
        <motion.h2
          className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Loading NextSight AI...
        </motion.h2>
        <div className="mt-4 flex justify-center">
          <PulseDots />
        </div>
      </div>
    </motion.div>
  );
}

// Card skeleton with animation
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="backdrop-blur-xl rounded-2xl border shadow-glass dark:shadow-glass-dark bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-slate-700/50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <ShimmerBar className="h-6 w-32" />
        <ShimmerBar className="h-8 w-8 rounded-lg" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <ShimmerBar className="h-4 w-full" />
          <ShimmerBar className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="backdrop-blur-xl rounded-2xl border shadow-glass dark:shadow-glass-dark bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100/50 dark:border-slate-700/50 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <ShimmerBar key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="px-6 py-4 border-b border-gray-50/50 dark:border-slate-700/30 flex gap-4 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <ShimmerBar key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Dashboard skeleton for full page loading
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <ShimmerBar className="h-8 w-64" />
          <ShimmerBar className="h-4 w-48" />
        </div>
        <ShimmerBar className="h-10 w-40 rounded-xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="backdrop-blur-xl rounded-2xl border shadow-glass dark:shadow-glass-dark bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-slate-700/50 p-6"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-3 flex-1">
                <ShimmerBar className="h-4 w-24" />
                <ShimmerBar className="h-8 w-16" />
                <ShimmerBar className="h-3 w-32" />
              </div>
              <ShimmerBar className="h-12 w-12 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
      </div>
    </div>
  );
}

// Inline loading for buttons
interface ButtonLoaderProps {
  loading?: boolean;
  children: React.ReactNode;
}

export function ButtonLoader({ loading, children }: ButtonLoaderProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner size="sm" color="white" />
        <span>Loading...</span>
      </div>
    );
  }
  return <>{children}</>;
}

// Progress bar
interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const progressColors = {
  primary: 'from-primary-500 to-primary-600',
  success: 'from-success-500 to-success-600',
  warning: 'from-warning-500 to-warning-600',
  danger: 'from-danger-500 to-danger-600',
};

const progressSizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({ progress, showLabel = false, color = 'primary', size = 'md' }: ProgressBarProps) {
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-sm text-gray-600 dark:text-gray-400">Progress</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{Math.round(progress)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden ${progressSizes[size]}`}>
        <motion.div
          className={`h-full bg-gradient-to-r ${progressColors[color]} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// Circular progress
interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

export function CircularProgress({ progress, size = 60, strokeWidth = 6, color = 'primary' }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const colorClasses = {
    primary: 'text-primary-500',
    success: 'text-success-500',
    warning: 'text-warning-500',
    danger: 'text-danger-500',
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200 dark:text-slate-700"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={colorClasses[color]}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5 }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <span className="absolute text-sm font-semibold text-gray-900 dark:text-white">
        {Math.round(progress)}%
      </span>
    </div>
  );
}

// ============================================
// SPECIFIC SKELETONS
// ============================================

// User table skeleton
export function UserTableSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-slate-700 flex gap-6">
        <ShimmerBar className="h-4 w-24" />
        <ShimmerBar className="h-4 w-16" />
        <ShimmerBar className="h-4 w-16" />
        <ShimmerBar className="h-4 w-20" />
        <ShimmerBar className="h-4 w-20 ml-auto" />
      </div>
      {/* Rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-6 py-4 border-b border-gray-100 dark:border-slate-700/50 flex items-center gap-6">
          <div className="flex items-center gap-3 flex-1">
            <ShimmerBar className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <ShimmerBar className="h-4 w-32" />
              <ShimmerBar className="h-3 w-40" />
            </div>
          </div>
          <ShimmerBar className="h-6 w-20 rounded-full" />
          <ShimmerBar className="h-6 w-16" />
          <ShimmerBar className="h-4 w-28" />
          <div className="flex gap-1">
            <ShimmerBar className="h-8 w-8 rounded-lg" />
            <ShimmerBar className="h-8 w-8 rounded-lg" />
            <ShimmerBar className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Kubernetes resources skeleton
export function ResourceTableSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-4">
        <ShimmerBar className="h-9 w-64 rounded-lg" />
        <ShimmerBar className="h-9 w-40 rounded-lg" />
        <ShimmerBar className="h-9 w-32 rounded-lg ml-auto" />
      </div>
      {/* Table */}
      <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <ShimmerBar className="h-4 w-4 rounded" />
            <div className="flex-1 grid grid-cols-5 gap-4">
              <ShimmerBar className="h-4" />
              <ShimmerBar className="h-4" />
              <ShimmerBar className="h-6 w-20 rounded-full" />
              <ShimmerBar className="h-4" />
              <ShimmerBar className="h-4 w-24" />
            </div>
            <ShimmerBar className="h-8 w-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Security dashboard skeleton
export function SecuritySkeleton() {
  return (
    <div className="space-y-6">
      {/* Score card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-8">
          <ShimmerBar className="h-32 w-32 rounded-full" />
          <div className="flex-1 space-y-4">
            <ShimmerBar className="h-6 w-48" />
            <ShimmerBar className="h-4 w-full max-w-md" />
            <div className="flex gap-3">
              <ShimmerBar className="h-8 w-24 rounded-lg" />
              <ShimmerBar className="h-8 w-24 rounded-lg" />
              <ShimmerBar className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
      {/* Findings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
            <ShimmerBar className="h-4 w-20 mb-3" />
            <ShimmerBar className="h-8 w-12 mb-2" />
            <ShimmerBar className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Cluster card skeleton
export function ClusterCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <ShimmerBar className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <ShimmerBar className="h-5 w-32" />
            <ShimmerBar className="h-3 w-48" />
          </div>
        </div>
        <ShimmerBar className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center">
            <ShimmerBar className="h-6 w-10 mx-auto mb-1" />
            <ShimmerBar className="h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <ShimmerBar className="h-9 flex-1 rounded-lg" />
        <ShimmerBar className="h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================
// ACTIONABLE ERROR STATES
// ============================================

interface ErrorStateProps {
  title?: string;
  message: string;
  details?: string;
  type?: 'error' | 'warning' | 'info';
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  icon?: React.ReactNode;
}

export function ErrorState({
  title,
  message,
  details,
  type = 'error',
  actions = [],
  icon,
}: ErrorStateProps) {
  const styles = {
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      iconBg: 'bg-red-100 dark:bg-red-900/40',
      iconColor: 'text-red-600 dark:text-red-400',
      title: 'text-red-800 dark:text-red-200',
      message: 'text-red-700 dark:text-red-300',
      details: 'text-red-600/80 dark:text-red-400/80',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/40',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      title: 'text-yellow-800 dark:text-yellow-200',
      message: 'text-yellow-700 dark:text-yellow-300',
      details: 'text-yellow-600/80 dark:text-yellow-400/80',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-800 dark:text-blue-200',
      message: 'text-blue-700 dark:text-blue-300',
      details: 'text-blue-600/80 dark:text-blue-400/80',
    },
  };

  const s = styles[type];

  const defaultIcons = {
    error: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    warning: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    info: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${s.bg} ${s.border}`}
    >
      <div className="flex gap-4">
        <div className={`flex-shrink-0 p-2 rounded-lg ${s.iconBg} ${s.iconColor}`}>
          {icon || defaultIcons[type]}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`font-semibold mb-1 ${s.title}`}>{title}</h4>
          )}
          <p className={`text-sm ${s.message}`}>{message}</p>
          {details && (
            <p className={`text-xs mt-2 font-mono ${s.details}`}>{details}</p>
          )}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : 'bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-600'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Connection error with retry
interface ConnectionErrorProps {
  service: string;
  onRetry: () => void;
  retrying?: boolean;
}

export function ConnectionError({ service, onRetry, retrying = false }: ConnectionErrorProps) {
  return (
    <ErrorState
      title={`Unable to connect to ${service}`}
      message="The service is not responding. This could be due to network issues or the service being down."
      type="error"
      actions={[
        {
          label: retrying ? 'Retrying...' : 'Retry Connection',
          onClick: onRetry,
          variant: 'primary',
        },
        {
          label: 'View Status',
          onClick: () => window.open('/health', '_blank'),
        },
      ]}
      icon={
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
        </svg>
      }
    />
  );
}

// Permission denied
interface PermissionDeniedProps {
  resource: string;
  requiredRole?: string;
}

export function PermissionDenied({ resource, requiredRole }: PermissionDeniedProps) {
  return (
    <ErrorState
      title="Access Denied"
      message={`You don't have permission to access ${resource}.${requiredRole ? ` Required role: ${requiredRole}` : ''}`}
      type="warning"
      icon={
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      }
    />
  );
}

// Empty state with action
interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

// Inline error for forms
interface InlineErrorProps {
  message: string;
}

export function InlineError({ message }: InlineErrorProps) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1"
    >
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </motion.p>
  );
}
