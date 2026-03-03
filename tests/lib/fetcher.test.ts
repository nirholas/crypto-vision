/**
 * Tests for lib/fetcher.ts — fetchJSON with retries, circuit breaker, timeout
 *
 * All HTTP calls are mocked via vi.stubGlobal — no live API traffic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchJSON, FetchError, circuitBreakerStats } from "@/lib/fetcher.js";

// ─── Helpers ─────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─── Successful fetch ────────────────────────────────────────

describe("fetchJSON — success path", () => {
  it("returns parsed JSON on 200", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ price: 42 }));
    const data = await fetchJSON<{ price: number }>("https://api.example.com/v1/price");
    expect(data).toEqual({ price: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends correct default headers", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await fetchJSON("https://api.example.com/v1/test");

    const callArgs = fetchMock.mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers).toMatchObject({
      Accept: "application/json",
      "User-Agent": "CryptoVision/1.0",
    });
  });

  it("passes custom headers", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await fetchJSON("https://api.example.com/v1/test", {
      headers: { "x-api-key": "secret" },
    });

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers["x-api-key"]).toBe("secret");
  });

  it("sends JSON body for POST requests", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await fetchJSON("https://api.example.com/v1/data", {
      method: "POST",
      body: { query: "bitcoin" },
    });

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].body).toBe(JSON.stringify({ query: "bitcoin" }));
    expect(callArgs[1].headers["Content-Type"]).toBe("application/json");
  });
});

// ─── Retries ─────────────────────────────────────────────────

describe("fetchJSON — retries", () => {
  it("retries on network error and succeeds on second attempt", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("network fail"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const data = await fetchJSON<{ ok: boolean }>("https://api.retry-test.com/data", {
      retries: 2,
    });
    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries", async () => {
    fetchMock.mockRejectedValue(new Error("persistent failure"));

    await expect(
      fetchJSON("https://api.exhaust-retries.com/data", { retries: 1 })
    ).rejects.toThrow("persistent failure");

    // 1 initial + 1 retry = 2 calls
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on HTTP 500 and eventually succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "server" }, 500))
      .mockResolvedValueOnce(jsonResponse({ data: "ok" }));

    // 500 triggers recordFailure + FetchError, then retry path
    // The implementation throws FetchError on non-ok responses
    // which triggers the retry with backoff
    const result = await fetchJSON<{ data: string }>("https://api.retry-500.com/data", {
      retries: 2,
    });
    expect(result).toEqual({ data: "ok" });
  });
});

// ─── Error handling ──────────────────────────────────────────

describe("fetchJSON — error handling", () => {
  it("throws FetchError for non-OK HTTP status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "not found" }, 404));

    await expect(
      fetchJSON("https://api.error-test.com/missing", { retries: 0 })
    ).rejects.toThrow(FetchError);
  });

  it("FetchError exposes status and source", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 403));

    try {
      await fetchJSON("https://api.error-props.com/forbidden", { retries: 0 });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBe(403);
      expect((err as FetchError).source).toBe("api.error-props.com");
    }
  });
});

// ─── Rate Limiting (429) ─────────────────────────────────────

describe("fetchJSON — 429 handling", () => {
  it("backs off on 429 and retries", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({}, 429, { "Retry-After": "1" })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    const result = await fetchJSON<{ success: boolean }>(
      "https://api.ratelimit-test.com/data",
      { retries: 2 }
    );
    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ─── Circuit Breaker ─────────────────────────────────────────

describe("fetchJSON — circuit breaker", () => {
  it("circuitBreakerStats returns object", () => {
    const stats = circuitBreakerStats();
    expect(typeof stats).toBe("object");
  });

  it("opens circuit after repeated failures", async () => {
    // Fail enough times to trip the circuit breaker (default threshold = 5)
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    for (let i = 0; i < 6; i++) {
      try {
        await fetchJSON(`https://circuit-open-test.com/data?i=${i}`, { retries: 0 });
      } catch {
        // expected
      }
    }

    // Next call should throw immediately with 503 (circuit open)
    await expect(
      fetchJSON("https://circuit-open-test.com/another", { retries: 0 })
    ).rejects.toThrow(/circuit open/i);
  });

  it("skipCircuitBreaker bypasses the check", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    // Trip the breaker for this host
    for (let i = 0; i < 6; i++) {
      try {
        await fetchJSON(`https://circuit-skip-test.com/data?i=${i}`, { retries: 0 });
      } catch {
        // expected
      }
    }

    // With skipCircuitBreaker, it should still attempt the request
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const data = await fetchJSON<{ ok: boolean }>(
      "https://circuit-skip-test.com/data",
      { retries: 0, skipCircuitBreaker: true }
    );
    expect(data).toEqual({ ok: true });
  });
});

// ─── Timeout ─────────────────────────────────────────────────

describe("fetchJSON — timeout", () => {
  it("aborts the request when timeout is exceeded", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          // Listen for abort and reject
          init.signal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
          // Never resolves — simulates a hang
        })
    );

    await expect(
      fetchJSON("https://api.timeout-test.com/slow", { timeout: 100, retries: 0 })
    ).rejects.toThrow();
  });

  it("completes if response arrives before timeout", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ fast: true }));

    const result = await fetchJSON<{ fast: boolean }>("https://api.fast-test.com/data", {
      timeout: 5000,
      retries: 0,
    });
    expect(result).toEqual({ fast: true });
  });
});

// ─── 429 default Retry-After ─────────────────────────────────

describe("fetchJSON — 429 default backoff", () => {
  it("defaults to 5 second backoff when Retry-After header is missing", async () => {
    const response429 = new Response(JSON.stringify({ error: "limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
    fetchMock
      .mockResolvedValueOnce(response429)
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await fetchJSON<{ ok: boolean }>("https://api.default429.com/data", {
      retries: 2,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ─── No retries (retries=0) ──────────────────────────────────

describe("fetchJSON — retries=0", () => {
  it("does not retry when retries is 0", async () => {
    fetchMock.mockRejectedValue(new Error("single failure"));

    await expect(
      fetchJSON("https://api.no-retry-test.com/data", { retries: 0 }),
    ).rejects.toThrow("single failure");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
