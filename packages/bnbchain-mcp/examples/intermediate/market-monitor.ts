#!/usr/bin/env npx ts-node
/**
 * Market Monitor - Intermediate Example
 * 
 * This example demonstrates how to:
 * - Track cryptocurrency prices and market data
 * - Monitor trending tokens and market sentiment
 * - Display Fear & Greed Index
 * - Generate market reports
 * 
 * Difficulty: ⭐⭐ Intermediate
 * Prerequisites: Node.js 18+, pnpm
 * Estimated Time: 15 minutes
 * 
 * @author Nich
 * @license MIT
 */

import "dotenv/config"
import Table from "cli-table3"
import chalk from "chalk"
import ora from "ora"
import {
  createMCPClient,
  callTool,
  printHeader,
  printSection,
  printKeyValue,
  printSuccess,
  printError,
  printInfo,
  printWarning,
  formatNumber,
  formatUSD,
  formatPercent,
  formatCompact,
  getEnv,
  sleep
} from "../lib/utils.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

// ============================================================================
// Configuration
// ============================================================================

// Default coins to track
const DEFAULT_WATCHLIST = ["bitcoin", "ethereum", "binancecoin", "solana", "arbitrum"]

// Refresh interval for continuous mode (seconds)
const REFRESH_INTERVAL = 60

// ============================================================================
// Types
// ============================================================================

interface CoinData {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  total_volume: number
  price_change_percentage_24h: number
  price_change_percentage_7d?: number
  high_24h: number
  low_24h: number
  ath: number
  ath_change_percentage: number
  circulating_supply: number
  total_supply?: number
}

interface FearGreedData {
  value: string
  value_classification: string
  timestamp: string
  time_until_update?: string
}

interface TrendingCoin {
  id: string
  name: string
  symbol: string
  market_cap_rank: number
  price_btc: number
  score: number
}

interface MarketGlobal {
  active_cryptocurrencies: number
  markets: number
  total_market_cap: Record<string, number>
  total_volume: Record<string, number>
  market_cap_percentage: Record<string, number>
  market_cap_change_percentage_24h_usd: number
}

// ============================================================================
// Market Data Functions
// ============================================================================

/**
 * Get data for specific coins
 */
async function getCoinData(client: Client, coinIds: string[]): Promise<CoinData[]> {
  const coins: CoinData[] = []
  
  for (const coinId of coinIds) {
    try {
      const result = await callTool<{ coin: CoinData }>(client, "market_get_coin_by_id", {
        coinId,
        currency: "USD"
      })
      
      if (result?.coin) {
        coins.push(result.coin)
      }
    } catch {
      // Skip failed coins
    }
  }
  
  return coins
}

/**
 * Get Fear & Greed Index
 */
async function getFearGreedIndex(client: Client): Promise<FearGreedData | null> {
  try {
    const result = await callTool<{ data: FearGreedData[] }>(client, "market_get_fear_greed", {})
    return result?.data?.[0] || null
  } catch {
    return null
  }
}

/**
 * Get trending coins
 */
async function getTrendingCoins(client: Client): Promise<TrendingCoin[]> {
  try {
    const result = await callTool<{ coins: Array<{ item: TrendingCoin }> }>(
      client, 
      "market_get_trending", 
      {}
    )
    return result?.coins?.map(c => c.item) || []
  } catch {
    return []
  }
}

/**
 * Get global market data
 */
async function getGlobalMarket(client: Client): Promise<MarketGlobal | null> {
  try {
    const result = await callTool<{ data: MarketGlobal }>(client, "market_get_global", {})
    return result?.data || null
  } catch {
    return null
  }
}

// ============================================================================
// Display Functions
// ============================================================================

/**
 * Get color based on percentage change
 */
function getChangeColor(change: number): chalk.Chalk {
  if (change >= 5) return chalk.bold.green
  if (change >= 0) return chalk.green
  if (change >= -5) return chalk.red
  return chalk.bold.red
}

/**
 * Get Fear & Greed color and emoji
 */
function getFearGreedStyle(value: number): { color: chalk.Chalk; emoji: string } {
  if (value >= 75) return { color: chalk.green, emoji: "🤑" }
  if (value >= 55) return { color: chalk.greenBright, emoji: "😊" }
  if (value >= 45) return { color: chalk.yellow, emoji: "😐" }
  if (value >= 25) return { color: chalk.red, emoji: "😨" }
  return { color: chalk.redBright, emoji: "😱" }
}

/**
 * Display market overview
 */
function displayMarketOverview(global: MarketGlobal | null, fearGreed: FearGreedData | null): void {
  printSection("🌍 Market Overview")
  
  if (global) {
    const totalCap = global.total_market_cap.usd || 0
    const totalVol = global.total_volume.usd || 0
    const change24h = global.market_cap_change_percentage_24h_usd || 0
    
    printKeyValue("Total Market Cap", formatUSD(totalCap))
    printKeyValue("24h Volume", formatUSD(totalVol))
    printKeyValue("24h Change", getChangeColor(change24h)(formatPercent(change24h)))
    printKeyValue("Active Coins", formatNumber(global.active_cryptocurrencies, 0))
    printKeyValue("Markets", formatNumber(global.markets, 0))
    
    // BTC Dominance
    const btcDom = global.market_cap_percentage.btc || 0
    console.log()
    console.log(`  ${chalk.gray("BTC Dominance:")} ${formatNumber(btcDom, 1)}%`)
    const ethDom = global.market_cap_percentage.eth || 0
    console.log(`  ${chalk.gray("ETH Dominance:")} ${formatNumber(ethDom, 1)}%`)
  } else {
    printWarning("Global market data unavailable")
  }
  
  // Fear & Greed
  if (fearGreed) {
    const value = parseInt(fearGreed.value)
    const style = getFearGreedStyle(value)
    console.log()
    console.log(`  ${chalk.gray("Fear & Greed:")} ${style.emoji} ${style.color(`${value} - ${fearGreed.value_classification}`)}`)
  }
}

/**
 * Display watchlist
 */
function displayWatchlist(coins: CoinData[]): void {
  printSection("📋 Watchlist")
  
  if (coins.length === 0) {
    printWarning("No coin data available")
    return
  }

  const table = new Table({
    head: [
      chalk.bold("#"),
      chalk.bold("Coin"),
      chalk.bold("Price"),
      chalk.bold("24h %"),
      chalk.bold("24h High"),
      chalk.bold("24h Low"),
      chalk.bold("Market Cap"),
      chalk.bold("Volume")
    ],
    style: { head: [], border: [] }
  })

  for (const coin of coins.sort((a, b) => a.market_cap_rank - b.market_cap_rank)) {
    const change24h = coin.price_change_percentage_24h || 0
    const changeColor = getChangeColor(change24h)
    
    table.push([
      coin.market_cap_rank?.toString() || "N/A",
      `${coin.symbol.toUpperCase()} ${chalk.gray(coin.name)}`,
      formatUSD(coin.current_price),
      changeColor(formatPercent(change24h)),
      formatUSD(coin.high_24h),
      formatUSD(coin.low_24h),
      formatCompact(coin.market_cap),
      formatCompact(coin.total_volume)
    ])
  }

  console.log(table.toString())
}

/**
 * Display trending coins
 */
function displayTrending(trending: TrendingCoin[]): void {
  printSection("🔥 Trending")
  
  if (trending.length === 0) {
    printInfo("No trending data available")
    return
  }

  const table = new Table({
    head: [
      chalk.bold("Rank"),
      chalk.bold("Coin"),
      chalk.bold("Symbol"),
      chalk.bold("Market Rank"),
      chalk.bold("Score")
    ],
    style: { head: [], border: [] }
  })

  for (const [index, coin] of trending.slice(0, 7).entries()) {
    table.push([
      `#${index + 1}`,
      chalk.bold(coin.name),
      coin.symbol.toUpperCase(),
      coin.market_cap_rank?.toString() || "N/A",
      coin.score.toString()
    ])
  }

  console.log(table.toString())
}

/**
 * Display price alerts
 */
function displayAlerts(coins: CoinData[]): void {
  printSection("⚡ Price Alerts")
  
  const alerts: string[] = []
  
  for (const coin of coins) {
    const change = coin.price_change_percentage_24h || 0
    
    // Significant moves
    if (Math.abs(change) > 10) {
      const direction = change > 0 ? "📈 surged" : "📉 dropped"
      alerts.push(
        `${coin.symbol.toUpperCase()} ${direction} ${formatPercent(Math.abs(change))} in 24h`
      )
    }
    
    // Near ATH
    const athDistance = Math.abs(coin.ath_change_percentage || 0)
    if (athDistance < 10 && athDistance > 0) {
      alerts.push(
        `${coin.symbol.toUpperCase()} is ${formatNumber(athDistance, 1)}% away from ATH`
      )
    }
    
    // Near 24h high/low
    const priceRange = coin.high_24h - coin.low_24h
    const currentPos = (coin.current_price - coin.low_24h) / priceRange
    if (currentPos > 0.95) {
      alerts.push(`${coin.symbol.toUpperCase()} testing 24h highs`)
    } else if (currentPos < 0.05) {
      alerts.push(`${coin.symbol.toUpperCase()} testing 24h lows`)
    }
  }
  
  if (alerts.length === 0) {
    console.log("  No significant alerts")
  } else {
    for (const alert of alerts.slice(0, 5)) {
      console.log(`  • ${alert}`)
    }
  }
}

/**
 * Display market sentiment summary
 */
function displaySentiment(fearGreed: FearGreedData | null, global: MarketGlobal | null): void {
  printSection("💭 Market Sentiment")
  
  let sentiment = "Neutral"
  let description = ""
  
  if (fearGreed) {
    const value = parseInt(fearGreed.value)
    if (value >= 75) {
      sentiment = "Extreme Greed"
      description = "Market may be overheated. Consider taking profits."
    } else if (value >= 55) {
      sentiment = "Greed"
      description = "Bullish sentiment prevails. Stay cautious of reversals."
    } else if (value >= 45) {
      sentiment = "Neutral"
      description = "Market is undecided. Wait for clearer signals."
    } else if (value >= 25) {
      sentiment = "Fear"
      description = "Bearish sentiment. Potential buying opportunity."
    } else {
      sentiment = "Extreme Fear"
      description = "High fear often precedes recovery. DYOR before buying."
    }
  }
  
  console.log(`  Sentiment: ${chalk.bold(sentiment)}`)
  console.log(`  ${chalk.gray(description)}`)
  
  if (global) {
    const change = global.market_cap_change_percentage_24h_usd || 0
    console.log()
    if (change > 3) {
      console.log(`  ${chalk.green("📈 Strong bullish day (+${formatNumber(change, 1)}%)")}`)
    } else if (change > 0) {
      console.log(`  ${chalk.greenBright("↗ Slightly bullish (+${formatNumber(change, 1)}%)")}`)
    } else if (change > -3) {
      console.log(`  ${chalk.red("↘ Slightly bearish (${formatNumber(change, 1)}%)")}`)
    } else {
      console.log(`  ${chalk.redBright("📉 Strong bearish day (${formatNumber(change, 1)}%)")}`)
    }
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  // Get configuration
  const continuous = getEnv("CONTINUOUS", "false") === "true"
  const watchlistEnv = getEnv("WATCHLIST", "")
  const watchlist = watchlistEnv 
    ? watchlistEnv.split(",").map(s => s.trim().toLowerCase())
    : DEFAULT_WATCHLIST

  printHeader("📊 Crypto Market Monitor")
  printInfo(`Tracking: ${watchlist.join(", ")}`)
  
  if (continuous) {
    printInfo(`Auto-refresh: ${REFRESH_INTERVAL}s (Ctrl+C to stop)`)
  }

  let client: Client | null = null

  try {
    // Connect to MCP server
    const spinner = ora("Connecting to MCP server...").start()
    client = await createMCPClient()
    spinner.succeed("Connected to Universal Crypto MCP")

    do {
      if (continuous) {
        console.clear()
        printHeader("📊 Crypto Market Monitor")
        printInfo(`Last update: ${new Date().toLocaleString()}`)
      }

      // Fetch all data
      const spinner = ora("Fetching market data...").start()
      
      const [coins, fearGreed, trending, global] = await Promise.all([
        getCoinData(client, watchlist),
        getFearGreedIndex(client),
        getTrendingCoins(client),
        getGlobalMarket(client)
      ])
      
      spinner.succeed("Market data fetched")

      // Display all sections
      displayMarketOverview(global, fearGreed)
      displayWatchlist(coins)
      displayTrending(trending)
      displayAlerts(coins)
      displaySentiment(fearGreed, global)

      // Timestamp
      printSection("⏰ Data Timestamp")
      console.log(`  ${new Date().toLocaleString()}`)

      if (continuous) {
        console.log()
        printInfo(`Refreshing in ${REFRESH_INTERVAL} seconds...`)
        await sleep(REFRESH_INTERVAL * 1000)
      }

    } while (continuous)

  } catch (error) {
    printError(`Error: ${(error as Error).message}`)
    process.exit(1)
  } finally {
    if (client) {
      await client.close()
    }
  }
}

// Run if executed directly
main().catch(console.error)

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * @example Basic market monitor
 * ```bash
 * npx ts-node intermediate/market-monitor.ts
 * ```
 * 
 * @example Custom watchlist
 * ```bash
 * WATCHLIST=bitcoin,ethereum,solana,avalanche npx ts-node intermediate/market-monitor.ts
 * ```
 * 
 * @example Continuous monitoring
 * ```bash
 * CONTINUOUS=true npx ts-node intermediate/market-monitor.ts
 * ```
 */
