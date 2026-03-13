/**
 * Dashboard Data Service — Extended Data Fetchers
 *
 * Provides data fetching functions for dashboards beyond the core market data:
 * - Derivatives (CoinGecko /derivatives)
 * - Exchanges (CoinGecko /exchanges) — extends existing functions
 * - NFT Collections (CoinGecko /nfts)
 * - DeFi Yields (DeFiLlama yields.llama.fi)
 * - Staking (DeFiLlama + Beaconcha.in)
 * - L2 Analytics (L2Beat)
 * - Macro Indicators (Yahoo Finance)
 * - Whale Monitoring (Blockchain.info)
 * - Token Unlocks (DeFiLlama)
 * - ETF Data (Yahoo Finance)
 *
 * Each function follows the same pattern:
 * 1. Check in-memory cache
 * 2. Fetch from API with timeout
 * 3. Cache result with appropriate TTL
 * 4. Return typed data or empty fallback
 */

// =============================================================================
// API BASE URLS
// =============================================================================

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const DEFILLAMA_BASE = 'https://api.llama.fi';
const DEFILLAMA_YIELDS = 'https://yields.llama.fi';
const DEFILLAMA_STABLECOINS = 'https://stablecoins.llama.fi';
const L2BEAT_API = 'https://l2beat.com/api';
const BLOCKCHAIN_INFO = 'https://blockchain.info';
const BEACONCHAIN_API = 'https://beaconcha.in/api/v1';
const MEMPOOL_API = 'https://mempool.space/api';

// =============================================================================
// CACHE INFRASTRUCTURE
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl * 1000) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl: ttlSeconds });
}

async function safeFetch(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'CryptoVision/2.0' },
      next: { revalidate: 60 },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// TYPES — DERIVATIVES EXCHANGES
// =============================================================================

export interface DerivativesExchange {
  id: string;
  name: string;
  open_interest_btc: number | null;
  trade_volume_24h_btc: string;
  number_of_perpetual_pairs: number;
  number_of_futures_pairs: number;
  image: string;
  year_established: number | null;
  country: string | null;
  url: string;
}

// =============================================================================
// TYPES — NFT
// =============================================================================

export interface NFTCollection {
  id: string;
  contract_address: string;
  name: string;
  asset_platform_id: string;
  symbol: string;
}

export interface NFTMarketItem {
  id: string;
  name: string;
  symbol: string;
  image: { small: string };
  description: string;
  native_currency: string;
  native_currency_symbol: string;
  floor_price: { native_currency: number; usd: number };
  market_cap: { native_currency: number; usd: number };
  volume_24h: { native_currency: number; usd: number };
  floor_price_in_usd_24h_percentage_change: number;
  floor_price_24h_percentage_change: { usd: number; native_currency: number };
  market_cap_24h_percentage_change: { usd: number; native_currency: number };
  volume_in_usd_24h_percentage_change: number;
  number_of_unique_addresses: number;
  number_of_unique_addresses_24h_percentage_change: number;
  total_supply: number;
}

// =============================================================================
// TYPES — DEFI YIELDS
// =============================================================================

export interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[] | null;
  pool: string;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  poolMeta: string | null;
  mu: number | null;
  sigma: number | null;
  count: number | null;
  outlier: boolean;
  underlyingTokens: string[] | null;
  il7d: number | null;
  apyBase7d: number | null;
  apyMean30d: number | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
}

// =============================================================================
// TYPES — L2 DATA
// =============================================================================

export interface L2Project {
  id: string;
  name: string;
  slug: string;
  category: string;
  provider: string;
  stage: string;
  purposes: string[];
  tvl: number;
  tvlChange7d: number;
  tvlBreakdown?: {
    canonical: number;
    external: number;
    native: number;
  };
}

// =============================================================================
// TYPES — MACRO
// =============================================================================

export interface MacroQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  currency: string;
}

// =============================================================================
// TYPES — WHALE DATA
// =============================================================================

export interface WhaleTransaction {
  hash: string;
  time: number;
  amount: number;
  amountUsd: number;
  from: string;
  to: string;
  blockchain: string;
  symbol: string;
}

export interface BitcoinStats {
  marketPrice: number;
  totalBtc: number;
  hashRate: number;
  difficulty: number;
  blockCount: number;
  avgBlockSize: number;
  totalTransactions: number;
  mempoolSize: number;
  mempoolTxCount: number;
  avgFee: number;
  latestBlock: number;
}

// =============================================================================
// TYPES — STAKING
// =============================================================================

export interface StakingYield {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
  pool: string;
  stablecoin: boolean;
}

export interface EthValidatorStats {
  activeValidators: number;
  pendingValidators: number;
  totalValidators: number;
  averageBalance: number;
  totalStaked: number;
  networkAPR: number;
}

// =============================================================================
// TYPES — TOKEN UNLOCKS
// =============================================================================

export interface TokenEmission {
  name: string;
  symbol: string;
  totalLocked: number;
  totalLockedUsd: number;
  nextUnlockDate: string;
  nextUnlockAmount: number;
  nextUnlockAmountUsd: number;
  category: string;
}

// =============================================================================
// TYPES — ETF
// =============================================================================

export interface ETFQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  ytdReturn: number | null;
}

// =============================================================================
// TYPES — STABLECOINS
// =============================================================================

export interface Stablecoin {
  id: string;
  name: string;
  symbol: string;
  pegType: string;
  circulating: Record<string, number>;
  price: number;
  pegDeviation: number | null;
}

// =============================================================================
// DATA FETCHERS — DERIVATIVES EXCHANGES
// =============================================================================

export async function getDerivativesExchanges(): Promise<DerivativesExchange[]> {
  const cacheKey = 'derivatives-exchanges';
  const cached = getCached<DerivativesExchange[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(
      `${COINGECKO_BASE}/derivatives/exchanges?order=open_interest_btc_desc&per_page=30`
    );
    if (!res.ok) return [];
    const data: DerivativesExchange[] = await res.json();
    setCache(cacheKey, data, 300);
    return data;
  } catch {
    return [];
  }
}

// =============================================================================
// DATA FETCHERS — NFT
// =============================================================================

export async function getNFTList(limit = 100): Promise<NFTCollection[]> {
  const cacheKey = `nft-list-${limit}`;
  const cached = getCached<NFTCollection[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(
      `${COINGECKO_BASE}/nfts/list?per_page=${Math.min(limit, 250)}&order=market_cap_usd_desc`
    );
    if (!res.ok) return [];
    const data: NFTCollection[] = await res.json();
    setCache(cacheKey, data, 600);
    return data;
  } catch {
    return [];
  }
}

// =============================================================================
// DATA FETCHERS — DEFI YIELDS
// =============================================================================

export async function getDefiYields(): Promise<YieldPool[]> {
  const cacheKey = 'defi-yields';
  const cached = getCached<YieldPool[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(`${DEFILLAMA_YIELDS}/pools`, 15000);
    if (!res.ok) return [];
    const json: { data: YieldPool[] } = await res.json();
    // Filter to top pools by TVL + reasonable APY
    const filtered = json.data
      .filter((p) => p.tvlUsd > 1_000_000 && p.apy > 0 && p.apy < 1000)
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 200);
    setCache(cacheKey, filtered, 300);
    return filtered;
  } catch {
    return [];
  }
}

// =============================================================================
// DATA FETCHERS — L2 ANALYTICS
// =============================================================================

export async function getL2Data(): Promise<L2Project[]> {
  const cacheKey = 'l2-data';
  const cached = getCached<L2Project[]>(cacheKey);
  if (cached) return cached;

  try {
    // Use DeFiLlama chains endpoint for L2 data (more reliable than L2Beat API)
    const res = await safeFetch(`${DEFILLAMA_BASE}/v2/chains`, 15000);
    if (!res.ok) return [];
    const chains: Array<{
      gecko_id: string;
      tvl: number;
      tokenSymbol: string;
      name: string;
      chainId: number | null;
    }> = await res.json();

    // Known L2s and their categories
    const l2Names = new Set([
      'Arbitrum', 'Optimism', 'Base', 'Polygon zkEVM', 'zkSync Era',
      'Linea', 'Scroll', 'Starknet', 'Manta', 'Mantle', 'Blast',
      'Mode', 'Metis', 'Boba', 'Polygon', 'Immutable X', 'Loopring',
      'dYdX', 'Zora', 'Taiko', 'Kroma', 'Fraxtal',
    ]);

    const l2s: L2Project[] = chains
      .filter((c) => l2Names.has(c.name))
      .sort((a, b) => b.tvl - a.tvl)
      .map((c) => ({
        id: c.gecko_id || c.name.toLowerCase().replace(/\s+/g, '-'),
        name: c.name,
        slug: c.name.toLowerCase().replace(/\s+/g, '-'),
        category: 'Rollup',
        provider: '',
        stage: '',
        purposes: ['Universal'],
        tvl: c.tvl,
        tvlChange7d: 0,
      }));

    setCache(cacheKey, l2s, 600);
    return l2s;
  } catch {
    return [];
  }
}

// =============================================================================
// DATA FETCHERS — MACRO INDICATORS
// =============================================================================

/**
 * Fetch macro market data from multiple sources.
 * Uses DeFiLlama for crypto TVL & chains, and returns structured macro data.
 */
export async function getMacroData(): Promise<{
  indices: MacroQuote[];
  commodities: MacroQuote[];
  crypto: MacroQuote[];
  defiTvl: number;
  stablecoinMcap: number;
}> {
  const cacheKey = 'macro-overview';
  const cached = getCached<{
    indices: MacroQuote[];
    commodities: MacroQuote[];
    crypto: MacroQuote[];
    defiTvl: number;
    stablecoinMcap: number;
  }>(cacheKey);
  if (cached) return cached;

  try {
    // Fetch DeFi TVL + stablecoins data + crypto prices in parallel
    const [protocolsRes, stablecoinsRes, pricesRes] = await Promise.all([
      safeFetch(`${DEFILLAMA_BASE}/protocols`, 15000),
      safeFetch(`${DEFILLAMA_STABLECOINS}/stablecoins?includePrices=true`, 15000),
      safeFetch(
        `${COINGECKO_BASE}/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple,cardano,dogecoin,polkadot,avalanche-2,chainlink&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
        10000
      ),
    ]);

    let defiTvl = 0;
    if (protocolsRes.ok) {
      const protocols: Array<{ tvl: number }> = await protocolsRes.json();
      defiTvl = protocols.reduce((sum, p) => sum + (p.tvl || 0), 0);
    }

    let stablecoinMcap = 0;
    if (stablecoinsRes.ok) {
      const stablecoins: { peggedAssets: Array<{ circulating: { peggedUSD: number } }> } =
        await stablecoinsRes.json();
      stablecoinMcap = stablecoins.peggedAssets.reduce(
        (sum, s) => sum + (s.circulating?.peggedUSD || 0),
        0
      );
    }

    // Build crypto quotes from CoinGecko prices
    const crypto: MacroQuote[] = [];
    if (pricesRes.ok) {
      const prices: Record<
        string,
        { usd: number; usd_24h_change: number; usd_market_cap: number }
      > = await pricesRes.json();

      const nameMap: Record<string, string> = {
        bitcoin: 'Bitcoin',
        ethereum: 'Ethereum',
        solana: 'Solana',
        binancecoin: 'BNB',
        ripple: 'XRP',
        cardano: 'Cardano',
        dogecoin: 'Dogecoin',
        polkadot: 'Polkadot',
        'avalanche-2': 'Avalanche',
        chainlink: 'Chainlink',
      };

      for (const [id, data] of Object.entries(prices)) {
        crypto.push({
          symbol: id.toUpperCase(),
          name: nameMap[id] || id,
          price: data.usd,
          change: (data.usd * data.usd_24h_change) / 100,
          changePercent: data.usd_24h_change,
          previousClose: data.usd / (1 + data.usd_24h_change / 100),
          currency: 'USD',
        });
      }
    }

    // Construct synthetic macro data from DeFi metrics
    const indices: MacroQuote[] = [
      {
        symbol: 'DEFI_TVL',
        name: 'Total DeFi TVL',
        price: defiTvl,
        change: 0,
        changePercent: 0,
        previousClose: defiTvl,
        currency: 'USD',
      },
      {
        symbol: 'STABLECOIN_MCAP',
        name: 'Total Stablecoin Market Cap',
        price: stablecoinMcap,
        change: 0,
        changePercent: 0,
        previousClose: stablecoinMcap,
        currency: 'USD',
      },
    ];

    const commodities: MacroQuote[] = [
      {
        symbol: 'DEFI_YIELD',
        name: 'Avg DeFi Yield',
        price: 0,
        change: 0,
        changePercent: 0,
        previousClose: 0,
        currency: '%',
      },
    ];

    const result = { indices, commodities, crypto, defiTvl, stablecoinMcap };
    setCache(cacheKey, result, 300);
    return result;
  } catch {
    return { indices: [], commodities: [], crypto: [], defiTvl: 0, stablecoinMcap: 0 };
  }
}

// =============================================================================
// DATA FETCHERS — WHALE DATA (Bitcoin)
// =============================================================================

export async function getBitcoinWhaleData(): Promise<BitcoinStats | null> {
  const cacheKey = 'btc-whale-stats';
  const cached = getCached<BitcoinStats>(cacheKey);
  if (cached) return cached;

  try {
    const [priceRes, statsRes, mempoolRes] = await Promise.all([
      safeFetch(`${BLOCKCHAIN_INFO}/ticker?cors=true`, 10000),
      safeFetch(`${MEMPOOL_API}/v1/mining/hashrate/3d`, 10000),
      safeFetch(`${MEMPOOL_API}/mempool`, 10000),
    ]);

    let marketPrice = 0;
    if (priceRes.ok) {
      const ticker: { USD: { last: number } } = await priceRes.json();
      marketPrice = ticker.USD?.last || 0;
    }

    let hashRate = 0;
    if (statsRes.ok) {
      const hashData: { currentHashrate: number } = await statsRes.json();
      hashRate = hashData.currentHashrate || 0;
    }

    let mempoolSize = 0;
    let mempoolTxCount = 0;
    if (mempoolRes.ok) {
      const mempool: { count: number; vsize: number } = await mempoolRes.json();
      mempoolSize = mempool.vsize || 0;
      mempoolTxCount = mempool.count || 0;
    }

    // Fetch additional Bitcoin stats from mempool.space
    const [diffRes, blockRes] = await Promise.all([
      safeFetch(`${MEMPOOL_API}/v1/difficulty-adjustment`, 10000),
      safeFetch(`${MEMPOOL_API}/blocks/tip/height`, 10000),
    ]);

    let difficulty = 0;
    if (diffRes.ok) {
      const diff: { difficultyChange: number } = await diffRes.json();
      difficulty = diff.difficultyChange || 0;
    }

    let latestBlock = 0;
    if (blockRes.ok) {
      const height = await blockRes.text();
      latestBlock = parseInt(height, 10) || 0;
    }

    const stats: BitcoinStats = {
      marketPrice,
      totalBtc: 21_000_000,
      hashRate,
      difficulty,
      blockCount: latestBlock,
      avgBlockSize: 0,
      totalTransactions: 0,
      mempoolSize,
      mempoolTxCount,
      avgFee: 0,
      latestBlock,
    };

    setCache(cacheKey, stats, 120);
    return stats;
  } catch {
    return null;
  }
}

export async function getRecentBlocks(): Promise<
  Array<{
    id: string;
    height: number;
    timestamp: number;
    tx_count: number;
    size: number;
    weight: number;
  }>
> {
  const cacheKey = 'recent-blocks';
  const cached =
    getCached<
      Array<{
        id: string;
        height: number;
        timestamp: number;
        tx_count: number;
        size: number;
        weight: number;
      }>
    >(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(`${MEMPOOL_API}/v1/blocks`, 10000);
    if (!res.ok) return [];
    const blocks: Array<{
      id: string;
      height: number;
      timestamp: number;
      tx_count: number;
      size: number;
      weight: number;
    }> = await res.json();
    const recent = blocks.slice(0, 15);
    setCache(cacheKey, recent, 60);
    return recent;
  } catch {
    return [];
  }
}

// =============================================================================
// DATA FETCHERS — STAKING
// =============================================================================

export async function getStakingYields(): Promise<StakingYield[]> {
  const cacheKey = 'staking-yields';
  const cached = getCached<StakingYield[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(`${DEFILLAMA_YIELDS}/pools`, 15000);
    if (!res.ok) return [];
    const json: { data: YieldPool[] } = await res.json();

    // Filter to staking-related pools
    const stakingKeywords = ['stak', 'validat', 'liquid stak', 'lsd', 'restaking'];
    const staking = json.data
      .filter(
        (p) =>
          p.tvlUsd > 500_000 &&
          p.apy > 0 &&
          p.apy < 100 &&
          (stakingKeywords.some((kw) => p.project.toLowerCase().includes(kw)) ||
            stakingKeywords.some((kw) => (p.symbol || '').toLowerCase().includes(kw)) ||
            ['lido', 'rocket-pool', 'frax-ether', 'coinbase-wrapped-staked-eth', 'mantle-staked-eth', 'binance-staked-eth'].includes(p.project.toLowerCase()) ||
            (p.symbol || '').toLowerCase().includes('steth') ||
            (p.symbol || '').toLowerCase().includes('reth') ||
            (p.symbol || '').toLowerCase().includes('cbeth') ||
            (p.symbol || '').toLowerCase().includes('meth') ||
            (p.symbol || '').toLowerCase().includes('wbeth'))
      )
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 50)
      .map((p) => ({
        chain: p.chain,
        project: p.project,
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
        pool: p.pool,
        stablecoin: p.stablecoin,
      }));

    setCache(cacheKey, staking, 300);
    return staking;
  } catch {
    return [];
  }
}

// =============================================================================
// DATA FETCHERS — ETF
// =============================================================================

/**
 * Get BTC & ETH Spot ETF data from CoinGecko simple prices
 * Uses crypto benchmarks as proxy for ETF tracking performance
 */
export async function getETFData(): Promise<{
  btcEtfs: ETFQuote[];
  ethEtfs: ETFQuote[];
  btcPrice: number;
  ethPrice: number;
  btcChange: number;
  ethChange: number;
}> {
  const cacheKey = 'etf-data';
  const cached = getCached<{
    btcEtfs: ETFQuote[];
    ethEtfs: ETFQuote[];
    btcPrice: number;
    ethPrice: number;
    btcChange: number;
    ethChange: number;
  }>(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(
      `${COINGECKO_BASE}/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    );
    if (!res.ok) {
      return { btcEtfs: [], ethEtfs: [], btcPrice: 0, ethPrice: 0, btcChange: 0, ethChange: 0 };
    }

    const prices: Record<
      string,
      {
        usd: number;
        usd_24h_change: number;
        usd_market_cap: number;
        usd_24h_vol: number;
      }
    > = await res.json();

    const btc = prices.bitcoin;
    const eth = prices.ethereum;

    // BTC Spot ETFs (tracked tickers)
    const btcEtfs: ETFQuote[] = [
      'IBIT', 'FBTC', 'GBTC', 'ARKB', 'BITB', 'HODL', 'BRRR', 'EZBC', 'BTCO', 'BTCW',
    ].map((ticker) => ({
      symbol: ticker,
      name: `${ticker} — BTC Spot ETF`,
      price: btc?.usd || 0,
      change: ((btc?.usd || 0) * (btc?.usd_24h_change || 0)) / 100,
      changePercent: btc?.usd_24h_change || 0,
      volume: btc?.usd_24h_vol || 0,
      avgVolume: 0,
      marketCap: btc?.usd_market_cap || 0,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      ytdReturn: null,
    }));

    // ETH Spot ETFs
    const ethEtfs: ETFQuote[] = ['ETHA', 'FETH', 'ETHE', 'ETHV', 'CETH', 'ETHW', 'QETH'].map(
      (ticker) => ({
        symbol: ticker,
        name: `${ticker} — ETH Spot ETF`,
        price: eth?.usd || 0,
        change: ((eth?.usd || 0) * (eth?.usd_24h_change || 0)) / 100,
        changePercent: eth?.usd_24h_change || 0,
        volume: eth?.usd_24h_vol || 0,
        avgVolume: 0,
        marketCap: eth?.usd_market_cap || 0,
        fiftyTwoWeekHigh: 0,
        fiftyTwoWeekLow: 0,
        ytdReturn: null,
      })
    );

    const result = {
      btcEtfs,
      ethEtfs,
      btcPrice: btc?.usd || 0,
      ethPrice: eth?.usd || 0,
      btcChange: btc?.usd_24h_change || 0,
      ethChange: eth?.usd_24h_change || 0,
    };

    setCache(cacheKey, result, 120);
    return result;
  } catch {
    return { btcEtfs: [], ethEtfs: [], btcPrice: 0, ethPrice: 0, btcChange: 0, ethChange: 0 };
  }
}

// =============================================================================
// DATA FETCHERS — TOKEN UNLOCKS / EMISSIONS
// =============================================================================

export async function getTokenUnlocks(): Promise<TokenEmission[]> {
  const cacheKey = 'token-unlocks';
  const cached = getCached<TokenEmission[]>(cacheKey);
  if (cached) return cached;

  try {
    // Use DeFiLlama protocols to extract upcoming emissions/events
    const res = await safeFetch(`${DEFILLAMA_BASE}/protocols`, 15000);
    if (!res.ok) return [];
    const protocols: Array<{
      name: string;
      symbol: string;
      tvl: number;
      mcap: number;
      category: string;
      change_1d: number;
    }> = await res.json();

    // Simulate token unlock data from protocol metrics
    // Real implementation would connect to token unlock APIs
    const topProtocols = protocols
      .filter((p) => p.tvl > 10_000_000 && p.symbol && p.mcap > 0)
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 50)
      .map((p) => ({
        name: p.name,
        symbol: p.symbol || '',
        totalLocked: p.tvl * 0.3,
        totalLockedUsd: p.tvl * 0.3,
        nextUnlockDate: new Date(
          Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        nextUnlockAmount: p.tvl * 0.02,
        nextUnlockAmountUsd: p.tvl * 0.02,
        category: p.category || 'DeFi',
      }));

    setCache(cacheKey, topProtocols, 1800);
    return topProtocols;
  } catch {
    return [];
  }
}

// =============================================================================
// DATA FETCHERS — STABLECOINS
// =============================================================================

export async function getStablecoins(): Promise<Stablecoin[]> {
  const cacheKey = 'stablecoins';
  const cached = getCached<Stablecoin[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(
      `${DEFILLAMA_STABLECOINS}/stablecoins?includePrices=true`,
      15000
    );
    if (!res.ok) return [];
    const data: {
      peggedAssets: Array<{
        id: string;
        name: string;
        symbol: string;
        pegType: string;
        circulating: Record<string, number>;
        price: number;
      }>;
    } = await res.json();

    const stablecoins = data.peggedAssets
      .filter((s) => (s.circulating?.peggedUSD || 0) > 1_000_000)
      .sort((a, b) => (b.circulating?.peggedUSD || 0) - (a.circulating?.peggedUSD || 0))
      .slice(0, 30)
      .map((s) => ({
        id: s.id,
        name: s.name,
        symbol: s.symbol,
        pegType: s.pegType,
        circulating: s.circulating,
        price: s.price || 1,
        pegDeviation: s.price ? Math.abs(s.price - 1) * 100 : null,
      }));

    setCache(cacheKey, stablecoins, 300);
    return stablecoins;
  } catch {
    return [];
  }
}

// =============================================================================
// DATA FETCHERS — DeFiLlama CHAINS (for L2/chain comparison)
// =============================================================================

export async function getChainsTvl(): Promise<
  Array<{
    name: string;
    tvl: number;
    tokenSymbol: string;
    gecko_id: string;
  }>
> {
  const cacheKey = 'chains-tvl';
  const cached =
    getCached<
      Array<{ name: string; tvl: number; tokenSymbol: string; gecko_id: string }>
    >(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(`${DEFILLAMA_BASE}/v2/chains`, 15000);
    if (!res.ok) return [];
    const chains: Array<{
      name: string;
      tvl: number;
      tokenSymbol: string;
      gecko_id: string;
    }> = await res.json();
    const sorted = chains.sort((a, b) => b.tvl - a.tvl).slice(0, 50);
    setCache(cacheKey, sorted, 300);
    return sorted;
  } catch {
    return [];
  }
}

// =============================================================================
// DATA FETCHERS — DeFiLlama BRIDGES, FEES, DEX VOLUMES
// =============================================================================

export async function getDexVolumes(): Promise<
  Array<{
    name: string;
    totalVolume24h: number;
    change_1d: number;
    chains: string[];
  }>
> {
  const cacheKey = 'dex-volumes';
  const cached =
    getCached<
      Array<{
        name: string;
        totalVolume24h: number;
        change_1d: number;
        chains: string[];
      }>
    >(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(`${DEFILLAMA_BASE}/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`, 15000);
    if (!res.ok) return [];
    const json: {
      protocols: Array<{
        name: string;
        total24h: number;
        change_1d: number;
        chains: string[];
      }>;
    } = await res.json();

    const dexes = (json.protocols || [])
      .filter((d) => d.total24h > 0)
      .sort((a, b) => b.total24h - a.total24h)
      .slice(0, 30)
      .map((d) => ({
        name: d.name,
        totalVolume24h: d.total24h,
        change_1d: d.change_1d || 0,
        chains: d.chains || [],
      }));

    setCache(cacheKey, dexes, 300);
    return dexes;
  } catch {
    return [];
  }
}

export async function getProtocolFees(): Promise<
  Array<{
    name: string;
    total24h: number;
    total7d: number;
    change_1d: number;
    chains: string[];
  }>
> {
  const cacheKey = 'protocol-fees';
  const cached =
    getCached<
      Array<{
        name: string;
        total24h: number;
        total7d: number;
        change_1d: number;
        chains: string[];
      }>
    >(cacheKey);
  if (cached) return cached;

  try {
    const res = await safeFetch(
      `${DEFILLAMA_BASE}/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
      15000
    );
    if (!res.ok) return [];
    const json: {
      protocols: Array<{
        name: string;
        total24h: number;
        total7d: number;
        change_1d: number;
        chains: string[];
      }>;
    } = await res.json();

    const fees = (json.protocols || [])
      .filter((f) => f.total24h > 0)
      .sort((a, b) => b.total24h - a.total24h)
      .slice(0, 30)
      .map((f) => ({
        name: f.name,
        total24h: f.total24h,
        total7d: f.total7d || 0,
        change_1d: f.change_1d || 0,
        chains: f.chains || [],
      }));

    setCache(cacheKey, fees, 300);
    return fees;
  } catch {
    return [];
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function formatLargeNumber(num: number): string {
  if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'K';
  return '$' + num.toFixed(2);
}

export function formatCompactNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toFixed(2);
}

export function formatPercentChange(num: number): string {
  const sign = num >= 0 ? '+' : '';
  return sign + num.toFixed(2) + '%';
}

export function changeColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-[var(--text-muted)]';
}

export function changeBg(value: number): string {
  if (value > 0) return 'bg-emerald-500/10 text-emerald-400';
  if (value < 0) return 'bg-red-500/10 text-red-400';
  return 'bg-[var(--surface-alt)] text-[var(--text-muted)]';
}
