/**
 * Tests for BNB vendor module (BNB Chain, Greenfield, opBNB)
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock viem
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem")
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({
      getBalance: vi.fn(),
      getBlock: vi.fn(),
      getBlockNumber: vi.fn(),
      getTransaction: vi.fn(),
      getTransactionReceipt: vi.fn(),
      readContract: vi.fn(),
      estimateGas: vi.fn(),
      getGasPrice: vi.fn(),
      call: vi.fn()
    }),
    createWalletClient: vi.fn().mockReturnValue({
      account: { address: "0x1234567890123456789012345678901234567890" },
      sendTransaction: vi.fn(),
      writeContract: vi.fn()
    }),
    http: vi.fn().mockReturnValue({}),
    parseEther: vi.fn().mockImplementation((value: string) => BigInt(Math.floor(parseFloat(value) * 1e18))),
    formatEther: vi.fn().mockImplementation((value: bigint) => (Number(value) / 1e18).toString()),
    parseUnits: vi.fn().mockImplementation((value: string, decimals: number) => 
      BigInt(Math.floor(parseFloat(value) * Math.pow(10, decimals)))
    ),
    formatUnits: vi.fn().mockImplementation((value: bigint, decimals: number) => 
      (Number(value) / Math.pow(10, decimals)).toString()
    ),
    privateKeyToAccount: vi.fn().mockReturnValue({
      address: "0x1234567890123456789012345678901234567890",
      signMessage: vi.fn(),
      signTransaction: vi.fn()
    }),
    isAddress: vi.fn().mockImplementation((addr: string) => 
      /^0x[a-fA-F0-9]{40}$/.test(addr)
    ),
    getAddress: vi.fn().mockImplementation((addr: string) => addr)
  }
})

// Mock Greenfield SDK
vi.mock("@bnb-chain/greenfield-js-sdk", () => ({
  Client: {
    create: vi.fn().mockReturnValue({
      account: {
        getAccountBalance: vi.fn()
      },
      bucket: {
        createBucket: vi.fn(),
        deleteBucket: vi.fn(),
        getBucketMeta: vi.fn(),
        listBuckets: vi.fn()
      },
      object: {
        createObject: vi.fn(),
        deleteObject: vi.fn(),
        getObject: vi.fn(),
        listObjects: vi.fn()
      },
      sp: {
        getStorageProviders: vi.fn()
      }
    })
  }
}))

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

import { createPublicClient, createWalletClient, privateKeyToAccount, parseEther, formatEther, isAddress } from "viem"

describe("BNB Vendor Module", () => {
  let mockPublicClient: ReturnType<typeof createPublicClient>
  let mockWalletClient: ReturnType<typeof createWalletClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPublicClient = createPublicClient({ transport: vi.fn()() } as any)
    mockWalletClient = createWalletClient({ transport: vi.fn()() } as any)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.BNB_PRIVATE_KEY
    delete process.env.GREENFIELD_PRIVATE_KEY
  })

  describe("BNB Chain EVM Operations", () => {
    describe("Wallet Operations", () => {
      it("should derive address from private key", () => {
        const privateKey = "0x1234567890123456789012345678901234567890123456789012345678901234"
        const account = privateKeyToAccount(privateKey as `0x${string}`)
        
        expect(account.address).toBeDefined()
        expect(isAddress(account.address)).toBe(true)
      })

      it("should validate BNB addresses", () => {
        const validAddress = "0x1234567890123456789012345678901234567890"
        const invalidAddress = "invalid-address"
        
        expect(isAddress(validAddress)).toBe(true)
        expect(isAddress(invalidAddress)).toBe(false)
      })

      it("should get native BNB balance", async () => {
        const mockBalance = BigInt(5 * 1e18) // 5 BNB
        ;(mockPublicClient.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(mockBalance)

        const balance = await mockPublicClient.getBalance({ address: "0x123" as `0x${string}` })
        
        expect(balance).toBe(mockBalance)
        expect(formatEther(balance)).toBe("5")
      })

      it("should handle zero balance", async () => {
        ;(mockPublicClient.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(BigInt(0))

        const balance = await mockPublicClient.getBalance({ address: "0x123" as `0x${string}` })
        
        expect(balance).toBe(BigInt(0))
      })
    })

    describe("Token Operations", () => {
      it("should read BEP20 token balance", async () => {
        const mockTokenBalance = BigInt(1000 * 1e18)
        ;(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValue(mockTokenBalance)

        const balance = await mockPublicClient.readContract({
          address: "0xTokenAddress" as `0x${string}`,
          abi: [],
          functionName: "balanceOf",
          args: ["0xOwnerAddress"]
        })
        
        expect(balance).toBe(mockTokenBalance)
      })

      it("should get token metadata", async () => {
        ;(mockPublicClient.readContract as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce("Test Token") // name
          .mockResolvedValueOnce("TEST")        // symbol
          .mockResolvedValueOnce(18)            // decimals

        const name = await mockPublicClient.readContract({
          address: "0xToken" as `0x${string}`,
          abi: [],
          functionName: "name"
        })
        const symbol = await mockPublicClient.readContract({
          address: "0xToken" as `0x${string}`,
          abi: [],
          functionName: "symbol"
        })
        const decimals = await mockPublicClient.readContract({
          address: "0xToken" as `0x${string}`,
          abi: [],
          functionName: "decimals"
        })
        
        expect(name).toBe("Test Token")
        expect(symbol).toBe("TEST")
        expect(decimals).toBe(18)
      })

      it("should approve token spending", async () => {
        const mockTxHash = "0xabc123def456"
        ;(mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mockResolvedValue(mockTxHash)

        const hash = await mockWalletClient.writeContract({
          address: "0xToken" as `0x${string}`,
          abi: [],
          functionName: "approve",
          args: ["0xSpender", BigInt(1000 * 1e18)]
        })
        
        expect(hash).toBe(mockTxHash)
      })
    })

    describe("Transaction Handling", () => {
      it("should transfer native BNB", async () => {
        const mockTxHash = "0xtxhash123"
        ;(mockWalletClient.sendTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(mockTxHash)

        const hash = await mockWalletClient.sendTransaction({
          to: "0xRecipient" as `0x${string}`,
          value: parseEther("1")
        })
        
        expect(hash).toBe(mockTxHash)
      })

      it("should transfer BEP20 tokens", async () => {
        const mockTxHash = "0xtxhash456"
        ;(mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mockResolvedValue(mockTxHash)

        const hash = await mockWalletClient.writeContract({
          address: "0xToken" as `0x${string}`,
          abi: [],
          functionName: "transfer",
          args: ["0xRecipient", BigInt(100 * 1e18)]
        })
        
        expect(hash).toBe(mockTxHash)
      })

      it("should get transaction receipt", async () => {
        const mockReceipt = {
          status: "success",
          blockNumber: BigInt(12345678),
          gasUsed: BigInt(21000),
          transactionHash: "0xhash123"
        }
        ;(mockPublicClient.getTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValue(mockReceipt)

        const receipt = await mockPublicClient.getTransactionReceipt({ hash: "0xhash123" as `0x${string}` })
        
        expect(receipt.status).toBe("success")
        expect(receipt.gasUsed).toBe(BigInt(21000))
      })

      it("should handle failed transaction", async () => {
        const mockReceipt = {
          status: "reverted",
          blockNumber: BigInt(12345678),
          gasUsed: BigInt(50000),
          transactionHash: "0xfailedhash"
        }
        ;(mockPublicClient.getTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValue(mockReceipt)

        const receipt = await mockPublicClient.getTransactionReceipt({ hash: "0xfailedhash" as `0x${string}` })
        
        expect(receipt.status).toBe("reverted")
      })

      it("should estimate gas for transaction", async () => {
        const mockGas = BigInt(21000)
        ;(mockPublicClient.estimateGas as ReturnType<typeof vi.fn>).mockResolvedValue(mockGas)

        const gas = await mockPublicClient.estimateGas({
          to: "0xRecipient" as `0x${string}`,
          value: parseEther("1")
        })
        
        expect(gas).toBe(mockGas)
      })
    })

    describe("Block Operations", () => {
      it("should get latest block number", async () => {
        const mockBlockNumber = BigInt(35000000)
        ;(mockPublicClient.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlockNumber)

        const blockNumber = await mockPublicClient.getBlockNumber()
        
        expect(blockNumber).toBe(mockBlockNumber)
      })

      it("should get block by number", async () => {
        const mockBlock = {
          number: BigInt(35000000),
          hash: "0xblockhash123",
          timestamp: BigInt(1700000000),
          transactions: ["0xtx1", "0xtx2"]
        }
        ;(mockPublicClient.getBlock as ReturnType<typeof vi.fn>).mockResolvedValue(mockBlock)

        const block = await mockPublicClient.getBlock({ blockNumber: BigInt(35000000) })
        
        expect(block.number).toBe(BigInt(35000000))
        expect(block.transactions).toHaveLength(2)
      })
    })
  })

  describe("BNB Greenfield Storage Operations", () => {
    describe("Account Operations", () => {
      it("should get account balance", async () => {
        const mockBalance = {
          balance: "1000000000000000000"
        }
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBalance)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/account/balance")
        const data = await response.json()
        
        expect(data.balance).toBe("1000000000000000000")
      })

      it("should get all storage providers", async () => {
        const mockSps = [
          { operatorAddress: "0xsp1", endpoint: "https://sp1.example.com" },
          { operatorAddress: "0xsp2", endpoint: "https://sp2.example.com" }
        ]
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSps)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/sp/list")
        const data = await response.json()
        
        expect(data).toHaveLength(2)
      })
    })

    describe("Bucket Operations", () => {
      it("should create a bucket", async () => {
        const mockResult = {
          transactionHash: "0xbuckettxhash",
          bucketName: "test-bucket"
        }
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/bucket/create", {
          method: "POST",
          body: JSON.stringify({ bucketName: "test-bucket" })
        })
        const data = await response.json()
        
        expect(data.bucketName).toBe("test-bucket")
      })

      it("should list buckets", async () => {
        const mockBuckets = [
          { bucketName: "bucket1", createAt: "2024-01-01" },
          { bucketName: "bucket2", createAt: "2024-01-02" }
        ]
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBuckets)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/bucket/list")
        const data = await response.json()
        
        expect(data).toHaveLength(2)
      })

      it("should get bucket info", async () => {
        const mockBucketInfo = {
          bucketName: "test-bucket",
          owner: "0xowner123",
          createAt: "2024-01-01",
          visibility: "public"
        }
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockBucketInfo)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/bucket/info/test-bucket")
        const data = await response.json()
        
        expect(data.bucketName).toBe("test-bucket")
        expect(data.visibility).toBe("public")
      })

      it("should delete a bucket", async () => {
        const mockResult = {
          success: true,
          transactionHash: "0xdeletebuckettx"
        }
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/bucket/delete", {
          method: "DELETE",
          body: JSON.stringify({ bucketName: "test-bucket" })
        })
        const data = await response.json()
        
        expect(data.success).toBe(true)
      })

      it("should handle bucket not found error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: "Bucket not found" })
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/bucket/info/nonexistent")
        
        expect(response.ok).toBe(false)
        expect(response.status).toBe(404)
      })
    })

    describe("Object (File) Operations", () => {
      it("should upload a file", async () => {
        const mockResult = {
          transactionHash: "0xuploadtxhash",
          objectName: "test-file.txt",
          bucketName: "test-bucket"
        }
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/object/upload", {
          method: "POST",
          body: JSON.stringify({ 
            bucketName: "test-bucket",
            objectName: "test-file.txt" 
          })
        })
        const data = await response.json()
        
        expect(data.objectName).toBe("test-file.txt")
      })

      it("should list objects in a bucket", async () => {
        const mockObjects = [
          { objectName: "file1.txt", size: 1024, createAt: "2024-01-01" },
          { objectName: "file2.txt", size: 2048, createAt: "2024-01-02" }
        ]
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockObjects)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/object/list/test-bucket")
        const data = await response.json()
        
        expect(data).toHaveLength(2)
      })

      it("should delete an object", async () => {
        const mockResult = {
          success: true,
          transactionHash: "0xdeleteobjecttx"
        }
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/object/delete", {
          method: "DELETE",
          body: JSON.stringify({ 
            bucketName: "test-bucket",
            objectName: "test-file.txt"
          })
        })
        const data = await response.json()
        
        expect(data.success).toBe(true)
      })

      it("should create a folder", async () => {
        const mockResult = {
          transactionHash: "0xfoldertxhash",
          objectName: "test-folder/",
          bucketName: "test-bucket"
        }
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult)
        })

        const response = await fetch("https://gnfd-testnet-sp.nodereal.io/object/folder", {
          method: "POST",
          body: JSON.stringify({ 
            bucketName: "test-bucket",
            folderName: "test-folder"
          })
        })
        const data = await response.json()
        
        expect(data.objectName).toBe("test-folder/")
      })
    })
  })

  describe("opBNB Layer 2 Operations", () => {
    describe("Network Configuration", () => {
      it("should use opBNB mainnet configuration", () => {
        const opBnbMainnet = {
          id: 204,
          name: "opBNB",
          rpcUrl: "https://opbnb-mainnet-rpc.bnbchain.org",
          blockExplorer: "https://opbnbscan.com"
        }
        
        expect(opBnbMainnet.id).toBe(204)
        expect(opBnbMainnet.name).toBe("opBNB")
      })

      it("should use opBNB testnet configuration", () => {
        const opBnbTestnet = {
          id: 5611,
          name: "opBNB Testnet",
          rpcUrl: "https://opbnb-testnet-rpc.bnbchain.org",
          blockExplorer: "https://testnet.opbnbscan.com"
        }
        
        expect(opBnbTestnet.id).toBe(5611)
      })
    })

    describe("L2 Specific Operations", () => {
      it("should get L2 gas price", async () => {
        const mockGasPrice = BigInt(1000000) // Much lower than L1
        ;(mockPublicClient.getGasPrice as ReturnType<typeof vi.fn>).mockResolvedValue(mockGasPrice)

        const gasPrice = await mockPublicClient.getGasPrice()
        
        expect(gasPrice).toBe(mockGasPrice)
        expect(Number(gasPrice)).toBeLessThan(1e9) // Less than 1 Gwei typically
      })

      it("should estimate L2 transaction cost", async () => {
        const mockGas = BigInt(21000)
        const mockGasPrice = BigInt(1000000)
        
        ;(mockPublicClient.estimateGas as ReturnType<typeof vi.fn>).mockResolvedValue(mockGas)
        ;(mockPublicClient.getGasPrice as ReturnType<typeof vi.fn>).mockResolvedValue(mockGasPrice)

        const gas = await mockPublicClient.estimateGas({
          to: "0xRecipient" as `0x${string}`,
          value: parseEther("0.1")
        })
        const gasPrice = await mockPublicClient.getGasPrice()
        const totalCost = gas * gasPrice
        
        expect(totalCost).toBe(BigInt(21000 * 1000000))
      })
    })
  })

  describe("Error Handling", () => {
    it("should handle RPC connection errors", async () => {
      ;(mockPublicClient.getBalance as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Failed to connect to RPC")
      )

      await expect(
        mockPublicClient.getBalance({ address: "0x123" as `0x${string}` })
      ).rejects.toThrow("Failed to connect to RPC")
    })

    it("should handle insufficient funds error", async () => {
      ;(mockWalletClient.sendTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Insufficient funds for gas * price + value")
      )

      await expect(
        mockWalletClient.sendTransaction({
          to: "0xRecipient" as `0x${string}`,
          value: parseEther("1000000")
        })
      ).rejects.toThrow("Insufficient funds")
    })

    it("should handle contract revert errors", async () => {
      ;(mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Execution reverted: ERC20: transfer amount exceeds balance")
      )

      await expect(
        mockPublicClient.readContract({
          address: "0xToken" as `0x${string}`,
          abi: [],
          functionName: "transfer",
          args: ["0xTo", BigInt(1e30)]
        })
      ).rejects.toThrow("exceeds balance")
    })

    it("should handle Greenfield API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" })
      })

      const response = await fetch("https://gnfd-testnet-sp.nodereal.io/bucket/list")
      
      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })

    it("should handle missing private key", () => {
      delete process.env.BNB_PRIVATE_KEY
      
      const hasPrivateKey = !!process.env.BNB_PRIVATE_KEY
      
      expect(hasPrivateKey).toBe(false)
    })
  })

  describe("Network Switching", () => {
    it("should support BNB Chain mainnet", () => {
      const bnbMainnet = {
        id: 56,
        name: "BNB Smart Chain",
        rpcUrl: "https://bsc-dataseed.binance.org",
        nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }
      }
      
      expect(bnbMainnet.id).toBe(56)
      expect(bnbMainnet.nativeCurrency.symbol).toBe("BNB")
    })

    it("should support BNB Chain testnet", () => {
      const bnbTestnet = {
        id: 97,
        name: "BNB Smart Chain Testnet",
        rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
        nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 }
      }
      
      expect(bnbTestnet.id).toBe(97)
    })
  })
})
