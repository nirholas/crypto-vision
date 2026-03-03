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

/** Pagination limit (1–250, default 25) */
export const LimitSchema = z.coerce.number().int().min(1).max(250).default(25);

/** Days param for charts (1–365) */
export const DaysSchema = z.coerce.number().int().min(1).max(365).default(7);

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
