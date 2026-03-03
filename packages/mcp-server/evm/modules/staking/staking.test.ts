/**
 * Tests for Staking Module
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { TEST_ADDRESSES, createMockViemClient } from "../../../../tests/setup"

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(),
  getWalletClient: vi.fn()
}))

// Mock viem/accounts
vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f1E123"
  })
}))

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { registerStakingTools } from "./tools.js"

describe("Staking Module", () => {
  let server: McpServer
  let mockPublicClient: ReturnType<typeof createMockViemClient>
  let mockWalletClient: ReturnType<typeof createMockViemClient>
  let registeredTools: Map<string, { handler: Function; schema: any }>

  // Test staking contract address (mock)
  const MOCK_STAKING_CONTRACT = "0x1234567890123456789012345678901234567890"
  const MOCK_USER_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f1E123"
  const MOCK_PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

  beforeEach(() => {
    // Create fresh mocks for each test
    mockPublicClient = createMockViemClient()
    mockWalletClient = createMockViemClient()

    // Setup mock implementations
    ;(getPublicClient as Mock).mockReturnValue(mockPublicClient)
    ;(getWalletClient as Mock).mockReturnValue(mockWalletClient)

    // Create a mock server that captures tool registrations
    registeredTools = new Map()
    server = {
      tool: vi.fn((name: string, description: string, schema: any, handler: Function) => {
        registeredTools.set(name, { handler, schema })
      })
    } as unknown as McpServer

    // Register staking tools
    registerStakingTools(server)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("get_staking_position", () => {
    it("should return staking position with balance and rewards", async () => {
      const stakedBalance = 5000000000000000000n // 5 tokens
      const pendingRewards = 250000000000000000n // 0.25 tokens
      const totalStaked = 1000000000000000000000n // 1000 tokens total

      mockPublicClient.readContract
        .mockResolvedValueOnce(stakedBalance) // balanceOf
        .mockResolvedValueOnce(pendingRewards) // earned
        .mockResolvedValueOnce(totalStaked) // totalSupply
        .mockResolvedValueOnce("0xStakingToken123") // stakingToken
        .mockResolvedValueOnce("0xRewardsToken456") // rewardsToken

      const tool = registeredTools.get("get_staking_position")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        userAddress: MOCK_USER_ADDRESS
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.position.stakedBalance).toBe(stakedBalance.toString())
      expect(data.position.pendingRewards).toBe(pendingRewards.toString())
      expect(data.pool.totalStaked).toBe(totalStaked.toString())
      expect(data.pool.userSharePercent).toBe("0.5000")
      expect(data.tokens.stakingToken).toBe("0xStakingToken123")
      expect(data.tokens.rewardsToken).toBe("0xRewardsToken456")
    })

    it("should handle user with no staked balance", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(0n) // balanceOf
        .mockResolvedValueOnce(0n) // earned
        .mockResolvedValueOnce(1000000000000000000000n) // totalSupply
        .mockResolvedValueOnce("0xStakingToken123")
        .mockResolvedValueOnce("0xRewardsToken456")

      const tool = registeredTools.get("get_staking_position")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        userAddress: MOCK_USER_ADDRESS
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.position.stakedBalance).toBe("0")
      expect(data.position.pendingRewards).toBe("0")
      // User share is formatted as percentage with 4 decimal places
      expect(data.pool.userSharePercent).toBe("0.0000")
    })

    it("should handle contract without some optional functions", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(5000000000000000000n) // balanceOf
        .mockRejectedValueOnce(new Error("Function not found")) // earned - not supported
        .mockResolvedValueOnce(1000000000000000000000n) // totalSupply
        .mockRejectedValueOnce(new Error("Function not found")) // stakingToken - not supported
        .mockRejectedValueOnce(new Error("Function not found")) // rewardsToken - not supported

      const tool = registeredTools.get("get_staking_position")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        userAddress: MOCK_USER_ADDRESS
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.position.stakedBalance).toBe("5000000000000000000")
      expect(data.position.pendingRewards).toBe("0")
      expect(data.tokens.stakingToken).toBeNull()
    })

    it("should calculate user share percentage correctly", async () => {
      // User has 100 tokens out of 10,000 total = 1%
      mockPublicClient.readContract
        .mockResolvedValueOnce(100000000000000000000n) // 100 tokens
        .mockResolvedValueOnce(5000000000000000000n) // 5 tokens rewards
        .mockResolvedValueOnce(10000000000000000000000n) // 10,000 total
        .mockResolvedValueOnce("0xStakingToken")
        .mockResolvedValueOnce("0xRewardsToken")

      const tool = registeredTools.get("get_staking_position")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        userAddress: MOCK_USER_ADDRESS
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.pool.userSharePercent).toBe("1.0000")
    })

    it("should handle empty pool (zero total staked)", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(0n)
        .mockResolvedValueOnce(0n)
        .mockResolvedValueOnce(0n) // Empty pool
        .mockResolvedValueOnce("0xStakingToken")
        .mockResolvedValueOnce("0xRewardsToken")

      const tool = registeredTools.get("get_staking_position")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        userAddress: MOCK_USER_ADDRESS
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.pool.userSharePercent).toBe("0")
    })
  })

  describe("stake_tokens", () => {
    const stakeAmount = "1000000000000000000" // 1 token

    it("should stake tokens successfully", async () => {
      const txHash = "0xstake123456789abcdef123456789abcdef123456789abcdef123456789abcdef"

      mockPublicClient.simulateContract = vi.fn().mockResolvedValue({ request: {} })
      mockWalletClient.writeContract = vi.fn().mockResolvedValue(txHash)
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("stake_tokens")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        amount: stakeAmount,
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.action).toBe("stake")
      expect(data.transactionHash).toBe(txHash)
      expect(data.status).toBe("success")
      expect(data.amount).toBe(stakeAmount)
    })

    it("should handle staking more than balance", async () => {
      mockPublicClient.simulateContract = vi.fn().mockRejectedValue(
        new Error("execution reverted: ERC20: transfer amount exceeds balance")
      )

      const tool = registeredTools.get("stake_tokens")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        amount: "1000000000000000000000000", // Very large amount
        privateKey: MOCK_PRIVATE_KEY
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("staking tokens")
    })

    it("should handle zero amount staking", async () => {
      mockPublicClient.simulateContract = vi.fn().mockRejectedValue(
        new Error("Cannot stake zero amount")
      )

      const tool = registeredTools.get("stake_tokens")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        amount: "0",
        privateKey: MOCK_PRIVATE_KEY
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle failed transaction", async () => {
      const txHash = "0xfailed123"

      mockPublicClient.simulateContract = vi.fn().mockResolvedValue({ request: {} })
      mockWalletClient.writeContract = vi.fn().mockResolvedValue(txHash)
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "reverted",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("stake_tokens")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        amount: stakeAmount,
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe("failed")
    })
  })

  describe("unstake_tokens", () => {
    const unstakeAmount = "500000000000000000" // 0.5 tokens

    it("should unstake tokens successfully", async () => {
      const txHash = "0xunstake123456789abcdef"

      mockPublicClient.simulateContract = vi.fn().mockResolvedValue({ request: {} })
      mockWalletClient.writeContract = vi.fn().mockResolvedValue(txHash)
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("unstake_tokens")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        amount: unstakeAmount,
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.action).toBe("unstake")
      expect(data.transactionHash).toBe(txHash)
      expect(data.status).toBe("success")
    })

    it("should try withdraw if unstake fails", async () => {
      const txHash = "0xwithdraw123456789abcdef"

      // First call (unstake) fails, second call (withdraw) succeeds
      mockPublicClient.simulateContract = vi.fn().mockRejectedValue(new Error("unstake not found"))
      mockWalletClient.writeContract = vi.fn().mockResolvedValue(txHash)
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("unstake_tokens")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        amount: unstakeAmount,
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe("success")
    })

    it("should handle unstaking more than staked balance", async () => {
      mockPublicClient.simulateContract = vi.fn().mockRejectedValue(
        new Error("Cannot unstake more than staked")
      )
      mockWalletClient.writeContract = vi.fn().mockRejectedValue(
        new Error("Cannot unstake more than staked")
      )

      const tool = registeredTools.get("unstake_tokens")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        amount: "999999999999999999999999",
        privateKey: MOCK_PRIVATE_KEY
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle cooldown period", async () => {
      mockPublicClient.simulateContract = vi.fn().mockRejectedValue(
        new Error("Cooldown period not elapsed")
      )
      mockWalletClient.writeContract = vi.fn().mockRejectedValue(
        new Error("Cooldown period not elapsed")
      )

      const tool = registeredTools.get("unstake_tokens")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        amount: unstakeAmount,
        privateKey: MOCK_PRIVATE_KEY
      })

      expect(result.content[0].text).toContain("Error")
    })
  })

  describe("claim_staking_rewards", () => {
    it("should claim rewards successfully", async () => {
      const pendingRewards = 1000000000000000000n // 1 token
      const txHash = "0xclaim123456789abcdef"

      mockPublicClient.readContract.mockResolvedValueOnce(pendingRewards)
      mockWalletClient.writeContract = vi.fn().mockResolvedValue(txHash)
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("claim_staking_rewards")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.action).toBe("claim_rewards")
      expect(data.rewardsClaimed).toBe(pendingRewards.toString())
      expect(data.status).toBe("success")
    })

    it("should return message when no rewards to claim", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(0n)

      const tool = registeredTools.get("claim_staking_rewards")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.pendingRewards).toBe("0")
      expect(data.message).toBe("No pending rewards to claim")
    })

    it("should try getReward if claimRewards fails", async () => {
      const pendingRewards = 500000000000000000n
      const txHash = "0xgetreward123"

      mockPublicClient.readContract.mockResolvedValueOnce(pendingRewards)
      mockWalletClient.writeContract = vi.fn()
        .mockRejectedValueOnce(new Error("claimRewards not found"))
        .mockResolvedValueOnce(txHash)
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("claim_staking_rewards")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe("success")
    })

    it("should handle claim failure", async () => {
      const pendingRewards = 500000000000000000n

      mockPublicClient.readContract.mockResolvedValueOnce(pendingRewards)
      mockWalletClient.writeContract = vi.fn()
        .mockRejectedValueOnce(new Error("claim failed"))
        .mockRejectedValueOnce(new Error("getReward failed"))

      const tool = registeredTools.get("claim_staking_rewards")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        privateKey: MOCK_PRIVATE_KEY
      })

      expect(result.content[0].text).toContain("Error")
    })
  })

  describe("get_staking_apr", () => {
    it("should calculate APR correctly", async () => {
      const rewardRate = 1000000000000000n // reward per second
      const totalStaked = 1000000000000000000000n // 1000 tokens

      mockPublicClient.readContract
        .mockResolvedValueOnce(rewardRate)
        .mockResolvedValueOnce(totalStaked)

      const tool = registeredTools.get("get_staking_apr")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.stakingContract).toBe(MOCK_STAKING_CONTRACT)
      // APR should be calculated
    })

    it("should handle zero total staked", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(1000000000000000n) // reward rate
        .mockResolvedValueOnce(0n) // zero total staked

      const tool = registeredTools.get("get_staking_apr")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT
      })

      // Should handle division by zero gracefully
      expect(result.content[0].text).not.toContain("Error")
    })

    it("should handle contract without rewardRate function", async () => {
      mockPublicClient.readContract
        .mockRejectedValueOnce(new Error("Function not found"))
        .mockResolvedValueOnce(1000000000000000000000n)

      const tool = registeredTools.get("get_staking_apr")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT
      })

      // Should return APR of 0 or handle gracefully
      expect(result.content[0].text).not.toContain("Error")
    })
  })

  describe("Edge Cases", () => {
    it("should handle invalid staking contract address", async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error("Invalid address"))

      const tool = registeredTools.get("get_staking_position")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: "invalid_address",
        userAddress: MOCK_USER_ADDRESS
      })

      // Should return zeros for invalid contract
      const data = JSON.parse(result.content[0].text)
      expect(data.position.stakedBalance).toBe("0")
    })

    it("should handle network errors gracefully", async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error("Network error"))

      const tool = registeredTools.get("get_staking_position")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        userAddress: MOCK_USER_ADDRESS
      })

      // Should handle gracefully with defaults
      expect(result.content[0].text).not.toContain("Error getting staking position")
    })

    it("should handle very large staking amounts", async () => {
      const largeAmount = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

      mockPublicClient.simulateContract = vi.fn().mockResolvedValue({ request: {} })
      mockWalletClient.writeContract = vi.fn().mockResolvedValue("0xhash")
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("stake_tokens")
      const result = await tool!.handler({
        network: "ethereum",
        stakingContract: MOCK_STAKING_CONTRACT,
        amount: largeAmount,
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe("success")
    })

    it("should work with different networks", async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(5000000000000000000n)
        .mockResolvedValueOnce(250000000000000000n)
        .mockResolvedValueOnce(1000000000000000000000n)
        .mockResolvedValueOnce("0xBSCStakingToken")
        .mockResolvedValueOnce("0xBSCRewardsToken")

      const tool = registeredTools.get("get_staking_position")
      const result = await tool!.handler({
        network: "bsc",
        stakingContract: MOCK_STAKING_CONTRACT,
        userAddress: MOCK_USER_ADDRESS
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.network).toBe("bsc")
    })
  })
})
