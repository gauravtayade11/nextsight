import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Troubleshooting',
  description: 'Common issues and solutions for NextSight AI.',
};

export default function TroubleshootingPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Troubleshooting
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Common issues and solutions for NextSight AI.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Cannot connect to cluster
            </h2>
            <p className="mb-2"><strong>Problem:</strong> NextSight AI cannot connect to Kubernetes cluster.</p>
            <p className="mb-2"><strong>Solution:</strong></p>
            <ul className="space-y-2 list-disc list-inside ml-4">
              <li>Verify kubeconfig is correctly mounted</li>
              <li>Check ServiceAccount has required permissions</li>
              <li>Ensure cluster is accessible from NextSight AI pod</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Database connection errors
            </h2>
            <p className="mb-2"><strong>Problem:</strong> Cannot connect to PostgreSQL database.</p>
            <p className="mb-2"><strong>Solution:</strong></p>
            <ul className="space-y-2 list-disc list-inside ml-4">
              <li>Verify DATABASE_URL environment variable</li>
              <li>Check PostgreSQL is running and accessible</li>
              <li>Ensure credentials are correct</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              AI assistant not responding
            </h2>
            <p className="mb-2"><strong>Problem:</strong> AI features not working.</p>
            <p className="mb-2"><strong>Solution:</strong></p>
            <ul className="space-y-2 list-disc list-inside ml-4">
              <li>Verify AI_PROVIDER is configured</li>
              <li>Check API key is valid and not expired</li>
              <li>Review backend logs for errors</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Security scans failing
            </h2>
            <p className="mb-2"><strong>Problem:</strong> Trivy scanning not working.</p>
            <p className="mb-2"><strong>Solution:</strong></p>
            <ul className="space-y-2 list-disc list-inside ml-4">
              <li>Check internet connectivity for CVE database updates</li>
              <li>Verify Trivy binary is accessible</li>
              <li>Review scan logs in backend</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
