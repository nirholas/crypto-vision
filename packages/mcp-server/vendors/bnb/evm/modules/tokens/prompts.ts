/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { networkSchema } from "../common/types.js"

export function registerTokenPrompts(server: McpServer) {
  // Token analysis prompt
  server.prompt(
    "analyze_token",
    "Analyze an ERC20 or NFT token",
    {
      tokenAddress: z.string().describe("Token contract address to analyze"),
      network: networkSchema,
      tokenType: z
        .string()
        .optional()
        .describe(
          "Type of token to analyze (erc20, erc721/nft, or auto-detect). Defaults to auto."
        ),
      tokenId: z
        .string()
        .optional()
        .describe("Token ID (required for NFT analysis)")
    },
    ({ tokenAddress, tokenType = "auto", tokenId, network = "bsc" }) => {
      let promptText = ""

      if (tokenType === "erc20" || tokenType === "auto") {
        promptText = `Please analyze the ERC20 token at address ${tokenAddress} on the ${network} network. Provide information about its name, symbol, total supply, and any other relevant details. If possible, explain the token's purpose, utility, and market context.`
      } else if ((tokenType === "erc721" || tokenType === "nft") && tokenId) {
        promptText = `Please analyze the NFT with token ID ${tokenId} from the collection at address ${tokenAddress} on the ${network} network. Provide information about the collection name, token details, ownership history if available, and any other relevant information about this specific NFT.`
      } else if (tokenType === "nft" || tokenType === "erc721") {
        promptText = `Please analyze the NFT collection at address ${tokenAddress} on the ${network} network. Provide information about the collection name, symbol, total supply if available, floor price if available, and any other relevant details about this NFT collection.`
      }

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
