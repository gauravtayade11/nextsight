import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about NextSight AI.',
};

export default function FAQPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Common questions about NextSight AI.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Is NextSight AI free?
            </h2>
            <p>
              Yes! NextSight AI is completely free and open-source under the MIT License. There are no paid tiers, no cluster limits, and no hidden costs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              What Kubernetes versions are supported?
            </h2>
            <p>
              NextSight AI supports Kubernetes 1.24+ and any CNCF-compliant distribution including EKS, GKE, AKS, K3s, and self-managed clusters.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Do I need to provide my own AI API key?
            </h2>
            <p>
              AI features are optional. You can use NextSight AI without AI capabilities. If you want to use the AI assistant, you'll need an API key for Gemini, Claude, or Groq.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              How many clusters can I connect?
            </h2>
            <p>
              Unlimited! There are no artificial limits on the number of clusters you can manage with NextSight AI.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Is my data sent to external servers?
            </h2>
            <p>
              No. NextSight AI is self-hosted and all your cluster data stays within your infrastructure. The only external connections are optional AI API calls if you enable AI features.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Can I use this in production?
            </h2>
            <p>
              Yes! NextSight AI is production-ready. We recommend following security best practices, using HTTPS, and setting strong passwords.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              How do I report bugs or request features?
            </h2>
            <p>
              Please open an issue on our{' '}
              <a
                href="https://github.com/gauravtayade11/nextsight/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                GitHub repository
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
