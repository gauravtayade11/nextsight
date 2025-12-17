import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  RocketLaunchIcon,
  DocumentTextIcon,
  CubeIcon,
  ArrowPathRoundedSquareIcon,
  SparklesIcon,
  CodeBracketIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import YAMLDeployEnhanced from './YAMLDeployEnhanced';
import HelmDeploy from './HelmDeploy';
import ArgoCDDeploy from './ArgoCDDeploy';

// Import shared constants
import { containerVariants, itemVariants } from '../../utils/constants';

type DeployTab = 'yaml' | 'helm' | 'argocd';

interface Tab {
  id: DeployTab;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: string;
  features: string[];
}

const tabs: Tab[] = [
  {
    id: 'yaml',
    name: 'YAML',
    icon: DocumentTextIcon,
    description: 'Deploy Kubernetes manifests directly',
    badge: 'AI-Powered',
    features: ['Monaco Editor', 'AI Review', 'Validation'],
  },
  {
    id: 'helm',
    name: 'Helm',
    icon: CubeIcon,
    description: 'Package manager for Kubernetes',
    badge: 'Enhanced',
    features: ['Chart Install', 'Releases', 'Templates'],
  },
  {
    id: 'argocd',
    name: 'ArgoCD',
    icon: ArrowPathRoundedSquareIcon,
    description: 'GitOps continuous delivery',
    badge: 'GitOps',
    features: ['Auto Sync', 'Git Integration', 'Rollback'],
  },
];

// Local animation variants (extends shared patterns for this component)
const localContainerVariants = {
  ...containerVariants,
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};


export default function DeployDashboard() {
  const [activeTab, setActiveTab] = useState<DeployTab>('yaml');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'yaml':
        return <YAMLDeployEnhanced key="yaml-deploy" />;
      case 'helm':
        return <HelmDeploy key="helm-deploy" />;
      case 'argocd':
        return <ArgoCDDeploy key="argocd-deploy" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Enhanced Header - Sticky */}
      <motion.div
        variants={itemVariants}
        className="sticky top-0 z-30 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 bg-gradient-to-r from-slate-50/95 via-white/95 to-slate-50/95 dark:from-slate-900/95 dark:via-slate-900/95 dark:to-slate-900/95 backdrop-blur-md border-b border-gray-200/50 dark:border-slate-700/50 shadow-sm"
      >
        {/* Main Header Row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-3">
          {/* Title Section */}
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ rotate: 5, scale: 1.05 }}
              className="p-3 rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-purple-600 shadow-lg shadow-primary-500/25"
            >
              <RocketLaunchIcon className="h-7 w-7 text-white" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                  Deployment Center
                </h1>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gradient-to-r from-primary-500 to-purple-500 text-white"
                >
                  v1.4
                </motion.span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Deploy, manage, and monitor your Kubernetes applications
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 p-1.5 bg-white/60 dark:bg-slate-800/60 rounded-2xl backdrop-blur-md border border-gray-200/50 dark:border-slate-700/50 shadow-sm">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <div className="flex flex-col items-start">
                    <span>{tab.name}</span>
                    {tab.badge && (
                      <span className={`text-[10px] font-medium ${
                        isActive ? 'text-primary-100' : 'text-gray-400 dark:text-gray-500'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Active Tab Info Bar */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-primary-50/50 to-purple-50/50 dark:from-primary-900/10 dark:to-purple-900/10 border border-primary-200/30 dark:border-primary-800/30"
        >
          <div className="flex items-center gap-3">
            {(() => {
              const currentTab = tabs.find((t) => t.id === activeTab);
              const Icon = currentTab?.icon || DocumentTextIcon;
              return (
                <>
                  <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                    <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {currentTab?.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <SparklesIcon className="h-3.5 w-3.5 text-primary-500" />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {currentTab?.features.join(' • ')}
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-gray-200/50 dark:border-slate-700/50">
              <CodeBracketIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Ready
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-gray-200/50 dark:border-slate-700/50">
              <CloudArrowUpIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Connected
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderTabContent()}
      </motion.div>
    </motion.div>
  );
}
