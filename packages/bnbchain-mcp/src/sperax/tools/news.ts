/**
 * Sperax MCP Server - Crypto News Tools
 *
 * Integration with Free Crypto News API
 * Aggregates real-time news from 7 major crypto news sources:
 * CoinDesk, The Block, Decrypt, CoinTelegraph, Bitcoin Magazine, Blockworks, The Defiant
 *
 * API: https://free-crypto-news.vercel.app
 * Repository: https://github.com/speraxos/crypto-news
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

const NEWS_API_BASE = 'https://free-crypto-news.vercel.app';

const NEWS_SOURCES = [
  'coindesk',
  'theblock',
  'decrypt',
  'cointelegraph',
  'bitcoinmagazine',
  'blockworks',
  'defiant',
] as const;

const SOURCE_INFO = {
  coindesk: { name: 'CoinDesk', category: 'general', emoji: '🟠' },
  theblock: { name: 'The Block', category: 'general', emoji: '🔵' },
  decrypt: { name: 'Decrypt', category: 'general', emoji: '🟢' },
  cointelegraph: { name: 'CoinTelegraph', category: 'general', emoji: '🟡' },
  bitcoinmagazine: { name: 'Bitcoin Magazine', category: 'bitcoin', emoji: '🟤' },
  blockworks: { name: 'Blockworks', category: 'general', emoji: '🟣' },
  defiant: { name: 'The Defiant', category: 'defi', emoji: '🔴' },
} as const;

// ============================================================================
// Types
// ============================================================================

interface NewsArticle {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  source: string;
  sourceKey: string;
  category: string;
  timeAgo: string;
}

interface NewsResponse {
  articles: NewsArticle[];
  totalCount: number;
  sources: string[];
  fetchedAt: string;
}

interface SourceInfo {
  key: string;
  name: string;
  url: string;
  category: string;
  status: 'active' | 'unavailable';
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fetchNews(endpoint: string): Promise<NewsResponse> {
  const response = await fetch(`${NEWS_API_BASE}${endpoint}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SperaxOS-MCP/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`News API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function formatArticleForDisplay(article: NewsArticle): string {
  const sourceEmoji = SOURCE_INFO[article.sourceKey as keyof typeof SOURCE_INFO]?.emoji || '📰';
  return `${sourceEmoji} **${article.title}**\n   _${article.source} • ${article.timeAgo}_\n   ${article.link}`;
}

// ============================================================================
// Input Schemas
// ============================================================================

const GetNewsInput = z.object({
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum number of articles to return'),
  source: z
    .enum(NEWS_SOURCES)
    .optional()
    .describe('Filter by specific news source'),
});

const SearchNewsInput = z.object({
  keywords: z
    .string()
    .min(1)
    .describe('Comma-separated keywords to search for (e.g., "bitcoin,etf" or "ethereum,merge")'),
  limit: z
    .number()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe('Maximum number of results'),
});

const GetDefiNewsInput = z.object({
  limit: z
    .number()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe('Maximum number of articles'),
});

const GetBitcoinNewsInput = z.object({
  limit: z
    .number()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe('Maximum number of articles'),
});

const GetBreakingNewsInput = z.object({
  limit: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Maximum number of articles'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const newsTools = [
  {
    name: 'news_get_latest',
    description:
      'Get the latest cryptocurrency news from 7 major sources: CoinDesk, The Block, Decrypt, CoinTelegraph, Bitcoin Magazine, Blockworks, and The Defiant. No API key required.',
    inputSchema: GetNewsInput,
    handler: async (params: z.infer<typeof GetNewsInput>) => {
      try {
        const { limit, source } = params;
        let endpoint = `/api/news?limit=${limit}`;
        if (source) {
          endpoint += `&source=${source}`;
        }

        const data = await fetchNews(endpoint);

        return {
          articles: data.articles.map(article => ({
            title: article.title,
            link: article.link,
            description: article.description,
            source: article.source,
            sourceKey: article.sourceKey,
            category: article.category,
            timeAgo: article.timeAgo,
            pubDate: article.pubDate,
          })),
          totalCount: data.totalCount,
          sources: data.sources,
          fetchedAt: data.fetchedAt,
          filter: source || 'all',
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch news',
          articles: [],
        };
      }
    },
  },

  {
    name: 'news_search',
    description:
      'Search crypto news by keywords across all 7 sources. Useful for finding news about specific topics, tokens, protocols, or events.',
    inputSchema: SearchNewsInput,
    handler: async (params: z.infer<typeof SearchNewsInput>) => {
      try {
        const { keywords, limit } = params;
        const encodedKeywords = encodeURIComponent(keywords);
        const data = await fetchNews(`/api/search?q=${encodedKeywords}&limit=${limit}`);

        return {
          query: keywords,
          articles: data.articles.map(article => ({
            title: article.title,
            link: article.link,
            description: article.description,
            source: article.source,
            timeAgo: article.timeAgo,
            relevance: article.title.toLowerCase().includes(keywords.toLowerCase().split(',')[0]) 
              ? 'high' 
              : 'medium',
          })),
          totalCount: data.totalCount,
          sources: data.sources,
          fetchedAt: data.fetchedAt,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to search news',
          query: params.keywords,
          articles: [],
        };
      }
    },
  },

  {
    name: 'news_get_defi',
    description:
      'Get DeFi-specific news covering yield farming, DEXs, lending protocols, liquidity pools, and decentralized finance developments.',
    inputSchema: GetDefiNewsInput,
    handler: async (params: z.infer<typeof GetDefiNewsInput>) => {
      try {
        const { limit } = params;
        const data = await fetchNews(`/api/defi?limit=${limit}`);

        return {
          category: 'DeFi',
          articles: data.articles.map(article => ({
            title: article.title,
            link: article.link,
            description: article.description,
            source: article.source,
            timeAgo: article.timeAgo,
          })),
          totalCount: data.totalCount,
          sources: data.sources,
          fetchedAt: data.fetchedAt,
          topics: ['yield farming', 'DEXs', 'lending', 'liquidity', 'AMMs', 'protocols', 'TVL'],
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch DeFi news',
          articles: [],
        };
      }
    },
  },

  {
    name: 'news_get_bitcoin',
    description:
      'Get Bitcoin-specific news including BTC price movements, mining, Lightning Network, ordinals, inscriptions, and Bitcoin ecosystem developments.',
    inputSchema: GetBitcoinNewsInput,
    handler: async (params: z.infer<typeof GetBitcoinNewsInput>) => {
      try {
        const { limit } = params;
        const data = await fetchNews(`/api/bitcoin?limit=${limit}`);

        return {
          category: 'Bitcoin',
          articles: data.articles.map(article => ({
            title: article.title,
            link: article.link,
            description: article.description,
            source: article.source,
            timeAgo: article.timeAgo,
          })),
          totalCount: data.totalCount,
          sources: data.sources,
          fetchedAt: data.fetchedAt,
          topics: ['BTC', 'mining', 'Lightning Network', 'halving', 'ordinals', 'inscriptions'],
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch Bitcoin news',
          articles: [],
        };
      }
    },
  },

  {
    name: 'news_get_breaking',
    description:
      'Get breaking crypto news from the last 2 hours. Use this for time-sensitive updates and recent market-moving events.',
    inputSchema: GetBreakingNewsInput,
    handler: async (params: z.infer<typeof GetBreakingNewsInput>) => {
      try {
        const { limit } = params;
        const data = await fetchNews(`/api/breaking?limit=${limit}`);

        return {
          category: 'Breaking',
          timeWindow: 'Last 2 hours',
          articles: data.articles.map(article => ({
            title: article.title,
            link: article.link,
            description: article.description,
            source: article.source,
            timeAgo: article.timeAgo,
            pubDate: article.pubDate,
            isBreaking: true,
          })),
          totalCount: data.totalCount,
          sources: data.sources,
          fetchedAt: data.fetchedAt,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch breaking news',
          articles: [],
        };
      }
    },
  },

  {
    name: 'news_get_sources',
    description:
      'Get information about all available news sources including their names, categories, and current status.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const response = await fetch(`${NEWS_API_BASE}/api/sources`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'SperaxOS-MCP/1.0',
          },
        });

        if (!response.ok) {
          // Fallback to static data if API fails
          return {
            sources: Object.entries(SOURCE_INFO).map(([key, info]) => ({
              key,
              name: info.name,
              category: info.category,
              emoji: info.emoji,
              status: 'active',
            })),
            totalSources: Object.keys(SOURCE_INFO).length,
            apiBase: NEWS_API_BASE,
          };
        }

        const data = await response.json();
        return {
          sources: data.sources,
          totalSources: data.sources.length,
          apiBase: NEWS_API_BASE,
        };
      } catch (error) {
        // Fallback to static data
        return {
          sources: Object.entries(SOURCE_INFO).map(([key, info]) => ({
            key,
            name: info.name,
            category: info.category,
            emoji: info.emoji,
            status: 'active',
          })),
          totalSources: Object.keys(SOURCE_INFO).length,
          apiBase: NEWS_API_BASE,
        };
      }
    },
  },

  {
    name: 'news_get_sperax',
    description:
      'Search for news specifically about Sperax protocol, USDs stablecoin, SPA token, and related ecosystem developments.',
    inputSchema: z.object({
      limit: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe('Maximum number of articles'),
    }),
    handler: async (params: { limit?: number }) => {
      try {
        const { limit = 10 } = params;
        // Search for Sperax-related news
        const data = await fetchNews(`/api/search?q=sperax,usds,arbitrum stablecoin&limit=${limit}`);

        return {
          query: 'Sperax ecosystem',
          keywords: ['sperax', 'usds', 'spa token', 'arbitrum stablecoin'],
          articles: data.articles.map(article => ({
            title: article.title,
            link: article.link,
            description: article.description,
            source: article.source,
            timeAgo: article.timeAgo,
          })),
          totalCount: data.totalCount,
          fetchedAt: data.fetchedAt,
          note: 'Includes news mentioning Sperax, USDs, and related terms',
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch Sperax news',
          articles: [],
        };
      }
    },
  },
];
