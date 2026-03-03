/**
 * Sperax MCP Server - Plugin Delivery Tools
 *
 * Integration with SperaxOS Plugin Marketplace
 * Provides access to AI function call plugins for crypto/DeFi operations.
 *
 * API: https://plugin.delivery
 * Repository: https://github.com/nirholas/plugin.delivery
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

const PLUGIN_API_BASE = 'https://plugin.delivery';
const PLUGIN_GATEWAY = `${PLUGIN_API_BASE}/api/gateway`;

const PLUGIN_CATEGORIES = [
  'stocks-finance',
  'developer',
  'information',
  'media-generate',
  'science-education',
  'gaming',
  'lifestyle',
] as const;

// ============================================================================
// Types
// ============================================================================

interface PluginMeta {
  avatar: string;
  title: string;
  description: string;
  tags: string[];
  category?: string;
}

interface PluginApi {
  name: string;
  description: string;
  url?: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface PluginManifest {
  identifier: string;
  api: PluginApi[];
  meta: PluginMeta;
  gateway?: string;
  systemRole?: string;
  version?: string;
  author?: string;
}

interface PluginIndexItem {
  identifier: string;
  author: string;
  createdAt: string;
  homepage?: string;
  manifest: string;
  meta: PluginMeta;
  schemaVersion: number;
}

interface PluginIndex {
  schemaVersion: number;
  name: string;
  description: string;
  plugins: PluginIndexItem[];
}

interface GatewayResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fetchPluginIndex(): Promise<PluginIndex> {
  const response = await fetch(`${PLUGIN_API_BASE}/index.json`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SperaxOS-MCP/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch plugin index: ${response.status}`);
  }

  return response.json();
}

async function fetchPluginManifest(manifestUrl: string): Promise<PluginManifest> {
  const response = await fetch(manifestUrl, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SperaxOS-MCP/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch plugin manifest: ${response.status}`);
  }

  return response.json();
}

async function executePluginFunction(
  pluginId: string,
  functionName: string,
  args: Record<string, unknown>
): Promise<GatewayResponse> {
  const response = await fetch(PLUGIN_GATEWAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SperaxOS-MCP/1.0',
    },
    body: JSON.stringify({
      plugin: pluginId,
      function: functionName,
      arguments: args,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gateway error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// Input Schemas
// ============================================================================

const ListPluginsInput = z.object({
  category: z
    .enum(PLUGIN_CATEGORIES)
    .optional()
    .describe('Filter plugins by category'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Maximum number of plugins to return'),
});

const GetPluginInput = z.object({
  identifier: z
    .string()
    .min(1)
    .describe('Plugin identifier (e.g., "coingecko", "defillama")'),
});

const ExecuteFunctionInput = z.object({
  pluginId: z
    .string()
    .min(1)
    .describe('Plugin identifier'),
  functionName: z
    .string()
    .min(1)
    .describe('Function name to execute'),
  arguments: z
    .record(z.unknown())
    .optional()
    .default({})
    .describe('Arguments to pass to the function'),
});

const CoinGeckoPriceInput = z.object({
  coinId: z
    .string()
    .min(1)
    .describe('CoinGecko coin ID (e.g., "bitcoin", "ethereum", "sperax")'),
  currency: z
    .string()
    .optional()
    .default('usd')
    .describe('Target currency (default: usd)'),
});

const DefiLlamaProtocolInput = z.object({
  protocol: z
    .string()
    .optional()
    .describe('Protocol slug (e.g., "aave", "uniswap", "sperax")'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const pluginsTools = [
  {
    name: 'plugins_list',
    description:
      'List available SperaxOS plugins from plugin.delivery marketplace. Returns plugins with their capabilities, categories, and metadata.',
    inputSchema: ListPluginsInput,
    handler: async (params: z.infer<typeof ListPluginsInput>) => {
      try {
        const { category, limit } = params;
        const data = await fetchPluginIndex();
        
        let plugins = data.plugins || [];

        // Apply category filter
        if (category) {
          plugins = plugins.filter(p => 
            p.meta.category === category ||
            p.meta.tags.includes(category)
          );
        }

        // Limit results
        plugins = plugins.slice(0, limit);

        return {
          plugins: plugins.map(plugin => ({
            identifier: plugin.identifier,
            title: plugin.meta.title,
            description: plugin.meta.description,
            avatar: plugin.meta.avatar,
            tags: plugin.meta.tags,
            category: plugin.meta.category,
            author: plugin.author,
            homepage: plugin.homepage,
            manifestUrl: plugin.manifest,
          })),
          totalCount: plugins.length,
          marketplace: PLUGIN_API_BASE,
          categories: PLUGIN_CATEGORIES,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch plugins',
          plugins: [],
        };
      }
    },
  },

  {
    name: 'plugins_get_manifest',
    description:
      'Get detailed plugin manifest including all available functions, parameters, and configuration. Use this to understand what a plugin can do.',
    inputSchema: GetPluginInput,
    handler: async (params: z.infer<typeof GetPluginInput>) => {
      try {
        const { identifier } = params;
        
        // First get the manifest URL from index
        const index = await fetchPluginIndex();
        const plugin = (index.plugins || []).find(p => p.identifier === identifier);
        
        if (!plugin) {
          throw new Error(`Plugin '${identifier}' not found`);
        }

        // Fetch full manifest
        const manifest = await fetchPluginManifest(plugin.manifest);

        return {
          identifier: manifest.identifier,
          title: plugin.meta.title,
          description: plugin.meta.description,
          author: plugin.author,
          version: manifest.version,
          gateway: manifest.gateway,
          systemRole: manifest.systemRole,
          functions: manifest.api.map(api => ({
            name: api.name,
            description: api.description,
            parameters: api.parameters,
            url: api.url,
          })),
          meta: plugin.meta,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch plugin manifest',
          identifier: params.identifier,
        };
      }
    },
  },

  {
    name: 'plugins_execute',
    description:
      'Execute a plugin function through the SperaxOS gateway. Routes the request to the appropriate plugin API and returns the result.',
    inputSchema: ExecuteFunctionInput,
    handler: async (params: z.infer<typeof ExecuteFunctionInput>) => {
      try {
        const { pluginId, functionName, arguments: args } = params;
        const result = await executePluginFunction(pluginId, functionName, args);

        return {
          success: true,
          pluginId,
          function: functionName,
          result: result.data || result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to execute plugin function',
          pluginId: params.pluginId,
          function: params.functionName,
        };
      }
    },
  },

  {
    name: 'plugins_coingecko_price',
    description:
      'Get cryptocurrency price and market data from CoinGecko via the official plugin. Returns current price, market cap, volume, and 24h change.',
    inputSchema: CoinGeckoPriceInput,
    handler: async (params: z.infer<typeof CoinGeckoPriceInput>) => {
      try {
        const { coinId, currency } = params;
        
        // Direct API call to CoinGecko (free, no API key)
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency}&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'SperaxOS-MCP/1.0',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        const coinData = data[coinId];

        if (!coinData) {
          throw new Error(`Coin '${coinId}' not found`);
        }

        return {
          coinId,
          currency,
          price: coinData[currency],
          marketCap: coinData[`${currency}_market_cap`],
          volume24h: coinData[`${currency}_24h_vol`],
          change24h: coinData[`${currency}_24h_change`],
          fetchedAt: new Date().toISOString(),
          source: 'CoinGecko',
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch price',
          coinId: params.coinId,
        };
      }
    },
  },

  {
    name: 'plugins_defillama_tvl',
    description:
      'Get DeFi protocol TVL (Total Value Locked) and metrics from DefiLlama. Returns TVL, chain breakdown, and historical data.',
    inputSchema: DefiLlamaProtocolInput,
    handler: async (params: z.infer<typeof DefiLlamaProtocolInput>) => {
      try {
        const { protocol } = params;

        if (protocol) {
          // Get specific protocol data
          const response = await fetch(
            `https://api.llama.fi/protocol/${protocol}`,
            {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'SperaxOS-MCP/1.0',
              },
            }
          );

          if (!response.ok) {
            throw new Error(`DefiLlama API error: ${response.status}`);
          }

          const data = await response.json();

          return {
            protocol: data.name,
            slug: data.slug,
            tvl: data.tvl,
            tvlChange24h: data.change_1d,
            tvlChange7d: data.change_7d,
            chains: data.chains,
            chainTvls: data.chainTvls,
            category: data.category,
            url: data.url,
            twitter: data.twitter,
            fetchedAt: new Date().toISOString(),
            source: 'DefiLlama',
          };
        } else {
          // Get top protocols by TVL
          const response = await fetch(
            'https://api.llama.fi/protocols',
            {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'SperaxOS-MCP/1.0',
              },
            }
          );

          if (!response.ok) {
            throw new Error(`DefiLlama API error: ${response.status}`);
          }

          const data = await response.json();
          const topProtocols = data.slice(0, 20);

          return {
            topProtocols: topProtocols.map((p: Record<string, unknown>) => ({
              name: p.name,
              slug: p.slug,
              tvl: p.tvl,
              category: p.category,
              chains: p.chains,
            })),
            totalCount: data.length,
            fetchedAt: new Date().toISOString(),
            source: 'DefiLlama',
          };
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch TVL data',
          protocol: params.protocol,
        };
      }
    },
  },

  {
    name: 'plugins_search',
    description:
      'Search for plugins by keyword in the SperaxOS plugin marketplace. Finds plugins matching the search query in name, description, or tags.',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe('Search query'),
      limit: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .default(10)
        .describe('Maximum results'),
    }),
    handler: async (params: { query: string; limit?: number }) => {
      try {
        const { query, limit = 10 } = params;
        const data = await fetchPluginIndex();
        
        const normalizedQuery = query.toLowerCase();
        const matches = (data.plugins || []).filter(plugin => {
          const searchText = [
            plugin.identifier,
            plugin.meta.title,
            plugin.meta.description,
            ...plugin.meta.tags,
          ].join(' ').toLowerCase();
          
          return searchText.includes(normalizedQuery);
        }).slice(0, limit);

        return {
          query,
          results: matches.map(plugin => ({
            identifier: plugin.identifier,
            title: plugin.meta.title,
            description: plugin.meta.description,
            avatar: plugin.meta.avatar,
            tags: plugin.meta.tags,
          })),
          totalCount: matches.length,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to search plugins',
          query: params.query,
          results: [],
        };
      }
    },
  },
];
