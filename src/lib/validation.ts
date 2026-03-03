/**
 * Crypto Vision — Input Validation Schemas
 *
 * Zod schemas for validating user inputs across routes.
 * The `z` dependency was already in package.json but unused — now it earns its keep.
 *
 * Usage:
 *   import { AskBodySchema, validateBody } from "../lib/validation.js";
 *   const body = validateBody(c, AskBodySchema);
 */

import { z } from "zod";
import type { Context } from "hono";
import { ApiError, type ValidationError } from "./api-error.js";

// ─── Shared Primitives ──────────────────────────────────────

/** Alphanumeric coin ID (e.g. "bitcoin", "ethereum") — no slashes, no injection */
export const CoinIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid coin ID format");

/** Ethereum-style hex address */
export const HexAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid hex address");

/** Generic search query — bounded length */
export const SearchQuerySchema = z.string().min(1).max(256).trim();

/** Positive integer query param */
export const PositiveIntSchema = z.coerce.number().int().positive();

/** Pagination page number (1+) */
export const PageSchema = z.coerce.number().int().min(1).default(1);

/** Pagination limit (1–250, default 25) */
export const LimitSchema = z.coerce.number().int().min(1).max(250).default(25);

/** Days param for charts (1–365) */
export const DaysSchema = z.coerce.number().int().min(1).max(365).default(7);

/** Factory for limit schemas with custom defaults and bounds */
export function limitSchema(defaultVal: number, maxVal: number) {
  return z.coerce.number().int().min(1).max(maxVal).default(defaultVal);
}

/** Pagination combo: page + limit */
export const PaginationSchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
});

// ─── Extended Primitives (route param validation) ────────────

/** Chain or network slug (e.g. "ethereum", "bsc", "arbitrum-one") */
export const ChainSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid chain/network identifier");

/** Bitcoin address: legacy (1…), P2SH (3…), or Bech32 (bc1…) */
export const BitcoinAddressSchema = z
  .string()
  .regex(/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/, "Invalid Bitcoin address");

/** URL query param (bounded, for security /dapp endpoint) */
export const UrlSchema = z.string().url("Invalid URL").max(2048);

/** Period param for on-chain analytics */
export const PeriodSchema = z.enum(["1w", "1m", "3m", "6m", "1y", "all"]);

/** DEX pool OHLCV timeframe */
export const TimeframeSchema = z.enum(["day", "hour", "minute"]);

/** CoinCap history interval */
export const CoinCapIntervalSchema = z.enum([
  "m1", "m5", "m15", "m30", "h1", "h2", "h6", "h12", "d1",
]);

/** CoinGecko chart interval */
export const ChartIntervalSchema = z.enum(["daily", "hourly", "5-minutely"]).optional();

/** Numeric ID string (e.g. CoinLore uses numeric IDs) */
export const NumericIdSchema = z
  .string()
  .regex(/^\d+$/, "ID must be numeric");

/** Chain ID (numeric string, 1-6 digits) */
export const ChainIdSchema = z
  .string()
  .regex(/^\d{1,6}$/, "Invalid chain ID");

/** Comma-separated coin IDs list — validates each part */
export const CoinIdListSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine(
    (s) => s.split(",").every((id) => /^[a-zA-Z0-9_-]+$/.test(id.trim())),
    "Each coin ID must be alphanumeric (with hyphens/underscores)",
  );

// ─── POST Body Schemas ──────────────────────────────────────

export const AskBodySchema = z.object({
  question: z
    .string()
    .min(1, "question is required")
    .max(2000, "question too long (max 2000 chars)"),
  context: z.string().max(4000).optional(),
  /** Enable RAG-enhanced answers (default: true) */
  useRag: z.boolean().optional().default(true),
  /** Filter RAG results by category (news, protocol, agent, governance) */
  ragCategory: z.enum(["news", "protocol", "agent", "governance"]).optional(),
});

export const AgentRunSchema = z.object({
  message: z
    .string()
    .min(1, "message is required")
    .max(2000, "message too long (max 2000 chars)"),
  context: z.string().max(4000).optional(),
  enrich: z.boolean().optional(),
  maxTokens: z.number().int().min(100).max(4096).optional(),
});

export const AgentMultiSchema = z.object({
  agents: z
    .array(z.string().min(1).max(64))
    .min(1, "at least one agent required")
    .max(5, "max 5 agents"),
  message: z
    .string()
    .min(1, "message is required")
    .max(2000, "message too long (max 2000 chars)"),
  context: z.string().max(4000).optional(),
  maxTokens: z.number().int().min(100).max(4096).optional(),
});

export const OrchestrateSchema = z.object({
  question: z
    .string()
    .min(1, "question is required")
    .max(2000, "question too long (max 2000 chars)"),
  /** Optional: use a pre-defined workflow template instead of LLM planning */
  template: z.string().max(64).optional(),
  /** Optional: extra context to give agents (e.g., portfolio details) */
  context: z.string().max(4000).optional(),
});

export const GenerateKeySchema = z.object({
  tier: z.enum(["basic", "pro", "enterprise"]).optional().default("basic"),
});

/** Portfolio holdings for valuation & diversification endpoints */
export const PortfolioHoldingsSchema = z.object({
  holdings: z
    .array(
      z.object({
        id: CoinIdSchema,
        amount: z.number().positive("amount must be positive"),
      }),
    )
    .min(1, "at least one holding required")
    .max(50, "maximum 50 holdings per request"),
  vs_currency: z.string().min(1).max(10).default("usd"),
});

/** Asset IDs for correlation / risk analysis */
export const AssetIdsSchema = z.object({
  ids: z
    .array(z.string().min(1).max(128))
    .min(2, "at least 2 coin IDs required")
    .max(20, "maximum 20 assets"),
  days: z.number().int().min(1).max(365).default(30),
  vs_currency: z.string().min(1).max(10).default("usd"),
});

/** Risk analysis — requires at least 1 ID */
export const RiskAnalysisSchema = z.object({
  ids: z
    .array(z.string().min(1).max(128))
    .min(1, "at least 1 coin ID required")
    .max(20, "maximum 20 assets"),
  days: z.number().int().min(1).max(365).default(90),
  vs_currency: z.string().min(1).max(10).default("usd"),
});

/** Pyth price feed IDs */
export const PythPriceIdsSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "at least one Pyth feed ID required")
    .max(100, "maximum 100 feed IDs per request"),
});

// ─── AI Chat & Analysis Schemas ──────────────────────────────

/** AI chat with crypto context */
export const AIChatSchema = z.object({
  message: z
    .string()
    .min(1, "message is required")
    .max(4000, "message too long (max 4000 chars)"),
  context: z
    .enum(["market", "defi", "technical", "general"])
    .default("general"),
  model: z.string().max(128).optional(),
  conversationId: z.string().max(128).optional(),
});

/** AI market analysis */
export const AIAnalyzeSchema = z.object({
  topic: z
    .string()
    .min(1, "topic is required")
    .max(256, "topic too long (max 256 chars)"),
  coin: z.string().max(128).optional(),
  depth: z.enum(["quick", "standard", "deep"]).default("standard"),
});

/** AI summarize articles/news */
export const AISummarizeSchema = z.object({
  text: z
    .string()
    .min(10, "text must be at least 10 characters")
    .max(16_000, "text too long (max 16000 chars)"),
  format: z.enum(["bullets", "paragraph", "tldr"]).default("bullets"),
  maxLength: z.number().int().min(50).max(2000).optional(),
});

/** AI sentiment analysis (POST body) */
export const AISentimentSchema = z.object({
  text: z
    .string()
    .min(1, "text is required")
    .max(8000, "text too long (max 8000 chars)"),
  coins: z.array(z.string().max(128)).max(10).optional(),
});

/** AI trading/DeFi strategy */
export const AIStrategySchema = z.object({
  goal: z
    .string()
    .min(1, "goal is required")
    .max(1000, "goal too long (max 1000 chars)"),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
  timeHorizon: z.enum(["short", "medium", "long"]).default("medium"),
  budget: z.string().max(64).optional(),
  holdings: z.array(z.string().max(128)).max(20).optional(),
});

/** AI explain (POST version) */
export const AIExplainSchema = z.object({
  topic: z
    .string()
    .min(1, "topic is required")
    .max(256, "topic too long (max 256 chars)"),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
});

/** AI embed (text embedding generation) */
export const AIEmbedSchema = z.object({
  texts: z
    .array(z.string().min(1).max(8192))
    .min(1, "at least one text required")
    .max(100, "maximum 100 texts per request"),
});

/** AI compare (POST version) */
export const AICompareSchema = z.object({
  items: z
    .array(z.string().min(1).max(128))
    .min(2, "at least 2 items required")
    .max(5, "maximum 5 items"),
  type: z.enum(["tokens", "protocols", "chains"]).default("tokens"),
});

/** AI risk assessment (POST) */
export const AIRiskAssessmentSchema = z.object({
  target: z
    .string()
    .min(1, "target is required")
    .max(256, "target too long (max 256 chars)"),
  type: z.enum(["protocol", "token", "portfolio", "strategy"]).default("token"),
  context: z.string().max(4000).optional(),
});

/** AI portfolio review (POST) */
export const AIPortfolioReviewSchema = z.object({
  holdings: z
    .array(
      z.object({
        asset: z.string().min(1).max(128),
        allocation: z.number().min(0).max(100),
      }),
    )
    .min(1, "at least one holding required")
    .max(50, "maximum 50 holdings"),
  totalValue: z.string().max(64).optional(),
  goal: z.string().max(256).optional(),
});

/** Agent composition pipeline */
export const AgentComposeSchema = z.object({
  pipeline: z
    .array(
      z.object({
        agentId: z.string().min(1).max(128),
        inputMapping: z.record(z.string(), z.string()).optional(),
      }),
    )
    .min(2, "pipeline must have at least 2 agents")
    .max(5, "pipeline can have at most 5 agents"),
  input: z.record(z.string(), z.unknown()),
});

// ─── Validation Helper ──────────────────────────────────────

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns the parsed data or sends a 400 error response.
 *
 * @example
 * const result = await validateBody(c, AskBodySchema);
 * if (!result.success) return result.error; // already a Response
 */
export async function validateBody<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return {
      success: false,
      error: ApiError.badRequest(c, "Request body must be valid JSON"),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues: ValidationError[] = result.error.issues.map((i) => ({
      field: i.path.join(".") || "(root)",
      message: i.message,
    }));
    return {
      success: false,
      error: ApiError.validation(
        c,
        `Invalid request: ${issues.map((i) => `${i.field}: ${i.message}`).join("; ")}`,
        issues,
      ),
    };
  }

  return { success: true, data: result.data };
}

// ─── Multi-Query Validation ─────────────────────────────────

/**
 * Validate multiple query parameters at once against a Zod object schema.
 * Reads each key from the URL query string, applies the schema,
 * and returns typed parsed data or a structured 400 error.
 *
 * @example
 * const QS = z.object({ page: PageSchema, limit: limitSchema(50, 200) });
 * const q = validateQueries(c, QS);
 * if (!q.success) return q.error;
 * const { page, limit } = q.data;
 */
export function validateQueries<T extends z.ZodRawShape>(
  c: Context,
  schema: z.ZodObject<T>,
): { success: true; data: z.infer<z.ZodObject<T>> } | { success: false; error: Response } {
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema.shape)) {
    raw[key] = c.req.query(key);
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues: ValidationError[] = result.error.issues.map((i) => ({
      field: i.path.join(".") || "(root)",
      message: i.message,
    }));
    return {
      success: false,
      error: ApiError.validation(
        c,
        `Invalid query parameters: ${issues.map((i) => `${i.field}: ${i.message}`).join("; ")}`,
        issues,
      ),
    };
  }
  return { success: true, data: result.data };
}
/**
 * Validate a query parameter against a Zod schema.
 * Returns the parsed value or sends a 400 error response.
 * If the query param is absent and the schema has a default, the default is used.
 */
export function validateQuery<T>(
  c: Context,
  queryName: string,
  schema: z.ZodType<T>,
): { success: true; data: T } | { success: false; error: Response } {
  const raw = c.req.query(queryName);
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      error: ApiError.validation(
        c,
        `Invalid query param '${queryName}': ${result.error.issues[0]?.message || "invalid"}`,
        [{ field: queryName, message: result.error.issues[0]?.message || "invalid" }],
      ),
    };
  }
  return { success: true, data: result.data };
}
/**
 * Validate a route param (e.g. :coin, :address).
 */
export function validateParam(
  c: Context,
  paramName: string,
  schema: z.ZodType<string>,
): { success: true; data: string } | { success: false; error: Response } {
  const raw = c.req.param(paramName);
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      error: ApiError.validation(
        c,
        `Invalid ${paramName}: ${result.error.issues[0]?.message || "invalid"}`,
        [{ field: paramName, message: result.error.issues[0]?.message || "invalid" }],
      ),
    };
  }
  return { success: true, data: result.data };
}
