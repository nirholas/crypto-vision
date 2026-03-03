/**
 * On-Chain Alerts Module
 * Create and manage alerts for blockchain events and conditions
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

// In-memory alert storage
const alerts = new Map<
  string,
  {
    type: string
    condition: Record<string, any>
    status: "active" | "paused" | "triggered"
    createdAt: Date
    triggeredAt?: Date
    triggerCount: number
    lastChecked?: Date
  }
>()

// Alert history
const alertHistory: Array<{
  alertId: string
  triggeredAt: Date
  data: any
}> = []

export function registerAlerts(server: McpServer) {
  // Create price alert
  server.tool(
    "alert_price",
    "Create a price alert for a cryptocurrency",
    {
      symbol: z.string().describe("Token symbol (e.g., BTC, ETH)"),
      condition: z.enum(["above", "below", "crosses"]).describe("Price condition"),
      targetPrice: z.number().describe("Target price in USD"),
      repeat: z.boolean().default(false).describe("Repeat alert after triggering"),
    },
    async ({ symbol, condition, targetPrice, repeat }) => {
      const alertId = `price_${symbol}_${condition}_${Date.now()}`

      alerts.set(alertId, {
        type: "price",
        condition: { symbol, condition, targetPrice, repeat },
        status: "active",
        createdAt: new Date(),
        triggerCount: 0,
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                alertId,
                type: "price",
                symbol,
                condition: `${symbol} ${condition} $${targetPrice}`,
                repeat,
                status: "active",
                message: `Alert created: Will notify when ${symbol} is ${condition} $${targetPrice}`,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Create whale movement alert
  server.tool(
    "alert_whale_movement",
    "Create an alert for large transactions on a token or wallet",
    {
      target: z.string().describe("Token address or wallet address to monitor"),
      targetType: z.enum(["token", "wallet"]).describe("Type of target"),
      minValueUSD: z.number().default(1000000).describe("Minimum transaction value in USD"),
      chain: z
        .enum(["ethereum", "bsc", "polygon", "arbitrum"])
        .default("ethereum")
        .describe("Blockchain"),
    },
    async ({ target, targetType, minValueUSD, chain }) => {
      const alertId = `whale_${targetType}_${target.slice(0, 10)}_${Date.now()}`

      alerts.set(alertId, {
        type: "whale_movement",
        condition: { target, targetType, minValueUSD, chain },
        status: "active",
        createdAt: new Date(),
        triggerCount: 0,
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                alertId,
                type: "whale_movement",
                target,
                targetType,
                minValueUSD,
                chain,
                status: "active",
                message: `Alert created: Will notify on transactions ≥$${minValueUSD.toLocaleString()}`,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Create gas price alert
  server.tool(
    "alert_gas",
    "Create an alert for gas price conditions",
    {
      chain: z
        .enum(["ethereum", "bsc", "polygon", "arbitrum"])
        .default("ethereum")
        .describe("Blockchain"),
      condition: z.enum(["below", "above"]).describe("Gas price condition"),
      targetGwei: z.number().describe("Target gas price in Gwei"),
    },
    async ({ chain, condition, targetGwei }) => {
      const alertId = `gas_${chain}_${condition}_${Date.now()}`

      alerts.set(alertId, {
        type: "gas",
        condition: { chain, condition, targetGwei },
        status: "active",
        createdAt: new Date(),
        triggerCount: 0,
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                alertId,
                type: "gas",
                chain,
                condition: `Gas ${condition} ${targetGwei} Gwei`,
                status: "active",
                message: `Alert created: Will notify when ${chain} gas is ${condition} ${targetGwei} Gwei`,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Create liquidity alert
  server.tool(
    "alert_liquidity",
    "Create an alert for liquidity changes in a pool",
    {
      poolAddress: z.string().describe("Liquidity pool address"),
      chain: z
        .enum(["ethereum", "bsc", "polygon", "arbitrum"])
        .default("ethereum")
        .describe("Blockchain"),
      condition: z.enum(["added", "removed", "change_percent"]).describe("Liquidity condition"),
      threshold: z.number().describe("Threshold value (USD for added/removed, % for change)"),
    },
    async ({ poolAddress, chain, condition, threshold }) => {
      const alertId = `liquidity_${poolAddress.slice(0, 10)}_${Date.now()}`

      alerts.set(alertId, {
        type: "liquidity",
        condition: { poolAddress, chain, condition, threshold },
        status: "active",
        createdAt: new Date(),
        triggerCount: 0,
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                alertId,
                type: "liquidity",
                poolAddress,
                chain,
                condition,
                threshold,
                status: "active",
                message: `Alert created: Monitoring liquidity ${condition} events`,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Create smart contract event alert
  server.tool(
    "alert_contract_event",
    "Create an alert for specific smart contract events",
    {
      contractAddress: z.string().describe("Smart contract address"),
      eventSignature: z.string().describe("Event signature (e.g., 'Transfer(address,address,uint256)')"),
      chain: z
        .enum(["ethereum", "bsc", "polygon", "arbitrum"])
        .default("ethereum")
        .describe("Blockchain"),
      filter: z.record(z.any()).optional().describe("Optional filter for event parameters"),
    },
    async ({ contractAddress, eventSignature, chain, filter }) => {
      const alertId = `event_${contractAddress.slice(0, 10)}_${Date.now()}`

      alerts.set(alertId, {
        type: "contract_event",
        condition: { contractAddress, eventSignature, chain, filter },
        status: "active",
        createdAt: new Date(),
        triggerCount: 0,
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                alertId,
                type: "contract_event",
                contractAddress,
                eventSignature,
                chain,
                filter,
                status: "active",
                message: "Alert created: Monitoring smart contract events",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Create wallet activity alert
  server.tool(
    "alert_wallet_activity",
    "Create an alert for any activity on a wallet",
    {
      address: z.string().describe("Wallet address to monitor"),
      chain: z
        .enum(["ethereum", "bsc", "polygon", "arbitrum", "solana"])
        .default("ethereum")
        .describe("Blockchain"),
      activityTypes: z
        .array(z.enum(["incoming", "outgoing", "contract_interaction", "nft", "all"]))
        .default(["all"])
        .describe("Types of activity to monitor"),
    },
    async ({ address, chain, activityTypes }) => {
      const alertId = `wallet_${address.slice(0, 10)}_${Date.now()}`

      alerts.set(alertId, {
        type: "wallet_activity",
        condition: { address, chain, activityTypes },
        status: "active",
        createdAt: new Date(),
        triggerCount: 0,
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                alertId,
                type: "wallet_activity",
                address,
                chain,
                activityTypes,
                status: "active",
                message: "Alert created: Monitoring wallet activity",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Check alerts (poll for triggered alerts)
  server.tool(
    "alert_check",
    "Check for triggered alerts",
    {
      alertIds: z.array(z.string()).optional().describe("Specific alert IDs to check (all if omitted)"),
    },
    async ({ alertIds }) => {
      const toCheck = alertIds
        ? alertIds.map((id) => [id, alerts.get(id)] as const).filter(([_, a]) => a)
        : Array.from(alerts.entries())

      const triggered: Array<{
        alertId: string
        type: string
        data: any
      }> = []

      // Simulate checking conditions (in production, query actual data)
      for (const [alertId, alert] of toCheck) {
        if (!alert || alert.status !== "active") continue

        alert.lastChecked = new Date()

        // Random trigger simulation (in production, check actual conditions)
        if (Math.random() < 0.1) {
          alert.triggerCount++

          let triggerData: any = {}

          if (alert.type === "price") {
            triggerData = {
              symbol: alert.condition.symbol,
              currentPrice: alert.condition.targetPrice * (1 + (Math.random() - 0.5) * 0.1),
              targetPrice: alert.condition.targetPrice,
              condition: alert.condition.condition,
            }
          } else if (alert.type === "whale_movement") {
            triggerData = {
              txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
              value: alert.condition.minValueUSD * (1 + Math.random()),
              from: `0x${Math.random().toString(16).slice(2, 42)}`,
              to: `0x${Math.random().toString(16).slice(2, 42)}`,
            }
          } else if (alert.type === "gas") {
            triggerData = {
              chain: alert.condition.chain,
              currentGwei: alert.condition.targetGwei * (1 + (Math.random() - 0.5) * 0.2),
              targetGwei: alert.condition.targetGwei,
            }
          }

          triggered.push({
            alertId,
            type: alert.type,
            data: triggerData,
          })

          alertHistory.push({
            alertId,
            triggeredAt: new Date(),
            data: triggerData,
          })

          if (!alert.condition.repeat) {
            alert.status = "triggered"
            alert.triggeredAt = new Date()
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                checked: toCheck.length,
                triggered: triggered.length,
                alerts: triggered,
                message:
                  triggered.length > 0
                    ? `${triggered.length} alert(s) triggered!`
                    : "No alerts triggered",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // List alerts
  server.tool(
    "alert_list",
    "List all alerts",
    {
      status: z
        .enum(["all", "active", "paused", "triggered"])
        .default("all")
        .describe("Filter by status"),
    },
    async ({ status }) => {
      let alertList = Array.from(alerts.entries()).map(([id, alert]) => ({
        alertId: id,
        type: alert.type,
        status: alert.status,
        condition: alert.condition,
        createdAt: alert.createdAt,
        triggerCount: alert.triggerCount,
        lastChecked: alert.lastChecked,
      }))

      if (status !== "all") {
        alertList = alertList.filter((a) => a.status === status)
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: alertList.length,
                alerts: alertList,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Pause alert
  server.tool(
    "alert_pause",
    "Pause an active alert",
    {
      alertId: z.string().describe("Alert ID to pause"),
    },
    async ({ alertId }) => {
      const alert = alerts.get(alertId)

      if (!alert) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Alert not found", alertId }, null, 2),
            },
          ],
          isError: true,
        }
      }

      alert.status = "paused"

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                alertId,
                status: "paused",
                message: "Alert paused successfully",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Resume alert
  server.tool(
    "alert_resume",
    "Resume a paused alert",
    {
      alertId: z.string().describe("Alert ID to resume"),
    },
    async ({ alertId }) => {
      const alert = alerts.get(alertId)

      if (!alert) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Alert not found", alertId }, null, 2),
            },
          ],
          isError: true,
        }
      }

      if (alert.status === "triggered") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Cannot resume triggered alert",
                  alertId,
                  suggestion: "Create a new alert instead",
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        }
      }

      alert.status = "active"

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                alertId,
                status: "active",
                message: "Alert resumed successfully",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Delete alert
  server.tool(
    "alert_delete",
    "Delete an alert",
    {
      alertId: z.string().describe("Alert ID to delete"),
    },
    async ({ alertId }) => {
      const existed = alerts.delete(alertId)

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                alertId,
                deleted: existed,
                message: existed ? "Alert deleted" : "Alert not found",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get alert history
  server.tool(
    "alert_history",
    "Get history of triggered alerts",
    {
      alertId: z.string().optional().describe("Filter by specific alert ID"),
      limit: z.number().default(50).describe("Maximum results"),
    },
    async ({ alertId, limit }) => {
      let history = alertId
        ? alertHistory.filter((h) => h.alertId === alertId)
        : alertHistory

      history = history.slice(-limit)

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: history.length,
                history: history.reverse(),
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Clear all alerts
  server.tool("alert_clear_all", "Clear all alerts", {}, async () => {
    const count = alerts.size
    alerts.clear()

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              cleared: count,
              message: `Cleared ${count} alerts`,
            },
            null,
            2
          ),
        },
      ],
    }
  })
}
