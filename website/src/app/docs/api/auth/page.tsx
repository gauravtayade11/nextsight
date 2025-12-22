import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication',
  description: 'API authentication with JWT tokens.',
};

export default function AuthAPIPage() {
  return (
    <div className="bg-white dark:bg-gray-950 pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Authentication
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Secure API access with JWT token authentication.
        </p>

        <div className="mt-10 space-y-8 text-gray-600 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Login
            </h2>
            <p className="mb-4">Obtain a JWT token by logging in with credentials.</p>
            <div className="rounded-lg bg-gray-900 p-4">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                <code>{`POST /api/v1/auth/login

{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer"
}`}</code>
              </pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Using Tokens
            </h2>
            <p className="mb-4">Include the token in the Authorization header for all requests.</p>
            <div className="rounded-lg bg-gray-900 p-4">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                <code>{`Authorization: Bearer eyJhbGc...`}</code>
              </pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Token Expiration
            </h2>
            <p>
              JWT tokens expire after 24 hours. Request a new token by logging in again.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
