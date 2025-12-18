import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';
import {
  GlobeAltIcon,
  CircleStackIcon,
  DocumentDuplicateIcon,
  KeyIcon,
  ServerStackIcon,
  CpuChipIcon,
  ClockIcon,
  CalendarIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ArrowPathIcon,
  CubeIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  StopIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ScaleIcon,
  TrashIcon,
  FunnelIcon,
  ChevronUpDownIcon,
  CodeBracketIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowUturnLeftIcon,
  CommandLineIcon,
  SignalIcon,
  SignalSlashIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { kubernetesApi } from '../../services/api';
import {
  useDeployments,
  usePods,
  useStatefulSets,
  useDaemonSets,
  useJobs,
  useCronJobs,
  useServices,
  useIngresses,
  useConfigMaps,
  useSecrets,
  usePVCs,
  useHPAs,
  useNamespaces,
  useInvalidateWorkloads,
} from '../../hooks/useWorkloadsData';
import { useToast } from '../../contexts/ToastContext';
import { useNamespace } from '../../contexts/NamespaceContext';
import { logger } from '../../utils/logger';
import PageHeader from '../common/PageHeader';
import PodLogsViewer from './PodLogsViewer';
import type {
  Namespace,
  K8sService,
  Ingress,
  ConfigMap,
  Secret,
  SecretDetail,
  PVC,
  StatefulSet,
  DaemonSet,
  Job,
  CronJob,
  HPA,
  Deployment,
  Pod,
} from '../../types';

// Import shared constants
import { containerVariants, itemVariants, scaleVariants, formatAge } from '../../utils/constants';
import { StatusBadge } from '../common/StatusBadge';

// Table row animation variant (extends shared patterns)
const tableRowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03 },
  }),
};

// ==================== REUSABLE MODAL COMPONENTS ====================

// Reusable Scale Modal Component with React Portal
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

function ScaleModal({ isOpen, onClose, resourceName, resourceType, namespace, currentReplicas, onScale, isLoading }: ScaleModalProps) {
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

// Rollback Modal Component with version history
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

function RollbackModal({ isOpen, onClose, deployment, onRollback, isLoading }: RollbackModalProps) {
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

// Pod Exec Modal Component - Interactive Terminal with xterm.js
interface PodExecModalProps {
  isOpen: boolean;
  onClose: () => void;
  pod: Pod;
}

function PodExecModal({ isOpen, onClose, pod }: PodExecModalProps) {
  const toast = useToast();
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [selectedShell, setSelectedShell] = useState<string>('/bin/sh');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDistroless, setIsDistroless] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugImage, setDebugImage] = useState('busybox:latest');

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const shellFailCountRef = useRef(0);

  const shells = ['/bin/bash', '/bin/sh', '/bin/ash', '/bin/zsh'];
  const debugImages = [
    { value: 'busybox:latest', label: 'BusyBox (minimal)' },
    { value: 'alpine:latest', label: 'Alpine (with apk)' },
    { value: 'nicolaka/netshoot:latest', label: 'Netshoot (network debug)' },
    { value: 'ubuntu:latest', label: 'Ubuntu (full)' },
  ];

  // Initialize container selection and reset debug state
  useEffect(() => {
    if (isOpen && pod.containers && pod.containers.length > 0) {
      setSelectedContainer(pod.containers[0]);
      // Reset debug state when modal opens
      setIsDistroless(false);
      setDebugMode(false);
      shellFailCountRef.current = 0;
    }
  }, [isOpen, pod]);

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!isOpen || !terminalRef.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e293b',
        foreground: '#e2e8f0',
        cursor: '#22c55e',
        cursorAccent: '#1e293b',
        selectionBackground: '#334155',
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e2e8f0',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc',
      },
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.writeln('\x1b[1;32m┌──────────────────────────────────────────┐\x1b[0m');
    terminal.writeln('\x1b[1;32m│\x1b[0m  \x1b[1;36mNextSight AI Pod Terminal\x1b[0m                \x1b[1;32m│\x1b[0m');
    terminal.writeln('\x1b[1;32m└──────────────────────────────────────────┘\x1b[0m');
    terminal.writeln('');
    terminal.writeln(`\x1b[90mPod:\x1b[0m ${pod.name}`);
    terminal.writeln(`\x1b[90mNamespace:\x1b[0m ${pod.namespace}`);
    terminal.writeln('');
    terminal.writeln('\x1b[33mConnecting...\x1b[0m');

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        // Send resize to WebSocket
        if (wsRef.current?.readyState === WebSocket.OPEN && xtermRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [isOpen, pod.name, pod.namespace]);

  // Track if initial connection was made
  const hasConnectedRef = useRef(false);
  const connectionStatusRef = useRef(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  // Connect WebSocket - stable function that doesn't change
  const connectWebSocket = useCallback(() => {
    if (!xtermRef.current || !selectedContainer) return;

    const terminal = xtermRef.current;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('connecting');

    // Build WebSocket URL - use debug endpoint if debug mode is enabled
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl: string;

    if (debugMode) {
      wsUrl = `${protocol}//${window.location.host}/api/v1/ws/pods/${pod.namespace}/${pod.name}/debug?container=${selectedContainer}&image=${encodeURIComponent(debugImage)}&target_container=${selectedContainer}`;
      terminal.writeln('');
      terminal.writeln(`\x1b[1;35m🔧 Debug Mode\x1b[0m`);
      terminal.writeln(`\x1b[90mAttaching debug container (${debugImage}) to ${selectedContainer}...\x1b[0m`);
    } else {
      wsUrl = `${protocol}//${window.location.host}/api/v1/ws/pods/${pod.namespace}/${pod.name}/exec?container=${selectedContainer}&shell=${encodeURIComponent(selectedShell)}`;
      terminal.writeln('');
      terminal.writeln(`\x1b[90mConnecting to ${selectedContainer} with ${selectedShell}...\x1b[0m`);
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    let inputHandler: { dispose: () => void } | null = null;
    let outputBuffer = '';

    ws.onopen = () => {
      setConnectionStatus('connected');
      terminal.writeln('\x1b[32m✓ Connected\x1b[0m');
      terminal.writeln('');

      // Send initial resize
      ws.send(JSON.stringify({
        type: 'resize',
        cols: terminal.cols,
        rows: terminal.rows,
      }));

      // Handle terminal input only after connection
      inputHandler = terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'output') {
          terminal.write(data.data);
          outputBuffer += data.data;

          // Detect shell not found errors (distroless container)
          if (!debugMode && (
            outputBuffer.includes('executable file not found') ||
            outputBuffer.includes('OCI runtime exec failed') ||
            outputBuffer.includes('no such file or directory') ||
            outputBuffer.includes('exit code 127')
          )) {
            shellFailCountRef.current++;

            // If all shells have failed, this is likely a distroless container
            if (shellFailCountRef.current >= shells.length) {
              setIsDistroless(true);
              terminal.writeln('');
              terminal.writeln('\x1b[1;33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
              terminal.writeln('\x1b[1;33m⚠  Distroless Container Detected\x1b[0m');
              terminal.writeln('\x1b[90m   This container has no shell or standard tools.\x1b[0m');
              terminal.writeln('\x1b[90m   Use the "Debug Container" mode to attach a debug pod.\x1b[0m');
              terminal.writeln('\x1b[1;33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
              terminal.writeln('');
            }
          }
        } else if (data.type === 'status') {
          if (data.status === 'disconnected') {
            terminal.writeln('');
            terminal.writeln('\x1b[33m⚠ Session ended\x1b[0m');
            setConnectionStatus('disconnected');
          }
        } else if (data.type === 'error') {
          terminal.writeln('');
          terminal.writeln(`\x1b[31m✗ Error: ${data.error}\x1b[0m`);
          setConnectionStatus('error');
        }
      } catch {
        // Raw text output
        terminal.write(event.data);
      }
    };

    ws.onerror = () => {
      terminal.writeln('');
      terminal.writeln('\x1b[31m✗ Connection error\x1b[0m');
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      // Only update to disconnected if not already in error state
      setConnectionStatus(prev => prev === 'error' ? 'error' : 'disconnected');
    };

    return () => {
      if (inputHandler) {
        inputHandler.dispose();
      }
    };
  }, [selectedContainer, selectedShell, debugMode, debugImage, pod.namespace, pod.name, shells.length]);

  // Connect when modal opens and container is selected (only once per open)
  useEffect(() => {
    if (isOpen && selectedContainer && xtermRef.current && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connectWebSocket();
    }

    // Reset when modal closes
    if (!isOpen) {
      hasConnectedRef.current = false;
    }
  }, [isOpen, selectedContainer, connectWebSocket]);

  // Reconnect when shell changes (user manually changes)
  const handleShellChange = (shell: string) => {
    setSelectedShell(shell);
    // Will reconnect in next effect
    setTimeout(() => {
      if (xtermRef.current) {
        connectWebSocket();
      }
    }, 100);
  };

  // Fit terminal when expanded state changes
  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 300);
    }
  }, [isExpanded]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleContainerChange = (container: string) => {
    setSelectedContainer(container);
    // Reconnect with new container
    setTimeout(() => {
      if (xtermRef.current) {
        connectWebSocket();
      }
    }, 100);
  };

  const handleReconnect = () => {
    connectWebSocket();
  };

  const copyExecCommand = () => {
    const containerFlag = selectedContainer ? `-c ${selectedContainer}` : '';
    const cmd = `kubectl exec -it ${pod.name} -n ${pod.namespace} ${containerFlag} -- ${selectedShell}`;
    navigator.clipboard.writeText(cmd);
    toast.success('Command copied', 'Exec command copied to clipboard');
  };

  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`fixed top-16 right-0 bottom-0 z-[9999] flex flex-col bg-slate-900 shadow-2xl border-l border-slate-700 ${
        isExpanded ? 'w-full left-0' : 'w-[55%] min-w-[600px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-900/30">
            <CommandLineIcon className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-100">Terminal</h2>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                connectionStatus === 'connected' ? 'bg-green-900/50 text-green-400' :
                connectionStatus === 'connecting' ? 'bg-yellow-900/50 text-yellow-400' :
                connectionStatus === 'error' ? 'bg-red-900/50 text-red-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {connectionStatus === 'connected' ? <SignalIcon className="h-3 w-3" /> : <SignalSlashIcon className="h-3 w-3" />}
                {connectionStatus}
              </span>
            </div>
            <p className="text-xs text-gray-400">{pod.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus !== 'connected' && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReconnect}
              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Reconnect
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={copyExecCommand}
            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-700 text-gray-300 hover:bg-slate-600 transition-colors"
          >
            Copy Command
          </motion.button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-slate-700 rounded-xl"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ArrowsPointingInIcon className="h-4 w-4 text-gray-400" />
            ) : (
              <ArrowsPointingOutIcon className="h-4 w-4 text-gray-400" />
            )}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-xl">
            <XMarkIcon className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-700 bg-slate-800/50 flex-wrap">
        {pod.containers && pod.containers.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Container:</label>
            <select
              value={selectedContainer}
              onChange={(e) => handleContainerChange(e.target.value)}
              className="px-2 py-1 text-xs rounded border border-slate-600 bg-slate-700 text-gray-100"
            >
              {pod.containers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* Debug Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setDebugMode(!debugMode);
              shellFailCountRef.current = 0;
              setIsDistroless(false);
              setTimeout(() => connectWebSocket(), 100);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-xl transition-colors ${
              debugMode
                ? 'bg-purple-600 text-white'
                : isDistroless
                ? 'bg-yellow-600 text-white animate-pulse'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
            Debug Container
          </button>
        </div>

        {debugMode ? (
          /* Debug Image Selector */
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Image:</label>
            <select
              value={debugImage}
              onChange={(e) => {
                setDebugImage(e.target.value);
                setTimeout(() => connectWebSocket(), 100);
              }}
              className="px-2 py-1 text-xs rounded border border-slate-600 bg-slate-700 text-gray-100"
            >
              {debugImages.map((img) => (
                <option key={img.value} value={img.value}>{img.label}</option>
              ))}
            </select>
          </div>
        ) : (
          /* Shell Selector */
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Shell:</label>
            <select
              value={selectedShell}
              onChange={(e) => handleShellChange(e.target.value)}
              className="px-2 py-1 text-xs rounded border border-slate-600 bg-slate-700 text-gray-100"
            >
              {shells.map((shell) => (
                <option key={shell} value={shell}>{shell}</option>
              ))}
            </select>
          </div>
        )}

        {/* Distroless warning indicator */}
        {isDistroless && !debugMode && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-xl bg-yellow-900/50 text-yellow-400">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            No shell available
          </div>
        )}
      </div>

      {/* Terminal */}
      <div className="flex-1 p-2 overflow-hidden">
        <div
          ref={terminalRef}
          className="h-full w-full rounded-xl overflow-hidden"
          style={{ backgroundColor: '#1e293b' }}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {debugMode ? (
            <>
              <span className="text-purple-400">Debug Mode</span> • Ephemeral container attached with process namespace sharing
            </>
          ) : (
            <>Press Esc to close • Ctrl+C to interrupt</>
          )}
        </p>
        {debugMode && (
          <span className="text-xs text-purple-400 flex items-center gap-1">
            <WrenchScrewdriverIcon className="h-3 w-3" />
            {debugImage}
          </span>
        )}
      </div>
    </motion.div>,
    document.body
  );
}

type CategoryType = 'workloads' | 'networking' | 'config' | 'storage' | 'scaling';
type WorkloadTab = 'deployments' | 'pods' | 'statefulsets' | 'daemonsets' | 'jobs' | 'cronjobs';
type NetworkTab = 'services' | 'ingresses';
type ConfigTab = 'configmaps' | 'secrets';

const categories: { id: CategoryType; label: string; icon: typeof CubeIcon }[] = [
  { id: 'workloads', label: 'Workloads', icon: CubeIcon },
  { id: 'networking', label: 'Networking', icon: GlobeAltIcon },
  { id: 'config', label: 'Config', icon: Cog6ToothIcon },
  { id: 'storage', label: 'Storage', icon: CircleStackIcon },
  { id: 'scaling', label: 'Scaling', icon: ArrowsPointingOutIcon },
];

const workloadTabs: { id: WorkloadTab; label: string; icon: typeof CubeIcon }[] = [
  { id: 'deployments', label: 'Deployments', icon: ServerStackIcon },
  { id: 'pods', label: 'Pods', icon: CubeIcon },
  { id: 'statefulsets', label: 'StatefulSets', icon: ServerStackIcon },
  { id: 'daemonsets', label: 'DaemonSets', icon: CpuChipIcon },
  { id: 'jobs', label: 'Jobs', icon: ClockIcon },
  { id: 'cronjobs', label: 'CronJobs', icon: CalendarIcon },
];

const networkTabs: { id: NetworkTab; label: string; icon: typeof GlobeAltIcon }[] = [
  { id: 'services', label: 'Services', icon: GlobeAltIcon },
  { id: 'ingresses', label: 'Ingresses', icon: GlobeAltIcon },
];

const configTabs: { id: ConfigTab; label: string; icon: typeof DocumentDuplicateIcon }[] = [
  { id: 'configmaps', label: 'ConfigMaps', icon: DocumentDuplicateIcon },
  { id: 'secrets', label: 'Secrets', icon: KeyIcon },
];

// Auto-refresh interval options
const autoRefreshOptions = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
];

// Health indicators helper function
function getHealthIndicators(
  workloadName: string,
  workloadNamespace: string,
  workloadLabels: Record<string, string>,
  ageStr: string,
  allPods: Pod[]
) {
  // Find pods belonging to this workload by matching labels or name prefix
  const workloadPods = allPods.filter(pod => {
    if (pod.namespace !== workloadNamespace) return false;
    // Match by common label patterns or name prefix
    return (
      pod.name.startsWith(workloadName) ||
      (workloadLabels?.app && pod.labels?.app === workloadLabels.app) ||
      (workloadLabels?.['app.kubernetes.io/name'] &&
       pod.labels?.['app.kubernetes.io/name'] === workloadLabels['app.kubernetes.io/name'])
    );
  });

  if (workloadPods.length === 0) {
    return {
      maxRestarts: 0,
      hasOOMKilled: false,
      hasImagePullError: false,
      hasCrashLoop: false,
      hasProbeFailure: false,
      isRecent: false,
    };
  }

  // Calculate max restarts
  const maxRestarts = Math.max(...workloadPods.map(p => p.restarts || 0));

  // Check for specific failure indicators
  const hasImagePullError = workloadPods.some(p => p.status === 'Pending' && !p.ready);
  const hasCrashLoop = workloadPods.some(p => (p.restarts || 0) > 5);
  const hasProbeFailure = workloadPods.some(p => p.status === 'Running' && !p.ready);

  // Check if workload is recent (< 10m)
  const isRecent = ageStr.includes('s') || (ageStr.includes('m') && parseInt(ageStr) < 10);

  return {
    maxRestarts,
    hasOOMKilled: false,
    hasImagePullError,
    hasCrashLoop,
    hasProbeFailure,
    isRecent,
  };
}

export default function KubernetesResourcesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedNamespace } = useNamespace();

  // Map URL tab param to category and sub-tab
  const getInitialState = () => {
    const tabParam = searchParams.get('tab');
    const workloadTabs: WorkloadTab[] = ['deployments', 'pods', 'statefulsets', 'daemonsets', 'jobs', 'cronjobs'];
    const networkTabs: NetworkTab[] = ['services', 'ingresses'];
    const configTabs: ConfigTab[] = ['configmaps', 'secrets'];

    if (tabParam) {
      if (workloadTabs.includes(tabParam as WorkloadTab)) {
        return { category: 'workloads' as CategoryType, workload: tabParam as WorkloadTab, network: 'services' as NetworkTab, config: 'configmaps' as ConfigTab };
      }
      if (networkTabs.includes(tabParam as NetworkTab)) {
        return { category: 'networking' as CategoryType, workload: 'deployments' as WorkloadTab, network: tabParam as NetworkTab, config: 'configmaps' as ConfigTab };
      }
      if (configTabs.includes(tabParam as ConfigTab)) {
        return { category: 'config' as CategoryType, workload: 'deployments' as WorkloadTab, network: 'services' as NetworkTab, config: tabParam as ConfigTab };
      }
      if (tabParam === 'storage' || tabParam === 'pvc' || tabParam === 'pvcs') {
        return { category: 'storage' as CategoryType, workload: 'deployments' as WorkloadTab, network: 'services' as NetworkTab, config: 'configmaps' as ConfigTab };
      }
      if (tabParam === 'scaling' || tabParam === 'hpa' || tabParam === 'hpas') {
        return { category: 'scaling' as CategoryType, workload: 'deployments' as WorkloadTab, network: 'services' as NetworkTab, config: 'configmaps' as ConfigTab };
      }
    }
    return { category: 'workloads' as CategoryType, workload: 'deployments' as WorkloadTab, network: 'services' as NetworkTab, config: 'configmaps' as ConfigTab };
  };

  const initialState = getInitialState();
  const [activeCategory, setActiveCategory] = useState<CategoryType>(initialState.category);
  const [activeWorkloadTab, setActiveWorkloadTab] = useState<WorkloadTab>(initialState.workload);
  const [activeNetworkTab, setActiveNetworkTab] = useState<NetworkTab>(initialState.network);
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTab>(initialState.config);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync URL when tab changes
  const updateUrlTab = useCallback((tab: string) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  // Cache invalidation
  const { invalidateByNamespace } = useInvalidateWorkloads();

  // Cached data hooks - only fetch when tab is active (enabled)
  const ns = selectedNamespace || undefined;

  // Namespaces
  const { data: namespaces = [] } = useNamespaces();

  // Workloads - use enabled flag to only fetch active tab
  const { data: deployments = [], isLoading: deploymentsLoading, refetch: refetchDeployments } =
    useDeployments(ns, activeCategory === 'workloads' && activeWorkloadTab === 'deployments');
  // Always fetch pods for health indicators across all workload tabs
  const { data: pods = [], isLoading: podsLoading, refetch: refetchPods } =
    usePods(ns, activeCategory === 'workloads');
  const { data: statefulSets = [], isLoading: statefulSetsLoading, refetch: refetchStatefulSets } =
    useStatefulSets(ns, activeCategory === 'workloads' && activeWorkloadTab === 'statefulsets');
  const { data: daemonSets = [], isLoading: daemonSetsLoading, refetch: refetchDaemonSets } =
    useDaemonSets(ns, activeCategory === 'workloads' && activeWorkloadTab === 'daemonsets');
  const { data: jobs = [], isLoading: jobsLoading, refetch: refetchJobs } =
    useJobs(ns, activeCategory === 'workloads' && activeWorkloadTab === 'jobs');
  const { data: cronJobs = [], isLoading: cronJobsLoading, refetch: refetchCronJobs } =
    useCronJobs(ns, activeCategory === 'workloads' && activeWorkloadTab === 'cronjobs');

  // Networking
  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } =
    useServices(ns, activeCategory === 'networking' && activeNetworkTab === 'services');
  const { data: ingresses = [], isLoading: ingressesLoading, refetch: refetchIngresses } =
    useIngresses(ns, activeCategory === 'networking' && activeNetworkTab === 'ingresses');

  // Config
  const { data: configMaps = [], isLoading: configMapsLoading, refetch: refetchConfigMaps } =
    useConfigMaps(ns, activeCategory === 'config' && activeConfigTab === 'configmaps');
  const { data: secrets = [], isLoading: secretsLoading, refetch: refetchSecrets } =
    useSecrets(ns, activeCategory === 'config' && activeConfigTab === 'secrets');

  // Storage
  const { data: pvcs = [], isLoading: pvcsLoading, refetch: refetchPVCs } =
    usePVCs(ns, activeCategory === 'storage');

  // Scaling
  const { data: hpas = [], isLoading: hpasLoading, refetch: refetchHPAs } =
    useHPAs(ns, activeCategory === 'scaling');

  // Compute loading state based on active tab
  const loading = useMemo(() => {
    if (activeCategory === 'workloads') {
      switch (activeWorkloadTab) {
        case 'deployments': return deploymentsLoading;
        case 'pods': return podsLoading;
        case 'statefulsets': return statefulSetsLoading;
        case 'daemonsets': return daemonSetsLoading;
        case 'jobs': return jobsLoading;
        case 'cronjobs': return cronJobsLoading;
      }
    } else if (activeCategory === 'networking') {
      switch (activeNetworkTab) {
        case 'services': return servicesLoading;
        case 'ingresses': return ingressesLoading;
      }
    } else if (activeCategory === 'config') {
      switch (activeConfigTab) {
        case 'configmaps': return configMapsLoading;
        case 'secrets': return secretsLoading;
      }
    } else if (activeCategory === 'storage') {
      return pvcsLoading;
    } else if (activeCategory === 'scaling') {
      return hpasLoading;
    }
    return false;
  }, [activeCategory, activeWorkloadTab, activeNetworkTab, activeConfigTab,
      deploymentsLoading, podsLoading, statefulSetsLoading, daemonSetsLoading,
      jobsLoading, cronJobsLoading, servicesLoading, ingressesLoading,
      configMapsLoading, secretsLoading, pvcsLoading, hpasLoading]);

  // Sync with URL params when they change (e.g., from sidebar navigation)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (!tabParam) return;

    const workloadTabsList: WorkloadTab[] = ['deployments', 'pods', 'statefulsets', 'daemonsets', 'jobs', 'cronjobs'];
    const networkTabsList: NetworkTab[] = ['services', 'ingresses'];
    const configTabsList: ConfigTab[] = ['configmaps', 'secrets'];

    if (workloadTabsList.includes(tabParam as WorkloadTab)) {
      setActiveCategory('workloads');
      setActiveWorkloadTab(tabParam as WorkloadTab);
    } else if (networkTabsList.includes(tabParam as NetworkTab)) {
      setActiveCategory('networking');
      setActiveNetworkTab(tabParam as NetworkTab);
    } else if (configTabsList.includes(tabParam as ConfigTab)) {
      setActiveCategory('config');
      setActiveConfigTab(tabParam as ConfigTab);
    } else if (tabParam === 'storage' || tabParam === 'pvc' || tabParam === 'pvcs') {
      setActiveCategory('storage');
    } else if (tabParam === 'scaling' || tabParam === 'hpa' || tabParam === 'hpas') {
      setActiveCategory('scaling');
    }
  }, [searchParams]);

  // Get current resource count based on active category and sub-tab
  function getCurrentResourceCount(): number {
    if (activeCategory === 'workloads') {
      switch (activeWorkloadTab) {
        case 'deployments': return deployments.length;
        case 'pods': return pods.length;
        case 'statefulsets': return statefulSets.length;
        case 'daemonsets': return daemonSets.length;
        case 'jobs': return jobs.length;
        case 'cronjobs': return cronJobs.length;
      }
    } else if (activeCategory === 'networking') {
      switch (activeNetworkTab) {
        case 'services': return services.length;
        case 'ingresses': return ingresses.length;
      }
    } else if (activeCategory === 'config') {
      switch (activeConfigTab) {
        case 'configmaps': return configMaps.length;
        case 'secrets': return secrets.length;
      }
    } else if (activeCategory === 'storage') {
      return pvcs.length;
    } else if (activeCategory === 'scaling') {
      return hpas.length;
    }
    return 0;
  }

  // Refetch current tab data
  const fetchResourceData = useCallback(() => {
    if (activeCategory === 'workloads') {
      switch (activeWorkloadTab) {
        case 'deployments': refetchDeployments(); break;
        case 'pods': refetchPods(); break;
        case 'statefulsets': refetchStatefulSets(); break;
        case 'daemonsets': refetchDaemonSets(); break;
        case 'jobs': refetchJobs(); break;
        case 'cronjobs': refetchCronJobs(); break;
      }
    } else if (activeCategory === 'networking') {
      switch (activeNetworkTab) {
        case 'services': refetchServices(); break;
        case 'ingresses': refetchIngresses(); break;
      }
    } else if (activeCategory === 'config') {
      switch (activeConfigTab) {
        case 'configmaps': refetchConfigMaps(); break;
        case 'secrets': refetchSecrets(); break;
      }
    } else if (activeCategory === 'storage') {
      refetchPVCs();
    } else if (activeCategory === 'scaling') {
      refetchHPAs();
    }
  }, [activeCategory, activeWorkloadTab, activeNetworkTab, activeConfigTab,
      refetchDeployments, refetchPods, refetchStatefulSets, refetchDaemonSets,
      refetchJobs, refetchCronJobs, refetchServices, refetchIngresses,
      refetchConfigMaps, refetchSecrets, refetchPVCs, refetchHPAs]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }

    if (autoRefreshInterval > 0) {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchResourceData();
      }, autoRefreshInterval * 1000);
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [autoRefreshInterval, selectedNamespace, activeCategory, activeWorkloadTab, activeNetworkTab, activeConfigTab]);

  // Render workload content based on active tab
  function renderContent() {
    if (loading) {
      return <TableSkeleton />;
    }

    switch (activeWorkloadTab) {
      case 'deployments':
        return <DeploymentsTable data={deployments} searchQuery={searchQuery} onRefresh={fetchResourceData} pods={pods} />;
      case 'pods':
        return <PodsTable data={pods} searchQuery={searchQuery} />;
      case 'statefulsets':
        return <StatefulSetsTable data={statefulSets} searchQuery={searchQuery} onRefresh={fetchResourceData} />;
      case 'daemonsets':
        return <DaemonSetsTable data={daemonSets} searchQuery={searchQuery} />;
      case 'jobs':
        return <JobsTable data={jobs} searchQuery={searchQuery} />;
      case 'cronjobs':
        return <CronJobsTable data={cronJobs} searchQuery={searchQuery} />;
      default:
        return <DeploymentsTable data={deployments} searchQuery={searchQuery} onRefresh={fetchResourceData} pods={pods} />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Workloads"
        description="Manage deployments, pods, and other workload resources"
        icon={CubeIcon}
        iconColor="primary"
        onRefresh={fetchResourceData}
        refreshing={loading}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resources..."
                className="pl-10 pr-4 py-2 w-64 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            {/* Namespace Filter */}
            <div className="relative">
              <select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all cursor-pointer"
              >
                <option value="">All Namespaces</option>
                {namespaces.map((ns) => (
                  <option key={ns.name} value={ns.name}>
                    {ns.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            {/* Auto-Refresh Toggle */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 p-1">
              {autoRefreshOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAutoRefreshInterval(option.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    autoRefreshInterval === option.value
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {autoRefreshInterval > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Auto
              </span>
            )}
          </div>
        }
      />

      {/* Horizontal Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 pb-4">
        {workloadTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveWorkloadTab(tab.id as WorkloadTab);
                updateUrlTab(tab.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                activeWorkloadTab === tab.id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeWorkloadTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Table Skeleton Component
function TableSkeleton() {
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

// Empty State Component with Enhanced Visuals
function EmptyState({ icon: Icon, title }: { icon: typeof CubeIcon; title: string }) {
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

// Status Filter Component
type StatusFilterOption = { value: string; label: string; color: string };

function StatusFilter({
  options,
  selected,
  onChange
}: {
  options: StatusFilterOption[];
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <FunnelIcon className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filter:</span>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1 text-xs font-medium rounded-xl transition-all ${
              selected === option.value
                ? `${option.color} ring-1 ring-current`
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Sortable Header Component
type SortDirection = 'asc' | 'desc' | null;
type SortConfig<T> = { key: keyof T | null; direction: SortDirection };

function SortableHeader<T>({
  label,
  sortKey,
  sortConfig,
  onSort,
  className = ''
}: {
  label: string;
  sortKey: keyof T;
  sortConfig: SortConfig<T>;
  onSort: (key: keyof T) => void;
  className?: string;
}) {
  const isActive = sortConfig.key === sortKey;

  return (
    <th
      className={`text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ChevronUpDownIcon className={`h-4 w-4 transition-colors ${isActive ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600'}`} />
        {isActive && sortConfig.direction && (
          <span className="text-xs text-primary-500">
            {sortConfig.direction === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );
}

// Sort helper function
function sortData<T>(data: T[], sortConfig: SortConfig<T>): T[] {
  if (!sortConfig.key || !sortConfig.direction) return data;

  return [...data].sort((a, b) => {
    const aVal = a[sortConfig.key as keyof T];
    const bVal = b[sortConfig.key as keyof T];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });
}

// Simple YAML display - no syntax highlighting to avoid HTML escaping issues
// The YAML content is displayed with proper monospace styling

// YAML Panel Component (slide-in panel)
function YAMLModal({
  isOpen,
  onClose,
  resourceType,
  namespace,
  name,
  onRefresh
}: {
  isOpen: boolean;
  onClose: () => void;
  resourceType: string;
  namespace: string;
  name: string;
  onRefresh?: () => void;
}) {
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

  // Keyboard shortcut: Escape to close
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
      logger.error('Failed to copy', err);
    }
  }

  function handleReset() {
    setYaml(originalYaml);
    setSaveResult(null);
    setError(null);
  }

  if (!isOpen) return null;

  const lines = yaml.split('\n');

  // Use React Portal to render slide-in panel at document.body level
  // Position below the main header (top-16 = 64px)
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
            {/* Edit Mode Toggle */}
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
            {/* Expand/Collapse button */}
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

// Deployment filter options
const deploymentFilterOptions: StatusFilterOption[] = [
  { value: 'all', label: 'All', color: 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700' },
  { value: 'healthy', label: 'Healthy', color: 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/20' },
  { value: 'degraded', label: 'Degraded', color: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/20' },
];

// Table Components
function DeploymentsTable({ data, searchQuery, onRefresh, pods }: { data: Deployment[]; searchQuery: string; onRefresh: () => void; pods: Pod[] }) {
  const toast = useToast();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [scaleModal, setScaleModal] = useState<{ dep: Deployment; replicas: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<SortConfig<Deployment>>({ key: null, direction: null });
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);
  const [rollbackModal, setRollbackModal] = useState<Deployment | null>(null);

  // Filter by search query
  const searchFiltered = data.filter(dep =>
    dep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dep.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dep.image?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter by status
  const statusFiltered = useMemo(() => {
    if (statusFilter === 'all') return searchFiltered;
    if (statusFilter === 'healthy') return searchFiltered.filter(dep => dep.ready_replicas === dep.replicas);
    if (statusFilter === 'degraded') return searchFiltered.filter(dep => dep.ready_replicas !== dep.replicas);
    return searchFiltered;
  }, [searchFiltered, statusFilter]);

  // Sort data
  const sortedData = useMemo(() => sortData(statusFiltered, sortConfig), [statusFiltered, sortConfig]);

  const handleSort = (key: keyof Deployment) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleScale = async (dep: Deployment, replicas: number) => {
    setActionLoading(`scale-${dep.namespace}-${dep.name}`);
    try {
      await kubernetesApi.scale(dep.namespace, dep.name, replicas);
      toast.success('Deployment scaled', `${dep.name} scaled to ${replicas} replicas`);
      onRefresh();
    } catch (error) {
      toast.error('Scale failed', `Failed to scale ${dep.name}`);
      logger.error('Failed to scale deployment', error);
    } finally {
      setActionLoading(null);
      setScaleModal(null);
    }
  };

  const handleRestart = async (dep: Deployment) => {
    setActionLoading(`restart-${dep.namespace}-${dep.name}`);
    try {
      await kubernetesApi.restart(dep.namespace, dep.name);
      toast.success('Deployment restarted', `${dep.name} is restarting`);
      onRefresh();
    } catch (error) {
      toast.error('Restart failed', `Failed to restart ${dep.name}`);
      logger.error('Failed to restart deployment', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRollback = async (dep: Deployment, revision: number) => {
    setActionLoading(`rollback-${dep.namespace}-${dep.name}`);
    try {
      await kubernetesApi.executeKubectl({
        command: `rollout undo deployment ${dep.name} -n ${dep.namespace} --to-revision=${revision}`,
      });
      toast.success('Rollback initiated', `${dep.name} is rolling back to revision ${revision}`);
      onRefresh();
      setRollbackModal(null);
    } catch (error) {
      toast.error('Rollback failed', `Failed to rollback ${dep.name}`);
      logger.error('Failed to rollback deployment', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (data.length === 0) {
    return <EmptyState icon={ServerStackIcon} title={searchQuery ? "No matching deployments" : "No deployments found"} />;
  }

  return (
    <>
      {/* Status Filter */}
      <StatusFilter options={deploymentFilterOptions} selected={statusFilter} onChange={setStatusFilter} />

      {sortedData.length === 0 ? (
        <EmptyState icon={ServerStackIcon} title="No deployments match filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ready</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Image</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {sortedData.map((dep, index) => {
                const isExpanded = expandedRow === `${dep.namespace}-${dep.name}`;
                const rowKey = `${dep.namespace}-${dep.name}`;
                return (
                  <>
                    <motion.tr
                      key={rowKey}
                      custom={index}
                      variants={tableRowVariants}
                      initial="hidden"
                      animate="visible"
                      className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                          className="p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                          )}
                        </motion.button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{dep.name}</span>
                          {(() => {
                            const healthIndicators = getHealthIndicators(dep.name, dep.namespace, dep.labels, dep.age, pods);
                            return (
                              <>
                                {healthIndicators.maxRestarts > 0 && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold"
                                    title={`${healthIndicators.maxRestarts} restarts`}
                                  >
                                    <ArrowPathIcon className="h-2.5 w-2.5" />
                                    {healthIndicators.maxRestarts}
                                  </span>
                                )}
                                {healthIndicators.isRecent && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-semibold">
                                    <ClockIcon className="h-2.5 w-2.5" />
                                    Recent
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                          {dep.namespace}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            dep.ready_replicas === dep.replicas
                              ? 'bg-success-500/10 text-success-600 dark:text-success-400 ring-1 ring-success-500/20'
                              : 'bg-warning-500/10 text-warning-600 dark:text-warning-400 ring-1 ring-warning-500/20'
                          }`}>
                            {dep.ready_replicas}/{dep.replicas}
                          </span>
                          {(() => {
                            const healthIndicators = getHealthIndicators(dep.name, dep.namespace, dep.labels, dep.age, pods);
                            return (
                              <>
                                {healthIndicators.hasCrashLoop && (
                                  <span title="CrashLoopBackOff detected" className="inline-flex p-0.5 rounded bg-red-100 dark:bg-red-500/10">
                                    <ExclamationTriangleIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                  </span>
                                )}
                                {healthIndicators.hasImagePullError && (
                                  <span title="ImagePullError detected" className="inline-flex p-0.5 rounded bg-amber-100 dark:bg-amber-500/10">
                                    <DocumentDuplicateIcon className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                  </span>
                                )}
                                {healthIndicators.hasProbeFailure && (
                                  <span title="Probe failure detected" className="inline-flex p-0.5 rounded bg-orange-100 dark:bg-orange-500/10">
                                    <ExclamationTriangleIcon className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm truncate max-w-xs font-mono">{dep.image?.split('/').pop() || '-'}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{dep.age}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setScaleModal({ dep, replicas: dep.replicas })}
                            className="p-2 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="Scale"
                          >
                            <ScaleIcon className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRestart(dep)}
                            disabled={actionLoading === `restart-${dep.namespace}-${dep.name}`}
                            className="p-2 rounded-xl text-gray-500 hover:text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors disabled:opacity-50"
                            title="Restart"
                          >
                            {actionLoading === `restart-${dep.namespace}-${dep.name}` ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowPathIcon className="h-4 w-4" />
                            )}
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setRollbackModal(dep)}
                            disabled={actionLoading === `rollback-${dep.namespace}-${dep.name}`}
                            className="p-2 rounded-xl text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50"
                            title="Rollback to specific revision"
                          >
                            {actionLoading === `rollback-${dep.namespace}-${dep.name}` ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowUturnLeftIcon className="h-4 w-4" />
                            )}
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setYamlModal({ namespace: dep.namespace, name: dep.name })}
                            className="p-2 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                            title="View YAML"
                          >
                            <CodeBracketIcon className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          key={`${rowKey}-details`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <td colSpan={7} className="p-0">
                            <div className="px-6 py-4 bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Full Image Path</h4>
                                  <p className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all bg-gray-100 dark:bg-slate-700 p-2 rounded-xl">
                                    {dep.image || '-'}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Labels</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {dep.labels && Object.keys(dep.labels).length > 0 ? (
                                      Object.entries(dep.labels).slice(0, 4).map(([key, value]) => (
                                        <span key={key} className="px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-mono">
                                          {key.split('/').pop()}={value.length > 15 ? value.slice(0, 15) + '...' : value}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-sm text-gray-400">No labels</span>
                                    )}
                                    {dep.labels && Object.keys(dep.labels).length > 4 && (
                                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-slate-700 text-gray-500">
                                        +{Object.keys(dep.labels).length - 4} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Replica Status</h4>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Desired:</span>
                                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{dep.replicas}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Ready:</span>
                                      <span className={`text-sm font-semibold ${dep.ready_replicas === dep.replicas ? 'text-success-600 dark:text-success-400' : 'text-warning-600 dark:text-warning-400'}`}>
                                        {dep.ready_replicas}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Available:</span>
                                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{dep.available_replicas ?? dep.ready_replicas}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Scale Modal - Using reusable component */}
      {scaleModal && (
        <ScaleModal
          isOpen={!!scaleModal}
          onClose={() => setScaleModal(null)}
          resourceName={scaleModal.dep.name}
          resourceType="Deployment"
          namespace={scaleModal.dep.namespace}
          currentReplicas={scaleModal.dep.replicas}
          onScale={async (replicas) => {
            await handleScale(scaleModal.dep, replicas);
          }}
          isLoading={actionLoading !== null}
        />
      )}

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="deployment"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Rollback Modal */}
      <AnimatePresence>
        {rollbackModal && (
          <RollbackModal
            isOpen={!!rollbackModal}
            onClose={() => setRollbackModal(null)}
            deployment={rollbackModal}
            onRollback={async (revision) => {
              await handleRollback(rollbackModal, revision);
            }}
            isLoading={actionLoading !== null}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Pod filter options
const podFilterOptions: StatusFilterOption[] = [
  { value: 'all', label: 'All', color: 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700' },
  { value: 'running', label: 'Running', color: 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/20' },
  { value: 'pending', label: 'Pending', color: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/20' },
  { value: 'failed', label: 'Failed', color: 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20' },
];

function PodsTable({ data, searchQuery, onRefresh }: { data: Pod[]; searchQuery: string; onRefresh?: () => void }) {
  const toast = useToast();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<SortConfig<Pod>>({ key: null, direction: null });
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);
  const [logsModal, setLogsModal] = useState<Pod | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [execModal, setExecModal] = useState<Pod | null>(null);

  // Filter by search query
  const searchFiltered = data.filter(pod =>
    pod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pod.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pod.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pod.node?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter by status
  const statusFiltered = useMemo(() => {
    if (statusFilter === 'all') return searchFiltered;
    if (statusFilter === 'running') return searchFiltered.filter(pod => pod.status === 'Running');
    if (statusFilter === 'pending') return searchFiltered.filter(pod => pod.status === 'Pending');
    if (statusFilter === 'failed') return searchFiltered.filter(pod => !['Running', 'Pending'].includes(pod.status));
    return searchFiltered;
  }, [searchFiltered, statusFilter]);

  // Sort data
  const sortedData = useMemo(() => sortData(statusFiltered, sortConfig), [statusFiltered, sortConfig]);

  const handleSort = (key: keyof Pod) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDelete = async (pod: Pod) => {
    if (!confirm(`Are you sure you want to delete pod "${pod.name}"?`)) return;

    setDeleteLoading(`${pod.namespace}-${pod.name}`);
    try {
      await kubernetesApi.executeKubectl({
        command: `delete pod ${pod.name} -n ${pod.namespace}`,
      });
      toast.success('Pod deleted', `${pod.name} has been deleted`);
    } catch (error) {
      toast.error('Delete failed', `Failed to delete ${pod.name}`);
      logger.error('Failed to delete pod', error);
    } finally {
      setDeleteLoading(null);
    }
  };

  if (data.length === 0) {
    return <EmptyState icon={CubeIcon} title={searchQuery ? "No matching pods" : "No pods found"} />;
  }

  return (
    <>
      {/* Status Filter */}
      <StatusFilter options={podFilterOptions} selected={statusFilter} onChange={setStatusFilter} />

      {sortedData.length === 0 ? (
        <EmptyState icon={CubeIcon} title="No pods match filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Restarts</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Node</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {sortedData.map((pod, index) => {
                const isExpanded = expandedRow === `${pod.namespace}-${pod.name}`;
                const rowKey = `${pod.namespace}-${pod.name}`;
                const isDeleting = deleteLoading === rowKey;
                return (
                  <>
                    <motion.tr
                      key={rowKey}
                      custom={index}
                      variants={tableRowVariants}
                      initial="hidden"
                      animate="visible"
                      className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                          className="p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                          )}
                        </motion.button>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">{pod.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                          {pod.namespace}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                            pod.status === 'Running'
                              ? 'bg-success-500/10 text-success-600 dark:text-success-400 ring-success-500/20'
                              : pod.status === 'Pending'
                              ? 'bg-warning-500/10 text-warning-600 dark:text-warning-400 ring-warning-500/20'
                              : 'bg-danger-500/10 text-danger-600 dark:text-danger-400 ring-danger-500/20'
                          }`}
                        >
                          {pod.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{pod.restarts}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm font-mono">{pod.node || '-'}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{pod.age}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setLogsModal(pod)}
                            className="p-2 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="View Logs"
                          >
                            <DocumentTextIcon className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setExecModal(pod)}
                            disabled={pod.status !== 'Running'}
                            className="p-2 rounded-xl text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={pod.status === 'Running' ? 'Execute commands in pod' : 'Pod must be running to exec'}
                          >
                            <CommandLineIcon className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setYamlModal({ namespace: pod.namespace, name: pod.name })}
                            className="p-2 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                            title="View YAML"
                          >
                            <CodeBracketIcon className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDelete(pod)}
                            disabled={isDeleting}
                            className="p-2 rounded-xl text-gray-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            {isDeleting ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <TrashIcon className="h-4 w-4" />
                            )}
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          key={`${rowKey}-details`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <td colSpan={8} className="p-0">
                            <div className="px-6 py-4 bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pod IP</h4>
                                  <p className="font-mono text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded inline-block">
                                    {pod.ip || 'Not assigned'}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Containers ({pod.containers?.length || 0})</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {pod.containers && pod.containers.length > 0 ? (
                                      pod.containers.map((container, idx) => (
                                        <span key={idx} className="px-2 py-0.5 rounded text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-mono">
                                          {container}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-sm text-gray-400">No containers</span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Node</h4>
                                  <p className="font-mono text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded inline-block">
                                    {pod.node || 'Not scheduled'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="pod"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Logs Modal */}
      {logsModal && (
        <PodLogsViewer pod={logsModal} onClose={() => setLogsModal(null)} />
      )}

      {/* Exec Modal */}
      <AnimatePresence>
        {execModal && (
          <PodExecModal
            isOpen={!!execModal}
            onClose={() => setExecModal(null)}
            pod={execModal}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ServicesTable({ data, searchQuery, onRefresh }: { data: K8sService[]; searchQuery: string; onRefresh?: () => void }) {
  const toast = useToast();
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<K8sService | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredData = data.filter(svc =>
    svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    svc.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    svc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    svc.cluster_ip?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (svc: K8sService) => {
    setDeleting(true);
    try {
      await kubernetesApi.deleteService(svc.namespace, svc.name);
      toast.success(`Service ${svc.name} deleted successfully`);
      setDeleteModal(null);
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to delete service: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (filteredData.length === 0) {
    return <EmptyState icon={GlobeAltIcon} title={searchQuery ? "No matching services" : "No services found"} />;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cluster IP</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">External IP</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ports</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filteredData.map((svc, index) => (
              <motion.tr
                key={`${svc.namespace}-${svc.name}`}
                custom={index}
                variants={tableRowVariants}
                initial="hidden"
                animate="visible"
                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{svc.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    {svc.namespace}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/20">
                    {svc.type}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-mono text-sm">{svc.cluster_ip || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-mono text-sm">{svc.external_ip || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">
                  {svc.ports.map((p, i) => (
                    <span key={i} className="inline-block mr-2 px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 font-mono text-xs">
                      {p.port}:{p.targetPort}/{p.protocol}
                    </span>
                  ))}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setYamlModal({ namespace: svc.namespace, name: svc.name })}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="View/Edit YAML"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDeleteModal(svc)}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="service"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteModal(null)}
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
                <div className="p-2 rounded-xl bg-danger-100 dark:bg-danger-900/30">
                  <ExclamationTriangleIcon className="h-6 w-6 text-danger-600 dark:text-danger-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Service</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <span className="font-semibold">{deleteModal.name}</span> in namespace{' '}
                <span className="font-semibold">{deleteModal.namespace}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteModal(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDelete(deleteModal)}
                  disabled={deleting}
                  className="px-5 py-2 text-sm font-medium rounded-xl bg-danger-600 text-white hover:bg-danger-700 transition-all shadow-lg shadow-danger-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function IngressesTable({ data, searchQuery, onRefresh }: { data: Ingress[]; searchQuery: string; onRefresh?: () => void }) {
  const toast = useToast();
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<Ingress | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredData = data.filter(ing =>
    ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ing.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ing.class_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ing.hosts.some(h => h.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDelete = async (ing: Ingress) => {
    setDeleting(true);
    try {
      await kubernetesApi.deleteIngress(ing.namespace, ing.name);
      toast.success(`Ingress ${ing.name} deleted successfully`);
      setDeleteModal(null);
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to delete ingress: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (filteredData.length === 0) {
    return <EmptyState icon={GlobeAltIcon} title={searchQuery ? "No matching ingresses" : "No ingresses found"} />;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hosts</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filteredData.map((ing, index) => (
              <motion.tr
                key={`${ing.namespace}-${ing.name}`}
                custom={index}
                variants={tableRowVariants}
                initial="hidden"
                animate="visible"
                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{ing.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    {ing.namespace}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{ing.class_name || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{ing.hosts.join(', ') || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-mono text-sm">{ing.address || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{ing.age}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setYamlModal({ namespace: ing.namespace, name: ing.name })}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="View/Edit YAML"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDeleteModal(ing)}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="ingress"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteModal(null)}
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
                <div className="p-2 rounded-xl bg-danger-100 dark:bg-danger-900/30">
                  <ExclamationTriangleIcon className="h-6 w-6 text-danger-600 dark:text-danger-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Ingress</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <span className="font-semibold">{deleteModal.name}</span> in namespace{' '}
                <span className="font-semibold">{deleteModal.namespace}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteModal(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDelete(deleteModal)}
                  disabled={deleting}
                  className="px-5 py-2 text-sm font-medium rounded-xl bg-danger-600 text-white hover:bg-danger-700 transition-all shadow-lg shadow-danger-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ConfigMapsTable({ data, searchQuery, onRefresh }: { data: ConfigMap[]; searchQuery: string; onRefresh?: () => void }) {
  const toast = useToast();
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<ConfigMap | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredData = data.filter(cm =>
    cm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cm.namespace.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (cm: ConfigMap) => {
    setDeleting(true);
    try {
      await kubernetesApi.deleteConfigMap(cm.namespace, cm.name);
      toast.success(`ConfigMap ${cm.name} deleted successfully`);
      setDeleteModal(null);
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to delete configmap: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (filteredData.length === 0) {
    return <EmptyState icon={DocumentDuplicateIcon} title={searchQuery ? "No matching configmaps" : "No configmaps found"} />;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data Keys</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filteredData.map((cm, index) => (
              <motion.tr
                key={`${cm.namespace}-${cm.name}`}
                custom={index}
                variants={tableRowVariants}
                initial="hidden"
                animate="visible"
                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{cm.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    {cm.namespace}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/20">
                    {cm.data_count} keys
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{cm.age}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setYamlModal({ namespace: cm.namespace, name: cm.name })}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="View/Edit YAML"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDeleteModal(cm)}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="configmap"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteModal(null)}
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
                <div className="p-2 rounded-xl bg-danger-100 dark:bg-danger-900/30">
                  <ExclamationTriangleIcon className="h-6 w-6 text-danger-600 dark:text-danger-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete ConfigMap</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <span className="font-semibold">{deleteModal.name}</span> in namespace{' '}
                <span className="font-semibold">{deleteModal.namespace}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteModal(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDelete(deleteModal)}
                  disabled={deleting}
                  className="px-5 py-2 text-sm font-medium rounded-xl bg-danger-600 text-white hover:bg-danger-700 transition-all shadow-lg shadow-danger-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Secret Modal for viewing and editing secrets
function SecretModal({
  secret,
  mode,
  namespaces,
  onClose,
  onSaved,
}: {
  secret: Secret | null;
  mode: 'view' | 'edit' | 'create';
  namespaces: Namespace[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [secretDetail, setSecretDetail] = useState<SecretDetail | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    namespace: namespaces[0]?.name || 'default',
    type: 'Opaque',
  });

  useEffect(() => {
    if (mode !== 'create' && secret) {
      loadSecretDetail();
    }
  }, [secret, mode]);

  const loadSecretDetail = async () => {
    if (!secret) return;
    setLoading(true);
    try {
      const response = await kubernetesApi.getSecret(secret.namespace, secret.name);
      setSecretDetail(response.data);
      setEditData({ ...response.data.data });
    } catch (err) {
      toast.error('Failed to load secret details');
      logger.error('Failed to load secret details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (mode === 'create') {
        await kubernetesApi.createSecret({
          name: createForm.name,
          namespace: createForm.namespace,
          type: createForm.type,
          data: editData,
        });
        toast.success('Secret created successfully');
      } else if (mode === 'edit' && secret) {
        await kubernetesApi.updateSecret(secret.namespace, secret.name, {
          data: editData,
        });
        toast.success('Secret updated successfully');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(`Failed to ${mode === 'create' ? 'create' : 'update'} secret`);
      logger.error(`Failed to ${mode === 'create' ? 'create' : 'update'} secret`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = () => {
    if (newKey && !editData[newKey]) {
      setEditData({ ...editData, [newKey]: newValue });
      setNewKey('');
      setNewValue('');
    }
  };

  const handleRemoveKey = (key: string) => {
    const newData = { ...editData };
    delete newData[key];
    setEditData(newData);
  };

  const toggleShowValue = (key: string) => {
    setShowValues({ ...showValues, [key]: !showValues[key] });
  };

  const isEditable = mode === 'edit' || mode === 'create';

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <KeyIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {mode === 'create' ? 'Create Secret' : mode === 'edit' ? 'Edit Secret' : 'View Secret'}
              </h3>
              {secret && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {secret.namespace}/{secret.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {!loading && mode === 'create' && (
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    placeholder="my-secret"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Namespace
                  </label>
                  <select
                    value={createForm.namespace}
                    onChange={(e) => setCreateForm({ ...createForm, namespace: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    {namespaces.map((ns) => (
                      <option key={ns.name} value={ns.name}>{ns.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Opaque">Opaque</option>
                  <option value="kubernetes.io/tls">kubernetes.io/tls</option>
                  <option value="kubernetes.io/dockerconfigjson">kubernetes.io/dockerconfigjson</option>
                  <option value="kubernetes.io/basic-auth">kubernetes.io/basic-auth</option>
                  <option value="kubernetes.io/ssh-auth">kubernetes.io/ssh-auth</option>
                </select>
              </div>
            </div>
          )}

          {!loading && (mode === 'view' || mode === 'edit') && secretDetail && (
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Type:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{secretDetail.type}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Created:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {secretDetail.created_at ? new Date(secretDetail.created_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Keys:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">{Object.keys(editData).length}</span>
                </div>
              </div>
            </div>
          )}

          {!loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Data</h4>
                {isEditable && (
                  <button
                    onClick={() => setShowValues(Object.keys(editData).reduce((acc, k) => ({ ...acc, [k]: true }), {}))}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Show all values
                  </button>
                )}
              </div>

              {Object.entries(editData).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{key}</span>
                      <button
                        onClick={() => toggleShowValue(key)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showValues[key] ? (
                          <EyeSlashIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {isEditable ? (
                      <textarea
                        value={value}
                        onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
                        rows={showValues[key] ? 3 : 1}
                        style={{ WebkitTextSecurity: showValues[key] ? 'none' : 'disc' } as React.CSSProperties}
                      />
                    ) : (
                      <div
                        className="text-sm text-gray-600 dark:text-gray-400 font-mono break-all"
                        style={{ WebkitTextSecurity: showValues[key] ? 'none' : 'disc' } as React.CSSProperties}
                      >
                        {value || '(empty)'}
                      </div>
                    )}
                  </div>
                  {isEditable && (
                    <button
                      onClick={() => handleRemoveKey(key)}
                      className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              {Object.keys(editData).length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No data keys
                </div>
              )}

              {isEditable && (
                <div className="flex items-end gap-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Key</label>
                    <input
                      type="text"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="new-key"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Value</label>
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      placeholder="value"
                    />
                  </div>
                  <button
                    onClick={handleAddKey}
                    disabled={!newKey}
                    className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded disabled:opacity-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            {isEditable ? 'Cancel' : 'Close'}
          </button>
          {isEditable && (
            <button
              onClick={handleSave}
              disabled={loading || (mode === 'create' && !createForm.name)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4" />
                  {mode === 'create' ? 'Create' : 'Save Changes'}
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function SecretsTable({ data, searchQuery, namespaces, onRefresh }: { data: Secret[]; searchQuery: string; namespaces: Namespace[]; onRefresh: () => void }) {
  const toast = useToast();
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Secret | null>(null);

  const handleView = (secret: Secret) => {
    setSelectedSecret(secret);
    setModalMode('view');
    setShowModal(true);
  };

  const handleEdit = (secret: Secret) => {
    setSelectedSecret(secret);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedSecret(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleDelete = async (secret: Secret) => {
    try {
      await kubernetesApi.deleteSecret(secret.namespace, secret.name);
      toast.success('Secret deleted successfully');
      setDeleteConfirm(null);
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete secret');
      logger.error('Failed to delete secret', err);
    }
  };

  const filteredData = data.filter(sec =>
    sec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Header with Create Button */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {filteredData.length} secret{filteredData.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-xl transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Create Secret
        </button>
      </div>

      {filteredData.length === 0 ? (
        <EmptyState icon={KeyIcon} title={searchQuery ? "No matching secrets" : "No secrets found"} />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredData.map((sec, index) => (
                <motion.tr
                  key={`${sec.namespace}-${sec.name}`}
                  custom={index}
                  variants={tableRowVariants}
                  initial="hidden"
                  animate="visible"
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{sec.name}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                      {sec.namespace}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/20">
                      {sec.type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs">
                      {sec.data_count} keys
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{sec.age}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleView(sec)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="View"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(sec)}
                        className="p-1.5 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Edit"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(sec)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Secret Modal */}
      <AnimatePresence>
        {showModal && (
          <SecretModal
            secret={selectedSecret}
            mode={modalMode}
            namespaces={namespaces}
            onClose={() => setShowModal(false)}
            onSaved={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Secret</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete the secret <strong>{deleteConfirm.namespace}/{deleteConfirm.name}</strong>?
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PVCsTable({ data, searchQuery, onRefresh }: { data: PVC[]; searchQuery: string; onRefresh?: () => void }) {
  const toast = useToast();
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<PVC | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredData = data.filter(pvc =>
    pvc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pvc.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pvc.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pvc.storage_class?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (pvc: PVC) => {
    setDeleting(true);
    try {
      await kubernetesApi.deletePVC(pvc.namespace, pvc.name);
      toast.success(`PVC ${pvc.name} deleted successfully`);
      setDeleteModal(null);
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to delete PVC: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (filteredData.length === 0) {
    return <EmptyState icon={CircleStackIcon} title={searchQuery ? "No matching PVCs" : "No PVCs found"} />;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Capacity</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Access Modes</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Storage Class</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filteredData.map((pvc, index) => (
              <motion.tr
                key={`${pvc.namespace}-${pvc.name}`}
                custom={index}
                variants={tableRowVariants}
                initial="hidden"
                animate="visible"
                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{pvc.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    {pvc.namespace}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                    pvc.status === 'Bound'
                      ? 'bg-success-500/10 text-success-600 dark:text-success-400 ring-success-500/20'
                      : 'bg-warning-500/10 text-warning-600 dark:text-warning-400 ring-warning-500/20'
                  }`}>
                    {pvc.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-400 font-mono text-sm">{pvc.capacity || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{pvc.access_modes.join(', ')}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{pvc.storage_class || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{pvc.age}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setYamlModal({ namespace: pvc.namespace, name: pvc.name })}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="View/Edit YAML"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDeleteModal(pvc)}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="pvc"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteModal(null)}
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
                <div className="p-2 rounded-xl bg-danger-100 dark:bg-danger-900/30">
                  <ExclamationTriangleIcon className="h-6 w-6 text-danger-600 dark:text-danger-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete PVC</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Are you sure you want to delete <span className="font-semibold">{deleteModal.name}</span> in namespace{' '}
                <span className="font-semibold">{deleteModal.namespace}</span>?
              </p>
              <p className="text-sm text-warning-600 dark:text-warning-400 mb-6">
                Warning: Deleting a PVC may result in data loss if the underlying PersistentVolume uses a delete reclaim policy.
              </p>
              <div className="flex justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteModal(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDelete(deleteModal)}
                  disabled={deleting}
                  className="px-5 py-2 text-sm font-medium rounded-xl bg-danger-600 text-white hover:bg-danger-700 transition-all shadow-lg shadow-danger-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Filter options for StatefulSets
const statefulSetFilterOptions: StatusFilterOption[] = [
  { value: 'all', label: 'All StatefulSets', color: 'gray' },
  { value: 'healthy', label: 'Healthy', color: 'success' },
  { value: 'degraded', label: 'Degraded', color: 'warning' },
];

function StatefulSetsTable({ data, searchQuery, onRefresh }: { data: StatefulSet[]; searchQuery: string; onRefresh: () => void }) {
  const toast = useToast();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [scaleModal, setScaleModal] = useState<{ ss: StatefulSet; replicas: number } | null>(null);
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<SortConfig<StatefulSet>>({ key: null, direction: null });

  // Filter by search query
  const searchFiltered = data.filter(ss =>
    ss.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ss.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ss.image?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter by status
  const statusFiltered = useMemo(() => {
    if (statusFilter === 'all') return searchFiltered;
    if (statusFilter === 'healthy') return searchFiltered.filter(ss => ss.ready_replicas === ss.replicas);
    if (statusFilter === 'degraded') return searchFiltered.filter(ss => ss.ready_replicas !== ss.replicas);
    return searchFiltered;
  }, [searchFiltered, statusFilter]);

  // Sort data
  const filteredData = useMemo(() => sortData(statusFiltered, sortConfig), [statusFiltered, sortConfig]);

  const handleSort = (key: keyof StatefulSet) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleScale = async (ss: StatefulSet, replicas: number) => {
    setActionLoading(`scale-${ss.namespace}-${ss.name}`);
    try {
      await kubernetesApi.executeKubectl({
        command: `scale statefulset ${ss.name} --replicas=${replicas} -n ${ss.namespace}`,
      });
      toast.success('StatefulSet scaled', `${ss.name} scaled to ${replicas} replicas`);
      onRefresh();
    } catch (error) {
      toast.error('Scale failed', `Failed to scale ${ss.name}`);
    } finally {
      setActionLoading(null);
      setScaleModal(null);
    }
  };

  const handleRestart = async (ss: StatefulSet) => {
    setActionLoading(`restart-${ss.namespace}-${ss.name}`);
    try {
      await kubernetesApi.executeKubectl({
        command: `rollout restart statefulset ${ss.name} -n ${ss.namespace}`,
      });
      toast.success('StatefulSet restarted', `${ss.name} is restarting`);
      onRefresh();
    } catch (error) {
      toast.error('Restart failed', `Failed to restart ${ss.name}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (data.length === 0) {
    return <EmptyState icon={ServerStackIcon} title={searchQuery ? "No matching statefulsets" : "No statefulsets found"} />;
  }

  return (
    <>
      {/* Status Filter */}
      <StatusFilter options={statefulSetFilterOptions} selected={statusFilter} onChange={setStatusFilter} />

      {filteredData.length === 0 ? (
        <EmptyState icon={ServerStackIcon} title="No statefulsets match filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8"></th>
                <SortableHeader<StatefulSet> label="Name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader<StatefulSet> label="Namespace" sortKey="namespace" sortConfig={sortConfig} onSort={handleSort} />
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ready</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Image</th>
                <SortableHeader<StatefulSet> label="Age" sortKey="age" sortConfig={sortConfig} onSort={handleSort} />
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredData.map((ss, index) => {
                const isExpanded = expandedRow === `${ss.namespace}-${ss.name}`;
                const rowKey = `${ss.namespace}-${ss.name}`;
                return (
                  <>
                    <motion.tr
                      key={rowKey}
                      custom={index}
                      variants={tableRowVariants}
                      initial="hidden"
                      animate="visible"
                      className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                          className="p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                          )}
                        </motion.button>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{ss.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                          {ss.namespace}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                          ss.ready_replicas === ss.replicas
                            ? 'bg-success-500/10 text-success-600 dark:text-success-400 ring-success-500/20'
                            : 'bg-warning-500/10 text-warning-600 dark:text-warning-400 ring-warning-500/20'
                        }`}>
                          {ss.ready_replicas}/{ss.replicas}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm truncate max-w-xs font-mono">{ss.image?.split('/').pop() || '-'}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{ss.age}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setScaleModal({ ss, replicas: ss.replicas })}
                            className="p-2 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="Scale"
                          >
                            <ScaleIcon className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleRestart(ss)}
                            disabled={actionLoading === `restart-${ss.namespace}-${ss.name}`}
                            className="p-2 rounded-xl text-gray-500 hover:text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors disabled:opacity-50"
                            title="Restart"
                          >
                            {actionLoading === `restart-${ss.namespace}-${ss.name}` ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowPathIcon className="h-4 w-4" />
                            )}
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setYamlModal({ namespace: ss.namespace, name: ss.name })}
                            className="p-2 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                            title="View YAML"
                          >
                            <CodeBracketIcon className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          key={`${rowKey}-details`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <td colSpan={7} className="p-0">
                            <div className="px-6 py-4 bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Full Image Path</h4>
                                  <p className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all bg-gray-100 dark:bg-slate-700 p-2 rounded-xl">
                                    {ss.image || '-'}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Labels</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {ss.labels && Object.keys(ss.labels).length > 0 ? (
                                      Object.entries(ss.labels).slice(0, 4).map(([key, value]) => (
                                        <span key={key} className="px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-mono">
                                          {key.split('/').pop()}={String(value).length > 15 ? String(value).slice(0, 15) + '...' : value}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-sm text-gray-400">No labels</span>
                                    )}
                                    {ss.labels && Object.keys(ss.labels).length > 4 && (
                                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-slate-700 text-gray-500">
                                        +{Object.keys(ss.labels).length - 4} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Replica Status</h4>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Replicas:</span>
                                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{ss.replicas}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Ready:</span>
                                      <span className={`text-sm font-semibold ${ss.ready_replicas === ss.replicas ? 'text-success-600 dark:text-success-400' : 'text-warning-600 dark:text-warning-400'}`}>
                                        {ss.ready_replicas}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">Service:</span>
                                      <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{ss.name}-headless</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Scale Modal - Using reusable component */}
      {scaleModal && (
        <ScaleModal
          isOpen={!!scaleModal}
          onClose={() => setScaleModal(null)}
          resourceName={scaleModal.ss.name}
          resourceType="StatefulSet"
          namespace={scaleModal.ss.namespace}
          currentReplicas={scaleModal.ss.replicas}
          onScale={async (replicas) => {
            await handleScale(scaleModal.ss, replicas);
          }}
          isLoading={actionLoading !== null}
        />
      )}

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="statefulset"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function DaemonSetsTable({ data, searchQuery, onRefresh }: { data: DaemonSet[]; searchQuery: string; onRefresh?: () => void }) {
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);

  const filteredData = data.filter(ds =>
    ds.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ds.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ds.image?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filteredData.length === 0) {
    return <EmptyState icon={CpuChipIcon} title={searchQuery ? "No matching daemonsets" : "No daemonsets found"} />;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Desired</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ready</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Available</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Image</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filteredData.map((ds, index) => (
              <motion.tr
                key={`${ds.namespace}-${ds.name}`}
                custom={index}
                variants={tableRowVariants}
                initial="hidden"
                animate="visible"
                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{ds.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    {ds.namespace}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{ds.desired}</td>
                <td className="py-3 px-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                    ds.ready === ds.desired
                      ? 'bg-success-500/10 text-success-600 dark:text-success-400 ring-success-500/20'
                      : 'bg-warning-500/10 text-warning-600 dark:text-warning-400 ring-warning-500/20'
                  }`}>
                    {ds.ready}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{ds.available}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm truncate max-w-xs font-mono">{ds.image?.split('/').pop() || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{ds.age}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setYamlModal({ namespace: ds.namespace, name: ds.name })}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="View/Edit YAML"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 rounded-xl text-gray-500 hover:text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors"
                      title="Restart"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="daemonset"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function JobsTable({ data, searchQuery, onRefresh }: { data: Job[]; searchQuery: string; onRefresh?: () => void }) {
  const toast = useToast();
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);
  const [logsModal, setLogsModal] = useState<{ job: Job; pods: Pod[] } | null>(null);
  const [selectedPodForLogs, setSelectedPodForLogs] = useState<Pod | null>(null);
  const [deleteModal, setDeleteModal] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingPods, setLoadingPods] = useState(false);

  const filteredData = data.filter(job =>
    job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.namespace.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch pods for a job
  const fetchJobPods = async (job: Job) => {
    setLoadingPods(true);
    try {
      const response = await kubernetesApi.getPods(job.namespace);
      // Filter pods that belong to this job using the job-name label
      const jobPods = response.data.filter(pod =>
        pod.labels?.['job-name'] === job.name ||
        pod.labels?.['controller-uid'] === job.labels?.['controller-uid']
      );
      setLogsModal({ job, pods: jobPods });
      if (jobPods.length > 0) {
        setSelectedPodForLogs(jobPods[0]);
      }
    } catch (error) {
      logger.error('Failed to fetch job pods', error);
      toast.error('Failed to fetch pods for this job');
    } finally {
      setLoadingPods(false);
    }
  };

  // Handle delete
  const handleDelete = async (job: Job) => {
    setDeleting(true);
    try {
      await kubernetesApi.deleteJob(job.namespace, job.name);
      toast.success(`Job ${job.name} deleted successfully`);
      setDeleteModal(null);
      onRefresh?.();
    } catch (error: any) {
      toast.error(`Failed to delete job: ${error.response?.data?.detail || error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (filteredData.length === 0) {
    return <EmptyState icon={ClockIcon} title={searchQuery ? "No matching jobs" : "No jobs found"} />;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Completions</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Succeeded</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Failed</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Duration</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filteredData.map((job, index) => (
              <motion.tr
                key={`${job.namespace}-${job.name}`}
                custom={index}
                variants={tableRowVariants}
                initial="hidden"
                animate="visible"
                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{job.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    {job.namespace}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{job.completions ?? '-'}</td>
                <td className="py-3 px-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-success-500/10 text-success-600 dark:text-success-400 ring-1 ring-success-500/20">
                    {job.succeeded}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {job.failed > 0 ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-danger-500/10 text-danger-600 dark:text-danger-400 ring-1 ring-danger-500/20">
                      {job.failed}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{job.duration || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{job.age}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setYamlModal({ namespace: job.namespace, name: job.name })}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="View/Edit YAML"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => fetchJobPods(job)}
                      disabled={loadingPods}
                      className="p-2 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50"
                      title="View Logs"
                    >
                      <DocumentTextIcon className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDeleteModal(job)}
                      className="p-2 rounded-xl text-gray-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="job"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>

      {/* Job Logs Modal */}
      <AnimatePresence>
        {logsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => { setLogsModal(null); setSelectedPodForLogs(null); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 border border-gray-200 dark:border-slate-700 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/30">
                    <DocumentTextIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Job Logs: {logsModal.job.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Namespace: {logsModal.job.namespace}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setLogsModal(null); setSelectedPodForLogs(null); }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden p-4">
                {logsModal.pods.length === 0 ? (
                  <div className="text-center py-8">
                    <CubeIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No pods found for this job</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      The job may have been completed and its pods cleaned up
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 h-full flex flex-col">
                    {/* Pod Selector */}
                    {logsModal.pods.length > 1 && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Select Pod:
                        </label>
                        <select
                          value={selectedPodForLogs?.name || ''}
                          onChange={(e) => {
                            const pod = logsModal.pods.find(p => p.name === e.target.value);
                            setSelectedPodForLogs(pod || null);
                          }}
                          className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm"
                        >
                          {logsModal.pods.map(pod => (
                            <option key={pod.name} value={pod.name}>
                              {pod.name} ({pod.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Pod Logs Viewer */}
                    {selectedPodForLogs && (
                      <div className="flex-1 min-h-0">
                        <PodLogsViewer
                          pod={selectedPodForLogs}
                          onClose={() => { setLogsModal(null); setSelectedPodForLogs(null); }}
                          defaultExpanded={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteModal(null)}
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
                <div className="p-2 rounded-xl bg-danger-100 dark:bg-danger-900/30">
                  <ExclamationTriangleIcon className="h-6 w-6 text-danger-600 dark:text-danger-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Delete Job
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <span className="font-semibold">{deleteModal.name}</span> in namespace{' '}
                <span className="font-semibold">{deleteModal.namespace}</span>?
              </p>

              <div className="flex justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDeleteModal(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDelete(deleteModal)}
                  disabled={deleting}
                  className="px-5 py-2 text-sm font-medium rounded-xl bg-danger-600 text-white hover:bg-danger-700 transition-all shadow-lg shadow-danger-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CronJobsTable({ data, searchQuery, onRefresh }: { data: CronJob[]; searchQuery: string; onRefresh?: () => void }) {
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);

  const filteredData = data.filter(cj =>
    cj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cj.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cj.schedule.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filteredData.length === 0) {
    return <EmptyState icon={CalendarIcon} title={searchQuery ? "No matching cronjobs" : "No cronjobs found"} />;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Schedule</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Suspend</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Schedule</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filteredData.map((cj, index) => (
              <motion.tr
                key={`${cj.namespace}-${cj.name}`}
                custom={index}
                variants={tableRowVariants}
                initial="hidden"
                animate="visible"
                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{cj.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    {cj.namespace}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 font-mono text-xs text-gray-600 dark:text-gray-300">
                    {cj.schedule}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                    cj.suspend
                      ? 'bg-warning-500/10 text-warning-600 dark:text-warning-400 ring-warning-500/20'
                      : 'bg-success-500/10 text-success-600 dark:text-success-400 ring-success-500/20'
                  }`}>
                    {cj.suspend ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{cj.active}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{cj.last_schedule || '-'}</td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{cj.age}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setYamlModal({ namespace: cj.namespace, name: cj.name })}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="View/Edit YAML"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="Trigger Now"
                    >
                      <PlayIcon className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 rounded-xl text-gray-500 hover:text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors"
                      title={cj.suspend ? "Resume" : "Suspend"}
                    >
                      {cj.suspend ? <PlayIcon className="h-4 w-4" /> : <StopIcon className="h-4 w-4" />}
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="cronjob"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function HPAsTable({ data, searchQuery, onRefresh }: { data: HPA[]; searchQuery: string; onRefresh?: () => void }) {
  const [yamlModal, setYamlModal] = useState<{ namespace: string; name: string } | null>(null);

  const filteredData = data.filter(hpa =>
    hpa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    hpa.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
    hpa.reference.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filteredData.length === 0) {
    return <EmptyState icon={ArrowsPointingOutIcon} title={searchQuery ? "No matching HPAs" : "No HPAs found"} />;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Namespace</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reference</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Min/Max</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Replicas</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CPU</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Age</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {filteredData.map((hpa, index) => (
              <motion.tr
                key={`${hpa.namespace}-${hpa.name}`}
                custom={index}
                variants={tableRowVariants}
                initial="hidden"
                animate="visible"
                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">{hpa.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    {hpa.namespace}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{hpa.reference}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 font-mono text-xs">
                    {hpa.min_replicas}/{hpa.max_replicas}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/20">
                    {hpa.current_replicas}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm font-mono">
                  {hpa.current_cpu || '-'} / {hpa.target_cpu || '-'}
                </td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{hpa.age}</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => setYamlModal({ namespace: hpa.namespace, name: hpa.name })}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    title="View/Edit YAML"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YAML Modal */}
      <AnimatePresence>
        {yamlModal && (
          <YAMLModal
            isOpen={!!yamlModal}
            onClose={() => setYamlModal(null)}
            resourceType="hpa"
            namespace={yamlModal.namespace}
            name={yamlModal.name}
            onRefresh={onRefresh}
          />
        )}
      </AnimatePresence>
    </>
  );
}
