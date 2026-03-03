/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { networkSchema } from "../common/types.js"

export function registerWaletPrompts(server: McpServer) {
  // Address analysis prompt
  server.prompt(
    "analyze_address",
    "Analyze an EVM address",
    {
      address: z.string().describe("Ethereum address to analyze"),
      network: networkSchema
    },
    ({ address, network = "bsc" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please analyze the address ${address} on the ${network} network. Provide information about its balance, transaction count, and any other relevant information you can find.`
          }
        }
      ]
    })
  )
}
