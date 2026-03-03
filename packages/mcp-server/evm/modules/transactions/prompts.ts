/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { networkSchema } from "../common/types.js"

export function registerTransactionPrompts(server: McpServer) {
  // Transaction analysis prompt
  server.prompt(
    "analyze_transaction",
    "Analyze a specific transaction",
    {
      txHash: z.string().describe("Transaction hash to analyze"),
      network: networkSchema
    },
    ({ txHash, network = "bsc" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please analyze transaction ${txHash} on the ${network} network and provide a detailed explanation of what this transaction does, who the parties involved are, the amount transferred (if applicable), gas used, and any other relevant information.`
          }
        }
      ]
    })
  )
}
