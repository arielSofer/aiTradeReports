/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile lightweight-charts for proper bundling
  transpilePackages: ['lightweight-charts'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:8000/api/:path*'
          : '/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig
