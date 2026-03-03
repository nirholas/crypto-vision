/**
 * Test Fixtures
 * Sample data for testing various scenarios
 */

import type { Address } from "viem";
import { DeFiProtocol, RiskLevel, DeFiProductType } from "../../src/services/defi/types.js";

// ============================================================
// Token Fixtures by Chain
// ============================================================

export const TOKENS = {
  ethereum: {
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 1.0,
    },
    USDT: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      priceUsd: 1.0,
    },
    DAI: {
      address: "0x6B175474E89094C44Da98b954EedeC8" as Address,
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      priceUsd: 1.0,
    },
    WETH: {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      priceUsd: 2500.0,
    },
    WBTC: {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address,
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      decimals: 8,
      priceUsd: 45000.0,
    },
    stETH: {
      address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as Address,
      symbol: "stETH",
      name: "Lido Staked ETH",
      decimals: 18,
      priceUsd: 2490.0,
    },
  },
  arbitrum: {
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 1.0,
    },
    "USDC.e": {
      address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8" as Address,
      symbol: "USDC.e",
      name: "Bridged USDC",
      decimals: 6,
      priceUsd: 1.0,
    },
    USDT: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as Address,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      priceUsd: 1.0,
    },
    WETH: {
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as Address,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      priceUsd: 2500.0,
    },
    ARB: {
      address: "0x912CE59144191C1204E64559FE8253a0e49E6548" as Address,
      symbol: "ARB",
      name: "Arbitrum",
      decimals: 18,
      priceUsd: 1.2,
    },
  },
  polygon: {
    USDC: {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 1.0,
    },
    "USDC.e": {
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as Address,
      symbol: "USDC.e",
      name: "Bridged USDC",
      decimals: 6,
      priceUsd: 1.0,
    },
    WMATIC: {
      address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" as Address,
      symbol: "WMATIC",
      name: "Wrapped Matic",
      decimals: 18,
      priceUsd: 0.8,
    },
  },
  base: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 1.0,
    },
    WETH: {
      address: "0x4200000000000000000000000000000000000006" as Address,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      priceUsd: 2500.0,
    },
    cbETH: {
      address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" as Address,
      symbol: "cbETH",
      name: "Coinbase Wrapped Staked ETH",
      decimals: 18,
      priceUsd: 2550.0,
    },
  },
  optimism: {
    USDC: {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priceUsd: 1.0,
    },
    WETH: {
      address: "0x4200000000000000000000000000000000000006" as Address,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      priceUsd: 2500.0,
    },
    OP: {
      address: "0x4200000000000000000000000000000000000042" as Address,
      symbol: "OP",
      name: "Optimism",
      decimals: 18,
      priceUsd: 2.5,
    },
  },
};

// ============================================================
// DeFi Vault Fixtures
// ============================================================

export const VAULTS = {
  aaveUSDC: {
    address: "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c" as Address,
    name: "Aave USDC",
    symbol: "aUSDC",
    protocol: DeFiProtocol.AAVE,
    chain: "ethereum",
    productType: DeFiProductType.LENDING,
    apy: 0.035,
    apyBase: 0.035,
    apyReward: 0,
    tvlUsd: 500000000,
    riskLevel: RiskLevel.LOW,
    depositToken: TOKENS.ethereum.USDC,
    receiptToken: {
      address: "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c" as Address,
      symbol: "aUSDC",
      name: "Aave USDC",
      decimals: 6,
    },
  },
  aaveWETH: {
    address: "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8" as Address,
    name: "Aave WETH",
    symbol: "aWETH",
    protocol: DeFiProtocol.AAVE,
    chain: "ethereum",
    productType: DeFiProductType.LENDING,
    apy: 0.02,
    apyBase: 0.02,
    apyReward: 0,
    tvlUsd: 2000000000,
    riskLevel: RiskLevel.LOW,
    depositToken: TOKENS.ethereum.WETH,
    receiptToken: {
      address: "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8" as Address,
      symbol: "aWETH",
      name: "Aave WETH",
      decimals: 18,
    },
  },
  yearnUSDC: {
    address: "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE" as Address,
    name: "Yearn USDC Vault",
    symbol: "yvUSDC",
    protocol: DeFiProtocol.YEARN,
    chain: "ethereum",
    productType: DeFiProductType.YIELD_AGGREGATOR,
    apy: 0.055,
    apyBase: 0.04,
    apyReward: 0.015,
    tvlUsd: 100000000,
    riskLevel: RiskLevel.MEDIUM,
    depositToken: TOKENS.ethereum.USDC,
    receiptToken: {
      address: "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE" as Address,
      symbol: "yvUSDC",
      name: "Yearn USDC",
      decimals: 6,
    },
  },
  beefyUSDC: {
    address: "0x1234567890123456789012345678901234567890" as Address,
    name: "Beefy USDC Vault",
    symbol: "mooUSDC",
    protocol: DeFiProtocol.BEEFY,
    chain: "arbitrum",
    productType: DeFiProductType.YIELD_AGGREGATOR,
    apy: 0.065,
    apyBase: 0.045,
    apyReward: 0.02,
    tvlUsd: 25000000,
    riskLevel: RiskLevel.MEDIUM,
    depositToken: TOKENS.arbitrum.USDC,
    receiptToken: {
      address: "0x1234567890123456789012345678901234567890" as Address,
      symbol: "mooUSDC",
      name: "Moo USDC",
      decimals: 6,
    },
  },
  lidoStETH: {
    address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as Address,
    name: "Lido Staked ETH",
    symbol: "stETH",
    protocol: DeFiProtocol.LIDO,
    chain: "ethereum",
    productType: DeFiProductType.LIQUID_STAKING,
    apy: 0.038,
    apyBase: 0.038,
    apyReward: 0,
    tvlUsd: 30000000000,
    riskLevel: RiskLevel.LOW,
    depositToken: {
      address: "0x0000000000000000000000000000000000000000" as Address,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
    },
    receiptToken: TOKENS.ethereum.stETH,
  },
};

// ============================================================
// Position Fixtures
// ============================================================

export const POSITIONS = {
  aaveUSDCPosition: {
    id: "pos-aave-usdc-1",
    userId: "user-123",
    protocol: DeFiProtocol.AAVE,
    chain: "ethereum",
    vault: VAULTS.aaveUSDC,
    depositedAmount: "1000000000", // 1000 USDC
    depositedValueUsd: 1000,
    currentAmount: "1035000000", // 1035 USDC (with yield)
    currentValueUsd: 1035,
    unrealizedPnl: 35,
    apy: 0.035,
    entryTimestamp: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
    lastUpdateTimestamp: Date.now(),
  },
  yearnUSDCPosition: {
    id: "pos-yearn-usdc-1",
    userId: "user-123",
    protocol: DeFiProtocol.YEARN,
    chain: "ethereum",
    vault: VAULTS.yearnUSDC,
    depositedAmount: "500000000", // 500 USDC
    depositedValueUsd: 500,
    currentAmount: "527500000", // 527.5 USDC
    currentValueUsd: 527.5,
    unrealizedPnl: 27.5,
    apy: 0.055,
    entryTimestamp: Date.now() - 365 * 24 * 60 * 60 * 1000,
    lastUpdateTimestamp: Date.now(),
  },
};

// ============================================================
// Dust Token Scenarios
// ============================================================

export const DUST_SCENARIOS = {
  // Small dust across multiple chains
  multiChainDust: {
    ethereum: [
      { ...TOKENS.ethereum.USDC, balance: 5000000n, valueUsd: 5.0, isDust: true },
      { ...TOKENS.ethereum.USDT, balance: 3500000n, valueUsd: 3.5, isDust: true },
      { ...TOKENS.ethereum.DAI, balance: 2000000000000000000n, valueUsd: 2.0, isDust: true },
    ],
    arbitrum: [
      { ...TOKENS.arbitrum.USDC, balance: 8000000n, valueUsd: 8.0, isDust: true },
      { ...TOKENS.arbitrum.ARB, balance: 5000000000000000000n, valueUsd: 6.0, isDust: true },
    ],
    polygon: [
      { ...TOKENS.polygon.USDC, balance: 4000000n, valueUsd: 4.0, isDust: true },
    ],
    base: [
      { ...TOKENS.base.USDC, balance: 9500000n, valueUsd: 9.5, isDust: true },
    ],
  },
  
  // Mix of dust and non-dust tokens
  mixedPortfolio: {
    ethereum: [
      { ...TOKENS.ethereum.USDC, balance: 1000000000n, valueUsd: 1000.0, isDust: false },
      { ...TOKENS.ethereum.USDT, balance: 5000000n, valueUsd: 5.0, isDust: true },
      { ...TOKENS.ethereum.WETH, balance: 100000000000000000n, valueUsd: 250.0, isDust: false },
      { ...TOKENS.ethereum.WBTC, balance: 10000n, valueUsd: 4.5, isDust: true },
    ],
  },
  
  // Edge case: All tokens below gas threshold
  unprofitableDust: {
    ethereum: [
      { ...TOKENS.ethereum.USDC, balance: 500000n, valueUsd: 0.5, isDust: true },
      { ...TOKENS.ethereum.USDT, balance: 800000n, valueUsd: 0.8, isDust: true },
    ],
  },
  
  // Empty wallet
  emptyWallet: {
    ethereum: [],
    arbitrum: [],
  },
};

// ============================================================
// Bridge Route Fixtures
// ============================================================

export const BRIDGE_ROUTES = {
  ethToArbitrum: {
    sourceChain: "ethereum",
    destinationChain: "arbitrum",
    sourceToken: TOKENS.ethereum.USDC.address,
    destinationToken: TOKENS.arbitrum.USDC.address,
    amount: 100000000n, // 100 USDC
    estimatedTime: 120, // 2 minutes
    fees: {
      bridgeFee: 100000n, // 0.1 USDC
      gasFee: 500000n, // 0.5 USDC
      relayerFee: 200000n, // 0.2 USDC
    },
    expectedOutput: 99200000n, // 99.2 USDC
  },
  arbToBase: {
    sourceChain: "arbitrum",
    destinationChain: "base",
    sourceToken: TOKENS.arbitrum.USDC.address,
    destinationToken: TOKENS.base.USDC.address,
    amount: 50000000n, // 50 USDC
    estimatedTime: 180, // 3 minutes
    fees: {
      bridgeFee: 50000n,
      gasFee: 100000n,
      relayerFee: 50000n,
    },
    expectedOutput: 49800000n, // 49.8 USDC
  },
};

// ============================================================
// User Fixtures
// ============================================================

export const USERS = {
  testUser1: {
    id: "user-123",
    address: "0x1234567890123456789012345678901234567890" as Address,
    email: "test@example.com",
    createdAt: new Date("2024-01-01"),
  },
  testUser2: {
    id: "user-456",
    address: "0x0987654321098765432109876543210987654321" as Address,
    email: "user2@example.com",
    createdAt: new Date("2024-06-01"),
  },
};

// ============================================================
// Sweep Job Fixtures
// ============================================================

export const SWEEP_JOBS = {
  pendingJob: {
    id: "sweep-001",
    userId: USERS.testUser1.id,
    status: "pending",
    chains: ["ethereum", "arbitrum"],
    tokensToSweep: 5,
    estimatedValueUsd: 25.5,
    estimatedGasUsd: 2.0,
    estimatedNetValueUsd: 23.5,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  completedJob: {
    id: "sweep-002",
    userId: USERS.testUser1.id,
    status: "completed",
    chains: ["polygon"],
    tokensToSweep: 3,
    estimatedValueUsd: 15.0,
    actualValueUsd: 14.8,
    estimatedGasUsd: 0.5,
    actualGasUsd: 0.45,
    netValueUsd: 14.35,
    txHashes: ["0xabc123...", "0xdef456..."],
    createdAt: new Date(Date.now() - 3600000),
    completedAt: new Date(),
    updatedAt: new Date(),
  },
  failedJob: {
    id: "sweep-003",
    userId: USERS.testUser2.id,
    status: "failed",
    chains: ["ethereum"],
    tokensToSweep: 1,
    estimatedValueUsd: 8.0,
    error: "Insufficient gas",
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(),
  },
};

// ============================================================
// Quote Fixtures
// ============================================================

export const QUOTE_FIXTURES = {
  simpleSwap: {
    inputToken: TOKENS.ethereum.WETH,
    outputToken: TOKENS.ethereum.USDC,
    inputAmount: "1000000000000000000", // 1 WETH
    expectedOutput: "2500000000", // 2500 USDC
    priceImpact: 0.1, // 0.1%
    estimatedGas: "200000",
    estimatedGasUsd: 15.0,
  },
  dustSwap: {
    inputToken: TOKENS.arbitrum.ARB,
    outputToken: TOKENS.arbitrum.USDC,
    inputAmount: "5000000000000000000", // 5 ARB
    expectedOutput: "6000000", // 6 USDC
    priceImpact: 0.5, // 0.5%
    estimatedGas: "150000",
    estimatedGasUsd: 0.05,
  },
};
