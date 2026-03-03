/**
 * @file addresses.ts
 * @author nirholas
 * @copyright (c) 2026 nichxbt
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * 
 * Contract addresses for deployed marketplace contracts
 */

export type ChainId = 
  | 42161    // Arbitrum One
  | 421614   // Arbitrum Sepolia
  | 8453     // Base
  | 84532    // Base Sepolia
  | 10       // Optimism
  | 11155420 // Optimism Sepolia

export interface ContractAddresses {
  toolRegistry: `0x${string}`;
  revenueRouter: `0x${string}`;
  toolStaking: `0x${string}`;
  usdsToken: `0x${string}`;
}

// TODO(nich): Update with deployed addresses
export const CONTRACT_ADDRESSES: Record<ChainId, ContractAddresses> = {
  // Arbitrum One (Mainnet)
  42161: {
    toolRegistry: '0x0000000000000000000000000000000000000000',
    revenueRouter: '0x0000000000000000000000000000000000000000',
    toolStaking: '0x0000000000000000000000000000000000000000',
    usdsToken: '0xD74f5255D557944cf7Dd0E45FF521520002D5748', // USDs on Arbitrum
  },
  
  // Arbitrum Sepolia (Testnet)
  421614: {
    toolRegistry: '0x0000000000000000000000000000000000000000',
    revenueRouter: '0x0000000000000000000000000000000000000000',
    toolStaking: '0x0000000000000000000000000000000000000000',
    usdsToken: '0x0000000000000000000000000000000000000000', // Mock USDs
  },
  
  // Base (Mainnet)
  8453: {
    toolRegistry: '0x0000000000000000000000000000000000000000',
    revenueRouter: '0x0000000000000000000000000000000000000000',
    toolStaking: '0x0000000000000000000000000000000000000000',
    usdsToken: '0x820C137fa70C8691f0e44Dc420a5e53c168921Dc', // USDs on Base
  },
  
  // Base Sepolia (Testnet)
  84532: {
    toolRegistry: '0x0000000000000000000000000000000000000000',
    revenueRouter: '0x0000000000000000000000000000000000000000',
    toolStaking: '0x0000000000000000000000000000000000000000',
    usdsToken: '0x0000000000000000000000000000000000000000',
  },
  
  // Optimism (Mainnet)
  10: {
    toolRegistry: '0x0000000000000000000000000000000000000000',
    revenueRouter: '0x0000000000000000000000000000000000000000',
    toolStaking: '0x0000000000000000000000000000000000000000',
    usdsToken: '0x0000000000000000000000000000000000000000',
  },
  
  // Optimism Sepolia (Testnet)
  11155420: {
    toolRegistry: '0x0000000000000000000000000000000000000000',
    revenueRouter: '0x0000000000000000000000000000000000000000',
    toolStaking: '0x0000000000000000000000000000000000000000',
    usdsToken: '0x0000000000000000000000000000000000000000',
  },
};

export function getContractAddresses(chainId: ChainId): ContractAddresses {
  const addresses = CONTRACT_ADDRESSES[chainId];
  if (!addresses) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return addresses;
}

export function isTestnet(chainId: ChainId): boolean {
  return [421614, 84532, 11155420].includes(chainId);
}

export function getChainName(chainId: ChainId): string {
  const names: Record<ChainId, string> = {
    42161: 'Arbitrum One',
    421614: 'Arbitrum Sepolia',
    8453: 'Base',
    84532: 'Base Sepolia',
    10: 'Optimism',
    11155420: 'Optimism Sepolia',
  };
  return names[chainId] || `Unknown (${chainId})`;
}

// ucm:n1ch-0las-4e49
