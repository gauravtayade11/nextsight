import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'REST API',
  description: 'NextSight AI REST API documentation.',
};

export default function RestAPIPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          REST API
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Complete REST API documentation for NextSight AI.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Base URL
            </h2>
            <div className="rounded-lg bg-gray-900 p-4">
              <pre className="text-sm text-gray-100">
                <code>http://localhost:8000/api/v1</code>
              </pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Authentication
            </h2>
            <p>All API requests require JWT authentication via the Authorization header.</p>
            <div className="mt-4 rounded-lg bg-gray-900 p-4">
              <pre className="text-sm text-gray-100">
                <code>Authorization: Bearer &lt;your-jwt-token&gt;</code>
              </pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Endpoints
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">GET /clusters</h3>
                <p>List all connected Kubernetes clusters</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">GET /pods</h3>
                <p>Get all pods across clusters</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">GET /security/scan</h3>
                <p>Trigger security scan for images</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
