/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { networkSchema } from "../common/types.js"

export function registerBlockPrompts(server: McpServer) {
  // Basic block explorer prompt
  server.prompt(
    "analyze_block",
    "Analyze a block and provide detailed information about its contents",
    {
      blockNumber: z
        .string()
        .optional()
        .describe(
          "Block number to explore. If not provided, latest block will be used."
        ),
      network: networkSchema
    },
    ({ blockNumber, network = "bsc" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: blockNumber
              ? `Please analyze block #${blockNumber} on the ${network} network and provide information about its key metrics, transactions, and significance.`
              : `Please analyze the latest block on the ${network} network and provide information about its key metrics, transactions, and significance.`
          }
        }
      ]
    })
  )
}
