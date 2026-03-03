/**
 * Comprehensive tests for events module tools
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { keccak256, toHex } from "viem"

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn()
}))

import { registerEventsTools } from "./tools.js"
import { getPublicClient } from "@/evm/services/clients.js"

describe("Events Module Tools", () => {
  let server: McpServer
  let registeredTools: Map<string, { handler: Function; schema: object; description: string }>
  let mockClient: any

  // Sample log data for testing
  const sampleTransferLog = {
    blockNumber: 18000000n,
    transactionHash: "0xabc123def456789abc123def456789abc123def456789abc123def456789abc1",
    logIndex: 0,
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    topics: [
      keccak256(toHex("Transfer(address,address,uint256)")),
      "0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045",
      "0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    ],
    data: "0x0000000000000000000000000000000000000000000000000000000005f5e100"
  }

  const sampleApprovalLog = {
    blockNumber: 18000001n,
    transactionHash: "0xdef456789abc123def456789abc123def456789abc123def456789abc123def4",
    logIndex: 1,
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    topics: [
      keccak256(toHex("Approval(address,address,uint256)")),
      "0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045",
      "0x0000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d"
    ],
    data: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  }

  beforeEach(() => {
    vi.clearAllMocks()
    registeredTools = new Map()

    // Create comprehensive mock client
    mockClient = {
      getBlockNumber: vi.fn().mockResolvedValue(18000000n),
      getLogs: vi.fn().mockResolvedValue([sampleTransferLog]),
      getChainId: vi.fn().mockResolvedValue(1)
    }

    vi.mocked(getPublicClient).mockReturnValue(mockClient)

    // Create a mock server that captures tool registrations
    server = {
      tool: vi.fn((name, description, schema, handler) => {
        registeredTools.set(name, { handler, schema, description })
      })
    } as unknown as McpServer

    registerEventsTools(server)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all events tools", () => {
      expect(registeredTools.has("get_contract_logs")).toBe(true)
      expect(registeredTools.has("get_erc20_transfers")).toBe(true)
      expect(registeredTools.has("get_approval_events")).toBe(true)
      expect(registeredTools.has("get_logs_by_topic")).toBe(true)
      expect(registeredTools.has("get_event_topics")).toBe(true)
      expect(registeredTools.has("calculate_event_signature")).toBe(true)
      expect(registeredTools.has("get_recent_events")).toBe(true)
    })

    it("should have correct descriptions for tools", () => {
      const logsTool = registeredTools.get("get_contract_logs")
      expect(logsTool?.description).toBe("Get event logs from a specific contract")
    })
  })

  describe("get_contract_logs", () => {
    it("should fetch logs from a contract", async () => {
      const tool = registeredTools.get("get_contract_logs")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.contractAddress).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
      expect(data.logsCount).toBe(1)
      expect(data.logs).toBeInstanceOf(Array)
    })

    it("should respect block range parameters", async () => {
      const tool = registeredTools.get("get_contract_logs")
      
      await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        fromBlock: "17999000",
        toBlock: "18000000"
      })

      expect(mockClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 17999000n,
          toBlock: 18000000n
        })
      )
    })

    it("should use default block range when not specified", async () => {
      const tool = registeredTools.get("get_contract_logs")
      
      await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })

      expect(mockClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 17999000n, // latest - 1000
          toBlock: 18000000n
        })
      )
    })

    it("should filter by event signature", async () => {
      const tool = registeredTools.get("get_contract_logs")
      
      await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        eventSignature: "Transfer(address,address,uint256)"
      })

      expect(mockClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: [keccak256(toHex("Transfer(address,address,uint256)"))]
        })
      )
    })

    it("should truncate logs when exceeding 100", async () => {
      const manyLogs = Array(150).fill(sampleTransferLog)
      mockClient.getLogs.mockResolvedValue(manyLogs)

      const tool = registeredTools.get("get_contract_logs")
      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.logsCount).toBe(150)
      expect(data.logs.length).toBe(100)
      expect(data.truncated).toBe(true)
    })

    it("should handle errors gracefully", async () => {
      mockClient.getLogs.mockRejectedValue(new Error("RPC Error"))

      const tool = registeredTools.get("get_contract_logs")
      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("getting contract logs")
    })
  })

  describe("get_erc20_transfers", () => {
    it("should fetch ERC20 transfer events", async () => {
      const tool = registeredTools.get("get_erc20_transfers")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.tokenAddress).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
      expect(data.transfers).toBeInstanceOf(Array)
    })

    it("should filter by sender address", async () => {
      const tool = registeredTools.get("get_erc20_transfers")
      
      await tool!.handler({
        network: "ethereum",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        fromAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
      })

      expect(mockClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: expect.arrayContaining([
            expect.any(String),
            expect.stringContaining("d8da6bf26964af9d7eed9e03e53415d37aa96045")
          ])
        })
      )
    })

    it("should filter by recipient address", async () => {
      const tool = registeredTools.get("get_erc20_transfers")
      
      await tool!.handler({
        network: "ethereum",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })

      expect(mockClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: expect.arrayContaining([
            expect.any(String),
            null,
            expect.stringContaining("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
          ])
        })
      )
    })

    it("should decode transfer events correctly", async () => {
      const tool = registeredTools.get("get_erc20_transfers")
      const result = await tool!.handler({
        network: "ethereum",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.transfers[0].transactionHash).toBeDefined()
      expect(data.transfers[0].blockNumber).toBeDefined()
    })

    it("should respect limit parameter", async () => {
      const manyLogs = Array(100).fill(sampleTransferLog)
      mockClient.getLogs.mockResolvedValue(manyLogs)

      const tool = registeredTools.get("get_erc20_transfers")
      const result = await tool!.handler({
        network: "ethereum",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        limit: 10
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.transfers.length).toBe(10)
      expect(data.truncated).toBe(true)
    })

    it("should handle decoding errors gracefully", async () => {
      // Log with malformed data
      mockClient.getLogs.mockResolvedValue([{
        ...sampleTransferLog,
        data: "0x" // Invalid data
      }])

      const tool = registeredTools.get("get_erc20_transfers")
      const result = await tool!.handler({
        network: "ethereum",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
      const data = JSON.parse(result.content[0].text)

      // Should still return result with raw data
      expect(data.transfers[0].raw).toBeDefined()
    })
  })

  describe("get_approval_events", () => {
    it("should fetch approval events", async () => {
      mockClient.getLogs.mockResolvedValue([sampleApprovalLog])

      const tool = registeredTools.get("get_approval_events")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.approvals).toBeInstanceOf(Array)
    })

    it("should filter by owner address", async () => {
      mockClient.getLogs.mockResolvedValue([sampleApprovalLog])

      const tool = registeredTools.get("get_approval_events")
      await tool!.handler({
        network: "ethereum",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        ownerAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
      })

      expect(mockClient.getLogs).toHaveBeenCalled()
    })

    it("should filter by spender address", async () => {
      mockClient.getLogs.mockResolvedValue([sampleApprovalLog])

      const tool = registeredTools.get("get_approval_events")
      await tool!.handler({
        network: "ethereum",
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        spenderAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
      })

      expect(mockClient.getLogs).toHaveBeenCalled()
    })
  })

  describe("get_logs_by_topic", () => {
    it("should fetch logs by primary topic", async () => {
      const tool = registeredTools.get("get_logs_by_topic")
      expect(tool).toBeDefined()

      const transferTopic = keccak256(toHex("Transfer(address,address,uint256)"))
      
      const result = await tool!.handler({
        network: "ethereum",
        topic0: transferTopic
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.topics.topic0).toBe(transferTopic)
      expect(data.logsCount).toBeDefined()
    })

    it("should support filtering by additional topics", async () => {
      const tool = registeredTools.get("get_logs_by_topic")
      const transferTopic = keccak256(toHex("Transfer(address,address,uint256)"))
      const fromTopic = "0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045"

      await tool!.handler({
        network: "ethereum",
        topic0: transferTopic,
        topic1: fromTopic
      })

      expect(mockClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: [transferTopic, fromTopic, null]
        })
      )
    })

    it("should filter by contract address", async () => {
      const tool = registeredTools.get("get_logs_by_topic")
      const transferTopic = keccak256(toHex("Transfer(address,address,uint256)"))

      await tool!.handler({
        network: "ethereum",
        topic0: transferTopic,
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })

      expect(mockClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        })
      )
    })
  })

  describe("get_event_topics", () => {
    it("should return all common event topics", async () => {
      const tool = registeredTools.get("get_event_topics")
      expect(tool).toBeDefined()

      const result = await tool!.handler({})
      const data = JSON.parse(result.content[0].text)

      expect(data.events).toBeInstanceOf(Array)
      expect(data.events.length).toBeGreaterThan(0)
      
      const transferEvent = data.events.find((e: any) => e.name === "Transfer")
      expect(transferEvent).toBeDefined()
      expect(transferEvent.signature).toBe("Transfer(address,address,uint256)")
      expect(transferEvent.topic).toBeDefined()
    })

    it("should return specific event topic", async () => {
      const tool = registeredTools.get("get_event_topics")
      const result = await tool!.handler({ eventName: "Transfer" })
      const data = JSON.parse(result.content[0].text)

      expect(data.event).toBe("Transfer")
      expect(data.signature).toBe("Transfer(address,address,uint256)")
      expect(data.topic).toBeDefined()
    })

    it("should return Approval event topic", async () => {
      const tool = registeredTools.get("get_event_topics")
      const result = await tool!.handler({ eventName: "Approval" })
      const data = JSON.parse(result.content[0].text)

      expect(data.event).toBe("Approval")
      expect(data.signature).toBe("Approval(address,address,uint256)")
    })

    it("should handle unknown event name", async () => {
      const tool = registeredTools.get("get_event_topics")
      const result = await tool!.handler({ eventName: "UnknownEvent" })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("Unknown event")
    })
  })

  describe("calculate_event_signature", () => {
    it("should calculate event signature hash", async () => {
      const tool = registeredTools.get("calculate_event_signature")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        signature: "Transfer(address,address,uint256)"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.signature).toBe("Transfer(address,address,uint256)")
      expect(data.topic).toBe(keccak256(toHex("Transfer(address,address,uint256)")))
    })

    it("should handle complex event signatures", async () => {
      const tool = registeredTools.get("calculate_event_signature")
      const result = await tool!.handler({
        signature: "Swap(address,uint256,uint256,uint256,uint256,address)"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.topic).toBe(keccak256(toHex("Swap(address,uint256,uint256,uint256,uint256,address)")))
    })

    it("should handle event signatures with no parameters", async () => {
      const tool = registeredTools.get("calculate_event_signature")
      const result = await tool!.handler({
        signature: "Paused()"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.topic).toBe(keccak256(toHex("Paused()")))
    })
  })

  describe("get_recent_events", () => {
    it("should fetch recent events for a contract", async () => {
      mockClient.getLogs.mockResolvedValue([
        { ...sampleTransferLog, blockNumber: 17999990n },
        { ...sampleTransferLog, blockNumber: 17999995n },
        { ...sampleTransferLog, blockNumber: 18000000n }
      ])

      const tool = registeredTools.get("get_recent_events")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        eventSignature: "Transfer(address,address,uint256)"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.network).toBe("ethereum")
      expect(data.contractAddress).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
      expect(data.totalEvents).toBe(3)
      expect(data.recentLogs).toBeInstanceOf(Array)
    })

    it("should use custom blocks back parameter", async () => {
      mockClient.getLogs.mockResolvedValue([])

      const tool = registeredTools.get("get_recent_events")
      await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        eventSignature: "Transfer(address,address,uint256)",
        blocksBack: 50
      })

      expect(mockClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 18000000n - 50n
        })
      )
    })

    it("should calculate events per block", async () => {
      mockClient.getLogs.mockResolvedValue([
        { ...sampleTransferLog, blockNumber: 17999990n },
        { ...sampleTransferLog, blockNumber: 17999990n },
        { ...sampleTransferLog, blockNumber: 17999995n }
      ])

      const tool = registeredTools.get("get_recent_events")
      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        eventSignature: "Transfer(address,address,uint256)"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.eventsPerBlock).toBeDefined()
      expect(parseFloat(data.eventsPerBlock)).toBeCloseTo(1.5, 1) // 3 events / 2 blocks
    })

    it("should return only last 20 logs in recentLogs", async () => {
      const manyLogs = Array(50).fill(sampleTransferLog).map((log, i) => ({
        ...log,
        blockNumber: BigInt(18000000 - i)
      }))
      mockClient.getLogs.mockResolvedValue(manyLogs)

      const tool = registeredTools.get("get_recent_events")
      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        eventSignature: "Transfer(address,address,uint256)"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.totalEvents).toBe(50)
      expect(data.recentLogs.length).toBe(20)
    })

    it("should include topic hash in response", async () => {
      mockClient.getLogs.mockResolvedValue([])

      const tool = registeredTools.get("get_recent_events")
      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        eventSignature: "Transfer(address,address,uint256)"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.topic).toBe(keccak256(toHex("Transfer(address,address,uint256)")))
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty log results", async () => {
      mockClient.getLogs.mockResolvedValue([])

      const tool = registeredTools.get("get_contract_logs")
      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.logsCount).toBe(0)
      expect(data.logs).toEqual([])
    })

    it("should handle invalid contract address format in logs query", async () => {
      mockClient.getLogs.mockRejectedValue(new Error("invalid address"))

      const tool = registeredTools.get("get_contract_logs")
      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "invalid"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle network errors", async () => {
      mockClient.getBlockNumber.mockRejectedValue(new Error("Network unavailable"))

      const tool = registeredTools.get("get_contract_logs")
      const result = await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle large block ranges efficiently", async () => {
      const tool = registeredTools.get("get_contract_logs")
      
      await tool!.handler({
        network: "ethereum",
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        fromBlock: "0",
        toBlock: "18000000"
      })

      expect(mockClient.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 0n,
          toBlock: 18000000n
        })
      )
    })
  })
})
