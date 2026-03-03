# Prompt 04: Vertex AI Model Training & Evaluation

## Agent Identity & Rules

```
You are building fine-tuned AI models for Crypto Vision on Google Cloud Vertex AI.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- Every dollar spent must produce a permanent artifact (model weights, eval datasets, training pipelines)
- No mocks, no fakes, no stubs — real implementations only
```

## Objective

Fine-tune Gemini and Vertex AI models specifically for crypto analysis tasks. Build a comprehensive evaluation framework to measure model quality, then integrate the fine-tuned models into the existing AI pipeline (`src/lib/ai.ts`) as the highest-priority provider.

## Budget: $20k

- Gemini fine-tuning: ~$10/M input tokens, ~$20/M output tokens for training
- Vertex AI custom training: ~$2.50/hr (n1-standard-8), ~$7.50/hr (GPU)
- Evaluation: ~$2k for running eval suites across models
- Inference (fine-tuned): ~30-50% cheaper than base models

## Current State

- `src/lib/ai.ts` — Multi-provider AI client with cascade: Groq → Gemini → OpenAI → Anthropic → OpenRouter
- `src/routes/ai.ts` — 20+ AI endpoints (sentiment, digest, signals, compare, risk, yield, whale, narrative, etc.)
- 43 agent definitions in `agents/src/` with specialized system prompts
- All market data sources produce structured data that can be used as training context

## Deliverables

### 1. Training Data Generation (`scripts/training/`)

Generate high-quality supervised fine-tuning datasets from real API interactions:

```typescript
// scripts/training/generate-sentiment-data.ts
// Generates sentiment analysis training pairs from historical data

import * as cg from "../../src/sources/coingecko.js";
import * as alt from "../../src/sources/alternative.js";
import * as llama from "../../src/sources/defillama.js";
import { aiComplete } from "../../src/lib/ai.js";
import { appendFileSync, mkdirSync } from "fs";

interface TrainingPair {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

const SYSTEM_PROMPT = `You are the world's leading crypto market analyst. You provide precise, data-backed analysis with specific numbers. You identify sentiment accurately from market data, on-chain metrics, and news context. Always respond in valid JSON.`;

async function generateSentimentPairs(): Promise<void> {
  mkdirSync("data/training", { recursive: true });
  
  const TOP_COINS = [
    "bitcoin", "ethereum", "solana", "bnb", "cardano", "avalanche",
    "polkadot", "chainlink", "polygon", "uniswap", "aave", "maker",
    "lido-dao", "arbitrum", "optimism", "sui", "aptos", "near",
    "cosmos", "toncoin", "dogecoin", "shiba-inu", "pepe", "bonk",
    "render-token", "injective-protocol", "celestia", "sei-network",
    "starknet", "jupiter-exchange-solana"
  ];

  for (const coinId of TOP_COINS) {
    try {
      // Fetch real market data
      const [detail, trending, fearGreed] = await Promise.all([
        cg.getCoinDetail(coinId),
        cg.getTrending(),
        alt.getFearGreedIndex(1),
      ]);

      const md = detail.market_data;
      const fg = fearGreed.data?.[0];

      const userPrompt = `Analyze the current sentiment for ${detail.name} (${detail.symbol.toUpperCase()}).

Market data:
- Price: $${md.current_price?.usd}
- 24h change: ${md.price_change_percentage_24h?.toFixed(2)}%
- 7d change: ${md.price_change_percentage_7d?.toFixed(2)}%
- 30d change: ${md.price_change_percentage_30d?.toFixed(2)}%
- Market cap: $${md.market_cap?.usd?.toLocaleString()}
- Volume 24h: $${md.total_volume?.usd?.toLocaleString()}
- ATH: $${md.ath?.usd}, ATH change: ${md.ath_change_percentage?.usd?.toFixed(2)}%
- Fear & Greed Index: ${fg?.value || "N/A"} (${fg?.value_classification || "N/A"})

Respond in JSON:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "summary": "2-3 sentence analysis",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "outlook": "short_term_view",
  "riskLevel": "low" | "medium" | "high",
  "tradeAction": "buy" | "sell" | "hold"
}`;

      // Generate high-quality response using best available model
      const { text } = await aiComplete(SYSTEM_PROMPT, userPrompt, {
        temperature: 0.2,
        maxTokens: 1000,
      });

      const pair: TrainingPair = {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
          { role: "assistant", content: text },
        ],
      };

      appendFileSync(
        "data/training/sentiment-pairs.jsonl",
        JSON.stringify(pair) + "\n"
      );

      console.log(`Generated sentiment pair for ${coinId}`);
      
      // Rate limit respect
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`Failed for ${coinId}: ${err.message}`);
    }
  }
}

// Also generate pairs for:
// - digest (daily market summary)
// - signals (trading signal generation)
// - compare (coin comparison)
// - risk (DeFi protocol risk assessment)
// - yield (yield opportunity analysis)
// - whale (whale activity interpretation)
// - narrative (market narrative detection)

async function generateDigestPairs(): Promise<void> {
  // Fetch comprehensive market state
  const [global, trending, fearGreed, topCoins, defiProtos, yields] = await Promise.all([
    cg.getGlobal(),
    cg.getTrending(),
    alt.getFearGreedIndex(7),
    cg.getCoins({ perPage: 20 }),
    llama.getProtocols({ limit: 20 }),
    llama.getYields({ minTvl: 1000000, limit: 20 }),
  ]);

  const userPrompt = `Generate a comprehensive daily crypto market digest.

Global Market:
- Total Market Cap: ${JSON.stringify(global.data)}
- Fear & Greed (7-day): ${JSON.stringify(fearGreed.data)}

Top 20 Coins:
${topCoins.map(c => `- ${c.name} (${c.symbol}): $${c.current_price}, 24h: ${c.price_change_percentage_24h?.toFixed(2)}%`).join("\n")}

Trending: ${trending.coins?.map(t => t.item?.name).join(", ")}

Top DeFi Protocols:
${defiProtos.slice(0, 10).map(p => `- ${p.name}: TVL $${p.tvl?.toLocaleString()}`).join("\n")}

Top Yields:
${yields.slice(0, 10).map(y => `- ${y.symbol} on ${y.project}: ${y.apy?.toFixed(2)}% APY`).join("\n")}

Respond in JSON:
{
  "headline": "single line market summary",
  "marketOverview": "paragraph",
  "topMovers": [{"name": "", "change": "", "why": ""}],
  "defiHighlights": ["highlight1", "highlight2"],
  "yieldOpportunities": [{"pool": "", "apy": "", "risk": ""}],
  "outlook": "paragraph"
}`;

  const { text } = await aiComplete(SYSTEM_PROMPT, userPrompt, {
    temperature: 0.3,
    maxTokens: 2000,
  });

  const pair: TrainingPair = {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
      { role: "assistant", content: text },
    ],
  };

  appendFileSync("data/training/digest-pairs.jsonl", JSON.stringify(pair) + "\n");
}

async function generateSignalPairs(): Promise<void> {
  const coins = await cg.getCoins({ perPage: 50 });
  
  for (const coin of coins) {
    const chartData = await cg.getChart(coin.id, { days: 30, interval: "daily" }).catch(() => null);
    if (!chartData) continue;

    const prices = chartData.prices?.map((p: number[]) => p[1]) || [];
    const volumes = chartData.total_volumes?.map((v: number[]) => v[1]) || [];

    const userPrompt = `Generate a trading signal analysis for ${coin.name} (${coin.symbol.toUpperCase()}).

Current Price: $${coin.current_price}
Market Cap Rank: #${coin.market_cap_rank}
24h Volume: $${coin.total_volume?.toLocaleString()}
24h Change: ${coin.price_change_percentage_24h?.toFixed(2)}%
7d Change: ${coin.price_change_percentage_7d_in_currency?.toFixed(2)}%
30d Price Series (daily close): [${prices.slice(-30).map(p => p.toFixed(2)).join(", ")}]
30d Volume Series: [${volumes.slice(-30).map(v => Math.round(v)).join(", ")}]

Respond in JSON:
{
  "signal": "buy" | "sell" | "hold",
  "strength": 0-100,
  "timeframe": "short" | "medium" | "long",
  "entry": number | null,
  "target": number | null,
  "stopLoss": number | null,
  "technicals": {
    "trend": "up" | "down" | "sideways",
    "momentum": "strong" | "moderate" | "weak",
    "volumeTrend": "increasing" | "decreasing" | "stable",
    "support": number,
    "resistance": number
  },
  "reasoning": "analysis paragraph"
}`;

    const { text } = await aiComplete(SYSTEM_PROMPT, userPrompt, { temperature: 0.2 });

    appendFileSync("data/training/signals-pairs.jsonl", JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
        { role: "assistant", content: text },
      ],
    }) + "\n");

    await new Promise(r => setTimeout(r, 3000));
  }
}

// Main runner — generates all training data
async function main() {
  console.log("=== Generating Training Data ===\n");
  
  console.log("1/3: Sentiment pairs...");
  await generateSentimentPairs();
  
  console.log("2/3: Digest pairs...");
  for (let i = 0; i < 50; i++) {
    await generateDigestPairs();
    await new Promise(r => setTimeout(r, 5000));
  }
  
  console.log("3/3: Signal pairs...");
  await generateSignalPairs();
  
  console.log("\n=== Training Data Generation Complete ===");
}

main().catch(console.error);
```

### 2. Training Data Validator (`scripts/training/validate-data.ts`)

```typescript
// scripts/training/validate-data.ts
// Validates JSONL training files for Gemini fine-tuning format compliance

import { readFileSync } from "fs";

interface ValidationResult {
  file: string;
  totalPairs: number;
  validPairs: number;
  errors: Array<{ line: number; error: string }>;
  stats: {
    avgInputTokens: number;
    avgOutputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

function validateJSONL(filePath: string): ValidationResult {
  const lines = readFileSync(filePath, "utf-8").trim().split("\n");
  const result: ValidationResult = {
    file: filePath,
    totalPairs: lines.length,
    validPairs: 0,
    errors: [],
    stats: { avgInputTokens: 0, avgOutputTokens: 0, totalTokens: 0, estimatedCost: 0 },
  };

  let totalInput = 0, totalOutput = 0;

  for (let i = 0; i < lines.length; i++) {
    try {
      const pair = JSON.parse(lines[i]);
      
      // Validate structure
      if (!pair.messages || !Array.isArray(pair.messages)) {
        result.errors.push({ line: i + 1, error: "Missing 'messages' array" });
        continue;
      }
      
      if (pair.messages.length < 2) {
        result.errors.push({ line: i + 1, error: "Need at least 2 messages (user + assistant)" });
        continue;
      }

      const hasSystem = pair.messages.some((m: any) => m.role === "system");
      const hasUser = pair.messages.some((m: any) => m.role === "user");
      const hasAssistant = pair.messages.some((m: any) => m.role === "assistant");
      
      if (!hasUser || !hasAssistant) {
        result.errors.push({ line: i + 1, error: "Must have user + assistant messages" });
        continue;
      }

      // Validate JSON output parses correctly
      const assistantMsg = pair.messages.find((m: any) => m.role === "assistant");
      try {
        const jsonMatch = assistantMsg.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) JSON.parse(jsonMatch[0]);
      } catch {
        result.errors.push({ line: i + 1, error: "Assistant response contains invalid JSON" });
        continue;
      }

      // Count tokens (rough: 1 token ≈ 4 chars)
      const inputTokens = pair.messages
        .filter((m: any) => m.role !== "assistant")
        .reduce((sum: number, m: any) => sum + Math.ceil(m.content.length / 4), 0);
      const outputTokens = Math.ceil(assistantMsg.content.length / 4);
      
      totalInput += inputTokens;
      totalOutput += outputTokens;
      result.validPairs++;
    } catch (err: any) {
      result.errors.push({ line: i + 1, error: `Invalid JSON: ${err.message}` });
    }
  }

  result.stats = {
    avgInputTokens: Math.round(totalInput / result.validPairs) || 0,
    avgOutputTokens: Math.round(totalOutput / result.validPairs) || 0,
    totalTokens: totalInput + totalOutput,
    // Gemini fine-tuning cost: ~$10/M input + $20/M output tokens
    estimatedCost: (totalInput * 10 / 1_000_000) + (totalOutput * 20 / 1_000_000),
  };

  return result;
}

// Validate all training files
const files = [
  "data/training/sentiment-pairs.jsonl",
  "data/training/digest-pairs.jsonl",
  "data/training/signals-pairs.jsonl",
];

for (const file of files) {
  try {
    const result = validateJSONL(file);
    console.log(`\n${file}`);
    console.log(`  Valid: ${result.validPairs}/${result.totalPairs}`);
    console.log(`  Avg input tokens: ${result.stats.avgInputTokens}`);
    console.log(`  Avg output tokens: ${result.stats.avgOutputTokens}`);
    console.log(`  Total tokens: ${result.stats.totalTokens.toLocaleString()}`);
    console.log(`  Est. training cost: $${result.stats.estimatedCost.toFixed(2)}`);
    if (result.errors.length) {
      console.log(`  Errors:`);
      result.errors.slice(0, 5).forEach(e => console.log(`    Line ${e.line}: ${e.error}`));
    }
  } catch {
    console.log(`${file} — not found, skipping`);
  }
}
```

### 3. Gemini Fine-Tuning Pipeline (`scripts/training/finetune-gemini.ts`)

```typescript
// scripts/training/finetune-gemini.ts
// Fine-tune Gemini on Vertex AI for crypto-specific tasks

import { VertexAI } from "@google-cloud/vertexai";

const PROJECT_ID = process.env.GCP_PROJECT_ID!;
const REGION = process.env.GCP_REGION || "us-central1";

interface FineTuneConfig {
  displayName: string;
  baseModel: string;
  trainingDataFile: string;
  validationDataFile?: string;
  hyperParams: {
    epochCount: number;
    learningRateMultiplier: number;
    adapterSize: "1" | "4" | "8" | "16";
  };
}

const MODELS_TO_TRAIN: FineTuneConfig[] = [
  {
    displayName: "crypto-vision-sentiment-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "gs://crypto-vision-training/sentiment-pairs.jsonl",
    validationDataFile: "gs://crypto-vision-training/sentiment-eval.jsonl",
    hyperParams: {
      epochCount: 5,
      learningRateMultiplier: 1.0,
      adapterSize: "4",
    },
  },
  {
    displayName: "crypto-vision-signals-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "gs://crypto-vision-training/signals-pairs.jsonl",
    hyperParams: {
      epochCount: 3,
      learningRateMultiplier: 0.5,
      adapterSize: "4",
    },
  },
  {
    displayName: "crypto-vision-digest-v1",
    baseModel: "gemini-2.0-flash-001",
    trainingDataFile: "gs://crypto-vision-training/digest-pairs.jsonl",
    hyperParams: {
      epochCount: 5,
      learningRateMultiplier: 1.0,
      adapterSize: "8",
    },
  },
];

async function uploadTrainingData(localPath: string, gcsPath: string): Promise<void> {
  const { Storage } = await import("@google-cloud/storage");
  const storage = new Storage({ projectId: PROJECT_ID });
  
  const bucket = gcsPath.split("/")[2];
  const objectPath = gcsPath.split("/").slice(3).join("/");
  
  await storage.bucket(bucket).upload(localPath, {
    destination: objectPath,
    metadata: { contentType: "application/jsonl" },
  });
  
  console.log(`Uploaded ${localPath} → ${gcsPath}`);
}

async function createFineTuneJob(config: FineTuneConfig): Promise<string> {
  // Use Vertex AI Tuning API
  const { TuningServiceClient } = await import("@google-cloud/aiplatform");
  const client = new TuningServiceClient({
    apiEndpoint: `${REGION}-aiplatform.googleapis.com`,
  });

  const parent = `projects/${PROJECT_ID}/locations/${REGION}`;
  
  const [operation] = await client.createTuningJob({
    parent,
    tuningJob: {
      displayName: config.displayName,
      baseModel: config.baseModel,
      supervisedTuningSpec: {
        trainingDatasetUri: config.trainingDataFile,
        validationDatasetUri: config.validationDataFile,
        hyperParameters: {
          epochCount: config.hyperParams.epochCount,
          learningRateMultiplier: config.hyperParams.learningRateMultiplier,
          adapterSize: config.hyperParams.adapterSize,
        },
      },
    },
  });

  console.log(`Fine-tune job created: ${operation.name}`);
  return operation.name!;
}

async function main() {
  console.log("=== Gemini Fine-Tuning Pipeline ===\n");

  // 1. Upload training data to GCS
  console.log("Step 1: Uploading training data...");
  await uploadTrainingData(
    "data/training/sentiment-pairs.jsonl",
    "gs://crypto-vision-training/sentiment-pairs.jsonl"
  );
  await uploadTrainingData(
    "data/training/signals-pairs.jsonl",
    "gs://crypto-vision-training/signals-pairs.jsonl"
  );
  await uploadTrainingData(
    "data/training/digest-pairs.jsonl",
    "gs://crypto-vision-training/digest-pairs.jsonl"
  );

  // 2. Launch fine-tuning jobs
  console.log("\nStep 2: Creating fine-tune jobs...");
  const jobIds: string[] = [];
  for (const config of MODELS_TO_TRAIN) {
    const jobId = await createFineTuneJob(config);
    jobIds.push(jobId);
    console.log(`  ${config.displayName}: ${jobId}`);
  }

  // 3. Monitor progress
  console.log("\nStep 3: Jobs submitted. Monitor with:");
  for (const id of jobIds) {
    console.log(`  gcloud ai tuning-jobs describe ${id} --region=${REGION}`);
  }
}

main().catch(console.error);
```

### 4. Evaluation Framework (`scripts/training/eval-models.ts`)

```typescript
// scripts/training/eval-models.ts
// Evaluate fine-tuned models against base models on crypto-specific benchmarks

interface EvalCase {
  id: string;
  category: "sentiment" | "signals" | "digest" | "risk" | "general";
  input: string;
  expectedFields: string[];  // JSON fields that must be present
  validators: Record<string, (value: any) => boolean>;
  groundTruth?: Record<string, any>;  // For accuracy measurement
}

interface EvalResult {
  model: string;
  category: string;
  totalCases: number;
  passed: number;
  failed: number;
  latencyP50: number;
  latencyP99: number;
  avgTokens: number;
  jsonParseRate: number;   // % of responses that are valid JSON
  fieldAccuracy: number;   // % of expected fields present
  detailedScores: Record<string, number>;
}

const EVAL_CASES: EvalCase[] = [
  // Sentiment evaluation
  {
    id: "sentiment-btc-bull",
    category: "sentiment",
    input: `Analyze Bitcoin sentiment. Price: $95,000, 24h: +5.2%, 7d: +12.3%, Volume: $45B, Fear & Greed: 78 (Extreme Greed)`,
    expectedFields: ["sentiment", "confidence", "summary", "keyFactors", "outlook"],
    validators: {
      sentiment: (v) => ["bullish", "bearish", "neutral"].includes(v),
      confidence: (v) => typeof v === "number" && v >= 0 && v <= 100,
      keyFactors: (v) => Array.isArray(v) && v.length >= 2,
    },
    groundTruth: { sentiment: "bullish" },
  },
  {
    id: "sentiment-eth-bear",
    category: "sentiment",
    input: `Analyze Ethereum sentiment. Price: $2,800, 24h: -8.1%, 7d: -15.6%, Volume: $12B, Fear & Greed: 22 (Extreme Fear)`,
    expectedFields: ["sentiment", "confidence", "summary", "keyFactors", "outlook"],
    validators: {
      sentiment: (v) => ["bullish", "bearish", "neutral"].includes(v),
      confidence: (v) => typeof v === "number" && v >= 0 && v <= 100,
    },
    groundTruth: { sentiment: "bearish" },
  },
  // Signal evaluation
  {
    id: "signal-sol-breakout",
    category: "signals",
    input: `Trading signal for Solana. Price: $180, 30d: [120, 125, 130, 140, 145, 155, 160, 162, 158, 160, 165, 170, 172, 168, 170, 175, 178, 180, 178, 175, 172, 170, 175, 178, 180, 182, 185, 180, 178, 180], Volume increasing 20%.`,
    expectedFields: ["signal", "strength", "timeframe", "technicals", "reasoning"],
    validators: {
      signal: (v) => ["buy", "sell", "hold"].includes(v),
      strength: (v) => typeof v === "number" && v >= 0 && v <= 100,
      timeframe: (v) => ["short", "medium", "long"].includes(v),
    },
  },
  // DeFi risk evaluation
  {
    id: "risk-aave-v3",
    category: "risk",
    input: `Assess DeFi risk for Aave V3. TVL: $12B, Category: Lending, Chains: Ethereum+Arbitrum+Base+Polygon, Audited: Yes (20+ audits), Bug Bounty: $15M, Governance: Active (Snapshot + Seatbelt), Token: AAVE, mcap/tvl: 0.8`,
    expectedFields: ["riskScore", "riskLevel", "factors", "recommendation"],
    validators: {
      riskScore: (v) => typeof v === "number" && v >= 0 && v <= 100,
      riskLevel: (v) => ["low", "medium", "high", "critical"].includes(v),
    },
  },
  // General Q&A evaluation
  {
    id: "general-impermanent-loss",
    category: "general",
    input: `Explain impermanent loss in liquidity pools. When is it most severe?`,
    expectedFields: [],  // Free-form text OK
    validators: {},
  },
];

async function runEvaluation(modelId: string, providerName: string): Promise<EvalResult> {
  const { aiComplete } = await import("../../src/lib/ai.js");
  
  const results: EvalResult = {
    model: modelId,
    category: "all",
    totalCases: EVAL_CASES.length,
    passed: 0,
    failed: 0,
    latencyP50: 0,
    latencyP99: 0,
    avgTokens: 0,
    jsonParseRate: 0,
    fieldAccuracy: 0,
    detailedScores: {},
  };

  const latencies: number[] = [];
  let jsonParseSuccess = 0;
  let totalFields = 0, presentFields = 0;
  let totalTokens = 0;
  const categoryScores: Record<string, { pass: number; total: number }> = {};

  for (const evalCase of EVAL_CASES) {
    const start = Date.now();
    try {
      const { text, tokensUsed } = await aiComplete(
        "You are an expert crypto analyst. Respond in JSON when the output has structured fields.",
        evalCase.input,
        { temperature: 0.1, maxTokens: 1500 }
      );
      
      const latency = Date.now() - start;
      latencies.push(latency);
      totalTokens += tokensUsed || 0;

      // Try parsing JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let parsed: any = null;
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          jsonParseSuccess++;
        } catch { /* not valid JSON */ }
      }

      // Check expected fields
      let casePassed = true;
      for (const field of evalCase.expectedFields) {
        totalFields++;
        if (parsed && field in parsed) {
          presentFields++;
        } else {
          casePassed = false;
        }
      }

      // Run validators
      for (const [field, validator] of Object.entries(evalCase.validators)) {
        if (!parsed || !validator(parsed[field])) {
          casePassed = false;
        }
      }

      // Check ground truth
      if (evalCase.groundTruth && parsed) {
        for (const [key, expected] of Object.entries(evalCase.groundTruth)) {
          if (parsed[key] !== expected) casePassed = false;
        }
      }

      if (casePassed) results.passed++;
      else results.failed++;

      // Track per-category
      if (!categoryScores[evalCase.category]) {
        categoryScores[evalCase.category] = { pass: 0, total: 0 };
      }
      categoryScores[evalCase.category].total++;
      if (casePassed) categoryScores[evalCase.category].pass++;

    } catch (err: any) {
      results.failed++;
      console.error(`  FAIL [${evalCase.id}]: ${err.message}`);
    }
  }

  // Compute statistics
  latencies.sort((a, b) => a - b);
  results.latencyP50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  results.latencyP99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  results.avgTokens = Math.round(totalTokens / EVAL_CASES.length);
  results.jsonParseRate = Math.round((jsonParseSuccess / EVAL_CASES.length) * 100);
  results.fieldAccuracy = totalFields > 0 ? Math.round((presentFields / totalFields) * 100) : 0;
  
  for (const [cat, score] of Object.entries(categoryScores)) {
    results.detailedScores[cat] = Math.round((score.pass / score.total) * 100);
  }

  return results;
}

async function main() {
  console.log("=== Crypto Vision Model Evaluation ===\n");
  
  const models = [
    { id: "gemini-2.0-flash", provider: "gemini" },
    { id: "llama-3.3-70b-versatile", provider: "groq" },
    { id: "gpt-4o-mini", provider: "openai" },
    // Fine-tuned models (add after training):
    // { id: "crypto-vision-sentiment-v1", provider: "vertex-ft" },
    // { id: "crypto-vision-signals-v1", provider: "vertex-ft" },
  ];

  const allResults: EvalResult[] = [];
  
  for (const model of models) {
    console.log(`Evaluating: ${model.id}...`);
    const result = await runEvaluation(model.id, model.provider);
    allResults.push(result);
    
    console.log(`  Pass: ${result.passed}/${result.totalCases}`);
    console.log(`  JSON Parse Rate: ${result.jsonParseRate}%`);
    console.log(`  Field Accuracy: ${result.fieldAccuracy}%`);
    console.log(`  Latency P50/P99: ${result.latencyP50}ms / ${result.latencyP99}ms`);
    console.log(`  Per-category: ${JSON.stringify(result.detailedScores)}`);
    console.log();
  }

  // Write comparison report
  const report = {
    evaluatedAt: new Date().toISOString(),
    evalCases: EVAL_CASES.length,
    models: allResults,
    winner: allResults.reduce((best, r) => r.passed > best.passed ? r : best, allResults[0]).model,
  };
  
  const { writeFileSync } = await import("fs");
  writeFileSync("data/training/eval-report.json", JSON.stringify(report, null, 2));
  console.log("Report saved to data/training/eval-report.json");
}

main().catch(console.error);
```

### 5. Integration: Add Fine-Tuned Model to AI Provider Cascade

After fine-tuning completes, add the fine-tuned Gemini model as the highest-priority provider in `src/lib/ai.ts`:

```typescript
// Add to PROVIDERS array at position 0 (highest priority)
{
  name: "vertex-finetuned",
  envKey: "GCP_PROJECT_ID",  // Uses ADC, not API key
  url: "",  // Dynamic based on model
  model: "crypto-vision-sentiment-v1",  // Updated after training
  buildRequest: (key, system, user, maxTokens, temperature) => {
    const projectId = process.env.GCP_PROJECT_ID;
    const region = process.env.GCP_REGION || "us-central1";
    const endpoint = process.env.VERTEX_FINETUNED_ENDPOINT;
    
    return {
      url: `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/${endpoint}:predict`,
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,  // ADC token
        },
        body: {
          instances: [{
            content: `${system}\n\n${user}`,
          }],
          parameters: {
            maxOutputTokens: maxTokens,
            temperature,
          },
        },
      },
    };
  },
  extractText: (r) => r.predictions?.[0]?.content || "",
  extractUsage: () => undefined,
}
```

### 6. Continuous Training Pipeline

Create a Cloud Scheduler job that triggers weekly re-training:

```yaml
# infra/scheduler/retrain.yaml
name: retrain-weekly
schedule: "0 2 * * 0"  # Sunday 2 AM UTC
target:
  cloudRunJob:
    name: crypto-vision-retrain
    command: ["node", "dist/scripts/training/generate-sentiment-data.js"]
```

The retraining pipeline:
1. Generates new training pairs from the latest market data
2. Appends to existing training data (data grows over time)
3. Validates the new dataset
4. Submits a new fine-tuning job
5. Evaluates the new model against the previous version
6. Swaps to the new model only if eval scores improve

### 7. Terraform for Training Infrastructure (`infra/terraform/vertex.tf`)

```hcl
# Cloud Storage bucket for training data
resource "google_storage_bucket" "training" {
  name     = "${var.project_id}-crypto-vision-training"
  location = var.region
  
  lifecycle_rule {
    condition { age = 365 }
    action { type = "Delete" }
  }
  
  versioning { enabled = true }
}

# Service account for Vertex AI
resource "google_service_account" "vertex" {
  account_id   = "crypto-vision-vertex"
  display_name = "Crypto Vision Vertex AI"
}

resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.vertex.email}"
}

resource "google_project_iam_member" "vertex_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.vertex.email}"
}
```

## npm Dependencies to Add

```bash
npm install @google-cloud/vertexai @google-cloud/aiplatform @google-cloud/storage
```

## GCP APIs to Enable

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  cloudscheduler.googleapis.com \
  run.googleapis.com
```

## Validation

1. Training data generation produces ≥500 pairs across all categories
2. Validation passes with >95% valid pairs
3. Fine-tuning jobs submit successfully on Vertex AI
4. Eval framework runs across 3+ models and produces comparison report
5. Fine-tuned model scores higher than base model on crypto-specific tasks
6. JSON parse rate ≥95% for fine-tuned model
7. The integration into `src/lib/ai.ts` works with fallback cascade
8. `npx tsc --noEmit` passes
