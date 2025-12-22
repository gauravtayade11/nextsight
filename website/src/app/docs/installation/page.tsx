import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Package, Server } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Installation',
  description: 'Install NextSight AI using Docker Compose, Helm, or Kubernetes manifests.',
};

export default function InstallationPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24">
      <div className="mx-auto max-w-4xl px-6 lg:px-8 py-24 sm:py-32">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Installation Guide
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Get NextSight AI running in minutes with Docker Compose, Helm, or Kubernetes manifests.
        </p>

        <div className="mt-16 space-y-12">
          {/* Docker Compose */}
          <div id="docker-compose">
            <div className="flex items-center gap-x-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 text-blue-600">
                <Terminal className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Docker Compose (Recommended)</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Fastest way to get started locally</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Start</CardTitle>
                <CardDescription>
                  Clone the repository and start with a single command
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-gray-900 p-4">
                  <pre className="text-sm text-gray-100 overflow-x-auto">
                    <code>{`# Clone the repository
git clone https://github.com/gauravtayade11/nextsight.git
cd nextsight

# Start the application
make dev
# or
docker-compose up -d

# View logs
make logs`}</code>
                  </pre>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Access at <strong>http://localhost:3000</strong>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Default credentials: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">admin / admin123</code>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Helm */}
          <div id="helm">
            <div className="flex items-center gap-x-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Helm Chart</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">For Kubernetes clusters</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Helm Installation</CardTitle>
                <CardDescription>
                  Deploy to your Kubernetes cluster using Helm
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-gray-900 p-4">
                  <pre className="text-sm text-gray-100 overflow-x-auto">
                    <code>{`# Install from local chart
helm install nextsight ./charts/nextsight -n nextsight --create-namespace

# Install with custom values
helm install nextsight ./charts/nextsight -n nextsight --create-namespace \\
  --set ingress.enabled=true \\
  --set ingress.hosts[0].host=nextsight.example.com

# Upgrade existing installation
helm upgrade nextsight ./charts/nextsight -n nextsight

# Uninstall
helm uninstall nextsight -n nextsight`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Kubernetes */}
          <div id="kubernetes">
            <div className="flex items-center gap-x-4 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 text-purple-600">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Kubernetes Manifests</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Direct kubectl deployment</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>kubectl Deployment</CardTitle>
                <CardDescription>
                  Deploy using raw Kubernetes manifests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-gray-900 p-4">
                  <pre className="text-sm text-gray-100 overflow-x-auto">
                    <code>{`# Build images
make build-prod

# Deploy to cluster
make k8s-deploy

# Check status
make k8s-status

# Port forward for access
kubectl port-forward -n nextsight svc/nextsight-frontend 3000:80`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Prerequisites */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Prerequisites</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Required</h3>
                <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>Docker</strong> 20.10+ (for Docker Compose)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>kubectl</strong> 1.25+ (Kubernetes CLI)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>Kubernetes Cluster</strong> 1.24+ (any CNCF-compliant distribution)</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Optional (Recommended)</h3>
                <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>metrics-server</strong> - For pod/node CPU & memory metrics</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>Prometheus</strong> - For advanced monitoring & alerting</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>AI API Key</strong> - For Gemini, Claude, or Groq (optional)</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Built-in Tools (No Installation Required)</h3>
                <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span><strong>Trivy</strong> v0.58.0 - Container vulnerability scanning</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span><strong>kubectl</strong> - Kubernetes operations</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span><strong>helm</strong> - Helm chart management</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Next Steps</h2>
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                After installation, check out these guides:
              </p>
              <ul className="space-y-2">
                <li>
                  <a href="/docs/configuration" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    Configuration Guide →
                  </a>
                </li>
                <li>
                  <a href="/docs/features/ai" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    Set up AI Assistant →
                  </a>
                </li>
                <li>
                  <a href="/docs/features/security" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    Enable Security Scanning →
                  </a>
                </li>
                <li>
                  <a href="/docs/features/clusters" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    Add Multiple Clusters →
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
