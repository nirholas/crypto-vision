/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { formatUnits, parseUnits, parseEther, formatEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam, privateKeyParam } from "../common/types.js"

// Lido stETH ABI
const LIDO_STETH_ABI = [
  {
    name: "submit",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "_referral", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getPooledEthByShares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_sharesAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getSharesByPooledEth",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_ethAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getTotalPooledEther",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getTotalShares",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const

// wstETH ABI
const WSTETH_ABI = [
  {
    name: "wrap",
    type: "function",
    inputs: [{ name: "_stETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "unwrap",
    type: "function",
    inputs: [{ name: "_wstETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getStETHByWstETH",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_wstETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getWstETHByStETH",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_stETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "stEthPerToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "tokensPerStEth",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const

// LP Farming ABI (MasterChef style)
const MASTERCHEF_ABI = [
  {
    name: "deposit",
    type: "function",
    inputs: [
      { name: "_pid", type: "uint256" },
      { name: "_amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [
      { name: "_pid", type: "uint256" },
      { name: "_amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "pendingReward",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_pid", type: "uint256" },
      { name: "_user", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "userInfo",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_pid", type: "uint256" },
      { name: "_user", type: "address" }
    ],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "rewardDebt", type: "uint256" }
    ]
  },
  {
    name: "poolInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_pid", type: "uint256" }],
    outputs: [
      { name: "lpToken", type: "address" },
      { name: "allocPoint", type: "uint256" },
      { name: "lastRewardBlock", type: "uint256" },
      { name: "accRewardPerShare", type: "uint256" }
    ]
  },
  {
    name: "poolLength",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "totalAllocPoint",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const

// Liquid staking addresses
const LIQUID_STAKING: Record<number, Record<string, Address>> = {
  1: { // Ethereum
    stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    rETH: "0xae78736Cd615f374D3085123A210448E74Fc6393"
  },
  42161: { // Arbitrum
    wstETH: "0x5979D7b546E38E414F7E9822514be443A4800529"
  },
  10: { // Optimism
    wstETH: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb"
  }
}

// Common staking contract interfaces
const STAKING_ABI = [
  {
    name: "stake",
    type: "function",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    name: "unstake",
    type: "function",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [],
    outputs: []
  },
  {
    name: "claimRewards",
    type: "function",
    inputs: [],
    outputs: []
  },
  {
    name: "getReward",
    type: "function",
    inputs: [],
    outputs: []
  },
  {
    name: "earned",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "rewardRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "rewardPerToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "stakingToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "rewardsToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
] as const

// Popular staking protocols
const STAKING_PROTOCOLS: Record<number, Record<string, Address>> = {
  1: { // Ethereum
    "Lido stETH": "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    "Rocket Pool": "0x9559Aaa82d9649C7A7b220E7c461d2E74c9a3593"
  },
  56: { // BSC
    "PancakeSwap": "0x45c54210128a065de780C4B0Df3d16664f7f859e"
  },
  42161: { // Arbitrum
    "GMX Staking": "0xd2D1162512F927a7e282Ef43a362659E4F2a728F"
  }
}

export function registerStakingTools(server: McpServer) {
  // Get staking position
  server.tool(
    "get_staking_position",
    "Get staking position and rewards for an address",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address"),
      userAddress: z.string().describe("User address to check")
    },
    async ({ network, stakingContract, userAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        
        // Get staked balance
        let stakedBalance = 0n
        try {
          stakedBalance = await publicClient.readContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "balanceOf",
            args: [userAddress as Address]
          })
        } catch {}

        // Get pending rewards
        let pendingRewards = 0n
        try {
          pendingRewards = await publicClient.readContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "earned",
            args: [userAddress as Address]
          })
        } catch {}

        // Get total staked
        let totalStaked = 0n
        try {
          totalStaked = await publicClient.readContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "totalSupply"
          })
        } catch {}

        // Get staking token
        let stakingToken = null
        try {
          stakingToken = await publicClient.readContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "stakingToken"
          })
        } catch {}

        // Get rewards token
        let rewardsToken = null
        try {
          rewardsToken = await publicClient.readContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "rewardsToken"
          })
        } catch {}

        const shareOfPool = totalStaked > 0n 
          ? (Number(stakedBalance) / Number(totalStaked) * 100).toFixed(4)
          : "0"

        return mcpToolRes.success({
          network,
          stakingContract,
          userAddress,
          position: {
            stakedBalance: stakedBalance.toString(),
            stakedFormatted: formatUnits(stakedBalance, 18),
            pendingRewards: pendingRewards.toString(),
            rewardsFormatted: formatUnits(pendingRewards, 18)
          },
          pool: {
            totalStaked: totalStaked.toString(),
            totalStakedFormatted: formatUnits(totalStaked, 18),
            userSharePercent: shareOfPool
          },
          tokens: {
            stakingToken,
            rewardsToken
          }
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting staking position")
      }
    }
  )

  // Stake tokens
  server.tool(
    "stake_tokens",
    "Stake tokens in a staking contract",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address"),
      amount: z.string().describe("Amount to stake (in wei)"),
      privateKey: privateKeyParam
    },
    async ({ network, stakingContract, amount, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey as Hex)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)

        // Simulate first
        await publicClient.simulateContract({
          address: stakingContract as Address,
          abi: STAKING_ABI,
          functionName: "stake",
          args: [BigInt(amount)],
          account
        })

        const hash = await walletClient.writeContract({
          address: stakingContract as Address,
          abi: STAKING_ABI,
          functionName: "stake",
          args: [BigInt(amount)],
          account
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          action: "stake",
          stakingContract,
          amount,
          amountFormatted: formatUnits(BigInt(amount), 18),
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed",
          blockNumber: receipt.blockNumber.toString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "staking tokens")
      }
    }
  )

  // Unstake tokens
  server.tool(
    "unstake_tokens",
    "Unstake/withdraw tokens from a staking contract",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address"),
      amount: z.string().describe("Amount to unstake (in wei)"),
      privateKey: privateKeyParam
    },
    async ({ network, stakingContract, amount, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey as Hex)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)

        // Try unstake first, then withdraw if that fails
        let hash: Hex
        try {
          await publicClient.simulateContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "unstake",
            args: [BigInt(amount)],
            account
          })

          hash = await walletClient.writeContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "unstake",
            args: [BigInt(amount)],
            account
          })
        } catch {
          // Try withdraw instead
          hash = await walletClient.writeContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "withdraw",
            account
          })
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          action: "unstake",
          stakingContract,
          amount,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        })
      } catch (error) {
        return mcpToolRes.error(error, "unstaking tokens")
      }
    }
  )

  // Claim rewards
  server.tool(
    "claim_staking_rewards",
    "Claim pending staking rewards",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address"),
      privateKey: privateKeyParam
    },
    async ({ network, stakingContract, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey as Hex)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)

        // Check pending rewards first
        let pendingRewards = 0n
        try {
          pendingRewards = await publicClient.readContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "earned",
            args: [account.address]
          })
        } catch {}

        if (pendingRewards === 0n) {
          return mcpToolRes.success({
            network,
            action: "claim_rewards",
            stakingContract,
            pendingRewards: "0",
            message: "No pending rewards to claim"
          })
        }

        // Try different claim functions
        let hash: Hex
        try {
          hash = await walletClient.writeContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "claimRewards",
            account
          })
        } catch {
          hash = await walletClient.writeContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "getReward",
            account
          })
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          action: "claim_rewards",
          stakingContract,
          rewardsClaimed: pendingRewards.toString(),
          rewardsFormatted: formatUnits(pendingRewards, 18),
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        })
      } catch (error) {
        return mcpToolRes.error(error, "claiming rewards")
      }
    }
  )

  // Get staking APR
  server.tool(
    "get_staking_apr",
    "Calculate estimated APR for a staking contract",
    {
      network: defaultNetworkParam,
      stakingContract: z.string().describe("Staking contract address")
    },
    async ({ network, stakingContract }) => {
      try {
        const publicClient = getPublicClient(network)
        
        // Get reward rate
        let rewardRate = 0n
        try {
          rewardRate = await publicClient.readContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "rewardRate"
          })
        } catch {}

        // Get total staked
        let totalStaked = 0n
        try {
          totalStaked = await publicClient.readContract({
            address: stakingContract as Address,
            abi: STAKING_ABI,
            functionName: "totalSupply"
          })
        } catch {}

        // Calculate APR (simplified - assumes 1:1 token value)
        // APR = (rewardRate * secondsPerYear / totalStaked) * 100
        const secondsPerYear = 365n * 24n * 60n * 60n
        let apr = "0"
        
        if (totalStaked > 0n && rewardRate > 0n) {
          const yearlyRewards = rewardRate * secondsPerYear
          apr = ((Number(yearlyRewards) / Number(totalStaked)) * 100).toFixed(2)
        }

        return mcpToolRes.success({
          network,
          stakingContract,
          rewardRate: rewardRate.toString(),
          rewardRatePerSecond: formatUnits(rewardRate, 18),
          totalStaked: totalStaked.toString(),
          estimatedAPR: `${apr}%`,
          note: "APR is estimated and assumes 1:1 token value ratio"
        })
      } catch (error) {
        return mcpToolRes.error(error, "calculating staking APR")
      }
    }
  )

  // Get popular staking protocols
  server.tool(
    "get_staking_protocols",
    "Get list of popular staking protocols on a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const protocols = STAKING_PROTOCOLS[chainId] || {}

        return mcpToolRes.success({
          network,
          chainId,
          protocols: Object.entries(protocols).map(([name, address]) => ({
            name,
            address
          })),
          note: protocols.length === 0 
            ? "No pre-configured protocols for this network"
            : "Use get_staking_position to check your positions"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting staking protocols")
      }
    }
  )

  // Stake ETH via Lido (get stETH)
  server.tool(
    "stake_eth_lido",
    "Stake ETH with Lido to receive stETH (liquid staking)",
    {
      network: z.enum(["ethereum"]).default("ethereum").describe("Network (Lido only on Ethereum mainnet)"),
      amount: z.string().describe("Amount of ETH to stake"),
      privateKey: z.string().describe("Private key for signing transaction"),
      referral: z.string().optional().describe("Referral address (optional)")
    },
    async ({ network, amount, privateKey, referral }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(network, privateKey)
        const account = privateKeyToAccount(privateKey as `0x${string}`)
        const chainId = await publicClient.getChainId()

        const stETHAddress = LIQUID_STAKING[chainId]?.stETH
        if (!stETHAddress) {
          return mcpToolRes.error(new Error("Lido stETH not available on this network"), "staking ETH")
        }

        const amountWei = parseEther(amount)

        // Get stETH balance before
        const balanceBefore = await publicClient.readContract({
          address: stETHAddress,
          abi: LIDO_STETH_ABI,
          functionName: "balanceOf",
          args: [account.address]
        })

        // Submit ETH to Lido
        const hash = await walletClient.writeContract({
          address: stETHAddress,
          abi: LIDO_STETH_ABI,
          functionName: "submit",
          args: [referral as Address || "0x0000000000000000000000000000000000000000"],
          value: amountWei,
          account,
          chain: walletClient.chain
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        // Get stETH balance after
        const balanceAfter = await publicClient.readContract({
          address: stETHAddress,
          abi: LIDO_STETH_ABI,
          functionName: "balanceOf",
          args: [account.address]
        })

        const stETHReceived = balanceAfter - balanceBefore

        return mcpToolRes.success({
          network,
          action: "stake_eth_lido",
          ethStaked: amount,
          stETHReceived: formatEther(stETHReceived),
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed",
          gasUsed: receipt.gasUsed.toString(),
          stETHAddress,
          note: "stETH is a rebasing token - your balance will increase daily with staking rewards"
        })
      } catch (error) {
        return mcpToolRes.error(error, "staking ETH via Lido")
      }
    }
  )

  // Wrap stETH to wstETH
  server.tool(
    "wrap_steth",
    "Wrap stETH to wstETH (non-rebasing wrapped staked ETH)",
    {
      network: defaultNetworkParam,
      amount: z.string().describe("Amount of stETH to wrap"),
      privateKey: z.string().describe("Private key for signing transaction")
    },
    async ({ network, amount, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(network, privateKey)
        const account = privateKeyToAccount(privateKey as `0x${string}`)
        const chainId = await publicClient.getChainId()

        const wstETHAddress = LIQUID_STAKING[chainId]?.wstETH
        const stETHAddress = LIQUID_STAKING[chainId]?.stETH
        if (!wstETHAddress) {
          return mcpToolRes.error(new Error("wstETH not available on this network"), "wrapping stETH")
        }

        const amountWei = parseEther(amount)

        // First approve stETH spending (if on mainnet with stETH)
        if (stETHAddress) {
          const approveHash = await walletClient.writeContract({
            address: stETHAddress,
            abi: [{
              name: "approve",
              type: "function",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" }
              ],
              outputs: [{ name: "", type: "bool" }]
            }],
            functionName: "approve",
            args: [wstETHAddress, amountWei],
            account,
            chain: walletClient.chain
          })
          await publicClient.waitForTransactionReceipt({ hash: approveHash })
        }

        // Wrap stETH to wstETH
        const hash = await walletClient.writeContract({
          address: wstETHAddress,
          abi: WSTETH_ABI,
          functionName: "wrap",
          args: [amountWei],
          account,
          chain: walletClient.chain
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        // Calculate expected wstETH
        const expectedWstETH = await publicClient.readContract({
          address: wstETHAddress,
          abi: WSTETH_ABI,
          functionName: "getWstETHByStETH",
          args: [amountWei]
        })

        return mcpToolRes.success({
          network,
          action: "wrap_steth",
          stETHWrapped: amount,
          expectedWstETH: formatEther(expectedWstETH),
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed",
          gasUsed: receipt.gasUsed.toString(),
          wstETHAddress,
          note: "wstETH is a non-rebasing token - better for DeFi and L2s"
        })
      } catch (error) {
        return mcpToolRes.error(error, "wrapping stETH")
      }
    }
  )

  // Unwrap wstETH to stETH
  server.tool(
    "unwrap_wsteth",
    "Unwrap wstETH back to stETH",
    {
      network: defaultNetworkParam,
      amount: z.string().describe("Amount of wstETH to unwrap"),
      privateKey: z.string().describe("Private key for signing transaction")
    },
    async ({ network, amount, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(network, privateKey)
        const account = privateKeyToAccount(privateKey as `0x${string}`)
        const chainId = await publicClient.getChainId()

        const wstETHAddress = LIQUID_STAKING[chainId]?.wstETH
        if (!wstETHAddress) {
          return mcpToolRes.error(new Error("wstETH not available on this network"), "unwrapping wstETH")
        }

        const amountWei = parseEther(amount)

        // Calculate expected stETH
        const expectedStETH = await publicClient.readContract({
          address: wstETHAddress,
          abi: WSTETH_ABI,
          functionName: "getStETHByWstETH",
          args: [amountWei]
        })

        // Unwrap wstETH
        const hash = await walletClient.writeContract({
          address: wstETHAddress,
          abi: WSTETH_ABI,
          functionName: "unwrap",
          args: [amountWei],
          account,
          chain: walletClient.chain
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          action: "unwrap_wsteth",
          wstETHUnwrapped: amount,
          expectedStETH: formatEther(expectedStETH),
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed",
          gasUsed: receipt.gasUsed.toString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "unwrapping wstETH")
      }
    }
  )

  // Get Lido staking stats
  server.tool(
    "get_lido_stats",
    "Get Lido staking statistics and APR",
    {
      network: z.enum(["ethereum"]).default("ethereum").describe("Network")
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()

        const stETHAddress = LIQUID_STAKING[chainId]?.stETH
        const wstETHAddress = LIQUID_STAKING[chainId]?.wstETH
        
        if (!stETHAddress) {
          return mcpToolRes.error(new Error("Lido not available on this network"), "getting Lido stats")
        }

        // Get total pooled ETH
        const totalPooledEther = await publicClient.readContract({
          address: stETHAddress,
          abi: LIDO_STETH_ABI,
          functionName: "getTotalPooledEther"
        })

        // Get total shares
        const totalShares = await publicClient.readContract({
          address: stETHAddress,
          abi: LIDO_STETH_ABI,
          functionName: "getTotalShares"
        })

        // Get wstETH exchange rate
        let stEthPerWstETH = 0n
        if (wstETHAddress) {
          stEthPerWstETH = await publicClient.readContract({
            address: wstETHAddress,
            abi: WSTETH_ABI,
            functionName: "stEthPerToken"
          })
        }

        // Calculate share price
        const sharePrice = totalShares > 0n 
          ? (totalPooledEther * BigInt(1e18)) / totalShares 
          : 0n

        return mcpToolRes.success({
          network,
          lido: {
            totalPooledEther: formatEther(totalPooledEther),
            totalShares: totalShares.toString(),
            sharePrice: formatEther(sharePrice),
            stEthPerWstETH: formatEther(stEthPerWstETH)
          },
          contracts: {
            stETH: stETHAddress,
            wstETH: wstETHAddress
          },
          note: "Current Lido APR is approximately 3-5% (varies based on network conditions)"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting Lido stats")
      }
    }
  )

  // Stake LP tokens in farm
  server.tool(
    "stake_lp_tokens",
    "Stake LP tokens in a MasterChef-style farming contract",
    {
      network: defaultNetworkParam,
      farmContract: z.string().describe("Farm contract address (MasterChef style)"),
      poolId: z.number().describe("Pool ID to stake in"),
      amount: z.string().describe("Amount of LP tokens to stake"),
      privateKey: z.string().describe("Private key for signing transaction")
    },
    async ({ network, farmContract, poolId, amount, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(network, privateKey)
        const account = privateKeyToAccount(privateKey as `0x${string}`)

        const amountWei = parseEther(amount)

        // Get pool info
        const poolInfo = await publicClient.readContract({
          address: farmContract as Address,
          abi: MASTERCHEF_ABI,
          functionName: "poolInfo",
          args: [BigInt(poolId)]
        }) as [Address, bigint, bigint, bigint]

        const lpToken = poolInfo[0]

        // Approve LP token spending
        const approveHash = await walletClient.writeContract({
          address: lpToken,
          abi: [{
            name: "approve",
            type: "function",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" }
            ],
            outputs: [{ name: "", type: "bool" }]
          }],
          functionName: "approve",
          args: [farmContract as Address, amountWei],
          account,
          chain: walletClient.chain
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })

        // Deposit LP tokens
        const hash = await walletClient.writeContract({
          address: farmContract as Address,
          abi: MASTERCHEF_ABI,
          functionName: "deposit",
          args: [BigInt(poolId), amountWei],
          account,
          chain: walletClient.chain
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          action: "stake_lp_tokens",
          farmContract,
          poolId,
          lpToken,
          amountStaked: amount,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed",
          gasUsed: receipt.gasUsed.toString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "staking LP tokens")
      }
    }
  )

  // Withdraw LP tokens from farm
  server.tool(
    "withdraw_lp_tokens",
    "Withdraw LP tokens from a MasterChef-style farming contract",
    {
      network: defaultNetworkParam,
      farmContract: z.string().describe("Farm contract address"),
      poolId: z.number().describe("Pool ID to withdraw from"),
      amount: z.string().describe("Amount of LP tokens to withdraw"),
      privateKey: z.string().describe("Private key for signing transaction")
    },
    async ({ network, farmContract, poolId, amount, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(network, privateKey)
        const account = privateKeyToAccount(privateKey as `0x${string}`)

        const amountWei = parseEther(amount)

        // Withdraw LP tokens
        const hash = await walletClient.writeContract({
          address: farmContract as Address,
          abi: MASTERCHEF_ABI,
          functionName: "withdraw",
          args: [BigInt(poolId), amountWei],
          account,
          chain: walletClient.chain
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          action: "withdraw_lp_tokens",
          farmContract,
          poolId,
          amountWithdrawn: amount,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed",
          gasUsed: receipt.gasUsed.toString(),
          note: "Pending rewards are automatically claimed on withdraw"
        })
      } catch (error) {
        return mcpToolRes.error(error, "withdrawing LP tokens")
      }
    }
  )

  // Get farming position
  server.tool(
    "get_farming_position",
    "Get LP farming position and pending rewards",
    {
      network: defaultNetworkParam,
      farmContract: z.string().describe("Farm contract address"),
      poolId: z.number().describe("Pool ID"),
      userAddress: z.string().describe("User address to check")
    },
    async ({ network, farmContract, poolId, userAddress }) => {
      try {
        const publicClient = getPublicClient(network)

        // Get user info
        const userInfo = await publicClient.readContract({
          address: farmContract as Address,
          abi: MASTERCHEF_ABI,
          functionName: "userInfo",
          args: [BigInt(poolId), userAddress as Address]
        }) as [bigint, bigint]

        // Get pending rewards
        let pendingRewards = 0n
        try {
          pendingRewards = await publicClient.readContract({
            address: farmContract as Address,
            abi: MASTERCHEF_ABI,
            functionName: "pendingReward",
            args: [BigInt(poolId), userAddress as Address]
          }) as bigint
        } catch {
          // Some contracts use different function names
        }

        // Get pool info
        const poolInfo = await publicClient.readContract({
          address: farmContract as Address,
          abi: MASTERCHEF_ABI,
          functionName: "poolInfo",
          args: [BigInt(poolId)]
        }) as [Address, bigint, bigint, bigint]

        return mcpToolRes.success({
          network,
          farmContract,
          poolId,
          userAddress,
          position: {
            stakedAmount: formatEther(userInfo[0]),
            stakedAmountRaw: userInfo[0].toString(),
            rewardDebt: userInfo[1].toString(),
            pendingRewards: formatEther(pendingRewards),
            pendingRewardsRaw: pendingRewards.toString()
          },
          pool: {
            lpToken: poolInfo[0],
            allocPoint: poolInfo[1].toString()
          }
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting farming position")
      }
    }
  )

  // Get liquid staking info
  server.tool(
    "get_liquid_staking_info",
    "Get liquid staking token addresses and info for a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()

        const tokens = LIQUID_STAKING[chainId] || {}

        return mcpToolRes.success({
          network,
          chainId,
          liquidStakingTokens: Object.entries(tokens).map(([name, address]) => ({
            name,
            address
          })),
          protocols: [
            { name: "Lido", tokens: ["stETH", "wstETH"], description: "Largest liquid staking protocol" },
            { name: "Rocket Pool", tokens: ["rETH"], description: "Decentralized liquid staking" }
          ],
          note: tokens.length === 0 
            ? "No liquid staking tokens configured for this network"
            : "Use stake_eth_lido to stake ETH and receive stETH"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting liquid staking info")
      }
    }
  )
}
