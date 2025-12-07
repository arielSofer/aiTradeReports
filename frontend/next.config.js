/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile lightweight-charts for proper bundling
  transpilePackages: ['lightweight-charts'],
  // Static export for GitHub Pages
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Disable trailing slash for GitHub Pages
  trailingSlash: false,
  // Base path for GitHub Pages (will be set in workflow)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
}

module.exports = nextConfig
