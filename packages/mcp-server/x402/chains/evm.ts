/**
 * @fileoverview EVM Chain Implementations for x402 Payments
 * @description Configuration for EVM-compatible chains (Base, Ethereum, Arbitrum, Polygon, etc.)
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import type { Address, Chain } from 'viem';
import {
  base,
  baseSepolia,
  mainnet,
  arbitrum,
  arbitrumSepolia,
  polygon,
  optimism,
  bsc,
} from 'viem/chains';
import type { ChainConfig, PaymentTokenConfig } from './types.js';
import { evmChainIdToCAIP2 } from './caip.js';

// ============================================================================
// USDC Contract Addresses
// ============================================================================

/**
 * Official USDC contract addresses on supported EVM chains
 * @see https://developers.circle.com/stablecoins/docs/usdc-on-main-networks
 */
export const USDC_ADDRESSES: Record<number, Address> = {
  // Mainnet chains
  [mainnet.id]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
  [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base (native USDC)
  [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum (native USDC)
  [polygon.id]: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon (native USDC)
  [optimism.id]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Optimism (native USDC)
  [bsc.id]: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BSC (bridged USDC)

  // Testnet chains
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  [arbitrumSepolia.id]: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
};

/**
 * Bridged USDC addresses (USDC.e) where native USDC also exists
 * These are the older bridged versions, prefer native USDC when available
 */
export const BRIDGED_USDC_ADDRESSES: Record<number, Address> = {
  [arbitrum.id]: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC.e on Arbitrum
  [polygon.id]: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e on Polygon
  [optimism.id]: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC.e on Optimism
};

// ============================================================================
// EVM Chain Configurations
// ============================================================================

/**
 * Default payment token configuration for EVM chains (USDC)
 */
function createUSDCConfig(chainId: number): PaymentTokenConfig {
  const address = USDC_ADDRESSES[chainId];
  if (!address) {
    throw new Error(`No USDC address configured for chain ID ${chainId}`);
  }
  
  return {
    address,
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    supportsEIP3009: true, // USDC supports gasless transfers
  };
}

/**
 * Create ChainConfig from viem Chain object
 */
function createEvmChainConfig(
  viemChain: Chain,
  options: {
    facilitatorUrl?: string;
    isTestnet?: boolean;
    rpcOverride?: string;
  } = {}
): ChainConfig {
  const chainId = viemChain.id;
  const networkName = viemChain.name.toLowerCase().replace(/\s+/g, '-');
  
  // Get RPC URL - always ensure we have a value
  const httpTransport = viemChain.rpcUrls.default?.http?.[0];
  const rpcUrl = options.rpcOverride ?? httpTransport ?? `https://rpc.ankr.com/${networkName}`;

  // Get explorer URL
  const explorerUrl = viemChain.blockExplorers?.default?.url ?? 'https://blockscan.com';

  return {
    caip2: evmChainIdToCAIP2(chainId),
    chainId,
    name: viemChain.name,
    network: networkName,
    rpcUrl,
    explorerUrl,
    isTestnet: options.isTestnet ?? viemChain.testnet ?? false,
    paymentToken: createUSDCConfig(chainId),
    facilitatorUrl: options.facilitatorUrl,
    nativeCurrency: viemChain.nativeCurrency,
    viemChain,
  };
}

// ============================================================================
// Supported EVM Chains
// ============================================================================

/**
 * Base Mainnet - PRIMARY chain for x402 payments
 * Fast, low-cost L2 built by Coinbase
 */
export const BASE_MAINNET: ChainConfig = createEvmChainConfig(base, {
  facilitatorUrl: 'https://x402.org/facilitator',
});

/**
 * Base Sepolia - Testnet for development
 */
export const BASE_SEPOLIA: ChainConfig = createEvmChainConfig(baseSepolia, {
  isTestnet: true,
  facilitatorUrl: 'https://x402.org/facilitator',
});

/**
 * Ethereum Mainnet
 * Higher gas costs, but maximum security and liquidity
 */
export const ETHEREUM_MAINNET: ChainConfig = createEvmChainConfig(mainnet);

/**
 * Arbitrum One - L2 with wide DeFi support
 */
export const ARBITRUM_ONE: ChainConfig = createEvmChainConfig(arbitrum);

/**
 * Arbitrum Sepolia - Testnet
 */
export const ARBITRUM_SEPOLIA: ChainConfig = createEvmChainConfig(arbitrumSepolia, {
  isTestnet: true,
});

/**
 * Polygon PoS - Low-cost L2 with wide adoption
 */
export const POLYGON_MAINNET: ChainConfig = createEvmChainConfig(polygon);

/**
 * Optimism - OP Stack L2
 */
export const OPTIMISM_MAINNET: ChainConfig = createEvmChainConfig(optimism);

/**
 * BNB Smart Chain - EVM-compatible L1
 */
export const BSC_MAINNET: ChainConfig = createEvmChainConfig(bsc);

// ============================================================================
// EVM Chain Registry
// ============================================================================

/**
 * All supported EVM chains indexed by CAIP-2 identifier
 */
export const EVM_CHAINS: Record<string, ChainConfig> = {
  // Mainnets
  [BASE_MAINNET.caip2]: BASE_MAINNET,
  [ETHEREUM_MAINNET.caip2]: ETHEREUM_MAINNET,
  [ARBITRUM_ONE.caip2]: ARBITRUM_ONE,
  [POLYGON_MAINNET.caip2]: POLYGON_MAINNET,
  [OPTIMISM_MAINNET.caip2]: OPTIMISM_MAINNET,
  [BSC_MAINNET.caip2]: BSC_MAINNET,

  // Testnets
  [BASE_SEPOLIA.caip2]: BASE_SEPOLIA,
  [ARBITRUM_SEPOLIA.caip2]: ARBITRUM_SEPOLIA,
};

/**
 * EVM chains indexed by chain ID
 */
export const EVM_CHAINS_BY_ID: Record<number, ChainConfig> = {
  [base.id]: BASE_MAINNET,
  [baseSepolia.id]: BASE_SEPOLIA,
  [mainnet.id]: ETHEREUM_MAINNET,
  [arbitrum.id]: ARBITRUM_ONE,
  [arbitrumSepolia.id]: ARBITRUM_SEPOLIA,
  [polygon.id]: POLYGON_MAINNET,
  [optimism.id]: OPTIMISM_MAINNET,
  [bsc.id]: BSC_MAINNET,
};

/**
 * Get EVM chain config by chain ID
 */
export function getEvmChainById(chainId: number): ChainConfig | undefined {
  return EVM_CHAINS_BY_ID[chainId];
}

/**
 * Get EVM chain config by CAIP-2 identifier
 */
export function getEvmChainByCAIP2(caip2: string): ChainConfig | undefined {
  return EVM_CHAINS[caip2];
}

/**
 * Check if an address looks like a valid EVM address
 */
export function isEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * List all mainnet EVM chains
 */
export function getEvmMainnets(): ChainConfig[] {
  return Object.values(EVM_CHAINS).filter(chain => !chain.isTestnet);
}

/**
 * List all testnet EVM chains
 */
export function getEvmTestnets(): ChainConfig[] {
  return Object.values(EVM_CHAINS).filter(chain => chain.isTestnet);
}

/**
 * Get the default/primary EVM chain (Base)
 */
export function getDefaultEvmChain(): ChainConfig {
  return BASE_MAINNET;
}
