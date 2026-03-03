import { z } from "zod";

// Token with balance info
export const TokenBalanceSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  balance: z.string(), // bigint as string
  chain: z.string(),
});
export type TokenBalance = z.infer<typeof TokenBalanceSchema>;

// Validated price from multi-oracle
export const ValidatedPriceSchema = z.object({
  price: z.number(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW", "UNTRUSTED"]),
  sources: z.array(
    z.object({
      name: z.string(),
      price: z.number(),
      timestamp: z.number(),
    })
  ),
  requiresApproval: z.boolean(),
});
export type ValidatedPrice = z.infer<typeof ValidatedPriceSchema>;

// Liquidity check result
export const LiquidityCheckSchema = z.object({
  isLiquid: z.boolean(),
  liquidityUsd: z.number(),
  topPools: z.array(
    z.object({
      dex: z.string(),
      liquidity: z.number(),
    })
  ),
});
export type LiquidityCheck = z.infer<typeof LiquidityCheckSchema>;

// Honeypot check result
export const HoneypotCheckSchema = z.object({
  isHoneypot: z.boolean(),
  buyTax: z.number(),
  sellTax: z.number(),
  isOpenSource: z.boolean(),
  hasProxyContract: z.boolean(),
});
export type HoneypotCheck = z.infer<typeof HoneypotCheckSchema>;

// Full sweep validation result
export const SweepValidationSchema = z.object({
  canSweep: z.boolean(),
  requiresApproval: z.boolean(),
  validatedPrice: ValidatedPriceSchema,
  liquidityCheck: LiquidityCheckSchema,
  anomalyCheck: z.object({
    isAnomalous: z.boolean(),
    currentPrice: z.number(),
    avg7d: z.number(),
    deviation: z.number(),
  }),
  executionGuard: z.object({
    canExecute: z.boolean(),
    requiresApproval: z.boolean(),
    reason: z.string().optional(),
    expectedValue: z.number(),
    minAcceptableValue: z.number(),
  }),
  honeypotCheck: HoneypotCheckSchema.optional(),
  listStatus: z.enum(["WHITELIST", "BLACKLIST", "GRAYLIST", "UNKNOWN"]),
  reasons: z.array(z.string()),
});
export type SweepValidation = z.infer<typeof SweepValidationSchema>;

// Dust token ready for sweeping
export const DustTokenSchema = z.object({
  token: TokenBalanceSchema,
  usdValue: z.number(),
  validation: SweepValidationSchema,
});
export type DustToken = z.infer<typeof DustTokenSchema>;

// Sweep quote
export const SweepQuoteSchema = z.object({
  dustTokens: z.array(DustTokenSchema),
  totalValueUsd: z.number(),
  outputToken: z.object({
    address: z.string(),
    symbol: z.string(),
    expectedAmount: z.string(),
  }),
  estimatedGasUsd: z.number(),
  netValueUsd: z.number(),
  route: z.object({
    aggregator: z.string(),
    steps: z.array(z.any()),
  }),
  expiresAt: z.number(),
});
export type SweepQuote = z.infer<typeof SweepQuoteSchema>;

// Sweep execution result
export const SweepResultSchema = z.object({
  success: z.boolean(),
  txHash: z.string().optional(),
  inputTokens: z.array(
    z.object({
      address: z.string(),
      amount: z.string(),
    })
  ),
  outputAmount: z.string().optional(),
  gasUsed: z.string().optional(),
  error: z.string().optional(),
});
export type SweepResult = z.infer<typeof SweepResultSchema>;
