/**
 * Tests for validation utilities
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, beforeEach } from "vitest"

import {
  ethereumAddressSchema,
  transactionHashSchema,
  privateKeySchema,
  ensNameSchema,
  tokenAmountSchema,
  slippageSchema,
  gasLimitSchema,
  sanitizeInput,
  normalizeNetworkName,
  validateNotBlockedAddress,
  RateLimiter
} from "./validation"

describe("Validation Utilities", () => {
  describe("ethereumAddressSchema", () => {
    it("should accept valid Ethereum addresses", () => {
      const validAddresses = [
        "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0x0000000000000000000000000000000000000001"
      ]

      for (const address of validAddresses) {
        expect(() => ethereumAddressSchema.parse(address)).not.toThrow()
      }
    })

    it("should reject invalid Ethereum addresses", () => {
      const invalidAddresses = [
        "0x123", // Too short
        "d8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // Missing 0x prefix
        "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ", // Invalid characters
        "", // Empty
        "not an address"
      ]

      for (const address of invalidAddresses) {
        expect(() => ethereumAddressSchema.parse(address)).toThrow()
      }
    })

    it("should normalize addresses to lowercase", () => {
      const result = ethereumAddressSchema.parse(
        "0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045"
      )
      expect(result).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
    })
  })

  describe("transactionHashSchema", () => {
    it("should accept valid transaction hashes", () => {
      const validHash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      expect(() => transactionHashSchema.parse(validHash)).not.toThrow()
    })

    it("should reject invalid transaction hashes", () => {
      const invalidHashes = [
        "0x1234", // Too short
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // Missing prefix
        ""
      ]

      for (const hash of invalidHashes) {
        expect(() => transactionHashSchema.parse(hash)).toThrow()
      }
    })
  })

  describe("ensNameSchema", () => {
    it("should accept valid ENS names", () => {
      const validNames = ["vitalik.eth", "nick.eth", "my-domain.eth"]

      for (const name of validNames) {
        expect(() => ensNameSchema.parse(name)).not.toThrow()
      }
    })

    it("should reject invalid ENS names", () => {
      const invalidNames = [
        "vitalik", // Missing .eth
        "vitalik.com", // Wrong TLD
        ".eth", // Empty name
        "invalid name.eth" // Space in name
      ]

      for (const name of invalidNames) {
        expect(() => ensNameSchema.parse(name)).toThrow()
      }
    })
  })

  describe("tokenAmountSchema", () => {
    it("should accept valid token amounts", () => {
      const validAmounts = ["100", "0.5", "1000000000000000000", "0.000001"]

      for (const amount of validAmounts) {
        expect(() => tokenAmountSchema.parse(amount)).not.toThrow()
      }
    })

    it("should reject invalid token amounts", () => {
      const invalidAmounts = ["-100", "abc", "1.2.3", ""]

      for (const amount of invalidAmounts) {
        expect(() => tokenAmountSchema.parse(amount)).toThrow()
      }
    })
  })

  describe("slippageSchema", () => {
    it("should accept valid slippage values", () => {
      expect(slippageSchema.parse(0)).toBe(0)
      expect(slippageSchema.parse(0.5)).toBe(0.5)
      expect(slippageSchema.parse(100)).toBe(100)
    })

    it("should reject invalid slippage values", () => {
      expect(() => slippageSchema.parse(-1)).toThrow()
      expect(() => slippageSchema.parse(101)).toThrow()
    })

    it("should use default value when undefined", () => {
      expect(slippageSchema.parse(undefined)).toBe(0.5)
    })
  })

  describe("gasLimitSchema", () => {
    it("should accept valid gas limits", () => {
      expect(gasLimitSchema.parse(21000)).toBe(21000)
      expect(gasLimitSchema.parse(500000)).toBe(500000)
    })

    it("should reject invalid gas limits", () => {
      expect(() => gasLimitSchema.parse(20000)).toThrow() // Too low
      expect(() => gasLimitSchema.parse(50000000)).toThrow() // Too high
    })
  })

  describe("sanitizeInput", () => {
    it("should remove HTML tags", () => {
      expect(sanitizeInput("<script>alert('xss')</script>")).toBe(
        "scriptalert('xss')/script"
      )
    })

    it("should remove control characters", () => {
      expect(sanitizeInput("hello\x00world")).toBe("helloworld")
    })

    it("should trim whitespace", () => {
      expect(sanitizeInput("  hello  ")).toBe("hello")
    })
  })

  describe("normalizeNetworkName", () => {
    it("should normalize common aliases", () => {
      expect(normalizeNetworkName("ETH")).toBe("ethereum")
      expect(normalizeNetworkName("mainnet")).toBe("ethereum")
      expect(normalizeNetworkName("MATIC")).toBe("polygon")
      expect(normalizeNetworkName("arb")).toBe("arbitrum")
    })

    it("should handle unknown networks", () => {
      expect(normalizeNetworkName("custom-network")).toBe("custom-network")
    })
  })

  describe("validateNotBlockedAddress", () => {
    it("should return false for blocked addresses", () => {
      expect(
        validateNotBlockedAddress(
          "0x0000000000000000000000000000000000000000"
        )
      ).toBe(false)
      expect(
        validateNotBlockedAddress(
          "0x000000000000000000000000000000000000dead"
        )
      ).toBe(false)
    })

    it("should return true for valid addresses", () => {
      expect(
        validateNotBlockedAddress(
          "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        )
      ).toBe(true)
    })
  })

  describe("RateLimiter", () => {
    let limiter: RateLimiter

    beforeEach(() => {
      limiter = new RateLimiter(3, 1000) // 3 requests per second
    })

    it("should allow requests within limit", () => {
      expect(limiter.isAllowed("user1")).toBe(true)
      expect(limiter.isAllowed("user1")).toBe(true)
      expect(limiter.isAllowed("user1")).toBe(true)
    })

    it("should block requests over limit", () => {
      limiter.isAllowed("user1")
      limiter.isAllowed("user1")
      limiter.isAllowed("user1")
      expect(limiter.isAllowed("user1")).toBe(false)
    })

    it("should track different keys separately", () => {
      limiter.isAllowed("user1")
      limiter.isAllowed("user1")
      limiter.isAllowed("user1")
      expect(limiter.isAllowed("user2")).toBe(true)
    })

    it("should reset limits for a key", () => {
      limiter.isAllowed("user1")
      limiter.isAllowed("user1")
      limiter.isAllowed("user1")
      limiter.reset("user1")
      expect(limiter.isAllowed("user1")).toBe(true)
    })
  })
})
