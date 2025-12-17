import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

interface ResourceYAMLEditorProps {
  isOpen: boolean;
  onClose: () => void;
  resourceKind: string;
  resourceName: string;
  namespace?: string;
  onSaved?: () => void;
}

export default function ResourceYAMLEditor({
  isOpen,
  onClose,
  resourceKind,
  resourceName,
  namespace,
  onSaved,
}: ResourceYAMLEditorProps) {
  const [yamlContent, setYamlContent] = useState('');
  const [originalYaml, setOriginalYaml] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [dryRunMode, setDryRunMode] = useState(false);
  const toast = useToast();

  // Load YAML when modal opens
  const loadYaml = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveResult(null);

    try {
      const response = await kubernetesApi.getResourceYAML({
        kind: resourceKind,
        name: resourceName,
        namespace,
      });

      if (response.data.success) {
        setYamlContent(response.data.yaml_content);
        setOriginalYaml(response.data.yaml_content);
        setHasChanges(false);
      } else {
        setError(response.data.error || 'Failed to load resource YAML');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resource YAML');
    } finally {
      setLoading(false);
    }
  }, [resourceKind, resourceName, namespace]);

  useEffect(() => {
    if (isOpen) {
      loadYaml();
    }
  }, [isOpen, loadYaml]);

  // Track changes
  useEffect(() => {
    setHasChanges(yamlContent !== originalYaml);
  }, [yamlContent, originalYaml]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveResult(null);

    try {
      const response = await kubernetesApi.updateResourceYAML(yamlContent, namespace, dryRunMode);

      if (response.data.success) {
        setSaveResult({
          success: true,
          message: dryRunMode
            ? 'Dry run successful - no changes applied'
            : response.data.message || 'Resource updated successfully'
        });

        if (!dryRunMode) {
          setOriginalYaml(yamlContent);
          setHasChanges(false);
          toast.success(`${resourceKind} ${resourceName} updated successfully`);
          onSaved?.();
        } else {
          toast.success('Dry run validation passed');
        }
      } else {
        const errorMsg = response.data.errors?.join('\n') || 'Failed to update resource';
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
  };

  const handleReset = () => {
    setYamlContent(originalYaml);
    setError(null);
    setSaveResult(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlContent);
      toast.success('YAML copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <DocumentTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit {resourceKind}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {namespace ? `${namespace}/` : ''}{resourceName}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              <button
                onClick={loadYaml}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
                Copy
              </button>
              <button
                onClick={handleReset}
                disabled={!hasChanges}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
                Reset
              </button>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  Unsaved changes
                </span>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={dryRunMode}
                  onChange={(e) => setDryRunMode(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Dry run
              </label>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Loading YAML...
                </div>
              </div>
            ) : error && !yamlContent ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                  <button
                    onClick={loadYaml}
                    className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <textarea
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                className="w-full h-full min-h-[400px] p-4 font-mono text-sm bg-gray-900 text-gray-100 rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                spellCheck={false}
                placeholder="YAML content will appear here..."
              />
            )}
          </div>

          {/* Result Message */}
          {saveResult && (
            <div className={`mx-6 mb-4 p-3 rounded-lg ${
              saveResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <div className={`flex items-center gap-2 text-sm ${
                saveResult.success
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-red-700 dark:text-red-400'
              }`}>
                {saveResult.success ? (
                  <CheckIcon className="w-4 h-4" />
                ) : (
                  <ExclamationTriangleIcon className="w-4 h-4" />
                )}
                <span className="font-medium">{saveResult.success ? 'Success' : 'Error'}</span>
              </div>
              <p className={`mt-1 text-sm whitespace-pre-wrap ${
                saveResult.success
                  ? 'text-green-600 dark:text-green-300'
                  : 'text-red-600 dark:text-red-300'
              }`}>
                {saveResult.message}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || (!hasChanges && !dryRunMode)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  {dryRunMode ? 'Validating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  {dryRunMode ? 'Validate' : 'Apply Changes'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
