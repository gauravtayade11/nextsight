import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  FolderIcon,
  LockClosedIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LinkIcon,
  ChevronRightIcon,
  StarIcon,
  ClockIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import GlassCard from '../common/GlassCard';
import { getGitHubRepos, getGitHubBranches, createGitHubWebhook } from '../../services/pipelineAPI';
import { pipelineLogger as logger } from '../../utils/logger';

// Types
interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  private: boolean;
  owner: string;
}

interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

interface RepositorySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (config: RepositoryConfig) => void;
  currentConfig?: RepositoryConfig;
}

export interface RepositoryConfig {
  repository: string;
  branch: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'manual';
  repoFullName?: string;
  webhookEnabled?: boolean;
  webhookSecret?: string;
}

// Animation variants
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};

export default function RepositorySelector({
  isOpen,
  onClose,
  onSelect,
  currentConfig,
}: RepositorySelectorProps) {
  // State
  const [step, setStep] = useState<'provider' | 'repos' | 'branches' | 'config'>('provider');
  const [provider, setProvider] = useState<'github' | 'gitlab' | 'bitbucket' | 'manual'>('github');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [manualUrl, setManualUrl] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (currentConfig) {
        setProvider(currentConfig.provider);
        setManualUrl(currentConfig.repository);
        setSelectedBranch(currentConfig.branch);
        setWebhookEnabled(currentConfig.webhookEnabled ?? true);
      } else {
        setStep('provider');
        setRepositories([]);
        setBranches([]);
        setSelectedRepo(null);
        setSelectedBranch('');
        setSearchQuery('');
        setError(null);
      }
    }
  }, [isOpen, currentConfig]);

  // Fetch repositories from GitHub
  const fetchRepositories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const repos = await getGitHubRepos();
      // Transform GitHub repos to match our Repository interface
      const transformedRepos: Repository[] = repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || null,
        html_url: repo.url,
        clone_url: `https://github.com/${repo.full_name}.git`,
        ssh_url: `git@github.com:${repo.full_name}.git`,
        default_branch: repo.default_branch,
        private: repo.private,
        owner: repo.owner,
      }));
      setRepositories(transformedRepos);
      setStep('repos');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch repositories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch branches for selected repository
  const fetchBranches = useCallback(async (repo: Repository) => {
    setIsLoading(true);
    setError(null);
    try {
      const branchData = await getGitHubBranches(repo.owner, repo.name);
      // Transform to match our Branch interface
      const transformedBranches: Branch[] = branchData.map((branch) => ({
        name: branch.name,
        sha: '',
        protected: branch.protected,
      }));
      setBranches(transformedBranches);
      setSelectedBranch(repo.default_branch);
      setStep('branches');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch branches');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle provider selection
  const handleProviderSelect = async (selectedProvider: typeof provider) => {
    setProvider(selectedProvider);
    if (selectedProvider === 'manual') {
      setStep('config');
    } else if (selectedProvider === 'github') {
      await fetchRepositories();
    } else {
      setError(`${selectedProvider} integration coming soon`);
    }
  };

  // Handle repository selection
  const handleRepoSelect = async (repo: Repository) => {
    setSelectedRepo(repo);
    await fetchBranches(repo);
  };

  // Handle final confirmation
  const handleConfirm = async () => {
    if (provider === 'manual') {
      onSelect({
        repository: manualUrl,
        branch: selectedBranch || 'main',
        provider: 'manual',
        webhookEnabled: false,
      });
      onClose();
      return;
    }

    if (!selectedRepo) return;

    // Create webhook if enabled
    let webhookSecret: string | undefined;
    let actualWebhookEnabled = webhookEnabled;
    if (webhookEnabled) {
      try {
        setIsLoading(true);
        const webhookData = await createGitHubWebhook(selectedRepo.owner, selectedRepo.name);
        webhookSecret = webhookData.secret;
      } catch (err: any) {
        // Webhook creation failed - notify user but allow proceeding
        const errorMessage = err.response?.data?.detail || err.message || 'Unknown error';
        const shouldProceed = window.confirm(
          `Webhook creation failed: ${errorMessage}\n\nYour pipeline will still be created, but automatic triggers won't work until you manually set up the webhook.\n\nDo you want to continue without webhook?`
        );
        if (!shouldProceed) {
          setIsLoading(false);
          return;
        }
        // Mark webhook as disabled since it failed
        actualWebhookEnabled = false;
        logger.warn('Webhook creation failed', err);
      } finally {
        setIsLoading(false);
      }
    }

    onSelect({
      repository: selectedRepo.clone_url,
      branch: selectedBranch,
      provider,
      repoFullName: selectedRepo.full_name,
      webhookEnabled: actualWebhookEnabled,
      webhookSecret,
    });
    onClose();
  };

  // Filter repositories by search
  const filteredRepos = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  // Provider options
  const providers = [
    {
      id: 'github' as const,
      name: 'GitHub',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      ),
      color: 'from-gray-700 to-gray-900',
      available: true,
    },
    {
      id: 'gitlab' as const,
      name: 'GitLab',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 00-.867 0L1.386 9.452.044 13.587a.924.924 0 00.331 1.023L12 23.054l11.625-8.443a.92.92 0 00.33-1.024" />
        </svg>
      ),
      color: 'from-orange-500 to-red-600',
      available: false,
    },
    {
      id: 'bitbucket' as const,
      name: 'Bitbucket',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891L.778 1.213zM14.52 15.53H9.522l-1.35-7.063h7.68l-1.332 7.063z" />
        </svg>
      ),
      color: 'from-blue-500 to-blue-700',
      available: false,
    },
    {
      id: 'manual' as const,
      name: 'Manual URL',
      icon: <LinkIcon className="w-8 h-8" />,
      color: 'from-purple-500 to-indigo-600',
      available: true,
    },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl"
        >
          <GlassCard padding="none" className="overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 dark:border-slate-700/50 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25">
                    <CodeBracketIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Connect Repository
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {step === 'provider' && 'Select your Git provider'}
                      {step === 'repos' && 'Choose a repository'}
                      {step === 'branches' && 'Select branch and configure'}
                      {step === 'config' && 'Configure repository'}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </motion.button>
              </div>

              {/* Progress Steps */}
              <div className="flex items-center gap-2 mt-4">
                {['provider', 'repos', 'branches'].map((s, i) => (
                  <div key={s} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        step === s
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                          : ['provider', 'repos', 'branches'].indexOf(step) > i
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-200 dark:bg-slate-700 text-gray-500'
                      }`}
                    >
                      {['provider', 'repos', 'branches'].indexOf(step) > i ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    {i < 2 && (
                      <div
                        className={`w-12 h-1 mx-2 rounded-full ${
                          ['provider', 'repos', 'branches'].indexOf(step) > i
                            ? 'bg-emerald-500'
                            : 'bg-gray-200 dark:bg-slate-700'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-600 dark:text-red-400"
                  >
                    <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                    <button
                      onClick={() => setError(null)}
                      className="ml-auto p-1 hover:bg-red-500/10 rounded-lg"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                  </div>
                </div>
              )}

              {/* Step 1: Provider Selection */}
              {!isLoading && step === 'provider' && (
                <div className="grid grid-cols-2 gap-4">
                  {providers.map((p) => (
                    <motion.button
                      key={p.id}
                      variants={itemVariants}
                      whileHover={{ scale: p.available ? 1.02 : 1 }}
                      whileTap={{ scale: p.available ? 0.98 : 1 }}
                      onClick={() => p.available && handleProviderSelect(p.id)}
                      disabled={!p.available}
                      className={`relative p-6 rounded-xl border transition-all text-left ${
                        p.available
                          ? 'border-white/20 dark:border-slate-600 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer'
                          : 'border-gray-200 dark:border-slate-700 opacity-50 cursor-not-allowed'
                      } ${
                        provider === p.id
                          ? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500'
                          : 'bg-white/50 dark:bg-slate-800/50'
                      }`}
                    >
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${p.color} text-white w-fit mb-3`}>
                        {p.icon}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{p.name}</h3>
                      {!p.available && (
                        <span className="absolute top-2 right-2 text-xs bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Step 2: Repository List */}
              {!isLoading && step === 'repos' && (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search repositories..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  {/* Repository List */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {filteredRepos.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FolderIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No repositories found</p>
                      </div>
                    ) : (
                      filteredRepos.map((repo) => (
                        <motion.button
                          key={repo.id}
                          variants={itemVariants}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handleRepoSelect(repo)}
                          className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                            selectedRepo?.id === repo.id
                              ? 'bg-blue-500/10 border-blue-500'
                              : 'bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-slate-600 hover:border-blue-500/50'
                          }`}
                        >
                          <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700">
                            {repo.private ? (
                              <LockClosedIcon className="h-5 w-5 text-amber-500" />
                            ) : (
                              <GlobeAltIcon className="h-5 w-5 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                                {repo.full_name}
                              </h4>
                              {repo.private && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                                  Private
                                </span>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                                {repo.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <CodeBracketIcon className="h-3.5 w-3.5" />
                                {repo.default_branch}
                              </span>
                            </div>
                          </div>
                          <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        </motion.button>
                      ))
                    )}
                  </div>

                  {/* Refresh Button */}
                  <button
                    onClick={fetchRepositories}
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Refresh repositories
                  </button>
                </div>
              )}

              {/* Step 3: Branch Selection & Configuration */}
              {!isLoading && step === 'branches' && selectedRepo && (
                <div className="space-y-6">
                  {/* Selected Repo Info */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <CodeBracketIcon className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {selectedRepo.full_name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedRepo.clone_url}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Branch Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Branch
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto">
                      {branches.map((branch) => (
                        <motion.button
                          key={branch.name}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedBranch(branch.name)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selectedBranch === branch.name
                              ? 'bg-blue-500/10 border-blue-500'
                              : 'bg-white/50 dark:bg-slate-800/50 border-white/20 dark:border-slate-600 hover:border-blue-500/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <CodeBracketIcon className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {branch.name}
                            </span>
                            {branch.protected && (
                              <LockClosedIcon className="h-3.5 w-3.5 text-amber-500" />
                            )}
                            {branch.name === selectedRepo.default_branch && (
                              <StarIcon className="h-3.5 w-3.5 text-yellow-500" />
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Webhook Configuration */}
                  <div className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/20 dark:border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                          <BellIcon className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Auto-trigger on Push
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Create webhook to trigger pipeline on code push
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={webhookEnabled}
                          onChange={(e) => setWebhookEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual URL Configuration */}
              {!isLoading && step === 'config' && provider === 'manual' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Repository URL
                    </label>
                    <input
                      type="text"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      placeholder="https://github.com/user/repo.git"
                      className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      placeholder="main"
                      className="w-full px-4 py-2.5 bg-white/50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (step === 'repos') setStep('provider');
                  else if (step === 'branches') setStep('repos');
                  else if (step === 'config') setStep('provider');
                  else onClose();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {step === 'provider' ? 'Cancel' : 'Back'}
              </motion.button>

              {(step === 'branches' || (step === 'config' && provider === 'manual')) && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirm}
                  disabled={
                    (step === 'branches' && !selectedBranch) ||
                    (step === 'config' && !manualUrl)
                  }
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LinkIcon className="h-4 w-4" />
                  Connect Repository
                </motion.button>
              )}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
