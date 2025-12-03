import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  UserCircleIcon,
  CurrencyDollarIcon,
  CloudIcon,
  ShieldCheckIcon,
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
      { name: 'Workloads', href: '/kubernetes', icon: CubeIcon },
      { name: 'Resources', href: '/kubernetes/resources', icon: ArchiveBoxIcon },
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

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['Kubernetes']);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const toggleExpand = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const isItemActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some(child => location.pathname === child.href);
    }
    return location.pathname === item.href;
  };

  const renderNavItem = (item: NavItem, mobile = false) => {
    const isActive = isItemActive(item);
    const isExpanded = expandedItems.includes(item.name);
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleExpand(item.name)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5" />
              {item.name}
            </div>
            <svg
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children!.map(child => {
                const childActive = location.pathname === child.href;
                return (
                  <Link
                    key={child.name}
                    to={child.href}
                    onClick={mobile ? () => setSidebarOpen(false) : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                      childActive
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <child.icon className="h-4 w-4" />
                    {child.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={mobile ? () => setSidebarOpen(false) : undefined}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
        }`}
      >
        <item.icon className="h-5 w-5" />
        {item.name}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-800 shadow-xl">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100 dark:border-slate-700">
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">NexOps</span>
            <button onClick={() => setSidebarOpen(false)}>
              <XMarkIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {navigation.map(item => renderNavItem(item, true))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:block bg-white dark:bg-slate-800 border-r border-gray-100 dark:border-slate-700 transition-colors">
        <div className="flex h-16 items-center px-6 border-b border-gray-100 dark:border-slate-700">
          <span className="text-xl font-bold text-primary-600 dark:text-primary-400">NexOps Center</span>
        </div>
        <nav className="p-4 space-y-1">
          {navigation.map(item => renderNavItem(item))}
        </nav>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 h-16 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 flex items-center px-4 lg:px-8 transition-colors">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex-1 flex justify-end items-center gap-4">
            {/* Cluster Switcher */}
            <ClusterSwitcher />
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? (
                <MoonIcon className="h-5 w-5 text-gray-600" />
              ) : (
                <SunIcon className="h-5 w-5 text-yellow-500" />
              )}
            </button>
            {/* User info and logout */}
            {user && (
              <div className="flex items-center gap-3 border-l border-gray-200 dark:border-slate-600 pl-4">
                <div className="flex items-center gap-2">
                  <UserCircleIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {user.username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {user.role}
                    </p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Sign out"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
