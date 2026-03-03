/**
 * Crypto Vision — Jupiter / Solana Data Source
 *
 * 100% free, no API key.
 * https://price.jup.ag, https://quote-api.jup.ag, https://token.jup.ag
 *
 * Provides: Solana token prices, swap quotes, token list,
 *           trending tokens, top tokens by volume.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const PRICE_API = "https://price.jup.ag/v6";
const QUOTE_API = "https://quote-api.jup.ag/v6";
const TOKEN_API = "https://token.jup.ag";

// ─── Prices ──────────────────────────────────────────────────

export interface JupiterPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
  timeTaken: number;
}

export function getPrice(ids: string): Promise<{ data: Record<string, JupiterPrice> }> {
  return cache.wrap(`jup:price:${ids}`, 15, () =>
    fetchJSON(`${PRICE_API}/price?ids=${ids}`)
  );
}

export function getPriceVs(
  ids: string,
  vsToken = "USDC",
): Promise<{ data: Record<string, JupiterPrice> }> {
  return cache.wrap(`jup:price:${ids}:${vsToken}`, 15, () =>
    fetchJSON(`${PRICE_API}/price?ids=${ids}&vsToken=${vsToken}`)
  );
}

// ─── Swap Quote ──────────────────────────────────────────────

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export function getQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = 50,
): Promise<JupiterQuote> {
  return cache.wrap(`jup:quote:${inputMint}:${outputMint}:${amount}`, 10, () =>
    fetchJSON(
      `${QUOTE_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`,
    )
  );
}

// ─── Token List ──────────────────────────────────────────────

export interface JupiterToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI: string;
  tags: string[];
  extensions?: Record<string, string>;
}

export function getTokenList(): Promise<JupiterToken[]> {
  return cache.wrap("jup:tokens", 3600, () =>
    fetchJSON(`${TOKEN_API}/all`)
  );
}

export function getStrictTokenList(): Promise<JupiterToken[]> {
  return cache.wrap("jup:tokens:strict", 3600, () =>
    fetchJSON(`${TOKEN_API}/strict`)
  );
}

// ─── Popular Solana Token Mints ──────────────────────────────

export const POPULAR_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  MSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
} as const;

export async function getPopularPrices(): Promise<Record<string, JupiterPrice>> {
  const mints = Object.values(POPULAR_MINTS).join(",");
  const res = await getPrice(mints);
  return res.data;
}

// ─── Market helpers ──────────────────────────────────────────

export async function getTopTokensByMarketCap(limit = 50): Promise<JupiterToken[]> {
  const tokens = await getStrictTokenList();
  // The strict list is already curated; return top N
  return tokens.slice(0, limit);
}

export async function searchTokens(query: string, limit = 20): Promise<JupiterToken[]> {
  const tokens = await getStrictTokenList();
  const q = query.toLowerCase();
  return tokens
    .filter((t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address === query
    )
    .slice(0, limit);
}
