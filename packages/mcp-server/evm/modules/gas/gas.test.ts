/**
 * Comprehensive tests for gas module tools
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn()
}))

import { registerGasTools } from "./tools.js"
import { getPublicClient } from "@/evm/services/clients.js"

describe("Gas Module Tools", () => {
  let server: McpServer
  let registeredTools: Map<string, { handler: Function; schema: object; description: string }>
  let mockClient: any

  beforeEach(() => {
    vi.clearAllMocks()
    registeredTools = new Map()

    // Create comprehensive mock client
    mockClient = {
      getChainId: vi.fn().mockResolvedValue(1),
      getGasPrice: vi.fn().mockResolvedValue(20000000000n), // 20 gwei
      estimateFeesPerGas: vi.fn().mockResolvedValue({
        maxFeePerGas: 30000000000n,
        maxPriorityFeePerGas: 2000000000n
      }),
      estimateGas: vi.fn().mockResolvedValue(21000n),
      getBlock: vi.fn().mockResolvedValue({
        number: 18000000n,
        baseFeePerGas: 25000000000n,
        timestamp: 1700000000n,
        hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      }),
      getBlockNumber: vi.fn().mockResolvedValue(18000000n)
    }

    vi.mocked(getPublicClient).mockReturnValue(mockClient)

    // Create a mock server that captures tool registrations
    server = {
      tool: vi.fn((name, description, schema, handler) => {
        registeredTools.set(name, { handler, schema, description })
      })
    } as unknown as McpServer

    registerGasTools(server)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all gas tools", () => {
      expect(registeredTools.has("get_gas_price")).toBe(true)
      expect(registeredTools.has("get_gas_prices_all_chains")).toBe(true)
      expect(registeredTools.has("get_eip1559_fees")).toBe(true)
      expect(registeredTools.has("estimate_gas")).toBe(true)
      expect(registeredTools.has("get_standard_gas_limits")).toBe(true)
      expect(registeredTools.has("calculate_tx_cost")).toBe(true)
      expect(registeredTools.has("get_gas_history")).toBe(true)
    })

    it("should have correct descriptions for tools", () => {
      const gasPriceTool = registeredTools.get("get_gas_price")
      expect(gasPriceTool?.description).toBe("Get current gas price for a network")
    })
  })

  describe("get_gas_price", () => {
    it("should return gas price for ethereum network", async () => {
      const tool = registeredTools.get("get_gas_price")
      expect(tool).toBeDefined()

      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.chainId).toBe(1)
      expect(data.gasPrice).toBeDefined()
      expect(data.gasPriceWei).toBe("20000000000")
      expect(data.nativeSymbol).toBe("ETH")
    })

    it("should include EIP-1559 fees for supported networks", async () => {
      const tool = registeredTools.get("get_gas_price")
      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      expect(data.eip1559).toBeDefined()
      expect(data.eip1559.maxFeePerGas).toBeDefined()
      expect(data.eip1559.maxPriorityFeePerGas).toBeDefined()
    })

    it("should handle non-EIP1559 chains (BSC)", async () => {
      mockClient.getChainId.mockResolvedValue(56)
      mockClient.estimateFeesPerGas.mockRejectedValue(new Error("EIP-1559 not supported"))

      const tool = registeredTools.get("get_gas_price")
      const result = await tool!.handler({ network: "bsc" })
      const data = JSON.parse(result.content[0].text)

      expect(data.chainId).toBe(56)
      expect(data.eip1559).toBeNull()
    })

    it("should handle errors gracefully", async () => {
      mockClient.getGasPrice.mockRejectedValue(new Error("RPC Error"))

      const tool = registeredTools.get("get_gas_price")
      const result = await tool!.handler({ network: "ethereum" })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("getting gas price")
    })

    it("should return different native symbols for different chains", async () => {
      mockClient.getChainId.mockResolvedValue(137)

      const tool = registeredTools.get("get_gas_price")
      const result = await tool!.handler({ network: "polygon" })
      const data = JSON.parse(result.content[0].text)

      expect(data.nativeSymbol).toBe("MATIC")
    })
  })

  describe("get_gas_prices_all_chains", () => {
    it("should return gas prices for multiple chains", async () => {
      const tool = registeredTools.get("get_gas_prices_all_chains")
      expect(tool).toBeDefined()

      const result = await tool!.handler({})
      const data = JSON.parse(result.content[0].text)

      expect(data.prices).toBeInstanceOf(Array)
      expect(data.prices.length).toBeGreaterThan(0)
      expect(data.cheapest).toBeDefined()
      expect(data.mostExpensive).toBeDefined()
      expect(data.timestamp).toBeDefined()
    })

    it("should sort prices from cheapest to most expensive", async () => {
      // Mock different gas prices for different chains
      let callCount = 0
      mockClient.getGasPrice.mockImplementation(() => {
        callCount++
        // Return different prices for different chains
        return Promise.resolve(BigInt(10000000000 + callCount * 5000000000))
      })

      const tool = registeredTools.get("get_gas_prices_all_chains")
      const result = await tool!.handler({})
      const data = JSON.parse(result.content[0].text)

      const prices = data.prices.map((p: any) => parseFloat(p.gasPrice))
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
      }
    })

    it("should handle partial failures gracefully", async () => {
      let callCount = 0
      vi.mocked(getPublicClient).mockImplementation((network) => {
        callCount++
        if (network === "polygon") {
          return {
            getChainId: vi.fn().mockRejectedValue(new Error("Network error")),
            getGasPrice: vi.fn().mockRejectedValue(new Error("Network error"))
          } as any
        }
        return mockClient
      })

      const tool = registeredTools.get("get_gas_prices_all_chains")
      const result = await tool!.handler({})
      const data = JSON.parse(result.content[0].text)

      // Should still return results, with error status for failed networks
      expect(data.prices).toBeInstanceOf(Array)
      const errorPrice = data.prices.find((p: any) => p.status === "error")
      expect(errorPrice).toBeDefined()
    })
  })

  describe("get_eip1559_fees", () => {
    it("should return detailed EIP-1559 fee data", async () => {
      const tool = registeredTools.get("get_eip1559_fees")
      expect(tool).toBeDefined()

      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.baseFee).toBeDefined()
      expect(data.baseFeeWei).toBeDefined()
      expect(data.maxFeePerGas).toBeDefined()
      expect(data.maxPriorityFeePerGas).toBeDefined()
      expect(data.recommendations).toBeDefined()
    })

    it("should include speed recommendations", async () => {
      const tool = registeredTools.get("get_eip1559_fees")
      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      expect(data.recommendations.slow).toBeDefined()
      expect(data.recommendations.standard).toBeDefined()
      expect(data.recommendations.fast).toBeDefined()
    })

    it("should include block number", async () => {
      const tool = registeredTools.get("get_eip1559_fees")
      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      expect(data.blockNumber).toBe("18000000")
    })
  })

  describe("estimate_gas", () => {
    it("should estimate gas for a simple ETH transfer", async () => {
      const tool = registeredTools.get("estimate_gas")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        value: "1000000000000000000"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.gasEstimate).toBe("21000")
      expect(data.gasPrice).toBeDefined()
      expect(data.estimatedCost).toBeDefined()
      expect(data.estimatedCost.wei).toBeDefined()
      expect(data.estimatedCost.nativeToken).toBeDefined()
    })

    it("should estimate gas for contract call with data", async () => {
      mockClient.estimateGas.mockResolvedValue(65000n)

      const tool = registeredTools.get("estimate_gas")
      const result = await tool!.handler({
        network: "ethereum",
        from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        data: "0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.gasEstimate).toBe("65000")
    })

    it("should handle estimation errors", async () => {
      mockClient.estimateGas.mockRejectedValue(new Error("execution reverted"))

      const tool = registeredTools.get("estimate_gas")
      const result = await tool!.handler({
        network: "ethereum",
        from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("estimating gas")
    })

    it("should calculate correct estimated cost", async () => {
      // 21000 gas * 20 gwei = 420000 gwei = 0.00042 ETH
      const tool = registeredTools.get("estimate_gas")
      const result = await tool!.handler({
        network: "ethereum",
        from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
      const data = JSON.parse(result.content[0].text)

      const expectedCostWei = 21000n * 20000000000n
      expect(data.estimatedCost.wei).toBe(expectedCostWei.toString())
    })
  })

  describe("get_standard_gas_limits", () => {
    it("should return all standard gas limits", async () => {
      const tool = registeredTools.get("get_standard_gas_limits")
      expect(tool).toBeDefined()

      const result = await tool!.handler({})
      const data = JSON.parse(result.content[0].text)

      expect(data.limits).toBeInstanceOf(Array)
      expect(data.limits.length).toBeGreaterThan(0)
      expect(data.note).toBeDefined()
    })

    it("should return specific operation gas limit", async () => {
      const tool = registeredTools.get("get_standard_gas_limits")
      const result = await tool!.handler({ operationType: "transfer" })
      const data = JSON.parse(result.content[0].text)

      expect(data.operation).toBe("transfer")
      expect(data.gasLimit).toBe("21000")
    })

    it("should return gas limit for ERC20 transfer", async () => {
      const tool = registeredTools.get("get_standard_gas_limits")
      const result = await tool!.handler({ operationType: "erc20Transfer" })
      const data = JSON.parse(result.content[0].text)

      expect(data.operation).toBe("erc20Transfer")
      expect(data.gasLimit).toBe("65000")
    })

    it("should return gas limit for swap operation", async () => {
      const tool = registeredTools.get("get_standard_gas_limits")
      const result = await tool!.handler({ operationType: "swap" })
      const data = JSON.parse(result.content[0].text)

      expect(data.operation).toBe("swap")
      expect(data.gasLimit).toBe("200000")
    })

    it("should handle unknown operation type", async () => {
      const tool = registeredTools.get("get_standard_gas_limits")
      const result = await tool!.handler({ operationType: "unknownOperation" })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("Unknown operation")
    })
  })

  describe("calculate_tx_cost", () => {
    it("should calculate transaction cost with current gas price", async () => {
      const tool = registeredTools.get("calculate_tx_cost")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        gasLimit: "21000"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.gasLimit).toBe("21000")
      expect(data.gasPrice).toBeDefined()
      expect(data.totalCost).toBeDefined()
      expect(data.totalCost.wei).toBeDefined()
      expect(data.totalCost.native).toBeDefined()
      expect(data.totalCost.symbol).toBe("ETH")
    })

    it("should calculate cost with custom gas price", async () => {
      const tool = registeredTools.get("calculate_tx_cost")
      const result = await tool!.handler({
        network: "ethereum",
        gasLimit: "21000",
        gasPriceGwei: "50"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.gasPrice).toBe("50")
      // 21000 * 50 gwei = 1050000 gwei = 0.00105 ETH
      expect(parseFloat(data.totalCost.native)).toBeCloseTo(0.00105, 5)
    })

    it("should handle different networks correctly", async () => {
      mockClient.getChainId.mockResolvedValue(56)

      const tool = registeredTools.get("calculate_tx_cost")
      const result = await tool!.handler({
        network: "bsc",
        gasLimit: "21000"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.totalCost.symbol).toBe("BNB")
    })
  })

  describe("get_gas_history", () => {
    it("should return gas history for default number of blocks", async () => {
      const tool = registeredTools.get("get_gas_history")
      expect(tool).toBeDefined()

      // Mock multiple block fetches
      mockClient.getBlock.mockImplementation(({ blockNumber, blockTag }: any) => {
        const num = blockTag === "latest" ? 18000000n : blockNumber
        return Promise.resolve({
          number: num,
          baseFeePerGas: 25000000000n + (18000000n - num) * 1000000000n,
          timestamp: 1700000000n - (18000000n - num) * 12n
        })
      })

      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.blocksAnalyzed).toBe(10)
      expect(data.history).toBeInstanceOf(Array)
      expect(data.history.length).toBe(10)
      expect(data.statistics).toBeDefined()
    })

    it("should return gas history for custom number of blocks", async () => {
      mockClient.getBlock.mockImplementation(({ blockNumber, blockTag }: any) => {
        const num = blockTag === "latest" ? 18000000n : blockNumber
        return Promise.resolve({
          number: num,
          baseFeePerGas: 25000000000n,
          timestamp: 1700000000n
        })
      })

      const tool = registeredTools.get("get_gas_history")
      const result = await tool!.handler({ network: "ethereum", blocks: 5 })
      const data = JSON.parse(result.content[0].text)

      expect(data.blocksAnalyzed).toBe(5)
      expect(data.history.length).toBe(5)
    })

    it("should calculate statistics correctly", async () => {
      // Mock blocks with known base fees
      const baseFees = [20n, 25n, 30n, 35n, 40n].map(f => f * 1000000000n)
      let blockIndex = 0

      mockClient.getBlock.mockImplementation(({ blockNumber, blockTag }: any) => {
        const num = blockTag === "latest" ? 18000000n : blockNumber
        const baseFee = baseFees[blockIndex++ % baseFees.length]
        return Promise.resolve({
          number: num,
          baseFeePerGas: baseFee,
          timestamp: 1700000000n
        })
      })

      const tool = registeredTools.get("get_gas_history")
      const result = await tool!.handler({ network: "ethereum", blocks: 5 })
      const data = JSON.parse(result.content[0].text)

      expect(data.statistics).toBeDefined()
      expect(data.statistics.average).toBeDefined()
      expect(data.statistics.min).toBeDefined()
      expect(data.statistics.max).toBeDefined()
    })

    it("should handle blocks without base fee", async () => {
      mockClient.getBlock.mockImplementation(({ blockNumber, blockTag }: any) => {
        const num = blockTag === "latest" ? 18000000n : blockNumber
        return Promise.resolve({
          number: num,
          baseFeePerGas: null, // Pre-London fork
          timestamp: 1700000000n
        })
      })

      const tool = registeredTools.get("get_gas_history")
      const result = await tool!.handler({ network: "bsc", blocks: 3 })
      const data = JSON.parse(result.content[0].text)

      expect(data.history[0].baseFee).toBeNull()
      expect(data.statistics).toBeNull()
    })

    it("should handle errors gracefully", async () => {
      mockClient.getBlock.mockRejectedValue(new Error("Block not found"))

      const tool = registeredTools.get("get_gas_history")
      const result = await tool!.handler({ network: "ethereum" })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("getting gas history")
    })
  })

  describe("Edge Cases", () => {
    it("should handle very high gas prices", async () => {
      mockClient.getGasPrice.mockResolvedValue(1000000000000n) // 1000 gwei

      const tool = registeredTools.get("get_gas_price")
      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      expect(parseFloat(data.gasPrice)).toBe(1000)
    })

    it("should handle very low gas prices", async () => {
      mockClient.getGasPrice.mockResolvedValue(100000000n) // 0.1 gwei

      const tool = registeredTools.get("get_gas_price")
      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      expect(parseFloat(data.gasPrice)).toBe(0.1)
    })

    it("should handle zero value in estimate_gas", async () => {
      const tool = registeredTools.get("estimate_gas")
      const result = await tool!.handler({
        network: "ethereum",
        from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        // No value specified
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.gasEstimate).toBeDefined()
    })

    it("should handle unknown chain IDs", async () => {
      mockClient.getChainId.mockResolvedValue(999999)

      const tool = registeredTools.get("get_gas_price")
      const result = await tool!.handler({ network: "custom" })
      const data = JSON.parse(result.content[0].text)

      // Should still work but with default symbol
      expect(data.nativeSymbol).toBe("ETH")
    })
  })
})
