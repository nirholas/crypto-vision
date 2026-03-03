/**
 * Crypto Vision — Token Unlocks & Emissions Data Source
 *
 * Free data on token vesting schedules, upcoming unlocks, and emissions.
 *  - DeFi Llama emissions API
 *  - CoinGecko developer/community data
 *
 * All endpoints are free.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

// ─── DeFi Llama Emissions ────────────────────────────────────

const LLAMA_BASE = "https://api.llama.fi";

/**
 * Get all protocols with emission data from DeFi Llama.
 */
export function getEmissionsProtocols(): Promise<any[]> {
  return cache.wrap("unlocks:protocols", 600, () =>
    fetchJSON(`${LLAMA_BASE}/emissions`),
  );
}

/**
 * Get emission schedule for a specific protocol (DeFi Llama).
 */
export function getProtocolEmissions(protocol: string): Promise<any> {
  return cache.wrap(`unlocks:emissions:${protocol}`, 600, () =>
    fetchJSON(`${LLAMA_BASE}/emission/${protocol}`),
  );
}

// ─── Custom unlock tracker (aggregated from multiple sources) ─

export interface TokenUnlock {
  protocol: string;
  token: string;
  amount: number;
  amountUSD?: number;
  unlockDate: string;
  category: string; // "team", "investor", "ecosystem", "community"
  percentOfSupply?: number;
  cliff: boolean;
  linear: boolean;
}

/**
 * Major upcoming token unlocks — manually curated list of tracked protocols
 * augmented with live DeFi Llama emissions data.
 */
export async function getUpcomingUnlocks(days = 30): Promise<{
  upcoming: TokenUnlock[];
  totalValueUSD: number;
  count: number;
}> {
  return cache.wrap(`unlocks:upcoming:${days}`, 300, async () => {
    // Fetch emission data from DeFi Llama for tracked protocols
    const protocols = await getEmissionsProtocols().catch(() => []);

    // Filter for protocols that have upcoming events within the timeframe
    const now = Date.now();
    const cutoff = now + days * 24 * 60 * 60 * 1000;

    const upcoming: TokenUnlock[] = [];
    let totalValueUSD = 0;

    for (const protocol of (protocols as any[]).slice(0, 200)) {
      if (!protocol?.name) continue;

      // Look for emission events within our window
      try {
        const detail = await getProtocolEmissions(protocol.name.toLowerCase().replace(/\s+/g, "-"));
        if (!detail) continue;

        const events = (detail as any).events || (detail as any).unlocks || [];
        for (const event of events) {
          const unlockTime = event.timestamp ? event.timestamp * 1000 : 0;
          if (unlockTime > now && unlockTime < cutoff) {
            const usd = event.noOfTokens && protocol.price
              ? event.noOfTokens * protocol.price
              : event.amountUSD || 0;

            upcoming.push({
              protocol: protocol.name,
              token: protocol.symbol || protocol.name,
              amount: event.noOfTokens || event.amount || 0,
              amountUSD: usd,
              unlockDate: new Date(unlockTime).toISOString(),
              category: event.description || event.category || "unknown",
              percentOfSupply: event.percentOfSupply,
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

// ─── Supply tracking ─────────────────────────────────────────

/**
 * Protocol supply breakdown — circulating, total, max.
 */
export function getProtocolSupply(protocol: string): Promise<any> {
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

/**
 * Quick overview of tracked protocol emissions.
 */
export async function getTrackedEmissions(): Promise<any[]> {
  const results = await Promise.allSettled(
    TRACKED_PROTOCOLS.map((p) =>
      getProtocolEmissions(p).then((data) => ({ protocol: p, data })),
    ),
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<{ protocol: string; data: any }>).value)
    .filter((v) => !!v.data);
}

