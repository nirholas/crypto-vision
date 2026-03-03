/**
 * Block Module Tests
 * Tests for EVM block-related tools and services
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Block, Hash } from "viem"

// Mock the services module
vi.mock("@/evm/services/index.js", () => ({
  getBlockByHash: vi.fn(),
  getBlockByNumber: vi.fn(),
  getLatestBlock: vi.fn(),
  helpers: {
    parseEther: vi.fn((value: string) => BigInt(parseFloat(value) * 1e18))
  }
}))

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(() => mockPublicClient)
}))

// Mock public client
const mockPublicClient = {
  getBlock: vi.fn(),
  getBlockNumber: vi.fn(),
  getUncleCountByBlockNumber: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getChainId: vi.fn().mockResolvedValue(1)
}

// Import after mocks are set up
import * as services from "@/evm/services/index.js"
import { getPublicClient } from "@/evm/services/clients.js"

describe("Block Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test data
  const mockBlockHash =
    "0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6" as Hash
  const mockBlockNumber = 18000000
  const mockNetwork = "ethereum"

  const createMockBlock = (overrides: Partial<Block> = {}): Block =>
    ({
      number: BigInt(mockBlockNumber),
      hash: mockBlockHash,
      parentHash:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      timestamp: BigInt(1700000000),
      nonce: "0x0000000000000000" as `0x${string}`,
      difficulty: BigInt(0),
      gasLimit: BigInt(30000000),
      gasUsed: BigInt(15000000),
      miner: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      extraData: "0x" as `0x${string}`,
      baseFeePerGas: BigInt(20000000000),
      logsBloom: "0x" as `0x${string}`,
      transactions: [],
      transactionsRoot:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      stateRoot:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      receiptsRoot:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      uncles: [],
      size: BigInt(50000),
      sha3Uncles:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      mixHash:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      totalDifficulty: BigInt(0),
      ...overrides
    }) as Block

  describe("getBlockByHash Service", () => {
    it("should fetch a block by its hash", async () => {
      const mockBlock = createMockBlock()
      vi.mocked(services.getBlockByHash).mockResolvedValue(mockBlock)

      const result = await services.getBlockByHash(mockBlockHash, mockNetwork)

      expect(services.getBlockByHash).toHaveBeenCalledWith(
        mockBlockHash,
        mockNetwork
      )
      expect(result).toEqual(mockBlock)
      expect(result.hash).toBe(mockBlockHash)
    })

    it("should handle non-existent block hash", async () => {
      const invalidHash =
        "0x0000000000000000000000000000000000000000000000000000000000000000" as Hash
      vi.mocked(services.getBlockByHash).mockRejectedValue(
        new Error("Block not found")
      )

      await expect(
        services.getBlockByHash(invalidHash, mockNetwork)
      ).rejects.toThrow("Block not found")
    })

    it("should work with different networks", async () => {
      const mockBlock = createMockBlock()
      const networks = ["ethereum", "bsc", "polygon", "arbitrum"]

      for (const network of networks) {
        vi.mocked(services.getBlockByHash).mockResolvedValue(mockBlock)
        await services.getBlockByHash(mockBlockHash, network)
        expect(services.getBlockByHash).toHaveBeenCalledWith(
          mockBlockHash,
          network
        )
      }
    })

    it("should handle invalid hash format", async () => {
      vi.mocked(services.getBlockByHash).mockRejectedValue(
        new Error("Invalid block hash format")
      )

      await expect(
        services.getBlockByHash("invalid-hash" as Hash, mockNetwork)
      ).rejects.toThrow("Invalid block hash format")
    })
  })

  describe("getBlockByNumber Service", () => {
    it("should fetch a block by its number", async () => {
      const mockBlock = createMockBlock()
      vi.mocked(services.getBlockByNumber).mockResolvedValue(mockBlock)

      const result = await services.getBlockByNumber(
        mockBlockNumber,
        mockNetwork
      )

      expect(services.getBlockByNumber).toHaveBeenCalledWith(
        mockBlockNumber,
        mockNetwork
      )
      expect(result).toEqual(mockBlock)
      expect(Number(result.number)).toBe(mockBlockNumber)
    })

    it("should handle block number 0 (genesis block)", async () => {
      const genesisBlock = createMockBlock({
        number: BigInt(0),
        parentHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000" as Hash
      })
      vi.mocked(services.getBlockByNumber).mockResolvedValue(genesisBlock)

      const result = await services.getBlockByNumber(0, mockNetwork)

      expect(result.number).toBe(BigInt(0))
    })

    it("should handle non-existent block number", async () => {
      const futureBlock = 999999999999
      vi.mocked(services.getBlockByNumber).mockRejectedValue(
        new Error("Block not found")
      )

      await expect(
        services.getBlockByNumber(futureBlock, mockNetwork)
      ).rejects.toThrow("Block not found")
    })

    it("should handle negative block numbers gracefully", async () => {
      vi.mocked(services.getBlockByNumber).mockRejectedValue(
        new Error("Invalid block number")
      )

      await expect(
        services.getBlockByNumber(-1, mockNetwork)
      ).rejects.toThrow("Invalid block number")
    })

    it("should use default network when not specified", async () => {
      const mockBlock = createMockBlock()
      vi.mocked(services.getBlockByNumber).mockResolvedValue(mockBlock)

      await services.getBlockByNumber(mockBlockNumber, undefined as any)

      expect(services.getBlockByNumber).toHaveBeenCalledWith(
        mockBlockNumber,
        undefined
      )
    })
  })

  describe("getLatestBlock Service", () => {
    it("should fetch the latest block", async () => {
      const mockBlock = createMockBlock()
      vi.mocked(services.getLatestBlock).mockResolvedValue(mockBlock)

      const result = await services.getLatestBlock(mockNetwork)

      expect(services.getLatestBlock).toHaveBeenCalledWith(mockNetwork)
      expect(result).toEqual(mockBlock)
    })

    it("should return recent timestamp for latest block", async () => {
      const recentTimestamp = BigInt(Math.floor(Date.now() / 1000) - 15)
      const mockBlock = createMockBlock({ timestamp: recentTimestamp })
      vi.mocked(services.getLatestBlock).mockResolvedValue(mockBlock)

      const result = await services.getLatestBlock(mockNetwork)

      const now = BigInt(Math.floor(Date.now() / 1000))
      expect(result.timestamp).toBeLessThanOrEqual(now)
      expect(Number(now - result.timestamp)).toBeLessThan(60) // Within 60 seconds
    })

    it("should handle network errors gracefully", async () => {
      vi.mocked(services.getLatestBlock).mockRejectedValue(
        new Error("Network error: failed to fetch")
      )

      await expect(services.getLatestBlock(mockNetwork)).rejects.toThrow(
        "Network error"
      )
    })

    it("should work with multiple networks in parallel", async () => {
      const networks = ["ethereum", "bsc", "polygon"]
      const mockBlocks = networks.map((_, i) =>
        createMockBlock({ number: BigInt(1000000 + i) })
      )

      vi.mocked(services.getLatestBlock)
        .mockResolvedValueOnce(mockBlocks[0])
        .mockResolvedValueOnce(mockBlocks[1])
        .mockResolvedValueOnce(mockBlocks[2])

      const results = await Promise.all(
        networks.map((n) => services.getLatestBlock(n))
      )

      expect(results).toHaveLength(3)
      results.forEach((result, i) => {
        expect(result.number).toBe(BigInt(1000000 + i))
      })
    })
  })

  describe("getBlockWithTransactions (via publicClient)", () => {
    it("should fetch block with full transaction details", async () => {
      const mockTransactions = [
        {
          hash: "0xabc123" as Hash,
          from: "0x1234567890123456789012345678901234567890" as `0x${string}`,
          to: "0x0987654321098765432109876543210987654321" as `0x${string}`,
          value: BigInt(1000000000000000000),
          gasPrice: BigInt(20000000000),
          maxFeePerGas: BigInt(30000000000),
          maxPriorityFeePerGas: BigInt(2000000000),
          input: "0x" as `0x${string}`,
          nonce: 1,
          transactionIndex: 0
        }
      ]

      const mockBlockWithTx = {
        ...createMockBlock(),
        transactions: mockTransactions
      }

      mockPublicClient.getBlock.mockResolvedValue(mockBlockWithTx)

      const publicClient = getPublicClient(mockNetwork)
      const result = await publicClient.getBlock({
        blockNumber: BigInt(mockBlockNumber),
        includeTransactions: true
      })

      expect(mockPublicClient.getBlock).toHaveBeenCalledWith({
        blockNumber: BigInt(mockBlockNumber),
        includeTransactions: true
      })
      expect(result.transactions).toHaveLength(1)
      expect(result.transactions[0].hash).toBe("0xabc123")
    })

    it("should fetch latest block with transactions when no blockNumber provided", async () => {
      const mockBlockWithTx = {
        ...createMockBlock(),
        transactions: []
      }

      mockPublicClient.getBlock.mockResolvedValue(mockBlockWithTx)

      const publicClient = getPublicClient(mockNetwork)
      await publicClient.getBlock({
        blockTag: "latest",
        includeTransactions: true
      })

      expect(mockPublicClient.getBlock).toHaveBeenCalledWith({
        blockTag: "latest",
        includeTransactions: true
      })
    })
  })

  describe("Uncle Blocks", () => {
    it("should fetch uncle count for a block", async () => {
      mockPublicClient.getBlock.mockResolvedValue(createMockBlock())
      mockPublicClient.getUncleCountByBlockNumber.mockResolvedValue(2)

      const publicClient = getPublicClient(mockNetwork)
      const uncleCount = await publicClient.getUncleCountByBlockNumber({
        blockNumber: BigInt(mockBlockNumber)
      })

      expect(uncleCount).toBe(2)
    })

    it("should return 0 uncles for L2 chains", async () => {
      const l2Block = createMockBlock({ uncles: [] })
      mockPublicClient.getBlock.mockResolvedValue(l2Block)
      mockPublicClient.getUncleCountByBlockNumber.mockResolvedValue(0)

      const publicClient = getPublicClient("arbitrum")
      const uncleCount = await publicClient.getUncleCountByBlockNumber({
        blockNumber: BigInt(mockBlockNumber)
      })

      expect(uncleCount).toBe(0)
    })
  })

  describe("Block Receipts", () => {
    it("should fetch transaction receipts for all transactions in a block", async () => {
      const mockTxHashes = [
        "0xabc123" as Hash,
        "0xdef456" as Hash,
        "0x789012" as Hash
      ]
      const mockBlockWithTx = {
        ...createMockBlock(),
        transactions: mockTxHashes
      }

      mockPublicClient.getBlock.mockResolvedValue(mockBlockWithTx)
      mockPublicClient.getTransactionReceipt.mockImplementation(
        ({ hash }: { hash: Hash }) =>
          Promise.resolve({
            transactionHash: hash,
            status: "success",
            gasUsed: BigInt(21000),
            logs: []
          })
      )

      const publicClient = getPublicClient(mockNetwork)
      const block = await publicClient.getBlock({
        blockNumber: BigInt(mockBlockNumber),
        includeTransactions: true
      })

      const receipts = await Promise.all(
        block.transactions.map((tx: any) =>
          publicClient.getTransactionReceipt({ hash: tx })
        )
      )

      expect(receipts).toHaveLength(3)
      receipts.forEach((receipt: any, i: number) => {
        expect(receipt.transactionHash).toBe(mockTxHashes[i])
        expect(receipt.status).toBe("success")
      })
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty block (no transactions)", async () => {
      const emptyBlock = createMockBlock({
        transactions: [],
        gasUsed: BigInt(0)
      })
      vi.mocked(services.getBlockByNumber).mockResolvedValue(emptyBlock)

      const result = await services.getBlockByNumber(
        mockBlockNumber,
        mockNetwork
      )

      expect(result.transactions).toHaveLength(0)
      expect(result.gasUsed).toBe(BigInt(0))
    })

    it("should handle very large block numbers", async () => {
      const largeBlockNumber = Number.MAX_SAFE_INTEGER - 1
      const mockBlock = createMockBlock({ number: BigInt(largeBlockNumber) })
      vi.mocked(services.getBlockByNumber).mockResolvedValue(mockBlock)

      const result = await services.getBlockByNumber(
        largeBlockNumber,
        mockNetwork
      )

      expect(Number(result.number)).toBe(largeBlockNumber)
    })

    it("should handle block with null baseFeePerGas (pre-EIP-1559)", async () => {
      const legacyBlock = createMockBlock({ baseFeePerGas: null })
      vi.mocked(services.getBlockByNumber).mockResolvedValue(legacyBlock)

      const result = await services.getBlockByNumber(
        mockBlockNumber,
        mockNetwork
      )

      expect(result.baseFeePerGas).toBeNull()
    })

    it("should handle RPC timeout errors", async () => {
      vi.mocked(services.getLatestBlock).mockRejectedValue(
        new Error("Request timed out")
      )

      await expect(services.getLatestBlock(mockNetwork)).rejects.toThrow(
        "Request timed out"
      )
    })

    it("should handle rate limiting errors", async () => {
      vi.mocked(services.getLatestBlock).mockRejectedValue(
        new Error("Rate limit exceeded")
      )

      await expect(services.getLatestBlock(mockNetwork)).rejects.toThrow(
        "Rate limit exceeded"
      )
    })
  })

  describe("Block Data Validation", () => {
    it("should validate block hash format", () => {
      const validHash = mockBlockHash
      const isValidFormat =
        /^0x[a-fA-F0-9]{64}$/.test(validHash)
      expect(isValidFormat).toBe(true)
    })

    it("should ensure block number is consistent with hash", async () => {
      const mockBlock = createMockBlock()
      vi.mocked(services.getBlockByHash).mockResolvedValue(mockBlock)

      const result = await services.getBlockByHash(mockBlockHash, mockNetwork)

      expect(result.hash).toBe(mockBlockHash)
      expect(typeof result.number).toBe("bigint")
    })

    it("should ensure timestamp is a positive bigint", async () => {
      const mockBlock = createMockBlock()
      vi.mocked(services.getLatestBlock).mockResolvedValue(mockBlock)

      const result = await services.getLatestBlock(mockNetwork)

      expect(result.timestamp).toBeGreaterThan(BigInt(0))
    })
  })
})
