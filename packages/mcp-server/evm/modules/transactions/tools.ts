/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hash, Hex } from "viem"
import { parseGwei } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam, privateKeyParam } from "../common/types"

export function registerTransactionTools(server: McpServer) {
  // Get transaction by hash
  server.tool(
    "get_transaction",
    "Get detailed information about a specific transaction by its hash. Includes sender, recipient, value, data, and more.",
    {
      txHash: z
        .string()
        .describe("The transaction hash to look up (e.g., '0x1234...')"),
      network: defaultNetworkParam
    },
    async ({ txHash, network }) => {
      try {
        const tx = await services.getTransaction(txHash as Hash, network)
        return mcpToolRes.success(tx)
      } catch (error) {
        return mcpToolRes.error(error, `fetching transaction ${txHash}`)
      }
    }
  )

  // Estimate gas
  server.tool(
    "estimate_gas",
    "Estimate the gas cost for a transaction",
    {
      to: z.string().describe("The recipient address"),
      value: z
        .string()
        .optional()
        .describe("The amount of ETH to send in ether (e.g., '0.1')"),
      data: z
        .string()
        .optional()
        .describe("The transaction data as a hex string"),
      network: defaultNetworkParam
    },
    async ({ to, value, data, network }) => {
      try {
        const params: any = { to: to as Address }

        if (value) {
          params.value = services.helpers.parseEther(value)
        }

        if (data) {
          params.data = data as `0x${string}`
        }

        const gas = await services.estimateGas(params, network)

        return mcpToolRes.success({
          network,
          estimatedGas: gas.toString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "estimating gas")
      }
    }
  )

  // Speed up transaction (replace with higher gas)
  server.tool(
    "speed_up_transaction",
    "Speed up a pending transaction by resubmitting it with higher gas price. Only works for pending transactions.",
    {
      originalTxHash: z
        .string()
        .describe("The hash of the pending transaction to speed up"),
      gasPriceMultiplier: z
        .number()
        .min(1.1)
        .max(10)
        .default(1.5)
        .describe("Multiplier for gas price (1.5 = 50% more gas, range: 1.1-10)"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ originalTxHash, gasPriceMultiplier, privateKey, network }) => {
      try {
        const publicClient = getPublicClient(network)

        // Get original transaction
        const originalTx = await publicClient.getTransaction({
          hash: originalTxHash as Hash
        })

        if (!originalTx) {
          throw new Error("Transaction not found")
        }

        // Check if already confirmed
        const receipt = await publicClient.getTransactionReceipt({
          hash: originalTxHash as Hash
        }).catch(() => null)

        if (receipt) {
          throw new Error("Transaction already confirmed, cannot speed up")
        }

        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)

        // Calculate new gas price
        let newGasPrice: bigint
        let newMaxFeePerGas: bigint | undefined
        let newMaxPriorityFeePerGas: bigint | undefined

        if (originalTx.maxFeePerGas && originalTx.maxPriorityFeePerGas) {
          // EIP-1559 transaction
          newMaxFeePerGas = BigInt(
            Math.ceil(Number(originalTx.maxFeePerGas) * gasPriceMultiplier)
          )
          newMaxPriorityFeePerGas = BigInt(
            Math.ceil(Number(originalTx.maxPriorityFeePerGas) * gasPriceMultiplier)
          )
        } else if (originalTx.gasPrice) {
          // Legacy transaction
          newGasPrice = BigInt(
            Math.ceil(Number(originalTx.gasPrice) * gasPriceMultiplier)
          )
        } else {
          throw new Error("Could not determine gas price from original transaction")
        }

        // Send replacement transaction with same nonce
        const txParams: any = {
          account,
          to: originalTx.to as Address,
          value: originalTx.value,
          data: originalTx.input,
          nonce: originalTx.nonce,
          gas: originalTx.gas
        }

        if (newMaxFeePerGas && newMaxPriorityFeePerGas) {
          txParams.maxFeePerGas = newMaxFeePerGas
          txParams.maxPriorityFeePerGas = newMaxPriorityFeePerGas
        } else {
          txParams.gasPrice = newGasPrice!
        }

        const hash = await walletClient.sendTransaction(txParams)

        return mcpToolRes.success({
          success: true,
          originalTxHash,
          newTxHash: hash,
          gasPriceMultiplier,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "speeding up transaction")
      }
    }
  )

  // Cancel transaction
  server.tool(
    "cancel_transaction",
    "Cancel a pending transaction by sending a 0-value transaction to yourself with the same nonce but higher gas",
    {
      originalTxHash: z
        .string()
        .describe("The hash of the pending transaction to cancel"),
      gasPriceMultiplier: z
        .number()
        .min(1.1)
        .max(10)
        .default(2)
        .describe("Multiplier for gas price (2 = double gas, range: 1.1-10)"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ originalTxHash, gasPriceMultiplier, privateKey, network }) => {
      try {
        const publicClient = getPublicClient(network)

        // Get original transaction
        const originalTx = await publicClient.getTransaction({
          hash: originalTxHash as Hash
        })

        if (!originalTx) {
          throw new Error("Transaction not found")
        }

        // Check if already confirmed
        const receipt = await publicClient.getTransactionReceipt({
          hash: originalTxHash as Hash
        }).catch(() => null)

        if (receipt) {
          throw new Error("Transaction already confirmed, cannot cancel")
        }

        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)

        // Calculate new gas price
        let txParams: any = {
          account,
          to: account.address, // Send to self
          value: BigInt(0), // Zero value
          nonce: originalTx.nonce,
          gas: BigInt(21000) // Minimum gas for simple transfer
        }

        if (originalTx.maxFeePerGas && originalTx.maxPriorityFeePerGas) {
          txParams.maxFeePerGas = BigInt(
            Math.ceil(Number(originalTx.maxFeePerGas) * gasPriceMultiplier)
          )
          txParams.maxPriorityFeePerGas = BigInt(
            Math.ceil(Number(originalTx.maxPriorityFeePerGas) * gasPriceMultiplier)
          )
        } else if (originalTx.gasPrice) {
          txParams.gasPrice = BigInt(
            Math.ceil(Number(originalTx.gasPrice) * gasPriceMultiplier)
          )
        }

        const hash = await walletClient.sendTransaction(txParams)

        return mcpToolRes.success({
          success: true,
          originalTxHash,
          cancellationTxHash: hash,
          message: "Cancellation transaction sent. If mined before the original, the original will fail.",
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "cancelling transaction")
      }
    }
  )

  // Get pending transactions for address
  server.tool(
    "get_pending_transaction_count",
    "Get the number of pending transactions for an address (difference between pending and latest nonce)",
    {
      address: z.string().describe("The address to check"),
      network: defaultNetworkParam
    },
    async ({ address, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const [pendingNonce, latestNonce] = await Promise.all([
          publicClient.getTransactionCount({
            address: address as Address,
            blockTag: "pending"
          }),
          publicClient.getTransactionCount({
            address: address as Address,
            blockTag: "latest"
          })
        ])

        return mcpToolRes.success({
          address,
          pendingNonce,
          confirmedNonce: latestNonce,
          pendingTransactions: pendingNonce - latestNonce,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting pending transaction count")
      }
    }
  )

  // Simulate transaction
  server.tool(
    "simulate_transaction",
    "Simulate a transaction to check if it would succeed without actually sending it",
    {
      to: z.string().describe("The recipient address"),
      value: z
        .string()
        .optional()
        .describe("Amount to send in ether (e.g., '0.1')"),
      data: z
        .string()
        .optional()
        .describe("Transaction calldata as hex string"),
      from: z
        .string()
        .optional()
        .describe("The sender address (for simulation)"),
      network: defaultNetworkParam
    },
    async ({ to, value, data, from, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const callParams: any = {
          to: to as Address
        }

        if (from) {
          callParams.account = from as Address
        }
        if (value) {
          callParams.value = services.helpers.parseEther(value)
        }
        if (data) {
          callParams.data = data as Hex
        }

        const result = await publicClient.call(callParams)

        return mcpToolRes.success({
          success: true,
          result: result.data || "0x",
          message: "Transaction simulation successful - it should succeed on-chain",
          network
        })
      } catch (error: any) {
        return mcpToolRes.success({
          success: false,
          error: error.message,
          message: "Transaction would fail",
          network
        })
      }
    }
  )
}
