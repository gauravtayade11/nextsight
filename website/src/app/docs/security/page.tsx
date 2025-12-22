import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security Overview',
  description: 'Security features and best practices for NextSight AI.',
};

export default function SecurityPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Security Overview
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Comprehensive security features built into NextSight AI.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Security Features
            </h2>
            <ul className="space-y-3 list-disc list-inside">
              <li>
                <Link href="/docs/security/trivy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Trivy vulnerability scanning
                </Link>
              </li>
              <li>JWT-based authentication</li>
              <li>
                <Link href="/docs/security/rbac" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Role-based access control (RBAC)
                </Link>
              </li>
              <li>Encrypted data transmission (HTTPS/WSS)</li>
              <li>Kubernetes RBAC integration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Best Practices
            </h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>Use strong passwords and rotate credentials regularly</li>
              <li>Enable HTTPS in production environments</li>
              <li>Limit ServiceAccount permissions to minimum required</li>
              <li>Regularly update NextSight AI to latest version</li>
              <li>Monitor security scan results and address vulnerabilities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Reporting Security Issues
            </h2>
            <p>
              If you discover a security vulnerability, please report it to our{' '}
              <a
                href="https://github.com/gauravtayade11/nextsight/security"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                GitHub Security page
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
