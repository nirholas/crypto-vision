/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { normalize } from "viem/ens"
import { z } from "zod"

import { getRpcUrl, getSupportedNetworks } from "@/evm/chains.js"
import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam } from "../common/types.js"

export function registerNetworkTools(server: McpServer) {
  // Get EVM info for a specific network
  server.tool(
    "get_chain_info",
    "Get chain information for a specific network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const chainId = await services.getChainId(network)
        const blockNumber = await services.getBlockNumber(network)
        const rpcUrl = getRpcUrl(network)

        return mcpToolRes.success({
          network,
          chainId,
          blockNumber: blockNumber.toString(),
          rpcUrl
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching chain info")
      }
    }
  )

  // Get supported networks
  server.tool(
    "get_supported_networks",
    "Get list of supported networks",
    {},
    async () => {
      try {
        const networks = getSupportedNetworks()
        return mcpToolRes.success({
          supportedNetworks: networks
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching supported networks")
      }
    }
  )

  // // Resolve ENS name to address
  // server.tool(
  //   "resolve_ens",
  //   "Resolve an ENS name to an EVM address (not supported on BSC)",
  //   {
  //     ensName: z.string().describe("ENS name to resolve (e.g., 'vitalik.eth')"),
  //     network: defaultNetworkParam.default("eth")
  //   },
  //   async ({ ensName, network }) => {
  //     try {
  //       const normalizedName = normalize(ensName)
  //       const address = await services.resolveAddress(normalizedName, network)
  //       return mcpToolRes.success({
  //         ensName,
  //         normalizedName,
  //         resolvedAddress: address,
  //         network
  //       })
  //     } catch (error) {
  //       return mcpToolRes.error(error, "resolving ENS name")
  //     }
  //   }
  // )
}
