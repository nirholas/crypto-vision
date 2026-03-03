/**
 * Crypto Vision — Staking Data Source
 *
 * Multi-provider staking data:
 *  - Beaconcha.in (ETH validators, epochs, network stats)
 *  - Rated.network (ETH validator performance, operators)
 *  - DeFi Llama (liquid staking protocols, yields, restaking)
 *
 * All endpoints are free / no key required.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

// ─── Types ───────────────────────────────────────────────────

export interface StakingYieldInfo {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  tvlUsd: number;
  rewardTokens: string[] | null;
}

export interface StakingInfo {
  apy: number;
  apr: number;
  tvlUsd: number;
  chain: string;
  project: string;
  symbol: string;
  unbondingDays: number;
  minimumStake: number;
  avgValidatorCommission: number;
}

export interface LiquidStakingProtocol {
  name: string;
  slug: string;
  symbol: string;
  tvl: number;
  change1d: number | null;
  change7d: number | null;
  chains: string[];
  category: string;
  url: string;
  logo: string;
  marketShare: number;
}

export interface RestakingProtocol {
  name: string;
  slug: string;
  symbol: string;
  tvl: number;
  change1d: number | null;
  change7d: number | null;
  chains: string[];
  category: string;
  url: string;
  logo: string;
}

export interface StakingHistoryPoint {
  date: string;
  apy: number;
  tvlUsd: number;
}

// ─── Chain-specific staking parameters ───────────────────────

const CHAIN_STAKING_PARAMS: Record<string, { unbondingDays: number; minimumStake: number; avgCommission: number }> = {
  ethereum: { unbondingDays: 1, minimumStake: 32, avgCommission: 10 },
  cosmos: { unbondingDays: 21, minimumStake: 0.001, avgCommission: 5 },
  solana: { unbondingDays: 2, minimumStake: 0.01, avgCommission: 7 },
  polkadot: { unbondingDays: 28, minimumStake: 250, avgCommission: 3 },
  avalanche: { unbondingDays: 14, minimumStake: 25, avgCommission: 2 },
  cardano: { unbondingDays: 0, minimumStake: 10, avgCommission: 3 },
  near: { unbondingDays: 2, minimumStake: 1, avgCommission: 5 },
  sui: { unbondingDays: 1, minimumStake: 1, avgCommission: 5 },
  aptos: { unbondingDays: 0, minimumStake: 10, avgCommission: 7 },
  celestia: { unbondingDays: 21, minimumStake: 1, avgCommission: 5 },
  osmosis: { unbondingDays: 14, minimumStake: 0.01, avgCommission: 5 },
  injective: { unbondingDays: 21, minimumStake: 0.01, avgCommission: 5 },
  sei: { unbondingDays: 21, minimumStake: 1, avgCommission: 5 },
  bnb: { unbondingDays: 7, minimumStake: 1, avgCommission: 10 },
};

function getChainParams(token: string): { unbondingDays: number; minimumStake: number; avgCommission: number } {
  const key = token.toLowerCase();
  // Map common token symbols to chain names
  const symbolToChain: Record<string, string> = {
    eth: "ethereum", sol: "solana", dot: "polkadot",
    avax: "avalanche", ada: "cardano", atom: "cosmos",
    matic: "ethereum", tia: "celestia", osmo: "osmosis",
    inj: "injective", apt: "aptos", bnb: "bnb",
  };
  const chain = symbolToChain[key] || key;
  return CHAIN_STAKING_PARAMS[chain] || { unbondingDays: 7, minimumStake: 1, avgCommission: 5 };
}

// ─── Beaconcha.in (Ethereum Beacon Chain) ────────────────────

const BEACON_BASE = "https://beaconcha.in/api/v1";

function beaconHeaders(): Record<string, string> {
  const key = process.env.BEACONCHAIN_API_KEY;
  return key ? { apikey: key } : {};
}

/** ETH validator queue (entry/exit). */
export function getValidatorQueue(): Promise<unknown> {
  return cache.wrap("staking:eth:queue", 120, () =>
    fetchJSON(`${BEACON_BASE}/validators/queue`, { headers: beaconHeaders() }),
  );
}

/** Latest epoch info (finalized, justified). */
export function getLatestEpoch(): Promise<unknown> {
  return cache.wrap("staking:eth:epoch", 120, () =>
    fetchJSON(`${BEACON_BASE}/epoch/latest`, { headers: beaconHeaders() }),
  );
}

/** ETH 2.0 network overview stats. */
export function getETHNetworkStats(): Promise<{ epoch: unknown; queue: unknown; fetchedAt: string }> {
  return cache.wrap("staking:eth:network", 120, async () => {
    const [epoch, queue] = await Promise.all([
      getLatestEpoch().catch(() => null),
      getValidatorQueue().catch(() => null),
    ]);

    return {
      epoch: (epoch as Record<string, unknown>)?.data || epoch,
      queue: (queue as Record<string, unknown>)?.data || queue,
      fetchedAt: new Date().toISOString(),
    };
  });
}

/** Validator detail by index or pubkey (Beaconcha.in). */
export function getValidator(indexOrPubkey: string): Promise<unknown> {
  return cache.wrap(`staking:eth:validator:${indexOrPubkey}`, 120, () =>
    fetchJSON(`${BEACON_BASE}/validator/${indexOrPubkey}`, { headers: beaconHeaders() }),
  );
}

/** Validator attestation performance (Beaconcha.in). */
export function getValidatorAttestations(indexOrPubkey: string): Promise<unknown> {
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

/** Rated.network validator overview (Ethereum). */
export function getRatedOverview(window = "30d"): Promise<unknown> {
  return cache.wrap(`staking:rated:overview:${window}`, 300, () =>
    fetchJSON(`${RATED_BASE}/eth/operators?window=${window}&idType=depositAddress&size=50`, {
      headers: ratedHeaders(),
    }),
  );
}

/** Top staking operators by effectiveness (Rated.network). */
export function getTopOperators(window = "30d", size = 50): Promise<unknown> {
  return cache.wrap(`staking:rated:operators:${window}:${size}`, 300, () =>
    fetchJSON(`${RATED_BASE}/eth/operators?window=${window}&idType=depositAddress&size=${size}`, {
      headers: ratedHeaders(),
    }),
  );
}

/** Network-level staking metrics (Rated.network). */
export function getNetworkMetrics(): Promise<unknown> {
  return cache.wrap("staking:rated:network", 300, () =>
    fetchJSON(`${RATED_BASE}/eth/network/overview`, { headers: ratedHeaders() }),
  );
}

// ─── DeFi Llama Liquid Staking ───────────────────────────────

const LLAMA_BASE = "https://api.llama.fi";
const YIELDS_BASE = "https://yields.llama.fi";

interface LlamaProtocol {
  name: string;
  slug: string;
  symbol: string;
  tvl: number;
  change_1d: number | null;
  change_7d: number | null;
  chains: string[];
  chain: string;
  category: string;
  url: string;
  logo: string;
}

interface YieldPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  tvlUsd: number;
  rewardTokens: string[] | null;
  category: string;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
}

/** Liquid staking protocols from DeFi Llama. */
export function getLiquidStakingProtocols(): Promise<LlamaProtocol[]> {
  return cache.wrap("staking:liquid", 300, () =>
    fetchJSON<LlamaProtocol[]>(`${LLAMA_BASE}/protocols`),
  );
}

/** Filter DeFi Llama protocols to find liquid staking ones. */
export async function getLiquidStaking(): Promise<LiquidStakingProtocol[]> {
  return cache.wrap("staking:liquid:filtered", 300, async () => {
    const protocols = await fetchJSON<LlamaProtocol[]>(`${LLAMA_BASE}/protocols`);
    const lstProtocols = protocols
      .filter((p) =>
        p.category === "Liquid Staking" ||
        p.category === "liquid staking",
      )
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 50);

    const totalTvl = lstProtocols.reduce((sum, p) => sum + (p.tvl || 0), 0);

    return lstProtocols.map((p) => ({
      name: p.name,
      slug: p.slug,
      symbol: p.symbol,
      tvl: p.tvl,
      change1d: p.change_1d,
      change7d: p.change_7d,
      chains: p.chains,
      category: p.category,
      url: p.url,
      logo: p.logo,
      marketShare: totalTvl > 0 ? ((p.tvl || 0) / totalTvl) * 100 : 0,
    }));
  });
}

/**
 * Liquid staking comparison filtered by chain.
 */
export async function getLiquidStakingByChain(chain: string): Promise<LiquidStakingProtocol[]> {
  return cache.wrap(`staking:liquid:chain:${chain.toLowerCase()}`, 300, async () => {
    const protocols = await fetchJSON<LlamaProtocol[]>(`${LLAMA_BASE}/protocols`);
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const chainName = capitalize(chain);

    const lstProtocols = protocols
      .filter((p) =>
        (p.category === "Liquid Staking" || p.category === "liquid staking") &&
        p.chains.some((ch) => ch.toLowerCase() === chain.toLowerCase()),
      )
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0));

    const totalTvl = lstProtocols.reduce((sum, p) => sum + (p.tvl || 0), 0);

    return lstProtocols.map((p) => ({
      name: p.name,
      slug: p.slug,
      symbol: p.symbol,
      tvl: p.tvl,
      change1d: p.change_1d,
      change7d: p.change_7d,
      chains: p.chains,
      category: p.category,
      url: p.url,
      logo: p.logo,
      marketShare: totalTvl > 0 ? ((p.tvl || 0) / totalTvl) * 100 : 0,
    }));
  });
}

// ─── Restaking (EigenLayer and similar) ──────────────────────

/**
 * Restaking protocol metrics from DeFi Llama.
 * Filters for "Restaking" category protocols (EigenLayer, Symbiotic, etc.)
 */
export async function getRestakingProtocols(): Promise<RestakingProtocol[]> {
  return cache.wrap("staking:restaking", 300, async () => {
    const protocols = await fetchJSON<LlamaProtocol[]>(`${LLAMA_BASE}/protocols`);
    return protocols
      .filter((p) =>
        p.category === "Restaking" ||
        p.category === "restaking" ||
        p.name?.toLowerCase().includes("eigenlayer") ||
        p.name?.toLowerCase().includes("symbiotic") ||
        p.name?.toLowerCase().includes("karak") ||
        p.name?.toLowerCase().includes("restaking"),
      )
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        symbol: p.symbol,
        tvl: p.tvl,
        change1d: p.change_1d,
        change7d: p.change_7d,
        chains: p.chains,
        category: p.category,
        url: p.url,
        logo: p.logo,
      }));
  });
}

// ─── Multi-chain staking yields ──────────────────────────────

/** Staking yields across chains from DeFi Llama yield pools. */
export async function getStakingYields(): Promise<StakingYieldInfo[]> {
  return cache.wrap("staking:yields", 300, async () => {
    const pools = await fetchJSON<{ data: YieldPool[] }>(
      `${YIELDS_BASE}/pools`,
    );
    return (pools.data || [])
      .filter(
        (p) =>
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
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 100)
      .map((p) => ({
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

/**
 * Get staking yield for a specific token.
 * Searches yield pools for the best match.
 */
export async function getStakingYield(token: string): Promise<StakingInfo> {
  return cache.wrap(`staking:yield:${token.toLowerCase()}`, 300, async () => {
    const pools = await fetchJSON<{ data: YieldPool[] }>(
      `${YIELDS_BASE}/pools`,
    );
    const upperToken = token.toUpperCase();

    // Find the best matching pool — prioritize native staking (highest TVL)
    const matches = (pools.data || [])
      .filter(
        (p) =>
          p.symbol?.toUpperCase().includes(upperToken) &&
          p.apy > 0 &&
          p.tvlUsd > 10_000,
      )
      .sort((a, b) => b.tvlUsd - a.tvlUsd);

    const best = matches[0];
    const chainParams = getChainParams(token);

    if (!best) {
      return {
        apy: 0,
        apr: 0,
        tvlUsd: 0,
        chain: "unknown",
        project: "unknown",
        symbol: upperToken,
        unbondingDays: chainParams.unbondingDays,
        minimumStake: chainParams.minimumStake,
        avgValidatorCommission: chainParams.avgCommission,
      };
    }

    // APY to APR conversion: APR = 365 * ((1 + APY/100)^(1/365) - 1) * 100
    const apyDecimal = best.apy / 100;
    const apr = 365 * (Math.pow(1 + apyDecimal, 1 / 365) - 1) * 100;

    return {
      apy: best.apy,
      apr,
      tvlUsd: best.tvlUsd,
      chain: best.chain,
      project: best.project,
      symbol: best.symbol,
      unbondingDays: chainParams.unbondingDays,
      minimumStake: chainParams.minimumStake,
      avgValidatorCommission: chainParams.avgCommission,
    };
  });
}

/**
 * Historical staking rate for a token.
 * Uses DeFi Llama yield chart data for the pool with highest TVL.
 */
export async function getStakingHistory(token: string): Promise<StakingHistoryPoint[]> {
  return cache.wrap(`staking:history:${token.toLowerCase()}`, 600, async () => {
    // Get pools to find the best pool ID for this token
    const pools = await fetchJSON<{ data: YieldPool[] }>(
      `${YIELDS_BASE}/pools`,
    );
    const upperToken = token.toUpperCase();

    const best = (pools.data || [])
      .filter(
        (p) =>
          p.symbol?.toUpperCase().includes(upperToken) &&
          p.apy > 0 &&
          p.tvlUsd > 10_000,
      )
      .sort((a, b) => b.tvlUsd - a.tvlUsd)[0];

    if (!best) return [];

    // Fetch historical chart data for this pool
    const chart = await fetchJSON<{ data: Array<{ timestamp: string; apy: number; tvlUsd: number }> }>(
      `${YIELDS_BASE}/chart/${best.pool}`,
    ).catch(() => ({ data: [] }));

    return (chart.data || [])
      .slice(-365) // Last 365 data points
      .map((point) => ({
        date: point.timestamp,
        apy: point.apy,
        tvlUsd: point.tvlUsd,
      }));
  });
}

/**
 * Get validators for a specific chain.
 * Currently supports Ethereum via Rated.network.
 * For other chains, returns aggregated staking pool data from DeFi Llama.
 */
export async function getChainValidators(chain: string): Promise<unknown> {
  const lowerChain = chain.toLowerCase();

  if (lowerChain === "ethereum" || lowerChain === "eth") {
    return cache.wrap("staking:validators:ethereum", 300, async () => {
      const [operators, metrics] = await Promise.all([
        getTopOperators("30d", 100).catch(() => []),
        getNetworkMetrics().catch(() => null),
      ]);
      return {
        chain: "ethereum",
        operators,
        networkMetrics: metrics,
        fetchedAt: new Date().toISOString(),
      };
    });
  }

  // For non-ETH chains: return staking pools from DeFi Llama yields
  return cache.wrap(`staking:validators:${lowerChain}`, 300, async () => {
    const pools = await fetchJSON<{ data: YieldPool[] }>(
      `${YIELDS_BASE}/pools`,
    );

    const chainPools = (pools.data || [])
      .filter(
        (p) =>
          p.chain?.toLowerCase() === lowerChain &&
          (p.project?.toLowerCase().includes("staking") ||
            p.category === "Liquid Staking") &&
          p.apy > 0,
      )
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 50)
      .map((p) => ({
        project: p.project,
        symbol: p.symbol,
        apy: p.apy,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
        tvlUsd: p.tvlUsd,
      }));

    return {
      chain: lowerChain,
      stakingPools: chainPools,
      count: chainPools.length,
      fetchedAt: new Date().toISOString(),
    };
  });
}

// ─── Aggregate staking overview ──────────────────────────────

/** Comprehensive staking dashboard — combines beacon chain, Rated, and liquid staking. */
export async function getStakingOverview(): Promise<{
  ethNetwork: { epoch: unknown; queue: unknown; fetchedAt: string } | null;
  liquidStaking: LiquidStakingProtocol[];
  topYields: StakingYieldInfo[];
  restaking: RestakingProtocol[];
  totalLSTTvl: number;
  totalRestakingTvl: number;
}> {
  const [ethNetwork, liquidStaking, topYields, restaking] = await Promise.all([
    getETHNetworkStats().catch(() => null),
    getLiquidStaking().catch(() => []),
    getStakingYields().then((y) => y.slice(0, 20)).catch(() => []),
    getRestakingProtocols().catch(() => []),
  ]);

  return {
    ethNetwork,
    liquidStaking,
    topYields,
    restaking: restaking.slice(0, 10),
    totalLSTTvl: liquidStaking.reduce((sum, p) => sum + (p.tvl || 0), 0),
    totalRestakingTvl: restaking.reduce((sum, p) => sum + (p.tvl || 0), 0),
  };
}
