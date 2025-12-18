import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowUturnLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../../services/api';
import { logger } from '../../../utils/logger';
import type { Deployment } from '../../../types';

interface RollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  deployment: Deployment;
  onRollback: (revision: number) => Promise<void>;
  isLoading: boolean;
}

interface RevisionInfo {
  revision: number;
  changeReason: string;
  image?: string;
}

export function RollbackModal({ isOpen, onClose, deployment, onRollback, isLoading }: RollbackModalProps) {
  const [revisions, setRevisions] = useState<RevisionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRevisions();
    }
  }, [isOpen, deployment]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchRevisions = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await kubernetesApi.executeKubectl({
        command: `rollout history deployment ${deployment.name} -n ${deployment.namespace}`,
      });

      // Parse the rollout history output
      const lines = result.data.stdout?.split('\n') || [];
      const parsedRevisions: RevisionInfo[] = [];

      for (const line of lines) {
        // Match lines like "1         <none>" or "2         kubectl set image..."
        const match = line.match(/^\s*(\d+)\s+(.*)$/);
        if (match) {
          parsedRevisions.push({
            revision: parseInt(match[1], 10),
            changeReason: match[2].trim() || '<none>',
          });
        }
      }

      setRevisions(parsedRevisions.reverse()); // Show newest first
      if (parsedRevisions.length > 1) {
        setSelectedRevision(parsedRevisions[parsedRevisions.length - 2]?.revision); // Select previous revision by default
      }
    } catch (err) {
      setError('Failed to fetch revision history');
      logger.error('Failed to fetch revisions', err);
    } finally {
      setLoading(false);
    }
  };

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
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 border border-gray-200 dark:border-slate-700"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <ArrowUturnLeftIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Rollback Deployment
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {deployment.name} in {deployment.namespace}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading revision history...</span>
          </div>
        ) : error ? (
          <div className="py-4 text-center text-danger-600 dark:text-danger-400">
            {error}
          </div>
        ) : revisions.length <= 1 ? (
          <div className="py-4 text-center text-gray-500 dark:text-gray-400">
            No previous revisions available for rollback
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Revision to Rollback
              </label>
              <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 dark:border-slate-600 rounded-xl p-2">
                {revisions.map((rev, idx) => (
                  <button
                    key={rev.revision}
                    onClick={() => setSelectedRevision(rev.revision)}
                    disabled={idx === 0} // Can't rollback to current
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      selectedRevision === rev.revision
                        ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500'
                        : idx === 0
                        ? 'bg-gray-50 dark:bg-slate-700/50 opacity-50 cursor-not-allowed'
                        : 'bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Rev {rev.revision}
                        </span>
                        {idx === 0 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate font-mono">
                      {rev.changeReason}
                    </p>
                  </button>
                ))}
              </div>
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
                onClick={() => selectedRevision && onRollback(selectedRevision)}
                disabled={isLoading || !selectedRevision}
                className="px-5 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Rolling back...
                  </span>
                ) : (
                  `Rollback to Rev ${selectedRevision}`
                )}
              </motion.button>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          Press Esc to cancel
        </p>
      </motion.div>
    </motion.div>,
    document.body
  );
}
