import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../../utils/logger';
import {
  Cog6ToothIcon,
  SwatchIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  BellIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import GlassCard from '../common/GlassCard';
import { settingsApi, UserSettingsResponse } from '../../services/api';

// Import shared constants
import { containerVariants, itemVariants } from '../../utils/constants';

// Tab configuration - Simplified to avoid duplication with sidebar navigation
// Clusters -> /clusters, Users -> /admin/users, API Keys -> /admin/api-keys
const tabs = [
  { id: 'themes', label: 'Themes', icon: SwatchIcon },
  { id: 'general', label: 'General', icon: WrenchScrewdriverIcon },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('themes');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data states
  const [userSettings, setUserSettings] = useState<UserSettingsResponse | null>(null);

  // Local settings state (for editing before save)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [notifications, setNotifications] = useState({
    email: true,
    slack: false,
    inApp: true,
    deployments: true,
    alerts: true,
    security: true,
  });
  const [generalSettings, setGeneralSettings] = useState({
    defaultNamespace: 'default',
    autoRefresh: true,
    refreshInterval: 30,
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
  });

  // Fetch data based on active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Only themes and general tabs remain - both use user settings
      const settingsRes = await settingsApi.getUserSettings();
      setUserSettings(settingsRes.data);
      setTheme(settingsRes.data.theme);
      setNotifications(settingsRes.data.notifications);
      setGeneralSettings({
        defaultNamespace: settingsRes.data.default_namespace,
        autoRefresh: settingsRes.data.auto_refresh,
        refreshInterval: settingsRes.data.refresh_interval_seconds,
        timezone: settingsRes.data.timezone,
        dateFormat: settingsRes.data.date_format,
      });
    } catch (err) {
      logger.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save settings
  const saveSettings = async () => {
    setSaving(true);
    try {
      await settingsApi.updateUserSettings({
        theme,
        notifications,
        default_namespace: generalSettings.defaultNamespace,
        auto_refresh: generalSettings.autoRefresh,
        refresh_interval_seconds: generalSettings.refreshInterval,
        timezone: generalSettings.timezone,
        date_format: generalSettings.dateFormat,
      });
    } catch (err) {
      logger.error('Failed to save settings', err);
    } finally {
      setSaving(false);
    }
  };

  // Reset settings
  const resetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to default values?')) return;
    try {
      const response = await settingsApi.resetUserSettings();
      setUserSettings(response.data);
      setTheme(response.data.theme);
      setNotifications(response.data.notifications);
      setGeneralSettings({
        defaultNamespace: response.data.default_namespace,
        autoRefresh: response.data.auto_refresh,
        refreshInterval: response.data.refresh_interval_seconds,
        timezone: response.data.timezone,
        dateFormat: response.data.date_format,
      });
    } catch (err) {
      logger.error('Failed to reset settings', err);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-slate-500/20 to-gray-500/20">
            <Cog6ToothIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
            <p className="text-xs text-gray-500">Manage appearance and preferences</p>
          </div>
        </div>
        {(activeTab === 'themes' || activeTab === 'general') && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </motion.button>
        )}
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 pb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-lg'
                  : 'bg-white/80 dark:bg-slate-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200/50 dark:border-slate-700/50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Tab Content */}
      {!loading && (
        <AnimatePresence mode="wait">
          {/* Themes Tab */}
          {activeTab === 'themes' && (
            <motion.div
              key="themes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <GlassCard className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'light', label: 'Light', icon: SunIcon },
                    { id: 'dark', label: 'Dark', icon: MoonIcon },
                    { id: 'system', label: 'System', icon: ComputerDesktopIcon },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTheme(option.id as typeof theme)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        theme === option.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <option.icon className={`h-6 w-6 mx-auto mb-2 ${theme === option.id ? 'text-blue-500' : 'text-gray-400'}`} />
                      <p className={`text-sm font-medium ${theme === option.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {option.label}
                      </p>
                    </button>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</p>
                        <p className="text-xs text-gray-500">Receive updates via email</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setNotifications(prev => ({ ...prev, email: !prev.email }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${notifications.email ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifications.email ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BellIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">In-App Notifications</p>
                        <p className="text-xs text-gray-500">Show notifications in the app</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setNotifications(prev => ({ ...prev, inApp: !prev.inApp }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${notifications.inApp ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifications.inApp ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <motion.div
              key="general"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <GlassCard className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Default Settings</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Default Namespace</label>
                    <select
                      value={generalSettings.defaultNamespace}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, defaultNamespace: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300"
                    >
                      <option value="default">default</option>
                      <option value="production">production</option>
                      <option value="staging">staging</option>
                      <option value="development">development</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Timezone</label>
                    <select
                      value={generalSettings.timezone}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, timezone: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300"
                    >
                      <optgroup label="Universal">
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                      </optgroup>
                      <optgroup label="Americas">
                        <option value="America/New_York">Eastern Time (US & Canada)</option>
                        <option value="America/Chicago">Central Time (US & Canada)</option>
                        <option value="America/Denver">Mountain Time (US & Canada)</option>
                        <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                        <option value="America/Anchorage">Alaska</option>
                        <option value="Pacific/Honolulu">Hawaii</option>
                        <option value="America/Toronto">Toronto</option>
                        <option value="America/Mexico_City">Mexico City</option>
                        <option value="America/Sao_Paulo">Sao Paulo</option>
                        <option value="America/Buenos_Aires">Buenos Aires</option>
                      </optgroup>
                      <optgroup label="Europe">
                        <option value="Europe/London">London</option>
                        <option value="Europe/Paris">Paris</option>
                        <option value="Europe/Berlin">Berlin</option>
                        <option value="Europe/Amsterdam">Amsterdam</option>
                        <option value="Europe/Madrid">Madrid</option>
                        <option value="Europe/Rome">Rome</option>
                        <option value="Europe/Moscow">Moscow</option>
                      </optgroup>
                      <optgroup label="Asia">
                        <option value="Asia/Dubai">Dubai</option>
                        <option value="Asia/Kolkata">India (IST)</option>
                        <option value="Asia/Singapore">Singapore</option>
                        <option value="Asia/Hong_Kong">Hong Kong</option>
                        <option value="Asia/Shanghai">China (CST)</option>
                        <option value="Asia/Tokyo">Tokyo</option>
                        <option value="Asia/Seoul">Seoul</option>
                        <option value="Asia/Bangkok">Bangkok</option>
                        <option value="Asia/Jakarta">Jakarta</option>
                      </optgroup>
                      <optgroup label="Pacific & Oceania">
                        <option value="Australia/Sydney">Sydney</option>
                        <option value="Australia/Melbourne">Melbourne</option>
                        <option value="Australia/Perth">Perth</option>
                        <option value="Pacific/Auckland">Auckland</option>
                      </optgroup>
                      <optgroup label="Africa & Middle East">
                        <option value="Africa/Cairo">Cairo</option>
                        <option value="Africa/Johannesburg">Johannesburg</option>
                        <option value="Africa/Lagos">Lagos</option>
                        <option value="Asia/Jerusalem">Jerusalem</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date Format</label>
                    <select
                      value={generalSettings.dateFormat}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, dateFormat: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Auto-Refresh Interval</label>
                    <select
                      value={generalSettings.refreshInterval}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200/50 dark:border-slate-700/50 rounded-xl bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-300"
                    >
                      <option value="15">15 seconds</option>
                      <option value="30">30 seconds</option>
                      <option value="60">1 minute</option>
                      <option value="300">5 minutes</option>
                    </select>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Data & Storage</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Clear Local Cache</p>
                      <p className="text-xs text-gray-500">Remove cached data and refresh from server</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        localStorage.clear();
                        window.location.reload();
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                      <ArrowPathIcon className="h-4 w-4 inline mr-1.5" />
                      Clear Cache
                    </motion.button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 dark:bg-red-500/5">
                    <div>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Danger Zone</p>
                      <p className="text-xs text-red-500 dark:text-red-400/80">Reset all settings to default values</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={resetSettings}
                      className="px-4 py-2 text-sm font-medium rounded-xl border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10"
                    >
                      <ExclamationTriangleIcon className="h-4 w-4 inline mr-1.5" />
                      Reset Settings
                    </motion.button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Note: User, Cluster, and API Token management has been moved to dedicated pages:
          - Clusters: /clusters
          - Users: /admin/users
          - API Keys: /admin/api-keys
      */}
    </motion.div>
  );
}
