/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile lightweight-charts for proper bundling
  transpilePackages: ['lightweight-charts'],
}

module.exports = nextConfig
