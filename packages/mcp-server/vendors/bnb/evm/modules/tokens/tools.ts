/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam, privateKeyParam } from "../common/types"

export function registerTokenTools(server: McpServer) {
  // Get ERC20 token info
  server.tool(
    "get_erc20_token_info",
    "Get ERC20 token information",
    {
      tokenAddress: z.string().describe("The ERC20 token contract address"),
      network: defaultNetworkParam
    },
    async ({ network, tokenAddress }) => {
      try {
        const tokenInfo = await services.getERC20TokenInfo(
          tokenAddress as Address,
          network
        )

        return mcpToolRes.success(tokenInfo)
      } catch (error) {
        return mcpToolRes.error(error, "fetching ERC20 token info")
      }
    }
  )

  // Get native token balance
  server.tool(
    "get_native_balance",
    "Get native token balance for an address",
    {
      network: defaultNetworkParam,
      address: z
        .string()
        .optional()
        .describe("The address to check balance for"),
      privateKey: privateKeyParam
    },
    async ({ network, address, privateKey }) => {
      try {
        const result = await services.getNativeBalance(
          address || privateKeyToAccount(privateKey as Hex).address,
          network
        )

        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "fetching native token balance")
      }
    }
  )

  // Get ERC20 token balance
  server.tool(
    "get_erc20_balance",
    "Get ERC20 token balance for an address",
    {
      tokenAddress: z.string().describe("The ERC20 token contract address"),
      address: z.string().describe("The address to check balance for"),
      network: defaultNetworkParam,
      privateKey: privateKeyParam
    },
    async ({ network, tokenAddress, address, privateKey }) => {
      try {
        const res = await services.getERC20Balance(
          tokenAddress as Address,
          address || privateKeyToAccount(privateKey as Hex).address,
          network
        )

        return mcpToolRes.success(res)
      } catch (error) {
        return mcpToolRes.error(error, "fetching ERC20 token balance")
      }
    }
  )

  // Create ERC20 token
  server.tool(
    "create_erc20_token",
    "Create a new ERC20 token",
    {
      name: z.string().describe("The name of the token"),
      symbol: z.string().describe("The symbol of the token"),
      network: defaultNetworkParam,
      privateKey: privateKeyParam
    },
    async ({ network, name, symbol, privateKey }) => {
      try {
        const result = await services.createERC20Token({
          name,
          symbol,
          privateKey: privateKey as Hex,
          network
        })

        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "creating ERC20 token")
      }
    }
  )
}
