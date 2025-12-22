import { Metadata } from 'next';
import { Bot, Shield, Terminal, Gauge, Cloud, Zap, BarChart3, Network, FileCode } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CTA } from '@/components/sections/cta';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Explore all the powerful features of NextSight AI, from AI-powered insights to built-in security scanning.',
};

const featureCategories = [
  {
    category: 'AI-Powered Features',
    icon: Bot,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
    image: '/images/ai-assistant.png',
    features: [
      {
        name: 'AI Chat Assistant',
        description: 'Ask questions about your cluster in plain English. Get intelligent responses with kubectl commands and actionable insights.',
      },
      {
        name: 'Proactive Insights',
        description: 'AI automatically analyzes your cluster and surfaces issues before they become incidents.',
      },
      {
        name: 'Smart Runbooks',
        description: 'Auto-generated incident response guides for common Kubernetes issues.',
      },
      {
        name: 'Workload Analysis',
        description: 'Deep analysis of deployments with health scoring and automated fix suggestions.',
      },
    ],
  },
  {
    category: 'Security Features',
    icon: Shield,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    image: '/images/security-dashboard.png',
    features: [
      {
        name: 'Trivy Vulnerability Scanning',
        description: 'Built-in container image vulnerability scanning. No external installation needed.',
      },
      {
        name: 'Security Dashboard',
        description: 'Comprehensive security analysis with A-F grading system and RBAC analysis.',
      },
      {
        name: 'AI Remediation',
        description: 'Step-by-step fixes for security issues explained in plain English.',
      },
      {
        name: 'Network Policy Coverage',
        description: 'Visualize and analyze your network security posture across namespaces.',
      },
    ],
  },
  {
    category: 'Developer Tools',
    icon: Terminal,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    image: '/images/terminal.png',
    features: [
      {
        name: 'Browser Terminals',
        description: 'Full kubectl and shell access in your browser with xterm.js support.',
      },
      {
        name: 'Pod Exec',
        description: 'Interactive PTY-based terminal sessions inside any container.',
      },
      {
        name: 'Debug Containers',
        description: 'Debug distroless images with ephemeral debug containers.',
      },
      {
        name: 'Real-time Logs',
        description: 'WebSocket-based log streaming with search and download capabilities.',
      },
    ],
  },
  {
    category: 'Deployment Tools',
    icon: FileCode,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
    image: '/images/helm-dashboard.png',
    features: [
      {
        name: 'Helm Catalog',
        description: 'Visual Helm chart catalog with one-click deployment from any repository.',
      },
      {
        name: 'YAML Deploy',
        description: 'Apply Kubernetes manifests with dry-run validation and deployment summary.',
      },
      {
        name: 'ArgoCD Integration',
        description: 'GitOps deployment tracking and management through ArgoCD.',
      },
      {
        name: 'Self-Service Portal',
        description: 'Empower developers to scale, restart, and rollback without kubectl access.',
      },
    ],
  },
  {
    category: 'Monitoring & Observability',
    icon: Gauge,
    color: 'text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30',
    image: '/images/kubernetes-workloads.png',
    features: [
      {
        name: 'Metrics Explorer',
        description: 'Explore Prometheus metrics with PromQL query builder and visualization.',
      },
      {
        name: 'Resource Metrics',
        description: 'CPU and memory utilization across nodes and pods with metrics-server integration.',
      },
      {
        name: 'Alerts Management',
        description: 'View and manage Prometheus alerts with firing status and history.',
      },
      {
        name: 'Event Timeline',
        description: 'Unified timeline of all cluster events and activities.',
      },
    ],
  },
  {
    category: 'Multi-Cluster & Scale',
    icon: Cloud,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30',
    image: '/images/cluster-management.png',
    features: [
      {
        name: 'Unlimited Clusters',
        description: 'Manage unlimited Kubernetes clusters from one dashboard. No enterprise pricing.',
      },
      {
        name: 'Cluster Switcher',
        description: 'Seamlessly switch between clusters with real-time status indicators.',
      },
      {
        name: 'Cluster Management UI',
        description: 'Add, remove, and configure clusters with kubeconfig discovery.',
      },
      {
        name: 'Multi-Cluster View',
        description: 'View aggregated metrics and status across all your clusters.',
      },
    ],
  },
  {
    category: 'Cost Optimization',
    icon: BarChart3,
    color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
    features: [
      {
        name: 'Cost Analysis',
        description: 'Per-namespace and per-pod cost breakdown with 30-day trends.',
      },
      {
        name: 'Resource Optimization',
        description: 'AI-powered recommendations for right-sizing over-provisioned workloads.',
      },
      {
        name: 'Idle Detection',
        description: 'Identify and eliminate idle resources wasting money.',
      },
      {
        name: 'Cost Projections',
        description: 'Monthly and annual cost projections based on current usage.',
      },
    ],
  },
  {
    category: 'Performance & Reliability',
    icon: Zap,
    color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30',
    features: [
      {
        name: 'Redis Caching',
        description: 'Intelligent caching with 60-second TTL for instant response times.',
      },
      {
        name: 'WebSocket Streaming',
        description: 'Real-time updates for logs, metrics, and terminal sessions.',
      },
      {
        name: 'Fast API',
        description: 'Built with FastAPI for high-performance backend operations.',
      },
      {
        name: 'React 18',
        description: 'Modern React with concurrent features for smooth UI experience.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            Everything you need to manage Kubernetes
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            From AI-powered insights to built-in security scanning, NextSight AI has everything you need
            to manage Kubernetes clusters efficiently. All features included, no paid tiers.
          </p>
        </div>
      </div>

      {/* Feature Categories */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
        <div className="space-y-24">
          {featureCategories.map((category, idx) => (
            <div key={category.category}>
              {/* Category Header */}
              <div className="flex items-center gap-x-4 mb-8">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${category.color}`}>
                  <category.icon className="h-6 w-6" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {category.category}
                </h2>
              </div>

              {/* Screenshot (if available) */}
              {category.image && (
                <div className="mb-12 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10">
                  <img
                    src={category.image}
                    alt={`${category.category} screenshot`}
                    className="w-full h-auto"
                  />
                </div>
              )}

              {/* Features Grid */}
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-2">
                {category.features.map((feature) => (
                  <Card key={feature.name} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-xl">{feature.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {idx < featureCategories.length - 1 && (
                <div className="mt-16 border-t border-gray-200 dark:border-gray-800" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <CTA />
    </div>
  );
}
