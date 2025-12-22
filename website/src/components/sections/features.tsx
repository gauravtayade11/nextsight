import { Bot, Shield, Terminal, TrendingUp, Cloud, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const features = [
  {
    name: 'AI That Actually Helps',
    description: 'Ask questions in plain English. Get intelligent answers with kubectl commands and actionable insights.',
    icon: Bot,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
  },
  {
    name: 'Security-First, Built-In',
    description: 'Trivy scanning, RBAC analysis, and AI-powered remediation. No plugins needed, no separate installation.',
    icon: Shield,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  },
  {
    name: 'Browser Terminals',
    description: 'Full kubectl and shell access in your browser. No local setup required, debug distroless containers easily.',
    icon: Terminal,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  },
  {
    name: 'Cost Optimization',
    description: 'AI-powered resource recommendations. Stop wasting money on over-provisioned pods with smart insights.',
    icon: TrendingUp,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
  },
  {
    name: 'Multi-Cluster',
    description: 'Manage unlimited clusters from one dashboard. No enterprise pricing, no hidden costs, truly unlimited.',
    icon: Cloud,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30',
  },
  {
    name: 'Lightning Fast',
    description: 'Built with FastAPI and React. Real-time updates via WebSocket. Cached metrics for instant response.',
    icon: Zap,
    color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
  },
];

export function Features() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400">
            Everything you need
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Built for DevOps teams who ship fast
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Most Kubernetes dashboards show you what's wrong. NextSight AI shows you why it's wrong and how to fix it.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-8">
          {features.map((feature) => (
            <Card key={feature.name} className="hover:shadow-lg hover:ring-2 hover:ring-indigo-600 dark:hover:ring-indigo-400 transition-all">
              <CardHeader>
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${feature.color} mb-4`}>
                  <feature.icon className="h-6 w-6" />
                </div>
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
      </div>
    </div>
  );
}
