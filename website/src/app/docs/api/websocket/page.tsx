import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WebSocket API',
  description: 'Real-time updates via WebSocket connections.',
};

export default function WebSocketAPIPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          WebSocket API
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Real-time updates and notifications via WebSocket connections.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Connection
            </h2>
            <div className="rounded-lg bg-gray-900 p-4">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                <code>{`ws://localhost:8000/ws?token=<your-jwt-token>`}</code>
              </pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Message Types
            </h2>
            <ul className="space-y-3 list-disc list-inside">
              <li><strong>pod_update:</strong> Pod status changes</li>
              <li><strong>deployment_update:</strong> Deployment changes</li>
              <li><strong>security_alert:</strong> New security vulnerabilities</li>
              <li><strong>metric_update:</strong> Real-time metrics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Example Usage
            </h2>
            <div className="rounded-lg bg-gray-900 p-4">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                <code>{`const ws = new WebSocket('ws://localhost:8000/ws?token=' + token);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};`}</code>
              </pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
