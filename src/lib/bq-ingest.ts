/**
 * Crypto Vision — BigQuery Ingestion Layer
 *
 * Centralized module that maps source data to BigQuery table rows.
 * Each function transforms raw API data into the warehouse schema
 * and streams it via fire-and-forget inserts.
 *
 * Callers should never await these — BigQuery must never block the API.
 */

import { insertRows, Tables } from "../lib/bigquery.js";
import type {
  MarketSnapshotRow,
  OHLCCandleRow,
  DefiProtocolRow,
  YieldPoolRow,
  NewsArticleRow,
  FearGreedRow,
  DexPairRow,
  ChainTVLRow,
  ExchangeSnapshotRow,
  BitcoinNetworkRow,
  GasPriceRow,
  StablecoinSupplyRow,
  FundingRoundRow,
  DerivativesSnapshotRow,
  GovernanceProposalRow,
  WhaleMovementRow,
  AgentInteractionRow,
} from "../lib/bigquery.js";

// ── Helpers ──────────────────────────────────────────────

function safeNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

/** Safely cast typed rows to the Record<string, unknown>[] that BigQuery expects. */
function asRows(rows: unknown): Record<string, unknown>[] {
  return rows as Record<string, unknown>[];
}

/** Single-row variant. */
function asRow(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

// ── Market Snapshots (CoinGecko) ─────────────────────────

export function ingestMarketSnapshots(coins: Array<Record<string, unknown>>): void {
  const rows: MarketSnapshotRow[] = coins.map((c) => ({
    snapshot_id: `${c.id}-${Date.now()}`,
    coin_id: String(c.id),
    symbol: String(c.symbol),
    name: String(c.name),
    current_price_usd: safeNum(c.current_price),
    market_cap: safeNum(c.market_cap),
    market_cap_rank: safeNum(c.market_cap_rank),
    total_volume: safeNum(c.total_volume),
    price_change_pct_1h: safeNum(c.price_change_percentage_1h_in_currency),
    price_change_pct_24h: safeNum(c.price_change_percentage_24h),
    price_change_pct_7d: safeNum(c.price_change_percentage_7d_in_currency),
    price_change_pct_30d: safeNum(c.price_change_percentage_30d_in_currency),
    circulating_supply: safeNum(c.circulating_supply),
    total_supply: safeNum(c.total_supply),
    max_supply: safeNum(c.max_supply),
    ath: safeNum(c.ath),
    ath_change_pct: safeNum(c.ath_change_percentage),
    source: "coingecko",
  }));
  insertRows(Tables.MARKET_SNAPSHOTS, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── OHLC Candles ─────────────────────────────────────────

export function ingestOHLCCandles(
  coinId: string,
  candles: Array<[number, number, number, number, number]>,
  source = "coingecko",
): void {
  const rows: OHLCCandleRow[] = candles.map((c) => ({
    coin_id: coinId,
    timestamp_ms: c[0],
    open: safeNum(c[1]),
    high: safeNum(c[2]),
    low: safeNum(c[3]),
    close: safeNum(c[4]),
    volume: null,
    source,
  }));
  insertRows(Tables.OHLC_CANDLES, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── DeFi Protocols (DeFiLlama) ───────────────────────────

export function ingestDefiProtocols(protocols: Array<Record<string, unknown>>): void {
  const rows: DefiProtocolRow[] = protocols.map((p) => ({
    protocol_slug: String(p.slug || p.name),
    name: String(p.name),
    category: safeStr(p.category),
    chain: safeStr(p.chain || (p.chains as string[] | undefined)?.[0]),
    tvl_usd: safeNum(p.tvl),
    change_1h: safeNum(p.change_1h),
    change_1d: safeNum(p.change_1d),
    change_7d: safeNum(p.change_7d),
    mcap_tvl_ratio: safeNum(p.mcap && p.tvl ? Number(p.mcap) / Number(p.tvl) : null),
    fees_24h: safeNum(p.fees_24h),
    revenue_24h: safeNum(p.revenue_24h),
    source: "defillama",
  }));
  insertRows(Tables.DEFI_PROTOCOLS, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Yield Pools (DeFiLlama) ──────────────────────────────

export function ingestYieldPools(pools: Array<Record<string, unknown>>): void {
  const rows: YieldPoolRow[] = pools.map((p) => ({
    pool_id: String(p.pool || p.configID || `${p.project}-${p.symbol}`),
    chain: safeStr(p.chain),
    project: safeStr(p.project),
    symbol: safeStr(p.symbol),
    tvl_usd: safeNum(p.tvlUsd),
    apy: safeNum(p.apy),
    apy_base: safeNum(p.apyBase),
    apy_reward: safeNum(p.apyReward),
    il_risk: safeStr(p.ilRisk),
    stablecoin: p.stablecoin === true || p.stablecoin === "true" ? true : false,
  }));
  insertRows(Tables.YIELD_POOLS, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── News Articles ────────────────────────────────────────

export function ingestNewsArticles(articles: Array<Record<string, unknown>>): void {
  const rows: NewsArticleRow[] = articles.map((a) => ({
    article_id: String(a.id || a.url || `${a.title}-${Date.now()}`),
    title: safeStr(a.title),
    description: safeStr(a.description || a.summary),
    url: safeStr(a.url || a.link),
    source_name: safeStr(a.source || a.sourceName || a.source_name),
    category: safeStr(a.category),
    published_at: safeStr(a.publishedAt || a.published_at || a.pubDate),
    sentiment_score: safeNum(a.sentiment_score || a.sentimentScore),
    sentiment_label: safeStr(a.sentiment_label || a.sentimentLabel),
    entities: Array.isArray(a.entities) ? a.entities.map(String) : [],
    topics: Array.isArray(a.topics) ? a.topics.map(String) : [],
  }));
  insertRows(Tables.NEWS_ARTICLES, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Fear & Greed Index ───────────────────────────────────

export function ingestFearGreed(data: Array<Record<string, unknown>>): void {
  const rows: FearGreedRow[] = data.map((d) => ({
    value: safeNum(d.value),
    classification: safeStr(d.value_classification),
    timestamp_unix: safeNum(d.timestamp),
  }));
  insertRows(Tables.FEAR_GREED, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── DEX Pairs ────────────────────────────────────────────

export function ingestDexPairs(pairs: Array<Record<string, unknown>>, source: string): void {
  const rows: DexPairRow[] = pairs.map((p) => ({
    pair_address: String(p.pairAddress || p.address || p.id),
    chain_id: safeStr(p.chainId || p.chain),
    dex_id: safeStr(p.dexId || p.dex),
    base_token_address: safeStr(
      typeof p.baseToken === "object" && p.baseToken ? (p.baseToken as Record<string, unknown>).address : p.baseTokenAddress,
    ),
    base_token_symbol: safeStr(
      typeof p.baseToken === "object" && p.baseToken ? (p.baseToken as Record<string, unknown>).symbol : p.baseTokenSymbol,
    ),
    quote_token_address: safeStr(
      typeof p.quoteToken === "object" && p.quoteToken ? (p.quoteToken as Record<string, unknown>).address : p.quoteTokenAddress,
    ),
    quote_token_symbol: safeStr(
      typeof p.quoteToken === "object" && p.quoteToken ? (p.quoteToken as Record<string, unknown>).symbol : p.quoteTokenSymbol,
    ),
    price_usd: safeNum(p.priceUsd || p.price_usd),
    volume_24h: safeNum(
      typeof p.volume === "object" && p.volume ? (p.volume as Record<string, unknown>).h24 : p.volume_24h,
    ),
    liquidity_usd: safeNum(
      typeof p.liquidity === "object" && p.liquidity ? (p.liquidity as Record<string, unknown>).usd : p.liquidity_usd,
    ),
    price_change_5m: safeNum(
      typeof p.priceChange === "object" && p.priceChange ? (p.priceChange as Record<string, unknown>).m5 : p.priceChange5m,
    ),
    price_change_1h: safeNum(
      typeof p.priceChange === "object" && p.priceChange ? (p.priceChange as Record<string, unknown>).h1 : p.priceChange1h,
    ),
    price_change_24h: safeNum(
      typeof p.priceChange === "object" && p.priceChange ? (p.priceChange as Record<string, unknown>).h24 : p.priceChange24h,
    ),
    fdv: safeNum(p.fdv),
    source,
  }));
  insertRows(Tables.DEX_PAIRS, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Chain TVL ────────────────────────────────────────────

export function ingestChainTVL(chains: Array<Record<string, unknown>>): void {
  const rows: ChainTVLRow[] = chains.map((c) => ({
    chain_name: String(c.name || c.gecko_id || c.chain),
    tvl_usd: safeNum(c.tvl),
    protocols_count: safeNum(c.protocols),
  }));
  insertRows(Tables.CHAIN_TVL, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Exchange Snapshots ───────────────────────────────────

export function ingestExchangeSnapshots(
  exchanges: Array<Record<string, unknown>>,
  source: string,
): void {
  const rows: ExchangeSnapshotRow[] = exchanges.map((e) => ({
    exchange_id: String(e.id || e.exchange_id || e.name),
    name: safeStr(e.name),
    trust_score: safeNum(e.trust_score || e.trustScore),
    trade_volume_24h_btc: safeNum(e.trade_volume_24h_btc),
    trade_volume_24h_usd: safeNum(e.trade_volume_24h_usd || e.volumeUsd),
    open_interest_usd: safeNum(e.open_interest_usd),
    source,
  }));
  insertRows(Tables.EXCHANGE_SNAPSHOTS, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Bitcoin Network ──────────────────────────────────────

export function ingestBitcoinNetwork(data: Record<string, unknown>): void {
  const row: BitcoinNetworkRow = {
    hashrate: safeNum(data.hash_rate || data.hashrate),
    difficulty: safeNum(data.difficulty),
    block_height: safeNum(data.block_height || data.n_blocks_total),
    fee_fast_sat_vb: safeNum(data.fee_fast || data.fastestFee),
    fee_medium_sat_vb: safeNum(data.fee_medium || data.halfHourFee),
    fee_slow_sat_vb: safeNum(data.fee_slow || data.hourFee),
    mempool_size: safeNum(data.mempool_size || data.count),
  };
  insertRows(Tables.BITCOIN_NETWORK, [row as unknown as Record<string, unknown>]).catch(() => {});
}

// ── Gas Prices ───────────────────────────────────────────

export function ingestGasPrices(gasData: Array<Record<string, unknown>>): void {
  const rows: GasPriceRow[] = gasData.map((g) => ({
    chain: String(g.chain || "ethereum"),
    fast_gwei: safeNum(g.fast || g.fast_gwei || g.FastGasPrice),
    standard_gwei: safeNum(g.standard || g.standard_gwei || g.ProposeGasPrice || g.average),
    slow_gwei: safeNum(g.slow || g.slow_gwei || g.SafeGasPrice || g.low),
    base_fee_gwei: safeNum(g.base_fee || g.base_fee_gwei || g.suggestBaseFee),
  }));
  insertRows(Tables.GAS_PRICES, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Stablecoin Supply ────────────────────────────────────

export function ingestStablecoinSupply(stables: Array<Record<string, unknown>>): void {
  const rows: StablecoinSupplyRow[] = stables.map((s) => ({
    stablecoin_id: String(s.id || s.name),
    name: safeStr(s.name),
    symbol: safeStr(s.symbol),
    peg_type: safeStr(s.pegType || s.peg_type),
    circulating: safeNum(s.circulating || s.circulatingSupply),
    chain_circulating: (s.chainCirculating || s.chain_circulating) as Record<string, unknown> | null ?? null,
    price: safeNum(s.price),
  }));
  insertRows(Tables.STABLECOIN_SUPPLY, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Funding Rounds ───────────────────────────────────────

export function ingestFundingRounds(rounds: Array<Record<string, unknown>>): void {
  const rows: FundingRoundRow[] = rounds.map((r) => ({
    round_id: safeStr(r.id || `${r.name}-${r.date}`),
    name: safeStr(r.name),
    category: safeStr(r.category || r.sector),
    amount: safeNum(r.amount),
    round_type: safeStr(r.round || r.roundType),
    lead_investors: Array.isArray(r.leadInvestors)
      ? r.leadInvestors.map(String)
      : typeof r.leadInvestors === "string"
        ? [r.leadInvestors]
        : [],
    date: safeStr(r.date),
  }));
  insertRows(Tables.FUNDING_ROUNDS, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Derivatives Snapshots ────────────────────────────────

export function ingestDerivativesSnapshots(
  data: Array<Record<string, unknown>>,
  source: string,
): void {
  const rows: DerivativesSnapshotRow[] = data.map((d) => ({
    symbol: String(d.symbol || d.ticker || d.coin),
    exchange: safeStr(d.exchange || d.exchangeName),
    open_interest_usd: safeNum(d.openInterest || d.open_interest || d.oi),
    funding_rate: safeNum(d.fundingRate || d.funding_rate || d.rate),
    volume_24h: safeNum(d.volume24h || d.volume_24h || d.vol),
    long_short_ratio: safeNum(d.longShortRatio || d.long_short_ratio),
    liquidations_24h: safeNum(d.liquidations || d.liquidations_24h),
    source,
  }));
  insertRows(Tables.DERIVATIVES_SNAPSHOTS, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Governance Proposals ─────────────────────────────────

export function ingestGovernanceProposals(proposals: Array<Record<string, unknown>>): void {
  const rows: GovernanceProposalRow[] = proposals.map((p) => ({
    proposal_id: String(p.id),
    space_id: safeStr(typeof p.space === "object" && p.space ? (p.space as Record<string, unknown>).id : p.space),
    title: safeStr(p.title),
    body: safeStr(p.body ? String(p.body).slice(0, 50_000) : null), // Truncate very long bodies
    state: safeStr(p.state),
    author: safeStr(p.author),
    votes_for: safeNum(p.scores_total || p.votes_for),
    votes_against: safeNum(p.votes_against),
    quorum: safeNum(p.quorum),
    start_ts: safeNum(p.start),
    end_ts: safeNum(p.end),
  }));
  insertRows(Tables.GOVERNANCE_PROPOSALS, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Whale Movements ──────────────────────────────────────

export function ingestWhaleMovements(movements: Array<Record<string, unknown>>): void {
  const rows: WhaleMovementRow[] = movements.map((m) => ({
    tx_hash: String(m.tx_hash || m.hash || m.txid),
    chain: safeStr(m.chain),
    from_address: safeStr(m.from || m.from_address),
    to_address: safeStr(m.to || m.to_address),
    token_symbol: safeStr(m.token || m.token_symbol || m.symbol),
    amount: safeNum(m.amount || m.value),
    usd_value: safeNum(m.usd_value || m.valueUsd),
    block_number: safeNum(m.blockNumber || m.block_number),
    timestamp_unix: safeNum(m.timestamp || m.timeStamp),
    movement_type: safeStr(m.movement_type || m.type),
  }));
  insertRows(Tables.WHALE_MOVEMENTS, rows as unknown as Record<string, unknown>[]).catch(() => {});
}

// ── Agent Interactions ───────────────────────────────────

export function ingestAgentInteraction(data: {
  interaction_id: string;
  agent_id: string;
  query?: string;
  response?: string;
  model_used?: string;
  tokens_used?: number;
  latency_ms?: number;
  user_feedback?: string;
}): void {
  const row: AgentInteractionRow = {
    interaction_id: data.interaction_id,
    agent_id: data.agent_id,
    query: data.query ?? null,
    response: data.response ? data.response.slice(0, 100_000) : null,
    model_used: data.model_used ?? null,
    tokens_used: data.tokens_used ?? null,
    latency_ms: data.latency_ms ?? null,
    user_feedback: data.user_feedback ?? null,
  };
  insertRows(Tables.AGENT_INTERACTIONS, [row as unknown as Record<string, unknown>]).catch(() => {});
}
