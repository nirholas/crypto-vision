/**
 * Smart Money Data Layer — BSC & SOL Wallet Intelligence
 *
 * Reads from the intercepted wallet JSON files (solwallets.json, bscwallets.json)
 * providing typed, pre-processed data for the Smart Money dashboard.
 *
 * Data sources: GMGN.ai smart money wallet rankings, KOL wallets,
 * trending tokens, DEX trade activity.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

// ─── Types ──────────────────────────────────────────────────

export type Chain = 'sol' | 'bsc';

export type WalletTag =
  | 'smart_degen'
  | 'launchpad_smart'
  | 'fresh_wallet'
  | 'snipe_bot'
  | 'live'
  | 'top_dev'
  | 'top_followed'
  | 'top_renamed';

export interface SmartWallet {
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
  trx_balance: string;
  monad_balance?: string;
  follow_count: number;
  remark_count: number;
  twitter_username: string;
  avatar: string | null;
  nickname: string | null;
  tags: string[];
  twitter_name: string | null;
  name: string | null;
}

export interface KOLWallet extends SmartWallet {
  twitter_description?: string;
  winrate_1d?: string;
  winrate_7d?: string;
  winrate_30d?: string;
  avg_cost_7d?: string;
  avg_cost_30d?: string;
  pnl_lt_minus_dot5_num_7d?: number;
  pnl_minus_dot5_0x_num_7d?: number;
  pnl_lt_2x_num_7d?: number;
  pnl_2x_5x_num_7d?: number;
  pnl_gt_5x_num_7d?: number;
  daily_profit_7d?: string;
  avg_holding_period_7d?: string;
  avg_holding_period_30d?: string;
  volume_7d?: string;
  volume_30d?: string;
  net_inflow_7d?: string;
  net_inflow_30d?: string;
}

export interface WalletDetail {
  twitter_bind: boolean;
  twitter_fans_num: number;
  twitter_username: string | null;
  twitter_name: string | null;
  ens: string | null;
  avatar: string | null;
  name: string | null;
  eth_balance: string;
  sol_balance: string;
  trx_balance: string;
  bnb_balance: string;
  balance: string;
  total_value: number;
  unrealized_profit: number;
  unrealized_pnl: number;
  realized_profit: number;
  pnl: number;
  pnl_1d: number;
  pnl_7d: number;
  pnl_30d: number;
  realized_profit_1d: number;
  realized_profit_7d: number;
  realized_profit_30d: number;
  winrate: number;
  buy: number;
  sell: number;
  buy_7d: number;
  sell_7d: number;
  buy_30d: number;
  sell_30d: number;
  token_num: number;
  profit_num: number;
  tags: string[];
  tag_rank: Record<string, number>;
  followers_count: number;
  avg_holding_peroid: string | null;
  risk?: unknown;
}

export interface TrendingToken {
  id: string;
  chain: string;
  address: string;
  name: string;
  symbol: string;
  logo: string;
  price: number;
  price_change_percent: number;
  price_change_percent1m: number;
  price_change_percent5m: number;
  price_change_percent1h: number;
  volume: number;
  liquidity: number;
  market_cap: number;
  total_supply: number;
  swaps: number;
  buys: number;
  sells: number;
  holder_count: number;
  top_10_holder_rate: number;
  open_timestamp: number;
  twitter_username: string | null;
  website: string | null;
  renounced_mint: number;
  renounced_freeze_account: number;
  burn_ratio: string;
  hot_level: number;
  smart_degen_count: number;
  renowned_count: number;
  sniper_count: number;
  rug_ratio: number | null;
  bundler_rate: number | null;
}

export interface DexTrade {
  dexName: string;
  chain: string;
  tradeCount: number;
  tradeCountChangeRate: number;
  tradeVolume: number;
  tradeVolumeChangeRate: number;
  traderCount: number;
  traderCountChangeRate: number;
  buyVolume: number;
  buyVolumeChangeRate: number;
  buyCount: number;
  sellVolume: number;
  sellVolumeChangeRate: number;
  sellCount: number;
  tokenStatsCreated: number;
  tokenStatsCreatedChangeRate: number;
}

export interface InterceptorStats {
  walletsBySmartMoney: number;
  walletsByLaunchpad: number;
  walletsByKOL: number;
  walletsBySniper: number;
  walletsByFreshWallet: number;
  walletsByLive: number;
  walletsByTopDev: number;
  walletsAll: number;
  tokensAll: number;
  urlsCaptured: number;
}

export interface ChainData {
  chain: Chain;
  interceptor: InterceptorStats;
  smartWallets: Record<WalletTag, SmartWallet[]>;
  walletDetails: Record<string, WalletDetail>;
  kolWallets: KOLWallet[];
  trending: TrendingToken[];
  dexTrades: DexTrade[];
  scannedAt: string;
}

// ─── Simulated Trade (for live feed) ────────────────────────

export interface SimulatedTrade {
  id: string;
  chain: Chain;
  wallet: string;
  walletLabel: string;
  action: 'buy' | 'sell' | 'first_buy' | 'sell_partial' | 'sell_all' | 'buy_more';
  token: string;
  tokenSymbol: string;
  tokenLogo: string;
  amount: number;
  marketCap: number;
  profit?: number;
  profitPercent?: number;
  tags: string[];
  timestamp: number;
  age: string;
}

// ─── Cache ──────────────────────────────────────────────────

const cache = new Map<string, { data: ChainData; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Loader ─────────────────────────────────────────────────

async function loadChainData(chain: Chain): Promise<ChainData> {
  const cached = cache.get(chain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const filename = chain === 'sol' ? 'solwallets.json' : 'bscwallets.json';
  const filePath = join(process.cwd(), '..', '..', filename);

  const raw = await readFile(filePath, 'utf-8');
  const json = JSON.parse(raw);

  const data: ChainData = {
    chain,
    interceptor: json.interceptor,
    smartWallets: json.smartMoney.wallets,
    walletDetails: json.smartMoney.walletDetails ?? {},
    kolWallets: json.kol?.wallets ?? [],
    trending: json.tokens?.trending ?? [],
    dexTrades: json.tokens?.dexTrades ?? [],
    scannedAt: json.meta?.finishedAt ?? new Date().toISOString(),
  };

  cache.set(chain, { data, ts: Date.now() });
  return data;
}

// ─── Public API ─────────────────────────────────────────────

export async function getSmartMoneyData(): Promise<{
  sol: ChainData;
  bsc: ChainData;
}> {
  const [sol, bsc] = await Promise.all([
    loadChainData('sol'),
    loadChainData('bsc'),
  ]);
  return { sol, bsc };
}

/**
 * Get all smart wallets across both chains, sorted by 7d realized profit.
 */
export function getAllSmartWallets(
  data: { sol: ChainData; bsc: ChainData },
  tag?: WalletTag,
): Array<SmartWallet & { chain: Chain }> {
  const wallets: Array<SmartWallet & { chain: Chain }> = [];

  for (const chain of ['sol', 'bsc'] as Chain[]) {
    const chainData = data[chain];
    if (tag) {
      const list = chainData.smartWallets[tag] ?? [];
      for (const w of list) wallets.push({ ...w, chain });
    } else {
      for (const [, list] of Object.entries(chainData.smartWallets)) {
        if (!Array.isArray(list)) continue;
        for (const w of list) wallets.push({ ...w, chain });
      }
    }
  }

  // Deduplicate by address
  const seen = new Set<string>();
  const unique = wallets.filter((w) => {
    const key = `${w.chain}:${w.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort(
    (a, b) => parseFloat(b.realized_profit_7d) - parseFloat(a.realized_profit_7d),
  );
}

/**
 * Get KOL wallets across both chains, sorted by 7d profit.
 */
export function getAllKOLWallets(
  data: { sol: ChainData; bsc: ChainData },
): Array<KOLWallet & { chain: Chain }> {
  const wallets: Array<KOLWallet & { chain: Chain }> = [];

  for (const chain of ['sol', 'bsc'] as Chain[]) {
    for (const w of data[chain].kolWallets) {
      wallets.push({ ...w, chain });
    }
  }

  const seen = new Set<string>();
  return wallets
    .filter((w) => {
      const key = `${w.chain}:${w.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) => parseFloat(b.realized_profit_7d) - parseFloat(a.realized_profit_7d),
    );
}

/**
 * Get trending tokens across both chains, sorted by volume.
 */
export function getAllTrending(
  data: { sol: ChainData; bsc: ChainData },
): Array<TrendingToken & { chain: Chain }> {
  const tokens: Array<TrendingToken & { chain: Chain }> = [];
  for (const chain of ['sol', 'bsc'] as Chain[]) {
    for (const t of data[chain].trending) {
      tokens.push({ ...t, chain });
    }
  }
  return tokens.sort((a, b) => (b.volume || 0) - (a.volume || 0));
}

/**
 * Generate simulated live trades from the wallet + token data.
 * Creates a realistic-looking trade feed from the actual data.
 */
export function generateSimulatedTrades(
  data: { sol: ChainData; bsc: ChainData },
  count: number = 80,
): SimulatedTrade[] {
  const trades: SimulatedTrade[] = [];
  const actions: SimulatedTrade['action'][] = [
    'buy', 'sell', 'first_buy', 'sell_partial', 'sell_all', 'buy_more',
  ];

  for (const chain of ['sol', 'bsc'] as Chain[]) {
    const chainData = data[chain];
    const trending = chainData.trending;
    if (trending.length === 0) continue;

    // Collect all wallets with their labels
    const allWallets: Array<{ address: string; label: string; tags: string[] }> = [];
    for (const [, list] of Object.entries(chainData.smartWallets)) {
      if (!Array.isArray(list)) continue;
      for (const w of list) {
        allWallets.push({
          address: w.address,
          label: w.nickname || w.twitter_name || w.name || shortenAddress(w.address),
          tags: w.tags ?? [],
        });
      }
    }
    for (const w of chainData.kolWallets) {
      allWallets.push({
        address: w.address,
        label: w.twitter_name || w.nickname || shortenAddress(w.address),
        tags: w.tags ?? [],
      });
    }

    if (allWallets.length === 0) continue;

    const tradesPerChain = Math.floor(count / 2);
    const now = Date.now();

    for (let i = 0; i < tradesPerChain; i++) {
      const wallet = allWallets[i % allWallets.length];
      const token = trending[i % trending.length];
      const action = actions[i % actions.length];
      const elapsed = i * 3; // seconds ago

      const isSell = action === 'sell' || action === 'sell_partial' || action === 'sell_all';
      const profitPct = isSell ? (seededRandom(i + chain.charCodeAt(0)) * 600 - 100) : undefined;
      const amount = token.price * (seededRandom(i * 7) * 5 + 0.01);

      trades.push({
        id: `${chain}-${i}-${wallet.address.slice(0, 8)}`,
        chain,
        wallet: wallet.address,
        walletLabel: wallet.label,
        action,
        token: token.name,
        tokenSymbol: token.symbol,
        tokenLogo: token.logo || '',
        amount,
        marketCap: token.market_cap || 0,
        profit: profitPct !== undefined ? (amount * profitPct) / 100 : undefined,
        profitPercent: profitPct,
        tags: wallet.tags,
        timestamp: now - elapsed * 1000,
        age: formatAge(elapsed),
      });
    }
  }

  return trades.sort((a, b) => b.timestamp - a.timestamp).slice(0, count);
}

// ─── Helpers ────────────────────────────────────────────────

function shortenAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ─── Formatting ─────────────────────────────────────────────

export function formatUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

export function formatPnl(pnl: string | number): string {
  const n = typeof pnl === 'string' ? parseFloat(pnl) : pnl;
  if (isNaN(n)) return '—';
  const pct = n * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatProfit(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${formatUsd(n)}`;
}
