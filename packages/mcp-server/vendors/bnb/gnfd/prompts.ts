/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerGnfdPrompts(server: McpServer) {
  // Analyze overdue buckets prompt
  server.prompt(
    "analyze_overdue_buckets",
    "Analyze buckets with overdue payments or low balance",
    {
      bucketName: z.string().describe("The name of the bucket to analyze"),
      network: z
        .string()
        .describe(
          "The network to use, greenfield testnet or greenfield mainnet"
        )
    },
    ({ bucketName, network = "testnet" }) => {
      const promptText = `Please analyze the payment status and balance for the following bucket on ${network}:
${bucketName}

For each bucket:
1. Check the bucket's quota and payment information
2. Analyze the payment account's balance and stream status
3. Identify any buckets with overdue payments or remaining quota is less than 0 bytes
4. Calculate remaining time before potential service interruption
5. Provide recommendations for required deposits

Please use gnfd_get_bucket_full_info to get bucket details and gnfd_get_payment_account_info to check payment status.`

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText
            }
          }
        ]
      }
    }
  )
}
