/**
 * Crypto Vision — Token Data Service
 *
 * Fetches real-time token data from multiple on-chain/off-chain sources.
 * Uses the existing crypto-vision data sources for market data, with
 * fallback chains and caching.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:token-data" });

export interface TokenData {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  price: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  holders: number;
  tokenAge: string;
  priceChange24h: number;
  topHolders: Array<{ address: string; percentage: number }>;
  dexUrl: string;
  chartUrl: string;
}

/**
 * Detect which chain a token address belongs to based on format.
 */
export function detectChain(address: string): string {
  // Solana: base58, 32-44 chars, no 0x prefix
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return "solana";
  }
  // EVM: 0x + 40 hex chars
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return "ethereum"; // default EVM — can be refined with chain-specific checks
  }
  return "unknown";
}

/**
 * Normalize token address input — handles contract addresses, LP addresses,
 * and chart URLs (dexscreener, dextools, birdeye, etc.)
 */
export function parseTokenInput(input: string): { address: string; chain: string } | null {
  const trimmed = input.trim();

  // Direct contract address
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { address: trimmed, chain: detectChain(trimmed) };
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
    return { address: trimmed, chain: "solana" };
  }

  // DexScreener URL: https://dexscreener.com/ethereum/0x...
  const dexscreenerMatch = trimmed.match(
    /dexscreener\.com\/(\w+)\/(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/i,
  );
  if (dexscreenerMatch) {
    return { address: dexscreenerMatch[2], chain: dexscreenerMatch[1].toLowerCase() };
  }

  // DexTools URL: https://www.dextools.io/app/en/ether/pair-explorer/0x...
  const dextoolsMatch = trimmed.match(
    /dextools\.io\/app\/\w+\/(\w+)\/pair-explorer\/(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/i,
  );
  if (dextoolsMatch) {
    const chainMap: Record<string, string> = {
      ether: "ethereum",
      bsc: "bsc",
      polygon: "polygon",
      solana: "solana",
      base: "base",
      arbitrum: "arbitrum",
      avalanche: "avalanche",
      optimism: "optimism",
    };
    return {
      address: dextoolsMatch[2],
      chain: chainMap[dextoolsMatch[1].toLowerCase()] || dextoolsMatch[1].toLowerCase(),
    };
  }

  // Birdeye URL: https://birdeye.so/token/ADDRESS
  const birdeyeMatch = trimmed.match(
    /birdeye\.so\/token\/([1-9A-HJ-NP-Za-km-z]{32,44}|0x[a-fA-F0-9]{40})/i,
  );
  if (birdeyeMatch) {
    return { address: birdeyeMatch[1], chain: detectChain(birdeyeMatch[1]) };
  }

  // GeckoTerminal URL: https://www.geckoterminal.com/eth/pools/0x...
  const geckoTerminalMatch = trimmed.match(
    /geckoterminal\.com\/(\w+)\/pools\/(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/i,
  );
  if (geckoTerminalMatch) {
    const chainMap: Record<string, string> = {
      eth: "ethereum",
      bsc: "bsc",
      polygon_pos: "polygon",
      solana: "solana",
      base: "base",
      arbitrum: "arbitrum",
    };
    return {
      address: geckoTerminalMatch[2],
      chain: chainMap[geckoTerminalMatch[1].toLowerCase()] || geckoTerminalMatch[1].toLowerCase(),
    };
  }

  return null;
}

/**
 * Fetch token data from DexScreener API (primary source).
 */
async function fetchFromDexScreener(address: string): Promise<TokenData | null> {
  try {
    const resp = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      pairs?: Array<{
        chainId: string;
        baseToken: { address: string; name: string; symbol: string };
        priceUsd: string;
        fdv: number;
        liquidity: { usd: number };
        volume: { h24: number };
        priceChange: { h24: number };
        pairCreatedAt: number;
        url: string;
        info?: { holders?: number };
      }>;
    };

    if (!data.pairs || data.pairs.length === 0) return null;

    // Pick the pair with highest liquidity
    const pair = data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

    const createdAt = pair.pairCreatedAt ? new Date(pair.pairCreatedAt) : new Date();
    const ageMs = Date.now() - createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageHours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return {
      address: pair.baseToken.address,
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      chain: pair.chainId,
      price: parseFloat(pair.priceUsd || "0"),
      marketCap: pair.fdv || 0,
      liquidity: pair.liquidity?.usd || 0,
      volume24h: pair.volume?.h24 || 0,
      holders: pair.info?.holders || 0,
      tokenAge: ageDays > 0 ? `${ageDays}d ${ageHours}h` : `${ageHours}h`,
      priceChange24h: pair.priceChange?.h24 || 0,
      topHolders: [],
      dexUrl: pair.url,
      chartUrl: `https://dexscreener.com/${pair.chainId}/${pair.baseToken.address}`,
    };
  } catch (err) {
    log.warn({ err, address }, "DexScreener fetch failed");
    return null;
  }
}

/**
 * Fetch token data from GeckoTerminal API (fallback source).
 */
async function fetchFromGeckoTerminal(address: string, chain: string): Promise<TokenData | null> {
  try {
    const networkMap: Record<string, string> = {
      ethereum: "eth",
      solana: "solana",
      bsc: "bsc",
      base: "base",
      arbitrum: "arbitrum",
      polygon: "polygon_pos",
      avalanche: "avax",
      optimism: "optimism",
    };
    const network = networkMap[chain] || chain;

    const resp = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}`,
      { headers: { Accept: "application/json" } },
    );
    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      data?: {
        attributes: {
          name: string;
          symbol: string;
          address: string;
          price_usd: string;
          fdv_usd: string;
          total_reserve_in_usd: string;
          volume_usd: { h24: string };
        };
      };
    };

    if (!data.data) return null;

    const attrs = data.data.attributes;
    return {
      address: attrs.address,
      symbol: attrs.symbol,
      name: attrs.name,
      chain,
      price: parseFloat(attrs.price_usd || "0"),
      marketCap: parseFloat(attrs.fdv_usd || "0"),
      liquidity: parseFloat(attrs.total_reserve_in_usd || "0"),
      volume24h: parseFloat(attrs.volume_usd?.h24 || "0"),
      holders: 0,
      tokenAge: "unknown",
      priceChange24h: 0,
      topHolders: [],
      dexUrl: `https://www.geckoterminal.com/${network}/tokens/${address}`,
      chartUrl: `https://www.geckoterminal.com/${network}/tokens/${address}`,
    };
  } catch (err) {
    log.warn({ err, address, chain }, "GeckoTerminal fetch failed");
    return null;
  }
}

/**
 * Get token data with caching and multi-source fallback.
 * Cache TTL: 30 seconds (token data changes rapidly).
 */
export async function getTokenData(
  address: string,
  chain = "ethereum",
): Promise<TokenData | null> {
  const cacheKey = `crypto-vision:token:${address}`;

  return cache.wrap(cacheKey, 30, async () => {
    // Try DexScreener first (works across all chains without specifying chain)
    const dexResult = await fetchFromDexScreener(address);
    if (dexResult) return dexResult;

    // Fallback to GeckoTerminal
    const geckoResult = await fetchFromGeckoTerminal(address, chain);
    if (geckoResult) return geckoResult;

    log.warn({ address, chain }, "Failed to fetch token data from all sources");
    return null;
  });
}

/**
 * Get current price for a token (lightweight — just price).
 */
export async function getTokenPrice(address: string): Promise<number | null> {
  const data = await getTokenData(address);
  return data?.price ?? null;
}

/**
 * Calculate the multiplier between call price and current/ATH price.
 */
export function calculateMultiplier(callPrice: number, currentPrice: number): number {
  if (callPrice <= 0) return 1;
  return currentPrice / callPrice;
}

/**
 * Calculate performance points based on peak multiplier.
 * Scoring system:
 * - 1x to 1.5x → -1 point (weak call)
 * - 1.5x to 2x → 0 points (solid base)
 * - 2x to 5x → +2 points (strong)
 * - 5x to 15x → +3 points (great)
 * - 15x to 30x → +4 points (elite)
 * - 30x+ → +5 points (legendary)
 */
export function calculatePerformancePoints(peakMultiplier: number): number {
  if (peakMultiplier >= 30) return 5;
  if (peakMultiplier >= 15) return 4;
  if (peakMultiplier >= 5) return 3;
  if (peakMultiplier >= 2) return 2;
  if (peakMultiplier >= 1.5) return 0;
  return -1;
}

/**
 * Determine if a call is a "win" (2x or more).
 */
export function isWinningCall(peakMultiplier: number): boolean {
  return peakMultiplier >= 2;
}

/**
 * Format market cap for display (e.g., "$1.2M", "$450K").
 */
export function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage for display.
 */
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format multiplier for display (e.g., "2.5x", "100x").
 */
export function formatMultiplier(value: number): string {
  if (value >= 100) return `${Math.round(value)}x`;
  if (value >= 10) return `${value.toFixed(1)}x`;
  return `${value.toFixed(2)}x`;
}
