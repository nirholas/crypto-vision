/**
 * Crypto Vision — Startup Environment Validation
 *
 * Validates required and optional environment variables at startup using Zod.
 * Fails fast with clear messages if the configuration is invalid.
 *
 * Import this module at the top of index.ts to ensure validation runs
 * before any other initialization.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { z } from "zod";
import { logger } from "./logger.js";

// ─── Schema ──────────────────────────────────────────────────

const portStr = z
  .string()
  .default("8080")
  .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535, {
    message: "PORT must be a number between 1 and 65535",
  });

const EnvSchema = z.object({
  // Server
  PORT: portStr,
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  CORS_ORIGINS: z.string().optional(),
  SHUTDOWN_TIMEOUT_MS: z
    .string()
    .default("15000")
    .refine((v) => /^\d+$/.test(v), { message: "SHUTDOWN_TIMEOUT_MS must be a positive integer" }),

  // Cache / Redis
  REDIS_URL: z
    .string()
    .url("REDIS_URL must be a valid URL (e.g. redis://localhost:6379)")
    .optional()
    .or(z.literal("")),

  // Rate limiting
  RATE_LIMIT_RPM: z
    .string()
    .default("200")
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "RATE_LIMIT_RPM must be a positive integer",
    }),

  // Circuit breaker
  CB_FAILURE_THRESHOLD: z
    .string()
    .default("5")
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "CB_FAILURE_THRESHOLD must be a positive integer",
    }),
  CB_RESET_MS: z
    .string()
    .default("30000")
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "CB_RESET_MS must be a positive integer",
    }),
  FETCH_CONCURRENCY_PER_HOST: z
    .string()
    .default("10")
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "FETCH_CONCURRENCY_PER_HOST must be a positive integer",
    }),

  // Queue / concurrency
  AI_CONCURRENCY: z
    .string()
    .default("10")
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "AI_CONCURRENCY must be a positive integer",
    }),
  AI_MAX_QUEUE: z
    .string()
    .default("500")
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "AI_MAX_QUEUE must be a positive integer",
    }),
  HEAVY_FETCH_CONCURRENCY: z
    .string()
    .default("20")
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "HEAVY_FETCH_CONCURRENCY must be a positive integer",
    }),

  // Cache tuning
  CACHE_MAX_ENTRIES: z
    .string()
    .default("200000")
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "CACHE_MAX_ENTRIES must be a positive integer",
    }),

  // Auth
  API_KEYS: z.string().optional(),
  ADMIN_API_KEYS: z.string().optional(),

  // ─── Data Source API Keys (all optional — graceful degradation) ──

  // Market data
  COINGECKO_API_KEY: z.string().optional(),
  COINGECKO_PRO: z.enum(["true", "false"]).default("false"),
  COINCAP_API_KEY: z.string().optional(),
  COINGLASS_API_KEY: z.string().optional(),
  CRYPTOCOMPARE_API_KEY: z.string().optional(),

  // Research & metrics
  MESSARI_API_KEY: z.string().optional(),
  TOKEN_TERMINAL_API_KEY: z.string().optional(),

  // Calendar / events
  COINMARKETCAL_API_KEY: z.string().optional(),

  // On-chain / EVM
  ETHERSCAN_API_KEY: z.string().optional(),
  OWLRACLE_API_KEY: z.string().optional(),

  // NFT
  RESERVOIR_API_KEY: z.string().optional(),

  // Whale tracking
  BLOCKCHAIR_API_KEY: z.string().optional(),

  // Staking
  BEACONCHAIN_API_KEY: z.string().optional(),
  RATED_API_KEY: z.string().optional(),

  // News
  NEWS_API_URL: z.string().optional(),

  // AI providers — all optional, but warn if none are set
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),

  // Crypto Vision — Telegram bot
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  CRYPTO_VISION_ENABLED: z.string().default("false"),

  // GCP / BigQuery / AI platform
  GCP_PROJECT_ID: z.string().optional(),
  GCP_REGION: z.string().default("us-central1"),
  BQ_DATASET: z.string().default("crypto_vision"),
  BQ_MAX_BYTES: z
    .string()
    .default("1000000000")
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "BQ_MAX_BYTES must be a positive integer",
    }),
});

export type Env = z.infer<typeof EnvSchema>;

// ─── Validate ────────────────────────────────────────────────

function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    logger.fatal(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }

  const env = result.data;

  // Warn if no AI provider keys are configured
  const aiKeys = [
    env.GROQ_API_KEY,
    env.GEMINI_API_KEY,
    env.OPENAI_API_KEY,
    env.ANTHROPIC_API_KEY,
    env.OPENROUTER_API_KEY,
  ].filter(Boolean);

  if (aiKeys.length === 0) {
    logger.warn(
      "No AI provider keys configured — /ai and /agents endpoints will fail. " +
        "Set at least one of: GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY",
    );
  }

  // Warn if REDIS_URL is not set
  if (!env.REDIS_URL) {
    logger.warn(
      "REDIS_URL not set — using in-memory cache and rate limiting. " +
        "This is fine for development but will not scale across multiple instances.",
    );
  }

  // Warn about missing data source API keys with degradation context
  const sourceKeyStatus: Record<string, string> = {
    COINGECKO_API_KEY: "CoinGecko Pro endpoints (rate-limited on free tier)",
    COINCAP_API_KEY: "CoinCap WebSocket real-time prices",
    COINGLASS_API_KEY: "Coinglass derivatives/perpetuals data",
    CRYPTOCOMPARE_API_KEY: "CryptoCompare social & historical data",
    MESSARI_API_KEY: "Messari research & metrics",
    TOKEN_TERMINAL_API_KEY: "Token Terminal protocol revenue data",
    COINMARKETCAL_API_KEY: "CoinMarketCal crypto calendar events",
    ETHERSCAN_API_KEY: "Etherscan on-chain data (rate-limited without key)",
    OWLRACLE_API_KEY: "Owlracle gas price estimates",
    RESERVOIR_API_KEY: "Reservoir NFT market data",
    BLOCKCHAIR_API_KEY: "Blockchair whale transaction tracking",
    BEACONCHAIN_API_KEY: "Beaconchain ETH staking data",
    RATED_API_KEY: "Rated.network validator performance data",
  };

  const missingSourceKeys = Object.entries(sourceKeyStatus)
    .filter(([key]) => !process.env[key])
    .map(([key, desc]) => `${key} → ${desc}`);

  if (missingSourceKeys.length > 0) {
    logger.warn(
      {
        missingKeys: missingSourceKeys.length,
        totalKeys: Object.keys(sourceKeyStatus).length,
      },
      `Missing ${missingSourceKeys.length} data source API key(s) — some endpoints will return limited or no data:\n${missingSourceKeys.map((k) => `  • ${k}`).join("\n")}`,
    );
  }

  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      redis: !!env.REDIS_URL,
      gcp: !!env.GCP_PROJECT_ID,
      aiProviders: aiKeys.length,
      sourceKeysConfigured: Object.keys(sourceKeyStatus).length - missingSourceKeys.length,
      sourceKeysTotal: Object.keys(sourceKeyStatus).length,
    },
    "Environment validated",
  );

  return env;
}

/** Validated environment — import this to get typed, validated env vars. */
export const env = validateEnv();
