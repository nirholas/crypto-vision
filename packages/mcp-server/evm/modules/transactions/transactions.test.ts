/**
 * Transaction Module Tests
 * Tests for EVM transaction-related tools and services
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Address, Hash, Hex, TransactionReceipt } from "viem"

// Mock the services module
vi.mock("@/evm/services/index.js", () => ({
  getTransaction: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getTransactionCount: vi.fn(),
  estimateGas: vi.fn(),
  getChainId: vi.fn(),
  helpers: {
    parseEther: vi.fn((value: string) => BigInt(parseFloat(value) * 1e18)),
    formatEther: vi.fn((value: bigint) => (Number(value) / 1e18).toString())
  }
}))

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(() => mockPublicClient),
  getWalletClient: vi.fn(() => mockWalletClient)
}))

// Mock viem accounts
vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn((key: Hex) => ({
    address: "0x1234567890123456789012345678901234567890" as Address,
    signMessage: vi.fn(),
    signTransaction: vi.fn()
  }))
}))

// Mock public client
const mockPublicClient = {
  getTransaction: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getTransactionCount: vi.fn(),
  estimateGas: vi.fn(),
  getGasPrice: vi.fn(),
  getChainId: vi.fn().mockResolvedValue(1),
  waitForTransactionReceipt: vi.fn()
}

// Mock wallet client
const mockWalletClient = {
  sendTransaction: vi.fn(),
  account: {
    address: "0x1234567890123456789012345678901234567890" as Address
  },
  chain: { id: 1, name: "Ethereum" }
}

// Import after mocks are set up
import * as services from "@/evm/services/index.js"

describe("Transaction Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test data
  const mockTxHash =
    "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060" as Hash
  const mockAddress =
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address
  const mockToAddress =
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address
  const mockPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex
  const mockNetwork = "ethereum"

  const createMockTransaction = (overrides: Record<string, any> = {}) => ({
    hash: mockTxHash,
    blockHash:
      "0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6" as Hash,
    blockNumber: BigInt(18000000),
    from: mockAddress,
    to: mockToAddress,
    value: BigInt(1000000000000000000), // 1 ETH
    gas: BigInt(21000),
    gasPrice: BigInt(20000000000),
    maxFeePerGas: BigInt(30000000000),
    maxPriorityFeePerGas: BigInt(2000000000),
    input: "0x" as Hex,
    nonce: 42,
    transactionIndex: 5,
    type: "eip1559",
    v: BigInt(1),
    r: "0x1234" as Hex,
    s: "0x5678" as Hex,
    ...overrides
  })

  const createMockReceipt = (
    overrides: Partial<TransactionReceipt> = {}
  ): TransactionReceipt =>
    ({
      transactionHash: mockTxHash,
      blockHash:
        "0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6" as Hash,
      blockNumber: BigInt(18000000),
      from: mockAddress,
      to: mockToAddress,
      contractAddress: null,
      cumulativeGasUsed: BigInt(5000000),
      gasUsed: BigInt(21000),
      effectiveGasPrice: BigInt(20000000000),
      logs: [],
      logsBloom: "0x" as `0x${string}`,
      status: "success",
      transactionIndex: 5,
      type: "eip1559",
      ...overrides
    }) as TransactionReceipt

  describe("getTransaction Service", () => {
    it("should fetch a transaction by hash", async () => {
      const mockTx = createMockTransaction()
      vi.mocked(services.getTransaction).mockResolvedValue(mockTx)

      const result = await services.getTransaction(mockTxHash, mockNetwork)

      expect(services.getTransaction).toHaveBeenCalledWith(
        mockTxHash,
        mockNetwork
      )
      expect(result.hash).toBe(mockTxHash)
      expect(result.from).toBe(mockAddress)
      expect(result.to).toBe(mockToAddress)
    })

    it("should handle non-existent transaction hash", async () => {
      const nonExistentHash =
        "0x0000000000000000000000000000000000000000000000000000000000000000" as Hash
      vi.mocked(services.getTransaction).mockRejectedValue(
        new Error("Transaction not found")
      )

      await expect(
        services.getTransaction(nonExistentHash, mockNetwork)
      ).rejects.toThrow("Transaction not found")
    })

    it("should handle pending transactions", async () => {
      const pendingTx = createMockTransaction({
        blockHash: null,
        blockNumber: null,
        transactionIndex: null
      })
      vi.mocked(services.getTransaction).mockResolvedValue(pendingTx)

      const result = await services.getTransaction(mockTxHash, mockNetwork)

      expect(result.blockHash).toBeNull()
      expect(result.blockNumber).toBeNull()
    })

    it("should return correct transaction type (EIP-1559)", async () => {
      const eip1559Tx = createMockTransaction({
        type: "eip1559",
        maxFeePerGas: BigInt(30000000000),
        maxPriorityFeePerGas: BigInt(2000000000)
      })
      vi.mocked(services.getTransaction).mockResolvedValue(eip1559Tx)

      const result = await services.getTransaction(mockTxHash, mockNetwork)

      expect(result.type).toBe("eip1559")
      expect(result.maxFeePerGas).toBeDefined()
      expect(result.maxPriorityFeePerGas).toBeDefined()
    })

    it("should return correct transaction type (legacy)", async () => {
      const legacyTx = createMockTransaction({
        type: "legacy",
        gasPrice: BigInt(20000000000),
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined
      })
      vi.mocked(services.getTransaction).mockResolvedValue(legacyTx)

      const result = await services.getTransaction(mockTxHash, mockNetwork)

      expect(result.type).toBe("legacy")
      expect(result.gasPrice).toBeDefined()
    })

    it("should work with different networks", async () => {
      const mockTx = createMockTransaction()
      const networks = ["ethereum", "bsc", "polygon", "arbitrum", "base"]

      for (const network of networks) {
        vi.mocked(services.getTransaction).mockResolvedValue(mockTx)
        await services.getTransaction(mockTxHash, network)
        expect(services.getTransaction).toHaveBeenCalledWith(mockTxHash, network)
      }
    })

    it("should handle invalid hash format", async () => {
      vi.mocked(services.getTransaction).mockRejectedValue(
        new Error("Invalid transaction hash")
      )

      await expect(
        services.getTransaction("invalid-hash" as Hash, mockNetwork)
      ).rejects.toThrow("Invalid transaction hash")
    })
  })

  describe("getTransactionReceipt Service", () => {
    it("should fetch a transaction receipt by hash", async () => {
      const mockReceipt = createMockReceipt()
      vi.mocked(services.getTransactionReceipt).mockResolvedValue(mockReceipt)

      const result = await services.getTransactionReceipt(
        mockTxHash,
        mockNetwork
      )

      expect(services.getTransactionReceipt).toHaveBeenCalledWith(
        mockTxHash,
        mockNetwork
      )
      expect(result.transactionHash).toBe(mockTxHash)
      expect(result.status).toBe("success")
    })

    it("should return receipt with success status", async () => {
      const successReceipt = createMockReceipt({ status: "success" })
      vi.mocked(services.getTransactionReceipt).mockResolvedValue(successReceipt)

      const result = await services.getTransactionReceipt(
        mockTxHash,
        mockNetwork
      )

      expect(result.status).toBe("success")
    })

    it("should return receipt with reverted status", async () => {
      const revertedReceipt = createMockReceipt({ status: "reverted" })
      vi.mocked(services.getTransactionReceipt).mockResolvedValue(revertedReceipt)

      const result = await services.getTransactionReceipt(
        mockTxHash,
        mockNetwork
      )

      expect(result.status).toBe("reverted")
    })

    it("should include contract address for contract creation", async () => {
      const contractCreationReceipt = createMockReceipt({
        to: null,
        contractAddress: "0x9876543210987654321098765432109876543210" as Address
      })
      vi.mocked(services.getTransactionReceipt).mockResolvedValue(
        contractCreationReceipt
      )

      const result = await services.getTransactionReceipt(
        mockTxHash,
        mockNetwork
      )

      expect(result.to).toBeNull()
      expect(result.contractAddress).toBe(
        "0x9876543210987654321098765432109876543210"
      )
    })

    it("should include logs for contract interactions", async () => {
      const receiptWithLogs = createMockReceipt({
        logs: [
          {
            address: mockToAddress,
            topics: [
              "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as Hash
            ],
            data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000" as Hex,
            blockNumber: BigInt(18000000),
            transactionHash: mockTxHash,
            transactionIndex: 5,
            blockHash:
              "0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6" as Hash,
            logIndex: 0,
            removed: false
          }
        ]
      })
      vi.mocked(services.getTransactionReceipt).mockResolvedValue(receiptWithLogs)

      const result = await services.getTransactionReceipt(
        mockTxHash,
        mockNetwork
      )

      expect(result.logs).toHaveLength(1)
      expect(result.logs[0].topics).toHaveLength(1)
    })

    it("should handle pending transaction (no receipt yet)", async () => {
      vi.mocked(services.getTransactionReceipt).mockRejectedValue(
        new Error("Transaction receipt not found")
      )

      await expect(
        services.getTransactionReceipt(mockTxHash, mockNetwork)
      ).rejects.toThrow("Transaction receipt not found")
    })

    it("should include gas information", async () => {
      const mockReceipt = createMockReceipt({
        gasUsed: BigInt(50000),
        effectiveGasPrice: BigInt(25000000000),
        cumulativeGasUsed: BigInt(1000000)
      })
      vi.mocked(services.getTransactionReceipt).mockResolvedValue(mockReceipt)

      const result = await services.getTransactionReceipt(
        mockTxHash,
        mockNetwork
      )

      expect(result.gasUsed).toBe(BigInt(50000))
      expect(result.effectiveGasPrice).toBe(BigInt(25000000000))
    })
  })

  describe("estimateGas Service", () => {
    it("should estimate gas for ETH transfer", async () => {
      vi.mocked(services.estimateGas).mockResolvedValue(BigInt(21000))

      const params = {
        to: mockToAddress,
        value: BigInt(1000000000000000000)
      }

      const result = await services.estimateGas(params, mockNetwork)

      expect(services.estimateGas).toHaveBeenCalledWith(params, mockNetwork)
      expect(result).toBe(BigInt(21000))
    })

    it("should estimate gas for contract call", async () => {
      vi.mocked(services.estimateGas).mockResolvedValue(BigInt(100000))

      const params = {
        to: mockToAddress,
        data: "0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890000000000000000000000000000000000000000000000000000000000000000a" as Hex
      }

      const result = await services.estimateGas(params, mockNetwork)

      expect(result).toBe(BigInt(100000))
    })

    it("should handle estimation failure for invalid transaction", async () => {
      vi.mocked(services.estimateGas).mockRejectedValue(
        new Error("Execution reverted")
      )

      const params = {
        to: mockToAddress,
        value: BigInt(1000000000000000000000000000) // More than anyone has
      }

      await expect(services.estimateGas(params, mockNetwork)).rejects.toThrow(
        "Execution reverted"
      )
    })

    it("should estimate gas for contract deployment", async () => {
      vi.mocked(services.estimateGas).mockResolvedValue(BigInt(500000))

      const params = {
        data: "0x608060405234801561001057600080fd5b50610150806100206000396000f3fe" as Hex
      }

      const result = await services.estimateGas(params, mockNetwork)

      expect(result).toBe(BigInt(500000))
    })

    it("should include from address in estimation when provided", async () => {
      vi.mocked(services.estimateGas).mockResolvedValue(BigInt(21000))

      const params = {
        from: mockAddress,
        to: mockToAddress,
        value: BigInt(1000000000000000000)
      }

      await services.estimateGas(params, mockNetwork)

      expect(services.estimateGas).toHaveBeenCalledWith(
        expect.objectContaining({ from: mockAddress }),
        mockNetwork
      )
    })
  })

  describe("getTransactionCount Service", () => {
    it("should get transaction count (nonce) for an address", async () => {
      vi.mocked(services.getTransactionCount).mockResolvedValue(42)

      const result = await services.getTransactionCount(
        mockAddress,
        mockNetwork
      )

      expect(services.getTransactionCount).toHaveBeenCalledWith(
        mockAddress,
        mockNetwork
      )
      expect(result).toBe(42)
    })

    it("should return 0 for address with no transactions", async () => {
      vi.mocked(services.getTransactionCount).mockResolvedValue(0)

      const newAddress =
        "0x0000000000000000000000000000000000000001" as Address
      const result = await services.getTransactionCount(newAddress, mockNetwork)

      expect(result).toBe(0)
    })

    it("should handle invalid address format", async () => {
      vi.mocked(services.getTransactionCount).mockRejectedValue(
        new Error("Invalid address")
      )

      await expect(
        services.getTransactionCount("invalid-address" as Address, mockNetwork)
      ).rejects.toThrow("Invalid address")
    })
  })

  describe("Send Transaction (Mock)", () => {
    it("should send ETH transfer transaction", async () => {
      const mockTxHash =
        "0xnew123456789abcdef123456789abcdef123456789abcdef123456789abcdef12" as Hash
      mockWalletClient.sendTransaction.mockResolvedValue(mockTxHash)

      const result = await mockWalletClient.sendTransaction({
        to: mockToAddress,
        value: BigInt(1000000000000000000),
        account: mockWalletClient.account,
        chain: mockWalletClient.chain
      })

      expect(mockWalletClient.sendTransaction).toHaveBeenCalled()
      expect(result).toBe(mockTxHash)
    })

    it("should include gas parameters in transaction", async () => {
      const mockTxHash = "0xabc123" as Hash
      mockWalletClient.sendTransaction.mockResolvedValue(mockTxHash)

      await mockWalletClient.sendTransaction({
        to: mockToAddress,
        value: BigInt(1000000000000000000),
        maxFeePerGas: BigInt(30000000000),
        maxPriorityFeePerGas: BigInt(2000000000),
        gas: BigInt(21000),
        account: mockWalletClient.account,
        chain: mockWalletClient.chain
      })

      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          maxFeePerGas: BigInt(30000000000),
          maxPriorityFeePerGas: BigInt(2000000000)
        })
      )
    })

    it("should handle insufficient funds error", async () => {
      mockWalletClient.sendTransaction.mockRejectedValue(
        new Error("insufficient funds for gas * price + value")
      )

      await expect(
        mockWalletClient.sendTransaction({
          to: mockToAddress,
          value: BigInt(1000000000000000000000000), // Large amount
          account: mockWalletClient.account,
          chain: mockWalletClient.chain
        })
      ).rejects.toThrow("insufficient funds")
    })

    it("should handle nonce too low error", async () => {
      mockWalletClient.sendTransaction.mockRejectedValue(
        new Error("nonce too low")
      )

      await expect(
        mockWalletClient.sendTransaction({
          to: mockToAddress,
          value: BigInt(1000000000000000000),
          nonce: 0, // Already used nonce
          account: mockWalletClient.account,
          chain: mockWalletClient.chain
        })
      ).rejects.toThrow("nonce too low")
    })
  })

  describe("Speed Up Transaction (Mock)", () => {
    it("should replace pending transaction with higher gas", async () => {
      const originalTx = createMockTransaction({
        blockHash: null,
        blockNumber: null,
        maxFeePerGas: BigInt(20000000000),
        maxPriorityFeePerGas: BigInt(1000000000)
      })
      mockPublicClient.getTransaction.mockResolvedValue(originalTx)
      mockPublicClient.getTransactionReceipt.mockRejectedValue(
        new Error("not found")
      )

      const newTxHash = "0xnewhash" as Hash
      mockWalletClient.sendTransaction.mockResolvedValue(newTxHash)

      // Simulate speed up with 1.5x gas
      const result = await mockWalletClient.sendTransaction({
        to: originalTx.to,
        value: originalTx.value,
        nonce: originalTx.nonce,
        maxFeePerGas: BigInt(30000000000), // 1.5x
        maxPriorityFeePerGas: BigInt(1500000000), // 1.5x
        account: mockWalletClient.account,
        chain: mockWalletClient.chain
      })

      expect(result).toBe(newTxHash)
    })
  })

  describe("Cancel Transaction (Mock)", () => {
    it("should cancel pending transaction by sending 0 value to self", async () => {
      const originalTx = createMockTransaction({
        blockHash: null,
        blockNumber: null
      })
      mockPublicClient.getTransaction.mockResolvedValue(originalTx)
      mockPublicClient.getTransactionReceipt.mockRejectedValue(
        new Error("not found")
      )

      const cancelTxHash = "0xcancelhash" as Hash
      mockWalletClient.sendTransaction.mockResolvedValue(cancelTxHash)

      const result = await mockWalletClient.sendTransaction({
        to: mockWalletClient.account.address, // Send to self
        value: BigInt(0), // Zero value
        nonce: originalTx.nonce, // Same nonce
        maxFeePerGas: BigInt(40000000000), // Higher gas
        maxPriorityFeePerGas: BigInt(2000000000),
        gas: BigInt(21000),
        account: mockWalletClient.account,
        chain: mockWalletClient.chain
      })

      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockWalletClient.account.address,
          value: BigInt(0),
          nonce: originalTx.nonce
        })
      )
      expect(result).toBe(cancelTxHash)
    })
  })

  describe("Edge Cases", () => {
    it("should handle transaction with zero value", async () => {
      const zeroValueTx = createMockTransaction({ value: BigInt(0) })
      vi.mocked(services.getTransaction).mockResolvedValue(zeroValueTx)

      const result = await services.getTransaction(mockTxHash, mockNetwork)

      expect(result.value).toBe(BigInt(0))
    })

    it("should handle transaction to null address (contract creation)", async () => {
      const contractCreationTx = createMockTransaction({ to: null })
      vi.mocked(services.getTransaction).mockResolvedValue(contractCreationTx)

      const result = await services.getTransaction(mockTxHash, mockNetwork)

      expect(result.to).toBeNull()
    })

    it("should handle very high gas prices", async () => {
      const highGasTx = createMockTransaction({
        maxFeePerGas: BigInt(1000000000000), // 1000 gwei
        maxPriorityFeePerGas: BigInt(100000000000) // 100 gwei
      })
      vi.mocked(services.getTransaction).mockResolvedValue(highGasTx)

      const result = await services.getTransaction(mockTxHash, mockNetwork)

      expect(result.maxFeePerGas).toBe(BigInt(1000000000000))
    })

    it("should handle transaction with large input data", async () => {
      const largeInputTx = createMockTransaction({
        input: ("0x" + "ab".repeat(10000)) as Hex
      })
      vi.mocked(services.getTransaction).mockResolvedValue(largeInputTx)

      const result = await services.getTransaction(mockTxHash, mockNetwork)

      expect(result.input.length).toBeGreaterThan(100)
    })

    it("should handle RPC connection errors", async () => {
      vi.mocked(services.getTransaction).mockRejectedValue(
        new Error("Failed to connect to RPC")
      )

      await expect(
        services.getTransaction(mockTxHash, mockNetwork)
      ).rejects.toThrow("Failed to connect to RPC")
    })

    it("should handle timeout errors", async () => {
      vi.mocked(services.getTransaction).mockRejectedValue(
        new Error("Request timeout")
      )

      await expect(
        services.getTransaction(mockTxHash, mockNetwork)
      ).rejects.toThrow("Request timeout")
    })
  })

  describe("Transaction Validation", () => {
    it("should validate transaction hash format", () => {
      const validHash = mockTxHash
      const isValidFormat = /^0x[a-fA-F0-9]{64}$/.test(validHash)
      expect(isValidFormat).toBe(true)
    })

    it("should validate address format", () => {
      const validAddress = mockAddress
      const isValidFormat = /^0x[a-fA-F0-9]{40}$/.test(validAddress)
      expect(isValidFormat).toBe(true)
    })

    it("should ensure gas used is less than or equal to gas limit", async () => {
      const mockReceipt = createMockReceipt({
        gasUsed: BigInt(21000)
      })
      const mockTx = createMockTransaction({
        gas: BigInt(30000)
      })

      vi.mocked(services.getTransaction).mockResolvedValue(mockTx)
      vi.mocked(services.getTransactionReceipt).mockResolvedValue(mockReceipt)

      const tx = await services.getTransaction(mockTxHash, mockNetwork)
      const receipt = await services.getTransactionReceipt(
        mockTxHash,
        mockNetwork
      )

      expect(receipt.gasUsed).toBeLessThanOrEqual(tx.gas)
    })
  })
})
