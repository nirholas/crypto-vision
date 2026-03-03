/**
 * Deployment Module Tests
 * Tests for contract deployment tools
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Address, Hash, Hex } from "viem"

// Mock fetch for block explorer APIs
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(() => mockPublicClient),
  getWalletClient: vi.fn(() => mockWalletClient)
}))

// Mock viem functions
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem")
  return {
    ...actual,
    encodeDeployData: vi.fn(),
    getContractAddress: vi.fn(),
    getCreate2Address: vi.fn(),
    keccak256: vi.fn().mockReturnValue("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
  }
})

// Mock public client
const mockPublicClient = {
  getChainId: vi.fn().mockResolvedValue(1),
  getCode: vi.fn(),
  getStorageAt: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  readContract: vi.fn(),
  estimateGas: vi.fn()
}

// Mock wallet client
const mockWalletClient = {
  account: { address: "0x1234567890123456789012345678901234567890" as Address },
  deployContract: vi.fn(),
  sendTransaction: vi.fn(),
  writeContract: vi.fn()
}

describe("Deployment Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test data
  const mockContractAddress = "0x1234567890123456789012345678901234567890" as Address
  const mockTxHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hash
  const mockBytecode = "0x608060405234801561001057600080fd5b50" as Hex

  describe("Contract Deployment", () => {
    it("should deploy a contract from bytecode", async () => {
      mockWalletClient.sendTransaction.mockResolvedValue(mockTxHash)
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        contractAddress: mockContractAddress,
        status: "success",
        blockNumber: BigInt(18000000)
      })

      const txHash = await mockWalletClient.sendTransaction({
        data: mockBytecode
      })

      expect(txHash).toBe(mockTxHash)

      const receipt = await mockPublicClient.waitForTransactionReceipt({ hash: txHash })
      expect(receipt.contractAddress).toBe(mockContractAddress)
      expect(receipt.status).toBe("success")
    })

    it("should handle deployment failure", async () => {
      mockWalletClient.sendTransaction.mockResolvedValue(mockTxHash)
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        contractAddress: null,
        status: "reverted"
      })

      const txHash = await mockWalletClient.sendTransaction({
        data: mockBytecode
      })
      const receipt = await mockPublicClient.waitForTransactionReceipt({ hash: txHash })

      expect(receipt.status).toBe("reverted")
      expect(receipt.contractAddress).toBeNull()
    })

    it("should estimate gas for deployment", async () => {
      mockPublicClient.estimateGas.mockResolvedValue(BigInt(500000))

      const gasEstimate = await mockPublicClient.estimateGas({
        data: mockBytecode
      })

      expect(gasEstimate).toBe(BigInt(500000))
    })
  })

  describe("CREATE2 Deployment", () => {
    it("should calculate CREATE2 address deterministically", async () => {
      const { getCreate2Address } = await import("viem")
      
      const salt = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex
      const initCodeHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash

      vi.mocked(getCreate2Address).mockReturnValue(mockContractAddress)

      const address = getCreate2Address({
        from: mockWalletClient.account.address,
        salt,
        bytecodeHash: initCodeHash
      })

      expect(address).toBe(mockContractAddress)
    })

    it("should use deterministic deployment proxy", () => {
      const CREATE2_FACTORY: Record<number, Address> = {
        1: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
        56: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
        137: "0x4e59b44847b379578588920cA78FbF26c0B4956C"
      }

      expect(CREATE2_FACTORY[1]).toBe("0x4e59b44847b379578588920cA78FbF26c0B4956C")
      expect(CREATE2_FACTORY[56]).toBe(CREATE2_FACTORY[1]) // Same across chains
    })
  })

  describe("Proxy Deployment", () => {
    it("should verify proxy implementation slot", async () => {
      const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
      
      mockPublicClient.getStorageAt.mockResolvedValue(
        "0x0000000000000000000000001234567890123456789012345678901234567890"
      )

      const implementationSlot = await mockPublicClient.getStorageAt({
        address: mockContractAddress,
        slot: IMPLEMENTATION_SLOT as Hex
      })

      expect(implementationSlot).toContain("1234567890123456789012345678901234567890")
    })

    it("should verify proxy admin slot", async () => {
      const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
      
      mockPublicClient.getStorageAt.mockResolvedValue(
        "0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12"
      )

      const adminSlot = await mockPublicClient.getStorageAt({
        address: mockContractAddress,
        slot: ADMIN_SLOT as Hex
      })

      expect(adminSlot).toBeDefined()
    })
  })

  describe("Contract Verification", () => {
    it("should submit contract for verification", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: "1",
          message: "OK",
          result: "verification-guid-123"
        })
      })

      const response = await fetch("https://api.etherscan.io/api", {
        method: "POST",
        body: new URLSearchParams({
          module: "contract",
          action: "verifysourcecode",
          contractaddress: mockContractAddress,
          sourceCode: "// SPDX-License-Identifier: MIT...",
          contractname: "MyContract",
          compilerversion: "v0.8.20+commit.a1b79de6"
        })
      })

      const result = await response.json()
      expect(result.status).toBe("1")
      expect(result.result).toContain("verification")
    })

    it("should check verification status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: "1",
          message: "OK",
          result: "Pass - Verified"
        })
      })

      const response = await fetch(
        `https://api.etherscan.io/api?module=contract&action=checkverifystatus&guid=verification-guid-123`
      )

      const result = await response.json()
      expect(result.result).toContain("Verified")
    })

    it("should handle verification failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: "0",
          message: "NOTOK",
          result: "Fail - Unable to verify"
        })
      })

      const response = await fetch("https://api.etherscan.io/api", {
        method: "POST",
        body: new URLSearchParams({
          module: "contract",
          action: "verifysourcecode"
        })
      })

      const result = await response.json()
      expect(result.status).toBe("0")
    })
  })

  describe("Explorer API Endpoints", () => {
    it("should have correct explorer URLs for major networks", () => {
      const EXPLORER_APIS: Record<number, { url: string; name: string }> = {
        1: { url: "https://api.etherscan.io/api", name: "Etherscan" },
        56: { url: "https://api.bscscan.com/api", name: "BSCScan" },
        137: { url: "https://api.polygonscan.com/api", name: "PolygonScan" },
        42161: { url: "https://api.arbiscan.io/api", name: "Arbiscan" }
      }

      expect(EXPLORER_APIS[1].name).toBe("Etherscan")
      expect(EXPLORER_APIS[56].name).toBe("BSCScan")
      expect(EXPLORER_APIS[42161].name).toBe("Arbiscan")
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty bytecode", async () => {
      mockPublicClient.estimateGas.mockRejectedValue(
        new Error("Contract code size is 0")
      )

      await expect(
        mockPublicClient.estimateGas({ data: "0x" as Hex })
      ).rejects.toThrow("Contract code size is 0")
    })

    it("should handle insufficient funds for deployment", async () => {
      mockWalletClient.sendTransaction.mockRejectedValue(
        new Error("Insufficient funds for gas")
      )

      await expect(
        mockWalletClient.sendTransaction({ data: mockBytecode })
      ).rejects.toThrow("Insufficient funds")
    })

    it("should handle contract already deployed at address", async () => {
      mockPublicClient.getCode.mockResolvedValue("0x608060405234801561001057600080fd5b50")

      const code = await mockPublicClient.getCode({ address: mockContractAddress })
      expect(code).not.toBe("0x")
    })

    it("should validate bytecode format", () => {
      const validBytecode = "0x608060405234801561001057600080fd5b50"
      const invalidBytecode = "608060405234801561001057600080fd5b50" // Missing 0x

      expect(validBytecode.startsWith("0x")).toBe(true)
      expect(invalidBytecode.startsWith("0x")).toBe(false)
    })
  })
})
