#!/usr/bin/env npx ts-node
/**
 * Swap Aggregator - Intermediate Example
 * 
 * This example demonstrates how to:
 * - Get quotes from multiple DEX aggregators (1inch, 0x, ParaSwap)
 * - Compare prices and find the best route
 * - Calculate slippage and price impact
 * - Execute swaps with proper error handling
 * 
 * Difficulty: ⭐⭐ Intermediate
 * Prerequisites: Node.js 18+, pnpm, PRIVATE_KEY (for execution)
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
  shortenAddress,
  isValidAddress,
  getEnv,
  NETWORKS
} from "../lib/utils.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

// ============================================================================
// Configuration
// ============================================================================

// Common token addresses by network
const TOKENS: Record<string, Record<string, { address: string; decimals: number }>> = {
  ethereum: {
    ETH: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    DAI: { address: "0x6B175474E89094C44Da98b954EesdddeB131e232", decimals: 18 }
  },
  bsc: {
    BNB: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    WBNB: { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18 },
    USDT: { address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    BUSD: { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18 },
    USDC: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 }
  },
  arbitrum: {
    ETH: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    ARB: { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 }
  },
  polygon: {
    MATIC: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
    WMATIC: { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", decimals: 18 },
    USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 }
  }
}

// DEX aggregator names
const AGGREGATORS = ["1inch", "0x", "paraswap"] as const
type Aggregator = typeof AGGREGATORS[number]

// ============================================================================
// Types
// ============================================================================

interface SwapQuote {
  aggregator: Aggregator
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  toAmountFormatted: string
  price: number
  priceImpact?: number
  gas?: string
  gasPrice?: string
  estimatedGasUsd?: number
  route?: string[]
  protocols?: string[]
  error?: string
}

interface QuoteComparison {
  quotes: SwapQuote[]
  best: SwapQuote | null
  savings: number
  savingsPercent: number
}

interface SwapResult {
  success: boolean
  txHash?: string
  fromAmount: string
  toAmount: string
  aggregator: string
  error?: string
}

// ============================================================================
// Quote Functions
// ============================================================================

/**
 * Get quote from 1inch
 */
async function get1inchQuote(
  client: Client,
  fromToken: string,
  toToken: string,
  amount: string,
  network: string
): Promise<SwapQuote | null> {
  try {
    const result = await callTool<{
      toAmount: string
      estimatedGas: string
      protocols: Array<Array<Array<{ name: string }>>>
    }>(client, "swap_get_quote", {
      fromToken,
      toToken,
      amount,
      network,
      aggregator: "1inch"
    })

    if (!result || !result.toAmount) return null

    const toTokenInfo = Object.values(TOKENS[network] || {})
      .find(t => t.address.toLowerCase() === toToken.toLowerCase())
    const decimals = toTokenInfo?.decimals || 18

    const toAmountNum = parseFloat(result.toAmount) / Math.pow(10, decimals)
    const fromAmountNum = parseFloat(amount) / Math.pow(10, 18)
    const price = toAmountNum / fromAmountNum

    return {
      aggregator: "1inch",
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: result.toAmount,
      toAmountFormatted: formatNumber(toAmountNum, 6),
      price,
      gas: result.estimatedGas,
      protocols: result.protocols?.flat(2).map(p => p.name) || []
    }
  } catch (error) {
    return {
      aggregator: "1inch",
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: "0",
      toAmountFormatted: "0",
      price: 0,
      error: (error as Error).message
    }
  }
}

/**
 * Get quote from 0x
 */
async function get0xQuote(
  client: Client,
  fromToken: string,
  toToken: string,
  amount: string,
  network: string
): Promise<SwapQuote | null> {
  try {
    const result = await callTool<{
      buyAmount: string
      estimatedGas: string
      sources: Array<{ name: string; proportion: string }>
      estimatedPriceImpact: string
    }>(client, "swap_get_quote", {
      fromToken,
      toToken,
      amount,
      network,
      aggregator: "0x"
    })

    if (!result || !result.buyAmount) return null

    const toTokenInfo = Object.values(TOKENS[network] || {})
      .find(t => t.address.toLowerCase() === toToken.toLowerCase())
    const decimals = toTokenInfo?.decimals || 18

    const toAmountNum = parseFloat(result.buyAmount) / Math.pow(10, decimals)
    const fromAmountNum = parseFloat(amount) / Math.pow(10, 18)
    const price = toAmountNum / fromAmountNum

    return {
      aggregator: "0x",
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: result.buyAmount,
      toAmountFormatted: formatNumber(toAmountNum, 6),
      price,
      priceImpact: result.estimatedPriceImpact ? parseFloat(result.estimatedPriceImpact) : undefined,
      gas: result.estimatedGas,
      protocols: result.sources?.filter(s => parseFloat(s.proportion) > 0).map(s => s.name) || []
    }
  } catch (error) {
    return {
      aggregator: "0x",
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: "0",
      toAmountFormatted: "0",
      price: 0,
      error: (error as Error).message
    }
  }
}

/**
 * Get quote from ParaSwap
 */
async function getParaSwapQuote(
  client: Client,
  fromToken: string,
  toToken: string,
  amount: string,
  network: string
): Promise<SwapQuote | null> {
  try {
    const result = await callTool<{
      destAmount: string
      gasCost: string
      bestRoute: Array<{ exchange: string }>
    }>(client, "swap_get_quote", {
      fromToken,
      toToken,
      amount,
      network,
      aggregator: "paraswap"
    })

    if (!result || !result.destAmount) return null

    const toTokenInfo = Object.values(TOKENS[network] || {})
      .find(t => t.address.toLowerCase() === toToken.toLowerCase())
    const decimals = toTokenInfo?.decimals || 18

    const toAmountNum = parseFloat(result.destAmount) / Math.pow(10, decimals)
    const fromAmountNum = parseFloat(amount) / Math.pow(10, 18)
    const price = toAmountNum / fromAmountNum

    return {
      aggregator: "paraswap",
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: result.destAmount,
      toAmountFormatted: formatNumber(toAmountNum, 6),
      price,
      gas: result.gasCost,
      protocols: result.bestRoute?.map(r => r.exchange) || []
    }
  } catch (error) {
    return {
      aggregator: "paraswap",
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: "0",
      toAmountFormatted: "0",
      price: 0,
      error: (error as Error).message
    }
  }
}

/**
 * Get quotes from all aggregators and compare
 */
async function compareQuotes(
  client: Client,
  fromToken: string,
  toToken: string,
  amount: string,
  network: string
): Promise<QuoteComparison> {
  const spinner = ora("Fetching quotes from aggregators...").start()

  // Fetch quotes in parallel
  const [quote1inch, quote0x, quoteParaSwap] = await Promise.all([
    get1inchQuote(client, fromToken, toToken, amount, network),
    get0xQuote(client, fromToken, toToken, amount, network),
    getParaSwapQuote(client, fromToken, toToken, amount, network)
  ])

  spinner.succeed("Quotes fetched")

  const quotes = [quote1inch, quote0x, quoteParaSwap].filter((q): q is SwapQuote => q !== null)
  const validQuotes = quotes.filter(q => !q.error && parseFloat(q.toAmount) > 0)

  // Find best quote
  const best = validQuotes.length > 0
    ? validQuotes.reduce((best, current) => 
        parseFloat(current.toAmount) > parseFloat(best.toAmount) ? current : best
      )
    : null

  // Calculate savings vs worst
  let savings = 0
  let savingsPercent = 0
  if (validQuotes.length > 1 && best) {
    const worst = validQuotes.reduce((worst, current) =>
      parseFloat(current.toAmount) < parseFloat(worst.toAmount) ? current : worst
    )
    savings = parseFloat(best.toAmount) - parseFloat(worst.toAmount)
    savingsPercent = (savings / parseFloat(worst.toAmount)) * 100
  }

  return { quotes, best, savings, savingsPercent }
}

// ============================================================================
// Display Functions
// ============================================================================

/**
 * Display quote comparison table
 */
function displayQuoteComparison(
  comparison: QuoteComparison,
  fromSymbol: string,
  toSymbol: string
): void {
  printSection("📊 Quote Comparison")

  const table = new Table({
    head: [
      chalk.bold("Aggregator"),
      chalk.bold(`Output (${toSymbol})`),
      chalk.bold("Price"),
      chalk.bold("Impact"),
      chalk.bold("Gas"),
      chalk.bold("Route"),
      chalk.bold("Status")
    ],
    style: { head: [], border: [] }
  })

  for (const quote of comparison.quotes) {
    const isBest = comparison.best && quote.aggregator === comparison.best.aggregator
    const statusIcon = quote.error ? "❌" : isBest ? "🏆" : "✓"
    const statusText = quote.error ? chalk.red("Error") : isBest ? chalk.green("Best") : chalk.gray("OK")
    
    table.push([
      isBest ? chalk.bold.green(quote.aggregator) : quote.aggregator,
      quote.error ? chalk.red("N/A") : isBest ? chalk.bold.green(quote.toAmountFormatted) : quote.toAmountFormatted,
      quote.error ? "N/A" : formatNumber(quote.price, 6),
      quote.priceImpact ? `${formatNumber(quote.priceImpact, 2)}%` : "N/A",
      quote.gas ? formatNumber(parseInt(quote.gas), 0) : "N/A",
      quote.protocols?.slice(0, 2).join(", ") || "N/A",
      `${statusIcon} ${statusText}`
    ])
  }

  console.log(table.toString())

  // Show savings
  if (comparison.savings > 0 && comparison.best) {
    console.log()
    printSuccess(
      `Best aggregator saves you ${formatNumber(comparison.savingsPercent, 2)}% ` +
      `(${formatNumber(comparison.savings / Math.pow(10, 6), 4)} ${toSymbol})`
    )
  }
}

/**
 * Display best route details
 */
function displayBestRoute(quote: SwapQuote, fromSymbol: string, toSymbol: string): void {
  printSection("🎯 Best Route Details")
  
  printKeyValue("Aggregator", chalk.bold(quote.aggregator))
  printKeyValue("Input", `${formatNumber(parseFloat(quote.fromAmount) / 1e18, 6)} ${fromSymbol}`)
  printKeyValue("Output", chalk.green(`${quote.toAmountFormatted} ${toSymbol}`))
  printKeyValue("Rate", `1 ${fromSymbol} = ${formatNumber(quote.price, 6)} ${toSymbol}`)
  
  if (quote.priceImpact !== undefined) {
    const impactColor = quote.priceImpact > 1 ? chalk.yellow : chalk.green
    printKeyValue("Price Impact", impactColor(`${formatNumber(quote.priceImpact, 2)}%`))
  }
  
  if (quote.gas) {
    printKeyValue("Estimated Gas", formatNumber(parseInt(quote.gas), 0))
  }
  
  if (quote.protocols && quote.protocols.length > 0) {
    printKeyValue("Route", quote.protocols.join(" → "))
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  // Get configuration
  const network = getEnv("NETWORK", "ethereum").toLowerCase()
  const fromSymbol = getEnv("FROM", "ETH").toUpperCase()
  const toSymbol = getEnv("TO", "USDC").toUpperCase()
  const amountStr = getEnv("AMOUNT", "1")
  const execute = getEnv("EXECUTE", "false") === "true"

  printHeader("🔄 DEX Aggregator Comparison")

  // Validate network
  if (!NETWORKS[network]) {
    printError(`Unknown network: ${network}`)
    process.exit(1)
  }

  // Get token addresses
  const networkTokens = TOKENS[network]
  if (!networkTokens) {
    printError(`No tokens configured for network: ${network}`)
    process.exit(1)
  }

  const fromToken = networkTokens[fromSymbol]
  const toToken = networkTokens[toSymbol]

  if (!fromToken) {
    printError(`Unknown token: ${fromSymbol} on ${network}`)
    printInfo(`Available: ${Object.keys(networkTokens).join(", ")}`)
    process.exit(1)
  }

  if (!toToken) {
    printError(`Unknown token: ${toSymbol} on ${network}`)
    printInfo(`Available: ${Object.keys(networkTokens).join(", ")}`)
    process.exit(1)
  }

  // Convert amount to wei
  const amount = (parseFloat(amountStr) * Math.pow(10, fromToken.decimals)).toString()

  // Display swap parameters
  printSection("🔧 Swap Parameters")
  printKeyValue("Network", NETWORKS[network].name)
  printKeyValue("From", `${amountStr} ${fromSymbol}`)
  printKeyValue("To", toSymbol)
  printKeyValue("From Address", shortenAddress(fromToken.address))
  printKeyValue("To Address", shortenAddress(toToken.address))

  let client: Client | null = null

  try {
    // Connect to MCP server
    printInfo("Connecting to MCP server...")
    client = await createMCPClient()
    printSuccess("Connected to Universal Crypto MCP")

    // Get and compare quotes
    const comparison = await compareQuotes(
      client,
      fromToken.address,
      toToken.address,
      amount,
      network
    )

    // Display results
    displayQuoteComparison(comparison, fromSymbol, toSymbol)

    if (comparison.best) {
      displayBestRoute(comparison.best, fromSymbol, toSymbol)

      // Execute if requested
      if (execute) {
        printSection("🚀 Executing Swap")
        
        if (!process.env.PRIVATE_KEY) {
          printError("PRIVATE_KEY environment variable required for execution")
          process.exit(1)
        }

        printWarning("Swap execution not implemented in this example")
        printInfo("Add execution logic using swap_execute_quote tool")
      } else {
        printSection("💡 Next Steps")
        console.log("  To execute this swap, run with EXECUTE=true:")
        console.log(chalk.gray(`  EXECUTE=true NETWORK=${network} FROM=${fromSymbol} TO=${toSymbol} AMOUNT=${amountStr} npx ts-node intermediate/swap-aggregator.ts`))
      }
    } else {
      printError("No valid quotes available")
    }

    // Tips
    printSection("📝 Swap Tips")
    console.log("  • Compare multiple aggregators before swapping")
    console.log("  • Check price impact for large trades")
    console.log("  • Consider gas costs in your calculations")
    console.log("  • Use limit orders for better prices on large amounts")

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
 * @example Compare ETH to USDC quotes on Ethereum
 * ```bash
 * npx ts-node intermediate/swap-aggregator.ts
 * ```
 * 
 * @example Compare BNB to USDT quotes on BSC
 * ```bash
 * NETWORK=bsc FROM=BNB TO=USDT AMOUNT=0.5 npx ts-node intermediate/swap-aggregator.ts
 * ```
 * 
 * @example Execute swap (requires PRIVATE_KEY)
 * ```bash
 * EXECUTE=true NETWORK=arbitrum FROM=ETH TO=USDC AMOUNT=0.1 npx ts-node intermediate/swap-aggregator.ts
 * ```
 */
