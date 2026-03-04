/**
 * Crypto Vision — Model Evaluation Framework
 *
 * Evaluates multiple AI models (base + fine-tuned) on crypto-specific tasks
 * using a curated set of evaluation cases. Produces a comparison report with
 * accuracy, latency, JSON parse rates, and per-category breakdowns.
 *
 * Categories tested:
 *   - Sentiment analysis (bullish/bearish/neutral classification)
 *   - Trading signal generation (buy/sell/hold with reasoning)
 *   - DeFi risk assessment (risk score + factor analysis)
 *   - Market digest (structured multi-section summary)
 *   - Yield analysis (opportunity ranking with risk)
 *   - Whale activity (transaction interpretation)
 *   - General Q&A (free-form crypto knowledge)
 *
 * Usage:
 *   npx tsx scripts/training/eval-models.ts
 *   npx tsx scripts/training/eval-models.ts --models gemini,groq --output data/training/eval.json
 *   npx tsx scripts/training/eval-models.ts --category sentiment --verbose
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

// ─── Types ───────────────────────────────────────────────────

interface EvalCase {
  id: string;
  category: EvalCategory;
  input: string;
  expectedFields: string[];
  validators: Record<string, (value: unknown) => boolean>;
  groundTruth?: Record<string, unknown>;
  description?: string;
}

type EvalCategory =
  | "sentiment"
  | "signals"
  | "risk"
  | "digest"
  | "yield"
  | "whale"
  | "general";

interface EvalResult {
  model: string;
  provider: string;
  category: string;
  totalCases: number;
  passed: number;
  failed: number;
  errors: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  avgTokens: number;
  jsonParseRate: number;
  fieldAccuracy: number;
  groundTruthAccuracy: number;
  detailedScores: Record<string, number>;
  caseResults: CaseResult[];
}

interface CaseResult {
  caseId: string;
  category: string;
  passed: boolean;
  latencyMs: number;
  jsonParsed: boolean;
  fieldsPresent: number;
  fieldsExpected: number;
  validatorResults: Record<string, boolean>;
  groundTruthMatch: boolean;
  error?: string;
  rawResponse?: string;
}

interface ComparisonReport {
  evaluatedAt: string;
  evalCaseCount: number;
  categories: EvalCategory[];
  models: EvalResult[];
  winner: string;
  categoryWinners: Record<string, string>;
  recommendations: string[];
}

// ─── CLI Argument Parsing ────────────────────────────────────

interface CliArgs {
  models: string[];
  category: EvalCategory | "all";
  output: string;
  verbose: boolean;
  temperature: number;
  maxRetries: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    models: [],
    category: "all",
    output: "data/training/eval-report.json",
    verbose: false,
    temperature: 0.1,
    maxRetries: 2,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--models":
        parsed.models = (args[++i] ?? "").split(",").filter(Boolean);
        break;
      case "--category":
        parsed.category = (args[++i] ?? "all") as EvalCategory | "all";
        break;
      case "--output":
        parsed.output = args[++i] ?? parsed.output;
        break;
      case "--verbose":
        parsed.verbose = true;
        break;
      case "--temperature":
        parsed.temperature = parseFloat(args[++i] ?? "0.1");
        break;
      case "--max-retries":
        parsed.maxRetries = parseInt(args[++i] ?? "2", 10);
        break;
    }
  }

  return parsed;
}

// ─── Model Registry ──────────────────────────────────────────

interface ModelSpec {
  id: string;
  provider: string;
  displayName: string;
  isFineTuned: boolean;
}

function getModelRegistry(): ModelSpec[] {
  const models: ModelSpec[] = [
    {
      id: "gemini-2.0-flash",
      provider: "gemini",
      displayName: "Gemini 2.0 Flash",
      isFineTuned: false,
    },
    {
      id: "llama-3.3-70b-versatile",
      provider: "groq",
      displayName: "Llama 3.3 70B (Groq)",
      isFineTuned: false,
    },
    {
      id: "gpt-4o-mini",
      provider: "openai",
      displayName: "GPT-4o Mini",
      isFineTuned: false,
    },
    {
      id: "claude-3-5-haiku-20241022",
      provider: "anthropic",
      displayName: "Claude 3.5 Haiku",
      isFineTuned: false,
    },
  ];

  // Add fine-tuned models if endpoints are configured
  if (process.env.VERTEX_FINETUNED_ENDPOINT) {
    models.unshift({
      id: process.env.VERTEX_FINETUNED_MODEL ?? "crypto-vision-v1",
      provider: "vertex-finetuned",
      displayName: "Crypto Vision Fine-Tuned",
      isFineTuned: true,
    });
  }

  return models;
}

// ─── Evaluation Cases ────────────────────────────────────────

const EVAL_CASES: EvalCase[] = [
  // ── Sentiment ──────────────────────────────────────────────
  {
    id: "sentiment-btc-bull",
    category: "sentiment",
    description: "Bitcoin with strong bullish indicators",
    input: `Analyze Bitcoin sentiment. Price: $95,000, 24h: +5.2%, 7d: +12.3%, 30d: +28.4%, Volume: $45B, Fear & Greed: 78 (Extreme Greed), ATH: $105,000 (within 10%)`,
    expectedFields: ["sentiment", "confidence", "summary", "keyFactors", "outlook", "riskLevel"],
    validators: {
      sentiment: (v) => typeof v === "string" && ["bullish", "bearish", "neutral"].includes(v),
      confidence: (v) => typeof v === "number" && v >= 0 && v <= 100,
      keyFactors: (v) => Array.isArray(v) && v.length >= 2,
      riskLevel: (v) => typeof v === "string" && ["low", "medium", "high"].includes(v),
    },
    groundTruth: { sentiment: "bullish" },
  },
  {
    id: "sentiment-eth-bear",
    category: "sentiment",
    description: "Ethereum with bearish indicators",
    input: `Analyze Ethereum sentiment. Price: $2,800, 24h: -8.1%, 7d: -15.6%, 30d: -22.3%, Volume: $12B (declining), Fear & Greed: 22 (Extreme Fear), ATH: $4,891 (-42.8%)`,
    expectedFields: ["sentiment", "confidence", "summary", "keyFactors", "outlook", "riskLevel"],
    validators: {
      sentiment: (v) => typeof v === "string" && ["bullish", "bearish", "neutral"].includes(v),
      confidence: (v) => typeof v === "number" && v >= 0 && v <= 100,
      keyFactors: (v) => Array.isArray(v) && v.length >= 2,
    },
    groundTruth: { sentiment: "bearish" },
  },
  {
    id: "sentiment-sol-neutral",
    category: "sentiment",
    description: "Solana with mixed signals",
    input: `Analyze Solana sentiment. Price: $145, 24h: +0.8%, 7d: -2.1%, 30d: +5.3%, Volume: $3.2B (average), Fear & Greed: 52 (Neutral), ATH: $260 (-44.2%). Strong ecosystem growth but regulatory concerns.`,
    expectedFields: ["sentiment", "confidence", "summary", "keyFactors", "outlook"],
    validators: {
      sentiment: (v) => typeof v === "string" && ["bullish", "bearish", "neutral"].includes(v),
      confidence: (v) => typeof v === "number" && v >= 0 && v <= 100,
    },
    groundTruth: {},
  },
  {
    id: "sentiment-stablecoin-depeg",
    category: "sentiment",
    description: "Stablecoin with depeg risk signal",
    input: `Analyze USDT sentiment. Price: $0.997, 24h: -0.3%, 7d: -0.1%, Volume: $62B (surging), Fear & Greed: 18 (Extreme Fear). Redemption queue at $2.5B. Whale transfers to DEXs increasing.`,
    expectedFields: ["sentiment", "confidence", "summary", "keyFactors", "outlook", "riskLevel"],
    validators: {
      sentiment: (v) => typeof v === "string" && ["bullish", "bearish", "neutral"].includes(v),
      confidence: (v) => typeof v === "number" && v >= 0 && v <= 100,
      riskLevel: (v) => typeof v === "string" && ["low", "medium", "high"].includes(v),
    },
    groundTruth: { riskLevel: "high" },
  },

  // ── Signals ────────────────────────────────────────────────
  {
    id: "signal-sol-breakout",
    category: "signals",
    description: "Solana breakout pattern with rising volume",
    input: `Trading signal for Solana. Price: $180, 30d prices: [120, 125, 130, 140, 145, 155, 160, 162, 158, 160, 165, 170, 172, 168, 170, 175, 178, 180, 178, 175, 172, 170, 175, 178, 180, 182, 185, 180, 178, 180]. Volume increasing 20%. RSI: 62. MACD: bullish crossover.`,
    expectedFields: ["signal", "strength", "timeframe", "technicals", "reasoning"],
    validators: {
      signal: (v) => typeof v === "string" && ["buy", "sell", "hold"].includes(v),
      strength: (v) => typeof v === "number" && v >= 0 && v <= 100,
      timeframe: (v) => typeof v === "string" && ["short", "medium", "long"].includes(v),
    },
    groundTruth: { signal: "buy" },
  },
  {
    id: "signal-eth-declining",
    category: "signals",
    description: "ETH in downtrend with declining volume",
    input: `Trading signal for Ethereum. Price: $2,800. 30d prices: [3500, 3450, 3400, 3380, 3350, 3300, 3280, 3200, 3150, 3100, 3050, 3000, 2980, 2950, 2920, 2900, 2880, 2850, 2830, 2810, 2800, 2780, 2760, 2780, 2800, 2790, 2800, 2810, 2800, 2800]. Volume declining 15%. RSI: 38. MACD: bearish.`,
    expectedFields: ["signal", "strength", "timeframe", "technicals", "reasoning"],
    validators: {
      signal: (v) => typeof v === "string" && ["buy", "sell", "hold"].includes(v),
      strength: (v) => typeof v === "number" && v >= 0 && v <= 100,
    },
    groundTruth: { signal: "sell" },
  },
  {
    id: "signal-btc-consolidation",
    category: "signals",
    description: "BTC consolidating in a range",
    input: `Trading signal for Bitcoin. Price: $82,000. 14d prices: [80000, 81000, 82500, 81500, 82000, 83000, 82000, 81000, 82000, 83000, 82500, 81500, 82000, 82000]. Volume flat. RSI: 50. MACD: neutral. Bollinger bands tightening.`,
    expectedFields: ["signal", "strength", "timeframe", "reasoning"],
    validators: {
      signal: (v) => typeof v === "string" && ["buy", "sell", "hold"].includes(v),
      strength: (v) => typeof v === "number" && v >= 0 && v <= 100,
    },
    groundTruth: { signal: "hold" },
  },

  // ── Risk Assessment ────────────────────────────────────────
  {
    id: "risk-aave-v3",
    category: "risk",
    description: "Aave V3 — battle-tested lending protocol",
    input: `Assess DeFi risk for Aave V3. TVL: $12B, Category: Lending, Chains: Ethereum+Arbitrum+Base+Polygon, Audited: Yes (20+ audits by Trail of Bits, OpenZeppelin, Sigma Prime), Bug Bounty: $15M, Governance: Active (Snapshot + Seatbelt), Token: AAVE, mcap/tvl: 0.8, Age: 4 years, Incidents: 1 minor (contained).`,
    expectedFields: ["riskScore", "riskLevel", "factors", "recommendation"],
    validators: {
      riskScore: (v) => typeof v === "number" && v >= 0 && v <= 100,
      riskLevel: (v) => typeof v === "string" && ["low", "medium", "high", "critical"].includes(v),
      factors: (v) => Array.isArray(v) && v.length >= 2,
    },
    groundTruth: { riskLevel: "low" },
  },
  {
    id: "risk-new-fork",
    category: "risk",
    description: "New Aave fork with suspicious characteristics",
    input: `Assess DeFi risk for YieldMaxx. TVL: $45M (grew from $2M in 3 days), Category: Lending, Chains: Arbitrum only, Audited: "Pending" (no audit report available), Bug Bounty: None, Governance: None, Token: YMAX, mcap/tvl: 12.5, Age: 2 weeks, Incidents: None reported. Team: anonymous. Code is fork of Aave V2 with modified reward mechanics.`,
    expectedFields: ["riskScore", "riskLevel", "factors", "recommendation"],
    validators: {
      riskScore: (v) => typeof v === "number" && v >= 0 && v <= 100,
      riskLevel: (v) => typeof v === "string" && ["low", "medium", "high", "critical"].includes(v),
    },
    groundTruth: { riskLevel: "high" },
  },
  {
    id: "risk-bridge",
    category: "risk",
    description: "Cross-chain bridge protocol",
    input: `Assess DeFi risk for OmniBridge. TVL: $800M, Category: Bridge, Chains: Ethereum↔Solana↔Avalanche, Audited: Yes (2 audits by Halborn and Quantstamp), Bug Bounty: $2M, Governance: Token vote, Token: OMNI, mcap/tvl: 0.3, Age: 18 months, Incidents: 0 but similar bridges have been exploited.`,
    expectedFields: ["riskScore", "riskLevel", "factors", "recommendation"],
    validators: {
      riskScore: (v) => typeof v === "number" && v >= 0 && v <= 100,
      riskLevel: (v) => typeof v === "string" && ["low", "medium", "high", "critical"].includes(v),
    },
    groundTruth: { riskLevel: "medium" },
  },

  // ── Digest ─────────────────────────────────────────────────
  {
    id: "digest-bull-market",
    category: "digest",
    description: "Bullish market conditions for daily digest",
    input: `Generate a comprehensive daily crypto market digest.

Global Market:
- Total Market Cap: $3.2T (+4.2% 24h)
- BTC Dominance: 52.3%
- ETH Dominance: 16.8%
- Fear & Greed: 75 (Greed)

Top 5 Coins:
- Bitcoin (BTC): $95,000, 24h: +3.1%, Vol: $42B
- Ethereum (ETH): $3,800, 24h: +5.4%, Vol: $18B
- Solana (SOL): $185, 24h: +8.2%, Vol: $6B
- BNB (BNB): $620, 24h: +1.8%, Vol: $2B
- XRP (XRP): $2.40, 24h: +12.3%, Vol: $8B

Trending: Render (RNDR), Celestia (TIA), Jupiter (JUP)

Top DeFi:
- Aave: TVL $15B (+3%)
- Lido: TVL $35B (+1%)
- Uniswap: TVL $8B (+5%)

Top Yields:
- USDC on Aave (Ethereum): 5.2% APY
- ETH on Lido: 3.8% APY
- SOL on Marinade: 7.1% APY`,
    expectedFields: ["headline", "marketOverview", "topMovers", "defiHighlights", "outlook"],
    validators: {
      headline: (v) => typeof v === "string" && v.length > 10,
      topMovers: (v) => Array.isArray(v) && v.length >= 2,
      defiHighlights: (v) => Array.isArray(v) && v.length >= 1,
    },
    groundTruth: {},
  },

  // ── Yield ──────────────────────────────────────────────────
  {
    id: "yield-stablecoin-comparison",
    category: "yield",
    description: "Compare stablecoin yield opportunities",
    input: `Analyze yield opportunities for stablecoin farming.

Available pools:
1. USDC on Aave V3 (Ethereum): 4.8% APY, TVL $3.2B, no lockup, audited
2. USDC on Compound V3 (Ethereum): 4.2% APY, TVL $1.8B, no lockup, audited
3. USDC-USDT on Curve (Ethereum): 6.5% APY, TVL $600M, IL risk minimal, audited
4. USDC on Kamino (Solana): 8.2% APY, TVL $400M, 7-day cooldown, 1 audit
5. USDC on NewYieldProtocol (Arbitrum): 22% APY, TVL $15M, no lockup, unaudited
6. DAI on Spark (Ethereum): 5.0% DSR, TVL $2B, no lockup, audited

Risk budget: Medium (willing to go on-chain, prefer audited protocols)
Amount: $100,000`,
    expectedFields: ["recommendations", "riskAssessment", "expectedReturn", "diversificationPlan"],
    validators: {
      recommendations: (v) => Array.isArray(v) && v.length >= 2,
      riskAssessment: (v) => typeof v === "string" || (typeof v === "object" && v !== null),
    },
    groundTruth: {},
  },

  // ── Whale ──────────────────────────────────────────────────
  {
    id: "whale-large-transfer",
    category: "whale",
    description: "Large whale transfer to exchange",
    input: `Interpret whale activity:

Transaction: 15,000 ETH ($57M) transferred from known whale wallet (0x7a250...) to Binance hot wallet.
Context:
- Wallet accumulated 15K ETH over past 6 months at avg price $3,200
- ETH price now $3,800 (18.75% profit)
- This is the first transfer in 3 months
- Binance ETH inflows up 340% in past hour
- ETH funding rate on perpetuals: +0.08% (elevated)
- Open interest: $12B (near ATH)

What does this whale activity signal?`,
    expectedFields: ["interpretation", "impact", "confidence", "suggestedAction"],
    validators: {
      interpretation: (v) => typeof v === "string" && v.length > 20,
      impact: (v) => typeof v === "string" && ["bullish", "bearish", "neutral"].includes(v),
      confidence: (v) => typeof v === "number" && v >= 0 && v <= 100,
    },
    groundTruth: { impact: "bearish" },
  },

  // ── General Q&A ────────────────────────────────────────────
  {
    id: "general-impermanent-loss",
    category: "general",
    description: "Explain impermanent loss",
    input: `Explain impermanent loss in liquidity pools. When is it most severe? Give a concrete numerical example with ETH/USDC.`,
    expectedFields: [],
    validators: {},
    groundTruth: {},
  },
  {
    id: "general-mev",
    category: "general",
    description: "Explain MEV and sandwich attacks",
    input: `What is MEV (Maximal Extractable Value)? Explain sandwich attacks with a concrete example. How can traders protect themselves?`,
    expectedFields: [],
    validators: {},
    groundTruth: {},
  },
  {
    id: "general-tokenomics",
    category: "general",
    description: "Evaluate tokenomics",
    input: `Evaluate these tokenomics: Total supply 1B tokens. 20% team (4yr vest, 1yr cliff), 30% community treasury (DAO governed), 15% investors (2yr vest, 6mo cliff), 10% ecosystem grants, 15% liquidity mining (3yr emission), 10% airdrop (no lockup). Current circulating supply: 250M (25%). FDV: $500M. Is this a good token distribution? What are the risks?`,
    expectedFields: [],
    validators: {},
    groundTruth: {},
  },
];

// ─── Response Quality Scorer ─────────────────────────────────

function scoreGeneralResponse(response: string): number {
  let score = 0;
  const wordCount = response.split(/\s+/).length;

  // Length check: should be substantial
  if (wordCount >= 50) score += 10;
  if (wordCount >= 100) score += 10;
  if (wordCount >= 200) score += 5;

  // Structure: uses formatting
  if (response.includes("\n")) score += 5;
  if (/\d/.test(response)) score += 10; // Contains numbers
  if (response.includes("%") || response.includes("$")) score += 5; // Uses financial notation
  if (/\b(example|for instance|e\.g\.|such as)\b/i.test(response)) score += 10; // Uses examples
  if (/\b(however|although|but|risk|caveat|warning|note)\b/i.test(response)) score += 10; // Nuanced

  // Crypto-awareness checks
  if (/\b(blockchain|smart contract|token|protocol|DeFi|DEX|AMM|liquidity)\b/i.test(response)) score += 10;
  if (/\b(gas|fee|slippage|impermanent|MEV|validator|consensus)\b/i.test(response)) score += 5;

  // Penalize very short or empty
  if (wordCount < 20) score = Math.max(0, score - 20);

  return Math.min(100, score);
}

// ─── Evaluation Runner ───────────────────────────────────────

async function evaluateModel(
  modelId: string,
  provider: string,
  cases: EvalCase[],
  temperature: number,
  maxRetries: number,
  verbose: boolean,
): Promise<EvalResult> {
  const { aiComplete } = await import("../../src/lib/ai.js");

  const systemPrompt =
    "You are an expert crypto analyst. When the output format requires structured data, respond in valid JSON. " +
    "Be precise, data-driven, and include specific numbers. For free-form questions, provide thorough explanations with examples.";

  const result: EvalResult = {
    model: modelId,
    provider,
    category: "all",
    totalCases: cases.length,
    passed: 0,
    failed: 0,
    errors: 0,
    latencyP50: 0,
    latencyP95: 0,
    latencyP99: 0,
    avgTokens: 0,
    jsonParseRate: 0,
    fieldAccuracy: 0,
    groundTruthAccuracy: 0,
    detailedScores: {},
    caseResults: [],
  };

  const latencies: number[] = [];
  let jsonParseSuccess = 0;
  let totalFields = 0;
  let presentFields = 0;
  let totalTokens = 0;
  let groundTruthChecked = 0;
  let groundTruthMatched = 0;
  const categoryScores: Record<string, { pass: number; total: number }> = {};

  for (const evalCase of cases) {
    const caseResult: CaseResult = {
      caseId: evalCase.id,
      category: evalCase.category,
      passed: false,
      latencyMs: 0,
      jsonParsed: false,
      fieldsPresent: 0,
      fieldsExpected: evalCase.expectedFields.length,
      validatorResults: {},
      groundTruthMatch: true,
    };

    let retries = 0;
    let success = false;

    while (retries <= maxRetries && !success) {
      const start = Date.now();
      try {
        const { text, tokensUsed } = await aiComplete(systemPrompt, evalCase.input, {
          temperature,
          maxTokens: 1500,
        });

        const latency = Date.now() - start;
        caseResult.latencyMs = latency;
        latencies.push(latency);
        totalTokens += tokensUsed ?? 0;

        if (verbose) {
          caseResult.rawResponse = text.slice(0, 500);
        }

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        let parsed: Record<string, unknown> | null = null;
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
            jsonParseSuccess++;
            caseResult.jsonParsed = true;
          } catch {
            // Not valid JSON
          }
        }

        // Handle general (non-JSON) cases
        if (evalCase.expectedFields.length === 0) {
          const qualityScore = scoreGeneralResponse(text);
          caseResult.passed = qualityScore >= 40;
          if (caseResult.passed) result.passed++;
          else result.failed++;
          success = true;
          result.caseResults.push(caseResult);

          // Track category
          const cat = evalCase.category;
          if (!categoryScores[cat]) categoryScores[cat] = { pass: 0, total: 0 };
          categoryScores[cat].total++;
          if (caseResult.passed) categoryScores[cat].pass++;

          if (verbose) {
            const status = caseResult.passed ? "PASS" : "FAIL";
            console.log(`  [${status}] ${evalCase.id} (quality: ${qualityScore}/100, ${latency}ms)`);
          }
          continue;
        }

        // Check expected fields
        let casePassed = true;
        for (const field of evalCase.expectedFields) {
          totalFields++;
          if (parsed && field in parsed) {
            presentFields++;
            caseResult.fieldsPresent++;
          } else {
            casePassed = false;
          }
        }

        // Run validators
        for (const [field, validator] of Object.entries(evalCase.validators)) {
          const valid = parsed !== null && validator(parsed[field]);
          caseResult.validatorResults[field] = valid;
          if (!valid) casePassed = false;
        }

        // Check ground truth
        if (evalCase.groundTruth && Object.keys(evalCase.groundTruth).length > 0) {
          groundTruthChecked++;
          for (const [key, expected] of Object.entries(evalCase.groundTruth)) {
            if (!parsed || parsed[key] !== expected) {
              casePassed = false;
              caseResult.groundTruthMatch = false;
            }
          }
          if (caseResult.groundTruthMatch) groundTruthMatched++;
        }

        caseResult.passed = casePassed;
        if (casePassed) result.passed++;
        else result.failed++;

        success = true;

        // Track per-category
        const cat = evalCase.category;
        if (!categoryScores[cat]) categoryScores[cat] = { pass: 0, total: 0 };
        categoryScores[cat].total++;
        if (casePassed) categoryScores[cat].pass++;

        if (verbose) {
          const status = casePassed ? "PASS" : "FAIL";
          console.log(`  [${status}] ${evalCase.id} (${latency}ms)`);
          if (!casePassed) {
            for (const [field, ok] of Object.entries(caseResult.validatorResults)) {
              if (!ok) console.log(`    ✗ ${field} validation failed`);
            }
            if (!caseResult.groundTruthMatch) {
              console.log(`    ✗ Ground truth mismatch`);
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        retries++;
        if (retries > maxRetries) {
          result.errors++;
          result.failed++;
          caseResult.error = msg;
          caseResult.latencyMs = Date.now() - start;

          const cat = evalCase.category;
          if (!categoryScores[cat]) categoryScores[cat] = { pass: 0, total: 0 };
          categoryScores[cat].total++;

          if (verbose) {
            console.log(`  [ERR] ${evalCase.id}: ${msg}`);
          }
        } else {
          // Wait before retry
          await new Promise((r) => setTimeout(r, 1000 * retries));
        }
      }
    }

    result.caseResults.push(caseResult);
  }

  // Compute latency statistics
  latencies.sort((a, b) => a - b);
  const pct = (p: number): number => latencies[Math.floor(latencies.length * p)] ?? 0;
  result.latencyP50 = pct(0.5);
  result.latencyP95 = pct(0.95);
  result.latencyP99 = pct(0.99);
  result.avgTokens = cases.length > 0 ? Math.round(totalTokens / cases.length) : 0;
  result.jsonParseRate =
    cases.length > 0 ? Math.round((jsonParseSuccess / cases.length) * 100) : 0;
  result.fieldAccuracy =
    totalFields > 0 ? Math.round((presentFields / totalFields) * 100) : 0;
  result.groundTruthAccuracy =
    groundTruthChecked > 0 ? Math.round((groundTruthMatched / groundTruthChecked) * 100) : 0;

  for (const [cat, score] of Object.entries(categoryScores)) {
    result.detailedScores[cat] = Math.round((score.pass / score.total) * 100);
  }

  return result;
}

// ─── Report Generator ────────────────────────────────────────

function generateRecommendations(results: EvalResult[]): string[] {
  const recs: string[] = [];

  const best = results.reduce((a, b) => (a.passed > b.passed ? a : b), results[0]);
  if (best) {
    recs.push(`Best overall accuracy: ${best.model} (${best.passed}/${best.totalCases} passed)`);
  }

  // Check JSON parse rates
  for (const r of results) {
    if (r.jsonParseRate < 80) {
      recs.push(
        `${r.model} has low JSON parse rate (${r.jsonParseRate}%) — consider fine-tuning with more structured output examples`,
      );
    }
  }

  // Check latency
  for (const r of results) {
    if (r.latencyP95 > 5000) {
      recs.push(`${r.model} has high P95 latency (${r.latencyP95}ms) — consider caching or a faster provider`);
    }
  }

  // Check ground truth
  for (const r of results) {
    if (r.groundTruthAccuracy < 70) {
      recs.push(
        `${r.model} has low ground truth accuracy (${r.groundTruthAccuracy}%) — may need domain-specific fine-tuning`,
      );
    }
  }

  // Fine-tuned model advantage
  const ftModels = results.filter((r) => r.model.startsWith("crypto-vision"));
  const baseModels = results.filter((r) => !r.model.startsWith("crypto-vision"));
  if (ftModels.length > 0 && baseModels.length > 0) {
    const ftBest = ftModels.reduce((a, b) => (a.passed > b.passed ? a : b));
    const baseBest = baseModels.reduce((a, b) => (a.passed > b.passed ? a : b));
    if (ftBest.passed > baseBest.passed) {
      recs.push(
        `Fine-tuned model outperforms best base model: ${ftBest.passed} vs ${baseBest.passed} passed cases`,
      );
    } else {
      recs.push(
        `Base model ${baseBest.model} still outperforms fine-tuned — consider more training data or different hyperparameters`,
      );
    }
  }

  return recs;
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  const allModels = getModelRegistry();

  // Filter models if specified
  const models =
    args.models.length > 0
      ? allModels.filter((m) => args.models.some((f) => m.id.includes(f) || m.provider.includes(f)))
      : allModels;

  if (models.length === 0) {
    console.error("No models matched the filter. Available:", allModels.map((m) => m.id).join(", "));
    process.exit(1);
  }

  // Filter eval cases if category specified
  const cases =
    args.category === "all" ? EVAL_CASES : EVAL_CASES.filter((c) => c.category === args.category);

  console.log("=== Crypto Vision Model Evaluation ===\n");
  console.log(`Models: ${models.map((m) => m.displayName).join(", ")}`);
  console.log(`Cases: ${cases.length} (${args.category})`);
  console.log(`Temperature: ${args.temperature}`);
  console.log(`Max retries: ${args.maxRetries}`);
  console.log();

  const allResults: EvalResult[] = [];

  for (const model of models) {
    console.log(`━━━ Evaluating: ${model.displayName} (${model.provider}) ━━━`);
    const result = await evaluateModel(
      model.id,
      model.provider,
      cases,
      args.temperature,
      args.maxRetries,
      args.verbose,
    );
    allResults.push(result);

    console.log(`  Pass: ${result.passed}/${result.totalCases} (${Math.round((result.passed / result.totalCases) * 100)}%)`);
    console.log(`  Errors: ${result.errors}`);
    console.log(`  JSON Parse Rate: ${result.jsonParseRate}%`);
    console.log(`  Field Accuracy: ${result.fieldAccuracy}%`);
    console.log(`  Ground Truth: ${result.groundTruthAccuracy}%`);
    console.log(`  Latency P50/P95/P99: ${result.latencyP50}ms / ${result.latencyP95}ms / ${result.latencyP99}ms`);
    console.log(`  Avg Tokens: ${result.avgTokens}`);
    console.log(`  Per-category: ${JSON.stringify(result.detailedScores)}`);
    console.log();
  }

  // Determine winners
  const winner = allResults.reduce((a, b) => (a.passed > b.passed ? a : b), allResults[0]);

  const categories = [...new Set(cases.map((c) => c.category))] as EvalCategory[];
  const categoryWinners: Record<string, string> = {};
  for (const cat of categories) {
    let bestScore = -1;
    let bestModel = "";
    for (const r of allResults) {
      const score = r.detailedScores[cat] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestModel = r.model;
      }
    }
    categoryWinners[cat] = bestModel;
  }

  // Generate report
  const report: ComparisonReport = {
    evaluatedAt: new Date().toISOString(),
    evalCaseCount: cases.length,
    categories,
    models: allResults,
    winner: winner?.model ?? "none",
    categoryWinners,
    recommendations: generateRecommendations(allResults),
  };

  // Write report
  const outputDir = resolve(process.cwd(), args.output, "..");
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = resolve(process.cwd(), args.output);
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log("═══════════════════════════════════════");
  console.log("COMPARISON SUMMARY");
  console.log("═══════════════════════════════════════\n");

  // Table header
  const modelNames = allResults.map((r) => r.model.padEnd(25));
  console.log(`${"Metric".padEnd(22)} ${modelNames.join(" ")}`);
  console.log("─".repeat(22 + modelNames.length * 26));

  const metrics: Array<[string, (r: EvalResult) => string]> = [
    ["Pass Rate", (r) => `${Math.round((r.passed / r.totalCases) * 100)}%`],
    ["JSON Parse", (r) => `${r.jsonParseRate}%`],
    ["Field Accuracy", (r) => `${r.fieldAccuracy}%`],
    ["Ground Truth", (r) => `${r.groundTruthAccuracy}%`],
    ["Latency P50", (r) => `${r.latencyP50}ms`],
    ["Latency P95", (r) => `${r.latencyP95}ms`],
    ["Avg Tokens", (r) => `${r.avgTokens}`],
  ];

  for (const [label, fn] of metrics) {
    const values = allResults.map((r) => fn(r).padEnd(25));
    console.log(`${label.padEnd(22)} ${values.join(" ")}`);
  }

  console.log();
  console.log(`🏆 Overall Winner: ${winner?.model}`);
  console.log(`\nPer-category winners:`);
  for (const [cat, model] of Object.entries(categoryWinners)) {
    console.log(`  ${cat}: ${model}`);
  }

  console.log(`\nRecommendations:`);
  for (const rec of report.recommendations) {
    console.log(`  • ${rec}`);
  }

  console.log(`\nReport saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
