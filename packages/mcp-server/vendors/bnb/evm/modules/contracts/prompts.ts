/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { networkSchema } from "../common/types.js"

export function registerContractPrompts(server: McpServer) {
  // Smart contract interaction guidance
  server.prompt(
    "interact_with_contract",
    "Get guidance on interacting with a smart contract",
    {
      contractAddress: z.string().describe("The contract address"),
      abiJson: z
        .string()
        .optional()
        .describe("The contract ABI as a JSON string"),
      network: networkSchema
    },
    ({ contractAddress, abiJson, network = "bsc" }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: abiJson
              ? `I need to interact with the smart contract at address ${contractAddress} on the ${network} network. Here's the ABI:\n\n${abiJson}\n\nPlease analyze this contract's functions and provide guidance on how to interact with it safely. Explain what each function does and what parameters it requires.`
              : `I need to interact with the smart contract at address ${contractAddress} on the ${network} network. Please help me understand what this contract does and how I can interact with it safely.`
          }
        }
      ]
    })
  )
}
