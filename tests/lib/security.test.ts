/**
 * Tests for lib/security.ts — Security hardening utilities
 *
 * Exercises input sanitization, XSS prevention, path traversal detection,
 * error sanitization, and timing-safe comparison.
 */

import { describe, it, expect } from "vitest";
import {
  sanitizeInput,
  escapeHtml,
  sanitizeCoinId,
  isValidHexAddress,
  hasPathTraversal,
  isBodySizeAcceptable,
  sanitizeError,
  safeErrorResponse,
  extractClientIp,
  isJsonContentType,
  timingSafeEqual,
} from "../../src/lib/security.js";

// ─── sanitizeInput ───────────────────────────────────────────

describe("sanitizeInput", () => {
  it("strips HTML tags", () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
      'alert("xss")',
    );
    expect(sanitizeInput('<img src=x onerror="alert(1)">')).toBe("");
    expect(sanitizeInput("normal text")).toBe("normal text");
  });

  it("limits length", () => {
    const long = "a".repeat(2000);
    expect(sanitizeInput(long).length).toBe(1000);
    expect(sanitizeInput(long, 50).length).toBe(50);
  });

  it("strips control characters", () => {
    expect(sanitizeInput("hello\x00world")).toBe("helloworld");
    expect(sanitizeInput("test\x1Fdata")).toBe("testdata");
  });

  it("preserves newlines, tabs, and carriage returns", () => {
    expect(sanitizeInput("line1\nline2")).toBe("line1\nline2");
    expect(sanitizeInput("col1\tcol2")).toBe("col1\tcol2");
  });

  it("trims whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });
});

// ─── escapeHtml ──────────────────────────────────────────────

describe("escapeHtml", () => {
  it("encodes all 5 special HTML characters", () => {
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#x27;");
  });

  it("encodes XSS payloads", () => {
    const result = escapeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("leaves safe text unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });
});

// ─── sanitizeCoinId ──────────────────────────────────────────

describe("sanitizeCoinId", () => {
  it("accepts valid coin IDs", () => {
    expect(sanitizeCoinId("bitcoin")).toBe("bitcoin");
    expect(sanitizeCoinId("ethereum")).toBe("ethereum");
    expect(sanitizeCoinId("wrapped-bitcoin")).toBe("wrapped-bitcoin");
    expect(sanitizeCoinId("sol_bridge")).toBe("sol_bridge");
  });

  it("lowercases input", () => {
    expect(sanitizeCoinId("Bitcoin")).toBe("bitcoin");
    expect(sanitizeCoinId("ETHEREUM")).toBe("ethereum");
  });

  it("rejects malicious IDs", () => {
    expect(sanitizeCoinId("../etc/passwd")).toBeNull();
    expect(sanitizeCoinId("<script>")).toBeNull();
    expect(sanitizeCoinId("coin OR 1=1")).toBeNull();
    expect(sanitizeCoinId("")).toBeNull();
    expect(sanitizeCoinId(" ")).toBeNull();
  });

  it("truncates at 128 characters", () => {
    const long = "a".repeat(200);
    const result = sanitizeCoinId(long);
    expect(result?.length).toBe(128);
  });
});

// ─── isValidHexAddress ───────────────────────────────────────

describe("isValidHexAddress", () => {
  it("accepts valid Ethereum addresses", () => {
    expect(
      isValidHexAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68"),
    ).toBe(true);
    expect(
      isValidHexAddress("0x0000000000000000000000000000000000000000"),
    ).toBe(true);
  });

  it("rejects invalid addresses", () => {
    expect(isValidHexAddress("0xinvalid")).toBe(false);
    expect(isValidHexAddress("not-an-address")).toBe(false);
    expect(isValidHexAddress("0x742d35")).toBe(false); // Too short
    expect(isValidHexAddress("")).toBe(false);
  });
});

// ─── hasPathTraversal ────────────────────────────────────────

describe("hasPathTraversal", () => {
  it("detects path traversal attempts", () => {
    expect(hasPathTraversal("../etc/passwd")).toBe(true);
    expect(hasPathTraversal("..\\windows\\system32")).toBe(true);
    expect(hasPathTraversal("%2e%2e%2fetc%2fpasswd")).toBe(true);
    expect(hasPathTraversal("test\x00file")).toBe(true);
  });

  it("allows safe paths", () => {
    expect(hasPathTraversal("bitcoin")).toBe(false);
    expect(hasPathTraversal("aave-v3")).toBe(false);
    expect(hasPathTraversal("protocol/lending")).toBe(false);
  });
});

// ─── isBodySizeAcceptable ────────────────────────────────────

describe("isBodySizeAcceptable", () => {
  it("accepts bodies within limit", () => {
    expect(isBodySizeAcceptable(1024)).toBe(true);
    expect(isBodySizeAcceptable(256 * 1024)).toBe(true);
  });

  it("rejects oversized bodies", () => {
    expect(isBodySizeAcceptable(256 * 1024 + 1)).toBe(false);
    expect(isBodySizeAcceptable(10_000_000)).toBe(false);
  });

  it("accepts undefined (trusts middleware)", () => {
    expect(isBodySizeAcceptable(undefined)).toBe(true);
  });

  it("respects custom maxBytes", () => {
    expect(isBodySizeAcceptable(500, 1000)).toBe(true);
    expect(isBodySizeAcceptable(1500, 1000)).toBe(false);
  });
});

// ─── sanitizeError ───────────────────────────────────────────

describe("sanitizeError", () => {
  it("strips file paths from error messages", () => {
    const err = new Error("Cannot read /home/user/.env: ENOENT");
    const result = sanitizeError(err);
    expect(result.message).not.toContain("/home/user");
    expect(result.message).toContain("[path]");
  });

  it("redacts secrets from error messages", () => {
    const err = new Error("API key=sk-abc123 is invalid");
    const result = sanitizeError(err);
    expect(result.message).not.toContain("sk-abc123");
    expect(result.message).toContain("[redacted]");
  });

  it("handles non-Error objects", () => {
    const result = sanitizeError("string error");
    expect(result.message).toBe("An unexpected error occurred");
  });

  it("truncates long error messages", () => {
    const err = new Error("x".repeat(1000));
    const result = sanitizeError(err);
    expect(result.message.length).toBeLessThanOrEqual(500);
  });
});

// ─── safeErrorResponse ───────────────────────────────────────

describe("safeErrorResponse", () => {
  it("creates structured error response", () => {
    const res = safeErrorResponse(400, "Invalid input", "field required");
    expect(res.error.status).toBe(400);
    expect(res.error.message).toBe("Invalid input");
    expect(res.error.details).toBe("field required");
  });

  it("sanitizes message content", () => {
    const res = safeErrorResponse(500, '<script>alert("xss")</script>');
    expect(res.error.message).not.toContain("<script>");
  });

  it("omits details when not provided", () => {
    const res = safeErrorResponse(404, "Not found");
    expect(res.error.details).toBeUndefined();
  });
});

// ─── extractClientIp ─────────────────────────────────────────

describe("extractClientIp", () => {
  it("prefers X-Forwarded-For", () => {
    expect(extractClientIp("10.0.0.1", "203.0.113.50, 70.41.3.18")).toBe(
      "203.0.113.50",
    );
  });

  it("falls back to remote address", () => {
    expect(extractClientIp("10.0.0.1")).toBe("10.0.0.1");
  });

  it("normalizes IPv6 loopback", () => {
    expect(extractClientIp("::1")).toBe("127.0.0.1");
  });

  it("strips port from IPv4 address", () => {
    expect(extractClientIp("10.0.0.1:54321")).toBe("10.0.0.1");
  });
});

// ─── isJsonContentType ───────────────────────────────────────

describe("isJsonContentType", () => {
  it("accepts application/json", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
    expect(isJsonContentType("APPLICATION/JSON")).toBe(true);
  });

  it("rejects non-JSON types", () => {
    expect(isJsonContentType("text/plain")).toBe(false);
    expect(isJsonContentType("application/xml")).toBe(false);
    expect(isJsonContentType("")).toBe(false);
    expect(isJsonContentType(undefined)).toBe(false);
  });
});

// ─── timingSafeEqual ─────────────────────────────────────────

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("long-api-key-12345", "long-api-key-12345")).toBe(
      true,
    );
  });

  it("returns false for different strings", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("abc", "")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(timingSafeEqual("short", "longer-string")).toBe(false);
  });
});
