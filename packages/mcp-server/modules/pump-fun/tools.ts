/**
 * PumpFun x402 Module — MCP Tools
 *
 * Registers MCP tools for pump.fun token intelligence.
 * Free tools query public data; premium tools call x402-gated
 * analytics APIs and auto-pay USDC micropayments.
 *
 * @author nirholas
 * @license Apache-2.0
 *
 * ## Tool Tiers
 *
 * | Tool                    | Cost  | Description                              |
 * |-------------------------|-------|------------------------------------------|
 * | pump_lookup_token       | Free  | Basic token info from pump.fun           |
 * | pump_get_price          | Free  | Current token price + bonding curve      |
 * | pump_list_new           | Free  | Recently launched tokens                 |
 * | pump_deep_analysis      | $0.03 | Full analysis: health, risk, signals     |
 * | pump_whale_tracker      | $0.05 | Whale holders + sniper labels            |
 * | pump_smart_money        | $0.05 | Smart money flow tracking                |
 * | pump_sniper_detection   | $0.02 | Bot detection on token launches          |
 * | pump_graduation_odds    | $0.03 | ML graduation probability                |
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import Logger from "@/utils/logger.js"
import { fetchPumpToken, fetchNewTokens, createPumpAnalyticsClient, PumpAnalyticsClient } from "./client.js"
import { PUMP_X402_PRICING } from "./types.js"

// Lazy-init the x402 analytics client (only created when premium tools are called)
let _analyticsClient: PumpAnalyticsClient | null = null

async function getAnalyticsClient(): Promise<PumpAnalyticsClient> {
  if (!_analyticsClient) {
    _analyticsClient = await createPumpAnalyticsClient()
  }
  return _analyticsClient
}

/**
 * Register all PumpFun tools with the MCP server
 */
export function registerPumpFunTools(server: McpServer): void {
  // ========================================================================
  // FREE TOOLS — Public pump.fun data
  // ========================================================================

  server.tool(
    "pump_lookup_token",
    "Look up a pump.fun token by its mint address. Returns name, symbol, price, market cap, bonding curve state, and graduation status. FREE — no payment required.",
    {
      mint: z.string().describe("The Solana mint address of the pump.fun token"),
    },
    async ({ mint }) => {
      try {
        const token = await fetchPumpToken(mint)
        if (!token) {
          return {
            content: [{
              type: "text" as const,
              text: `Token not found: ${mint}. Verify the mint address is a valid pump.fun token.`,
            }],
          }
        }

        const lines = [
          `# ${token.name} (${token.symbol})`,
          "",
          `**Mint:** \`${token.mint}\``,
          `**Creator:** \`${token.creator}\``,
          `**Created:** ${token.createdAt}`,
          "",
          "## Price & Market Cap",
          `- **Price:** $${token.priceUsd.toFixed(8)} (${token.priceSol.toFixed(6)} SOL)`,
          `- **Market Cap:** $${token.marketCapUsd.toLocaleString()} (${token.marketCapSol.toFixed(2)} SOL)`,
          token.volume24h ? `- **24h Volume:** $${token.volume24h.toLocaleString()}` : "",
          token.holders ? `- **Holders:** ${token.holders.toLocaleString()}` : "",
          "",
          "## Bonding Curve",
          `- **Status:** ${token.isGraduated ? "✅ Graduated to AMM" : "📈 Active bonding curve"}`,
          `- **Virtual SOL Reserves:** ${(Number(token.virtualSolReserves) / 1e9).toFixed(4)} SOL`,
          `- **Virtual Token Reserves:** ${(Number(token.virtualTokenReserves) / 1e6).toFixed(0)} tokens`,
          token.isGraduated && token.ammPoolAddress
            ? `- **AMM Pool:** \`${token.ammPoolAddress}\``
            : "",
          "",
          `> 💡 For deep analysis (whale tracking, rug risk, graduation odds), use the premium tools: \`pump_deep_analysis\`, \`pump_whale_tracker\`, \`pump_graduation_odds\`. These cost $0.02–$0.05 USDC via x402 micropayment.`,
        ].filter(Boolean)

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        Logger.error("pump_lookup_token error:", error)
        return {
          content: [{
            type: "text" as const,
            text: `Error looking up token: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "pump_get_price",
    "Get the current price of a pump.fun token in SOL and USD, plus bonding curve reserves. FREE — no payment required.",
    {
      mint: z.string().describe("The Solana mint address of the pump.fun token"),
    },
    async ({ mint }) => {
      try {
        const token = await fetchPumpToken(mint)
        if (!token) {
          return {
            content: [{ type: "text" as const, text: `Token not found: ${mint}` }],
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: [
              `**${token.name} (${token.symbol})**`,
              `Price: $${token.priceUsd.toFixed(8)} / ${token.priceSol.toFixed(6)} SOL`,
              `Market Cap: $${token.marketCapUsd.toLocaleString()}`,
              `Status: ${token.isGraduated ? "Graduated (AMM)" : "Bonding Curve"}`,
            ].join("\n"),
          }],
        }
      } catch (error) {
        Logger.error("pump_get_price error:", error)
        return {
          content: [{
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "pump_list_new",
    "List the most recently created tokens on pump.fun. Returns name, symbol, price, market cap, and age. FREE — no payment required.",
    {
      limit: z.number().min(1).max(50).default(10).describe("Number of tokens to return (1-50, default 10)"),
    },
    async ({ limit }) => {
      try {
        const tokens = await fetchNewTokens(limit)
        if (tokens.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No tokens found." }],
          }
        }

        const lines = [
          "# Recently Launched on pump.fun",
          "",
          "| # | Token | Price (USD) | Market Cap | Status |",
          "|---|-------|------------|------------|--------|",
          ...tokens.map((t, i) => {
            const status = t.isGraduated ? "✅ Graduated" : "📈 Active"
            return `| ${i + 1} | **${t.symbol}** (${t.name}) | $${t.priceUsd.toFixed(8)} | $${t.marketCapUsd.toLocaleString()} | ${status} |`
          }),
          "",
          "> Use `pump_deep_analysis` on any token mint for premium analytics ($0.03 USDC via x402).",
        ]

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        Logger.error("pump_list_new error:", error)
        return {
          content: [{
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        }
      }
    }
  )

  // ========================================================================
  // PREMIUM TOOLS — x402 micropayment required
  // ========================================================================

  server.tool(
    "pump_deep_analysis",
    `Deep analysis of a pump.fun token — bonding curve health, whale concentration, rug pull risk score, graduation probability, price impact simulation, and trading signals. PREMIUM: costs $${PUMP_X402_PRICING.deepAnalysis} USDC paid automatically via x402 micropayment. The payment is handled transparently by your wallet — no user action needed.`,
    {
      mint: z.string().describe("The Solana mint address of the pump.fun token to analyze"),
    },
    async ({ mint }) => {
      try {
        const client = await getAnalyticsClient()
        const analysis = await client.getDeepAnalysis(mint)

        const riskEmoji = {
          low: "🟢",
          medium: "🟡",
          high: "🔴",
          critical: "🚨",
        }[analysis.analytics.rugPullRisk]

        const lines = [
          `# Deep Analysis: ${analysis.token.name} (${analysis.token.symbol})`,
          "",
          "## Health Score",
          `**${analysis.analytics.healthScore}/100** ${analysis.analytics.healthScore >= 70 ? "🟢" : analysis.analytics.healthScore >= 40 ? "🟡" : "🔴"}`,
          "",
          "## Risk Assessment",
          `- **Rug Pull Risk:** ${riskEmoji} ${analysis.analytics.rugPullRisk.toUpperCase()}`,
          `- **Creator Holding:** ${analysis.analytics.creatorHolding.toFixed(1)}% of supply`,
          `- **Dev Sell Pressure:** ${analysis.analytics.devSellPressure}`,
          `- **Holder Concentration (Gini):** ${analysis.analytics.holderConcentration.toFixed(2)}`,
          `- **Top 10 Holders:** ${analysis.analytics.top10HolderPercentage.toFixed(1)}% of supply`,
          "",
          "## Graduation",
          `- **Probability:** ${(analysis.analytics.graduationProbability * 100).toFixed(1)}%`,
          analysis.analytics.estimatedTimeToGraduation
            ? `- **Estimated Time:** ${analysis.analytics.estimatedTimeToGraduation}`
            : "- **Estimated Time:** N/A",
          "",
          "## Price Impact",
          `- **1 SOL buy:** ${analysis.analytics.priceImpact1Sol.toFixed(2)}% impact`,
          `- **10 SOL buy:** ${analysis.analytics.priceImpact10Sol.toFixed(2)}% impact`,
          `- **Liquidity Depth:** $${analysis.analytics.liquidityDepth.toLocaleString()}`,
          "",
          "## Trading Signals",
          ...analysis.signals.map((s) => {
            const emoji = { buy: "🟢", sell: "🔴", hold: "🟡", warning: "⚠️" }[s.type]
            return `- ${emoji} **${s.type.toUpperCase()}** (${s.strength}): ${s.reason}`
          }),
          "",
          "## Top Whale Holders",
          ...analysis.whales.slice(0, 5).map((w, i) => {
            const label = w.label ? ` [${w.label}]` : ""
            return `${i + 1}. \`${w.address.slice(0, 8)}...\`${label} — ${w.percentageOfSupply.toFixed(1)}% (PnL: ${w.unrealizedPnl >= 0 ? "+" : ""}$${w.unrealizedPnl.toFixed(2)})`
          }),
          "",
          `> 💰 This analysis was paid via x402 micropayment ($${PUMP_X402_PRICING.deepAnalysis} USDC).`,
          `> Payment is settled on-chain — no subscription, no API key, no credit card.`,
        ]

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        Logger.error("pump_deep_analysis error:", error)
        return {
          content: [{
            type: "text" as const,
            text: `Error running deep analysis: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "pump_whale_tracker",
    `Track whale holders on a pump.fun token — shows largest holders, their buy history, unrealized P&L, and labels (sniper, whale, smart money, dev, insider). PREMIUM: costs $${PUMP_X402_PRICING.whaleTracker} USDC via x402 micropayment.`,
    {
      mint: z.string().describe("The Solana mint address"),
      limit: z.number().min(1).max(50).default(20).describe("Number of top holders to return"),
    },
    async ({ mint, limit }) => {
      try {
        const client = await getAnalyticsClient()
        const whales = await client.getWhaleHolders(mint, limit)

        const lines = [
          `# Whale Tracker: Top ${whales.length} Holders`,
          "",
          "| # | Address | % Supply | Avg Buy | PnL | Label | Txs |",
          "|---|---------|----------|---------|-----|-------|-----|",
          ...whales.map((w, i) => {
            const label = w.label ?? "—"
            const pnl = w.unrealizedPnl >= 0 ? `+$${w.unrealizedPnl.toFixed(2)}` : `-$${Math.abs(w.unrealizedPnl).toFixed(2)}`
            return `| ${i + 1} | \`${w.address.slice(0, 8)}...\` | ${w.percentageOfSupply.toFixed(1)}% | $${w.averageBuyPrice.toFixed(6)} | ${pnl} | ${label} | ${w.txCount} |`
          }),
          "",
          `> 💰 Paid $${PUMP_X402_PRICING.whaleTracker} USDC via x402.`,
        ]

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        Logger.error("pump_whale_tracker error:", error)
        return {
          content: [{
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "pump_smart_money",
    `Track smart money flows on a pump.fun token — wallets with historically high win rates and their current positioning. PREMIUM: costs $${PUMP_X402_PRICING.smartMoney} USDC via x402 micropayment.`,
    {
      mint: z.string().describe("The Solana mint address"),
      period: z.enum(["1h", "4h", "24h", "7d"]).default("24h").describe("Time period for flow analysis"),
    },
    async ({ mint, period }) => {
      try {
        const client = await getAnalyticsClient()
        const flow = await client.getSmartMoneyFlow(mint, period)

        const sentimentEmoji = { bullish: "🟢", bearish: "🔴", neutral: "🟡" }[flow.sentiment]

        const lines = [
          `# Smart Money Flow: ${flow.token}`,
          `**Period:** ${flow.period} | **Sentiment:** ${sentimentEmoji} ${flow.sentiment.toUpperCase()} (${(flow.confidence * 100).toFixed(0)}% confidence)`,
          "",
          `- **Net Flow:** ${flow.netFlow} (${flow.smartMoneyNetVolumeSol.toFixed(2)} SOL)`,
          `- **Smart Buyers:** ${flow.smartMoneyBuyers} | **Smart Sellers:** ${flow.smartMoneySellers}`,
          "",
          "## Notable Wallets",
          ...flow.notableWallets.map((w) => {
            const emoji = w.action === "buy" ? "🟢" : "🔴"
            return `- ${emoji} \`${w.address.slice(0, 8)}...\` (${w.label}) — ${w.action.toUpperCase()} ${w.amountSol.toFixed(2)} SOL (win rate: ${(w.historicalWinRate * 100).toFixed(0)}%)`
          }),
          "",
          `> 💰 Paid $${PUMP_X402_PRICING.smartMoney} USDC via x402.`,
        ]

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        Logger.error("pump_smart_money error:", error)
        return {
          content: [{
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "pump_sniper_detection",
    `Detect sniper bots on a pump.fun token launch — finds wallets that bought in the first blocks and cross-references known bot addresses. PREMIUM: costs $${PUMP_X402_PRICING.sniperDetection} USDC via x402 micropayment.`,
    {
      mint: z.string().describe("The Solana mint address"),
    },
    async ({ mint }) => {
      try {
        const client = await getAnalyticsClient()
        const result = await client.detectSnipers(mint)

        const riskEmoji = { low: "🟢", medium: "🟡", high: "🔴" }[result.riskLevel]

        const lines = [
          `# Sniper Detection: ${result.token}`,
          "",
          `**Risk Level:** ${riskEmoji} ${result.riskLevel.toUpperCase()}`,
          `**Snipers Detected:** ${result.snipersDetected}`,
          `**Total Sniper Volume:** ${result.totalSniperVolumeSol.toFixed(2)} SOL`,
          "",
          `**Verdict:** ${result.verdict}`,
          "",
          "## Detected Snipers",
          "| Address | Buy (SOL) | % Supply | Known Bot | Status |",
          "|---------|-----------|----------|-----------|--------|",
          ...result.snipers.slice(0, 10).map((s) => {
            const status = s.hasAlreadySold ? `Sold (${s.soldAmountSol?.toFixed(2)} SOL)` : "Holding"
            const bot = s.knownSniperBot ? `✅ ${s.botName ?? "Unknown"}` : "❌"
            return `| \`${s.address.slice(0, 8)}...\` | ${s.buyAmountSol.toFixed(2)} | ${s.percentOfSupply.toFixed(1)}% | ${bot} | ${status} |`
          }),
          "",
          `> 💰 Paid $${PUMP_X402_PRICING.sniperDetection} USDC via x402.`,
        ]

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        Logger.error("pump_sniper_detection error:", error)
        return {
          content: [{
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "pump_graduation_odds",
    `Calculate the probability that a pump.fun token will graduate from the bonding curve to the AMM. Uses ML analysis of historical patterns from similar tokens. PREMIUM: costs $${PUMP_X402_PRICING.graduationOdds} USDC via x402 micropayment.`,
    {
      mint: z.string().describe("The Solana mint address"),
    },
    async ({ mint }) => {
      try {
        const client = await getAnalyticsClient()
        const odds = await client.getGraduationOdds(mint)

        const recEmoji = {
          likely: "🟢",
          possible: "🟡",
          unlikely: "🔴",
          very_unlikely: "🚨",
        }[odds.recommendation]

        const lines = [
          `# Graduation Odds: ${odds.token}`,
          "",
          `## Probability: ${(odds.estimatedProbability * 100).toFixed(1)}% ${recEmoji}`,
          `**Recommendation:** ${odds.recommendation.replace("_", " ").toUpperCase()}`,
          "",
          `- **Current Market Cap:** ${odds.currentMarketCapSol.toFixed(2)} SOL`,
          `- **Graduation Threshold:** ${odds.graduationThresholdSol.toFixed(2)} SOL`,
          `- **Progress:** ${odds.progressPercent.toFixed(1)}%`,
          "",
          "## Scoring Factors",
          ...odds.factors.map((f) => {
            const bar = "█".repeat(Math.round(f.score * 10)) + "░".repeat(10 - Math.round(f.score * 10))
            return `- **${f.name}** (weight: ${(f.weight * 100).toFixed(0)}%): [${bar}] ${(f.score * 100).toFixed(0)}%\n  ${f.description}`
          }),
          "",
          "## Historical Comparison",
          `- Tokens sampled: ${odds.historicalComparison.totalLaunched.toLocaleString()}`,
          `- Tokens graduated: ${odds.historicalComparison.totalGraduated.toLocaleString()}`,
          `- Historical graduation rate: ${(odds.historicalComparison.graduationRate * 100).toFixed(1)}%`,
          `- Average time to graduation: ${odds.historicalComparison.averageTimeToGraduation}`,
          "",
          `> 💰 Paid $${PUMP_X402_PRICING.graduationOdds} USDC via x402.`,
        ]

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        }
      } catch (error) {
        Logger.error("pump_graduation_odds error:", error)
        return {
          content: [{
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        }
      }
    }
  )

  Logger.info(
    "pump-fun: Registered 8 tools (3 free, 5 premium x402-gated)"
  )
}
