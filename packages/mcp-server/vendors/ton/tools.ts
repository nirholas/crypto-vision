/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
  TonClient,
  Address,
  toNano,
  fromNano,
  beginCell,
  WalletContractV4,
  internal,
  SendMode
} from "@ton/ton"
import { mnemonicToWalletKey, KeyPair } from "@ton/crypto"

import Logger from "@/utils/logger.js"

// Initialize TON client
let tonClient: TonClient | null = null

// TON Network URL - Default to mainnet
const TON_MAINNET_ENDPOINT = process.env.TON_RPC_URL || "https://toncenter.com/api/v2/jsonRPC"
const TON_TESTNET_ENDPOINT = "https://testnet.toncenter.com/api/v2/jsonRPC"
const TON_API_KEY = process.env.TON_API_KEY || ""
const TON_EXPLORER = "https://tonscan.org"

// Helper function to get or initialize the client
function getClient(testnet: boolean = false): TonClient {
  const endpoint = testnet ? TON_TESTNET_ENDPOINT : TON_MAINNET_ENDPOINT

  if (!tonClient) {
    tonClient = new TonClient({
      endpoint,
      apiKey: TON_API_KEY
    })
  }
  return tonClient
}

// Helper function to create a wallet from mnemonic
async function createWalletFromMnemonic(mnemonic: string): Promise<KeyPair> {
  const mnemonicArray = mnemonic.split(" ")
  const keyPair = await mnemonicToWalletKey(mnemonicArray)
  return keyPair
}

// Helper function to determine wallet version and create appropriate contract
async function createWalletContract(
  client: TonClient,
  address: Address,
  keyPair: KeyPair
): Promise<{ contract: WalletContractV4; walletVersion: string }> {
  const walletContract = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0
  })

  const derivedAddress = walletContract.address
  if (!derivedAddress.equals(address)) {
    Logger.warn("Warning: Derived wallet address does not match provided address.")
    Logger.warn(`Derived: ${derivedAddress.toString()}`)
    Logger.warn(`Provided: ${address.toString()}`)
  }

  return {
    contract: walletContract,
    walletVersion: "v4r2"
  }
}

// Helper function to implement exponential backoff for API rate limits
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let retries = 0

  while (true) {
    try {
      return await fn()
    } catch (error: any) {
      retries++

      if (retries > maxRetries || !error.message.includes("429")) {
        throw error
      }

      const delay = Math.pow(2, retries - 1) * 1000
      Logger.debug(`Rate limit hit, retrying in ${delay}ms (attempt ${retries} of ${maxRetries})...`)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

export function registerTonTools(server: McpServer) {
  // ==================== BALANCE ====================

  server.tool(
    "ton_get_balance",
    "Get balance for a TON address",
    {
      address: z.string().describe("TON address to check"),
      testnet: z.boolean().optional().describe("Use testnet instead of mainnet")
    },
    async ({ address, testnet = false }) => {
      try {
        const client = getClient(testnet)

        let validAddress
        try {
          validAddress = Address.parse(address)
        } catch (error) {
          return {
            content: [{ type: "text" as const, text: `Invalid TON address format: ${address}` }]
          }
        }

        const accountInfo = await withRetry(() => client.getBalance(validAddress))
        const balance = fromNano(accountInfo)

        return {
          content: [
            {
              type: "text" as const,
              text: `TON Balance for ${validAddress.toString()}:\n${balance} TON`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Failed to retrieve TON balance: ${error.message}` }]
        }
      }
    }
  )

  // ==================== TRANSACTION HISTORY ====================

  server.tool(
    "ton_get_transaction_history",
    "Get transaction history for a TON address",
    {
      address: z.string().describe("TON address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return (default: 10)"),
      testnet: z.boolean().optional().describe("Use testnet instead of mainnet")
    },
    async ({ address, limit = 10, testnet = false }) => {
      try {
        const client = getClient(testnet)

        let validAddress
        try {
          validAddress = Address.parse(address)
        } catch (error) {
          return {
            content: [{ type: "text" as const, text: `Invalid TON address format: ${address}` }]
          }
        }

        const transactions = await withRetry(() =>
          client.getTransactions(validAddress, { limit: limit })
        )

        if (transactions.length === 0) {
          return {
            content: [
              { type: "text" as const, text: `No transactions found for ${validAddress.toString()}` }
            ]
          }
        }

        const txList = transactions
          .map((tx: any) => {
            const timestamp = new Date(tx.time * 1000).toLocaleString()
            const inMsg = tx.inMessage
            const outMsgs = tx.outMessages

            let txType = "Unknown"
            let fromAddress = "N/A"
            let toAddress = "N/A"
            let amount = "0"
            let comment = ""

            if (inMsg && inMsg.source) {
              txType = "Incoming"
              fromAddress = inMsg.source.toString()
              toAddress = validAddress.toString()
              amount = inMsg.value ? fromNano(inMsg.value) : "0"

              if (inMsg.body) {
                try {
                  const msgBody = inMsg.body
                  if (msgBody && msgBody.beginParse) {
                    const slice = msgBody.beginParse()
                    if (slice.loadUint(32) === 0) {
                      comment = slice.loadStringTail()
                    }
                  }
                } catch (e) {
                  // Silent fail if we can't parse the comment
                }
              }
            } else if (outMsgs && outMsgs.length > 0) {
              txType = "Outgoing"
              fromAddress = validAddress.toString()

              let totalAmount = 0n
              outMsgs.forEach((msg: any) => {
                if (msg.destination) {
                  toAddress = msg.destination.toString()
                }
                if (msg.value) {
                  totalAmount += msg.value
                }

                if (!comment && msg.body) {
                  try {
                    const msgBody = msg.body
                    if (msgBody && msgBody.beginParse) {
                      const slice = msgBody.beginParse()
                      if (slice.loadUint(32) === 0) {
                        comment = slice.loadStringTail()
                      }
                    }
                  } catch (e) {
                    // Silent fail if we can't parse the comment
                  }
                }
              })

              amount = fromNano(totalAmount)
            }

            return `
Transaction: ${tx.hash}
Type: ${txType}
Date: ${timestamp}
From: ${fromAddress}
To: ${toAddress}
Amount: ${amount} TON${comment ? `\nComment: ${comment}` : ""}`
          })
          .join("\n---\n")

        return {
          content: [
            {
              type: "text" as const,
              text: `TON Transaction History for ${validAddress.toString()}:\n${txList}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve TON transaction history: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== ADDRESS VALIDATION ====================

  server.tool(
    "ton_validate_address",
    "Validate a TON address format",
    {
      address: z.string().describe("TON address to validate")
    },
    async ({ address }) => {
      try {
        let isValid = false
        let normalized = ""

        try {
          const parsedAddress = Address.parse(address)
          isValid = true
          normalized = parsedAddress.toString()
        } catch (e) {
          isValid = false
        }

        return {
          content: [
            {
              type: "text" as const,
              text: isValid
                ? `The address ${address} has a valid TON address format.\nNormalized format: ${normalized}`
                : `The address ${address} does NOT have a valid TON address format.`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Error validating TON address: ${error.message}` }]
        }
      }
    }
  )

  // ==================== NETWORK INFO ====================

  server.tool(
    "ton_get_network_info",
    "Get current TON network information",
    {
      testnet: z.boolean().optional().describe("Use testnet instead of mainnet")
    },
    async ({ testnet = false }) => {
      try {
        const client = getClient(testnet)

        const masterchainInfo = await withRetry(() => client.getMasterchainInfo())

        return {
          content: [
            {
              type: "text" as const,
              text: `TON Network Information (${testnet ? "Testnet" : "Mainnet"}):
Current Workchain: ${masterchainInfo.workchain}
Current Shard: ${masterchainInfo.shard}
Initial Seqno: ${masterchainInfo.initSeqno}
Latest Seqno: ${masterchainInfo.latestSeqno}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve TON Network information: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== SEND TRANSACTION ====================

  server.tool(
    "ton_send_transaction",
    "Send TON from your wallet to another address using mnemonic from environment",
    {
      toAddress: z.string().describe("TON address to send to"),
      amount: z.union([z.string(), z.number()]).describe("Amount of TON to send"),
      comment: z.string().optional().describe("Optional comment to include with the transaction"),
      testnet: z.boolean().optional().describe("Use testnet instead of mainnet")
    },
    async ({ toAddress, amount, comment, testnet = false }) => {
      try {
        if (!process.env.TON_MNEMONIC) {
          return {
            content: [
              { type: "text" as const, text: "TON_MNEMONIC is required in the environment" }
            ]
          }
        }

        if (!process.env.TON_ADDRESS) {
          return {
            content: [{ type: "text" as const, text: "TON_ADDRESS is required in the environment" }]
          }
        }

        const client = getClient(testnet)

        const walletAddress = Address.parse(process.env.TON_ADDRESS)
        let destinationAddress: Address
        try {
          destinationAddress = Address.parse(toAddress)
        } catch (error) {
          return {
            content: [{ type: "text" as const, text: `Invalid destination address: ${toAddress}` }]
          }
        }

        const keyPair = await createWalletFromMnemonic(process.env.TON_MNEMONIC)

        const amountInNano = toNano(typeof amount === "number" ? amount.toString() : amount)

        const { contract: walletContract, walletVersion } = await createWalletContract(
          client,
          walletAddress,
          keyPair
        )

        const wallet = client.open(walletContract)

        const balance = await withRetry(() => wallet.getBalance())
        const balanceInTon = fromNano(balance)

        const sendAmount = BigInt(amountInNano)
        const gasFee = toNano("0.05")
        if (balance < sendAmount + gasFee) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Insufficient funds: ${balanceInTon} TON available, need at least ${fromNano(sendAmount + gasFee)} TON (including fees)`
              }
            ]
          }
        }

        const body = comment
          ? beginCell().storeUint(0, 32).storeStringTail(comment).endCell()
          : undefined

        const message = internal({
          to: destinationAddress,
          value: amountInNano,
          body: body
        })

        const seqno = await withRetry(() => wallet.getSeqno())

        const timestamp = Math.floor(Date.now() / 1000)
        const txId = `${timestamp}-${walletAddress.toString().slice(0, 8)}-${destinationAddress.toString().slice(0, 8)}`

        await withRetry(() =>
          wallet.sendTransfer({
            seqno: seqno,
            secretKey: keyPair.secretKey,
            messages: [message],
            sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS
          })
        )

        const explorerLink = testnet
          ? `https://testnet.tonscan.org/address/${destinationAddress.toString()}`
          : `${TON_EXPLORER}/address/${destinationAddress.toString()}`

        return {
          content: [
            {
              type: "text" as const,
              text: `TON Transaction Sent Successfully!
From: ${walletAddress.toString()}
To: ${destinationAddress.toString()}
Amount: ${typeof amount === "number" ? amount.toString() : amount} TON
${comment ? `Comment: ${comment}\n` : ""}
Wallet Version: ${walletVersion}
Transaction ID: ${txId}
Explorer Link: ${explorerLink}

Note: The transaction has been sent to the network. Check the explorer link to see when it appears (usually within seconds).`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Failed to send TON transaction: ${error.message}` }]
        }
      }
    }
  )
}
