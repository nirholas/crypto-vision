import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { namehash, labelhash, normalize } from "viem/ens"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// ENS Registry and Resolver ABIs
const ENS_REGISTRY_ABI = [
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "resolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "ttl",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "uint64" }]
  }
] as const

const ENS_RESOLVER_ABI = [
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "text",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" }
    ],
    outputs: [{ name: "", type: "string" }]
  },
  {
    name: "contenthash",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes" }]
  }
] as const

// ENS contract addresses
const ENS_CONTRACTS: Record<number, { registry: Address }> = {
  1: { registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" },
  5: { registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" }, // Goerli
  11155111: { registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" } // Sepolia
}

// Space ID for BNB Chain
const SPACE_ID_CONTRACTS: Record<number, { registry: Address }> = {
  56: { registry: "0x08CEd32a7f3eeC915Ba84415e9C07a7286977956" }
}

export function registerDomainsTools(server: McpServer) {
  // Resolve ENS name to address
  server.tool(
    "resolve_ens_name",
    "Resolve an ENS name to its Ethereum address",
    {
      name: z.string().describe("ENS name (e.g., 'vitalik.eth')"),
      network: z.string().optional().describe("Network (default: ethereum)")
    },
    async ({ name, network = "ethereum" }) => {
      try {
        const publicClient = getPublicClient(network)
        
        // Use viem's built-in ENS resolution
        const address = await publicClient.getEnsAddress({ name: normalize(name) })
        
        if (!address) {
          return mcpToolRes.success({
            name,
            resolved: false,
            address: null,
            message: "ENS name does not resolve to an address"
          })
        }

        return mcpToolRes.success({
          name,
          resolved: true,
          address,
          namehash: namehash(normalize(name))
        })
      } catch (error) {
        return mcpToolRes.error(error, "resolving ENS name")
      }
    }
  )

  // Reverse resolve address to ENS name
  server.tool(
    "reverse_resolve_address",
    "Get the ENS name for an Ethereum address (reverse lookup)",
    {
      address: z.string().describe("Ethereum address"),
      network: z.string().optional().describe("Network (default: ethereum)")
    },
    async ({ address, network = "ethereum" }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const name = await publicClient.getEnsName({ address: address as Address })
        
        return mcpToolRes.success({
          address,
          hasEnsName: !!name,
          ensName: name || null
        })
      } catch (error) {
        return mcpToolRes.error(error, "reverse resolving address")
      }
    }
  )

  // Get ENS text records
  server.tool(
    "get_ens_text_records",
    "Get text records for an ENS name (avatar, twitter, email, etc.)",
    {
      name: z.string().describe("ENS name"),
      records: z.array(z.string()).optional().describe("Specific records to fetch (default: common ones)")
    },
    async ({ name, records }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        const normalizedName = normalize(name)
        
        const defaultRecords = [
          "avatar",
          "description",
          "display",
          "email",
          "keywords",
          "mail",
          "notice",
          "location",
          "phone",
          "url",
          "com.twitter",
          "com.github",
          "com.discord",
          "org.telegram"
        ]

        const recordsToFetch = records || defaultRecords
        const textRecords: Record<string, string | null> = {}

        for (const key of recordsToFetch) {
          try {
            const value = await publicClient.getEnsText({ name: normalizedName, key })
            if (value) {
              textRecords[key] = value
            }
          } catch {
            // Record doesn't exist or error
          }
        }

        return mcpToolRes.success({
          name: normalizedName,
          textRecords,
          recordsFound: Object.keys(textRecords).length
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting ENS text records")
      }
    }
  )

  // Get ENS avatar
  server.tool(
    "get_ens_avatar",
    "Get the avatar URL for an ENS name",
    {
      name: z.string().describe("ENS name")
    },
    async ({ name }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        const normalizedName = normalize(name)
        
        const avatar = await publicClient.getEnsAvatar({ name: normalizedName })
        
        return mcpToolRes.success({
          name: normalizedName,
          hasAvatar: !!avatar,
          avatarUrl: avatar || null
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting ENS avatar")
      }
    }
  )

  // Check ENS name availability
  server.tool(
    "check_ens_availability",
    "Check if an ENS name is available for registration",
    {
      name: z.string().describe("ENS name to check (without .eth)")
    },
    async ({ name }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        const fullName = name.endsWith(".eth") ? name : `${name}.eth`
        const normalizedName = normalize(fullName)
        
        // Try to resolve - if it fails or returns null, might be available
        const address = await publicClient.getEnsAddress({ name: normalizedName })
        
        return mcpToolRes.success({
          name: normalizedName,
          isRegistered: !!address,
          currentOwner: address || null,
          available: !address,
          note: address 
            ? "This name is already registered" 
            : "Name may be available (verify on ENS app)"
        })
      } catch (error) {
        // If resolution fails completely, name might be available
        return mcpToolRes.success({
          name: name.endsWith(".eth") ? name : `${name}.eth`,
          isRegistered: false,
          available: true,
          note: "Name appears to be available (verify on ENS app)"
        })
      }
    }
  )

  // Get ENS name details
  server.tool(
    "get_ens_name_details",
    "Get comprehensive details about an ENS name",
    {
      name: z.string().describe("ENS name")
    },
    async ({ name }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        const normalizedName = normalize(name)
        const node = namehash(normalizedName)
        const chainId = await publicClient.getChainId()
        
        const ensContracts = ENS_CONTRACTS[chainId]
        if (!ensContracts) {
          return mcpToolRes.error(new Error("ENS not available on this network"), "getting ENS details")
        }

        // Get basic info
        const [address, resolver, owner] = await Promise.all([
          publicClient.getEnsAddress({ name: normalizedName }).catch(() => null),
          publicClient.readContract({
            address: ensContracts.registry,
            abi: ENS_REGISTRY_ABI,
            functionName: "resolver",
            args: [node]
          }).catch(() => null),
          publicClient.readContract({
            address: ensContracts.registry,
            abi: ENS_REGISTRY_ABI,
            functionName: "owner",
            args: [node]
          }).catch(() => null)
        ])

        // Get avatar
        const avatar = await publicClient.getEnsAvatar({ name: normalizedName }).catch(() => null)

        return mcpToolRes.success({
          name: normalizedName,
          namehash: node,
          details: {
            resolvedAddress: address,
            owner,
            resolver,
            avatar
          },
          isRegistered: !!owner && owner !== "0x0000000000000000000000000000000000000000"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting ENS name details")
      }
    }
  )

  // Lookup multiple addresses
  server.tool(
    "batch_resolve_addresses",
    "Reverse resolve multiple addresses to ENS names",
    {
      addresses: z.array(z.string()).describe("Array of Ethereum addresses")
    },
    async ({ addresses }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        
        const results: Array<{ address: string; ensName: string | null }> = []

        for (const address of addresses) {
          try {
            const name = await publicClient.getEnsName({ address: address as Address })
            results.push({ address, ensName: name || null })
          } catch {
            results.push({ address, ensName: null })
          }
        }

        const resolved = results.filter(r => r.ensName !== null).length

        return mcpToolRes.success({
          results,
          summary: {
            total: addresses.length,
            resolved,
            notResolved: addresses.length - resolved
          }
        })
      } catch (error) {
        return mcpToolRes.error(error, "batch resolving addresses")
      }
    }
  )
}
