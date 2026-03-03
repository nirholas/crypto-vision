/**
 * Tests for lib/ai.ts — aiComplete, aiCompleteJSON, askAI, isAIConfigured,
 * getConfiguredProviders, AIAuthError
 *
 * All external API calls are mocked via vi.mock of fetcher.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock cache
vi.mock("@/lib/cache.js", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
vi.mock("@/lib/logger.js", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fetchJSON before importing AI module
const mockFetchJSON = vi.fn();
vi.mock("@/lib/fetcher.js", () => ({
  fetchJSON: (...args: unknown[]) => mockFetchJSON(...args),
}));

import {
  aiComplete,
  aiCompleteJSON,
  askAI,
  isAIConfigured,
  getConfiguredProviders,
  AIAuthError,
} from "@/lib/ai.js";
import { cache } from "@/lib/cache.js";

// ─── Helpers ────────────────────────────────────────────────

function setProviderEnv(provider: string, key: string) {
  vi.stubEnv(provider, key);
}

function clearAllProviderEnvs() {
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.stubEnv("SELF_HOSTED_URL", "");
  vi.stubEnv("VERTEX_FINETUNED_ENDPOINT", "");
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAllProviderEnvs();
});

// ─── isAIConfigured ─────────────────────────────────────────

describe("isAIConfigured()", () => {
  it("returns false when no provider keys are set", () => {
    expect(isAIConfigured()).toBe(false);
  });

  it("returns true when at least one provider key is set", () => {
    setProviderEnv("GROQ_API_KEY", "test-key");
    expect(isAIConfigured()).toBe(true);
  });
});

// ─── getConfiguredProviders ─────────────────────────────────

describe("getConfiguredProviders()", () => {
  it("returns empty array when no providers configured", () => {
    expect(getConfiguredProviders()).toEqual([]);
  });

  it("returns array of configured provider names", () => {
    setProviderEnv("GROQ_API_KEY", "test-key");
    setProviderEnv("OPENAI_API_KEY", "test-key-2");
    const providers = getConfiguredProviders();
    expect(providers).toContain("groq");
    expect(providers).toContain("openai");
  });
});

// ─── AIAuthError ────────────────────────────────────────────

describe("AIAuthError", () => {
  it("is an instance of Error", () => {
    const err = new AIAuthError("groq", "Invalid API key");
    expect(err).toBeInstanceOf(Error);
  });

  it("stores provider and message", () => {
    const err = new AIAuthError("openai", "Rate limited");
    expect(err.provider).toBe("openai");
    expect(err.message).toBe("Rate limited");
    expect(err.name).toBe("AIAuthError");
  });
});

// ─── aiComplete ─────────────────────────────────────────────

describe("aiComplete()", () => {
  it("throws when no providers are configured", async () => {
    await expect(aiComplete("system", "user")).rejects.toThrow("No AI provider configured");
  });

  it("returns AI response from Groq provider", async () => {
    setProviderEnv("GROQ_API_KEY", "test-groq-key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: "Bitcoin is a cryptocurrency." } }],
      usage: { total_tokens: 42 },
    });

    const result = await aiComplete("You are an analyst", "What is Bitcoin?");
    expect(result.text).toBe("Bitcoin is a cryptocurrency.");
    expect(result.provider).toBe("groq");
    expect(result.model).toBe("llama-3.3-70b-versatile");
    expect(result.tokensUsed).toBe(42);
  });

  it("returns AI response from Gemini provider", async () => {
    setProviderEnv("GEMINI_API_KEY", "test-gemini-key");
    mockFetchJSON.mockResolvedValueOnce({
      candidates: [{ content: { parts: [{ text: "Gemini response" }] } }],
      usageMetadata: { totalTokenCount: 100 },
    });

    const result = await aiComplete("system", "user");
    expect(result.text).toBe("Gemini response");
    expect(result.provider).toBe("gemini");
    expect(result.tokensUsed).toBe(100);
  });

  it("returns AI response from OpenAI provider", async () => {
    setProviderEnv("OPENAI_API_KEY", "test-openai-key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: "OpenAI says hello" } }],
      usage: { total_tokens: 55 },
    });

    const result = await aiComplete("system", "user");
    expect(result.text).toBe("OpenAI says hello");
    expect(result.provider).toBe("openai");
  });

  it("returns AI response from Anthropic provider", async () => {
    setProviderEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
    mockFetchJSON.mockResolvedValueOnce({
      content: [{ text: "Anthropic response" }],
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const result = await aiComplete("system", "user");
    expect(result.text).toBe("Anthropic response");
    expect(result.provider).toBe("anthropic");
    expect(result.tokensUsed).toBe(30);
  });

  it("falls through to next provider on auth error (401)", async () => {
    setProviderEnv("GROQ_API_KEY", "bad-key");
    setProviderEnv("OPENAI_API_KEY", "good-key");

    mockFetchJSON
      .mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }))
      .mockResolvedValueOnce({
        choices: [{ message: { content: "OpenAI fallback" } }],
        usage: { total_tokens: 10 },
      });

    const result = await aiComplete("system", "user");
    expect(result.provider).toBe("openai");
    expect(result.text).toBe("OpenAI fallback");
  });

  it("falls through to next provider on rate limit (429)", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    setProviderEnv("OPENAI_API_KEY", "key2");

    mockFetchJSON
      .mockRejectedValueOnce(Object.assign(new Error("Rate limited"), { status: 429 }))
      .mockResolvedValueOnce({
        choices: [{ message: { content: "fallback" } }],
        usage: { total_tokens: 5 },
      });

    const result = await aiComplete("system", "user");
    expect(result.provider).toBe("openai");
  });

  it("throws when all providers fail", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockRejectedValueOnce(new Error("Provider down"));

    await expect(aiComplete("system", "user")).rejects.toThrow("Provider down");
  });

  it("throws when forced provider is not configured", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    await expect(
      aiComplete("system", "user", { provider: "openai" }),
    ).rejects.toThrow("not configured");
  });

  it("throws when provider returns empty text", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    });

    await expect(aiComplete("system", "user")).rejects.toThrow("Empty response");
  });

  it("caches result when cacheKey is provided", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: "cached result" } }],
      usage: { total_tokens: 10 },
    });

    await aiComplete("system", "user", { cacheKey: "test-cache", cacheTTL: 600 });

    expect(cache.set).toHaveBeenCalledWith(
      "ai:test-cache",
      expect.any(String),
      600,
    );
  });

  it("returns cached result when available", async () => {
    const cached = JSON.stringify({
      text: "from cache",
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      tokensUsed: 5,
    });
    vi.mocked(cache.get).mockResolvedValueOnce(cached);

    setProviderEnv("GROQ_API_KEY", "key");

    const result = await aiComplete("system", "user", { cacheKey: "hit" });
    expect(result.text).toBe("from cache");
    expect(mockFetchJSON).not.toHaveBeenCalled();
  });

  it("passes custom maxTokens and temperature", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: "custom params" } }],
      usage: { total_tokens: 10 },
    });

    await aiComplete("system", "user", { maxTokens: 2048, temperature: 0.7 });

    const callArgs = mockFetchJSON.mock.calls[0];
    expect(callArgs[1].body.max_tokens).toBe(2048);
    expect(callArgs[1].body.temperature).toBe(0.7);
  });
});

// ─── aiCompleteJSON ─────────────────────────────────────────

describe("aiCompleteJSON()", () => {
  it("parses JSON from AI response", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: '{"sentiment": "bullish", "score": 0.8}' } }],
      usage: { total_tokens: 20 },
    });

    const result = await aiCompleteJSON<{ sentiment: string; score: number }>("system", "user");
    expect(result.data.sentiment).toBe("bullish");
    expect(result.data.score).toBe(0.8);
    expect(result.provider).toBe("groq");
  });

  it("strips markdown code fences from response", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: '```json\n{"result": true}\n```' } }],
      usage: { total_tokens: 10 },
    });

    const result = await aiCompleteJSON<{ result: boolean }>("system", "user");
    expect(result.data.result).toBe(true);
  });

  it("throws when response contains no valid JSON", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: "This is just plain text without any JSON" } }],
      usage: { total_tokens: 10 },
    });

    await expect(aiCompleteJSON("system", "user")).rejects.toThrow("No JSON found");
  });

  it("throws when JSON is malformed", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: '{invalid json content}' } }],
      usage: { total_tokens: 10 },
    });

    await expect(aiCompleteJSON("system", "user")).rejects.toThrow("Failed to parse AI JSON");
  });
});

// ─── askAI ──────────────────────────────────────────────────

describe("askAI()", () => {
  it("delegates to aiComplete with crypto analyst system prompt", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: "BTC is at $65k" } }],
      usage: { total_tokens: 15 },
    });

    const result = await askAI("What is Bitcoin's price?");
    expect(result.text).toBe("BTC is at $65k");
    expect(result.provider).toBe("groq");

    // Verify system prompt was the crypto analyst one
    const callArgs = mockFetchJSON.mock.calls[0];
    const body = callArgs[1].body;
    expect(body.messages[0].content).toContain("crypto market analyst");
  });

  it("passes options through to aiComplete", async () => {
    setProviderEnv("GROQ_API_KEY", "key");
    mockFetchJSON.mockResolvedValueOnce({
      choices: [{ message: { content: "response" } }],
      usage: { total_tokens: 5 },
    });

    await askAI("test", { maxTokens: 512, temperature: 0.5 });

    const callArgs = mockFetchJSON.mock.calls[0];
    expect(callArgs[1].body.max_tokens).toBe(512);
    expect(callArgs[1].body.temperature).toBe(0.5);
  });
});
