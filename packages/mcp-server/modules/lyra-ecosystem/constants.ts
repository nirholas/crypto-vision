/**
 * Lyra Ecosystem Constants
 * @description Configuration constants and defaults for Lyra services
 * @author nirholas
 * @license Apache-2.0
 */

// ============================================================================
// Service URLs
// ============================================================================

export const LYRA_SERVICE_URLS = {
  intel: {
    production: "https://api.lyra-intel.dev",
    staging: "https://staging.lyra-intel.dev",
  },
  registry: {
    production: "https://api.lyra-registry.dev",
    staging: "https://staging.lyra-registry.dev",
  },
  discovery: {
    production: "https://api.lyra-discovery.dev",
    staging: "https://staging.lyra-discovery.dev",
  },
} as const;

// ============================================================================
// GitHub Repos (reference)
// ============================================================================

export const LYRA_REPOS = {
  intel: "nirholas/lyra-intel",
  registry: "nirholas/lyra-registry",
  discovery: "nirholas/lyra-tool-discovery",
} as const;

// ============================================================================
// Pricing Configuration (USD)
// ============================================================================

export const LYRA_PRICES = {
  // Lyra Intel
  intel: {
    fileAnalysis: "0.00",
    securityScan: "0.05",
    repoAudit: "0.10",
    enterpriseAnalysis: "1.00",
  },
  // Lyra Registry
  registry: {
    browse: "0.00",
    toolDetails: "0.01",
    privateRegistration: "0.05",
    featuredListing: "10.00", // Monthly
  },
  // Lyra Tool Discovery
  discovery: {
    basicDiscovery: "0.00",
    compatibility: "0.02",
    generateConfig: "0.10",
    fullAssistance: "0.50",
  },
} as const;

// ============================================================================
// Rate Limits (requests per minute for free tier)
// ============================================================================

export const LYRA_RATE_LIMITS = {
  intel: {
    free: 10,
    paid: 100,
  },
  registry: {
    free: 60,
    paid: 600,
  },
  discovery: {
    free: 30,
    paid: 300,
  },
} as const;

// ============================================================================
// Payment Networks - Full Multi-Chain Support
// ============================================================================

/**
 * Supported payment networks with CAIP-2 identifiers
 * https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md
 */
export const LYRA_NETWORKS = {
  // EVM Chains
  base: {
    caip2: "eip155:8453",
    name: "Base",
    chainId: 8453,
    type: "evm" as const,
    testnet: false,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    gasToken: "ETH",
  },
  "base-sepolia": {
    caip2: "eip155:84532",
    name: "Base Sepolia",
    chainId: 84532,
    type: "evm" as const,
    testnet: true,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    gasToken: "ETH",
  },
  arbitrum: {
    caip2: "eip155:42161",
    name: "Arbitrum One",
    chainId: 42161,
    type: "evm" as const,
    testnet: false,
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usds: "0xD74f5255D557944cf7Dd0E45FF521520002D5748", // Sperax USDs
    gasToken: "ETH",
  },
  "arbitrum-sepolia": {
    caip2: "eip155:421614",
    name: "Arbitrum Sepolia",
    chainId: 421614,
    type: "evm" as const,
    testnet: true,
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    gasToken: "ETH",
  },
  bsc: {
    caip2: "eip155:56",
    name: "BNB Smart Chain",
    chainId: 56,
    type: "evm" as const,
    testnet: false,
    usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    usdt: "0x55d398326f99059fF775485246999027B3197955",
    gasToken: "BNB",
  },
  "bsc-testnet": {
    caip2: "eip155:97",
    name: "BNB Testnet",
    chainId: 97,
    type: "evm" as const,
    testnet: true,
    usdc: "0x64544969ed7EBf5f083679233325356EbE738930",
    gasToken: "BNB",
  },
  ethereum: {
    caip2: "eip155:1",
    name: "Ethereum",
    chainId: 1,
    type: "evm" as const,
    testnet: false,
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    gasToken: "ETH",
  },
  polygon: {
    caip2: "eip155:137",
    name: "Polygon",
    chainId: 137,
    type: "evm" as const,
    testnet: false,
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    gasToken: "MATIC",
  },
  optimism: {
    caip2: "eip155:10",
    name: "Optimism",
    chainId: 10,
    type: "evm" as const,
    testnet: false,
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    gasToken: "ETH",
  },
  // Solana Chains
  "solana-mainnet": {
    caip2: "solana:mainnet",
    name: "Solana Mainnet",
    chainId: "mainnet-beta",
    type: "svm" as const,
    testnet: false,
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    gasToken: "SOL",
  },
  "solana-devnet": {
    caip2: "solana:devnet",
    name: "Solana Devnet",
    chainId: "devnet",
    type: "svm" as const,
    testnet: true,
    usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    gasToken: "SOL",
  },
} as const;

export type LyraNetworkId = keyof typeof LYRA_NETWORKS;
export type LyraNetworkConfig = typeof LYRA_NETWORKS[LyraNetworkId];

/** Legacy array for backward compatibility */
export const LYRA_SUPPORTED_NETWORKS = Object.values(LYRA_NETWORKS).map(n => n.caip2);

/** Default network for payments */
export const LYRA_DEFAULT_NETWORK = "base" as LyraNetworkId;

/** Recommended networks by use case */
export const LYRA_RECOMMENDED_NETWORKS = {
  /** Lowest fees, fast finality */
  lowCost: ["base", "arbitrum", "bsc"] as LyraNetworkId[],
  /** Most secure, battle-tested */
  secure: ["ethereum", "base", "arbitrum"] as LyraNetworkId[],
  /** Best for non-EVM users */
  solana: ["solana-mainnet"] as LyraNetworkId[],
  /** For testing */
  testnet: ["base-sepolia", "arbitrum-sepolia", "bsc-testnet", "solana-devnet"] as LyraNetworkId[],
  /** Yield-bearing payments with USDs */
  yieldBearing: ["arbitrum"] as LyraNetworkId[],
} as const;

// ============================================================================
// Sperax USDs Integration (Yield-Bearing Stablecoin)
// ============================================================================

/**
 * Sperax ecosystem contract addresses
 * USDs is a yield-bearing stablecoin - holders automatically earn yield!
 * https://docs.sperax.io/
 */
export const SPERAX_CONTRACTS = {
  arbitrum: {
    /** USDs - Yield-bearing stablecoin */
    usds: "0xD74f5255D557944cf7Dd0E45FF521520002D5748",
    /** SPA - Governance token */
    spa: "0x5575552988A3A80504bBaeB1311674fCFd40aD4B",
    /** xSPA - Staked SPA */
    xspa: "0x0966E72256d6055145902F72F9D3B6a194B9cCc3",
    /** veSPA - Vote-escrowed SPA (proxy) */
    vespa: "0x2e2071180682Ce6C247B1eF93d382D509F5F6A17",
  },
  ethereum: {
    /** SPA L1 */
    spa: "0xB4A3B0Faf0Ab53df58001804DdA5Bfc6a3D59008",
    /** wSPA (wrapped) */
    wspa: "0x2a95FE4c7e64e09856989F9eA0b57B9AB5f770CB",
    /** veSPA (proxy) */
    vespa: "0xbF82a3212e13b2d407D10f5107b5C8404dE7F403",
  },
  bsc: {
    /** SPA on BSC */
    spa: "0x1A9Fd6eC3144Da3Dd6Ea13Ec1C25C58423a379b1",
  },
} as const;

/**
 * Why use USDs for Lyra payments?
 * 
 * 1. **Auto-Yield**: Earn ~5-10% APY just by holding USDs
 * 2. **No Staking Required**: Yield is automatic, no lock-up
 * 3. **AI Agent Friendly**: Agents earn while idle
 * 4. **Arbitrum Native**: Low fees, fast transactions
 * 
 * Example: An AI agent with $100 in USDs earns ~$5-10/year passively
 */
export const USDS_BENEFITS = {
  autoYield: true,
  estimatedApy: "5-10%",
  noStakingRequired: true,
  supportedChains: ["arbitrum"],
  rebaseFrequency: "daily",
} as const;

// ============================================================================
// Supported Payment Tokens
// ============================================================================

export type PaymentToken = "USDC" | "USDT" | "USDs" | "DAI";

export const PAYMENT_TOKENS: Record<PaymentToken, {
  name: string;
  decimals: number;
  yieldBearing: boolean;
  chains: LyraNetworkId[];
}> = {
  USDC: {
    name: "USD Coin",
    decimals: 6,
    yieldBearing: false,
    chains: ["base", "arbitrum", "bsc", "ethereum", "polygon", "optimism", "solana-mainnet"],
  },
  USDT: {
    name: "Tether USD",
    decimals: 6,
    yieldBearing: false,
    chains: ["bsc", "ethereum", "polygon", "optimism"],
  },
  USDs: {
    name: "Sperax USD (Yield-Bearing)",
    decimals: 18,
    yieldBearing: true,
    chains: ["arbitrum"],
  },
  DAI: {
    name: "Dai Stablecoin",
    decimals: 18,
    yieldBearing: false,
    chains: ["ethereum"],
  },
};

/** Default token per chain */
export const DEFAULT_TOKEN_PER_CHAIN: Record<LyraNetworkId, PaymentToken> = {
  base: "USDC",
  "base-sepolia": "USDC",
  arbitrum: "USDs",  // Prefer yield-bearing on Arbitrum!
  "arbitrum-sepolia": "USDC",
  bsc: "USDT",
  "bsc-testnet": "USDC",
  ethereum: "USDC",
  polygon: "USDC",
  optimism: "USDC",
  "solana-mainnet": "USDC",
  "solana-devnet": "USDC",
};

// ============================================================================
// Facilitator Configuration
// ============================================================================

export const LYRA_FACILITATOR_URL = "https://x402.org/facilitator";

/** Chain-specific facilitators (if different from default) */
export const LYRA_CHAIN_FACILITATORS: Partial<Record<LyraNetworkId, string>> = {
  // All chains use the default facilitator for now
  // "bsc": "https://bsc.x402.org/facilitator",
};

// ============================================================================
// Treasury Addresses per Chain
// ============================================================================

export const LYRA_TREASURY_ADDRESSES = {
  // EVM chains use the same address
  evm: "0x742d35Cc6634C0532925a3b844Bc9e7595f50a1a",
  // Solana has a different address format
  solana: "LyraT8kuFd5G7TnJMVpxQh5xJHHmRZQKWPDxvPZQnXk",
} as const;

/** Legacy single address */
export const LYRA_TREASURY_ADDRESS = LYRA_TREASURY_ADDRESSES.evm;

// ============================================================================
// API Version
// ============================================================================

export const LYRA_API_VERSION = "v1";

// ============================================================================
// Cache Configuration
// ============================================================================

export const LYRA_CACHE_CONFIG = {
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 1000,
  enabledByDefault: true,
} as const;

// ============================================================================
// Supported Languages for Lyra Intel
// ============================================================================

export const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "java",
  "kotlin",
  "swift",
  "c",
  "cpp",
  "csharp",
  "ruby",
  "php",
  "solidity",
  "move",
  "cairo",
] as const;

// ============================================================================
// Tool Categories for Lyra Registry
// ============================================================================

export const TOOL_CATEGORIES = [
  "ai-ml",
  "blockchain",
  "data",
  "devops",
  "finance",
  "gaming",
  "media",
  "productivity",
  "security",
  "social",
  "utilities",
  "web3",
] as const;

// ============================================================================
// Protocol Types for Lyra Discovery
// ============================================================================

export const DISCOVERABLE_PROTOCOLS = [
  "mcp",
  "openapi",
  "graphql",
  "grpc",
  "rest",
  "websocket",
] as const;
