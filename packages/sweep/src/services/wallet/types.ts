import { z } from "zod";
import type { SupportedChain } from "../../config/chains.js";

// ============================================================
// Token Balance Types
// ============================================================

export const WalletTokenSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  balance: z.string(), // Raw balance as string (for bigint precision)
  balanceFormatted: z.string(), // Human-readable balance
  valueUsd: z.number(),
  isDust: z.boolean(),
  logoUrl: z.string().optional(),
});
export type WalletToken = z.infer<typeof WalletTokenSchema>;

export const ChainBalanceSchema = z.object({
  chain: z.string(),
  address: z.string(),
  tokens: z.array(WalletTokenSchema),
  nativeBalance: z.string(),
  nativeValueUsd: z.number(),
  totalValueUsd: z.number(),
  dustValueUsd: z.number(),
  dustTokenCount: z.number(),
  scannedAt: z.number(),
});
export type ChainBalance = z.infer<typeof ChainBalanceSchema>;

export const WalletIndexResultSchema = z.object({
  address: z.string(),
  chains: z.array(ChainBalanceSchema),
  totalValueUsd: z.number(),
  totalDustValueUsd: z.number(),
  totalDustTokenCount: z.number(),
  indexedAt: z.number(),
});
export type WalletIndexResult = z.infer<typeof WalletIndexResultSchema>;

// ============================================================
// Alchemy API Types
// ============================================================

export interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

export interface AlchemyTokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

export interface AlchemyGetTokenBalancesResponse {
  address: string;
  tokenBalances: AlchemyTokenBalance[];
}

// ============================================================
// Helius API Types (Solana)
// ============================================================

export interface HeliusAsset {
  id: string;
  interface: string;
  content: {
    metadata: {
      name: string;
      symbol: string;
    };
    links?: {
      image?: string;
    };
  };
  token_info?: {
    balance: number;
    decimals: number;
    price_info?: {
      price_per_token: number;
      total_price: number;
    };
  };
}

export interface HeliusGetAssetsByOwnerResponse {
  total: number;
  limit: number;
  page: number;
  items: HeliusAsset[];
}

// ============================================================
// Scanner Interface
// ============================================================

export interface ChainScanner {
  chain: SupportedChain;
  scan(address: string): Promise<ChainBalance>;
}

// ============================================================
// Configuration
// ============================================================

export const DUST_THRESHOLD_USD = 100; // Tokens worth less than $100 are dust

export const CACHE_TTL_SECONDS = 300; // 5 minute cache TTL

export const ALCHEMY_SUPPORTED_CHAINS: SupportedChain[] = [
  "ethereum",
  "base",
  "arbitrum",
  "polygon",
  "linea",
];

export const INFURA_SUPPORTED_CHAINS: SupportedChain[] = [
  "bsc",
];
