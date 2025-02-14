/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'ssh2': false,
    }

    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    })

    return config
  },
  experimental: {
    serverActions: true,
  }
}

module.exports = nextConfig