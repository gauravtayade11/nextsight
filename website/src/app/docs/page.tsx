import { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Book, Rocket, Settings, Code, Shield, HelpCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Complete guide to installing, configuring, and using NextSight AI for Kubernetes management.',
};

const docSections = [
  {
    title: 'Getting Started',
    description: 'Quick start guides and installation instructions',
    icon: Rocket,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    links: [
      { name: 'Installation', href: '/docs/installation' },
      { name: 'Quick Start', href: '/docs/quickstart' },
      { name: 'Architecture', href: '/docs/architecture' },
    ],
  },
  {
    title: 'Configuration',
    description: 'Configure NextSight AI for your environment',
    icon: Settings,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
    links: [
      { name: 'Environment Variables', href: '/docs/configuration' },
      { name: 'AI Providers', href: '/docs/ai-configuration' },
      { name: 'RBAC Setup', href: '/docs/rbac' },
    ],
  },
  {
    title: 'Features',
    description: 'Learn about all NextSight AI features',
    icon: Book,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    links: [
      { name: 'AI Assistant', href: '/docs/features/ai' },
      { name: 'Security Dashboard', href: '/docs/features/security' },
      { name: 'Multi-Cluster', href: '/docs/features/clusters' },
    ],
  },
  {
    title: 'API Reference',
    description: 'REST API and WebSocket documentation',
    icon: Code,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
    links: [
      { name: 'REST API', href: '/docs/api/rest' },
      { name: 'WebSocket API', href: '/docs/api/websocket' },
      { name: 'Authentication', href: '/docs/api/auth' },
    ],
  },
  {
    title: 'Security',
    description: 'Security best practices and scanning',
    icon: Shield,
    color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
    links: [
      { name: 'Security Overview', href: '/docs/security' },
      { name: 'Trivy Scanning', href: '/docs/security/trivy' },
      { name: 'RBAC Policies', href: '/docs/security/rbac' },
    ],
  },
  {
    title: 'Troubleshooting',
    description: 'Common issues and solutions',
    icon: HelpCircle,
    color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
    links: [
      { name: 'Common Issues', href: '/docs/troubleshooting' },
      { name: 'FAQ', href: '/docs/faq' },
      { name: 'Support', href: '/docs/support' },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            Documentation
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Everything you need to know about installing, configuring, and using NextSight AI.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            <a
              href="https://gauravtayade11.github.io/nextsight/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="gap-2">
                <Book className="h-5 w-5" />
                View Full Documentation
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>

          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Complete interactive documentation with search, code examples, and detailed guides
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {docSections.map((section) => (
            <Card key={section.title} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${section.color} mb-4`}>
                  <section.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                      >
                        {link.name} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mt-24 border-t border-gray-200 dark:border-gray-800 pt-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Popular Topics</h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link href="/docs/installation" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    How to install with Docker Compose →
                  </Link>
                </li>
                <li>
                  <Link href="/docs/installation#helm" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    How to deploy with Helm →
                  </Link>
                </li>
                <li>
                  <Link href="/docs/configuration" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    How to configure AI providers →
                  </Link>
                </li>
                <li>
                  <Link href="/docs/features/security" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    How to use security scanning →
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Need Help?</h2>
              <p className="mt-4 text-gray-600 dark:text-gray-300">
                Can't find what you're looking for? Join our community for help.
              </p>
              <ul className="mt-4 space-y-3">
                <li>
                  <a
                    href="https://github.com/gauravtayade11/nextsight/discussions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                  >
                    Ask on GitHub Discussions →
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/gauravtayade11/nextsight/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                  >
                    Report an issue →
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
