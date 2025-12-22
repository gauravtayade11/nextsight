import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trivy Scanning',
  description: 'Container vulnerability scanning with Trivy.',
};

export default function TrivyPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Trivy Scanning
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Automated container image vulnerability scanning with Trivy v0.58.0.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              What is Trivy?
            </h2>
            <p>
              Trivy is a comprehensive security scanner that detects vulnerabilities in container images, file systems, and configuration files. NextSight AI includes Trivy v0.58.0 built-in.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Scanning Features
            </h2>
            <ul className="space-y-3 list-disc list-inside">
              <li>CVE detection for OS packages</li>
              <li>Application dependency scanning</li>
              <li>Misconfiguration detection</li>
              <li>Secret scanning</li>
              <li>License detection</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Automatic Scanning
            </h2>
            <p>
              NextSight AI automatically scans all container images in your clusters. Scan results are displayed in the Security Dashboard with severity levels (CRITICAL, HIGH, MEDIUM, LOW).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Configuration
            </h2>
            <p>
              Trivy scanning is enabled by default. Configure scan frequency and severity thresholds in the settings panel.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
