import { useState, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  RocketLaunchIcon,
  Bars3Icon,
  XMarkIcon,
  CpuChipIcon,
  ServerIcon,
  CubeIcon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  CommandLineIcon,
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
  CurrencyDollarIcon,
  CloudIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import ClusterSwitcher from './ClusterSwitcher';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  {
    name: 'Kubernetes',
    href: '/kubernetes',
    icon: ServerStackIcon,
    children: [
      { name: 'Resources', href: '/kubernetes', icon: ArchiveBoxIcon },
      { name: 'Nodes', href: '/kubernetes/nodes', icon: ServerIcon },
      { name: 'Metrics', href: '/kubernetes/metrics', icon: CpuChipIcon },
      { name: 'Deploy', href: '/kubernetes/deploy', icon: DocumentTextIcon },
      { name: 'Terminal', href: '/kubernetes/terminal', icon: CommandLineIcon },
    ]
  },
  { name: 'Clusters', href: '/clusters', icon: CloudIcon },
  { name: 'Helm', href: '/helm', icon: CubeIcon },
  { name: 'Cost', href: '/cost', icon: CurrencyDollarIcon },
  { name: 'Security', href: '/security', icon: ShieldCheckIcon },
  { name: 'Incidents', href: '/incidents', icon: ExclamationTriangleIcon },
  { name: 'Timeline', href: '/timeline', icon: ClockIcon },
  { name: 'Self-Service', href: '/selfservice', icon: WrenchScrewdriverIcon },
  { name: 'Releases', href: '/releases', icon: RocketLaunchIcon },
];

// Animation variants
const sidebarVariants = {
  hidden: { x: -280, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 }
  },
  exit: {
    x: -280,
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

const childrenVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto' as const,
    transition: { duration: 0.3, ease: 'easeOut' as const }
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.2 }
  }
};

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['Kubernetes']);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  // Auto-scroll to item when expanding/collapsing
  const scrollToItem = useCallback((itemName: string, navElement: HTMLElement | null) => {
    if (!navElement) return;

    setTimeout(() => {
      const itemElement = navElement.querySelector(`[data-nav-item="${itemName}"]`);
      if (itemElement) {
        itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }, []);

  const toggleExpand = (name: string, isMobile = false) => {
    const isExpanding = !expandedItems.includes(name);
    setExpandedItems(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );

    // Auto-scroll when expanding
    if (isExpanding) {
      scrollToItem(name, isMobile ? mobileNavRef.current : navRef.current);
    }
  };

  const isItemActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some(child => location.pathname === child.href);
    }
    return location.pathname === item.href;
  };

  const renderNavItem = (item: NavItem, _index: number, mobile = false, collapsed = false) => {
    const isActive = isItemActive(item);
    const isExpanded = expandedItems.includes(item.name);
    const hasChildren = item.children && item.children.length > 0;
    const isHovered = hoveredItem === item.name;

    // Collapsed sidebar view
    if (collapsed && !mobile) {
      // For items with children, clicking expands the sidebar
      if (hasChildren) {
        return (
          <div key={item.name} className="relative">
            <button
              onClick={() => {
                setSidebarCollapsed(false);
                if (!expandedItems.includes(item.name)) {
                  toggleExpand(item.name, false);
                }
              }}
              onMouseEnter={() => setHoveredItem(item.name)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`w-full relative flex items-center justify-center p-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/5'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {/* Indicator for expandable items */}
              <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary-500" />
              {/* Tooltip */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: 10, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 10, scale: 0.95 }}
                    className="absolute left-full ml-3 px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-lg whitespace-nowrap z-50 shadow-xl"
                  >
                    <div className="flex items-center gap-2">
                      {item.name}
                      <span className="text-[10px] text-gray-400">Click to expand</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        );
      }

      // For items without children, regular link
      return (
        <div key={item.name} className="relative">
          <Link
            to={item.href}
            onMouseEnter={() => setHoveredItem(item.name)}
            onMouseLeave={() => setHoveredItem(null)}
            className={`relative flex items-center justify-center p-3 rounded-xl transition-all duration-200 group ${
              isActive
                ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            <item.icon className="h-5 w-5" />
            {/* Tooltip */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, x: 10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10, scale: 0.95 }}
                  className="absolute left-full ml-3 px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-lg whitespace-nowrap z-50 shadow-xl"
                >
                  {item.name}
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </div>
      );
    }

    // Full sidebar view
    if (hasChildren) {
      return (
        <div key={item.name} data-nav-item={item.name}>
          <motion.button
            whileHover={{ x: 2 }}
            onClick={() => toggleExpand(item.name, mobile)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-primary-600 dark:text-primary-400 font-medium'
                : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-primary-500/20' : 'bg-gray-100 dark:bg-slate-700/50'}`}>
                <item.icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{item.name}</span>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDownIcon className="h-4 w-4" />
            </motion.div>
          </motion.button>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                variants={childrenVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="ml-4 mt-1 space-y-0.5 overflow-hidden"
              >
                {item.children!.map((child, childIndex) => {
                  const childActive = location.pathname === child.href;
                  return (
                    <motion.div
                      key={child.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: childIndex * 0.03 }}
                    >
                      <Link
                        to={child.href}
                        onClick={mobile ? () => setSidebarOpen(false) : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                          childActive
                            ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium border-l-2 border-primary-500'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-white/30 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        <child.icon className="h-4 w-4" />
                        {child.name}
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <motion.div key={item.name} whileHover={{ x: 2 }}>
        <Link
          to={item.href}
          onClick={mobile ? () => setSidebarOpen(false) : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
            isActive
              ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/10 text-primary-600 dark:text-primary-400 font-medium'
              : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/5'
          }`}
        >
          <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-primary-500/20' : 'bg-gray-100 dark:bg-slate-700/50'}`}>
            <item.icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium">{item.name}</span>
        </Link>
      </motion.div>
    );
  };

  const sidebarWidth = sidebarCollapsed ? 'lg:w-20' : 'lg:w-64';
  const mainPadding = sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors">
      {/* Subtle background gradient - reduced for performance */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-50">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-400/5 dark:bg-primary-500/3 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 w-80 h-80 bg-purple-400/5 dark:bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 lg:hidden bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              variants={sidebarVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden"
            >
              <div className="flex flex-col h-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm shadow-lg border-r border-gray-200/50 dark:border-slate-700/50">
                {/* Header */}
                <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100/50 dark:border-slate-700/50 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
                      <span className="text-white font-bold text-sm">N</span>
                    </div>
                    <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                      NexOps
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100/50 dark:hover:bg-slate-700/50"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </motion.button>
                </div>

                {/* Scrollable Nav */}
                <nav
                  ref={mobileNavRef}
                  className="flex-1 overflow-y-auto p-4 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth"
                >
                  {navigation.map((item, index) => renderNavItem(item, index, true))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100/50 dark:border-slate-700/50 flex-shrink-0">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-primary-500/10 via-purple-500/10 to-pink-500/10 border border-primary-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <SparklesIcon className="h-4 w-4 text-primary-500" />
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">NexOps</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">v1.2.0</span>
                      <span className="flex items-center gap-1 text-[10px] text-success-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                        Latest
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.div
        className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block ${sidebarWidth}`}
        animate={{ width: sidebarCollapsed ? 80 : 256 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <div className="flex flex-col h-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-r border-gray-200/50 dark:border-slate-700/50 shadow-lg transition-colors">
          {/* Header */}
          <div className="flex h-16 items-center px-4 border-b border-gray-100/50 dark:border-slate-700/50 flex-shrink-0">
            <div className="flex items-center gap-3 flex-1">
              <motion.div
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30 flex-shrink-0"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <span className="text-white font-bold text-lg">N</span>
              </motion.div>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden"
                  >
                    <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent whitespace-nowrap">
                      NexOps
                    </span>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wider uppercase whitespace-nowrap">
                      Command Center
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Scrollable Nav */}
          <nav
            ref={navRef}
            className="flex-1 overflow-y-auto p-3 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth"
          >
            {navigation.map((item, index) => renderNavItem(item, index, false, sidebarCollapsed))}
          </nav>

          {/* Footer with collapse toggle */}
          <div className="p-3 border-t border-gray-100/50 dark:border-slate-700/50 flex-shrink-0 space-y-2">
            {/* Collapse toggle button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-gray-100/50 dark:bg-slate-700/30 hover:bg-gray-200/50 dark:hover:bg-slate-600/30 text-gray-500 dark:text-gray-400 transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeftIcon className="h-4 w-4" />
                  <span className="text-xs">Collapse</span>
                </>
              )}
            </motion.button>

            {/* Version info - only show when expanded */}
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-primary-500/10 via-purple-500/10 to-pink-500/10 border border-primary-500/20 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4 text-primary-500" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">NexOps</span>
                      </div>
                      <motion.button
                        whileHover={{ rotate: 180 }}
                        transition={{ duration: 0.3 }}
                        className="p-1 rounded-md hover:bg-white/50 dark:hover:bg-slate-700/50"
                        title="Check for updates"
                      >
                        <ArrowPathIcon className="h-3 w-3 text-gray-400" />
                      </motion.button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">v1.2.0</span>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success-500/10 text-[10px] text-success-600 dark:text-success-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                        Up to date
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <motion.div
        className={mainPadding}
        animate={{ paddingLeft: sidebarCollapsed ? 80 : 256 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{ paddingLeft: undefined }} // Let className handle initial state
      >
        {/* Modern Top bar with glassmorphism */}
        <div className="sticky top-0 z-40 h-16">
          {/* Glassmorphic background */}
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/30 dark:border-slate-700/30 shadow-lg shadow-gray-200/20 dark:shadow-slate-900/50" />

          {/* Gradient accent line at top */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 opacity-80" />

          {/* Content */}
          <div className="relative h-full flex items-center px-4 lg:px-8">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-500/10 to-purple-500/10 hover:from-primary-500/20 hover:to-purple-500/20 border border-primary-500/20 transition-all duration-300"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">Menu</span>
            </motion.button>

            <div className="flex-1 flex justify-end items-center gap-4">
              {/* Cluster Switcher */}
              <ClusterSwitcher />

              {/* Dark mode toggle - Modern pill style */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className="relative p-2.5 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-slate-700 dark:to-slate-800 hover:from-gray-200 hover:to-gray-100 dark:hover:from-slate-600 dark:hover:to-slate-700 transition-all duration-300 border border-gray-200/50 dark:border-slate-600/50 shadow-sm hover:shadow-md"
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                <AnimatePresence mode="wait">
                  {theme === 'light' ? (
                    <motion.div
                      key="moon"
                      initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.2 }}
                    >
                      <MoonIcon className="h-5 w-5 text-slate-600" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="sun"
                      initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.2 }}
                    >
                      <SunIcon className="h-5 w-5 text-amber-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* User info and logout - Modern card style */}
              {user && (
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200/50 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    {/* Avatar with status indicator */}
                    <div className="relative">
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-primary-500/30"
                      >
                        <span className="text-white font-bold text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </motion.div>
                      {/* Online status dot */}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success-500 rounded-full border-2 border-white dark:border-slate-900" />
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {user.username}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                        {user.role}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={logout}
                    className="p-2.5 rounded-xl bg-gray-100/50 dark:bg-slate-700/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-300 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
                    title="Sign out"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {children}
          </motion.div>
        </main>
      </motion.div>
    </div>
  );
}
