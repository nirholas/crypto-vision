/**
 * Tests for utility helper functions
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect } from "vitest"

import { mcpToolRes, safeStringify, safeParse } from "@/utils/helper"

describe("MCP Tool Response Helper", () => {
  describe("mcpToolRes.success", () => {
    it("should format success response correctly", () => {
      const data = { balance: "1.0", symbol: "ETH" }
      const result = mcpToolRes.success(data)

      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe("text")

      const parsed = JSON.parse(result.content[0].text)
      // mcpToolRes.success returns data directly, not wrapped
      expect(parsed.balance).toBe("1.0")
      expect(parsed.symbol).toBe("ETH")
    })

    it("should handle complex nested objects", () => {
      const data = {
        user: {
          address: "0x123",
          balances: [
            { token: "ETH", amount: "1.0" },
            { token: "USDC", amount: "100.0" }
          ]
        }
      }
      const result = mcpToolRes.success(data)
      const parsed = JSON.parse(result.content[0].text)

      expect(parsed.user.balances).toHaveLength(2)
    })

    it("should handle null and undefined values", () => {
      const data = { value: null, optional: undefined }
      const result = mcpToolRes.success(data)
      const parsed = JSON.parse(result.content[0].text)

      expect(parsed.value).toBeNull()
      // undefined is not included in JSON
      expect("optional" in parsed).toBe(false)
    })
  })

  describe("mcpToolRes.error", () => {
    it("should format error response correctly", () => {
      const error = new Error("Something went wrong")
      const result = mcpToolRes.error(error, "fetching data")

      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe("text")
      // Error responses are plain text, not JSON
      expect(result.content[0].text).toContain("Something went wrong")
      expect(result.content[0].text).toContain("fetching data")
    })

    it("should handle string errors", () => {
      const result = mcpToolRes.error("Network timeout", "connecting")

      expect(result.content[0].text).toContain("Network timeout")
      expect(result.content[0].text).toContain("connecting")
    })

    it("should handle unknown error types", () => {
      const result = mcpToolRes.error({ code: 500 }, "processing")

      expect(result.content[0].text).toContain("processing")
    })
  })
})

describe("safeStringify", () => {
  it("should stringify regular objects", () => {
    const result = safeStringify({ key: "value" })
    expect(JSON.parse(result)).toEqual({ key: "value" })
  })

  it("should handle BigInt values", () => {
    const result = safeStringify({ amount: BigInt("1000000000000000000") })
    const parsed = JSON.parse(result)
    expect(parsed.amount).toBe("1000000000000000000")
  })

  it("should handle nested BigInt values", () => {
    const result = safeStringify({
      data: {
        balance: BigInt(100),
        items: [{ value: BigInt(50) }]
      }
    })
    const parsed = JSON.parse(result)
    expect(parsed.data.balance).toBe("100")
    expect(parsed.data.items[0].value).toBe("50")
  })
})

describe("safeParse", () => {
  it("should parse valid JSON", () => {
    const result = safeParse('{"key": "value"}')
    expect(result).toEqual({ key: "value" })
  })

  it("should return null for invalid JSON", () => {
    const result = safeParse("not valid json")
    expect(result).toBeNull()
  })
})
