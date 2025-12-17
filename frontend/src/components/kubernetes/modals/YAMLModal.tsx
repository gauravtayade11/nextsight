import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ArrowPathIcon,
  XMarkIcon,
  CodeBracketIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowUturnLeftIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { logger } from '../../../utils/logger';

interface YAMLModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceType: string;
  namespace: string;
  name: string;
  onRefresh?: () => void;
}

export function YAMLModal({
  isOpen,
  onClose,
  resourceType,
  namespace,
  name,
  onRefresh
}: YAMLModalProps) {
  const toast = useToast();
  const [yaml, setYaml] = useState<string>('');
  const [originalYaml, setOriginalYaml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [dryRunMode, setDryRunMode] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  const hasChanges = yaml !== originalYaml;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        if (hasChanges && editMode) {
          if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, hasChanges, editMode]);

  useEffect(() => {
    if (isOpen) {
      fetchYAML();
      setEditMode(false);
      setSaveResult(null);
    }
  }, [isOpen, resourceType, namespace, name]);

  async function fetchYAML() {
    setLoading(true);
    setError(null);
    setSaveResult(null);
    try {
      const result = await kubernetesApi.getResourceYAML({
        kind: resourceType,
        name: name,
        namespace: namespace,
      });
      if (result.data.success) {
        setYaml(result.data.yaml_content);
        setOriginalYaml(result.data.yaml_content);
      } else {
        setError(result.data.error || 'Failed to fetch YAML');
      }
    } catch (err) {
      setError('Failed to fetch resource YAML');
      logger.error('Failed to fetch resource YAML', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveResult(null);
    try {
      const result = await kubernetesApi.updateResourceYAML(yaml, namespace, dryRunMode);
      if (result.data.success) {
        setSaveResult({
          success: true,
          message: dryRunMode
            ? 'Dry run successful - no changes applied'
            : result.data.message || 'Resource updated successfully'
        });
        if (!dryRunMode) {
          setOriginalYaml(yaml);
          toast.success(`${resourceType} ${name} updated successfully`);
          onRefresh?.();
        } else {
          toast.success('Dry run validation passed');
        }
      } else {
        const errorMsg = result.data.errors?.join('\n') || 'Failed to update resource';
        setSaveResult({ success: false, message: errorMsg });
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update resource';
      setSaveResult({ success: false, message: errorMsg });
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy to clipboard', err);
    }
  }

  function handleReset() {
    setYaml(originalYaml);
    setSaveResult(null);
    setError(null);
  }

  if (!isOpen) return null;

  const lines = yaml.split('\n');

  return createPortal(
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`fixed top-16 right-0 bottom-0 z-[9999] flex flex-col bg-white dark:bg-slate-800 shadow-2xl border-l border-gray-200 dark:border-slate-700 ${
        isExpanded ? 'w-full left-0' : 'w-[55%] min-w-[600px]'
      }`}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30">
            <CodeBracketIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editMode ? 'Edit' : 'View'} Resource YAML
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {resourceType}/{name} in {namespace}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              editMode
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            <PencilSquareIcon className="h-4 w-4" />
            {editMode ? 'Editing' : 'Edit'}
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopy}
            disabled={loading || !!error}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 text-success-500" />
                Copied!
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy
              </>
            )}
          </motion.button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title={isExpanded ? 'Collapse panel' : 'Expand to full screen'}
          >
            {isExpanded ? (
              <ArrowsPointingInIcon className="h-5 w-5" />
            ) : (
              <ArrowsPointingOutIcon className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title="Close (Esc)"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Edit toolbar */}
      {editMode && (
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <button
              onClick={fetchYAML}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleReset}
              disabled={!hasChanges}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
            >
              <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                Unsaved changes
              </span>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={dryRunMode}
                onChange={(e) => setDryRunMode(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
              />
              Dry run
            </label>
            <button
              onClick={handleSave}
              disabled={saving || loading || (!hasChanges && !dryRunMode)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                  {dryRunMode ? 'Validating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <CheckIcon className="h-3.5 w-3.5" />
                  {dryRunMode ? 'Validate' : 'Apply'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Save Result Message */}
      {saveResult && (
        <div className={`mx-4 mt-2 p-2 rounded-xl text-xs ${
          saveResult.success
            ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 text-success-700 dark:text-success-400'
            : 'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-400'
        }`}>
          <div className="flex items-center gap-1.5 font-medium">
            {saveResult.success ? (
              <CheckIcon className="h-3.5 w-3.5" />
            ) : (
              <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            )}
            {saveResult.success ? 'Success' : 'Error'}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap">{saveResult.message}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              <span>Loading YAML...</span>
            </div>
          </div>
        ) : error && !yaml ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-danger-500 dark:text-danger-400 font-medium">{error}</p>
              <button
                onClick={fetchYAML}
                className="mt-3 text-sm text-primary-500 hover:text-primary-600 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        ) : editMode ? (
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            className="w-full h-full p-4 font-mono text-xs bg-gray-900 text-gray-100 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none leading-5"
            spellCheck={false}
            placeholder="YAML content will appear here..."
          />
        ) : (
          <div className="h-full bg-gray-50 dark:bg-slate-900 rounded-xl overflow-auto">
            <pre className="p-4 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre leading-5">
              {yaml}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-2 border-t border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400">
        <span>{lines.length} lines</span>
        <span>Press Esc to close</span>
      </div>
    </motion.div>,
    document.body
  );
}
