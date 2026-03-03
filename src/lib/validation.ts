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

export const GenerateKeySchema = z.object({
  tier: z.enum(["basic", "pro"]).optional().default("basic"),
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
