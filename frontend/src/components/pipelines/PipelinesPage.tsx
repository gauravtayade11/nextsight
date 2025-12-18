import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { pipelineLogger as logger } from '../../utils/logger';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  EllipsisVerticalIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  PencilSquareIcon,
  TrashIcon,
  RocketLaunchIcon,
  CommandLineIcon,
  EyeIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import usePipelineStore from '../../stores/pipelineStore';
import { useToast } from '../../contexts/ToastContext';
import { TableSkeleton, EmptyState } from '../common/LoadingStates';
import { getPendingApprovals, PendingApproval } from '../../services/pipelineAPI';

// Import shared utilities
import { containerVariants, itemVariants, formatAge } from '../../utils/constants';
import { StatusBadge } from '../common/StatusBadge';

type StatusFilter = 'all' | 'success' | 'failed' | 'running' | 'pending';

export default function PipelinesPage() {
  const navigate = useNavigate();
  const { pipelines, isLoading, error, fetchPipelines, deletePipeline, triggerPipeline, clearError } = usePipelineStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    fetchPipelines();
    loadPendingApprovals();
    
    // Refresh pending approvals every 10 seconds
    const interval = setInterval(loadPendingApprovals, 10000);
    return () => clearInterval(interval);
  }, [fetchPipelines]);

  const loadPendingApprovals = async () => {
    setIsLoadingApprovals(true);
    try {
      const approvals = await getPendingApprovals();
      setPendingApprovals(approvals);
    } catch (err) {
      logger.error('Failed to load pending approvals', err);
    } finally {
      setIsLoadingApprovals(false);
    }
  };

  // Auto-dismiss action error after 5 seconds
  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isOutsideMenu = menuRef.current && !menuRef.current.contains(target);
      const isOutsideButtons = !Object.values(buttonRefs.current).some(
        btn => btn && btn.contains(target)
      );
      if (isOutsideMenu && isOutsideButtons) {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuToggle = useCallback((pipelineId: string) => {
    if (openMenuId === pipelineId) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const button = buttonRefs.current[pipelineId];
      if (button) {
        const rect = button.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 8,
          left: rect.right - 192,
        });
      }
      setOpenMenuId(pipelineId);
    }
  }, [openMenuId]);

  const uniqueBranches = [...new Set(pipelines.map(p => p.branch || 'main'))];

  const filteredPipelines = pipelines.filter(pipeline => {
    const matchesSearch = pipeline.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pipeline.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || (pipeline.branch || 'main') === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  // Calculate stats
  const totalPipelines = pipelines.length;
  const successfulPipelines = pipelines.filter(p => p.status === 'success').length;
  const failedPipelines = pipelines.filter(p => p.status === 'failed').length;
  const runningPipelines = pipelines.filter(p => p.status === 'running').length;
  const successRate = totalPipelines > 0 ? Math.round((successfulPipelines / totalPipelines) * 100) : 0;

  const getStatusBadge = (status?: string) => {
    const config: Record<string, { bg: string; text: string; dot: string }> = {
      success: {
        bg: 'bg-emerald-100 dark:bg-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500',
      },
      failed: {
        bg: 'bg-red-100 dark:bg-red-500/20',
        text: 'text-red-700 dark:text-red-400',
        dot: 'bg-red-500',
      },
      running: {
        bg: 'bg-blue-100 dark:bg-blue-500/20',
        text: 'text-blue-700 dark:text-blue-400',
        dot: 'bg-blue-500 animate-pulse',
      },
      pending: {
        bg: 'bg-amber-100 dark:bg-amber-500/20',
        text: 'text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
      },
    };

    const { bg, text, dot } = config[status || 'pending'] || config.pending;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {status === 'success' ? 'Success' : status === 'failed' ? 'Failed' : status === 'running' ? 'Running' : 'Pending'}
      </span>
    );
  };

  const formatLastRun = (lastRun?: string) => {
    if (!lastRun || lastRun === 'Never') return 'Never';
    try {
      const date = new Date(lastRun);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return lastRun;
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete pipeline "${name}"?`)) {
      try {
        await deletePipeline(id);
        fetchPipelines();
      } catch (err: any) {
        setActionError(err.message || 'Failed to delete pipeline');
      }
    }
    setOpenMenuId(null);
  };

  const handleQuickRun = async (id: string) => {
    try {
      setActionError(null);
      const run = await triggerPipeline(id);
      navigate(`/pipelines/${id}/runs/${run.id}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to run pipeline');
      logger.error('Failed to run pipeline', err);
    }
  };

  const handleDuplicate = (pipeline: typeof pipelines[0]) => {
    navigate('/pipelines/new', { state: { duplicate: pipeline } });
    setOpenMenuId(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Error Banner */}
      <AnimatePresence>
        {(error || actionError) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-shrink-0 px-6 py-3 bg-red-50 dark:bg-red-500/10 border-b border-red-200/50 dark:border-red-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span className="text-sm font-medium">{error || actionError}</span>
              </div>
              <button
                onClick={() => {
                  clearError();
                  setActionError(null);
                }}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Approvals Banner */}
      {pendingApprovals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 px-6 py-3 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200/50 dark:border-amber-500/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/20">
                <ShieldCheckIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {pendingApprovals.length} Pending Approval{pendingApprovals.length > 1 ? 's' : ''}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {pendingApprovals.filter(a => a.environment?.toLowerCase() === 'production').length > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {pendingApprovals.filter(a => a.environment?.toLowerCase() === 'production').length} production deployment{pendingApprovals.filter(a => a.environment?.toLowerCase() === 'production').length > 1 ? 's' : ''} waiting
                    </span>
                  )}
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (pendingApprovals[0]) {
                  navigate(`/pipelines/${pendingApprovals[0].pipelineId}/runs/${pendingApprovals[0].runId}`);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-all shadow-md shadow-amber-500/25"
            >
              Review Approvals
              <ArrowRightIcon className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Fixed Header Section */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100/50 dark:border-slate-700/50 backdrop-blur-xl bg-white/60 dark:bg-slate-800/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Title & New Button */}
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Pipelines
            </h1>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/pipelines/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-medium rounded-lg hover:from-primary-600 hover:to-primary-700 shadow-md shadow-primary-500/25 transition-all"
            >
              <PlusIcon className="h-4 w-4" />
              New
            </motion.button>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-slate-600/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-2.5 py-1.5 bg-white/50 dark:bg-slate-700/50 border border-gray-200/50 dark:border-slate-600/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
            </select>

            {/* Inline Stats */}
            <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-gray-200/50 dark:border-slate-600/50">
              <span className="flex items-center gap-1 text-xs">
                <span className="font-semibold text-gray-900 dark:text-white">{totalPipelines}</span>
                <span className="text-gray-500">total</span>
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{successRate}%</span>
              </span>
              {failedPipelines > 0 && (
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{failedPipelines}</span>
                  <span className="text-gray-500">failed</span>
                </span>
              )}
              {runningPipelines > 0 && (
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{runningPipelines}</span>
                  <span className="text-gray-500">running</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Pipeline List */}
      <div className="flex-1 min-h-0 overflow-hidden p-6 pt-4 pb-6">
        <div className="h-full backdrop-blur-xl bg-white/60 dark:bg-slate-800/60 rounded-xl border border-white/20 dark:border-slate-700/50 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="p-6 overflow-auto flex-1">
              <TableSkeleton rows={8} columns={5} />
            </div>
          ) : filteredPipelines.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                title={searchQuery || statusFilter !== 'all' || branchFilter !== 'all'
                  ? "No matching pipelines"
                  : "Welcome to Pipelines"}
                message={searchQuery || statusFilter !== 'all' || branchFilter !== 'all'
                  ? 'No pipelines match your current filters. Try adjusting your search or filter criteria.'
                  : "You haven't created any pipelines yet. Create your first CI/CD pipeline to automate your build, test, and deployment workflows."}
                icon={<RocketLaunchIcon className="h-8 w-8" />}
                action={!searchQuery && statusFilter === 'all' && branchFilter === 'all' ? {
                  label: 'Create Your First Pipeline',
                  onClick: () => navigate('/pipelines/new'),
                } : {
                  label: 'Clear Filters',
                  onClick: () => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setBranchFilter('all');
                  },
                }}
              />
            </div>
          ) : (
            <>
              {/* Table Header - Fixed */}
              <div className="flex-shrink-0 border-b border-gray-100/50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30">
                <div className="grid grid-cols-12 gap-4 px-4 py-3">
                  <div className="col-span-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pipeline
                  </div>
                  <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Branch
                  </div>
                  <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Run
                  </div>
                  <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </div>
                  <div className="col-span-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                    Actions
                  </div>
                </div>
              </div>

              {/* Scrollable Table Body */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <AnimatePresence>
                  {filteredPipelines.map((pipeline, index) => (
                    <motion.div
                      key={pipeline.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.03 }}
                      className="grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-gray-50/50 dark:border-slate-700/30 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/pipelines/${pipeline.id}`)}
                    >
                      {/* Pipeline Name */}
                      <div className="col-span-4 flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500/20 to-primary-600/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <RocketLaunchIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {pipeline.name}
                          </p>
                          {pipeline.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {pipeline.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Branch */}
                      <div className="col-span-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100/80 dark:bg-slate-700/80 text-gray-700 dark:text-gray-300 font-mono">
                          {pipeline.branch || 'main'}
                        </span>
                      </div>

                      {/* Last Run */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1.5">
                          <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatLastRun(pipeline.lastRun)}
                          </span>
                        </div>
                        {pipeline.duration && pipeline.duration !== '-' && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {pipeline.duration}
                          </p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        {getStatusBadge(pipeline.status)}
                        {pipeline.successRate !== undefined && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {pipeline.successRate.toFixed(1)}% success
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {pipeline.status === 'running' ? (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/pipelines/${pipeline.id}`)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="View"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </motion.button>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleQuickRun(pipeline.id)}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title="Run Pipeline"
                          >
                            <PlayIcon className="h-4 w-4" />
                          </motion.button>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => navigate(`/pipelines/${pipeline.id}`)}
                          className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                          title="View Logs"
                        >
                          <CommandLineIcon className="h-4 w-4" />
                        </motion.button>

                        <button
                          ref={(el) => { buttonRefs.current[pipeline.id] = el; }}
                          onClick={() => handleMenuToggle(pipeline.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <EllipsisVerticalIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dropdown Menu Portal */}
      {openMenuId && menuPosition && createPortal(
        <AnimatePresence>
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
              zIndex: 9999,
            }}
            className="w-48 backdrop-blur-xl bg-white/95 dark:bg-slate-800/95 rounded-xl shadow-2xl border border-gray-200/50 dark:border-slate-700/50 py-1.5"
          >
            <button
              onClick={() => {
                navigate(`/pipelines/${openMenuId}/edit`);
                setOpenMenuId(null);
                setMenuPosition(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
            >
              <PencilSquareIcon className="h-4 w-4 text-gray-400" />
              Edit Pipeline
            </button>
            <button
              onClick={() => {
                const pipeline = pipelines.find(p => p.id === openMenuId);
                if (pipeline) handleDuplicate(pipeline);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
            >
              <DocumentDuplicateIcon className="h-4 w-4 text-gray-400" />
              Duplicate
            </button>
            <button
              onClick={() => {
                handleQuickRun(openMenuId);
                setOpenMenuId(null);
                setMenuPosition(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
            >
              <PlayIcon className="h-4 w-4 text-emerald-500" />
              Run Pipeline
            </button>
            <hr className="my-1.5 border-gray-100 dark:border-slate-700" />
            <button
              onClick={() => {
                const pipeline = pipelines.find(p => p.id === openMenuId);
                if (pipeline) handleDelete(openMenuId, pipeline.name);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
