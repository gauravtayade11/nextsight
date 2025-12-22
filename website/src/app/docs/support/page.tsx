import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Get help and support for NextSight AI.',
};

export default function SupportPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Support
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Get help with NextSight AI from our community and contributors.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Community Support
            </h2>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://github.com/gauravtayade11/nextsight/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  GitHub Discussions →
                </a>
                <p className="mt-1">Ask questions and get help from the community</p>
              </li>
              <li>
                <a
                  href="https://github.com/gauravtayade11/nextsight/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  GitHub Issues →
                </a>
                <p className="mt-1">Report bugs and request features</p>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Documentation
            </h2>
            <p>
              Browse our comprehensive documentation for guides, tutorials, and API reference.
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside ml-4">
              <li>
                <a href="/docs/installation" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Installation Guide
                </a>
              </li>
              <li>
                <a href="/docs/quickstart" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Quick Start
                </a>
              </li>
              <li>
                <a href="/docs/troubleshooting" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Troubleshooting
                </a>
              </li>
              <li>
                <a href="/docs/faq" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  FAQ
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Contributing
            </h2>
            <p>
              NextSight AI is open-source and we welcome contributions! Check out our{' '}
              <a
                href="https://github.com/gauravtayade11/nextsight"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                GitHub repository
              </a>{' '}
              to get started.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Response Time
            </h2>
            <p>
              As an open-source project, support is provided by volunteers. Response times may vary. For urgent issues, please clearly mark them in GitHub Issues.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
