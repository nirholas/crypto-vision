/**
 * Crypto Vision — Staking Data Source
 *
 * Multi-provider staking data:
 *  - Beaconcha.in (ETH validators, epochs, network stats)
 *  - Rated.network (ETH validator performance, operators)
 *  - DeFi Llama (liquid staking protocols)
 *
 * All endpoints are free / no key required.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

// ─── Beaconcha.in (Ethereum Beacon Chain) ────────────────────

const BEACON_BASE = "https://beaconcha.in/api/v1";

function beaconHeaders(): Record<string, string> {
  const key = process.env.BEACONCHAIN_API_KEY;
  return key ? { apikey: key } : {};
}

/**
 * ETH validator queue (entry/exit).
 */
export function getValidatorQueue(): Promise<any> {
  return cache.wrap("staking:eth:queue", 120, () =>
    fetchJSON(`${BEACON_BASE}/validators/queue`, { headers: beaconHeaders() }),
  );
}

/**
 * Latest epoch info (finalized, justified).
 */
export function getLatestEpoch(): Promise<any> {
  return cache.wrap("staking:eth:epoch", 120, () =>
    fetchJSON(`${BEACON_BASE}/epoch/latest`, { headers: beaconHeaders() }),
  );
}

/**
 * ETH 2.0 network overview stats.
 */
export function getETHNetworkStats(): Promise<any> {
  return cache.wrap("staking:eth:network", 120, async () => {
    const [epoch, queue] = await Promise.all([
      getLatestEpoch().catch(() => null),
      getValidatorQueue().catch(() => null),
    ]);

    return {
      epoch: (epoch as any)?.data || epoch,
      queue: (queue as any)?.data || queue,
      fetchedAt: new Date().toISOString(),
    };
  });
}

/**
 * Validator detail by index or pubkey (Beaconcha.in).
 */
export function getValidator(indexOrPubkey: string): Promise<any> {
  return cache.wrap(`staking:eth:validator:${indexOrPubkey}`, 120, () =>
    fetchJSON(`${BEACON_BASE}/validator/${indexOrPubkey}`, { headers: beaconHeaders() }),
  );
}

/**
 * Validator attestation performance (Beaconcha.in).
 */
export function getValidatorAttestations(indexOrPubkey: string): Promise<any> {
  return cache.wrap(`staking:eth:attestations:${indexOrPubkey}`, 300, () =>
    fetchJSON(`${BEACON_BASE}/validator/${indexOrPubkey}/attestations`, { headers: beaconHeaders() }),
  );
}

// ─── Rated.network (Validator Analytics) ─────────────────────

const RATED_BASE = "https://api.rated.network/v0";

function ratedHeaders(): Record<string, string> {
  const key = process.env.RATED_API_KEY;
  return key
    ? { Authorization: `Bearer ${key}`, Accept: "application/json" }
    : { Accept: "application/json" };
}

/**
 * Rated.network validator overview (Ethereum).
 */
export function getRatedOverview(window = "30d"): Promise<any> {
  return cache.wrap(`staking:rated:overview:${window}`, 300, () =>
    fetchJSON(`${RATED_BASE}/eth/operators?window=${window}&idType=depositAddress&size=50`, {
      headers: ratedHeaders(),
    }),
  );
}

/**
 * Top staking operators by effectiveness (Rated.network).
 */
export function getTopOperators(window = "30d", size = 50): Promise<any> {
  return cache.wrap(`staking:rated:operators:${window}:${size}`, 300, () =>
    fetchJSON(`${RATED_BASE}/eth/operators?window=${window}&idType=depositAddress&size=${size}`, {
      headers: ratedHeaders(),
    }),
  );
}

/**
 * Network-level staking metrics (Rated.network).
 */
export function getNetworkMetrics(): Promise<any> {
  return cache.wrap("staking:rated:network", 300, () =>
    fetchJSON(`${RATED_BASE}/eth/network/overview`, { headers: ratedHeaders() }),
  );
}

// ─── DeFi Llama Liquid Staking ───────────────────────────────

const LLAMA_BASE = "https://api.llama.fi";

/**
 * Liquid staking protocols from DeFi Llama.
 */
export function getLiquidStakingProtocols(): Promise<any> {
  return cache.wrap("staking:liquid", 300, () =>
    fetchJSON(`${LLAMA_BASE}/protocols`),
  );
}

/**
 * Filter DeFi Llama protocols to find liquid staking ones.
 */
export async function getLiquidStaking(): Promise<any[]> {
  return cache.wrap("staking:liquid:filtered", 300, async () => {
    const protocols = await fetchJSON<any[]>(`${LLAMA_BASE}/protocols`);
    return protocols
      .filter((p: any) =>
        p.category === "Liquid Staking" ||
        p.category === "liquid staking" ||
        p.name?.toLowerCase().includes("staking"),
      )
      .sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 50)
      .map((p: any) => ({
        name: p.name,
        symbol: p.symbol,
        tvl: p.tvl,
        tvlChange1d: p.change_1d,
        tvlChange7d: p.change_7d,
        chain: p.chain,
        chains: p.chains,
        category: p.category,
        url: p.url,
        logo: p.logo,
      }));
  });
}

// ─── Multi-chain staking yields ──────────────────────────────

/**
 * Staking yields across chains from DeFi Llama yield pools.
 */
export async function getStakingYields(): Promise<any[]> {
  return cache.wrap("staking:yields", 300, async () => {
    const pools = await fetchJSON<{ data: any[] }>(
      "https://yields.llama.fi/pools",
    );
    return (pools.data || [])
      .filter(
        (p: any) =>
          (p.project?.toLowerCase().includes("staking") ||
            p.project?.toLowerCase().includes("lido") ||
            p.project?.toLowerCase().includes("rocket") ||
            p.project?.toLowerCase().includes("coinbase") ||
            p.project?.toLowerCase().includes("mantle") ||
            p.project?.toLowerCase().includes("frax-ether") ||
            p.project?.toLowerCase().includes("swell") ||
            p.project?.toLowerCase().includes("binance-staked") ||
            p.category === "Liquid Staking") &&
          p.apy > 0 &&
          p.tvlUsd > 100_000,
      )
      .sort((a: any, b: any) => b.tvlUsd - a.tvlUsd)
      .slice(0, 100)
      .map((p: any) => ({
        pool: p.pool,
        chain: p.chain,
        project: p.project,
        symbol: p.symbol,
        apy: p.apy,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
        tvlUsd: p.tvlUsd,
        rewardTokens: p.rewardTokens,
      }));
  });
}

// ─── Aggregate staking overview ──────────────────────────────

/**
 * Comprehensive staking dashboard — combines beacon chain, Rated, and liquid staking.
 */
export async function getStakingOverview(): Promise<{
  ethNetwork: any;
  liquidStaking: any[];
  topYields: any[];
}> {
  const [ethNetwork, liquidStaking, topYields] = await Promise.all([
    getETHNetworkStats().catch(() => null),
    getLiquidStaking().catch(() => []),
    getStakingYields().then((y) => y.slice(0, 20)).catch(() => []),
  ]);

  return { ethNetwork, liquidStaking, topYields };
}
