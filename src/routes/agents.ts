/**
 * Crypto Vision — AI Agents Routes
 *
 * Exposes all 43 DeFi agents as API endpoints, each with a specialized
 * system prompt and optional live data enrichment.
 *
 * GET  /api/agents                     — List all available agents
 * GET  /api/agents/:id                 — Agent detail & metadata
 * POST /api/agents/:id/run             — Execute an agent task (AI + live data)
 * GET  /api/agents/categories          — List agent categories
 * GET  /api/agents/search              — Search agents
 * POST /api/agents/multi               — Ask multiple agents at once
 */

import { Hono } from "hono";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { aiComplete, isAIConfigured, getConfiguredProviders } from "../lib/ai.js";
import { cache } from "../lib/cache.js";
import { aiQueue, QueueFullError } from "../lib/queue.js";
import { log } from "../lib/logger.js";
import { ApiError } from "../lib/api-error.js";
import * as cg from "../sources/coingecko.js";
import * as llama from "../sources/defillama.js";
import * as alt from "../sources/alternative.js";
import { AgentRunSchema, AgentMultiSchema, validateBody } from "../lib/validation.js";

export const agentsRoutes = new Hono();

// ─── Agent Registry ──────────────────────────────────────────

interface AgentConfig {
  identifier: string;
  meta: {
    title: string;
    description: string;
    avatar: string;
    tags?: string[];
    category?: string;
  };
  config: {
    systemRole: string;
    openingMessage: string;
    openingQuestions: string[];
  };
  author: string;
  createdAt: string;
}

// Load all agent definitions at startup
const AGENTS_DIR = join(import.meta.dirname ?? ".", "../agents/src");
const AGENTS_MAP = new Map<string, AgentConfig>();

function loadAgents(): void {
  try {
    const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = readFileSync(join(AGENTS_DIR, file), "utf-8");
        const agent = JSON.parse(raw) as AgentConfig;
        AGENTS_MAP.set(agent.identifier, agent);
      } catch {
        log.warn({ file }, "Failed to load agent definition");
      }
    }
    log.info({ count: AGENTS_MAP.size }, "Agents loaded");
  } catch (err) {
    log.warn({ err }, "Failed to load agents directory");
  }
}

loadAgents();

// ─── Data Enrichment ─────────────────────────────────────────

type DataEnricher = () => Promise<string>;

/**
 * Map of agent categories to live data enrichment functions.
 * When a user chats with an agent, relevant live data is injected
 * into the prompt so the LLM has current market context.
 */
const DATA_ENRICHERS: Record<string, DataEnricher> = {
  market: async () => {
    const [global, fg, trending] = await Promise.all([
      cg.getGlobal().catch(() => null),
      alt.getFearGreedIndex(1).catch(() => ({ data: [] })),
      cg.getTrending().catch(() => ({ coins: [] })),
    ]);
    const g = global?.data;
    if (!g) return "";
    return `\n[LIVE MARKET DATA]
- Total Market Cap: $${(g.total_market_cap.usd / 1e12).toFixed(2)}T
- 24h Change: ${g.market_cap_change_percentage_24h_usd.toFixed(2)}%
- BTC Dominance: ${g.market_cap_percentage.btc.toFixed(1)}%
- Fear & Greed: ${fg.data[0]?.value || "N/A"} (${fg.data[0]?.value_classification || "N/A"})
- Trending: ${trending.coins.slice(0, 5).map((t) => t.item.name).join(", ")}`;
  },
  defi: async () => {
    const [protocols, yields] = await Promise.all([
      llama.getProtocols().catch(() => []),
      llama.getYieldPools().catch(() => ({ data: [] })),
    ]);
    const topProto = protocols.slice(0, 10);
    const topYields = yields.data
      .filter((y) => y.tvlUsd > 1_000_000)
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 5);
    return `\n[LIVE DEFI DATA]
- Top Protocols by TVL: ${topProto.map((p) => `${p.name}: $${(p.tvl / 1e9).toFixed(2)}B`).join(", ")}
- Top Yields: ${topYields.map((y) => `${y.symbol} on ${y.project}: ${y.apy.toFixed(1)}% APY`).join(", ")}`;
  },
  stablecoin: async () => {
    const { peggedAssets } = await llama.getStablecoins().catch(() => ({ peggedAssets: [] }));
    const top = peggedAssets.slice(0, 10);
    return `\n[LIVE STABLECOIN DATA]
- Top Stablecoins: ${top.map((s) => `${s.name} (${s.symbol})`).join(", ")}`;
  },
  bitcoin: async () => {
    const [fees, hashrate] = await Promise.all([
      alt.getBitcoinFees().catch(() => null),
      alt.getBitcoinHashrate().catch(() => null),
    ]);
    return `\n[LIVE BITCOIN DATA]
${fees ? `- Fees: fastest=${fees.fastestFee} sat/vB, hour=${fees.hourFee} sat/vB` : ""}
${hashrate ? `- Hashrate: ${hashrate.currentHashrate}, Difficulty: ${hashrate.currentDifficulty}` : ""}`;
  },
  news: async () => {
    const trending = await cg.getTrending().catch(() => ({ coins: [] }));
    return `\n[LIVE NEWS CONTEXT]
- Trending coins: ${trending.coins.slice(0, 5).map((t) => t.item.name).join(", ")}`;
  },
};

/**
 * Determine which enricher to use based on agent identifier.
 */
function getEnricherForAgent(agentId: string): DataEnricher | null {
  const id = agentId.toLowerCase();

  // Market/trading agents
  if (id.includes("whale") || id.includes("narrative") || id.includes("alpha") ||
      id.includes("portfolio") || id.includes("pump")) {
    return DATA_ENRICHERS.market;
  }

  // DeFi agents
  if (id.includes("defi") || id.includes("yield") || id.includes("liquidity") ||
      id.includes("protocol") || id.includes("dex") || id.includes("apy") ||
      id.includes("impermanent") || id.includes("liquidation") ||
      id.includes("governance") || id.includes("staking")) {
    return DATA_ENRICHERS.defi;
  }

  // Stablecoin agents
  if (id.includes("stablecoin") || id.includes("usds")) {
    return DATA_ENRICHERS.stablecoin;
  }

  // Bitcoin agents
  if (id.includes("bitcoin") || id.includes("mining")) {
    return DATA_ENRICHERS.bitcoin;
  }

  // News agents
  if (id.includes("news")) {
    return DATA_ENRICHERS.news;
  }

  // Default — general market data
  return DATA_ENRICHERS.market;
}

// ─── GET /api/agents ─────────────────────────────────────────

agentsRoutes.get("/", (c) => {
  const agents = Array.from(AGENTS_MAP.values()).map((a) => ({
    id: a.identifier,
    title: a.meta.title,
    description: a.meta.description,
    avatar: a.meta.avatar,
    tags: a.meta.tags || [],
    category: a.meta.category || categorizeAgent(a.identifier),
    openingQuestions: a.config.openingQuestions,
  }));

  return c.json({
    data: agents,
    count: agents.length,
    aiConfigured: isAIConfigured(),
    providers: getConfiguredProviders(),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/agents/categories ──────────────────────────────

agentsRoutes.get("/categories", (c) => {
  const categories = new Map<string, number>();
  for (const agent of AGENTS_MAP.values()) {
    const cat = agent.meta.category || categorizeAgent(agent.identifier);
    categories.set(cat, (categories.get(cat) || 0) + 1);
  }

  return c.json({
    data: Array.from(categories.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/agents/search ──────────────────────────────────

agentsRoutes.get("/search", (c) => {
  const q = (c.req.query("q") || "").toLowerCase();
  if (!q) return ApiError.missingParam(c, "q");

  const results = Array.from(AGENTS_MAP.values())
    .filter(
      (a) =>
        a.identifier.includes(q) ||
        a.meta.title.toLowerCase().includes(q) ||
        a.meta.description.toLowerCase().includes(q) ||
        (a.meta.tags || []).some((t) => t.toLowerCase().includes(q))
    )
    .map((a) => ({
      id: a.identifier,
      title: a.meta.title,
      description: a.meta.description,
      avatar: a.meta.avatar,
      category: a.meta.category || categorizeAgent(a.identifier),
    }));

  return c.json({
    data: results,
    count: results.length,
    query: q,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/agents/:id ────────────────────────────────────

agentsRoutes.get("/:id", (c) => {
  const agent = AGENTS_MAP.get(c.req.param("id"));
  if (!agent) return ApiError.notFound(c, `Agent '${c.req.param("id")}' not found`);

  return c.json({
    data: {
      id: agent.identifier,
      title: agent.meta.title,
      description: agent.meta.description,
      avatar: agent.meta.avatar,
      tags: agent.meta.tags || [],
      category: agent.meta.category || categorizeAgent(agent.identifier),
      author: agent.author,
      createdAt: agent.createdAt,
      openingMessage: agent.config.openingMessage,
      openingQuestions: agent.config.openingQuestions,
      systemRolePreview: agent.config.systemRole.slice(0, 200) + "...",
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/agents/:id/run ───────────────────────────────

agentsRoutes.post("/:id/run", async (c) => {
  const agentId = c.req.param("id");
  const agent = AGENTS_MAP.get(agentId);
  if (!agent) return ApiError.notFound(c, `Agent '${agentId}' not found`);

  if (!isAIConfigured()) {
    return ApiError.serviceUnavailable(c, "No AI provider configured");
  }

  const parsed = await validateBody(c, AgentRunSchema);
  if (!parsed.success) return parsed.error;
  const body = parsed.data;

  // Build enriched prompt
  let liveData = "";
  if (body.enrich !== false) {
    const enricher = getEnricherForAgent(agentId);
    if (enricher) {
      try {
        liveData = await enricher();
      } catch {
        // Non-critical — continue without enrichment
      }
    }
  }

  const userPrompt = `${liveData}
${body.context ? `\nContext: ${body.context}` : ""}

User: ${body.message}`;

  try {
    const result = await aiQueue.execute(() =>
      aiComplete(agent.config.systemRole, userPrompt, {
        maxTokens: body.maxTokens || 1500,
        temperature: 0.4,
        cacheKey: undefined, // Don't cache agent runs — each task is unique
      })
    );

    return c.json({
      data: {
        agent: agentId,
        agentTitle: agent.meta.title,
        response: result.text,
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof QueueFullError) {
      return ApiError.serviceUnavailable(c, err.message);
    }
    log.error({ err, agentId }, "Agent run failed");
    return ApiError.aiError(c, `Agent ${agentId} failed`, (err as Error).message);
  }
});

// ─── POST /api/agents/multi ──────────────────────────────────

agentsRoutes.post("/multi", async (c) => {
  if (!isAIConfigured()) {
    return ApiError.serviceUnavailable(c, "No AI provider configured");
  }

  const parsed = await validateBody(c, AgentMultiSchema);
  if (!parsed.success) return parsed.error;
  const body = parsed.data;

  const agentIds = body.agents.slice(0, 5); // Max 5 agents at once
  const results = await Promise.allSettled(
    agentIds.map(async (agentId) => {
      const agent = AGENTS_MAP.get(agentId);
      if (!agent) throw new Error(`Agent '${agentId}' not found`);

      let liveData = "";
      const enricher = getEnricherForAgent(agentId);
      if (enricher) {
        try { liveData = await enricher(); } catch { /* non-critical */ }
      }

      const userPrompt = `${liveData}\n${body.context ? `Context: ${body.context}\n` : ""}User: ${body.message}`;

      const result = await aiQueue.execute(() =>
        aiComplete(agent.config.systemRole, userPrompt, {
          maxTokens: body.maxTokens || 1024,
          temperature: 0.4,
        })
      );

      return {
        agent: agentId,
        agentTitle: agent.meta.title,
        response: result.text,
        provider: result.provider,
        model: result.model,
        tokensUsed: result.tokensUsed,
      };
    })
  );

  return c.json({
    data: results.map((r, i) => {
      if (r.status === "fulfilled") {
        return { status: r.status, ...r.value };
      }
      return { status: r.status, agent: agentIds[i], error: (r.reason as Error).message };
    }),
    timestamp: new Date().toISOString(),
  });
});

// ─── Helpers ─────────────────────────────────────────────────

function categorizeAgent(id: string): string {
  if (id.includes("sperax") || id.includes("spa-") || id.includes("vespa") || id.includes("usds")) return "sperax";
  if (id.includes("yield") || id.includes("apy") || id.includes("staking")) return "yield";
  if (id.includes("defi") || id.includes("protocol") || id.includes("liquidity") || id.includes("dex")) return "defi";
  if (id.includes("risk") || id.includes("security") || id.includes("audit") || id.includes("insurance") || id.includes("liquidation") || id.includes("mev")) return "security";
  if (id.includes("news") || id.includes("narrative") || id.includes("alpha")) return "intelligence";
  if (id.includes("whale") || id.includes("portfolio") || id.includes("token-unlock")) return "trading";
  if (id.includes("bridge") || id.includes("layer2") || id.includes("gas")) return "infrastructure";
  if (id.includes("tax") || id.includes("onboarding") || id.includes("educator")) return "education";
  if (id.includes("stablecoin")) return "stablecoins";
  if (id.includes("governance") || id.includes("treasury")) return "governance";
  if (id.includes("nft")) return "nft";
  if (id.includes("pump")) return "meme";
  return "general";
}
