import { useState, useRef, useEffect } from 'react';
import { useCluster } from '../../contexts/ClusterContext';
import { logger } from '../../utils/logger';
import {
  ServerStackIcon,
  CheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

export default function ClusterSwitcher() {
  const { clusters, activeCluster, loading, setActiveCluster } = useCluster();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClusterSwitch = async (clusterId: string) => {
    if (clusterId === activeCluster?.id) {
      setIsOpen(false);
      return;
    }

    try {
      setSwitching(true);
      await setActiveCluster(clusterId);
      setIsOpen(false);
      // Optionally refresh the page or trigger a global state refresh
      window.location.reload();
    } catch (error) {
      logger.error('Failed to switch cluster', error);
    } finally {
      setSwitching(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-gray-400';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
        <ServerStackIcon className="h-5 w-5 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  if (clusters.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200"
      >
        <ServerStackIcon className="h-5 w-5" />
        <span className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${getStatusColor(activeCluster?.status || 'unknown')}`}
          />
          {activeCluster?.name || 'Select Cluster'}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 z-50">
          <div className="p-2 border-b border-gray-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
              Kubernetes Clusters
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {clusters.map((cluster) => (
              <button
                key={cluster.id}
                onClick={() => handleClusterSwitch(cluster.id)}
                disabled={switching}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                  cluster.id === activeCluster?.id
                    ? 'bg-primary-50 dark:bg-primary-900/30'
                    : ''
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${getStatusColor(cluster.status)}`}
                />
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {cluster.name}
                    </span>
                    {cluster.is_default && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {cluster.version && (
                      <span className="mr-3">{cluster.version}</span>
                    )}
                    <span>{cluster.node_count} nodes</span>
                    <span className="mx-1">•</span>
                    <span>{cluster.namespace_count} namespaces</span>
                  </div>
                </div>
                {cluster.id === activeCluster?.id && (
                  <CheckIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
