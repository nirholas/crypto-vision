/**
 * API Request Validation Schemas
 * 
 * Zod schemas for validating all v2 API requests.
 * Provides type-safe validation with detailed error messages.
 * 
 * @module validation/api-schemas
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from './monitoring';

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/** Pagination parameters */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  per_page: z.coerce.number().int().min(1).max(250).default(100),
});

/** Coin ID - lowercase alphanumeric with hyphens */
export const coinIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'Invalid coin ID format');

/** Multiple coin IDs */
export const coinIdsSchema = z
  .string()
  .transform((val) => val.split(',').filter(Boolean))
  .pipe(z.array(coinIdSchema).max(50));

/** Sort order options */
export const sortOrderSchema = z.enum([
  'market_cap_desc',
  'market_cap_asc',
  'volume_desc',
  'volume_asc',
  'price_desc',
  'price_asc',
  'id_asc',
  'id_desc',
]).default('market_cap_desc');

/** Boolean from query string */
export const booleanQuerySchema = z
  .enum(['true', 'false', '1', '0'])
  .transform((val) => val === 'true' || val === '1')
  .default('false');

// =============================================================================
// ENDPOINT SCHEMAS
// =============================================================================

/** GET /api/v2/coins */
export const coinsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  per_page: z.coerce.number().int().min(1).max(250).default(100),
  order: sortOrderSchema,
  ids: coinIdsSchema.optional(),
  sparkline: booleanQuerySchema,
});

/** GET /api/v2/coin/:id */
export const coinDetailParamsSchema = z.object({
  id: coinIdSchema,
});

/** GET /api/v2/historical/:id */
export const historicalQuerySchema = z.object({
  days: z.coerce.number().int().refine(
    (val) => [1, 7, 14, 30, 90, 180, 365].includes(val),
    { message: 'Days must be one of: 1, 7, 14, 30, 90, 180, 365' }
  ).default(30),
});

export const historicalParamsSchema = z.object({
  id: coinIdSchema,
});

/** GET /api/v2/search */
export const searchQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(100).optional(),
  query: z.string().min(2).max(100).optional(),
}).refine(
  (data) => data.q || data.query,
  { message: 'Either q or query parameter is required' }
).transform((data) => ({
  query: data.q || data.query || '',
}));

/** GET /api/v2/global */
export const globalQuerySchema = z.object({}).optional();

/** GET /api/v2/defi */
export const defiQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  category: z.string().max(50).optional(),
});

/** GET /api/v2/gas */
export const gasQuerySchema = z.object({
  network: z.enum(['all', 'ethereum', 'eth', 'bitcoin', 'btc']).default('all'),
});

/** GET /api/v2/ticker */
export const tickerQuerySchema = z.object({
  symbol: z.string().min(2).max(10).toUpperCase().optional(),
  symbols: z.string().transform((val) => val.toUpperCase().split(',').filter(Boolean)).optional(),
}).refine(
  (data) => data.symbol || data.symbols,
  { message: 'Either symbol or symbols parameter is required' }
);

/** GET /api/v2/volatility */
export const volatilityQuerySchema = z.object({
  ids: coinIdsSchema.optional(),
  period: z.enum(['7d', '30d', '90d']).default('30d'),
});

/** GET /api/v2/trending */
export const trendingQuerySchema = z.object({}).optional();

// =============================================================================
// VALIDATION HELPER
// =============================================================================

export type ValidationSuccess<T> = {
  success: true;
  data: T;
};

export type ValidationError = {
  success: false;
  error: string;
  details: z.ZodIssue[];
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Validate request query parameters against a Zod schema
 */
export function validateQuery<T extends z.ZodSchema>(
  request: NextRequest,
  schema: T
): ValidationResult<z.infer<T>> {
  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    logger.warn('Request validation failed', {
      errors: result.error.issues,
      params,
    });
    
    return {
      success: false,
      error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      details: result.error.issues,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Validate route parameters against a Zod schema
 */
export function validateParams<T extends z.ZodSchema>(
  params: Record<string, string>,
  schema: T
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(params);

  if (!result.success) {
    logger.warn('Route params validation failed', {
      errors: result.error.issues,
      params,
    });
    
    return {
      success: false,
      error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      details: result.error.issues,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Create error response for validation failures
 */
export function validationErrorResponse(
  error: string,
  details?: z.ZodIssue[]
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      code: 'VALIDATION_ERROR',
      details: details?.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      })),
    },
    {
      status: 400,
      headers: {
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CoinsQuery = z.infer<typeof coinsQuerySchema>;
export type CoinDetailParams = z.infer<typeof coinDetailParamsSchema>;
export type HistoricalQuery = z.infer<typeof historicalQuerySchema>;
export type HistoricalParams = z.infer<typeof historicalParamsSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type DefiQuery = z.infer<typeof defiQuerySchema>;
export type GasQuery = z.infer<typeof gasQuerySchema>;
export type TickerQuery = z.infer<typeof tickerQuerySchema>;
export type VolatilityQuery = z.infer<typeof volatilityQuerySchema>;
