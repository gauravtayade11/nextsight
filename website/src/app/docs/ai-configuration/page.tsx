import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'AI Configuration',
  description: 'Configure AI providers for NextSight AI assistant.',
};

export default function AIConfigurationPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          AI Provider Configuration
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Configure AI providers (Gemini, Claude, Groq) for the AI assistant.
        </p>

        <div className="mt-12 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Google Gemini</CardTitle>
              <CardDescription>
                Configure Google Gemini API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gray-900 p-4">
                <pre className="text-sm text-gray-100 overflow-x-auto">
                  <code>{`AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anthropic Claude</CardTitle>
              <CardDescription>
                Configure Anthropic Claude API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gray-900 p-4">
                <pre className="text-sm text-gray-100 overflow-x-auto">
                  <code>{`AI_PROVIDER=claude
CLAUDE_API_KEY=your-claude-api-key`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Groq</CardTitle>
              <CardDescription>
                Configure Groq API for fast inference
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gray-900 p-4">
                <pre className="text-sm text-gray-100 overflow-x-auto">
                  <code>{`AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
