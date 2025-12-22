/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: false,
    domains: ['raw.githubusercontent.com'],
  },
  // Enable static export if needed
  // output: 'export',
}

module.exports = nextConfig
