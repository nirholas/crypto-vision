#!/usr/bin/env npx ts-node
/**
 * Gas Tracker - Basic Example
 * 
 * This example demonstrates how to:
 * - Monitor gas prices across multiple EVM networks
 * - Display current gas prices (slow, standard, fast)
 * - Compare gas costs between networks
 * - Estimate transaction costs
 * 
 * Difficulty: ⭐ Beginner
 * Prerequisites: Node.js 18+, pnpm
 * Estimated Time: 10 minutes
 * 
 * @author Nich
 * @license MIT
 */

import "dotenv/config"
import Table from "cli-table3"
import chalk from "chalk"
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
  getEnv,
  sleep,
  NETWORKS
} from "../lib/utils.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

// ============================================================================
// Configuration
// ============================================================================

// Networks to monitor
const MONITORED_NETWORKS = ["ethereum", "bsc", "arbitrum", "polygon", "base", "optimism"]

// Standard gas units for different transaction types
const GAS_UNITS = {
  transfer: 21000,
  erc20Transfer: 65000,
  swap: 150000,
  nftMint: 200000,
  contractDeploy: 500000
}

// Refresh interval for continuous monitoring (in seconds)
const REFRESH_INTERVAL = 30

// ============================================================================
// Types
// ============================================================================

interface GasPriceResult {
  network: string
  chainId: number
  gasPrice: {
    slow: string
    standard: string
    fast: string
  }
  baseFee?: string
  priorityFee?: {
    slow: string
    standard: string
    fast: string
  }
  estimatedCosts?: {
    transfer: string
    erc20Transfer: string
    swap: string
  }
  lastUpdated: string
}

interface NetworkGasData {
  network: string
  nativeToken: string
  slow: number
  standard: number
  fast: number
  baseFee?: number
  transferCost: number
  swapCost: number
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get gas prices for a specific network
 */
async function getGasPrice(client: Client, network: string): Promise<GasPriceResult | null> {
  try {
    const result = await callTool<GasPriceResult>(client, "get_gas_price", {
      network
    })
    return result
  } catch (error) {
    printWarning(`Could not fetch gas for ${network}: ${(error as Error).message}`)
    return null
  }
}

/**
 * Calculate transaction cost in native token
 */
function calculateCost(gasPrice: number, gasUnits: number): number {
  // gasPrice is in Gwei, convert to native token
  return (gasPrice * gasUnits) / 1e9
}

/**
 * Format gas price with color based on value
 */
function formatGasWithColor(gwei: number, network: string): string {
  // Define thresholds based on network
  const thresholds: Record<string, { low: number; high: number }> = {
    ethereum: { low: 20, high: 50 },
    bsc: { low: 3, high: 10 },
    arbitrum: { low: 0.1, high: 0.5 },
    polygon: { low: 50, high: 200 },
    base: { low: 0.01, high: 0.1 },
    optimism: { low: 0.01, high: 0.1 }
  }
  
  const threshold = thresholds[network] || { low: 10, high: 50 }
  const formatted = `${formatNumber(gwei, 2)} Gwei`
  
  if (gwei <= threshold.low) {
    return chalk.green(formatted)
  } else if (gwei >= threshold.high) {
    return chalk.red(formatted)
  } else {
    return chalk.yellow(formatted)
  }
}

/**
 * Display gas prices in a formatted table
 */
function displayGasTable(gasData: NetworkGasData[]): void {
  const table = new Table({
    head: [
      chalk.bold("Network"),
      chalk.bold("🐌 Slow"),
      chalk.bold("🚗 Standard"),
      chalk.bold("🚀 Fast"),
      chalk.bold("Transfer Cost"),
      chalk.bold("Swap Cost")
    ],
    style: {
      head: [],
      border: []
    }
  })

  for (const data of gasData) {
    table.push([
      `${data.network} (${data.nativeToken})`,
      formatGasWithColor(data.slow, data.network.toLowerCase()),
      formatGasWithColor(data.standard, data.network.toLowerCase()),
      formatGasWithColor(data.fast, data.network.toLowerCase()),
      `${formatNumber(data.transferCost, 6)} ${data.nativeToken}`,
      `${formatNumber(data.swapCost, 6)} ${data.nativeToken}`
    ])
  }

  console.log(table.toString())
}

/**
 * Display gas cost comparison for different transaction types
 */
function displayCostComparison(gasData: NetworkGasData[]): void {
  printSection("💰 Transaction Cost Comparison (Standard Gas)")
  
  const costTable = new Table({
    head: [
      chalk.bold("Network"),
      chalk.bold("ETH Transfer"),
      chalk.bold("ERC20 Transfer"),
      chalk.bold("DEX Swap"),
      chalk.bold("NFT Mint")
    ],
    style: {
      head: [],
      border: []
    }
  })

  for (const data of gasData) {
    const standard = data.standard
    costTable.push([
      data.network,
      `${formatNumber(calculateCost(standard, GAS_UNITS.transfer), 6)} ${data.nativeToken}`,
      `${formatNumber(calculateCost(standard, GAS_UNITS.erc20Transfer), 6)} ${data.nativeToken}`,
      `${formatNumber(calculateCost(standard, GAS_UNITS.swap), 6)} ${data.nativeToken}`,
      `${formatNumber(calculateCost(standard, GAS_UNITS.nftMint), 6)} ${data.nativeToken}`
    ])
  }

  console.log(costTable.toString())
}

/**
 * Find the cheapest network for a transaction
 */
function findCheapestNetwork(gasData: NetworkGasData[], txType: keyof typeof GAS_UNITS): NetworkGasData | null {
  if (gasData.length === 0) return null
  
  return gasData.reduce((cheapest, current) => {
    const cheapestCost = calculateCost(cheapest.standard, GAS_UNITS[txType])
    const currentCost = calculateCost(current.standard, GAS_UNITS[txType])
    return currentCost < cheapestCost ? current : cheapest
  })
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  // Get configuration
  const continuous = getEnv("CONTINUOUS", "false") === "true"
  const networksEnv = getEnv("NETWORKS", "")
  const networks = networksEnv 
    ? networksEnv.split(",").map(n => n.trim().toLowerCase())
    : MONITORED_NETWORKS

  printHeader("⛽ Multi-Chain Gas Tracker")
  printInfo(`Monitoring ${networks.length} networks: ${networks.join(", ")}`)
  
  if (continuous) {
    printInfo(`Refresh interval: ${REFRESH_INTERVAL} seconds`)
    printInfo("Press Ctrl+C to stop")
  }

  let client: Client | null = null

  try {
    // Connect to MCP server
    printInfo("Connecting to MCP server...")
    client = await createMCPClient()
    printSuccess("Connected to Universal Crypto MCP")

    do {
      console.clear()
      printHeader("⛽ Multi-Chain Gas Tracker")
      printInfo(`Last updated: ${new Date().toLocaleTimeString()}`)

      // Fetch gas prices from all networks
      printSection("📊 Current Gas Prices")
      
      const gasDataPromises = networks.map(async (network) => {
        const result = await getGasPrice(client!, network)
        if (!result) return null

        const networkConfig = NETWORKS[network]
        return {
          network: networkConfig?.name || network,
          nativeToken: networkConfig?.nativeToken || "ETH",
          slow: parseFloat(result.gasPrice.slow),
          standard: parseFloat(result.gasPrice.standard),
          fast: parseFloat(result.gasPrice.fast),
          baseFee: result.baseFee ? parseFloat(result.baseFee) : undefined,
          transferCost: calculateCost(parseFloat(result.gasPrice.standard), GAS_UNITS.transfer),
          swapCost: calculateCost(parseFloat(result.gasPrice.standard), GAS_UNITS.swap)
        } as NetworkGasData
      })

      const gasResults = await Promise.all(gasDataPromises)
      const gasData = gasResults.filter((d): d is NetworkGasData => d !== null)

      if (gasData.length === 0) {
        printError("Could not fetch gas prices from any network")
      } else {
        // Display main gas table
        displayGasTable(gasData)

        // Display cost comparison
        displayCostComparison(gasData)

        // Show recommendations
        printSection("💡 Recommendations")
        
        const cheapestForSwap = findCheapestNetwork(gasData, "swap")
        if (cheapestForSwap) {
          printSuccess(`Cheapest for swaps: ${cheapestForSwap.network}`)
        }

        const cheapestForTransfer = findCheapestNetwork(gasData, "transfer")
        if (cheapestForTransfer) {
          printSuccess(`Cheapest for transfers: ${cheapestForTransfer.network}`)
        }

        // Gas saving tips
        printSection("📝 Gas Saving Tips")
        console.log("  • Use Layer 2s (Arbitrum, Base, Optimism) for lower fees")
        console.log("  • Time transactions during low activity periods")
        console.log("  • Batch multiple operations when possible")
        console.log("  • Set appropriate gas limits to avoid overpaying")
      }

      if (continuous) {
        printInfo(`\nRefreshing in ${REFRESH_INTERVAL} seconds...`)
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
 * @example Basic gas check
 * ```bash
 * npx ts-node basic/gas-tracker.ts
 * ```
 * 
 * @example Continuous monitoring
 * ```bash
 * CONTINUOUS=true npx ts-node basic/gas-tracker.ts
 * ```
 * 
 * @example Monitor specific networks only
 * ```bash
 * NETWORKS=ethereum,arbitrum,base npx ts-node basic/gas-tracker.ts
 * ```
 */
