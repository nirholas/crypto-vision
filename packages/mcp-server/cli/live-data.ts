#!/usr/bin/env node
/**
 * Live Data Fetchers for CLI
 * Real API integrations for production use
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3"
const COINGECKO_PRO_API_BASE = "https://pro-api.coingecko.com/api/v3"
const FEAR_GREED_API = "https://api.alternative.me/fng"
const ETHERSCAN_API = "https://api.etherscan.io/api"
const ARBISCAN_API = "https://api.arbiscan.io/api"
const BASESCAN_API = "https://api.basescan.org/api"
const POLYGONSCAN_API = "https://api.polygonscan.com/api"
const BSCSCAN_API = "https://api.bscscan.com/api"

// Symbol to CoinGecko ID mapping
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOGE: "dogecoin",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  ARB: "arbitrum",
  OP: "optimism",
  APT: "aptos",
  SUI: "sui",
  NEAR: "near",
  FTM: "fantom",
  AAVE: "aave",
  MKR: "maker",
  CRV: "curve-dao-token",
  SNX: "havven",
  COMP: "compound-governance-token",
  LDO: "lido-dao",
  RPL: "rocket-pool",
  GMX: "gmx",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  FRAX: "frax",
  USDS: "usds",
}

export interface TokenPrice {
  symbol: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
}

export interface MarketOverview {
  totalMarketCap: number
  totalVolume24h: number
  btcDominance: number
  ethDominance: number
  activeCryptocurrencies: number
  fearGreedIndex: number
  fearGreedLabel: string
}

export interface GasPrice {
  chain: string
  low: number
  average: number
  high: number
  baseFee?: number
  unit: string
}

export interface WalletBalance {
  address: string
  chain: string
  balance: string
  symbol: string
  balanceUsd?: number
}

/**
 * Fetch token price from CoinGecko
 */
export async function fetchLivePrice(symbol: string): Promise<TokenPrice | null> {
  const coinId = SYMBOL_TO_ID[symbol.toUpperCase()]
  if (!coinId) return null

  try {
    const apiKey = process.env.COINGECKO_API_KEY
    const baseUrl = apiKey ? COINGECKO_PRO_API_BASE : COINGECKO_API_BASE
    const headers: Record<string, string> = {}
    if (apiKey) headers["x-cg-pro-api-key"] = apiKey

    const response = await fetch(
      `${baseUrl}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`,
      { headers }
    )

    if (!response.ok) {
      if (response.status === 429) {
        console.error("CoinGecko rate limit hit")
        return null
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json() as {
      symbol: string
      market_data: {
        current_price: { usd: number }
        price_change_percentage_24h: number
        market_cap: { usd: number }
        total_volume: { usd: number }
      }
    }

    return {
      symbol: data.symbol.toUpperCase(),
      price: data.market_data.current_price.usd,
      change24h: data.market_data.price_change_percentage_24h,
      marketCap: data.market_data.market_cap.usd,
      volume24h: data.market_data.total_volume.usd,
    }
  } catch (error) {
    console.error("Error fetching price:", error)
    return null
  }
}

/**
 * Fetch multiple token prices at once
 */
export async function fetchMultiplePrices(symbols: string[]): Promise<Map<string, TokenPrice>> {
  const results = new Map<string, TokenPrice>()
  const coinIds = symbols
    .map((s) => SYMBOL_TO_ID[s.toUpperCase()])
    .filter(Boolean)
    .join(",")

  if (!coinIds) return results

  try {
    const apiKey = process.env.COINGECKO_API_KEY
    const baseUrl = apiKey ? COINGECKO_PRO_API_BASE : COINGECKO_API_BASE
    const headers: Record<string, string> = {}
    if (apiKey) headers["x-cg-pro-api-key"] = apiKey

    const response = await fetch(
      `${baseUrl}/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
      { headers }
    )

    if (!response.ok) return results

    const data = await response.json() as Array<{
      symbol: string
      current_price: number
      price_change_percentage_24h: number
      market_cap: number
      total_volume: number
    }>

    for (const coin of data) {
      results.set(coin.symbol.toUpperCase(), {
        symbol: coin.symbol.toUpperCase(),
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h || 0,
        marketCap: coin.market_cap,
        volume24h: coin.total_volume,
      })
    }
  } catch (error) {
    console.error("Error fetching prices:", error)
  }

  return results
}

/**
 * Fetch global market data
 */
export async function fetchMarketOverview(): Promise<MarketOverview | null> {
  try {
    const apiKey = process.env.COINGECKO_API_KEY
    const baseUrl = apiKey ? COINGECKO_PRO_API_BASE : COINGECKO_API_BASE
    const headers: Record<string, string> = {}
    if (apiKey) headers["x-cg-pro-api-key"] = apiKey

    // Fetch global data and fear & greed in parallel
    const [globalRes, fgRes] = await Promise.all([
      fetch(`${baseUrl}/global`, { headers }),
      fetch(`${FEAR_GREED_API}?limit=1`),
    ])

    if (!globalRes.ok) return null

    const globalData = await globalRes.json() as {
      data: {
        total_market_cap: { usd: number }
        total_volume: { usd: number }
        market_cap_percentage: { btc: number; eth: number }
        active_cryptocurrencies: number
      }
    }

    let fearGreedIndex = 50
    let fearGreedLabel = "Neutral"

    if (fgRes.ok) {
      const fgData = await fgRes.json() as {
        data: Array<{ value: string; value_classification: string }>
      }
      if (fgData.data?.[0]) {
        fearGreedIndex = parseInt(fgData.data[0].value, 10)
        fearGreedLabel = fgData.data[0].value_classification
      }
    }

    return {
      totalMarketCap: globalData.data.total_market_cap.usd,
      totalVolume24h: globalData.data.total_volume.usd,
      btcDominance: globalData.data.market_cap_percentage.btc,
      ethDominance: globalData.data.market_cap_percentage.eth,
      activeCryptocurrencies: globalData.data.active_cryptocurrencies,
      fearGreedIndex,
      fearGreedLabel,
    }
  } catch (error) {
    console.error("Error fetching market overview:", error)
    return null
  }
}

/**
 * Fetch gas prices from block explorers
 */
export async function fetchGasPrice(chain: string): Promise<GasPrice | null> {
  const chainConfig: Record<string, { api: string; key: string; unit: string }> = {
    ethereum: {
      api: ETHERSCAN_API,
      key: process.env.ETHERSCAN_API_KEY || "",
      unit: "Gwei",
    },
    arbitrum: {
      api: ARBISCAN_API,
      key: process.env.ARBISCAN_API_KEY || "",
      unit: "Gwei",
    },
    base: {
      api: BASESCAN_API,
      key: process.env.BASESCAN_API_KEY || "",
      unit: "Gwei",
    },
    polygon: {
      api: POLYGONSCAN_API,
      key: process.env.POLYGONSCAN_API_KEY || "",
      unit: "Gwei",
    },
    bsc: {
      api: BSCSCAN_API,
      key: process.env.BSCSCAN_API_KEY || "",
      unit: "Gwei",
    },
  }

  const config = chainConfig[chain.toLowerCase()]
  if (!config) return null

  try {
    const url = `${config.api}?module=gastracker&action=gasoracle&apikey=${config.key}`
    const response = await fetch(url)

    if (!response.ok) return null

    const data = await response.json() as {
      status: string
      result: {
        SafeGasPrice: string
        ProposeGasPrice: string
        FastGasPrice: string
        suggestBaseFee?: string
      }
    }

    if (data.status !== "1") return null

    return {
      chain,
      low: parseFloat(data.result.SafeGasPrice),
      average: parseFloat(data.result.ProposeGasPrice),
      high: parseFloat(data.result.FastGasPrice),
      baseFee: data.result.suggestBaseFee
        ? parseFloat(data.result.suggestBaseFee)
        : undefined,
      unit: config.unit,
    }
  } catch (error) {
    console.error("Error fetching gas price:", error)
    return null
  }
}

/**
 * Fetch wallet balance from RPC
 */
export async function fetchWalletBalance(
  address: string,
  chain: string
): Promise<WalletBalance | null> {
  const rpcUrls: Record<string, { url: string; symbol: string }> = {
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
      symbol: "ETH",
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      symbol: "ETH",
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      symbol: "ETH",
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      symbol: "MATIC",
    },
    optimism: {
      url: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
      symbol: "ETH",
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      symbol: "BNB",
    },
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      symbol: "AVAX",
    },
  }

  const config = rpcUrls[chain.toLowerCase()]
  if (!config) return null

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    })

    if (!response.ok) return null

    const data = await response.json() as {
      result: string
    }

    // Convert hex wei to ETH
    const balanceWei = BigInt(data.result)
    const balanceEth = Number(balanceWei) / 1e18
    const formattedBalance = balanceEth.toFixed(6)

    // Try to get USD value
    let balanceUsd: number | undefined
    const price = await fetchLivePrice(config.symbol)
    if (price) {
      balanceUsd = balanceEth * price.price
    }

    return {
      address,
      chain,
      balance: formattedBalance,
      symbol: config.symbol,
      balanceUsd,
    }
  } catch (error) {
    console.error("Error fetching balance:", error)
    return null
  }
}

/**
 * Fetch trending coins
 */
export async function fetchTrendingCoins(): Promise<
  Array<{ name: string; symbol: string; marketCapRank: number }> | null
> {
  try {
    const apiKey = process.env.COINGECKO_API_KEY
    const baseUrl = apiKey ? COINGECKO_PRO_API_BASE : COINGECKO_API_BASE
    const headers: Record<string, string> = {}
    if (apiKey) headers["x-cg-pro-api-key"] = apiKey

    const response = await fetch(`${baseUrl}/search/trending`, { headers })

    if (!response.ok) return null

    const data = await response.json() as {
      coins: Array<{
        item: {
          name: string
          symbol: string
          market_cap_rank: number
        }
      }>
    }

    return data.coins.slice(0, 10).map((c) => ({
      name: c.item.name,
      symbol: c.item.symbol,
      marketCapRank: c.item.market_cap_rank,
    }))
  } catch (error) {
    console.error("Error fetching trending:", error)
    return null
  }
}

/**
 * Format large numbers for display
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
  return `$${num.toFixed(2)}`
}

/**
 * Format percentage with color indicator
 */
export function formatPercentage(pct: number): { value: string; isPositive: boolean } {
  const sign = pct >= 0 ? "+" : ""
  return {
    value: `${sign}${pct.toFixed(2)}%`,
    isPositive: pct >= 0,
  }
}

export { SYMBOL_TO_ID }
