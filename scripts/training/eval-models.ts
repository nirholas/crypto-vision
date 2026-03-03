/**
 * Crypto Vision — Open-Source Model Evaluation
 *
 * Evaluates fine-tuned models against a standardized benchmark suite.
 * Tests sentiment analysis, market digest generation, trading signals,
 * DeFi risk assessment, and structured JSON output quality.
 *
 * Connects to a running vLLM inference server (or any OpenAI-compatible endpoint)
 * and measures: accuracy, latency, JSON validity, and output quality.
 *
 * Usage:
 *   # Full evaluation against local server
 *   npx tsx scripts/training/eval-models.ts --endpoint http://localhost:8000
 *
 *   # Quick smoke test (5 prompts)
 *   npx tsx scripts/training/eval-models.ts quick --endpoint http://localhost:8000
 *
 *   # Compare two models
 *   npx tsx scripts/training/eval-models.ts --endpoint http://localhost:8000 \
 *     --compare http://localhost:8001
 *
 *   # Evaluate against Groq baseline
 *   npx tsx scripts/training/eval-models.ts --use-groq-baseline
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

// ─── Types ───────────────────────────────────────────────────

interface EvalPrompt {
  id: string;
  category: "sentiment" | "digest" | "signals" | "risk" | "yield" | "qa";
  systemPrompt: string;
  userPrompt: string;
  expectedFields: string[];
  validationFn: (output: Record<string, unknown>) => EvalScore;
}

interface EvalScore {
  /** 0-100 overall quality score */
  score: number;
  /** Whether the output parsed as valid JSON */
  jsonValid: boolean;
  /** Whether all expected fields are present */
  fieldsPresent: boolean;
  /** Specific field-level scores */
  fieldScores: Record<string, number>;
  /** Any issues found */
  issues: string[];
}

interface EvalResult {
  promptId: string;
  category: string;
  score: EvalScore;
  latencyMs: number;
  tokensUsed: number | null;
  rawOutput: string;
  model: string;
  endpoint: string;
  timestamp: string;
}

interface EvalReport {
  evaluatedAt: string;
  endpoint: string;
  model: string;
  totalPrompts: number;
  results: EvalResult[];
  summary: {
    avgScore: number;
    avgLatencyMs: number;
    jsonValidRate: number;
    fieldsCompleteRate: number;
    categoryScores: Record<string, number>;
    totalTokens: number;
  };
  comparison?: {
    baselineEndpoint: string;
    baselineModel: string;
    scoreDelta: number;
    latencyDelta: number;
  };
}

// ─── Configuration ───────────────────────────────────────────

const DEFAULT_ENDPOINT = "http://localhost:8000";
const DEFAULT_MODEL = "crypto-vision";
const OUTPUT_DIR = "data/evaluation";
const MAX_TOKENS = 1024;
const TEMPERATURE = 0.3;
const TIMEOUT_MS = 60_000;

// ─── Evaluation Prompts ──────────────────────────────────────

function buildEvalPrompts(quick: boolean): EvalPrompt[] {
  const prompts: EvalPrompt[] = [
    // ── Sentiment Analysis ──
    {
      id: "sentiment-bitcoin-bullish",
      category: "sentiment",
      systemPrompt:
        "You are a crypto market analyst. Analyze the sentiment for the given cryptocurrency based on the provided market data. Respond in valid JSON with fields: sentiment (bullish/bearish/neutral), confidence (0-100), reasoning (string), signals (array of strings).",
      userPrompt: `Analyze Bitcoin sentiment given:
- Price: $67,450 (+4.2% 24h, +12.8% 7d)
- Volume: $38.2B (up 65% from average)
- Fear & Greed Index: 78 (Extreme Greed)
- BTC dominance: 54.2% (rising)
- Whale accumulation: +12,400 BTC from exchanges in 48h
- Funding rates: 0.015% (moderately positive)
- Open interest: $18.5B (ATH)`,
      expectedFields: ["sentiment", "confidence", "reasoning", "signals"],
      validationFn: (output) => {
        const issues: string[] = [];
        const fieldScores: Record<string, number> = {};
        let total = 0;

        // sentiment field
        if (["bullish", "bearish", "neutral"].includes(output.sentiment as string)) {
          fieldScores.sentiment = output.sentiment === "bullish" ? 100 : 50;
        } else {
          fieldScores.sentiment = 0;
          issues.push(`Invalid sentiment value: ${output.sentiment}`);
        }

        // confidence field
        const conf = output.confidence as number;
        if (typeof conf === "number" && conf >= 0 && conf <= 100) {
          fieldScores.confidence = conf >= 60 ? 100 : 70;
        } else {
          fieldScores.confidence = 0;
          issues.push(`Invalid confidence: ${conf}`);
        }

        // reasoning field
        if (typeof output.reasoning === "string" && output.reasoning.length > 30) {
          fieldScores.reasoning = Math.min(100, Math.round(output.reasoning.length / 3));
        } else {
          fieldScores.reasoning = 0;
          issues.push("Reasoning too short or missing");
        }

        // signals field
        if (Array.isArray(output.signals) && output.signals.length >= 2) {
          fieldScores.signals = Math.min(100, output.signals.length * 25);
        } else {
          fieldScores.signals = 0;
          issues.push("Signals array missing or too few entries");
        }

        total = Math.round(
          Object.values(fieldScores).reduce((a, b) => a + b, 0) / Object.keys(fieldScores).length,
        );

        return {
          score: total,
          jsonValid: true,
          fieldsPresent: Object.keys(fieldScores).every((k) => fieldScores[k] > 0),
          fieldScores,
          issues,
        };
      },
    },

    {
      id: "sentiment-ethereum-bearish",
      category: "sentiment",
      systemPrompt:
        "You are a crypto market analyst. Analyze the sentiment for the given cryptocurrency. Respond in valid JSON with fields: sentiment (bullish/bearish/neutral), confidence (0-100), reasoning (string), signals (array of strings).",
      userPrompt: `Analyze Ethereum sentiment given:
- Price: $2,180 (-8.5% 24h, -15.2% 7d)
- Volume: $15.8B (declining)
- Gas fees: 8 gwei (abnormally low, suggesting low demand)
- ETH/BTC ratio: 0.032 (52-week low)
- DeFi TVL: $45B (down 18% in 30d)
- Validator exits: 8,200 in past week (elevated)
- Funding rates: -0.02% (negative)`,
      expectedFields: ["sentiment", "confidence", "reasoning", "signals"],
      validationFn: (output) => {
        const issues: string[] = [];
        const fieldScores: Record<string, number> = {};

        if (["bullish", "bearish", "neutral"].includes(output.sentiment as string)) {
          fieldScores.sentiment = output.sentiment === "bearish" ? 100 : 40;
        } else {
          fieldScores.sentiment = 0;
          issues.push(`Invalid sentiment: ${output.sentiment}`);
        }

        const conf = output.confidence as number;
        fieldScores.confidence =
          typeof conf === "number" && conf >= 0 && conf <= 100 ? (conf >= 50 ? 100 : 70) : 0;
        if (fieldScores.confidence === 0) issues.push(`Invalid confidence: ${conf}`);

        fieldScores.reasoning =
          typeof output.reasoning === "string" && output.reasoning.length > 30
            ? Math.min(100, Math.round(output.reasoning.length / 3))
            : 0;
        if (!fieldScores.reasoning) issues.push("Reasoning too short");

        fieldScores.signals =
          Array.isArray(output.signals) && output.signals.length >= 2
            ? Math.min(100, output.signals.length * 25)
            : 0;
        if (!fieldScores.signals) issues.push("Signals missing");

        const total = Math.round(
          Object.values(fieldScores).reduce((a, b) => a + b, 0) / Object.keys(fieldScores).length,
        );

        return {
          score: total,
          jsonValid: true,
          fieldsPresent: Object.keys(fieldScores).every((k) => fieldScores[k] > 0),
          fieldScores,
          issues,
        };
      },
    },

    // ── Market Digest ──
    {
      id: "digest-daily",
      category: "digest",
      systemPrompt:
        "You are a crypto market strategist producing daily briefings. Respond with valid JSON containing: headline (string), summary (string), topMovers (array of {coin, change, reason}), riskLevel (low/medium/high), keyMetrics (object).",
      userPrompt: `Generate today's market digest:

Global: Market cap $2.38T (+2.1%), BTC dominance 53.8%, 24h volume $95B
Top gainers: SOL +15.2%, AVAX +11.8%, LINK +9.5%
Top losers: DOGE -4.2%, SHIB -6.1%
BTC: $68,200 (+3.1%), ETH: $3,450 (+1.8%)
DeFi TVL: $89.2B (+3.5%), Stablecoin supply: $165B
Fear & Greed: 72 (Greed)
Notable: Solana DEX volume surpassed Ethereum for 3rd consecutive day
Macro: Fed holding rates, CPI at 3.1%`,
      expectedFields: ["headline", "summary", "topMovers", "riskLevel", "keyMetrics"],
      validationFn: (output) => {
        const issues: string[] = [];
        const fieldScores: Record<string, number> = {};

        fieldScores.headline =
          typeof output.headline === "string" && output.headline.length > 10 ? 100 : 0;
        if (!fieldScores.headline) issues.push("Missing or short headline");

        fieldScores.summary =
          typeof output.summary === "string" && output.summary.length > 50 ? 100 : 0;
        if (!fieldScores.summary) issues.push("Missing or short summary");

        fieldScores.topMovers =
          Array.isArray(output.topMovers) && output.topMovers.length >= 2 ? 100 : 0;
        if (!fieldScores.topMovers) issues.push("Missing topMovers");

        fieldScores.riskLevel = ["low", "medium", "high"].includes(output.riskLevel as string)
          ? 100
          : 0;
        if (!fieldScores.riskLevel) issues.push(`Invalid riskLevel: ${output.riskLevel}`);

        fieldScores.keyMetrics =
          typeof output.keyMetrics === "object" && output.keyMetrics !== null ? 100 : 0;
        if (!fieldScores.keyMetrics) issues.push("Missing keyMetrics");

        const total = Math.round(
          Object.values(fieldScores).reduce((a, b) => a + b, 0) / Object.keys(fieldScores).length,
        );

        return {
          score: total,
          jsonValid: true,
          fieldsPresent: Object.values(fieldScores).every((s) => s > 0),
          fieldScores,
          issues,
        };
      },
    },

    // ── Trading Signals ──
    {
      id: "signals-btc-breakout",
      category: "signals",
      systemPrompt:
        "You are a quantitative crypto trader. Generate a trading signal with valid JSON containing: action (buy/sell/hold), coin (string), entry (number), target (number), stopLoss (number), confidence (0-100), timeframe (string), reasoning (string).",
      userPrompt: `Generate trading signal for BTC:
- Current price: $67,850
- 24h high/low: $68,200 / $64,300
- RSI(14): 68 (approaching overbought)
- MACD: Bullish crossover 2 days ago
- Volume: 45% above 20-day average
- Key resistance: $69,000 (previous ATH region)
- Key support: $63,500 (20-day MA)
- Open interest increasing with price (confirmation)
- Funding rate: 0.01% (neutral-positive)`,
      expectedFields: ["action", "coin", "entry", "target", "stopLoss", "confidence", "timeframe", "reasoning"],
      validationFn: (output) => {
        const issues: string[] = [];
        const fieldScores: Record<string, number> = {};

        fieldScores.action = ["buy", "sell", "hold"].includes(output.action as string) ? 100 : 0;
        if (!fieldScores.action) issues.push(`Invalid action: ${output.action}`);

        fieldScores.coin = typeof output.coin === "string" && output.coin.length > 0 ? 100 : 0;
        if (!fieldScores.coin) issues.push("Missing coin");

        const entry = output.entry as number;
        fieldScores.entry =
          typeof entry === "number" && entry > 50000 && entry < 80000 ? 100 : 0;
        if (!fieldScores.entry) issues.push(`Invalid entry price: ${entry}`);

        const target = output.target as number;
        fieldScores.target = typeof target === "number" && target > 0 ? 100 : 0;
        if (!fieldScores.target) issues.push(`Invalid target: ${target}`);

        const stop = output.stopLoss as number;
        fieldScores.stopLoss = typeof stop === "number" && stop > 0 ? 100 : 0;
        if (!fieldScores.stopLoss) issues.push(`Invalid stopLoss: ${stop}`);

        // Risk/reward check
        if (fieldScores.entry && fieldScores.target && fieldScores.stopLoss) {
          const rr = Math.abs(target - entry) / Math.abs(entry - stop);
          if (rr < 1) {
            fieldScores.riskReward = 30;
            issues.push(`Poor risk/reward ratio: ${rr.toFixed(2)}`);
          } else {
            fieldScores.riskReward = Math.min(100, Math.round(rr * 40));
          }
        }

        fieldScores.confidence =
          typeof (output.confidence as number) === "number" &&
            (output.confidence as number) >= 0 &&
            (output.confidence as number) <= 100
            ? 100
            : 0;

        fieldScores.timeframe =
          typeof output.timeframe === "string" && output.timeframe.length > 0 ? 100 : 0;

        fieldScores.reasoning =
          typeof output.reasoning === "string" && output.reasoning.length > 20 ? 100 : 0;
        if (!fieldScores.reasoning) issues.push("Reasoning too short");

        const total = Math.round(
          Object.values(fieldScores).reduce((a, b) => a + b, 0) / Object.keys(fieldScores).length,
        );

        return {
          score: total,
          jsonValid: true,
          fieldsPresent: Object.keys(fieldScores).every((k) => fieldScores[k] > 0),
          fieldScores,
          issues,
        };
      },
    },

    // ── DeFi Risk Assessment ──
    {
      id: "risk-aave-v3",
      category: "risk",
      systemPrompt:
        "You are a DeFi security researcher. Assess the risk of the given protocol. Respond with valid JSON containing: protocol (string), riskScore (0-100, lower=safer), riskLevel (low/medium/high/critical), factors (array of {factor, impact, description}), recommendation (string).",
      userPrompt: `Assess the risk of Aave V3:
- TVL: $12.8B across 8 chains
- Audits: Trail of Bits, OpenZeppelin, Sigma Prime (all passed)
- Governance: Active DAO with 400+ proposals
- Insurance: Covered by Nexus Mutual ($50M capacity)
- Smart contract age: 18 months (V3), 4+ years (protocol)
- Oracle: Chainlink price feeds (industry standard)
- Incidents: 1 minor oracle delay issue (recovered, no loss)
- Admin keys: Timelock + multisig (no single point of failure)
- Revenue: $180M annualized from interest spreads`,
      expectedFields: ["protocol", "riskScore", "riskLevel", "factors", "recommendation"],
      validationFn: (output) => {
        const issues: string[] = [];
        const fieldScores: Record<string, number> = {};

        fieldScores.protocol =
          typeof output.protocol === "string" && output.protocol.toLowerCase().includes("aave")
            ? 100
            : typeof output.protocol === "string"
              ? 60
              : 0;

        const riskScore = output.riskScore as number;
        fieldScores.riskScore =
          typeof riskScore === "number" && riskScore >= 0 && riskScore <= 100
            ? riskScore <= 40
              ? 100
              : 60
            : 0;
        if (!fieldScores.riskScore) issues.push(`Invalid riskScore: ${riskScore}`);

        fieldScores.riskLevel = ["low", "medium", "high", "critical"].includes(
          output.riskLevel as string,
        )
          ? (output.riskLevel as string) === "low"
            ? 100
            : 70
          : 0;

        fieldScores.factors =
          Array.isArray(output.factors) && output.factors.length >= 3 ? 100 : 0;
        if (!fieldScores.factors) issues.push("Too few risk factors");

        fieldScores.recommendation =
          typeof output.recommendation === "string" && output.recommendation.length > 20 ? 100 : 0;

        const total = Math.round(
          Object.values(fieldScores).reduce((a, b) => a + b, 0) / Object.keys(fieldScores).length,
        );

        return {
          score: total,
          jsonValid: true,
          fieldsPresent: Object.values(fieldScores).every((s) => s > 0),
          fieldScores,
          issues,
        };
      },
    },

    // ── Yield Analysis ──
    {
      id: "yield-stablecoin-strategy",
      category: "yield",
      systemPrompt:
        "You are a DeFi yield strategist. Analyze the given yield opportunity. Respond with valid JSON containing: strategy (string), estimatedAPY (number), riskLevel (low/medium/high), protocols (array of strings), risks (array of strings), recommendation (string).",
      userPrompt: `Evaluate this stablecoin yield strategy:
- Deposit USDC on Aave V3 (Arbitrum): 4.2% supply APY
- Borrow USDT at 3.1% (LTV: 77%)
- Deposit borrowed USDT in Curve USDT/USDC/DAI pool: 6.8% APY
- Net yield estimate: ~7.9% APY
- Additional CRV + ARB incentives: ~3.2% APY
- Total estimated: ~11.1% APY
- Capital: $100,000
- Health factor target: 1.8 (conservative)`,
      expectedFields: ["strategy", "estimatedAPY", "riskLevel", "protocols", "risks", "recommendation"],
      validationFn: (output) => {
        const issues: string[] = [];
        const fieldScores: Record<string, number> = {};

        fieldScores.strategy =
          typeof output.strategy === "string" && output.strategy.length > 10 ? 100 : 0;

        const apy = output.estimatedAPY as number;
        fieldScores.estimatedAPY = typeof apy === "number" && apy > 0 && apy < 100 ? 100 : 0;
        if (!fieldScores.estimatedAPY) issues.push(`Invalid APY: ${apy}`);

        fieldScores.riskLevel = ["low", "medium", "high"].includes(output.riskLevel as string)
          ? 100
          : 0;

        fieldScores.protocols =
          Array.isArray(output.protocols) && output.protocols.length >= 1 ? 100 : 0;

        fieldScores.risks =
          Array.isArray(output.risks) && output.risks.length >= 2 ? 100 : 0;
        if (!fieldScores.risks) issues.push("Too few risks identified");

        fieldScores.recommendation =
          typeof output.recommendation === "string" && output.recommendation.length > 20 ? 100 : 0;

        const total = Math.round(
          Object.values(fieldScores).reduce((a, b) => a + b, 0) / Object.keys(fieldScores).length,
        );

        return {
          score: total,
          jsonValid: true,
          fieldsPresent: Object.values(fieldScores).every((s) => s > 0),
          fieldScores,
          issues,
        };
      },
    },

    // ── Q&A ──
    {
      id: "qa-impermanent-loss",
      category: "qa",
      systemPrompt:
        "You are a crypto educator. Answer the user's question clearly and accurately. Respond with valid JSON containing: answer (string), confidence (0-100), sources (array of strings), relatedTopics (array of strings).",
      userPrompt:
        "What is impermanent loss in DeFi liquidity pools, and how can I minimize it? Give a concrete example with real numbers.",
      expectedFields: ["answer", "confidence", "sources", "relatedTopics"],
      validationFn: (output) => {
        const issues: string[] = [];
        const fieldScores: Record<string, number> = {};

        const answer = output.answer as string;
        fieldScores.answer =
          typeof answer === "string" && answer.length > 100
            ? answer.toLowerCase().includes("impermanent")
              ? 100
              : 70
            : 0;
        if (!fieldScores.answer) issues.push("Answer too short or missing keyword");

        fieldScores.confidence =
          typeof (output.confidence as number) === "number" &&
            (output.confidence as number) >= 0 &&
            (output.confidence as number) <= 100
            ? 100
            : 0;

        fieldScores.sources = Array.isArray(output.sources) ? 100 : 0;

        fieldScores.relatedTopics =
          Array.isArray(output.relatedTopics) && output.relatedTopics.length >= 1 ? 100 : 0;

        const total = Math.round(
          Object.values(fieldScores).reduce((a, b) => a + b, 0) / Object.keys(fieldScores).length,
        );

        return {
          score: total,
          jsonValid: true,
          fieldsPresent: Object.values(fieldScores).every((s) => s > 0),
          fieldScores,
          issues,
        };
      },
    },
  ];

  return quick ? prompts.slice(0, 3) : prompts;
}

// ─── API Client ──────────────────────────────────────────────

async function queryModel(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; tokensUsed: number | null; latencyMs: number }> {
  const url = endpoint.endsWith("/v1/chat/completions")
    ? endpoint
    : `${endpoint.replace(/\/$/, "")}/v1/chat/completions`;

  const start = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const latencyMs = Math.round(performance.now() - start);

    const choices = data.choices as Array<{ message: { content: string } }> | undefined;
    const text = choices?.[0]?.message?.content || "";
    const usage = data.usage as { total_tokens: number } | undefined;

    return {
      text,
      tokensUsed: usage?.total_tokens ?? null,
      latencyMs,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── JSON Extraction ─────────────────────────────────────────

function extractJSON(text: string): Record<string, unknown> | null {
  const cleaned = text.trim();

  // Strip markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : cleaned;

  // Find outermost JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Evaluation Runner ───────────────────────────────────────

async function evaluateModel(
  endpoint: string,
  model: string,
  prompts: EvalPrompt[],
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];

  for (const prompt of prompts) {
    console.log(`  Evaluating: ${prompt.id}...`);

    try {
      const { text, tokensUsed, latencyMs } = await queryModel(
        endpoint,
        model,
        prompt.systemPrompt,
        prompt.userPrompt,
      );

      const parsed = extractJSON(text);
      let score: EvalScore;

      if (!parsed) {
        score = {
          score: 0,
          jsonValid: false,
          fieldsPresent: false,
          fieldScores: {},
          issues: ["Failed to parse JSON from model output"],
        };
      } else {
        // Check expected fields exist
        const missingFields = prompt.expectedFields.filter((f) => !(f in parsed));
        if (missingFields.length > 0) {
          score = prompt.validationFn(parsed);
          score.issues.push(`Missing fields: ${missingFields.join(", ")}`);
          score.fieldsPresent = false;
        } else {
          score = prompt.validationFn(parsed);
        }
      }

      results.push({
        promptId: prompt.id,
        category: prompt.category,
        score,
        latencyMs,
        tokensUsed,
        rawOutput: text.slice(0, 2000),
        model,
        endpoint,
        timestamp: new Date().toISOString(),
      });

      const icon = score.score >= 80 ? "✓" : score.score >= 50 ? "△" : "✗";
      console.log(
        `    ${icon} Score: ${score.score}/100 | JSON: ${score.jsonValid ? "✓" : "✗"} | Latency: ${latencyMs}ms`,
      );
      if (score.issues.length > 0) {
        console.log(`    Issues: ${score.issues.join("; ")}`);
      }
    } catch (err) {
      console.error(`    ✗ FAILED: ${(err as Error).message}`);
      results.push({
        promptId: prompt.id,
        category: prompt.category,
        score: {
          score: 0,
          jsonValid: false,
          fieldsPresent: false,
          fieldScores: {},
          issues: [`Evaluation failed: ${(err as Error).message}`],
        },
        latencyMs: 0,
        tokensUsed: null,
        rawOutput: "",
        model,
        endpoint,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

// ─── Report Generation ───────────────────────────────────────

function generateReport(
  endpoint: string,
  model: string,
  results: EvalResult[],
  comparison?: { endpoint: string; model: string; results: EvalResult[] },
): EvalReport {
  const scores = results.map((r) => r.score.score);
  const latencies = results.filter((r) => r.latencyMs > 0).map((r) => r.latencyMs);

  // Category breakdown
  const categoryScores: Record<string, number[]> = {};
  for (const r of results) {
    if (!categoryScores[r.category]) categoryScores[r.category] = [];
    categoryScores[r.category].push(r.score.score);
  }
  const avgCategoryScores: Record<string, number> = {};
  for (const [cat, catScores] of Object.entries(categoryScores)) {
    avgCategoryScores[cat] = Math.round(catScores.reduce((a, b) => a + b, 0) / catScores.length);
  }

  const report: EvalReport = {
    evaluatedAt: new Date().toISOString(),
    endpoint,
    model,
    totalPrompts: results.length,
    results,
    summary: {
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      avgLatencyMs: latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
      jsonValidRate: Math.round(
        (results.filter((r) => r.score.jsonValid).length / results.length) * 100,
      ),
      fieldsCompleteRate: Math.round(
        (results.filter((r) => r.score.fieldsPresent).length / results.length) * 100,
      ),
      categoryScores: avgCategoryScores,
      totalTokens: results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0),
    },
  };

  if (comparison) {
    const baselineScores = comparison.results.map((r) => r.score.score);
    const baselineLatencies = comparison.results
      .filter((r) => r.latencyMs > 0)
      .map((r) => r.latencyMs);

    const baselineAvgScore = Math.round(
      baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length,
    );
    const baselineAvgLatency =
      baselineLatencies.length > 0
        ? Math.round(baselineLatencies.reduce((a, b) => a + b, 0) / baselineLatencies.length)
        : 0;

    report.comparison = {
      baselineEndpoint: comparison.endpoint,
      baselineModel: comparison.model,
      scoreDelta: report.summary.avgScore - baselineAvgScore,
      latencyDelta: report.summary.avgLatencyMs - baselineAvgLatency,
    };
  }

  return report;
}

// ─── CLI ─────────────────────────────────────────────────────

function parseCliArgs(): {
  quick: boolean;
  endpoint: string;
  model: string;
  compareEndpoint: string | null;
  compareModel: string;
} {
  const args = process.argv.slice(2);
  const quick = args.includes("quick");
  const endpointIdx = args.indexOf("--endpoint");
  const compareIdx = args.indexOf("--compare");
  const modelIdx = args.indexOf("--model");
  const compareModelIdx = args.indexOf("--compare-model");

  return {
    quick,
    endpoint: endpointIdx >= 0 && args[endpointIdx + 1] ? args[endpointIdx + 1] : DEFAULT_ENDPOINT,
    model: modelIdx >= 0 && args[modelIdx + 1] ? args[modelIdx + 1] : DEFAULT_MODEL,
    compareEndpoint: compareIdx >= 0 && args[compareIdx + 1] ? args[compareIdx + 1] : null,
    compareModel:
      compareModelIdx >= 0 && args[compareModelIdx + 1]
        ? args[compareModelIdx + 1]
        : DEFAULT_MODEL,
  };
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cliArgs = parseCliArgs();
  const prompts = buildEvalPrompts(cliArgs.quick);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Crypto Vision — Model Evaluation");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Mode:     ${cliArgs.quick ? "Quick (3 prompts)" : "Full (7 prompts)"}`);
  console.log(`  Endpoint: ${cliArgs.endpoint}`);
  console.log(`  Model:    ${cliArgs.model}`);
  if (cliArgs.compareEndpoint) {
    console.log(`  Compare:  ${cliArgs.compareEndpoint}`);
  }
  console.log("═══════════════════════════════════════════════════════\n");

  // Evaluate primary model
  console.log(`Evaluating ${cliArgs.model} @ ${cliArgs.endpoint}...`);
  const results = await evaluateModel(cliArgs.endpoint, cliArgs.model, prompts);

  // Evaluate comparison model if specified
  let comparisonData:
    | { endpoint: string; model: string; results: EvalResult[] }
    | undefined;

  if (cliArgs.compareEndpoint) {
    console.log(`\nEvaluating baseline: ${cliArgs.compareModel} @ ${cliArgs.compareEndpoint}...`);
    const baselineResults = await evaluateModel(
      cliArgs.compareEndpoint,
      cliArgs.compareModel,
      prompts,
    );
    comparisonData = {
      endpoint: cliArgs.compareEndpoint,
      model: cliArgs.compareModel,
      results: baselineResults,
    };
  }

  // Generate report
  const report = generateReport(cliArgs.endpoint, cliArgs.model, results, comparisonData);

  // Save report
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportFile = resolve(OUTPUT_DIR, `eval-${cliArgs.model}-${timestamp}.json`);
  writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");

  // Print summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  EVALUATION RESULTS");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Average Score:     ${report.summary.avgScore}/100`);
  console.log(`  JSON Valid Rate:   ${report.summary.jsonValidRate}%`);
  console.log(`  Fields Complete:   ${report.summary.fieldsCompleteRate}%`);
  console.log(`  Average Latency:   ${report.summary.avgLatencyMs}ms`);
  console.log(`  Total Tokens:      ${report.summary.totalTokens}`);
  console.log();
  console.log("  Category Scores:");
  for (const [cat, score] of Object.entries(report.summary.categoryScores)) {
    const bar = "█".repeat(Math.round(score / 5)) + "░".repeat(20 - Math.round(score / 5));
    console.log(`    ${cat.padEnd(12)} ${bar} ${score}/100`);
  }

  if (report.comparison) {
    console.log();
    console.log("  Comparison vs Baseline:");
    const scoreDelta = report.comparison.scoreDelta;
    const latencyDelta = report.comparison.latencyDelta;
    console.log(
      `    Score delta:   ${scoreDelta >= 0 ? "+" : ""}${scoreDelta} points`,
    );
    console.log(
      `    Latency delta: ${latencyDelta >= 0 ? "+" : ""}${latencyDelta}ms`,
    );
  }

  console.log(`\n  Report saved: ${reportFile}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // Exit with error code if score is too low
  if (report.summary.avgScore < 30) {
    console.error("FAIL: Average score below 30. Model needs more training.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
