import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ScaleIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline';

interface ScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceName: string;
  resourceType: string;
  namespace: string;
  currentReplicas: number;
  onScale: (replicas: number) => Promise<void>;
  isLoading: boolean;
}

export function ScaleModal({
  isOpen,
  onClose,
  resourceName,
  resourceType,
  namespace,
  currentReplicas,
  onScale,
  isLoading
}: ScaleModalProps) {
  const [replicas, setReplicas] = useState(currentReplicas);

  useEffect(() => {
    setReplicas(currentReplicas);
  }, [currentReplicas, isOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-slate-700"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30">
            <ScaleIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Scale {resourceType}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {resourceName} in {namespace}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Number of Replicas
          </label>
          <div className="flex items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setReplicas(Math.max(0, replicas - 1))}
              className="p-3 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              <StopIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </motion.button>
            <input
              type="number"
              min="0"
              value={replicas}
              onChange={(e) => setReplicas(parseInt(e.target.value) || 0)}
              className="w-24 text-center text-2xl font-bold px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-0 transition-colors"
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setReplicas(replicas + 1)}
              className="p-3 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              <PlayIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </motion.button>
          </div>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
            Current: {currentReplicas} → New: {replicas}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onScale(replicas)}
            disabled={isLoading || replicas === currentReplicas}
            className="px-5 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Scaling...
              </span>
            ) : (
              'Scale'
            )}
          </motion.button>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          Press Esc to cancel
        </p>
      </motion.div>
    </motion.div>,
    document.body
  );
}
