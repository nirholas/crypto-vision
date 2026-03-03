/**
 * Tests for Bridge Module
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
import { registerBridgeTools } from "./tools.js"

describe("Bridge Module", () => {
  let server: McpServer
  let mockPublicClient: ReturnType<typeof createMockViemClient>
  let mockWalletClient: ReturnType<typeof createMockViemClient>
  let registeredTools: Map<string, { handler: Function; schema: any }>

  // Test addresses
  const MOCK_USER_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f1E123"
  const MOCK_PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  const MOCK_USDC_ADDRESS = TEST_ADDRESSES.ETH_MAINNET.USDC
  const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"

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

    // Register bridge tools
    registerBridgeTools(server)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("get_bridge_quote", () => {
    const token = MOCK_USDC_ADDRESS
    const amount = "1000000000" // 1000 USDC (6 decimals)

    it("should return bridge quotes for valid route", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.token).toBe(token)
      expect(data.amount).toBe(amount)
      expect(data.sourceChain).toBe("ethereum")
      expect(data.destChain).toBe("arbitrum")
      expect(data.quotes).toBeInstanceOf(Array)
      expect(data.quotes.length).toBeGreaterThan(0)
      expect(data.bestBridge).toBeDefined()
    })

    it("should return quotes sorted by best output", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "polygon"
      })

      const data = JSON.parse(result.content[0].text)
      
      // Verify quotes are sorted by estimated output (descending)
      for (let i = 0; i < data.quotes.length - 1; i++) {
        expect(BigInt(data.quotes[i].estimatedOutput)).toBeGreaterThanOrEqual(
          BigInt(data.quotes[i + 1].estimatedOutput)
        )
      }
    })

    it("should filter to specific bridge when specified", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "stargate"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.quotes.length).toBe(1)
      expect(data.quotes[0].bridge).toBe("Stargate")
    })

    it("should handle invalid source chain", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "invalid_chain",
        destChain: "arbitrum"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("Invalid chain name")
    })

    it("should handle invalid destination chain", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "invalid_chain"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should return warning when no bridges support route", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "fantom", // Limited bridge support
        bridge: "across" // Across doesn't support Fantom
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.quotes).toEqual([])
      expect(data.bestBridge).toBeNull()
      expect(data.warning).toContain("No bridges support")
    })

    it("should calculate fees correctly", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum"
      })

      const data = JSON.parse(result.content[0].text)
      
      for (const quote of data.quotes) {
        const fee = BigInt(quote.fee)
        const output = BigInt(quote.estimatedOutput)
        // Output + fee should approximately equal input amount
        expect(fee + output).toBeLessThanOrEqual(BigInt(amount))
      }
    })

    it("should handle zero amount", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token,
        amount: "0",
        sourceChain: "ethereum",
        destChain: "arbitrum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.quotes[0].estimatedOutput).toBe("0")
      expect(data.quotes[0].fee).toBe("0")
    })
  })

  describe("execute_bridge", () => {
    const token = MOCK_USDC_ADDRESS
    const amount = "1000000000"

    it("should prepare bridge transaction successfully", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)

      const tool = registeredTools.get("execute_bridge")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "stargate",
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.status).toBe("pending")
      expect(data.details.token).toBe(token)
      expect(data.details.amount).toBe(amount)
      expect(data.details.sourceChain).toBe("ethereum")
      expect(data.details.destChain).toBe("arbitrum")
      expect(data.details.bridge).toBe("Stargate")
      expect(data.details.estimatedTime).toBeDefined()
    })

    it("should use sender address as recipient when not specified", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)

      const tool = registeredTools.get("execute_bridge")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "stargate",
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.details.recipient).toBe(MOCK_USER_ADDRESS)
    })

    it("should use custom recipient when specified", async () => {
      const customRecipient = "0x9999999999999999999999999999999999999999"
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)

      const tool = registeredTools.get("execute_bridge")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "stargate",
        privateKey: MOCK_PRIVATE_KEY,
        recipient: customRecipient
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.details.recipient).toBe(customRecipient)
    })

    it("should handle unsupported bridge", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)

      const tool = registeredTools.get("execute_bridge")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "unknown_bridge",
        privateKey: MOCK_PRIVATE_KEY
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("not supported")
    })

    it("should handle bridge not available on source chain", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(999) // Unknown chain

      const tool = registeredTools.get("execute_bridge")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "stargate",
        privateKey: MOCK_PRIVATE_KEY
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("not available")
    })

    it("should include estimated time in response", async () => {
      mockPublicClient.getChainId = vi.fn().mockResolvedValue(1)

      const tool = registeredTools.get("execute_bridge")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "polygon",
        bridge: "layerzero",
        privateKey: MOCK_PRIVATE_KEY
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.details.estimatedTime).toBe("5-20 minutes")
    })
  })

  describe("get_bridge_status", () => {
    it("should return bridge status for confirmed source transaction", async () => {
      mockPublicClient.getTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("get_bridge_status")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        txHash: MOCK_TX_HASH,
        sourceChain: "ethereum",
        bridge: "stargate"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.txHash).toBe(MOCK_TX_HASH)
      expect(data.sourceChain).toBe("ethereum")
      expect(data.bridge).toBe("stargate")
      expect(data.sourceStatus).toBe("confirmed")
      expect(data.sourceBlockNumber).toBe("18000000")
      expect(data.destinationStatus).toBe("pending")
      expect(data.estimatedCompletion).toBeDefined()
    })

    it("should return failed status for reverted transaction", async () => {
      mockPublicClient.getTransactionReceipt = vi.fn().mockResolvedValue({
        status: "reverted",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("get_bridge_status")
      const result = await tool!.handler({
        txHash: MOCK_TX_HASH,
        sourceChain: "ethereum",
        bridge: "stargate"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.sourceStatus).toBe("failed")
    })

    it("should handle transaction not found", async () => {
      mockPublicClient.getTransactionReceipt = vi.fn().mockRejectedValue(
        new Error("Transaction not found")
      )

      const tool = registeredTools.get("get_bridge_status")
      const result = await tool!.handler({
        txHash: MOCK_TX_HASH,
        sourceChain: "ethereum",
        bridge: "stargate"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should return estimated completion time for different bridges", async () => {
      mockPublicClient.getTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("get_bridge_status")
      
      // Test Stargate
      let result = await tool!.handler({
        txHash: MOCK_TX_HASH,
        sourceChain: "ethereum",
        bridge: "stargate"
      })
      let data = JSON.parse(result.content[0].text)
      expect(data.estimatedCompletion).toBe("10-30 minutes")

      // Test Across (faster)
      result = await tool!.handler({
        txHash: MOCK_TX_HASH,
        sourceChain: "ethereum",
        bridge: "across"
      })
      data = JSON.parse(result.content[0].text)
      expect(data.estimatedCompletion).toBe("2-10 minutes")
    })

    it("should return unknown for unsupported bridge time estimate", async () => {
      mockPublicClient.getTransactionReceipt = vi.fn().mockResolvedValue({
        status: "success",
        blockNumber: 18000000n
      })

      const tool = registeredTools.get("get_bridge_status")
      const result = await tool!.handler({
        txHash: MOCK_TX_HASH,
        sourceChain: "ethereum",
        bridge: "unknown_bridge"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.estimatedCompletion).toBe("unknown")
    })
  })

  describe("get_supported_bridges", () => {
    it("should return all supported bridges when no filters", async () => {
      const tool = registeredTools.get("get_supported_bridges")
      expect(tool).toBeDefined()

      const result = await tool!.handler({})

      const data = JSON.parse(result.content[0].text)
      expect(data.bridges).toBeInstanceOf(Array)
      expect(data.totalCount).toBeGreaterThan(0)
      
      // Should include major bridges
      const bridgeNames = data.bridges.map((b: any) => b.id)
      expect(bridgeNames).toContain("stargate")
      expect(bridgeNames).toContain("layerzero")
      expect(bridgeNames).toContain("wormhole")
      expect(bridgeNames).toContain("across")
    })

    it("should filter by source chain", async () => {
      const tool = registeredTools.get("get_supported_bridges")
      const result = await tool!.handler({
        sourceChain: "ethereum"
      })

      const data = JSON.parse(result.content[0].text)
      // All returned bridges should support ethereum
      for (const bridge of data.bridges) {
        expect(bridge.supportsRoute).toBe(true)
      }
    })

    it("should filter by destination chain", async () => {
      const tool = registeredTools.get("get_supported_bridges")
      const result = await tool!.handler({
        destChain: "arbitrum"
      })

      const data = JSON.parse(result.content[0].text)
      for (const bridge of data.bridges) {
        expect(bridge.supportsRoute).toBe(true)
      }
    })

    it("should filter by both source and destination", async () => {
      const tool = registeredTools.get("get_supported_bridges")
      const result = await tool!.handler({
        sourceChain: "ethereum",
        destChain: "base"
      })

      const data = JSON.parse(result.content[0].text)
      // Should return bridges that support both chains
      expect(data.bridges.some((b: any) => b.supportsRoute)).toBe(true)
    })

    it("should include estimated time for each bridge", async () => {
      const tool = registeredTools.get("get_supported_bridges")
      const result = await tool!.handler({})

      const data = JSON.parse(result.content[0].text)
      for (const bridge of data.bridges) {
        expect(bridge.estimatedTime).toBeDefined()
        expect(bridge.estimatedTime).toContain("minutes")
      }
    })

    it("should include supported chains list", async () => {
      const tool = registeredTools.get("get_supported_bridges")
      const result = await tool!.handler({})

      const data = JSON.parse(result.content[0].text)
      for (const bridge of data.bridges) {
        expect(bridge.supportedChains).toBeInstanceOf(Array)
        expect(bridge.supportedChains.length).toBeGreaterThan(0)
      }
    })
  })

  describe("estimate_bridge_time", () => {
    it("should return time estimates for all bridges", async () => {
      const tool = registeredTools.get("estimate_bridge_time")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        sourceChain: "ethereum",
        destChain: "arbitrum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.estimates).toBeInstanceOf(Array)
      expect(data.estimates.length).toBeGreaterThan(0)
      
      for (const estimate of data.estimates) {
        expect(estimate.bridge).toBeDefined()
        expect(estimate.estimatedTime).toBeDefined()
        expect(estimate.factors).toBeInstanceOf(Array)
      }
    })

    it("should filter to specific bridge when provided", async () => {
      const tool = registeredTools.get("estimate_bridge_time")
      const result = await tool!.handler({
        sourceChain: "ethereum",
        destChain: "polygon",
        bridge: "stargate"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.estimates.length).toBe(1)
      expect(data.estimates[0].bridge).toBe("Stargate")
    })

    it("should include factors affecting time", async () => {
      const tool = registeredTools.get("estimate_bridge_time")
      const result = await tool!.handler({
        sourceChain: "ethereum",
        destChain: "arbitrum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.estimates[0].factors).toContain("Source chain finality")
      expect(data.estimates[0].factors).toContain("Bridge protocol verification")
      expect(data.estimates[0].factors).toContain("Destination chain confirmation")
    })

    it("should include note about time variability", async () => {
      const tool = registeredTools.get("estimate_bridge_time")
      const result = await tool!.handler({
        sourceChain: "ethereum",
        destChain: "polygon"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.note).toContain("network congestion")
    })
  })

  describe("get_bridge_fees", () => {
    const token = MOCK_USDC_ADDRESS
    const amount = "1000000000000000000" // 1 ETH worth

    it("should return detailed fee breakdown", async () => {
      const tool = registeredTools.get("get_bridge_fees")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "stargate"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.bridge).toBe("Stargate")
      expect(data.fees.protocolFee).toBeDefined()
      expect(data.fees.protocolFeePercent).toBe("0.3%")
      expect(data.fees.lpFee).toBeDefined()
      expect(data.fees.lpFeePercent).toBe("0.1%")
      expect(data.fees.estimatedGas).toBeDefined()
      expect(data.fees.totalFees).toBeDefined()
      expect(data.netAmount).toBeDefined()
    })

    it("should calculate net amount correctly", async () => {
      const tool = registeredTools.get("get_bridge_fees")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "polygon",
        bridge: "layerzero"
      })

      const data = JSON.parse(result.content[0].text)
      const totalFees = BigInt(data.fees.totalFees)
      const netAmount = BigInt(data.netAmount)
      
      expect(netAmount).toBe(BigInt(amount) - totalFees)
    })

    it("should handle unknown bridge", async () => {
      const tool = registeredTools.get("get_bridge_fees")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "unknown_bridge"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("not found")
    })

    it("should include note about fee variability", async () => {
      const tool = registeredTools.get("get_bridge_fees")
      const result = await tool!.handler({
        token,
        amount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "across"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.note).toContain("may vary")
    })

    it("should calculate percentage-based fees correctly", async () => {
      const exactAmount = "1000000000000000000000" // 1000 tokens
      
      const tool = registeredTools.get("get_bridge_fees")
      const result = await tool!.handler({
        token,
        amount: exactAmount,
        sourceChain: "ethereum",
        destChain: "arbitrum",
        bridge: "wormhole"
      })

      const data = JSON.parse(result.content[0].text)
      const protocolFee = BigInt(data.fees.protocolFee)
      
      // Protocol fee should be 0.3% of amount
      const expectedProtocolFee = (BigInt(exactAmount) * 3n) / 1000n
      expect(protocolFee).toBe(expectedProtocolFee)
    })
  })

  describe("Edge Cases", () => {
    it("should handle very large bridge amounts", async () => {
      const largeAmount = "1000000000000000000000000" // 1 million tokens

      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token: MOCK_USDC_ADDRESS,
        amount: largeAmount,
        sourceChain: "ethereum",
        destChain: "arbitrum"
      })

      const data = JSON.parse(result.content[0].text)
      expect(data.quotes.length).toBeGreaterThan(0)
    })

    it("should handle same chain bridge request", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token: MOCK_USDC_ADDRESS,
        amount: "1000000000",
        sourceChain: "ethereum",
        destChain: "ethereum" // Same chain
      })

      const data = JSON.parse(result.content[0].text)
      // Bridges should still return quotes (for cross-chain, just happens to be same)
      expect(data.quotes).toBeDefined()
    })

    it("should handle all major chain combinations", async () => {
      const chains = ["ethereum", "bsc", "polygon", "arbitrum", "optimism"]
      const tool = registeredTools.get("get_bridge_quote")

      for (const source of chains) {
        for (const dest of chains) {
          if (source === dest) continue

          const result = await tool!.handler({
            token: MOCK_USDC_ADDRESS,
            amount: "1000000000",
            sourceChain: source,
            destChain: dest
          })

          // Should not throw, should return valid response
          expect(result.content[0].text).not.toContain("Error getting bridge quote")
        }
      }
    })

    it("should handle network errors gracefully", async () => {
      mockPublicClient.getTransactionReceipt = vi.fn().mockRejectedValue(
        new Error("Network error: connection refused")
      )

      const tool = registeredTools.get("get_bridge_status")
      const result = await tool!.handler({
        txHash: MOCK_TX_HASH,
        sourceChain: "ethereum",
        bridge: "stargate"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle concurrent bridge quote requests", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      
      const requests = Array(5).fill(null).map(() => 
        tool!.handler({
          token: MOCK_USDC_ADDRESS,
          amount: "1000000000",
          sourceChain: "ethereum",
          destChain: "arbitrum"
        })
      )

      const results = await Promise.all(requests)
      
      for (const result of results) {
        const data = JSON.parse(result.content[0].text)
        expect(data.quotes).toBeInstanceOf(Array)
      }
    })

    it("should handle empty token address", async () => {
      const tool = registeredTools.get("get_bridge_quote")
      const result = await tool!.handler({
        token: "",
        amount: "1000000000",
        sourceChain: "ethereum",
        destChain: "arbitrum"
      })

      // Should still work (validation happens at bridge level)
      const data = JSON.parse(result.content[0].text)
      expect(data.token).toBe("")
    })
  })

  describe("Tool Registration", () => {
    it("should register all bridge tools", () => {
      expect(registeredTools.has("get_bridge_quote")).toBe(true)
      expect(registeredTools.has("execute_bridge")).toBe(true)
      expect(registeredTools.has("get_bridge_status")).toBe(true)
      expect(registeredTools.has("get_supported_bridges")).toBe(true)
      expect(registeredTools.has("estimate_bridge_time")).toBe(true)
      expect(registeredTools.has("get_bridge_fees")).toBe(true)
    })

    it("should have proper tool count", () => {
      // Bridge module should have exactly 6 tools
      expect(registeredTools.size).toBe(6)
    })
  })
})
