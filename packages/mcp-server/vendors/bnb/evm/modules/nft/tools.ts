/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address } from "viem"
import { z } from "zod"

import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam } from "../common/types"

export function registerNftTools(server: McpServer) {
  // Get NFT (ERC721) information
  server.tool(
    "get_nft_info",
    "Get detailed information about a specific NFT (ERC721 token), including collection name, symbol, token URI, and current owner if available.",
    {
      tokenAddress: z
        .string()
        .describe(
          "The contract address of the NFT collection (e.g., '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' for Bored Ape Yacht Club)"
        ),
      tokenId: z
        .string()
        .describe("The ID of the specific NFT token to query (e.g., '1234')"),
      network: defaultNetworkParam
    },
    async ({ tokenAddress, tokenId, network }) => {
      try {
        const metadata = await services.getERC721TokenMetadata(
          tokenAddress as Address,
          BigInt(tokenId),
          network
        )

        return mcpToolRes.success(metadata)
      } catch (error) {
        return mcpToolRes.error(error, "fetching NFT metadata")
      }
    }
  )

  // Add tool for getting ERC1155 token URI
  server.tool(
    "get_erc1155_token_metadata",
    "Get the metadata for an ERC1155 token (multi-token standard used for both fungible and non-fungible tokens). The metadata typically points to JSON metadata about the token.",
    {
      tokenAddress: z
        .string()
        .describe(
          "The contract address of the ERC1155 token collection (e.g., '0x76BE3b62873462d2142405439777e971754E8E77')"
        ),
      tokenId: z
        .string()
        .describe(
          "The ID of the specific token to query metadata for (e.g., '1234')"
        ),
      network: defaultNetworkParam
    },
    async ({ tokenAddress, tokenId, network }) => {
      try {
        const metadata = await services.getERC1155TokenMetadata(
          tokenAddress as Address,
          BigInt(tokenId),
          network
        )

        return mcpToolRes.success(metadata)
      } catch (error) {
        return mcpToolRes.error(error, "fetching ERC1155 token URI")
      }
    }
  )

  // Transfer NFT
  server.tool(
    "transfer_nft",
    "Transfer an NFT to an address",
    {
      privateKey: z
        .string()
        .describe(
          "Private key of the owner's account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."
        )
        .default(process.env.PRIVATE_KEY as string),
      tokenAddress: z
        .string()
        .describe(
          "The contract address of the NFT collection (e.g., '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D' for Bored Ape Yacht Club)"
        ),
      tokenId: z
        .string()
        .describe("The ID of the specific NFT to transfer (e.g., '1234')"),
      toAddress: z
        .string()
        .describe("The recipient address that will receive the NFT"),
      network: defaultNetworkParam
    },
    async ({ privateKey, tokenAddress, tokenId, toAddress, network }) => {
      try {
        const result = await services.transferERC721(
          tokenAddress as Address,
          toAddress as Address,
          BigInt(tokenId),
          privateKey,
          network
        )

        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          network,
          contract: tokenAddress,
          tokenId: result.tokenId,
          recipient: toAddress,
          name: result.token.name,
          symbol: result.token.symbol
        })
      } catch (error) {
        return mcpToolRes.error(error, "transferring NFT")
      }
    }
  )

  // Transfer ERC1155 token
  server.tool(
    "transfer_erc1155",
    "Transfer ERC1155 tokens to another address. ERC1155 is a multi-token standard that can represent both fungible and non-fungible tokens in a single contract.",
    {
      privateKey: z
        .string()
        .describe(
          "Private key of the token owner account in hex format (with or without 0x prefix). SECURITY: This is used only for transaction signing and is not stored."
        )
        .default(process.env.PRIVATE_KEY as string),
      tokenAddress: z
        .string()
        .describe(
          "The contract address of the ERC1155 token collection (e.g., '0x76BE3b62873462d2142405439777e971754E8E77')"
        ),
      tokenId: z
        .string()
        .describe("The ID of the specific token to transfer (e.g., '1234')"),
      amount: z
        .string()
        .describe(
          "The quantity of tokens to send (e.g., '1' for a single NFT or '10' for 10 fungible tokens)"
        ),
      toAddress: z
        .string()
        .describe("The recipient wallet address that will receive the tokens"),
      network: defaultNetworkParam
    },
    async ({
      privateKey,
      tokenAddress,
      tokenId,
      amount,
      toAddress,
      network
    }) => {
      try {
        const result = await services.transferERC1155(
          tokenAddress as Address,
          toAddress as Address,
          BigInt(tokenId),
          amount,
          privateKey,
          network
        )

        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          network,
          contract: tokenAddress,
          tokenId: result.tokenId,
          amount: result.amount,
          recipient: toAddress
        })
      } catch (error) {
        return mcpToolRes.error(error, "transferring ERC1155 tokens")
      }
    }
  )
}
