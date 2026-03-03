import { type Chain } from "viem";
import {
  mainnet,
  base,
  arbitrum,
  polygon,
  bsc,
  linea,
  optimism,
} from "viem/chains";

export type SupportedChain =
  | "ethereum"
  | "base"
  | "arbitrum"
  | "polygon"
  | "bsc"
  | "linea"
  | "optimism"
  | "solana";

export const CHAIN_CONFIG: Record<
  Exclude<SupportedChain, "solana">,
  {
    chain: Chain;
    rpcEnvKey: string;
    coingeckoPlatformId: string;
    nativeToken: string;
    stablecoin: `0x${string}`;
    blockExplorerApi: string;
  }
> = {
  ethereum: {
    chain: mainnet,
    rpcEnvKey: "RPC_ETHEREUM",
    coingeckoPlatformId: "ethereum",
    nativeToken: "ETH",
    stablecoin: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    blockExplorerApi: "https://api.etherscan.io/api",
  },
  base: {
    chain: base,
    rpcEnvKey: "RPC_BASE",
    coingeckoPlatformId: "base",
    nativeToken: "ETH",
    stablecoin: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    blockExplorerApi: "https://api.basescan.org/api",
  },
  arbitrum: {
    chain: arbitrum,
    rpcEnvKey: "RPC_ARBITRUM",
    coingeckoPlatformId: "arbitrum-one",
    nativeToken: "ETH",
    stablecoin: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
    blockExplorerApi: "https://api.arbiscan.io/api",
  },
  polygon: {
    chain: polygon,
    rpcEnvKey: "RPC_POLYGON",
    coingeckoPlatformId: "polygon-pos",
    nativeToken: "MATIC",
    stablecoin: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC
    blockExplorerApi: "https://api.polygonscan.com/api",
  },
  bsc: {
    chain: bsc,
    rpcEnvKey: "RPC_BSC",
    coingeckoPlatformId: "binance-smart-chain",
    nativeToken: "BNB",
    stablecoin: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
    blockExplorerApi: "https://api.bscscan.com/api",
  },
  linea: {
    chain: linea,
    rpcEnvKey: "RPC_LINEA",
    coingeckoPlatformId: "linea",
    nativeToken: "ETH",
    stablecoin: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", // USDC
    blockExplorerApi: "https://api.lineascan.build/api",
  },
  optimism: {
    chain: optimism,
    rpcEnvKey: "RPC_OPTIMISM",
    coingeckoPlatformId: "optimistic-ethereum",
    nativeToken: "ETH",
    stablecoin: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC
    blockExplorerApi: "https://api-optimistic.etherscan.io/api",
  },
};

export const SOLANA_CONFIG = {
  rpcEnvKey: "RPC_SOLANA",
  coingeckoPlatformId: "solana",
  nativeToken: "SOL",
  stablecoin: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
};

// Safety thresholds
export const SAFETY_CONFIG = {
  // Price validation
  PRICE_DEVIATION_THRESHOLD: 0.05, // 5% max deviation from median
  MIN_PRICE_SOURCES: 2,
  ORACLE_DEVIATION_THRESHOLD: 0.10, // 10% max from on-chain oracle

  // Liquidity
  MIN_LIQUIDITY_USD: 10_000,
  MIN_24H_VOLUME_USD: 5_000,

  // Execution
  MAX_SLIPPAGE: 0.03, // 3%
  AUTO_SWEEP_THRESHOLD_USD: 50,

  // Token safety
  MAX_HIDDEN_TAX: 0.05, // 5%
  MAX_TOP_HOLDER_CONCENTRATION: 0.80, // 80%
  MIN_TOKEN_AGE_DAYS: 7,
  MAX_CROSS_DEX_DEVIATION: 0.05, // 5%
  TWAP_DEVIATION_THRESHOLD: 0.20, // 20%
  ANOMALY_THRESHOLD: 0.50, // 50% from 7d avg
};
