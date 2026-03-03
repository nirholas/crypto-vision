import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { formatUnits, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam, privateKeyParam } from "../common/types.js"

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
}
