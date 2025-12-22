import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI Assistant',
  description: 'Use the AI-powered assistant for Kubernetes management.',
};

export default function AIFeaturePage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          AI Assistant
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Intelligent Kubernetes management with AI-powered insights and recommendations.
        </p>

        <div className="my-12 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10">
          <img
            src="/images/ai-assistant.png"
            alt="AI Assistant Screenshot"
            className="w-full h-auto"
          />
        </div>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Features
            </h2>
            <ul className="space-y-3 list-disc list-inside">
              <li>Natural language queries for cluster information</li>
              <li>Automated troubleshooting and diagnostics</li>
              <li>Security recommendations and best practices</li>
              <li>Resource optimization suggestions</li>
              <li>Log analysis and error detection</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Configuration
            </h2>
            <p>
              To enable the AI assistant, configure your AI provider in the{' '}
              <Link href="/docs/ai-configuration" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                AI Configuration
              </Link>{' '}
              settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Example Queries
            </h2>
            <div className="space-y-2">
              <p className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
                "Show me all pods with errors"
              </p>
              <p className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
                "Why is my deployment failing?"
              </p>
              <p className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
                "Optimize resource usage for namespace production"
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
