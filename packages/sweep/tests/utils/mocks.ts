/**
 * Test Mock Factories
 * Centralized mocks for external services and viem clients
 */

import { vi } from "vitest";
import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { DeFiProtocol, RiskLevel, DeFiProductType } from "../../src/services/defi/types.js";

// ============================================================
// Viem Client Mocks
// ============================================================

export function createMockPublicClient(overrides: Partial<PublicClient> = {}): PublicClient {
  return {
    chain: { id: 1, name: "Ethereum" },
    readContract: vi.fn(),
    simulateContract: vi.fn(),
    estimateGas: vi.fn().mockResolvedValue(200000n),
    getGasPrice: vi.fn().mockResolvedValue(30000000000n), // 30 gwei
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n), // 1 ETH
    getBlock: vi.fn().mockResolvedValue({ timestamp: BigInt(Date.now() / 1000) }),
    getBlockNumber: vi.fn().mockResolvedValue(18000000n),
    multicall: vi.fn(),
    call: vi.fn(),
    ...overrides,
  } as unknown as PublicClient;
}

export function createMockWalletClient(overrides: Partial<WalletClient> = {}): WalletClient {
  return {
    chain: { id: 1, name: "Ethereum" },
    account: { address: "0x1234567890123456789012345678901234567890" as Address },
    sendTransaction: vi.fn().mockResolvedValue("0xtxhash" as Hex),
    signMessage: vi.fn().mockResolvedValue("0xsignature" as Hex),
    signTypedData: vi.fn().mockResolvedValue("0xtypedSignature" as Hex),
    writeContract: vi.fn().mockResolvedValue("0xcontracttxhash" as Hex),
    ...overrides,
  } as unknown as WalletClient;
}

// ============================================================
// DeFi API Response Mocks
// ============================================================

export const mockAaveReserveData = {
  unbacked: 0n,
  accruedToTreasuryScaled: 0n,
  totalAToken: 1000000000000n, // 1M tokens (6 decimals)
  totalStableDebt: 0n,
  totalVariableDebt: 500000000000n,
  liquidityRate: 30000000000000000000000000n, // ~3% APY in ray
  variableBorrowRate: 50000000000000000000000000n,
  stableBorrowRate: 60000000000000000000000000n,
  averageStableBorrowRate: 55000000000000000000000000n,
  liquidityIndex: 1050000000000000000000000000n,
  variableBorrowIndex: 1100000000000000000000000000n,
  lastUpdateTimestamp: Math.floor(Date.now() / 1000),
};

export const mockAaveUserAccountData = {
  totalCollateralBase: 10000000000n, // $10,000 in 8 decimals
  totalDebtBase: 5000000000n,
  availableBorrowsBase: 3000000000n,
  currentLiquidationThreshold: 8500n,
  ltv: 8000n,
  healthFactor: 1500000000000000000n, // 1.5
};

export const mockAaveReserveConfigData = {
  decimals: 6n,
  ltv: 8000n,
  liquidationThreshold: 8500n,
  liquidationBonus: 10500n,
  reserveFactor: 1000n,
  usageAsCollateralEnabled: true,
  borrowingEnabled: true,
  stableBorrowRateEnabled: false,
  isActive: true,
  isFrozen: false,
};

export const mockYearnVaultResponse = {
  address: "0x1234567890123456789012345678901234567890",
  name: "USDC Vault",
  symbol: "yvUSDC",
  version: "3.0.0",
  decimals: 6,
  token: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
  tvl: {
    totalAssets: "100000000000",
    tvl: 100000000,
    price: 1,
  },
  apy: {
    type: "v3:averaged",
    gross_apr: 0.05,
    net_apy: 0.045,
    fees: {
      performance: 0.1,
      management: 0.02,
    },
    points: {
      week_ago: 0.04,
      month_ago: 0.045,
      inception: 0.042,
    },
  },
  strategies: [
    {
      address: "0x9876543210987654321098765432109876543210",
      name: "USDC Strategy",
      description: "Optimized USDC yield farming",
    },
  ],
  endorsed: true,
  kind: "Vault",
  category: "Stablecoin",
  staking: { available: false },
  migration: { available: false },
  featuringScore: 0.95,
};

export const mockBeefyVaultResponse = {
  id: "aave-usdc",
  name: "Aave USDC",
  token: "aUSDC",
  tokenAddress: "0x1234567890123456789012345678901234567890",
  earnedToken: "mooAaveUSDC",
  earnedTokenAddress: "0x0987654321098765432109876543210987654321",
  earnContractAddress: "0x0987654321098765432109876543210987654321",
  oracle: "tokens",
  oracleId: "USDC",
  status: "active",
  platformId: "aave",
  assets: ["USDC"],
  risks: ["COMPLEXITY_LOW", "BATTLE_TESTED"],
  strategyTypeId: "single",
  buyTokenUrl: "https://app.1inch.io/#/1/swap/ETH/USDC",
  network: "ethereum",
  createdAt: 1640000000,
  chain: "ethereum",
  apy: 0.035,
  tvlUsd: 50000000,
  pricePerFullShare: "1050000",
};

// ============================================================
// DEX API Response Mocks
// ============================================================

export const mock1InchQuoteResponse = {
  toAmount: "995000000", // 995 USDC (6 decimals) - 0.5% slippage
  fromToken: {
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  toToken: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  protocols: [[{ name: "UNISWAP_V3", part: 100 }]],
  estimatedGas: 200000,
};

export const mock1InchSwapResponse = {
  ...mock1InchQuoteResponse,
  tx: {
    from: "0x1234567890123456789012345678901234567890",
    to: "0x1111111254EEB25477B68fb85Ed929f73A960582",
    data: "0x12345678",
    value: "0",
    gas: 200000,
    gasPrice: "30000000000",
  },
};

export const mockParaswapQuoteResponse = {
  priceRoute: {
    blockNumber: 18000000,
    destAmount: "996000000",
    destToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    srcAmount: "1000000000000000000",
    srcToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    gasCost: "180000",
    gasCostUSD: "5.40",
    bestRoute: [
      {
        percent: 100,
        swaps: [
          {
            srcToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            destToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            exchange: "UniswapV3",
          },
        ],
      },
    ],
  },
};

export const mockCowswapQuoteResponse = {
  quote: {
    sellToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    buyToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    sellAmount: "1000000000000000000",
    buyAmount: "997000000",
    feeAmount: "1000000000000000",
    validTo: Math.floor(Date.now() / 1000) + 3600,
    kind: "sell",
    partiallyFillable: false,
    receiver: "0x1234567890123456789012345678901234567890",
  },
  id: "order-id-123",
  from: "0x1234567890123456789012345678901234567890",
};

// ============================================================
// Bridge API Response Mocks
// ============================================================

export const mockAcrossQuoteResponse = {
  totalRelayFee: {
    pct: "0.001", // 0.1%
    total: "1000000",
  },
  relayerCapitalFee: {
    pct: "0.0005",
    total: "500000",
  },
  relayerGasFee: {
    pct: "0.0003",
    total: "300000",
  },
  lpFee: {
    pct: "0.0002",
    total: "200000",
  },
  timestamp: Date.now(),
  isAmountTooLow: false,
  quoteBlock: "18000000",
  spokePoolAddress: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
  destinationSpokePoolAddress: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
  expectedFillTime: 120, // 2 minutes
};

export const mockStargateQuoteResponse = {
  amountLD: "998000000",
  minAmountLD: "993000000",
  fee: {
    lzFee: "2000000",
    protocolFee: "1000000",
  },
  estimatedTime: 300, // 5 minutes
};

export const mockLiFiQuoteResponse = {
  id: "lifi-quote-123",
  type: "lifi",
  tool: "stargate",
  action: {
    fromChainId: 1,
    toChainId: 42161,
    fromToken: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
      chainId: 1,
    },
    toToken: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      symbol: "USDC",
      decimals: 6,
      chainId: 42161,
    },
    fromAmount: "1000000000",
    slippage: 0.005,
  },
  estimate: {
    fromAmount: "1000000000",
    toAmount: "997000000",
    toAmountMin: "992000000",
    approvalAddress: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
    gasCosts: [{ estimate: "150000", token: { symbol: "ETH" } }],
    executionDuration: 180,
  },
  transactionRequest: {
    to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
    data: "0x...",
    value: "0",
  },
};

// ============================================================
// Wallet/Token Mocks
// ============================================================

export const mockTokenBalances = [
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    balance: 5000000n, // 5 USDC
    valueUsd: 5.0,
    isDust: true,
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    balance: 3500000n, // 3.5 USDT
    valueUsd: 3.5,
    isDust: true,
  },
  {
    address: "0x6B175474E89094C44Da98b954EescdeCB5" as Address,
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    balance: 8000000000000000000n, // 8 DAI
    valueUsd: 8.0,
    isDust: true,
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address,
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    balance: 100000n, // 0.001 WBTC
    valueUsd: 45.0,
    isDust: false,
  },
];

export const mockChainBalances = [
  {
    chain: "ethereum",
    tokens: mockTokenBalances,
    totalValueUsd: 61.5,
    dustCount: 3,
    dustValueUsd: 16.5,
  },
  {
    chain: "arbitrum",
    tokens: [
      {
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address,
        symbol: "USDC",
        decimals: 6,
        balance: 7500000n,
        valueUsd: 7.5,
        isDust: true,
      },
    ],
    totalValueUsd: 7.5,
    dustCount: 1,
    dustValueUsd: 7.5,
  },
];

// ============================================================
// Price API Mocks
// ============================================================

export const mockCoinGeckoResponse = {
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
    usd: 1.0,
    usd_24h_change: 0.01,
  },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
    usd: 2500.0,
    usd_24h_change: 2.5,
  },
};

export const mockDefiLlamaResponse = {
  coins: {
    "ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
      price: 1.0,
      symbol: "USDC",
      timestamp: Date.now() / 1000,
      confidence: 0.99,
    },
    "ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
      price: 2500.0,
      symbol: "WETH",
      timestamp: Date.now() / 1000,
      confidence: 0.99,
    },
  },
};

// ============================================================
// Mock DeFi Vault Factory
// ============================================================

export function createMockVault(overrides: Partial<{
  address: Address;
  name: string;
  protocol: DeFiProtocol;
  chain: string;
  apy: number;
  tvlUsd: number;
  riskLevel: RiskLevel;
  depositToken: { address: Address; symbol: string; decimals: number };
}> = {}) {
  return {
    address: "0x1234567890123456789012345678901234567890" as Address,
    name: "Test Vault",
    symbol: "tvTest",
    protocol: DeFiProtocol.AAVE,
    chain: "ethereum",
    productType: DeFiProductType.LENDING,
    apy: 0.05,
    apyBase: 0.03,
    apyReward: 0.02,
    tvlUsd: 10000000,
    riskLevel: RiskLevel.LOW,
    depositToken: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    receiptToken: {
      address: "0x9876543210987654321098765432109876543210" as Address,
      symbol: "aUSDC",
      name: "Aave USDC",
      decimals: 6,
    },
    ...overrides,
  };
}

// ============================================================
// Fetch Mock Helper
// ============================================================

export function createFetchMock(responses: Record<string, any>) {
  return vi.fn(async (url: string) => {
    const urlStr = url.toString();
    
    for (const [pattern, response] of Object.entries(responses)) {
      if (urlStr.includes(pattern)) {
        return {
          ok: true,
          status: 200,
          json: async () => response,
          text: async () => JSON.stringify(response),
        };
      }
    }
    
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
      text: async () => "Not found",
    };
  });
}
