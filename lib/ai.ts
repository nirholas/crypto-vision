/**
 * Multi-Provider AI Client — Ported from free-crypto-news
 * (src/lib/groq.ts + src/lib/ai-provider.ts)
 *
 * Supports: Groq (Llama 3.3), Google Gemini, OpenAI, Anthropic, OpenRouter
 * Falls through providers automatically on failure.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 * @see https://github.com/nirholas/free-crypto-news
 */

import { fetchJSON, type FetchOptions } from "./fetcher.js";
import { cache } from "./cache.js";
import { log } from "./logger.js";

// ─── Provider Config ─────────────────────────────────────────

interface AIProvider {
  name: string;
  envKey: string;
  url: string;
  model: string;
  buildRequest: (
    key: string,
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number,
  ) => { url: string; init: FetchOptions };
  extractText: (response: any) => string;
  extractUsage: (response: any) => number | undefined;
}

const PROVIDERS: AIProvider[] = [
  // ── Groq (Free tier, fastest) ──
  {
    name: "groq",
    envKey: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    buildRequest: (key, system, user, maxTokens, temperature) => ({
      url: "https://api.groq.com/openai/v1/chat/completions",
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
        },
        body: {
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: maxTokens,
          temperature,
          response_format: { type: "json_object" },
        },
      },
    }),
    extractText: (r) => r.choices?.[0]?.message?.content || "",
    extractUsage: (r) => r.usage?.total_tokens,
  },

  // ── Google Gemini (Free quota) ──
  {
    name: "gemini",
    envKey: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    model: "gemini-2.0-flash",
    buildRequest: (key, system, user, maxTokens, temperature) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      init: {
        method: "POST",
        body: {
          contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
          },
        },
      },
    }),
    extractText: (r) => r.candidates?.[0]?.content?.parts?.[0]?.text || "",
    extractUsage: (r) => r.usageMetadata?.totalTokenCount,
  },

  // ── OpenAI ──
  {
    name: "openai",
    envKey: "OPENAI_API_KEY",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    buildRequest: (key, system, user, maxTokens, temperature) => ({
      url: "https://api.openai.com/v1/chat/completions",
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
        },
        body: {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: system,
            },
            { role: "user", content: user },
          ],
          max_tokens: maxTokens,
          temperature,
        },
      },
    }),
    extractText: (r) => r.choices?.[0]?.message?.content || "",
    extractUsage: (r) => r.usage?.total_tokens,
  },

  // ── Anthropic ──
  {
    name: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-3-5-haiku-latest",
    buildRequest: (key, system, user, maxTokens, temperature) => ({
      url: "https://api.anthropic.com/v1/messages",
      init: {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: {
          model: "claude-3-5-haiku-latest",
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        },
      },
    }),
    extractText: (r) =>
      r.content?.map((b: any) => b.text).join("") || "",
    extractUsage: (r) =>
      (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0),
  },

  // ── OpenRouter (fallback, hundreds of models) ──
  {
    name: "openrouter",
    envKey: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.3-70b-instruct",
    buildRequest: (key, system, user, maxTokens, temperature) => ({
      url: "https://openrouter.ai/api/v1/chat/completions",
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://cryptocurrency.cv",
          "X-Title": "Crypto Vision",
        },
        body: {
          model: "meta-llama/llama-3.3-70b-instruct",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: maxTokens,
          temperature,
        },
      },
    }),
    extractText: (r) => r.choices?.[0]?.message?.content || "",
    extractUsage: (r) => r.usage?.total_tokens,
  },
];

// ─── Types ───────────────────────────────────────────────────

export interface AIResponse {
  text: string;
  provider: string;
  model: string;
  tokensUsed?: number;
}

export interface AIOptions {
  maxTokens?: number;
  temperature?: number;
  /** Force a specific provider by name */
  provider?: string;
  /** Cache key prefix — if set, result is cached */
  cacheKey?: string;
  /** Cache TTL in seconds (default: 300) */
  cacheTTL?: number;
}

export class AIAuthError extends Error {
  constructor(
    public provider: string,
    message: string,
  ) {
    super(message);
    this.name = "AIAuthError";
  }
}

// ─── Core Functions ──────────────────────────────────────────

function getAvailableProviders(): Array<AIProvider & { key: string }> {
  return PROVIDERS.map((p) => ({
    ...p,
    key: process.env[p.envKey] || "",
  })).filter((p) => p.key.length > 0);
}

export function isAIConfigured(): boolean {
  return getAvailableProviders().length > 0;
}

export function getConfiguredProviders(): string[] {
  return getAvailableProviders().map((p) => p.name);
}

/**
 * Complete an AI prompt with automatic provider fallback.
 * Tries each configured provider in order until one succeeds.
 */
export async function aiComplete(
  systemPrompt: string,
  userPrompt: string,
  options: AIOptions = {},
): Promise<AIResponse> {
  const { maxTokens = 1024, temperature = 0.3, provider: forceProvider } = options;

  // Check cache first
  if (options.cacheKey) {
    const cached = await cache.get(`ai:${options.cacheKey}`);
    if (cached) {
      return JSON.parse(cached as string);
    }
  }

  const available = getAvailableProviders();

  if (available.length === 0) {
    throw new Error(
      "No AI provider configured. Set one of: GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY",
    );
  }

  // If a specific provider is forced, filter to just that one
  const providers = forceProvider
    ? available.filter((p) => p.name === forceProvider)
    : available;

  if (providers.length === 0) {
    throw new Error(`Provider '${forceProvider}' is not configured`);
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      const { url, init } = provider.buildRequest(
        provider.key,
        systemPrompt,
        userPrompt,
        maxTokens,
        temperature,
      );

      const response = await fetchJSON<any>(url, init);
      const text = provider.extractText(response);
      const tokensUsed = provider.extractUsage(response);

      if (!text) {
        throw new Error(`Empty response from ${provider.name}`);
      }

      const result: AIResponse = {
        text,
        provider: provider.name,
        model: provider.model,
        tokensUsed,
      };

      // Cache if requested
      if (options.cacheKey) {
        await cache.set(
          `ai:${options.cacheKey}`,
          JSON.stringify(result),
          options.cacheTTL || 300,
        );
      }

      return result;
    } catch (err: any) {
      lastError = err;
      const status = err.status || err.statusCode;

      // Auth error → try next provider
      if (status === 401 || status === 403) {
        log.warn(
          { provider: provider.name, status },
          "AI provider auth error, falling through",
        );
        continue;
      }

      // Rate-limit → try next provider
      if (status === 429) {
        log.warn(
          { provider: provider.name },
          "AI provider rate-limited, falling through",
        );
        continue;
      }

      // Other error → still try next
      log.warn(
        { provider: provider.name, err: err.message },
        "AI provider error, falling through",
      );
    }
  }

  throw lastError || new Error("All AI providers failed");
}

/**
 * Complete and parse JSON from the AI response.
 */
export async function aiCompleteJSON<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options: AIOptions = {},
): Promise<{ data: T; provider: string; model: string; tokensUsed?: number }> {
  const response = await aiComplete(systemPrompt, userPrompt, options);

  // Extract JSON from response (handles markdown code fences)
  const text = response.text.trim();
  let jsonStr = text;

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Find the outermost JSON object or array
  const jsonMatch = jsonStr.match(/[\[{][\s\S]*[\]}]/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in AI response: ${text.slice(0, 200)}`);
  }

  try {
    const data = JSON.parse(jsonMatch[0]) as T;
    return {
      data,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed,
    };
  } catch (e) {
    throw new Error(
      `Failed to parse AI JSON: ${(e as Error).message}\nRaw: ${jsonMatch[0].slice(0, 500)}`,
    );
  }
}

/**
 * Simple helper — prompt + get text back.
 */
export async function askAI(
  question: string,
  options: AIOptions = {},
): Promise<AIResponse> {
  return aiComplete(
    "You are a crypto market analyst. Be concise, specific, and data-driven.",
    question,
    options,
  );
}
