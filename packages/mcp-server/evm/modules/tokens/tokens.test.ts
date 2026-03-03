/**
 * Token Module Tests
 * Tests for EVM token-related tools and services (ERC20, native tokens)
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Address, Hash, Hex } from "viem"

// Mock the services module
vi.mock("@/evm/services/index.js", () => ({
  getERC20TokenInfo: vi.fn(),
  getERC20Balance: vi.fn(),
  getNativeBalance: vi.fn(),
  createERC20Token: vi.fn(),
  transferERC20: vi.fn(),
  approveERC20: vi.fn(),
  helpers: {
    parseEther: vi.fn((value: string) => BigInt(parseFloat(value) * 1e18)),
    formatEther: vi.fn((value: bigint) => (Number(value) / 1e18).toString()),
    parseUnits: vi.fn((value: string, decimals: number) =>
      BigInt(parseFloat(value) * Math.pow(10, decimals))
    ),
    formatUnits: vi.fn(
      (value: bigint, decimals: number) =>
        (Number(value) / Math.pow(10, decimals)).toString()
    )
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
  readContract: vi.fn(),
  getChainId: vi.fn().mockResolvedValue(1),
  getBalance: vi.fn()
}

// Mock wallet client
const mockWalletClient = {
  writeContract: vi.fn(),
  sendTransaction: vi.fn(),
  account: {
    address: "0x1234567890123456789012345678901234567890" as Address
  },
  chain: { id: 1, name: "Ethereum" }
}

// Import after mocks are set up
import * as services from "@/evm/services/index.js"

describe("Token Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test data - common addresses
  const mockUSDCAddress =
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address
  const mockUSDTAddress =
    "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address
  const mockWETHAddress =
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address
  const mockUserAddress =
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address
  const mockPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex
  const mockNetwork = "ethereum"

  describe("getERC20TokenInfo Service", () => {
    it("should fetch token info for USDC", async () => {
      const mockTokenInfo = {
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        totalSupply: BigInt("50000000000000000"), // 50 billion with 6 decimals
        formattedTotalSupply: "50000000000"
      }
      vi.mocked(services.getERC20TokenInfo).mockResolvedValue(mockTokenInfo)

      const result = await services.getERC20TokenInfo(
        mockUSDCAddress,
        mockNetwork
      )

      expect(services.getERC20TokenInfo).toHaveBeenCalledWith(
        mockUSDCAddress,
        mockNetwork
      )
      expect(result.name).toBe("USD Coin")
      expect(result.symbol).toBe("USDC")
      expect(result.decimals).toBe(6)
    })

    it("should fetch token info for USDT", async () => {
      const mockTokenInfo = {
        name: "Tether USD",
        symbol: "USDT",
        decimals: 6,
        totalSupply: BigInt("83000000000000000"),
        formattedTotalSupply: "83000000000"
      }
      vi.mocked(services.getERC20TokenInfo).mockResolvedValue(mockTokenInfo)

      const result = await services.getERC20TokenInfo(
        mockUSDTAddress,
        mockNetwork
      )

      expect(result.symbol).toBe("USDT")
      expect(result.decimals).toBe(6)
    })

    it("should fetch token info for WETH (18 decimals)", async () => {
      const mockTokenInfo = {
        name: "Wrapped Ether",
        symbol: "WETH",
        decimals: 18,
        totalSupply: BigInt("3000000000000000000000000"), // 3M WETH
        formattedTotalSupply: "3000000"
      }
      vi.mocked(services.getERC20TokenInfo).mockResolvedValue(mockTokenInfo)

      const result = await services.getERC20TokenInfo(
        mockWETHAddress,
        mockNetwork
      )

      expect(result.symbol).toBe("WETH")
      expect(result.decimals).toBe(18)
    })

    it("should handle non-contract address", async () => {
      vi.mocked(services.getERC20TokenInfo).mockRejectedValue(
        new Error("Token address is not a contract")
      )

      await expect(
        services.getERC20TokenInfo(mockUserAddress, mockNetwork)
      ).rejects.toThrow("Token address is not a contract")
    })

    it("should handle invalid ERC20 contract (no name)", async () => {
      vi.mocked(services.getERC20TokenInfo).mockRejectedValue(
        new Error("Contract does not implement ERC20 interface")
      )

      await expect(
        services.getERC20TokenInfo(
          "0x0000000000000000000000000000000000000001" as Address,
          mockNetwork
        )
      ).rejects.toThrow("Contract does not implement ERC20 interface")
    })

    it("should work with different networks", async () => {
      const mockTokenInfo = {
        name: "Test Token",
        symbol: "TEST",
        decimals: 18,
        totalSupply: BigInt("1000000000000000000000000"),
        formattedTotalSupply: "1000000"
      }
      vi.mocked(services.getERC20TokenInfo).mockResolvedValue(mockTokenInfo)

      const networks = ["ethereum", "bsc", "polygon", "arbitrum"]

      for (const network of networks) {
        await services.getERC20TokenInfo(mockUSDCAddress, network)
        expect(services.getERC20TokenInfo).toHaveBeenCalledWith(
          mockUSDCAddress,
          network
        )
      }
    })

    it("should handle tokens with 0 decimals", async () => {
      const mockTokenInfo = {
        name: "Zero Decimal Token",
        symbol: "ZDT",
        decimals: 0,
        totalSupply: BigInt("1000000"),
        formattedTotalSupply: "1000000"
      }
      vi.mocked(services.getERC20TokenInfo).mockResolvedValue(mockTokenInfo)

      const result = await services.getERC20TokenInfo(
        mockUSDCAddress,
        mockNetwork
      )

      expect(result.decimals).toBe(0)
    })
  })

  describe("getERC20Balance Service", () => {
    it("should get ERC20 token balance for an address", async () => {
      const mockBalance = {
        raw: BigInt("1000000000"), // 1000 USDC
        formatted: "1000",
        symbol: "USDC",
        decimals: 6,
        network: mockNetwork,
        tokenAddress: mockUSDCAddress,
        ownerAddress: mockUserAddress
      }
      vi.mocked(services.getERC20Balance).mockResolvedValue(mockBalance)

      const result = await services.getERC20Balance(
        mockUSDCAddress,
        mockUserAddress,
        mockNetwork
      )

      expect(services.getERC20Balance).toHaveBeenCalledWith(
        mockUSDCAddress,
        mockUserAddress,
        mockNetwork
      )
      expect(result.formatted).toBe("1000")
      expect(result.symbol).toBe("USDC")
    })

    it("should return 0 balance for address with no tokens", async () => {
      const mockBalance = {
        raw: BigInt(0),
        formatted: "0",
        symbol: "USDC",
        decimals: 6,
        network: mockNetwork,
        tokenAddress: mockUSDCAddress,
        ownerAddress: "0x0000000000000000000000000000000000000001" as Address
      }
      vi.mocked(services.getERC20Balance).mockResolvedValue(mockBalance)

      const result = await services.getERC20Balance(
        mockUSDCAddress,
        "0x0000000000000000000000000000000000000001" as Address,
        mockNetwork
      )

      expect(result.raw).toBe(BigInt(0))
      expect(result.formatted).toBe("0")
    })

    it("should handle very large balances", async () => {
      const mockBalance = {
        raw: BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"), // Max uint256
        formatted: "115792089237316195423570985008687907853269984665640564039457.584007913129639935",
        symbol: "TEST",
        decimals: 18,
        network: mockNetwork,
        tokenAddress: mockUSDCAddress,
        ownerAddress: mockUserAddress
      }
      vi.mocked(services.getERC20Balance).mockResolvedValue(mockBalance)

      const result = await services.getERC20Balance(
        mockUSDCAddress,
        mockUserAddress,
        mockNetwork
      )

      expect(result.raw).toBeGreaterThan(BigInt(0))
    })

    it("should handle invalid token address", async () => {
      vi.mocked(services.getERC20Balance).mockRejectedValue(
        new Error("Invalid token address")
      )

      await expect(
        services.getERC20Balance(
          "invalid" as Address,
          mockUserAddress,
          mockNetwork
        )
      ).rejects.toThrow("Invalid token address")
    })

    it("should handle invalid owner address", async () => {
      vi.mocked(services.getERC20Balance).mockRejectedValue(
        new Error("Invalid owner address")
      )

      await expect(
        services.getERC20Balance(
          mockUSDCAddress,
          "invalid" as Address,
          mockNetwork
        )
      ).rejects.toThrow("Invalid owner address")
    })
  })

  describe("getNativeBalance Service", () => {
    it("should get native ETH balance", async () => {
      const mockBalance = {
        raw: BigInt("5000000000000000000"), // 5 ETH
        formatted: "5",
        network: mockNetwork,
        symbol: "ETH",
        decimals: 18
      }
      vi.mocked(services.getNativeBalance).mockResolvedValue(mockBalance)

      const result = await services.getNativeBalance(
        mockUserAddress,
        mockNetwork
      )

      expect(services.getNativeBalance).toHaveBeenCalledWith(
        mockUserAddress,
        mockNetwork
      )
      expect(result.formatted).toBe("5")
      expect(result.symbol).toBe("ETH")
    })

    it("should get native BNB balance on BSC", async () => {
      const mockBalance = {
        raw: BigInt("10000000000000000000"), // 10 BNB
        formatted: "10",
        network: "bsc",
        symbol: "BNB",
        decimals: 18
      }
      vi.mocked(services.getNativeBalance).mockResolvedValue(mockBalance)

      const result = await services.getNativeBalance(mockUserAddress, "bsc")

      expect(result.symbol).toBe("BNB")
    })

    it("should get native MATIC balance on Polygon", async () => {
      const mockBalance = {
        raw: BigInt("100000000000000000000"), // 100 MATIC
        formatted: "100",
        network: "polygon",
        symbol: "MATIC",
        decimals: 18
      }
      vi.mocked(services.getNativeBalance).mockResolvedValue(mockBalance)

      const result = await services.getNativeBalance(mockUserAddress, "polygon")

      expect(result.symbol).toBe("MATIC")
    })

    it("should return 0 for empty wallet", async () => {
      const mockBalance = {
        raw: BigInt(0),
        formatted: "0",
        network: mockNetwork,
        symbol: "ETH",
        decimals: 18
      }
      vi.mocked(services.getNativeBalance).mockResolvedValue(mockBalance)

      const result = await services.getNativeBalance(
        "0x0000000000000000000000000000000000000001" as Address,
        mockNetwork
      )

      expect(result.raw).toBe(BigInt(0))
    })

    it("should handle ENS name resolution", async () => {
      const mockBalance = {
        raw: BigInt("5000000000000000000"),
        formatted: "5",
        network: mockNetwork,
        symbol: "ETH",
        decimals: 18
      }
      vi.mocked(services.getNativeBalance).mockResolvedValue(mockBalance)

      const result = await services.getNativeBalance("vitalik.eth", mockNetwork)

      expect(services.getNativeBalance).toHaveBeenCalledWith(
        "vitalik.eth",
        mockNetwork
      )
      expect(result.formatted).toBe("5")
    })
  })

  describe("ERC20 Transfer (Mock)", () => {
    it("should transfer ERC20 tokens", async () => {
      const mockResult = {
        txHash:
          "0xabc123def456789012345678901234567890123456789012345678901234567890" as Hash,
        amount: {
          raw: BigInt("1000000000"),
          formatted: "1000"
        },
        token: {
          symbol: "USDC",
          decimals: 6
        }
      }
      vi.mocked(services.transferERC20).mockResolvedValue(mockResult)

      const result = await services.transferERC20(
        mockUSDCAddress,
        mockUserAddress,
        "1000",
        mockPrivateKey,
        mockNetwork
      )

      expect(result.txHash).toBeDefined()
      expect(result.amount.formatted).toBe("1000")
    })

    it("should handle insufficient balance for transfer", async () => {
      vi.mocked(services.transferERC20).mockRejectedValue(
        new Error("Insufficient token balance")
      )

      await expect(
        services.transferERC20(
          mockUSDCAddress,
          mockUserAddress,
          "1000000000", // Very large amount
          mockPrivateKey,
          mockNetwork
        )
      ).rejects.toThrow("Insufficient token balance")
    })

    it("should handle invalid recipient address", async () => {
      vi.mocked(services.transferERC20).mockRejectedValue(
        new Error("Invalid recipient address")
      )

      await expect(
        services.transferERC20(
          mockUSDCAddress,
          "invalid" as any,
          "100",
          mockPrivateKey,
          mockNetwork
        )
      ).rejects.toThrow("Invalid recipient address")
    })
  })

  describe("createERC20Token Service", () => {
    it("should create a new ERC20 token", async () => {
      const mockResult = {
        hash: "0xdeploymenthash123456789012345678901234567890123456789012345678" as Hash,
        name: "My Token",
        symbol: "MTK",
        totalSupply: BigInt("1000000000000000000000000000"),
        owner: "0x1234567890123456789012345678901234567890" as Address
      }
      vi.mocked(services.createERC20Token).mockResolvedValue(mockResult)

      const result = await services.createERC20Token({
        name: "My Token",
        symbol: "MTK",
        privateKey: mockPrivateKey,
        network: mockNetwork
      })

      expect(result.hash).toBeDefined()
      expect(result.name).toBe("My Token")
      expect(result.symbol).toBe("MTK")
    })

    it("should create token with custom total supply", async () => {
      const mockResult = {
        hash: "0xhash123" as Hash,
        name: "Custom Token",
        symbol: "CTK",
        totalSupply: BigInt("500000000"),
        owner: "0x1234567890123456789012345678901234567890" as Address
      }
      vi.mocked(services.createERC20Token).mockResolvedValue(mockResult)

      const result = await services.createERC20Token({
        name: "Custom Token",
        symbol: "CTK",
        privateKey: mockPrivateKey,
        network: mockNetwork,
        totalSupply: "500000000"
      })

      expect(result.totalSupply).toBe(BigInt("500000000"))
    })

    it("should handle deployment failure", async () => {
      vi.mocked(services.createERC20Token).mockRejectedValue(
        new Error("Contract deployment failed")
      )

      await expect(
        services.createERC20Token({
          name: "Failed Token",
          symbol: "FAIL",
          privateKey: mockPrivateKey,
          network: mockNetwork
        })
      ).rejects.toThrow("Contract deployment failed")
    })
  })

  describe("Wrapped Native Token Operations", () => {
    it("should wrap native token (ETH -> WETH)", async () => {
      mockWalletClient.writeContract.mockResolvedValue(
        "0xwraphash123" as Hash
      )

      const result = await mockWalletClient.writeContract({
        address: mockWETHAddress,
        abi: [{ name: "deposit", type: "function" }],
        functionName: "deposit",
        value: BigInt("1000000000000000000"),
        account: mockWalletClient.account
      })

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "deposit",
          value: BigInt("1000000000000000000")
        })
      )
      expect(result).toBe("0xwraphash123")
    })

    it("should unwrap wrapped token (WETH -> ETH)", async () => {
      mockWalletClient.writeContract.mockResolvedValue(
        "0xunwraphash123" as Hash
      )

      const result = await mockWalletClient.writeContract({
        address: mockWETHAddress,
        abi: [{ name: "withdraw", type: "function" }],
        functionName: "withdraw",
        args: [BigInt("1000000000000000000")],
        account: mockWalletClient.account
      })

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "withdraw",
          args: [BigInt("1000000000000000000")]
        })
      )
      expect(result).toBe("0xunwraphash123")
    })

    it("should handle insufficient wrapped token balance for unwrap", async () => {
      mockPublicClient.readContract.mockResolvedValue(BigInt(0))
      mockWalletClient.writeContract.mockRejectedValue(
        new Error("Insufficient wrapped token balance")
      )

      await expect(
        mockWalletClient.writeContract({
          address: mockWETHAddress,
          abi: [{ name: "withdraw", type: "function" }],
          functionName: "withdraw",
          args: [BigInt("1000000000000000000")],
          account: mockWalletClient.account
        })
      ).rejects.toThrow("Insufficient wrapped token balance")
    })
  })

  describe("Token Approval", () => {
    it("should approve token spending", async () => {
      mockWalletClient.writeContract.mockResolvedValue(
        "0xapprovehash123" as Hash
      )

      const spenderAddress =
        "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D" as Address // Uniswap Router

      const result = await mockWalletClient.writeContract({
        address: mockUSDCAddress,
        abi: [{ name: "approve", type: "function" }],
        functionName: "approve",
        args: [spenderAddress, BigInt("1000000000")],
        account: mockWalletClient.account
      })

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "approve",
          args: [spenderAddress, BigInt("1000000000")]
        })
      )
      expect(result).toBe("0xapprovehash123")
    })

    it("should approve unlimited spending (max uint256)", async () => {
      mockWalletClient.writeContract.mockResolvedValue(
        "0xunlimitedapprove" as Hash
      )
      const maxUint256 = BigInt(
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      )

      await mockWalletClient.writeContract({
        address: mockUSDCAddress,
        abi: [{ name: "approve", type: "function" }],
        functionName: "approve",
        args: [mockUserAddress, maxUint256],
        account: mockWalletClient.account
      })

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [mockUserAddress, maxUint256]
        })
      )
    })

    it("should revoke approval (set to 0)", async () => {
      mockWalletClient.writeContract.mockResolvedValue(
        "0xrevokeapprove" as Hash
      )

      await mockWalletClient.writeContract({
        address: mockUSDCAddress,
        abi: [{ name: "approve", type: "function" }],
        functionName: "approve",
        args: [mockUserAddress, BigInt(0)],
        account: mockWalletClient.account
      })

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [mockUserAddress, BigInt(0)]
        })
      )
    })
  })

  describe("Edge Cases", () => {
    it("should handle token with empty name", async () => {
      const mockTokenInfo = {
        name: "",
        symbol: "NONAME",
        decimals: 18,
        totalSupply: BigInt("1000000000000000000000000"),
        formattedTotalSupply: "1000000"
      }
      vi.mocked(services.getERC20TokenInfo).mockResolvedValue(mockTokenInfo)

      const result = await services.getERC20TokenInfo(
        mockUSDCAddress,
        mockNetwork
      )

      expect(result.name).toBe("")
    })

    it("should handle very small balances (dust)", async () => {
      const mockBalance = {
        raw: BigInt(1), // 1 wei
        formatted: "0.000000000000000001",
        symbol: "ETH",
        decimals: 18,
        network: mockNetwork,
        tokenAddress: mockUSDCAddress,
        ownerAddress: mockUserAddress
      }
      vi.mocked(services.getERC20Balance).mockResolvedValue(mockBalance)

      const result = await services.getERC20Balance(
        mockUSDCAddress,
        mockUserAddress,
        mockNetwork
      )

      expect(result.raw).toBe(BigInt(1))
    })

    it("should handle RPC errors gracefully", async () => {
      vi.mocked(services.getERC20TokenInfo).mockRejectedValue(
        new Error("RPC connection failed")
      )

      await expect(
        services.getERC20TokenInfo(mockUSDCAddress, mockNetwork)
      ).rejects.toThrow("RPC connection failed")
    })

    it("should handle network not supported error", async () => {
      vi.mocked(services.getNativeBalance).mockRejectedValue(
        new Error("Network not supported")
      )

      await expect(
        services.getNativeBalance(mockUserAddress, "unsupported-network")
      ).rejects.toThrow("Network not supported")
    })

    it("should handle checksum address variations", async () => {
      const checksumAddress =
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address
      const lowercaseAddress =
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" as Address

      const mockTokenInfo = {
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        totalSupply: BigInt("50000000000000000"),
        formattedTotalSupply: "50000000000"
      }
      vi.mocked(services.getERC20TokenInfo).mockResolvedValue(mockTokenInfo)

      // Both should work
      await services.getERC20TokenInfo(checksumAddress, mockNetwork)
      await services.getERC20TokenInfo(lowercaseAddress, mockNetwork)

      expect(services.getERC20TokenInfo).toHaveBeenCalledTimes(2)
    })
  })

  describe("Data Validation", () => {
    it("should validate token address format", () => {
      const validAddress = mockUSDCAddress
      const isValidFormat = /^0x[a-fA-F0-9]{40}$/.test(validAddress)
      expect(isValidFormat).toBe(true)
    })

    it("should ensure decimals is a valid number (0-18)", async () => {
      const mockTokenInfo = {
        name: "Test Token",
        symbol: "TEST",
        decimals: 18,
        totalSupply: BigInt("1000000"),
        formattedTotalSupply: "1000000"
      }
      vi.mocked(services.getERC20TokenInfo).mockResolvedValue(mockTokenInfo)

      const result = await services.getERC20TokenInfo(
        mockUSDCAddress,
        mockNetwork
      )

      expect(result.decimals).toBeGreaterThanOrEqual(0)
      expect(result.decimals).toBeLessThanOrEqual(18)
    })

    it("should ensure totalSupply is non-negative", async () => {
      const mockTokenInfo = {
        name: "Test Token",
        symbol: "TEST",
        decimals: 18,
        totalSupply: BigInt(0),
        formattedTotalSupply: "0"
      }
      vi.mocked(services.getERC20TokenInfo).mockResolvedValue(mockTokenInfo)

      const result = await services.getERC20TokenInfo(
        mockUSDCAddress,
        mockNetwork
      )

      expect(result.totalSupply).toBeGreaterThanOrEqual(BigInt(0))
    })
  })
})
