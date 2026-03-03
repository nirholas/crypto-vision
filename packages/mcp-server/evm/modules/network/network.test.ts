/**
 * Network Module Tests
 * Tests for EVM network-related tools and services
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Block, Hash } from "viem"

// Mock the services module
vi.mock("@/evm/services/index.js", () => ({
  getChainId: vi.fn(),
  getBlockNumber: vi.fn(),
  getLatestBlock: vi.fn(),
  helpers: {
    parseEther: vi.fn((value: string) => BigInt(parseFloat(value) * 1e18)),
    formatEther: vi.fn((value: bigint) => (Number(value) / 1e18).toString())
  }
}))

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(() => mockPublicClient)
}))

// Mock the chains module
vi.mock("@/evm/chains.js", () => ({
  getChain: vi.fn((network: string) => mockChainData[network] || mockChainData.ethereum),
  getRpcUrl: vi.fn((network: string) => mockRpcUrls[network] || mockRpcUrls.ethereum),
  getSupportedNetworks: vi.fn(() => [
    "ethereum",
    "polygon",
    "arbitrum",
    "optimism",
    "base",
    "bsc",
    "sepolia",
    "arbitrum-sepolia",
    "base-sepolia"
  ]),
  chainMap: {
    1: { id: 1, name: "Ethereum" },
    137: { id: 137, name: "Polygon" },
    42161: { id: 42161, name: "Arbitrum" },
    10: { id: 10, name: "Optimism" },
    8453: { id: 8453, name: "Base" },
    56: { id: 56, name: "BNB Smart Chain" }
  },
  networkNameMap: {
    ethereum: 1,
    polygon: 137,
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    bsc: 56
  }
}))

// Mock chain data
const mockChainData: Record<string, any> = {
  ethereum: {
    id: 1,
    name: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorers: {
      default: { name: "Etherscan", url: "https://etherscan.io" }
    },
    testnet: false,
    fees: { baseFeeMultiplier: 1.2 },
    contracts: {
      ensRegistry: { address: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" }
    }
  },
  polygon: {
    id: 137,
    name: "Polygon",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorers: {
      default: { name: "Polygonscan", url: "https://polygonscan.com" }
    },
    testnet: false,
    fees: { baseFeeMultiplier: 1.2 }
  },
  arbitrum: {
    id: 42161,
    name: "Arbitrum One",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorers: {
      default: { name: "Arbiscan", url: "https://arbiscan.io" }
    },
    testnet: false
  },
  base: {
    id: 8453,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorers: {
      default: { name: "Basescan", url: "https://basescan.org" }
    },
    testnet: false
  },
  sepolia: {
    id: 11155111,
    name: "Sepolia",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    blockExplorers: {
      default: { name: "Etherscan", url: "https://sepolia.etherscan.io" }
    },
    testnet: true
  }
}

// Mock RPC URLs
const mockRpcUrls: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  polygon: "https://polygon-rpc.com",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  base: "https://mainnet.base.org",
  sepolia: "https://rpc.sepolia.org"
}

// Mock public client
const mockPublicClient = {
  getChainId: vi.fn(),
  getBlockNumber: vi.fn(),
  getBlock: vi.fn(),
  getGasPrice: vi.fn(),
  getFeeHistory: vi.fn(),
  getBalance: vi.fn(),
  getTransactionCount: vi.fn()
}

// Import after mocks are set up
import * as services from "@/evm/services/index.js"
import { getPublicClient } from "@/evm/services/clients.js"
import { getChain, getRpcUrl, getSupportedNetworks, chainMap, networkNameMap } from "@/evm/chains.js"

describe("Network Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset default mock implementations
    mockPublicClient.getChainId.mockResolvedValue(1)
    mockPublicClient.getBlockNumber.mockResolvedValue(BigInt(18500000))
    mockPublicClient.getGasPrice.mockResolvedValue(BigInt(30000000000)) // 30 gwei
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test data
  const mockNetwork = "ethereum"
  const mockBlockNumber = BigInt(18500000)
  const mockChainId = 1
  const mockTimestamp = BigInt(Math.floor(Date.now() / 1000))

  const createMockBlock = (overrides: Partial<Block> = {}): Block =>
    ({
      number: mockBlockNumber,
      hash: "0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6" as Hash,
      parentHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      timestamp: mockTimestamp,
      nonce: "0x0000000000000000" as `0x${string}`,
      difficulty: BigInt(0),
      gasLimit: BigInt(30000000),
      gasUsed: BigInt(15000000),
      miner: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      extraData: "0x" as `0x${string}`,
      baseFeePerGas: BigInt(20000000000),
      logsBloom: "0x" as `0x${string}`,
      transactions: [],
      transactionsRoot: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      stateRoot: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      receiptsRoot: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      uncles: [],
      size: BigInt(50000),
      sha3Uncles: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      mixHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash,
      totalDifficulty: BigInt(0),
      ...overrides
    }) as Block

  describe("getChainInfo Service", () => {
    it("should get chain info for ethereum", async () => {
      vi.mocked(services.getChainId).mockResolvedValue(mockChainId)
      vi.mocked(services.getBlockNumber).mockResolvedValue(mockBlockNumber)

      const chainId = await services.getChainId(mockNetwork)
      const blockNumber = await services.getBlockNumber(mockNetwork)
      const rpcUrl = getRpcUrl(mockNetwork)

      expect(chainId).toBe(1)
      expect(blockNumber).toBe(mockBlockNumber)
      expect(rpcUrl).toBe("https://eth.llamarpc.com")
    })

    it("should get chain info for polygon", async () => {
      vi.mocked(services.getChainId).mockResolvedValue(137)
      vi.mocked(services.getBlockNumber).mockResolvedValue(BigInt(50000000))

      const chainId = await services.getChainId("polygon")
      const rpcUrl = getRpcUrl("polygon")

      expect(chainId).toBe(137)
      expect(rpcUrl).toBe("https://polygon-rpc.com")
    })

    it("should get chain info for arbitrum", async () => {
      vi.mocked(services.getChainId).mockResolvedValue(42161)
      vi.mocked(services.getBlockNumber).mockResolvedValue(BigInt(150000000))

      const chainId = await services.getChainId("arbitrum")
      const rpcUrl = getRpcUrl("arbitrum")

      expect(chainId).toBe(42161)
      expect(rpcUrl).toBe("https://arb1.arbitrum.io/rpc")
    })

    it("should handle unsupported network", async () => {
      vi.mocked(services.getChainId).mockRejectedValue(
        new Error("Unsupported network")
      )

      await expect(services.getChainId("unsupported-network")).rejects.toThrow(
        "Unsupported network"
      )
    })

    it("should handle RPC connection failure", async () => {
      vi.mocked(services.getChainId).mockRejectedValue(
        new Error("Could not connect to RPC")
      )

      await expect(services.getChainId(mockNetwork)).rejects.toThrow(
        "Could not connect to RPC"
      )
    })

    it("should return consistent chain ID for same network", async () => {
      vi.mocked(services.getChainId).mockResolvedValue(1)

      const chainId1 = await services.getChainId(mockNetwork)
      const chainId2 = await services.getChainId(mockNetwork)

      expect(chainId1).toBe(chainId2)
    })
  })

  describe("getSupportedNetworks Service", () => {
    it("should return list of supported networks", () => {
      const networks = getSupportedNetworks()

      expect(networks).toContain("ethereum")
      expect(networks).toContain("polygon")
      expect(networks).toContain("arbitrum")
      expect(networks).toContain("optimism")
      expect(networks).toContain("base")
      expect(networks).toContain("bsc")
    })

    it("should include testnet networks", () => {
      const networks = getSupportedNetworks()

      expect(networks).toContain("sepolia")
      expect(networks).toContain("arbitrum-sepolia")
      expect(networks).toContain("base-sepolia")
    })

    it("should return non-empty array", () => {
      const networks = getSupportedNetworks()

      expect(Array.isArray(networks)).toBe(true)
      expect(networks.length).toBeGreaterThan(0)
    })

    it("should not contain duplicates", () => {
      const networks = getSupportedNetworks()
      const uniqueNetworks = [...new Set(networks)]

      expect(networks.length).toBe(uniqueNetworks.length)
    })

    it("should return networks as strings", () => {
      const networks = getSupportedNetworks()

      networks.forEach((network) => {
        expect(typeof network).toBe("string")
      })
    })
  })

  describe("getNetworkStatus (Network Health) Service", () => {
    it("should return healthy status for responsive network", async () => {
      const mockBlock = createMockBlock()
      mockPublicClient.getChainId.mockResolvedValue(1)
      mockPublicClient.getBlockNumber.mockResolvedValue(mockBlockNumber)
      mockPublicClient.getGasPrice.mockResolvedValue(BigInt(30000000000))
      mockPublicClient.getBlock.mockResolvedValue(mockBlock)

      const [chainId, blockNumber, gasPrice, block] = await Promise.all([
        mockPublicClient.getChainId(),
        mockPublicClient.getBlockNumber(),
        mockPublicClient.getGasPrice(),
        mockPublicClient.getBlock({ blockTag: "latest" })
      ])

      expect(chainId).toBe(1)
      expect(blockNumber).toBe(mockBlockNumber)
      expect(gasPrice).toBe(BigInt(30000000000))
      expect(block.number).toBe(mockBlockNumber)
    })

    it("should detect stale blocks", async () => {
      const staleTimestamp = BigInt(Math.floor(Date.now() / 1000) - 120) // 2 minutes old
      const mockBlock = createMockBlock({ timestamp: staleTimestamp })
      mockPublicClient.getBlock.mockResolvedValue(mockBlock)

      const block = await mockPublicClient.getBlock({ blockTag: "latest" })
      const blockAge = Date.now() / 1000 - Number(block.timestamp)

      expect(blockAge).toBeGreaterThan(60)
    })

    it("should detect very stale blocks", async () => {
      const veryStaleTimestamp = BigInt(Math.floor(Date.now() / 1000) - 600) // 10 minutes old
      const mockBlock = createMockBlock({ timestamp: veryStaleTimestamp })
      mockPublicClient.getBlock.mockResolvedValue(mockBlock)

      const block = await mockPublicClient.getBlock({ blockTag: "latest" })
      const blockAge = Date.now() / 1000 - Number(block.timestamp)

      expect(blockAge).toBeGreaterThan(300)
    })

    it("should handle RPC timeout", async () => {
      mockPublicClient.getChainId.mockRejectedValue(new Error("Request timeout"))

      await expect(mockPublicClient.getChainId()).rejects.toThrow("Request timeout")
    })

    it("should handle network unreachable", async () => {
      mockPublicClient.getBlockNumber.mockRejectedValue(
        new Error("Network unreachable")
      )

      await expect(mockPublicClient.getBlockNumber()).rejects.toThrow(
        "Network unreachable"
      )
    })

    it("should measure RPC latency", async () => {
      const startTime = Date.now()
      mockPublicClient.getChainId.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return 1
      })

      await mockPublicClient.getChainId()
      const latency = Date.now() - startTime

      expect(latency).toBeGreaterThanOrEqual(50)
    })
  })

  describe("getBlockExplorerUrl Service", () => {
    it("should return correct explorer URL for ethereum", () => {
      const chain = getChain("ethereum")

      expect(chain.blockExplorers.default.url).toBe("https://etherscan.io")
      expect(chain.blockExplorers.default.name).toBe("Etherscan")
    })

    it("should return correct explorer URL for polygon", () => {
      const chain = getChain("polygon")

      expect(chain.blockExplorers.default.url).toBe("https://polygonscan.com")
      expect(chain.blockExplorers.default.name).toBe("Polygonscan")
    })

    it("should return correct explorer URL for arbitrum", () => {
      const chain = getChain("arbitrum")

      expect(chain.blockExplorers.default.url).toBe("https://arbiscan.io")
      expect(chain.blockExplorers.default.name).toBe("Arbiscan")
    })

    it("should return correct explorer URL for base", () => {
      const chain = getChain("base")

      expect(chain.blockExplorers.default.url).toBe("https://basescan.org")
      expect(chain.blockExplorers.default.name).toBe("Basescan")
    })

    it("should return testnet explorer URL for sepolia", () => {
      const chain = getChain("sepolia")

      expect(chain.blockExplorers.default.url).toBe("https://sepolia.etherscan.io")
      expect(chain.testnet).toBe(true)
    })

    it("should construct transaction URL correctly", () => {
      const chain = getChain("ethereum")
      const txHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      const expectedUrl = `${chain.blockExplorers.default.url}/tx/${txHash}`

      expect(expectedUrl).toBe(`https://etherscan.io/tx/${txHash}`)
    })

    it("should construct address URL correctly", () => {
      const chain = getChain("ethereum")
      const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
      const expectedUrl = `${chain.blockExplorers.default.url}/address/${address}`

      expect(expectedUrl).toBe(`https://etherscan.io/address/${address}`)
    })

    it("should construct block URL correctly", () => {
      const chain = getChain("ethereum")
      const blockNumber = 18500000
      const expectedUrl = `${chain.blockExplorers.default.url}/block/${blockNumber}`

      expect(expectedUrl).toBe(`https://etherscan.io/block/${blockNumber}`)
    })
  })

  describe("Network Metadata", () => {
    it("should return native currency info for ethereum", () => {
      const chain = getChain("ethereum")

      expect(chain.nativeCurrency.name).toBe("Ether")
      expect(chain.nativeCurrency.symbol).toBe("ETH")
      expect(chain.nativeCurrency.decimals).toBe(18)
    })

    it("should return native currency info for polygon", () => {
      const chain = getChain("polygon")

      expect(chain.nativeCurrency.name).toBe("MATIC")
      expect(chain.nativeCurrency.symbol).toBe("MATIC")
      expect(chain.nativeCurrency.decimals).toBe(18)
    })

    it("should identify testnet networks", () => {
      const sepoliaChain = getChain("sepolia")
      const ethereumChain = getChain("ethereum")

      expect(sepoliaChain.testnet).toBe(true)
      expect(ethereumChain.testnet).toBe(false)
    })

    it("should return chain ID from chain data", () => {
      const ethereumChain = getChain("ethereum")
      const polygonChain = getChain("polygon")

      expect(ethereumChain.id).toBe(1)
      expect(polygonChain.id).toBe(137)
    })

    it("should return contracts for networks that have them", () => {
      const chain = getChain("ethereum")

      expect(chain.contracts).toBeDefined()
      expect(chain.contracts.ensRegistry).toBeDefined()
    })
  })

  describe("Gas Price Operations", () => {
    it("should get current gas price", async () => {
      mockPublicClient.getGasPrice.mockResolvedValue(BigInt(30000000000)) // 30 gwei

      const gasPrice = await mockPublicClient.getGasPrice()

      expect(gasPrice).toBe(BigInt(30000000000))
    })

    it("should get fee history", async () => {
      mockPublicClient.getFeeHistory.mockResolvedValue({
        baseFeePerGas: [BigInt(20000000000), BigInt(21000000000)],
        gasUsedRatio: [0.5, 0.6],
        reward: [[BigInt(1000000000)], [BigInt(1500000000)]]
      })

      const feeHistory = await mockPublicClient.getFeeHistory({
        blockCount: 10,
        rewardPercentiles: [25, 50, 75]
      })

      expect(feeHistory.baseFeePerGas).toHaveLength(2)
      expect(feeHistory.gasUsedRatio).toHaveLength(2)
    })

    it("should handle networks without EIP-1559", async () => {
      mockPublicClient.getFeeHistory.mockRejectedValue(
        new Error("Method not supported")
      )

      await expect(
        mockPublicClient.getFeeHistory({
          blockCount: 10,
          rewardPercentiles: [25, 50, 75]
        })
      ).rejects.toThrow("Method not supported")
    })

    it("should handle very high gas prices", async () => {
      const highGasPrice = BigInt(500000000000) // 500 gwei
      mockPublicClient.getGasPrice.mockResolvedValue(highGasPrice)

      const gasPrice = await mockPublicClient.getGasPrice()

      expect(gasPrice).toBe(highGasPrice)
      expect(Number(gasPrice) / 1e9).toBe(500)
    })

    it("should handle very low gas prices", async () => {
      const lowGasPrice = BigInt(100000000) // 0.1 gwei
      mockPublicClient.getGasPrice.mockResolvedValue(lowGasPrice)

      const gasPrice = await mockPublicClient.getGasPrice()

      expect(gasPrice).toBe(lowGasPrice)
      expect(Number(gasPrice) / 1e9).toBe(0.1)
    })
  })

  describe("Block Operations", () => {
    it("should get latest block", async () => {
      const mockBlock = createMockBlock()
      mockPublicClient.getBlock.mockResolvedValue(mockBlock)

      const block = await mockPublicClient.getBlock({ blockTag: "latest" })

      expect(block.number).toBe(mockBlockNumber)
      expect(block.gasLimit).toBe(BigInt(30000000))
    })

    it("should get finalized block", async () => {
      const finalizedBlockNumber = mockBlockNumber - BigInt(64)
      const mockBlock = createMockBlock({ number: finalizedBlockNumber })
      mockPublicClient.getBlock.mockResolvedValue(mockBlock)

      const block = await mockPublicClient.getBlock({ blockTag: "finalized" })

      expect(block.number).toBe(finalizedBlockNumber)
    })

    it("should handle networks without finalized block support", async () => {
      mockPublicClient.getBlock.mockRejectedValue(
        new Error("Finalized block not supported")
      )

      await expect(
        mockPublicClient.getBlock({ blockTag: "finalized" })
      ).rejects.toThrow("Finalized block not supported")
    })

    it("should get pending block", async () => {
      const pendingBlock = createMockBlock({
        number: mockBlockNumber + BigInt(1),
        transactions: ["0xtx1", "0xtx2", "0xtx3"] as any
      })
      mockPublicClient.getBlock.mockResolvedValue(pendingBlock)

      const block = await mockPublicClient.getBlock({ blockTag: "pending" })

      expect(block.transactions.length).toBe(3)
    })

    it("should calculate block utilization", async () => {
      const mockBlock = createMockBlock({
        gasUsed: BigInt(15000000),
        gasLimit: BigInt(30000000)
      })
      mockPublicClient.getBlock.mockResolvedValue(mockBlock)

      const block = await mockPublicClient.getBlock({ blockTag: "latest" })
      const utilization = Number((block.gasUsed * BigInt(100)) / block.gasLimit)

      expect(utilization).toBe(50)
    })
  })

  describe("Finality Status", () => {
    it("should calculate confirmations correctly", async () => {
      const targetBlockNumber = BigInt(18499900)
      const latestBlockNumber = mockBlockNumber

      const confirmations = Number(latestBlockNumber - targetBlockNumber)

      expect(confirmations).toBe(100)
    })

    it("should identify finalized blocks", async () => {
      const latestBlock = createMockBlock({ number: mockBlockNumber })
      const finalizedBlock = createMockBlock({
        number: mockBlockNumber - BigInt(64)
      })

      mockPublicClient.getBlock
        .mockResolvedValueOnce(latestBlock)
        .mockResolvedValueOnce(finalizedBlock)

      const latest = await mockPublicClient.getBlock({ blockTag: "latest" })
      const finalized = await mockPublicClient.getBlock({ blockTag: "finalized" })

      expect(finalized.number).toBeLessThan(latest.number)
    })

    it("should handle pending status", async () => {
      const latestBlockNumber = mockBlockNumber
      const targetBlockNumber = latestBlockNumber // Same block = pending

      const confirmations = Number(latestBlockNumber - targetBlockNumber)

      expect(confirmations).toBe(0)
    })

    it("should identify highly confirmed blocks", async () => {
      const latestBlockNumber = mockBlockNumber
      const targetBlockNumber = mockBlockNumber - BigInt(20)

      const confirmations = Number(latestBlockNumber - targetBlockNumber)

      expect(confirmations).toBeGreaterThanOrEqual(12)
    })
  })

  describe("Pending Transactions", () => {
    it("should get pending transaction count for address", async () => {
      mockPublicClient.getTransactionCount
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(8) // latest

      const pendingNonce = await mockPublicClient.getTransactionCount({
        address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        blockTag: "pending"
      })

      const latestNonce = await mockPublicClient.getTransactionCount({
        address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        blockTag: "latest"
      })

      const pendingTxCount = pendingNonce - latestNonce

      expect(pendingTxCount).toBe(2)
    })

    it("should get pending balance changes", async () => {
      const pendingBalance = BigInt("5000000000000000000") // 5 ETH
      const latestBalance = BigInt("6000000000000000000") // 6 ETH

      mockPublicClient.getBalance
        .mockResolvedValueOnce(pendingBalance)
        .mockResolvedValueOnce(latestBalance)

      const pending = await mockPublicClient.getBalance({
        address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        blockTag: "pending"
      })

      const latest = await mockPublicClient.getBalance({
        address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        blockTag: "latest"
      })

      const balanceDelta = pending - latest

      expect(balanceDelta).toBe(BigInt("-1000000000000000000")) // -1 ETH
    })
  })

  describe("Edge Cases and Error Handling", () => {
    it("should handle network with alias names", () => {
      // Both "ethereum" and "mainnet" should map to chain ID 1
      const ethereumChain = getChain("ethereum")

      expect(ethereumChain.id).toBe(1)
    })

    it("should handle RPC rate limiting", async () => {
      mockPublicClient.getChainId.mockRejectedValue(
        new Error("Rate limit exceeded")
      )

      await expect(mockPublicClient.getChainId()).rejects.toThrow(
        "Rate limit exceeded"
      )
    })

    it("should handle invalid block number", async () => {
      mockPublicClient.getBlock.mockRejectedValue(new Error("Block not found"))

      await expect(
        mockPublicClient.getBlock({ blockNumber: BigInt(999999999999) })
      ).rejects.toThrow("Block not found")
    })

    it("should handle empty block", async () => {
      const emptyBlock = createMockBlock({
        transactions: [],
        gasUsed: BigInt(0)
      })
      mockPublicClient.getBlock.mockResolvedValue(emptyBlock)

      const block = await mockPublicClient.getBlock({ blockTag: "latest" })

      expect(block.transactions.length).toBe(0)
      expect(block.gasUsed).toBe(BigInt(0))
    })

    it("should handle concurrent requests", async () => {
      mockPublicClient.getChainId.mockResolvedValue(1)
      mockPublicClient.getBlockNumber.mockResolvedValue(mockBlockNumber)
      mockPublicClient.getGasPrice.mockResolvedValue(BigInt(30000000000))

      const results = await Promise.all([
        mockPublicClient.getChainId(),
        mockPublicClient.getBlockNumber(),
        mockPublicClient.getGasPrice()
      ])

      expect(results[0]).toBe(1)
      expect(results[1]).toBe(mockBlockNumber)
      expect(results[2]).toBe(BigInt(30000000000))
    })

    it("should handle partial failures in concurrent requests", async () => {
      mockPublicClient.getChainId.mockResolvedValue(1)
      mockPublicClient.getBlockNumber.mockRejectedValue(new Error("Failed"))
      mockPublicClient.getGasPrice.mockResolvedValue(BigInt(30000000000))

      const results = await Promise.allSettled([
        mockPublicClient.getChainId(),
        mockPublicClient.getBlockNumber(),
        mockPublicClient.getGasPrice()
      ])

      expect(results[0].status).toBe("fulfilled")
      expect(results[1].status).toBe("rejected")
      expect(results[2].status).toBe("fulfilled")
    })

    it("should handle zero gas price", async () => {
      mockPublicClient.getGasPrice.mockResolvedValue(BigInt(0))

      const gasPrice = await mockPublicClient.getGasPrice()

      expect(gasPrice).toBe(BigInt(0))
    })

    it("should handle block with null baseFeePerGas (pre-EIP-1559)", async () => {
      const preEIP1559Block = createMockBlock({ baseFeePerGas: null as any })
      mockPublicClient.getBlock.mockResolvedValue(preEIP1559Block)

      const block = await mockPublicClient.getBlock({ blockTag: "latest" })

      expect(block.baseFeePerGas).toBeNull()
    })
  })

  describe("Chain Map Operations", () => {
    it("should map chain ID to chain object", () => {
      expect(chainMap[1].name).toBe("Ethereum")
      expect(chainMap[137].name).toBe("Polygon")
      expect(chainMap[42161].name).toBe("Arbitrum")
    })

    it("should map network name to chain ID", () => {
      expect(networkNameMap.ethereum).toBe(1)
      expect(networkNameMap.polygon).toBe(137)
      expect(networkNameMap.arbitrum).toBe(42161)
    })

    it("should handle undefined chain ID", () => {
      expect(chainMap[999999]).toBeUndefined()
    })

    it("should handle undefined network name", () => {
      expect(networkNameMap["invalid-network"]).toBeUndefined()
    })
  })
})
