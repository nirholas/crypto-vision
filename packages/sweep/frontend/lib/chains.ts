import { type Chain } from "./types";

// Extended chain type with string id for UI purposes
export interface UIChain extends Omit<Chain, 'id'> {
  id: number;
  stringId: string;
}

// Supported chains configuration
export const SUPPORTED_CHAINS: UIChain[] = [
  {
    id: 1,
    stringId: "ethereum",
    name: "Ethereum",
    icon: "Ξ",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://etherscan.io",
    rpcUrl: "https://eth.llamarpc.com",
  },
  {
    id: 8453,
    stringId: "base",
    name: "Base",
    icon: "🔵",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://basescan.org",
    rpcUrl: "https://base.llamarpc.com",
  },
  {
    id: 42161,
    stringId: "arbitrum",
    name: "Arbitrum",
    icon: "🔷",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://arbiscan.io",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  {
    id: 137,
    stringId: "polygon",
    name: "Polygon",
    icon: "🟣",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    blockExplorerUrl: "https://polygonscan.com",
    rpcUrl: "https://polygon.llamarpc.com",
  },
  {
    id: 56,
    stringId: "bsc",
    name: "BNB Chain",
    icon: "🔶",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    blockExplorerUrl: "https://bscscan.com",
    rpcUrl: "https://bsc-dataseed.binance.org",
  },
  {
    id: 59144,
    stringId: "linea",
    name: "Linea",
    icon: "🟢",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrl: "https://lineascan.build",
    rpcUrl: "https://rpc.linea.build",
  },
];

// Solana special case (non-EVM)
export const SOLANA_CHAIN = {
  id: "solana",
  name: "Solana",
  icon: "◎",
  nativeCurrency: { name: "SOL", symbol: "SOL", decimals: 9 },
  blockExplorerUrl: "https://solscan.io",
  rpcUrl: "https://api.mainnet-beta.solana.com",
};

// Get chain by ID
export function getChainById(chainId: number): Chain | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId);
}

// Get chain name by ID
export function getChainName(chainId: number): string {
  return getChainById(chainId)?.name || `Chain ${chainId}`;
}

// Get explorer URL for transaction
export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const chain = getChainById(chainId);
  if (!chain) return `https://etherscan.io/tx/${txHash}`;
  return `${chain.blockExplorerUrl}/tx/${txHash}`;
}

// Get explorer URL for address
export function getExplorerAddressUrl(chainId: number, address: string): string {
  const chain = getChainById(chainId);
  if (!chain) return `https://etherscan.io/address/${address}`;
  return `${chain.blockExplorerUrl}/address/${address}`;
}

// Get explorer URL for token
export function getExplorerTokenUrl(chainId: number, address: string): string {
  const chain = getChainById(chainId);
  if (!chain) return `https://etherscan.io/token/${address}`;
  return `${chain.blockExplorerUrl}/token/${address}`;
}

// Chain colors for UI
export const CHAIN_COLORS: Record<number, string> = {
  1: "#627EEA", // Ethereum - blue
  8453: "#0052FF", // Base - blue
  42161: "#28A0F0", // Arbitrum - light blue
  137: "#8247E5", // Polygon - purple
  56: "#F0B90B", // BNB - yellow
  59144: "#61DFFF", // Linea - cyan
};

// Chain logos (using placeholder URLs - replace with actual logos)
export const CHAIN_LOGOS: Record<number, string> = {
  1: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  8453: "https://assets.coingecko.com/coins/images/31098/small/base.png",
  42161: "https://assets.coingecko.com/coins/images/16547/small/arb.png",
  137: "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
  56: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  59144: "https://assets.coingecko.com/coins/images/32138/small/linea.png",
};

// Default chain (Base for low gas)
export const DEFAULT_CHAIN_ID = 8453;

// Check if chain is supported
export function isChainSupported(chainId: number): boolean {
  return SUPPORTED_CHAINS.some((c) => c.id === chainId);
}

// Group tokens by chain
export function groupTokensByChain<T extends { chainId: number }>(
  tokens: T[]
): Record<number, T[]> {
  return tokens.reduce((acc, token) => {
    if (!acc[token.chainId]) {
      acc[token.chainId] = [];
    }
    acc[token.chainId].push(token);
    return acc;
  }, {} as Record<number, T[]>);
}
