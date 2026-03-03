/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hash } from "viem"
import { z } from "zod"

import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam } from "../common/types"

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
}
