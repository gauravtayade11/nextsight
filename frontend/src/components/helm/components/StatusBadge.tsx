import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isHealthy = status === 'deployed';
  const isFailed = status === 'failed';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isHealthy
          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : isFailed
          ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
      }`}
    >
      {isHealthy ? (
        <CheckCircleIcon className="h-3.5 w-3.5" />
      ) : isFailed ? (
        <XCircleIcon className="h-3.5 w-3.5" />
      ) : (
        <ClockIcon className="h-3.5 w-3.5 animate-pulse" />
      )}
      {isHealthy ? 'Healthy' : isFailed ? 'Failed' : 'Pending'}
    </span>
  );
}
