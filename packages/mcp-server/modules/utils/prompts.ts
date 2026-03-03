/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerUtilityPrompts(server: McpServer) {
  server.prompt(
    "decode_calldata",
    "Help decode transaction calldata",
    {
      calldata: {
        description: "The transaction calldata to decode",
        required: true
      }
    },
    ({ calldata }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me decode this transaction calldata: ${calldata}

Steps to analyze:
1. Use get_function_selector to identify the function (first 4 bytes)
2. Look up common function selectors
3. Use abi_decode to decode the parameters

Provide:
- Function signature (if identifiable)
- Decoded parameters
- Explanation of what the transaction does`
          }
        }
      ]
    })
  )

  server.prompt(
    "analyze_storage_layout",
    "Analyze contract storage layout",
    {
      address: {
        description: "Contract address to analyze",
        required: true
      },
      network: {
        description: "Network to use",
        required: false
      }
    },
    ({ address, network = "eth" }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze the storage layout of contract ${address} on ${network}.

Use get_storage_at to read various slots and try to identify:
1. Owner/admin address (often slot 0)
2. Important state variables
3. Mapping storage patterns

Read common slots: 0x0, 0x1, 0x2, etc. and analyze the values.`
          }
        }
      ]
    })
  )
}
