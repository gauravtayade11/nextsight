import Link from 'next/link';
import { Github, Twitter, Linkedin } from 'lucide-react';
import { APP_NAME, SOCIAL_LINKS, GITHUB_URL } from '@/lib/constants';

const navigation = {
  product: [
    { name: 'Features', href: '/features' },
    { name: 'Documentation', href: '/docs' },
    { name: 'GitHub', href: GITHUB_URL },
  ],
  support: [
    { name: 'Community', href: `${GITHUB_URL}/discussions` },
    { name: 'Issues', href: `${GITHUB_URL}/issues` },
    { name: 'Security', href: `${GITHUB_URL}/security` },
  ],
  company: [
    { name: 'About', href: '/about' },
    { name: 'Blog', href: '/blog' },
  ],
  legal: [
    { name: 'License', href: `${GITHUB_URL}/blob/main/LICENSE` },
    { name: 'Privacy', href: '/privacy' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-16 sm:pt-24 lg:px-8 lg:pt-32">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8">
            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">{APP_NAME}</span>
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
              AI-powered Kubernetes management platform. Free & Open Source.
            </p>
            <div className="flex space-x-6">
              <a href={SOCIAL_LINKS.github} className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400" target="_blank" rel="noopener noreferrer">
                <span className="sr-only">GitHub</span>
                <Github className="h-6 w-6" />
              </a>
              <a href={SOCIAL_LINKS.twitter} className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400" target="_blank" rel="noopener noreferrer">
                <span className="sr-only">Twitter</span>
                <Twitter className="h-6 w-6" />
              </a>
              <a href={SOCIAL_LINKS.linkedin} className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400" target="_blank" rel="noopener noreferrer">
                <span className="sr-only">LinkedIn</span>
                <Linkedin className="h-6 w-6" />
              </a>
            </div>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">Product</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.product.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href} className="text-sm leading-6 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">Support</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.support.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href} className="text-sm leading-6 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">Company</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.company.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href} className="text-sm leading-6 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">Legal</h3>
                <ul role="list" className="mt-6 space-y-4">
                  {navigation.legal.map((item) => (
                    <li key={item.name}>
                      <Link href={item.href} className="text-sm leading-6 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-16 border-t border-gray-900/10 dark:border-gray-700/30 pt-8 sm:mt-20 lg:mt-24">
          <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} {APP_NAME}. Released under the MIT License.
          </p>
          <p className="mt-4 text-xs leading-5 text-gray-400 dark:text-gray-500">
            Kubernetes, Lens, k9s, and other product names mentioned on this site are trademarks of their respective owners.
            All trademarks and registered trademarks are the property of their respective owners.
          </p>
        </div>
      </div>
    </footer>
  );
}
