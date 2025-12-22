import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Github, ArrowRight } from 'lucide-react';
import { GITHUB_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn about NextSight AI, our mission, and why we built the best free Kubernetes dashboard.',
};

export default function AboutPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            About NextSight AI
          </h1>

          <div className="mt-10 space-y-8 text-lg leading-8 text-gray-600 dark:text-gray-300">
            <p>
              <strong className="text-gray-900 dark:text-white">NextSight AI</strong> is a free, open-source Kubernetes management platform that brings
              the power of artificial intelligence to DevOps teams. We believe that Kubernetes management
              tools should be accessible to everyone, not just enterprises with deep pockets.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-12">Our Mission</h2>
            <p>
              Most Kubernetes dashboards show you <em>what's wrong</em>. NextSight AI shows you <em>why</em> it's
              wrong and <em>how</em> to fix it. We're building the most intelligent, user-friendly Kubernetes
              management platform that's completely free and open source.
            </p>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-12">Why We Built This</h2>
            <p>
              We were frustrated with the existing Kubernetes dashboards:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Lens costs money and limits clusters on the free tier</li>
              <li>k9s is powerful but CLI-only and has a steep learning curve</li>
              <li>The official Kubernetes Dashboard is basic and hard to deploy</li>
              <li>None of them have built-in AI or security scanning</li>
            </ul>

            <p className="mt-6">
              So we built NextSight AI with everything we wished existed:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>AI-powered insights</strong> that actually help you fix problems</li>
              <li><strong>Built-in security scanning</strong> with Trivy integration</li>
              <li><strong>Unlimited multi-cluster support</strong> with no paid tiers</li>
              <li><strong>Beautiful browser-based UI</strong> that's easy to use</li>
              <li><strong>100% free and open source</strong> under the MIT license</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-12">Open Source</h2>
            <p>
              NextSight AI is released under the MIT License. This means you can:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use it for any purpose, including commercial projects</li>
              <li>Modify it to fit your needs</li>
              <li>Distribute it freely</li>
              <li>Contribute back to make it better for everyone</li>
            </ul>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-12">Architecture</h2>
            <p>
              NextSight AI is built with a modern microservices architecture:
            </p>

            <div className="my-8 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10 bg-white dark:bg-gray-900 p-8">
              <img
                src="/images/architecture.svg"
                alt="NextSight AI Architecture Diagram"
                className="w-full h-auto"
              />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-12">Get Involved</h2>
            <p>
              We welcome contributions from the community! Whether you're fixing bugs, adding features,
              improving documentation, or just spreading the word, we'd love your help.
            </p>

            <div className="mt-10 flex items-center gap-x-6">
              <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="gap-x-2">
                  <Github className="h-5 w-5" />
                  Contribute on GitHub
                </Button>
              </Link>
              <Link href={`${GITHUB_URL}/discussions`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="gap-x-2">
                  Join Discussions
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
