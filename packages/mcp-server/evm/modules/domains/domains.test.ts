/**
 * Comprehensive tests for domains module tools (ENS)
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { namehash, normalize } from "viem/ens"

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(),
  getWalletClient: vi.fn()
}))

import { registerDomainsTools } from "./tools.js"
import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"

describe("Domains Module Tools", () => {
  let server: McpServer
  let registeredTools: Map<string, { handler: Function; schema: object; description: string }>
  let mockPublicClient: any
  let mockWalletClient: any

  const VITALIK_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
  const VITALIK_ENS = "vitalik.eth"

  beforeEach(() => {
    vi.clearAllMocks()
    registeredTools = new Map()

    // Create comprehensive mock public client
    mockPublicClient = {
      getChainId: vi.fn().mockResolvedValue(1),
      getEnsAddress: vi.fn(),
      getEnsName: vi.fn(),
      getEnsText: vi.fn(),
      getEnsAvatar: vi.fn(),
      readContract: vi.fn()
    }

    // Create mock wallet client
    mockWalletClient = {
      account: {
        address: VITALIK_ADDRESS
      },
      sendTransaction: vi.fn().mockResolvedValue("0xabc123")
    }

    vi.mocked(getPublicClient).mockReturnValue(mockPublicClient)
    vi.mocked(getWalletClient).mockReturnValue(mockWalletClient)

    // Create a mock server that captures tool registrations
    server = {
      tool: vi.fn((name, description, schema, handler) => {
        registeredTools.set(name, { handler, schema, description })
      })
    } as unknown as McpServer

    registerDomainsTools(server)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Tool Registration", () => {
    it("should register all domain tools", () => {
      expect(registeredTools.has("resolve_ens_name")).toBe(true)
      expect(registeredTools.has("reverse_resolve_address")).toBe(true)
      expect(registeredTools.has("get_ens_text_records")).toBe(true)
      expect(registeredTools.has("get_ens_avatar")).toBe(true)
      expect(registeredTools.has("check_ens_availability")).toBe(true)
      expect(registeredTools.has("get_ens_name_details")).toBe(true)
      expect(registeredTools.has("batch_resolve_addresses")).toBe(true)
    })

    it("should have correct descriptions for tools", () => {
      const resolveTool = registeredTools.get("resolve_ens_name")
      expect(resolveTool?.description).toBe("Resolve an ENS name to its Ethereum address")

      const reverseTool = registeredTools.get("reverse_resolve_address")
      expect(reverseTool?.description).toBe("Get the ENS name for an Ethereum address (reverse lookup)")
    })
  })

  describe("resolve_ens_name", () => {
    it("should resolve ENS name to address", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(VITALIK_ADDRESS)

      const tool = registeredTools.get("resolve_ens_name")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        name: VITALIK_ENS
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.name).toBe(VITALIK_ENS)
      expect(data.resolved).toBe(true)
      expect(data.address).toBe(VITALIK_ADDRESS)
      expect(data.namehash).toBe(namehash(normalize(VITALIK_ENS)))
    })

    it("should handle unregistered ENS name", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(null)

      const tool = registeredTools.get("resolve_ens_name")
      const result = await tool!.handler({
        name: "unregistered-name-12345.eth"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.resolved).toBe(false)
      expect(data.address).toBeNull()
      expect(data.message).toContain("does not resolve")
    })

    it("should use default network (ethereum)", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(VITALIK_ADDRESS)

      const tool = registeredTools.get("resolve_ens_name")
      await tool!.handler({
        name: VITALIK_ENS
      })

      expect(getPublicClient).toHaveBeenCalledWith("ethereum")
    })

    it("should support custom network", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(VITALIK_ADDRESS)

      const tool = registeredTools.get("resolve_ens_name")
      await tool!.handler({
        name: VITALIK_ENS,
        network: "goerli"
      })

      expect(getPublicClient).toHaveBeenCalledWith("goerli")
    })

    it("should handle errors gracefully", async () => {
      mockPublicClient.getEnsAddress.mockRejectedValue(new Error("Network error"))

      const tool = registeredTools.get("resolve_ens_name")
      const result = await tool!.handler({
        name: VITALIK_ENS
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("resolving ENS name")
    })

    it("should normalize ENS names correctly", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(VITALIK_ADDRESS)

      const tool = registeredTools.get("resolve_ens_name")
      
      // Test with uppercase
      await tool!.handler({
        name: "VITALIK.ETH"
      })

      expect(mockPublicClient.getEnsAddress).toHaveBeenCalledWith({
        name: normalize("VITALIK.ETH")
      })
    })
  })

  describe("reverse_resolve_address", () => {
    it("should reverse resolve address to ENS name", async () => {
      mockPublicClient.getEnsName.mockResolvedValue(VITALIK_ENS)

      const tool = registeredTools.get("reverse_resolve_address")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        address: VITALIK_ADDRESS
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.address).toBe(VITALIK_ADDRESS)
      expect(data.hasEnsName).toBe(true)
      expect(data.ensName).toBe(VITALIK_ENS)
    })

    it("should handle address without ENS name", async () => {
      mockPublicClient.getEnsName.mockResolvedValue(null)

      const tool = registeredTools.get("reverse_resolve_address")
      const result = await tool!.handler({
        address: "0x1234567890123456789012345678901234567890"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.hasEnsName).toBe(false)
      expect(data.ensName).toBeNull()
    })

    it("should use default network (ethereum)", async () => {
      mockPublicClient.getEnsName.mockResolvedValue(null)

      const tool = registeredTools.get("reverse_resolve_address")
      await tool!.handler({
        address: VITALIK_ADDRESS
      })

      expect(getPublicClient).toHaveBeenCalledWith("ethereum")
    })

    it("should handle errors gracefully", async () => {
      mockPublicClient.getEnsName.mockRejectedValue(new Error("Invalid address"))

      const tool = registeredTools.get("reverse_resolve_address")
      const result = await tool!.handler({
        address: "invalid"
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("reverse resolving")
    })
  })

  describe("get_ens_text_records", () => {
    it("should fetch ENS text records", async () => {
      mockPublicClient.getEnsText.mockImplementation(({ name, key }: { name: string; key: string }) => {
        const records: Record<string, string> = {
          avatar: "https://example.com/avatar.png",
          description: "Ethereum co-founder",
          "com.twitter": "VitalikButerin",
          "com.github": "vbuterin"
        }
        return Promise.resolve(records[key] || null)
      })

      const tool = registeredTools.get("get_ens_text_records")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        name: VITALIK_ENS
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.name).toBe(VITALIK_ENS)
      expect(data.textRecords).toBeDefined()
      expect(data.recordsFound).toBeGreaterThan(0)
    })

    it("should fetch specific records when provided", async () => {
      mockPublicClient.getEnsText.mockImplementation(({ name, key }: { name: string; key: string }) => {
        if (key === "com.twitter") return Promise.resolve("VitalikButerin")
        return Promise.resolve(null)
      })

      const tool = registeredTools.get("get_ens_text_records")
      const result = await tool!.handler({
        name: VITALIK_ENS,
        records: ["com.twitter", "com.github"]
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.textRecords["com.twitter"]).toBe("VitalikButerin")
      expect(data.recordsFound).toBe(1)
    })

    it("should handle ENS name with no text records", async () => {
      mockPublicClient.getEnsText.mockResolvedValue(null)

      const tool = registeredTools.get("get_ens_text_records")
      const result = await tool!.handler({
        name: "empty-records.eth"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.recordsFound).toBe(0)
      expect(Object.keys(data.textRecords).length).toBe(0)
    })

    it("should handle individual record errors gracefully", async () => {
      mockPublicClient.getEnsText.mockImplementation(({ key }: { key: string }) => {
        if (key === "avatar") return Promise.reject(new Error("Not found"))
        return Promise.resolve("value")
      })

      const tool = registeredTools.get("get_ens_text_records")
      const result = await tool!.handler({
        name: VITALIK_ENS,
        records: ["avatar", "description"]
      })
      const data = JSON.parse(result.content[0].text)

      // Should still return partial results
      expect(data.textRecords).toBeDefined()
    })

    it("should normalize ENS name", async () => {
      mockPublicClient.getEnsText.mockResolvedValue(null)

      const tool = registeredTools.get("get_ens_text_records")
      const result = await tool!.handler({
        name: "VITALIK.ETH"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.name).toBe("vitalik.eth")
    })
  })

  describe("get_ens_avatar", () => {
    it("should fetch ENS avatar URL", async () => {
      mockPublicClient.getEnsAvatar.mockResolvedValue("https://example.com/avatar.png")

      const tool = registeredTools.get("get_ens_avatar")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        name: VITALIK_ENS
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.name).toBe(VITALIK_ENS)
      expect(data.hasAvatar).toBe(true)
      expect(data.avatarUrl).toBe("https://example.com/avatar.png")
    })

    it("should handle ENS name without avatar", async () => {
      mockPublicClient.getEnsAvatar.mockResolvedValue(null)

      const tool = registeredTools.get("get_ens_avatar")
      const result = await tool!.handler({
        name: "no-avatar.eth"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.hasAvatar).toBe(false)
      expect(data.avatarUrl).toBeNull()
    })

    it("should handle NFT avatar URIs", async () => {
      mockPublicClient.getEnsAvatar.mockResolvedValue("ipfs://Qm...")

      const tool = registeredTools.get("get_ens_avatar")
      const result = await tool!.handler({
        name: VITALIK_ENS
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.hasAvatar).toBe(true)
      expect(data.avatarUrl).toContain("ipfs://")
    })

    it("should handle errors gracefully", async () => {
      mockPublicClient.getEnsAvatar.mockRejectedValue(new Error("Failed to fetch"))

      const tool = registeredTools.get("get_ens_avatar")
      const result = await tool!.handler({
        name: VITALIK_ENS
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("getting ENS avatar")
    })
  })

  describe("check_ens_availability", () => {
    it("should check available ENS name", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(null)

      const tool = registeredTools.get("check_ens_availability")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        name: "available-name-12345"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.isRegistered).toBe(false)
      expect(data.available).toBe(true)
      expect(data.currentOwner).toBeNull()
    })

    it("should check registered ENS name", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(VITALIK_ADDRESS)

      const tool = registeredTools.get("check_ens_availability")
      const result = await tool!.handler({
        name: "vitalik"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.isRegistered).toBe(true)
      expect(data.available).toBe(false)
      expect(data.currentOwner).toBe(VITALIK_ADDRESS)
    })

    it("should add .eth suffix if not present", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(null)

      const tool = registeredTools.get("check_ens_availability")
      const result = await tool!.handler({
        name: "myname"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.name).toBe("myname.eth")
    })

    it("should not duplicate .eth suffix", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(null)

      const tool = registeredTools.get("check_ens_availability")
      const result = await tool!.handler({
        name: "myname.eth"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.name).toBe("myname.eth")
    })

    it("should handle resolution errors as potentially available", async () => {
      mockPublicClient.getEnsAddress.mockRejectedValue(new Error("Resolution failed"))

      const tool = registeredTools.get("check_ens_availability")
      const result = await tool!.handler({
        name: "problematic-name"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.available).toBe(true)
      expect(data.note).toContain("appears to be available")
    })
  })

  describe("get_ens_name_details", () => {
    it("should fetch comprehensive ENS details", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(VITALIK_ADDRESS)
      mockPublicClient.getEnsAvatar.mockResolvedValue("https://example.com/avatar.png")
      mockPublicClient.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "resolver") return Promise.resolve("0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41")
        if (functionName === "owner") return Promise.resolve(VITALIK_ADDRESS)
        return Promise.resolve(null)
      })

      const tool = registeredTools.get("get_ens_name_details")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        name: VITALIK_ENS
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.name).toBe(VITALIK_ENS)
      expect(data.namehash).toBeDefined()
      expect(data.details).toBeDefined()
      expect(data.details.resolvedAddress).toBe(VITALIK_ADDRESS)
      expect(data.isRegistered).toBe(true)
    })

    it("should handle unregistered ENS name", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(null)
      mockPublicClient.getEnsAvatar.mockResolvedValue(null)
      mockPublicClient.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "owner") return Promise.resolve("0x0000000000000000000000000000000000000000")
        return Promise.resolve(null)
      })

      const tool = registeredTools.get("get_ens_name_details")
      const result = await tool!.handler({
        name: "unregistered.eth"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.isRegistered).toBe(false)
    })

    it("should include namehash in response", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(VITALIK_ADDRESS)
      mockPublicClient.getEnsAvatar.mockResolvedValue(null)
      mockPublicClient.readContract.mockResolvedValue(null)

      const tool = registeredTools.get("get_ens_name_details")
      const result = await tool!.handler({
        name: VITALIK_ENS
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.namehash).toBe(namehash(normalize(VITALIK_ENS)))
    })

    it("should handle ENS not available on network", async () => {
      mockPublicClient.getChainId.mockResolvedValue(56) // BSC doesn't have ENS

      const tool = registeredTools.get("get_ens_name_details")
      const result = await tool!.handler({
        name: VITALIK_ENS
      })

      expect(result.content[0].text).toContain("Error")
      expect(result.content[0].text).toContain("ENS not available")
    })
  })

  describe("batch_resolve_addresses", () => {
    it("should batch resolve multiple addresses", async () => {
      mockPublicClient.getEnsName.mockImplementation(({ address }: { address: string }) => {
        if (address === VITALIK_ADDRESS) return Promise.resolve(VITALIK_ENS)
        return Promise.resolve(null)
      })

      const tool = registeredTools.get("batch_resolve_addresses")
      expect(tool).toBeDefined()

      const result = await tool!.handler({
        addresses: [
          VITALIK_ADDRESS,
          "0x1234567890123456789012345678901234567890"
        ]
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.results).toHaveLength(2)
      expect(data.results[0].address).toBe(VITALIK_ADDRESS)
      expect(data.results[0].ensName).toBe(VITALIK_ENS)
      expect(data.results[1].ensName).toBeNull()
      expect(data.summary.total).toBe(2)
      expect(data.summary.resolved).toBe(1)
      expect(data.summary.notResolved).toBe(1)
    })

    it("should handle all addresses without ENS names", async () => {
      mockPublicClient.getEnsName.mockResolvedValue(null)

      const tool = registeredTools.get("batch_resolve_addresses")
      const result = await tool!.handler({
        addresses: [
          "0x1111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222"
        ]
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.summary.resolved).toBe(0)
      expect(data.summary.notResolved).toBe(2)
    })

    it("should handle all addresses with ENS names", async () => {
      mockPublicClient.getEnsName.mockImplementation(({ address }: { address: string }) => {
        return Promise.resolve(`${address.slice(2, 8)}.eth`)
      })

      const tool = registeredTools.get("batch_resolve_addresses")
      const result = await tool!.handler({
        addresses: [
          "0x1111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222"
        ]
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.summary.resolved).toBe(2)
      expect(data.summary.notResolved).toBe(0)
    })

    it("should handle individual address resolution errors", async () => {
      mockPublicClient.getEnsName.mockImplementation(({ address }: { address: string }) => {
        if (address === VITALIK_ADDRESS) return Promise.resolve(VITALIK_ENS)
        return Promise.reject(new Error("Resolution failed"))
      })

      const tool = registeredTools.get("batch_resolve_addresses")
      const result = await tool!.handler({
        addresses: [
          VITALIK_ADDRESS,
          "0x1234567890123456789012345678901234567890"
        ]
      })
      const data = JSON.parse(result.content[0].text)

      // Should still return results for successful resolutions
      expect(data.results).toHaveLength(2)
      expect(data.results[0].ensName).toBe(VITALIK_ENS)
      expect(data.results[1].ensName).toBeNull()
    })

    it("should handle empty address array", async () => {
      const tool = registeredTools.get("batch_resolve_addresses")
      const result = await tool!.handler({
        addresses: []
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.results).toHaveLength(0)
      expect(data.summary.total).toBe(0)
    })

    it("should handle large batch of addresses", async () => {
      const addresses = Array(50).fill(null).map((_, i) => 
        `0x${i.toString(16).padStart(40, '0')}`
      )
      mockPublicClient.getEnsName.mockResolvedValue(null)

      const tool = registeredTools.get("batch_resolve_addresses")
      const result = await tool!.handler({
        addresses
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.results).toHaveLength(50)
      expect(data.summary.total).toBe(50)
    })
  })

  describe("Edge Cases", () => {
    it("should handle ENS name with subdomains", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(VITALIK_ADDRESS)

      const tool = registeredTools.get("resolve_ens_name")
      const result = await tool!.handler({
        name: "subdomain.vitalik.eth"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.name).toBe("subdomain.vitalik.eth")
    })

    it("should handle ENS name with special characters", async () => {
      mockPublicClient.getEnsAddress.mockResolvedValue(VITALIK_ADDRESS)

      const tool = registeredTools.get("resolve_ens_name")
      const result = await tool!.handler({
        name: "my-name.eth"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.resolved).toBe(true)
    })

    it("should handle zero address in reverse lookup", async () => {
      mockPublicClient.getEnsName.mockResolvedValue(null)

      const tool = registeredTools.get("reverse_resolve_address")
      const result = await tool!.handler({
        address: "0x0000000000000000000000000000000000000000"
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.hasEnsName).toBe(false)
    })

    it("should handle case sensitivity in addresses", async () => {
      mockPublicClient.getEnsName.mockResolvedValue(VITALIK_ENS)

      const tool = registeredTools.get("reverse_resolve_address")
      
      // Test lowercase
      const result1 = await tool!.handler({
        address: VITALIK_ADDRESS.toLowerCase()
      })
      const data1 = JSON.parse(result1.content[0].text)

      // Test checksum
      const result2 = await tool!.handler({
        address: VITALIK_ADDRESS
      })
      const data2 = JSON.parse(result2.content[0].text)

      expect(data1.ensName).toBe(data2.ensName)
    })

    it("should handle very long ENS names", async () => {
      const longName = "a".repeat(100) + ".eth"
      mockPublicClient.getEnsAddress.mockResolvedValue(null)

      const tool = registeredTools.get("resolve_ens_name")
      const result = await tool!.handler({
        name: longName
      })
      const data = JSON.parse(result.content[0].text)

      expect(data.resolved).toBe(false)
    })

    it("should handle network errors in batch resolve", async () => {
      mockPublicClient.getEnsName.mockRejectedValue(new Error("Network error"))

      const tool = registeredTools.get("batch_resolve_addresses")
      const result = await tool!.handler({
        addresses: [VITALIK_ADDRESS]
      })
      const data = JSON.parse(result.content[0].text)

      // Should gracefully handle and return null for failed lookups
      expect(data.results[0].ensName).toBeNull()
    })
  })
})
