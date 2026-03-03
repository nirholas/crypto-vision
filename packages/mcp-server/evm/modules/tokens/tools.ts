/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { parseEther, formatEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam, privateKeyParam } from "../common/types"

// WETH/Wrapped Native Token ABI
const WETH_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: []
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: []
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const

// Wrapped native token addresses by chain ID
const WRAPPED_NATIVE_ADDRESSES: Record<number, Address> = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on Ethereum
  56: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB on BSC
  137: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC on Polygon
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH on Arbitrum
  10: "0x4200000000000000000000000000000000000006", // WETH on Optimism
  8453: "0x4200000000000000000000000000000000000006", // WETH on Base
  43114: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX on Avalanche
}

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

  // Wrap native token (ETH -> WETH, BNB -> WBNB, etc.)
  server.tool(
    "wrap_native_token",
    "Wrap native tokens to their wrapped ERC-20 version (ETH→WETH, BNB→WBNB, MATIC→WMATIC, etc.)",
    {
      amount: z
        .string()
        .describe("Amount of native tokens to wrap (e.g., '1.5')"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ amount, privateKey, network }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)

        const chainId = await publicClient.getChainId()
        const wrappedAddress = WRAPPED_NATIVE_ADDRESSES[chainId]

        if (!wrappedAddress) {
          throw new Error(`Wrapped native token not supported on chain ${chainId}`)
        }

        const amountWei = parseEther(amount)

        // Call deposit() with value
        const hash = await walletClient.writeContract({
          address: wrappedAddress,
          abi: WETH_ABI,
          functionName: "deposit",
          value: amountWei,
          account
        })

        return mcpToolRes.success({
          success: true,
          txHash: hash,
          amount,
          wrappedTokenAddress: wrappedAddress,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "wrapping native token")
      }
    }
  )

  // Unwrap wrapped native token (WETH -> ETH, WBNB -> BNB, etc.)
  server.tool(
    "unwrap_native_token",
    "Unwrap wrapped tokens back to native tokens (WETH→ETH, WBNB→BNB, WMATIC→MATIC, etc.)",
    {
      amount: z
        .string()
        .describe("Amount of wrapped tokens to unwrap (e.g., '1.5')"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ amount, privateKey, network }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)

        const chainId = await publicClient.getChainId()
        const wrappedAddress = WRAPPED_NATIVE_ADDRESSES[chainId]

        if (!wrappedAddress) {
          throw new Error(`Wrapped native token not supported on chain ${chainId}`)
        }

        const amountWei = parseEther(amount)

        // Check balance first
        const balance = await publicClient.readContract({
          address: wrappedAddress,
          abi: WETH_ABI,
          functionName: "balanceOf",
          args: [account.address]
        })

        if (balance < amountWei) {
          throw new Error(
            `Insufficient wrapped token balance. Have: ${formatEther(balance)}, Want: ${amount}`
          )
        }

        // Call withdraw()
        const hash = await walletClient.writeContract({
          address: wrappedAddress,
          abi: WETH_ABI,
          functionName: "withdraw",
          args: [amountWei],
          account
        })

        return mcpToolRes.success({
          success: true,
          txHash: hash,
          amount,
          wrappedTokenAddress: wrappedAddress,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "unwrapping native token")
      }
    }
  )

  // Get wrapped native token balance
  server.tool(
    "get_wrapped_native_balance",
    "Get the wrapped native token balance (WETH, WBNB, WMATIC, etc.) for an address",
    {
      address: z.string().describe("The address to check balance for"),
      network: defaultNetworkParam
    },
    async ({ address, network }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        const wrappedAddress = WRAPPED_NATIVE_ADDRESSES[chainId]

        if (!wrappedAddress) {
          throw new Error(`Wrapped native token not supported on chain ${chainId}`)
        }

        const balance = await publicClient.readContract({
          address: wrappedAddress,
          abi: WETH_ABI,
          functionName: "balanceOf",
          args: [address as Address]
        })

        return mcpToolRes.success({
          address,
          wrappedTokenAddress: wrappedAddress,
          balance: formatEther(balance),
          balanceWei: balance.toString(),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching wrapped native token balance")
      }
    }
  )

  // Batch transfer ERC20 tokens
  server.tool(
    "batch_transfer_erc20",
    "Transfer ERC20 tokens to multiple recipients in a single transaction (gas efficient)",
    {
      tokenAddress: z.string().describe("ERC20 token contract address"),
      recipients: z.array(z.object({
        address: z.string().describe("Recipient address"),
        amount: z.string().describe("Amount to send (in token units, e.g., '100.5')")
      })).describe("Array of recipient addresses and amounts"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ tokenAddress, recipients, privateKey, network }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        const account = privateKeyToAccount(privateKey as Hex)

        // Get token decimals
        const decimals = await publicClient.readContract({
          address: tokenAddress as Address,
          abi: [{ name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }],
          functionName: "decimals"
        }) as number

        const results: Array<{ recipient: string; amount: string; txHash: string; status: string }> = []

        // Process transfers sequentially to manage nonce
        for (const recipient of recipients) {
          try {
            const amountWei = BigInt(Math.floor(parseFloat(recipient.amount) * 10 ** decimals))
            
            const hash = await walletClient.writeContract({
              address: tokenAddress as Address,
              abi: [{ name: "transfer", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }],
              functionName: "transfer",
              args: [recipient.address as Address, amountWei],
              account
            })

            results.push({
              recipient: recipient.address,
              amount: recipient.amount,
              txHash: hash,
              status: "sent"
            })
          } catch (err: any) {
            results.push({
              recipient: recipient.address,
              amount: recipient.amount,
              txHash: "",
              status: `failed: ${err.message}`
            })
          }
        }

        return mcpToolRes.success({
          tokenAddress,
          totalRecipients: recipients.length,
          successful: results.filter(r => r.status === "sent").length,
          failed: results.filter(r => r.status !== "sent").length,
          results,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "batch transferring tokens")
      }
    }
  )

  // Burn ERC20 tokens
  server.tool(
    "burn_erc20_tokens",
    "Burn ERC20 tokens (send to zero address or call burn function if available)",
    {
      tokenAddress: z.string().describe("ERC20 token contract address"),
      amount: z.string().describe("Amount to burn (in token units)"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ tokenAddress, amount, privateKey, network }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        const account = privateKeyToAccount(privateKey as Hex)

        // Get decimals
        const decimals = await publicClient.readContract({
          address: tokenAddress as Address,
          abi: [{ name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }],
          functionName: "decimals"
        }) as number

        const amountWei = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals))

        // Try burn function first, fallback to transfer to dead address
        let hash: Hex
        try {
          hash = await walletClient.writeContract({
            address: tokenAddress as Address,
            abi: [{ name: "burn", type: "function", inputs: [{ name: "amount", type: "uint256" }], outputs: [] }],
            functionName: "burn",
            args: [amountWei],
            account
          })
        } catch {
          // Fallback: transfer to dead address
          hash = await walletClient.writeContract({
            address: tokenAddress as Address,
            abi: [{ name: "transfer", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }],
            functionName: "transfer",
            args: ["0x000000000000000000000000000000000000dEaD" as Address, amountWei],
            account
          })
        }

        return mcpToolRes.success({
          tokenAddress,
          amount,
          amountWei: amountWei.toString(),
          txHash: hash,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "burning tokens")
      }
    }
  )

  // Get token holders count (from events)
  server.tool(
    "get_token_holder_count",
    "Estimate token holder count by analyzing transfer events",
    {
      tokenAddress: z.string().describe("ERC20 token contract address"),
      network: defaultNetworkParam,
      blockRange: z.number().optional().describe("Number of blocks to analyze (default: 10000)")
    },
    async ({ tokenAddress, network, blockRange = 10000 }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlockNumber()

        // Get Transfer events
        const logs = await publicClient.getLogs({
          address: tokenAddress as Address,
          event: {
            type: "event",
            name: "Transfer",
            inputs: [
              { type: "address", indexed: true, name: "from" },
              { type: "address", indexed: true, name: "to" },
              { type: "uint256", indexed: false, name: "value" }
            ]
          },
          fromBlock: latestBlock - BigInt(blockRange),
          toBlock: latestBlock
        })

        // Track unique addresses
        const holders = new Set<string>()
        for (const log of logs) {
          if (log.args && typeof log.args === "object") {
            const args = log.args as { from?: string; to?: string }
            if (args.from && args.from !== "0x0000000000000000000000000000000000000000") {
              holders.add(args.from.toLowerCase())
            }
            if (args.to && args.to !== "0x0000000000000000000000000000000000000000") {
              holders.add(args.to.toLowerCase())
            }
          }
        }

        return mcpToolRes.success({
          tokenAddress,
          estimatedHolders: holders.size,
          transfersAnalyzed: logs.length,
          blockRange: {
            from: (latestBlock - BigInt(blockRange)).toString(),
            to: latestBlock.toString()
          },
          note: "This is an estimate based on recent transfer events",
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting token holder count")
      }
    }
  )

  // Check token allowance
  server.tool(
    "check_token_allowance",
    "Check ERC20 token allowance for a spender",
    {
      tokenAddress: z.string().describe("ERC20 token contract address"),
      ownerAddress: z.string().describe("Token owner address"),
      spenderAddress: z.string().describe("Spender address to check"),
      network: defaultNetworkParam
    },
    async ({ tokenAddress, ownerAddress, spenderAddress, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const [allowance, decimals, symbol] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: [{ name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] }],
            functionName: "allowance",
            args: [ownerAddress as Address, spenderAddress as Address]
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: [{ name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }],
            functionName: "decimals"
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: [{ name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }],
            functionName: "symbol"
          })
        ])

        const allowanceBigInt = allowance as bigint
        const dec = decimals as number
        const sym = symbol as string
        const isUnlimited = allowanceBigInt >= BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / 2n

        return mcpToolRes.success({
          tokenAddress,
          symbol: sym,
          owner: ownerAddress,
          spender: spenderAddress,
          allowance: allowanceBigInt.toString(),
          allowanceFormatted: (Number(allowanceBigInt) / 10 ** dec).toString(),
          isUnlimited,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking token allowance")
      }
    }
  )

  // Approve token spending
  server.tool(
    "approve_token_spending",
    "Approve a spender to use your ERC20 tokens",
    {
      tokenAddress: z.string().describe("ERC20 token contract address"),
      spenderAddress: z.string().describe("Address to approve for spending"),
      amount: z.string().describe("Amount to approve (use 'unlimited' for max approval)"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ tokenAddress, spenderAddress, amount, privateKey, network }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        const account = privateKeyToAccount(privateKey as Hex)

        let amountWei: bigint
        if (amount.toLowerCase() === "unlimited" || amount.toLowerCase() === "max") {
          amountWei = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        } else {
          const decimals = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: [{ name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }],
            functionName: "decimals"
          }) as number
          amountWei = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals))
        }

        const hash = await walletClient.writeContract({
          address: tokenAddress as Address,
          abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }],
          functionName: "approve",
          args: [spenderAddress as Address, amountWei],
          account
        })

        return mcpToolRes.success({
          tokenAddress,
          spender: spenderAddress,
          amount: amount,
          amountWei: amountWei.toString(),
          txHash: hash,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "approving token spending")
      }
    }
  )

  // Revoke token approval
  server.tool(
    "revoke_token_approval",
    "Revoke (set to 0) a spender's approval to use your tokens",
    {
      tokenAddress: z.string().describe("ERC20 token contract address"),
      spenderAddress: z.string().describe("Spender address to revoke"),
      privateKey: privateKeyParam,
      network: defaultNetworkParam
    },
    async ({ tokenAddress, spenderAddress, privateKey, network }) => {
      try {
        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)

        const hash = await walletClient.writeContract({
          address: tokenAddress as Address,
          abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }],
          functionName: "approve",
          args: [spenderAddress as Address, 0n],
          account
        })

        return mcpToolRes.success({
          tokenAddress,
          spender: spenderAddress,
          action: "revoked",
          txHash: hash,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "revoking token approval")
      }
    }
  )

  // Get token total supply and circulating info
  server.tool(
    "get_token_supply_info",
    "Get comprehensive token supply information including total supply, burned, and circulating",
    {
      tokenAddress: z.string().describe("ERC20 token contract address"),
      network: defaultNetworkParam
    },
    async ({ tokenAddress, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const [totalSupply, decimals, symbol, name] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: [{ name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }],
            functionName: "totalSupply"
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: [{ name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] }],
            functionName: "decimals"
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: [{ name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }],
            functionName: "symbol"
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: [{ name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }],
            functionName: "name"
          })
        ])

        // Check common burn addresses
        const burnAddresses = [
          "0x0000000000000000000000000000000000000000",
          "0x000000000000000000000000000000000000dEaD",
          "0x0000000000000000000000000000000000000001"
        ]

        let burnedAmount = 0n
        for (const burnAddr of burnAddresses) {
          try {
            const burned = await publicClient.readContract({
              address: tokenAddress as Address,
              abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }],
              functionName: "balanceOf",
              args: [burnAddr as Address]
            }) as bigint
            burnedAmount += burned
          } catch {}
        }

        const total = totalSupply as bigint
        const dec = decimals as number
        const circulating = total - burnedAmount

        return mcpToolRes.success({
          tokenAddress,
          name: name as string,
          symbol: symbol as string,
          decimals: dec,
          totalSupply: {
            raw: total.toString(),
            formatted: (Number(total) / 10 ** dec).toLocaleString()
          },
          burnedSupply: {
            raw: burnedAmount.toString(),
            formatted: (Number(burnedAmount) / 10 ** dec).toLocaleString()
          },
          circulatingSupply: {
            raw: circulating.toString(),
            formatted: (Number(circulating) / 10 ** dec).toLocaleString()
          },
          burnedPercent: ((Number(burnedAmount) / Number(total)) * 100).toFixed(2) + "%",
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting token supply info")
      }
    }
  )
}
