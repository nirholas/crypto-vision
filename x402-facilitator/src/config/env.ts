import { z } from 'zod';
import type { FacilitatorConfig, ChainConfig, Hex } from '../types/index.js';
import { CHAIN_CONFIGS } from './chains.js';

const envSchema = z.object({
  FACILITATOR_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Must be a 32-byte hex private key'),

  BASE_RPC_URL: z.string().url().default('https://mainnet.base.org'),
  BASE_SEPOLIA_RPC_URL: z.string().url().optional(),
  ARBITRUM_RPC_URL: z.string().url().optional(),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url().optional(),
  ETHEREUM_RPC_URL: z.string().url().optional(),

  PORT: z.coerce.number().int().min(1).max(65535).default(3402),
  HOST: z.string().default('0.0.0.0'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Feature flags
  ENABLE_BASE: z.coerce.boolean().default(true),
  ENABLE_BASE_SEPOLIA: z.coerce.boolean().default(true),
  ENABLE_ARBITRUM: z.coerce.boolean().default(false),
  ENABLE_ARBITRUM_SEPOLIA: z.coerce.boolean().default(false),
  ENABLE_ETHEREUM: z.coerce.boolean().default(false),

  REDIS_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Raw parsed environment — available for direct access by middleware/routes */
let _env: Env | undefined;
export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return getEnv()[prop as keyof Env];
  },
});

export function loadConfig(): FacilitatorConfig {
  const parsed = env;

  const chains: ChainConfig[] = [];

  if (parsed.ENABLE_BASE) {
    chains.push({
      ...CHAIN_CONFIGS.base,
      rpcUrl: parsed.BASE_RPC_URL,
    });
  }

  if (parsed.ENABLE_BASE_SEPOLIA && parsed.BASE_SEPOLIA_RPC_URL) {
    chains.push({
      ...CHAIN_CONFIGS.baseSepolia,
      rpcUrl: parsed.BASE_SEPOLIA_RPC_URL,
    });
  }

  if (parsed.ENABLE_ARBITRUM && parsed.ARBITRUM_RPC_URL) {
    chains.push({
      ...CHAIN_CONFIGS.arbitrum,
      rpcUrl: parsed.ARBITRUM_RPC_URL,
    });
  }
  if (parsed.ENABLE_ARBITRUM_SEPOLIA && parsed.ARBITRUM_SEPOLIA_RPC_URL) {
    chains.push({
      ...CHAIN_CONFIGS.arbitrumSepolia,
      rpcUrl: parsed.ARBITRUM_SEPOLIA_RPC_URL,
    });
  }

  if (parsed.ENABLE_ETHEREUM && parsed.ETHEREUM_RPC_URL) {
    chains.push({
      ...CHAIN_CONFIGS.ethereum,
      rpcUrl: parsed.ETHEREUM_RPC_URL,
    });
  }

  if (chains.length === 0) {
    throw new Error('At least one chain must be enabled. Set ENABLE_BASE=true and provide BASE_RPC_URL.');
  }

  return {
    privateKey: parsed.FACILITATOR_PRIVATE_KEY as Hex,
    chains,
    port: parsed.PORT,
    host: parsed.HOST,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    corsOrigins: parsed.CORS_ORIGINS.split(',').map((s) => s.trim()),
    logLevel: parsed.LOG_LEVEL,
  };
}
