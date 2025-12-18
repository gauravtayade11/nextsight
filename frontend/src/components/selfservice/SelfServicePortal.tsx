import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  ArrowsUpDownIcon,
  RocketLaunchIcon,
  ArrowUturnLeftIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { selfServiceApi, kubernetesApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { ServiceCatalogItem, SelfServiceAction, ActionType, Deployment } from '../../types';

export default function SelfServicePortal() {
  const [, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [actions, setActions] = useState<SelfServiceAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{
    type: ActionType;
    service: ServiceCatalogItem;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [catalogRes, deploymentsRes, actionsRes] = await Promise.all([
        selfServiceApi.getCatalog().catch(() => ({ data: [] })),
        kubernetesApi.getDeployments().catch(() => ({ data: [] })),
        selfServiceApi.listActions().catch(() => ({ data: [] })),
      ]);

      setCatalog(catalogRes.data);
      setDeployments(deploymentsRes.data);
      setActions(actionsRes.data);
    } catch (error) {
      logger.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(type: ActionType, service: ServiceCatalogItem, params: Record<string, unknown>) {
    try {
      await selfServiceApi.createAction({
        action_type: type,
        target_service: service.name,
        target_namespace: service.namespace,
        target_environment: service.environment,
        parameters: params,
        reason: `Self-service ${type} action`,
      });
      setActionModal(null);
      await fetchData();
    } catch (error) {
      logger.error('Action failed', error);
    }
  }

  const quickActions = [
    { type: 'scale' as ActionType, icon: ArrowsUpDownIcon, label: 'Scale', color: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/20' },
    { type: 'restart' as ActionType, icon: ArrowPathIcon, label: 'Restart', color: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-500/20' },
    { type: 'rollback' as ActionType, icon: ArrowUturnLeftIcon, label: 'Rollback', color: 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-500/20' },
  ];

  const statusColors = {
    pending: 'bg-warning-50 dark:bg-warning-500/20 text-warning-600 dark:text-warning-400',
    approved: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    running: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    completed: 'bg-success-50 dark:bg-success-500/20 text-success-600 dark:text-success-400',
    failed: 'bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400',
    rejected: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Developer Self-Service</h1>
        <div className="flex gap-3">
          <Link to="/releases" className="btn-primary flex items-center gap-2">
            <RocketLaunchIcon className="h-4 w-4" />
            Manage Releases
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Services</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{deployments.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending Actions</p>
          <p className="text-2xl font-bold text-warning-600">
            {actions.filter((a) => a.status === 'pending').length}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Completed Today</p>
          <p className="text-2xl font-bold text-success-600">
            {actions.filter((a) => a.status === 'completed').length}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Failed Actions</p>
          <p className="text-2xl font-bold text-danger-600">
            {actions.filter((a) => a.status === 'failed').length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Catalog */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <WrenchScrewdriverIcon className="h-5 w-5" />
              Service Catalog
            </h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : deployments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">No services found</div>
            ) : (
              <div className="space-y-3">
                {deployments.map((dep) => {
                  const service: ServiceCatalogItem = {
                    name: dep.name,
                    namespace: dep.namespace,
                    environment: 'default',
                    current_version: dep.image?.split(':').pop() || 'latest',
                    allowed_actions: ['scale', 'restart', 'rollback'],
                    health_status: dep.ready_replicas === dep.replicas ? 'healthy' : 'degraded',
                  };

                  return (
                    <div
                      key={`${dep.namespace}-${dep.name}`}
                      className="p-4 border border-gray-100 dark:border-slate-600 rounded-lg hover:border-primary-200 dark:hover:border-primary-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100">{dep.name}</h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                service.health_status === 'healthy'
                                  ? 'bg-success-50 dark:bg-success-500/20 text-success-600 dark:text-success-400'
                                  : 'bg-warning-50 dark:bg-warning-500/20 text-warning-600 dark:text-warning-400'
                              }`}
                            >
                              {service.health_status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {dep.namespace} • {dep.ready_replicas}/{dep.replicas} replicas •{' '}
                            {service.current_version}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {quickActions.map((action) => (
                            <button
                              key={action.type}
                              onClick={() => setActionModal({ type: action.type, service })}
                              className={`p-2 rounded-lg ${action.color} hover:opacity-80 transition-opacity`}
                              title={action.label}
                            >
                              <action.icon className="h-4 w-4" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Recent Actions
          </h2>
          {actions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">No actions yet</div>
          ) : (
            <div className="space-y-3">
              {actions.slice(0, 10).map((action) => (
                <div key={action.id} className="p-3 border border-gray-100 dark:border-slate-600 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {action.action_type.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{action.target_service}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[action.status]}`}>
                      {action.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {new Date(action.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {actionModal && (
        <ActionModal
          type={actionModal.type}
          service={actionModal.service}
          onClose={() => setActionModal(null)}
          onExecute={(params) => executeAction(actionModal.type, actionModal.service, params)}
        />
      )}
    </div>
  );
}

interface ActionModalProps {
  type: ActionType;
  service: ServiceCatalogItem;
  onClose: () => void;
  onExecute: (params: Record<string, unknown>) => void;
}

function ActionModal({ type, service, onClose, onExecute }: ActionModalProps) {
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onExecute({ ...params, reason });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 capitalize">
          {type.replace('_', ' ')} {service.name}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'scale' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Replicas
              </label>
              <input
                type="number"
                min="0"
                max="100"
                required
                value={(params.replicas as number) || 1}
                onChange={(e) => setParams({ ...params, replicas: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          )}

          {type === 'rollback' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Version (optional)
              </label>
              <input
                type="text"
                value={(params.version as string) || ''}
                onChange={(e) => setParams({ ...params, version: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                placeholder="Leave empty for previous version"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason
            </label>
            <textarea
              required
              minLength={10}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              rows={3}
              placeholder="Explain why you're performing this action..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Execute
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
