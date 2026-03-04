/**
 * Market Trend Detector — Real Pump.fun API analysis for optimal launch timing
 *
 * Features:
 * - Real-time Pump.fun coin scanning (recent launches, top by market cap, KOTH)
 * - Category classification via keyword matching (AI, animal, political, culture, DeFi)
 * - Graduation rate tracking (raydium_pool / complete field detection)
 * - Launch timing assessment with multi-factor scoring
 * - Time-of-day activity pattern analysis (UTC hourly buckets)
 * - In-memory trend history with configurable TTL cache
 * - Continuous tracking via interval-based polling
 * - Event bus integration for cross-agent communication
 */

import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_PUMP_FUN_API_BASE = 'https://frontend-api-v3.pump.fun';
const DEFAULT_RECENT_COINS_LIMIT = 200;
const DEFAULT_CACHE_TTL = 300_000; // 5 minutes
const HTTP_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const FETCH_PAGE_SIZE = 50;

/** Graduation threshold: tokens with market_cap above ~69k SOL are on Raydium */
const GRADUATION_MARKET_CAP_THRESHOLD = 69_000_000_000; // lamports equivalent heuristic

const DEFAULT_TRACKED_CATEGORIES: readonly string[] = [
  'ai',
  'animal',
  'political',
  'tech',
  'culture',
  'defi',
] as const;

// ─── Types ────────────────────────────────────────────────────

export interface TrendConfig {
  /** Pump.fun API base URL */
  pumpFunApiBase: string;
  /** How many recent coins to analyze */
  recentCoinsLimit: number;
  /** Cache TTL (ms) */
  cacheTtl: number;
  /** Categories to track */
  trackedCategories: string[];
}

export interface MarketTrends {
  /** Overall market activity level */
  activityLevel: 'dead' | 'low' | 'moderate' | 'high' | 'frenzy';
  /** Launches per hour (rolling) */
  launchesPerHour: number;
  /** Graduation rate: % of tokens that graduate in last 24h */
  graduationRate: number;
  /** Average market cap of recent launches */
  avgMarketCap: number;
  /** Category breakdown */
  categories: CategoryTrend[];
  /** Trending tokens (fastest growing) */
  trendingTokens: Array<{
    mint: string;
    name: string;
    symbol: string;
    marketCap: number;
    growth: number;
  }>;
  /** Tokens close to graduation */
  nearGraduation: Array<{
    mint: string;
    name: string;
    progress: number;
  }>;
  /** Optimal launch window assessment */
  launchTiming: LaunchTimingAssessment;
  /** Time-of-day activity pattern (24 hours, UTC) */
  hourlyActivity: number[];
  /** Analyzed at */
  timestamp: number;
}

export interface CategoryTrend {
  /** Category name */
  category: string;
  /** Number of launches in this category (recent) */
  launchCount: number;
  /** Percentage of total launches */
  launchShare: number;
  /** Average market cap in this category */
  avgMarketCap: number;
  /** Is this category trending up or down? */
  momentum: 'rising' | 'stable' | 'falling';
  /** Graduation rate for this category */
  graduationRate: number;
  /** Example tokens */
  examples: Array<{ name: string; symbol: string; marketCap: number }>;
  /** Score: 0-100 overall hotness */
  score: number;
}

export interface LaunchTimingAssessment {
  /** Overall score: 0-100 (higher = better time to launch) */
  score: number;
  /** Should we launch now? */
  recommendation: 'launch-now' | 'wait' | 'avoid';
  /** Factors contributing to recommendation */
  factors: Array<{
    factor: string;
    score: number;
    weight: number;
    reasoning: string;
  }>;
  /** Estimated best launch window (UTC hours) */
  bestHours: number[];
  /** How long until next good window (ms), 0 if now is good */
  nextWindowMs: number;
  /** Warnings */
  warnings: string[];
}

export interface ActivityMetrics {
  /** Total tokens analyzed */
  totalTokens: number;
  /** Tokens launched in last hour */
  launchedLastHour: number;
  /** Tokens launched in last 24h */
  launchedLast24h: number;
  /** Graduated tokens in last 24h */
  graduatedLast24h: number;
  /** Average market cap across all analyzed tokens */
  avgMarketCap: number;
  /** Median market cap */
  medianMarketCap: number;
  /** Total combined market cap */
  totalMarketCap: number;
  /** Activity level classification */
  activityLevel: 'dead' | 'low' | 'moderate' | 'high' | 'frenzy';
  /** Timestamp */
  timestamp: number;
}

// ─── Internal Types ───────────────────────────────────────────

interface PumpFunCoin {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  market_cap: number;
  reply_count: number;
  created_timestamp: number;
  raydium_pool: string | null;
  complete: boolean;
  usd_market_cap?: number;
  total_supply?: number;
  virtual_sol_reserves?: number;
  virtual_token_reserves?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ─── Category Keywords ────────────────────────────────────────

const CATEGORY_KEYWORDS: ReadonlyMap<string, readonly string[]> = new Map([
  [
    'ai',
    [
      'ai',
      'gpt',
      'agent',
      'bot',
      'neural',
      'quantum',
      'cyber',
      'llm',
      'openai',
      'chatgpt',
      'machine learning',
      'deep learning',
      'artificial',
      'intelligence',
      'transformer',
      'compute',
      'model',
    ],
  ],
  [
    'animal',
    [
      'dog',
      'cat',
      'pepe',
      'frog',
      'shiba',
      'inu',
      'bear',
      'bull',
      'doge',
      'monkey',
      'ape',
      'whale',
      'fish',
      'bird',
      'hamster',
      'penguin',
      'fox',
      'wolf',
      'lion',
      'tiger',
      'panda',
      'bunny',
      'rabbit',
      'duck',
      'owl',
    ],
  ],
  [
    'political',
    [
      'trump',
      'biden',
      'elon',
      'musk',
      'president',
      'vote',
      'election',
      'congress',
      'senate',
      'democrat',
      'republican',
      'political',
      'government',
      'war',
      'freedom',
      'patriot',
      'america',
      'maga',
    ],
  ],
  [
    'culture',
    [
      'meme',
      'based',
      'chad',
      'wojak',
      'npc',
      'sigma',
      'gigachad',
      'copium',
      'hopium',
      'ratio',
      'bruh',
      'vibe',
      'cope',
      'seethe',
      'rug',
      'wagmi',
      'ngmi',
      'degen',
      'gm',
      'ser',
      'fren',
      'anon',
    ],
  ],
  [
    'defi',
    [
      'swap',
      'yield',
      'stake',
      'pool',
      'vault',
      'protocol',
      'liquidity',
      'farm',
      'lending',
      'borrow',
      'collateral',
      'amm',
      'dex',
      'dao',
      'governance',
      'treasury',
    ],
  ],
  [
    'tech',
    [
      'chain',
      'crypto',
      'blockchain',
      'web3',
      'decentralized',
      'token',
      'nft',
      'metaverse',
      'virtual',
      'digital',
      'layer',
      'rollup',
      'bridge',
      'node',
      'validator',
      'consensus',
      'zk',
      'proof',
    ],
  ],
]);

// ─── Helpers ──────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function classifyActivity(
  launchesPerHour: number,
): 'dead' | 'low' | 'moderate' | 'high' | 'frenzy' {
  if (launchesPerHour < 5) return 'dead';
  if (launchesPerHour < 20) return 'low';
  if (launchesPerHour < 60) return 'moderate';
  if (launchesPerHour < 150) return 'high';
  return 'frenzy';
}

function classifyCoin(coin: PumpFunCoin): string[] {
  const text = `${coin.name} ${coin.symbol} ${coin.description}`.toLowerCase();
  const matched: string[] = [];

  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        matched.push(category);
        break; // one keyword match per category is enough
      }
    }
  }

  return matched.length > 0 ? matched : ['uncategorized'];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── TrendDetector ────────────────────────────────────────────

export class TrendDetector {
  private readonly eventBus: SwarmEventBus;
  private readonly config: TrendConfig;
  private readonly logger: SwarmLogger;

  // Cache
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  // Trend history
  private readonly trendHistory: MarketTrends[] = [];
  private readonly maxHistorySize = 288; // 24h at 5-min intervals

  // Continuous tracking
  private trackingInterval: ReturnType<typeof setInterval> | undefined;
  private isTracking = false;

  constructor(eventBus: SwarmEventBus, config?: Partial<TrendConfig>) {
    this.eventBus = eventBus;
    this.config = {
      pumpFunApiBase: config?.pumpFunApiBase ?? DEFAULT_PUMP_FUN_API_BASE,
      recentCoinsLimit: config?.recentCoinsLimit ?? DEFAULT_RECENT_COINS_LIMIT,
      cacheTtl: config?.cacheTtl ?? DEFAULT_CACHE_TTL,
      trackedCategories: config?.trackedCategories ?? [...DEFAULT_TRACKED_CATEGORIES],
    };
    this.logger = SwarmLogger.create('trend-detector', 'intelligence');
    this.logger.info('TrendDetector initialized', {
      apiBase: this.config.pumpFunApiBase,
      recentCoinsLimit: this.config.recentCoinsLimit,
      cacheTtl: this.config.cacheTtl,
      trackedCategories: this.config.trackedCategories,
    });
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Comprehensive trend analysis: fetches recent launches, top coins,
   * king-of-the-hill tokens, computes categories, graduation rates,
   * hourly patterns, and launch timing.
   */
  async detectTrends(): Promise<MarketTrends> {
    const cached = this.getCached<MarketTrends>('trends');
    if (cached) return cached;

    this.logger.info('Detecting market trends...');

    const [recentCoins, topCoins, kothCoins] = await Promise.all([
      this.fetchRecentCoins(),
      this.fetchTopCoins(),
      this.fetchKingOfTheHill(),
    ]);

    const allCoins = this.deduplicateCoins([...recentCoins, ...topCoins, ...kothCoins]);
    const now = Date.now();

    // Compute core metrics
    const launchesPerHour = this.computeLaunchesPerHour(recentCoins, now);
    const activityLevel = classifyActivity(launchesPerHour);
    const graduationRate = this.computeGraduationRate(allCoins);
    const avgMarketCap = this.computeAvgMarketCap(allCoins);
    const hourlyActivity = this.computeHourlyActivity(recentCoins);
    const categories = this.computeCategories(allCoins);
    const trendingTokens = this.computeTrendingTokens(topCoins);
    const nearGraduation = this.computeNearGraduation(kothCoins);
    const launchTiming = this.computeLaunchTiming(
      activityLevel,
      launchesPerHour,
      graduationRate,
      categories,
      hourlyActivity,
      now,
    );

    const trends: MarketTrends = {
      activityLevel,
      launchesPerHour,
      graduationRate,
      avgMarketCap,
      categories,
      trendingTokens,
      nearGraduation,
      launchTiming,
      hourlyActivity,
      timestamp: now,
    };

    // Store in history
    this.trendHistory.push(trends);
    if (this.trendHistory.length > this.maxHistorySize) {
      this.trendHistory.splice(0, this.trendHistory.length - this.maxHistorySize);
    }

    // Cache
    this.setCache('trends', trends);

    // Emit event
    this.eventBus.emit(
      'intelligence:trends-detected',
      'intelligence',
      'trend-detector',
      {
        activityLevel,
        launchesPerHour,
        graduationRate,
        avgMarketCap,
        recommendation: launchTiming.recommendation,
        launchScore: launchTiming.score,
        categoryCount: categories.length,
      },
    );

    this.logger.info('Trends detected', {
      activityLevel,
      launchesPerHour: Math.round(launchesPerHour * 10) / 10,
      graduationRate: Math.round(graduationRate * 1000) / 10,
      avgMarketCap: Math.round(avgMarketCap),
      recommendation: launchTiming.recommendation,
      score: launchTiming.score,
    });

    return trends;
  }

  /**
   * Should we launch a token now? Returns a full timing assessment.
   */
  async isGoodTimeToLaunch(): Promise<LaunchTimingAssessment> {
    const trends = await this.detectTrends();
    return trends.launchTiming;
  }

  /**
   * Get currently trending categories ranked by hotness score.
   */
  async getTrendingCategories(): Promise<CategoryTrend[]> {
    const trends = await this.detectTrends();
    return [...trends.categories].sort((a, b) => b.score - a.score);
  }

  /**
   * Get overall Pump.fun activity metrics.
   */
  async getMarketActivity(): Promise<ActivityMetrics> {
    const cached = this.getCached<ActivityMetrics>('activity');
    if (cached) return cached;

    const recentCoins = await this.fetchRecentCoins();
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;
    const oneDayAgo = now - 86_400_000;

    const marketCaps = recentCoins.map((c) => c.market_cap);
    const launchedLastHour = recentCoins.filter(
      (c) => c.created_timestamp > oneHourAgo / 1000,
    ).length;
    const launchedLast24h = recentCoins.filter(
      (c) => c.created_timestamp > oneDayAgo / 1000,
    ).length;
    const graduatedLast24h = recentCoins.filter(
      (c) =>
        c.created_timestamp > oneDayAgo / 1000 &&
        (c.complete || c.raydium_pool !== null),
    ).length;
    const totalMarketCap = marketCaps.reduce((sum, mc) => sum + mc, 0);
    const avgMC = marketCaps.length > 0 ? totalMarketCap / marketCaps.length : 0;
    const medianMC = median(marketCaps);
    const launchesPerHour = this.computeLaunchesPerHour(recentCoins, now);

    const metrics: ActivityMetrics = {
      totalTokens: recentCoins.length,
      launchedLastHour,
      launchedLast24h,
      graduatedLast24h,
      avgMarketCap: avgMC,
      medianMarketCap: medianMC,
      totalMarketCap,
      activityLevel: classifyActivity(launchesPerHour),
      timestamp: now,
    };

    this.setCache('activity', metrics);
    return metrics;
  }

  /**
   * Start continuous trend tracking at the given interval.
   */
  startTracking(intervalMs: number): void {
    if (this.isTracking) {
      this.logger.warn('Tracking already active, ignoring startTracking call');
      return;
    }

    this.isTracking = true;
    this.logger.info('Starting continuous trend tracking', { intervalMs });

    // Run immediately, then on interval
    void this.detectTrends().catch((err: unknown) => {
      this.logger.error(
        'Initial trend detection failed',
        err instanceof Error ? err : new Error(String(err)),
      );
    });

    this.trackingInterval = setInterval(() => {
      void this.detectTrends().catch((err: unknown) => {
        this.logger.error(
          'Periodic trend detection failed',
          err instanceof Error ? err : new Error(String(err)),
        );
      });
    }, intervalMs);
  }

  /**
   * Stop continuous trend tracking.
   */
  stopTracking(): void {
    if (!this.isTracking) return;

    if (this.trackingInterval !== undefined) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = undefined;
    }
    this.isTracking = false;
    this.logger.info('Stopped continuous trend tracking');
  }

  /**
   * Return all stored trend snapshots (oldest first).
   */
  getHistoricalTrends(): MarketTrends[] {
    return [...this.trendHistory];
  }

  // ─── API Fetching ───────────────────────────────────────────

  /**
   * Fetch recent coin launches from Pump.fun, paginated up to recentCoinsLimit.
   */
  private async fetchRecentCoins(): Promise<PumpFunCoin[]> {
    const cached = this.getCached<PumpFunCoin[]>('recent-coins');
    if (cached) return cached;

    const coins: PumpFunCoin[] = [];
    const limit = this.config.recentCoinsLimit;
    const pages = Math.ceil(limit / FETCH_PAGE_SIZE);

    for (let page = 0; page < pages; page++) {
      const offset = page * FETCH_PAGE_SIZE;
      const pageLimit = Math.min(FETCH_PAGE_SIZE, limit - offset);
      const url = `${this.config.pumpFunApiBase}/coins?sort=created_timestamp&order=desc&limit=${pageLimit}&offset=${offset}`;

      const data = await this.fetchWithRetry<PumpFunCoin[]>(url);
      if (data.length === 0) break;
      coins.push(...data);

      // Small delay between pages to avoid rate limiting
      if (page < pages - 1) {
        await sleep(200);
      }
    }

    this.setCache('recent-coins', coins);
    this.logger.debug('Fetched recent coins', { count: coins.length });
    return coins;
  }

  /**
   * Fetch top coins by market cap from Pump.fun.
   */
  private async fetchTopCoins(): Promise<PumpFunCoin[]> {
    const cached = this.getCached<PumpFunCoin[]>('top-coins');
    if (cached) return cached;

    const url = `${this.config.pumpFunApiBase}/coins?sort=market_cap&order=desc&limit=${FETCH_PAGE_SIZE}`;
    const coins = await this.fetchWithRetry<PumpFunCoin[]>(url);

    this.setCache('top-coins', coins);
    this.logger.debug('Fetched top coins', { count: coins.length });
    return coins;
  }

  /**
   * Fetch King of the Hill tokens — those closest to graduating to Raydium.
   */
  private async fetchKingOfTheHill(): Promise<PumpFunCoin[]> {
    const cached = this.getCached<PumpFunCoin[]>('koth');
    if (cached) return cached;

    const url = `${this.config.pumpFunApiBase}/coins/king-of-the-hill?includeNsfw=false`;

    try {
      const data = await this.fetchWithRetry<PumpFunCoin | PumpFunCoin[]>(url);
      const coins = Array.isArray(data) ? data : [data];
      this.setCache('koth', coins);
      this.logger.debug('Fetched KOTH coins', { count: coins.length });
      return coins;
    } catch (err) {
      // KOTH endpoint can be flaky; don't fail the whole analysis
      this.logger.warn(
        'KOTH fetch failed, continuing without it',
        { error: err instanceof Error ? err.message : String(err) },
      );
      return [];
    }
  }

  /**
   * HTTP fetch with exponential retry backoff and timeout.
   */
  private async fetchWithRetry<T>(url: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

        const response = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'CryptoVision-TrendDetector/1.0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
        }

        const data = (await response.json()) as T;
        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          this.logger.warn(`Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
            url,
            error: lastError.message,
          });
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
  }

  // ─── Computation Methods ────────────────────────────────────

  /**
   * Deduplicate coins by mint address, keeping the first occurrence.
   */
  private deduplicateCoins(coins: PumpFunCoin[]): PumpFunCoin[] {
    const seen = new Set<string>();
    const result: PumpFunCoin[] = [];

    for (const coin of coins) {
      if (!seen.has(coin.mint)) {
        seen.add(coin.mint);
        result.push(coin);
      }
    }

    return result;
  }

  /**
   * Compute rolling launches per hour from recent coin timestamps.
   */
  private computeLaunchesPerHour(coins: PumpFunCoin[], nowMs: number): number {
    if (coins.length === 0) return 0;

    // created_timestamp is in seconds (Unix epoch)
    const oneHourAgoSec = (nowMs - 3_600_000) / 1000;
    const launchedInLastHour = coins.filter(
      (c) => c.created_timestamp > oneHourAgoSec,
    ).length;

    // If we have enough data, use the actual count
    if (launchedInLastHour > 0) return launchedInLastHour;

    // Fallback: estimate from the time span of coins we have
    const timestamps = coins.map((c) => c.created_timestamp).sort((a, b) => a - b);
    const oldest = timestamps[0]!;
    const newest = timestamps[timestamps.length - 1]!;
    const spanHours = Math.max((newest - oldest) / 3600, 0.1);

    return coins.length / spanHours;
  }

  /**
   * Compute the graduation rate: fraction of tokens that have graduated
   * (complete === true or raydium_pool is set).
   */
  private computeGraduationRate(coins: PumpFunCoin[]): number {
    if (coins.length === 0) return 0;

    const graduated = coins.filter(
      (c) => c.complete || c.raydium_pool !== null,
    ).length;

    return graduated / coins.length;
  }

  /**
   * Average market cap across all coins.
   */
  private computeAvgMarketCap(coins: PumpFunCoin[]): number {
    if (coins.length === 0) return 0;
    const total = coins.reduce((sum, c) => sum + c.market_cap, 0);
    return total / coins.length;
  }

  /**
   * Compute a 24-element array of launch counts per UTC hour.
   */
  private computeHourlyActivity(coins: PumpFunCoin[]): number[] {
    const hours = new Array<number>(24).fill(0);

    for (const coin of coins) {
      // created_timestamp is in seconds
      const date = new Date(coin.created_timestamp * 1000);
      const hour = date.getUTCHours();
      hours[hour]++;
    }

    return hours;
  }

  /**
   * Build CategoryTrend data for each tracked category.
   */
  private computeCategories(coins: PumpFunCoin[]): CategoryTrend[] {
    const totalCoins = coins.length;
    if (totalCoins === 0) return [];

    // Bucket coins into categories
    const catBuckets = new Map<string, PumpFunCoin[]>();
    for (const cat of this.config.trackedCategories) {
      catBuckets.set(cat, []);
    }
    catBuckets.set('uncategorized', []);

    for (const coin of coins) {
      const categories = classifyCoin(coin);
      for (const cat of categories) {
        const bucket = catBuckets.get(cat);
        if (bucket) {
          bucket.push(coin);
        }
      }
    }

    // Compute previous category shares from history for momentum
    const prevShares = this.getPreviousCategoryShares();

    const result: CategoryTrend[] = [];
    for (const [category, bucket] of catBuckets) {
      if (category === 'uncategorized' && bucket.length === 0) continue;

      const launchCount = bucket.length;
      const launchShare = totalCoins > 0 ? launchCount / totalCoins : 0;
      const avgMarketCap = this.computeAvgMarketCap(bucket);
      const graduationRate = this.computeGraduationRate(bucket);

      // Momentum: compare current share to previous
      const prevShare = prevShares.get(category) ?? launchShare;
      const shareDelta = launchShare - prevShare;
      let momentum: 'rising' | 'stable' | 'falling';
      if (shareDelta > 0.03) momentum = 'rising';
      else if (shareDelta < -0.03) momentum = 'falling';
      else momentum = 'stable';

      // Examples: top 3 by market cap
      const examples = [...bucket]
        .sort((a, b) => b.market_cap - a.market_cap)
        .slice(0, 3)
        .map((c) => ({ name: c.name, symbol: c.symbol, marketCap: c.market_cap }));

      // Hotness score: weighted combination of share, graduation rate, and momentum
      const shareScore = clamp(launchShare * 200, 0, 40); // max 40
      const gradScore = clamp(graduationRate * 100, 0, 30); // max 30
      const momentumScore =
        momentum === 'rising' ? 30 : momentum === 'stable' ? 15 : 0;
      const score = Math.round(clamp(shareScore + gradScore + momentumScore, 0, 100));

      result.push({
        category,
        launchCount,
        launchShare: Math.round(launchShare * 1000) / 10, // as percentage
        avgMarketCap: Math.round(avgMarketCap),
        momentum,
        graduationRate: Math.round(graduationRate * 1000) / 10, // as percentage
        examples,
        score,
      });
    }

    return result.sort((a, b) => b.score - a.score);
  }

  /**
   * Extract previous category shares from the most recent historical trend snapshot.
   */
  private getPreviousCategoryShares(): Map<string, number> {
    const shares = new Map<string, number>();
    if (this.trendHistory.length === 0) return shares;

    const prev = this.trendHistory[this.trendHistory.length - 1]!;
    for (const cat of prev.categories) {
      shares.set(cat.category, cat.launchShare / 100); // convert back from percentage
    }

    return shares;
  }

  /**
   * Identify trending tokens by market cap (proxy for growth).
   * Returns top coins sorted by market cap descending.
   */
  private computeTrendingTokens(
    topCoins: PumpFunCoin[],
  ): Array<{ mint: string; name: string; symbol: string; marketCap: number; growth: number }> {
    return topCoins
      .filter((c) => !c.complete) // exclude already graduated
      .sort((a, b) => b.market_cap - a.market_cap)
      .slice(0, 10)
      .map((coin) => ({
        mint: coin.mint,
        name: coin.name,
        symbol: coin.symbol,
        marketCap: coin.market_cap,
        // Growth proxy: market cap relative to reply count (engagement-weighted)
        growth: coin.reply_count > 0
          ? Math.round((coin.market_cap / coin.reply_count) * 100) / 100
          : coin.market_cap,
      }));
  }

  /**
   * Find tokens near graduation — high market cap but not yet complete.
   */
  private computeNearGraduation(
    kothCoins: PumpFunCoin[],
  ): Array<{ mint: string; name: string; progress: number }> {
    return kothCoins
      .filter((c) => !c.complete && c.raydium_pool === null)
      .map((coin) => ({
        mint: coin.mint,
        name: coin.name,
        // Progress: market cap as % of graduation threshold
        progress: Math.min(
          Math.round((coin.market_cap / GRADUATION_MARKET_CAP_THRESHOLD) * 10000) / 100,
          99.9,
        ),
      }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 10);
  }

  /**
   * Compute a multi-factor launch timing assessment.
   */
  private computeLaunchTiming(
    activityLevel: MarketTrends['activityLevel'],
    launchesPerHour: number,
    graduationRate: number,
    categories: CategoryTrend[],
    hourlyActivity: number[],
    nowMs: number,
  ): LaunchTimingAssessment {
    const factors: LaunchTimingAssessment['factors'] = [];
    const warnings: string[] = [];

    // Factor 1: Activity Level (weight: 0.25)
    // Moderate activity is ideal — enough audience without too much competition
    const activityScores: Record<string, number> = {
      dead: 10,
      low: 40,
      moderate: 90,
      high: 60,
      frenzy: 30,
    };
    const activityScore = activityScores[activityLevel] ?? 50;
    factors.push({
      factor: 'Market Activity',
      score: activityScore,
      weight: 0.25,
      reasoning:
        activityLevel === 'moderate'
          ? 'Moderate activity — good balance of audience and competition'
          : activityLevel === 'dead' || activityLevel === 'low'
            ? 'Low activity — limited audience for new tokens'
            : activityLevel === 'frenzy'
              ? 'Extremely high activity — fierce competition, hard to stand out'
              : 'High activity — strong audience but rising competition',
    });

    if (activityLevel === 'dead') {
      warnings.push('Market activity is extremely low — very few traders active');
    }
    if (activityLevel === 'frenzy') {
      warnings.push('Market is in frenzy mode — high risk of getting lost in noise');
    }

    // Factor 2: Time of Day (weight: 0.20)
    // US market hours (14:00-02:00 UTC) are peak
    const currentHourUtc = new Date(nowMs).getUTCHours();
    const peakHoursUtc = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];
    const isInPeakHours = peakHoursUtc.includes(currentHourUtc);
    const timeScore = isInPeakHours ? 85 : 35;
    factors.push({
      factor: 'Time of Day',
      score: timeScore,
      weight: 0.2,
      reasoning: isInPeakHours
        ? `Current hour (${currentHourUtc}:00 UTC) is within US market peak hours`
        : `Current hour (${currentHourUtc}:00 UTC) is outside US market peak hours (14:00-02:00 UTC)`,
    });

    // Factor 3: Graduation Rate (weight: 0.20)
    // Higher graduation rate = more engaged traders = better
    const gradPercent = graduationRate * 100;
    const gradScore = clamp(Math.round(gradPercent * 20), 0, 100); // 5% rate → 100 score
    factors.push({
      factor: 'Graduation Rate',
      score: gradScore,
      weight: 0.2,
      reasoning:
        gradPercent > 3
          ? `Strong graduation rate (${gradPercent.toFixed(1)}%) — traders are actively pushing tokens to Raydium`
          : gradPercent > 1
            ? `Moderate graduation rate (${gradPercent.toFixed(1)}%) — decent trader engagement`
            : `Low graduation rate (${gradPercent.toFixed(1)}%) — traders are not pushing tokens through`,
    });

    if (gradPercent < 0.5) {
      warnings.push('Very low graduation rate — market may be in a lull');
    }

    // Factor 4: Category Saturation (weight: 0.20)
    // If the top category dominates > 40%, it's saturated
    const topCategory = categories[0];
    const topCatShare = topCategory ? topCategory.launchShare : 0;
    const saturationScore = topCatShare > 40 ? 30 : topCatShare > 25 ? 60 : 85;
    factors.push({
      factor: 'Category Diversity',
      score: saturationScore,
      weight: 0.2,
      reasoning:
        topCatShare > 40
          ? `Top category "${topCategory?.category}" dominates at ${topCatShare.toFixed(1)}% — high saturation, avoid this category`
          : topCatShare > 25
            ? `Top category "${topCategory?.category}" at ${topCatShare.toFixed(1)}% — moderate concentration`
            : 'Good category diversity — no single category dominates',
    });

    if (topCatShare > 40 && topCategory) {
      warnings.push(
        `"${topCategory.category}" category is saturated at ${topCatShare.toFixed(1)}% — consider a different category`,
      );
    }

    // Factor 5: Launch Velocity (weight: 0.15)
    // 20-80 launches/hour is the sweet spot
    const velocityScore =
      launchesPerHour >= 20 && launchesPerHour <= 80
        ? 90
        : launchesPerHour < 20
          ? clamp(Math.round(launchesPerHour * 4.5), 0, 89)
          : clamp(Math.round(180 - launchesPerHour), 0, 89);
    factors.push({
      factor: 'Launch Velocity',
      score: velocityScore,
      weight: 0.15,
      reasoning: `${Math.round(launchesPerHour)} launches/hour — ${
        launchesPerHour >= 20 && launchesPerHour <= 80
          ? 'optimal range for visibility'
          : launchesPerHour < 20
            ? 'below optimal velocity'
            : 'above optimal velocity, risk of getting buried'
      }`,
    });

    // Compute weighted total score
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    const score = Math.round(clamp(weightedScore / totalWeight, 0, 100));

    // Recommendation
    let recommendation: LaunchTimingAssessment['recommendation'];
    if (score >= 65) recommendation = 'launch-now';
    else if (score >= 40) recommendation = 'wait';
    else recommendation = 'avoid';

    // Best hours: find top hours from hourly activity
    const bestHours = this.computeBestLaunchHours(hourlyActivity);

    // Next window: how long until the next peak hour
    const nextWindowMs = this.computeNextWindowMs(currentHourUtc, bestHours, nowMs);

    return {
      score,
      recommendation,
      factors,
      bestHours,
      nextWindowMs,
      warnings,
    };
  }

  /**
   * Determine the best UTC hours to launch based on hourly activity data,
   * biased toward US market hours.
   */
  private computeBestLaunchHours(hourlyActivity: number[]): number[] {
    // Combine actual activity data with US market hour bias
    const scored = hourlyActivity.map((count, hour) => {
      const usBonus = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1].includes(hour)
        ? 5
        : 0;
      return { hour, score: count + usBonus };
    });

    // Sort by score descending, take top 5
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5).map((s) => s.hour).sort((a, b) => a - b);
  }

  /**
   * Compute milliseconds until the next good launch window.
   */
  private computeNextWindowMs(
    currentHourUtc: number,
    bestHours: number[],
    nowMs: number,
  ): number {
    if (bestHours.length === 0) return 0;
    if (bestHours.includes(currentHourUtc)) return 0;

    // Find the next best hour
    let nextHour = bestHours.find((h) => h > currentHourUtc);
    if (nextHour === undefined) {
      // Wrap around to next day
      nextHour = bestHours[0]!;
    }

    // Calculate ms until that hour
    const now = new Date(nowMs);
    const target = new Date(nowMs);
    target.setUTCHours(nextHour, 0, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setUTCDate(target.getUTCDate() + 1);
    }

    return target.getTime() - now.getTime();
  }

  // ─── Cache ──────────────────────────────────────────────────

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.config.cacheTtl,
    });
  }
}
