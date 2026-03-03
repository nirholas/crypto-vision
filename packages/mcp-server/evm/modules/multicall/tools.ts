/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { decodeFunctionResult, encodeFunctionData } from "viem"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Multicall3 contract address (same across all EVM chains)
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address

// Multicall3 ABI
const MULTICALL3_ABI = [
  {
    name: "aggregate3",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" }
        ]
      }
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" }
        ]
      }
    ]
  },
  {
    name: "aggregate",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" }
        ]
      }
    ],
    outputs: [
      { name: "blockNumber", type: "uint256" },
      { name: "returnData", type: "bytes[]" }
    ]
  },
  {
    name: "tryAggregate",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "requireSuccess", type: "bool" },
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" }
        ]
      }
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" }
        ]
      }
    ]
  },
  {
    name: "getBlockNumber",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "blockNumber", type: "uint256" }]
  },
  {
    name: "getBasefee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "basefee", type: "uint256" }]
  },
  {
    name: "getBlockHash",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "blockNumber", type: "uint256" }],
    outputs: [{ name: "blockHash", type: "bytes32" }]
  },
  {
    name: "getEthBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  }
] as const

// ERC20 ABI for common calls
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const

export function registerMulticallTools(server: McpServer) {
  // Execute multicall
  server.tool(
    "execute_multicall",
    "Execute multiple contract calls in a single transaction",
    {
      network: defaultNetworkParam,
      calls: z.array(z.object({
        target: z.string().describe("Contract address"),
        callData: z.string().describe("Encoded call data (hex)"),
        allowFailure: z.boolean().optional().describe("Allow this call to fail")
      })).describe("Array of calls to execute")
    },
    async ({ network, calls }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const formattedCalls = calls.map(call => ({
          target: call.target as Address,
          allowFailure: call.allowFailure ?? false,
          callData: call.callData as Hex
        }))

        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [formattedCalls]
        })

        const results = (result as Array<{ success: boolean; returnData: Hex }>).map((r, i) => ({
          index: i,
          target: calls[i].target,
          success: r.success,
          returnData: r.returnData
        }))

        return mcpToolRes.success({
          network,
          totalCalls: calls.length,
          successfulCalls: results.filter(r => r.success).length,
          results
        })
      } catch (error) {
        return mcpToolRes.error(error, "executing multicall")
      }
    }
  )

  // Get multiple token balances
  server.tool(
    "get_multi_token_balances",
    "Get balances of multiple tokens for an address in a single call",
    {
      network: defaultNetworkParam,
      address: z.string().describe("Wallet address to check"),
      tokens: z.array(z.string()).describe("Array of token contract addresses")
    },
    async ({ network, address, tokens }) => {
      try {
        const publicClient = getPublicClient(network)
        
        // Build multicall for balanceOf
        const calls = tokens.map(token => ({
          target: token as Address,
          allowFailure: true,
          callData: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address as Address]
          })
        }))

        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [calls]
        })

        const balances = (result as Array<{ success: boolean; returnData: Hex }>).map((r, i) => {
          if (!r.success || r.returnData === "0x") {
            return {
              token: tokens[i],
              balance: "0",
              error: "Call failed"
            }
          }
          
          try {
            const balance = decodeFunctionResult({
              abi: ERC20_ABI,
              functionName: "balanceOf",
              data: r.returnData
            })
            return {
              token: tokens[i],
              balance: balance.toString()
            }
          } catch {
            return {
              token: tokens[i],
              balance: "0",
              error: "Decode failed"
            }
          }
        })

        return mcpToolRes.success({
          network,
          address,
          balances,
          totalTokens: tokens.length
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting multi token balances")
      }
    }
  )

  // Get token info for multiple tokens
  server.tool(
    "get_multi_token_info",
    "Get name, symbol, decimals for multiple tokens in a single call",
    {
      network: defaultNetworkParam,
      tokens: z.array(z.string()).describe("Array of token contract addresses")
    },
    async ({ network, tokens }) => {
      try {
        const publicClient = getPublicClient(network)
        
        // Build calls for name, symbol, decimals for each token
        const calls: Array<{ target: Address; allowFailure: boolean; callData: Hex }> = []
        
        for (const token of tokens) {
          calls.push({
            target: token as Address,
            allowFailure: true,
            callData: encodeFunctionData({ abi: ERC20_ABI, functionName: "name" })
          })
          calls.push({
            target: token as Address,
            allowFailure: true,
            callData: encodeFunctionData({ abi: ERC20_ABI, functionName: "symbol" })
          })
          calls.push({
            target: token as Address,
            allowFailure: true,
            callData: encodeFunctionData({ abi: ERC20_ABI, functionName: "decimals" })
          })
        }

        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [calls]
        })

        const results = result as Array<{ success: boolean; returnData: Hex }>
        const tokenInfos = tokens.map((token, i) => {
          const nameResult = results[i * 3]
          const symbolResult = results[i * 3 + 1]
          const decimalsResult = results[i * 3 + 2]
          
          let name = "Unknown"
          let symbol = "???"
          let decimals = 18
          
          try {
            if (nameResult.success && nameResult.returnData !== "0x") {
              name = decodeFunctionResult({
                abi: ERC20_ABI,
                functionName: "name",
                data: nameResult.returnData
              }) as string
            }
          } catch {}
          
          try {
            if (symbolResult.success && symbolResult.returnData !== "0x") {
              symbol = decodeFunctionResult({
                abi: ERC20_ABI,
                functionName: "symbol",
                data: symbolResult.returnData
              }) as string
            }
          } catch {}
          
          try {
            if (decimalsResult.success && decimalsResult.returnData !== "0x") {
              decimals = Number(decodeFunctionResult({
                abi: ERC20_ABI,
                functionName: "decimals",
                data: decimalsResult.returnData
              }))
            }
          } catch {}

          return { address: token, name, symbol, decimals }
        })

        return mcpToolRes.success({
          network,
          tokens: tokenInfos,
          totalTokens: tokens.length
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting multi token info")
      }
    }
  )

  // Get multiple native balances
  server.tool(
    "get_multi_native_balances",
    "Get native token balances for multiple addresses",
    {
      network: defaultNetworkParam,
      addresses: z.array(z.string()).describe("Array of addresses to check")
    },
    async ({ network, addresses }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const calls = addresses.map(addr => ({
          target: MULTICALL3_ADDRESS,
          allowFailure: true,
          callData: encodeFunctionData({
            abi: MULTICALL3_ABI,
            functionName: "getEthBalance",
            args: [addr as Address]
          })
        }))

        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [calls]
        })

        const balances = (result as Array<{ success: boolean; returnData: Hex }>).map((r, i) => {
          if (!r.success) {
            return { address: addresses[i], balance: "0", error: "Call failed" }
          }
          
          // Decode uint256
          const balance = BigInt(r.returnData)
          return {
            address: addresses[i],
            balance: balance.toString(),
            formatted: (Number(balance) / 1e18).toFixed(6)
          }
        })

        return mcpToolRes.success({
          network,
          balances,
          totalAddresses: addresses.length
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting multi native balances")
      }
    }
  )

  // Encode call data helper
  server.tool(
    "encode_call_data",
    "Encode function call data for use in multicall",
    {
      functionSignature: z.string().describe("Function signature (e.g., 'balanceOf(address)')"),
      args: z.array(z.string()).describe("Function arguments as strings")
    },
    async ({ functionSignature, args }) => {
      try {
        // Parse function signature
        const match = functionSignature.match(/^(\w+)\((.*)\)$/)
        if (!match) {
          return mcpToolRes.error(new Error("Invalid function signature"), "encoding call data")
        }

        const [, funcName, paramTypes] = match
        const types = paramTypes ? paramTypes.split(",").map(t => t.trim()) : []

        // Build minimal ABI
        const abi = [{
          name: funcName,
          type: "function",
          inputs: types.map((type, i) => ({ name: `arg${i}`, type })),
          outputs: []
        }] as const

        // Process args based on types
        const processedArgs = args.map((arg, i) => {
          const type = types[i]
          if (type.startsWith("uint") || type.startsWith("int")) {
            return BigInt(arg)
          }
          if (type === "bool") {
            return arg.toLowerCase() === "true"
          }
          return arg
        })

        const callData = encodeFunctionData({
          abi,
          functionName: funcName,
          args: processedArgs
        })

        return mcpToolRes.success({
          functionSignature,
          args,
          callData
        })
      } catch (error) {
        return mcpToolRes.error(error, "encoding call data")
      }
    }
  )

  // Batch check allowances
  server.tool(
    "batch_check_allowances",
    "Check token allowances for multiple token/spender pairs",
    {
      network: defaultNetworkParam,
      owner: z.string().describe("Token owner address"),
      checks: z.array(z.object({
        token: z.string().describe("Token address"),
        spender: z.string().describe("Spender address")
      })).describe("Array of token/spender pairs to check")
    },
    async ({ network, owner, checks }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const allowanceAbi = [{
          name: "allowance",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" }
          ],
          outputs: [{ name: "", type: "uint256" }]
        }] as const

        const calls = checks.map(check => ({
          target: check.token as Address,
          allowFailure: true,
          callData: encodeFunctionData({
            abi: allowanceAbi,
            functionName: "allowance",
            args: [owner as Address, check.spender as Address]
          })
        }))

        const result = await publicClient.readContract({
          address: MULTICALL3_ADDRESS,
          abi: MULTICALL3_ABI,
          functionName: "aggregate3",
          args: [calls]
        })

        const allowances = (result as Array<{ success: boolean; returnData: Hex }>).map((r, i) => {
          if (!r.success) {
            return {
              token: checks[i].token,
              spender: checks[i].spender,
              allowance: "0",
              error: "Call failed"
            }
          }
          
          const allowance = BigInt(r.returnData)
          return {
            token: checks[i].token,
            spender: checks[i].spender,
            allowance: allowance.toString(),
            isUnlimited: allowance >= BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / 2n
          }
        })

        return mcpToolRes.success({
          network,
          owner,
          allowances,
          totalChecks: checks.length
        })
      } catch (error) {
        return mcpToolRes.error(error, "batch checking allowances")
      }
    }
  )
}
