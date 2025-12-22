import { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Terminal } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Quick Start',
  description: 'Get started with NextSight AI in under 5 minutes.',
};

export default function QuickStartPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Quick Start Guide
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Get NextSight AI up and running in under 5 minutes.
        </p>

        <div className="mt-12 space-y-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Terminal className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                <CardTitle>1. Clone and Start</CardTitle>
              </div>
              <CardDescription>
                Clone the repository and start with Docker Compose
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gray-900 p-4">
                <pre className="text-sm text-gray-100 overflow-x-auto">
                  <code>{`git clone https://github.com/gauravtayade11/nextsight.git
cd nextsight
make dev`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                <CardTitle>2. Access the Dashboard</CardTitle>
              </div>
              <CardDescription>
                Open your browser and login
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                Navigate to <strong>http://localhost:3000</strong>
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                Default credentials: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">admin / admin123</code>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Next Steps</CardTitle>
              <CardDescription>
                Configure and customize your installation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li>
                  <Link href="/docs/configuration" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    Configure AI providers →
                  </Link>
                </li>
                <li>
                  <Link href="/docs/features/security" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    Enable security scanning →
                  </Link>
                </li>
                <li>
                  <Link href="/docs/features/clusters" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">
                    Add more clusters →
                  </Link>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
