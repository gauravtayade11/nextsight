import { motion } from 'framer-motion';

export function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Table Header Skeleton */}
      <div className="flex items-center gap-4 py-3 px-4 border-b border-gray-100 dark:border-slate-700">
        <div className="w-8 h-4 bg-gray-200 dark:bg-slate-600 rounded" />
        <div className="w-32 h-4 bg-gray-200 dark:bg-slate-600 rounded" />
        <div className="w-24 h-4 bg-gray-200 dark:bg-slate-600 rounded" />
        <div className="w-16 h-4 bg-gray-200 dark:bg-slate-600 rounded" />
        <div className="flex-1" />
        <div className="w-20 h-4 bg-gray-200 dark:bg-slate-600 rounded" />
      </div>
      {/* Table Rows Skeleton */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-4 py-4 px-4 border-b border-gray-50 dark:border-slate-700/50"
        >
          <div className="w-8 h-8 bg-gray-200 dark:bg-slate-600 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-1/3" />
            <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-1/4" />
          </div>
          <div className="w-16 h-6 bg-gray-200 dark:bg-slate-600 rounded-full" />
          <div className="w-24 h-4 bg-gray-100 dark:bg-slate-700 rounded" />
          <div className="flex gap-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-slate-600 rounded-xl" />
            <div className="w-8 h-8 bg-gray-200 dark:bg-slate-600 rounded-xl" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
