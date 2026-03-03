#!/usr/bin/env npx ts-node
/**
 * Security Scanner - Basic Example
 * 
 * This example demonstrates how to:
 * - Scan tokens for security risks (honeypots, rug pulls)
 * - Check contract verification status
 * - Analyze token ownership and permissions
 * - Generate security reports
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
  shortenAddress,
  isValidAddress,
  getEnv,
  NETWORKS
} from "../lib/utils.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

// ============================================================================
// Configuration
// ============================================================================

// Example tokens to scan (known safe tokens for demo)
const EXAMPLE_TOKENS: Record<string, { address: string; name: string }> = {
  ethereum: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", name: "USDC" },
  bsc: { address: "0x55d398326f99059fF775485246999027B3197955", name: "USDT" },
  arbitrum: { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", name: "ARB" },
  polygon: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", name: "USDC" }
}

// Risk level colors and descriptions
const RISK_LEVELS = {
  safe: { color: chalk.green, emoji: "✅", description: "Low risk" },
  low: { color: chalk.blue, emoji: "ℹ️", description: "Minor concerns" },
  medium: { color: chalk.yellow, emoji: "⚠️", description: "Proceed with caution" },
  high: { color: chalk.red, emoji: "🚨", description: "High risk detected" },
  critical: { color: chalk.bgRed.white, emoji: "🛑", description: "Do not interact" }
} as const

type RiskLevel = keyof typeof RISK_LEVELS

// ============================================================================
// Types
// ============================================================================

interface TokenSecurityResult {
  token: {
    address: string
    name: string
    symbol: string
    decimals: number
  }
  security: {
    isVerified: boolean
    hasProxyContract: boolean
    isOpenSource: boolean
    owner?: string
    ownerRenounced: boolean
  }
  risks: Array<{
    type: string
    severity: string
    description: string
  }>
  flags: {
    canMint: boolean
    canPause: boolean
    canBlacklist: boolean
    hasTax: boolean
    taxAmount?: number
    isHoneypot: boolean
    hasHiddenOwner: boolean
  }
  liquidity?: {
    hasLiquidity: boolean
    isLocked: boolean
    lockDuration?: number
    lpPairs: Array<{
      dex: string
      pairAddress: string
      liquidity: string
    }>
  }
  overallRisk: string
  score: number
}

interface ContractVerificationResult {
  address: string
  network: string
  isVerified: boolean
  contractName?: string
  compiler?: string
  sourceCode?: boolean
  abi?: boolean
}

// ============================================================================
// Security Analysis Functions
// ============================================================================

/**
 * Analyze token security
 */
async function analyzeTokenSecurity(
  client: Client,
  tokenAddress: string,
  network: string
): Promise<TokenSecurityResult | null> {
  try {
    const result = await callTool<TokenSecurityResult>(client, "security_check_token", {
      tokenAddress,
      network
    })
    return result
  } catch (error) {
    printWarning(`Security check failed: ${(error as Error).message}`)
    return null
  }
}

/**
 * Check if contract is verified
 */
async function checkContractVerification(
  client: Client,
  address: string,
  network: string
): Promise<ContractVerificationResult | null> {
  try {
    const result = await callTool<ContractVerificationResult>(client, "verify_contract_status", {
      address,
      network
    })
    return result
  } catch (error) {
    return null
  }
}

/**
 * Check for honeypot
 */
async function checkHoneypot(
  client: Client,
  tokenAddress: string,
  network: string
): Promise<{ isHoneypot: boolean; details?: string } | null> {
  try {
    const result = await callTool<{ isHoneypot: boolean; details?: string }>(
      client, 
      "security_honeypot_check", 
      {
        tokenAddress,
        network
      }
    )
    return result
  } catch (error) {
    return null
  }
}

/**
 * Determine overall risk level from score
 */
function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "safe"
  if (score >= 60) return "low"
  if (score >= 40) return "medium"
  if (score >= 20) return "high"
  return "critical"
}

/**
 * Display security report
 */
function displaySecurityReport(result: TokenSecurityResult, network: string): void {
  const riskLevel = getRiskLevel(result.score)
  const risk = RISK_LEVELS[riskLevel]

  // Token Info
  printSection(`${result.token.symbol} (${result.token.name})`)
  printKeyValue("Address", result.token.address)
  printKeyValue("Network", NETWORKS[network]?.name || network)
  printKeyValue("Decimals", result.token.decimals.toString())

  // Security Score
  console.log()
  console.log(risk.color(`  ${risk.emoji} Security Score: ${result.score}/100 - ${risk.description}`))
  console.log()

  // Security Flags Table
  const flagsTable = new Table({
    head: [chalk.bold("Check"), chalk.bold("Status"), chalk.bold("Risk")],
    style: { head: [], border: [] }
  })

  const addFlag = (name: string, value: boolean, badIfTrue: boolean) => {
    const status = value ? "Yes" : "No"
    const isRisky = badIfTrue ? value : !value
    const statusColor = isRisky ? chalk.red : chalk.green
    const riskLabel = isRisky ? chalk.red("⚠ Risk") : chalk.green("✓ Safe")
    flagsTable.push([name, statusColor(status), riskLabel])
  }

  addFlag("Contract Verified", result.security.isVerified, false)
  addFlag("Owner Renounced", result.security.ownerRenounced, false)
  addFlag("Can Mint Tokens", result.flags.canMint, true)
  addFlag("Can Pause Trading", result.flags.canPause, true)
  addFlag("Can Blacklist Addresses", result.flags.canBlacklist, true)
  addFlag("Has Transfer Tax", result.flags.hasTax, true)
  addFlag("Is Honeypot", result.flags.isHoneypot, true)
  addFlag("Has Hidden Owner", result.flags.hasHiddenOwner, true)
  addFlag("Is Proxy Contract", result.security.hasProxyContract, true)

  console.log(flagsTable.toString())

  // Tax Information
  if (result.flags.hasTax && result.flags.taxAmount !== undefined) {
    printSection("💸 Tax Information")
    const taxPercent = result.flags.taxAmount
    const taxColor = taxPercent > 10 ? chalk.red : taxPercent > 5 ? chalk.yellow : chalk.green
    printKeyValue("Tax Rate", taxColor(`${taxPercent}%`))
    
    if (taxPercent > 10) {
      printWarning("High tax rate may significantly impact trading!")
    }
  }

  // Liquidity Information
  if (result.liquidity) {
    printSection("💧 Liquidity")
    printKeyValue("Has Liquidity", result.liquidity.hasLiquidity ? chalk.green("Yes") : chalk.red("No"))
    printKeyValue("LP Locked", result.liquidity.isLocked ? chalk.green("Yes") : chalk.yellow("No"))
    
    if (result.liquidity.lpPairs && result.liquidity.lpPairs.length > 0) {
      console.log()
      console.log("  Trading Pairs:")
      for (const pair of result.liquidity.lpPairs) {
        console.log(`    • ${pair.dex}: ${shortenAddress(pair.pairAddress)} (${pair.liquidity})`)
      }
    }
  }

  // Risk Warnings
  if (result.risks && result.risks.length > 0) {
    printSection("⚠️ Risk Warnings")
    for (const risk of result.risks) {
      const severityColor = 
        risk.severity === "critical" ? chalk.bgRed.white :
        risk.severity === "high" ? chalk.red :
        risk.severity === "medium" ? chalk.yellow :
        chalk.blue
      
      console.log(`  ${severityColor(`[${risk.severity.toUpperCase()}]`)} ${risk.type}`)
      console.log(chalk.gray(`    ${risk.description}`))
    }
  }

  // Recommendations
  printSection("💡 Recommendations")
  if (riskLevel === "safe" || riskLevel === "low") {
    printSuccess("Token appears relatively safe for interaction")
    console.log("  • Always do your own research (DYOR)")
    console.log("  • Start with small amounts when trading new tokens")
  } else if (riskLevel === "medium") {
    printWarning("Proceed with caution")
    console.log("  • Review the specific risks identified above")
    console.log("  • Consider the token's community and team reputation")
    console.log("  • Only invest what you can afford to lose")
  } else {
    printError("High risk detected - exercise extreme caution")
    console.log("  • Multiple red flags were identified")
    console.log("  • Consider avoiding this token")
    console.log("  • If you proceed, use minimal amounts for testing")
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  // Get configuration
  const tokenAddress = getEnv("TOKEN", "")
  const network = getEnv("NETWORK", "ethereum").toLowerCase()
  
  printHeader("🔒 Token Security Scanner")

  // Validate inputs
  if (tokenAddress && !isValidAddress(tokenAddress)) {
    printError(`Invalid token address: ${tokenAddress}`)
    process.exit(1)
  }

  if (!NETWORKS[network]) {
    printError(`Unknown network: ${network}. Supported: ${Object.keys(NETWORKS).join(", ")}`)
    process.exit(1)
  }

  // Use example token if none provided
  const addressToScan = tokenAddress || EXAMPLE_TOKENS[network]?.address
  const tokenName = tokenAddress ? "Custom Token" : EXAMPLE_TOKENS[network]?.name

  if (!addressToScan) {
    printError(`No token address provided and no example available for ${network}`)
    process.exit(1)
  }

  printInfo(`Scanning: ${tokenName || shortenAddress(addressToScan)}`)
  printInfo(`Address: ${addressToScan}`)
  printInfo(`Network: ${NETWORKS[network].name}`)

  let client: Client | null = null

  try {
    // Connect to MCP server
    printInfo("Connecting to MCP server...")
    client = await createMCPClient()
    printSuccess("Connected to Universal Crypto MCP")

    // Run security analysis
    printSection("🔍 Running Security Analysis...")
    
    const securityResult = await analyzeTokenSecurity(client, addressToScan, network)
    
    if (!securityResult) {
      // Try individual checks if main analysis fails
      printWarning("Full security analysis unavailable, running basic checks...")
      
      const verification = await checkContractVerification(client, addressToScan, network)
      const honeypot = await checkHoneypot(client, addressToScan, network)
      
      printSection("📋 Basic Security Checks")
      
      if (verification) {
        printKeyValue("Contract Verified", verification.isVerified ? chalk.green("Yes") : chalk.yellow("No"))
        if (verification.contractName) {
          printKeyValue("Contract Name", verification.contractName)
        }
      }
      
      if (honeypot) {
        printKeyValue("Honeypot Check", honeypot.isHoneypot ? chalk.red("⚠️ HONEYPOT DETECTED") : chalk.green("Passed"))
        if (honeypot.details) {
          console.log(chalk.gray(`    ${honeypot.details}`))
        }
      }
      
      printWarning("For complete analysis, ensure GoPlus API is available")
    } else {
      // Display full security report
      displaySecurityReport(securityResult, network)
    }

    // Explorer link
    printSection("🔗 Resources")
    console.log(`  Explorer: ${NETWORKS[network].explorer}/token/${addressToScan}`)
    console.log(`  GoPlus: https://gopluslabs.io/token-security/${network === "bsc" ? "56" : "1"}/${addressToScan}`)

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
 * @example Scan example token on Ethereum
 * ```bash
 * npx ts-node basic/security-scanner.ts
 * ```
 * 
 * @example Scan specific token
 * ```bash
 * TOKEN=0x... NETWORK=bsc npx ts-node basic/security-scanner.ts
 * ```
 * 
 * @example Scan on Arbitrum
 * ```bash
 * NETWORK=arbitrum npx ts-node basic/security-scanner.ts
 * ```
 */
