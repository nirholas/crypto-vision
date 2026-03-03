/**
 * Comprehensive tests for contracts module tools
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"

// Mock the services module
vi.mock("@/evm/services/index.js", () => ({
  isContract: vi.fn(),
  readContract: vi.fn(),
  writeContract: vi.fn()
}))

import { registerContractTools } from "./tools.js"
import * as services from "@/evm/services/index.js"

describe("Contracts Module Tools", () => {
  let server: McpServer
  let registeredTools: Map<string, { handler: Function; schema: object; description: string }>

  const TEST_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  const TEST_WALLET_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
  const TEST_PRIVATE_KEY = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

  // Sample ERC20 ABI
  const ERC20_ABI = [
    {
      type: "function",
      name: "balanceOf",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    },
    {
      type: "function",
      name: "transfer",
      stateMutability: "nonpayable",
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [{ name: "", type: "bool" }]
    },
    {
      type: "function",
      name: "approve",
      stateMutability: "nonpayable",
      inputs: [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      outputs: [{ name: "", type: "bool" }]
    },
    {
      type: "function",
      name: "name",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "string" }]
    },
    {
      type: "function",
      name: "decimals",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "uint8" }]
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    registeredTools = new Map()

    // Create a mock server that captures tool registrations
    server = {
      tool: vi.fn((name, description, schema, handler) => {
        registeredTools.set(name, { handler, schema, description })
      })
    } as unknown as McpServer

    registerContractTools(server)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all contract tools", () => {
      expect(registeredTools.has("is_contract")).toBe(true)
      expect(registeredTools.has("read_contract")).toBe(true)
      expect(registeredTools.has("write_contract")).toBe(true)
    })

    it("should have correct descriptions for tools", () => {
      const isContractTool = registeredTools.get("is_contract")
      expect(isContractTool?.description).toBe("Check if an address is a smart contract or an externally owned account (EOA)")

      const readContractTool = registeredTools.get("read_contract")
      expect(readContractTool?.description).toBe("Read data from a smart contract by calling a view/pure function")

      const writeContractTool = registeredTools.get("write_contract")
      expect(writeContractTool?.description).toBe("Write data to a smart contract by calling a state-changing function")
    })
  })

  describe("is_contract", () => {
    it("should identify a contract address", async () => {
      vi.mocked(services.isContract).mockResolvedValue(true)

      const tool = registeredTools.get("is_contract")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        address: TEST_CONTRACT_ADDRESS,
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.address).toBe(TEST_CONTRACT_ADDRESS)
      expect(data.network).toBe("ethereum")
      expect(data.isContract).toBe(true)
      expect(data.type).toBe("Contract")
    })

    it("should identify an EOA address", async () => {
      vi.mocked(services.isContract).mockResolvedValue(false)

      const tool = registeredTools.get("is_contract")
      const result = await tool!.handler({
        address: TEST_WALLET_ADDRESS,
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.address).toBe(TEST_WALLET_ADDRESS)
      expect(data.isContract).toBe(false)
      expect(data.type).toBe("EOA")
    })

    it("should use default network (bsc) when not specified", async () => {
      vi.mocked(services.isContract).mockResolvedValue(true)

      const tool = registeredTools.get("is_contract")
      await tool!.handler({
        address: TEST_CONTRACT_ADDRESS
      })

      expect(services.isContract).toHaveBeenCalledWith(
        TEST_CONTRACT_ADDRESS,
        "bsc"
      )
    })

    it("should handle errors gracefully", async () => {
      vi.mocked(services.isContract).mockRejectedValue(new Error("Invalid address"))

      const tool = registeredTools.get("is_contract")
      const result = await tool!.handler({
        address: "invalid",
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("checking contract status")
    })

    it("should work with different networks", async () => {
      vi.mocked(services.isContract).mockResolvedValue(true)

      const tool = registeredTools.get("is_contract")
      
      // Test with BSC
      await tool!.handler({
        address: TEST_CONTRACT_ADDRESS,
        network: "bsc"
      })
      expect(services.isContract).toHaveBeenCalledWith(TEST_CONTRACT_ADDRESS, "bsc")

      // Test with Polygon
      await tool!.handler({
        address: TEST_CONTRACT_ADDRESS,
        network: "polygon"
      })
      expect(services.isContract).toHaveBeenCalledWith(TEST_CONTRACT_ADDRESS, "polygon")
    })
  })

  describe("read_contract", () => {
    it("should read contract state (balanceOf)", async () => {
      vi.mocked(services.readContract).mockResolvedValue(1000000000000n) // 1M tokens with 6 decimals

      const tool = registeredTools.get("read_contract")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [TEST_WALLET_ADDRESS],
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data).toBe("1000000000000")
    })

    it("should read contract without args (name)", async () => {
      vi.mocked(services.readContract).mockResolvedValue("USD Coin")

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "name",
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data).toBe("USD Coin")
    })

    it("should read decimals from contract", async () => {
      vi.mocked(services.readContract).mockResolvedValue(6)

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "decimals",
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data).toBe(6)
    })

    it("should pass correct parameters to readContract service", async () => {
      vi.mocked(services.readContract).mockResolvedValue("test")

      const tool = registeredTools.get("read_contract")
      await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "name",
        args: [],
        network: "polygon"
      })

      expect(services.readContract).toHaveBeenCalledWith(
        {
          address: TEST_CONTRACT_ADDRESS,
          abi: ERC20_ABI,
          functionName: "name",
          args: []
        },
        "polygon"
      )
    })

    it("should handle ABI as string (JSON)", async () => {
      vi.mocked(services.readContract).mockResolvedValue("Test Token")

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: JSON.stringify(ERC20_ABI),
        functionName: "name",
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data).toBe("Test Token")
    })

    it("should handle contract read errors", async () => {
      vi.mocked(services.readContract).mockRejectedValue(new Error("execution reverted"))

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: ["invalid"],
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("reading contract")
    })

    it("should handle complex return types", async () => {
      vi.mocked(services.readContract).mockResolvedValue({
        reserve0: 1000000000000000000n,
        reserve1: 2000000000000000000n,
        blockTimestampLast: 1700000000
      })

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: [{
          type: "function",
          name: "getReserves",
          stateMutability: "view",
          inputs: [],
          outputs: [
            { name: "reserve0", type: "uint112" },
            { name: "reserve1", type: "uint112" },
            { name: "blockTimestampLast", type: "uint32" }
          ]
        }],
        functionName: "getReserves",
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.reserve0).toBeDefined()
      expect(data.reserve1).toBeDefined()
      expect(data.blockTimestampLast).toBeDefined()
    })

    it("should handle array return types", async () => {
      vi.mocked(services.readContract).mockResolvedValue([
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222"
      ])

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: [{
          type: "function",
          name: "getOwners",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "address[]" }]
        }],
        functionName: "getOwners",
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBe(2)
    })
  })

  describe("write_contract", () => {
    const TEST_TX_HASH = "0xabc123def456789abc123def456789abc123def456789abc123def456789abc1"

    it("should write to contract (transfer)", async () => {
      vi.mocked(services.writeContract).mockResolvedValue(TEST_TX_HASH)

      const tool = registeredTools.get("write_contract")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [TEST_WALLET_ADDRESS, "1000000"],
        privateKey: TEST_PRIVATE_KEY,
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.contractAddress).toBe(TEST_CONTRACT_ADDRESS)
      expect(data.functionName).toBe("transfer")
      expect(data.transactionHash).toBe(TEST_TX_HASH)
      expect(data.message).toContain("successfully")
    })

    it("should write to contract (approve)", async () => {
      vi.mocked(services.writeContract).mockResolvedValue(TEST_TX_HASH)

      const tool = registeredTools.get("write_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: ["0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", "115792089237316195423570985008687907853269984665640564039457584007913129639935"],
        privateKey: TEST_PRIVATE_KEY,
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.functionName).toBe("approve")
      expect(data.transactionHash).toBe(TEST_TX_HASH)
    })

    it("should pass correct parameters to writeContract service", async () => {
      vi.mocked(services.writeContract).mockResolvedValue(TEST_TX_HASH)

      const tool = registeredTools.get("write_contract")
      await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [TEST_WALLET_ADDRESS, "1000000"],
        privateKey: TEST_PRIVATE_KEY,
        network: "bsc"
      })

      expect(services.writeContract).toHaveBeenCalledWith(
        TEST_PRIVATE_KEY,
        expect.objectContaining({
          address: TEST_CONTRACT_ADDRESS,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [TEST_WALLET_ADDRESS, "1000000"]
        }),
        "bsc"
      )
    })

    it("should handle write errors", async () => {
      vi.mocked(services.writeContract).mockRejectedValue(new Error("insufficient funds"))

      const tool = registeredTools.get("write_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [TEST_WALLET_ADDRESS, "1000000000000000000000000"],
        privateKey: TEST_PRIVATE_KEY,
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("writing to contract")
    })

    it("should handle transaction revert errors", async () => {
      vi.mocked(services.writeContract).mockRejectedValue(new Error("execution reverted: ERC20: transfer amount exceeds balance"))

      const tool = registeredTools.get("write_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [TEST_WALLET_ADDRESS, "1000000000000000000"],
        privateKey: TEST_PRIVATE_KEY,
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("transfer amount exceeds balance")
    })

    it("should include args in response", async () => {
      vi.mocked(services.writeContract).mockResolvedValue(TEST_TX_HASH)

      const tool = registeredTools.get("write_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [TEST_WALLET_ADDRESS, "1000000"],
        privateKey: TEST_PRIVATE_KEY,
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.args).toEqual([TEST_WALLET_ADDRESS, "1000000"])
    })

    it("should handle ABI as JSON string", async () => {
      vi.mocked(services.writeContract).mockResolvedValue(TEST_TX_HASH)

      const tool = registeredTools.get("write_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: JSON.stringify(ERC20_ABI),
        functionName: "transfer",
        args: [TEST_WALLET_ADDRESS, "1000000"],
        privateKey: TEST_PRIVATE_KEY,
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.transactionHash).toBe(TEST_TX_HASH)
    })

    it("should use default network (bsc) when not specified", async () => {
      vi.mocked(services.writeContract).mockResolvedValue(TEST_TX_HASH)

      const tool = registeredTools.get("write_contract")
      await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [TEST_WALLET_ADDRESS, "1000000"],
        privateKey: TEST_PRIVATE_KEY
      })

      expect(services.writeContract).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        "bsc"
      )
    })
  })

  describe("Edge Cases", () => {
    it("should handle zero address in is_contract", async () => {
      vi.mocked(services.isContract).mockResolvedValue(false)

      const tool = registeredTools.get("is_contract")
      const result = await tool!.handler({
        address: "0x0000000000000000000000000000000000000000",
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.isContract).toBe(false)
    })

    it("should handle empty args array in read_contract", async () => {
      vi.mocked(services.readContract).mockResolvedValue("Token")

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "name",
        args: [],
        network: "ethereum"
      })

      expect(services.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          args: []
        }),
        expect.any(String)
      )
    })

    it("should handle BigInt arguments in read_contract", async () => {
      vi.mocked(services.readContract).mockResolvedValue(true)

      const tool = registeredTools.get("read_contract")
      await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: [{
          type: "function",
          name: "exists",
          stateMutability: "view",
          inputs: [{ name: "tokenId", type: "uint256" }],
          outputs: [{ name: "", type: "bool" }]
        }],
        functionName: "exists",
        args: ["115792089237316195423570985008687907853269984665640564039457584007913129639935"],
        network: "ethereum"
      })

      expect(services.readContract).toHaveBeenCalled()
    })

    it("should handle network timeout errors", async () => {
      vi.mocked(services.readContract).mockRejectedValue(new Error("request timeout"))

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "name",
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("reading contract")
    })

    it("should handle invalid function name", async () => {
      vi.mocked(services.readContract).mockRejectedValue(new Error("Function not found"))

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: "nonExistentFunction",
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle malformed ABI gracefully", async () => {
      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: "invalid json",
        functionName: "name",
        network: "ethereum"
      })

      expect(result.content[0].text).toContain("Error")
    })

    it("should handle boolean return values", async () => {
      vi.mocked(services.readContract).mockResolvedValue(true)

      const tool = registeredTools.get("read_contract")
      const result = await tool!.handler({
        contractAddress: TEST_CONTRACT_ADDRESS,
        abi: [{
          type: "function",
          name: "paused",
          stateMutability: "view",
          inputs: [],
          outputs: [{ name: "", type: "bool" }]
        }],
        functionName: "paused",
        network: "ethereum"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data).toBe(true)
    })
  })
})
