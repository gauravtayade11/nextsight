import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  ShieldCheckIcon,
  CheckIcon,
  XMarkIcon,
  InformationCircleIcon,
  ServerStackIcon,
  CloudIcon,
  CommandLineIcon,
  ChartBarIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';

// Simplified permission categories
const PERMISSION_SUMMARY = [
  {
    name: 'Kubernetes',
    icon: ServerStackIcon,
    permissions: ['View', 'Create', 'Edit', 'Delete', 'Exec', 'Logs'],
  },
  {
    name: 'GitOps',
    icon: CloudIcon,
    permissions: ['View', 'Sync', 'Create', 'Delete', 'Rollback'],
  },
  {
    name: 'Helm',
    icon: CommandLineIcon,
    permissions: ['View', 'Install', 'Upgrade', 'Uninstall'],
  },
  {
    name: 'Security',
    icon: ShieldCheckIcon,
    permissions: ['View', 'Scan', 'Configure'],
  },
  {
    name: 'Monitoring',
    icon: ChartBarIcon,
    permissions: ['View', 'Alerts'],
  },
  {
    name: 'Admin',
    icon: CogIcon,
    permissions: ['Users', 'Roles', 'Clusters', 'Settings'],
  },
];

const ROLE_ACCESS: Record<UserRole, Record<string, boolean[]>> = {
  admin: {
    Kubernetes: [true, true, true, true, true, true],
    GitOps: [true, true, true, true, true],
    Helm: [true, true, true, true],
    Security: [true, true, true],
    Monitoring: [true, true],
    Admin: [true, true, true, true],
  },
  developer: {
    Kubernetes: [true, true, true, true, true, true],
    GitOps: [true, true, true, false, true],
    Helm: [true, true, true, false],
    Security: [true, true, false],
    Monitoring: [true, false],
    Admin: [false, false, false, false],
  },
  operator: {
    Kubernetes: [true, false, true, false, true, true],
    GitOps: [true, true, false, false, true],
    Helm: [true, false, true, false],
    Security: [true, false, false],
    Monitoring: [true, true],
    Admin: [false, false, false, false],
  },
  viewer: {
    Kubernetes: [true, false, false, false, false, true],
    GitOps: [true, false, false, false, false],
    Helm: [true, false, false, false],
    Security: [true, false, false],
    Monitoring: [true, false],
    Admin: [false, false, false, false],
  },
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-500',
  developer: 'bg-blue-500',
  operator: 'bg-yellow-500',
  viewer: 'bg-gray-500',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  developer: 'Developer',
  operator: 'Operator',
  viewer: 'Viewer',
};

interface PermissionsInfoProps {
  buttonClassName?: string;
  iconOnly?: boolean;
}

export default function PermissionsInfo({ buttonClassName = '', iconOnly = false }: PermissionsInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const currentRole = user?.role || 'viewer';

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition-colors ${buttonClassName}`}
        title="View role permissions"
      >
        <InformationCircleIcon className="w-4 h-4" />
        {!iconOnly && <span className="text-xs">Permissions</span>}
      </button>

      {/* Modal */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-xl transition-all">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        <ShieldCheckIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <Dialog.Title className="text-lg font-semibold text-white">
                          Role Permissions
                        </Dialog.Title>
                        <p className="text-xs text-slate-400">
                          Your role: <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs ${ROLE_COLORS[currentRole]}`}>
                            {ROLE_LABELS[currentRole]}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Compact Permission Matrix */}
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-3">
                      {PERMISSION_SUMMARY.map((category) => (
                        <div
                          key={category.name}
                          className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <category.icon className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-medium text-white">{category.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {category.permissions.map((perm, idx) => {
                              const hasAccess = ROLE_ACCESS[currentRole][category.name][idx];
                              return (
                                <span
                                  key={perm}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                    hasAccess
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                      : 'bg-slate-700/50 text-slate-500 border border-slate-600/30'
                                  }`}
                                >
                                  {hasAccess ? (
                                    <CheckIcon className="w-3 h-3" />
                                  ) : (
                                    <XMarkIcon className="w-3 h-3" />
                                  )}
                                  {perm}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Role Legend */}
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-xs text-slate-500 mb-2">Role Hierarchy:</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(['admin', 'developer', 'operator', 'viewer'] as UserRole[]).map((role, idx) => (
                          <div
                            key={role}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
                              role === currentRole
                                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${ROLE_COLORS[role]}`} />
                            <span>{ROLE_LABELS[role]}</span>
                            <span className="text-slate-600">({4 - idx})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

// Inline tooltip version for headers
export function PermissionsTooltip() {
  const { user } = useAuth();
  const currentRole = user?.role || 'viewer';

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[currentRole]} text-white`}>
        <ShieldCheckIcon className="w-3 h-3" />
        {ROLE_LABELS[currentRole]}
      </span>
      <PermissionsInfo iconOnly />
    </div>
  );
}
