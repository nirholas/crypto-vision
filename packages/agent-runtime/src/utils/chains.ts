/**
 * Multi-chain Configuration
 *
 * Re-exports and extends chain configs from ERC-8004 contracts.
 * @see https://erc8004.agency
 */

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
  currency: { name: string; symbol: string; decimals: number };
  contracts: {
    identity: string;
    reputation: string;
    validation?: string;
  };
  agentRegistry: string;
  testnet: boolean;
}

/**
 * Deterministic CREATE2 addresses — identical on every testnet chain.
 */
const TESTNET_CONTRACTS = {
  identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
  validation: '0x8004Cb1BF31DAf7788923b405b754f57acEB4272',
} as const;

/**
 * Mainnet addresses — separate deployment bytecode, still 0x8004 prefix.
 */
const MAINNET_CONTRACTS = {
  identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
} as const;

export const CHAINS: Record<string, ChainConfig> = {
  'bsc-testnet': {
    name: 'BSC Testnet',
    chainId: 97,
    rpcUrl: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    explorer: 'https://testnet.bscscan.com',
    currency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    contracts: { ...TESTNET_CONTRACTS },
    agentRegistry: `eip155:97:${TESTNET_CONTRACTS.identity}`,
    testnet: true,
  },
  'bsc-mainnet': {
    name: 'BSC Mainnet',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.bnbchain.org',
    explorer: 'https://bscscan.com',
    currency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    contracts: { ...MAINNET_CONTRACTS },
    agentRegistry: `eip155:56:${MAINNET_CONTRACTS.identity}`,
    testnet: false,
  },
  'opbnb-testnet': {
    name: 'opBNB Testnet',
    chainId: 5611,
    rpcUrl: 'https://opbnb-testnet-rpc.bnbchain.org',
    explorer: 'https://testnet.opbnbscan.com',
    currency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    contracts: { ...TESTNET_CONTRACTS },
    agentRegistry: `eip155:5611:${TESTNET_CONTRACTS.identity}`,
    testnet: true,
  },
  'opbnb-mainnet': {
    name: 'opBNB',
    chainId: 204,
    rpcUrl: 'https://opbnb-mainnet-rpc.bnbchain.org',
    explorer: 'https://opbnbscan.com',
    currency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    contracts: { ...MAINNET_CONTRACTS },
    agentRegistry: `eip155:204:${MAINNET_CONTRACTS.identity}`,
    testnet: false,
  },
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    currency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    contracts: { ...MAINNET_CONTRACTS },
    agentRegistry: `eip155:1:${MAINNET_CONTRACTS.identity}`,
    testnet: false,
  },
  sepolia: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
    currency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
    contracts: { ...TESTNET_CONTRACTS },
    agentRegistry: `eip155:11155111:${TESTNET_CONTRACTS.identity}`,
    testnet: true,
  },
  'base-sepolia': {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    currency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    contracts: { ...TESTNET_CONTRACTS },
    agentRegistry: `eip155:84532:${TESTNET_CONTRACTS.identity}`,
    testnet: true,
  },
  'arbitrum-sepolia': {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    currency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    contracts: { ...TESTNET_CONTRACTS },
    agentRegistry: `eip155:421614:${TESTNET_CONTRACTS.identity}`,
    testnet: true,
  },
  'optimism-sepolia': {
    name: 'Optimism Sepolia',
    chainId: 11155420,
    rpcUrl: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimistic.etherscan.io',
    currency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    contracts: { ...TESTNET_CONTRACTS },
    agentRegistry: `eip155:11155420:${TESTNET_CONTRACTS.identity}`,
    testnet: true,
  },
  'polygon-amoy': {
    name: 'Polygon Amoy',
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
    currency: { name: 'POL', symbol: 'POL', decimals: 18 },
    contracts: { ...TESTNET_CONTRACTS },
    agentRegistry: `eip155:80002:${TESTNET_CONTRACTS.identity}`,
    testnet: true,
  },
};

/**
 * Resolve a chain config by chain ID, name, or key.
 */
export function resolveChain(input: string | number): ChainConfig {
  // Direct key match
  if (typeof input === 'string' && CHAINS[input]) return CHAINS[input];

  // Chain ID match
  const chainId = typeof input === 'number' ? input : parseInt(input, 10);
  if (!isNaN(chainId)) {
    const found = Object.values(CHAINS).find((c) => c.chainId === chainId);
    if (found) return found;
  }

  // Fuzzy name match
  if (typeof input === 'string') {
    const normalized = input.toLowerCase().replace(/[\s-_]/g, '');
    const found = Object.values(CHAINS).find(
      (c) => c.name.toLowerCase().replace(/[\s-_]/g, '') === normalized
    );
    if (found) return found;
  }

  throw new Error(`Unknown chain: ${input}. Available: ${Object.keys(CHAINS).join(', ')}`);
}

/**
 * Get all supported chain keys.
 */
export function getSupportedChains(): string[] {
  return Object.keys(CHAINS);
}

/**
 * Get all testnet chain configs.
 */
export function getTestnetChains(): ChainConfig[] {
  return Object.values(CHAINS).filter((c) => c.testnet);
}

/**
 * Get all mainnet chain configs.
 */
export function getMainnetChains(): ChainConfig[] {
  return Object.values(CHAINS).filter((c) => !c.testnet);
}
