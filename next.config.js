/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/terminal',
        destination: '/api/terminal',
        has: [
          {
            type: 'header',
            key: 'upgrade',
            value: '(?i)websocket'
          }
        ]
      }
    ]
  },
  async headers() {
    return [
      {
        source: '/api/terminal',
        headers: [
          {
            key: 'Upgrade',
            value: 'websocket'
          },
          {
            key: 'Connection',
            value: 'Upgrade'
          }
        ]
      }
    ]
  },
  webpack: (config, { isServer }) => {
    // Configuration pour les modules natifs
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false
      }
    }

    // Loader pour les fichiers binaires
    config.module.rules.push({
      test: /\.node$/,
      loader: 'node-loader',
      options: {
        name: '[name].[ext]'
      }
    })

    return config
  }
}

module.exports = nextConfig