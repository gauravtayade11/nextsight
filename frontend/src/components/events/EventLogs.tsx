import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { kubernetesApi } from '../../services/api';
import PageHeader from '../common/PageHeader';
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  CubeIcon,
  ServerIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
  DocumentTextIcon,
  PlayIcon,
  PauseIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

// Import shared constants
import { containerVariants, itemVariants, formatAge } from '../../utils/constants';

// Types
interface K8sEvent {
  uid: string;
  name: string;
  namespace: string;
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  count: number;
  first_timestamp: string;
  last_timestamp: string;
  involved_object: {
    kind: string;
    name: string;
    namespace?: string;
  };
  source?: {
    component: string;
    host?: string;
  };
}

// Severity configuration
const severityConfig = {
  Warning: {
    icon: ExclamationTriangleIcon,
    color: 'text-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-200/50 dark:border-amber-800/50',
  },
  Normal: {
    icon: InformationCircleIcon,
    color: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-200/50 dark:border-blue-800/50',
  },
  Error: {
    icon: ExclamationCircleIcon,
    color: 'text-red-500',
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-200/50 dark:border-red-800/50',
  },
};

// Time formatting
function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

// Event Card Component
function EventCard({
  event,
  isExpanded,
  onToggle,
  index,
}: {
  event: K8sEvent;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const config = severityConfig[event.type] || severityConfig.Normal;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border ${config.border} shadow-sm overflow-hidden transition-all duration-200`}
    >
      <div
        className="px-4 py-3 cursor-pointer hover:bg-white/90 dark:hover:bg-slate-700/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${config.bg}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.color}`}>
                {event.type}
              </span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{event.reason}</span>
              {event.count > 1 && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-100/80 dark:bg-slate-700/80 text-gray-600 dark:text-gray-400 rounded-full">
                  x{event.count}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-900 dark:text-white line-clamp-2">{event.message}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <CubeIcon className="h-3.5 w-3.5" />
                {event.involved_object.kind}/{event.involved_object.name}
              </span>
              <span className="flex items-center gap-1">
                <ServerIcon className="h-3.5 w-3.5" />
                {event.namespace}
              </span>
              <span className="flex items-center gap-1">
                <ClockIcon className="h-3.5 w-3.5" />
                {formatTimeAgo(event.last_timestamp)}
              </span>
            </div>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            {isExpanded ? (
              <ChevronDownIcon className="h-5 w-5" />
            ) : (
              <ChevronRightIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 border-t border-gray-100/50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/50">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Full Message</p>
                  <p className="text-gray-900 dark:text-white">{event.message}</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">First Seen</p>
                    <p className="text-gray-900 dark:text-white">{formatTimestamp(event.first_timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Seen</p>
                    <p className="text-gray-900 dark:text-white">{formatTimestamp(event.last_timestamp)}</p>
                  </div>
                  {event.source && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Source</p>
                      <p className="text-gray-900 dark:text-white">
                        {event.source.component}
                        {event.source.host && ` (${event.source.host})`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Filter Badge Component
function FilterBadge({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 dark:hover:text-blue-200 transition-colors">
        <XMarkIcon className="h-3 w-3" />
      </button>
    </span>
  );
}

// Stats Card Component
function StatsCard({
  title,
  value,
  icon: Icon,
  color,
  index,
}: {
  title: string;
  value: number;
  icon: typeof InformationCircleIcon;
  color: 'blue' | 'yellow' | 'red' | 'green';
  index: number;
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-slate-700/50 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Main Component
export default function EventLogs() {
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Normal' | 'Warning'>('all');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load namespaces
  useEffect(() => {
    kubernetesApi.getNamespaces().then((res) => {
      if (res.data) {
        setNamespaces(res.data.map((ns: { name: string }) => ns.name));
      }
    });
  }, []);

  // Load events
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = namespaceFilter !== 'all' ? { namespace: namespaceFilter } : {};
      const res = await kubernetesApi.getEvents(params);

      if (res.data) {
        // Transform API response to our format
        const transformedEvents: K8sEvent[] = res.data.map((event: any) => ({
          uid: event.name + event.namespace,
          name: event.name,
          namespace: event.namespace,
          type: event.type || 'Normal',
          reason: event.reason,
          message: event.message,
          count: event.count || 1,
          first_timestamp: event.first_timestamp || new Date().toISOString(),
          last_timestamp: event.last_timestamp || new Date().toISOString(),
          involved_object: event.involved_object || { kind: 'Unknown', name: 'Unknown' },
          source: event.source,
        }));

        // Sort by last timestamp descending
        transformedEvents.sort((a, b) =>
          new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime()
        );

        setEvents(transformedEvents);
      }
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [namespaceFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadEvents, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadEvents]);

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (typeFilter !== 'all' && event.type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        event.message.toLowerCase().includes(query) ||
        event.reason.toLowerCase().includes(query) ||
        event.involved_object.name.toLowerCase().includes(query) ||
        event.namespace.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Calculate stats
  const stats = {
    total: events.length,
    normal: events.filter((e) => e.type === 'Normal').length,
    warning: events.filter((e) => e.type === 'Warning').length,
    lastHour: events.filter((e) => {
      const hourAgo = new Date();
      hourAgo.setHours(hourAgo.getHours() - 1);
      return new Date(e.last_timestamp) > hourAgo;
    }).length,
  };

  // Toggle event expansion
  const toggleEvent = (uid: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  // Clear filters
  const hasActiveFilters = typeFilter !== 'all' || namespaceFilter !== 'all' || searchQuery !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Event Logs"
        description="Real-time Kubernetes cluster events and notifications"
        icon={BellAlertIcon}
        iconColor="purple"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                autoRefresh
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-500/25'
                  : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {autoRefresh ? (
                <>
                  <PauseIcon className="h-4 w-4" />
                  <span>Live</span>
                  <span className="ml-1 h-2 w-2 rounded-full bg-white animate-pulse" />
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4" />
                  <span>Auto-refresh</span>
                </>
              )}
            </button>
            <button
              onClick={loadEvents}
              disabled={loading}
              className="p-2.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-all disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard title="Total Events" value={stats.total} icon={DocumentTextIcon} color="blue" index={0} />
        <StatsCard title="Normal" value={stats.normal} icon={InformationCircleIcon} color="green" index={1} />
        <StatsCard title="Warnings" value={stats.warning} icon={ExclamationTriangleIcon} color="yellow" index={2} />
        <StatsCard title="Last Hour" value={stats.lastHour} icon={ClockIcon} color="blue" index={3} />
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-700/50 p-4 shadow-sm"
      >
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search events by message, reason, resource..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/80 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700/50 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'Normal' | 'Warning')}
            className="px-4 py-2.5 bg-gray-50/80 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700/50 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="all">All Types</option>
            <option value="Normal">Normal</option>
            <option value="Warning">Warning</option>
          </select>

          {/* Namespace Filter */}
          <select
            value={namespaceFilter}
            onChange={(e) => setNamespaceFilter(e.target.value)}
            className="px-4 py-2.5 bg-gray-50/80 dark:bg-slate-900/50 border border-gray-200/50 dark:border-slate-700/50 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="all">All Namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>

        {/* Active Filters */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100/50 dark:border-slate-700/50"
            >
              <FunnelIcon className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Active filters:</span>
              {typeFilter !== 'all' && (
                <FilterBadge label={`Type: ${typeFilter}`} onRemove={() => setTypeFilter('all')} />
              )}
              {namespaceFilter !== 'all' && (
                <FilterBadge label={`Namespace: ${namespaceFilter}`} onRemove={() => setNamespaceFilter('all')} />
              )}
              {searchQuery && (
                <FilterBadge label={`Search: "${searchQuery}"`} onRemove={() => setSearchQuery('')} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>
          Showing {filteredEvents.length} of {events.length} events
        </span>
        <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
      </div>

      {/* Events List */}
      {error ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50/80 dark:bg-red-900/30 backdrop-blur-sm border border-red-200/50 dark:border-red-800/50 rounded-xl p-4 text-red-700 dark:text-red-400"
        >
          <p>{error}</p>
          <button onClick={loadEvents} className="mt-2 text-sm underline hover:no-underline">
            Retry
          </button>
        </motion.div>
      ) : loading && events.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-gray-500">
            <ArrowPathIcon className="h-5 w-5 animate-spin" />
            <span>Loading events...</span>
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-700/50 p-8 text-center"
        >
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No events found</p>
          {hasActiveFilters && (
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
          )}
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event, index) => (
            <EventCard
              key={event.uid}
              event={event}
              isExpanded={expandedEvents.has(event.uid)}
              onToggle={() => toggleEvent(event.uid)}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
