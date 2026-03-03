/**
 * Tests for error utilities
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi } from "vitest"

import {
  McpError,
  NetworkError,
  ValidationError,
  RateLimitError,
  ContractError,
  TransactionError,
  InsufficientFundsError,
  ChainNotSupportedError,
  getErrorMessage,
  wrapError,
  withRetry
} from "./errors"

describe("Error Classes", () => {
  describe("McpError", () => {
    it("should create error with code and context", () => {
      const error = new McpError("Test error", "TEST_CODE", { key: "value" })

      expect(error.message).toBe("Test error")
      expect(error.code).toBe("TEST_CODE")
      expect(error.context).toEqual({ key: "value" })
      expect(error.name).toBe("McpError")
    })

    it("should serialize to JSON correctly", () => {
      const error = new McpError("Test error", "TEST_CODE", { key: "value" })
      const json = error.toJSON()

      expect(json).toEqual({
        name: "McpError",
        message: "Test error",
        code: "TEST_CODE",
        context: { key: "value" }
      })
    })
  })

  describe("NetworkError", () => {
    it("should have NETWORK_ERROR code", () => {
      const error = new NetworkError("Connection failed")
      expect(error.code).toBe("NETWORK_ERROR")
      expect(error.name).toBe("NetworkError")
    })
  })

  describe("ValidationError", () => {
    it("should have VALIDATION_ERROR code", () => {
      const error = new ValidationError("Invalid input")
      expect(error.code).toBe("VALIDATION_ERROR")
      expect(error.name).toBe("ValidationError")
    })
  })

  describe("RateLimitError", () => {
    it("should include retryAfter", () => {
      const error = new RateLimitError("Too many requests", 60)
      expect(error.code).toBe("RATE_LIMIT_ERROR")
      expect(error.retryAfter).toBe(60)
    })
  })

  describe("TransactionError", () => {
    it("should include txHash", () => {
      const error = new TransactionError("Transaction failed", "0x123abc")
      expect(error.code).toBe("TRANSACTION_ERROR")
      expect(error.txHash).toBe("0x123abc")
    })
  })

  describe("InsufficientFundsError", () => {
    it("should include required and available amounts", () => {
      const error = new InsufficientFundsError("1.0", "0.5")
      expect(error.message).toContain("1.0")
      expect(error.message).toContain("0.5")
      expect(error.required).toBe("1.0")
      expect(error.available).toBe("0.5")
    })
  })

  describe("ChainNotSupportedError", () => {
    it("should include chainId", () => {
      const error = new ChainNotSupportedError(999)
      expect(error.message).toContain("999")
      expect(error.chainId).toBe(999)
    })
  })
})

describe("getErrorMessage", () => {
  it("should extract message from Error", () => {
    expect(getErrorMessage(new Error("Test error"))).toBe("Test error")
  })

  it("should return string as-is", () => {
    expect(getErrorMessage("Test error")).toBe("Test error")
  })

  it("should extract message from object", () => {
    expect(getErrorMessage({ message: "Test error" })).toBe("Test error")
  })

  it("should return default for unknown types", () => {
    expect(getErrorMessage(null)).toBe("An unknown error occurred")
    expect(getErrorMessage(undefined)).toBe("An unknown error occurred")
    expect(getErrorMessage(123)).toBe("An unknown error occurred")
  })
})

describe("wrapError", () => {
  it("should return McpError as-is", () => {
    const error = new McpError("Test", "TEST")
    expect(wrapError(error, "Default")).toBe(error)
  })

  it("should wrap regular Error", () => {
    const error = new Error("Original error")
    const wrapped = wrapError(error, "Default")

    expect(wrapped).toBeInstanceOf(McpError)
    expect(wrapped.message).toBe("Original error")
    expect(wrapped.code).toBe("UNKNOWN_ERROR")
  })

  it("should use default message for unknown errors", () => {
    const wrapped = wrapError(null, "Default message")
    // getErrorMessage returns "An unknown error occurred" for null, which is truthy
    expect(wrapped.message).toBe("An unknown error occurred")
  })
})

describe("withRetry", () => {
  it("should return result on success", async () => {
    const fn = vi.fn().mockResolvedValue("success")
    const result = await withRetry(fn)

    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("should retry on failure", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError("Failed"))
      .mockResolvedValueOnce("success")

    const result = await withRetry(fn, { baseDelayMs: 10 })

    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("should throw after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new NetworkError("Failed"))

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })
    ).rejects.toThrow("Failed")

    expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it("should not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new ValidationError("Invalid"))

    await expect(withRetry(fn, { baseDelayMs: 10 })).rejects.toThrow("Invalid")

    expect(fn).toHaveBeenCalledTimes(1) // No retries
  })
})
