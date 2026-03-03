/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compress responses
  compress: true,

  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // Changed from DENY to allow PWA features
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // Service Worker headers
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        // Manifest headers
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
      {
        // PWA assets headers
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Splash screen headers
        source: '/splash/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes - CORS and caching
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
          {
            key: 'X-RateLimit-Policy',
            value: 'fair-use',
          },
        ],
      },
    ];
  },
  // Disable x-powered-by header
  poweredByHeader: false,

  // Enable React strict mode
  reactStrictMode: true,

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Experimental features for better performance
  experimental: {
    // Enable optimized loading of CSS
    optimizeCss: true,
    // Limit concurrent static page generation to avoid API rate limits
    staticGenerationMaxConcurrency: 1,
  },

  // Reduce bundle size
  modularizeImports: {
    lodash: {
      transform: 'lodash/{{member}}',
    },
  },

  // URL redirects for SEO
  async redirects() {
    return [
      // Redirect old article IDs to search (for unknown old URLs)
      // Note: Specific redirects are handled in the article page itself
      
      // Common URL variations
      {
        source: '/articles/:id',
        destination: '/article/:id',
        permanent: true,
      },
      {
        source: '/coins/:id',
        destination: '/coin/:id',
        permanent: true,
      },
      {
        source: '/categories/:slug',
        destination: '/category/:slug',
        permanent: true,
      },
      {
        source: '/topics/:slug',
        destination: '/topic/:slug',
        permanent: true,
      },
      {
        source: '/sources/:slug',
        destination: '/source/:slug',
        permanent: true,
      },
      // Trailing slash normalization
      {
        source: '/blog/',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/api/',
        destination: '/developers',
        permanent: true,
      },
      {
        source: '/docs/',
        destination: '/developers',
        permanent: true,
      },
    ];
  },

  // URL rewrites for cleaner URLs
  async rewrites() {
    return {
      beforeFiles: [
        // Allow coins to be accessed by symbol (e.g., /coin/btc)
        {
          source: '/c/:symbol',
          destination: '/coin/:symbol',
        },
        // Short article URLs
        {
          source: '/a/:id',
          destination: '/article/:id',
        },
      ],
    };
  },
};
module.exports = nextConfig;