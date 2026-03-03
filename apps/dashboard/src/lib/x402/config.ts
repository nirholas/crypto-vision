/**
 * x402 Configuration
 *
 * Central configuration for x402 payment protocol
 * @see https://docs.x402.org
 */

// =============================================================================
// NETWORK CONFIGURATION (CAIP-2 Standard)
// =============================================================================

export const NETWORKS = {
  // EVM Networks
  BASE_MAINNET: 'eip155:8453',
  BASE_SEPOLIA: 'eip155:84532',

  // Solana Networks
  SOLANA_MAINNET: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  SOLANA_DEVNET: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
} as const;

export type NetworkId = (typeof NETWORKS)[keyof typeof NETWORKS];

/**
 * Current network based on environment
 */
export const CURRENT_NETWORK: NetworkId =
  (process.env.X402_NETWORK as NetworkId) ||
  (process.env.NODE_ENV === 'production' ? NETWORKS.BASE_MAINNET : NETWORKS.BASE_SEPOLIA);

// =============================================================================
// FACILITATOR CONFIGURATION
// =============================================================================

export const FACILITATORS = {
  /** x402.org - Testnet only, no setup required */
  X402_ORG: 'https://x402.org/facilitator',

  /** CDP Facilitator - Production ready, requires CDP API keys */
  CDP: 'https://api.cdp.coinbase.com/platform/v2/x402',

  /** PayAI - Multi-chain support (Solana, Base, Polygon, etc.) */
  PAYAI: 'https://facilitator.payai.network',

  /** x402.rs - Community Rust implementation */
  X402_RS: 'https://facilitator.x402.rs',
} as const;

/**
 * Active facilitator URL
 */
export const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ||
  (process.env.NODE_ENV === 'production' ? FACILITATORS.CDP : FACILITATORS.X402_ORG);

// =============================================================================
// PAYMENT ADDRESS
// =============================================================================

/**
 * Payment receiving address (your wallet)
 * CRITICAL: Set X402_PAYMENT_ADDRESS in production!
 */
export const PAYMENT_ADDRESS =
  (process.env.X402_PAYMENT_ADDRESS as `0x${string}`) ||
  ('0x0000000000000000000000000000000000000000' as `0x${string}`);

// Warn if not configured in production
if (
  typeof window === 'undefined' &&
  process.env.NODE_ENV === 'production' &&
  PAYMENT_ADDRESS === '0x0000000000000000000000000000000000000000'
) {
  console.error('[x402] CRITICAL: X402_PAYMENT_ADDRESS not set! Configure your wallet address.');
}

// =============================================================================
// TOKEN CONFIGURATION
// =============================================================================

/**
 * USDC token addresses by network
 */
export const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  // Base
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  // Ethereum
  'eip155:1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum Mainnet
  'eip155:11155111': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
  // Polygon
  'eip155:137': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon Mainnet (native USDC)
  'eip155:80001': '0x0FA8781a83E46826621b3BC094Ea2A0212e71B23', // Mumbai (deprecated)
  'eip155:80002': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Amoy
  // Arbitrum
  'eip155:42161': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum One
  'eip155:421614': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
  // Optimism
  'eip155:10': '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Optimism Mainnet
  'eip155:11155420': '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // OP Sepolia
};

/**
 * Native token (ETH/MATIC/SOL) for gas estimation
 */
export const NATIVE_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  'eip155:8453': { symbol: 'ETH', decimals: 18 },
  'eip155:84532': { symbol: 'ETH', decimals: 18 },
  'eip155:1': { symbol: 'ETH', decimals: 18 },
  'eip155:137': { symbol: 'MATIC', decimals: 18 },
  'eip155:42161': { symbol: 'ETH', decimals: 18 },
  'eip155:10': { symbol: 'ETH', decimals: 18 },
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': { symbol: 'SOL', decimals: 9 },
};

/**
 * Get USDC address for current network
 */
export const USDC_ADDRESS = USDC_ADDRESSES[CURRENT_NETWORK];

/**
 * Supported payment networks for display
 */
export const SUPPORTED_PAYMENT_NETWORKS = [
  {
    id: 'eip155:8453',
    name: 'Base',
    testnet: false,
    usdc: USDC_ADDRESSES['eip155:8453'],
    explorer: 'https://basescan.org',
    recommended: true,
    gasCost: 'Very Low (~$0.001)',
  },
  {
    id: 'eip155:84532',
    name: 'Base Sepolia',
    testnet: true,
    usdc: USDC_ADDRESSES['eip155:84532'],
    explorer: 'https://sepolia.basescan.org',
    recommended: false,
    gasCost: 'Free (testnet)',
  },
  {
    id: 'eip155:137',
    name: 'Polygon',
    testnet: false,
    usdc: USDC_ADDRESSES['eip155:137'],
    explorer: 'https://polygonscan.com',
    recommended: true,
    gasCost: 'Very Low (~$0.01)',
  },
  {
    id: 'eip155:42161',
    name: 'Arbitrum',
    testnet: false,
    usdc: USDC_ADDRESSES['eip155:42161'],
    explorer: 'https://arbiscan.io',
    recommended: true,
    gasCost: 'Low (~$0.05)',
  },
  {
    id: 'eip155:10',
    name: 'Optimism',
    testnet: false,
    usdc: USDC_ADDRESSES['eip155:10'],
    explorer: 'https://optimistic.etherscan.io',
    recommended: false,
    gasCost: 'Low (~$0.05)',
  },
  {
    id: 'eip155:1',
    name: 'Ethereum',
    testnet: false,
    usdc: USDC_ADDRESSES['eip155:1'],
    explorer: 'https://etherscan.io',
    recommended: false,
    gasCost: 'High (~$2-10)',
  },
];

/**
 * Get network info by ID
 */
export function getNetworkInfo(networkId: string) {
  return SUPPORTED_PAYMENT_NETWORKS.find((n) => n.id === networkId);
}

/**
 * Get all supported networks (optionally filter testnets)
 */
export function getSupportedNetworks(includeTestnets = false) {
  return SUPPORTED_PAYMENT_NETWORKS.filter((n) => includeTestnets || !n.testnet);
}
