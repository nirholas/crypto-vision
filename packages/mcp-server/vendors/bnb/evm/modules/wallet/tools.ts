/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Hex } from "viem"
import { z } from "zod"

import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam, privateKeyParam } from "../common/types"

export function registerWalletTools(server: McpServer) {
  // Get address from private key
  server.tool(
    "get_address_from_private_key",
    "Get the EVM address derived from a private key",
    {
      privateKey: privateKeyParam
    },
    async ({ privateKey }) => {
      try {
        // Ensure the private key has 0x prefix
        const formattedKey = privateKey.startsWith("0x")
          ? (privateKey as Hex)
          : (`0x${privateKey}` as Hex)

        const address = services.getAddressFromPrivateKey(formattedKey)

        return mcpToolRes.success({
          address
        })
      } catch (error) {
        return mcpToolRes.error(error, "deriving address from private key")
      }
    }
  )

  // Transfer native token
  server.tool(
    "transfer_native_token",
    "Transfer native tokens (BNB, ETH, MATIC, etc.) to an address",
    {
      privateKey: privateKeyParam,
      toAddress: z
        .string()
        .describe(
          "The recipient address or ENS name (e.g., '0x1234...' or 'vitalik.eth')"
        ),
      amount: z
        .string()
        .describe(
          "Amount to send in BNB (or the native token of the network), as a string (e.g., '0.1')"
        ),
      network: defaultNetworkParam
    },
    async ({ privateKey, toAddress, amount, network }) => {
      try {
        const hash = await services.transferETH(
          privateKey,
          toAddress,
          amount,
          network
        )

        return mcpToolRes.success({
          success: true,
          txHash: hash,
          toAddress,
          amount,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "transferring native token")
      }
    }
  )

  // Approve ERC20 token spending
  server.tool(
    "approve_token_spending",
    "Approve another address (like a DeFi protocol or exchange) to spend your ERC20 tokens. This is often required before interacting with DeFi protocols.",
    {
      privateKey: privateKeyParam,
      tokenAddress: z
        .string()
        .describe(
          "The contract address of the ERC20 token to approve for spending (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC on Ethereum)"
        ),
      spenderAddress: z
        .string()
        .describe(
          "The contract address being approved to spend your tokens (e.g., a DEX or lending protocol)"
        ),
      amount: z
        .string()
        .describe(
          "The amount of tokens to approve in token units, not wei (e.g., '1000' to approve spending 1000 tokens). Use a very large number for unlimited approval."
        ),
      network: defaultNetworkParam
    },
    async ({ privateKey, tokenAddress, spenderAddress, amount, network }) => {
      try {
        const result = await services.approveERC20(
          tokenAddress,
          spenderAddress,
          amount,
          privateKey,
          network
        )

        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          tokenAddress,
          spenderAddress,
          amount: result.amount.formatted,
          symbol: result.token.symbol,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "approving token spending")
      }
    }
  )

  // Transfer ERC20 tokens
  server.tool(
    "transfer_erc20",
    "Transfer ERC20 tokens to an address",
    {
      privateKey: privateKeyParam,
      tokenAddress: z
        .string()
        .describe(
          "The contract address or ENS name of the ERC20 token to transfer (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC or 'uniswap.eth')"
        ),
      toAddress: z
        .string()
        .describe(
          "The recipient address or ENS name that will receive the tokens (e.g., '0x1234...' or 'vitalik.eth')"
        ),
      amount: z
        .string()
        .describe(
          "Amount of tokens to send as a string (e.g., '100' for 100 tokens). This will be adjusted for the token's decimals."
        ),
      network: defaultNetworkParam
    },
    async ({ privateKey, tokenAddress, toAddress, amount, network }) => {
      try {
        const result = await services.transferERC20(
          tokenAddress,
          toAddress,
          amount,
          privateKey,
          network
        )

        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          tokenAddress,
          toAddress,
          amount: result.amount.formatted,
          symbol: result.token.symbol,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "transferring tokens")
      }
    }
  )
}
