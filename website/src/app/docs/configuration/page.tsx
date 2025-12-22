import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Configuration',
  description: 'Configure NextSight AI environment variables and settings.',
};

export default function ConfigurationPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Configuration
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Configure NextSight AI with environment variables and settings.
        </p>

        <div className="mt-12 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>
                Configure these in your .env file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gray-900 p-4">
                <pre className="text-sm text-gray-100 overflow-x-auto">
                  <code>{`# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/nextsight

# JWT Secret
JWT_SECRET=your-secret-key-here

# AI Provider (optional)
AI_PROVIDER=gemini
GEMINI_API_KEY=your-api-key

# Kubernetes
KUBECONFIG_PATH=/path/to/kubeconfig`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Configuration Options
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Database Configuration</h3>
                <p>Configure PostgreSQL connection settings for data persistence.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Security Settings</h3>
                <p>Set JWT secrets and authentication parameters.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">AI Provider</h3>
                <p>Configure AI provider (Gemini, Claude, or Groq) with API keys.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
