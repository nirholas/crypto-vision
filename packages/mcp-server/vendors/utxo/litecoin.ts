/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { Client as LitecoinClient, defaultLtcParams } from "@xchainjs/xchain-litecoin"
import { Network } from "@xchainjs/xchain-client"

// Initialize client with mainnet by default
const litecoinClient = new LitecoinClient({
  ...defaultLtcParams,
  network: Network.Mainnet
})

// Helper function to format base amounts
function formatBaseAmount(baseAmount: any): string {
  return baseAmount.amount().toString()
}

export function registerLitecoinTools(server: McpServer) {
  // ==================== BALANCE ====================

  server.tool(
    "litecoin_get_balance",
    "Get balance for a Litecoin address",
    {
      address: z.string().describe("Litecoin address to check")
    },
    async ({ address }) => {
      try {
        const balances = await litecoinClient.getBalance(address)
        return {
          content: [
            {
              type: "text" as const,
              text: `Litecoin Balance for ${address}:\n${formatBaseAmount(balances[0].amount)} LTC`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Failed to retrieve LTC balance: ${error.message}` }]
        }
      }
    }
  )

  // ==================== TRANSACTION HISTORY ====================

  server.tool(
    "litecoin_get_transaction_history",
    "Get transaction history for a Litecoin address",
    {
      address: z.string().describe("Litecoin address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return"),
      offset: z.number().optional().describe("Number of transactions to skip")
    },
    async ({ address, limit = 10, offset = 0 }) => {
      try {
        const txs = await litecoinClient.getTransactions({ address, limit, offset })
        const txList = txs.txs
          .map((tx: any) => {
            const fromAmount = tx.from[0]?.amount
              ? `${formatBaseAmount(tx.from[0].amount)} LTC`
              : "Unknown"
            const toAmount = tx.to[0]?.amount
              ? `${formatBaseAmount(tx.to[0].amount)} LTC`
              : "Unknown"

            return `
Transaction: ${tx.hash}
Type: ${tx.type}
From: ${tx.from[0]?.from || "Unknown"} (${fromAmount})
To: ${tx.to[0]?.to || "Unknown"} (${toAmount})
Asset: ${tx.asset.ticker}
Date: ${new Date(tx.date).toLocaleString()}`
          })
          .join("\n---\n")

        return {
          content: [
            {
              type: "text" as const,
              text: `Litecoin Transaction History for ${address}:\n${txList}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve LTC transaction history: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== ADDRESS VALIDATION ====================

  server.tool(
    "litecoin_validate_address",
    "Validate a Litecoin address format",
    {
      address: z.string().describe("Litecoin address to validate")
    },
    async ({ address }) => {
      try {
        const isValid = litecoinClient.validateAddress(address)
        return {
          content: [
            {
              type: "text" as const,
              text: isValid
                ? `The address ${address} is a valid Litecoin address`
                : `The address ${address} is NOT a valid Litecoin address`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Error validating Litecoin address: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== NETWORK INFO ====================

  server.tool(
    "litecoin_get_network_info",
    "Get current Litecoin network information including fee rates",
    {},
    async () => {
      try {
        const fees = await litecoinClient.getFeeRates()
        return {
          content: [
            {
              type: "text" as const,
              text: `Litecoin Network Information:
Current Network: ${litecoinClient.getNetwork()}
Fee Rates (sats/byte):
  Fast: ${fees.fast}
  Average: ${fees.average}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to retrieve Litecoin network information: ${error.message}`
            }
          ]
        }
      }
    }
  )
}
