#!/usr/bin/env npx ts-node
/**
 * Token Balance Checker - Basic Example
 * 
 * This example demonstrates how to:
 * - Connect to the Universal Crypto MCP server
 * - Check native token balances (ETH, BNB, MATIC, etc.)
 * - Check ERC20 token balances
 * - Display formatted results
 * 
 * Difficulty: ⭐ Beginner
 * Prerequisites: Node.js 18+, pnpm
 * Estimated Time: 5 minutes
 * 
 * @author Nich
 * @license MIT
 */

import "dotenv/config"
import {
  createMCPClient,
  callTool,
  printHeader,
  printSection,
  printKeyValue,
  printSuccess,
  printError,
  printInfo,
  formatNumber,
  formatUSD,
  shortenAddress,
  isValidAddress,
  getEnv,
  NETWORKS
} from "../lib/utils.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

// ============================================================================
// Configuration
// ============================================================================

// Default address to check (Vitalik's address for demo purposes)
const DEFAULT_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

// Popular tokens to check on each network
const TOKENS_TO_CHECK: Record<string, Array<{ symbol: string; address: string }>> = {
  ethereum: [
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
  ],
  bsc: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955" },
    { symbol: "BUSD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" },
    { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" },
  ],
  arbitrum: [
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { symbol: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548" },
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
  ],
  polygon: [
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
    { symbol: "WMATIC", address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" },
  ]
}

// ============================================================================
// Types
// ============================================================================

interface NativeBalanceResult {
  network: string
  address: string
  balance: string
  formatted: string
  symbol: string
}

interface TokenBalanceResult {
  network: string
  wallet: string
  token: {
    address: string
    symbol: string
    decimals: number
  }
  balance: string
  formatted: string
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Check native token balance for an address on a specific network
 */
async function checkNativeBalance(
  client: Client,
  address: string,
  network: string
): Promise<NativeBalanceResult | null> {
  try {
    const result = await callTool<NativeBalanceResult>(client, "get_native_balance", {
      address,
      network
    })
    return result
  } catch (error) {
    printError(`Failed to get native balance on ${network}: ${(error as Error).message}`)
    return null
  }
}

/**
 * Check ERC20 token balance for an address
 */
async function checkTokenBalance(
  client: Client,
  address: string,
  tokenAddress: string,
  network: string
): Promise<TokenBalanceResult | null> {
  try {
    const result = await callTool<TokenBalanceResult>(client, "get_token_balance", {
      address,
      tokenAddress,
      network
    })
    return result
  } catch (error) {
    // Token might not exist on this network or address has no balance
    return null
  }
}

/**
 * Display balance results in a formatted way
 */
function displayBalances(
  address: string,
  network: string,
  nativeBalance: NativeBalanceResult | null,
  tokenBalances: Array<{ symbol: string; balance: TokenBalanceResult | null }>
): void {
  const networkConfig = NETWORKS[network]
  
  printSection(`${networkConfig.name} (${network})`)
  
  if (nativeBalance) {
    const formattedBal = parseFloat(nativeBalance.formatted)
    printKeyValue(
      `${networkConfig.nativeToken} Balance`,
      `${formatNumber(formattedBal, 6)} ${networkConfig.nativeToken}`
    )
  }
  
  // Display token balances (only non-zero)
  for (const { symbol, balance } of tokenBalances) {
    if (balance && parseFloat(balance.formatted) > 0) {
      printKeyValue(
        `${symbol} Balance`,
        `${formatNumber(parseFloat(balance.formatted), 4)} ${symbol}`
      )
    }
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  // Get configuration from environment or use defaults
  const address = getEnv("ADDRESS", DEFAULT_ADDRESS)
  const network = getEnv("NETWORK", "ethereum").toLowerCase()
  const checkAllNetworks = getEnv("CHECK_ALL", "false") === "true"

  // Validate address
  if (!isValidAddress(address)) {
    printError(`Invalid address: ${address}`)
    process.exit(1)
  }

  // Print header
  printHeader("🔍 Token Balance Checker")
  printInfo(`Checking balances for: ${shortenAddress(address)}`)
  printInfo(`Full address: ${address}`)
  
  let client: Client | null = null

  try {
    // Connect to MCP server
    printInfo("Connecting to MCP server...")
    client = await createMCPClient()
    printSuccess("Connected to Universal Crypto MCP")

    // Determine which networks to check
    const networksToCheck = checkAllNetworks 
      ? Object.keys(TOKENS_TO_CHECK) 
      : [network]

    // Check balances on each network
    for (const net of networksToCheck) {
      if (!NETWORKS[net]) {
        printError(`Unknown network: ${net}`)
        continue
      }

      // Check native balance
      const nativeBalance = await checkNativeBalance(client, address, net)

      // Check popular token balances
      const tokens = TOKENS_TO_CHECK[net] || []
      const tokenBalances = await Promise.all(
        tokens.map(async (token) => ({
          symbol: token.symbol,
          balance: await checkTokenBalance(client, address, token.address, net)
        }))
      )

      // Display results
      displayBalances(address, net, nativeBalance, tokenBalances)
    }

    // Summary
    printSection("Summary")
    printSuccess(`Checked ${networksToCheck.length} network(s)`)
    printInfo(`Explorer: ${NETWORKS[network]?.explorer}/address/${address}`)

  } catch (error) {
    printError(`Error: ${(error as Error).message}`)
    process.exit(1)
  } finally {
    // Clean up
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
 * @example Check default address on Ethereum
 * ```bash
 * npx ts-node basic/token-balance-checker.ts
 * ```
 * 
 * @example Check custom address on BSC
 * ```bash
 * ADDRESS=0x... NETWORK=bsc npx ts-node basic/token-balance-checker.ts
 * ```
 * 
 * @example Check all supported networks
 * ```bash
 * ADDRESS=0x... CHECK_ALL=true npx ts-node basic/token-balance-checker.ts
 * ```
 */
