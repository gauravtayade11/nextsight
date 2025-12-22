import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RBAC Setup',
  description: 'Configure Role-Based Access Control for NextSight AI.',
};

export default function RBACPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          RBAC Setup
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Configure Role-Based Access Control for secure multi-user access.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              User Roles
            </h2>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>Admin:</strong> Full access to all features and settings</li>
              <li><strong>Developer:</strong> Can view and manage resources</li>
              <li><strong>Viewer:</strong> Read-only access to dashboards</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Kubernetes RBAC
            </h2>
            <p>
              NextSight AI respects Kubernetes RBAC policies and requires appropriate ServiceAccount permissions to access cluster resources.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
