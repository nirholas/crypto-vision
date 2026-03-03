/**
 * Tests for gas module tools
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Mock the clients
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn((network: string) => ({
    getChainId: vi.fn().mockResolvedValue(1),
    getGasPrice: vi.fn().mockResolvedValue(20000000000n), // 20 gwei
    estimateFeesPerGas: vi.fn().mockResolvedValue({
      maxFeePerGas: 30000000000n,
      maxPriorityFeePerGas: 2000000000n
    }),
    estimateGas: vi.fn().mockResolvedValue(21000n)
  }))
}))

import { registerGasTools } from "@/evm/modules/gas/tools"
import { getPublicClient } from "@/evm/services/clients.js"

describe("Gas Module Tools", () => {
  let server: McpServer
  let registeredTools: Map<string, { handler: Function; schema: object }>

  beforeEach(() => {
    vi.clearAllMocks()
    registeredTools = new Map()
    
    // Create a mock server that captures tool registrations
    server = {
      tool: vi.fn((name, description, schema, handler) => {
        registeredTools.set(name, { handler, schema })
      })
    } as unknown as McpServer

    registerGasTools(server)
  })

  describe("tool registration", () => {
    it("should register get_gas_price tool", () => {
      expect(registeredTools.has("get_gas_price")).toBe(true)
    })

    it("should register get_gas_prices_all_chains tool", () => {
      expect(registeredTools.has("get_gas_prices_all_chains")).toBe(true)
    })

    it("should register get_eip1559_fees tool", () => {
      expect(registeredTools.has("get_eip1559_fees")).toBe(true)
    })
  })

  describe("get_gas_price", () => {
    it("should return gas price for a network", async () => {
      const tool = registeredTools.get("get_gas_price")
      expect(tool).toBeDefined()

      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      // mcpToolRes.success returns data directly, not wrapped
      expect(data.chainId).toBe(1)
      expect(data.gasPrice).toBeDefined()
    })

    it("should include EIP-1559 fees for supported networks", async () => {
      const tool = registeredTools.get("get_gas_price")
      const result = await tool!.handler({ network: "ethereum" })
      const data = JSON.parse(result.content[0].text)

      expect(data.eip1559).toBeDefined()
      expect(data.eip1559.maxFeePerGas).toBeDefined()
      expect(data.eip1559.maxPriorityFeePerGas).toBeDefined()
    })
  })

  describe("get_gas_prices_all_chains", () => {
    it("should return gas prices for multiple chains", async () => {
      const tool = registeredTools.get("get_gas_prices_all_chains")
      expect(tool).toBeDefined()

      const result = await tool!.handler({})
      const data = JSON.parse(result.content[0].text)

      // mcpToolRes.success returns data directly
      expect(data.prices).toBeInstanceOf(Array)
      expect(data.prices.length).toBeGreaterThan(0)
      expect(data.cheapest).toBeDefined()
      expect(data.mostExpensive).toBeDefined()
    })
  })
})
