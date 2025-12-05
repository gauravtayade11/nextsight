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
