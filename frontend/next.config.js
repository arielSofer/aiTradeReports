/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile lightweight-charts for proper bundling
  transpilePackages: ['lightweight-charts'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:8000/api/v1/:path*'
          : 'https://tradetracker-api.onrender.com/api/v1/:path*',
      },
      {
        source: '/api/market-data',
        destination: '/api/market-data',
      }
    ]
  },
}

module.exports = nextConfig
