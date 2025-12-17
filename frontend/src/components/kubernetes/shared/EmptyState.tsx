import { motion } from 'framer-motion';
import { CubeIcon } from '@heroicons/react/24/outline';

interface EmptyStateProps {
  icon: typeof CubeIcon;
  title: string;
}

export function EmptyState({ icon: Icon, title }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-16"
    >
      <motion.div
        className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center shadow-lg shadow-gray-200/50 dark:shadow-slate-900/50"
        animate={{
          y: [0, -5, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Icon className="h-10 w-10 text-gray-400 dark:text-gray-500" />
      </motion.div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        No resources match your current filters. Try adjusting your search or namespace selection.
      </p>
    </motion.div>
  );
}
