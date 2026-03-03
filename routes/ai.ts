/**
 * Crypto Vision — AI Intelligence Routes
 *
 * These routes provide AI-powered crypto analysis using structured prompts
 * and upstream data. Requires LLM API key (Google Gemini or OpenAI).
 *
 * GET  /api/ai/sentiment/:coin — AI sentiment analysis for a coin
 * GET  /api/ai/digest          — Daily market digest
 * GET  /api/ai/signals         — AI trading signal scan
 * POST /api/ai/ask             — Ask anything about crypto
 */

import { Hono } from "hono";
import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import * as cg from "../sources/coingecko.js";
import * as llama from "../sources/defillama.js";
import * as alt from "../sources/alternative.js";
import { log } from "../lib/logger.js";

export const aiRoutes = new Hono();

// ─── LLM Config ──────────────────────────────────────────────

const GEMINI_KEY = () => process.env.GEMINI_API_KEY || "";
const OPENAI_KEY = () => process.env.OPENAI_API_KEY || "";

interface LLMResponse {
  text: string;
  model: string;
  tokensUsed?: number;
}

/**
 * Simple LLM call abstraction. Prefers Gemini (free tier available),
 * falls back to OpenAI.
 */
async function llmComplete(prompt: string, maxTokens = 1024): Promise<LLMResponse> {
  if (GEMINI_KEY()) {
    return callGemini(prompt, maxTokens);
  }
  if (OPENAI_KEY()) {
    return callOpenAI(prompt, maxTokens);
  }
  throw new Error("No LLM API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.");
}

async function callGemini(prompt: string, maxTokens: number): Promise<LLMResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY()}`;

  const res = await fetchJSON<any>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
    }),
  });

  const text = res.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return {
    text,
    model: "gemini-2.0-flash",
    tokensUsed: res.usageMetadata?.totalTokenCount,
  };
}

async function callOpenAI(prompt: string, maxTokens: number): Promise<LLMResponse> {
  const res = await fetchJSON<any>("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a crypto market analyst. Provide concise, data-backed analysis. Always include specific numbers. Respond in JSON when asked.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  return {
    text: res.choices?.[0]?.message?.content || "",
    model: res.model || "gpt-4o-mini",
    tokensUsed: res.usage?.total_tokens,
  };
}

// ─── GET /api/ai/sentiment/:coin ─────────────────────────────

aiRoutes.get("/sentiment/:coin", async (c) => {
  const coinId = c.req.param("coin");

  const [detail, trending, fearGreed] = await Promise.all([
    cg.getCoinDetail(coinId).catch(() => null),
    cg.getTrending().catch(() => ({ coins: [] })),
    alt.getFearGreedIndex(1).catch(() => ({ data: [] })),
  ]);

  if (!detail) {
    return c.json({ error: `Coin '${coinId}' not found` }, 404);
  }

  const md = detail.market_data;
  const fg = fearGreed.data[0];

  const prompt = `Analyze the current sentiment for ${detail.name} (${detail.symbol.toUpperCase()}).

Market data:
- Price: $${md.current_price.usd}
- 24h change: ${md.price_change_percentage_24h?.toFixed(2)}%
- 7d change: ${md.price_change_percentage_7d?.toFixed(2)}%
- 30d change: ${md.price_change_percentage_30d?.toFixed(2)}%
- Market cap: $${md.market_cap.usd?.toLocaleString()}
- Volume 24h: $${md.total_volume.usd?.toLocaleString()}
- Fear & Greed Index: ${fg?.value || "N/A"} (${fg?.value_classification || "N/A"})
- Trending coins: ${trending.coins.map((t) => t.item.name).join(", ")}

Respond in JSON with this exact structure:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "summary": "2-3 sentence analysis",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "outlook": "short_term_view"
}`;

  const cached = await cache.get(`ai:sentiment:${coinId}`);
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  try {
    const { text, model, tokensUsed } = await llmComplete(prompt);
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };

    await cache.set(`ai:sentiment:${coinId}`, JSON.stringify(parsed), 300); // 5min cache

    return c.json({
      data: parsed,
      model,
      tokensUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    log.error({ err }, "AI sentiment failed");
    return c.json({ error: err.message }, 500);
  }
});

// ─── GET /api/ai/digest ──────────────────────────────────────

aiRoutes.get("/digest", async (c) => {
  const cached = await cache.get("ai:digest");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [global, trending, fearGreed, topCoins] = await Promise.all([
    cg.getGlobal(),
    cg.getTrending(),
    alt.getFearGreedIndex(7),
    cg.getCoins({ page: 1, perPage: 10, order: "market_cap_desc", sparkline: false }),
  ]);

  const g = global.data;
  const prompt = `Generate a concise daily crypto market digest.

Global metrics:
- Total market cap: $${(g.total_market_cap.usd / 1e12).toFixed(2)}T
- 24h change: ${g.market_cap_change_percentage_24h_usd.toFixed(2)}%
- BTC dominance: ${g.market_cap_percentage.btc.toFixed(1)}%
- Total 24h volume: $${(g.total_volume.usd / 1e9).toFixed(1)}B

Top 10 coins by market cap (24h change):
${topCoins.map((coin) => `- ${coin.name}: $${coin.current_price} (${coin.price_change_percentage_24h?.toFixed(2)}%)`).join("\n")}

Trending coins: ${trending.coins.map((t) => t.item.name).join(", ")}

Fear & Greed (last 7 days): ${fearGreed.data.map((d) => `${d.value} (${d.value_classification})`).join(", ")}

Respond in JSON:
{
  "headline": "One-line market summary",
  "marketStatus": "risk_on" | "risk_off" | "neutral",
  "topMovers": [{"name": "...", "change": "...", "note": "..."}],
  "keyInsights": ["insight1", "insight2", "insight3"],
  "outlook": "Short paragraph on what to watch"
}`;

  try {
    const { text, model, tokensUsed } = await llmComplete(prompt, 1500);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };

    await cache.set("ai:digest", JSON.stringify(parsed), 900); // 15min cache

    return c.json({
      data: parsed,
      model,
      tokensUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    log.error({ err }, "AI digest failed");
    return c.json({ error: err.message }, 500);
  }
});

// ─── GET /api/ai/signals ─────────────────────────────────────

aiRoutes.get("/signals", async (c) => {
  const cached = await cache.get("ai:signals");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [topCoins, yields, fearGreed] = await Promise.all([
    cg.getCoins({ page: 1, perPage: 25, order: "market_cap_desc", sparkline: false }),
    llama.getYieldPools().catch(() => ({ data: [] })),
    alt.getFearGreedIndex(1),
  ]);

  // Top gainers/losers from top 25
  const sorted = [...topCoins].sort(
    (a, b) =>
      Math.abs(b.price_change_percentage_24h || 0) -
      Math.abs(a.price_change_percentage_24h || 0)
  );

  // Top yields
  const topYields = yields.data
    .filter((y) => y.tvlUsd > 1_000_000 && y.apy > 0)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 10);

  const prompt = `Identify top crypto trading signals and opportunities right now.

Most-moved coins (top 25 by cap):
${sorted.slice(0, 10).map((coin) => `- ${coin.name}: ${coin.price_change_percentage_24h?.toFixed(2)}% ($${coin.current_price})`).join("\n")}

Top DeFi yields (>$1M TVL):
${topYields.map((y) => `- ${y.symbol} on ${y.project} (${y.chain}): ${y.apy.toFixed(1)}% APY, $${(y.tvlUsd / 1e6).toFixed(1)}M TVL`).join("\n")}

Fear & Greed: ${fearGreed.data[0]?.value || "N/A"} (${fearGreed.data[0]?.value_classification || "N/A"})

Respond in JSON:
{
  "signals": [
    {
      "type": "momentum" | "yield" | "reversal" | "breakout",
      "asset": "name",
      "action": "watch" | "long_bias" | "short_bias" | "farm",
      "confidence": 0-100,
      "reasoning": "one-line reason"
    }
  ],
  "marketContext": "one-line market context",
  "riskLevel": "low" | "medium" | "high"
}`;

  try {
    const { text, model, tokensUsed } = await llmComplete(prompt, 1500);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };

    await cache.set("ai:signals", JSON.stringify(parsed), 600); // 10min cache

    return c.json({
      data: parsed,
      model,
      tokensUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    log.error({ err }, "AI signals failed");
    return c.json({ error: err.message }, 500);
  }
});

// ─── POST /api/ai/ask ────────────────────────────────────────

aiRoutes.post("/ask", async (c) => {
  const body = await c.req.json<{ question: string; context?: string }>();
  if (!body.question) {
    return c.json({ error: "question field required" }, 400);
  }

  // Fetch live context to enrich the answer
  const [global, fearGreed] = await Promise.all([
    cg.getGlobal().catch(() => null),
    alt.getFearGreedIndex(1).catch(() => ({ data: [] })),
  ]);

  const marketContext = global
    ? `\nLive market: Cap $${(global.data.total_market_cap.usd / 1e12).toFixed(2)}T, BTC dom ${global.data.market_cap_percentage.btc.toFixed(1)}%, 24h change ${global.data.market_cap_change_percentage_24h_usd.toFixed(2)}%, Fear&Greed ${fearGreed.data[0]?.value || "N/A"}`
    : "";

  const prompt = `You are Crypto Vision AI, an expert crypto market analyst.
Answer the following question using current data and your knowledge.
Be concise, specific, and data-driven. If you're uncertain, say so.
${marketContext}
${body.context ? `\nAdditional context: ${body.context}` : ""}

Question: ${body.question}`;

  try {
    const { text, model, tokensUsed } = await llmComplete(prompt, 2048);

    return c.json({
      data: { answer: text },
      model,
      tokensUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    log.error({ err }, "AI ask failed");
    return c.json({ error: err.message }, 500);
  }
});
