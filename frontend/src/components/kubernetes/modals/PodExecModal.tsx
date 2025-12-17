import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';
import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  XMarkIcon,
  CommandLineIcon,
  SignalIcon,
  SignalSlashIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../../../contexts/ToastContext';
import type { Pod } from '../../../types';

interface PodExecModalProps {
  isOpen: boolean;
  onClose: () => void;
  pod: Pod;
}

const shells = ['/bin/bash', '/bin/sh', '/bin/ash', '/bin/zsh'];
const debugImages = [
  { value: 'busybox:latest', label: 'BusyBox (minimal)' },
  { value: 'alpine:latest', label: 'Alpine (with apk)' },
  { value: 'nicolaka/netshoot:latest', label: 'Netshoot (network debug)' },
  { value: 'ubuntu:latest', label: 'Ubuntu (full)' },
];

export function PodExecModal({ isOpen, onClose, pod }: PodExecModalProps) {
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
  const hasConnectedRef = useRef(false);

  // Initialize container selection and reset debug state
  useEffect(() => {
    if (isOpen && pod.containers && pod.containers.length > 0) {
      setSelectedContainer(pod.containers[0]);
      setIsDistroless(false);
      setDebugMode(false);
      shellFailCountRef.current = 0;
    }
  }, [isOpen, pod]);

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!isOpen || !terminalRef.current) return;

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

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
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

  const connectWebSocket = useCallback(() => {
    if (!xtermRef.current || !selectedContainer) return;

    const terminal = xtermRef.current;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('connecting');

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

      ws.send(JSON.stringify({
        type: 'resize',
        cols: terminal.cols,
        rows: terminal.rows,
      }));

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

          if (!debugMode && (
            outputBuffer.includes('executable file not found') ||
            outputBuffer.includes('OCI runtime exec failed') ||
            outputBuffer.includes('no such file or directory') ||
            outputBuffer.includes('exit code 127')
          )) {
            shellFailCountRef.current++;

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
        terminal.write(event.data);
      }
    };

    ws.onerror = () => {
      terminal.writeln('');
      terminal.writeln('\x1b[31m✗ Connection error\x1b[0m');
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      setConnectionStatus(prev => prev === 'error' ? 'error' : 'disconnected');
    };

    return () => {
      if (inputHandler) {
        inputHandler.dispose();
      }
    };
  }, [selectedContainer, selectedShell, debugMode, debugImage, pod.namespace, pod.name]);

  useEffect(() => {
    if (isOpen && selectedContainer && xtermRef.current && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connectWebSocket();
    }

    if (!isOpen) {
      hasConnectedRef.current = false;
    }
  }, [isOpen, selectedContainer, connectWebSocket]);

  const handleShellChange = (shell: string) => {
    setSelectedShell(shell);
    setTimeout(() => {
      if (xtermRef.current) {
        connectWebSocket();
      }
    }, 100);
  };

  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 300);
    }
  }, [isExpanded]);

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
