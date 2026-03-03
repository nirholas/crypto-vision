/**
 * Tests for EVM chains configuration
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect } from "vitest"

import {
  chainMap,
  networkNameMap,
  rpcUrlMap,
  DEFAULT_CHAIN_ID,
  DEFAULT_RPC_URL
} from "@/evm/chains"

describe("EVM Chains Configuration", () => {
  describe("chainMap", () => {
    it("should contain all major mainnet chains", () => {
      const mainnetChainIds = [1, 10, 42161, 8453, 137, 56, 204, 4689]
      for (const chainId of mainnetChainIds) {
        expect(chainMap[chainId]).toBeDefined()
        expect(chainMap[chainId]!.id).toBe(chainId)
      }
    })

    it("should contain all major testnet chains", () => {
      const testnetChainIds = [11155111, 11155420, 421614, 84532, 80002, 97, 5611, 4690]
      for (const chainId of testnetChainIds) {
        expect(chainMap[chainId]).toBeDefined()
        expect(chainMap[chainId]!.id).toBe(chainId)
      }
    })

    it("should have valid chain objects with required properties", () => {
      for (const [chainId, chain] of Object.entries(chainMap)) {
        expect(chain).toHaveProperty("id")
        expect(chain).toHaveProperty("name")
        expect(chain.id).toBe(Number(chainId))
      }
    })
  })

  describe("networkNameMap", () => {
    it("should map common network names to chain IDs", () => {
      expect(networkNameMap["ethereum"]).toBe(1)
      expect(networkNameMap["mainnet"]).toBe(1)
      expect(networkNameMap["eth"]).toBe(1)
      expect(networkNameMap["bsc"]).toBe(56)
      expect(networkNameMap["polygon"]).toBe(137)
      expect(networkNameMap["arbitrum"]).toBe(42161)
      expect(networkNameMap["optimism"]).toBe(10)
      expect(networkNameMap["base"]).toBe(8453)
    })

    it("should map testnet names correctly", () => {
      expect(networkNameMap["sepolia"]).toBe(11155111)
      expect(networkNameMap["bsc-testnet"]).toBe(97)
      expect(networkNameMap["bsctestnet"]).toBe(97)
      expect(networkNameMap["polygon-amoy"]).toBe(80002)
    })

    it("should have consistent mappings with chainMap", () => {
      for (const [name, chainId] of Object.entries(networkNameMap)) {
        expect(chainMap[chainId]).toBeDefined()
      }
    })
  })

  describe("rpcUrlMap", () => {
    it("should have RPC URLs for all mainnet chains", () => {
      const mainnetChainIds = [1, 10, 42161, 8453, 137, 56, 204]
      for (const chainId of mainnetChainIds) {
        expect(rpcUrlMap[chainId]).toBeDefined()
        expect(rpcUrlMap[chainId]).toMatch(/^https?:\/\//)
      }
    })

    it("should have valid HTTPS URLs", () => {
      for (const [chainId, url] of Object.entries(rpcUrlMap)) {
        expect(url).toMatch(/^https:\/\//)
      }
    })
  })

  describe("defaults", () => {
    it("should have valid default chain ID", () => {
      expect(DEFAULT_CHAIN_ID).toBe(1)
      expect(chainMap[DEFAULT_CHAIN_ID]).toBeDefined()
    })

    it("should have valid default RPC URL", () => {
      expect(DEFAULT_RPC_URL).toMatch(/^https:\/\//)
    })
  })
})
