export default function BlogPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Blog
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Stay updated with the latest news, tutorials, and insights about NextSight AI and Kubernetes management.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Blog posts coming soon! Follow us on{' '}
              <a
                href="https://twitter.com/nextsightai"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
              >
                Twitter
              </a>
              {' '}for updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
