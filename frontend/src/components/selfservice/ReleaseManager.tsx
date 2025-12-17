import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RocketLaunchIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  TagIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { gitflowApi, kubernetesApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { Release, ReleaseStatus, Environment } from '../../types';

export default function ReleaseManager() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [deployModal, setDeployModal] = useState<Release | null>(null);

  useEffect(() => {
    fetchReleases();
  }, []);

  async function fetchReleases() {
    setLoading(true);
    try {
      const res = await gitflowApi.listReleases(undefined, 50);
      setReleases(res.data.releases);
    } catch (error) {
      logger.error('Failed to fetch releases', error);
    } finally {
      setLoading(false);
    }
  }

  async function createRelease(version: string, changelog?: string) {
    try {
      await gitflowApi.createRelease(version, 'develop', changelog);
      setShowCreateModal(false);
      await fetchReleases();
    } catch (error) {
      logger.error('Failed to create release', error);
    }
  }

  async function approveRelease(id: string) {
    try {
      await gitflowApi.approveRelease(id, 'self-service');
      await fetchReleases();
    } catch (error) {
      logger.error('Failed to approve release', error);
    }
  }

  async function finishRelease(id: string) {
    try {
      await gitflowApi.finishRelease(id);
      await fetchReleases();
    } catch (error) {
      logger.error('Failed to finish release', error);
    }
  }

  async function deployRelease(release: Release, environment: Environment, namespace: string) {
    try {
      await kubernetesApi.deploy(release.id, environment, namespace, []);
      setDeployModal(null);
      await fetchReleases();
    } catch (error) {
      logger.error('Failed to deploy release', error);
    }
  }

  const statusColors: Record<ReleaseStatus, string> = {
    draft: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    pending_approval: 'bg-warning-50 dark:bg-warning-500/20 text-warning-600 dark:text-warning-400',
    approved: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    deploying: 'bg-primary-50 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400',
    deployed: 'bg-success-50 dark:bg-success-500/20 text-success-600 dark:text-success-400',
    rolled_back: 'bg-warning-50 dark:bg-warning-500/20 text-warning-600 dark:text-warning-400',
    failed: 'bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400',
  };

  const statusIcons: Record<ReleaseStatus, React.ElementType> = {
    draft: ClockIcon,
    pending_approval: ClockIcon,
    approved: CheckCircleIcon,
    deploying: ArrowPathIcon,
    deployed: CheckCircleIcon,
    rolled_back: ArrowPathIcon,
    failed: XCircleIcon,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/selfservice"
            className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Self-Service
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Release Manager</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          New Release
        </button>
      </div>

      {/* Release Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Releases</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{releases.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Draft</p>
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">
            {releases.filter((r) => r.status === 'draft').length}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending Approval</p>
          <p className="text-2xl font-bold text-warning-600">
            {releases.filter((r) => r.status === 'pending_approval').length}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Deployed</p>
          <p className="text-2xl font-bold text-success-600">
            {releases.filter((r) => r.status === 'deployed').length}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
          <p className="text-2xl font-bold text-danger-600">
            {releases.filter((r) => r.status === 'failed').length}
          </p>
        </div>
      </div>

      {/* Releases List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <TagIcon className="h-5 w-5" />
          Releases
        </h2>
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : releases.length === 0 ? (
          <div className="text-center py-12">
            <RocketLaunchIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No releases found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              Create your first release
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {releases.map((release) => {
              const StatusIcon = statusIcons[release.status];
              return (
                <div
                  key={release.id}
                  className="p-4 border border-gray-100 dark:border-slate-600 rounded-lg hover:border-primary-200 dark:hover:border-primary-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">v{release.version}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[release.status]}`}>
                          <StatusIcon className="h-3 w-3" />
                          {release.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Branch: {release.release_branch} • {release.commits.length} commits
                      </p>
                      {release.created_by && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Created by: {release.created_by}</p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Created: {new Date(release.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {release.status === 'draft' && (
                        <button
                          onClick={() => approveRelease(release.id)}
                          className="btn-secondary text-sm"
                        >
                          Approve
                        </button>
                      )}
                      {release.status === 'approved' && (
                        <>
                          <button
                            onClick={() => setDeployModal(release)}
                            className="btn-primary text-sm flex items-center gap-1"
                          >
                            <RocketLaunchIcon className="h-4 w-4" />
                            Deploy
                          </button>
                          <button
                            onClick={() => finishRelease(release.id)}
                            className="btn-secondary text-sm"
                          >
                            Finish
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedRelease(release)}
                        className="btn-secondary text-sm"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Release Modal */}
      {showCreateModal && (
        <CreateReleaseModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createRelease}
        />
      )}

      {/* Release Details Modal */}
      {selectedRelease && (
        <ReleaseDetailsModal
          release={selectedRelease}
          onClose={() => setSelectedRelease(null)}
        />
      )}

      {/* Deploy Modal */}
      {deployModal && (
        <DeployModal
          release={deployModal}
          onClose={() => setDeployModal(null)}
          onDeploy={deployRelease}
        />
      )}
    </div>
  );
}

function CreateReleaseModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (version: string, changelog?: string) => void;
}) {
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onCreate(version, changelog || undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Create New Release</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version</label>
            <input
              type="text"
              required
              pattern="^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              placeholder="1.0.0"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Format: major.minor.patch (e.g., 1.0.0)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Changelog (optional)</label>
            <textarea
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              rows={4}
              placeholder="What's new in this release..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Release
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReleaseDetailsModal({
  release,
  onClose,
}: {
  release: Release;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Release v{release.version}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Details</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500 dark:text-gray-400">Status</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 capitalize">{release.status.replace('_', ' ')}</dd>
              <dt className="text-gray-500 dark:text-gray-400">Branch</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{release.release_branch}</dd>
              <dt className="text-gray-500 dark:text-gray-400">Source</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{release.source_branch}</dd>
              <dt className="text-gray-500 dark:text-gray-400">Target</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{release.target_branch}</dd>
            </dl>
          </div>

          {release.changelog && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Changelog</h3>
              <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-lg text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {release.changelog}
              </div>
            </div>
          )}

          {release.commits.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Commits ({release.commits.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {release.commits.map((commit, i) => (
                  <div key={i} className="p-2 bg-gray-50 dark:bg-slate-700 rounded text-sm">
                    <code className="text-primary-600 dark:text-primary-400">{commit.sha}</code>
                    <span className="mx-2 text-gray-900 dark:text-gray-100">-</span>
                    <span className="text-gray-900 dark:text-gray-100">{commit.message}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">by {commit.author}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t border-gray-100 dark:border-slate-600">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DeployModal({
  release,
  onClose,
  onDeploy,
}: {
  release: Release;
  onClose: () => void;
  onDeploy: (release: Release, environment: Environment, namespace: string) => void;
}) {
  const [environment, setEnvironment] = useState<Environment>('staging');
  const [namespace, setNamespace] = useState('default');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onDeploy(release, environment, namespace);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Deploy v{release.version}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as Environment)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="uat">UAT</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Namespace</label>
            <input
              type="text"
              required
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          {environment === 'production' && (
            <div className="p-3 bg-warning-50 dark:bg-warning-500/20 border border-warning-200 dark:border-warning-500/30 rounded-lg">
              <p className="text-sm text-warning-800 dark:text-warning-300 font-medium">
                Warning: You are deploying to production. This action requires approval.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2">
              <RocketLaunchIcon className="h-4 w-4" />
              Deploy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
