#!/usr/bin/env npx ts-node
/**
 * Portfolio Analyzer - Intermediate Example
 * 
 * This example demonstrates how to:
 * - Analyze a complete multi-chain portfolio
 * - Fetch balances across multiple networks simultaneously
 * - Calculate total portfolio value
 * - Display asset allocation breakdown
 * - Track portfolio changes over time
 * 
 * Difficulty: ⭐⭐ Intermediate
 * Prerequisites: Node.js 18+, pnpm
 * Estimated Time: 20 minutes
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
  shortenAddress,
  isValidAddress,
  getEnv,
  parallelLimit,
  NETWORKS
} from "../lib/utils.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

// ============================================================================
// Configuration
// ============================================================================

// Networks to analyze
const SUPPORTED_NETWORKS = ["ethereum", "bsc", "arbitrum", "polygon", "base", "optimism"]

// Demo address (Vitalik)
const DEFAULT_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

// Concurrency limit for API calls
const CONCURRENCY_LIMIT = 3

// ============================================================================
// Types
// ============================================================================

interface TokenHolding {
  symbol: string
  name: string
  address: string
  balance: string
  decimals: number
  price?: number
  value?: number
  network: string
  change24h?: number
}

interface NetworkPortfolio {
  network: string
  chainId: number
  nativeToken: {
    symbol: string
    balance: string
    price?: number
    value?: number
    change24h?: number
  }
  tokens: TokenHolding[]
  totalValue: number
}

interface PortfolioSummary {
  address: string
  totalValue: number
  networks: NetworkPortfolio[]
  topHoldings: TokenHolding[]
  allocation: {
    byNetwork: Record<string, number>
    byAsset: Record<string, number>
  }
  lastUpdated: string
}

interface PortfolioOverviewResult {
  network: string
  chainId: number
  address: string
  native: {
    balance: string
    formatted: string
  }
  tokens: Array<{
    symbol: string
    address: string
    balance: string
    formatted: string
  }>
  summary: {
    totalTokens: number
    totalHoldings: number
  }
}

interface CoinPriceResult {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  market_cap: number
}

// ============================================================================
// Price Fetching
// ============================================================================

// Native token CoinGecko IDs
const NATIVE_TOKEN_IDS: Record<string, string> = {
  ethereum: "ethereum",
  bsc: "binancecoin",
  polygon: "matic-network",
  arbitrum: "ethereum",
  optimism: "ethereum",
  base: "ethereum",
  avalanche: "avalanche-2"
}

/**
 * Get prices for native tokens
 */
async function getNativePrices(client: Client): Promise<Record<string, { price: number; change24h: number }>> {
  const prices: Record<string, { price: number; change24h: number }> = {}
  
  try {
    // Get unique token IDs
    const tokenIds = [...new Set(Object.values(NATIVE_TOKEN_IDS))]
    
    for (const tokenId of tokenIds) {
      try {
        const result = await callTool<CoinPriceResult>(client, "market_get_coin_by_id", {
          coinId: tokenId,
          currency: "USD"
        })
        
        if (result) {
          prices[tokenId] = {
            price: result.current_price,
            change24h: result.price_change_percentage_24h
          }
        }
      } catch {
        // Price not available, continue
      }
    }
  } catch (error) {
    printWarning("Could not fetch prices, values will be estimated")
  }
  
  return prices
}

// ============================================================================
// Portfolio Analysis Functions
// ============================================================================

/**
 * Get portfolio for a single network
 */
async function getNetworkPortfolio(
  client: Client,
  address: string,
  network: string,
  nativePrices: Record<string, { price: number; change24h: number }>
): Promise<NetworkPortfolio | null> {
  try {
    const result = await callTool<PortfolioOverviewResult>(client, "get_portfolio_overview", {
      address,
      network
    })

    if (!result) return null

    const networkConfig = NETWORKS[network]
    const priceId = NATIVE_TOKEN_IDS[network]
    const priceData = priceId ? nativePrices[priceId] : undefined
    
    const nativeBalance = parseFloat(result.native.formatted)
    const nativeValue = priceData ? nativeBalance * priceData.price : 0

    // Process token holdings
    const tokens: TokenHolding[] = result.tokens.map(token => ({
      symbol: token.symbol,
      name: token.symbol,
      address: token.address,
      balance: token.formatted,
      decimals: 18,
      network,
      value: 0 // Would need token prices for accurate values
    }))

    const totalValue = nativeValue // + token values

    return {
      network,
      chainId: result.chainId,
      nativeToken: {
        symbol: networkConfig?.nativeToken || "ETH",
        balance: result.native.formatted,
        price: priceData?.price,
        value: nativeValue,
        change24h: priceData?.change24h
      },
      tokens,
      totalValue
    }
  } catch (error) {
    return null
  }
}

/**
 * Analyze complete portfolio across all networks
 */
async function analyzePortfolio(
  client: Client,
  address: string
): Promise<PortfolioSummary> {
  const spinner = ora("Fetching native token prices...").start()
  
  // Get prices first
  const nativePrices = await getNativePrices(client)
  spinner.succeed("Prices fetched")
  
  // Fetch portfolio from each network
  spinner.start("Analyzing portfolio across networks...")
  
  const portfolioTasks = SUPPORTED_NETWORKS.map(network => async () => {
    return getNetworkPortfolio(client, address, network, nativePrices)
  })
  
  const portfolioResults = await parallelLimit(portfolioTasks, CONCURRENCY_LIMIT)
  const networks = portfolioResults.filter((p): p is NetworkPortfolio => p !== null)
  
  spinner.succeed(`Analyzed ${networks.length} networks`)
  
  // Calculate totals
  const totalValue = networks.reduce((sum, n) => sum + n.totalValue, 0)
  
  // Get top holdings
  const allHoldings: TokenHolding[] = []
  for (const network of networks) {
    // Add native token as holding
    if (network.nativeToken.value && network.nativeToken.value > 0) {
      allHoldings.push({
        symbol: network.nativeToken.symbol,
        name: network.nativeToken.symbol,
        address: "native",
        balance: network.nativeToken.balance,
        decimals: 18,
        price: network.nativeToken.price,
        value: network.nativeToken.value,
        network: network.network,
        change24h: network.nativeToken.change24h
      })
    }
    // Add token holdings
    allHoldings.push(...network.tokens)
  }
  
  // Sort by value and get top 10
  const topHoldings = allHoldings
    .filter(h => h.value && h.value > 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 10)
  
  // Calculate allocation
  const byNetwork: Record<string, number> = {}
  const byAsset: Record<string, number> = {}
  
  for (const network of networks) {
    if (network.totalValue > 0) {
      byNetwork[network.network] = (network.totalValue / totalValue) * 100
    }
  }
  
  for (const holding of topHoldings) {
    if (holding.value && totalValue > 0) {
      const key = holding.symbol
      byAsset[key] = (byAsset[key] || 0) + (holding.value / totalValue) * 100
    }
  }
  
  return {
    address,
    totalValue,
    networks,
    topHoldings,
    allocation: { byNetwork, byAsset },
    lastUpdated: new Date().toISOString()
  }
}

// ============================================================================
// Display Functions
// ============================================================================

/**
 * Display portfolio summary
 */
function displayPortfolioSummary(summary: PortfolioSummary): void {
  printSection("💰 Portfolio Overview")
  printKeyValue("Address", shortenAddress(summary.address))
  printKeyValue("Total Value", chalk.bold.green(formatUSD(summary.totalValue)))
  printKeyValue("Networks", `${summary.networks.length} chains`)
  printKeyValue("Last Updated", new Date(summary.lastUpdated).toLocaleString())
}

/**
 * Display network breakdown
 */
function displayNetworkBreakdown(networks: NetworkPortfolio[]): void {
  printSection("🌐 Network Breakdown")
  
  const table = new Table({
    head: [
      chalk.bold("Network"),
      chalk.bold("Native Balance"),
      chalk.bold("Price"),
      chalk.bold("Value"),
      chalk.bold("24h Change"),
      chalk.bold("Tokens")
    ],
    style: { head: [], border: [] }
  })

  for (const network of networks.sort((a, b) => b.totalValue - a.totalValue)) {
    const config = NETWORKS[network.network]
    const change = network.nativeToken.change24h
    const changeColor = change && change >= 0 ? chalk.green : chalk.red
    
    table.push([
      config?.name || network.network,
      `${formatNumber(parseFloat(network.nativeToken.balance), 4)} ${network.nativeToken.symbol}`,
      network.nativeToken.price ? formatUSD(network.nativeToken.price) : "N/A",
      network.nativeToken.value ? formatUSD(network.nativeToken.value) : "N/A",
      change ? changeColor(formatPercent(change)) : "N/A",
      network.tokens.length.toString()
    ])
  }

  console.log(table.toString())
}

/**
 * Display top holdings
 */
function displayTopHoldings(holdings: TokenHolding[]): void {
  if (holdings.length === 0) {
    printInfo("No holdings with value found")
    return
  }

  printSection("🏆 Top Holdings")
  
  const table = new Table({
    head: [
      chalk.bold("#"),
      chalk.bold("Asset"),
      chalk.bold("Network"),
      chalk.bold("Balance"),
      chalk.bold("Value"),
      chalk.bold("24h")
    ],
    style: { head: [], border: [] }
  })

  holdings.forEach((holding, index) => {
    const change = holding.change24h
    const changeColor = change && change >= 0 ? chalk.green : chalk.red
    const config = NETWORKS[holding.network]
    
    table.push([
      (index + 1).toString(),
      chalk.bold(holding.symbol),
      config?.name || holding.network,
      formatNumber(parseFloat(holding.balance), 4),
      holding.value ? formatUSD(holding.value) : "N/A",
      change ? changeColor(formatPercent(change)) : "N/A"
    ])
  })

  console.log(table.toString())
}

/**
 * Display allocation chart (text-based)
 */
function displayAllocation(allocation: { byNetwork: Record<string, number>; byAsset: Record<string, number> }): void {
  printSection("📊 Allocation")
  
  console.log("  By Network:")
  const sortedNetworks = Object.entries(allocation.byNetwork)
    .sort(([, a], [, b]) => b - a)
  
  for (const [network, percent] of sortedNetworks) {
    const config = NETWORKS[network]
    const bar = "█".repeat(Math.round(percent / 5)) + "░".repeat(20 - Math.round(percent / 5))
    console.log(`    ${(config?.name || network).padEnd(15)} ${bar} ${formatNumber(percent, 1)}%`)
  }
  
  console.log()
  console.log("  By Asset:")
  const sortedAssets = Object.entries(allocation.byAsset)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
  
  for (const [asset, percent] of sortedAssets) {
    const bar = "█".repeat(Math.round(percent / 5)) + "░".repeat(20 - Math.round(percent / 5))
    console.log(`    ${asset.padEnd(15)} ${bar} ${formatNumber(percent, 1)}%`)
  }
}

/**
 * Display recommendations
 */
function displayRecommendations(summary: PortfolioSummary): void {
  printSection("💡 Insights & Recommendations")
  
  const insights: string[] = []
  
  // Check diversification
  const networkCount = summary.networks.filter(n => n.totalValue > 0).length
  if (networkCount === 1) {
    insights.push("Consider diversifying across multiple chains to reduce risk")
  } else if (networkCount >= 3) {
    insights.push("Good diversification across multiple chains")
  }
  
  // Check concentration
  const topHolding = summary.topHoldings[0]
  if (topHolding && summary.totalValue > 0) {
    const topPercent = ((topHolding.value || 0) / summary.totalValue) * 100
    if (topPercent > 50) {
      insights.push(`High concentration in ${topHolding.symbol} (${formatNumber(topPercent, 1)}%)`)
    }
  }
  
  // Check for stablecoins
  const hasStables = summary.topHoldings.some(h => 
    ["USDC", "USDT", "DAI", "BUSD"].includes(h.symbol)
  )
  if (!hasStables && summary.totalValue > 1000) {
    insights.push("Consider holding some stablecoins for risk management")
  }
  
  // Display insights
  for (const insight of insights) {
    console.log(`  • ${insight}`)
  }
  
  if (insights.length === 0) {
    console.log("  • Portfolio looks well-balanced")
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  // Get configuration
  const address = getEnv("ADDRESS", DEFAULT_ADDRESS)
  
  printHeader("📊 Multi-Chain Portfolio Analyzer")

  // Validate address
  if (!isValidAddress(address)) {
    printError(`Invalid address: ${address}`)
    process.exit(1)
  }

  printInfo(`Analyzing portfolio for: ${address}`)
  console.log()

  let client: Client | null = null

  try {
    // Connect to MCP server
    const spinner = ora("Connecting to MCP server...").start()
    client = await createMCPClient()
    spinner.succeed("Connected to Universal Crypto MCP")

    // Analyze portfolio
    const summary = await analyzePortfolio(client, address)

    // Display results
    console.log()
    displayPortfolioSummary(summary)
    displayNetworkBreakdown(summary.networks)
    displayTopHoldings(summary.topHoldings)
    displayAllocation(summary.allocation)
    displayRecommendations(summary)

    // Links
    printSection("🔗 View on Explorers")
    for (const network of summary.networks.filter(n => n.totalValue > 0)) {
      const config = NETWORKS[network.network]
      if (config) {
        console.log(`  ${config.name}: ${config.explorer}/address/${address}`)
      }
    }

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
 * @example Analyze default address
 * ```bash
 * npx ts-node intermediate/portfolio-analyzer.ts
 * ```
 * 
 * @example Analyze custom address
 * ```bash
 * ADDRESS=0xYourAddress npx ts-node intermediate/portfolio-analyzer.ts
 * ```
 */
