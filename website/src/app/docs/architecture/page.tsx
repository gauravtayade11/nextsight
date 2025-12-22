import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Architecture',
  description: 'NextSight AI architecture and system design.',
};

export default function ArchitecturePage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Architecture
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Understanding NextSight AI's system architecture and components.
        </p>

        <div className="my-12 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10 bg-white dark:bg-gray-900 p-8">
          <img
            src="/images/architecture.svg"
            alt="NextSight AI Architecture Diagram"
            className="w-full h-auto"
          />
        </div>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              System Overview
            </h2>
            <p>
              NextSight AI is built with a modern microservices architecture, consisting of a React frontend, FastAPI backend, and PostgreSQL database.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Components
            </h2>
            <ul className="space-y-3 list-disc list-inside">
              <li><strong>Frontend:</strong> React with TypeScript, Tailwind CSS</li>
              <li><strong>Backend:</strong> Python FastAPI with async support</li>
              <li><strong>Database:</strong> PostgreSQL for data persistence</li>
              <li><strong>Security Scanner:</strong> Trivy for vulnerability scanning</li>
              <li><strong>AI Integration:</strong> Support for multiple AI providers (Gemini, Claude, Groq)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Data Flow
            </h2>
            <p>
              The system uses Kubernetes API for cluster management, WebSockets for real-time updates, and JWT for authentication.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
