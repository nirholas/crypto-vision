/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { Client, Wallet, Payment, TrustSet } from "xrpl"

import Logger from "@/utils/logger.js"

// Initialize XRP Ledger client
let xrpClient: Client | null = null

// XRP Network URL
const XRP_NETWORK_URL = process.env.XRP_RPC_URL || "wss://s1.ripple.com"
const XRP_EXPLORER = "https://livenet.xrpl.org"

// Helper function to get or initialize the client
async function getClient(): Promise<Client> {
  if (!xrpClient || !xrpClient.isConnected()) {
    xrpClient = new Client(XRP_NETWORK_URL)
    await xrpClient.connect()
  }
  return xrpClient
}

// Helper function to format drops to XRP
function dropsToXrp(drops: string): string {
  return (parseInt(drops) / 1000000).toFixed(6)
}

// Helper function to format XRP to drops
function xrpToDrops(xrp: string | number): string {
  const xrpStr = typeof xrp === "number" ? xrp.toString() : xrp
  const drops = Math.floor(parseFloat(xrpStr) * 1000000).toString()
  return drops
}

// Helper function to clean up resources
async function cleanUp() {
  if (xrpClient && xrpClient.isConnected()) {
    await xrpClient.disconnect()
  }
}

// Helper function to create a wallet from available credentials
async function createWallet() {
  // Try with private key first if available
  if (process.env.XRP_PRIVATE_KEY) {
    try {
      return Wallet.fromSeed(process.env.XRP_PRIVATE_KEY)
    } catch (err) {
      Logger.debug("Failed to create wallet from private key:", err)
    }
  }

  // Try with mnemonic if private key failed or isn't available
  if (process.env.XRP_MNEMONIC) {
    try {
      return Wallet.fromMnemonic(process.env.XRP_MNEMONIC)
    } catch (err) {
      Logger.debug("Failed to create wallet from mnemonic:", err)
    }
  }

  // If we have the address and we get here, throw an error
  if (process.env.XRP_ADDRESS) {
    throw new Error("Could not create wallet from available credentials")
  }

  throw new Error(
    "No wallet credentials provided. Please add XRP_PRIVATE_KEY or XRP_MNEMONIC to your environment"
  )
}

export function registerRippleTools(server: McpServer) {
  // ==================== BALANCE ====================

  server.tool(
    "xrp_get_balance",
    "Get balance for an XRP address",
    {
      address: z.string().describe("XRP address to check")
    },
    async ({ address }) => {
      try {
        const client = await getClient()
        const response = await client.request({
          command: "account_info",
          account: address,
          ledger_index: "validated"
        })

        const balance = dropsToXrp(response.result.account_data.Balance)

        return {
          content: [
            {
              type: "text" as const,
              text: `XRP Balance for ${address}:\n${balance} XRP`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Failed to retrieve XRP balance: ${error.message}` }]
        }
      }
    }
  )

  // ==================== TRANSACTION HISTORY ====================

  server.tool(
    "xrp_get_transaction_history",
    "Get transaction history for an XRP address",
    {
      address: z.string().describe("XRP address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return (default: 10)")
    },
    async ({ address, limit = 10 }) => {
      try {
        const client = await getClient()
        const response = await client.request({
          command: "account_tx",
          account: address,
          limit: limit
        })

        if (!response.result.transactions || response.result.transactions.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No transactions found for ${address}` }]
          }
        }

        const txList = response.result.transactions
          .map((tx: any) => {
            const transaction = tx.tx
            let txInfo = `
Transaction: ${transaction.hash}
Type: ${transaction.TransactionType}
Date: ${new Date(transaction.date ? (transaction.date + 946684800) * 1000 : 0).toLocaleString()}`

            if (transaction.TransactionType === "Payment") {
              txInfo += `
From: ${transaction.Account}
To: ${transaction.Destination}
Amount: ${transaction.Amount.currency ? `${transaction.Amount.value} ${transaction.Amount.currency}` : `${dropsToXrp(transaction.Amount)} XRP`}`
            }

            return txInfo
          })
          .join("\n---\n")

        return {
          content: [
            {
              type: "text" as const,
              text: `XRP Transaction History for ${address}:\n${txList}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve XRP transaction history: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== ADDRESS VALIDATION ====================

  server.tool(
    "xrp_validate_address",
    "Validate an XRP address format",
    {
      address: z.string().describe("XRP address to validate")
    },
    async ({ address }) => {
      try {
        // XRP addresses start with 'r' and are 25-35 characters in length
        const isValid = /^r[a-zA-Z0-9]{24,34}$/.test(address)

        return {
          content: [
            {
              type: "text" as const,
              text: isValid
                ? `The address ${address} has a valid XRP address format`
                : `The address ${address} does NOT have a valid XRP address format`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Error validating XRP address: ${error.message}` }]
        }
      }
    }
  )

  // ==================== LEDGER INFO ====================

  server.tool(
    "xrp_get_ledger_info",
    "Get current XRP Ledger information",
    {},
    async () => {
      try {
        const client = await getClient()
        const serverInfo = await client.request({
          command: "server_info"
        })

        const ledgerInfo = await client.request({
          command: "ledger",
          ledger_index: "validated"
        })

        // Extract values safely with null checks
        const serverState = serverInfo.result.info.server_state || "Unknown"
        const ledgerIndex = ledgerInfo.result.ledger.ledger_index || "Unknown"
        const ledgerHash = ledgerInfo.result.ledger.ledger_hash || "Unknown"
        const closeTime = ledgerInfo.result.ledger.close_time
          ? new Date((ledgerInfo.result.ledger.close_time + 946684800) * 1000).toLocaleString()
          : "Unknown"

        // Safe access to validated_ledger properties
        const baseFee = serverInfo.result.info.validated_ledger?.base_fee_xrp || "Unknown"
        const reserveBase = serverInfo.result.info.validated_ledger?.reserve_base_xrp || "Unknown"
        const reserveInc = serverInfo.result.info.validated_ledger?.reserve_inc_xrp || "Unknown"

        return {
          content: [
            {
              type: "text" as const,
              text: `XRP Ledger Information:
Server Status: ${serverState}
Current Ledger: ${ledgerIndex}
Ledger Hash: ${ledgerHash}
Close Time: ${closeTime}
Base Fee: ${baseFee} XRP
Reserve Base: ${reserveBase} XRP
Reserve Inc: ${reserveInc} XRP`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve XRP Ledger information: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== SEND TRANSACTION ====================

  server.tool(
    "xrp_send_transaction",
    "Send XRP from your wallet to another address using private key from environment",
    {
      toAddress: z.string().describe("XRP address to send to"),
      amount: z.union([z.string(), z.number()]).describe("Amount of XRP to send"),
      memo: z.string().optional().describe("Optional memo to include with the transaction")
    },
    async ({ toAddress, amount, memo }) => {
      try {
        const amountStr = typeof amount === "number" ? amount.toString() : amount

        const client = await getClient()
        const wallet = await createWallet()

        // Create a payment transaction
        const payment: Payment = {
          TransactionType: "Payment",
          Account: wallet.address,
          Destination: toAddress,
          Amount: xrpToDrops(amount)
        }

        // Add memo if provided
        if (memo) {
          payment.Memos = [
            {
              Memo: {
                MemoData: Buffer.from(memo, "utf8").toString("hex").toUpperCase()
              }
            }
          ]
        }

        // Prepare and sign the transaction
        const prepared = await client.autofill(payment)
        const signed = wallet.sign(prepared)

        // Submit the transaction
        const submitResult = await client.submit(signed.tx_blob)

        if (
          submitResult.result.engine_result === "tesSUCCESS" ||
          submitResult.result.engine_result.startsWith("tes")
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: `XRP Transaction Sent!
From: ${wallet.address}
To: ${toAddress}
Amount: ${amountStr} XRP
Transaction Hash: ${signed.hash}
Explorer Link: ${XRP_EXPLORER}/transactions/${signed.hash}`
              }
            ]
          }
        } else {
          throw new Error(
            `Transaction submission failed: ${submitResult.result.engine_result} - ${submitResult.result.engine_result_message}`
          )
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Failed to send XRP transaction: ${error.message}` }]
        }
      }
    }
  )

  // ==================== TOKEN BALANCES ====================

  server.tool(
    "xrp_get_token_balances",
    "Get token balances for an XRP address",
    {
      address: z.string().describe("XRP address to check")
    },
    async ({ address }) => {
      try {
        const client = await getClient()
        const response = await client.request({
          command: "account_lines",
          account: address
        })

        if (!response.result.lines || response.result.lines.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No token balances found for ${address}`
              }
            ]
          }
        }

        const tokenBalances = response.result.lines
          .map((line: any) => {
            return `${line.balance} ${line.currency} (Issuer: ${line.account})`
          })
          .join("\n")

        return {
          content: [
            {
              type: "text" as const,
              text: `Token Balances for ${address}:\n${tokenBalances}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve XRP token balances: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== CREATE TRUSTLINE ====================

  server.tool(
    "xrp_create_trustline",
    "Create a trustline for a token on the XRP Ledger using private key from environment",
    {
      currency: z.string().describe("Currency code (3-letter ISO code or hex string)"),
      issuer: z.string().describe("Issuer's XRP address"),
      limit: z.string().describe("Maximum amount of the token to trust")
    },
    async ({ currency, issuer, limit }) => {
      try {
        const client = await getClient()
        const wallet = await createWallet()

        // Create a trustline transaction
        const trustSetTx: TrustSet = {
          TransactionType: "TrustSet",
          Account: wallet.address,
          LimitAmount: {
            currency,
            issuer,
            value: limit
          }
        }

        // Prepare and sign the transaction
        const prepared = await client.autofill(trustSetTx)
        const signed = wallet.sign(prepared)

        // Submit the transaction
        const result = await client.submitAndWait(signed.tx_blob)

        return {
          content: [
            {
              type: "text" as const,
              text: `XRP Trustline Created!
Account: ${wallet.address}
Currency: ${currency}
Issuer: ${issuer}
Limit: ${limit}
Transaction Hash: ${result.result.hash}
Explorer Link: ${XRP_EXPLORER}/transactions/${result.result.hash}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Failed to create XRP trustline: ${error.message}` }]
        }
      }
    }
  )

  // Clean up on process exit
  process.on("beforeExit", async () => {
    await cleanUp()
  })
}
