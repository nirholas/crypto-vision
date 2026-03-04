/**
 * Crypto Vision — AI Intelligence Routes
 *
 * GET  /api/ai/sentiment/:coin   — AI sentiment analysis for a coin
 * GET  /api/ai/digest            — Daily market digest
 * GET  /api/ai/signals           — AI trading signal scan
 * POST /api/ai/ask               — Ask anything about crypto
 * GET  /api/ai/compare           — AI side-by-side coin comparison
 * GET  /api/ai/explain/:topic    — AI crypto concept explainer
 * GET  /api/ai/risk/:protocol    — AI DeFi risk assessment
 * GET  /api/ai/yield-analysis    — AI yield opportunity analysis
 * GET  /api/ai/portfolio-review  — AI portfolio allocation review
 * GET  /api/ai/whale-alert       — AI whale activity analysis
 * GET  /api/ai/narrative         — AI narrative/trend analysis
 * GET  /api/ai/news-analysis     — AI news impact analysis
 * GET  /api/ai/fear-greed-explain — AI Fear & Greed interpretation
 * GET  /api/ai/chain-compare     — AI chain comparison
 * GET  /api/ai/stablecoin-risk   — AI stablecoin risk analysis
 * GET  /api/ai/defi-overview     — AI DeFi market overview
 * GET  /api/ai/market-regime     — AI market regime detection
 * GET  /api/ai/correlation       — AI correlation analysis
 * GET  /api/ai/providers         — List configured AI providers
 */

import { Hono } from "hono";
import { cache } from "../lib/cache.js";
import { aiComplete, isAIConfigured, getConfiguredProviders } from "../lib/ai.js";
import { aiQueue, QueueFullError } from "../lib/queue.js";
import * as cg from "../sources/coingecko.js";
import * as llama from "../sources/defillama.js";
import * as alt from "../sources/alternative.js";
import { log } from "../lib/logger.js";
import { ApiError, extractErrorMessage } from "../lib/api-error.js";
import { AskBodySchema, CoinIdSchema, validateBody, validateParam } from "../lib/validation.js";

export const aiRoutes = new Hono();

const SYSTEM_PROMPT =
  "You are a crypto market analyst. Provide concise, data-backed analysis. Always include specific numbers. Respond in JSON when asked.";

// ─── GET /api/ai/sentiment/:coin ─────────────────────────────

aiRoutes.get("/sentiment/:coin", async (c) => {
  const param = validateParam(c, "coin", CoinIdSchema);
  if (!param.success) return param.error;
  const coinId = param.data;

  const [detail, trending, fearGreed] = await Promise.all([
    cg.getCoinDetail(coinId).catch(() => null),
    cg.getTrending().catch(() => ({ coins: [] })),
    alt.getFearGreedIndex(1).catch(() => ({ data: [] })),
  ]);

  if (!detail) {
    return ApiError.notFound(c, `Coin '${coinId}' not found`);
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
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };

    await cache.set(`ai:sentiment:${coinId}`, JSON.stringify(parsed), 300);

    return c.json({
      data: parsed,
      model,
      tokensUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    if (err instanceof QueueFullError) {
      return ApiError.serviceUnavailable(c, "AI service busy — please retry");
    }
    log.error({ err }, "AI sentiment failed");
    return ApiError.aiError(c, "AI sentiment analysis failed", extractErrorMessage(err));
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
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };

    await cache.set("ai:digest", JSON.stringify(parsed), 900);

    return c.json({
      data: parsed,
      model,
      tokensUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    if (err instanceof QueueFullError) {
      return ApiError.serviceUnavailable(c, "AI service busy — please retry");
    }
    log.error({ err }, "AI digest failed");
    return ApiError.aiError(c, "AI digest generation failed", extractErrorMessage(err));
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
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };

    await cache.set("ai:signals", JSON.stringify(parsed), 600);

    return c.json({
      data: parsed,
      model,
      tokensUsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    if (err instanceof QueueFullError) {
      return ApiError.serviceUnavailable(c, "AI service busy — please retry");
    }
    log.error({ err }, "AI signals failed");
    return ApiError.aiError(c, "AI signals generation failed", extractErrorMessage(err));
  }
});

// ─── POST /api/ai/ask ────────────────────────────────────────

aiRoutes.post("/ask", async (c) => {
  const parsed = await validateBody(c, AskBodySchema);
  if (!parsed.success) return parsed.error;
  const body = parsed.data;

  const { question, context: userContext, useRag = true, ragCategory } = body;

  // ─── RAG-Enhanced Path ─────────────────────────────────────
  if (useRag) {
    try {
      const { ragQuery } = await import("../lib/rag.js");
      const result = await aiQueue.execute(() =>
        ragQuery(question, {
          category: ragCategory || userContext || undefined,
          topK: 5,
          temperature: 0.3,
          maxTokens: 2048,
        })
      );

      return c.json({
        data: {
          answer: result.answer,
          sources: result.sources,
        },
        model: result.model,
        tokensUsed: result.tokensUsed,
        rag: result.ragUsed,
        retrievalCount: result.retrievalCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      if (error.name === "QueueFullError") {
        return ApiError.serviceUnavailable(c, "AI service busy — please retry");
      }
      // Fall through to non-RAG path on RAG-specific failures
      log.warn({ err: error.message }, "RAG query failed — falling back to direct LLM");
    }
  }

  // ─── Non-RAG Fallback Path ─────────────────────────────────
  // Fetch live context to enrich the answer
  const [global, fearGreed] = await Promise.all([
    cg.getGlobal().catch(() => null),
    alt.getFearGreedIndex(1).catch(() => ({ data: [] })),
  ]);

  const marketContext = global
    ? `\nLive market: Cap $${(global.data.total_market_cap.usd / 1e12).toFixed(2)}T, BTC dom ${global.data.market_cap_percentage.btc.toFixed(1)}%, 24h change ${global.data.market_cap_change_percentage_24h_usd.toFixed(2)}%, Fear&Greed ${fearGreed.data[0]?.value || "N/A"}`
    : "";

  const askSystemPrompt = `You are Crypto Vision AI, an expert crypto market analyst.
Answer the following question using current data and your knowledge.
Be concise, specific, and data-driven. If you're uncertain, say so.`;

  const userPrompt = `${marketContext}
${userContext ? `\nAdditional context: ${userContext}` : ""}

Question: ${question}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(askSystemPrompt, userPrompt, { maxTokens: 2048, temperature: 0.3 })
    );

    return c.json({
      data: { answer: text },
      model,
      tokensUsed,
      rag: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error & { name?: string };
    if (error.name === "QueueFullError") {
      return ApiError.serviceUnavailable(c, "AI service busy — please retry");
    }
    log.error({ err: error }, "AI ask failed");
    return ApiError.aiError(c, "AI question answering failed", error.message);
  }
});

// ─── GET /api/ai/providers ───────────────────────────────────

aiRoutes.get("/providers", (c) => {
  return c.json({
    data: {
      configured: isAIConfigured(),
      providers: getConfiguredProviders(),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/ai/compare ────────────────────────────────────

aiRoutes.get("/compare", async (c) => {
  const ids = c.req.query("ids");
  if (!ids) return c.json({ error: "ids parameter required (comma-separated, e.g. bitcoin,ethereum)" }, 400);

  const coinIds = ids.split(",").slice(0, 5).map((s) => s.trim());
  const cacheKey = `ai:compare:${coinIds.sort().join(",")}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const details = await Promise.all(
    coinIds.map((id) => cg.getCoinDetail(id).catch(() => null))
  );

  const coinData = details.filter(Boolean).map((d) => {
    const md = d!.market_data;
    return `${d!.name} (${d!.symbol.toUpperCase()}): Price $${md.current_price.usd}, MCap $${md.market_cap.usd?.toLocaleString()}, 24h ${md.price_change_percentage_24h?.toFixed(2)}%, 7d ${md.price_change_percentage_7d?.toFixed(2)}%, 30d ${md.price_change_percentage_30d?.toFixed(2)}%`;
  });

  const prompt = `Compare these cryptocurrencies side by side:
${coinData.join("\n")}

Respond in JSON:
{
  "comparison": [
    { "coin": "name", "strengths": ["..."], "weaknesses": ["..."], "verdict": "..." }
  ],
  "winner": "coin_name",
  "reasoning": "2-3 sentence summary",
  "riskRanking": ["lowest_risk_to_highest"]
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set(cacheKey, JSON.stringify(parsed), 600);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI compare failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/explain/:topic ──────────────────────────────

aiRoutes.get("/explain/:topic", async (c) => {
  const topic = c.req.param("topic");
  const level = c.req.query("level") || "beginner"; // beginner, intermediate, advanced
  const cacheKey = `ai:explain:${topic}:${level}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const prompt = `Explain the crypto/DeFi concept "${topic}" for a ${level}-level audience.

Respond in JSON:
{
  "topic": "${topic}",
  "level": "${level}",
  "explanation": "Clear explanation",
  "keyPoints": ["point1", "point2", "point3"],
  "realWorldExample": "Practical example",
  "risks": ["risk1", "risk2"],
  "relatedTopics": ["topic1", "topic2"]
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete("You are a crypto educator. Explain concepts clearly with real examples. Respond in JSON.", prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set(cacheKey, JSON.stringify(parsed), 3600); // 1hr cache for education

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI explain failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/risk/:protocol ──────────────────────────────

aiRoutes.get("/risk/:protocol", async (c) => {
  const slug = c.req.param("protocol");
  const cacheKey = `ai:risk:${slug}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [protocolDetail, yields] = await Promise.all([
    llama.getProtocolDetail(slug).catch(() => null),
    llama.getYieldPools().catch(() => ({ data: [] })),
  ]);

  const protocolYields = yields.data
    .filter((y) => y.project.toLowerCase() === slug.toLowerCase())
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, 5);

  const prompt = `Assess the risk profile of the DeFi protocol "${slug}".

${protocolDetail ? `Protocol Data:
- TVL: $${((protocolDetail.tvl.at(-1)?.totalLiquidityUSD ?? 0) / 1e9).toFixed(2)}B
- Category: ${protocolDetail.category || "N/A"}
- Chains: ${(protocolDetail.chains || []).join(", ")}` : `No on-chain data found for "${slug}" — assess based on general knowledge.`}

${protocolYields.length > 0 ? `Yield Pools:
${protocolYields.map((y) => `- ${y.symbol}: ${y.apy.toFixed(1)}% APY, $${(y.tvlUsd / 1e6).toFixed(1)}M TVL`).join("\n")}` : ""}

Respond in JSON:
{
  "protocol": "${slug}",
  "riskScore": 1-10,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "factors": [
    { "category": "smart_contract" | "economic" | "governance" | "oracle" | "liquidity", "risk": "low" | "medium" | "high", "detail": "..." }
  ],
  "summary": "2-3 sentence risk assessment",
  "recommendations": ["rec1", "rec2"]
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set(cacheKey, JSON.stringify(parsed), 900);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI risk assessment failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/yield-analysis ──────────────────────────────

aiRoutes.get("/yield-analysis", async (c) => {
  const cached = await cache.get("ai:yield-analysis");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const { data: pools } = await llama.getYieldPools();
  const topYields = pools
    .filter((y) => y.tvlUsd > 1_000_000 && y.apy > 0 && y.apy < 1000)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 20);

  const stableYields = pools
    .filter((y) => y.stablecoin && y.tvlUsd > 5_000_000)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 10);

  const prompt = `Analyze the current DeFi yield landscape.

Top Yield Opportunities (>$1M TVL):
${topYields.map((y) => `- ${y.symbol} on ${y.project} (${y.chain}): ${y.apy.toFixed(1)}% APY, $${(y.tvlUsd / 1e6).toFixed(1)}M TVL, IL risk: ${y.ilRisk || "unknown"}`).join("\n")}

Top Stablecoin Yields (>$5M TVL):
${stableYields.map((y) => `- ${y.symbol} on ${y.project} (${y.chain}): ${y.apy.toFixed(1)}% APY, $${(y.tvlUsd / 1e6).toFixed(1)}M TVL`).join("\n")}

Respond in JSON:
{
  "overview": "Market yield summary",
  "bestOpportunities": [{ "pool": "...", "apy": 0, "risk": "low|medium|high", "reasoning": "..." }],
  "stablecoinPicks": [{ "pool": "...", "apy": 0, "reasoning": "..." }],
  "warnings": ["warning1", "warning2"],
  "yieldOutlook": "Short paragraph on yield trends"
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set("ai:yield-analysis", JSON.stringify(parsed), 900);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI yield analysis failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/portfolio-review ────────────────────────────

aiRoutes.get("/portfolio-review", async (c) => {
  const holdings = c.req.query("holdings"); // format: bitcoin:40,ethereum:30,solana:20,usdc:10
  if (!holdings) return c.json({ error: "holdings parameter required (format: coin:pct,coin:pct)" }, 400);

  const allocations = holdings.split(",").map((h) => {
    const [coin, pct] = h.split(":");
    return { coin: coin.trim(), pct: Number(pct) };
  });

  const cacheKey = `ai:portfolio:${allocations.map((a) => `${a.coin}${a.pct}`).sort().join("")}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [global, fearGreed] = await Promise.all([
    cg.getGlobal().catch(() => null),
    alt.getFearGreedIndex(1).catch(() => ({ data: [] })),
  ]);

  const prompt = `Review this crypto portfolio allocation:
${allocations.map((a) => `- ${a.coin}: ${a.pct}%`).join("\n")}

Market context:
${global ? `- Total market cap: $${(global.data.total_market_cap.usd / 1e12).toFixed(2)}T` : ""}
- Fear & Greed: ${fearGreed.data[0]?.value || "N/A"} (${fearGreed.data[0]?.value_classification || "N/A"})

Respond in JSON:
{
  "overallScore": 1-10,
  "riskLevel": "conservative" | "moderate" | "aggressive",
  "diversification": "poor" | "fair" | "good" | "excellent",
  "analysis": "2-3 sentence portfolio assessment",
  "suggestions": [{ "action": "increase|decrease|add|remove", "asset": "...", "reasoning": "..." }],
  "risks": ["risk1", "risk2"],
  "strengths": ["strength1", "strength2"]
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set(cacheKey, JSON.stringify(parsed), 600);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI portfolio review failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/whale-alert ─────────────────────────────────

aiRoutes.get("/whale-alert", async (c) => {
  const cached = await cache.get("ai:whale-alert");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [topCoins, fearGreed] = await Promise.all([
    cg.getCoins({ page: 1, perPage: 25, order: "market_cap_desc", sparkline: false }),
    alt.getFearGreedIndex(1).catch(() => ({ data: [] })),
  ]);

  // High volume/price movers suggest whale activity
  const volumeMovers = [...topCoins]
    .filter((c) => c.total_volume && c.market_cap)
    .map((c) => ({ ...c, volumeRatio: c.total_volume / c.market_cap }))
    .sort((a, b) => b.volumeRatio - a.volumeRatio)
    .slice(0, 10);

  const prompt = `Analyze potential whale activity based on volume-to-market-cap anomalies.

Coins with unusually high volume (volume/mcap ratio):
${volumeMovers.map((c) => `- ${c.name}: vol/mcap ratio ${(c.volumeRatio * 100).toFixed(2)}%, 24h change ${c.price_change_percentage_24h?.toFixed(2)}%, volume $${(c.total_volume / 1e9).toFixed(2)}B`).join("\n")}

Fear & Greed: ${fearGreed.data[0]?.value || "N/A"} (${fearGreed.data[0]?.value_classification || "N/A"})

Respond in JSON:
{
  "alerts": [{ "coin": "...", "signal": "accumulation|distribution|neutral", "confidence": 0-100, "reasoning": "..." }],
  "marketImplication": "What this whale activity pattern suggests",
  "actionable": "What traders should watch for"
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set("ai:whale-alert", JSON.stringify(parsed), 600);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI whale alert failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/narrative ───────────────────────────────────

aiRoutes.get("/narrative", async (c) => {
  const cached = await cache.get("ai:narrative");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [trending, categories, topCoins, fearGreed] = await Promise.all([
    cg.getTrending(),
    cg.getCategories().catch(() => []),
    cg.getCoins({ page: 1, perPage: 50, order: "market_cap_desc", sparkline: false }),
    alt.getFearGreedIndex(7).catch(() => ({ data: [] })),
  ]);

  const topCategories = categories
    .sort((a, b) => (b.market_cap_change_24h || 0) - (a.market_cap_change_24h || 0))
    .slice(0, 10);

  const prompt = `Identify the dominant crypto market narratives and trends right now.

Trending coins: ${trending.coins.map((t) => t.item.name).join(", ")}

Top performing categories (24h):
${topCategories.map((cat) => `- ${cat.name}: ${cat.market_cap_change_24h?.toFixed(2)}% change`).join("\n")}

Top movers (top 50 by cap):
${[...topCoins].sort((a, b) => Math.abs(b.price_change_percentage_24h || 0) - Math.abs(a.price_change_percentage_24h || 0)).slice(0, 10).map((c) => `- ${c.name}: ${c.price_change_percentage_24h?.toFixed(2)}%`).join("\n")}

Fear & Greed (7d): ${fearGreed.data.map((d) => `${d.value}`).join(", ")}

Respond in JSON:
{
  "dominantNarratives": [{ "narrative": "...", "strength": "emerging|growing|peak|fading", "coins": ["..."], "reasoning": "..." }],
  "sectorRotation": "Where capital is flowing to/from",
  "emergingThemes": ["theme1", "theme2"],
  "riskNarrative": "Overall market narrative for risk management"
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set("ai:narrative", JSON.stringify(parsed), 900);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI narrative failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/fear-greed-explain ──────────────────────────

aiRoutes.get("/fear-greed-explain", async (c) => {
  const cached = await cache.get("ai:fg-explain");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [fearGreed, global] = await Promise.all([
    alt.getFearGreedIndex(30),
    cg.getGlobal(),
  ]);

  const prompt = `Analyze the Fear & Greed Index trend and its implications.

Current reading: ${fearGreed.data[0]?.value} (${fearGreed.data[0]?.value_classification})
Last 30 days: ${fearGreed.data.map((d) => d.value).join(", ")}

Market context: Total cap $${(global.data.total_market_cap.usd / 1e12).toFixed(2)}T, BTC dom ${global.data.market_cap_percentage.btc.toFixed(1)}%

Respond in JSON:
{
  "current": { "value": 0, "classification": "...", "interpretation": "..." },
  "trend": "rising|falling|stable|volatile",
  "trendAnalysis": "What the 30-day trend suggests",
  "historicalContext": "How this compares to historical patterns",
  "tradingImplication": "What this means for traders",
  "contrarian": "Contrarian view based on the reading"
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1200, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set("ai:fg-explain", JSON.stringify(parsed), 900);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI fear greed explain failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/chain-compare ───────────────────────────────

aiRoutes.get("/chain-compare", async (c) => {
  const chains = c.req.query("chains"); // e.g. "ethereum,solana,arbitrum"
  if (!chains) return c.json({ error: "chains parameter required" }, 400);

  const chainNames = chains.split(",").slice(0, 5).map((s) => s.trim());
  const cacheKey = `ai:chain-compare:${chainNames.sort().join(",")}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [allChains, dexVolumes, fees] = await Promise.all([
    llama.getChainsTVL(),
    llama.getDexVolumes().catch(() => ({ protocols: [] })),
    llama.getFeesRevenue().catch(() => ({ protocols: [] })),
  ]);

  const chainData = chainNames.map((name) => {
    const chain = allChains.find((ch) => ch.name.toLowerCase() === name.toLowerCase());
    return chain
      ? `${chain.name}: TVL $${(chain.tvl / 1e9).toFixed(2)}B, Token: ${chain.tokenSymbol || "N/A"}`
      : `${name}: No TVL data`;
  });

  const prompt = `Compare these blockchain networks:
${chainData.join("\n")}

Respond in JSON:
{
  "comparison": [{ "chain": "...", "strengths": ["..."], "weaknesses": ["..."], "bestFor": "..." }],
  "recommendation": "Which chain for which use case",
  "tvlTrend": "Overall TVL trend analysis",
  "developerActivity": "Assessment of ecosystem health"
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set(cacheKey, JSON.stringify(parsed), 900);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI chain compare failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/stablecoin-risk ─────────────────────────────

aiRoutes.get("/stablecoin-risk", async (c) => {
  const cached = await cache.get("ai:stablecoin-risk");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const { peggedAssets } = await llama.getStablecoins();
  const top = peggedAssets.slice(0, 15).map((s) => {
    const circ = Object.values(s.circulating).reduce(
      (sum, ch) => sum + (ch.peggedUSD || 0), 0
    );
    return `${s.name} (${s.symbol}): $${(circ / 1e9).toFixed(2)}B, peg: ${s.pegType}, chains: ${s.chains.length}`;
  });

  const prompt = `Analyze the risk profile of top stablecoins:
${top.join("\n")}

Respond in JSON:
{
  "stablecoins": [{ "name": "...", "riskScore": 1-10, "riskLevel": "low|medium|high", "mainRisks": ["..."], "pegStability": "strong|moderate|weak" }],
  "systemicRisks": ["risk1", "risk2"],
  "safestPick": "Which stablecoin and why",
  "marketOutlook": "Stablecoin market trend"
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set("ai:stablecoin-risk", JSON.stringify(parsed), 1800);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI stablecoin risk failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/defi-overview ───────────────────────────────

aiRoutes.get("/defi-overview", async (c) => {
  const cached = await cache.get("ai:defi-overview");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [protocols, chains, dexVols, fees, raises] = await Promise.all([
    llama.getProtocols().catch(() => []),
    llama.getChainsTVL().catch(() => []),
    llama.getDexVolumes().catch(() => ({ protocols: [] })),
    llama.getFeesRevenue().catch(() => ({ protocols: [] })),
    llama.getRaises().catch(() => ({ raises: [] })),
  ]);

  const totalTvl = protocols.reduce((s, p) => s + (p.tvl || 0), 0);
  const topProto = protocols.slice(0, 10);
  const topChains = chains.filter((c) => c.tvl > 0).sort((a, b) => b.tvl - a.tvl).slice(0, 5);
  const recentRaises = (raises.raises || []).slice(0, 5);

  const prompt = `Provide a comprehensive DeFi market overview.

Total TVL: $${(totalTvl / 1e9).toFixed(2)}B
Top Protocols: ${topProto.map((p) => `${p.name} $${(p.tvl / 1e9).toFixed(2)}B`).join(", ")}
Top Chains: ${topChains.map((c) => `${c.name} $${(c.tvl / 1e9).toFixed(2)}B`).join(", ")}
Recent Raises: ${recentRaises.map((r) => `${r.name}: $${r.amount}M (${r.round || "unknown"})`).join(", ")}

Respond in JSON:
{
  "headline": "One-line DeFi summary",
  "tvlTrend": "growing|stable|declining",
  "hotSectors": ["sector1", "sector2"],
  "topOpportunities": [{ "protocol": "...", "type": "yield|governance|airdrop", "detail": "..." }],
  "risks": ["risk1", "risk2"],
  "outlook": "DeFi market outlook paragraph"
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set("ai:defi-overview", JSON.stringify(parsed), 900);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI defi overview failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/market-regime ───────────────────────────────

aiRoutes.get("/market-regime", async (c) => {
  const cached = await cache.get("ai:market-regime");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [global, fearGreed, topCoins] = await Promise.all([
    cg.getGlobal(),
    alt.getFearGreedIndex(30),
    cg.getCoins({ page: 1, perPage: 20, order: "market_cap_desc", sparkline: false }),
  ]);

  const g = global.data;
  const avgChange = topCoins.reduce((s, c) => s + (c.price_change_percentage_24h || 0), 0) / topCoins.length;

  const prompt = `Determine the current crypto market regime.

Market cap: $${(g.total_market_cap.usd / 1e12).toFixed(2)}T, 24h change: ${g.market_cap_change_percentage_24h_usd.toFixed(2)}%
BTC dominance: ${g.market_cap_percentage.btc.toFixed(1)}%
Average top-20 change (24h): ${avgChange.toFixed(2)}%
Fear & Greed (30d): ${fearGreed.data.map((d) => d.value).join(", ")}
Current F&G: ${fearGreed.data[0]?.value} (${fearGreed.data[0]?.value_classification})

Respond in JSON:
{
  "regime": "accumulation" | "markup" | "distribution" | "markdown" | "ranging",
  "confidence": 0-100,
  "characteristics": ["char1", "char2"],
  "historicalParallel": "When was the last similar regime",
  "expectedDuration": "How long this regime typically lasts",
  "strategy": "Recommended approach in this regime",
  "watchFor": "Signals that regime is changing"
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1200, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set("ai:market-regime", JSON.stringify(parsed), 900);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI market regime failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/correlation ─────────────────────────────────

aiRoutes.get("/correlation", async (c) => {
  const ids = c.req.query("ids") || "bitcoin,ethereum,solana";
  const coinIds = ids.split(",").slice(0, 8).map((s) => s.trim());
  const cacheKey = `ai:correlation:${coinIds.sort().join(",")}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const coins = await cg.getCoins({ page: 1, perPage: 250, order: "market_cap_desc", sparkline: false });
  const selected = coins.filter((c) => coinIds.includes(c.id));

  const prompt = `Analyze the correlation between these crypto assets:
${selected.map((c) => `- ${c.name}: 24h ${c.price_change_percentage_24h?.toFixed(2)}%, 7d ${c.price_change_percentage_7d_in_currency?.toFixed(2) ?? "N/A"}%, 30d ${c.price_change_percentage_30d_in_currency?.toFixed(2) ?? "N/A"}%`).join("\n")}

Respond in JSON:
{
  "correlations": [{ "pair": ["coin1", "coin2"], "strength": "strong|moderate|weak|negative", "note": "..." }],
  "diversificationScore": 1-10,
  "insight": "Key correlation insight",
  "uncorrelatedPicks": ["Coins that would add diversification"]
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1200, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set(cacheKey, JSON.stringify(parsed), 600);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI correlation failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});

// ─── GET /api/ai/news-analysis ───────────────────────────────

aiRoutes.get("/news-analysis", async (c) => {
  const cached = await cache.get("ai:news-analysis");
  if (cached) {
    return c.json({ data: JSON.parse(cached as string), cached: true, timestamp: new Date().toISOString() });
  }

  const [trending, global, fearGreed, categories] = await Promise.all([
    cg.getTrending(),
    cg.getGlobal(),
    alt.getFearGreedIndex(1).catch(() => ({ data: [] })),
    cg.getCategories().catch(() => []),
  ]);

  const hotCategories = categories
    .filter((c) => c.market_cap_change_24h != null)
    .sort((a, b) => Math.abs(b.market_cap_change_24h || 0) - Math.abs(a.market_cap_change_24h || 0))
    .slice(0, 5);

  const prompt = `Analyze current crypto market signals from a news/narrative perspective.

Trending: ${trending.coins.map((t) => t.item.name).join(", ")}
Market cap change 24h: ${global.data.market_cap_change_percentage_24h_usd.toFixed(2)}%
Fear & Greed: ${fearGreed.data[0]?.value || "N/A"}
Hot categories: ${hotCategories.map((c) => `${c.name}: ${c.market_cap_change_24h?.toFixed(2)}%`).join(", ")}

Respond in JSON:
{
  "topStories": [{ "headline": "...", "impact": "bullish|bearish|neutral", "affectedAssets": ["..."], "timeframe": "immediate|short|medium" }],
  "sentiment": "bullish|bearish|neutral|mixed",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "actionItems": ["What to watch", "What to research"]
}`;

  try {
    const { text, model, tokensUsed } = await aiQueue.execute(() =>
      aiComplete(SYSTEM_PROMPT, prompt, { maxTokens: 1500, temperature: 0.3 })
    );
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    await cache.set("ai:news-analysis", JSON.stringify(parsed), 600);

    return c.json({ data: parsed, model, tokensUsed, timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    log.error({ err }, "AI news analysis failed");
    return c.json({ error: extractErrorMessage(err) }, 500);
  }
});
