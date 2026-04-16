/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/marvinlauportfolio',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
