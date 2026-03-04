/**
 * Tests for lib/validation.ts — Zod schemas + validateBody/validateQuery/validateParam
 *
 * Uses a real Hono app to exercise validation end-to-end through HTTP requests.
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import {
  CoinIdSchema,
  HexAddressSchema,
  SearchQuerySchema,
  PositiveIntSchema,
  LimitSchema,
  DaysSchema,
  ChainSlugSchema,
  BitcoinAddressSchema,
  UrlSchema,
  PeriodSchema,
  TimeframeSchema,
  NumericIdSchema,
  ChainIdSchema,
  CoinIdListSchema,
  AskBodySchema,
  AgentRunSchema,
  AgentMultiSchema,
  OrchestrateSchema,
  GenerateKeySchema,
  PortfolioHoldingsSchema,
  AssetIdsSchema,
  RiskAnalysisSchema,
  AIChatSchema,
  AIAnalyzeSchema,
  AISummarizeSchema,
  AISentimentSchema,
  AIStrategySchema,
  AIExplainSchema,
  AIEmbedSchema,
  AICompareSchema,
  AIRiskAssessmentSchema,
  AIPortfolioReviewSchema,
  AgentComposeSchema,
  validateBody,
  validateQuery,
  validateParam,
} from "@/lib/validation.js";
import { z } from "zod";

// ─── Shared Primitives ──────────────────────────────────────

describe("CoinIdSchema", () => {
  it("accepts valid coin IDs (alphanumeric, hyphens, underscores)", () => {
    expect(CoinIdSchema.parse("bitcoin")).toBe("bitcoin");
    expect(CoinIdSchema.parse("ethereum")).toBe("ethereum");
    expect(CoinIdSchema.parse("avalanche-2")).toBe("avalanche-2");
    expect(CoinIdSchema.parse("wrapped_bitcoin")).toBe("wrapped_bitcoin");
  });

  it("rejects empty strings", () => {
    expect(() => CoinIdSchema.parse("")).toThrow();
  });

  it("rejects strings with special characters", () => {
    expect(() => CoinIdSchema.parse("../etc/passwd")).toThrow();
    expect(() => CoinIdSchema.parse("coin<script>")).toThrow();
    expect(() => CoinIdSchema.parse("bit coin")).toThrow();
  });

  it("rejects strings exceeding 128 characters", () => {
    expect(() => CoinIdSchema.parse("a".repeat(129))).toThrow();
  });
});

describe("HexAddressSchema", () => {
  it("accepts valid Ethereum addresses", () => {
    expect(HexAddressSchema.parse("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08")).toBe(
      "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08",
    );
    expect(HexAddressSchema.parse("0x0000000000000000000000000000000000000000")).toBe(
      "0x0000000000000000000000000000000000000000",
    );
  });

  it("rejects addresses without 0x prefix", () => {
    expect(() => HexAddressSchema.parse("742d35Cc6634C0532925a3b844Bc9e7595f2bD08")).toThrow();
  });

  it("rejects addresses with wrong length", () => {
    expect(() => HexAddressSchema.parse("0x742d35Cc")).toThrow();
    expect(() => HexAddressSchema.parse("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD0800")).toThrow();
  });
});

describe("SearchQuerySchema", () => {
  it("accepts valid search queries", () => {
    expect(SearchQuerySchema.parse("bitcoin price")).toBe("bitcoin price");
  });

  it("trims whitespace", () => {
    expect(SearchQuerySchema.parse("  ethereum  ")).toBe("ethereum");
  });

  it("rejects empty strings", () => {
    expect(() => SearchQuerySchema.parse("")).toThrow();
  });

  it("rejects strings exceeding 256 characters", () => {
    expect(() => SearchQuerySchema.parse("a".repeat(257))).toThrow();
  });
});

describe("PositiveIntSchema", () => {
  it("coerces string numbers to integers", () => {
    expect(PositiveIntSchema.parse("5")).toBe(5);
    expect(PositiveIntSchema.parse("100")).toBe(100);
  });

  it("rejects zero", () => {
    expect(() => PositiveIntSchema.parse("0")).toThrow();
  });

  it("rejects negative numbers", () => {
    expect(() => PositiveIntSchema.parse("-1")).toThrow();
  });

  it("rejects non-integer values", () => {
    expect(() => PositiveIntSchema.parse("3.14")).toThrow();
  });
});

describe("LimitSchema", () => {
  it("accepts valid limits within range (1–250)", () => {
    expect(LimitSchema.parse("1")).toBe(1);
    expect(LimitSchema.parse("50")).toBe(50);
    expect(LimitSchema.parse("250")).toBe(250);
  });

  it("defaults to 25 when undefined", () => {
    expect(LimitSchema.parse(undefined)).toBe(25);
  });

  it("rejects values outside range", () => {
    expect(() => LimitSchema.parse("0")).toThrow();
    expect(() => LimitSchema.parse("251")).toThrow();
  });
});

describe("DaysSchema", () => {
  it("accepts valid day ranges (1–365)", () => {
    expect(DaysSchema.parse("1")).toBe(1);
    expect(DaysSchema.parse("365")).toBe(365);
  });

  it("defaults to 7 when undefined", () => {
    expect(DaysSchema.parse(undefined)).toBe(7);
  });

  it("rejects values outside range", () => {
    expect(() => DaysSchema.parse("0")).toThrow();
    expect(() => DaysSchema.parse("366")).toThrow();
  });
});

describe("ChainSlugSchema", () => {
  it("accepts valid chain slugs", () => {
    expect(ChainSlugSchema.parse("ethereum")).toBe("ethereum");
    expect(ChainSlugSchema.parse("arbitrum-one")).toBe("arbitrum-one");
    expect(ChainSlugSchema.parse("bsc")).toBe("bsc");
  });

  it("rejects slugs with special characters", () => {
    expect(() => ChainSlugSchema.parse("eth/main")).toThrow();
    expect(() => ChainSlugSchema.parse("some chain")).toThrow();
  });

  it("rejects empty strings", () => {
    expect(() => ChainSlugSchema.parse("")).toThrow();
  });
});

describe("BitcoinAddressSchema", () => {
  it("accepts legacy addresses (start with 1)", () => {
    expect(BitcoinAddressSchema.parse("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBeDefined();
  });

  it("accepts P2SH addresses (start with 3)", () => {
    expect(BitcoinAddressSchema.parse("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy")).toBeDefined();
  });

  it("accepts Bech32 addresses (start with bc1)", () => {
    expect(BitcoinAddressSchema.parse("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")).toBeDefined();
  });

  it("rejects invalid prefixes", () => {
    expect(() => BitcoinAddressSchema.parse("2invalid")).toThrow();
  });
});

describe("UrlSchema", () => {
  it("accepts valid URLs", () => {
    expect(UrlSchema.parse("https://example.com")).toBe("https://example.com");
    expect(UrlSchema.parse("https://app.uniswap.org/swap")).toBe("https://app.uniswap.org/swap");
  });

  it("rejects non-URL strings", () => {
    expect(() => UrlSchema.parse("not-a-url")).toThrow();
  });

  it("rejects URLs exceeding 2048 characters", () => {
    expect(() => UrlSchema.parse(`https://example.com/${"a".repeat(2040)}`)).toThrow();
  });
});

describe("PeriodSchema", () => {
  it("accepts valid period values", () => {
    expect(PeriodSchema.parse("1w")).toBe("1w");
    expect(PeriodSchema.parse("1m")).toBe("1m");
    expect(PeriodSchema.parse("1y")).toBe("1y");
    expect(PeriodSchema.parse("all")).toBe("all");
  });

  it("rejects invalid period values", () => {
    expect(() => PeriodSchema.parse("2w")).toThrow();
    expect(() => PeriodSchema.parse("hourly")).toThrow();
  });
});

describe("TimeframeSchema", () => {
  it("accepts valid timeframes", () => {
    expect(TimeframeSchema.parse("day")).toBe("day");
    expect(TimeframeSchema.parse("hour")).toBe("hour");
    expect(TimeframeSchema.parse("minute")).toBe("minute");
  });

  it("rejects invalid timeframes", () => {
    expect(() => TimeframeSchema.parse("weekly")).toThrow();
  });
});

describe("NumericIdSchema", () => {
  it("accepts numeric string IDs", () => {
    expect(NumericIdSchema.parse("12345")).toBe("12345");
    expect(NumericIdSchema.parse("0")).toBe("0");
  });

  it("rejects non-numeric strings", () => {
    expect(() => NumericIdSchema.parse("abc")).toThrow();
    expect(() => NumericIdSchema.parse("12.5")).toThrow();
  });
});

describe("ChainIdSchema", () => {
  it("accepts valid chain IDs (1–6 digits)", () => {
    expect(ChainIdSchema.parse("1")).toBe("1");
    expect(ChainIdSchema.parse("56")).toBe("56");
    expect(ChainIdSchema.parse("137")).toBe("137");
    expect(ChainIdSchema.parse("421613")).toBe("421613");
  });

  it("rejects chain IDs with more than 6 digits", () => {
    expect(() => ChainIdSchema.parse("1234567")).toThrow();
  });

  it("rejects non-numeric strings", () => {
    expect(() => ChainIdSchema.parse("abc")).toThrow();
  });
});

describe("CoinIdListSchema", () => {
  it("accepts comma-separated valid coin IDs", () => {
    expect(CoinIdListSchema.parse("bitcoin,ethereum,solana")).toBe("bitcoin,ethereum,solana");
  });

  it("accepts a single coin ID", () => {
    expect(CoinIdListSchema.parse("bitcoin")).toBe("bitcoin");
  });

  it("rejects if any ID has invalid characters", () => {
    expect(() => CoinIdListSchema.parse("bitcoin,../bad")).toThrow();
  });

  it("rejects empty strings", () => {
    expect(() => CoinIdListSchema.parse("")).toThrow();
  });
});

// ─── POST Body Schemas ──────────────────────────────────────

describe("AskBodySchema", () => {
  it("validates a correct ask body", () => {
    const result = AskBodySchema.parse({ question: "What is Bitcoin?" });
    expect(result.question).toBe("What is Bitcoin?");
    expect(result.useRag).toBe(true); // default
  });

  it("accepts optional fields", () => {
    const result = AskBodySchema.parse({
      question: "x",
      context: "some context",
      useRag: false,
      ragCategory: "news",
    });
    expect(result.useRag).toBe(false);
    expect(result.ragCategory).toBe("news");
  });

  it("rejects missing question", () => {
    expect(() => AskBodySchema.parse({})).toThrow();
  });

  it("rejects question exceeding 2000 chars", () => {
    expect(() => AskBodySchema.parse({ question: "a".repeat(2001) })).toThrow();
  });
});

describe("AgentRunSchema", () => {
  it("validates a correct agent run body", () => {
    const result = AgentRunSchema.parse({ message: "Hello agent" });
    expect(result.message).toBe("Hello agent");
  });

  it("rejects empty message", () => {
    expect(() => AgentRunSchema.parse({ message: "" })).toThrow();
  });

  it("rejects maxTokens outside bounds", () => {
    expect(() => AgentRunSchema.parse({ message: "x", maxTokens: 50 })).toThrow();
    expect(() => AgentRunSchema.parse({ message: "x", maxTokens: 5000 })).toThrow();
  });
});

describe("AgentMultiSchema", () => {
  it("validates correct multi-agent body", () => {
    const result = AgentMultiSchema.parse({
      agents: ["agent-a", "agent-b"],
      message: "Compare yields",
    });
    expect(result.agents).toHaveLength(2);
  });

  it("rejects empty agents array", () => {
    expect(() => AgentMultiSchema.parse({ agents: [], message: "x" })).toThrow();
  });

  it("rejects more than 5 agents", () => {
    expect(() =>
      AgentMultiSchema.parse({ agents: ["a", "b", "c", "d", "e", "f"], message: "x" }),
    ).toThrow();
  });
});

describe("OrchestrateSchema", () => {
  it("validates correct orchestrate body", () => {
    const result = OrchestrateSchema.parse({ question: "What yield is best?" });
    expect(result.question).toBe("What yield is best?");
  });

  it("accepts optional template and context", () => {
    const result = OrchestrateSchema.parse({
      question: "x",
      template: "defi-analysis",
      context: "I hold ETH",
    });
    expect(result.template).toBe("defi-analysis");
  });

  it("rejects missing question", () => {
    expect(() => OrchestrateSchema.parse({})).toThrow();
  });
});

describe("GenerateKeySchema", () => {
  it("defaults tier to basic", () => {
    const result = GenerateKeySchema.parse({});
    expect(result.tier).toBe("basic");
  });

  it("accepts valid tiers", () => {
    expect(GenerateKeySchema.parse({ tier: "pro" }).tier).toBe("pro");
    expect(GenerateKeySchema.parse({ tier: "enterprise" }).tier).toBe("enterprise");
  });

  it("rejects invalid tier values", () => {
    expect(() => GenerateKeySchema.parse({ tier: "super" })).toThrow();
  });
});

describe("PortfolioHoldingsSchema", () => {
  it("validates correct holdings", () => {
    const result = PortfolioHoldingsSchema.parse({
      holdings: [{ id: "bitcoin", amount: 1.5 }],
    });
    expect(result.holdings[0].id).toBe("bitcoin");
    expect(result.vs_currency).toBe("usd"); // default
  });

  it("rejects zero or negative amounts", () => {
    expect(() =>
      PortfolioHoldingsSchema.parse({ holdings: [{ id: "bitcoin", amount: 0 }] }),
    ).toThrow();
    expect(() =>
      PortfolioHoldingsSchema.parse({ holdings: [{ id: "bitcoin", amount: -1 }] }),
    ).toThrow();
  });

  it("rejects empty holdings array", () => {
    expect(() => PortfolioHoldingsSchema.parse({ holdings: [] })).toThrow();
  });

  it("rejects more than 50 holdings", () => {
    const holdings = Array.from({ length: 51 }, (_, i) => ({ id: `coin-${i}`, amount: 1 }));
    expect(() => PortfolioHoldingsSchema.parse({ holdings })).toThrow();
  });
});

describe("AssetIdsSchema", () => {
  it("validates correct asset IDs", () => {
    const result = AssetIdsSchema.parse({ ids: ["bitcoin", "ethereum"] });
    expect(result.ids).toHaveLength(2);
    expect(result.days).toBe(30); // default
  });

  it("rejects fewer than 2 IDs", () => {
    expect(() => AssetIdsSchema.parse({ ids: ["bitcoin"] })).toThrow();
  });

  it("rejects more than 20 IDs", () => {
    const ids = Array.from({ length: 21 }, (_, i) => `coin-${i}`);
    expect(() => AssetIdsSchema.parse({ ids })).toThrow();
  });
});

describe("RiskAnalysisSchema", () => {
  it("validates correct risk analysis input", () => {
    const result = RiskAnalysisSchema.parse({ ids: ["bitcoin"] });
    expect(result.days).toBe(90); // default
  });

  it("rejects empty ids", () => {
    expect(() => RiskAnalysisSchema.parse({ ids: [] })).toThrow();
  });
});

describe("AIChatSchema", () => {
  it("validates correct AI chat body", () => {
    const result = AIChatSchema.parse({ message: "What is DeFi?" });
    expect(result.context).toBe("general"); // default
  });

  it("rejects empty message", () => {
    expect(() => AIChatSchema.parse({ message: "" })).toThrow();
  });

  it("accepts valid context enums", () => {
    expect(AIChatSchema.parse({ message: "x", context: "defi" }).context).toBe("defi");
    expect(AIChatSchema.parse({ message: "x", context: "market" }).context).toBe("market");
  });
});

describe("AIAnalyzeSchema", () => {
  it("validates correct analysis topic", () => {
    const result = AIAnalyzeSchema.parse({ topic: "DeFi yields" });
    expect(result.depth).toBe("standard"); // default
  });

  it("rejects empty topic", () => {
    expect(() => AIAnalyzeSchema.parse({ topic: "" })).toThrow();
  });
});

describe("AISummarizeSchema", () => {
  it("validates correct summarize body", () => {
    const result = AISummarizeSchema.parse({ text: "Long article text here." });
    expect(result.format).toBe("bullets"); // default
  });

  it("rejects text shorter than 10 characters", () => {
    expect(() => AISummarizeSchema.parse({ text: "short" })).toThrow();
  });
});

describe("AISentimentSchema", () => {
  it("validates correct sentiment body", () => {
    const result = AISentimentSchema.parse({ text: "Bitcoin to the moon!" });
    expect(result.text).toBe("Bitcoin to the moon!");
  });

  it("rejects empty text", () => {
    expect(() => AISentimentSchema.parse({ text: "" })).toThrow();
  });
});

describe("AIStrategySchema", () => {
  it("validates correct strategy body", () => {
    const result = AIStrategySchema.parse({ goal: "Maximize yield" });
    expect(result.riskTolerance).toBe("moderate"); // default
    expect(result.timeHorizon).toBe("medium"); // default
  });

  it("rejects empty goal", () => {
    expect(() => AIStrategySchema.parse({ goal: "" })).toThrow();
  });
});

describe("AIExplainSchema", () => {
  it("validates correct explain body", () => {
    const result = AIExplainSchema.parse({ topic: "Impermanent loss" });
    expect(result.level).toBe("beginner"); // default
  });

  it("accepts valid levels", () => {
    expect(AIExplainSchema.parse({ topic: "x", level: "advanced" }).level).toBe("advanced");
  });
});

describe("AIEmbedSchema", () => {
  it("validates correct embed body", () => {
    const result = AIEmbedSchema.parse({ texts: ["bitcoin price analysis"] });
    expect(result.texts).toHaveLength(1);
  });

  it("rejects empty texts array", () => {
    expect(() => AIEmbedSchema.parse({ texts: [] })).toThrow();
  });

  it("rejects more than 100 texts", () => {
    const texts = Array.from({ length: 101 }, () => "text");
    expect(() => AIEmbedSchema.parse({ texts })).toThrow();
  });
});

describe("AICompareSchema", () => {
  it("validates correct compare body", () => {
    const result = AICompareSchema.parse({ items: ["bitcoin", "ethereum"] });
    expect(result.type).toBe("tokens"); // default
  });

  it("rejects fewer than 2 items", () => {
    expect(() => AICompareSchema.parse({ items: ["bitcoin"] })).toThrow();
  });

  it("rejects more than 5 items", () => {
    expect(() =>
      AICompareSchema.parse({ items: ["a", "b", "c", "d", "e", "f"] }),
    ).toThrow();
  });
});

describe("AIRiskAssessmentSchema", () => {
  it("validates correct risk assessment body", () => {
    const result = AIRiskAssessmentSchema.parse({ target: "uniswap" });
    expect(result.type).toBe("token"); // default
  });

  it("rejects empty target", () => {
    expect(() => AIRiskAssessmentSchema.parse({ target: "" })).toThrow();
  });
});

describe("AIPortfolioReviewSchema", () => {
  it("validates correct portfolio review body", () => {
    const result = AIPortfolioReviewSchema.parse({
      holdings: [{ asset: "BTC", allocation: 60 }],
    });
    expect(result.holdings).toHaveLength(1);
  });

  it("rejects empty holdings", () => {
    expect(() => AIPortfolioReviewSchema.parse({ holdings: [] })).toThrow();
  });

  it("rejects allocation outside 0–100", () => {
    expect(() =>
      AIPortfolioReviewSchema.parse({ holdings: [{ asset: "BTC", allocation: 101 }] }),
    ).toThrow();
  });
});

describe("AgentComposeSchema", () => {
  it("validates correct compose body", () => {
    const result = AgentComposeSchema.parse({
      pipeline: [
        { agentId: "agent-a" },
        { agentId: "agent-b" },
      ],
      input: { question: "test" },
    });
    expect(result.pipeline).toHaveLength(2);
  });

  it("rejects pipeline with fewer than 2 agents", () => {
    expect(() =>
      AgentComposeSchema.parse({ pipeline: [{ agentId: "agent-a" }], input: {} }),
    ).toThrow();
  });

  it("rejects pipeline with more than 5 agents", () => {
    const pipeline = Array.from({ length: 6 }, (_, i) => ({ agentId: `agent-${i}` }));
    expect(() => AgentComposeSchema.parse({ pipeline, input: {} })).toThrow();
  });
});

// ─── validateBody ───────────────────────────────────────────

describe("validateBody()", () => {
  function buildApp(schema: z.ZodTypeAny) {
    const app = new Hono();
    app.post("/test", async (c) => {
      const result = await validateBody(c, schema);
      if (!result.success) return result.error;
      return c.json({ ok: true, data: result.data });
    });
    return app;
  }

  it("returns parsed data for valid JSON body", async () => {
    const app = buildApp(AskBodySchema);
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is ETH?" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.ok).toBe(true);
    expect(body.data.question).toBe("What is ETH?");
  });

  it("returns 400 for invalid JSON syntax", async () => {
    const app = buildApp(AskBodySchema);
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 for valid JSON that fails schema validation", async () => {
    const app = buildApp(AskBodySchema);
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.validationErrors).toBeDefined();
    expect(body.validationErrors.length).toBeGreaterThan(0);
  });

  it("returns field-level validation errors", async () => {
    const app = buildApp(PortfolioHoldingsSchema);
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdings: [] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, any>;
    expect(body.validationErrors).toBeDefined();
    expect(body.validationErrors[0].field).toBeDefined();
  });
});

// ─── validateQuery ──────────────────────────────────────────

describe("validateQuery()", () => {
  function buildApp(queryName: string, schema: z.ZodTypeAny) {
    const app = new Hono();
    app.get("/test", (c) => {
      const result = validateQuery(c, queryName, schema);
      if (!result.success) return result.error;
      return c.json({ ok: true, data: result.data });
    });
    return app;
  }

  it("parses a valid query parameter", async () => {
    const app = buildApp("limit", LimitSchema);
    const res = await app.request("/test?limit=50");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toBe(50);
  });

  it("uses default value when query param is absent", async () => {
    const app = buildApp("limit", LimitSchema);
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toBe(25);
  });

  it("returns 400 for invalid query parameter value", async () => {
    const app = buildApp("limit", LimitSchema);
    const res = await app.request("/test?limit=999");
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("VALIDATION_FAILED");
  });
});

// ─── validateParam ──────────────────────────────────────────

describe("validateParam()", () => {
  function buildApp(paramName: string, schema: z.ZodType<string>) {
    const app = new Hono();
    app.get(`/test/:${paramName}`, (c) => {
      const result = validateParam(c, paramName, schema);
      if (!result.success) return result.error;
      return c.json({ ok: true, data: result.data });
    });
    return app;
  }

  it("validates a valid route param", async () => {
    const app = buildApp("coin", CoinIdSchema);
    const res = await app.request("/test/bitcoin");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.data).toBe("bitcoin");
  });

  it("returns 400 for an invalid route param", async () => {
    const app = buildApp("coin", CoinIdSchema);
    const res = await app.request("/test/..%2Fetc%2Fpasswd");
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, any>;
    expect(body.code).toBe("VALIDATION_FAILED");
  });
});
