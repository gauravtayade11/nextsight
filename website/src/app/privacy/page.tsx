export default function PrivacyPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Overview
              </h2>
              <p>
                NextSight AI is an open-source Kubernetes management platform. This privacy policy explains how we handle data when you use our software and visit our website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Data Collection
              </h2>
              <p>
                As an open-source, self-hosted solution, NextSight AI does not collect or transmit any of your Kubernetes cluster data to external servers. All data remains within your infrastructure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Website Analytics
              </h2>
              <p>
                Our website may use privacy-friendly analytics to understand how visitors use our site. We do not use tracking cookies or collect personally identifiable information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Third-Party Services
              </h2>
              <p>
                Our website is hosted on standard web infrastructure. We use GitHub for code hosting and issue tracking. Please refer to GitHub's privacy policy for information about data they collect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Your Rights
              </h2>
              <p>
                Since NextSight AI is self-hosted and open-source, you have complete control over your data. You can inspect, modify, or delete any data stored by the application at any time.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Contact
              </h2>
              <p>
                For questions about this privacy policy, please open an issue on our{' '}
                <a
                  href="https://github.com/gauravtayade11/nextsight/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                >
                  GitHub repository
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
