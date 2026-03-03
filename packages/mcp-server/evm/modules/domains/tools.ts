/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { namehash, labelhash, normalize } from "viem/ens"
import { keccak256, toHex, encodeFunctionData, parseEther, formatEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
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
  },
  {
    name: "setSubnodeOwner",
    type: "function",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "label", type: "bytes32" },
      { name: "owner", type: "address" }
    ],
    outputs: [{ name: "", type: "bytes32" }]
  },
  {
    name: "setOwner",
    type: "function",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "owner", type: "address" }
    ],
    outputs: []
  },
  {
    name: "setResolver",
    type: "function",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "resolver", type: "address" }
    ],
    outputs: []
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
  },
  {
    name: "setAddr",
    type: "function",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "addr", type: "address" }
    ],
    outputs: []
  },
  {
    name: "setText",
    type: "function",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" }
    ],
    outputs: []
  },
  {
    name: "setContenthash",
    type: "function",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "hash", type: "bytes" }
    ],
    outputs: []
  }
] as const

// ENS Controller ABI (for registration)
const ENS_CONTROLLER_ABI = [
  {
    name: "available",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "rentPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "duration", type: "uint256" }
    ],
    outputs: [
      { name: "base", type: "uint256" },
      { name: "premium", type: "uint256" }
    ]
  },
  {
    name: "makeCommitment",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "name", type: "string" },
      { name: "owner", type: "address" },
      { name: "duration", type: "uint256" },
      { name: "secret", type: "bytes32" },
      { name: "resolver", type: "address" },
      { name: "data", type: "bytes[]" },
      { name: "reverseRecord", type: "bool" },
      { name: "ownerControlledFuses", type: "uint16" }
    ],
    outputs: [{ name: "", type: "bytes32" }]
  },
  {
    name: "commit",
    type: "function",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: []
  },
  {
    name: "register",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "owner", type: "address" },
      { name: "duration", type: "uint256" },
      { name: "secret", type: "bytes32" },
      { name: "resolver", type: "address" },
      { name: "data", type: "bytes[]" },
      { name: "reverseRecord", type: "bool" },
      { name: "ownerControlledFuses", type: "uint16" }
    ],
    outputs: []
  },
  {
    name: "renew",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "duration", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "minCommitmentAge",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "maxCommitmentAge",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const

// ENS contract addresses
const ENS_CONTRACTS: Record<number, { registry: Address; controller?: Address; publicResolver?: Address }> = {
  1: { 
    registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    controller: "0x253553366Da8546fC250F225fe3d25d0C782303b",
    publicResolver: "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63"
  },
  5: { registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" }, // Goerli
  11155111: { 
    registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    controller: "0xFED6a969AaA60E4961FCD3EBF1A2e8913ac65B72",
    publicResolver: "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD"
  } // Sepolia
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

  // Register ENS name
  server.tool(
    "register_ens_name",
    "Register a new ENS name via ETH Registrar Controller (requires commit-reveal process)",
    {
      name: z.string().describe("ENS name to register (without .eth suffix)"),
      duration: z.number().describe("Registration duration in seconds (1 year = 31536000)"),
      ownerAddress: z.string().optional().describe("Address to set as owner (defaults to sender)"),
      setReverseRecord: z.boolean().optional().default(true).describe("Set as primary name for owner"),
      privateKey: z.string().describe("Private key for registration").default(process.env.PRIVATE_KEY as string)
    },
    async ({ name, duration, ownerAddress, setReverseRecord = true, privateKey }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        const walletClient = getWalletClient(privateKey as Hex, "ethereum")
        const chainId = await publicClient.getChainId()
        
        const ensContracts = ENS_CONTRACTS[chainId]
        if (!ensContracts?.controller) {
          return mcpToolRes.error(
            new Error("ENS registration not available on this network"),
            "registering ENS name"
          )
        }

        // Normalize name (remove .eth if present)
        const label = name.toLowerCase().replace(/\.eth$/, "")
        const owner = (ownerAddress || walletClient.account.address) as Address

        // Check availability
        const isAvailable = await publicClient.readContract({
          address: ensContracts.controller,
          abi: ENS_CONTROLLER_ABI,
          functionName: "available",
          args: [label]
        })

        if (!isAvailable) {
          return mcpToolRes.error(new Error(`Name "${label}.eth" is not available`), "registering ENS name")
        }

        // Get rent price
        const [basePrice, premium] = await publicClient.readContract({
          address: ensContracts.controller,
          abi: ENS_CONTROLLER_ABI,
          functionName: "rentPrice",
          args: [label, BigInt(duration)]
        }) as [bigint, bigint]

        const totalPrice = basePrice + premium

        // Generate random secret for commit-reveal
        const secret = keccak256(toHex(Date.now().toString() + Math.random().toString()))

        // Get minimum commitment age
        const minCommitmentAge = await publicClient.readContract({
          address: ensContracts.controller,
          abi: ENS_CONTROLLER_ABI,
          functionName: "minCommitmentAge"
        }) as bigint

        // Create commitment
        const commitment = await publicClient.readContract({
          address: ensContracts.controller,
          abi: ENS_CONTROLLER_ABI,
          functionName: "makeCommitment",
          args: [
            label,
            owner,
            BigInt(duration),
            secret,
            ensContracts.publicResolver || "0x0000000000000000000000000000000000000000",
            [],
            setReverseRecord,
            0
          ]
        }) as Hex

        // Submit commitment
        const commitData = encodeFunctionData({
          abi: ENS_CONTROLLER_ABI,
          functionName: "commit",
          args: [commitment]
        })

        const commitTx = await walletClient.sendTransaction({
          to: ensContracts.controller,
          data: commitData
        })

        await publicClient.waitForTransactionReceipt({ hash: commitTx })

        // Return info for second step (register)
        // In practice, user needs to wait minCommitmentAge and then call register
        return mcpToolRes.success({
          step: "commitment_submitted",
          name: `${label}.eth`,
          owner,
          duration: {
            seconds: duration,
            years: (duration / 31536000).toFixed(2)
          },
          pricing: {
            basePrice: formatEther(basePrice),
            premium: formatEther(premium),
            totalPrice: formatEther(totalPrice),
            totalPriceWei: totalPrice.toString()
          },
          commitment: {
            hash: commitment,
            secret: secret,
            transactionHash: commitTx
          },
          nextStep: {
            waitTime: Number(minCommitmentAge),
            waitTimeMinutes: Math.ceil(Number(minCommitmentAge) / 60),
            action: "After waiting, use the secret to complete registration",
            note: "IMPORTANT: Save the secret! You need it to complete registration."
          },
          resolver: ensContracts.publicResolver
        })
      } catch (error) {
        return mcpToolRes.error(error, "registering ENS name")
      }
    }
  )

  // Set ENS records
  server.tool(
    "set_ens_records",
    "Set records for an ENS name (address, text records, contenthash)",
    {
      name: z.string().describe("ENS name"),
      records: z.object({
        address: z.string().optional().describe("ETH address to resolve to"),
        textRecords: z.record(z.string()).optional().describe("Text records (e.g., {\"com.twitter\": \"@username\"})"),
        contenthash: z.string().optional().describe("Content hash (IPFS, Swarm, etc.)")
      }).describe("Records to set"),
      privateKey: z.string().describe("Private key of name owner").default(process.env.PRIVATE_KEY as string)
    },
    async ({ name, records, privateKey }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        const walletClient = getWalletClient(privateKey as Hex, "ethereum")
        const chainId = await publicClient.getChainId()
        
        const ensContracts = ENS_CONTRACTS[chainId]
        if (!ensContracts) {
          return mcpToolRes.error(new Error("ENS not available on this network"), "setting ENS records")
        }

        const normalizedName = normalize(name)
        const node = namehash(normalizedName)

        // Get resolver address
        const resolverAddress = await publicClient.readContract({
          address: ensContracts.registry,
          abi: ENS_REGISTRY_ABI,
          functionName: "resolver",
          args: [node]
        }) as Address

        if (!resolverAddress || resolverAddress === "0x0000000000000000000000000000000000000000") {
          return mcpToolRes.error(
            new Error("No resolver set for this name. Set a resolver first."),
            "setting ENS records"
          )
        }

        const transactions: Array<{ type: string; hash: string }> = []

        // Set address record
        if (records.address) {
          const setAddrData = encodeFunctionData({
            abi: ENS_RESOLVER_ABI,
            functionName: "setAddr",
            args: [node, records.address as Address]
          })

          const hash = await walletClient.sendTransaction({
            to: resolverAddress,
            data: setAddrData
          })
          await publicClient.waitForTransactionReceipt({ hash })
          transactions.push({ type: "setAddr", hash })
        }

        // Set text records
        if (records.textRecords) {
          for (const [key, value] of Object.entries(records.textRecords)) {
            const setTextData = encodeFunctionData({
              abi: ENS_RESOLVER_ABI,
              functionName: "setText",
              args: [node, key, value]
            })

            const hash = await walletClient.sendTransaction({
              to: resolverAddress,
              data: setTextData
            })
            await publicClient.waitForTransactionReceipt({ hash })
            transactions.push({ type: `setText(${key})`, hash })
          }
        }

        // Set contenthash
        if (records.contenthash) {
          const setContenthashData = encodeFunctionData({
            abi: ENS_RESOLVER_ABI,
            functionName: "setContenthash",
            args: [node, records.contenthash as Hex]
          })

          const hash = await walletClient.sendTransaction({
            to: resolverAddress,
            data: setContenthashData
          })
          await publicClient.waitForTransactionReceipt({ hash })
          transactions.push({ type: "setContenthash", hash })
        }

        return mcpToolRes.success({
          name: normalizedName,
          resolver: resolverAddress,
          recordsSet: {
            address: records.address || null,
            textRecords: records.textRecords || {},
            contenthash: records.contenthash || null
          },
          transactions,
          status: "success"
        })
      } catch (error) {
        return mcpToolRes.error(error, "setting ENS records")
      }
    }
  )

  // Transfer ENS name
  server.tool(
    "transfer_ens",
    "Transfer ENS name ownership to a new address",
    {
      name: z.string().describe("ENS name to transfer"),
      newOwner: z.string().describe("Address of new owner"),
      privateKey: z.string().describe("Private key of current owner").default(process.env.PRIVATE_KEY as string)
    },
    async ({ name, newOwner, privateKey }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        const walletClient = getWalletClient(privateKey as Hex, "ethereum")
        const chainId = await publicClient.getChainId()
        
        const ensContracts = ENS_CONTRACTS[chainId]
        if (!ensContracts) {
          return mcpToolRes.error(new Error("ENS not available on this network"), "transferring ENS name")
        }

        const normalizedName = normalize(name)
        const node = namehash(normalizedName)

        // Verify current ownership
        const currentOwner = await publicClient.readContract({
          address: ensContracts.registry,
          abi: ENS_REGISTRY_ABI,
          functionName: "owner",
          args: [node]
        }) as Address

        if (currentOwner.toLowerCase() !== walletClient.account.address.toLowerCase()) {
          return mcpToolRes.error(
            new Error("You are not the owner of this ENS name"),
            "transferring ENS name"
          )
        }

        // Transfer ownership
        const transferData = encodeFunctionData({
          abi: ENS_REGISTRY_ABI,
          functionName: "setOwner",
          args: [node, newOwner as Address]
        })

        const hash = await walletClient.sendTransaction({
          to: ensContracts.registry,
          data: transferData
        })

        await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          name: normalizedName,
          transfer: {
            from: currentOwner,
            to: newOwner,
            transactionHash: hash
          },
          status: "success",
          note: "ENS name ownership transferred. The new owner now controls this name."
        })
      } catch (error) {
        return mcpToolRes.error(error, "transferring ENS name")
      }
    }
  )

  // Renew ENS name
  server.tool(
    "renew_ens",
    "Extend the registration of an ENS name",
    {
      name: z.string().describe("ENS name to renew (without .eth)"),
      duration: z.number().describe("Additional duration in seconds (1 year = 31536000)"),
      privateKey: z.string().describe("Private key for payment").default(process.env.PRIVATE_KEY as string)
    },
    async ({ name, duration, privateKey }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        const walletClient = getWalletClient(privateKey as Hex, "ethereum")
        const chainId = await publicClient.getChainId()
        
        const ensContracts = ENS_CONTRACTS[chainId]
        if (!ensContracts?.controller) {
          return mcpToolRes.error(
            new Error("ENS renewal not available on this network"),
            "renewing ENS name"
          )
        }

        // Normalize name
        const label = name.toLowerCase().replace(/\.eth$/, "")

        // Get renewal price
        const [basePrice, premium] = await publicClient.readContract({
          address: ensContracts.controller,
          abi: ENS_CONTROLLER_ABI,
          functionName: "rentPrice",
          args: [label, BigInt(duration)]
        }) as [bigint, bigint]

        const totalPrice = basePrice + premium
        // Add 10% buffer for price fluctuations
        const valueToSend = (totalPrice * 110n) / 100n

        // Renew the name
        const renewData = encodeFunctionData({
          abi: ENS_CONTROLLER_ABI,
          functionName: "renew",
          args: [label, BigInt(duration)]
        })

        const hash = await walletClient.sendTransaction({
          to: ensContracts.controller,
          data: renewData,
          value: valueToSend
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          name: `${label}.eth`,
          renewal: {
            duration: {
              seconds: duration,
              years: (duration / 31536000).toFixed(2)
            },
            price: {
              base: formatEther(basePrice),
              premium: formatEther(premium),
              total: formatEther(totalPrice)
            },
            transactionHash: hash,
            gasUsed: receipt.gasUsed.toString()
          },
          status: "success"
        })
      } catch (error) {
        return mcpToolRes.error(error, "renewing ENS name")
      }
    }
  )

  // Create subdomain
  server.tool(
    "create_subdomain",
    "Create a subdomain under an ENS name you own",
    {
      parentName: z.string().describe("Parent ENS name (e.g., 'example.eth')"),
      subdomain: z.string().describe("Subdomain label (e.g., 'blog' for 'blog.example.eth')"),
      ownerAddress: z.string().optional().describe("Owner of the subdomain (defaults to sender)"),
      resolverAddress: z.string().optional().describe("Resolver address for subdomain"),
      privateKey: z.string().describe("Private key of parent name owner").default(process.env.PRIVATE_KEY as string)
    },
    async ({ parentName, subdomain, ownerAddress, resolverAddress, privateKey }) => {
      try {
        const publicClient = getPublicClient("ethereum")
        const walletClient = getWalletClient(privateKey as Hex, "ethereum")
        const chainId = await publicClient.getChainId()
        
        const ensContracts = ENS_CONTRACTS[chainId]
        if (!ensContracts) {
          return mcpToolRes.error(new Error("ENS not available on this network"), "creating subdomain")
        }

        const normalizedParent = normalize(parentName)
        const parentNode = namehash(normalizedParent)
        const subdomainLabel = subdomain.toLowerCase()
        const subdomainLabelHash = labelhash(subdomainLabel)
        const fullName = `${subdomainLabel}.${normalizedParent}`
        const fullNode = namehash(fullName)

        // Verify ownership of parent
        const parentOwner = await publicClient.readContract({
          address: ensContracts.registry,
          abi: ENS_REGISTRY_ABI,
          functionName: "owner",
          args: [parentNode]
        }) as Address

        if (parentOwner.toLowerCase() !== walletClient.account.address.toLowerCase()) {
          return mcpToolRes.error(
            new Error("You are not the owner of the parent ENS name"),
            "creating subdomain"
          )
        }

        const subdomainOwner = (ownerAddress || walletClient.account.address) as Address

        // Create subdomain
        const setSubnodeData = encodeFunctionData({
          abi: ENS_REGISTRY_ABI,
          functionName: "setSubnodeOwner",
          args: [parentNode, subdomainLabelHash, subdomainOwner]
        })

        const createTx = await walletClient.sendTransaction({
          to: ensContracts.registry,
          data: setSubnodeData
        })

        await publicClient.waitForTransactionReceipt({ hash: createTx })

        // Set resolver if provided
        let resolverTx: string | null = null
        if (resolverAddress || ensContracts.publicResolver) {
          const resolver = (resolverAddress || ensContracts.publicResolver) as Address
          
          // Need to set resolver as subdomain owner
          const setResolverData = encodeFunctionData({
            abi: ENS_REGISTRY_ABI,
            functionName: "setResolver",
            args: [fullNode, resolver]
          })

          // If subdomain owner is different, this would need to be called by them
          if (subdomainOwner.toLowerCase() === walletClient.account.address.toLowerCase()) {
            resolverTx = await walletClient.sendTransaction({
              to: ensContracts.registry,
              data: setResolverData
            })
            await publicClient.waitForTransactionReceipt({ hash: resolverTx as Hex })
          }
        }

        return mcpToolRes.success({
          subdomain: {
            fullName,
            label: subdomainLabel,
            parent: normalizedParent,
            owner: subdomainOwner,
            node: fullNode
          },
          transactions: {
            create: createTx,
            setResolver: resolverTx
          },
          status: "success",
          note: resolverTx 
            ? "Subdomain created and resolver set"
            : "Subdomain created. Set a resolver to configure records."
        })
      } catch (error) {
        return mcpToolRes.error(error, "creating subdomain")
      }
    }
  )
}

