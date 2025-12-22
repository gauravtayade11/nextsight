import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Multi-Cluster Management',
  description: 'Manage multiple Kubernetes clusters from a single dashboard.',
};

export default function ClustersFeaturePage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Multi-Cluster Management
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Manage multiple Kubernetes clusters from a single unified dashboard.
        </p>

        <div className="my-12 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10">
          <img
            src="/images/cluster-management.png"
            alt="Multi-Cluster Management Screenshot"
            className="w-full h-auto"
          />
        </div>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Features
            </h2>
            <ul className="space-y-3 list-disc list-inside">
              <li>Connect unlimited Kubernetes clusters</li>
              <li>Switch between clusters seamlessly</li>
              <li>Unified resource view across all clusters</li>
              <li>Cross-cluster search and filtering</li>
              <li>Aggregate metrics and monitoring</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Adding a Cluster
            </h2>
            <div className="rounded-lg bg-gray-900 p-4">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                <code>{`# Add cluster configuration to kubeconfig
kubectl config use-context your-cluster-name

# NextSight AI automatically detects all contexts
# from your kubeconfig file`}</code>
              </pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Supported Platforms
            </h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>Amazon EKS</li>
              <li>Google GKE</li>
              <li>Azure AKS</li>
              <li>Self-managed Kubernetes</li>
              <li>K3s, MicroK8s, Minikube</li>
              <li>Any CNCF-compliant distribution</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
