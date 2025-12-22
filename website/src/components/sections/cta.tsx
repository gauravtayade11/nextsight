import Link from 'next/link';
import { ArrowRight, Github } from 'lucide-react';
import { Button } from '../ui/button';
import { GITHUB_URL } from '@/lib/constants';

export function CTA() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-900 dark:via-purple-900 dark:to-pink-900">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/30 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-white/30 blur-3xl"></div>
      </div>

      <div className="relative px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-white/90">
            Deploy NextSight AI in minutes with Docker Compose or Helm.
            Join hundreds of teams already managing their Kubernetes clusters smarter.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/docs/installation" className="group">
              <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 dark:bg-white dark:text-indigo-900 dark:hover:bg-gray-100 gap-x-2 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="group">
              <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 gap-x-2 hover:scale-105 transition-all">
                <Github className="h-5 w-5 transition-transform group-hover:rotate-12" />
                View on GitHub
              </Button>
            </Link>
          </div>
          <div className="mt-10 text-center">
            <p className="text-sm text-white/80">
              Free & Open Source · MIT License · No Credit Card Required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
