/**
 * @fileoverview Solana Chain Implementation for x402 Payments
 * @description Configuration for Solana mainnet and devnet with USDC SPL token support
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import type { ChainConfig, PaymentTokenConfig } from './types.js';
import {
  CHAIN_NAMESPACES,
  SOLANA_GENESIS_HASHES,
  generateCAIP2,
} from './caip.js';

// ============================================================================
// USDC SPL Token Addresses
// ============================================================================

/**
 * Official USDC SPL token mint addresses on Solana
 * @see https://developers.circle.com/stablecoins/docs/usdc-on-main-networks
 */
export const SOLANA_USDC_ADDRESSES = {
  /** Solana Mainnet USDC (native, issued by Circle) */
  MAINNET: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  /** Solana Devnet USDC (test token) */
  DEVNET: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
} as const;

/**
 * Solana token program IDs
 */
export const SOLANA_PROGRAMS = {
  /** SPL Token Program */
  TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  /** SPL Token-2022 Program (for newer token features) */
  TOKEN_2022_PROGRAM: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  /** Associated Token Account Program */
  ATA_PROGRAM: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
} as const;

// ============================================================================
// Solana Chain Configurations
// ============================================================================

/**
 * Create USDC token config for Solana
 */
function createSolanaUSDCConfig(cluster: 'mainnet' | 'devnet'): PaymentTokenConfig {
  const address = cluster === 'mainnet' 
    ? SOLANA_USDC_ADDRESSES.MAINNET 
    : SOLANA_USDC_ADDRESSES.DEVNET;

  return {
    address,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    supportsEIP3009: false, // EIP-3009 is EVM-specific
    // Solana-specific extensions
    programId: SOLANA_PROGRAMS.TOKEN_PROGRAM,
  };
}

/**
 * Solana Mainnet Beta configuration
 * CAIP-2: solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
 */
export const SOLANA_MAINNET: ChainConfig = {
  caip2: generateCAIP2(CHAIN_NAMESPACES.SOLANA, SOLANA_GENESIS_HASHES.MAINNET),
  name: 'Solana',
  network: 'mainnet-beta',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  explorerUrl: 'https://solscan.io',
  isTestnet: false,
  paymentToken: createSolanaUSDCConfig('mainnet'),
  facilitatorUrl: 'https://x402.org/facilitator/solana',
  nativeCurrency: {
    name: 'SOL',
    symbol: 'SOL',
    decimals: 9,
  },
  // Solana-specific config
  cluster: 'mainnet-beta',
  genesisHash: SOLANA_GENESIS_HASHES.MAINNET,
};

/**
 * Solana Devnet configuration
 * CAIP-2: solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
 */
export const SOLANA_DEVNET: ChainConfig = {
  caip2: generateCAIP2(CHAIN_NAMESPACES.SOLANA, SOLANA_GENESIS_HASHES.DEVNET),
  name: 'Solana Devnet',
  network: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  explorerUrl: 'https://solscan.io/?cluster=devnet',
  isTestnet: true,
  paymentToken: createSolanaUSDCConfig('devnet'),
  facilitatorUrl: 'https://x402.org/facilitator/solana',
  nativeCurrency: {
    name: 'SOL',
    symbol: 'SOL',
    decimals: 9,
  },
  // Solana-specific config
  cluster: 'devnet',
  genesisHash: SOLANA_GENESIS_HASHES.DEVNET,
};

/**
 * Solana Testnet configuration (less commonly used)
 * CAIP-2: solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z
 */
export const SOLANA_TESTNET: ChainConfig = {
  caip2: generateCAIP2(CHAIN_NAMESPACES.SOLANA, SOLANA_GENESIS_HASHES.TESTNET),
  name: 'Solana Testnet',
  network: 'testnet',
  rpcUrl: 'https://api.testnet.solana.com',
  explorerUrl: 'https://solscan.io/?cluster=testnet',
  isTestnet: true,
  paymentToken: createSolanaUSDCConfig('devnet'), // Use devnet USDC for testing
  nativeCurrency: {
    name: 'SOL',
    symbol: 'SOL',
    decimals: 9,
  },
  cluster: 'testnet',
  genesisHash: SOLANA_GENESIS_HASHES.TESTNET,
};

// ============================================================================
// Solana Chain Registry
// ============================================================================

/**
 * All supported Solana chains indexed by CAIP-2 identifier
 */
export const SOLANA_CHAINS: Record<string, ChainConfig> = {
  [SOLANA_MAINNET.caip2]: SOLANA_MAINNET,
  [SOLANA_DEVNET.caip2]: SOLANA_DEVNET,
  [SOLANA_TESTNET.caip2]: SOLANA_TESTNET,
};

/**
 * Solana chains indexed by cluster name
 */
export const SOLANA_CHAINS_BY_CLUSTER: Record<string, ChainConfig> = {
  'mainnet-beta': SOLANA_MAINNET,
  mainnet: SOLANA_MAINNET,
  devnet: SOLANA_DEVNET,
  testnet: SOLANA_TESTNET,
};

/**
 * Get Solana chain config by CAIP-2 identifier
 */
export function getSolanaChainByCAIP2(caip2: string): ChainConfig | undefined {
  return SOLANA_CHAINS[caip2];
}

/**
 * Get Solana chain config by cluster name
 */
export function getSolanaChainByCluster(cluster: string): ChainConfig | undefined {
  return SOLANA_CHAINS_BY_CLUSTER[cluster];
}

/**
 * Check if an address looks like a valid Solana address (base58, 32-44 chars)
 */
export function isSolanaAddress(address: string): boolean {
  // Solana addresses are base58 encoded, typically 32-44 characters
  // They don't start with 0x like EVM addresses
  if (address.startsWith('0x')) {
    return false;
  }
  // Base58 charset: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  // (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Get the default/primary Solana chain (mainnet)
 */
export function getDefaultSolanaChain(): ChainConfig {
  return SOLANA_MAINNET;
}

/**
 * List all mainnet Solana chains
 */
export function getSolanaMainnets(): ChainConfig[] {
  return Object.values(SOLANA_CHAINS).filter(chain => !chain.isTestnet);
}

/**
 * List all testnet Solana chains
 */
export function getSolanaTestnets(): ChainConfig[] {
  return Object.values(SOLANA_CHAINS).filter(chain => chain.isTestnet);
}

/**
 * Get explorer URL for a Solana transaction
 */
export function getSolanaExplorerTxUrl(signature: string, cluster: string = 'mainnet-beta'): string {
  const chain = getSolanaChainByCluster(cluster) || SOLANA_MAINNET;
  const baseUrl = chain.explorerUrl.replace(/\?.*$/, ''); // Remove existing query params
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `${baseUrl}/tx/${signature}${clusterParam}`;
}

/**
 * Get explorer URL for a Solana account/address
 */
export function getSolanaExplorerAccountUrl(address: string, cluster: string = 'mainnet-beta'): string {
  const chain = getSolanaChainByCluster(cluster) || SOLANA_MAINNET;
  const baseUrl = chain.explorerUrl.replace(/\?.*$/, '');
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `${baseUrl}/account/${address}${clusterParam}`;
}
