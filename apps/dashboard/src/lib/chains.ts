/**
 * @fileoverview Blockchain Chain Configuration
 * 
 * Chain colors, icons, and metadata for multi-chain token display.
 * DeFiLlama-inspired color scheme for blockchain networks.
 * 
 * @module lib/chains
 */

// =============================================================================
// TYPES
// =============================================================================

export type ChainId =
  | 'ethereum'
  | 'bsc'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'avalanche'
  | 'solana'
  | 'base'
  | 'fantom'
  | 'cronos'
  | 'gnosis'
  | 'celo'
  | 'moonbeam'
  | 'harmony'
  | 'aurora'
  | 'near'
  | 'tron'
  | 'cosmos'
  | 'polkadot'
  | 'cardano';

export interface ChainConfig {
  /** Display name */
  name: string;
  /** Short name for compact display */
  shortName: string;
  /** Background color (hex) */
  bg: string;
  /** Text color for contrast */
  text: string;
  /** Icon identifier */
  icon: string;
  /** Unicode symbol for text-only display */
  symbol: string;
  /** Chain ID (for EVM chains) */
  chainId?: number;
  /** Native currency symbol */
  nativeCurrency: string;
  /** Block explorer URL */
  explorer?: string;
}

// =============================================================================
// CHAIN COLORS & CONFIGURATION
// =============================================================================

/**
 * Chain color configuration
 * Colors match official brand guidelines for each chain
 */
export const CHAIN_COLORS: Record<ChainId, ChainConfig> = {
  ethereum: {
    name: 'Ethereum',
    shortName: 'ETH',
    bg: '#627EEA',
    text: '#FFFFFF',
    icon: 'eth',
    symbol: 'Ξ',
    chainId: 1,
    nativeCurrency: 'ETH',
    explorer: 'https://etherscan.io',
  },
  bsc: {
    name: 'BNB Chain',
    shortName: 'BSC',
    bg: '#F3BA2F',
    text: '#000000',
    icon: 'bnb',
    symbol: '◈',
    chainId: 56,
    nativeCurrency: 'BNB',
    explorer: 'https://bscscan.com',
  },
  polygon: {
    name: 'Polygon',
    shortName: 'MATIC',
    bg: '#8247E5',
    text: '#FFFFFF',
    icon: 'matic',
    symbol: '⬡',
    chainId: 137,
    nativeCurrency: 'MATIC',
    explorer: 'https://polygonscan.com',
  },
  arbitrum: {
    name: 'Arbitrum',
    shortName: 'ARB',
    bg: '#28A0F0',
    text: '#FFFFFF',
    icon: 'arb',
    symbol: '⟠',
    chainId: 42161,
    nativeCurrency: 'ETH',
    explorer: 'https://arbiscan.io',
  },
  optimism: {
    name: 'Optimism',
    shortName: 'OP',
    bg: '#FF0420',
    text: '#FFFFFF',
    icon: 'op',
    symbol: '◎',
    chainId: 10,
    nativeCurrency: 'ETH',
    explorer: 'https://optimistic.etherscan.io',
  },
  avalanche: {
    name: 'Avalanche',
    shortName: 'AVAX',
    bg: '#E84142',
    text: '#FFFFFF',
    icon: 'avax',
    symbol: '△',
    chainId: 43114,
    nativeCurrency: 'AVAX',
    explorer: 'https://snowtrace.io',
  },
  solana: {
    name: 'Solana',
    shortName: 'SOL',
    bg: '#14F195',
    text: '#000000',
    icon: 'sol',
    symbol: '◉',
    nativeCurrency: 'SOL',
    explorer: 'https://solscan.io',
  },
  base: {
    name: 'Base',
    shortName: 'BASE',
    bg: '#0052FF',
    text: '#FFFFFF',
    icon: 'base',
    symbol: '⬢',
    chainId: 8453,
    nativeCurrency: 'ETH',
    explorer: 'https://basescan.org',
  },
  fantom: {
    name: 'Fantom',
    shortName: 'FTM',
    bg: '#1969FF',
    text: '#FFFFFF',
    icon: 'ftm',
    symbol: '◇',
    chainId: 250,
    nativeCurrency: 'FTM',
    explorer: 'https://ftmscan.com',
  },
  cronos: {
    name: 'Cronos',
    shortName: 'CRO',
    bg: '#002D74',
    text: '#FFFFFF',
    icon: 'cro',
    symbol: '◆',
    chainId: 25,
    nativeCurrency: 'CRO',
    explorer: 'https://cronoscan.com',
  },
  gnosis: {
    name: 'Gnosis',
    shortName: 'GNO',
    bg: '#04795B',
    text: '#FFFFFF',
    icon: 'gno',
    symbol: '⬣',
    chainId: 100,
    nativeCurrency: 'xDAI',
    explorer: 'https://gnosisscan.io',
  },
  celo: {
    name: 'Celo',
    shortName: 'CELO',
    bg: '#FCFF52',
    text: '#000000',
    icon: 'celo',
    symbol: '○',
    chainId: 42220,
    nativeCurrency: 'CELO',
    explorer: 'https://celoscan.io',
  },
  moonbeam: {
    name: 'Moonbeam',
    shortName: 'GLMR',
    bg: '#53CBC8',
    text: '#000000',
    icon: 'glmr',
    symbol: '☽',
    chainId: 1284,
    nativeCurrency: 'GLMR',
    explorer: 'https://moonscan.io',
  },
  harmony: {
    name: 'Harmony',
    shortName: 'ONE',
    bg: '#00ADE8',
    text: '#FFFFFF',
    icon: 'one',
    symbol: '⬡',
    chainId: 1666600000,
    nativeCurrency: 'ONE',
    explorer: 'https://explorer.harmony.one',
  },
  aurora: {
    name: 'Aurora',
    shortName: 'AURORA',
    bg: '#70D44B',
    text: '#000000',
    icon: 'aurora',
    symbol: '✦',
    chainId: 1313161554,
    nativeCurrency: 'ETH',
    explorer: 'https://aurorascan.dev',
  },
  near: {
    name: 'NEAR',
    shortName: 'NEAR',
    bg: '#000000',
    text: '#FFFFFF',
    icon: 'near',
    symbol: '◯',
    nativeCurrency: 'NEAR',
    explorer: 'https://explorer.near.org',
  },
  tron: {
    name: 'TRON',
    shortName: 'TRX',
    bg: '#FF0013',
    text: '#FFFFFF',
    icon: 'trx',
    symbol: '◊',
    nativeCurrency: 'TRX',
    explorer: 'https://tronscan.org',
  },
  cosmos: {
    name: 'Cosmos',
    shortName: 'ATOM',
    bg: '#2E3148',
    text: '#FFFFFF',
    icon: 'atom',
    symbol: '⊛',
    nativeCurrency: 'ATOM',
    explorer: 'https://www.mintscan.io/cosmos',
  },
  polkadot: {
    name: 'Polkadot',
    shortName: 'DOT',
    bg: '#E6007A',
    text: '#FFFFFF',
    icon: 'dot',
    symbol: '●',
    nativeCurrency: 'DOT',
    explorer: 'https://polkadot.subscan.io',
  },
  cardano: {
    name: 'Cardano',
    shortName: 'ADA',
    bg: '#0033AD',
    text: '#FFFFFF',
    icon: 'ada',
    symbol: '₳',
    nativeCurrency: 'ADA',
    explorer: 'https://cardanoscan.io',
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get chain configuration by ID
 */
export function getChainConfig(chainId: ChainId): ChainConfig {
  return CHAIN_COLORS[chainId];
}

/**
 * Get chain by EVM chain ID
 */
export function getChainByEvmId(evmChainId: number): ChainConfig | undefined {
  const entry = Object.entries(CHAIN_COLORS).find(
    ([, config]) => config.chainId === evmChainId
  );
  return entry ? entry[1] : undefined;
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChains(): ChainId[] {
  return Object.keys(CHAIN_COLORS) as ChainId[];
}

/**
 * Check if a chain ID is valid
 */
export function isValidChain(chainId: string): chainId is ChainId {
  return chainId in CHAIN_COLORS;
}

/**
 * Get chain color as CSS inline style
 */
export function getChainStyle(chainId: ChainId): React.CSSProperties {
  const config = CHAIN_COLORS[chainId];
  return {
    backgroundColor: config.bg,
    color: config.text,
  };
}

/**
 * Get chain colors for Tailwind dynamic styling
 * Returns bg-[color] and text-[color] classes
 */
export function getChainTailwindClasses(chainId: ChainId): {
  bg: string;
  text: string;
  bgMuted: string;
} {
  const config = CHAIN_COLORS[chainId];
  return {
    bg: `bg-[${config.bg}]`,
    text: `text-[${config.text}]`,
    bgMuted: `bg-[${config.bg}]/15`,
  };
}

/**
 * Get explorer URL for a chain
 */
export function getExplorerUrl(
  chainId: ChainId,
  type: 'tx' | 'address' | 'token' = 'address',
  hash?: string
): string {
  const config = CHAIN_COLORS[chainId];
  if (!config.explorer) return '';
  
  const base = config.explorer;
  if (!hash) return base;
  
  switch (type) {
    case 'tx':
      return `${base}/tx/${hash}`;
    case 'address':
      return `${base}/address/${hash}`;
    case 'token':
      return `${base}/token/${hash}`;
    default:
      return base;
  }
}

/**
 * Popular chains for quick selection
 */
export const POPULAR_CHAINS: ChainId[] = [
  'ethereum',
  'bsc',
  'polygon',
  'arbitrum',
  'optimism',
  'avalanche',
  'solana',
  'base',
];

/**
 * EVM-compatible chains
 */
export const EVM_CHAINS: ChainId[] = [
  'ethereum',
  'bsc',
  'polygon',
  'arbitrum',
  'optimism',
  'avalanche',
  'base',
  'fantom',
  'cronos',
  'gnosis',
  'celo',
  'moonbeam',
  'harmony',
  'aurora',
];
