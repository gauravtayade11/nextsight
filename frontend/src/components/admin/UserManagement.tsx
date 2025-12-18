import { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import {
  UserIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  EyeIcon,
  ClockIcon,
  EnvelopeIcon,
  IdentificationIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { authApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import PermissionsInfo from '../common/PermissionsInfo';
import { UserTableSkeleton, ConnectionError, EmptyState, PermissionDenied } from '../common/LoadingStates';
import type { User, UserRole } from '../../types';

interface CreateUserData {
  username: string;
  email: string;
  full_name: string;
  password: string;
  role: UserRole;
}

interface EditUserData {
  email?: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

// Matrix permission structure for visual grid display
// Each category has actions mapped to permission keys
const PERMISSION_MATRIX = {
  columns: [
    { key: 'view', label: 'View', icon: 'eye' },
    { key: 'create', label: 'Create', icon: 'plus' },
    { key: 'edit', label: 'Edit', icon: 'pencil' },
    { key: 'delete', label: 'Delete', icon: 'trash' },
    { key: 'execute', label: 'Execute', icon: 'terminal' },
    { key: 'special', label: 'Special', icon: 'star' },
  ],
  rows: [
    {
      category: 'Kubernetes',
      prefix: 'k8s',
      color: 'blue',
      permissions: {
        view: 'k8s.view',
        create: 'k8s.create',
        edit: 'k8s.edit',
        delete: 'k8s.delete',
        execute: 'k8s.exec',
        special: 'k8s.logs', // View Logs
      },
      specialLabel: 'Logs',
    },
    {
      category: 'GitOps (ArgoCD)',
      prefix: 'argocd',
      color: 'orange',
      permissions: {
        view: 'argocd.view',
        create: 'argocd.create',
        edit: 'argocd.sync', // Sync is like edit
        delete: 'argocd.delete',
        execute: null,
        special: 'argocd.rollback',
      },
      specialLabel: 'Rollback',
    },
    {
      category: 'Helm',
      prefix: 'helm',
      color: 'purple',
      permissions: {
        view: 'helm.view',
        create: 'helm.install',
        edit: 'helm.upgrade',
        delete: 'helm.uninstall',
        execute: null,
        special: null,
      },
      specialLabel: null,
    },
    {
      category: 'Security',
      prefix: 'security',
      color: 'red',
      permissions: {
        view: 'security.view',
        create: null,
        edit: 'security.config',
        delete: null,
        execute: 'security.scan',
        special: null,
      },
      specialLabel: null,
    },
    {
      category: 'Admin',
      prefix: 'admin',
      color: 'gray',
      permissions: {
        view: 'admin.audit', // Audit logs is view
        create: 'admin.users',
        edit: 'admin.roles',
        delete: null,
        execute: null,
        special: 'admin.clusters',
      },
      specialLabel: 'Clusters',
    },
  ],
};

// Flatten for legacy compatibility
const PERMISSION_CATEGORIES = [
  {
    name: 'Kubernetes',
    permissions: [
      { key: 'k8s.view', label: 'View Resources' },
      { key: 'k8s.create', label: 'Create Resources' },
      { key: 'k8s.edit', label: 'Edit Resources' },
      { key: 'k8s.delete', label: 'Delete Resources' },
      { key: 'k8s.exec', label: 'Execute Commands' },
      { key: 'k8s.logs', label: 'View Logs' },
    ],
  },
  {
    name: 'GitOps',
    permissions: [
      { key: 'argocd.view', label: 'View Apps' },
      { key: 'argocd.sync', label: 'Sync Apps' },
      { key: 'argocd.create', label: 'Create Apps' },
      { key: 'argocd.delete', label: 'Delete Apps' },
      { key: 'argocd.rollback', label: 'Rollback' },
    ],
  },
  {
    name: 'Helm',
    permissions: [
      { key: 'helm.view', label: 'View Releases' },
      { key: 'helm.install', label: 'Install' },
      { key: 'helm.upgrade', label: 'Upgrade' },
      { key: 'helm.uninstall', label: 'Uninstall' },
    ],
  },
  {
    name: 'Security',
    permissions: [
      { key: 'security.view', label: 'View Scans' },
      { key: 'security.scan', label: 'Run Scans' },
      { key: 'security.config', label: 'Configure' },
    ],
  },
  {
    name: 'Admin',
    permissions: [
      { key: 'admin.users', label: 'User Management' },
      { key: 'admin.roles', label: 'Role Management' },
      { key: 'admin.clusters', label: 'Cluster Management' },
      { key: 'admin.audit', label: 'Audit Logs' },
    ],
  },
];

// Default role permissions
const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  developer: [
    'k8s.view', 'k8s.create', 'k8s.edit', 'k8s.delete', 'k8s.exec', 'k8s.logs',
    'argocd.view', 'argocd.sync', 'argocd.create', 'argocd.rollback',
    'helm.view', 'helm.install', 'helm.upgrade',
    'security.view', 'security.scan',
  ],
  operator: [
    'k8s.view', 'k8s.edit', 'k8s.exec', 'k8s.logs',
    'argocd.view', 'argocd.sync', 'argocd.rollback',
    'helm.view', 'helm.upgrade',
    'security.view',
  ],
  viewer: ['k8s.view', 'k8s.logs', 'argocd.view', 'helm.view', 'security.view'],
};

const ROLES: { value: UserRole; label: string; color: string; description: string }[] = [
  { value: 'admin', label: 'Admin', color: 'red', description: 'Full system access' },
  { value: 'developer', label: 'Developer', color: 'blue', description: 'Deploy and manage applications' },
  { value: 'operator', label: 'Operator', color: 'yellow', description: 'Monitor and operate systems' },
  { value: 'viewer', label: 'Viewer', color: 'gray', description: 'Read-only access' },
];

export default function UserManagement() {
  const { user: currentUser, hasRole } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState<CreateUserData>({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'viewer',
  });
  const [editForm, setEditForm] = useState<EditUserData>({});
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Custom permissions state
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [useCustomPermissions, setUseCustomPermissions] = useState(false);

  // Create user with permissions state
  const [createUseCustomPermissions, setCreateUseCustomPermissions] = useState(false);
  const [createUserPermissions, setCreateUserPermissions] = useState<string[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authApi.listUsers();
      setUsers(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load users');
      logger.error('Error fetching users', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      const response = await authApi.createUser(createForm);
      const newUserId = response.data.id;

      // If custom permissions are enabled, set them after user creation
      if (createUseCustomPermissions && createUserPermissions.length > 0) {
        try {
          await authApi.setUserPermissions(newUserId, {
            use_custom_permissions: true,
            permissions: createUserPermissions,
          });
          toast.success('User Created', `${createForm.username} created with custom permissions`);
        } catch {
          toast.warning('Partial Success', `${createForm.username} created, but failed to set permissions`);
        }
      } else {
        toast.success('User Created', `${createForm.username} has been created successfully`);
      }

      setShowCreateModal(false);
      setCreateForm({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'viewer',
      });
      setCreateUseCustomPermissions(false);
      setCreateUserPermissions([]);
      fetchUsers();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create user';
      setFormError(errorMsg);
      toast.error('Creation Failed', errorMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setFormError(null);
    setFormLoading(true);
    const username = selectedUser.username;

    try {
      await authApi.updateUser(selectedUser.id, editForm);
      setShowEditModal(false);
      setSelectedUser(null);
      setEditForm({});
      toast.success('User Updated', `${username}'s profile has been updated`);
      fetchUsers();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update user';
      setFormError(errorMsg);
      toast.error('Update Failed', errorMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setFormError(null);
    setFormLoading(true);
    const username = selectedUser.username;

    try {
      await authApi.deleteUser(selectedUser.id);
      setShowDeleteModal(false);
      setSelectedUser(null);
      toast.success('User Deleted', `${username} has been removed`);
      fetchUsers();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete user';
      setFormError(errorMsg);
      toast.error('Deletion Failed', errorMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setFormError(null);
    setFormLoading(true);
    const username = selectedUser.username;

    try {
      await authApi.resetUserPassword(selectedUser.id, { new_password: newPassword });
      setShowResetPasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
      toast.success('Password Reset', `${username}'s password has been reset`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to reset password';
      setFormError(errorMsg);
      toast.error('Reset Failed', errorMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    setFormLoading(true);
    setFormError(null);
    const username = selectedUser.username;

    try {
      await authApi.setUserPermissions(selectedUser.id, {
        use_custom_permissions: useCustomPermissions,
        permissions: useCustomPermissions ? userPermissions : [],
      });

      if (useCustomPermissions) {
        toast.success('Permissions Updated', `Custom permissions saved for ${username}`);
      } else {
        toast.info('Permissions Reset', `${username} now uses role-based permissions`);
      }

      // Refresh users list to get updated permissions
      await fetchUsers();

      setShowPermissionsModal(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save permissions';
      setFormError(errorMsg);
      toast.error('Save Failed', errorMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email || '',
      full_name: user.full_name || '',
      role: user.role,
      is_active: user.is_active,
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setFormError(null);
    setShowDeleteModal(true);
  };

  const openResetPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setFormError(null);
    setShowResetPasswordModal(true);
  };

  const openProfileModal = (user: User) => {
    setSelectedUser(user);
    setShowProfileModal(true);
  };

  const openPermissionsModal = async (user: User) => {
    setSelectedUser(user);
    setFormError(null);
    setFormLoading(true);

    try {
      // Fetch user permissions from API
      const response = await authApi.getUserPermissions(user.id);
      setUseCustomPermissions(response.data.use_custom_permissions);
      setUserPermissions(response.data.permissions);
      setShowPermissionsModal(true);
    } catch (err) {
      // Fall back to local data if API fails
      const hasCustom = user.use_custom_permissions || false;
      setUseCustomPermissions(hasCustom);
      setUserPermissions(
        hasCustom && user.custom_permissions
          ? user.custom_permissions
          : DEFAULT_ROLE_PERMISSIONS[user.role] || []
      );
      setShowPermissionsModal(true);
    } finally {
      setFormLoading(false);
    }
  };

  const togglePermission = (permission: string) => {
    setUserPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const toggleCreatePermission = (permission: string) => {
    setCreateUserPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const getRoleColor = (role: UserRole) => {
    const roleConfig = ROLES.find((r) => r.value === role);
    switch (roleConfig?.color) {
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
      case 'admin':
        return 'border-red-500';
      case 'developer':
        return 'border-blue-500';
      case 'operator':
        return 'border-yellow-500';
      default:
        return 'border-gray-500';
    }
  };

  if (!hasRole('admin')) {
    return (
      <div className="p-6">
        <PermissionDenied
          resource="User Management"
          requiredRole="Administrator"
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Current Admin Profile Card */}
      {currentUser && (
        <div className="bg-gradient-to-r from-primary-500/10 via-purple-500/10 to-blue-500/10 dark:from-primary-900/30 dark:via-purple-900/30 dark:to-blue-900/30 rounded-xl border border-primary-200 dark:border-primary-800/50 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 via-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                <span className="text-2xl font-bold text-white">
                  {currentUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {currentUser.full_name || currentUser.username}
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 uppercase">
                    {currentUser.role}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Logged In
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">@{currentUser.username}</p>
                {currentUser.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                    <EnvelopeIcon className="h-3.5 w-3.5" />
                    {currentUser.email}
                  </p>
                )}
              </div>
            </div>
            <div className="sm:ml-auto flex flex-wrap gap-2">
              <div className="px-3 py-1.5 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">User ID</p>
                <p className="text-sm font-mono text-gray-700 dark:text-gray-300">{currentUser.id.slice(0, 8)}...</p>
              </div>
              <div className="px-3 py-1.5 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Permissions</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {currentUser.role === 'admin' ? 'Full Access' : currentUser.use_custom_permissions ? 'Custom' : 'Role-based'}
                </p>
              </div>
              <div className="px-3 py-1.5 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Users</p>
                <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{users.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserIcon className="h-7 w-7 text-primary-600" />
            User Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage users, roles, and permissions
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <ConnectionError
          service="User Management API"
          onRetry={fetchUsers}
          retrying={loading}
        />
      )}

      {/* Users Table */}
      {loading ? (
        <UserTableSkeleton />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          {filteredUsers.length === 0 ? (
            <EmptyState
              title="No users found"
              message={searchQuery || selectedRole !== 'all'
                ? "Try adjusting your search or filter criteria"
                : "Get started by creating the first user"
              }
              icon={<UserIcon className="h-8 w-8" />}
              action={searchQuery || selectedRole !== 'all' ? {
                label: 'Clear Filters',
                onClick: () => {
                  setSearchQuery('');
                  setSelectedRole('all');
                }
              } : {
                label: 'Add User',
                onClick: () => setShowCreateModal(true)
              }}
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      Role
                      <PermissionsInfo iconOnly buttonClassName="text-gray-400 hover:text-primary-500" />
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <button
                          onClick={() => openProfileModal(user)}
                          className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center hover:ring-2 hover:ring-primary-500 transition-all"
                        >
                          <span className="text-primary-600 dark:text-primary-400 font-medium">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </button>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openProfileModal(user)}
                              className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                            >
                              {user.username}
                            </button>
                            {user.id === currentUser?.id && (
                              <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 px-2 py-0.5 rounded">
                                You
                              </span>
                            )}
                            {user.use_custom_permissions && (
                              <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email || user.full_name || 'No email'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                          user.role
                        )}`}
                      >
                        {ROLES.find((r) => r.value === user.role)?.label || user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircleIcon className="h-4 w-4" />
                          <span className="text-sm">Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <XCircleIcon className="h-4 w-4" />
                          <span className="text-sm">Inactive</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.last_login
                        ? new Date(user.last_login).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openProfileModal(user)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="View profile"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openPermissionsModal(user)}
                          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                          title="Manage permissions"
                        >
                          <AdjustmentsHorizontalIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(user)}
                          disabled={user.id === currentUser?.id}
                          className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Reset password"
                        >
                          <KeyIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(user)}
                          disabled={user.id === currentUser?.id}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete user"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* View Profile Modal */}
      {showProfileModal && selectedUser && (
        <Modal title="User Profile" onClose={() => setShowProfileModal(false)} size="lg">
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-xl">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg border-4 ${getRoleBorderColor(selectedUser.role)}`}>
                <span className="text-white font-bold text-2xl">
                  {selectedUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedUser.full_name || selectedUser.username}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(selectedUser.role)}`}>
                    {ROLES.find((r) => r.value === selectedUser.role)?.label}
                  </span>
                </div>
                <p className="text-gray-500 dark:text-gray-400">@{selectedUser.username}</p>
              </div>
              <div className="text-right">
                {selectedUser.is_active ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    Inactive
                  </span>
                )}
              </div>
            </div>

            {/* Profile Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <IdentificationIcon className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide font-medium">User ID</span>
                </div>
                <p className="text-sm font-mono text-gray-900 dark:text-white truncate">
                  {selectedUser.id}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <EnvelopeIcon className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide font-medium">Email</span>
                </div>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedUser.email || 'Not provided'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <ClockIcon className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide font-medium">Member Since</span>
                </div>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedUser.created_at
                    ? new Date(selectedUser.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Unknown'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                  <ClockIcon className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide font-medium">Last Login</span>
                </div>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedUser.last_login
                    ? new Date(selectedUser.last_login).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Never'}
                </p>
              </div>
            </div>

            {/* Permissions Summary */}
            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <ShieldCheckIcon className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide font-medium">Permissions</span>
                </div>
                {selectedUser.use_custom_permissions && (
                  <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded">
                    Custom Permissions
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                {selectedUser.role === 'admin'
                  ? 'Full system access with all permissions'
                  : `${(selectedUser.custom_permissions || DEFAULT_ROLE_PERMISSIONS[selectedUser.role] || []).length} permissions granted`}
              </p>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  openPermissionsModal(selectedUser);
                }}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                View & Edit Permissions
              </button>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  openEditModal(selectedUser);
                }}
                className="px-4 py-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
              >
                Edit Profile
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Permissions Modal - Matrix Style */}
      {showPermissionsModal && selectedUser && (
        <Modal
          title={`Permission Matrix: ${selectedUser.username}`}
          onClose={() => setShowPermissionsModal(false)}
          size="xl"
        >
          <div className="space-y-4">
            {formError && <ErrorAlert message={formError} />}

            {/* User Info Header */}
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-lg">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center`}>
                <span className="text-white font-bold">{selectedUser.username.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{selectedUser.full_name || selectedUser.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Role: <span className={`font-medium px-1.5 py-0.5 rounded ${getRoleColor(selectedUser.role)}`}>
                    {ROLES.find(r => r.value === selectedUser.role)?.label}
                  </span>
                </p>
              </div>
            </div>

            {/* Custom vs Role Toggle */}
            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-600">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <AdjustmentsHorizontalIcon className="h-5 w-5 text-purple-500" />
                    Enable Custom Permissions
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Override role defaults and assign granular permissions per category
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={useCustomPermissions}
                    onChange={(e) => {
                      setUseCustomPermissions(e.target.checked);
                      if (!e.target.checked) {
                        setUserPermissions(DEFAULT_ROLE_PERMISSIONS[selectedUser.role] || []);
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-14 h-7 rounded-full transition-colors ${useCustomPermissions ? 'bg-purple-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                    <div className={`w-6 h-6 bg-white rounded-full shadow-lg transform transition-transform ${useCustomPermissions ? 'translate-x-7' : 'translate-x-0.5'} mt-0.5`} />
                  </div>
                </div>
              </label>
            </div>

            {!useCustomPermissions && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Using default <span className="font-semibold">{ROLES.find(r => r.value === selectedUser.role)?.label}</span> role permissions.
                  Enable custom permissions above to modify individual access.
                </p>
              </div>
            )}

            {/* Matrix Permission Grid */}
            <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-slate-700">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b border-r border-gray-200 dark:border-slate-600 sticky left-0 bg-gray-100 dark:bg-slate-700 z-10 min-w-[140px]">
                        Category
                      </th>
                      {PERMISSION_MATRIX.columns.map((col) => (
                        <th
                          key={col.key}
                          className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-slate-600 min-w-[80px]"
                        >
                          <div className="flex flex-col items-center gap-1">
                            {col.key === 'view' && <EyeIcon className="h-4 w-4" />}
                            {col.key === 'create' && <PlusIcon className="h-4 w-4" />}
                            {col.key === 'edit' && <PencilSquareIcon className="h-4 w-4" />}
                            {col.key === 'delete' && <TrashIcon className="h-4 w-4" />}
                            {col.key === 'execute' && <KeyIcon className="h-4 w-4" />}
                            {col.key === 'special' && <ShieldCheckIcon className="h-4 w-4" />}
                            <span>{col.label}</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-slate-600 min-w-[60px]">
                        All
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_MATRIX.rows.map((row, rowIndex) => {
                      const rowPermKeys = Object.values(row.permissions).filter(Boolean) as string[];
                      const allRowChecked = rowPermKeys.every(p => userPermissions.includes('*') || userPermissions.includes(p));
                      const someRowChecked = rowPermKeys.some(p => userPermissions.includes('*') || userPermissions.includes(p));

                      return (
                        <tr
                          key={row.category}
                          className={`${rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-800/50'} hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors`}
                        >
                          <td className={`px-4 py-3 border-r border-gray-200 dark:border-slate-600 sticky left-0 z-10 ${rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full bg-${row.color}-500`} style={{
                                backgroundColor: row.color === 'blue' ? '#3b82f6' :
                                  row.color === 'orange' ? '#f97316' :
                                  row.color === 'purple' ? '#a855f7' :
                                  row.color === 'red' ? '#ef4444' : '#6b7280'
                              }} />
                              <span className="font-medium text-gray-900 dark:text-white text-sm">
                                {row.category}
                              </span>
                            </div>
                          </td>
                          {PERMISSION_MATRIX.columns.map((col) => {
                            const permKey = row.permissions[col.key as keyof typeof row.permissions];
                            const isChecked = permKey ? (userPermissions.includes('*') || userPermissions.includes(permKey)) : false;
                            const isDisabled = !useCustomPermissions || userPermissions.includes('*') || !permKey;
                            const tooltipLabel = col.key === 'special' && row.specialLabel ? row.specialLabel : null;

                            return (
                              <td key={col.key} className="px-3 py-3 text-center border-gray-200 dark:border-slate-600">
                                {permKey ? (
                                  <div className="flex flex-col items-center">
                                    <label className={`relative inline-flex items-center ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        disabled={isDisabled}
                                        onChange={() => permKey && togglePermission(permKey)}
                                        className="sr-only"
                                      />
                                      <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                        isChecked
                                          ? 'bg-green-500 text-white shadow-sm'
                                          : 'bg-gray-200 dark:bg-slate-600 text-gray-400 dark:text-slate-400'
                                      } ${isDisabled ? 'opacity-50' : 'hover:scale-110'}`}>
                                        {isChecked ? (
                                          <CheckCircleIcon className="h-4 w-4" />
                                        ) : (
                                          <XCircleIcon className="h-4 w-4" />
                                        )}
                                      </div>
                                    </label>
                                    {tooltipLabel && (
                                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{tooltipLabel}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-300 dark:text-slate-600">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center border-gray-200 dark:border-slate-600">
                            <label className={`relative inline-flex items-center ${!useCustomPermissions ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={allRowChecked}
                                disabled={!useCustomPermissions || userPermissions.includes('*')}
                                onChange={() => {
                                  if (allRowChecked) {
                                    setUserPermissions(prev => prev.filter(p => !rowPermKeys.includes(p)));
                                  } else {
                                    setUserPermissions(prev => [...new Set([...prev, ...rowPermKeys])]);
                                  }
                                }}
                                className="sr-only"
                              />
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                allRowChecked
                                  ? 'bg-purple-500 text-white shadow-sm'
                                  : someRowChecked
                                  ? 'bg-purple-200 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300'
                                  : 'bg-gray-200 dark:bg-slate-600 text-gray-400'
                              } ${!useCustomPermissions ? 'opacity-50' : 'hover:scale-110'}`}>
                                {allRowChecked ? (
                                  <CheckCircleIcon className="h-4 w-4" />
                                ) : someRowChecked ? (
                                  <div className="w-2 h-2 bg-current rounded-sm" />
                                ) : (
                                  <XCircleIcon className="h-4 w-4" />
                                )}
                              </div>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="px-4 py-2 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-200 dark:border-slate-600 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
                    <CheckCircleIcon className="h-3 w-3 text-white" />
                  </div>
                  <span>Granted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-gray-200 dark:bg-slate-600 flex items-center justify-center">
                    <XCircleIcon className="h-3 w-3 text-gray-400" />
                  </div>
                  <span>Denied</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-300 dark:text-slate-600">—</span>
                  <span>N/A</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded bg-purple-500 flex items-center justify-center">
                    <CheckCircleIcon className="h-3 w-3 text-white" />
                  </div>
                  <span>Row All</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {useCustomPermissions && (
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => {
                    const allPerms = PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.key));
                    setUserPermissions(allPerms);
                  }}
                  className="text-xs px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-medium"
                >
                  Grant All
                </button>
                <button
                  onClick={() => setUserPermissions([])}
                  className="text-xs px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium"
                >
                  Revoke All
                </button>
                <button
                  onClick={() => setUserPermissions(DEFAULT_ROLE_PERMISSIONS[selectedUser.role] || [])}
                  className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-medium"
                >
                  Reset to {ROLES.find(r => r.value === selectedUser.role)?.label} Default
                </button>
                <button
                  onClick={() => {
                    // Grant view-only permissions
                    const viewPerms = PERMISSION_MATRIX.rows
                      .map(r => r.permissions.view)
                      .filter(Boolean) as string[];
                    setUserPermissions(viewPerms);
                  }}
                  className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium"
                >
                  View Only
                </button>
              </div>
            )}

            {/* Permission Summary */}
            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {useCustomPermissions ? 'Custom' : 'Role-based'} permissions:
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {userPermissions.includes('*') ? 'Full Access' : `${userPermissions.length} permissions`}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowPermissionsModal(false)}
                disabled={formLoading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={formLoading}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {formLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="h-4 w-4" />
                    Save Permissions
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create User Modal with Permissions */}
      {showCreateModal && (
        <Modal title="Create New User" onClose={() => setShowCreateModal(false)} size="xl">
          <form onSubmit={handleCreateUser} className="space-y-4">
            {formError && <ErrorAlert message={formError} />}

            {/* Basic Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter password"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Min 8 chars, uppercase, lowercase, digit, special char
                </p>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role *
              </label>
              <select
                value={createForm.role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  setCreateForm({ ...createForm, role: newRole });
                  // Reset custom permissions when role changes
                  if (!createUseCustomPermissions) {
                    setCreateUserPermissions(DEFAULT_ROLE_PERMISSIONS[newRole] || []);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label} - {role.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Permission Matrix Section */}
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
              <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-600 mb-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <AdjustmentsHorizontalIcon className="h-5 w-5 text-purple-500" />
                      Set Custom Permissions
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Override default {ROLES.find(r => r.value === createForm.role)?.label} role permissions
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={createUseCustomPermissions}
                      onChange={(e) => {
                        setCreateUseCustomPermissions(e.target.checked);
                        if (!e.target.checked) {
                          setCreateUserPermissions([]);
                        } else {
                          setCreateUserPermissions(DEFAULT_ROLE_PERMISSIONS[createForm.role] || []);
                        }
                      }}
                      className="sr-only"
                    />
                    <div className={`w-12 h-6 rounded-full transition-colors ${createUseCustomPermissions ? 'bg-purple-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${createUseCustomPermissions ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                    </div>
                  </div>
                </label>
              </div>

              {createUseCustomPermissions && (
                <>
                  {/* Compact Permission Matrix */}
                  <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0">
                          <tr className="bg-gray-100 dark:bg-slate-700">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase border-b border-r border-gray-200 dark:border-slate-600 sticky left-0 bg-gray-100 dark:bg-slate-700 z-10">
                              Category
                            </th>
                            {PERMISSION_MATRIX.columns.map((col) => (
                              <th key={col.key} className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase border-b border-gray-200 dark:border-slate-600 min-w-[60px]">
                                {col.label}
                              </th>
                            ))}
                            <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase border-b border-gray-200 dark:border-slate-600">
                              All
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {PERMISSION_MATRIX.rows.map((row, rowIndex) => {
                            const rowPermKeys = Object.values(row.permissions).filter(Boolean) as string[];
                            const allRowChecked = rowPermKeys.every(p => createUserPermissions.includes(p));
                            const someRowChecked = rowPermKeys.some(p => createUserPermissions.includes(p));

                            return (
                              <tr key={row.category} className={`${rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
                                <td className={`px-3 py-2 border-r border-gray-200 dark:border-slate-600 sticky left-0 z-10 ${rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{
                                      backgroundColor: row.color === 'blue' ? '#3b82f6' :
                                        row.color === 'orange' ? '#f97316' :
                                        row.color === 'purple' ? '#a855f7' :
                                        row.color === 'red' ? '#ef4444' : '#6b7280'
                                    }} />
                                    <span className="font-medium text-gray-900 dark:text-white text-xs whitespace-nowrap">
                                      {row.category}
                                    </span>
                                  </div>
                                </td>
                                {PERMISSION_MATRIX.columns.map((col) => {
                                  const permKey = row.permissions[col.key as keyof typeof row.permissions];
                                  const isChecked = permKey ? createUserPermissions.includes(permKey) : false;

                                  return (
                                    <td key={col.key} className="px-2 py-2 text-center">
                                      {permKey ? (
                                        <label className="cursor-pointer inline-flex">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => permKey && toggleCreatePermission(permKey)}
                                            className="sr-only"
                                          />
                                          <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                                            isChecked
                                              ? 'bg-green-500 text-white'
                                              : 'bg-gray-200 dark:bg-slate-600 text-gray-400'
                                          } hover:scale-110`}>
                                            {isChecked ? (
                                              <CheckCircleIcon className="h-3.5 w-3.5" />
                                            ) : (
                                              <XCircleIcon className="h-3.5 w-3.5" />
                                            )}
                                          </div>
                                        </label>
                                      ) : (
                                        <span className="text-gray-300 dark:text-slate-600 text-xs">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-2 text-center">
                                  <label className="cursor-pointer inline-flex">
                                    <input
                                      type="checkbox"
                                      checked={allRowChecked}
                                      onChange={() => {
                                        if (allRowChecked) {
                                          setCreateUserPermissions(prev => prev.filter(p => !rowPermKeys.includes(p)));
                                        } else {
                                          setCreateUserPermissions(prev => [...new Set([...prev, ...rowPermKeys])]);
                                        }
                                      }}
                                      className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                                      allRowChecked
                                        ? 'bg-purple-500 text-white'
                                        : someRowChecked
                                        ? 'bg-purple-200 dark:bg-purple-900/50 text-purple-600'
                                        : 'bg-gray-200 dark:bg-slate-600 text-gray-400'
                                    } hover:scale-110`}>
                                      {allRowChecked ? (
                                        <CheckCircleIcon className="h-3.5 w-3.5" />
                                      ) : someRowChecked ? (
                                        <div className="w-1.5 h-1.5 bg-current rounded-sm" />
                                      ) : (
                                        <XCircleIcon className="h-3.5 w-3.5" />
                                      )}
                                    </div>
                                  </label>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        const allPerms = PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.key));
                        setCreateUserPermissions(allPerms);
                      }}
                      className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
                    >
                      Grant All
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateUserPermissions([])}
                      className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      Revoke All
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateUserPermissions(DEFAULT_ROLE_PERMISSIONS[createForm.role] || [])}
                      className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    >
                      Role Default
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const viewPerms = PERMISSION_MATRIX.rows.map(r => r.permissions.view).filter(Boolean) as string[];
                        setCreateUserPermissions(viewPerms);
                      }}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600"
                    >
                      View Only
                    </button>
                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 self-center">
                      {createUserPermissions.length} permissions selected
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateUseCustomPermissions(false);
                  setCreateUserPermissions([]);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {formLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <Modal title={`Edit User: ${selectedUser.username}`} onClose={() => setShowEditModal(false)}>
          <form onSubmit={handleEditUser} className="space-y-4">
            {formError && <ErrorAlert message={formError} />}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={editForm.full_name || ''}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                value={editForm.role || selectedUser.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                disabled={selectedUser.id === currentUser?.id}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {selectedUser.id === currentUser?.id && (
                <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                  You cannot change your own role
                </p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_active ?? selectedUser.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  disabled={selectedUser.id === currentUser?.id}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-slate-600 rounded disabled:opacity-50"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active Account
                </span>
              </label>
              {selectedUser.id === currentUser?.id && (
                <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                  You cannot deactivate your own account
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {formLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <Modal title="Delete User" onClose={() => setShowDeleteModal(false)}>
          <div className="space-y-4">
            {formError && <ErrorAlert message={formError} />}
            <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <ExclamationTriangleIcon className="h-10 w-10 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-red-800 dark:text-red-200 font-medium">
                  Are you sure you want to delete this user?
                </p>
                <p className="text-red-600 dark:text-red-300 text-sm mt-1">
                  User <span className="font-semibold">{selectedUser.username}</span> will be permanently deleted.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={formLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {formLoading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <Modal title={`Reset Password: ${selectedUser.username}`} onClose={() => setShowResetPasswordModal(false)}>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {formError && <ErrorAlert message={formError} />}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Password *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter new password"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Min 8 chars, uppercase, lowercase, digit, special char (!@#$%^&*)
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowResetPasswordModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {formLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Reusable Modal Component
function Modal({
  title,
  children,
  onClose,
  size = 'md',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-slate-900 dark:bg-opacity-75 transition-opacity" onClick={onClose} />

        {/* Modal Panel */}
        <div className={`relative inline-block w-full ${sizeClasses[size]} p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-slate-800 shadow-xl rounded-2xl`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// Error Alert Component
function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 border border-red-200 dark:border-red-800">
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
    </div>
  );
}
