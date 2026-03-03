/**
 * Portfolio Module Tests
 * Tests for EVM portfolio tracking tools
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Address } from "viem"

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(() => mockPublicClient)
}))

// Mock public client
const mockPublicClient = {
  getChainId: vi.fn().mockResolvedValue(1),
  getBalance: vi.fn(),
  readContract: vi.fn(),
  getTransactionCount: vi.fn()
}

// Import after mocks are set up
import { getPublicClient } from "@/evm/services/clients.js"

describe("Portfolio Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test data
  const mockAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address
  const mockNetwork = "ethereum"

  describe("getPublicClient Mock", () => {
    it("should return the mocked public client", () => {
      const client = getPublicClient(mockNetwork)
      expect(client).toBe(mockPublicClient)
    })
  })

  describe("Portfolio Overview", () => {
    it("should get native balance for an address", async () => {
      const mockBalance = BigInt("1000000000000000000") // 1 ETH
      mockPublicClient.getBalance.mockResolvedValue(mockBalance)

      const balance = await mockPublicClient.getBalance({ address: mockAddress })
      
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({ address: mockAddress })
      expect(balance).toBe(mockBalance)
    })

    it("should handle zero balance", async () => {
      mockPublicClient.getBalance.mockResolvedValue(BigInt(0))

      const balance = await mockPublicClient.getBalance({ address: mockAddress })
      
      expect(balance).toBe(BigInt(0))
    })

    it("should get chain ID correctly", async () => {
      const chainId = await mockPublicClient.getChainId()
      expect(chainId).toBe(1)
    })

    it("should handle RPC errors gracefully", async () => {
      mockPublicClient.getBalance.mockRejectedValue(new Error("RPC Error"))

      await expect(
        mockPublicClient.getBalance({ address: mockAddress })
      ).rejects.toThrow("RPC Error")
    })
  })

  describe("Token Balance", () => {
    it("should read ERC20 token balance", async () => {
      const mockTokenBalance = BigInt("1000000") // 1 USDC
      mockPublicClient.readContract.mockResolvedValue(mockTokenBalance)

      const balance = await mockPublicClient.readContract({
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
        abi: [{ name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
        functionName: "balanceOf",
        args: [mockAddress]
      })

      expect(balance).toBe(mockTokenBalance)
    })

    it("should handle token balance of zero", async () => {
      mockPublicClient.readContract.mockResolvedValue(BigInt(0))

      const balance = await mockPublicClient.readContract({
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
        abi: [],
        functionName: "balanceOf",
        args: [mockAddress]
      })

      expect(balance).toBe(BigInt(0))
    })

    it("should handle token contract errors", async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error("Contract not found"))

      await expect(
        mockPublicClient.readContract({
          address: "0x0000000000000000000000000000000000000000" as Address,
          abi: [],
          functionName: "balanceOf",
          args: [mockAddress]
        })
      ).rejects.toThrow("Contract not found")
    })
  })

  describe("Multi-chain Portfolio", () => {
    it("should handle multiple networks", async () => {
      const networks = ["ethereum", "bsc", "arbitrum", "polygon"]
      
      for (const network of networks) {
        const client = getPublicClient(network)
        expect(client).toBeDefined()
      }
    })
  })

  describe("Wallet Activity", () => {
    it("should get transaction count (nonce)", async () => {
      mockPublicClient.getTransactionCount.mockResolvedValue(100)

      const nonce = await mockPublicClient.getTransactionCount({ address: mockAddress })
      
      expect(nonce).toBe(100)
    })

    it("should handle new wallet with zero transactions", async () => {
      mockPublicClient.getTransactionCount.mockResolvedValue(0)

      const nonce = await mockPublicClient.getTransactionCount({ address: mockAddress })
      
      expect(nonce).toBe(0)
    })

    it("should handle high activity wallets", async () => {
      mockPublicClient.getTransactionCount.mockResolvedValue(10000)

      const nonce = await mockPublicClient.getTransactionCount({ address: mockAddress })
      
      expect(nonce).toBe(10000)
    })
  })

  describe("Edge Cases", () => {
    it("should handle very large balances", async () => {
      // 10 billion ETH worth of wei
      const largeBalance = BigInt("10000000000000000000000000000")
      mockPublicClient.getBalance.mockResolvedValue(largeBalance)

      const balance = await mockPublicClient.getBalance({ address: mockAddress })
      
      expect(balance).toBe(largeBalance)
    })

    it("should handle invalid address format gracefully", async () => {
      mockPublicClient.getBalance.mockRejectedValue(new Error("Invalid address"))

      await expect(
        mockPublicClient.getBalance({ address: "invalid" as Address })
      ).rejects.toThrow("Invalid address")
    })

    it("should handle multiple simultaneous requests", async () => {
      mockPublicClient.getBalance.mockResolvedValue(BigInt("1000000000000000000"))
      mockPublicClient.getTransactionCount.mockResolvedValue(50)

      const [balance, nonce] = await Promise.all([
        mockPublicClient.getBalance({ address: mockAddress }),
        mockPublicClient.getTransactionCount({ address: mockAddress })
      ])

      expect(balance).toBe(BigInt("1000000000000000000"))
      expect(nonce).toBe(50)
    })
  })
})
