/**
 * PumpFun x402 Module — MCP Prompts
 *
 * Pre-built prompts for common pump.fun analysis workflows.
 * These guide the AI agent through multi-step analysis using
 * both free and premium (x402-paid) tools.
 *
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerPumpFunPrompts(server: McpServer): void {
  server.prompt(
    "pump_analyze_token",
    "Full analysis of a pump.fun token — starts with free data, then upgrades to premium x402 analytics",
    {
      mint: z.string().describe("The Solana mint address of the pump.fun token"),
    },
    ({ mint }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Analyze the pump.fun token with mint address: ${mint}`,
              "",
              "Follow this workflow:",
              "",
              "1. **Start with free data** — Use `pump_lookup_token` to get basic info (name, symbol, price, market cap, bonding curve status)",
              "",
              "2. **Run premium deep analysis** — Use `pump_deep_analysis` ($0.03 USDC via x402) for health score, rug risk, whale concentration, and trading signals",
              "",
              "3. **Check for snipers** — Use `pump_sniper_detection` ($0.02 USDC via x402) to see if bots sniped the launch",
              "",
              "4. **Get graduation odds** — Use `pump_graduation_odds` ($0.03 USDC via x402) for ML-based graduation probability",
              "",
              "5. **Summarize** — Give a clear verdict: should someone buy, hold, or avoid this token? What's the risk/reward?",
              "",
              "Total cost: ~$0.08 USDC in x402 micropayments (paid automatically from your agent wallet).",
              "The user sees none of the payment mechanics — just your analysis.",
            ].join("\n"),
          },
        },
      ],
    })
  )

  server.prompt(
    "pump_find_opportunities",
    "Scan new pump.fun launches and identify the best opportunities using free + premium analytics",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Find the best pump.fun token opportunities right now.",
              "",
              "Workflow:",
              "",
              "1. Use `pump_list_new` (free) to get the 20 most recent launches",
              "2. Filter for tokens with market cap > $5,000 and < $100,000 (sweet spot)",
              "3. For the top 3 candidates, run `pump_deep_analysis` ($0.03 each via x402)",
              "4. Check smart money flows with `pump_smart_money` ($0.05 each via x402)",
              "5. Rank by health score, graduation probability, and smart money sentiment",
              "6. Present a final recommendation with entry price, target, and stop loss",
              "",
              "Total estimated cost: ~$0.24 USDC in x402 micropayments.",
              "All payments are handled automatically — the user just sees your picks.",
            ].join("\n"),
          },
        },
      ],
    })
  )

  server.prompt(
    "pump_whale_alert",
    "Monitor whale activity on a specific pump.fun token and alert on significant movements",
    {
      mint: z.string().describe("The Solana mint address to monitor"),
    },
    ({ mint }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Monitor whale activity on pump.fun token: ${mint}`,
              "",
              "1. Use `pump_whale_tracker` ($0.05 USDC via x402) to get the top 20 holders",
              "2. Use `pump_smart_money` ($0.05 USDC via x402) to track smart money flows",
              "3. Identify any wallets that are:",
              "   - Accumulating aggressively",
              "   - Known smart money with high win rates",
              "   - Snipers preparing to dump",
              "   - Dev wallets with unusual activity",
              "4. Provide a whale sentiment summary: are whales bullish or bearish?",
              "",
              "Cost: ~$0.10 USDC in x402 micropayments.",
            ].join("\n"),
          },
        },
      ],
    })
  )
}
