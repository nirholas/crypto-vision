/**
 * x402 Payment Configuration
 * @description Configuration for x402 payment protocol integration with EVM and SVM support
 * @author nirholas
 * @license Apache-2.0
 *
 * SECURITY DEFAULTS:
 * - Default to testnet chains for safety
 * - Require explicit opt-in for mainnet (X402_MAINNET_ENABLED=true)
 * - Conservative payment limits by default
 * - Private keys only from environment variables
 */

import type { X402Chain, X402SvmChain } from "./sdk/types.js"
import { validatePrivateKeyFormat, loadPrivateKeySecure, logSecurityEvent, isKeySourceSecure } from "./security.js"
import Logger from "@/utils/logger.js"

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Combined chain type for all supported networks
 */
export type X402Network = X402Chain | X402SvmChain

/**
 * Token address configuration per chain
 */
export interface TokenConfig {
  symbol: string
  address: string
  decimals: number
}

/**
 * Network configuration with CAIP-2 identifier
 */
export interface NetworkConfig {
  caip2: string
  name: string
  testnet: boolean
  chainType: "evm" | "svm"
  rpcUrl?: string
  tokens: TokenConfig[]
}

/**
 * Full x402 configuration from environment variables
 */
export interface X402Config {
  /** EVM private key for payments (hex string with 0x prefix) */
  evmPrivateKey?: `0x${string}`
  /** SVM (Solana) private key for payments (base58 encoded) */
  svmPrivateKey?: string
  /** Default chain for payments */
  defaultChain: X402Network
  /** Custom RPC URLs per chain */
  rpcUrls: Partial<Record<X402Network, string>>
  /** Enable gasless payments via EIP-3009 (EVM only) */
  enableGasless: boolean
  /** Facilitator URL for payment processing */
  facilitatorUrl?: string
  /** Maximum payment allowed per request (in USD) */
  maxPaymentPerRequest: string
  /** Enable debug logging */
  debug: boolean
  /** Is mainnet explicitly enabled */
  mainnetEnabled: boolean
  /** Is testnet-only mode enforced */
  testnetOnly: boolean
  /** Require payment approval for amounts above this threshold (in USD) */
  requireApprovalAbove: string
}

/**
 * Legacy alias for backward compatibility
 */
export interface LegacyX402Config {
  privateKey?: `0x${string}`
  chain: X402Chain
  rpcUrl?: string
  enableGasless: boolean
  facilitatorUrl?: string
  maxPaymentPerRequest: string
  debug: boolean
  mainnetEnabled: boolean
  testnetOnly: boolean
}

/**
 * Secure default values - intentionally conservative
 */
const SECURE_DEFAULTS = {
  /** Default to testnet for safety */
  defaultChain: "base-sepolia" as X402Network,
  /** Conservative default max payment */
  maxPayment: "1.00",
  /** Threshold for requiring approval */
  approvalThreshold: "0.50",
  /** Gasless enabled by default (safer, no gas needed) */
  enableGasless: true,
}

// ============================================================================
// Supported Networks with CAIP-2 Identifiers
// ============================================================================

/**
 * EVM chain configurations
 */
export const EVM_CHAINS: Record<X402Chain, NetworkConfig> = {
  arbitrum: {
    caip2: "eip155:42161",
    name: "Arbitrum One",
    testnet: false,
    chainType: "evm",
    tokens: [
      { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
      { symbol: "USDs", address: "0xD74f5255D557944cf7Dd0E45FF521520002D5748", decimals: 18 },
      { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    ],
  },
  "arbitrum-sepolia": {
    caip2: "eip155:421614",
    name: "Arbitrum Sepolia",
    testnet: true,
    chainType: "evm",
    tokens: [
      { symbol: "USDC", address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", decimals: 6 },
    ],
  },
  base: {
    caip2: "eip155:8453",
    name: "Base",
    testnet: false,
    chainType: "evm",
    tokens: [
      { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
      { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    ],
  },
  "base-sepolia": {
    caip2: "eip155:84532",
    name: "Base Sepolia",
    testnet: true,
    chainType: "evm",
    tokens: [
      { symbol: "USDC", address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
    ],
  },
  ethereum: {
    caip2: "eip155:1",
    name: "Ethereum",
    testnet: false,
    chainType: "evm",
    tokens: [
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
      { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
      { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EesC666c39bFFB", decimals: 18 },
    ],
  },
  polygon: {
    caip2: "eip155:137",
    name: "Polygon",
    testnet: false,
    chainType: "evm",
    tokens: [
      { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
      { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    ],
  },
  optimism: {
    caip2: "eip155:10",
    name: "Optimism",
    testnet: false,
    chainType: "evm",
    tokens: [
      { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
      { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    ],
  },
  bsc: {
    caip2: "eip155:56",
    name: "BNB Chain",
    testnet: false,
    chainType: "evm",
    tokens: [
      { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
      { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    ],
  },
}

/**
 * Solana (SVM) chain configurations
 */
export const SVM_CHAINS: Record<X402SvmChain, NetworkConfig> = {
  "solana-mainnet": {
    caip2: "solana:mainnet",
    name: "Solana Mainnet",
    testnet: false,
    chainType: "svm",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    tokens: [
      { symbol: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
      { symbol: "USDT", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
    ],
  },
  "solana-devnet": {
    caip2: "solana:devnet",
    name: "Solana Devnet",
    testnet: true,
    chainType: "svm",
    rpcUrl: "https://api.devnet.solana.com",
    tokens: [
      { symbol: "USDC", address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
    ],
  },
}

/**
 * All supported chains (EVM + SVM)
 */
export const SUPPORTED_CHAINS: Record<X402Network, NetworkConfig> = {
  ...EVM_CHAINS,
  ...SVM_CHAINS,
}

/**
 * Legacy alias for backward compatibility
 */
export const SUPPORTED_EVM_CHAINS = EVM_CHAINS

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load full x402 configuration from environment variables
 * 
 * Environment Variables:
 * - X402_EVM_PRIVATE_KEY: EVM wallet private key (hex with 0x prefix)
 * - X402_SVM_PRIVATE_KEY: Solana wallet private key (base58)
 * - X402_PRIVATE_KEY: Legacy EVM key (falls back if EVM key not set)
 * - X402_CHAIN: Default chain (e.g., "base", "solana-mainnet")
 * - X402_RPC_URL: Custom RPC URL for default chain
 * - X402_ENABLE_GASLESS: Enable gasless payments (default: true)
 * - X402_FACILITATOR_URL: Custom facilitator URL
 * - X402_MAX_PAYMENT: Maximum payment per request in USD (default: 1.00)
 * - X402_MAINNET_ENABLED: Explicitly enable mainnet chains (default: false)
 * - X402_TESTNET_ONLY: Force testnet-only mode (default: true unless mainnet enabled)
 * - X402_REQUIRE_APPROVAL_ABOVE: Threshold for requiring approval (default: 0.50)
 * - X402_DEBUG: Enable debug logging
 */
export function loadX402Config(): X402Config {
  // Load private key securely (validates format, never logs actual key)
  const evmPrivateKey = loadPrivateKeySecure() ?? undefined
  const svmPrivateKey = process.env.X402_SVM_PRIVATE_KEY

  // Check key source security
  const keySecurityCheck = isKeySourceSecure()
  if (!keySecurityCheck.secure) {
    keySecurityCheck.warnings.forEach(w => Logger.warn(`x402 Security: ${w}`))
  }

  // Check if mainnet is explicitly enabled
  const mainnetEnabled = process.env.X402_MAINNET_ENABLED === "true"
  const testnetOnly = process.env.X402_TESTNET_ONLY === "true" || !mainnetEnabled

  // Determine default chain with secure defaults
  let defaultChain: X402Network
  const envChain = process.env.X402_CHAIN as X402Network | undefined

  if (envChain) {
    const chainConfig = SUPPORTED_CHAINS[envChain]
    const isMainnetChain = chainConfig && !chainConfig.testnet

    if (isMainnetChain && !mainnetEnabled) {
      Logger.warn(
        `x402 Security: Mainnet chain "${envChain}" requested but X402_MAINNET_ENABLED is not set. ` +
        `Falling back to testnet. Set X402_MAINNET_ENABLED=true for mainnet.`
      )
      logSecurityEvent("mainnet_access", {
        requestedChain: envChain,
        allowed: false,
        reason: "mainnet_not_enabled",
      }, "warning")
      defaultChain = SECURE_DEFAULTS.defaultChain
    } else {
      defaultChain = envChain
      if (isMainnetChain) {
        logSecurityEvent("mainnet_access", {
          chain: envChain,
          allowed: true,
        }, "info")
      }
    }
  } else {
    // No chain specified - use secure default (testnet)
    defaultChain = SECURE_DEFAULTS.defaultChain
  }

  const enableGasless = process.env.X402_ENABLE_GASLESS !== "false"
  const facilitatorUrl = process.env.X402_FACILITATOR_URL
  const maxPaymentPerRequest = process.env.X402_MAX_PAYMENT || SECURE_DEFAULTS.maxPayment
  const requireApprovalAbove = process.env.X402_REQUIRE_APPROVAL_ABOVE || SECURE_DEFAULTS.approvalThreshold
  const debug = process.env.X402_DEBUG === "true"

  // Validate max payment isn't dangerously high
  const maxPayment = parseFloat(maxPaymentPerRequest)
  if (maxPayment > 100) {
    Logger.warn(
      `x402 Security: Max payment of $${maxPayment} is very high. ` +
      `Consider lowering X402_MAX_PAYMENT for safety.`
    )
    logSecurityEvent("config_changed", {
      type: "high_max_payment",
      value: maxPayment,
    }, "warning")
  }

  // Build RPC URLs from environment
  const rpcUrls: Partial<Record<X402Network, string>> = {}
  
  // Default RPC URL applies to default chain
  if (process.env.X402_RPC_URL) {
    rpcUrls[defaultChain] = process.env.X402_RPC_URL
  }
  
  // Chain-specific RPC URLs (e.g., X402_RPC_URL_BASE, X402_RPC_URL_SOLANA_MAINNET)
  for (const chain of Object.keys(SUPPORTED_CHAINS) as X402Network[]) {
    const envKey = `X402_RPC_URL_${chain.toUpperCase().replace("-", "_")}`
    if (process.env[envKey]) {
      rpcUrls[chain] = process.env[envKey]
    }
  }

  return {
    evmPrivateKey,
    svmPrivateKey,
    defaultChain,
    rpcUrls,
    enableGasless,
    facilitatorUrl,
    maxPaymentPerRequest,
    debug,
    mainnetEnabled,
    testnetOnly,
    requireApprovalAbove,
  }
}

/**
 * Load legacy x402 configuration format (for backward compatibility)
 */
export function loadLegacyX402Config(): LegacyX402Config {
  const config = loadX402Config()
  return {
    privateKey: config.evmPrivateKey,
    chain: config.defaultChain as X402Chain,
    rpcUrl: config.rpcUrls[config.defaultChain],
    enableGasless: config.enableGasless,
    facilitatorUrl: config.facilitatorUrl,
    maxPaymentPerRequest: config.maxPaymentPerRequest,
    debug: config.debug,
    mainnetEnabled: config.mainnetEnabled,
    testnetOnly: config.testnetOnly,
  }
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Check if EVM payments are configured
 */
export function isEvmConfigured(): boolean {
  return !!(process.env.X402_EVM_PRIVATE_KEY || process.env.X402_PRIVATE_KEY)
}

/**
 * Check if SVM (Solana) payments are configured
 */
export function isSvmConfigured(): boolean {
  return !!process.env.X402_SVM_PRIVATE_KEY
}

/**
 * Check if any x402 payment method is configured
 */
export function isX402Configured(): boolean {
  return isEvmConfigured() || isSvmConfigured()
}

/**
 * Get chain type from network identifier
 */
export function getChainType(network: X402Network): "evm" | "svm" {
  return SUPPORTED_CHAINS[network]?.chainType || "evm"
}

/**
 * Get CAIP-2 identifier from chain name
 */
export function getCaip2FromChain(chain: X402Network): string {
  return SUPPORTED_CHAINS[chain]?.caip2 || `eip155:1`
}

/**
 * Get chain name from CAIP-2 identifier
 */
export function getChainFromCaip2(caip2: string): X402Network | undefined {
  for (const [chain, config] of Object.entries(SUPPORTED_CHAINS)) {
    if (config.caip2 === caip2) {
      return chain as X402Network
    }
  }
  return undefined
}

/**
 * Get token configuration for a specific chain and symbol
 */
export function getTokenConfig(chain: X402Network, symbol: string): TokenConfig | undefined {
  return SUPPORTED_CHAINS[chain]?.tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase())
}

/**
 * Get USDC address for a chain (most common payment token)
 */
export function getUsdcAddress(chain: X402Network): string | undefined {
  return getTokenConfig(chain, "USDC")?.address
}

/**
 * Validate x402 configuration
 */
export function validateX402Config(config: X402Config): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Check EVM key format if provided
  if (config.evmPrivateKey) {
    if (!config.evmPrivateKey.startsWith("0x") || config.evmPrivateKey.length !== 66) {
      errors.push("X402_EVM_PRIVATE_KEY must be a valid 32-byte hex string starting with 0x")
    }
  } else {
    warnings.push("X402_EVM_PRIVATE_KEY not set - EVM payments disabled")
  }

  // Check SVM key if provided (basic validation)
  if (config.svmPrivateKey) {
    if (config.svmPrivateKey.length < 32 || config.svmPrivateKey.length > 88) {
      errors.push("X402_SVM_PRIVATE_KEY appears invalid - should be base58 encoded")
    }
  } else {
    warnings.push("X402_SVM_PRIVATE_KEY not set - Solana payments disabled")
  }

  // Check if at least one key is configured
  if (!config.evmPrivateKey && !config.svmPrivateKey) {
    errors.push("No payment keys configured - at least one of X402_EVM_PRIVATE_KEY or X402_SVM_PRIVATE_KEY required")
  }

  // Validate default chain
  if (!SUPPORTED_CHAINS[config.defaultChain]) {
    errors.push(`X402_CHAIN "${config.defaultChain}" is not supported`)
  }

  // Validate max payment
  const maxPayment = parseFloat(config.maxPaymentPerRequest)
  if (isNaN(maxPayment) || maxPayment <= 0) {
    errors.push("X402_MAX_PAYMENT must be a positive number")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
