import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RBAC Policies',
  description: 'Kubernetes RBAC integration and policies.',
};

export default function RBACPoliciesPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          RBAC Policies
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Kubernetes Role-Based Access Control integration and policy management.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              ServiceAccount Permissions
            </h2>
            <p>
              NextSight AI requires a ServiceAccount with appropriate RBAC permissions to access Kubernetes resources.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Required Permissions
            </h2>
            <div className="rounded-lg bg-gray-900 p-4">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                <code>{`apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: nextsight-viewer
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]`}</code>
              </pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Policy Best Practices
            </h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>Grant minimum required permissions (principle of least privilege)</li>
              <li>Use namespaced roles when possible instead of cluster-wide</li>
              <li>Regularly audit RBAC policies</li>
              <li>Separate read and write permissions</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
