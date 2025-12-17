import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { helmApi } from '../../services/api';
import { logger } from '../../utils/logger';
import type { HelmChartSearchResult } from '../../types';
import HelmRepositoryManager from './HelmRepositoryManager';
import {
  CubeIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
  StarIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
  ServerStackIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

// Mock popular charts data
const mockPopularCharts = [
  { name: 'nginx', repo: 'bitnami', description: 'NGINX Open Source is a web server', version: '15.1.0', downloads: '10M+', rating: 4.8 },
  { name: 'mysql', repo: 'bitnami', description: 'MySQL is a fast, reliable, scalable database', version: '9.12.1', downloads: '8M+', rating: 4.7 },
  { name: 'postgresql', repo: 'bitnami', description: 'PostgreSQL is an advanced database', version: '12.8.0', downloads: '7M+', rating: 4.9 },
  { name: 'redis', repo: 'bitnami', description: 'Redis is an in-memory data structure store', version: '18.0.3', downloads: '9M+', rating: 4.8 },
  { name: 'mongodb', repo: 'bitnami', description: 'MongoDB is a NoSQL database', version: '13.16.0', downloads: '6M+', rating: 4.6 },
  { name: 'apache', repo: 'bitnami', description: 'Apache HTTP Server', version: '10.1.2', downloads: '5M+', rating: 4.5 },
];

const categories = ['All', 'Databases', 'Web Servers', 'Monitoring', 'CI/CD', 'Messaging', 'Storage'];
const repositories = ['All Repos', 'bitnami', 'stable', 'prometheus-community', 'jetstack'];

export default function HelmChartCatalog() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRepo, setSelectedRepo] = useState('All Repos');
  const [charts, setCharts] = useState<typeof mockPopularCharts>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showRepoManager, setShowRepoManager] = useState(false);
  const [showVersionSelector, setShowVersionSelector] = useState(false);
  const [selectedChart, setSelectedChart] = useState<typeof mockPopularCharts[0] | null>(null);
  const [chartVersions, setChartVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Fetch charts on mount and when search changes
  useEffect(() => {
    // Start with mock data
    setCharts(mockPopularCharts);
    // Fetch real charts if search query exists
    if (searchQuery) {
      fetchCharts(searchQuery);
    }
  }, [searchQuery]);

  const fetchCharts = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await helmApi.searchCharts(query, selectedRepo !== 'All Repos' ? selectedRepo : undefined);
      if (response.data && Array.isArray(response.data)) {
        // Transform API response to match our chart format
        const transformedCharts = response.data.map((chart: any) => ({
          name: chart.name,
          repo: chart.repository || 'unknown',
          description: chart.description || 'No description available',
          version: chart.version || 'latest',
          downloads: chart.downloads || 'N/A',
          rating: chart.rating || 4.5,
        }));
        setCharts(transformedCharts);
      }
    } catch (err) {
      logger.error('Failed to search charts', err);
      // Keep mock data on error
    } finally {
      setLoading(false);
    }
  };

  // Filter charts
  const filteredCharts = charts.filter((chart) => {
    const matchesSearch =
      chart.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chart.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRepo = selectedRepo === 'All Repos' || chart.repo === selectedRepo;
    return matchesSearch && matchesRepo;
  });

  const handleInstallChart = async (chart: typeof mockPopularCharts[0]) => {
    setSelectedChart(chart);
    setShowVersionSelector(true);
    setLoadingVersions(true);

    try {
      const response = await helmApi.getChartVersions(`${chart.repo}/${chart.name}`);
      if (response.data && Array.isArray(response.data)) {
        setChartVersions(response.data);
      } else {
        // If no versions found, use the current version
        setChartVersions([{ version: chart.version, app_version: '', description: chart.description }]);
      }
    } catch (err) {
      logger.error('Failed to fetch chart versions', err);
      // Use current version as fallback
      setChartVersions([{ version: chart.version, app_version: '', description: chart.description }]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSelectVersion = (version: string) => {
    if (!selectedChart) return;
    setShowVersionSelector(false);
    navigate(`/deploy/helm/workspace?mode=install&chart=${selectedChart.repo}/${selectedChart.name}&version=${version}`);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Update repositories first
      await helmApi.updateRepositories();
      // Then search for popular charts
      if (searchQuery) {
        await fetchCharts(searchQuery);
      } else {
        // Reset to popular charts
        setCharts(mockPopularCharts);
      }
    } catch (err) {
      logger.error('Failed to refresh', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] overflow-hidden bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
            <CubeIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Helm Chart Catalog</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Browse and install charts from your repositories
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowRepoManager(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
          >
            <ServerStackIcon className="h-5 w-5" />
            Manage Repos
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={loading}
            className="p-2.5 rounded-lg bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search charts by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              showFilters
                ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30'
                : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            Filters
          </motion.button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-3 border-t border-gray-200 dark:border-slate-700"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        selectedCategory === category
                          ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Repository</label>
                <div className="flex flex-wrap gap-2">
                  {repositories.map((repo) => (
                    <button
                      key={repo}
                      onClick={() => setSelectedRepo(repo)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        selectedRepo === repo
                          ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {repo}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Chart Grid */}
      <div className="flex-1 overflow-auto p-6">
        {loading && filteredCharts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ArrowPathIcon className="h-12 w-12 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading charts...</p>
            </div>
          </div>
        ) : filteredCharts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CubeIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No charts found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Try adjusting your search or filters
              </p>
              {(searchQuery || selectedRepo !== 'All Repos') && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRepo('All Repos');
                    setSelectedCategory('All');
                  }}
                  className="px-4 py-2 text-sm font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-all"
                >
                  Clear Filters
                </motion.button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCharts.map((chart, index) => (
              <motion.div
                key={`${chart.repo}/${chart.name}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-all"
              >
                {/* Chart Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-200 dark:border-cyan-800">
                      <CubeIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{chart.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{chart.repo}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 min-h-[2.5rem]">
                  {chart.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-3 mb-3 text-xs">
                  <div className="flex items-center gap-1 text-amber-500">
                    <StarIcon className="h-3.5 w-3.5 fill-amber-500" />
                    <span className="font-medium">{chart.rating}</span>
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    {chart.downloads} downloads
                  </div>
                </div>

                {/* Version & Action */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-slate-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    v{chart.version}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleInstallChart(chart)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg hover:shadow-lg transition-all"
                  >
                    <RocketLaunchIcon className="h-3.5 w-3.5" />
                    Install
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Repository Manager Modal */}
      <HelmRepositoryManager
        isOpen={showRepoManager}
        onClose={() => setShowRepoManager(false)}
        onRepositoriesUpdated={handleRefresh}
      />

      {/* Version Selector Modal */}
      <AnimatePresence>
        {showVersionSelector && selectedChart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowVersionSelector(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-200 dark:border-cyan-800">
                    <CubeIcon className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Select Version
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedChart.repo}/{selectedChart.name}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowVersionSelector(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </motion.button>
              </div>

              {/* Versions List */}
              <div className="flex-1 overflow-auto">
                {loadingVersions ? (
                  <div className="flex items-center justify-center py-12">
                    <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
                  </div>
                ) : chartVersions.length > 0 ? (
                  <div className="space-y-2">
                    {chartVersions.map((version, idx) => (
                      <motion.button
                        key={`${version.version}-${idx}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => handleSelectVersion(version.version)}
                        className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                v{version.version}
                              </span>
                              {idx === 0 && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                                  Latest
                                </span>
                              )}
                              {version.app_version && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  App: {version.app_version}
                                </span>
                              )}
                            </div>
                            {version.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                                {version.description}
                              </p>
                            )}
                          </div>
                          <RocketLaunchIcon className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ClockIcon className="h-12 w-12 text-gray-300 dark:text-slate-600 mb-4" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No versions available</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
