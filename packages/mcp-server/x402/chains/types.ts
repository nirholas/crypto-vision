/**
 * @fileoverview Chain Types for x402 Multi-Chain Payment Engine
 * @description Type definitions for chain configuration
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import type { Chain } from 'viem';

/**
 * Payment token configuration
 */
export interface PaymentTokenConfig {
  /** Token contract/mint address */
  address: string;
  /** Token decimals */
  decimals: number;
  /** Token symbol (e.g., "USDC") */
  symbol: string;
  /** Token name (e.g., "USD Coin") */
  name: string;
  /** Whether this token supports EIP-3009 gasless transfers (EVM only) */
  supportsEIP3009?: boolean;
  /** SPL Token program ID (Solana only) */
  programId?: string;
}

/**
 * Native currency configuration
 */
export interface NativeCurrencyConfig {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Unified chain configuration for all supported networks
 */
export interface ChainConfig {
  /** CAIP-2 identifier (e.g., "eip155:8453", "solana:5eykt...") */
  caip2: string;
  /** Chain ID for EVM chains (undefined for non-EVM) */
  chainId?: number;
  /** Human-readable chain name */
  name: string;
  /** Network identifier */
  network: string;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer URL */
  explorerUrl: string;
  /** Whether this is a testnet */
  isTestnet: boolean;
  /** Primary payment token (USDC) */
  paymentToken: PaymentTokenConfig;
  /** Facilitator URL for payment settlement */
  facilitatorUrl?: string;
  /** Native currency configuration */
  nativeCurrency: NativeCurrencyConfig;
  /** Viem chain object (EVM only) */
  viemChain?: Chain;
  /** Solana cluster name (Solana only) */
  cluster?: string;
  /** Solana genesis hash (Solana only) */
  genesisHash?: string;
}

/**
 * Chain type discriminator
 */
export type ChainType = 'evm' | 'solana' | 'unknown';
