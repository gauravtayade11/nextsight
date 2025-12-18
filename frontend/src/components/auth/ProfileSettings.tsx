import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircleIcon,
  KeyIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../common/PageHeader';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ProfileSettings() {
  const { user, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const passwordRequirements = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'Contains uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Contains lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'Contains a number', test: (p: string) => /\d/.test(p) },
    { label: 'Contains special character', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
  ];

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    // Validate password requirements
    const failedRequirement = passwordRequirements.find((req) => !req.test(newPassword));
    if (failedRequirement) {
      setPasswordError(`Password requirement not met: ${failedRequirement.label}`);
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to change password';
      setPasswordError(errorMsg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'developer':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'operator':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
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
      <PageHeader
        title="Account Settings"
        description="Manage your profile and security settings"
        icon={UserCircleIcon}
        iconColor="blue"
      />

      {/* Tabs */}
      <motion.div
        variants={itemVariants}
        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-slate-700/50 p-1.5 inline-flex gap-1"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'profile'
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <UserCircleIcon className="h-4 w-4" />
          Profile
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'security'
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-slate-700/50'
          }`}
        >
          <ShieldCheckIcon className="h-4 w-4" />
          Security
        </motion.button>
      </motion.div>

      {/* Profile Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'profile' && user && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* User Info Card */}
            <motion.div
              variants={itemVariants}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 dark:border-slate-700/50 p-6"
            >
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-3xl">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {user.full_name || user.username}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleColor(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">@{user.username}</p>
                  {user.email && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{user.email}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200/50 dark:border-slate-700/50">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Role Level
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {user.role === 'admin'
                      ? '4 (Highest)'
                      : user.role === 'developer'
                      ? '3'
                      : user.role === 'operator'
                      ? '2'
                      : '1'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Member Since
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Last Login
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Role Permissions Info */}
            <motion.div
              variants={itemVariants}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 dark:border-slate-700/50 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <KeyIcon className="h-5 w-5 text-gray-500" />
                Your Permissions
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Based on your <span className="font-medium capitalize">{user.role}</span> role, you
                have access to:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {user.role === 'admin' && (
                  <PermissionItem label="Full System Access" description="All permissions granted" />
                )}
                {(user.role === 'admin' || user.role === 'developer') && (
                  <>
                    <PermissionItem label="Kubernetes Management" description="Create, edit, delete resources" />
                    <PermissionItem label="GitOps Deployments" description="Sync and manage ArgoCD apps" />
                    <PermissionItem label="Helm Operations" description="Install and manage charts" />
                  </>
                )}
                {user.role === 'operator' && (
                  <>
                    <PermissionItem label="View & Monitor" description="Access dashboards and metrics" />
                    <PermissionItem label="Operations" description="Scale, restart, exec into pods" />
                    <PermissionItem label="Alert Management" description="Configure and manage alerts" />
                  </>
                )}
                {user.role === 'viewer' && (
                  <>
                    <PermissionItem label="View Resources" description="Read-only access to all resources" />
                    <PermissionItem label="View Logs" description="Access container logs" />
                    <PermissionItem label="View Metrics" description="Access monitoring dashboards" />
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Change Password Card */}
            <motion.div
              variants={itemVariants}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 dark:border-slate-700/50 p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <KeyIcon className="h-5 w-5 text-gray-500" />
                Change Password
              </h3>

              {/* Success Message */}
              <AnimatePresence>
                {passwordSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/30 backdrop-blur-sm p-4 border border-emerald-200/50 dark:border-emerald-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        Password changed successfully!
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message */}
              <AnimatePresence>
                {passwordError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 rounded-xl bg-red-50/80 dark:bg-red-900/30 backdrop-blur-sm p-4 border border-red-200/50 dark:border-red-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        {passwordError}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2.5 pr-12 border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showCurrentPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2.5 pr-12 border border-gray-200/50 dark:border-slate-600/50 rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showNewPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                <AnimatePresence>
                  {newPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 bg-gray-50/80 dark:bg-slate-700/50 backdrop-blur-sm rounded-xl"
                    >
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Password Requirements:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {passwordRequirements.map((req) => {
                          const passed = req.test(newPassword);
                          return (
                            <div
                              key={req.label}
                              className={`text-xs flex items-center gap-1 transition-colors ${
                                passed
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              {passed ? (
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-current" />
                              )}
                              {req.label}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 py-2.5 pr-12 border rounded-xl bg-white/50 dark:bg-slate-700/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        confirmPassword && confirmPassword !== newPassword
                          ? 'border-red-300/50 dark:border-red-600/50'
                          : 'border-gray-200/50 dark:border-slate-600/50'
                      }`}
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <div className="pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={passwordLoading || (confirmPassword !== '' && confirmPassword !== newPassword)}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordLoading ? 'Changing Password...' : 'Change Password'}
                  </motion.button>
                </div>
              </form>
            </motion.div>

            {/* Security Tips */}
            <motion.div
              variants={itemVariants}
              className="bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm rounded-xl border border-blue-200/50 dark:border-blue-800/50 p-6"
            >
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5" />
                Security Tips
              </h3>
              <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Use a unique password that you don't use elsewhere
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Avoid using personal information in your password
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Consider using a password manager for secure storage
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Change your password regularly for better security
                </li>
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PermissionItem({ label, description }: { label: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-start gap-2 p-3 bg-gray-50/80 dark:bg-slate-700/50 backdrop-blur-sm rounded-xl"
    >
      <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </motion.div>
  );
}
