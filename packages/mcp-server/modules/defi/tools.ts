/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import Logger from "@/utils/logger.js"

// DefiLlama API - Free, no key required
const DEFILLAMA_API = "https://api.llama.fi"
const DEFILLAMA_YIELDS_API = "https://yields.llama.fi"
const DEFILLAMA_COINS_API = "https://coins.llama.fi"
const DEFILLAMA_STABLECOINS_API = "https://stablecoins.llama.fi"

/**
 * Generic API request helper for DefiLlama
 */
async function defiLlamaRequest<T>(baseUrl: string, endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    Logger.error("DefiLlama API error:", error)
    return null
  }
}

export function registerDefiTools(server: McpServer) {
  // ==================== PROTOCOL TVL ====================

  server.tool(
    "defi_get_protocols",
    "Get list of all DeFi protocols with TVL, chains, and categories. Returns comprehensive protocol data sorted by TVL.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/protocols")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch protocols" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_protocol",
    "Get detailed information about a specific DeFi protocol including TVL breakdown by chain, token, and historical data.",
    {
      protocol: z.string().describe("Protocol slug (e.g., 'aave', 'uniswap', 'lido')")
    },
    async ({ protocol }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/protocol/${protocol}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch protocol: ${protocol}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_protocol_tvl",
    "Get historical TVL data for a protocol.",
    {
      protocol: z.string().describe("Protocol slug")
    },
    async ({ protocol }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/tvl/${protocol}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch TVL for: ${protocol}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== CHAIN TVL ====================

  server.tool(
    "defi_get_chains",
    "Get TVL data for all blockchain networks. Shows total DeFi TVL on each chain.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/v2/chains")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch chains" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_chain_tvl",
    "Get historical TVL data for a specific blockchain.",
    {
      chain: z.string().describe("Chain name (e.g., 'Ethereum', 'Arbitrum', 'BSC')")
    },
    async ({ chain }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/v2/historicalChainTvl/${chain}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch chain TVL: ${chain}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_chain_protocols",
    "Get all protocols on a specific chain with their TVL.",
    {
      chain: z.string().describe("Chain name (e.g., 'Ethereum', 'Arbitrum')")
    },
    async ({ chain }) => {
      // Get all protocols and filter by chain
      const data = await defiLlamaRequest<any[]>(DEFILLAMA_API, "/protocols")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch protocols" }] }
      }
      
      const chainProtocols = data
        .filter((p: any) => p.chains?.includes(chain))
        .map((p: any) => ({
          name: p.name,
          slug: p.slug,
          tvl: p.tvl,
          chainTvls: p.chainTvls?.[chain],
          category: p.category,
          change_1d: p.change_1d,
          change_7d: p.change_7d
        }))
        .sort((a: any, b: any) => (b.chainTvls || 0) - (a.chainTvls || 0))
        .slice(0, 50)

      return { content: [{ type: "text" as const, text: JSON.stringify(chainProtocols, null, 2) }] }
    }
  )

  // ==================== YIELDS ====================

  server.tool(
    "defi_get_yields",
    "Get yield/APY data for DeFi pools across all protocols. Filter by chain, project, or minimum TVL.",
    {
      chain: z.string().optional().describe("Filter by chain (e.g., 'Ethereum', 'Arbitrum')"),
      project: z.string().optional().describe("Filter by project (e.g., 'aave', 'compound')"),
      minTvl: z.number().optional().describe("Minimum TVL in USD"),
      minApy: z.number().optional().describe("Minimum APY percentage")
    },
    async ({ chain, project, minTvl, minApy }) => {
      const data = await defiLlamaRequest<{ data: any[] }>(DEFILLAMA_YIELDS_API, "/pools")
      if (!data?.data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch yields" }] }
      }

      let pools = data.data

      // Apply filters
      if (chain) {
        pools = pools.filter((p: any) => p.chain?.toLowerCase() === chain.toLowerCase())
      }
      if (project) {
        pools = pools.filter((p: any) => p.project?.toLowerCase() === project.toLowerCase())
      }
      if (minTvl) {
        pools = pools.filter((p: any) => p.tvlUsd >= minTvl)
      }
      if (minApy) {
        pools = pools.filter((p: any) => p.apy >= minApy)
      }

      // Sort by APY and limit results
      pools = pools
        .sort((a: any, b: any) => (b.apy || 0) - (a.apy || 0))
        .slice(0, 100)
        .map((p: any) => ({
          pool: p.pool,
          chain: p.chain,
          project: p.project,
          symbol: p.symbol,
          tvlUsd: p.tvlUsd,
          apy: p.apy,
          apyBase: p.apyBase,
          apyReward: p.apyReward,
          rewardTokens: p.rewardTokens,
          underlyingTokens: p.underlyingTokens,
          ilRisk: p.ilRisk,
          exposure: p.exposure
        }))

      return { content: [{ type: "text" as const, text: JSON.stringify(pools, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_yield_pool",
    "Get detailed data for a specific yield pool including historical APY.",
    {
      poolId: z.string().describe("Pool UUID from defi_get_yields")
    },
    async ({ poolId }) => {
      const data = await defiLlamaRequest(DEFILLAMA_YIELDS_API, `/chart/${poolId}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch pool: ${poolId}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== FEES & REVENUE ====================

  server.tool(
    "defi_get_fees_overview",
    "Get fees/revenue overview for all DeFi protocols.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/overview/fees")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch fees overview" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_protocol_fees",
    "Get detailed fees and revenue data for a specific protocol.",
    {
      protocol: z.string().describe("Protocol slug (e.g., 'uniswap', 'aave')")
    },
    async ({ protocol }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/summary/fees/${protocol}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch fees for: ${protocol}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_chain_fees",
    "Get fees/revenue data for a specific blockchain.",
    {
      chain: z.string().describe("Chain name (e.g., 'Ethereum', 'Arbitrum')")
    },
    async ({ chain }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/overview/fees/${chain}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch fees for: ${chain}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== DEX VOLUME ====================

  server.tool(
    "defi_get_dex_volume",
    "Get DEX trading volume overview across all protocols.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/overview/dexs")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch DEX volume" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_dex_protocol_volume",
    "Get detailed volume data for a specific DEX.",
    {
      protocol: z.string().describe("DEX protocol slug (e.g., 'uniswap', 'curve')")
    },
    async ({ protocol }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/summary/dexs/${protocol}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch volume for: ${protocol}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_chain_dex_volume",
    "Get DEX volume data for a specific blockchain.",
    {
      chain: z.string().describe("Chain name")
    },
    async ({ chain }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/overview/dexs/${chain}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch DEX volume for: ${chain}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== OPTIONS ====================

  server.tool(
    "defi_get_options_volume",
    "Get options trading volume across DeFi protocols.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/overview/options")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch options volume" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== STABLECOINS ====================

  server.tool(
    "defi_get_stablecoins",
    "Get list of all stablecoins with market cap, chain distribution, and peg data.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_STABLECOINS_API, "/stablecoins")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch stablecoins" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_stablecoin",
    "Get detailed data for a specific stablecoin including historical market cap.",
    {
      stablecoinId: z.number().describe("Stablecoin ID from defi_get_stablecoins")
    },
    async ({ stablecoinId }) => {
      const data = await defiLlamaRequest(DEFILLAMA_STABLECOINS_API, `/stablecoin/${stablecoinId}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch stablecoin: ${stablecoinId}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_stablecoin_chains",
    "Get stablecoin market cap breakdown by blockchain.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_STABLECOINS_API, "/stablecoinchains")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch stablecoin chains" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== BRIDGES ====================

  server.tool(
    "defi_get_bridges",
    "Get list of all cross-chain bridges with volume data.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/bridges")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch bridges" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_bridge",
    "Get detailed data for a specific bridge including volume by chain.",
    {
      bridgeId: z.number().describe("Bridge ID from defi_get_bridges")
    },
    async ({ bridgeId }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/bridge/${bridgeId}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch bridge: ${bridgeId}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_bridge_volume",
    "Get historical bridge volume for a specific chain.",
    {
      chain: z.string().describe("Chain name")
    },
    async ({ chain }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/bridgevolume/${chain}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch bridge volume for: ${chain}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== LIQUIDATIONS ====================

  server.tool(
    "defi_get_liquidations",
    "Get liquidation data for lending protocols. Shows liquidatable positions at various price levels.",
    {
      protocol: z.string().optional().describe("Filter by protocol (e.g., 'aave', 'compound')")
    },
    async ({ protocol }) => {
      let endpoint = "/liquidations"
      if (protocol) {
        endpoint += `/${protocol}`
      }
      const data = await defiLlamaRequest(DEFILLAMA_API, endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch liquidations" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== RAISES ====================

  server.tool(
    "defi_get_raises",
    "Get funding rounds and raises in the crypto/DeFi space.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/raises")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch raises" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== HACKS ====================

  server.tool(
    "defi_get_hacks",
    "Get historical DeFi hacks and exploits with amounts lost.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/hacks")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch hacks" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== ORACLES ====================

  server.tool(
    "defi_get_oracles",
    "Get oracle TVL data - protocols secured by different price oracles.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/oracles")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch oracles" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== TOKEN PRICES ====================

  server.tool(
    "defi_get_token_prices",
    "Get current prices for tokens by contract address. Supports multiple chains.",
    {
      coins: z.array(z.string()).describe("Array of 'chain:address' strings (e.g., ['ethereum:0x...', 'bsc:0x...'])")
    },
    async ({ coins }) => {
      const coinsParam = coins.join(",")
      const data = await defiLlamaRequest(DEFILLAMA_COINS_API, `/prices/current/${coinsParam}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch token prices" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_token_price_history",
    "Get historical price for a token at a specific timestamp.",
    {
      coin: z.string().describe("Token in 'chain:address' format (e.g., 'ethereum:0x...')"),
      timestamp: z.number().describe("Unix timestamp")
    },
    async ({ coin, timestamp }) => {
      const data = await defiLlamaRequest(DEFILLAMA_COINS_API, `/prices/historical/${timestamp}/${coin}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch historical price" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_token_chart",
    "Get price chart data for a token over a time period.",
    {
      coin: z.string().describe("Token in 'chain:address' format"),
      start: z.number().optional().describe("Start timestamp (default: 1 week ago)"),
      end: z.number().optional().describe("End timestamp (default: now)"),
      span: z.number().optional().describe("Number of data points (default: 100)"),
      period: z.enum(["1d", "1w", "1M", "1y"]).optional().describe("Time period")
    },
    async ({ coin, start, end, span, period }) => {
      let endpoint = `/chart/${coin}?`
      if (start) endpoint += `start=${start}&`
      if (end) endpoint += `end=${end}&`
      if (span) endpoint += `span=${span}&`
      if (period) endpoint += `period=${period}&`
      
      const data = await defiLlamaRequest(DEFILLAMA_COINS_API, endpoint)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch price chart" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== AGGREGATORS ====================

  server.tool(
    "defi_get_aggregators",
    "Get DEX aggregator volume data.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/overview/aggregators")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch aggregators" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== PERPETUALS ====================

  server.tool(
    "defi_get_perpetuals",
    "Get perpetual DEX volume and open interest data.",
    {},
    async () => {
      const data = await defiLlamaRequest(DEFILLAMA_API, "/overview/derivatives")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch perpetuals" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "defi_get_perpetual_protocol",
    "Get detailed data for a specific perpetuals protocol.",
    {
      protocol: z.string().describe("Protocol slug (e.g., 'gmx', 'dydx')")
    },
    async ({ protocol }) => {
      const data = await defiLlamaRequest(DEFILLAMA_API, `/summary/derivatives/${protocol}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch perp data for: ${protocol}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
