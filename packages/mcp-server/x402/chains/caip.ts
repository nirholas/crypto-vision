/**
 * @fileoverview CAIP-2 (Chain Agnostic Improvement Proposal 2) Utilities
 * @description Parse, generate, and validate CAIP-2 chain identifiers
 * @see https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

/**
 * Parsed CAIP-2 identifier components
 */
export interface CAIP2Identifier {
  /** Namespace (e.g., "eip155" for EVM, "solana" for Solana) */
  namespace: string;
  /** Reference (chain-specific identifier, e.g., "8453" for Base) */
  reference: string;
  /** Original full identifier string */
  full: string;
}

/**
 * Chain namespace constants
 */
export const CHAIN_NAMESPACES = {
  EVM: 'eip155',
  SOLANA: 'solana',
  COSMOS: 'cosmos',
  BITCOIN: 'bip122',
  POLKADOT: 'polkadot',
} as const;

export type ChainNamespace = (typeof CHAIN_NAMESPACES)[keyof typeof CHAIN_NAMESPACES];

/**
 * Well-known Solana cluster genesis hashes (used as CAIP-2 references)
 */
export const SOLANA_GENESIS_HASHES = {
  /** Solana Mainnet Beta */
  MAINNET: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  /** Solana Devnet */
  DEVNET: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  /** Solana Testnet */
  TESTNET: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
} as const;

/**
 * CAIP-2 format regex pattern
 * Format: namespace:reference
 * - namespace: [-a-z0-9]{3,8}
 * - reference: [-_a-zA-Z0-9]{1,64}
 */
const CAIP2_REGEX = /^(?<namespace>[-a-z0-9]{3,8}):(?<reference>[-_a-zA-Z0-9]{1,64})$/;

/**
 * Parse a CAIP-2 identifier string into its components
 * 
 * @param caip2 - The CAIP-2 identifier string (e.g., "eip155:8453")
 * @returns Parsed CAIP-2 components or null if invalid
 * 
 * @example
 * ```typescript
 * parseCAIP2("eip155:8453")
 * // { namespace: "eip155", reference: "8453", full: "eip155:8453" }
 * 
 * parseCAIP2("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
 * // { namespace: "solana", reference: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", full: "..." }
 * 
 * parseCAIP2("invalid")
 * // null
 * ```
 */
export function parseCAIP2(caip2: string): CAIP2Identifier | null {
  const match = caip2.match(CAIP2_REGEX);
  if (!match?.groups) {
    return null;
  }

  const { namespace, reference } = match.groups;
  if (!namespace || !reference) {
    return null;
  }

  return {
    namespace,
    reference,
    full: caip2,
  };
}

/**
 * Generate a CAIP-2 identifier from namespace and reference
 * 
 * @param namespace - The chain namespace (e.g., "eip155", "solana")
 * @param reference - The chain reference (e.g., chain ID for EVM, genesis hash for Solana)
 * @returns CAIP-2 identifier string
 * 
 * @example
 * ```typescript
 * generateCAIP2("eip155", "8453")  // "eip155:8453"
 * generateCAIP2("solana", "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
 * ```
 */
export function generateCAIP2(namespace: string, reference: string | number): string {
  const refStr = String(reference);
  const caip2 = `${namespace}:${refStr}`;
  
  if (!isValidCAIP2(caip2)) {
    throw new Error(`Invalid CAIP-2 components: namespace="${namespace}", reference="${refStr}"`);
  }
  
  return caip2;
}

/**
 * Generate CAIP-2 identifier for an EVM chain
 * 
 * @param chainId - The EVM chain ID
 * @returns CAIP-2 identifier (e.g., "eip155:8453")
 */
export function evmChainIdToCAIP2(chainId: number): string {
  return generateCAIP2(CHAIN_NAMESPACES.EVM, chainId);
}

/**
 * Extract EVM chain ID from CAIP-2 identifier
 * 
 * @param caip2 - The CAIP-2 identifier
 * @returns Chain ID number or null if not an EVM chain
 * 
 * @example
 * ```typescript
 * caip2ToEvmChainId("eip155:8453")  // 8453
 * caip2ToEvmChainId("solana:...")   // null
 * ```
 */
export function caip2ToEvmChainId(caip2: string): number | null {
  const parsed = parseCAIP2(caip2);
  if (!parsed || parsed.namespace !== CHAIN_NAMESPACES.EVM) {
    return null;
  }
  
  const chainId = parseInt(parsed.reference, 10);
  return isNaN(chainId) ? null : chainId;
}

/**
 * Check if a CAIP-2 identifier represents an EVM chain
 */
export function isEvmChain(caip2: string): boolean {
  const parsed = parseCAIP2(caip2);
  return parsed?.namespace === CHAIN_NAMESPACES.EVM;
}

/**
 * Check if a CAIP-2 identifier represents a Solana chain
 */
export function isSolanaChain(caip2: string): boolean {
  const parsed = parseCAIP2(caip2);
  return parsed?.namespace === CHAIN_NAMESPACES.SOLANA;
}

/**
 * Validate a CAIP-2 identifier string
 * 
 * @param caip2 - The string to validate
 * @returns True if valid CAIP-2 format
 */
export function isValidCAIP2(caip2: string): boolean {
  return CAIP2_REGEX.test(caip2);
}

/**
 * Get human-readable name for a chain namespace
 */
export function getNamespaceName(namespace: string): string {
  const names: Record<string, string> = {
    [CHAIN_NAMESPACES.EVM]: 'EVM',
    [CHAIN_NAMESPACES.SOLANA]: 'Solana',
    [CHAIN_NAMESPACES.COSMOS]: 'Cosmos',
    [CHAIN_NAMESPACES.BITCOIN]: 'Bitcoin',
    [CHAIN_NAMESPACES.POLKADOT]: 'Polkadot',
  };
  return names[namespace] || namespace.toUpperCase();
}

/**
 * Get Solana cluster name from CAIP-2 identifier
 * 
 * @param caip2 - The CAIP-2 identifier for Solana
 * @returns Cluster name ('mainnet', 'devnet', 'testnet') or null
 */
export function getSolanaCluster(caip2: string): 'mainnet' | 'devnet' | 'testnet' | null {
  const parsed = parseCAIP2(caip2);
  if (!parsed || parsed.namespace !== CHAIN_NAMESPACES.SOLANA) {
    return null;
  }

  switch (parsed.reference) {
    case SOLANA_GENESIS_HASHES.MAINNET:
      return 'mainnet';
    case SOLANA_GENESIS_HASHES.DEVNET:
      return 'devnet';
    case SOLANA_GENESIS_HASHES.TESTNET:
      return 'testnet';
    default:
      return null;
  }
}

/**
 * Generate Solana CAIP-2 identifier from cluster name
 * 
 * @param cluster - The Solana cluster name
 * @returns CAIP-2 identifier
 */
export function solanaClusterToCAIP2(cluster: 'mainnet' | 'devnet' | 'testnet'): string {
  const genesisHash = {
    mainnet: SOLANA_GENESIS_HASHES.MAINNET,
    devnet: SOLANA_GENESIS_HASHES.DEVNET,
    testnet: SOLANA_GENESIS_HASHES.TESTNET,
  }[cluster];

  return generateCAIP2(CHAIN_NAMESPACES.SOLANA, genesisHash);
}
