/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerNetworkPrompts(server: McpServer) {
  // EVM concept explanation
  server.prompt(
    "explain_evm_concept",
    "Get an explanation of an EVM concept",
    {
      concept: z
        .string()
        .describe("The EVM concept to explain (e.g., gas, nonce, etc.)")
    },
    ({ concept }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please explain the EVM Blockchain concept of "${concept}" in detail. Include how it works, why it's important, and provide examples if applicable.`
          }
        }
      ]
    })
  )

  // Network comparison
  server.prompt(
    "compare_networks",
    "Compare different EVM-compatible networks",
    {
      networkList: z
        .string()
        .describe(
          "Comma-separated list of networks to compare (e.g., 'bsc,opbnb,ethereum,optimism,base,etc.')"
        )
    },
    ({ networkList }) => {
      const networks = networkList.split(",").map((n) => n.trim())
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please compare the following EVM-compatible networks: ${networks.join(", ")}. Include information about their architecture, gas fees, transaction speed, security, and any other relevant differences.`
            }
          }
        ]
      }
    }
  )
}
