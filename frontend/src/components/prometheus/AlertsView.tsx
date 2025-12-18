import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BellAlertIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  FireIcon,
  ClockIcon,
  XMarkIcon,
  ArrowPathIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  BellSlashIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { prometheusApi, getSeverityColor, getRelativeTime } from '../../services/prometheusApi';
import { logger } from '../../utils/logger';
import type { Alert, AlertGroup, Silence, SilenceCreate, AlertsResponse, RulesResponse, SilencesResponse } from '../../types/prometheus';

interface SilenceModalProps {
  alert: Alert;
  onClose: () => void;
  onSilence: (silence: SilenceCreate) => void;
}

const SilenceModal = ({ alert, onClose, onSilence }: SilenceModalProps) => {
  const [duration, setDuration] = useState('2h');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const now = new Date();
    const durationMs = parseDurationToMs(duration);
    const endsAt = new Date(now.getTime() + durationMs);

    const silence: SilenceCreate = {
      matchers: Object.entries(alert.labels).map(([name, value]) => ({
        name,
        value,
        isRegex: false,
      })),
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      created_by: 'NextSight AI User',
      comment: comment || `Silenced from NextSight AI at ${now.toLocaleString()}`,
    };

    await onSilence(silence);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Silence Alert
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Alert
            </label>
            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white">
                {alert.labels.alertname}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {alert.annotations.summary || alert.annotations.description}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white"
            >
              <option value="30m">30 minutes</option>
              <option value="1h">1 hour</option>
              <option value="2h">2 hours</option>
              <option value="4h">4 hours</option>
              <option value="8h">8 hours</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Comment
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Reason for silencing..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              Silence
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const parseDurationToMs = (duration: string): number => {
  const match = duration.match(/^(\d+)(m|h|d)$/);
  if (!match) return 2 * 60 * 60 * 1000; // Default 2h
  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 3600000);
};

const severityIcon = (severity: string) => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return <FireIcon className="h-5 w-5 text-red-500" />;
    case 'warning':
      return <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />;
    default:
      return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
  }
};

export default function AlertsView() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [ruleGroups, setRuleGroups] = useState<AlertGroup[]>([]);
  const [silences, setSilences] = useState<Silence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'alerts' | 'rules' | 'silences'>('alerts');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('firing');
  const [silenceModal, setSilenceModal] = useState<Alert | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, rulesRes, silencesRes] = await Promise.all([
        prometheusApi.getAlerts(),
        prometheusApi.getRules(),
        prometheusApi.getSilences(),
      ]);

      setAlerts((alertsRes.data as AlertsResponse).alerts || []);
      setRuleGroups((rulesRes.data as RulesResponse).groups || []);
      setSilences((silencesRes.data as SilencesResponse).silences || []);
      setError(null);
    } catch (err: unknown) {
      logger.error('Failed to fetch alert data', err);
      setError('Failed to load alert data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSilence = async (silence: SilenceCreate) => {
    try {
      await prometheusApi.createSilence(silence);
      setSilenceModal(null);
      fetchData();
    } catch (err) {
      logger.error('Failed to create silence', err);
    }
  };

  const handleDeleteSilence = async (silenceId: string) => {
    try {
      await prometheusApi.deleteSilence(silenceId);
      fetchData();
    } catch (err) {
      logger.error('Failed to delete silence', err);
    }
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = searchQuery === '' ||
      alert.labels.alertname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.annotations.summary?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === 'all' ||
      alert.labels.severity?.toLowerCase() === severityFilter;

    const matchesState = stateFilter === 'all' ||
      alert.state === stateFilter;

    return matchesSearch && matchesSeverity && matchesState;
  });

  // Count alerts by severity
  const alertCounts = {
    critical: alerts.filter(a => a.labels.severity === 'critical' && a.state === 'firing').length,
    warning: alerts.filter(a => a.labels.severity === 'warning' && a.state === 'firing').length,
    info: alerts.filter(a => a.labels.severity === 'info' && a.state === 'firing').length,
    pending: alerts.filter(a => a.state === 'pending').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BellAlertIcon className="h-7 w-7 text-purple-500" />
            Alerts & Rules
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor active alerts, manage rules, and configure silences
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20"
        >
          <div className="flex items-center gap-3">
            <FireIcon className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{alertCounts.critical}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Critical</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20"
        >
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{alertCounts.warning}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Warning</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20"
        >
          <div className="flex items-center gap-3">
            <InformationCircleIcon className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{alertCounts.info}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Info</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20"
        >
          <div className="flex items-center gap-3">
            <ClockIcon className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{alertCounts.pending}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-200 dark:border-slate-700">
        {[
          { id: 'alerts', label: 'Active Alerts', icon: BellAlertIcon, count: filteredAlerts.length },
          { id: 'rules', label: 'Alert Rules', icon: ExclamationTriangleIcon, count: ruleGroups.reduce((acc, g) => acc + g.rules.length, 0) },
          { id: 'silences', label: 'Silences', icon: BellSlashIcon, count: silences.filter(s => s.status?.state === 'active').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id as 'alerts' | 'rules' | 'silences')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              view === tab.id
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              view === tab.id
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      {view === 'alerts' && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alerts..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>

            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white text-sm"
            >
              <option value="all">All States</option>
              <option value="firing">Firing</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Alerts List */}
      {view === 'alerts' && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredAlerts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <CheckCircleIcon className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-white">All Clear!</p>
                <p className="text-gray-500 dark:text-gray-400">No active alerts matching your filters</p>
              </motion.div>
            ) : (
              filteredAlerts.map((alert, index) => (
                <motion.div
                  key={alert.fingerprint || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-xl border ${
                    alert.state === 'firing'
                      ? alert.labels.severity === 'critical'
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50'
                        : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50'
                      : 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {severityIcon(alert.labels.severity || 'info')}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {alert.labels.alertname}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            alert.state === 'firing'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                          }`}>
                            {alert.state}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(alert.labels.severity || 'info')}`}>
                            {alert.labels.severity || 'info'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {alert.annotations.summary || alert.annotations.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {alert.labels.namespace && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 rounded text-gray-600 dark:text-gray-400">
                              ns: {alert.labels.namespace}
                            </span>
                          )}
                          {alert.labels.pod && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 rounded text-gray-600 dark:text-gray-400">
                              pod: {alert.labels.pod}
                            </span>
                          )}
                          {alert.labels.instance && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 rounded text-gray-600 dark:text-gray-400">
                              {alert.labels.instance}
                            </span>
                          )}
                          {alert.active_at && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Active {getRelativeTime(alert.active_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSilenceModal(alert)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                    >
                      <BellSlashIcon className="h-4 w-4" />
                      Silence
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Rules View */}
      {view === 'rules' && (
        <div className="space-y-4">
          {ruleGroups.map((group) => (
            <div key={group.name} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleGroup(group.name)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  {expandedGroups.has(group.name) ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">{group.name}</span>
                  <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                    {group.rules.length} rules
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{group.file}</span>
              </button>

              <AnimatePresence>
                {expandedGroups.has(group.name) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-gray-200 dark:divide-slate-700">
                      {group.rules.map((rule, idx) => (
                        <div key={idx} className="p-4 bg-white dark:bg-slate-800">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 dark:text-white">{rule.name}</h4>
                                {rule.state && (
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    rule.state === 'firing'
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                      : rule.state === 'pending'
                                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                                      : 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                  }`}>
                                    {rule.state}
                                  </span>
                                )}
                                {rule.labels.severity && (
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(rule.labels.severity)}`}>
                                    {rule.labels.severity}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {rule.annotations.summary || rule.annotations.description}
                              </p>
                              <code className="block mt-2 p-2 bg-gray-50 dark:bg-slate-900/50 rounded text-xs text-gray-600 dark:text-gray-400 font-mono">
                                {rule.query}
                              </code>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>For: {rule.duration}</span>
                                {rule.alerts.length > 0 && (
                                  <span className="text-red-500">{rule.alerts.length} firing</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Silences View */}
      {view === 'silences' && (
        <div className="space-y-3">
          {silences.length === 0 ? (
            <div className="text-center py-12">
              <BellSlashIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">No Active Silences</p>
              <p className="text-gray-500 dark:text-gray-400">Silence alerts from the Active Alerts tab</p>
            </div>
          ) : (
            silences.map((silence) => (
              <motion.div
                key={silence.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border ${
                  silence.status?.state === 'active'
                    ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/50'
                    : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <BellSlashIcon className="h-5 w-5 text-purple-500" />
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        silence.status?.state === 'active'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-600'
                      }`}>
                        {silence.status?.state || 'unknown'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {silence.comment}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {silence.matchers.map((m, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-slate-700 rounded text-gray-600 dark:text-gray-400">
                          {m.name}={m.value}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>By: {silence.created_by}</span>
                      <span>Ends: {new Date(silence.ends_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {silence.status?.state === 'active' && (
                    <button
                      onClick={() => handleDeleteSilence(silence.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Silence Modal */}
      {silenceModal && (
        <SilenceModal
          alert={silenceModal}
          onClose={() => setSilenceModal(null)}
          onSilence={handleSilence}
        />
      )}
    </div>
  );
}
