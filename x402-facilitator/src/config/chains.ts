import type { ChainConfig, SupportedChainId, NetworkName } from '../types/index.js';

/** Chain configs without rpcUrl — URL is injected from env */
type ChainTemplate = Omit<ChainConfig, 'rpcUrl'>;

export const CHAIN_CONFIGS: Record<string, ChainTemplate> = {
  ethereum: {
    chainId: 1,
    network: 'ethereum',
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    blockExplorerUrl: 'https://etherscan.io',
    blockTimeMs: 12_000,
  },
  base: {
    chainId: 8453,
    network: 'base',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    blockExplorerUrl: 'https://basescan.org',
    blockTimeMs: 2_000,
  },
  baseSepolia: {
    chainId: 84532,
    network: 'base-sepolia',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    blockExplorerUrl: 'https://sepolia.basescan.org',
    blockTimeMs: 2_000,
  },
  arbitrum: {
    chainId: 42161,
    network: 'arbitrum',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    blockExplorerUrl: 'https://arbiscan.io',
    blockTimeMs: 250,
  },
  arbitrumSepolia: {
    chainId: 421614,
    network: 'arbitrum-sepolia',
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    blockExplorerUrl: 'https://sepolia.arbiscan.io',
    blockTimeMs: 250,
  },
} as const;

/**
 * Look up chain config by chain ID.
 */
export function getChainConfig(chainId: SupportedChainId): ChainTemplate {
  const config = Object.values(CHAIN_CONFIGS).find((c) => c.chainId === chainId);
  if (!config) throw new Error(`Unsupported chain ID: ${chainId}`);
  return config;
}

/**
 * Get the chain name for display.
 */
export function getNetworkName(chainId: SupportedChainId): NetworkName {
  return getChainConfig(chainId).network;
}

/**
 * All chain configs as an array (for iteration).
 */
export const SUPPORTED_CHAINS = Object.values(CHAIN_CONFIGS);
