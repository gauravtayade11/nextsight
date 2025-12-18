import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ServerIcon,
  BellIcon,
  ChartBarIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PlayIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import GlassCard from '../common/GlassCard';
import { prometheusApi } from '../../services/prometheusApi';
import type {
  PrometheusStackConfig,
  PrometheusStackStatus,
  StackStatus,
} from '../../types/prometheus';
import { getDefaultStackConfig } from '../../types/prometheus';

interface StepProps {
  config: PrometheusStackConfig;
  setConfig: (config: PrometheusStackConfig) => void;
}

// Step 1: Namespace & Release Configuration
function NamespaceStep({ config, setConfig }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Namespace
        </label>
        <input
          type="text"
          value={config.namespace}
          onChange={(e) => setConfig({ ...config, namespace: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="monitoring"
        />
        <p className="mt-1 text-xs text-gray-500">Namespace where Prometheus stack will be deployed</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Release Name
        </label>
        <input
          type="text"
          value={config.release_name}
          onChange={(e) => setConfig({ ...config, release_name: e.target.value })}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="prometheus-stack"
        />
        <p className="mt-1 text-xs text-gray-500">Helm release name for the stack</p>
      </div>
    </div>
  );
}

// Step 2: Prometheus Configuration
function PrometheusStep({ config, setConfig }: StepProps) {
  const retentionOptions = ['7d', '15d', '30d', '60d', '90d'];
  const storageOptions = ['10Gi', '25Gi', '50Gi', '100Gi', '200Gi', '500Gi'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Data Retention
          </label>
          <select
            value={config.prometheus.retention}
            onChange={(e) => setConfig({
              ...config,
              prometheus: { ...config.prometheus, retention: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            {retentionOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Storage Size
          </label>
          <select
            value={config.prometheus.storage_size}
            onChange={(e) => setConfig({
              ...config,
              prometheus: { ...config.prometheus, storage_size: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            {storageOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Storage Class (optional)
        </label>
        <input
          type="text"
          value={config.prometheus.storage_class || ''}
          onChange={(e) => setConfig({
            ...config,
            prometheus: { ...config.prometheus, storage_class: e.target.value || undefined }
          })}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          placeholder="default (uses cluster default)"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Replicas
          </label>
          <select
            value={config.prometheus.replicas}
            onChange={(e) => setConfig({
              ...config,
              prometheus: { ...config.prometheus, replicas: parseInt(e.target.value) }
            })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option value={1}>1 (Single)</option>
            <option value={2}>2 (HA)</option>
            <option value={3}>3 (HA)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Scrape Interval
          </label>
          <select
            value={config.prometheus.scrape_interval}
            onChange={(e) => setConfig({
              ...config,
              prometheus: { ...config.prometheus, scrape_interval: e.target.value }
            })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option value="15s">15s</option>
            <option value="30s">30s</option>
            <option value="60s">60s</option>
          </select>
        </div>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Resource Limits</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">CPU Request</label>
            <input
              type="text"
              value={config.prometheus.resources.cpu_request}
              onChange={(e) => setConfig({
                ...config,
                prometheus: {
                  ...config.prometheus,
                  resources: { ...config.prometheus.resources, cpu_request: e.target.value }
                }
              })}
              className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Memory Request</label>
            <input
              type="text"
              value={config.prometheus.resources.memory_request}
              onChange={(e) => setConfig({
                ...config,
                prometheus: {
                  ...config.prometheus,
                  resources: { ...config.prometheus.resources, memory_request: e.target.value }
                }
              })}
              className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 3: Alertmanager Configuration
function AlertmanagerStep({ config, setConfig }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">Enable Alertmanager</h4>
          <p className="text-sm text-gray-500">Handle and route alerts to notification channels</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.alertmanager.enabled}
            onChange={(e) => setConfig({
              ...config,
              alertmanager: { ...config.alertmanager, enabled: e.target.checked }
            })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
        </label>
      </div>

      {config.alertmanager.enabled && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Replicas
              </label>
              <select
                value={config.alertmanager.replicas}
                onChange={(e) => setConfig({
                  ...config,
                  alertmanager: { ...config.alertmanager, replicas: parseInt(e.target.value) }
                })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Storage Size
              </label>
              <select
                value={config.alertmanager.storage_size}
                onChange={(e) => setConfig({
                  ...config,
                  alertmanager: { ...config.alertmanager, storage_size: e.target.value }
                })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value="5Gi">5Gi</option>
                <option value="10Gi">10Gi</option>
                <option value="20Gi">20Gi</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Notification receivers (Slack, Email, PagerDuty) can be configured after deployment through the Alert Rules Manager.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Step 4: Grafana Configuration
function GrafanaStep({ config, setConfig }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">Enable Grafana</h4>
          <p className="text-sm text-gray-500">Visualization and dashboards for metrics</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.grafana.enabled}
            onChange={(e) => setConfig({
              ...config,
              grafana: { ...config.grafana, enabled: e.target.checked }
            })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
        </label>
      </div>

      {config.grafana.enabled && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Admin Password (optional)
            </label>
            <input
              type="password"
              value={config.grafana.admin_password || ''}
              onChange={(e) => setConfig({
                ...config,
                grafana: { ...config.grafana, admin_password: e.target.value || undefined }
              })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              placeholder="Auto-generated if empty"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Enable Persistence</h4>
              <p className="text-sm text-gray-500">Store dashboards and settings</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.grafana.persistence_enabled}
                onChange={(e) => setConfig({
                  ...config,
                  grafana: { ...config.grafana, persistence_enabled: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {config.grafana.persistence_enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Storage Size
              </label>
              <select
                value={config.grafana.storage_size}
                onChange={(e) => setConfig({
                  ...config,
                  grafana: { ...config.grafana, storage_size: e.target.value }
                })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value="5Gi">5Gi</option>
                <option value="10Gi">10Gi</option>
                <option value="20Gi">20Gi</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">Enable Ingress</h4>
              <p className="text-sm text-gray-500">Expose Grafana externally</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.grafana.ingress_enabled}
                onChange={(e) => setConfig({
                  ...config,
                  grafana: { ...config.grafana, ingress_enabled: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {config.grafana.ingress_enabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ingress Host
              </label>
              <input
                type="text"
                value={config.grafana.ingress_host || ''}
                onChange={(e) => setConfig({
                  ...config,
                  grafana: { ...config.grafana, ingress_host: e.target.value || undefined }
                })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                placeholder="grafana.example.com"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Step 5: Exporters Configuration
function ExportersStep({ config, setConfig }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">Node Exporter</h4>
          <p className="text-sm text-gray-500">Collect hardware and OS metrics from nodes</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.node_exporter.enabled}
            onChange={(e) => setConfig({
              ...config,
              node_exporter: { enabled: e.target.checked }
            })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
        </label>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">kube-state-metrics</h4>
          <p className="text-sm text-gray-500">Collect Kubernetes object state metrics</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.kube_state_metrics.enabled}
            onChange={(e) => setConfig({
              ...config,
              kube_state_metrics: { enabled: e.target.checked }
            })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
        </label>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">What you'll get:</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          {config.node_exporter.enabled && (
            <li>- CPU, Memory, Disk, Network metrics per node</li>
          )}
          {config.kube_state_metrics.enabled && (
            <li>- Deployment, Pod, Service, Node state metrics</li>
          )}
          <li>- Container CPU/Memory metrics (from kubelet)</li>
          <li>- Kubernetes API server metrics</li>
        </ul>
      </div>
    </div>
  );
}

// Step 6: Review & Deploy
function ReviewStep({ config }: { config: PrometheusStackConfig }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Namespace</h4>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{config.namespace}</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Release Name</h4>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{config.release_name}</p>
        </div>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Prometheus</h4>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div><span className="text-gray-500">Retention:</span> {config.prometheus.retention}</div>
          <div><span className="text-gray-500">Storage:</span> {config.prometheus.storage_size}</div>
          <div><span className="text-gray-500">Replicas:</span> {config.prometheus.replicas}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={`p-4 rounded-lg ${config.alertmanager.enabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-slate-700/50'}`}>
          <div className="flex items-center gap-2">
            {config.alertmanager.enabled ? (
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-gray-400" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">Alertmanager</span>
          </div>
        </div>
        <div className={`p-4 rounded-lg ${config.grafana.enabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-slate-700/50'}`}>
          <div className="flex items-center gap-2">
            {config.grafana.enabled ? (
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-gray-400" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">Grafana</span>
          </div>
        </div>
        <div className={`p-4 rounded-lg ${config.node_exporter.enabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-slate-700/50'}`}>
          <div className="flex items-center gap-2">
            {config.node_exporter.enabled ? (
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-gray-400" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">Node Exporter</span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
        <div className="flex items-start gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Deployment may take 5-10 minutes. The stack will be installed via Helm and pods will need time to start.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function PrometheusSetup() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<PrometheusStackConfig>(getDefaultStackConfig());
  const [status, setStatus] = useState<PrometheusStackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string } | null>(null);

  const steps = [
    { id: 'namespace', title: 'Namespace', icon: ServerIcon },
    { id: 'prometheus', title: 'Prometheus', icon: ChartBarIcon },
    { id: 'alertmanager', title: 'Alertmanager', icon: BellIcon },
    { id: 'grafana', title: 'Grafana', icon: ChartBarIcon },
    { id: 'exporters', title: 'Exporters', icon: CpuChipIcon },
    { id: 'review', title: 'Review', icon: Cog6ToothIcon },
  ];

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await prometheusApi.getStackStatus();
      setStatus(response.data);
    } catch (err) {
      // Stack not installed is expected
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);
    setDeployResult(null);

    try {
      const response = await prometheusApi.deployStack(config);
      setDeployResult({ success: response.data.success, message: response.data.message });
      if (response.data.success) {
        setStatus(response.data.status || null);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Deployment failed';
      setError(errorMessage);
      setDeployResult({ success: false, message: errorMessage });
    } finally {
      setDeploying(false);
    }
  };

  const getStatusColor = (stackStatus: StackStatus) => {
    switch (stackStatus) {
      case 'running':
        return 'text-green-500 bg-green-500/10';
      case 'degraded':
        return 'text-amber-500 bg-amber-500/10';
      case 'failed':
        return 'text-red-500 bg-red-500/10';
      case 'installing':
      case 'upgrading':
        return 'text-blue-500 bg-blue-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // If stack is already installed, show status
  if (status && status.status !== 'not_installed') {
    return (
      <div className="space-y-6">
        <GlassCard>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Prometheus Stack Status</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>
                {status.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Namespace</p>
                <p className="font-semibold text-gray-900 dark:text-white">{status.namespace}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Release</p>
                <p className="font-semibold text-gray-900 dark:text-white">{status.release_name}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Version</p>
                <p className="font-semibold text-gray-900 dark:text-white">{status.version || 'N/A'}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Components</p>
                <p className="font-semibold text-gray-900 dark:text-white">{status.components.length}</p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Components</h3>
            <div className="space-y-2">
              {status.components.map((component) => (
                <div key={component.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {component.ready ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircleIcon className="w-5 h-5 text-red-500" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">{component.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {component.ready_replicas}/{component.replicas} ready
                  </span>
                </div>
              ))}
            </div>

            {status.prometheus_url && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Access URLs (Internal)</h4>
                <div className="space-y-1 text-sm text-blue-700 dark:text-blue-400">
                  <p>Prometheus: {status.prometheus_url}</p>
                  {status.alertmanager_url && <p>Alertmanager: {status.alertmanager_url}</p>}
                  {status.grafana_url && <p>Grafana: {status.grafana_url}</p>}
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  // Show setup wizard
  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Deploy Prometheus Stack</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Deploy a complete monitoring stack with Prometheus, Alertmanager, Grafana, and exporters.
          </p>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(index)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    currentStep === index
                      ? 'bg-primary-500 text-white'
                      : currentStep > index
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
                  }`}
                >
                  <step.icon className="w-5 h-5" />
                  <span className="hidden md:inline text-sm font-medium">{step.title}</span>
                </button>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${currentStep > index ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="min-h-[300px]"
            >
              {currentStep === 0 && <NamespaceStep config={config} setConfig={setConfig} />}
              {currentStep === 1 && <PrometheusStep config={config} setConfig={setConfig} />}
              {currentStep === 2 && <AlertmanagerStep config={config} setConfig={setConfig} />}
              {currentStep === 3 && <GrafanaStep config={config} setConfig={setConfig} />}
              {currentStep === 4 && <ExportersStep config={config} setConfig={setConfig} />}
              {currentStep === 5 && <ReviewStep config={config} />}
            </motion.div>
          </AnimatePresence>

          {/* Error/Success Messages */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {deployResult && (
            <div className={`mt-4 p-4 rounded-lg ${deployResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <p className={`text-sm ${deployResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {deployResult.message}
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="flex items-center gap-2 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Next
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleDeploy}
                disabled={deploying}
                className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deploying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deploying...
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-4 h-4" />
                    Deploy Stack
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
