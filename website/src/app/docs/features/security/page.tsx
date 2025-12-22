import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security Dashboard',
  description: 'Built-in security scanning with Trivy for container vulnerabilities.',
};

export default function SecurityFeaturePage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Security Dashboard
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Built-in security scanning with Trivy for comprehensive vulnerability detection.
        </p>

        <div className="my-12 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10">
          <img
            src="/images/security-dashboard.png"
            alt="Security Dashboard Screenshot"
            className="w-full h-auto"
          />
        </div>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Features
            </h2>
            <ul className="space-y-3 list-disc list-inside">
              <li>Automated container image vulnerability scanning</li>
              <li>CVE detection and severity classification</li>
              <li>Real-time security alerts</li>
              <li>Compliance reporting</li>
              <li>Integration with CI/CD pipelines</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Trivy Integration
            </h2>
            <p>
              NextSight AI includes Trivy v0.58.0 for comprehensive security scanning. No additional installation required.
            </p>
            <p className="mt-4">
              Learn more about{' '}
              <Link href="/docs/security/trivy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Trivy scanning configuration
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Vulnerability Severity Levels
            </h2>
            <ul className="space-y-2">
              <li><span className="font-semibold text-red-600 dark:text-red-400">CRITICAL:</span> Immediate action required</li>
              <li><span className="font-semibold text-orange-600 dark:text-orange-400">HIGH:</span> Should be addressed soon</li>
              <li><span className="font-semibold text-yellow-600 dark:text-yellow-400">MEDIUM:</span> Address when possible</li>
              <li><span className="font-semibold text-blue-600 dark:text-blue-400">LOW:</span> Informational</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
