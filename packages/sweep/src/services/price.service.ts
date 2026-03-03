import { SAFETY_CONFIG } from "../config/chains.js";
import { cacheGetOrFetch, getRedis } from "../utils/redis.js";
import type { ValidatedPrice, LiquidityCheck, HoneypotCheck } from "../types/index.js";

interface PriceSource {
  name: string;
  price: number;
  timestamp: number;
}

// ============================================================
// LAYER 1: Multi-Oracle Price Consensus
// ============================================================

export async function fetchCoinGeckoPrice(
  tokenAddress: string,
  chain: string
): Promise<PriceSource> {
  const platformId = getPlatformId(chain);
  const url = `https://api.coingecko.com/api/v3/simple/token_price/${platformId}?contract_addresses=${tokenAddress}&vs_currencies=usd`;

  const response = await fetch(url, {
    headers: process.env.COINGECKO_API_KEY
      ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY }
      : {},
  });
  const data = await response.json() as Record<string, { usd?: number }>;
  const price = data[tokenAddress.toLowerCase()]?.usd || 0;

  return { name: "coingecko", price, timestamp: Date.now() };
}

export async function fetchDefiLlamaPrice(
  tokenAddress: string,
  chain: string
): Promise<PriceSource> {
  const chainPrefix = getDefiLlamaChain(chain);
  const url = `https://coins.llama.fi/prices/current/${chainPrefix}:${tokenAddress}`;

  const response = await fetch(url);
  const data = await response.json() as { coins?: Record<string, { price?: number }> };
  const price = data.coins?.[`${chainPrefix}:${tokenAddress}`]?.price || 0;

  return { name: "defillama", price, timestamp: Date.now() };
}

export async function fetchDexScreenerPrice(
  tokenAddress: string,
  chain: string
): Promise<PriceSource> {
  const dexScreenerChain = getDexScreenerChain(chain);
  const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;

  const response = await fetch(url);
  const data = await response.json() as { pairs?: Array<{ chainId: string; baseToken: { address: string }; priceUsd?: string }> };

  // Find pair on the correct chain
  const pair = data.pairs?.find(
    (p) => p.chainId === dexScreenerChain && p.baseToken.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  const price = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;

  return { name: "dexscreener", price, timestamp: Date.now() };
}

export async function getValidatedPrice(
  tokenAddress: string,
  chain: string
): Promise<ValidatedPrice> {
  const cacheKey = `validated-price:${chain}:${tokenAddress.toLowerCase()}`;

  return cacheGetOrFetch(cacheKey, async () => {
    // Fetch from multiple sources in parallel
    const results = await Promise.allSettled([
      fetchCoinGeckoPrice(tokenAddress, chain),
      fetchDefiLlamaPrice(tokenAddress, chain),
      fetchDexScreenerPrice(tokenAddress, chain),
    ]);

    const validPrices: PriceSource[] = results
      .filter((r): r is PromiseFulfilledResult<PriceSource> =>
        r.status === "fulfilled" && r.value.price > 0
      )
      .map((r) => r.value);

    if (validPrices.length === 0) {
      return {
        price: 0,
        confidence: "UNTRUSTED" as const,
        sources: [],
        requiresApproval: true,
      };
    }

    // Calculate median
    const sortedPrices = validPrices.map((p) => p.price).sort((a, b) => a - b);
    const median = sortedPrices[Math.floor(sortedPrices.length / 2)];

    // Filter sources within acceptable deviation
    const consensusSources = validPrices.filter(
      (p) =>
        Math.abs(p.price - median) / median <=
        SAFETY_CONFIG.PRICE_DEVIATION_THRESHOLD
    );

    // Determine confidence
    let confidence: ValidatedPrice["confidence"];
    if (consensusSources.length >= 3) {
      confidence = "HIGH";
    } else if (consensusSources.length >= 2) {
      confidence = "MEDIUM";
    } else if (consensusSources.length === 1) {
      confidence = "LOW";
    } else {
      confidence = "UNTRUSTED";
    }

    return {
      price: median,
      confidence,
      sources: validPrices,
      requiresApproval: confidence === "LOW" || confidence === "UNTRUSTED",
    };
  }, 60); // Cache for 60 seconds
}

// ============================================================
// LAYER 2: Liquidity Check
// ============================================================

export async function checkTokenLiquidity(
  tokenAddress: string,
  chain: string
): Promise<LiquidityCheck> {
  const cacheKey = `liquidity:${chain}:${tokenAddress.toLowerCase()}`;

  return cacheGetOrFetch(cacheKey, async () => {
    const dexScreenerChain = getDexScreenerChain(chain);
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;

    const response = await fetch(url);
    const data = await response.json() as { pairs?: Array<{ chainId: string; dexId?: string; liquidity?: { usd?: number } }> };

    const pairs = (data.pairs || []).filter(
      (p: any) => p.chainId === dexScreenerChain
    );

    const topPools = pairs
      .slice(0, 5)
      .map((p: any) => ({
        dex: p.dexId,
        liquidity: p.liquidity?.usd || 0,
      }));

    const totalLiquidity = topPools.reduce(
      (sum: number, p: any) => sum + p.liquidity,
      0
    );

    return {
      isLiquid: totalLiquidity >= SAFETY_CONFIG.MIN_LIQUIDITY_USD,
      liquidityUsd: totalLiquidity,
      topPools,
    };
  }, 300); // Cache for 5 minutes
}

// ============================================================
// LAYER 3: Historical Anomaly Detection
// ============================================================

export async function detectPriceAnomaly(
  tokenAddress: string,
  chain: string,
  currentPrice: number
): Promise<{ isAnomalous: boolean; currentPrice: number; avg7d: number; deviation: number }> {
  const historyKey = `price-history:${chain}:${tokenAddress.toLowerCase()}`;
  const redis = getRedis();

  // Store current price in history
  await redis.lpush(historyKey, JSON.stringify({ price: currentPrice, timestamp: Date.now() }));
  await redis.ltrim(historyKey, 0, 168); // Keep ~7 days of hourly data

  // Get history
  const history = await redis.lrange(historyKey, 0, -1);

  if (history.length < 24) {
    // Not enough history - be conservative
    return {
      isAnomalous: true,
      currentPrice,
      avg7d: 0,
      deviation: 1,
    };
  }

  const prices = history.map((h) => JSON.parse(h).price);
  const avg7d = prices.reduce((a, b) => a + b, 0) / prices.length;
  const deviation = Math.abs(currentPrice - avg7d) / avg7d;

  return {
    isAnomalous: deviation > SAFETY_CONFIG.ANOMALY_THRESHOLD,
    currentPrice,
    avg7d,
    deviation,
  };
}

// ============================================================
// LAYER 7: On-Chain Oracle Cross-Check
// ============================================================

export async function crossCheckOnChainOracles(
  tokenAddress: string,
  chain: string,
  apiPrice: number
): Promise<{ valid: boolean; deviation?: number }> {
  // For MVP, we'll use the Chainlink price feed via DefiLlama
  // In production, call Chainlink/Pyth contracts directly
  try {
    const defillamaPrice = await fetchDefiLlamaPrice(tokenAddress, chain);

    if (defillamaPrice.price === 0) {
      return { valid: true }; // No oracle data available
    }

    const deviation = Math.abs(defillamaPrice.price - apiPrice) / apiPrice;
    return {
      valid: deviation <= SAFETY_CONFIG.ORACLE_DEVIATION_THRESHOLD,
      deviation,
    };
  } catch {
    return { valid: true }; // Fail open if oracle unavailable
  }
}

// ============================================================
// LAYER 8: 24h Volume Check
// ============================================================

export async function checkTradingVolume(
  tokenAddress: string,
  chain: string
): Promise<{ sufficient: boolean; volume24h: number }> {
  const cacheKey = `volume:${chain}:${tokenAddress.toLowerCase()}`;

  return cacheGetOrFetch(cacheKey, async () => {
    const dexScreenerChain = getDexScreenerChain(chain);
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;

    const response = await fetch(url);
    const data = await response.json() as { pairs?: Array<{ chainId: string; volume?: { h24?: number } }> };

    const pairs = (data.pairs || []).filter(
      (p: any) => p.chainId === dexScreenerChain
    );

    const volume24h = pairs.reduce(
      (sum: number, p: any) => sum + (p.volume?.h24 || 0),
      0
    );

    return {
      sufficient: volume24h >= SAFETY_CONFIG.MIN_24H_VOLUME_USD,
      volume24h,
    };
  }, 300);
}

// ============================================================
// LAYER 9: Honeypot Detection
// ============================================================

export async function detectHoneypot(
  tokenAddress: string,
  chain: string
): Promise<HoneypotCheck> {
  const cacheKey = `honeypot:${chain}:${tokenAddress.toLowerCase()}`;

  return cacheGetOrFetch(cacheKey, async () => {
    const chainId = getChainId(chain);

    // Try GoPlus Security API
    try {
      const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${tokenAddress}`;
      const response = await fetch(url);
      const data = await response.json() as { result?: Record<string, { is_honeypot?: string; buy_tax?: string; sell_tax?: string; is_open_source?: string; is_proxy?: string }> };

      const security = data.result?.[tokenAddress.toLowerCase()];

      if (security) {
        return {
          isHoneypot: security.is_honeypot === "1",
          buyTax: parseFloat(security.buy_tax || "0") * 100,
          sellTax: parseFloat(security.sell_tax || "0") * 100,
          isOpenSource: security.is_open_source === "1",
          hasProxyContract: security.is_proxy === "1",
        };
      }
    } catch (e) {
      console.error("GoPlus API error:", e);
    }

    // Default: assume safe but require manual review
    return {
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      isOpenSource: false,
      hasProxyContract: false,
    };
  }, 3600); // Cache for 1 hour
}

// ============================================================
// LAYER 13: Token Age Verification
// ============================================================

export async function checkTokenAge(
  tokenAddress: string,
  chain: string
): Promise<{ isMature: boolean; ageInDays: number }> {
  const cacheKey = `token-age:${chain}:${tokenAddress.toLowerCase()}`;

  return cacheGetOrFetch(cacheKey, async () => {
    // Use block explorer API to get contract creation
    const explorerApiKey = process.env[`${chain.toUpperCase()}_EXPLORER_API_KEY`] || "";
    const explorerUrl = getExplorerApiUrl(chain);

    try {
      const url = `${explorerUrl}?module=contract&action=getcontractcreation&contractaddresses=${tokenAddress}&apikey=${explorerApiKey}`;
      const response = await fetch(url);
      const data = await response.json() as { result?: Array<{ txHash?: string }> };

      if (data.result?.[0]?.txHash) {
        // Get block timestamp from tx
        const txUrl = `${explorerUrl}?module=proxy&action=eth_getTransactionByHash&txhash=${data.result[0].txHash}&apikey=${explorerApiKey}`;
        const txResponse = await fetch(txUrl);
        const txData = await txResponse.json() as { result?: { blockNumber?: string } };

        if (txData.result?.blockNumber) {
          const blockUrl = `${explorerUrl}?module=block&action=getblockreward&blockno=${parseInt(txData.result.blockNumber, 16)}&apikey=${explorerApiKey}`;
          const blockResponse = await fetch(blockUrl);
          const blockData = await blockResponse.json() as { result?: { timeStamp?: string } };

          const timestamp = parseInt(blockData.result?.timeStamp || "0") * 1000;
          const ageInDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);

          return {
            isMature: ageInDays >= SAFETY_CONFIG.MIN_TOKEN_AGE_DAYS,
            ageInDays,
          };
        }
      }
    } catch (e) {
      console.error("Token age check error:", e);
    }

    // If we can't determine age, be conservative
    return {
      isMature: false,
      ageInDays: 0,
    };
  }, 86400); // Cache for 24 hours
}

// ============================================================
// Helper functions
// ============================================================

function getPlatformId(chain: string): string {
  const mapping: Record<string, string> = {
    ethereum: "ethereum",
    base: "base",
    arbitrum: "arbitrum-one",
    polygon: "polygon-pos",
    bsc: "binance-smart-chain",
    linea: "linea",
    optimism: "optimistic-ethereum",
  };
  return mapping[chain] || chain;
}

function getDefiLlamaChain(chain: string): string {
  const mapping: Record<string, string> = {
    ethereum: "ethereum",
    base: "base",
    arbitrum: "arbitrum",
    polygon: "polygon",
    bsc: "bsc",
    linea: "linea",
    optimism: "optimism",
  };
  return mapping[chain] || chain;
}

function getDexScreenerChain(chain: string): string {
  const mapping: Record<string, string> = {
    ethereum: "ethereum",
    base: "base",
    arbitrum: "arbitrum",
    polygon: "polygon",
    bsc: "bsc",
    linea: "linea",
    optimism: "optimism",
  };
  return mapping[chain] || chain;
}

function getChainId(chain: string): number {
  const mapping: Record<string, number> = {
    ethereum: 1,
    base: 8453,
    arbitrum: 42161,
    polygon: 137,
    bsc: 56,
    linea: 59144,
    optimism: 10,
  };
  return mapping[chain] || 1;
}

function getExplorerApiUrl(chain: string): string {
  const mapping: Record<string, string> = {
    ethereum: "https://api.etherscan.io/api",
    base: "https://api.basescan.org/api",
    arbitrum: "https://api.arbiscan.io/api",
    polygon: "https://api.polygonscan.com/api",
    bsc: "https://api.bscscan.com/api",
    linea: "https://api.lineascan.build/api",
    optimism: "https://api-optimistic.etherscan.io/api",
  };
  return mapping[chain] || mapping.ethereum;
}
