import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  PlusIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { incidentsApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { Incident, IncidentSeverity, IncidentStatus } from '../../types';

export default function IncidentList() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter, severityFilter]);

  async function fetchIncidents() {
    setLoading(true);
    try {
      const res = await incidentsApi.list({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
      });
      setIncidents(res.data);
    } catch (error) {
      logger.error('Failed to fetch incidents', error);
    } finally {
      setLoading(false);
    }
  }

  async function createIncident(data: Partial<Incident>) {
    try {
      await incidentsApi.create(data);
      setShowCreateModal(false);
      fetchIncidents();
    } catch (error) {
      logger.error('Failed to create incident', error);
    }
  }

  const severityColors = {
    critical: 'bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400 border-danger-200 dark:border-danger-500/30',
    high: 'bg-warning-50 dark:bg-warning-500/20 text-warning-600 dark:text-warning-400 border-warning-200 dark:border-warning-500/30',
    medium: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 border-primary-200 dark:border-primary-500/30',
    low: 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  };

  const statusColors = {
    open: 'bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400',
    investigating: 'bg-warning-50 dark:bg-warning-500/20 text-warning-600 dark:text-warning-400',
    identified: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    monitoring: 'bg-success-50 dark:bg-success-500/20 text-success-600 dark:text-success-400',
    resolved: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Incidents</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          New Incident
        </button>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-4">
        <FunnelIcon className="h-5 w-5 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | '')}
          className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="identified">Identified</option>
          <option value="monitoring">Monitoring</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as IncidentSeverity | '')}
          className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Incidents List */}
      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-12">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No incidents found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => (
              <Link
                key={incident.id}
                to={`/incidents/${incident.id}`}
                className="block p-4 rounded-lg border border-gray-100 dark:border-slate-600 hover:border-primary-200 dark:hover:border-primary-700 hover:shadow-sm dark:hover:bg-slate-700/50 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium border ${severityColors[incident.severity]}`}
                      >
                        {incident.severity.toUpperCase()}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[incident.status]}`}
                      >
                        {incident.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{incident.title}</h3>
                    {incident.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{incident.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                      {incident.namespace && <span>Namespace: {incident.namespace}</span>}
                      {incident.affected_services.length > 0 && (
                        <span>{incident.affected_services.length} service(s) affected</span>
                      )}
                      <span>{new Date(incident.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {incident.ai_analysis && (
                    <span className="px-2 py-1 bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded text-xs font-medium">
                      AI Analyzed
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateIncidentModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createIncident}
        />
      )}
    </div>
  );
}

interface CreateIncidentModalProps {
  onClose: () => void;
  onCreate: (data: Partial<Incident>) => void;
}

function CreateIncidentModal({ onClose, onCreate }: CreateIncidentModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium' as IncidentSeverity,
    namespace: '',
    affected_services: '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onCreate({
      ...formData,
      affected_services: formData.affected_services
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Create Incident</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              placeholder="Brief description of the incident"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              rows={3}
              placeholder="Detailed description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Severity</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as IncidentSeverity })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Namespace</label>
              <input
                type="text"
                value={formData.namespace}
                onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., production"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Affected Services (comma-separated)
            </label>
            <input
              type="text"
              value={formData.affected_services}
              onChange={(e) => setFormData({ ...formData, affected_services: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              placeholder="api-gateway, user-service"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
