/**
 * Crypto Vision — Etherscan / EVM Chain Data Sources
 *
 * Free tiers available for all explorers (5 req/sec).
 *
 * Provides: gas oracle, token supply, contract info,
 *           ERC-20 top holders, and multi-chain EVM gas.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { ingestGasPrices } from "../lib/bq-ingest.js";

// ─── Multi-Chain Gas Tracking ────────────────────────────────

interface GasEstimate {
  chain: string;
  low: number;
  average: number;
  high: number;
  unit: string;
}

/**
 * Owlracle — Free multi-chain gas oracle (no key, fair use).
 * Supports: Ethereum, BSC, Polygon, Avalanche, Fantom, Arbitrum, Optimism.
 */
const OWLRACLE_CHAINS: Record<string, string> = {
  ethereum: "eth",
  bsc: "bsc",
  polygon: "poly",
  avalanche: "avax",
  fantom: "ftm",
  arbitrum: "arb",
  optimism: "opt",
};

export async function getGasOracle(chain = "ethereum"): Promise<{
  speeds: Array<{ acceptance: number; gasPrice: number; estimatedFee: number }>;
  timestamp: number;
}> {
  const slug = OWLRACLE_CHAINS[chain] || "eth";
  const key = process.env.OWLRACLE_API_KEY || "";
  const q = key ? `?apikey=${key}` : "";
  return cache.wrap(`gas:${slug}`, 30, () =>
    fetchJSON(`https://api.owlracle.info/v4/${slug}/gas${q}`),
  );
}

export async function getMultiChainGas(): Promise<GasEstimate[]> {
  const data = await cache.wrap("gas:multi", 30, async () => {
    const chains = Object.keys(OWLRACLE_CHAINS);
    const results = await Promise.allSettled(
      chains.map((chain) => getGasOracle(chain)),
    );

    const estimates: GasEstimate[] = [];
    for (let i = 0; i < chains.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && r.value.speeds?.length >= 3) {
        const speeds = r.value.speeds;
        estimates.push({
          chain: chains[i],
          low: speeds[0].gasPrice,
          average: speeds[1].gasPrice,
          high: speeds[speeds.length - 1].gasPrice,
          unit: "gwei",
        });
      }
    }
    return estimates;
  });
  ingestGasPrices(
    data.map(g => ({ chain: g.chain, fast: g.high, standard: g.average, slow: g.low })),
  );
  return data;
}

// ─── Etherscan (with key) ────────────────────────────────────

const ETHERSCAN = "https://api.etherscan.io/api";

function es<T>(params: Record<string, string>, ttl: number): Promise<T> {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw new Error("ETHERSCAN_API_KEY not set");
  const p = new URLSearchParams({ ...params, apikey: key });
  const cacheKey = `etherscan:${params.module}:${params.action}:${JSON.stringify(params)}`;
  return cache.wrap(cacheKey, ttl, () =>
    fetchJSON<T>(`${ETHERSCAN}?${p}`),
  );
}

export function getEthGasOracle(): Promise<{
  result: {
    LastBlock: string;
    SafeGasPrice: string;
    ProposeGasPrice: string;
    FastGasPrice: string;
    suggestBaseFee: string;
    gasUsedRatio: string;
  };
}> {
  return es({ module: "gastracker", action: "gasoracle" }, 15);
}

export function getEthSupply(): Promise<{ result: string }> {
  return es({ module: "stats", action: "ethsupply" }, 3600);
}

export function getEthPrice(): Promise<{
  result: { ethbtc: string; ethbtc_timestamp: string; ethusd: string; ethusd_timestamp: string };
}> {
  return es({ module: "stats", action: "ethprice" }, 30);
}

export function getERC20TopHolders(
  contractAddress: string,
): Promise<{
  result: Array<{ TokenHolderAddress: string; TokenHolderQuantity: string; percentage: string }>;
}> {
  return es(
    { module: "token", action: "tokenholderlist", contractaddress: contractAddress, page: "1", offset: "20" },
    600,
  );
}
