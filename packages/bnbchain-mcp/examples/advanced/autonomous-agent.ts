#!/usr/bin/env npx ts-node
/**
 * Autonomous DeFi Monitoring Agent - Advanced Example
 * 
 * This example demonstrates how to:
 * - Build an autonomous monitoring agent
 * - Implement multi-metric health checks
 * - Set up alert thresholds and notifications
 * - Handle error recovery and logging
 * - Generate scheduled reports
 * 
 * Difficulty: ⭐⭐⭐ Advanced
 * Prerequisites: Node.js 18+, pnpm
 * Estimated Time: 45 minutes
 * 
 * @author Nich
 * @license MIT
 */

import "dotenv/config"
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
  formatPercent,
  shortenAddress,
  isValidAddress,
  getEnv,
  sleep,
  retry,
  NETWORKS
} from "../lib/utils.js"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"

// ============================================================================
// Configuration
// ============================================================================

interface AgentConfig {
  // Monitoring interval in seconds
  checkInterval: number
  
  // Networks to monitor
  networks: string[]
  
  // Addresses to watch
  watchAddresses: string[]
  
  // Alert thresholds
  thresholds: {
    // Price drop alert (percentage)
    priceDropAlert: number
    // Low balance alert (in native token)
    lowBalanceAlert: number
    // Gas spike alert (gwei)
    gasSpike: Record<string, number>
    // Large transaction alert (USD value)
    largeTransaction: number
  }
  
  // Report settings
  reports: {
    enabled: boolean
    intervalHours: number
  }
}

const DEFAULT_CONFIG: AgentConfig = {
  checkInterval: 60,
  networks: ["ethereum", "bsc", "arbitrum"],
  watchAddresses: [],
  thresholds: {
    priceDropAlert: 5,
    lowBalanceAlert: 0.1,
    gasSpike: {
      ethereum: 50,
      bsc: 10,
      arbitrum: 0.5
    },
    largeTransaction: 100000
  },
  reports: {
    enabled: true,
    intervalHours: 6
  }
}

// ============================================================================
// Types
// ============================================================================

interface AlertLevel {
  level: "info" | "warning" | "critical"
  emoji: string
  color: chalk.Chalk
}

interface Alert {
  id: string
  timestamp: Date
  level: AlertLevel["level"]
  category: string
  title: string
  message: string
  data?: Record<string, unknown>
}

interface MetricSnapshot {
  timestamp: Date
  gasPrice: Record<string, number>
  prices: Record<string, number>
  balances: Record<string, Record<string, string>>
}

interface AgentState {
  isRunning: boolean
  startTime: Date
  lastCheck: Date | null
  lastReport: Date | null
  checkCount: number
  alertCount: number
  errors: number
  alerts: Alert[]
  metrics: MetricSnapshot[]
}

// ============================================================================
// Alert System
// ============================================================================

const ALERT_LEVELS: Record<string, AlertLevel> = {
  info: { level: "info", emoji: "ℹ️", color: chalk.blue },
  warning: { level: "warning", emoji: "⚠️", color: chalk.yellow },
  critical: { level: "critical", emoji: "🚨", color: chalk.red }
}

/**
 * Create and log an alert
 */
function createAlert(
  state: AgentState,
  level: AlertLevel["level"],
  category: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Alert {
  const alert: Alert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date(),
    level,
    category,
    title,
    message,
    data
  }
  
  state.alerts.push(alert)
  state.alertCount++
  
  // Keep only last 100 alerts
  if (state.alerts.length > 100) {
    state.alerts = state.alerts.slice(-100)
  }
  
  // Log alert
  const levelConfig = ALERT_LEVELS[level]
  console.log()
  console.log(levelConfig.color(`${levelConfig.emoji} [${level.toUpperCase()}] ${title}`))
  console.log(chalk.gray(`   ${message}`))
  if (data) {
    console.log(chalk.gray(`   Data: ${JSON.stringify(data)}`))
  }
  
  return alert
}

/**
 * Send alert notification (webhook, email, etc.)
 * This is a placeholder - implement your notification method
 */
async function sendNotification(alert: Alert): Promise<void> {
  // TODO: Implement notification sending
  // Examples:
  // - Discord webhook
  // - Telegram bot
  // - Email via SendGrid
  // - Slack webhook
  
  if (alert.level === "critical") {
    console.log(chalk.red(`[NOTIFICATION] Would send critical alert: ${alert.title}`))
  }
}

// ============================================================================
// Monitoring Functions
// ============================================================================

/**
 * Check gas prices across networks
 */
async function checkGasPrices(
  client: Client,
  config: AgentConfig,
  state: AgentState
): Promise<Record<string, number>> {
  const gasPrices: Record<string, number> = {}
  
  for (const network of config.networks) {
    try {
      const result = await retry(async () => {
        return callTool<{ gasPrice: { standard: string } }>(client, "get_gas_price", {
          network
        })
      })
      
      if (result?.gasPrice?.standard) {
        const gasGwei = parseFloat(result.gasPrice.standard)
        gasPrices[network] = gasGwei
        
        // Check for gas spike
        const threshold = config.thresholds.gasSpike[network] || 50
        if (gasGwei > threshold) {
          createAlert(
            state,
            "warning",
            "gas",
            `High Gas on ${NETWORKS[network]?.name || network}`,
            `Gas price is ${formatNumber(gasGwei, 2)} Gwei (threshold: ${threshold})`,
            { network, gasPrice: gasGwei, threshold }
          )
        }
      }
    } catch (error) {
      state.errors++
    }
  }
  
  return gasPrices
}

/**
 * Check market prices
 */
async function checkMarketPrices(
  client: Client,
  config: AgentConfig,
  state: AgentState,
  previousPrices: Record<string, number>
): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  const coinsToCheck = ["ethereum", "binancecoin", "bitcoin"]
  
  for (const coinId of coinsToCheck) {
    try {
      const result = await retry(async () => {
        return callTool<{ coin: { current_price: number } }>(client, "market_get_coin_by_id", {
          coinId,
          currency: "USD"
        })
      })
      
      if (result?.coin?.current_price) {
        const currentPrice = result.coin.current_price
        prices[coinId] = currentPrice
        
        // Check for price drop
        const previousPrice = previousPrices[coinId]
        if (previousPrice) {
          const change = ((currentPrice - previousPrice) / previousPrice) * 100
          
          if (change <= -config.thresholds.priceDropAlert) {
            createAlert(
              state,
              "warning",
              "price",
              `${coinId.toUpperCase()} Price Drop`,
              `Price dropped ${formatPercent(change)} to ${formatUSD(currentPrice)}`,
              { coinId, previousPrice, currentPrice, change }
            )
          }
        }
      }
    } catch (error) {
      state.errors++
    }
  }
  
  return prices
}

/**
 * Check watched address balances
 */
async function checkAddressBalances(
  client: Client,
  config: AgentConfig,
  state: AgentState
): Promise<Record<string, Record<string, string>>> {
  const balances: Record<string, Record<string, string>> = {}
  
  for (const address of config.watchAddresses) {
    balances[address] = {}
    
    for (const network of config.networks) {
      try {
        const result = await retry(async () => {
          return callTool<{ formatted: string }>(client, "get_native_balance", {
            address,
            network
          })
        })
        
        if (result?.formatted) {
          const balance = parseFloat(result.formatted)
          balances[address][network] = result.formatted
          
          // Check for low balance
          if (balance < config.thresholds.lowBalanceAlert) {
            createAlert(
              state,
              "warning",
              "balance",
              `Low Balance on ${NETWORKS[network]?.name || network}`,
              `${shortenAddress(address)} has only ${formatNumber(balance, 4)} ${NETWORKS[network]?.nativeToken || "tokens"}`,
              { address, network, balance }
            )
          }
        }
      } catch (error) {
        state.errors++
      }
    }
  }
  
  return balances
}

/**
 * Run security checks
 */
async function runSecurityChecks(
  client: Client,
  config: AgentConfig,
  state: AgentState
): Promise<void> {
  // Check for any pending approvals or suspicious activity
  // This is a placeholder for more advanced security monitoring
  
  // Example: Check approval limits
  for (const address of config.watchAddresses) {
    try {
      // Would call security tools here
      // const result = await callTool(client, "security_check_approvals", { address })
    } catch (error) {
      state.errors++
    }
  }
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Generate periodic report
 */
function generateReport(state: AgentState, config: AgentConfig): void {
  printHeader("📊 Agent Status Report")
  
  const uptime = Date.now() - state.startTime.getTime()
  const hours = Math.floor(uptime / (1000 * 60 * 60))
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
  
  printSection("🤖 Agent Status")
  printKeyValue("Status", state.isRunning ? chalk.green("Running") : chalk.red("Stopped"))
  printKeyValue("Uptime", `${hours}h ${minutes}m`)
  printKeyValue("Start Time", state.startTime.toLocaleString())
  printKeyValue("Last Check", state.lastCheck?.toLocaleString() || "Never")
  
  printSection("📈 Statistics")
  printKeyValue("Total Checks", state.checkCount.toString())
  printKeyValue("Alerts Generated", state.alertCount.toString())
  printKeyValue("Errors", state.errors.toString())
  
  printSection("⚡ Recent Alerts")
  const recentAlerts = state.alerts.slice(-5)
  if (recentAlerts.length === 0) {
    console.log("  No recent alerts")
  } else {
    for (const alert of recentAlerts) {
      const levelConfig = ALERT_LEVELS[alert.level]
      console.log(`  ${levelConfig.emoji} [${alert.timestamp.toLocaleTimeString()}] ${alert.title}`)
    }
  }
  
  printSection("📊 Latest Metrics")
  const latestMetric = state.metrics[state.metrics.length - 1]
  if (latestMetric) {
    console.log("  Gas Prices:")
    for (const [network, gas] of Object.entries(latestMetric.gasPrice)) {
      console.log(`    ${network}: ${formatNumber(gas, 2)} Gwei`)
    }
    console.log("  Market Prices:")
    for (const [coin, price] of Object.entries(latestMetric.prices)) {
      console.log(`    ${coin}: ${formatUSD(price)}`)
    }
  }
  
  state.lastReport = new Date()
}

// ============================================================================
// Main Agent Loop
// ============================================================================

/**
 * Run a single monitoring cycle
 */
async function runMonitoringCycle(
  client: Client,
  config: AgentConfig,
  state: AgentState,
  previousMetrics: MetricSnapshot | null
): Promise<MetricSnapshot> {
  state.checkCount++
  state.lastCheck = new Date()
  
  console.log(chalk.gray(`\n[${state.lastCheck.toLocaleTimeString()}] Running check #${state.checkCount}...`))
  
  // Gather metrics
  const gasPrices = await checkGasPrices(client, config, state)
  const prices = await checkMarketPrices(
    client, 
    config, 
    state, 
    previousMetrics?.prices || {}
  )
  const balances = await checkAddressBalances(client, config, state)
  await runSecurityChecks(client, config, state)
  
  // Create snapshot
  const snapshot: MetricSnapshot = {
    timestamp: new Date(),
    gasPrice: gasPrices,
    prices,
    balances
  }
  
  // Store metrics (keep last 1000)
  state.metrics.push(snapshot)
  if (state.metrics.length > 1000) {
    state.metrics = state.metrics.slice(-1000)
  }
  
  // Check if report is due
  if (config.reports.enabled && state.lastReport) {
    const hoursSinceReport = (Date.now() - state.lastReport.getTime()) / (1000 * 60 * 60)
    if (hoursSinceReport >= config.reports.intervalHours) {
      generateReport(state, config)
    }
  }
  
  console.log(chalk.gray(`Check complete. Alerts: ${state.alertCount}, Errors: ${state.errors}`))
  
  return snapshot
}

/**
 * Main agent function
 */
async function runAgent(config: AgentConfig): Promise<void> {
  // Initialize state
  const state: AgentState = {
    isRunning: true,
    startTime: new Date(),
    lastCheck: null,
    lastReport: new Date(),
    checkCount: 0,
    alertCount: 0,
    errors: 0,
    alerts: [],
    metrics: []
  }
  
  printHeader("🤖 Autonomous DeFi Monitoring Agent")
  printInfo(`Monitoring ${config.networks.length} networks`)
  printInfo(`Watch addresses: ${config.watchAddresses.length}`)
  printInfo(`Check interval: ${config.checkInterval}s`)
  printInfo("Press Ctrl+C to stop")
  
  // Generate initial report
  generateReport(state, config)
  
  let client: Client | null = null
  let previousMetrics: MetricSnapshot | null = null
  
  try {
    // Connect to MCP server
    printInfo("Connecting to MCP server...")
    client = await createMCPClient()
    printSuccess("Connected to Universal Crypto MCP")
    
    // Main loop
    while (state.isRunning) {
      try {
        previousMetrics = await runMonitoringCycle(client, config, state, previousMetrics)
      } catch (error) {
        state.errors++
        printError(`Cycle error: ${(error as Error).message}`)
        
        // Reconnect if needed
        if ((error as Error).message.includes("connection")) {
          printInfo("Attempting to reconnect...")
          try {
            await client.close()
            client = await createMCPClient()
            printSuccess("Reconnected")
          } catch {
            printError("Reconnection failed, will retry next cycle")
          }
        }
      }
      
      // Wait for next cycle
      await sleep(config.checkInterval * 1000)
    }
    
  } catch (error) {
    printError(`Fatal error: ${(error as Error).message}`)
    process.exit(1)
  } finally {
    state.isRunning = false
    if (client) {
      await client.close()
    }
    
    // Final report
    printHeader("🛑 Agent Shutdown")
    generateReport(state, config)
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  // Build configuration from environment
  const config: AgentConfig = {
    ...DEFAULT_CONFIG,
    checkInterval: parseInt(getEnv("CHECK_INTERVAL", "60")),
    networks: getEnv("NETWORKS", "ethereum,bsc,arbitrum").split(",").map(s => s.trim()),
    watchAddresses: getEnv("WATCH_ADDRESSES", "").split(",").filter(a => a && isValidAddress(a.trim())),
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      priceDropAlert: parseFloat(getEnv("PRICE_DROP_ALERT", "5")),
      lowBalanceAlert: parseFloat(getEnv("LOW_BALANCE_ALERT", "0.1"))
    }
  }
  
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    printInfo("\nShutting down agent...")
    process.exit(0)
  })
  
  process.on("SIGTERM", () => {
    printInfo("\nReceived SIGTERM, shutting down...")
    process.exit(0)
  })
  
  // Run agent
  await runAgent(config)
}

// Run if executed directly
main().catch(console.error)

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * @example Basic monitoring
 * ```bash
 * npx ts-node advanced/autonomous-agent.ts
 * ```
 * 
 * @example With watch addresses
 * ```bash
 * WATCH_ADDRESSES=0x123...,0x456... npx ts-node advanced/autonomous-agent.ts
 * ```
 * 
 * @example Custom thresholds
 * ```bash
 * CHECK_INTERVAL=30 PRICE_DROP_ALERT=3 LOW_BALANCE_ALERT=0.5 npx ts-node advanced/autonomous-agent.ts
 * ```
 */
