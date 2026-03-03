/**
 * Crypto Vision — Training Data Generation
 *
 * Generates high-quality supervised fine-tuning datasets from real API interactions.
 * Produces JSONL files compatible with Gemini fine-tuning on Vertex AI.
 *
 * Categories:
 *   - Sentiment analysis (per-coin)
 *   - Daily market digest
 *   - Trading signal generation
 *   - DeFi risk assessment
 *   - Yield opportunity analysis
 *   - Whale activity interpretation
 *   - Market narrative detection
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import {
  getCoins,
  getCoinDetail,
  getTrending,
  getGlobal,
  getMarketChart,
  type CoinMarket,
} from "../../src/sources/coingecko.js";
import { getFearGreedIndex } from "../../src/sources/alternative.js";
import {
  getProtocols,
  getYieldPools,
  getFeesRevenue,
  getDexVolumes,
  getChainsTVL,
  getHacks,
  getLiquidations,
} from "../../src/sources/defillama.js";
import { aiComplete } from "../../src/lib/ai.js";
import { appendFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";

// ─── Types ───────────────────────────────────────────────────

interface TrainingPair {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

interface GenerationStats {
  category: string;
  generated: number;
  failed: number;
  startedAt: number;
  durationMs?: number;
}

// ─── Constants ───────────────────────────────────────────────

const DATA_DIR = resolve(process.cwd(), "data/training");

const SYSTEM_PROMPTS: Record<string, string> = {
  sentiment: `You are the world's leading crypto market analyst. You provide precise, data-backed analysis with specific numbers. You identify sentiment accurately from market data, on-chain metrics, and news context. Always respond in valid JSON.`,

  digest: `You are a senior crypto market strategist producing institutional-grade daily briefings. You synthesize global market data, DeFi metrics, trending tokens, and yield opportunities into actionable insights. Always respond in valid JSON.`,

  signals: `You are an expert quantitative crypto trader. You analyze price action, volume patterns, and market structure to generate precise trading signals with entry, target, and stop-loss levels. Always respond in valid JSON.`,

  risk: `You are a DeFi security researcher and risk analyst. You evaluate protocol risk based on TVL, audit history, governance structure, smart contract complexity, and historical incidents. Always respond in valid JSON.`,

  yield: `You are a DeFi yield strategist. You analyze lending rates, LP yields, staking returns, and farming opportunities across chains. You factor in impermanent loss, smart contract risk, and sustainability. Always respond in valid JSON.`,

  whale: `You are a blockchain intelligence analyst specializing in whale activity and large transaction patterns. You interpret on-chain flows to identify accumulation, distribution, and institutional positioning. Always respond in valid JSON.`,

  narrative: `You are a crypto market narrative analyst. You identify emerging themes, sector rotations, and momentum shifts in the crypto market by synthesizing market data, social signals, and on-chain metrics. Always respond in valid JSON.`,
};

const TOP_COINS = [
  "bitcoin", "ethereum", "solana", "binancecoin", "cardano", "avalanche-2",
  "polkadot", "chainlink", "matic-network", "uniswap", "aave", "maker",
  "lido-dao", "arbitrum", "optimism", "sui", "aptos", "near",
  "cosmos", "the-open-network", "dogecoin", "shiba-inu", "pepe",
  "bonk", "render-token", "injective-protocol", "celestia", "sei-network",
  "starknet", "jupiter-exchange-solana",
];

// ─── Helpers ─────────────────────────────────────────────────

function appendPair(file: string, pair: TrainingPair): void {
  appendFileSync(resolve(DATA_DIR, file), JSON.stringify(pair) + "\n");
}

function countExistingPairs(file: string): number {
  const path = resolve(DATA_DIR, file);
  if (!existsSync(path)) return 0;
  const content = readFileSync(path, "utf-8").trim();
  return content ? content.split("\n").length : 0;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "N/A";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function pct(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${n.toFixed(2)}%`;
}

// ─── Sentiment Pairs ─────────────────────────────────────────

async function generateSentimentPairs(): Promise<GenerationStats> {
  const stats: GenerationStats = { category: "sentiment", generated: 0, failed: 0, startedAt: Date.now() };
  const file = "sentiment-pairs.jsonl";

  console.log(`  Starting sentiment generation for ${TOP_COINS.length} coins...`);

  for (const coinId of TOP_COINS) {
    try {
      const [detail, trending, fearGreed] = await Promise.all([
        getCoinDetail(coinId),
        getTrending(),
        getFearGreedIndex(1),
      ]);

      const md = detail.market_data;
      const fg = fearGreed.data?.[0];

      const userPrompt = `Analyze the current sentiment for ${detail.name} (${detail.symbol.toUpperCase()}).

Market data:
- Price: ${formatNumber(md.current_price?.usd)}
- 24h change: ${pct(md.price_change_percentage_24h)}
- 7d change: ${pct(md.price_change_percentage_7d)}
- 30d change: ${pct(md.price_change_percentage_30d)}
- Market cap: ${formatNumber(md.market_cap?.usd)}
- Volume 24h: ${formatNumber(md.total_volume?.usd)}
- Circulating supply: ${md.circulating_supply?.toLocaleString() ?? "N/A"}
- Total supply: ${md.total_supply?.toLocaleString() ?? "N/A"}
- Fear & Greed Index: ${fg?.value ?? "N/A"} (${fg?.value_classification ?? "N/A"})
- Trending coins: ${trending.coins?.slice(0, 5).map((t) => t.item?.name).join(", ") ?? "N/A"}

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

      const { text } = await aiComplete(SYSTEM_PROMPTS.sentiment, userPrompt, {
        temperature: 0.2,
        maxTokens: 1000,
      });

      // Validate the response contains parseable JSON before saving
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      JSON.parse(jsonMatch[0]); // Validates structure

      const pair: TrainingPair = {
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.sentiment },
          { role: "user", content: userPrompt },
          { role: "assistant", content: text },
        ],
      };

      appendPair(file, pair);
      stats.generated++;
      console.log(`    ✓ ${coinId} (${stats.generated}/${TOP_COINS.length})`);

      // Rate limit respect
      await sleep(2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ ${coinId}: ${msg}`);
      stats.failed++;
    }
  }

  stats.durationMs = Date.now() - stats.startedAt;
  return stats;
}

// ─── Digest Pairs ────────────────────────────────────────────

async function generateDigestPairs(iterations: number): Promise<GenerationStats> {
  const stats: GenerationStats = { category: "digest", generated: 0, failed: 0, startedAt: Date.now() };
  const file = "digest-pairs.jsonl";

  console.log(`  Starting digest generation (${iterations} iterations)...`);

  for (let i = 0; i < iterations; i++) {
    try {
      const [global, trending, fearGreedWeek, topCoins, defiProtos, yieldsData, dexVols, chains] = await Promise.all([
        getGlobal(),
        getTrending(),
        getFearGreedIndex(7),
        getCoins({ perPage: 20 }),
        getProtocols(),
        getYieldPools(),
        getDexVolumes(),
        getChainsTVL(),
      ]);

      // Filter and sort DeFi protocols by TVL
      const topProtocols = defiProtos
        .filter((p) => p.tvl > 0)
        .sort((a, b) => b.tvl - a.tvl)
        .slice(0, 20);

      // Filter yields
      const topYields = yieldsData.data
        .filter((y) => y.tvlUsd >= 1_000_000 && y.apy > 0)
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 20);

      // Top chains by TVL
      const topChains = chains
        .filter((c) => c.tvl > 0)
        .sort((a, b) => b.tvl - a.tvl)
        .slice(0, 10);

      const globalData = global.data;

      const userPrompt = `Generate a comprehensive daily crypto market digest.

Global Market:
- Total Market Cap: ${formatNumber(globalData.total_market_cap?.usd)}
- 24h Market Cap Change: ${pct(globalData.market_cap_change_percentage_24h_usd)}
- Total 24h Volume: ${formatNumber(globalData.total_volume?.usd)}
- BTC Dominance: ${pct(globalData.market_cap_percentage?.btc)}
- ETH Dominance: ${pct(globalData.market_cap_percentage?.eth)}
- Active Cryptocurrencies: ${globalData.active_cryptocurrencies?.toLocaleString()}

Fear & Greed (7-day):
${fearGreedWeek.data?.map((d) => `  - ${d.value} (${d.value_classification}) @ ${new Date(Number(d.timestamp) * 1000).toISOString().split("T")[0]}`).join("\n") ?? "N/A"}

Top 20 Coins by Market Cap:
${topCoins.map((c) => `- ${c.name} (${c.symbol.toUpperCase()}): ${formatNumber(c.current_price)}, 24h: ${pct(c.price_change_percentage_24h)}, MCap: ${formatNumber(c.market_cap)}`).join("\n")}

Trending: ${trending.coins?.map((t) => t.item?.name).join(", ") ?? "N/A"}

Top DeFi Protocols by TVL:
${topProtocols.slice(0, 10).map((p) => `- ${p.name}: TVL ${formatNumber(p.tvl)}, 24h: ${pct(p.change_1d)}, 7d: ${pct(p.change_7d)}`).join("\n")}

Top Chains by TVL:
${topChains.map((c) => `- ${c.name}: TVL ${formatNumber(c.tvl)}`).join("\n")}

Top DEX Volumes:
${dexVols.protocols?.slice(0, 5).map((d) => `- ${d.name}: 24h Volume ${formatNumber(d.total24h)}, 7d ${formatNumber(d.total7d)}`).join("\n") ?? "N/A"}

Top Yield Opportunities (TVL > $1M):
${topYields.slice(0, 10).map((y) => `- ${y.symbol} on ${y.project} (${y.chain}): ${y.apy.toFixed(2)}% APY, TVL: ${formatNumber(y.tvlUsd)}, Stablecoin: ${y.stablecoin}, IL Risk: ${y.ilRisk}`).join("\n")}

Respond in JSON:
{
  "headline": "single line market summary",
  "marketOverview": "paragraph summarizing today's market",
  "topMovers": [{"name": "", "change": "", "why": ""}],
  "defiHighlights": ["highlight1", "highlight2"],
  "yieldOpportunities": [{"pool": "", "apy": "", "risk": ""}],
  "chainActivity": [{"chain": "", "tvl": "", "trend": ""}],
  "narratives": ["narrative1", "narrative2"],
  "outlook": "paragraph with short-term market outlook"
}`;

      const { text } = await aiComplete(SYSTEM_PROMPTS.digest, userPrompt, {
        temperature: 0.3,
        maxTokens: 2000,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      JSON.parse(jsonMatch[0]);

      appendPair(file, {
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.digest },
          { role: "user", content: userPrompt },
          { role: "assistant", content: text },
        ],
      });

      stats.generated++;
      console.log(`    ✓ Digest ${i + 1}/${iterations} (${stats.generated} total)`);

      await sleep(5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ Digest ${i + 1}: ${msg}`);
      stats.failed++;
    }
  }

  stats.durationMs = Date.now() - stats.startedAt;
  return stats;
}

// ─── Signal Pairs ────────────────────────────────────────────

async function generateSignalPairs(): Promise<GenerationStats> {
  const stats: GenerationStats = { category: "signals", generated: 0, failed: 0, startedAt: Date.now() };
  const file = "signals-pairs.jsonl";

  const coins = await getCoins({ perPage: 50 });
  console.log(`  Starting signal generation for ${coins.length} coins...`);

  for (const coin of coins) {
    try {
      const chartData = await getMarketChart(coin.id, 30, "daily").catch(() => null);
      if (!chartData) {
        stats.failed++;
        continue;
      }

      const prices = chartData.prices?.map((p) => p[1]) ?? [];
      const volumes = chartData.total_volumes?.map((v) => v[1]) ?? [];

      if (prices.length < 10) {
        stats.failed++;
        continue;
      }

      const userPrompt = `Generate a trading signal analysis for ${coin.name} (${coin.symbol.toUpperCase()}).

Current Price: ${formatNumber(coin.current_price)}
Market Cap Rank: #${coin.market_cap_rank}
24h Volume: ${formatNumber(coin.total_volume)}
24h Change: ${pct(coin.price_change_percentage_24h)}
7d Change: ${pct(coin.price_change_percentage_7d_in_currency)}
30d Price Series (daily close): [${prices.slice(-30).map((p) => p.toFixed(2)).join(", ")}]
30d Volume Series (daily): [${volumes.slice(-30).map((v) => Math.round(v)).join(", ")}]

Technical Context:
- Price range (30d): ${formatNumber(Math.min(...prices))} – ${formatNumber(Math.max(...prices))}
- Current vs 30d average: ${((coin.current_price / (prices.reduce((a, b) => a + b, 0) / prices.length) - 1) * 100).toFixed(2)}%
- Volume trend: ${volumes.length >= 2 ? (volumes[volumes.length - 1] > volumes[volumes.length - 2] ? "increasing" : "decreasing") : "unknown"}

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

      const { text } = await aiComplete(SYSTEM_PROMPTS.signals, userPrompt, {
        temperature: 0.2,
        maxTokens: 1200,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      JSON.parse(jsonMatch[0]);

      appendPair(file, {
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.signals },
          { role: "user", content: userPrompt },
          { role: "assistant", content: text },
        ],
      });

      stats.generated++;
      console.log(`    ✓ ${coin.symbol.toUpperCase()} (${stats.generated}/${coins.length})`);

      await sleep(3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ ${coin.symbol}: ${msg}`);
      stats.failed++;
    }
  }

  stats.durationMs = Date.now() - stats.startedAt;
  return stats;
}

// ─── Risk Assessment Pairs ───────────────────────────────────

async function generateRiskPairs(): Promise<GenerationStats> {
  const stats: GenerationStats = { category: "risk", generated: 0, failed: 0, startedAt: Date.now() };
  const file = "risk-pairs.jsonl";

  const [protocols, hacks] = await Promise.all([
    getProtocols(),
    getHacks().catch(() => [] as Array<{ name: string; amount: number; date: number; classification: string }>),
  ]);

  const topProtocols = protocols
    .filter((p) => p.tvl > 10_000_000)
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 40);

  console.log(`  Starting risk assessment generation for ${topProtocols.length} protocols...`);

  // Build a hack lookup for context
  const hacksByName = new Map<string, Array<{ amount: number; date: number; classification: string }>>();
  if (Array.isArray(hacks)) {
    for (const hack of hacks) {
      const existing = hacksByName.get(hack.name.toLowerCase()) ?? [];
      existing.push({ amount: hack.amount, date: hack.date, classification: hack.classification });
      hacksByName.set(hack.name.toLowerCase(), existing);
    }
  }

  for (const proto of topProtocols) {
    try {
      const protoHacks = hacksByName.get(proto.name.toLowerCase()) ?? [];
      const mcapToTvl = proto.mcap ? (proto.mcap / proto.tvl).toFixed(2) : "N/A";

      const userPrompt = `Assess the DeFi risk for ${proto.name}.

Protocol Details:
- Category: ${proto.category}
- TVL: ${formatNumber(proto.tvl)}
- Chains: ${proto.chains?.join(", ") ?? "N/A"}
- Token: ${proto.symbol || "N/A"}
- Market Cap / TVL Ratio: ${mcapToTvl}
- 1h TVL Change: ${pct(proto.change_1h)}
- 24h TVL Change: ${pct(proto.change_1d)}
- 7d TVL Change: ${pct(proto.change_7d)}
- Website: ${proto.url || "N/A"}
${protoHacks.length > 0 ? `\nHistorical Security Incidents:\n${protoHacks.map((h) => `- ${new Date(h.date * 1000).toISOString().split("T")[0]}: $${h.amount?.toLocaleString()} (${h.classification})`).join("\n")}` : "\nNo known security incidents."}

Respond in JSON:
{
  "riskScore": 0-100,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "overallAssessment": "paragraph",
  "factors": {
    "smartContractRisk": { "score": 0-100, "detail": "" },
    "protocolRisk": { "score": 0-100, "detail": "" },
    "marketRisk": { "score": 0-100, "detail": "" },
    "counterpartyRisk": { "score": 0-100, "detail": "" },
    "liquidityRisk": { "score": 0-100, "detail": "" }
  },
  "recommendations": ["action1", "action2"],
  "maxRecommendedExposure": "percentage of portfolio"
}`;

      const { text } = await aiComplete(SYSTEM_PROMPTS.risk, userPrompt, {
        temperature: 0.2,
        maxTokens: 1500,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      JSON.parse(jsonMatch[0]);

      appendPair(file, {
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.risk },
          { role: "user", content: userPrompt },
          { role: "assistant", content: text },
        ],
      });

      stats.generated++;
      console.log(`    ✓ ${proto.name} (${stats.generated}/${topProtocols.length})`);
      await sleep(2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ ${proto.name}: ${msg}`);
      stats.failed++;
    }
  }

  stats.durationMs = Date.now() - stats.startedAt;
  return stats;
}

// ─── Yield Analysis Pairs ────────────────────────────────────

async function generateYieldPairs(): Promise<GenerationStats> {
  const stats: GenerationStats = { category: "yield", generated: 0, failed: 0, startedAt: Date.now() };
  const file = "yield-pairs.jsonl";

  const [yieldsData, chains] = await Promise.all([
    getYieldPools(),
    getChainsTVL(),
  ]);

  // Group yields by chain for varied prompts
  const chainMap = new Map<string, typeof yieldsData.data>();
  for (const pool of yieldsData.data) {
    if (pool.tvlUsd < 500_000 || pool.apy <= 0) continue;
    const existing = chainMap.get(pool.chain) ?? [];
    existing.push(pool);
    chainMap.set(pool.chain, existing);
  }

  const topChainNames = chains
    .filter((c) => c.tvl > 100_000_000)
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 15)
    .map((c) => c.name);

  console.log(`  Starting yield analysis generation for ${topChainNames.length} chains...`);

  for (const chainName of topChainNames) {
    try {
      const chainPools = (chainMap.get(chainName) ?? [])
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 15);

      if (chainPools.length < 3) continue;

      const userPrompt = `Analyze yield opportunities on ${chainName}.

Available Pools (sorted by APY):
${chainPools.map((y) => `- ${y.symbol} on ${y.project}: ${y.apy.toFixed(2)}% APY (base: ${y.apyBase?.toFixed(2) ?? "N/A"}%, reward: ${y.apyReward?.toFixed(2) ?? "N/A"}%), TVL: ${formatNumber(y.tvlUsd)}, Stablecoin: ${y.stablecoin}, IL Risk: ${y.ilRisk}`).join("\n")}

Respond in JSON:
{
  "chain": "${chainName}",
  "overallAssessment": "paragraph about yield environment on this chain",
  "topPicks": [
    {
      "pool": "",
      "project": "",
      "apy": 0,
      "risk": "low" | "medium" | "high",
      "suitableFor": "conservative" | "balanced" | "aggressive",
      "reasoning": ""
    }
  ],
  "stablecoinYields": {
    "bestOption": "",
    "apy": 0,
    "risk": ""
  },
  "warnings": ["warning1", "warning2"],
  "strategy": "recommended overall approach for this chain"
}`;

      const { text } = await aiComplete(SYSTEM_PROMPTS.yield, userPrompt, {
        temperature: 0.25,
        maxTokens: 1500,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      JSON.parse(jsonMatch[0]);

      appendPair(file, {
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.yield },
          { role: "user", content: userPrompt },
          { role: "assistant", content: text },
        ],
      });

      stats.generated++;
      console.log(`    ✓ ${chainName} (${stats.generated}/${topChainNames.length})`);
      await sleep(3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ ${chainName}: ${msg}`);
      stats.failed++;
    }
  }

  stats.durationMs = Date.now() - stats.startedAt;
  return stats;
}

// ─── Whale Activity Pairs ────────────────────────────────────

async function generateWhalePairs(): Promise<GenerationStats> {
  const stats: GenerationStats = { category: "whale", generated: 0, failed: 0, startedAt: Date.now() };
  const file = "whale-pairs.jsonl";

  const [topCoins, liquidations] = await Promise.all([
    getCoins({ perPage: 30 }),
    getLiquidations().catch(() => [] as Array<{ symbol: string; openInterest: number; liquidations24h: number }>),
  ]);

  console.log(`  Starting whale activity generation for ${topCoins.length} coins...`);

  for (const coin of topCoins) {
    try {
      const chart = await getMarketChart(coin.id, 7, "daily").catch(() => null);
      const liq = Array.isArray(liquidations) ? liquidations.find((l) => l.symbol?.toLowerCase() === coin.symbol.toLowerCase()) : null;

      const prices = chart?.prices?.map((p) => p[1]) ?? [];
      const volumes = chart?.total_volumes?.map((v) => v[1]) ?? [];

      // Simulate whale metrics from volume/price data
      const avgVol = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
      const latestVol = volumes.length > 0 ? volumes[volumes.length - 1] : 0;
      const volSpike = avgVol > 0 ? ((latestVol - avgVol) / avgVol * 100) : 0;

      const userPrompt = `Analyze whale activity and large transaction patterns for ${coin.name} (${coin.symbol.toUpperCase()}).

Market Context:
- Price: ${formatNumber(coin.current_price)}
- Market Cap: ${formatNumber(coin.market_cap)}
- 24h Volume: ${formatNumber(coin.total_volume)}
- 24h Change: ${pct(coin.price_change_percentage_24h)}
- 7d Price Trend: [${prices.map((p) => p.toFixed(2)).join(", ")}]
- 7d Volume Trend: [${volumes.map((v) => Math.round(v)).join(", ")}]
- Volume vs 7d Average: ${volSpike >= 0 ? "+" : ""}${volSpike.toFixed(1)}%
${liq ? `- Open Interest: ${formatNumber(liq.openInterest)}\n- 24h Liquidations: ${formatNumber(liq.liquidations24h)}` : "- Liquidation data: N/A"}

Respond in JSON:
{
  "whaleActivity": "accumulation" | "distribution" | "neutral",
  "confidence": 0-100,
  "volumeAnalysis": {
    "trend": "increasing" | "decreasing" | "stable",
    "anomaly": true | false,
    "detail": ""
  },
  "flowEstimate": {
    "netFlow": "inflow" | "outflow" | "balanced",
    "magnitude": "large" | "moderate" | "small"
  },
  "institutionalSignals": ["signal1", "signal2"],
  "priceImpact": "expected short-term price impact",
  "interpretation": "paragraph explaining the whale activity pattern"
}`;

      const { text } = await aiComplete(SYSTEM_PROMPTS.whale, userPrompt, {
        temperature: 0.2,
        maxTokens: 1200,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      JSON.parse(jsonMatch[0]);

      appendPair(file, {
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.whale },
          { role: "user", content: userPrompt },
          { role: "assistant", content: text },
        ],
      });

      stats.generated++;
      console.log(`    ✓ ${coin.symbol.toUpperCase()} (${stats.generated}/${topCoins.length})`);
      await sleep(2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ ${coin.symbol}: ${msg}`);
      stats.failed++;
    }
  }

  stats.durationMs = Date.now() - stats.startedAt;
  return stats;
}

// ─── Narrative Detection Pairs ───────────────────────────────

async function generateNarrativePairs(iterations: number): Promise<GenerationStats> {
  const stats: GenerationStats = { category: "narrative", generated: 0, failed: 0, startedAt: Date.now() };
  const file = "narrative-pairs.jsonl";

  console.log(`  Starting narrative detection generation (${iterations} iterations)...`);

  for (let i = 0; i < iterations; i++) {
    try {
      const [topCoins, trending, dexVols, feesRev, chains, fearGreed] = await Promise.all([
        getCoins({ perPage: 50 }),
        getTrending(),
        getDexVolumes(),
        getFeesRevenue(),
        getChainsTVL(),
        getFearGreedIndex(7),
      ]);

      // Identify sector movers
      const bigMovers = topCoins
        .filter((c) => Math.abs(c.price_change_percentage_24h) > 5)
        .sort((a, b) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h))
        .slice(0, 10);

      const topFees = feesRev.protocols
        ?.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0))
        .slice(0, 10);

      const userPrompt = `Identify the dominant market narratives and sector rotations in the crypto market.

Market Sentiment:
- Fear & Greed (7-day): ${fearGreed.data?.map((d) => `${d.value} (${d.value_classification})`).join(" → ") ?? "N/A"}

Trending Coins: ${trending.coins?.map((t) => t.item?.name).join(", ") ?? "N/A"}

Big Movers (>5% 24h change):
${bigMovers.map((c) => `- ${c.name} (${c.symbol.toUpperCase()}): ${pct(c.price_change_percentage_24h)}, MCap: ${formatNumber(c.market_cap)}`).join("\n") || "No major movers"}

Top Chains by TVL:
${chains.sort((a, b) => b.tvl - a.tvl).slice(0, 10).map((c) => `- ${c.name}: ${formatNumber(c.tvl)}`).join("\n")}

Top DEX Volume:
${dexVols.protocols?.slice(0, 5).map((d) => `- ${d.name}: ${formatNumber(d.total24h)}, change: ${pct(d.change_1d)}`).join("\n") ?? "N/A"}

Top Fee-Generating Protocols:
${topFees?.slice(0, 5).map((f) => `- ${f.name}: ${formatNumber(f.total24h)}/day (${f.category})`).join("\n") ?? "N/A"}

Respond in JSON:
{
  "dominantNarratives": [
    {
      "name": "narrative name",
      "strength": 0-100,
      "description": "what's happening",
      "keyTokens": ["token1", "token2"],
      "phase": "emerging" | "accelerating" | "peaking" | "fading"
    }
  ],
  "sectorRotation": {
    "flowingInto": ["sector1", "sector2"],
    "flowingOutOf": ["sector3"],
    "detail": ""
  },
  "emergingThemes": ["theme1", "theme2"],
  "riskNarratives": ["risk1"],
  "weeklyOutlook": "paragraph"
}`;

      const { text } = await aiComplete(SYSTEM_PROMPTS.narrative, userPrompt, {
        temperature: 0.3,
        maxTokens: 1500,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      JSON.parse(jsonMatch[0]);

      appendPair(file, {
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.narrative },
          { role: "user", content: userPrompt },
          { role: "assistant", content: text },
        ],
      });

      stats.generated++;
      console.log(`    ✓ Narrative ${i + 1}/${iterations} (${stats.generated} total)`);
      await sleep(5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ Narrative ${i + 1}: ${msg}`);
      stats.failed++;
    }
  }

  stats.durationMs = Date.now() - stats.startedAt;
  return stats;
}

// ─── Main Runner ─────────────────────────────────────────────

async function main(): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true });

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║        Crypto Vision — Training Data Generation     ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const allStats: GenerationStats[] = [];

  // 1. Sentiment pairs
  console.log("[1/7] Generating sentiment analysis pairs...");
  const sentimentStats = await generateSentimentPairs();
  allStats.push(sentimentStats);
  console.log(`  → ${sentimentStats.generated} generated, ${sentimentStats.failed} failed (${((sentimentStats.durationMs ?? 0) / 1000).toFixed(0)}s)\n`);

  // 2. Digest pairs
  console.log("[2/7] Generating daily digest pairs...");
  const digestStats = await generateDigestPairs(50);
  allStats.push(digestStats);
  console.log(`  → ${digestStats.generated} generated, ${digestStats.failed} failed (${((digestStats.durationMs ?? 0) / 1000).toFixed(0)}s)\n`);

  // 3. Signal pairs
  console.log("[3/7] Generating trading signal pairs...");
  const signalStats = await generateSignalPairs();
  allStats.push(signalStats);
  console.log(`  → ${signalStats.generated} generated, ${signalStats.failed} failed (${((signalStats.durationMs ?? 0) / 1000).toFixed(0)}s)\n`);

  // 4. Risk assessment pairs
  console.log("[4/7] Generating DeFi risk assessment pairs...");
  const riskStats = await generateRiskPairs();
  allStats.push(riskStats);
  console.log(`  → ${riskStats.generated} generated, ${riskStats.failed} failed (${((riskStats.durationMs ?? 0) / 1000).toFixed(0)}s)\n`);

  // 5. Yield analysis pairs
  console.log("[5/7] Generating yield analysis pairs...");
  const yieldStats = await generateYieldPairs();
  allStats.push(yieldStats);
  console.log(`  → ${yieldStats.generated} generated, ${yieldStats.failed} failed (${((yieldStats.durationMs ?? 0) / 1000).toFixed(0)}s)\n`);

  // 6. Whale activity pairs
  console.log("[6/7] Generating whale activity pairs...");
  const whaleStats = await generateWhalePairs();
  allStats.push(whaleStats);
  console.log(`  → ${whaleStats.generated} generated, ${whaleStats.failed} failed (${((whaleStats.durationMs ?? 0) / 1000).toFixed(0)}s)\n`);

  // 7. Narrative detection pairs
  console.log("[7/7] Generating narrative detection pairs...");
  const narrativeStats = await generateNarrativePairs(30);
  allStats.push(narrativeStats);
  console.log(`  → ${narrativeStats.generated} generated, ${narrativeStats.failed} failed (${((narrativeStats.durationMs ?? 0) / 1000).toFixed(0)}s)\n`);

  // Summary
  const totalGenerated = allStats.reduce((sum, s) => sum + s.generated, 0);
  const totalFailed = allStats.reduce((sum, s) => sum + s.failed, 0);
  const totalDuration = allStats.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║           Training Data Generation Complete          ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Total Pairs Generated: ${String(totalGenerated).padStart(5)}                       ║`);
  console.log(`║  Total Failed:          ${String(totalFailed).padStart(5)}                       ║`);
  console.log(`║  Duration:              ${String((totalDuration / 1000).toFixed(0)).padStart(5)}s                      ║`);
  console.log("╠──────────────────────────────────────────────────────╣");
  for (const s of allStats) {
    const name = s.category.padEnd(12);
    console.log(`║  ${name}: ${String(s.generated).padStart(4)} ok, ${String(s.failed).padStart(3)} failed             ║`);
  }
  console.log("╠──────────────────────────────────────────────────────╣");
  console.log("║  Files:                                              ║");
  for (const s of allStats) {
    const existing = countExistingPairs(`${s.category}-pairs.jsonl`);
    console.log(`║    ${s.category}-pairs.jsonl: ${existing} pairs              ║`);
  }
  console.log("╚══════════════════════════════════════════════════════╝");
}

main().catch(console.error);
