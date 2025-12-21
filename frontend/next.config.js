/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile lightweight-charts for proper bundling
  transpilePackages: ['lightweight-charts'],
  async rewrites() {
    return []
  },
}

module.exports = nextConfig
