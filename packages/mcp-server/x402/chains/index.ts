/**
 * @fileoverview Multi-Chain Payment Engine - Chain Registry
 * @description Unified chain registry and factory for x402 payments across EVM and Solana
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import { isEvmChain, isSolanaChain } from './caip.js';
import { EVM_CHAINS, getEvmChainById, isEvmAddress, BASE_MAINNET } from './evm.js';
import { SOLANA_CHAINS, SOLANA_CHAINS_BY_CLUSTER, isSolanaAddress, SOLANA_MAINNET } from './solana.js';
import type { ChainConfig, ChainType } from './types.js';

// Re-export types
export type { ChainConfig, PaymentTokenConfig, NativeCurrencyConfig, ChainType } from './types.js';

// Re-export everything from submodules
export * from './caip.js';
export * from './evm.js';
export * from './solana.js';

// ============================================================================
// Unified Chain Registry
// ============================================================================

/**
 * All supported chains indexed by CAIP-2 identifier
 */
export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ...EVM_CHAINS,
  ...SOLANA_CHAINS,
};

/**
 * Get the chain type from a CAIP-2 identifier
 */
export function getChainType(caip2: string): ChainType {
  if (isEvmChain(caip2)) return 'evm';
  if (isSolanaChain(caip2)) return 'solana';
  return 'unknown';
}

/**
 * Get chain configuration by CAIP-2 identifier or chain ID
 * 
 * @param caip2OrChainId - CAIP-2 string (e.g., "eip155:8453") or EVM chain ID number
 * @returns ChainConfig or undefined if not found
 * 
 * @example
 * ```typescript
 * // By CAIP-2
 * getChainConfig("eip155:8453")         // Base
 * getChainConfig("solana:5eykt...")     // Solana mainnet
 * 
 * // By chain ID (EVM only)
 * getChainConfig(8453)                  // Base
 * getChainConfig(1)                     // Ethereum
 * 
 * // By name (convenience)
 * getChainConfig("base")                // Base (if supported)
 * ```
 */
export function getChainConfig(caip2OrChainId: string | number): ChainConfig | undefined {
  // Handle numeric chain ID (EVM)
  if (typeof caip2OrChainId === 'number') {
    return getEvmChainById(caip2OrChainId);
  }

  // Handle CAIP-2 string
  const caip2 = caip2OrChainId;

  // Direct lookup in registry
  if (SUPPORTED_CHAINS[caip2]) {
    return SUPPORTED_CHAINS[caip2];
  }

  // Try parsing as chain name/alias
  const normalized = caip2.toLowerCase();
  
  // Check common aliases
  const aliases: Record<string, string> = {
    'base': BASE_MAINNET.caip2,
    'base-mainnet': BASE_MAINNET.caip2,
    'base-sepolia': 'eip155:84532',
    'ethereum': 'eip155:1',
    'eth': 'eip155:1',
    'mainnet': 'eip155:1',
    'arbitrum': 'eip155:42161',
    'arb': 'eip155:42161',
    'arbitrum-one': 'eip155:42161',
    'polygon': 'eip155:137',
    'matic': 'eip155:137',
    'optimism': 'eip155:10',
    'op': 'eip155:10',
    'bsc': 'eip155:56',
    'bnb': 'eip155:56',
    'solana': SOLANA_MAINNET.caip2,
    'sol': SOLANA_MAINNET.caip2,
    'solana-mainnet': SOLANA_MAINNET.caip2,
    'solana-devnet': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  };

  const aliasedCaip2 = aliases[normalized];
  if (aliasedCaip2) {
    return SUPPORTED_CHAINS[aliasedCaip2];
  }

  // Try Solana cluster lookup
  const solanaChain = SOLANA_CHAINS_BY_CLUSTER[normalized];
  if (solanaChain) {
    return solanaChain;
  }

  return undefined;
}

/**
 * Detect chain from an address format
 * 
 * @param address - The address to analyze
 * @returns Best-guess ChainConfig based on address format, or null if unknown
 * 
 * @example
 * ```typescript
 * detectChainFromAddress("0x1234...") // Returns Base (default EVM)
 * detectChainFromAddress("Gh9Zw...")  // Returns Solana mainnet
 * ```
 */
export function detectChainFromAddress(address: string): ChainConfig | null {
  // EVM addresses start with 0x and are 42 characters
  if (isEvmAddress(address)) {
    // Default to Base for EVM addresses
    return BASE_MAINNET;
  }

  // Solana addresses are base58 encoded, 32-44 characters
  if (isSolanaAddress(address)) {
    return SOLANA_MAINNET;
  }

  return null;
}

/**
 * Get all supported chains
 */
export function getAllChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS);
}

/**
 * Get all mainnet chains
 */
export function getMainnetChains(): ChainConfig[] {
  return getAllChains().filter(chain => !chain.isTestnet);
}

/**
 * Get all testnet chains
 */
export function getTestnetChains(): ChainConfig[] {
  return getAllChains().filter(chain => chain.isTestnet);
}

/**
 * Get all EVM chains
 */
export function getEvmChains(): ChainConfig[] {
  return getAllChains().filter(chain => isEvmChain(chain.caip2));
}

/**
 * Get all Solana chains
 */
export function getSolanaChains(): ChainConfig[] {
  return getAllChains().filter(chain => isSolanaChain(chain.caip2));
}

/**
 * Get the default chain for payments (Base mainnet)
 */
export function getDefaultChain(): ChainConfig {
  return BASE_MAINNET;
}

/**
 * Validate that a chain is supported
 */
export function isChainSupported(caip2OrChainId: string | number): boolean {
  return getChainConfig(caip2OrChainId) !== undefined;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(chain: ChainConfig, txHash: string): string {
  if (isEvmChain(chain.caip2)) {
    return `${chain.explorerUrl}/tx/${txHash}`;
  }
  // Solana
  const clusterParam = chain.isTestnet ? `?cluster=${chain.cluster}` : '';
  return `${chain.explorerUrl.replace(/\?.*$/, '')}/tx/${txHash}${clusterParam}`;
}

/**
 * Get explorer URL for an address
 */
export function getExplorerAddressUrl(chain: ChainConfig, address: string): string {
  if (isEvmChain(chain.caip2)) {
    return `${chain.explorerUrl}/address/${address}`;
  }
  // Solana
  const clusterParam = chain.isTestnet ? `?cluster=${chain.cluster}` : '';
  return `${chain.explorerUrl.replace(/\?.*$/, '')}/account/${address}${clusterParam}`;
}

/**
 * Format chain info for display
 */
export function formatChainInfo(chain: ChainConfig): string {
  const type = getChainType(chain.caip2);
  const testnetLabel = chain.isTestnet ? ' (testnet)' : '';
  return `${chain.name}${testnetLabel} [${type.toUpperCase()}] - ${chain.paymentToken.symbol}`;
}

/**
 * List all supported chains in a formatted way
 */
export function listSupportedChains(): string {
  const chains = getAllChains();
  const mainnets = chains.filter(c => !c.isTestnet);
  const testnets = chains.filter(c => c.isTestnet);

  let output = '## Supported Chains\n\n### Mainnets\n';
  for (const chain of mainnets) {
    output += `- ${formatChainInfo(chain)}\n`;
    output += `  CAIP-2: ${chain.caip2}\n`;
  }

  output += '\n### Testnets\n';
  for (const chain of testnets) {
    output += `- ${formatChainInfo(chain)}\n`;
    output += `  CAIP-2: ${chain.caip2}\n`;
  }

  return output;
}
