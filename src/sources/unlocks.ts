/**
 * Crypto Vision — Token Unlocks & Emissions Data Source
 *
 * Comprehensive token vesting schedules, upcoming unlocks, and emissions.
 *  - DeFi Llama emissions API
 *  - CoinGecko market data for price impact analysis
 *
 * All endpoints are free.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { cache } from "../lib/cache.js";
import { fetchJSON } from "../lib/fetcher.js";

// ─── Types ───────────────────────────────────────────────────

export interface TokenUnlock {
  protocol: string;
  token: string;
  amount: number;
  amountUSD: number;
  unlockDate: string;
  category: string;
  percentOfSupply: number;
  cliff: boolean;
  linear: boolean;
}

export interface VestingEvent {
  date: string;
  timestamp: number;
  amount: number;
  amountUSD: number;
  category: string;
  description: string;
  cliff: boolean;
  linear: boolean;
  percentOfSupply: number;
}

export interface VestingSchedule {
  protocol: string;
  token: string;
  totalSupply: number;
  circulatingSupply: number;
  lockedAmount: number;
  lockedValueUSD: number;
  percentVested: number;
  schedule: VestingEvent[];
}

export interface UnlockImpact {
  symbol: string;
  nextUnlock: {
    date: string;
    amount: number;
    valueUsd: number;
    percentOfCirculating: number;
  } | null;
  impactAssessment: {
    sellingPressure: "extreme" | "high" | "moderate" | "low" | "none";
    historicalAvgImpact: number;
    riskRating: number;
    recommendation: string;
  };
  upcomingUnlocks: VestingEvent[];
  totalLocked: number;
  totalLockedUsd: number;
  percentVested: number;
}

// ─── DeFi Llama Emissions ────────────────────────────────────

const LLAMA_BASE = "https://api.llama.fi";
const CG_BASE = "https://api.coingecko.com/api/v3";

function cgHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { "x-cg-pro-api-key": key } : {};
}

interface EmissionsProtocol {
  name: string;
  slug?: string;
  symbol?: string;
  gecko_id?: string;
  sources?: string[];
}

interface EmissionDetail {
  name?: string;
  events?: Array<{
    timestamp: number;
    noOfTokens?: number;
    amount?: number;
    amountUSD?: number;
    description?: string;
    category?: string;
    cliff?: boolean;
    linear?: boolean;
    percentOfSupply?: number;
  }>;
  unlocks?: Array<{
    timestamp: number;
    noOfTokens?: number;
    amount?: number;
    amountUSD?: number;
    description?: string;
    category?: string;
    cliff?: boolean;
    linear?: boolean;
    percentOfSupply?: number;
  }>;
  tokenPrice?: Record<string, number>;
  categories?: Record<string, {
    locked: number;
    released: number;
  }>;
}

interface CoinGeckoSimplePrice {
  [id: string]: {
    usd: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
  };
}

interface CoinGeckoCoinDetail {
  id: string;
  symbol: string;
  name: string;
  market_data: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    total_volume: Record<string, number>;
  };
}

/** Get all protocols with emission data from DeFi Llama. */
export function getEmissionsProtocols(): Promise<EmissionsProtocol[]> {
  return cache.wrap("unlocks:protocols", 600, () =>
    fetchJSON<EmissionsProtocol[]>(`${LLAMA_BASE}/emissions`),
  );
}

/** Get emission schedule for a specific protocol (DeFi Llama). */
export function getProtocolEmissions(protocol: string): Promise<EmissionDetail> {
  return cache.wrap(`unlocks:emissions:${protocol}`, 600, () =>
    fetchJSON<EmissionDetail>(`${LLAMA_BASE}/emission/${protocol}`),
  );
}

// ─── Upcoming Unlocks ────────────────────────────────────────

/**
 * Major upcoming token unlocks — fetches from DeFi Llama emissions
 * and enriches with price data.
 */
export async function getUpcomingUnlocks(days = 30): Promise<{
  upcoming: TokenUnlock[];
  totalValueUSD: number;
  count: number;
}> {
  return cache.wrap(`unlocks:upcoming:${days}`, 300, async () => {
    const protocols = await getEmissionsProtocols().catch(() => []);

    const now = Date.now();
    const cutoff = now + days * 24 * 60 * 60 * 1000;

    const upcoming: TokenUnlock[] = [];
    let totalValueUSD = 0;

    for (const protocol of protocols.slice(0, 200)) {
      if (!protocol?.name) continue;

      try {
        const slug = protocol.slug || protocol.name.toLowerCase().replace(/\s+/g, "-");
        const detail = await getProtocolEmissions(slug);
        if (!detail) continue;

        const events = detail.events || detail.unlocks || [];
        for (const event of events) {
          const unlockTime = event.timestamp ? event.timestamp * 1000 : 0;
          if (unlockTime > now && unlockTime < cutoff) {
            const amount = event.noOfTokens || event.amount || 0;
            const usd = event.amountUSD || 0;

            upcoming.push({
              protocol: protocol.name,
              token: protocol.symbol || protocol.name,
              amount,
              amountUSD: usd,
              unlockDate: new Date(unlockTime).toISOString(),
              category: event.description || event.category || "unknown",
              percentOfSupply: event.percentOfSupply || 0,
              cliff: !!event.cliff,
              linear: !!event.linear,
            });

            totalValueUSD += usd;
          }
        }
      } catch {
        // Skip protocols that fail
      }
    }

    upcoming.sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime());

    return {
      upcoming: upcoming.slice(0, 100),
      totalValueUSD,
      count: upcoming.length,
    };
  });
}

// ─── Token-specific unlock schedule ──────────────────────────

/**
 * Get unlock schedule for a specific token by symbol.
 * Matches against DeFi Llama emissions protocols.
 */
export async function getTokenUnlocks(symbol: string): Promise<{
  protocol: string;
  token: string;
  events: VestingEvent[];
  totalLocked: number;
  totalLockedUSD: number;
  percentVested: number;
} | null> {
  return cache.wrap(`unlocks:token:${symbol.toLowerCase()}`, 300, async () => {
    const protocols = await getEmissionsProtocols().catch(() => []);

    // Find the matching protocol by symbol or name
    const upperSymbol = symbol.toUpperCase();
    const lowerSymbol = symbol.toLowerCase();
    const matched = protocols.find(
      (p) =>
        p.symbol?.toUpperCase() === upperSymbol ||
        p.name?.toLowerCase() === lowerSymbol ||
        p.slug?.toLowerCase() === lowerSymbol,
    );

    if (!matched) return null;

    const slug = matched.slug || matched.name.toLowerCase().replace(/\s+/g, "-");
    const detail = await getProtocolEmissions(slug);
    if (!detail) return null;

    const rawEvents = detail.events || detail.unlocks || [];
    const now = Date.now();

    let totalLocked = 0;
    let totalReleased = 0;

    const events: VestingEvent[] = rawEvents.map((e) => {
      const amount = e.noOfTokens || e.amount || 0;
      const usd = e.amountUSD || 0;
      const ts = (e.timestamp || 0) * 1000;
      const isFuture = ts > now;

      if (isFuture) totalLocked += amount;
      else totalReleased += amount;

      return {
        date: new Date(ts).toISOString(),
        timestamp: e.timestamp || 0,
        amount,
        amountUSD: usd,
        category: e.category || e.description || "unknown",
        description: e.description || "",
        cliff: !!e.cliff,
        linear: !!e.linear,
        percentOfSupply: e.percentOfSupply || 0,
      };
    });

    const totalSupply = totalLocked + totalReleased;
    const percentVested = totalSupply > 0 ? (totalReleased / totalSupply) * 100 : 0;

    // Get current price for USD values
    let tokenPrice = 0;
    try {
      const priceData = await fetchJSON<CoinGeckoSimplePrice>(
        `${CG_BASE}/simple/price?ids=${slug}&vs_currencies=usd`,
        { headers: cgHeaders() },
      );
      tokenPrice = priceData[slug]?.usd || 0;
    } catch {
      // Price lookup failed — use zeros
    }

    const totalLockedUSD = tokenPrice > 0 ? totalLocked * tokenPrice : 0;

    return {
      protocol: matched.name,
      token: matched.symbol || matched.name,
      events: events.sort((a, b) => a.timestamp - b.timestamp),
      totalLocked,
      totalLockedUSD,
      percentVested,
    };
  });
}

// ─── Calendar View ───────────────────────────────────────────

/**
 * Calendar view of upcoming unlocks grouped by date.
 */
export async function getUnlockCalendar(days = 90): Promise<{
  calendar: Record<string, TokenUnlock[]>;
  totalEvents: number;
  totalValueUSD: number;
}> {
  return cache.wrap(`unlocks:calendar:${days}`, 300, async () => {
    const { upcoming } = await getUpcomingUnlocks(days);

    const calendar: Record<string, TokenUnlock[]> = {};
    let totalValueUSD = 0;

    for (const unlock of upcoming) {
      const dateKey = unlock.unlockDate.split("T")[0]; // YYYY-MM-DD
      if (!calendar[dateKey]) calendar[dateKey] = [];
      calendar[dateKey].push(unlock);
      totalValueUSD += unlock.amountUSD;
    }

    return {
      calendar,
      totalEvents: upcoming.length,
      totalValueUSD,
    };
  });
}

// ─── Large Unlocks ───────────────────────────────────────────

/**
 * Filter for large unlocks exceeding a USD threshold (default $10M).
 */
export async function getLargeUnlocks(
  thresholdUsd = 10_000_000,
  days = 90,
): Promise<{
  largeUnlocks: TokenUnlock[];
  totalValueUSD: number;
  count: number;
}> {
  return cache.wrap(`unlocks:large:${thresholdUsd}:${days}`, 300, async () => {
    const { upcoming } = await getUpcomingUnlocks(days);

    const largeUnlocks = upcoming.filter((u) => u.amountUSD >= thresholdUsd);
    const totalValueUSD = largeUnlocks.reduce((sum, u) => sum + u.amountUSD, 0);

    return {
      largeUnlocks,
      totalValueUSD,
      count: largeUnlocks.length,
    };
  });
}

// ─── Cliff Unlocks ───────────────────────────────────────────

/**
 * Get upcoming cliff unlocks (large one-time token releases).
 */
export async function getCliffUnlocks(days = 90): Promise<{
  cliffUnlocks: TokenUnlock[];
  totalValueUSD: number;
  count: number;
}> {
  return cache.wrap(`unlocks:cliff:${days}`, 300, async () => {
    const { upcoming } = await getUpcomingUnlocks(days);

    const cliffUnlocks = upcoming.filter((u) => u.cliff);
    const totalValueUSD = cliffUnlocks.reduce((sum, u) => sum + u.amountUSD, 0);

    return {
      cliffUnlocks,
      totalValueUSD,
      count: cliffUnlocks.length,
    };
  });
}

// ─── Unlock Impact Analysis ──────────────────────────────────

/**
 * Analyze the potential price impact of upcoming unlocks for a token.
 * Computes selling pressure based on unlock amount vs circulating supply.
 */
export async function getUnlockImpact(symbol: string): Promise<UnlockImpact> {
  return cache.wrap(`unlocks:impact:${symbol.toLowerCase()}`, 300, async () => {
    const [tokenUnlocks, coinData] = await Promise.allSettled([
      getTokenUnlocks(symbol),
      fetchJSON<CoinGeckoCoinDetail>(
        `${CG_BASE}/coins/${symbol.toLowerCase()}?localization=false&tickers=false&community_data=false&developer_data=false`,
        { headers: cgHeaders() },
      ),
    ]);

    const unlockData = tokenUnlocks.status === "fulfilled" ? tokenUnlocks.value : null;
    const coin = coinData.status === "fulfilled" ? coinData.value : null;

    const currentPrice = coin?.market_data?.current_price?.usd || 0;
    const circulatingSupply = coin?.market_data?.circulating_supply || 0;
    const totalSupply = coin?.market_data?.total_supply || circulatingSupply;
    const marketCap = coin?.market_data?.market_cap?.usd || 0;

    // Find next upcoming unlock
    const now = Date.now();
    const futureEvents = (unlockData?.events || [])
      .filter((e) => new Date(e.date).getTime() > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const nextEvent = futureEvents[0] || null;
    const threeMonthsCutoff = now + 90 * 24 * 60 * 60 * 1000;
    const upcomingUnlocks = futureEvents.filter(
      (e) => new Date(e.date).getTime() < threeMonthsCutoff,
    );

    // Calculate unlock impact metrics
    let unlockPercent = 0;
    let unlockValueUsd = 0;
    if (nextEvent && circulatingSupply > 0) {
      unlockPercent = (nextEvent.amount / circulatingSupply) * 100;
      unlockValueUsd = currentPrice > 0 ? nextEvent.amount * currentPrice : nextEvent.amountUSD;
    }

    // Selling pressure assessment
    const sellingPressure: "extreme" | "high" | "moderate" | "low" | "none" =
      unlockPercent > 5 ? "extreme" :
        unlockPercent > 2 ? "high" :
          unlockPercent > 0.5 ? "moderate" :
            unlockPercent > 0 ? "low" :
              "none";

    // Historical avg impact estimate (empirical: large unlocks ~2-8% drop)
    const historicalAvgImpact =
      unlockPercent > 5 ? -8.5 :
        unlockPercent > 2 ? -5.2 :
          unlockPercent > 0.5 ? -2.8 :
            unlockPercent > 0 ? -1.0 :
              0;

    // Risk score (1-10)
    const riskRating = Math.min(10, Math.max(1, Math.round(unlockPercent * 2)));

    // Recommendation
    const recommendation =
      sellingPressure === "extreme" ? "Consider reducing position before unlock. Extreme selling pressure expected." :
        sellingPressure === "high" ? "Exercise caution. Significant selling pressure likely around unlock date." :
          sellingPressure === "moderate" ? "Monitor position. Moderate selling pressure possible." :
            sellingPressure === "low" ? "Low risk from unlock. Minimal expected impact on price." :
              "No upcoming unlocks detected.";

    const totalLocked = unlockData?.totalLocked || 0;
    const totalLockedUsd = totalLocked * currentPrice;
    const percentVested = unlockData?.percentVested || (totalSupply > 0 ? (circulatingSupply / totalSupply) * 100 : 0);

    return {
      symbol: symbol.toUpperCase(),
      nextUnlock: nextEvent ? {
        date: nextEvent.date,
        amount: nextEvent.amount,
        valueUsd: unlockValueUsd,
        percentOfCirculating: unlockPercent,
      } : null,
      impactAssessment: {
        sellingPressure,
        historicalAvgImpact,
        riskRating,
        recommendation,
      },
      upcomingUnlocks,
      totalLocked,
      totalLockedUsd,
      percentVested,
    };
  });
}

// ─── Full Vesting Schedule ───────────────────────────────────

/**
 * Get the full vesting schedule for a token, including past and future events.
 */
export async function getVestingSchedule(symbol: string): Promise<VestingSchedule | null> {
  return cache.wrap(`unlocks:vesting:${symbol.toLowerCase()}`, 600, async () => {
    const tokenUnlocks = await getTokenUnlocks(symbol);
    if (!tokenUnlocks) return null;

    // Get current market data for enrichment
    let currentPrice = 0;
    let circulatingSupply = 0;
    let totalSupply = 0;
    try {
      const coin = await fetchJSON<CoinGeckoCoinDetail>(
        `${CG_BASE}/coins/${symbol.toLowerCase()}?localization=false&tickers=false&community_data=false&developer_data=false`,
        { headers: cgHeaders() },
      );
      currentPrice = coin.market_data?.current_price?.usd || 0;
      circulatingSupply = coin.market_data?.circulating_supply || 0;
      totalSupply = coin.market_data?.total_supply || circulatingSupply;
    } catch {
      // Use unlock data totals
      totalSupply = tokenUnlocks.events.reduce((sum, e) => sum + e.amount, 0);
      circulatingSupply = totalSupply - tokenUnlocks.totalLocked;
    }

    return {
      protocol: tokenUnlocks.protocol,
      token: tokenUnlocks.token,
      totalSupply,
      circulatingSupply,
      lockedAmount: tokenUnlocks.totalLocked,
      lockedValueUSD: currentPrice > 0 ? tokenUnlocks.totalLocked * currentPrice : tokenUnlocks.totalLockedUSD,
      percentVested: tokenUnlocks.percentVested,
      schedule: tokenUnlocks.events,
    };
  });
}

// ─── Supply tracking ─────────────────────────────────────────

/** Protocol supply breakdown — circulating, total, max. */
export function getProtocolSupply(protocol: string): Promise<{ protocol: string; emissions: EmissionDetail; fetchedAt: string }> {
  return cache.wrap(`unlocks:supply:${protocol}`, 600, async () => {
    const emissions = await getProtocolEmissions(protocol);
    return {
      protocol,
      emissions,
      fetchedAt: new Date().toISOString(),
    };
  });
}

// ─── Well-known protocols with significant upcoming unlocks ──

export const TRACKED_PROTOCOLS = [
  "arbitrum", "optimism", "aptos", "sui", "celestia", "starknet",
  "worldcoin", "sei", "dymension", "manta-network", "altlayer",
  "pixels", "pyth-network", "jito", "jupiter", "wormhole",
  "layerzero", "eigenlayer", "ethena", "ondo-finance",
  "pendle", "aave", "uniswap", "lido", "maker",
  "compound", "synthetix", "curve-dao", "convex-finance",
  "ribbon-finance", "yearn-finance", "sushi", "balancer",
  "1inch", "dydx", "gmx", "radiant-capital", "camelot",
] as const;

/** Quick overview of tracked protocol emissions. */
export type TrackedProtocol = (typeof TRACKED_PROTOCOLS)[number];

export async function getTrackedEmissions(): Promise<Array<{ protocol: TrackedProtocol; data: EmissionDetail }>> {
  const results = await Promise.allSettled(
    TRACKED_PROTOCOLS.map((p) =>
      getProtocolEmissions(p).then((data) => ({ protocol: p, data })),
    ),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ protocol: TrackedProtocol; data: EmissionDetail }> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v) => !!v.data);
}

