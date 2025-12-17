import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import GlassCard from '../common/GlassCard';
import api from '../../services/api';
import { pipelineLogger as logger } from '../../utils/logger';

interface Approval {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  approverUsername?: string;
  approverEmail?: string;
  approverRole?: string;
  comment?: string;
  createdAt: string;
}

interface PipelineApprovalGateProps {
  pipelineId: string;
  runId: string;
  stageId: string;
  stageName: string;
  requiresApproval: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  requiredApprovers: number;
  currentApprovals: number;
  approverRoles?: string[];
  environment?: string;
  onApprovalChange?: () => void;
}

export default function PipelineApprovalGate({
  pipelineId,
  runId,
  stageId,
  stageName,
  requiresApproval,
  approvalStatus = 'pending',
  requiredApprovers,
  currentApprovals,
  approverRoles = [],
  environment,
  onApprovalChange,
}: PipelineApprovalGateProps) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentApprovalsCount, setCurrentApprovalsCount] = useState(currentApprovals);

  useEffect(() => {
    setCurrentApprovalsCount(currentApprovals);
  }, [currentApprovals]);

  useEffect(() => {
    if (requiresApproval && stageId) {
      fetchApprovals();
      // Poll for approval updates every 5 seconds if pending
      if (approvalStatus === 'pending') {
        const interval = setInterval(() => {
          fetchApprovals();
        }, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [pipelineId, runId, stageId, requiresApproval, approvalStatus]);

  const fetchApprovals = async () => {
    try {
      const response = await api.get(
        `/pipelines/${pipelineId}/runs/${runId}/stages/${stageId}/approvals`
      );
      const fetchedApprovals = response.data || [];
      setApprovals(fetchedApprovals);
      
      // Update current approvals count
      const approvedCount = fetchedApprovals.filter((a: Approval) => a.status === 'approved').length;
      setCurrentApprovalsCount(approvedCount);
      
      // Trigger refresh if count changed
      if (approvedCount !== currentApprovalsCount && onApprovalChange) {
        onApprovalChange();
      }
    } catch (err: any) {
      logger.error('Failed to fetch approvals', err);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);
    try {
      await api.post(
        `/pipelines/${pipelineId}/runs/${runId}/stages/${stageId}/approve`,
        { comment: comment.trim() || undefined }
      );
      await fetchApprovals();
      setComment('');
      if (onApprovalChange) onApprovalChange();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to approve stage');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Are you sure you want to reject this deployment? This will stop the pipeline.')) {
      return;
    }

    setIsRejecting(true);
    setError(null);
    try {
      await api.post(
        `/pipelines/${pipelineId}/runs/${runId}/stages/${stageId}/reject`,
        { comment: comment.trim() || 'Deployment rejected' }
      );
      await fetchApprovals();
      setComment('');
      if (onApprovalChange) onApprovalChange();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reject stage');
    } finally {
      setIsRejecting(false);
    }
  };

  if (!requiresApproval) {
    return null;
  }

  const isProduction = environment?.toLowerCase() === 'production' || environment?.toLowerCase() === 'prod';
  const canApprove = approvalStatus === 'pending' && currentApprovalsCount < requiredApprovers;
  const isApproved = approvalStatus === 'approved';
  const isRejected = approvalStatus === 'rejected';

  const getStatusConfig = () => {
    if (isRejected) {
      return {
        bg: 'bg-red-50 dark:bg-red-500/10',
        border: 'border-red-200 dark:border-red-500/30',
        text: 'text-red-700 dark:text-red-400',
        icon: <XCircleIcon className="h-5 w-5" />,
      };
    }
    if (isApproved) {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        border: 'border-emerald-200 dark:border-emerald-500/30',
        text: 'text-emerald-700 dark:text-emerald-400',
        icon: <CheckCircleIcon className="h-5 w-5" />,
      };
    }
    return {
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/30',
      text: 'text-amber-700 dark:text-amber-400',
      icon: <ClockIcon className="h-5 w-5" />,
    };
  };

  const statusConfig = getStatusConfig();

  return (
    <GlassCard className="p-5">
      <div className={`${statusConfig.bg} ${statusConfig.border} border-2 rounded-xl p-4`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
              {statusConfig.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-amber-500" />
                Approval Gate
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stageName} {isProduction && '(Production Deployment)'}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.text} ${statusConfig.bg}`}>
            {approvalStatus === 'approved' ? 'Approved' : 
             approvalStatus === 'rejected' ? 'Rejected' : 
             'Pending Approval'}
          </span>
        </div>

        {/* Approval Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Approvals: {currentApprovalsCount} / {requiredApprovers}
            </span>
            {approverRoles.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Required roles: {approverRoles.join(', ')}
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((currentApprovalsCount / requiredApprovers) * 100, 100)}%` }}
              className={`h-2 rounded-full ${
                isRejected ? 'bg-red-500' :
                isApproved ? 'bg-emerald-500' :
                'bg-amber-500'
              }`}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-700 dark:text-red-400"
          >
            {error}
          </motion.div>
        )}

        {/* Approval Actions */}
        {canApprove && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment about your approval..."
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApprove}
                disabled={isApproving || isRejecting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4" />
                    Approve Deployment
                  </>
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReject}
                disabled={isApproving || isRejecting}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-all shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRejecting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircleIcon className="h-4 w-4" />
                    Reject
                  </>
                )}
              </motion.button>
            </div>
          </div>
        )}

        {/* Approval History */}
        {approvals.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Approval History
            </h4>
            <div className="space-y-2">
              <AnimatePresence>
                {approvals.map((approval) => (
                  <motion.div
                    key={approval.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg"
                  >
                    <div className={`p-1.5 rounded-lg ${
                      approval.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-500/20' :
                      approval.status === 'rejected' ? 'bg-red-100 dark:bg-red-500/20' :
                      'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {approval.status === 'approved' ? (
                        <CheckCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : approval.status === 'rejected' ? (
                        <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                      ) : (
                        <ClockIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <UserCircleIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {approval.approverUsername || 'Unknown'}
                        </span>
                        {approval.approverRole && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({approval.approverRole})
                          </span>
                        )}
                        <span className={`ml-auto text-xs font-medium ${
                          approval.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' :
                          approval.status === 'rejected' ? 'text-red-600 dark:text-red-400' :
                          'text-gray-500'
                        }`}>
                          {approval.status === 'approved' ? 'Approved' :
                           approval.status === 'rejected' ? 'Rejected' :
                           'Pending'}
                        </span>
                      </div>
                      {approval.comment && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {approval.comment}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(approval.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Warning for Production */}
        {isProduction && canApprove && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">Production Deployment</p>
              <p>This will deploy to production. Please review all changes carefully before approving.</p>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
