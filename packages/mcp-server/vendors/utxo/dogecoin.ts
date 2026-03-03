/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { Client as DogeClient, defaultDogeParams } from "@xchainjs/xchain-doge"
import { Network } from "@xchainjs/xchain-client"

// Initialize client with mainnet by default
const dogeClient = new DogeClient({
  ...defaultDogeParams,
  network: Network.Mainnet
})

// Helper function to format base amounts
function formatBaseAmount(baseAmount: any): string {
  return baseAmount.amount().toString()
}

export function registerDogecoinTools(server: McpServer) {
  // ==================== BALANCE ====================

  server.tool(
    "dogecoin_get_balance",
    "Get balance for a Dogecoin address",
    {
      address: z.string().describe("Dogecoin address to check")
    },
    async ({ address }) => {
      try {
        const balances = await dogeClient.getBalance(address)
        return {
          content: [
            {
              type: "text" as const,
              text: `Dogecoin Balance for ${address}:\n${formatBaseAmount(balances[0].amount)} DOGE`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Failed to retrieve DOGE balance: ${error.message}` }]
        }
      }
    }
  )

  // ==================== TRANSACTION HISTORY ====================

  server.tool(
    "dogecoin_get_transaction_history",
    "Get transaction history for a Dogecoin address",
    {
      address: z.string().describe("Dogecoin address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return"),
      offset: z.number().optional().describe("Number of transactions to skip")
    },
    async ({ address, limit = 10, offset = 0 }) => {
      try {
        const txs = await dogeClient.getTransactions({ address, limit, offset })
        const txList = txs.txs
          .map((tx: any) => {
            const fromAmount = tx.from[0]?.amount
              ? `${formatBaseAmount(tx.from[0].amount)} DOGE`
              : "Unknown"
            const toAmount = tx.to[0]?.amount
              ? `${formatBaseAmount(tx.to[0].amount)} DOGE`
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
              text: `Dogecoin Transaction History for ${address}:\n${txList}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve DOGE transaction history: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== ADDRESS VALIDATION ====================

  server.tool(
    "dogecoin_validate_address",
    "Validate a Dogecoin address format",
    {
      address: z.string().describe("Dogecoin address to validate")
    },
    async ({ address }) => {
      try {
        const isValid = dogeClient.validateAddress(address)
        return {
          content: [
            {
              type: "text" as const,
              text: isValid
                ? `The address ${address} is a valid Dogecoin address`
                : `The address ${address} is NOT a valid Dogecoin address`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Error validating Dogecoin address: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== NETWORK INFO ====================

  server.tool(
    "dogecoin_get_network_info",
    "Get current Dogecoin network information including fee rates",
    {},
    async () => {
      try {
        const fees = await dogeClient.getFeeRates()
        return {
          content: [
            {
              type: "text" as const,
              text: `Dogecoin Network Information:
Current Network: ${dogeClient.getNetwork()}
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
              text: `Failed to retrieve Dogecoin network information: ${error.message}`
            }
          ]
        }
      }
    }
  )
}
