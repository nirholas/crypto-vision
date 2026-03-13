/**
 * GMGN Wallet Intelligence — TypeScript Types
 *
 * Typed schema for bscwallets.json / solwallets.json GMGN v3 data format.
 * Categories: smart_degen, launchpad_smart, fresh_wallet, snipe_bot,
 *             live, top_dev, top_followed, top_renamed
 */

// ─── Root ───────────────────────────────────────────────────

export interface GmgnWalletFile {
  meta: GmgnMeta;
  interceptor: GmgnInterceptor;
  smartMoney: GmgnSmartMoney;
  kol: GmgnKol;
  tokens: GmgnTokens;
}

// ─── Meta ───────────────────────────────────────────────────

export interface GmgnMeta {
  startedAt: string;
  finishedAt: string;
  chain: GmgnChain;
  version: string;
}

export type GmgnChain = 'bsc' | 'sol';

// ─── Interceptor (summary counts) ──────────────────────────

export interface GmgnInterceptor {
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

// ─── Smart Money ────────────────────────────────────────────

export type GmgnWalletCategory =
  | 'smart_degen'
  | 'launchpad_smart'
  | 'fresh_wallet'
  | 'snipe_bot'
  | 'live'
  | 'top_dev'
  | 'top_followed'
  | 'top_renamed';

export interface GmgnSmartMoney {
  wallets: Record<GmgnWalletCategory, GmgnWallet[]>;
  walletDetails: Record<string, GmgnWalletDetail>;
  walletHoldings: Record<string, GmgnWalletHolding>;
}

export interface GmgnDailyProfit {
  timestamp: number;
  profit: string;
}

export interface GmgnWallet {
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
  monad_balance: string;
  follow_count: number;
  remark_count: number;
  twitter_username: string;
  avatar: string;
  nickname: string;
  tags: string[];
  twitter_name: string;
  twitter_description: string;
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
  daily_profit_7d: GmgnDailyProfit[];
}

// ─── Wallet Details ─────────────────────────────────────────

export interface GmgnWalletDetail {
  twitter_bind: boolean;
  is_contract: boolean;
  eth_balance: string;
  sol_balance: string;
  balance: string;
  realized_profit: string;
  unrealized_profit: string;
  total_profit: string;
  buy: number;
  sell: number;
  buy_1d: number;
  sell_1d: number;
  buy_7d: number;
  sell_7d: number;
  buy_30d: number;
  sell_30d: number;
  winrate: number | null;
  ens: string | null;
  twitter_username: string | null;
  tags: Record<string, number>;
}

// ─── Wallet Holdings ────────────────────────────────────────

export interface GmgnWalletHolding {
  list: GmgnHoldingItem[];
}

export interface GmgnHoldingItem {
  balance: string;
  accu_amount: string;
  accu_cost: string;
  history_bought_amount: string;
  history_sold_amount: string;
  history_total_buys: number;
  history_total_sells: number;
  realized_profit: string;
  token: GmgnTokenRef;
  wallet_token_tags: string[] | null;
}

export interface GmgnTokenRef {
  token_address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: string;
  total_supply: string;
  liquidity: string;
  launchpad: string | null;
  is_honeypot: boolean;
}

// ─── KOL ────────────────────────────────────────────────────

export interface GmgnKol {
  wallets: GmgnKolWallet[];
}

export interface GmgnKolWallet {
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
}

// ─── Tokens (trending) ─────────────────────────────────────

export interface GmgnTokens {
  trending: GmgnToken[];
  dexTrades: GmgnToken[];
}

export interface GmgnToken {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  price: string;
  price_change_percent: string | null;
  volume: string;
  liquidity: string;
  market_cap: string;
  swaps: number;
  is_honeypot: number;
  buy_tax: string;
  sell_tax: string;
  launchpad_platform: string | null;
  smart_degen_count: number;
  sniper_count: number;
}

// ─── Trade Event (for real-time simulation) ─────────────────

export interface TradeEvent {
  id: string;
  timestamp: number;
  chain: GmgnChain;
  walletAddress: string;
  walletLabel: string;
  walletCategory: GmgnWalletCategory | 'kol';
  action: 'buy' | 'sell' | 'first_buy';
  tokenSymbol: string;
  tokenAddress: string;
  amountUsd: number;
  pnlPercent: number | null;
  walletPnl7d: number;
  winrate: number;
  avatar: string;
  twitterUsername: string;
}

// ─── API Response shapes ────────────────────────────────────

export interface GmgnWalletApiResponse {
  wallets: GmgnWalletSummary[];
  categories: Record<GmgnWalletCategory, number>;
  totalWallets: number;
  chain: GmgnChain;
}

export interface GmgnWalletSummary {
  address: string;
  chain: GmgnChain;
  category: GmgnWalletCategory | 'kol';
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
