/**
 * Dynamic Sitemap Generation
 * Generates sitemap for all routes including dynamic coin pages
 * Uses sitemap index for large number of coins
 */

import { MetadataRoute } from 'next';

const BASE_URL = 'https://crypto-data-aggregator.vercel.app';

// Extended list of top coins for better SEO coverage (top 100+)
const TOP_COINS = [
  // Top 50 by market cap
  'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana',
  'ripple', 'usd-coin', 'cardano', 'dogecoin', 'avalanche-2',
  'polkadot', 'chainlink', 'polygon', 'litecoin', 'uniswap',
  'bitcoin-cash', 'stellar', 'cosmos', 'monero', 'ethereum-classic',
  'filecoin', 'internet-computer', 'hedera-hashgraph', 'vechain', 'near',
  'algorand', 'fantom', 'the-sandbox', 'decentraland', 'axie-infinity',
  'tezos', 'theta-token', 'elrond-erd-2', 'aave', 'compound-governance-token',
  'maker', 'curve-dao-token', 'sushi', 'pancakeswap-token', 'yearn-finance',
  // Additional popular coins (51-100)
  'shiba-inu', 'wrapped-bitcoin', 'tron', 'leo-token', 'okb',
  'dai', 'aptos', 'optimism', 'arbitrum', 'immutable-x',
  'injective-protocol', 'thorchain', 'the-graph', 'render-token', 'fetch-ai',
  'lido-dao', 'rocket-pool', 'gmx', 'frax', 'just',
  'sui', 'sei-network', 'celestia', 'blur', 'dydx',
  'pepe', 'floki', 'bonk', 'kaspa', 'mina-protocol',
  'stacks', 'conflux-token', 'enjincoin', 'gala', 'flow',
  'quant-network', 'kava', 'neo', 'zilliqa', 'iota',
  'eos', 'klaytn', 'xdc-network', 'chiliz', 'helium',
  // DeFi protocols
  'lido-staked-ether', 'rocket-pool-eth', 'frax-ether', 'coinbase-wrapped-staked-eth',
  '1inch', 'synthetix-network-token', 'balancer', 'convex-finance', 'ribbon-finance',
  // Layer 2s & Scaling
  'matic-network', 'loopring', 'metis-token', 'boba-network', 'zksync',
  // Gaming & Metaverse
  'illuvium', 'stepn', 'apecoin', 'magic', 'treasure-tokens',
];

// Topics for enhanced SEO
const TOPICS = [
  'bitcoin-etf', 'ethereum-etf', 'stablecoin', 'regulation', 'hack',
  'institutional', 'layer2', 'airdrop', 'mining', 'ai', 'gaming',
  'exchange', 'whale',
];

// News categories
const CATEGORIES = [
  'bitcoin',
  'ethereum',
  'defi',
  'nft',
  'regulation',
  'altcoins',
  'markets',
  'technology',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // AI Agent Discovery files
  const aiDiscoveryRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/llms.txt`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/llms-full.txt`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/agents.json`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/.well-known/ai-plugin.json`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/.well-known/mcp.json`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/schema.json`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/humans.txt`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'always',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/markets`,
      lastModified: now,
      changeFrequency: 'always',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/markets/trending`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/markets/gainers`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/markets/losers`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/defi`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/movers`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sentiment`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/trending`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/compare`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/screener`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/heatmap`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/buzz`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/calculator`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/gas`,
      lastModified: now,
      changeFrequency: 'always',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/dominance`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/correlation`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/liquidations`,
      lastModified: now,
      changeFrequency: 'always',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/portfolio`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/watchlist`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/docs/api`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // Dynamic coin routes
  const coinRoutes: MetadataRoute.Sitemap = TOP_COINS.map((coinId) => ({
    url: `${BASE_URL}/coin/${coinId}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.7,
  }));

  // Category routes
  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((category) => ({
    url: `${BASE_URL}/category/${category}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.6,
  }));

  // Topic routes for enhanced SEO
  const topicRoutes: MetadataRoute.Sitemap = TOPICS.map((topic) => ({
    url: `${BASE_URL}/topic/${topic}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.6,
  }));

  // Blog routes (static pages)
  const blogRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
  ];

  // Additional high-value pages
  const additionalRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/topics`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/sources`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    },
  ];

  return [
    ...aiDiscoveryRoutes,
    ...staticRoutes,
    ...coinRoutes,
    ...categoryRoutes,
    ...topicRoutes,
    ...blogRoutes,
    ...additionalRoutes,
  ];
}
