/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crypto-vision/pump-agent-swarm'],
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4200'}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
