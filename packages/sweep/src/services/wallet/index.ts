import type { SupportedChain } from "../../config/chains.js";
import { cacheGetOrFetch, cacheGet, cacheSet } from "../../utils/redis.js";
import {
  type ChainBalance,
  type ChainScanner,
  type WalletIndexResult,
  CACHE_TTL_SECONDS,
} from "./types.js";
import { analyzeDust, type DustAnalysis } from "./dust-detector.js";

// Import chain scanners
import { ethereumScanner } from "./chains/ethereum.js";
import { baseScanner } from "./chains/base.js";
import { arbitrumScanner } from "./chains/arbitrum.js";
import { polygonScanner } from "./chains/polygon.js";
import { bscScanner } from "./chains/bsc.js";
import { lineaScanner } from "./chains/linea.js";
import { solanaScanner } from "./chains/solana.js";

// ============================================================
// Chain Scanner Registry
// ============================================================

const CHAIN_SCANNERS: Record<SupportedChain, ChainScanner> = {
  ethereum: ethereumScanner,
  base: baseScanner,
  arbitrum: arbitrumScanner,
  polygon: polygonScanner,
  bsc: bscScanner,
  linea: lineaScanner,
  optimism: ethereumScanner, // Can reuse Ethereum scanner with different config
  solana: solanaScanner,
};

// Default chains to scan (excluding Ethereum L1 by default due to high gas)
const DEFAULT_SCAN_CHAINS: SupportedChain[] = [
  "base",
  "arbitrum",
  "polygon",
  "bsc",
  "linea",
  "solana",
];

// All supported EVM chains
const ALL_EVM_CHAINS: SupportedChain[] = [
  "ethereum",
  "base",
  "arbitrum",
  "polygon",
  "bsc",
  "linea",
];

// ============================================================
// Wallet Indexer Service
// ============================================================

export class WalletIndexer {
  /**
   * Scan a single chain for token balances
   */
  async scanChain(
    address: string,
    chain: SupportedChain
  ): Promise<ChainBalance> {
    const cacheKey = `wallet:${chain}:${address.toLowerCase()}`;

    return cacheGetOrFetch(
      cacheKey,
      async () => {
        const scanner = CHAIN_SCANNERS[chain];
        if (!scanner) {
          throw new Error(`Unsupported chain: ${chain}`);
        }
        return scanner.scan(address);
      },
      CACHE_TTL_SECONDS
    );
  }

  /**
   * Scan multiple chains in parallel
   */
  async scanChains(
    address: string,
    chains: SupportedChain[]
  ): Promise<ChainBalance[]> {
    const scanPromises = chains.map((chain) =>
      this.scanChain(address, chain).catch((error) => {
        console.error(`Error scanning ${chain} for ${address}:`, error);
        // Return empty balance on error
        return {
          chain,
          address: address.toLowerCase(),
          tokens: [],
          nativeBalance: "0",
          nativeValueUsd: 0,
          totalValueUsd: 0,
          dustValueUsd: 0,
          dustTokenCount: 0,
          scannedAt: Date.now(),
        } as ChainBalance;
      })
    );

    return Promise.all(scanPromises);
  }

  /**
   * Scan all supported chains for a wallet
   */
  async scanAllChains(address: string): Promise<WalletIndexResult> {
    const cacheKey = `wallet:all:${address.toLowerCase()}`;

    // Check cache first
    const cached = await cacheGet<WalletIndexResult>(cacheKey);
    if (cached) return cached;

    // Determine if address is EVM or Solana
    const isEvmAddress = address.startsWith("0x");
    const isSolanaAddress = !isEvmAddress && address.length >= 32 && address.length <= 44;

    let chainsToScan: SupportedChain[] = [];

    if (isEvmAddress) {
      // Scan all EVM chains for EVM address
      chainsToScan = ALL_EVM_CHAINS;
    } else if (isSolanaAddress) {
      // Only scan Solana for Solana address
      chainsToScan = ["solana"];
    } else {
      throw new Error("Invalid address format");
    }

    const chainBalances = await this.scanChains(address, chainsToScan);

    const result: WalletIndexResult = {
      address: address.toLowerCase(),
      chains: chainBalances,
      totalValueUsd: chainBalances.reduce((sum, cb) => sum + cb.totalValueUsd, 0),
      totalDustValueUsd: chainBalances.reduce((sum, cb) => sum + cb.dustValueUsd, 0),
      totalDustTokenCount: chainBalances.reduce((sum, cb) => sum + cb.dustTokenCount, 0),
      indexedAt: Date.now(),
    };

    // Cache the result
    await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);

    return result;
  }

  /**
   * Scan default chains (L2s + Solana, excluding expensive L1)
   */
  async scanDefaultChains(address: string): Promise<WalletIndexResult> {
    const isEvmAddress = address.startsWith("0x");
    const isSolanaAddress = !isEvmAddress && address.length >= 32 && address.length <= 44;

    let chainsToScan: SupportedChain[] = [];

    if (isEvmAddress) {
      chainsToScan = DEFAULT_SCAN_CHAINS.filter((c) => c !== "solana");
    } else if (isSolanaAddress) {
      chainsToScan = ["solana"];
    } else {
      throw new Error("Invalid address format");
    }

    const chainBalances = await this.scanChains(address, chainsToScan);

    return {
      address: address.toLowerCase(),
      chains: chainBalances,
      totalValueUsd: chainBalances.reduce((sum, cb) => sum + cb.totalValueUsd, 0),
      totalDustValueUsd: chainBalances.reduce((sum, cb) => sum + cb.dustValueUsd, 0),
      totalDustTokenCount: chainBalances.reduce((sum, cb) => sum + cb.dustTokenCount, 0),
      indexedAt: Date.now(),
    };
  }

  /**
   * Get dust analysis for a wallet across all chains
   */
  async analyzeDust(address: string): Promise<DustAnalysis> {
    const walletData = await this.scanAllChains(address);
    return analyzeDust(walletData.chains);
  }

  /**
   * Quick dust check - only returns summary without full token details
   */
  async quickDustCheck(
    address: string,
    chains?: SupportedChain[]
  ): Promise<{
    totalDustValueUsd: number;
    dustTokenCount: number;
    chainsWithDust: string[];
  }> {
    const chainsToScan = chains || DEFAULT_SCAN_CHAINS;
    const chainBalances = await this.scanChains(address, chainsToScan);

    const totalDustValueUsd = chainBalances.reduce((sum, cb) => sum + cb.dustValueUsd, 0);
    const dustTokenCount = chainBalances.reduce((sum, cb) => sum + cb.dustTokenCount, 0);
    const chainsWithDust = chainBalances
      .filter((cb) => cb.dustTokenCount > 0)
      .map((cb) => cb.chain);

    return {
      totalDustValueUsd,
      dustTokenCount,
      chainsWithDust,
    };
  }

  /**
   * Invalidate cache for a specific wallet/chain
   */
  async invalidateCache(address: string, chain?: SupportedChain): Promise<void> {
    const { getRedis } = await import("../../utils/redis.js");
    const redis = getRedis();

    if (chain) {
      await redis.del(`wallet:${chain}:${address.toLowerCase()}`);
    } else {
      // Invalidate all chain caches for this address
      const keys = await redis.keys(`wallet:*:${address.toLowerCase()}`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.del(`wallet:all:${address.toLowerCase()}`);
    }
  }
}

// Export singleton instance
export const walletIndexer = new WalletIndexer();

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Scan a wallet and get dust analysis in one call
 */
export async function getWalletDust(address: string): Promise<{
  wallet: WalletIndexResult;
  dust: DustAnalysis;
}> {
  const wallet = await walletIndexer.scanAllChains(address);
  const dust = analyzeDust(wallet.chains);
  return { wallet, dust };
}

/**
 * Quick scan for dust tokens only
 */
export async function findDustTokens(
  address: string,
  chains?: SupportedChain[]
): Promise<DustAnalysis> {
  const chainsToScan = chains || DEFAULT_SCAN_CHAINS;
  const chainBalances = await walletIndexer.scanChains(address, chainsToScan);
  return analyzeDust(chainBalances);
}

// Re-export types and utilities
export * from "./types.js";
export * from "./dust-detector.js";
