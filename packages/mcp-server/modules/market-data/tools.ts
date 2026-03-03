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
const COINSTATS_API_BASE = "https://openapiv1.coinstats.app"
const COINSTATS_API_KEY = process.env.COINSTATS_API_KEY || ""
const FEAR_GREED_API_BASE = "https://api.alternative.me/fng"
const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3"
const COINGECKO_PRO_API_BASE = "https://pro-api.coingecko.com/api/v3"
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || ""

/**
 * Generic API request helper for CoinStats
 */
async function coinStatsRequest<T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const headers = {
    "X-API-KEY": COINSTATS_API_KEY,
    "Content-Type": "application/json"
  }

  try {
    const queryParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value))
      }
    }
    const queryString = queryParams.toString()
    const url = `${COINSTATS_API_BASE}${endpoint}${queryString ? `?${queryString}` : ""}`

    const response = await fetch(url, { method: "GET", headers })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    Logger.error("CoinStats API error:", error)
    return null
  }
}

/**
 * Generic API request helper for Fear & Greed Index
 */
async function fearGreedRequest<T>(
  params: Record<string, unknown> = {}
): Promise<T | null> {
  try {
    const queryParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value))
      }
    }
    const queryString = queryParams.toString()
    const url = `${FEAR_GREED_API_BASE}${queryString ? `?${queryString}` : ""}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    Logger.error("Fear & Greed API error:", error)
    return null
  }
}

/**
 * Generic API request helper for CoinGecko
 */
async function coinGeckoRequest<T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  try {
    const baseUrl = COINGECKO_API_KEY ? COINGECKO_PRO_API_BASE : COINGECKO_API_BASE
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    
    if (COINGECKO_API_KEY) {
      headers["x-cg-pro-api-key"] = COINGECKO_API_KEY
    }
    
    const queryParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value))
      }
    }
    const queryString = queryParams.toString()
    const url = `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ""}`

    const response = await fetch(url, { headers })
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("CoinGecko rate limit exceeded. Consider using API key.")
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    Logger.error("CoinGecko API error:", error)
    return null
  }
}

export function registerMarketDataTools(server: McpServer) {
  // ==================== COINSTATS TOOLS ====================

  // Get Coins List
  server.tool(
    "market_get_coins",
    "Get comprehensive data about cryptocurrencies: price, market cap, volume, price changes (1h, 24h, 7d), supply information, trading metrics, and social links",
    {
      name: z.string().optional().describe("Search coins by name"),
      page: z.number().optional().default(1).describe("Page number"),
      limit: z.number().optional().default(20).describe("Results per page"),
      currency: z.string().optional().default("USD").describe("Currency for price data"),
      symbol: z.string().optional().describe("Get coins by symbol"),
      blockchains: z.string().optional().describe("Blockchain filters, comma-separated (e.g., ethereum,solana)"),
      categories: z.string().optional().describe("Category filters, comma-separated (e.g., memecoins,defi)"),
      sortBy: z.string().optional().describe("Field to sort by"),
      sortDir: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
      marketCapGreaterThan: z.number().optional().describe("Market cap greater than"),
      marketCapLessThan: z.number().optional().describe("Market cap less than"),
      volumeGreaterThan: z.number().optional().describe("24h volume greater than"),
      volumeLessThan: z.number().optional().describe("24h volume less than"),
      priceGreaterThan: z.number().optional().describe("Price greater than"),
      priceLessThan: z.number().optional().describe("Price less than")
    },
    async (params) => {
      const queryParams: Record<string, unknown> = {
        page: params.page,
        limit: params.limit,
        currency: params.currency
      }

      if (params.name) queryParams.name = params.name
      if (params.symbol) queryParams.symbol = params.symbol
      if (params.blockchains) queryParams.blockchains = params.blockchains
      if (params.categories) queryParams.categories = params.categories
      if (params.sortBy) queryParams.sortBy = params.sortBy
      if (params.sortDir) queryParams.sortDir = params.sortDir
      if (params.marketCapGreaterThan) queryParams["marketCap~greaterThan"] = params.marketCapGreaterThan
      if (params.marketCapLessThan) queryParams["marketCap~lessThan"] = params.marketCapLessThan
      if (params.volumeGreaterThan) queryParams["volume~greaterThan"] = params.volumeGreaterThan
      if (params.volumeLessThan) queryParams["volume~lessThan"] = params.volumeLessThan
      if (params.priceGreaterThan) queryParams["price~greaterThan"] = params.priceGreaterThan
      if (params.priceLessThan) queryParams["price~lessThan"] = params.priceLessThan

      const data = await coinStatsRequest("/coins", queryParams)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch coins data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin by ID
  server.tool(
    "market_get_coin_by_id",
    "Get detailed information about a specific cryptocurrency by its unique identifier",
    {
      coinId: z.string().describe("The coin identifier from get_coins response"),
      currency: z.string().optional().default("USD").describe("Currency for price data")
    },
    async (params) => {
      const data = await coinStatsRequest(`/coins/${params.coinId}`, { currency: params.currency })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch coin data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin Chart
  server.tool(
    "market_get_coin_chart",
    "Get historical chart data for a cryptocurrency with different time ranges",
    {
      coinId: z.string().describe("The coin identifier"),
      period: z.enum(["24h", "1w", "1m", "3m", "6m", "1y", "all"]).describe("Time period for chart data")
    },
    async (params) => {
      const data = await coinStatsRequest(`/coins/${params.coinId}/charts`, { period: params.period })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch chart data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin Average Price (Historical)
  server.tool(
    "market_get_coin_avg_price",
    "Get the historical average price for a cryptocurrency at a specific timestamp",
    {
      coinId: z.string().describe("The coin identifier"),
      timestamp: z.number().describe("Unix timestamp for the price query")
    },
    async (params) => {
      const data = await coinStatsRequest("/coins/price/avg", {
        coinId: params.coinId,
        timestamp: params.timestamp
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch average price" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin Exchange Price
  server.tool(
    "market_get_exchange_price",
    "Get historical price data for a cryptocurrency on a specific exchange",
    {
      exchange: z.string().describe("Exchange name"),
      from: z.string().describe("From currency/coin symbol"),
      to: z.string().describe("To currency/coin symbol"),
      timestamp: z.number().describe("Unix timestamp")
    },
    async (params) => {
      const data = await coinStatsRequest("/coins/price/exchange", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch exchange price" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Exchanges List
  server.tool(
    "market_get_exchanges",
    "Get a list of supported cryptocurrency exchanges",
    {},
    async () => {
      const data = await coinStatsRequest("/tickers/exchanges")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch exchanges" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Ticker Markets
  server.tool(
    "market_get_tickers",
    "Get trading pairs/tickers for a cryptocurrency across different exchanges",
    {
      page: z.number().optional().default(1).describe("Page number"),
      limit: z.number().optional().default(20).describe("Results per page"),
      exchange: z.string().optional().describe("Filter by exchange name"),
      fromCoin: z.string().optional().describe("From currency/coin symbol"),
      toCoin: z.string().optional().describe("To currency/coin symbol"),
      coinId: z.string().optional().describe("Filter by coin identifier"),
      onlyVerified: z.boolean().optional().describe("Only verified exchanges")
    },
    async (params) => {
      const data = await coinStatsRequest("/tickers/markets", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch tickers" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Supported Blockchains
  server.tool(
    "market_get_blockchains",
    "Get a list of blockchains supported by CoinStats",
    {},
    async () => {
      const data = await coinStatsRequest("/wallet/blockchains")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch blockchains" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Wallet Balance
  server.tool(
    "market_get_wallet_balance",
    "Get balance data for a wallet address on a specific blockchain",
    {
      address: z.string().describe("Wallet address"),
      connectionId: z.string().describe("Blockchain connection ID from get_blockchains")
    },
    async (params) => {
      const data = await coinStatsRequest("/wallet/balance", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch wallet balance" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Wallet Balances (All Networks)
  server.tool(
    "market_get_wallet_balances_all",
    "Get balance data for a wallet address across all supported networks",
    {
      address: z.string().describe("Wallet address"),
      networks: z.string().optional().default("all").describe("Networks to query, comma-separated")
    },
    async (params) => {
      const data = await coinStatsRequest("/wallet/balances", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch balances" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Wallet Transactions
  server.tool(
    "market_get_wallet_transactions",
    "Get transaction history for a wallet address",
    {
      address: z.string().describe("Wallet address"),
      connectionId: z.string().describe("Blockchain connection ID"),
      page: z.number().optional().default(1).describe("Page number"),
      limit: z.number().optional().default(20).describe("Results per page"),
      from: z.string().optional().describe("Start date (ISO 8601)"),
      to: z.string().optional().describe("End date (ISO 8601)"),
      currency: z.string().optional().default("USD").describe("Currency for values"),
      types: z.string().optional().describe("Transaction types (deposit,withdraw,approve,executed,balance,fee)")
    },
    async (params) => {
      const data = await coinStatsRequest("/wallet/transactions", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch transactions" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Global Market Data
  server.tool(
    "market_get_global",
    "Get global cryptocurrency market statistics (total market cap, volume, BTC dominance, etc.)",
    {},
    async () => {
      const data = await coinStatsRequest("/markets")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch global market data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get News Sources
  server.tool(
    "market_get_news_sources",
    "Get available cryptocurrency news sources",
    {},
    async () => {
      const data = await coinStatsRequest("/news/sources")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch news sources" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get News
  server.tool(
    "market_get_news",
    "Get cryptocurrency news articles with pagination",
    {
      page: z.number().optional().default(1).describe("Page number"),
      limit: z.number().optional().default(20).describe("Results per page"),
      from: z.string().optional().describe("Start date (ISO 8601)"),
      to: z.string().optional().describe("End date (ISO 8601)")
    },
    async (params) => {
      const data = await coinStatsRequest("/news", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch news" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get News by Type
  server.tool(
    "market_get_news_by_type",
    "Get cryptocurrency news filtered by type (handpicked, trending, latest, bullish, bearish)",
    {
      type: z.enum(["handpicked", "trending", "latest", "bullish", "bearish"]).describe("News type"),
      page: z.number().optional().default(1).describe("Page number"),
      limit: z.number().optional().default(20).describe("Results per page")
    },
    async (params) => {
      const { type, ...rest } = params
      const data = await coinStatsRequest(`/news/type/${type}`, rest)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch news" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Fiat Currencies
  server.tool(
    "market_get_fiats",
    "Get list of supported fiat currencies",
    {},
    async () => {
      const data = await coinStatsRequest("/fiats")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch fiats" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Portfolio Coins
  server.tool(
    "market_get_portfolio_coins",
    "Get portfolio holdings with P/L data (requires share token from CoinStats web app)",
    {
      shareToken: z.string().describe("Portfolio share token from CoinStats web app"),
      page: z.number().optional().default(1).describe("Page number"),
      limit: z.number().optional().default(20).describe("Results per page")
    },
    async (params) => {
      const data = await coinStatsRequest("/portfolio/coins", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch portfolio" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Portfolio Chart
  server.tool(
    "market_get_portfolio_chart",
    "Get portfolio performance chart data",
    {
      shareToken: z.string().describe("Portfolio share token"),
      type: z.enum(["24h", "1w", "1m", "3m", "6m", "1y", "all"]).describe("Chart time period")
    },
    async (params) => {
      const data = await coinStatsRequest("/portfolio/chart", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch portfolio chart" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== FEAR & GREED INDEX TOOLS ====================

  // Get Current Fear & Greed Index
  server.tool(
    "market_get_fear_greed_current",
    "Get the current Crypto Fear & Greed Index (0-100 scale: 0-24 Extreme Fear, 25-49 Fear, 50-74 Greed, 75-100 Extreme Greed)",
    {},
    async () => {
      const data = await fearGreedRequest<{ data: Array<{ value: string; value_classification: string; timestamp: string }> }>({ limit: 1 })
      if (!data || !data.data || data.data.length === 0) {
        return { content: [{ type: "text" as const, text: "Failed to fetch Fear & Greed Index" }] }
      }
      
      const current = data.data[0]
      const result = {
        value: parseInt(current.value),
        classification: current.value_classification,
        timestamp: new Date(parseInt(current.timestamp) * 1000).toISOString(),
        interpretation: getInterpretation(parseInt(current.value))
      }
      
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  // Get Historical Fear & Greed Index
  server.tool(
    "market_get_fear_greed_historical",
    "Get historical Fear & Greed Index data for specified number of days",
    {
      days: z.number().min(1).max(365).describe("Number of days of historical data (1-365)")
    },
    async (params) => {
      const data = await fearGreedRequest<{ data: Array<{ value: string; value_classification: string; timestamp: string }> }>({ limit: params.days })
      if (!data || !data.data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch historical data" }] }
      }

      const history = data.data.map(item => ({
        value: parseInt(item.value),
        classification: item.value_classification,
        date: new Date(parseInt(item.timestamp) * 1000).toISOString().split("T")[0]
      }))

      return { content: [{ type: "text" as const, text: JSON.stringify(history, null, 2) }] }
    }
  )

  // Analyze Fear & Greed Trends
  server.tool(
    "market_analyze_fear_greed_trend",
    "Analyze trends in the Fear & Greed Index over a specified period, calculating averages and trend direction",
    {
      days: z.number().min(2).max(365).describe("Number of days to analyze (2-365)")
    },
    async (params) => {
      const data = await fearGreedRequest<{ data: Array<{ value: string; value_classification: string; timestamp: string }> }>({ limit: params.days })
      if (!data || !data.data || data.data.length < 2) {
        return { content: [{ type: "text" as const, text: "Failed to fetch data for analysis" }] }
      }

      const values = data.data.map(item => parseInt(item.value))
      const average = values.reduce((a, b) => a + b, 0) / values.length
      const latest = values[0]
      const oldest = values[values.length - 1]
      const trend = latest > oldest ? "INCREASING" : latest < oldest ? "DECREASING" : "STABLE"
      const change = latest - oldest

      const analysis = {
        period: `${params.days} days`,
        dataPoints: values.length,
        current: latest,
        average: Math.round(average * 100) / 100,
        averageClassification: getClassification(average),
        trend,
        change,
        changePercent: Math.round((change / oldest) * 10000) / 100,
        high: Math.max(...values),
        low: Math.min(...values),
        interpretation: getTrendInterpretation(trend, average, change)
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(analysis, null, 2) }] }
    }
  )

  // ==================== COINGECKO API TOOLS ====================

  // Ping CoinGecko API
  server.tool(
    "market_coingecko_ping",
    "Check CoinGecko API server status",
    {},
    async () => {
      const data = await coinGeckoRequest("/ping")
      if (!data) {
        return { content: [{ type: "text" as const, text: "CoinGecko API is not responding" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coins List
  server.tool(
    "market_coingecko_coins_list",
    "Get list of all supported coins with id, name, and symbol (use for looking up coin IDs)",
    {
      includePlatform: z.boolean().optional().default(false).describe("Include platform contract addresses")
    },
    async (params) => {
      const data = await coinGeckoRequest("/coins/list", { include_platform: params.includePlatform })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch coins list" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coins Markets
  server.tool(
    "market_coingecko_coins_markets",
    "Get coins with market data (price, market cap, volume) - most commonly used endpoint",
    {
      vsCurrency: z.string().default("usd").describe("Target currency (usd, eur, btc, etc.)"),
      ids: z.string().optional().describe("Comma-separated coin IDs to filter"),
      category: z.string().optional().describe("Filter by category (e.g., 'decentralized-finance-defi')"),
      order: z.enum(["market_cap_desc", "market_cap_asc", "volume_desc", "volume_asc", "id_desc", "id_asc"]).optional().default("market_cap_desc").describe("Sort order"),
      perPage: z.number().optional().default(100).describe("Results per page (1-250)"),
      page: z.number().optional().default(1).describe("Page number"),
      sparkline: z.boolean().optional().default(false).describe("Include 7 day sparkline data"),
      priceChangePercentage: z.string().optional().describe("Include price change % (1h,24h,7d,14d,30d,200d,1y)")
    },
    async (params) => {
      const data = await coinGeckoRequest("/coins/markets", {
        vs_currency: params.vsCurrency,
        ids: params.ids,
        category: params.category,
        order: params.order,
        per_page: params.perPage,
        page: params.page,
        sparkline: params.sparkline,
        price_change_percentage: params.priceChangePercentage
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch coins markets" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin by ID
  server.tool(
    "market_coingecko_coin",
    "Get detailed coin data including description, links, market data, community data, developer stats",
    {
      id: z.string().describe("Coin ID (use coins/list to find ID)"),
      localization: z.boolean().optional().default(false).describe("Include all localizations"),
      tickers: z.boolean().optional().default(true).describe("Include exchange tickers"),
      marketData: z.boolean().optional().default(true).describe("Include market data"),
      communityData: z.boolean().optional().default(true).describe("Include community data"),
      developerData: z.boolean().optional().default(true).describe("Include developer data"),
      sparkline: z.boolean().optional().default(false).describe("Include sparkline data")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/coins/${params.id}`, {
        localization: params.localization,
        tickers: params.tickers,
        market_data: params.marketData,
        community_data: params.communityData,
        developer_data: params.developerData,
        sparkline: params.sparkline
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch coin data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin Tickers
  server.tool(
    "market_coingecko_coin_tickers",
    "Get exchange tickers for a coin (trading pairs across exchanges)",
    {
      id: z.string().describe("Coin ID"),
      exchangeIds: z.string().optional().describe("Filter by exchange IDs (comma-separated)"),
      includeExchangeLogo: z.boolean().optional().default(false).describe("Include exchange logo"),
      page: z.number().optional().default(1).describe("Page number"),
      order: z.enum(["trust_score_desc", "trust_score_asc", "volume_desc"]).optional().describe("Sort order"),
      depth: z.boolean().optional().default(false).describe("Include 2% orderbook depth")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/coins/${params.id}/tickers`, {
        exchange_ids: params.exchangeIds,
        include_exchange_logo: params.includeExchangeLogo,
        page: params.page,
        order: params.order,
        depth: params.depth
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch coin tickers" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin History
  server.tool(
    "market_coingecko_coin_history",
    "Get historical coin data (price, market cap, volume) for a specific date",
    {
      id: z.string().describe("Coin ID"),
      date: z.string().describe("Date in dd-mm-yyyy format"),
      localization: z.boolean().optional().default(false).describe("Include localizations")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/coins/${params.id}/history`, {
        date: params.date,
        localization: params.localization
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch coin history" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin Market Chart
  server.tool(
    "market_coingecko_coin_market_chart",
    "Get historical market chart data (price, market cap, volume) over time",
    {
      id: z.string().describe("Coin ID"),
      vsCurrency: z.string().default("usd").describe("Target currency"),
      days: z.string().describe("Data up to number of days ago (1, 7, 14, 30, 90, 180, 365, max)"),
      interval: z.enum(["daily", "hourly"]).optional().describe("Data interval (auto if omitted)")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/coins/${params.id}/market_chart`, {
        vs_currency: params.vsCurrency,
        days: params.days,
        interval: params.interval
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch market chart" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin Market Chart Range
  server.tool(
    "market_coingecko_coin_market_chart_range",
    "Get historical market data within a custom date range (unix timestamps)",
    {
      id: z.string().describe("Coin ID"),
      vsCurrency: z.string().default("usd").describe("Target currency"),
      from: z.number().describe("From timestamp (UNIX)"),
      to: z.number().describe("To timestamp (UNIX)")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/coins/${params.id}/market_chart/range`, {
        vs_currency: params.vsCurrency,
        from: params.from,
        to: params.to
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch market chart range" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin OHLC
  server.tool(
    "market_coingecko_coin_ohlc",
    "Get OHLC (Open, High, Low, Close) candlestick data for a coin",
    {
      id: z.string().describe("Coin ID"),
      vsCurrency: z.string().default("usd").describe("Target currency"),
      days: z.enum(["1", "7", "14", "30", "90", "180", "365", "max"]).describe("Data up to number of days ago")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/coins/${params.id}/ohlc`, {
        vs_currency: params.vsCurrency,
        days: params.days
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch OHLC data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Simple Price
  server.tool(
    "market_coingecko_simple_price",
    "Get current price of coins in multiple currencies (most efficient for price lookup)",
    {
      ids: z.string().describe("Comma-separated coin IDs (bitcoin,ethereum,etc.)"),
      vsCurrencies: z.string().default("usd").describe("Comma-separated target currencies (usd,eur,btc)"),
      includeMarketCap: z.boolean().optional().default(false).describe("Include market cap"),
      include24hrVol: z.boolean().optional().default(false).describe("Include 24hr volume"),
      include24hrChange: z.boolean().optional().default(false).describe("Include 24hr change"),
      includeLastUpdatedAt: z.boolean().optional().default(false).describe("Include last updated timestamp")
    },
    async (params) => {
      const data = await coinGeckoRequest("/simple/price", {
        ids: params.ids,
        vs_currencies: params.vsCurrencies,
        include_market_cap: params.includeMarketCap,
        include_24hr_vol: params.include24hrVol,
        include_24hr_change: params.include24hrChange,
        include_last_updated_at: params.includeLastUpdatedAt
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch simple price" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Token Price by Contract
  server.tool(
    "market_coingecko_token_price",
    "Get token price by contract address (for ERC20, BEP20, etc. tokens)",
    {
      platform: z.string().describe("Platform ID (ethereum, binance-smart-chain, polygon-pos, etc.)"),
      contractAddresses: z.string().describe("Comma-separated contract addresses"),
      vsCurrencies: z.string().default("usd").describe("Comma-separated target currencies"),
      includeMarketCap: z.boolean().optional().default(false).describe("Include market cap"),
      include24hrVol: z.boolean().optional().default(false).describe("Include 24hr volume"),
      include24hrChange: z.boolean().optional().default(false).describe("Include 24hr change")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/simple/token_price/${params.platform}`, {
        contract_addresses: params.contractAddresses,
        vs_currencies: params.vsCurrencies,
        include_market_cap: params.includeMarketCap,
        include_24hr_vol: params.include24hrVol,
        include_24hr_change: params.include24hrChange
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch token price" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Supported VS Currencies
  server.tool(
    "market_coingecko_supported_currencies",
    "Get list of supported vs currencies (fiat and crypto)",
    {},
    async () => {
      const data = await coinGeckoRequest("/simple/supported_vs_currencies")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch supported currencies" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Global Data
  server.tool(
    "market_coingecko_global",
    "Get global cryptocurrency statistics (total market cap, volume, dominance, etc.)",
    {},
    async () => {
      const data = await coinGeckoRequest("/global")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch global data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Global DeFi Data
  server.tool(
    "market_coingecko_global_defi",
    "Get global DeFi market statistics (DeFi market cap, dominance, top coins)",
    {},
    async () => {
      const data = await coinGeckoRequest("/global/decentralized_finance_defi")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch global DeFi data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Trending Coins
  server.tool(
    "market_coingecko_trending",
    "Get top 7 trending coins on CoinGecko based on user searches in the last 24 hours",
    {},
    async () => {
      const data = await coinGeckoRequest("/search/trending")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch trending coins" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Search Coins
  server.tool(
    "market_coingecko_search",
    "Search for coins, categories, and exchanges by name or symbol",
    {
      query: z.string().describe("Search query (coin name or symbol)")
    },
    async (params) => {
      const data = await coinGeckoRequest("/search", { query: params.query })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to search" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Categories List
  server.tool(
    "market_coingecko_categories_list",
    "Get list of all coin categories with IDs",
    {},
    async () => {
      const data = await coinGeckoRequest("/coins/categories/list")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch categories list" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Categories with Market Data
  server.tool(
    "market_coingecko_categories",
    "Get all categories with market data (market cap, volume, change)",
    {
      order: z.enum(["market_cap_desc", "market_cap_asc", "name_desc", "name_asc", "market_cap_change_24h_desc", "market_cap_change_24h_asc"]).optional().default("market_cap_desc").describe("Sort order")
    },
    async (params) => {
      const data = await coinGeckoRequest("/coins/categories", { order: params.order })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch categories" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Exchanges List
  server.tool(
    "market_coingecko_exchanges",
    "Get all exchanges ranked by trust score with trading volume data",
    {
      perPage: z.number().optional().default(100).describe("Results per page (1-250)"),
      page: z.number().optional().default(1).describe("Page number")
    },
    async (params) => {
      const data = await coinGeckoRequest("/exchanges", {
        per_page: params.perPage,
        page: params.page
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch exchanges" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Exchange by ID
  server.tool(
    "market_coingecko_exchange",
    "Get detailed exchange data including trust score, trading volume, and tickers",
    {
      id: z.string().describe("Exchange ID (use exchanges list to find ID)")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/exchanges/${params.id}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch exchange data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Exchange Tickers
  server.tool(
    "market_coingecko_exchange_tickers",
    "Get all trading pairs/tickers for an exchange",
    {
      id: z.string().describe("Exchange ID"),
      coinIds: z.string().optional().describe("Filter by coin IDs (comma-separated)"),
      includeExchangeLogo: z.boolean().optional().default(false).describe("Include exchange logo"),
      page: z.number().optional().default(1).describe("Page number"),
      depth: z.boolean().optional().default(false).describe("Include orderbook depth"),
      order: z.enum(["trust_score_desc", "trust_score_asc", "volume_desc"]).optional().describe("Sort order")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/exchanges/${params.id}/tickers`, {
        coin_ids: params.coinIds,
        include_exchange_logo: params.includeExchangeLogo,
        page: params.page,
        depth: params.depth,
        order: params.order
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch exchange tickers" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Exchange Volume Chart
  server.tool(
    "market_coingecko_exchange_volume_chart",
    "Get historical volume chart data for an exchange",
    {
      id: z.string().describe("Exchange ID"),
      days: z.number().describe("Data up to number of days ago (1-365)")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/exchanges/${params.id}/volume_chart`, { days: params.days })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch exchange volume chart" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Asset Platforms
  server.tool(
    "market_coingecko_asset_platforms",
    "Get list of asset platforms (blockchains) for token lookups",
    {
      filter: z.string().optional().describe("Filter platforms (e.g., 'nft')")
    },
    async (params) => {
      const data = await coinGeckoRequest("/asset_platforms", { filter: params.filter })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch asset platforms" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Coin Contract Info
  server.tool(
    "market_coingecko_contract",
    "Get coin info by contract address",
    {
      platform: z.string().describe("Platform ID (ethereum, polygon-pos, etc.)"),
      contractAddress: z.string().describe("Token contract address")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/coins/${params.platform}/contract/${params.contractAddress}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch contract info" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Contract Market Chart
  server.tool(
    "market_coingecko_contract_market_chart",
    "Get historical market data for a token by contract address",
    {
      platform: z.string().describe("Platform ID"),
      contractAddress: z.string().describe("Token contract address"),
      vsCurrency: z.string().default("usd").describe("Target currency"),
      days: z.string().describe("Data up to number of days ago (1, 7, 14, 30, 90, 180, 365, max)")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/coins/${params.platform}/contract/${params.contractAddress}/market_chart`, {
        vs_currency: params.vsCurrency,
        days: params.days
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch contract market chart" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Derivatives
  server.tool(
    "market_coingecko_derivatives",
    "Get list of all derivative tickers",
    {
      includeTickers: z.enum(["all", "unexpired"]).optional().default("unexpired").describe("Include tickers filter")
    },
    async (params) => {
      const data = await coinGeckoRequest("/derivatives", { include_tickers: params.includeTickers })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch derivatives" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Derivatives Exchanges
  server.tool(
    "market_coingecko_derivatives_exchanges",
    "Get list of derivatives exchanges",
    {
      order: z.enum(["name_asc", "name_desc", "open_interest_btc_asc", "open_interest_btc_desc", "trade_volume_24h_btc_asc", "trade_volume_24h_btc_desc"]).optional().describe("Sort order"),
      perPage: z.number().optional().default(100).describe("Results per page"),
      page: z.number().optional().default(1).describe("Page number")
    },
    async (params) => {
      const data = await coinGeckoRequest("/derivatives/exchanges", {
        order: params.order,
        per_page: params.perPage,
        page: params.page
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch derivatives exchanges" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get NFT List
  server.tool(
    "market_coingecko_nfts_list",
    "Get list of all supported NFT collections",
    {
      order: z.enum(["h24_volume_native_asc", "h24_volume_native_desc", "floor_price_native_asc", "floor_price_native_desc", "market_cap_native_asc", "market_cap_native_desc", "market_cap_usd_asc", "market_cap_usd_desc"]).optional().describe("Sort order"),
      perPage: z.number().optional().default(100).describe("Results per page"),
      page: z.number().optional().default(1).describe("Page number")
    },
    async (params) => {
      const data = await coinGeckoRequest("/nfts/list", {
        order: params.order,
        per_page: params.perPage,
        page: params.page
      })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch NFT list" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get NFT Collection
  server.tool(
    "market_coingecko_nft",
    "Get detailed NFT collection data",
    {
      id: z.string().describe("NFT collection ID")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/nfts/${params.id}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch NFT data" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Exchange Rates
  server.tool(
    "market_coingecko_exchange_rates",
    "Get BTC exchange rates against all supported currencies",
    {},
    async () => {
      const data = await coinGeckoRequest("/exchange_rates")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch exchange rates" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // Get Companies Holdings
  server.tool(
    "market_coingecko_companies_holdings",
    "Get public companies Bitcoin or Ethereum holdings",
    {
      coinId: z.enum(["bitcoin", "ethereum"]).describe("Coin ID (bitcoin or ethereum)")
    },
    async (params) => {
      const data = await coinGeckoRequest(`/companies/public_treasury/${params.coinId}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch companies holdings" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}

// Helper functions for Fear & Greed Index
function getClassification(value: number): string {
  if (value <= 24) return "Extreme Fear"
  if (value <= 49) return "Fear"
  if (value <= 74) return "Greed"
  return "Extreme Greed"
}

function getInterpretation(value: number): string {
  if (value <= 24) {
    return "Market is in Extreme Fear - historically a good buying opportunity as investors are overly worried"
  }
  if (value <= 49) {
    return "Market is in Fear - investors are cautious, potential accumulation zone"
  }
  if (value <= 74) {
    return "Market is in Greed - investors are optimistic, consider taking some profits"
  }
  return "Market is in Extreme Greed - historically a risky time to buy, consider selling"
}

function getTrendInterpretation(trend: string, average: number, change: number): string {
  if (trend === "INCREASING" && average > 50) {
    return "Sentiment is improving and already positive - market momentum is bullish but be cautious of overheating"
  }
  if (trend === "INCREASING" && average <= 50) {
    return "Sentiment is recovering from fear - potential early signs of market recovery"
  }
  if (trend === "DECREASING" && average > 50) {
    return "Sentiment is declining from greed - market may be cooling off, healthy correction possible"
  }
  if (trend === "DECREASING" && average <= 50) {
    return "Sentiment continues to worsen - market fear increasing, watch for capitulation"
  }
  return "Sentiment is stable - market is in consolidation phase"
}
