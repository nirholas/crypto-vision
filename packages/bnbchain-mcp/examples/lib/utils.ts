/**
 * Universal Crypto MCP - Example Utilities
 * 
 * Shared utility functions for all examples including:
 * - MCP client connection
 * - Output formatting
 * - Common helpers
 * 
 * @author Nich
 * @license MIT
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { spawn } from "child_process"
import chalk from "chalk"

// ============================================================================
// Types
// ============================================================================

export interface MCPToolResult {
  content: Array<{
    type: string
    text: string
  }>
  isError?: boolean
}

export interface NetworkConfig {
  name: string
  chainId: number
  rpcUrl: string
  nativeToken: string
  explorer: string
}

// ============================================================================
// Network Configurations
// ============================================================================

export const NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    rpcUrl: "https://eth.llamarpc.com",
    nativeToken: "ETH",
    explorer: "https://etherscan.io"
  },
  bsc: {
    name: "BNB Smart Chain",
    chainId: 56,
    rpcUrl: "https://bsc-dataseed.binance.org",
    nativeToken: "BNB",
    explorer: "https://bscscan.com"
  },
  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    nativeToken: "ETH",
    explorer: "https://arbiscan.io"
  },
  polygon: {
    name: "Polygon",
    chainId: 137,
    rpcUrl: "https://polygon-rpc.com",
    nativeToken: "MATIC",
    explorer: "https://polygonscan.com"
  },
  optimism: {
    name: "Optimism",
    chainId: 10,
    rpcUrl: "https://mainnet.optimism.io",
    nativeToken: "ETH",
    explorer: "https://optimistic.etherscan.io"
  },
  base: {
    name: "Base",
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    nativeToken: "ETH",
    explorer: "https://basescan.org"
  },
  avalanche: {
    name: "Avalanche",
    chainId: 43114,
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    nativeToken: "AVAX",
    explorer: "https://snowtrace.io"
  },
  opbnb: {
    name: "opBNB",
    chainId: 204,
    rpcUrl: "https://opbnb-mainnet-rpc.bnbchain.org",
    nativeToken: "BNB",
    explorer: "https://opbnbscan.com"
  }
}

// ============================================================================
// MCP Client
// ============================================================================

/**
 * Create and connect to the MCP server
 * 
 * @example
 * ```typescript
 * const client = await createMCPClient()
 * const result = await callTool(client, "get_native_balance", { 
 *   network: "ethereum", 
 *   address: "0x..." 
 * })
 * await client.close()
 * ```
 */
export async function createMCPClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@nirholas/universal-crypto-mcp@latest"],
    env: {
      ...process.env,
      PRIVATE_KEY: process.env.PRIVATE_KEY || ""
    }
  })

  const client = new Client({
    name: "example-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  })

  await client.connect(transport)
  return client
}

/**
 * Create MCP client using local development server
 */
export async function createLocalMCPClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "tsx",
    args: ["../src/index.ts"],
    env: {
      ...process.env,
      PRIVATE_KEY: process.env.PRIVATE_KEY || ""
    }
  })

  const client = new Client({
    name: "example-client-local",
    version: "1.0.0"
  }, {
    capabilities: {}
  })

  await client.connect(transport)
  return client
}

/**
 * Call an MCP tool and return parsed result
 */
export async function callTool<T = unknown>(
  client: Client,
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const result = await client.callTool({
    name: toolName,
    arguments: args
  }) as MCPToolResult

  if (result.isError) {
    const errorText = result.content[0]?.text || "Unknown error"
    throw new Error(errorText)
  }

  const text = result.content[0]?.text
  if (!text) {
    throw new Error("Empty response from tool")
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return text as T
  }
}

/**
 * List all available tools
 */
export async function listTools(client: Client): Promise<Array<{ name: string; description: string }>> {
  const result = await client.listTools()
  return result.tools.map(tool => ({
    name: tool.name,
    description: tool.description || ""
  }))
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format a number with commas and decimals
 */
export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Format a value as USD currency
 */
export function formatUSD(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(num)
}

/**
 * Format a percentage
 */
export function formatPercent(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`
}

/**
 * Shorten an address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Format timestamp to human readable
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}

/**
 * Format large numbers (1M, 1B, etc.)
 */
export function formatCompact(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(num)
}

// ============================================================================
// Console Output Helpers
// ============================================================================

/**
 * Print a styled header
 */
export function printHeader(title: string): void {
  console.log()
  console.log(chalk.bold.blue("═".repeat(60)))
  console.log(chalk.bold.blue(`  ${title}`))
  console.log(chalk.bold.blue("═".repeat(60)))
  console.log()
}

/**
 * Print a section header
 */
export function printSection(title: string): void {
  console.log()
  console.log(chalk.bold.cyan(`▶ ${title}`))
  console.log(chalk.dim("─".repeat(50)))
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: string | number): void {
  console.log(`  ${chalk.gray(key + ":")} ${chalk.white(value)}`)
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`))
}

/**
 * Print error message
 */
export function printError(message: string): void {
  console.log(chalk.red(`✗ ${message}`))
}

/**
 * Print warning message
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`))
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`))
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Validate network name
 */
export function isValidNetwork(network: string): boolean {
  return network.toLowerCase() in NETWORKS
}

/**
 * Get network config or throw
 */
export function getNetworkConfig(network: string): NetworkConfig {
  const config = NETWORKS[network.toLowerCase()]
  if (!config) {
    throw new Error(`Unknown network: ${network}. Supported: ${Object.keys(NETWORKS).join(", ")}`)
  }
  return config
}

// ============================================================================
// Environment Helpers
// ============================================================================

/**
 * Get required environment variable or throw
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Get optional environment variable with default
 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

/**
 * Load and validate environment
 */
export function loadEnv(): void {
  // dotenv is loaded via import
  if (!process.env.PRIVATE_KEY) {
    printWarning("PRIVATE_KEY not set - write operations will fail")
  }
}

// ============================================================================
// Async Helpers
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        printWarning(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  
  throw lastError
}

/**
 * Execute multiple promises with concurrency limit
 */
export async function parallelLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = []
  const executing: Promise<void>[] = []

  for (const task of tasks) {
    const p = task().then(result => {
      results.push(result)
    })
    executing.push(p)

    if (executing.length >= limit) {
      await Promise.race(executing)
      executing.splice(
        executing.findIndex(e => e === p),
        1
      )
    }
  }

  await Promise.all(executing)
  return results
}

export default {
  createMCPClient,
  createLocalMCPClient,
  callTool,
  listTools,
  formatNumber,
  formatUSD,
  formatPercent,
  formatCompact,
  shortenAddress,
  formatTimestamp,
  printHeader,
  printSection,
  printKeyValue,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  isValidAddress,
  isValidNetwork,
  getNetworkConfig,
  requireEnv,
  getEnv,
  loadEnv,
  sleep,
  retry,
  parallelLimit,
  NETWORKS
}
