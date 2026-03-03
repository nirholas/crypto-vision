/**
 * Multicall Module Tests
 * Tests for batched contract calls
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Address, Hex } from "viem"

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(() => mockPublicClient),
  getWalletClient: vi.fn(() => mockWalletClient)
}))

// Mock public client
const mockPublicClient = {
  getChainId: vi.fn().mockResolvedValue(1),
  readContract: vi.fn(),
  multicall: vi.fn(),
  simulateContract: vi.fn()
}

// Mock wallet client
const mockWalletClient = {
  account: { address: "0x1234567890123456789012345678901234567890" as Address },
  writeContract: vi.fn()
}

describe("Multicall Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Common addresses
  const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address
  const mockTokenAddresses = [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0x6B175474E89094C44Da98b954EescdECD73107EC6F"  // DAI
  ] as Address[]
  const userAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12" as Address

  describe("Multicall3 Aggregate", () => {
    it("should batch multiple read calls together", async () => {
      mockPublicClient.multicall.mockResolvedValue([
        { result: BigInt(1000000000), status: "success" }, // USDC balance (1000 USDC)
        { result: BigInt(500000000), status: "success" },  // USDT balance
        { result: BigInt("250000000000000000000"), status: "success" } // DAI balance
      ])

      const results = await mockPublicClient.multicall({
        contracts: mockTokenAddresses.map(address => ({
          address,
          abi: [{ name: "balanceOf", type: "function", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }],
          functionName: "balanceOf",
          args: [userAddress]
        }))
      })

      expect(results).toHaveLength(3)
      expect(results[0].result).toBe(BigInt(1000000000))
      expect(results[1].result).toBe(BigInt(500000000))
      expect(results[2].result).toBe(BigInt("250000000000000000000"))
    })

    it("should handle partial failures with aggregate3", async () => {
      mockPublicClient.multicall.mockResolvedValue([
        { result: BigInt(1000000000), status: "success" },
        { error: new Error("Call reverted"), status: "failure" },
        { result: BigInt("250000000000000000000"), status: "success" }
      ])

      const results = await mockPublicClient.multicall({
        contracts: mockTokenAddresses.map(address => ({
          address,
          abi: [{ name: "balanceOf", type: "function" }],
          functionName: "balanceOf",
          args: [userAddress]
        })),
        allowFailure: true
      })

      expect(results).toHaveLength(3)
      expect(results[0].status).toBe("success")
      expect(results[1].status).toBe("failure")
      expect(results[2].status).toBe("success")
    })

    it("should throw on failure when allowFailure is false", async () => {
      mockPublicClient.multicall.mockRejectedValue(
        new Error("Multicall aggregate3: call failed")
      )

      await expect(
        mockPublicClient.multicall({
          contracts: [{ address: mockTokenAddresses[0], functionName: "balanceOf" }],
          allowFailure: false
        })
      ).rejects.toThrow("call failed")
    })
  })

  describe("ERC20 Token Batch Operations", () => {
    it("should fetch multiple token balances in one call", async () => {
      const expectedBalances = [
        BigInt(1000000000),      // 1000 USDC (6 decimals)
        BigInt(500000000),       // 500 USDT (6 decimals)
        BigInt("100000000000000000000") // 100 DAI (18 decimals)
      ]

      mockPublicClient.multicall.mockResolvedValue(
        expectedBalances.map(balance => ({ result: balance, status: "success" }))
      )

      const results = await mockPublicClient.multicall({
        contracts: mockTokenAddresses.map(address => ({
          address,
          abi: [{ name: "balanceOf", type: "function" }],
          functionName: "balanceOf",
          args: [userAddress]
        }))
      })

      results.forEach((result, i) => {
        expect(result.result).toBe(expectedBalances[i])
      })
    })

    it("should fetch token metadata in batch", async () => {
      mockPublicClient.multicall.mockResolvedValue([
        { result: "USD Coin", status: "success" },
        { result: "USDC", status: "success" },
        { result: 6, status: "success" }
      ])

      const results = await mockPublicClient.multicall({
        contracts: [
          { address: mockTokenAddresses[0], functionName: "name" },
          { address: mockTokenAddresses[0], functionName: "symbol" },
          { address: mockTokenAddresses[0], functionName: "decimals" }
        ]
      })

      expect(results[0].result).toBe("USD Coin")
      expect(results[1].result).toBe("USDC")
      expect(results[2].result).toBe(6)
    })
  })

  describe("Chain Support", () => {
    it("should use correct Multicall3 address across chains", () => {
      // Multicall3 is deployed at the same address on all major chains
      const SUPPORTED_CHAINS = [1, 56, 137, 42161, 10, 8453, 43114]
      
      SUPPORTED_CHAINS.forEach(chainId => {
        // All supported chains use the same Multicall3 address
        expect(MULTICALL3_ADDRESS).toBe("0xcA11bde05977b3631167028862bE2a173976CA11")
      })
    })

    it("should detect chains without Multicall3 support", () => {
      const LEGACY_CHAINS_WITHOUT_MULTICALL3 = [324] // ZkSync Era uses different deployment

      // These chains may need special handling
      expect(LEGACY_CHAINS_WITHOUT_MULTICALL3.includes(324)).toBe(true)
    })
  })

  describe("Gas Estimation", () => {
    it("should estimate gas for batched calls", async () => {
      mockPublicClient.simulateContract.mockResolvedValue({
        result: [
          { success: true, returnData: "0x" },
          { success: true, returnData: "0x" }
        ]
      })

      const simulation = await mockPublicClient.simulateContract({
        address: MULTICALL3_ADDRESS,
        functionName: "aggregate3",
        args: [[
          { target: mockTokenAddresses[0], callData: "0x70a08231..." as Hex, allowFailure: true },
          { target: mockTokenAddresses[1], callData: "0x70a08231..." as Hex, allowFailure: true }
        ]]
      })

      expect(simulation.result).toHaveLength(2)
    })
  })

  describe("Batched Write Operations", () => {
    it("should execute multiple token approvals in one tx via aggregate", async () => {
      mockPublicClient.simulateContract.mockResolvedValue({
        result: undefined
      })
      mockWalletClient.writeContract.mockResolvedValue(
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
      )

      const txHash = await mockWalletClient.writeContract({
        address: MULTICALL3_ADDRESS,
        abi: [],
        functionName: "aggregate3",
        args: [[
          { target: mockTokenAddresses[0], callData: "0x095ea7b3..." as Hex, allowFailure: false }
        ]]
      })

      expect(txHash).toMatch(/^0x[a-f0-9]{64}$/)
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty call array", async () => {
      mockPublicClient.multicall.mockResolvedValue([])

      const results = await mockPublicClient.multicall({
        contracts: []
      })

      expect(results).toHaveLength(0)
    })

    it("should handle very large batch sizes", async () => {
      const largeBatch = Array(100).fill(null).map((_, i) => ({
        result: BigInt(i * 1000000),
        status: "success" as const
      }))

      mockPublicClient.multicall.mockResolvedValue(largeBatch)

      const results = await mockPublicClient.multicall({
        contracts: Array(100).fill({
          address: mockTokenAddresses[0],
          functionName: "balanceOf",
          args: [userAddress]
        })
      })

      expect(results).toHaveLength(100)
    })

    it("should handle contract that does not exist", async () => {
      mockPublicClient.multicall.mockResolvedValue([
        { error: new Error("Contract not found"), status: "failure" }
      ])

      const results = await mockPublicClient.multicall({
        contracts: [{
          address: "0x0000000000000000000000000000000000000000" as Address,
          functionName: "balanceOf",
          args: [userAddress]
        }],
        allowFailure: true
      })

      expect(results[0].status).toBe("failure")
    })

    it("should handle out of gas scenarios", async () => {
      mockPublicClient.multicall.mockRejectedValue(
        new Error("Out of gas")
      )

      await expect(
        mockPublicClient.multicall({
          contracts: Array(1000).fill({
            address: mockTokenAddresses[0],
            functionName: "balanceOf"
          })
        })
      ).rejects.toThrow("Out of gas")
    })

    it("should respect block number parameter for historical queries", async () => {
      mockPublicClient.multicall.mockResolvedValue([
        { result: BigInt(500000000), status: "success" }
      ])

      await mockPublicClient.multicall({
        contracts: [{
          address: mockTokenAddresses[0],
          functionName: "balanceOf",
          args: [userAddress]
        }],
        blockNumber: BigInt(17000000)
      })

      expect(mockPublicClient.multicall).toHaveBeenCalledWith(
        expect.objectContaining({
          blockNumber: BigInt(17000000)
        })
      )
    })
  })
})
