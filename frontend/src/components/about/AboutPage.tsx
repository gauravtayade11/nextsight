import { motion } from 'framer-motion';
import {
  InformationCircleIcon,
  SparklesIcon,
  CodeBracketIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  RocketLaunchIcon,
  HeartIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '../common/PageHeader';

const features = [
  {
    icon: CpuChipIcon,
    name: 'Kubernetes Management',
    description: 'Full lifecycle management of Kubernetes clusters, workloads, and resources.',
  },
  {
    icon: SparklesIcon,
    name: 'AI-Powered Insights',
    description: 'Intelligent recommendations for optimization, security, and cost management.',
  },
  {
    icon: ShieldCheckIcon,
    name: 'Security Center',
    description: 'Comprehensive security scanning and vulnerability management.',
  },
  {
    icon: RocketLaunchIcon,
    name: 'GitOps Deployments',
    description: 'Seamless integration with ArgoCD, Helm, and CI/CD pipelines.',
  },
];

const techStack = [
  { name: 'React', version: '18.x' },
  { name: 'TypeScript', version: '5.x' },
  { name: 'Tailwind CSS', version: '3.x' },
  { name: 'FastAPI', version: '0.109.x' },
  { name: 'Python', version: '3.11+' },
  { name: 'Kubernetes Client', version: '28.x' },
];

export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="About NextSight AI"
        description="AI-Driven Kubernetes & DevOps Management Platform"
        icon={InformationCircleIcon}
        iconColor="primary"
      />

      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden p-8 rounded-2xl bg-gradient-to-br from-blue-500/10 via-primary-500/10 to-purple-500/10 border border-primary-500/20"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative flex items-start gap-6">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 via-primary-500 to-purple-600 shadow-xl shadow-primary-500/30"
          >
            <SparklesIcon className="h-10 w-10 text-white" />
          </motion.div>
          <div className="flex-1">
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-primary-500 to-purple-600 bg-clip-text text-transparent mb-2"
            >
              NextSight AI
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-gray-600 dark:text-gray-300 mb-4"
            >
              A comprehensive platform for managing Kubernetes clusters with AI-powered insights,
              GitOps workflows, and enterprise-grade security. Designed to simplify DevOps operations
              while providing deep visibility into your infrastructure.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-4"
            >
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-primary-500/20 text-primary-600 dark:text-primary-400">
                v1.4.0
              </span>
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Stable Release
              </span>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Features Grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Key Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                  <feature.icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    {feature.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50"
      >
        <div className="flex items-center gap-2 mb-4">
          <CodeBracketIcon className="h-5 w-5 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Technology Stack
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {techStack.map((tech) => (
            <span
              key={tech.name}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {tech.name} <span className="text-gray-400 dark:text-gray-500">{tech.version}</span>
            </span>
          ))}
        </div>
      </motion.div>

      {/* Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.a
          href="https://github.com/nexsight/nexsight-ai"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-4 p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 hover:border-primary-500/50 transition-colors"
        >
          <div className="p-3 rounded-xl bg-gray-900 dark:bg-gray-700">
            <CodeBracketIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">GitHub Repository</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">View source code and contribute</p>
          </div>
        </motion.a>

        <motion.a
          href="https://docs.nexsight.ai"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-4 p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-700/50 hover:border-primary-500/50 transition-colors"
        >
          <div className="p-3 rounded-xl bg-blue-500">
            <GlobeAltIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Documentation</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Learn how to use NextSight AI</p>
          </div>
        </motion.a>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center py-6"
      >
        <p className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          Built with <HeartIcon className="h-4 w-4 text-red-500" /> by the NextSight Team
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          &copy; {new Date().getFullYear()} NextSight AI. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
