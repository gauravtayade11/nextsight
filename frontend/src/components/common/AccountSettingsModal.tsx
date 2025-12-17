import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  UserCircleIcon,
  KeyIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon,
  EnvelopeIcon,
  IdentificationIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_DETAILS: Record<UserRole, { label: string; color: string }> = {
  admin: { label: 'Administrator', color: 'red' },
  developer: { label: 'Developer', color: 'blue' },
  operator: { label: 'Operator', color: 'yellow' },
  viewer: { label: 'Viewer', color: 'gray' },
};

export default function AccountSettingsModal({ isOpen, onClose }: AccountSettingsModalProps) {
  const { user, logout, changePassword } = useAuth();
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
    { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'Number', test: (p: string) => /\d/.test(p) },
    { label: 'Special character', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
  ];

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

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

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const getRoleColor = (role: UserRole) => {
    switch (ROLE_DETAILS[role]?.color) {
      case 'red':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'blue':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getRoleBorderColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'border-red-500';
      case 'developer': return 'border-blue-500';
      case 'operator': return 'border-yellow-500';
      default: return 'border-gray-500';
    }
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
              {/* Header */}
              <div className="relative px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg border-4 ${getRoleBorderColor(user.role)}`}>
                    <span className="text-white font-bold text-xl">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {user.full_name || user.username}
                      </h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {ROLE_DETAILS[user.role]?.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-4">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'profile'
                        ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <UserCircleIcon className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    onClick={() => setActiveTab('security')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'security'
                        ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <ShieldCheckIcon className="h-4 w-4" />
                    Security
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    {/* User Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                          <IdentificationIcon className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wide font-medium">User ID</span>
                        </div>
                        <p className="text-sm font-mono text-gray-900 dark:text-white truncate">
                          {user.id}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                          <EnvelopeIcon className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wide font-medium">Email</span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {user.email || 'Not provided'}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                          <ClockIcon className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wide font-medium">Member Since</span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Unknown'}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                          <ClockIcon className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wide font-medium">Last Login</span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {user.last_login
                            ? new Date(user.last_login).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Just now'}
                        </p>
                      </div>
                    </div>

                    {/* Role & Permissions Info */}
                    <div className="p-4 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
                      <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300 mb-2">
                        <KeyIcon className="h-5 w-5" />
                        <span className="font-medium">Your Permissions</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {user.role === 'admin'
                          ? 'Full system access with all permissions.'
                          : user.role === 'developer'
                          ? 'Deploy and manage applications, Kubernetes resources, and GitOps.'
                          : user.role === 'operator'
                          ? 'Monitor systems, view logs, and perform operational tasks.'
                          : 'Read-only access to view resources and dashboards.'}
                      </p>
                    </div>

                    {/* Account Status */}
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <div>
                          <p className="font-medium text-green-800 dark:text-green-200">Account Active</p>
                          <p className="text-sm text-green-600 dark:text-green-300">Your account is in good standing</p>
                        </div>
                      </div>
                      <CheckCircleIcon className="h-8 w-8 text-green-500" />
                    </div>
                  </div>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                  <div className="space-y-6">
                    {/* Change Password Form */}
                    <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <KeyIcon className="h-5 w-5 text-gray-500" />
                        Change Password
                      </h3>

                      {passwordSuccess && (
                        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2">
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                              Password changed successfully!
                            </p>
                          </div>
                        </div>
                      )}

                      {passwordError && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-2">
                            <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                              {passwordError}
                            </p>
                          </div>
                        </div>
                      )}

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
                              className="w-full px-4 py-2.5 pr-12 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              placeholder="Enter current password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600"
                            >
                              {showCurrentPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
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
                              className="w-full px-4 py-2.5 pr-12 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              placeholder="Enter new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600"
                            >
                              {showNewPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Password Requirements */}
                        {newPassword && (
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600">
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                              Password Requirements:
                            </p>
                            <div className="grid grid-cols-2 gap-1">
                              {passwordRequirements.map((req) => {
                                const passed = req.test(newPassword);
                                return (
                                  <div
                                    key={req.label}
                                    className={`text-xs flex items-center gap-1 ${
                                      passed ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
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
                          </div>
                        )}

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
                              className={`w-full px-4 py-2.5 pr-12 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                                confirmPassword && confirmPassword !== newPassword
                                  ? 'border-red-300 dark:border-red-600'
                                  : 'border-gray-300 dark:border-slate-600'
                              }`}
                              placeholder="Confirm new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600"
                            >
                              {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                          </div>
                          {confirmPassword && confirmPassword !== newPassword && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              Passwords do not match
                            </p>
                          )}
                        </div>

                        <button
                          type="submit"
                          disabled={passwordLoading || (confirmPassword !== '' && confirmPassword !== newPassword)}
                          className="w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {passwordLoading ? 'Changing Password...' : 'Change Password'}
                        </button>
                      </form>
                    </div>

                    {/* Security Tips */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                        <ShieldCheckIcon className="h-4 w-4" />
                        Security Tips
                      </h3>
                      <ul className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <li>Use a unique password that you don't use elsewhere</li>
                        <li>Change your password regularly for better security</li>
                        <li>Never share your login credentials with others</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
