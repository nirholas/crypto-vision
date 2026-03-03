/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { formatEther, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam, privateKeyParam } from "../common/types"

// OpenSea Seaport contract addresses
const SEAPORT_ADDRESSES: Record<number, Address> = {
  1: "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", // Ethereum
  137: "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", // Polygon
  42161: "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", // Arbitrum
  10: "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC", // Optimism
  8453: "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC" // Base
}

// ERC721 ABI for extended operations
const ERC721_EXTENDED_ABI = [
  { name: "approve", type: "function", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  { name: "setApprovalForAll", type: "function", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
  { name: "isApprovedForAll", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ type: "bool" }] },
  { name: "getApproved", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "tokenURI", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }
] as const

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

  // Get NFT collection info
  server.tool(
    "get_nft_collection_info",
    "Get comprehensive information about an NFT collection (total supply, name, symbol)",
    {
      collectionAddress: z.string().describe("NFT collection contract address"),
      network: defaultNetworkParam
    },
    async ({ collectionAddress, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const [name, symbol, totalSupply] = await Promise.all([
          publicClient.readContract({
            address: collectionAddress as Address,
            abi: ERC721_EXTENDED_ABI,
            functionName: "name"
          }).catch(() => "Unknown"),
          publicClient.readContract({
            address: collectionAddress as Address,
            abi: ERC721_EXTENDED_ABI,
            functionName: "symbol"
          }).catch(() => "???"),
          publicClient.readContract({
            address: collectionAddress as Address,
            abi: ERC721_EXTENDED_ABI,
            functionName: "totalSupply"
          }).catch(() => 0n)
        ])

        return mcpToolRes.success({
          collectionAddress,
          name,
          symbol,
          totalSupply: totalSupply.toString(),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting NFT collection info")
      }
    }
  )

  // Get NFTs owned by address
  server.tool(
    "get_nfts_by_owner",
    "Get the count of NFTs owned by an address in a specific collection",
    {
      collectionAddress: z.string().describe("NFT collection contract address"),
      ownerAddress: z.string().describe("Owner address to check"),
      network: defaultNetworkParam
    },
    async ({ collectionAddress, ownerAddress, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const balance = await publicClient.readContract({
          address: collectionAddress as Address,
          abi: ERC721_EXTENDED_ABI,
          functionName: "balanceOf",
          args: [ownerAddress as Address]
        })

        return mcpToolRes.success({
          collectionAddress,
          ownerAddress,
          nftCount: balance.toString(),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting NFTs by owner")
      }
    }
  )

  // Check NFT ownership
  server.tool(
    "check_nft_ownership",
    "Check if an address owns a specific NFT",
    {
      collectionAddress: z.string().describe("NFT collection contract address"),
      tokenId: z.string().describe("Token ID to check"),
      network: defaultNetworkParam
    },
    async ({ collectionAddress, tokenId, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const owner = await publicClient.readContract({
          address: collectionAddress as Address,
          abi: ERC721_EXTENDED_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)]
        })

        return mcpToolRes.success({
          collectionAddress,
          tokenId,
          owner,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking NFT ownership")
      }
    }
  )

  // Approve NFT for marketplace
  server.tool(
    "approve_nft_for_marketplace",
    "Approve an NFT for sale on a marketplace (Seaport/OpenSea)",
    {
      collectionAddress: z.string().describe("NFT collection contract address"),
      tokenId: z.string().optional().describe("Specific token ID (omit for collection-wide approval)"),
      marketplace: z.enum(["seaport", "custom"]).default("seaport").describe("Marketplace to approve for"),
      customOperator: z.string().optional().describe("Custom operator address if marketplace is 'custom'"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ collectionAddress, tokenId, marketplace, customOperator, privateKey, network }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        const account = privateKeyToAccount(privateKey as Hex)
        const chainId = await publicClient.getChainId()

        let operatorAddress: Address
        if (marketplace === "seaport") {
          operatorAddress = SEAPORT_ADDRESSES[chainId]
          if (!operatorAddress) {
            throw new Error(`Seaport not available on chain ${chainId}`)
          }
        } else {
          if (!customOperator) throw new Error("customOperator required for custom marketplace")
          operatorAddress = customOperator as Address
        }

        let hash: Hex
        if (tokenId) {
          // Approve specific token
          hash = await walletClient.writeContract({
            address: collectionAddress as Address,
            abi: ERC721_EXTENDED_ABI,
            functionName: "approve",
            args: [operatorAddress, BigInt(tokenId)],
            account
          })
        } else {
          // Approve all tokens
          hash = await walletClient.writeContract({
            address: collectionAddress as Address,
            abi: ERC721_EXTENDED_ABI,
            functionName: "setApprovalForAll",
            args: [operatorAddress, true],
            account
          })
        }

        return mcpToolRes.success({
          collectionAddress,
          tokenId: tokenId || "all",
          operator: operatorAddress,
          marketplace,
          txHash: hash,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "approving NFT for marketplace")
      }
    }
  )

  // Revoke NFT marketplace approval
  server.tool(
    "revoke_nft_approval",
    "Revoke NFT approval for a marketplace or operator",
    {
      collectionAddress: z.string().describe("NFT collection contract address"),
      operator: z.string().describe("Operator address to revoke"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ collectionAddress, operator, privateKey, network }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)

        const hash = await walletClient.writeContract({
          address: collectionAddress as Address,
          abi: ERC721_EXTENDED_ABI,
          functionName: "setApprovalForAll",
          args: [operator as Address, false],
          account
        })

        return mcpToolRes.success({
          collectionAddress,
          operator,
          action: "revoked",
          txHash: hash,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "revoking NFT approval")
      }
    }
  )

  // Check NFT approval status
  server.tool(
    "check_nft_approval",
    "Check if an operator is approved to manage NFTs",
    {
      collectionAddress: z.string().describe("NFT collection contract address"),
      ownerAddress: z.string().describe("NFT owner address"),
      operatorAddress: z.string().describe("Operator address to check"),
      tokenId: z.string().optional().describe("Specific token ID to check (for single token approval)"),
      network: defaultNetworkParam
    },
    async ({ collectionAddress, ownerAddress, operatorAddress, tokenId, network }) => {
      try {
        const publicClient = getPublicClient(network)

        // Check collection-wide approval
        const isApprovedForAll = await publicClient.readContract({
          address: collectionAddress as Address,
          abi: ERC721_EXTENDED_ABI,
          functionName: "isApprovedForAll",
          args: [ownerAddress as Address, operatorAddress as Address]
        })

        let singleTokenApproval: string | null = null
        if (tokenId) {
          const approved = await publicClient.readContract({
            address: collectionAddress as Address,
            abi: ERC721_EXTENDED_ABI,
            functionName: "getApproved",
            args: [BigInt(tokenId)]
          })
          singleTokenApproval = approved as string
        }

        return mcpToolRes.success({
          collectionAddress,
          ownerAddress,
          operatorAddress,
          isApprovedForAll,
          singleTokenApproval: tokenId ? {
            tokenId,
            approvedAddress: singleTokenApproval,
            isApproved: singleTokenApproval?.toLowerCase() === operatorAddress.toLowerCase()
          } : null,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking NFT approval")
      }
    }
  )

  // Batch transfer NFTs
  server.tool(
    "batch_transfer_nfts",
    "Transfer multiple NFTs to one or more recipients",
    {
      collectionAddress: z.string().describe("NFT collection contract address"),
      transfers: z.array(z.object({
        tokenId: z.string().describe("Token ID to transfer"),
        recipient: z.string().describe("Recipient address")
      })).describe("Array of transfers to execute"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ collectionAddress, transfers, privateKey, network }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        const account = privateKeyToAccount(privateKey as Hex)

        const results: Array<{ tokenId: string; recipient: string; txHash: string; status: string }> = []

        for (const transfer of transfers) {
          try {
            const hash = await walletClient.writeContract({
              address: collectionAddress as Address,
              abi: [{ name: "safeTransferFrom", type: "function", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] }],
              functionName: "safeTransferFrom",
              args: [account.address, transfer.recipient as Address, BigInt(transfer.tokenId)],
              account
            })
            results.push({ tokenId: transfer.tokenId, recipient: transfer.recipient, txHash: hash, status: "sent" })
          } catch (err: any) {
            results.push({ tokenId: transfer.tokenId, recipient: transfer.recipient, txHash: "", status: `failed: ${err.message}` })
          }
        }

        return mcpToolRes.success({
          collectionAddress,
          totalTransfers: transfers.length,
          successful: results.filter(r => r.status === "sent").length,
          results,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "batch transferring NFTs")
      }
    }
  )

  // Get NFT metadata from URI
  server.tool(
    "fetch_nft_metadata",
    "Fetch and parse NFT metadata from its token URI",
    {
      collectionAddress: z.string().describe("NFT collection contract address"),
      tokenId: z.string().describe("Token ID to fetch metadata for"),
      network: defaultNetworkParam
    },
    async ({ collectionAddress, tokenId, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const tokenURI = await publicClient.readContract({
          address: collectionAddress as Address,
          abi: ERC721_EXTENDED_ABI,
          functionName: "tokenURI",
          args: [BigInt(tokenId)]
        }) as string

        // Handle IPFS URIs
        let fetchUrl = tokenURI
        if (tokenURI.startsWith("ipfs://")) {
          fetchUrl = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/")
        }

        // Handle data URIs
        if (tokenURI.startsWith("data:application/json")) {
          const base64Data = tokenURI.split(",")[1]
          const jsonStr = Buffer.from(base64Data, "base64").toString()
          const metadata = JSON.parse(jsonStr)
          return mcpToolRes.success({
            collectionAddress,
            tokenId,
            tokenURI,
            metadata,
            source: "data-uri",
            network
          })
        }

        // Fetch from URL
        try {
          const response = await fetch(fetchUrl, { signal: AbortSignal.timeout(10000) })
          const metadata = await response.json()
          return mcpToolRes.success({
            collectionAddress,
            tokenId,
            tokenURI,
            metadata,
            source: "fetched",
            network
          })
        } catch {
          return mcpToolRes.success({
            collectionAddress,
            tokenId,
            tokenURI,
            metadata: null,
            source: "fetch-failed",
            note: "Could not fetch metadata from URI",
            network
          })
        }
      } catch (error) {
        return mcpToolRes.error(error, "fetching NFT metadata")
      }
    }
  )
}
