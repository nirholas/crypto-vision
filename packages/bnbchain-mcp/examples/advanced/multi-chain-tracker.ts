#!/usr/bin/env npx ts-node
/**
 * Multi-Chain Tracker - Advanced Example
 * 
 * This example demonstrates how to:
 * - Track assets across multiple EVM chains simultaneously
 * - Implement parallel data fetching with concurrency control
 * - Build cross-chain comparison dashboards
 * - Handle different chain configurations and RPCs
 * 
 * Difficulty: ⭐⭐⭐ Advanced
 * Prerequisites: Node.js 18+, pnpm
 * Estimated Time: 30 minutes
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
  sleep,
  parallelLimit,
  retry,
  NETWORKS
} from "../lib/utils.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

// ============================================================================
// Configuration
// ============================================================================

// All supported chains
const ALL_CHAINS = [
  "ethereum",
  "bsc",
  "arbitrum",
  "polygon",
  "optimism",
  "base",
  "avalanche"
]

// Native token price IDs (CoinGecko)
const NATIVE_TOKEN_PRICE_IDS: Record<string, string> = {
  ethereum: "ethereum",
  bsc: "binancecoin",
  arbitrum: "ethereum",
  polygon: "matic-network",
  optimism: "ethereum",
  base: "ethereum",
  avalanche: "avalanche-2"
}

// Concurrency settings
const MAX_CONCURRENT_REQUESTS = 4
const RETRY_ATTEMPTS = 3

// Demo address
const DEFAULT_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

// ============================================================================
// Types
// ============================================================================

interface ChainData {
  network: string
  chainId: number
  status: "success" | "error" | "pending"
  nativeBalance: {
    raw: string
    formatted: number
  }
  nativePrice?: number
  nativeValue?: number
  gasPrice: number
  tokenCount: number
  tokens: Array<{
    symbol: string
    address: string
    balance: string
    formatted: number
  }>
  error?: string
  latency: number
}

interface MultiChainSummary {
  address: string
  totalValueUSD: number
  chains: ChainData[]
  topTokens: Array<{
    symbol: string
    network: string
    balance: number
    value?: number
  }>
  cheapestGas: {
    network: string
    gasPrice: number
  }
  mostExpensiveGas: {
    network: string
    gasPrice: number
  }
  fetchedAt: Date
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetch native token prices
 */
async function fetchNativePrices(client: Client): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  const uniqueIds = [...new Set(Object.values(NATIVE_TOKEN_PRICE_IDS))]
  
  for (const coinId of uniqueIds) {
    try {
      const result = await retry(async () => {
        return callTool<{ coin: { current_price: number } }>(client, "market_get_coin_by_id", {
          coinId,
          currency: "USD"
        })
      }, RETRY_ATTEMPTS)
      
      if (result?.coin?.current_price) {
        prices[coinId] = result.coin.current_price
      }
    } catch {
      // Price unavailable
    }
  }
  
  return prices
}

/**
 * Fetch data for a single chain
 */
async function fetchChainData(
  client: Client,
  address: string,
  network: string,
  nativePrices: Record<string, number>
): Promise<ChainData> {
  const startTime = Date.now()
  const chainConfig = NETWORKS[network]
  
  try {
    // Fetch balance and portfolio in parallel
    const [balanceResult, gasResult, portfolioResult] = await Promise.all([
      retry(async () => {
        return callTool<{ formatted: string; balance: string }>(client, "get_native_balance", {
          address,
          network
        })
      }, RETRY_ATTEMPTS),
      
      retry(async () => {
        return callTool<{ gasPrice: { standard: string } }>(client, "get_gas_price", {
          network
        })
      }, RETRY_ATTEMPTS),
      
      retry(async () => {
        return callTool<{
          chainId: number
          tokens: Array<{ symbol: string; address: string; formatted: string }>
        }>(client, "get_portfolio_overview", {
          address,
          network
        })
      }, RETRY_ATTEMPTS)
    ])
    
    const nativeFormatted = parseFloat(balanceResult?.formatted || "0")
    const gasPrice = parseFloat(gasResult?.gasPrice?.standard || "0")
    const priceId = NATIVE_TOKEN_PRICE_IDS[network]
    const nativePrice = priceId ? nativePrices[priceId] : undefined
    const nativeValue = nativePrice ? nativeFormatted * nativePrice : undefined
    
    const tokens = (portfolioResult?.tokens || []).map(t => ({
      symbol: t.symbol,
      address: t.address,
      balance: t.formatted,
      formatted: parseFloat(t.formatted)
    }))
    
    return {
      network,
      chainId: portfolioResult?.chainId || 0,
      status: "success",
      nativeBalance: {
        raw: balanceResult?.balance || "0",
        formatted: nativeFormatted
      },
      nativePrice,
      nativeValue,
      gasPrice,
      tokenCount: tokens.length,
      tokens,
      latency: Date.now() - startTime
    }
    
  } catch (error) {
    return {
      network,
      chainId: 0,
      status: "error",
      nativeBalance: { raw: "0", formatted: 0 },
      gasPrice: 0,
      tokenCount: 0,
      tokens: [],
      error: (error as Error).message,
      latency: Date.now() - startTime
    }
  }
}

/**
 * Fetch data from all chains
 */
async function fetchAllChains(
  client: Client,
  address: string,
  chains: string[]
): Promise<MultiChainSummary> {
  const spinner = ora("Fetching native token prices...").start()
  
  // Get prices first
  const nativePrices = await fetchNativePrices(client)
  spinner.succeed("Prices fetched")
  
  // Fetch chain data with concurrency limit
  spinner.start(`Fetching data from ${chains.length} chains...`)
  
  const fetchTasks = chains.map(network => async () => {
    return fetchChainData(client, address, network, nativePrices)
  })
  
  const chainData = await parallelLimit(fetchTasks, MAX_CONCURRENT_REQUESTS)
  
  const successCount = chainData.filter(c => c.status === "success").length
  spinner.succeed(`Fetched ${successCount}/${chains.length} chains successfully`)
  
  // Calculate totals
  const totalValueUSD = chainData
    .filter(c => c.status === "success" && c.nativeValue)
    .reduce((sum, c) => sum + (c.nativeValue || 0), 0)
  
  // Get top tokens across all chains
  const allTokens: Array<{ symbol: string; network: string; balance: number; value?: number }> = []
  for (const chain of chainData) {
    if (chain.status === "success") {
      // Add native token
      if (chain.nativeBalance.formatted > 0) {
        allTokens.push({
          symbol: NETWORKS[chain.network]?.nativeToken || "???",
          network: chain.network,
          balance: chain.nativeBalance.formatted,
          value: chain.nativeValue
        })
      }
      // Add ERC20 tokens
      for (const token of chain.tokens) {
        allTokens.push({
          symbol: token.symbol,
          network: chain.network,
          balance: token.formatted
        })
      }
    }
  }
  
  const topTokens = allTokens
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 10)
  
  // Find cheapest/most expensive gas
  const successChains = chainData.filter(c => c.status === "success" && c.gasPrice > 0)
  const cheapestGas = successChains.reduce((min, c) => 
    c.gasPrice < min.gasPrice ? { network: c.network, gasPrice: c.gasPrice } : min,
    { network: "", gasPrice: Infinity }
  )
  const mostExpensiveGas = successChains.reduce((max, c) =>
    c.gasPrice > max.gasPrice ? { network: c.network, gasPrice: c.gasPrice } : max,
    { network: "", gasPrice: 0 }
  )
  
  return {
    address,
    totalValueUSD,
    chains: chainData,
    topTokens,
    cheapestGas,
    mostExpensiveGas,
    fetchedAt: new Date()
  }
}

// ============================================================================
// Display Functions
// ============================================================================

/**
 * Display chain comparison table
 */
function displayChainComparison(summary: MultiChainSummary): void {
  printSection("🌐 Multi-Chain Overview")
  
  const table = new Table({
    head: [
      chalk.bold("Chain"),
      chalk.bold("Status"),
      chalk.bold("Native Balance"),
      chalk.bold("Value (USD)"),
      chalk.bold("Gas (Gwei)"),
      chalk.bold("Tokens"),
      chalk.bold("Latency")
    ],
    style: { head: [], border: [] }
  })

  for (const chain of summary.chains.sort((a, b) => (b.nativeValue || 0) - (a.nativeValue || 0))) {
    const config = NETWORKS[chain.network]
    const statusIcon = chain.status === "success" ? chalk.green("✓") : chalk.red("✗")
    const statusText = chain.status === "success" ? "OK" : chain.error?.slice(0, 20) || "Error"
    
    table.push([
      config?.name || chain.network,
      `${statusIcon} ${statusText}`,
      chain.status === "success" 
        ? `${formatNumber(chain.nativeBalance.formatted, 4)} ${config?.nativeToken || ""}` 
        : "N/A",
      chain.nativeValue ? formatUSD(chain.nativeValue) : "N/A",
      chain.gasPrice > 0 ? formatNumber(chain.gasPrice, 2) : "N/A",
      chain.tokenCount.toString(),
      `${chain.latency}ms`
    ])
  }

  console.log(table.toString())
}

/**
 * Display top holdings
 */
function displayTopHoldings(summary: MultiChainSummary): void {
  printSection("🏆 Top Holdings (by value)")
  
  if (summary.topTokens.length === 0) {
    printInfo("No holdings found")
    return
  }

  const table = new Table({
    head: [
      chalk.bold("#"),
      chalk.bold("Token"),
      chalk.bold("Chain"),
      chalk.bold("Balance"),
      chalk.bold("Value")
    ],
    style: { head: [], border: [] }
  })

  summary.topTokens.forEach((token, index) => {
    const config = NETWORKS[token.network]
    table.push([
      (index + 1).toString(),
      chalk.bold(token.symbol),
      config?.name || token.network,
      formatNumber(token.balance, 4),
      token.value ? formatUSD(token.value) : "N/A"
    ])
  })

  console.log(table.toString())
}

/**
 * Display gas comparison
 */
function displayGasComparison(summary: MultiChainSummary): void {
  printSection("⛽ Gas Comparison")
  
  // Sort by gas price
  const sortedChains = summary.chains
    .filter(c => c.status === "success" && c.gasPrice > 0)
    .sort((a, b) => a.gasPrice - b.gasPrice)
  
  if (sortedChains.length === 0) {
    printInfo("No gas data available")
    return
  }
  
  console.log("  Cheapest → Most Expensive:")
  console.log()
  
  for (const chain of sortedChains) {
    const config = NETWORKS[chain.network]
    const isCheapest = chain.network === summary.cheapestGas.network
    const isMostExpensive = chain.network === summary.mostExpensiveGas.network
    
    let indicator = "  "
    if (isCheapest) indicator = chalk.green("🏆")
    else if (isMostExpensive) indicator = chalk.red("💸")
    
    const bar = "█".repeat(Math.min(Math.ceil(chain.gasPrice / 5), 20))
    const gasColor = chain.gasPrice < 10 ? chalk.green : chain.gasPrice < 50 ? chalk.yellow : chalk.red
    
    console.log(`  ${indicator} ${(config?.name || chain.network).padEnd(12)} ${gasColor(bar.padEnd(20))} ${formatNumber(chain.gasPrice, 2)} Gwei`)
  }
}

/**
 * Display cross-chain summary
 */
function displayCrossChainSummary(summary: MultiChainSummary): void {
  printSection("📊 Cross-Chain Summary")
  
  const successCount = summary.chains.filter(c => c.status === "success").length
  const totalTokens = summary.chains.reduce((sum, c) => sum + c.tokenCount, 0)
  const avgLatency = summary.chains.reduce((sum, c) => sum + c.latency, 0) / summary.chains.length
  
  printKeyValue("Address", shortenAddress(summary.address))
  printKeyValue("Total Value", chalk.bold.green(formatUSD(summary.totalValueUSD)))
  printKeyValue("Chains Tracked", `${successCount}/${summary.chains.length}`)
  printKeyValue("Total Tokens", totalTokens.toString())
  printKeyValue("Avg Latency", `${formatNumber(avgLatency, 0)}ms`)
  printKeyValue("Fetched At", summary.fetchedAt.toLocaleString())
  
  console.log()
  if (summary.cheapestGas.network) {
    const cheapConfig = NETWORKS[summary.cheapestGas.network]
    printSuccess(`Cheapest gas: ${cheapConfig?.name || summary.cheapestGas.network} (${formatNumber(summary.cheapestGas.gasPrice, 2)} Gwei)`)
  }
  
  if (summary.mostExpensiveGas.network) {
    const expConfig = NETWORKS[summary.mostExpensiveGas.network]
    printWarning(`Most expensive: ${expConfig?.name || summary.mostExpensiveGas.network} (${formatNumber(summary.mostExpensiveGas.gasPrice, 2)} Gwei)`)
  }
}

/**
 * Display recommendations
 */
function displayRecommendations(summary: MultiChainSummary): void {
  printSection("💡 Recommendations")
  
  const recommendations: string[] = []
  
  // Check for concentration
  const totalValue = summary.totalValueUSD
  for (const chain of summary.chains) {
    if (chain.nativeValue && totalValue > 0) {
      const percent = (chain.nativeValue / totalValue) * 100
      if (percent > 80) {
        const config = NETWORKS[chain.network]
        recommendations.push(`High concentration on ${config?.name || chain.network} (${formatNumber(percent, 1)}%). Consider diversifying.`)
      }
    }
  }
  
  // Check gas for optimal chain usage
  if (summary.cheapestGas.network && summary.mostExpensiveGas.network) {
    const ratio = summary.mostExpensiveGas.gasPrice / summary.cheapestGas.gasPrice
    if (ratio > 10) {
      const cheapConfig = NETWORKS[summary.cheapestGas.network]
      recommendations.push(`Gas is ${formatNumber(ratio, 0)}x cheaper on ${cheapConfig?.name}. Consider using it for non-urgent transactions.`)
    }
  }
  
  // Check for unused chains
  const emptyChains = summary.chains.filter(c => c.status === "success" && c.nativeBalance.formatted === 0)
  if (emptyChains.length > 0 && emptyChains.length < summary.chains.length) {
    recommendations.push(`${emptyChains.length} chains have zero balance. Bridge assets if you want to use them.`)
  }
  
  if (recommendations.length === 0) {
    recommendations.push("Portfolio looks well-distributed across chains.")
  }
  
  for (const rec of recommendations) {
    console.log(`  • ${rec}`)
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  // Get configuration
  const address = getEnv("ADDRESS", DEFAULT_ADDRESS)
  const chainsEnv = getEnv("CHAINS", "")
  const chains = chainsEnv 
    ? chainsEnv.split(",").map(s => s.trim().toLowerCase())
    : ALL_CHAINS
  const continuous = getEnv("CONTINUOUS", "false") === "true"
  const interval = parseInt(getEnv("INTERVAL", "300"))

  printHeader("🌐 Multi-Chain Asset Tracker")

  // Validate address
  if (!isValidAddress(address)) {
    printError(`Invalid address: ${address}`)
    process.exit(1)
  }

  printInfo(`Tracking: ${shortenAddress(address)}`)
  printInfo(`Chains: ${chains.join(", ")}`)
  
  if (continuous) {
    printInfo(`Refresh interval: ${interval}s`)
    printInfo("Press Ctrl+C to stop")
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
        printHeader("🌐 Multi-Chain Asset Tracker")
      }

      // Fetch all chain data
      const summary = await fetchAllChains(client, address, chains)

      // Display results
      displayCrossChainSummary(summary)
      displayChainComparison(summary)
      displayTopHoldings(summary)
      displayGasComparison(summary)
      displayRecommendations(summary)

      // Links
      printSection("🔗 Explorers")
      for (const chain of summary.chains.filter(c => c.status === "success")) {
        const config = NETWORKS[chain.network]
        if (config) {
          console.log(`  ${config.name}: ${config.explorer}/address/${address}`)
        }
      }

      if (continuous) {
        printInfo(`\nRefreshing in ${interval} seconds...`)
        await sleep(interval * 1000)
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
 * @example Track default address
 * ```bash
 * npx ts-node advanced/multi-chain-tracker.ts
 * ```
 * 
 * @example Track custom address
 * ```bash
 * ADDRESS=0xYourAddress npx ts-node advanced/multi-chain-tracker.ts
 * ```
 * 
 * @example Track specific chains
 * ```bash
 * CHAINS=ethereum,arbitrum,base npx ts-node advanced/multi-chain-tracker.ts
 * ```
 * 
 * @example Continuous tracking
 * ```bash
 * CONTINUOUS=true INTERVAL=60 npx ts-node advanced/multi-chain-tracker.ts
 * ```
 */
