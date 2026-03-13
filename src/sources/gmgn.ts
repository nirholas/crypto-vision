/**
 * GMGN Smart Money Data Source
 *
 * Reads bscwallets.json and solwallets.json from disk, processes them into
 * a unified wallet leaderboard and generates simulated trade events
 * based on actual wallet activity patterns.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// ─── Types ──────────────────────────────────────────────────

interface GmgnWalletRaw {
  wallet_address: string;
  address: string;
  last_active: number;
  realized_profit_1d: string;
  realized_profit_7d: string;
  realized_profit_30d: string;
  buy: number;
  buy_1d: number;
  buy_7d: number;
  buy_30d: number;
  sell: number;
  sell_1d: number;
  sell_7d: number;
  sell_30d: number;
  pnl_1d: string;
  pnl_7d: string;
  pnl_30d: string;
  txs: number;
  txs_1d: number;
  txs_7d: number;
  txs_30d: number;
  balance: string;
  eth_balance: string;
  sol_balance: string;
  follow_count: number;
  remark_count: number;
  twitter_username: string;
  avatar: string;
  nickname: string;
  tags: string[];
  twitter_name: string;
  name: string;
  winrate_1d: number;
  winrate_7d: number;
  winrate_30d: number;
  avg_cost_1d: string;
  avg_cost_7d: string;
  avg_cost_30d: string;
  pnl_lt_minus_dot5_num_7d: number;
  pnl_minus_dot5_0x_num_7d: number;
  pnl_lt_2x_num_7d: number;
  pnl_2x_5x_num_7d: number;
  pnl_gt_5x_num_7d: number;
}

interface GmgnHoldingItem {
  balance: string;
  realized_profit: string;
  history_total_buys: number;
  history_total_sells: number;
  token: {
    token_address: string;
    symbol: string;
    name: string;
    price: string;
    liquidity: string;
    is_honeypot: boolean;
  };
}

interface GmgnFileRaw {
  meta: { chain: string; version: string; startedAt: string; finishedAt: string };
  interceptor: Record<string, number>;
  smartMoney: {
    wallets: Record<string, GmgnWalletRaw[]>;
    walletDetails: Record<string, Record<string, unknown>>;
    walletHoldings: Record<string, { list: GmgnHoldingItem[] }>;
  };
  kol: {
    wallets: Array<{
      wallet_address: string;
      twitter_username: string;
      twitter_name: string;
      avatar: string;
      tags: string[];
      realized_profit_7d: string;
      realized_profit_30d: string;
      pnl_7d: string;
      pnl_30d: string;
      winrate_7d: number;
      winrate_30d: number;
      buy_7d: number;
      sell_7d: number;
      net_inflow_30d: string;
    }>;
  };
  tokens: {
    trending: Array<{
      address: string;
      symbol: string;
      name: string;
      chain: string;
      price: string;
      volume: string;
      liquidity: string;
      market_cap: string;
      swaps: number;
    }>;
  };
}

// ─── Exported Types ─────────────────────────────────────────

export type WalletCategory =
  | "smart_degen"
  | "launchpad_smart"
  | "fresh_wallet"
  | "snipe_bot"
  | "live"
  | "top_dev"
  | "top_followed"
  | "top_renamed"
  | "kol";

export interface WalletSummary {
  address: string;
  chain: "bsc" | "sol";
  category: WalletCategory;
  pnl7d: number;
  pnl30d: number;
  winrate7d: number;
  winrate30d: number;
  buys7d: number;
  sells7d: number;
  txs7d: number;
  volume30d: number;
  avgCost7d: number;
  realizedProfit7d: number;
  realizedProfit30d: number;
  twitterUsername: string;
  twitterName: string;
  avatar: string;
  name: string;
  tags: string[];
  followCount: number;
  lastActive: number;
}

export interface TradeEvent {
  id: string;
  timestamp: number;
  chain: "bsc" | "sol";
  walletAddress: string;
  walletLabel: string;
  walletCategory: WalletCategory;
  action: "buy" | "sell" | "first_buy";
  tokenSymbol: string;
  tokenAddress: string;
  amountUsd: number;
  pnlPercent: number | null;
  walletPnl7d: number;
  winrate: number;
  avatar: string;
  twitterUsername: string;
}

// ─── Cache ──────────────────────────────────────────────────

let bscData: GmgnFileRaw | null = null;
let solData: GmgnFileRaw | null = null;
let walletCache: WalletSummary[] | null = null;
let tradeEventCache: TradeEvent[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 300_000; // 5 min

async function loadFile(chain: "bsc" | "sol"): Promise<GmgnFileRaw> {
  const filename = chain === "bsc" ? "bscwallets.json" : "solwallets.json";
  const filePath = resolve(process.cwd(), filename);
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as GmgnFileRaw;
}

async function ensureData(): Promise<void> {
  if (bscData && solData && Date.now() - cacheTimestamp < CACHE_TTL) return;

  const [bsc, sol] = await Promise.all([loadFile("bsc"), loadFile("sol")]);
  bscData = bsc;
  solData = sol;
  walletCache = null;
  tradeEventCache = null;
  cacheTimestamp = Date.now();
}

// ─── Process Wallets ────────────────────────────────────────

function processWallets(data: GmgnFileRaw, chain: "bsc" | "sol"): WalletSummary[] {
  const results: WalletSummary[] = [];
  const seen = new Set<string>();

  // Process smart money categories
  for (const [category, wallets] of Object.entries(data.smartMoney.wallets)) {
    if (!Array.isArray(wallets)) continue;
    for (const w of wallets) {
      if (seen.has(w.wallet_address)) continue;
      seen.add(w.wallet_address);

      results.push({
        address: w.wallet_address,
        chain,
        category: category as WalletCategory,
        pnl7d: safeFloat(w.pnl_7d),
        pnl30d: safeFloat(w.pnl_30d),
        winrate7d: w.winrate_7d ?? 0,
        winrate30d: w.winrate_30d ?? 0,
        buys7d: w.buy_7d ?? 0,
        sells7d: w.sell_7d ?? 0,
        txs7d: w.txs_7d ?? 0,
        volume30d: safeFloat(w.avg_cost_30d) * (w.buy_30d + w.sell_30d),
        avgCost7d: safeFloat(w.avg_cost_7d),
        realizedProfit7d: safeFloat(w.realized_profit_7d),
        realizedProfit30d: safeFloat(w.realized_profit_30d),
        twitterUsername: w.twitter_username || "",
        twitterName: w.twitter_name || w.name || "",
        avatar: w.avatar || "",
        name: w.name || w.nickname || "",
        tags: w.tags || [],
        followCount: w.follow_count ?? 0,
        lastActive: w.last_active ?? 0,
      });
    }
  }

  // Process KOL wallets
  if (data.kol?.wallets) {
    for (const k of data.kol.wallets) {
      if (seen.has(k.wallet_address)) continue;
      seen.add(k.wallet_address);

      results.push({
        address: k.wallet_address,
        chain,
        category: "kol",
        pnl7d: safeFloat(k.pnl_7d),
        pnl30d: safeFloat(k.pnl_30d),
        winrate7d: k.winrate_7d ?? 0,
        winrate30d: k.winrate_30d ?? 0,
        buys7d: k.buy_7d ?? 0,
        sells7d: k.sell_7d ?? 0,
        txs7d: (k.buy_7d ?? 0) + (k.sell_7d ?? 0),
        volume30d: 0,
        avgCost7d: 0,
        realizedProfit7d: safeFloat(k.realized_profit_7d),
        realizedProfit30d: safeFloat(k.realized_profit_30d),
        twitterUsername: k.twitter_username || "",
        twitterName: k.twitter_name || "",
        avatar: k.avatar || "",
        name: k.twitter_name || "",
        tags: k.tags || [],
        followCount: 0,
        lastActive: 0,
      });
    }
  }

  return results;
}

// ─── Generate Trade Events ──────────────────────────────────

function generateTradeEvents(
  data: GmgnFileRaw,
  chain: "bsc" | "sol",
  wallets: WalletSummary[],
): TradeEvent[] {
  const events: TradeEvent[] = [];
  const holdings = data.smartMoney.walletHoldings;
  let eventId = 0;
  const now = Date.now();

  // Build a wallet lookup for quick access
  const walletMap = new Map<string, WalletSummary>();
  for (const w of wallets) walletMap.set(w.address, w);

  // For each wallet with holdings, create trade events
  for (const [addr, holdingData] of Object.entries(holdings)) {
    if (!holdingData?.list) continue;
    const wallet = walletMap.get(addr);
    if (!wallet) continue;

    for (const item of holdingData.list) {
      if (!item.token?.symbol) continue;
      if (item.token.is_honeypot) continue;

      const buys = item.history_total_buys ?? 0;
      const sells = item.history_total_sells ?? 0;
      const profit = safeFloat(item.realized_profit);
      const tokenPrice = safeFloat(item.token.price);
      const liquidity = safeFloat(item.token.liquidity);

      if (liquidity < 1000) continue; // skip dust

      // Generate buy events
      if (buys > 0) {
        const avgBuySize = wallet.avgCost7d > 0 ? wallet.avgCost7d : 200;
        events.push({
          id: `${chain}-${eventId++}`,
          timestamp: now - Math.floor(Math.random() * 3600_000),
          chain,
          walletAddress: addr,
          walletLabel: wallet.name || wallet.twitterUsername || shortAddr(addr),
          walletCategory: wallet.category,
          action: buys <= 2 ? "first_buy" : "buy",
          tokenSymbol: item.token.symbol,
          tokenAddress: item.token.token_address,
          amountUsd: Math.min(avgBuySize * (0.5 + Math.random()), 50_000),
          pnlPercent: profit !== 0 ? (profit / (avgBuySize * buys + 1)) * 100 : null,
          walletPnl7d: wallet.realizedProfit7d,
          winrate: wallet.winrate7d,
          avatar: wallet.avatar,
          twitterUsername: wallet.twitterUsername,
        });
      }

      // Generate sell events
      if (sells > 0 && profit !== 0) {
        const avgSellSize = wallet.avgCost7d > 0 ? wallet.avgCost7d : 200;
        events.push({
          id: `${chain}-${eventId++}`,
          timestamp: now - Math.floor(Math.random() * 3600_000),
          chain,
          walletAddress: addr,
          walletLabel: wallet.name || wallet.twitterUsername || shortAddr(addr),
          walletCategory: wallet.category,
          action: "sell",
          tokenSymbol: item.token.symbol,
          tokenAddress: item.token.token_address,
          amountUsd: Math.min(avgSellSize * (0.5 + Math.random()), 50_000),
          pnlPercent: profit !== 0 ? (profit / (avgSellSize * sells + 1)) * 100 : null,
          walletPnl7d: wallet.realizedProfit7d,
          winrate: wallet.winrate7d,
          avatar: wallet.avatar,
          twitterUsername: wallet.twitterUsername,
        });
      }
    }
  }

  // Sort by timestamp desc, take top events
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Public API ─────────────────────────────────────────────

export async function getGmgnWallets(
  chain?: "bsc" | "sol",
  category?: WalletCategory,
  sortBy: "pnl7d" | "pnl30d" | "winrate7d" | "realizedProfit7d" | "txs7d" = "realizedProfit7d",
  limit = 50,
): Promise<{
  wallets: WalletSummary[];
  categories: Record<string, number>;
  totalWallets: number;
  chains: { bsc: number; sol: number };
}> {
  await ensureData();

  if (!walletCache) {
    const bscWallets = processWallets(bscData!, "bsc");
    const solWallets = processWallets(solData!, "sol");
    walletCache = [...bscWallets, ...solWallets];
  }

  let filtered = walletCache;
  if (chain) filtered = filtered.filter((w) => w.chain === chain);
  if (category) filtered = filtered.filter((w) => w.category === category);

  // Count categories
  const categories: Record<string, number> = {};
  for (const w of filtered) {
    categories[w.category] = (categories[w.category] || 0) + 1;
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortBy];
    const vb = b[sortBy];
    return (typeof vb === "number" ? vb : 0) - (typeof va === "number" ? va : 0);
  });

  return {
    wallets: sorted.slice(0, limit),
    categories,
    totalWallets: filtered.length,
    chains: {
      bsc: walletCache.filter((w) => w.chain === "bsc").length,
      sol: walletCache.filter((w) => w.chain === "sol").length,
    },
  };
}

export async function getGmgnTradeEvents(
  chain?: "bsc" | "sol",
  limit = 200,
): Promise<TradeEvent[]> {
  await ensureData();

  if (!walletCache) {
    const bscWallets = processWallets(bscData!, "bsc");
    const solWallets = processWallets(solData!, "sol");
    walletCache = [...bscWallets, ...solWallets];
  }

  if (!tradeEventCache) {
    const bscEvents = generateTradeEvents(bscData!, "bsc", walletCache.filter((w) => w.chain === "bsc"));
    const solEvents = generateTradeEvents(solData!, "sol", walletCache.filter((w) => w.chain === "sol"));
    tradeEventCache = [...bscEvents, ...solEvents].sort((a, b) => b.timestamp - a.timestamp);
  }

  let events = tradeEventCache;
  if (chain) events = events.filter((e) => e.chain === chain);

  return events.slice(0, limit);
}

export async function getGmgnCategorySummary(): Promise<{
  bsc: Record<string, { count: number; totalPnl7d: number; avgWinrate: number }>;
  sol: Record<string, { count: number; totalPnl7d: number; avgWinrate: number }>;
}> {
  await ensureData();

  if (!walletCache) {
    const bscWallets = processWallets(bscData!, "bsc");
    const solWallets = processWallets(solData!, "sol");
    walletCache = [...bscWallets, ...solWallets];
  }

  const result: Record<string, Record<string, { count: number; totalPnl7d: number; avgWinrate: number }>> = {
    bsc: {},
    sol: {},
  };

  for (const w of walletCache) {
    const chain = result[w.chain];
    if (!chain[w.category]) {
      chain[w.category] = { count: 0, totalPnl7d: 0, avgWinrate: 0 };
    }
    chain[w.category].count++;
    chain[w.category].totalPnl7d += w.realizedProfit7d;
    chain[w.category].avgWinrate += w.winrate7d;
  }

  // Average the winrates
  for (const chain of Object.values(result)) {
    for (const cat of Object.values(chain)) {
      if (cat.count > 0) cat.avgWinrate /= cat.count;
    }
  }

  return result as {
    bsc: Record<string, { count: number; totalPnl7d: number; avgWinrate: number }>;
    sol: Record<string, { count: number; totalPnl7d: number; avgWinrate: number }>;
  };
}

// ─── Helpers ────────────────────────────────────────────────

function safeFloat(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "unknown";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
