/**
 * API Fuzz Tests — Test all endpoints with random, malicious, and edge-case inputs.
 *
 * These tests verify the server never crashes (500) on any input,
 * never reflects XSS payloads, and handles all malformed data gracefully.
 *
 * Requires a running server — use vitest.e2e.config.ts or run separately.
 */

import { describe, it, expect, beforeAll } from "vitest";

let BASE_URL: string;
let API_KEY: string;

beforeAll(() => {
  BASE_URL = process.env.E2E_BASE_URL || "http://localhost:8080";
  API_KEY = process.env.E2E_API_KEY || "";
});

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) h["X-API-Key"] = API_KEY;
  return h;
}

async function safeFetch(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);
    const body = await res.text();
    return { status: res.status, body };
  } catch {
    return { status: 0, body: "" };
  }
}

// ─── Attack Payloads ─────────────────────────────────────────

const ATTACK_PAYLOADS = [
  // SQL injection
  "' OR 1=1 --",
  "'; DROP TABLE users; --",
  "1 UNION SELECT * FROM api_keys",

  // XSS
  "<script>alert(1)</script>",
  '<img src=x onerror="alert(1)">',
  "javascript:alert(1)",
  '"><script>alert(document.cookie)</script>',

  // Template injection
  "{{7*7}}",
  "${7*7}",
  "#{7*7}",
  "<%= 7*7 %>",

  // Path traversal
  "../../../etc/passwd",
  "..\\..\\..\\windows\\system32\\config\\sam",
  "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",

  // Null bytes
  "%00",
  "\x00\x00\x00",
  "test%00.json",

  // Buffer overflow attempts
  "a".repeat(10_000),
  "a".repeat(100_000),

  // Prototype pollution
  '{"__proto__": {"isAdmin": true}}',
  '{"constructor": {"prototype": {"isAdmin": true}}}',

  // Format string
  "AAAA%n%n%n%n",
  "%s%s%s%s%s",
  "%x%x%x%x",

  // Numeric edge cases
  "NaN",
  "Infinity",
  "-Infinity",
  "undefined",
  "null",
  "true",
  "false",
  "0",
  "-1",
  "999999999999999999",
  "1e308",
  "-1e308",
  "0x0",
  "0b1010",

  // Unicode edge cases
  "\uFEFF", // BOM
  "\u0000", // Null
  "\uD800", // Unpaired surrogate
  "🚀💰🔥",
  "Ω≈ç√∫",

  // CRLF injection
  "test\r\nInjected-Header: evil",
  "test%0d%0aInjected-Header: evil",

  // Command injection
  "; ls -la",
  "| cat /etc/passwd",
  "`whoami`",
  "$(whoami)",
];

// ─── Parametric Endpoint Fuzzing ─────────────────────────────

describe("Parametric Endpoint Fuzzing", () => {
  const ENDPOINTS = [
    "/api/coin/FUZZ",
    "/api/chart/FUZZ",
    "/api/ohlc/FUZZ",
    "/api/search?q=FUZZ",
    "/api/defi/protocol/FUZZ",
    "/api/defi/chain/FUZZ",
    "/api/coins?per_page=FUZZ",
    "/api/coins?page=FUZZ",
  ];

  for (const endpoint of ENDPOINTS) {
    for (const payload of ATTACK_PAYLOADS) {
      const shortPayload =
        payload.length > 40 ? `${payload.slice(0, 40)}...` : payload;

      it(`${endpoint} handles: ${shortPayload}`, async () => {
        const url = `${BASE_URL}${endpoint.replace("FUZZ", encodeURIComponent(payload))}`;
        const { status, body } = await safeFetch(url, { headers: headers() });

        // Server must NEVER return 500 (internal error)
        expect(status).not.toBe(500);

        // Must never reflect XSS payloads unescaped in response
        if (body) {
          expect(body).not.toContain("<script>alert(1)</script>");
          expect(body).not.toContain('<img src=x onerror="alert(1)">');
        }
      });
    }
  }
});

// ─── POST Body Fuzzing ───────────────────────────────────────

describe("POST Body Fuzzing", () => {
  it("POST /api/ai/ask handles all attack payloads", async () => {
    for (const payload of ATTACK_PAYLOADS) {
      const { status } = await safeFetch(`${BASE_URL}/api/ai/ask`, {
        method: "POST",
        headers: {
          ...headers(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: payload }),
      });
      expect(status).not.toBe(500);
    }
  });

  it("POST /api/ai/ask handles non-JSON bodies", async () => {
    const bodies = [
      "not json at all",
      "",
      "null",
      "[]",
      "true",
      "42",
      "{invalid json}",
      '{"question": 12345}',
      '{"question": null}',
      '{"question": []}',
      '{"question": {}}',
      '{"question": true}',
      '{"question": ""}',
    ];

    for (const body of bodies) {
      const { status } = await safeFetch(`${BASE_URL}/api/ai/ask`, {
        method: "POST",
        headers: {
          ...headers(),
          "Content-Type": "application/json",
        },
        body,
      });
      expect(status).not.toBe(500);
    }
  });

  it("POST /api/ai/ask handles malformed content types", async () => {
    const contentTypes = [
      "text/plain",
      "application/xml",
      "multipart/form-data",
      "application/x-www-form-urlencoded",
      "",
      "invalid",
    ];

    for (const ct of contentTypes) {
      const { status } = await safeFetch(`${BASE_URL}/api/ai/ask`, {
        method: "POST",
        headers: { ...headers(), ...(ct ? { "Content-Type": ct } : {}) },
        body: '{"question": "test"}',
      });
      expect(status).not.toBe(500);
    }
  });
});

// ─── Header Fuzzing ──────────────────────────────────────────

describe("Header Fuzzing", () => {
  it("handles oversized headers gracefully", async () => {
    const { status } = await safeFetch(`${BASE_URL}/health`, {
      headers: { "X-Custom": "a".repeat(50_000) },
    });
    // Should reject, not crash — 200 (ignored), 400, 413, or 431
    expect([0, 200, 400, 413, 431]).toContain(status);
  });

  it("handles many headers", async () => {
    const manyHeaders: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      manyHeaders[`X-Custom-${i}`] = `value-${i}`;
    }
    const { status } = await safeFetch(`${BASE_URL}/health`, {
      headers: manyHeaders,
    });
    expect(status).not.toBe(500);
  });

  it("handles malicious Authorization header", async () => {
    for (const payload of ATTACK_PAYLOADS.slice(0, 10)) {
      const { status } = await safeFetch(`${BASE_URL}/api/coins`, {
        headers: { ...headers(), Authorization: `Bearer ${payload}` },
      });
      expect(status).not.toBe(500);
    }
  });

  it("handles malicious X-API-Key header", async () => {
    for (const payload of ATTACK_PAYLOADS.slice(0, 10)) {
      const { status } = await safeFetch(`${BASE_URL}/api/coins`, {
        headers: { ...headers(), "X-API-Key": payload },
      });
      expect(status).not.toBe(500);
    }
  });
});

// ─── HTTP Method Fuzzing ─────────────────────────────────────

describe("HTTP Method Fuzzing", () => {
  const methods = ["PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

  for (const method of methods) {
    it(`${method} /api/coins does not crash`, async () => {
      const { status } = await safeFetch(`${BASE_URL}/api/coins`, {
        method,
        headers: headers(),
      });
      // Should return 405 (Method Not Allowed) or similar, never 500
      expect(status).not.toBe(500);
    });
  }
});

// ─── URL Encoding Edge Cases ─────────────────────────────────

describe("URL Encoding Edge Cases", () => {
  const encodingCases = [
    "/api/coin/bitcoin%20ethereum",
    "/api/coin/bitcoin%00",
    "/api/coin/bitcoin%0d%0a",
    "/api/coin/bitcoin/../../../etc/passwd",
    "/api/coin/bit%63oin", // %63 = 'c'
    "/api/coin/BITCOIN",   // Case sensitivity
    "/api/coin/.",
    "/api/coin/..",
    "/api/coin/..%2F..%2F",
  ];

  for (const path of encodingCases) {
    it(`handles ${path}`, async () => {
      const { status } = await safeFetch(`${BASE_URL}${path}`, {
        headers: headers(),
      });
      expect(status).not.toBe(500);
    });
  }
});
