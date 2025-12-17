import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  HomeIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  CloudIcon,
  CommandLineIcon,
  SparklesIcon,
  ArrowRightIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserGroupIcon,
  ChartBarIcon,
  DocumentArrowUpIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: 'navigation' | 'actions' | 'ai';
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAIChat?: () => void;
}

export default function CommandPalette({ isOpen, onClose, onOpenAIChat }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-dashboard', title: 'Go to Dashboard', icon: HomeIcon, action: () => { navigate('/'); onClose(); }, category: 'navigation', shortcut: '⇧D' },
    { id: 'nav-kubernetes', title: 'Go to Kubernetes', icon: ServerStackIcon, action: () => { navigate('/kubernetes'); onClose(); }, category: 'navigation', shortcut: '⇧K' },
    { id: 'nav-clusters', title: 'Go to Clusters', icon: CloudIcon, action: () => { navigate('/clusters'); onClose(); }, category: 'navigation', shortcut: '⇧C' },
    { id: 'nav-deploy', title: 'Go to Deploy', icon: DocumentArrowUpIcon, action: () => { navigate('/deploy'); onClose(); }, category: 'navigation' },
    { id: 'nav-security', title: 'Go to Security', icon: ShieldCheckIcon, action: () => { navigate('/security'); onClose(); }, category: 'navigation', shortcut: '⇧S' },
    { id: 'nav-metrics', title: 'Go to Metrics', icon: ChartBarIcon, action: () => { navigate('/kubernetes/metrics'); onClose(); }, category: 'navigation' },
    { id: 'nav-terminal', title: 'Open Terminal', icon: CommandLineIcon, action: () => { navigate('/kubernetes/terminal'); onClose(); }, category: 'navigation', shortcut: '⇧T' },
    { id: 'nav-profile', title: 'Go to Profile', icon: UserCircleIcon, action: () => { navigate('/profile'); onClose(); }, category: 'navigation' },
    ...(isAdmin ? [
      { id: 'nav-users', title: 'Go to User Management', icon: UserGroupIcon, action: () => { navigate('/admin/users'); onClose(); }, category: 'navigation' as const, shortcut: '⇧U' },
    ] : []),
    // Actions
    { id: 'action-deploy', title: 'Deploy YAML', description: 'Deploy resources from YAML', icon: DocumentArrowUpIcon, action: () => { navigate('/deploy'); onClose(); }, category: 'actions' },
    { id: 'action-scan', title: 'Run Security Scan', description: 'Scan cluster for vulnerabilities', icon: ShieldCheckIcon, action: () => { navigate('/security'); onClose(); }, category: 'actions' },
    { id: 'action-settings', title: 'Open Settings', description: 'Configure preferences', icon: Cog6ToothIcon, action: () => { navigate('/profile'); onClose(); }, category: 'actions' },
    { id: 'action-logout', title: 'Sign Out', description: 'Log out of NextSight AI', icon: ArrowRightOnRectangleIcon, action: () => { logout(); onClose(); }, category: 'actions' },
    // AI
    { id: 'ai-chat', title: 'Ask AI Assistant', description: 'Get help from NextSight AI', icon: SparklesIcon, action: () => { onClose(); onOpenAIChat?.(); }, category: 'ai', shortcut: '⇧A' },
    { id: 'ai-analyze', title: 'AI: Analyze Cluster', description: 'Get AI insights on your cluster', icon: SparklesIcon, action: () => { onClose(); onOpenAIChat?.(); }, category: 'ai' },
    { id: 'ai-optimize', title: 'AI: Suggest Optimizations', description: 'Get cost and performance tips', icon: SparklesIcon, action: () => { onClose(); onOpenAIChat?.(); }, category: 'ai' },
  ], [navigate, onClose, onOpenAIChat, isAdmin, logout]);

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const lowerSearch = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(lowerSearch) ||
        cmd.description?.toLowerCase().includes(lowerSearch)
    );
  }, [commands, search]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      ai: [],
      actions: [],
      navigation: [],
    };
    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'ai': return 'AI Assistant';
      case 'actions': return 'Quick Actions';
      case 'navigation': return 'Navigation';
      default: return category;
    }
  };

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm"
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-full max-w-xl"
          >
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100/50 dark:border-slate-700/50">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 rounded-md">
                  ESC
                </kbd>
              </div>

              {/* Commands List */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {filteredCommands.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No commands found
                  </div>
                ) : (
                  <>
                    {(['ai', 'actions', 'navigation'] as const).map((category) => {
                      const items = groupedCommands[category];
                      if (items.length === 0) return null;

                      return (
                        <div key={category} className="mb-4 last:mb-0">
                          <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            {getCategoryLabel(category)}
                          </div>
                          <div className="space-y-0.5">
                            {items.map((cmd) => {
                              flatIndex++;
                              const currentIndex = flatIndex;
                              const isSelected = selectedIndex === currentIndex;

                              return (
                                <motion.button
                                  key={cmd.id}
                                  onClick={cmd.action}
                                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                                    isSelected
                                      ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${
                                      isSelected
                                        ? 'bg-primary-500/20'
                                        : 'bg-gray-100 dark:bg-slate-700'
                                    }`}>
                                      <cmd.icon className="h-4 w-4" />
                                    </div>
                                    <div className="text-left">
                                      <p className="font-medium text-sm">{cmd.title}</p>
                                      {cmd.description && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                          {cmd.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {cmd.shortcut && (
                                      <kbd className="px-2 py-0.5 text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 rounded font-mono">
                                        {cmd.shortcut}
                                      </kbd>
                                    )}
                                    <ArrowRightIcon className={`h-4 w-4 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100/50 dark:border-slate-700/50 text-xs text-gray-400 dark:text-gray-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded">↵</kbd>
                    select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <SparklesIcon className="h-3.5 w-3.5" />
                  NextSight AI Command Palette
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook for command palette keyboard shortcut with global navigation
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette toggle: ⌘K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Global shortcuts only work when not in an input field
      const target = e.target as HTMLElement;
      const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (isInputField) return;

      // ⌘+Shift or Ctrl+Shift shortcuts for navigation
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        const shortcuts: Record<string, string> = {
          'd': '/',           // Dashboard
          'k': '/kubernetes', // Kubernetes
          'c': '/clusters',   // Clusters
          's': '/security',   // Security
          't': '/kubernetes/terminal', // Terminal
          'a': 'ai-chat',     // AI Chat (special handling)
          'u': '/admin/users', // Users (admin only)
        };

        const key = e.key.toLowerCase();
        const path = shortcuts[key];

        if (path) {
          e.preventDefault();
          if (path === 'ai-chat') {
            // Dispatch custom event for AI chat - will be handled by App component
            window.dispatchEvent(new CustomEvent('open-ai-chat'));
          } else {
            // Use history API for navigation
            window.dispatchEvent(new CustomEvent('navigate', { detail: { path } }));
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}
