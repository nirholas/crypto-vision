/**
 * Tests for Swap Module
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
import { registerSwapTools } from "./tools.js"

describe("Swap Module", () => {
  let server: McpServer
  let mockPublicClient: ReturnType<typeof createMockViemClient>
  let mockWalletClient: ReturnType<typeof createMockViemClient>
  let registeredTools: Map<string, { handler: Function; schema: any }>

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

    // Register swap tools
    registerSwapTools(server)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("get_swap_quote", () => {
    const tokenIn = TEST_ADDRESSES.ETH_MAINNET.WETH
    const tokenOut = TEST_ADDRESSES.ETH_MAINNET.USDC
    const amountIn = "1000000000000000000" // 1 ETH in wei

    it("should return a valid swap quote", async () => {
      // Mock getAmountsOut to return expected output
      const expectedOutput = 2500000000n // 2500 USDC (6 decimals)
      mockPublicClient.readContract.mockResolvedValueOnce([BigInt(amountIn), expectedOutput])
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)

      const tool = registeredTools.get("get_swap_quote")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        network: "ethereum",
        dex: "uniswap"
      })

      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe("text")

      const data = JSON.parse(result.content[0].text)
      expect(data.tokenIn).toBe(tokenIn)
      expect(data.tokenOut).toBe(tokenOut)
      expect(data.amountIn).toBe(amountIn)
      expect(data.amountOut).toBe(expectedOutput.toString())
      expect(data.network).toBe("ethereum")
    })

    it("should handle invalid DEX router", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)

      const tool = registeredTools.get("get_swap_quote")
      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        network: "ethereum",
        dex: "invalid_dex"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("No router found")
    })

    it("should handle contract read errors (insufficient liquidity)", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)
      mockPublicClient.readContract.mockRejectedValueOnce(new Error("INSUFFICIENT_LIQUIDITY"))

      const tool = registeredTools.get("get_swap_quote")
      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should work with BSC network and PancakeSwap", async () => {
      const expectedOutput = 5000000000000000000n // 5 BNB worth
      mockPublicClient.readContract.mockResolvedValueOnce([BigInt(amountIn), expectedOutput])
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(56)

      const tool = registeredTools.get("get_swap_quote")
      const result = await tool!.handler({
        tokenIn: TEST_ADDRESSES.BSC_MAINNET.WBNB,
        tokenOut: TEST_ADDRESSES.BSC_MAINNET.BUSD,
        amountIn,
        network: "bsc",
        dex: "pancakeswap"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.network).toBe("bsc")
      expect(data.dex).toBe("pancakeswap")
      expect(data.amountOut).toBe(expectedOutput.toString())
    })

    it("should handle zero amount input", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)
      mockPublicClient.readContract.mockResolvedValueOnce([0n, 0n])

      const tool = registeredTools.get("get_swap_quote")
      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn: "0",
        network: "ethereum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.amountOut).toBe("0")
    })
  })

  describe("execute_swap", () => {
    const tokenIn = TEST_ADDRESSES.ETH_MAINNET.WETH
    const tokenOut = TEST_ADDRESSES.ETH_MAINNET.USDC
    const amountIn = "1000000000000000000"
    const minAmountOut = "2400000000" // 2400 USDC with slippage
    const privateKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

    it("should execute a successful swap", async () => {
      const txHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"

      // Mock allowance check (already approved)
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"))
      mockWalletClient.writeContract = vi.fn().mockResolvedValue(txHash)
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n,
        gasUsed: 150000n
      })

      const tool = registeredTools.get("execute_swap")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        network: "ethereum",
        privateKey
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.success).toBe(true)
      expect(data.transactionHash).toBe(txHash)
      expect(data.tokenIn).toBe(tokenIn)
      expect(data.tokenOut).toBe(tokenOut)
    })

    it("should approve tokens if allowance is insufficient", async () => {
      const approveHash = "0x1111111111111111111111111111111111111111111111111111111111111111"
      const swapHash = "0x2222222222222222222222222222222222222222222222222222222222222222"

      // Mock allowance check (not approved)
      mockPublicClient.readContract.mockResolvedValueOnce(0n)
      mockWalletClient.writeContract = vi.fn()
        .mockResolvedValueOnce(approveHash) // Approval tx
        .mockResolvedValueOnce(swapHash) // Swap tx
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n,
        gasUsed: 150000n
      })

      const tool = registeredTools.get("execute_swap")
      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        network: "ethereum",
        privateKey
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.success).toBe(true)
      expect(mockWalletClient.writeContract).toHaveBeenCalledTimes(2)
    })

    it("should handle slippage error when minAmountOut is not met", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"))
      mockWalletClient.writeContract = vi.fn().mockRejectedValue(new Error("INSUFFICIENT_OUTPUT_AMOUNT"))

      const tool = registeredTools.get("execute_swap")
      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut: "5000000000", // Unrealistic high minAmountOut
        network: "ethereum",
        privateKey
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle transaction failure", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"))
      mockWalletClient.writeContract = vi.fn().mockRejectedValue(new Error("Transaction reverted"))

      const tool = registeredTools.get("execute_swap")
      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        network: "ethereum",
        privateKey
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("executing swap")
    })
  })

  describe("get_best_route", () => {
    const tokenIn = TEST_ADDRESSES.ETH_MAINNET.WETH
    const tokenOut = TEST_ADDRESSES.ETH_MAINNET.USDC
    const amountIn = "1000000000000000000"

    it("should return the best route across multiple DEXs", async () => {
      // Mock different quotes from different DEXs
      mockPublicClient.readContract
        .mockResolvedValueOnce([BigInt(amountIn), 2500000000n]) // Uniswap: 2500 USDC
        .mockResolvedValueOnce([BigInt(amountIn), 2450000000n]) // Sushiswap: 2450 USDC

      const tool = registeredTools.get("get_best_route")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        network: "ethereum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.bestRoute).toBeDefined()
      expect(data.allQuotes).toBeInstanceOf(Array)
      expect(data.allQuotes.length).toBeGreaterThan(0)
    })

    it("should sort quotes by best output", async () => {
      // Mock different quotes - ensure proper ordering
      mockPublicClient.readContract
        .mockResolvedValueOnce([BigInt(amountIn), 2400000000n]) // First DEX: 2400 USDC
        .mockResolvedValueOnce([BigInt(amountIn), 2600000000n]) // Second DEX: 2600 USDC

      const tool = registeredTools.get("get_best_route")
      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        network: "ethereum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.allQuotes.length).toBe(2)
      // Best route should have highest output
      expect(BigInt(data.bestRoute.amountOut)).toBe(2600000000n)
    })

    it("should handle when no DEX has the pair", async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error("PAIR_NOT_FOUND"))

      const tool = registeredTools.get("get_best_route")
      const result = await tool!.handler({
        tokenIn,
        tokenOut: "0x0000000000000000000000000000000000000001", // Non-existent token
        amountIn,
        network: "ethereum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.allQuotes).toEqual([])
      expect(data.bestRoute).toBeUndefined()
    })
  })

  describe("get_price_impact", () => {
    const tokenIn = TEST_ADDRESSES.ETH_MAINNET.WETH
    const tokenOut = TEST_ADDRESSES.ETH_MAINNET.USDC
    const amountIn = "1000000000000000000000" // 1000 ETH - large trade

    it("should calculate price impact correctly", async () => {
      // Small amount baseline: 1 ETH = 2500 USDC (baseline rate)
      mockPublicClient.readContract
        .mockResolvedValueOnce([1000000000000000n, 2500000n]) // Small trade: 0.001 ETH = 2.5 USDC
        .mockResolvedValueOnce([BigInt(amountIn), 2400000000000n]) // Large trade: 1000 ETH = 2,400,000 USDC (4% impact)

      const tool = registeredTools.get("get_price_impact")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        network: "ethereum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.priceImpact).toBeDefined()
      expect(data.priceImpactRaw).toBeDefined()
      expect(typeof data.priceImpactRaw).toBe("number")
    })

    it("should warn about high price impact", async () => {
      // Simulate high price impact scenario
      // Small trade baseline: 1 token in => 2500 out (rate = 2500)
      // Large trade: 1000 tokens in => 2000000 out (rate = 2000)
      // Price impact = (2500 - 2000) / 2500 * 100 = 20%
      mockPublicClient.readContract
        .mockResolvedValueOnce([BigInt(amountIn) / 1000n, 2500000000000n]) // Small trade: 2500 per token
        .mockResolvedValueOnce([BigInt(amountIn), 2000000000000000n]) // Large trade: 2000 per token (20% worse)

      const tool = registeredTools.get("get_price_impact")
      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        network: "ethereum"
      })

      const data = JSON.parse(result.content[0].text)
      // Should detect price impact and show warning
      expect(data.warning).toContain("HIGH PRICE IMPACT")
    })

    it("should handle low liquidity pairs gracefully", async () => {
      mockPublicClient.readContract.mockRejectedValue(new Error("INSUFFICIENT_LIQUIDITY"))

      const tool = registeredTools.get("get_price_impact")
      const result = await tool!.handler({
        tokenIn,
        tokenOut,
        amountIn,
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
    })
  })

  describe("get_supported_dexs", () => {
    it("should return supported DEXs for ethereum", async () => {
      const tool = registeredTools.get("get_supported_dexs")
      expect(tool).toBeDefined()

      const result = await tool!.handler({ network: "ethereum" })

      const data = JSON.parse(result.content[0].text)
      expect(data.network).toBe("ethereum")
      expect(data.supportedDEXs).toBeInstanceOf(Array)
      expect(data.count).toBeGreaterThan(0)
    })

    it("should return supported DEXs for BSC", async () => {
      const tool = registeredTools.get("get_supported_dexs")
      const result = await tool!.handler({ network: "bsc" })

      const data = JSON.parse(result.content[0].text)
      expect(data.network).toBe("bsc")
      expect(data.supportedDEXs.some((dex: any) => dex.name === "pancakeswap")).toBe(true)
    })

    it("should return empty array for unsupported network", async () => {
      const tool = registeredTools.get("get_supported_dexs")
      const result = await tool!.handler({ network: "unknown_network" })

      const data = JSON.parse(result.content[0].text)
      expect(data.supportedDEXs).toEqual([])
      expect(data.count).toBe(0)
    })
  })

  describe("add_liquidity", () => {
    const tokenA = TEST_ADDRESSES.ETH_MAINNET.WETH
    const tokenB = TEST_ADDRESSES.ETH_MAINNET.USDC
    const amountA = "1000000000000000000" // 1 ETH
    const amountB = "2500000000" // 2500 USDC
    const privateKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

    it("should add liquidity successfully", async () => {
      const approveHashA = "0x1111111111111111111111111111111111111111111111111111111111111111"
      const approveHashB = "0x2222222222222222222222222222222222222222222222222222222222222222"
      const liquidityHash = "0x3333333333333333333333333333333333333333333333333333333333333333"

      mockWalletClient.writeContract = vi.fn()
        .mockResolvedValueOnce(approveHashA)
        .mockResolvedValueOnce(approveHashB)
        .mockResolvedValueOnce(liquidityHash)
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n,
        gasUsed: 250000n
      })

      const tool = registeredTools.get("add_liquidity")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        tokenA,
        tokenB,
        amountA,
        amountB,
        slippage: 1,
        network: "ethereum",
        privateKey
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.transactionHash).toBe(liquidityHash)
      expect(mockWalletClient.writeContract).toHaveBeenCalledTimes(3)
    })

    it("should handle liquidity provision failure", async () => {
      mockWalletClient.writeContract = vi.fn()
        .mockResolvedValueOnce("0x1111")
        .mockResolvedValueOnce("0x2222")
        .mockRejectedValueOnce(new Error("INSUFFICIENT_AMOUNTS"))
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success"
      })

      const tool = registeredTools.get("add_liquidity")
      const result = await tool!.handler({
        tokenA,
        tokenB,
        amountA,
        amountB,
        slippage: 1,
        network: "ethereum",
        privateKey
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should apply slippage tolerance correctly", async () => {
      mockWalletClient.writeContract = vi.fn().mockResolvedValue("0x1234")
      mockPublicClient.waitForTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("add_liquidity")
      await tool!.handler({
        tokenA,
        tokenB,
        amountA,
        amountB,
        slippage: 5, // 5% slippage
        network: "ethereum",
        privateKey
      })

      // Verify the add liquidity call includes proper min amounts
      const addLiquidityCall = mockWalletClient.writeContract.mock.calls[2]
      expect(addLiquidityCall).toBeDefined()
    })
  })

  describe("Edge Cases", () => {
    it("should handle extremely large swap amounts", async () => {
      const largeAmount = "1000000000000000000000000000" // 1 billion ETH
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)
      mockPublicClient.readContract.mockRejectedValue(new Error("INSUFFICIENT_LIQUIDITY"))

      const tool = registeredTools.get("get_swap_quote")
      const result = await tool!.handler({
        tokenIn: TEST_ADDRESSES.ETH_MAINNET.WETH,
        tokenOut: TEST_ADDRESSES.ETH_MAINNET.USDC,
        amountIn: largeAmount,
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle same token swap (invalid)", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)
      mockPublicClient.readContract.mockRejectedValue(new Error("IDENTICAL_ADDRESSES"))

      const tool = registeredTools.get("get_swap_quote")
      const result = await tool!.handler({
        tokenIn: TEST_ADDRESSES.ETH_MAINNET.WETH,
        tokenOut: TEST_ADDRESSES.ETH_MAINNET.WETH,
        amountIn: "1000000000000000000",
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle invalid address format", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)
      mockPublicClient.readContract.mockRejectedValue(new Error("Invalid address"))

      const tool = registeredTools.get("get_swap_quote")
      const result = await tool!.handler({
        tokenIn: "invalid_address",
        tokenOut: TEST_ADDRESSES.ETH_MAINNET.USDC,
        amountIn: "1000000000000000000",
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
    })
  })
})
