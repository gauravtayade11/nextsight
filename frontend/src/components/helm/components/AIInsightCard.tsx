import {
  ExclamationTriangleIcon,
  LightBulbIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import type { AIInsight } from './types';

interface AIInsightCardProps {
  insight: AIInsight;
  onApplyFix?: () => void;
}

const iconConfig = {
  warning: {
    icon: ExclamationTriangleIcon,
    color: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
  },
  suggestion: {
    icon: LightBulbIcon,
    color: 'text-purple-500 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    border: 'border-purple-200 dark:border-purple-500/20',
  },
  info: {
    icon: SparklesIcon,
    color: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/20',
  },
};

export function AIInsightCard({ insight, onApplyFix }: AIInsightCardProps) {
  const config = iconConfig[insight.type];
  const Icon = config.icon;

  return (
    <div className={`p-2 rounded-lg ${config.bg} border ${config.border}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-3.5 w-3.5 ${config.color} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-700 dark:text-gray-300">{insight.message}</p>
          {insight.fix && onApplyFix && (
            <button
              onClick={onApplyFix}
              className="mt-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
            >
              Apply Fix
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
