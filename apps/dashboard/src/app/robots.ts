/**
 * Robots.txt Configuration
 * Controls search engine crawling behavior
 */

import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://crypto-data-aggregator.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/', // Don't crawl API routes
          '/_next/', // Don't crawl Next.js internals
          '/admin/', // Don't crawl admin (if exists)
        ],
      },
      // AI Agent Crawlers - Allow full access for discoverability
      {
        userAgent: 'GPTBot',
        allow: ['/', '/llms.txt', '/llms-full.txt', '/agents.json', '/.well-known/'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: ['/', '/llms.txt', '/llms-full.txt', '/agents.json', '/.well-known/'],
      },
      {
        userAgent: 'Claude-Web',
        allow: ['/', '/llms.txt', '/llms-full.txt', '/agents.json', '/.well-known/'],
      },
      {
        userAgent: 'Anthropic-AI',
        allow: ['/', '/llms.txt', '/llms-full.txt', '/agents.json', '/.well-known/'],
      },
      {
        userAgent: 'Cohere-AI',
        allow: ['/', '/llms.txt', '/llms-full.txt', '/agents.json', '/.well-known/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/llms.txt', '/llms-full.txt', '/agents.json', '/.well-known/'],
      },
      {
        userAgent: 'x402-agent',
        allow: ['/', '/llms.txt', '/llms-full.txt', '/agents.json', '/.well-known/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
