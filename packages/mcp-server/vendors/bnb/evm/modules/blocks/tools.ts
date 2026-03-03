/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Hash } from "viem"
import { z } from "zod"

import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam } from "../common/types"

export function registerBlockTools(server: McpServer) {
  // Get block by hash for a specific network
  server.tool(
    "get_block_by_hash",
    "Get a block by hash",
    {
      blockHash: z.string().describe("The block hash to look up"),
      network: defaultNetworkParam
    },
    async ({ network, blockHash }) => {
      try {
        const block = await services.getBlockByHash(blockHash as Hash, network)
        return mcpToolRes.success(block)
      } catch (error) {
        return mcpToolRes.error(error, "fetching block by hash")
      }
    }
  )

  // Get block by number for a specific network
  server.tool(
    "get_block_by_number",
    "Get a block by number",
    {
      blockNumber: z.string().describe("The block number to look up"),
      network: defaultNetworkParam
    },
    async ({ network, blockNumber }) => {
      try {
        const block = await services.getBlockByNumber(
          parseInt(blockNumber),
          network
        )
        return mcpToolRes.success(block)
      } catch (error) {
        return mcpToolRes.error(error, "fetching block by number")
      }
    }
  )

  // Get latest block for a specific network
  server.tool(
    "get_latest_block",
    "Get the latest block",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const block = await services.getLatestBlock(network)
        return mcpToolRes.success(block)
      } catch (error) {
        return mcpToolRes.error(error, "fetching latest block")
      }
    }
  )
}
