/**
 * @fileoverview X402 Server Configuration
 * @description Configuration management for x402 server infrastructure
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { Address } from 'viem';
import type { X402Chain, X402Token } from '../sdk/types.js';
import type { X402ServerConfig, FacilitatorConfig } from './types.js';
import Logger from '@/utils/logger.js';

// ============================================================================
// Environment Variable Names
// ============================================================================

const ENV_VARS = {
  SERVER_WALLET: 'X402_SERVER_WALLET',
  SERVER_PRIVATE_KEY: 'X402_SERVER_PRIVATE_KEY',
  DEFAULT_CHAIN: 'X402_DEFAULT_CHAIN',
  DEFAULT_TOKEN: 'X402_DEFAULT_TOKEN',
  FACILITATOR_TYPE: 'X402_FACILITATOR_TYPE',
  FACILITATOR_URL: 'X402_FACILITATOR_URL',
  FACILITATOR_API_KEY: 'X402_FACILITATOR_API_KEY',
  FACILITATOR_API_SECRET: 'X402_FACILITATOR_API_SECRET',
  FACILITATOR_WEBHOOK_SECRET: 'X402_FACILITATOR_WEBHOOK_SECRET',
  ENABLE_ANALYTICS: 'X402_ENABLE_ANALYTICS',
  ANALYTICS_PATH: 'X402_ANALYTICS_PATH',
  DEBUG: 'X402_DEBUG',
  RPC_ARBITRUM: 'X402_RPC_ARBITRUM',
  RPC_BASE: 'X402_RPC_BASE',
  RPC_ETHEREUM: 'X402_RPC_ETHEREUM',
  RPC_POLYGON: 'X402_RPC_POLYGON',
  RPC_OPTIMISM: 'X402_RPC_OPTIMISM',
  RPC_BSC: 'X402_RPC_BSC',
};

// ============================================================================
// Defaults
// ============================================================================

const DEFAULTS: Omit<X402ServerConfig, 'walletAddress'> & { walletAddress?: Address } = {
  walletAddress: undefined,
  defaultChain: 'arbitrum',
  defaultToken: 'USDs',
  enableAnalytics: true,
  analyticsPath: './data/x402-payments.json',
  debug: false,
};

// ============================================================================
// Configuration Loading
// ============================================================================

// Cached config
let cachedConfig: X402ServerConfig | null = null;

/**
 * Load x402 server configuration from environment variables
 */
export function loadX402ServerConfig(): X402ServerConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = process.env;

  // Build RPC URLs map
  const rpcUrls: Partial<Record<X402Chain, string>> = {};
  if (env[ENV_VARS.RPC_ARBITRUM]) rpcUrls.arbitrum = env[ENV_VARS.RPC_ARBITRUM];
  if (env[ENV_VARS.RPC_BASE]) rpcUrls.base = env[ENV_VARS.RPC_BASE];
  if (env[ENV_VARS.RPC_ETHEREUM]) rpcUrls.ethereum = env[ENV_VARS.RPC_ETHEREUM];
  if (env[ENV_VARS.RPC_POLYGON]) rpcUrls.polygon = env[ENV_VARS.RPC_POLYGON];
  if (env[ENV_VARS.RPC_OPTIMISM]) rpcUrls.optimism = env[ENV_VARS.RPC_OPTIMISM];
  if (env[ENV_VARS.RPC_BSC]) rpcUrls.bsc = env[ENV_VARS.RPC_BSC];

  // Build facilitator config if provided
  let facilitator: FacilitatorConfig | undefined;
  if (env[ENV_VARS.FACILITATOR_TYPE] || env[ENV_VARS.FACILITATOR_URL]) {
    facilitator = {
      type: (env[ENV_VARS.FACILITATOR_TYPE] as 'coinbase' | 'self-hosted') || 'self-hosted',
      url: env[ENV_VARS.FACILITATOR_URL] || '',
      apiKey: env[ENV_VARS.FACILITATOR_API_KEY],
      apiSecret: env[ENV_VARS.FACILITATOR_API_SECRET],
      webhookSecret: env[ENV_VARS.FACILITATOR_WEBHOOK_SECRET],
    };
  }

  const config: X402ServerConfig = {
    walletAddress: (env[ENV_VARS.SERVER_WALLET] as Address) || DEFAULTS.walletAddress!,
    privateKey: env[ENV_VARS.SERVER_PRIVATE_KEY] as `0x${string}` | undefined,
    defaultChain: (env[ENV_VARS.DEFAULT_CHAIN] as X402Chain) || DEFAULTS.defaultChain,
    defaultToken: (env[ENV_VARS.DEFAULT_TOKEN] as X402Token) || DEFAULTS.defaultToken,
    facilitator,
    rpcUrls: Object.keys(rpcUrls).length > 0 ? rpcUrls : undefined,
    enableAnalytics: env[ENV_VARS.ENABLE_ANALYTICS] !== 'false',
    analyticsPath: env[ENV_VARS.ANALYTICS_PATH] || DEFAULTS.analyticsPath,
    debug: env[ENV_VARS.DEBUG] === 'true',
  };

  cachedConfig = config;
  return config;
}

/**
 * Check if server is properly configured
 */
export function isX402ServerConfigured(): boolean {
  const config = loadX402ServerConfig();
  return !!config.walletAddress;
}

/**
 * Validate server configuration
 */
export function validateX402ServerConfig(config: X402ServerConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check wallet address
  if (!config.walletAddress) {
    errors.push(`Missing ${ENV_VARS.SERVER_WALLET} - Required to receive payments`);
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(config.walletAddress)) {
    errors.push(`Invalid wallet address format: ${config.walletAddress}`);
  }

  // Check private key format if provided
  if (config.privateKey && !/^0x[a-fA-F0-9]{64}$/.test(config.privateKey)) {
    errors.push('Invalid private key format');
  }

  // Check chain
  const validChains: X402Chain[] = ['arbitrum', 'arbitrum-sepolia', 'base', 'ethereum', 'polygon', 'optimism', 'bsc'];
  if (!validChains.includes(config.defaultChain)) {
    errors.push(`Invalid chain: ${config.defaultChain}. Must be one of: ${validChains.join(', ')}`);
  }

  // Check token
  const validTokens: X402Token[] = ['USDs', 'USDC', 'USDT', 'DAI', 'ETH', 'SOL'];
  if (!validTokens.includes(config.defaultToken)) {
    errors.push(`Invalid token: ${config.defaultToken}. Must be one of: ${validTokens.join(', ')}`);
  }

  // Warnings
  if (!config.facilitator) {
    warnings.push('No facilitator configured - payments will be verified on-chain only');
  }

  if (config.defaultChain.includes('sepolia')) {
    warnings.push('Using testnet chain - for development only');
  }

  if (!config.privateKey) {
    warnings.push('No private key configured - some features like signing may be unavailable');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Clear cached config (for testing)
 */
export function clearX402ServerConfigCache(): void {
  cachedConfig = null;
}

/**
 * Set config programmatically (for testing or custom setup)
 */
export function setX402ServerConfig(config: X402ServerConfig): void {
  cachedConfig = config;
}

// ============================================================================
// Configuration Display
// ============================================================================

/**
 * Get safe config for logging (no secrets)
 */
export function getSafeConfigForLogging(config: X402ServerConfig): Record<string, unknown> {
  return {
    walletAddress: config.walletAddress ? `${config.walletAddress.slice(0, 6)}...${config.walletAddress.slice(-4)}` : 'not set',
    hasPrivateKey: !!config.privateKey,
    defaultChain: config.defaultChain,
    defaultToken: config.defaultToken,
    facilitatorType: config.facilitator?.type || 'none',
    enableAnalytics: config.enableAnalytics,
    debug: config.debug,
  };
}

/**
 * Log current configuration
 */
export function logX402ServerConfig(): void {
  const config = loadX402ServerConfig();
  const safe = getSafeConfigForLogging(config);
  
  Logger.info('x402 Server Configuration:');
  Object.entries(safe).forEach(([key, value]) => {
    Logger.info(`  ${key}: ${value}`);
  });

  const validation = validateX402ServerConfig(config);
  if (validation.errors.length > 0) {
    validation.errors.forEach(err => Logger.error(`  Error: ${err}`));
  }
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warn => Logger.warn(`  Warning: ${warn}`));
  }
}
