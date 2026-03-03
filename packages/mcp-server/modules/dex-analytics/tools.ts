/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import Logger from "@/utils/logger.js"

// API Configuration
const DEXPAPRIKA_API_BASE = "https://api.dexpaprika.com"

/**
 * Generic API request helper for DexPaprika
 */
async function dexPaprikaRequest<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${DEXPAPRIKA_API_BASE}${endpoint}`)
    if (!response.ok) {
      if (response.status === 410) {
        throw new Error(
          "This endpoint has been permanently removed. Please use network-specific endpoints instead."
        )
      }
      if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Consider upgrading to a paid plan at https://docs.dexpaprika.com/"
        )
      }
      throw new Error(`API request failed with status ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    Logger.error("DexPaprika API error:", error)
    return null
  }
}

export function registerDexAnalyticsTools(server: McpServer) {
  // Get Networks (Required First Step)
  server.tool(
    "dex_get_networks",
    "REQUIRED FIRST STEP: Get all supported blockchain networks for DEX data. Always call this first to see available network IDs like 'ethereum', 'solana', 'arbitrum', etc.",
    {},
    async () => {
      const data = await dexPaprikaRequest("/networks")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch networks" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Network DEXes
  server.tool(
    "dex_get_network_dexes",
    "Get available DEXes on a specific network. First call dex_get_networks to see valid network IDs.",
    {
      network: z.string().describe("Network ID from dex_get_networks (e.g., 'ethereum', 'solana')"),
      page: z.number().optional().default(0).describe("Page number for pagination"),
      limit: z.number().optional().default(10).describe("Results per page (max 100)"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
      orderBy: z.enum(["pool"]).optional().describe("Order by field")
    },
    async (params) => {
      let endpoint = `/networks/${params.network}/dexes?page=${params.page}&limit=${params.limit}&sort=${params.sort}`
      if (params.orderBy) {
        endpoint += `&order_by=${params.orderBy}`
      }
      const data = await dexPaprikaRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch DEXes" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Network Pools (Primary Pool Function)
  server.tool(
    "dex_get_network_pools",
    "PRIMARY POOL FUNCTION: Get top liquidity pools on a specific network sorted by volume, price, or transactions. This is the main way to get pool data.",
    {
      network: z.string().describe("Network ID (e.g., 'ethereum', 'solana', 'arbitrum')"),
      page: z.number().optional().default(0).describe("Page number for pagination"),
      limit: z.number().optional().default(10).describe("Results per page (max 100)"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
      orderBy: z.enum(["volume_usd", "price_usd", "transactions", "last_price_change_usd_24h", "created_at"])
        .optional().default("volume_usd").describe("Field to order by")
    },
    async (params) => {
      const endpoint = `/networks/${params.network}/pools?page=${params.page}&limit=${params.limit}&sort=${params.sort}&order_by=${params.orderBy}`
      const data = await dexPaprikaRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get DEX Pools
  server.tool(
    "dex_get_dex_pools",
    "Get pools from a specific DEX on a network. First use dex_get_networks, then dex_get_network_dexes to find valid DEX IDs.",
    {
      network: z.string().describe("Network ID (e.g., 'ethereum')"),
      dex: z.string().describe("DEX identifier from dex_get_network_dexes (e.g., 'uniswap_v3')"),
      page: z.number().optional().default(0).describe("Page number"),
      limit: z.number().optional().default(10).describe("Results per page (max 100)"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
      orderBy: z.enum(["volume_usd", "price_usd", "transactions", "last_price_change_usd_24h", "created_at"])
        .optional().default("volume_usd").describe("Field to order by")
    },
    async (params) => {
      const endpoint = `/networks/${params.network}/dexes/${params.dex}/pools?page=${params.page}&limit=${params.limit}&sort=${params.sort}&order_by=${params.orderBy}`
      const data = await dexPaprikaRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch DEX pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Pool Details
  server.tool(
    "dex_get_pool_details",
    "Get detailed information about a specific liquidity pool including reserves, fees, and token information.",
    {
      network: z.string().describe("Network ID (e.g., 'ethereum')"),
      poolAddress: z.string().describe("Pool contract address"),
      inversed: z.boolean().optional().default(false).describe("Whether to invert the price ratio")
    },
    async (params) => {
      const endpoint = `/networks/${params.network}/pools/${params.poolAddress}?inversed=${params.inversed}`
      const data = await dexPaprikaRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch pool details" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Token Details
  server.tool(
    "dex_get_token_details",
    "Get detailed information about a token on a specific network including price, volume, and trading pairs.",
    {
      network: z.string().describe("Network ID (e.g., 'ethereum')"),
      tokenAddress: z.string().describe("Token contract address")
    },
    async (params) => {
      const endpoint = `/networks/${params.network}/tokens/${params.tokenAddress}`
      const data = await dexPaprikaRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch token details" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Token Pools
  server.tool(
    "dex_get_token_pools",
    "Get liquidity pools containing a specific token. Great for finding where a token is traded and its liquidity.",
    {
      network: z.string().describe("Network ID (e.g., 'ethereum')"),
      tokenAddress: z.string().describe("Token contract address"),
      page: z.number().optional().default(0).describe("Page number"),
      limit: z.number().optional().default(10).describe("Results per page (max 100)"),
      sort: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort order"),
      orderBy: z.enum(["volume_usd", "price_usd", "transactions", "last_price_change_usd_24h", "created_at"])
        .optional().default("volume_usd").describe("Field to order by"),
      reorder: z.boolean().optional().describe("Reorder so specified token is primary"),
      pairedWith: z.string().optional().describe("Filter pools paired with this token address")
    },
    async (params) => {
      let endpoint = `/networks/${params.network}/tokens/${params.tokenAddress}/pools?page=${params.page}&limit=${params.limit}&sort=${params.sort}&order_by=${params.orderBy}`
      if (params.reorder !== undefined) {
        endpoint += `&reorder=${params.reorder}`
      }
      if (params.pairedWith) {
        endpoint += `&address=${encodeURIComponent(params.pairedWith)}`
      }
      const data = await dexPaprikaRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch token pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Pool OHLCV (Historical Price Data)
  server.tool(
    "dex_get_pool_ohlcv",
    "Get historical OHLCV (Open, High, Low, Close, Volume) price data for a pool. Essential for price analysis, charting, and backtesting.",
    {
      network: z.string().describe("Network ID (e.g., 'ethereum')"),
      poolAddress: z.string().describe("Pool contract address"),
      start: z.string().describe("Start time (Unix timestamp, RFC3339, or yyyy-mm-dd)"),
      end: z.string().optional().describe("End time (max 1 year from start)"),
      limit: z.number().optional().default(100).describe("Number of data points (max 366)"),
      interval: z.enum(["1m", "5m", "10m", "15m", "30m", "1h", "6h", "12h", "24h"])
        .optional().default("24h").describe("Candle interval"),
      inversed: z.boolean().optional().default(false).describe("Invert price ratio")
    },
    async (params) => {
      let endpoint = `/networks/${params.network}/pools/${params.poolAddress}/ohlcv?start=${encodeURIComponent(params.start)}&interval=${params.interval}&limit=${params.limit}&inversed=${params.inversed}`
      if (params.end) {
        endpoint += `&end=${encodeURIComponent(params.end)}`
      }
      const data = await dexPaprikaRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch OHLCV data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Pool Transactions
  server.tool(
    "dex_get_pool_transactions",
    "Get recent transactions for a liquidity pool including swaps, adds, and removes.",
    {
      network: z.string().describe("Network ID (e.g., 'ethereum')"),
      poolAddress: z.string().describe("Pool contract address"),
      page: z.number().optional().default(0).describe("Page number (up to 100 pages)"),
      limit: z.number().optional().default(10).describe("Results per page (max 100)"),
      cursor: z.string().optional().describe("Transaction ID for cursor-based pagination")
    },
    async (params) => {
      let endpoint = `/networks/${params.network}/pools/${params.poolAddress}/transactions?page=${params.page}&limit=${params.limit}`
      if (params.cursor) {
        endpoint += `&cursor=${encodeURIComponent(params.cursor)}`
      }
      const data = await dexPaprikaRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch transactions" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Search
  server.tool(
    "dex_search",
    "Search across ALL networks for tokens, pools, and DEXes by name, symbol, or address. Good starting point when you don't know the specific network.",
    {
      query: z.string().min(1).describe("Search term (token name, symbol, or address)")
    },
    async (params) => {
      const sanitizedQuery = encodeURIComponent(params.query.trim())
      const data = await dexPaprikaRequest(`/search?query=${sanitizedQuery}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to search" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Stats
  server.tool(
    "dex_get_stats",
    "Get high-level statistics about the DexPaprika ecosystem: total networks, DEXes, pools, and tokens available.",
    {},
    async () => {
      const data = await dexPaprikaRequest("/stats")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch stats" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Multi Token Prices
  server.tool(
    "dex_get_multi_prices",
    "Get batched prices for multiple tokens on a specific network. Efficient for portfolio valuations.",
    {
      network: z.string().describe("Network ID (e.g., 'ethereum')"),
      tokens: z.array(z.string()).min(1).describe("Array of token contract addresses")
    },
    async (params) => {
      const tokensQuery = params.tokens.map(t => `tokens=${encodeURIComponent(t)}`).join("&")
      const endpoint = `/networks/${params.network}/multi/prices?${tokensQuery}`
      const data = await dexPaprikaRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch prices" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== GECKOTERMINAL API TOOLS ====================
  
  const GECKOTERMINAL_API_BASE = "https://api.geckoterminal.com/api/v2"
  
  async function geckoTerminalRequest<T>(endpoint: string): Promise<T | null> {
    try {
      const response = await fetch(`${GECKOTERMINAL_API_BASE}${endpoint}`, {
        headers: {
          "Accept": "application/json"
        }
      })
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("GeckoTerminal rate limit exceeded")
        }
        throw new Error(`API request failed with status ${response.status}`)
      }
      return (await response.json()) as T
    } catch (error) {
      Logger.error("GeckoTerminal API error:", error)
      return null
    }
  }

  // GeckoTerminal Networks
  server.tool(
    "geckoterminal_get_networks",
    "Get all blockchain networks supported by GeckoTerminal",
    {
      page: z.number().optional().default(1).describe("Page number")
    },
    async (params) => {
      const data = await geckoTerminalRequest(`/networks?page=${params.page}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch networks" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal DEXes on Network
  server.tool(
    "geckoterminal_get_dexes",
    "Get all DEXes on a specific network",
    {
      network: z.string().describe("Network ID (e.g., 'eth', 'bsc', 'polygon_pos')"),
      page: z.number().optional().default(1).describe("Page number")
    },
    async (params) => {
      const data = await geckoTerminalRequest(`/networks/${params.network}/dexes?page=${params.page}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch DEXes" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Trending Pools
  server.tool(
    "geckoterminal_trending_pools",
    "Get trending pools across all networks or on a specific network - hot new tokens and high activity pools",
    {
      network: z.string().optional().describe("Network ID (optional - omit for all networks)"),
      page: z.number().optional().default(1).describe("Page number")
    },
    async (params) => {
      const endpoint = params.network 
        ? `/networks/${params.network}/trending_pools?page=${params.page}`
        : `/networks/trending_pools?page=${params.page}`
      const data = await geckoTerminalRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch trending pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal New Pools
  server.tool(
    "geckoterminal_new_pools",
    "Get newly created pools across all networks or on a specific network - catch new token launches early",
    {
      network: z.string().optional().describe("Network ID (optional - omit for all networks)"),
      page: z.number().optional().default(1).describe("Page number")
    },
    async (params) => {
      const endpoint = params.network 
        ? `/networks/${params.network}/new_pools?page=${params.page}`
        : `/networks/new_pools?page=${params.page}`
      const data = await geckoTerminalRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch new pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Top Pools
  server.tool(
    "geckoterminal_top_pools",
    "Get top pools on a specific network by various metrics",
    {
      network: z.string().describe("Network ID (e.g., 'eth', 'bsc')"),
      page: z.number().optional().default(1).describe("Page number"),
      sort: z.enum(["h24_tx_count_desc", "h24_volume_usd_desc", "h24_volume_usd_asc"]).optional().default("h24_volume_usd_desc").describe("Sort order")
    },
    async (params) => {
      const data = await geckoTerminalRequest(`/networks/${params.network}/pools?page=${params.page}&sort=${params.sort}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch top pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Pool by Address
  server.tool(
    "geckoterminal_get_pool",
    "Get detailed information about a specific pool by address",
    {
      network: z.string().describe("Network ID"),
      poolAddress: z.string().describe("Pool contract address")
    },
    async (params) => {
      const data = await geckoTerminalRequest(`/networks/${params.network}/pools/${params.poolAddress}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch pool" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Multiple Pools
  server.tool(
    "geckoterminal_get_multi_pools",
    "Get information for multiple pools in a single request (up to 30)",
    {
      network: z.string().describe("Network ID"),
      poolAddresses: z.array(z.string()).min(1).max(30).describe("Array of pool addresses (max 30)")
    },
    async (params) => {
      const addresses = params.poolAddresses.join(",")
      const data = await geckoTerminalRequest(`/networks/${params.network}/pools/multi/${addresses}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Pool OHLCV
  server.tool(
    "geckoterminal_pool_ohlcv",
    "Get OHLCV (candlestick) data for a pool - essential for charting and technical analysis",
    {
      network: z.string().describe("Network ID"),
      poolAddress: z.string().describe("Pool contract address"),
      timeframe: z.enum(["day", "hour", "minute"]).default("hour").describe("Candle timeframe"),
      aggregate: z.number().optional().default(1).describe("Aggregate multiple periods (e.g., 4 for 4-hour candles)"),
      limit: z.number().optional().default(100).describe("Number of candles (max 1000)"),
      currency: z.enum(["usd", "token"]).optional().default("usd").describe("Price currency"),
      token: z.enum(["base", "quote"]).optional().default("base").describe("Which token to get OHLCV for")
    },
    async (params) => {
      const endpoint = `/networks/${params.network}/pools/${params.poolAddress}/ohlcv/${params.timeframe}?aggregate=${params.aggregate}&limit=${params.limit}&currency=${params.currency}&token=${params.token}`
      const data = await geckoTerminalRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch OHLCV data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Pool Trades
  server.tool(
    "geckoterminal_pool_trades",
    "Get recent trades for a pool - watch whale activity and trade flow",
    {
      network: z.string().describe("Network ID"),
      poolAddress: z.string().describe("Pool contract address"),
      tradeVolumeInUsdGreaterThan: z.number().optional().describe("Filter for trades above USD value")
    },
    async (params) => {
      let endpoint = `/networks/${params.network}/pools/${params.poolAddress}/trades`
      if (params.tradeVolumeInUsdGreaterThan) {
        endpoint += `?trade_volume_in_usd_greater_than=${params.tradeVolumeInUsdGreaterThan}`
      }
      const data = await geckoTerminalRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch trades" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Token Info
  server.tool(
    "geckoterminal_get_token",
    "Get detailed token information including price, market cap, and metadata",
    {
      network: z.string().describe("Network ID"),
      tokenAddress: z.string().describe("Token contract address")
    },
    async (params) => {
      const data = await geckoTerminalRequest(`/networks/${params.network}/tokens/${params.tokenAddress}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch token" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Multi Tokens
  server.tool(
    "geckoterminal_get_multi_tokens",
    "Get information for multiple tokens in a single request (up to 30)",
    {
      network: z.string().describe("Network ID"),
      tokenAddresses: z.array(z.string()).min(1).max(30).describe("Array of token addresses (max 30)")
    },
    async (params) => {
      const addresses = params.tokenAddresses.join(",")
      const data = await geckoTerminalRequest(`/networks/${params.network}/tokens/multi/${addresses}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch tokens" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Token Pools
  server.tool(
    "geckoterminal_token_pools",
    "Get top pools for a specific token - find liquidity and trading venues",
    {
      network: z.string().describe("Network ID"),
      tokenAddress: z.string().describe("Token contract address"),
      page: z.number().optional().default(1).describe("Page number"),
      sort: z.enum(["h24_tx_count_desc", "h24_volume_usd_desc"]).optional().default("h24_volume_usd_desc").describe("Sort order")
    },
    async (params) => {
      const data = await geckoTerminalRequest(`/networks/${params.network}/tokens/${params.tokenAddress}/pools?page=${params.page}&sort=${params.sort}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch token pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Token Info from Pool
  server.tool(
    "geckoterminal_pool_tokens_info",
    "Get detailed information about both tokens in a pool",
    {
      network: z.string().describe("Network ID"),
      poolAddress: z.string().describe("Pool contract address")
    },
    async (params) => {
      const data = await geckoTerminalRequest(`/networks/${params.network}/pools/${params.poolAddress}/info`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch pool tokens info" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal DEX Pools
  server.tool(
    "geckoterminal_dex_pools",
    "Get pools for a specific DEX on a network",
    {
      network: z.string().describe("Network ID"),
      dex: z.string().describe("DEX ID (e.g., 'uniswap_v3', 'sushiswap')"),
      page: z.number().optional().default(1).describe("Page number"),
      sort: z.enum(["h24_tx_count_desc", "h24_volume_usd_desc"]).optional().default("h24_volume_usd_desc").describe("Sort order")
    },
    async (params) => {
      const data = await geckoTerminalRequest(`/networks/${params.network}/dexes/${params.dex}/pools?page=${params.page}&sort=${params.sort}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch DEX pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Search Pools
  server.tool(
    "geckoterminal_search_pools",
    "Search for pools across all networks by token name, symbol, or address",
    {
      query: z.string().min(1).describe("Search query (token name, symbol, or address)"),
      network: z.string().optional().describe("Limit search to specific network (optional)"),
      page: z.number().optional().default(1).describe("Page number")
    },
    async (params) => {
      let endpoint = `/search/pools?query=${encodeURIComponent(params.query)}&page=${params.page}`
      if (params.network) {
        endpoint += `&network=${params.network}`
      }
      const data = await geckoTerminalRequest(endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to search pools" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // GeckoTerminal Global DEX Stats  
  server.tool(
    "geckoterminal_global_dex_stats",
    "Get global DEX trading statistics and market overview",
    {},
    async () => {
      // GeckoTerminal doesn't have a direct global stats endpoint, but we can get network-level stats
      const networks = await geckoTerminalRequest<{ data: { id: string }[] }>("/networks")
      if (!networks) {
        return { content: [{ type: "text" as const, text: "Failed to fetch global stats" }] }
      }
      
      // Return top 10 networks with their pool counts
      return { content: [{ type: "text" as const, text: JSON.stringify({
        networks: networks.data?.slice(0, 10),
        note: "Use specific network endpoints for detailed stats"
      }, null, 2) }] }
    }
  )

  // GeckoTerminal Simple Token Price
  server.tool(
    "geckoterminal_simple_token_price",
    "Get simple token price by address - quick price lookup",
    {
      network: z.string().describe("Network ID"),
      tokenAddresses: z.array(z.string()).min(1).max(30).describe("Token addresses (max 30)")
    },
    async (params) => {
      const addresses = params.tokenAddresses.join(",")
      const data = await geckoTerminalRequest(`/simple/networks/${params.network}/token_price/${addresses}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch token prices" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
