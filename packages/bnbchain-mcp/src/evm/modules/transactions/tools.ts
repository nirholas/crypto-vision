import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
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
}
