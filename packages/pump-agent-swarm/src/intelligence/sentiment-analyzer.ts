/**
 * Social Sentiment Analyzer — Real API integrations with Twitter/X,
 * Pump.fun comments, and Google Trends for token & narrative analysis.
 *
 * Features:
 * - Twitter/X search via API v2 (bearer token) or syndication fallback
 * - Pump.fun comment scraping (no auth required)
 * - Google Trends daily trends parsing
 * - Local keyword-based sentiment scoring (zero API calls)
 * - AI-powered deep sentiment via OpenRouter LLM
 * - In-memory TTL cache with rate limiting
 * - Batch analysis for multiple queries
 */

import { v4 as uuidv4 } from 'uuid';

import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Types ────────────────────────────────────────────────────

export type SentimentLabel =
  | 'very-positive'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'very-negative';

export interface SentimentConfig {
  /** Twitter Bearer Token (API v2) */
  twitterBearerToken?: string;
  /** OpenRouter API key for AI-powered sentiment */
  openRouterApiKey?: string;
  /** Groq API key for fallback AI inference */
  groqApiKey?: string;
  /** Model for AI analysis */
  aiModel: string;
  /** Cache TTL (ms) */
  cacheTtl: number;
  /** Max requests per minute to avoid rate limits */
  maxRequestsPerMinute: number;
  /** Enable/disable specific sources */
  sources: {
    twitter: boolean;
    pumpfunComments: boolean;
    googleTrends: boolean;
    aiAnalysis: boolean;
  };
}

export interface SourceSentiment {
  score: number;
  postCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  samplePosts: Array<{
    text: string;
    sentiment: number;
    engagement?: number;
  }>;
}

export interface TrendsData {
  /** Interest score 0-100 */
  interestScore: number;
  relatedQueries: string[];
  rising: boolean;
}

export interface SentimentScore {
  /** Aggregate sentiment: -1 (very negative) to 1 (very positive) */
  score: number;
  /** Categorized label */
  sentiment: SentimentLabel;
  /** Number of texts analyzed */
  count: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
}

export interface SentimentReport {
  query: string;
  /** Aggregate sentiment: -1 (very negative) to 1 (very positive) */
  score: number;
  /** Categorized sentiment */
  sentiment: SentimentLabel;
  /** How confident in the score (0-1), based on data volume */
  confidence: number;
  /** Volume of mentions/posts found */
  volume: number;
  /** Is this topic trending? */
  trending: boolean;
  /** Source breakdown */
  sources: {
    twitter?: SourceSentiment;
    pumpfun?: SourceSentiment;
    googleTrends?: TrendsData;
  };
  /** Keywords extracted from content */
  keywords: Array<{ word: string; count: number; sentiment: number }>;
  /** Timestamp */
  analyzedAt: number;
}

export interface TokenSentiment {
  mint: string;
  name: string;
  ticker: string;
  overallSentiment: number;
  sentiment: SentimentLabel;
  pumpfunComments: {
    count: number;
    sentiment: number;
    recentComments: Array<{
      text: string;
      timestamp: number;
      sentiment: number;
    }>;
  };
  twitterMentions: {
    count: number;
    sentiment: number;
    engagement: number;
  };
  /** Community health 0-100 based on activity quality */
  communityHealth: number;
  /** FUD level 0-100 */
  fudLevel: number;
  /** Hype meter 0-100 */
  hypeMeter: number;
  analyzedAt: number;
}

export interface TrendingNarrative {
  narrative: string;
  category: string;
  momentum: number;
  sentiment: number;
  volume: number;
  examples: string[];
  peakEstimate: 'rising' | 'peaking' | 'fading';
}

export interface AISentimentResult {
  overallSentiment: number;
  categories: Array<{
    category: string;
    percentage: number;
  }>;
  summary: string;
  keyInsights: string[];
}

// ─── Internal Types ───────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface TwitterTweet {
  text: string;
  created_at?: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
}

interface PumpfunReply {
  text?: string;
  body?: string;
  content?: string;
  timestamp?: number;
  created_at?: string;
  created_timestamp?: number;
}

// ─── Constants ────────────────────────────────────────────────

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_FALLBACK_MODEL = 'llama-3.1-8b-instant';
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const PUMPFUN_API_BASE = 'https://frontend-api-v3.pump.fun';
const GOOGLE_TRENDS_DAILY = 'https://trends.google.com/trends/api/dailytrends';

const LLM_TIMEOUT_MS = 90_000;
const HTTP_TIMEOUT_MS = 15_000;
const MAX_AI_BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

const POSITIVE_KEYWORDS = new Set([
  'moon', 'pump', 'gem', 'bullish', '100x', 'based', 'lfg',
  'alpha', 'accumulate', 'undervalued', 'buy', 'long', 'rocket',
  'lambo', 'diamond', 'hands', 'hodl', 'hold', 'degen', 'send',
  'banger', 'fire', 'wagmi', 'gm', 'breakout', 'parabolic',
  'massive', 'insane', 'incredible', 'amazing', 'love', 'great',
  'perfect', 'winner', 'mooning', 'pumping', 'kings', 'legend',
  'early', 'opportunity', 'potential', 'growth', 'gain', 'profit',
]);

const NEGATIVE_KEYWORDS = new Set([
  'rug', 'scam', 'dump', 'bearish', 'dead', 'sell', 'rugpull',
  'honeypot', 'avoid', 'exit', 'short', 'crash', 'rekt', 'ngmi',
  'fake', 'fraud', 'ponzi', 'scheme', 'warning', 'danger',
  'shit', 'trash', 'garbage', 'terrible', 'horrible', 'awful',
  'bad', 'worst', 'hate', 'fear', 'panic', 'dump', 'dumping',
  'dumpeet', 'exit-scam', 'beware', 'bot', 'wash', 'insider',
  'manipulation', 'manipulated', 'rigged', 'devdump', 'jeet',
]);

const POSITIVE_WEIGHT = 1.0;
const NEGATIVE_WEIGHT = 1.2; // Slightly higher weight for negative signals

// AI system prompt for sentiment analysis
const SENTIMENT_SYSTEM_PROMPT = `You are a crypto social media sentiment analyst. Analyze the provided texts from crypto communities (Twitter, Pump.fun, Telegram, etc.).

For each batch of texts, provide:
1. Overall sentiment score (-1.0 to 1.0, where -1 = extremely negative, 0 = neutral, 1 = extremely positive)
2. Category breakdown (hype, fud, genuine-interest, spam, shill) with percentages that sum to 100
3. A one-sentence summary of the overall sentiment
4. 2-5 key insights about what the community thinks

Context: Crypto communities use heavy slang. "rug" = scam, "moon" = price increase, "degen" = high-risk trader, "ape" = buy aggressively, "ngmi" = not gonna make it, "wagmi" = we're all gonna make it, "LFG" = positive excitement, "jeet" = someone who sells early.

You MUST respond with valid JSON only. No markdown, no code fences, no extra text.

Response format:
{
  "overallSentiment": 0.5,
  "categories": [
    {"category": "hype", "percentage": 40},
    {"category": "genuine-interest", "percentage": 30},
    {"category": "shill", "percentage": 15},
    {"category": "fud", "percentage": 10},
    {"category": "spam", "percentage": 5}
  ],
  "summary": "Community is mostly bullish with genuine interest in the project.",
  "keyInsights": [
    "Strong organic buying interest detected",
    "Some concerns about developer transparency"
  ]
}`;

// Crypto narratives to track
const NARRATIVE_KEYWORDS: Record<string, { keywords: string[]; category: string }> = {
  'AI agents': { keywords: ['ai agent', 'autonomous', 'ai16z', 'eliza', 'virtuals', 'sentient'], category: 'tech' },
  'political memes': { keywords: ['trump', 'biden', 'politics', 'maga', 'potus', 'election'], category: 'political' },
  'animal memes': { keywords: ['dog', 'cat', 'frog', 'pepe', 'doge', 'shiba', 'bonk', 'wif'], category: 'animal' },
  'DeFi 2.0': { keywords: ['defi', 'yield', 'lending', 'dex', 'amm', 'liquidity'], category: 'defi' },
  'RWA': { keywords: ['rwa', 'real world', 'tokenized', 'treasury', 'bond'], category: 'finance' },
  'gaming': { keywords: ['gaming', 'gamefi', 'play2earn', 'p2e', 'nft game', 'metaverse'], category: 'gaming' },
  'L2/scaling': { keywords: ['l2', 'layer 2', 'rollup', 'zk', 'optimistic', 'base', 'blast'], category: 'infra' },
  'social-fi': { keywords: ['socialfi', 'friend.tech', 'farcaster', 'lens', 'social'], category: 'social' },
  'meme coins': { keywords: ['memecoin', 'meme coin', 'pump.fun', 'pumpfun', 'degen', 'fair launch'], category: 'meme' },
  'stablecoins': { keywords: ['stablecoin', 'usdc', 'usdt', 'dai', 'depeg', 'peg'], category: 'finance' },
  'restaking': { keywords: ['restaking', 'eigenlayer', 'avs', 'lst', 'liquid staking'], category: 'defi' },
  'privacy': { keywords: ['privacy', 'zero knowledge', 'zk proof', 'anonymous', 'mixer'], category: 'privacy' },
};

// ─── Default Config ───────────────────────────────────────────

const DEFAULT_CONFIG: Omit<SentimentConfig, 'sources'> & { sources: SentimentConfig['sources'] } = {
  aiModel: 'meta-llama/llama-3.1-8b-instruct',
  cacheTtl: 300_000,
  maxRequestsPerMinute: 10,
  sources: {
    twitter: true,
    pumpfunComments: true,
    googleTrends: true,
    aiAnalysis: true,
  },
};

// ─── Helpers ──────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function labelFromScore(score: number): SentimentLabel {
  if (score >= 0.5) return 'very-positive';
  if (score >= 0.15) return 'positive';
  if (score > -0.15) return 'neutral';
  if (score > -0.5) return 'negative';
  return 'very-negative';
}

function extractTextFromPumpfunReply(reply: PumpfunReply): string {
  return reply.text ?? reply.body ?? reply.content ?? '';
}

function extractTimestampFromPumpfunReply(reply: PumpfunReply): number {
  if (reply.timestamp) return reply.timestamp;
  if (reply.created_timestamp) return reply.created_timestamp;
  if (reply.created_at) return new Date(reply.created_at).getTime();
  return Date.now();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── SentimentAnalyzer ────────────────────────────────────────

export class SentimentAnalyzer {
  private readonly config: SentimentConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;
  private readonly correlationId: string;

  // In-memory TTL cache
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  // Rate limiting: sliding window of request timestamps
  private readonly requestTimestamps: number[] = [];

  constructor(config: Partial<SentimentConfig> & Pick<SentimentConfig, 'sources'>, eventBus: SwarmEventBus) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      sources: { ...DEFAULT_CONFIG.sources, ...config.sources },
    };
    this.eventBus = eventBus;
    this.correlationId = uuidv4();
    this.logger = SwarmLogger.create('sentiment-analyzer', 'intelligence');

    this.logger.info('SentimentAnalyzer initialized', {
      aiModel: this.config.aiModel,
      sources: this.config.sources,
      cacheTtl: this.config.cacheTtl,
      maxRequestsPerMinute: this.config.maxRequestsPerMinute,
      hasTwitterToken: !!this.config.twitterBearerToken,
      hasOpenRouterKey: !!this.config.openRouterApiKey,
    });
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Analyze sentiment for a keyword/phrase across all enabled sources.
   */
  async analyzeSentiment(query: string): Promise<SentimentReport> {
    const cacheKey = `sentiment:${query}`;
    const cached = this.getFromCache<SentimentReport>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit for sentiment query', { query });
      return cached;
    }

    this.logger.info('Analyzing sentiment', { query });
    this.eventBus.emit(
      'sentiment:analyzing',
      'intelligence',
      'sentiment-analyzer',
      { query },
      this.correlationId,
    );

    const sources: SentimentReport['sources'] = {};
    const allTexts: string[] = [];

    // Parallel source fetching
    const [twitterResult, pumpfunResult, trendsResult] = await Promise.allSettled([
      this.config.sources.twitter ? this.fetchTwitterSentiment(query) : Promise.resolve(undefined),
      this.config.sources.pumpfunComments ? this.fetchPumpfunComments(query) : Promise.resolve(undefined),
      this.config.sources.googleTrends ? this.fetchGoogleTrends(query) : Promise.resolve(undefined),
    ]);

    if (twitterResult.status === 'fulfilled' && twitterResult.value) {
      sources.twitter = twitterResult.value;
      allTexts.push(...twitterResult.value.samplePosts.map((p) => p.text));
    } else if (twitterResult.status === 'rejected') {
      this.logger.warn('Twitter fetch failed', { error: String(twitterResult.reason) });
    }

    if (pumpfunResult.status === 'fulfilled' && pumpfunResult.value) {
      sources.pumpfun = pumpfunResult.value;
      allTexts.push(...pumpfunResult.value.samplePosts.map((p) => p.text));
    } else if (pumpfunResult.status === 'rejected') {
      this.logger.warn('Pump.fun fetch failed', { error: String(pumpfunResult.reason) });
    }

    if (trendsResult.status === 'fulfilled' && trendsResult.value) {
      sources.googleTrends = trendsResult.value;
    } else if (trendsResult.status === 'rejected') {
      this.logger.warn('Google Trends fetch failed', { error: String(trendsResult.reason) });
    }

    // Compute aggregate score from all sources
    const localScore = this.scoreSentiment(allTexts);
    const keywords = this.extractKeywords(allTexts);

    // Volume = total posts found
    const twitterCount = sources.twitter?.postCount ?? 0;
    const pumpfunCount = sources.pumpfun?.postCount ?? 0;
    const volume = twitterCount + pumpfunCount;

    // Weighted score: combine source scores
    let weightedScore = localScore.score;
    let totalWeight = 1.0; // local keyword score baseline

    if (sources.twitter) {
      weightedScore += sources.twitter.score * 1.5;
      totalWeight += 1.5;
    }
    if (sources.pumpfun) {
      weightedScore += sources.pumpfun.score * 1.2;
      totalWeight += 1.2;
    }

    const finalScore = clamp(weightedScore / totalWeight, -1, 1);

    // Confidence based on data volume: more data → higher confidence
    const confidence = clamp(Math.min(volume / 100, 1) * 0.7 + (allTexts.length > 0 ? 0.3 : 0), 0, 1);

    // Trending check
    const trending = (sources.googleTrends?.rising ?? false) ||
      (sources.googleTrends?.interestScore ?? 0) > 60 ||
      volume > 50;

    const report: SentimentReport = {
      query,
      score: Math.round(finalScore * 1000) / 1000,
      sentiment: labelFromScore(finalScore),
      confidence: Math.round(confidence * 100) / 100,
      volume,
      trending,
      sources,
      keywords,
      analyzedAt: Date.now(),
    };

    this.setCache(cacheKey, report);

    this.eventBus.emit(
      'sentiment:analyzed',
      'intelligence',
      'sentiment-analyzer',
      {
        query,
        score: report.score,
        sentiment: report.sentiment,
        confidence: report.confidence,
        volume: report.volume,
        trending: report.trending,
      },
      this.correlationId,
    );

    this.logger.info('Sentiment analysis complete', {
      query,
      score: report.score,
      sentiment: report.sentiment,
      volume: report.volume,
      trending: report.trending,
    });

    return report;
  }

  /**
   * Get sentiment for a specific token using mint, name, and ticker.
   */
  async getTokenSentiment(mint: string, name: string, ticker: string): Promise<TokenSentiment> {
    const cacheKey = `token-sentiment:${mint}`;
    const cached = this.getFromCache<TokenSentiment>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit for token sentiment', { mint });
      return cached;
    }

    this.logger.info('Getting token sentiment', { mint, name, ticker });
    this.eventBus.emit(
      'sentiment:token-analyzing',
      'intelligence',
      'sentiment-analyzer',
      { mint, name, ticker },
      this.correlationId,
    );

    // Fetch Pump.fun comments for this specific mint
    const commentsPromise = this.fetchPumpfunCommentsByMint(mint);

    // Search Twitter for the token name and ticker
    const twitterPromise = this.config.sources.twitter
      ? this.fetchTwitterSentiment(`${name} OR $${ticker} crypto`)
      : Promise.resolve(undefined);

    const [commentsResult, twitterResult] = await Promise.allSettled([
      commentsPromise,
      twitterPromise,
    ]);

    // Process Pump.fun comments
    let pumpfunComments: TokenSentiment['pumpfunComments'] = {
      count: 0,
      sentiment: 0,
      recentComments: [],
    };

    if (commentsResult.status === 'fulfilled' && commentsResult.value) {
      const replies = commentsResult.value;
      const texts = replies.map((r) => extractTextFromPumpfunReply(r));
      const localScore = this.scoreSentiment(texts);

      pumpfunComments = {
        count: replies.length,
        sentiment: localScore.score,
        recentComments: replies.slice(0, 20).map((r) => {
          const text = extractTextFromPumpfunReply(r);
          return {
            text,
            timestamp: extractTimestampFromPumpfunReply(r),
            sentiment: this.scoreSingleText(text),
          };
        }),
      };
    } else if (commentsResult.status === 'rejected') {
      this.logger.warn('Pump.fun comments fetch failed', { mint, error: String(commentsResult.reason) });
    }

    // Process Twitter mentions
    let twitterMentions: TokenSentiment['twitterMentions'] = {
      count: 0,
      sentiment: 0,
      engagement: 0,
    };

    if (twitterResult.status === 'fulfilled' && twitterResult.value) {
      const twitter = twitterResult.value;
      twitterMentions = {
        count: twitter.postCount,
        sentiment: twitter.score,
        engagement: twitter.samplePosts.reduce((sum, p) => sum + (p.engagement ?? 0), 0),
      };
    }

    // Compute derived metrics
    const allTexts = [
      ...pumpfunComments.recentComments.map((c) => c.text),
      ...(twitterResult.status === 'fulfilled' && twitterResult.value
        ? twitterResult.value.samplePosts.map((p) => p.text)
        : []),
    ];

    const overallScore = this.computeWeightedSentiment(
      pumpfunComments.sentiment,
      pumpfunComments.count,
      twitterMentions.sentiment,
      twitterMentions.count,
    );

    const communityHealth = this.computeCommunityHealth(allTexts, pumpfunComments.count, twitterMentions.count);
    const fudLevel = this.computeFudLevel(allTexts);
    const hypeMeter = this.computeHypeMeter(allTexts);

    const tokenSentiment: TokenSentiment = {
      mint,
      name,
      ticker,
      overallSentiment: Math.round(overallScore * 1000) / 1000,
      sentiment: labelFromScore(overallScore),
      pumpfunComments,
      twitterMentions,
      communityHealth: Math.round(communityHealth),
      fudLevel: Math.round(fudLevel),
      hypeMeter: Math.round(hypeMeter),
      analyzedAt: Date.now(),
    };

    this.setCache(cacheKey, tokenSentiment);

    this.eventBus.emit(
      'sentiment:token-analyzed',
      'intelligence',
      'sentiment-analyzer',
      {
        mint,
        name,
        ticker,
        overallSentiment: tokenSentiment.overallSentiment,
        sentiment: tokenSentiment.sentiment,
        communityHealth: tokenSentiment.communityHealth,
        fudLevel: tokenSentiment.fudLevel,
        hypeMeter: tokenSentiment.hypeMeter,
      },
      this.correlationId,
    );

    this.logger.info('Token sentiment complete', {
      mint,
      overallSentiment: tokenSentiment.overallSentiment,
      communityHealth: tokenSentiment.communityHealth,
    });

    return tokenSentiment;
  }

  /**
   * Identify trending narratives from Google Trends + keyword analysis.
   */
  async getTrendingNarratives(): Promise<TrendingNarrative[]> {
    const cacheKey = 'trending-narratives';
    const cached = this.getFromCache<TrendingNarrative[]>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit for trending narratives');
      return cached;
    }

    this.logger.info('Fetching trending narratives');

    // 1. Fetch Google Trends data
    let trendingTopics: string[] = [];
    try {
      const trendsData = await this.fetchGoogleTrendsDailyRaw();
      trendingTopics = trendsData;
    } catch (err) {
      this.logger.warn('Failed to fetch Google Trends for narrative detection', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 2. Match trends against known crypto narratives
    const narratives: TrendingNarrative[] = [];

    for (const [narrativeName, config] of Object.entries(NARRATIVE_KEYWORDS)) {
      // Check if any narrative keywords appear in trending topics
      const matchingTrends = trendingTopics.filter((topic) =>
        config.keywords.some((kw) => topic.toLowerCase().includes(kw.toLowerCase())),
      );

      // Search Twitter for narrative keywords (if enabled)
      let twitterVolume = 0;
      let twitterSentiment = 0;

      if (this.config.sources.twitter) {
        const searchQuery = config.keywords.slice(0, 3).join(' OR ') + ' crypto';
        try {
          const twitterData = await this.fetchTwitterSentiment(searchQuery);
          if (twitterData) {
            twitterVolume = twitterData.postCount;
            twitterSentiment = twitterData.score;
          }
        } catch {
          // Continue without Twitter data
        }
      }

      // Calculate momentum based on trend matches and volume
      const trendBoost = matchingTrends.length * 25;
      const volumeBoost = Math.min(twitterVolume / 2, 50);
      const momentum = clamp(trendBoost + volumeBoost, 0, 100);

      if (momentum > 10 || twitterVolume > 5) {
        const sentiment = twitterSentiment || 0;
        narratives.push({
          narrative: narrativeName,
          category: config.category,
          momentum,
          sentiment: Math.round(sentiment * 100) / 100,
          volume: twitterVolume + matchingTrends.length * 10,
          examples: config.keywords.slice(0, 3),
          peakEstimate: momentum > 70 ? 'peaking' : momentum > 30 ? 'rising' : 'fading',
        });
      }
    }

    // Sort by momentum descending
    narratives.sort((a, b) => b.momentum - a.momentum);

    this.setCache(cacheKey, narratives);

    this.eventBus.emit(
      'sentiment:trending-narratives',
      'intelligence',
      'sentiment-analyzer',
      {
        count: narratives.length,
        top: narratives.slice(0, 3).map((n) => ({ narrative: n.narrative, momentum: n.momentum })),
      },
      this.correlationId,
    );

    this.logger.info('Trending narratives detected', {
      count: narratives.length,
      top3: narratives.slice(0, 3).map((n) => n.narrative),
    });

    return narratives;
  }

  /**
   * Quick local keyword-based sentiment scoring (no API calls).
   */
  scoreSentiment(texts: string[]): SentimentScore {
    if (texts.length === 0) {
      return {
        score: 0,
        sentiment: 'neutral',
        count: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
      };
    }

    let totalScore = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    for (const text of texts) {
      const textScore = this.scoreSingleText(text);
      totalScore += textScore;

      if (textScore > 0.1) {
        positiveCount++;
      } else if (textScore < -0.1) {
        negativeCount++;
      } else {
        neutralCount++;
      }
    }

    const averageScore = totalScore / texts.length;
    const normalizedScore = clamp(averageScore, -1, 1);

    return {
      score: Math.round(normalizedScore * 1000) / 1000,
      sentiment: labelFromScore(normalizedScore),
      count: texts.length,
      positiveCount,
      negativeCount,
      neutralCount,
    };
  }

  /**
   * Batch analyze multiple queries in parallel.
   */
  async batchAnalyze(queries: string[]): Promise<Map<string, SentimentReport>> {
    this.logger.info('Batch analyzing sentiment', { queryCount: queries.length });

    const results = new Map<string, SentimentReport>();
    const uniqueQueries = [...new Set(queries)];

    // Process in chunks to respect rate limits
    const chunkSize = Math.max(1, Math.floor(this.config.maxRequestsPerMinute / 3));

    for (let i = 0; i < uniqueQueries.length; i += chunkSize) {
      const chunk = uniqueQueries.slice(i, i + chunkSize);
      const chunkResults = await Promise.allSettled(
        chunk.map((q) => this.analyzeSentiment(q)),
      );

      for (let j = 0; j < chunk.length; j++) {
        const result = chunkResults[j];
        if (result.status === 'fulfilled') {
          results.set(chunk[j], result.value);
        } else {
          this.logger.warn('Batch analysis failed for query', {
            query: chunk[j],
            error: String(result.reason),
          });
        }
      }

      // Rate limiting delay between chunks
      if (i + chunkSize < uniqueQueries.length) {
        await sleep(2_000);
      }
    }

    this.logger.info('Batch analysis complete', {
      requested: queries.length,
      succeeded: results.size,
    });

    return results;
  }

  /**
   * AI-powered deep sentiment analysis via OpenRouter LLM.
   */
  async getAISentiment(texts: string[]): Promise<AISentimentResult> {
    if (!this.config.openRouterApiKey) {
      this.logger.warn('No OpenRouter API key — falling back to keyword-based analysis');
      return this.fallbackAISentiment(texts);
    }

    if (texts.length === 0) {
      return {
        overallSentiment: 0,
        categories: [{ category: 'neutral', percentage: 100 }],
        summary: 'No texts provided for analysis.',
        keyInsights: [],
      };
    }

    this.logger.info('Running AI sentiment analysis', { textCount: texts.length });

    // Batch texts, max 50 per call
    const batched = texts.slice(0, MAX_AI_BATCH_SIZE);
    const numberedTexts = batched
      .map((t, i) => `${i + 1}. "${t.slice(0, 300)}"`)
      .join('\n');

    const userPrompt = `Analyze the sentiment of these ${batched.length} texts from crypto social media:

${numberedTexts}

Provide your analysis as JSON with overallSentiment (-1.0 to 1.0), categories with percentages, summary, and keyInsights.`;

    await this.enforceRateLimit();

    const response = await this.callOpenRouter(
      SENTIMENT_SYSTEM_PROMPT,
      userPrompt,
      0.2, // Low temperature for analytical accuracy
    );

    const parsed = this.parseJsonResponse<AISentimentResult>(response);

    const result: AISentimentResult = {
      overallSentiment: clamp(parsed.overallSentiment ?? 0, -1, 1),
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.map((c) => ({
          category: String(c.category ?? 'unknown'),
          percentage: clamp(Number(c.percentage ?? 0), 0, 100),
        }))
        : [{ category: 'neutral', percentage: 100 }],
      summary: String(parsed.summary ?? 'Analysis completed.'),
      keyInsights: Array.isArray(parsed.keyInsights)
        ? parsed.keyInsights.map(String)
        : [],
    };

    this.eventBus.emit(
      'sentiment:ai-analyzed',
      'intelligence',
      'sentiment-analyzer',
      {
        textCount: texts.length,
        overallSentiment: result.overallSentiment,
        topCategory: result.categories[0]?.category,
      },
      this.correlationId,
    );

    this.logger.info('AI sentiment analysis complete', {
      overallSentiment: result.overallSentiment,
      summary: result.summary,
    });

    return result;
  }

  // ─── Twitter/X Integration ──────────────────────────────────

  private async fetchTwitterSentiment(query: string): Promise<SourceSentiment | undefined> {
    const cacheKey = `twitter:${query}`;
    const cached = this.getFromCache<SourceSentiment>(cacheKey);
    if (cached) return cached;

    await this.enforceRateLimit();

    let tweets: TwitterTweet[] = [];

    if (this.config.twitterBearerToken) {
      tweets = await this.searchTwitterV2(query);
    } else {
      this.logger.debug('No Twitter bearer token — skipping Twitter source', { query });
      return undefined;
    }

    if (tweets.length === 0) return undefined;

    const texts = tweets.map((t) => t.text);
    const scores = texts.map((t) => this.scoreSingleText(t));

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    for (const s of scores) {
      if (s > 0.1) positiveCount++;
      else if (s < -0.1) negativeCount++;
      else neutralCount++;
    }

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const samplePosts = tweets.slice(0, 10).map((t, i) => ({
      text: t.text,
      sentiment: scores[i],
      engagement: t.public_metrics
        ? t.public_metrics.like_count + t.public_metrics.retweet_count +
          t.public_metrics.reply_count + t.public_metrics.quote_count
        : 0,
    }));

    const result: SourceSentiment = {
      score: Math.round(clamp(avgScore, -1, 1) * 1000) / 1000,
      postCount: tweets.length,
      positiveCount,
      negativeCount,
      neutralCount,
      samplePosts,
    };

    this.setCache(cacheKey, result);
    return result;
  }

  private async searchTwitterV2(query: string): Promise<TwitterTweet[]> {
    const url = new URL(`${TWITTER_API_BASE}/tweets/search/recent`);
    url.searchParams.set('query', `${query} crypto`);
    url.searchParams.set('max_results', '100');
    url.searchParams.set('tweet.fields', 'created_at,public_metrics');

    const response = await this.fetchWithRetry(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.config.twitterBearerToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Twitter API v2 error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json() as {
      data?: TwitterTweet[];
      meta?: { result_count: number };
    };

    return data.data ?? [];
  }

  // ─── Pump.fun Integration ──────────────────────────────────

  private async fetchPumpfunComments(query: string): Promise<SourceSentiment | undefined> {
    // Pump.fun comments require a mint address; for general queries we skip
    // unless the query looks like a mint address (base58, 32-44 chars)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query)) {
      return this.fetchPumpfunCommentsBySentiment(query);
    }
    return undefined;
  }

  private async fetchPumpfunCommentsBySentiment(mint: string): Promise<SourceSentiment | undefined> {
    const replies = await this.fetchPumpfunCommentsByMint(mint);
    if (replies.length === 0) return undefined;

    const texts = replies.map((r) => extractTextFromPumpfunReply(r));
    const scores = texts.map((t) => this.scoreSingleText(t));

    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    for (const s of scores) {
      if (s > 0.1) positiveCount++;
      else if (s < -0.1) negativeCount++;
      else neutralCount++;
    }

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const samplePosts = replies.slice(0, 10).map((r, i) => ({
      text: extractTextFromPumpfunReply(r),
      sentiment: scores[i],
    }));

    return {
      score: Math.round(clamp(avgScore, -1, 1) * 1000) / 1000,
      postCount: replies.length,
      positiveCount,
      negativeCount,
      neutralCount,
      samplePosts,
    };
  }

  private async fetchPumpfunCommentsByMint(mint: string): Promise<PumpfunReply[]> {
    const cacheKey = `pumpfun-replies:${mint}`;
    const cached = this.getFromCache<PumpfunReply[]>(cacheKey);
    if (cached) return cached;

    await this.enforceRateLimit();

    const url = `${PUMPFUN_API_BASE}/replies/${mint}?limit=100&offset=0`;

    try {
      const response = await this.fetchWithRetry(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn('Pump.fun API error', { status: response.status, mint });
        return [];
      }

      const data = await response.json() as PumpfunReply[];
      const replies = Array.isArray(data) ? data : [];

      this.setCache(cacheKey, replies);
      return replies;
    } catch (err) {
      this.logger.warn('Pump.fun fetch error', {
        mint,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  // ─── Google Trends Integration ─────────────────────────────

  private async fetchGoogleTrends(query: string): Promise<TrendsData | undefined> {
    const cacheKey = `trends:${query}`;
    const cached = this.getFromCache<TrendsData>(cacheKey);
    if (cached) return cached;

    try {
      const trendingTopics = await this.fetchGoogleTrendsDailyRaw();

      // Check if query matches any trending topics
      const queryLower = query.toLowerCase();
      const matchingTopics = trendingTopics.filter((t) =>
        t.toLowerCase().includes(queryLower) || queryLower.includes(t.toLowerCase()),
      );

      const isRising = matchingTopics.length > 0;
      const interestScore = isRising
        ? Math.min(matchingTopics.length * 30 + 20, 100)
        : 0;

      // Extract related queries from matching topics
      const relatedQueries = trendingTopics
        .filter((t) => {
          const tLower = t.toLowerCase();
          return tLower.includes(queryLower) ||
            queryLower.split(' ').some((word) => tLower.includes(word));
        })
        .slice(0, 10);

      const result: TrendsData = {
        interestScore,
        relatedQueries,
        rising: isRising,
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (err) {
      this.logger.warn('Google Trends fetch error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    }
  }

  private async fetchGoogleTrendsDailyRaw(): Promise<string[]> {
    const cacheKey = 'google-trends-daily-raw';
    const cached = this.getFromCache<string[]>(cacheKey);
    if (cached) return cached;

    await this.enforceRateLimit();

    const url = `${GOOGLE_TRENDS_DAILY}?hl=en-US&tz=-480&geo=US&ns=15`;

    const response = await this.fetchWithRetry(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; CryptoVision/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Trends API error: ${response.status}`);
    }

    let text = await response.text();

    // Google Trends prepends ")]}'" to the JSON response
    if (text.startsWith(')]}\'\n')) {
      text = text.slice(5);
    } else if (text.startsWith(')]}\'\r\n')) {
      text = text.slice(6);
    } else if (text.startsWith(')]}\'')) {
      text = text.slice(4);
    }

    const data = JSON.parse(text) as {
      default?: {
        trendingSearchesDays?: Array<{
          trendingSearches?: Array<{
            title?: { query?: string };
            relatedQueries?: Array<{ query?: string }>;
          }>;
        }>;
      };
    };

    const topics: string[] = [];
    const days = data.default?.trendingSearchesDays ?? [];

    for (const day of days) {
      const searches = day.trendingSearches ?? [];
      for (const search of searches) {
        if (search.title?.query) {
          topics.push(search.title.query);
        }
        const related = search.relatedQueries ?? [];
        for (const rq of related) {
          if (rq.query) {
            topics.push(rq.query);
          }
        }
      }
    }

    this.setCache(cacheKey, topics);
    return topics;
  }

  // ─── OpenRouter AI (with Groq Fallback) ─────────────────────

  private async callOpenRouter(
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
  ): Promise<string> {
    if (!this.config.openRouterApiKey && !this.config.groqApiKey) {
      throw new Error('OpenRouter or Groq API key is required for AI sentiment analysis');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // Try OpenRouter first
    if (this.config.openRouterApiKey) {
      try {
        return await this.callLLMProvider(
          `${OPENROUTER_API_BASE}/chat/completions`,
          this.config.openRouterApiKey,
          this.config.aiModel,
          messages,
          temperature,
          { 'HTTP-Referer': 'https://crypto-vision.dev', 'X-Title': 'CryptoVision Sentiment Analyzer' },
        );
      } catch (err) {
        this.logger.warn('OpenRouter call failed, attempting Groq fallback', {
          error: err instanceof Error ? err.message : String(err),
        });
        if (!this.config.groqApiKey) throw err;
      }
    }

    // Groq fallback
    return this.callLLMProvider(
      GROQ_API_BASE,
      this.config.groqApiKey!,
      GROQ_FALLBACK_MODEL,
      messages,
      temperature,
      {},
    );
  }

  /** Generic LLM provider call (OpenRouter or Groq) */
  private async callLLMProvider(
    url: string,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    extraHeaders: Record<string, string>,
  ): Promise<string> {
    const body = {
      model,
      messages,
      temperature,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    };

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify(body),
      },
      LLM_TIMEOUT_MS,
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errBody.slice(0, 300)}`);
    }

    const result = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM provider returned empty response');
    }

    return content;
  }

  // ─── Keyword Scoring ───────────────────────────────────────

  /**
   * Score a single text using keyword-based sentiment.
   * Returns a value between -1 and 1.
   */
  private scoreSingleText(text: string): number {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    if (words.length === 0) return 0;

    let positiveHits = 0;
    let negativeHits = 0;

    for (const word of words) {
      if (POSITIVE_KEYWORDS.has(word)) positiveHits++;
      if (NEGATIVE_KEYWORDS.has(word)) negativeHits++;
    }

    if (positiveHits === 0 && negativeHits === 0) return 0;

    const rawScore =
      (positiveHits * POSITIVE_WEIGHT - negativeHits * NEGATIVE_WEIGHT) /
      Math.sqrt(words.length); // Normalize by sqrt to not penalize longer texts too much

    return clamp(rawScore / 2, -1, 1); // Divide by 2 to keep scores moderate
  }

  private extractKeywords(texts: string[]): Array<{ word: string; count: number; sentiment: number }> {
    const wordCounts = new Map<string, { count: number; totalSentiment: number }>();

    for (const text of texts) {
      const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      for (const word of words) {
        const isPositive = POSITIVE_KEYWORDS.has(word);
        const isNegative = NEGATIVE_KEYWORDS.has(word);

        if (isPositive || isNegative) {
          const existing = wordCounts.get(word) ?? { count: 0, totalSentiment: 0 };
          existing.count++;
          existing.totalSentiment += isPositive ? 1 : -1;
          wordCounts.set(word, existing);
        }
      }
    }

    return [...wordCounts.entries()]
      .map(([word, data]) => ({
        word,
        count: data.count,
        sentiment: Math.round((data.totalSentiment / data.count) * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  // ─── Derived Metrics ───────────────────────────────────────

  private computeWeightedSentiment(
    pumpfunScore: number,
    pumpfunCount: number,
    twitterScore: number,
    twitterCount: number,
  ): number {
    const totalCount = pumpfunCount + twitterCount;
    if (totalCount === 0) return 0;

    // Weight by volume — more data = more influence
    const pumpfunWeight = pumpfunCount / totalCount;
    const twitterWeight = twitterCount / totalCount;

    return clamp(
      pumpfunScore * pumpfunWeight + twitterScore * twitterWeight,
      -1,
      1,
    );
  }

  private computeCommunityHealth(texts: string[], pumpfunCount: number, twitterCount: number): number {
    if (texts.length === 0) return 0;

    let health = 30; // Base score

    // Volume bonus (more activity = healthier, up to a point)
    const totalCount = pumpfunCount + twitterCount;
    health += Math.min(totalCount * 0.5, 25);

    // Diversity bonus: multiple sources
    if (pumpfunCount > 0 && twitterCount > 0) health += 10;

    // Content quality: longer, more substantive posts
    const avgLength = texts.reduce((sum, t) => sum + t.length, 0) / texts.length;
    if (avgLength > 50) health += 10;
    if (avgLength > 100) health += 5;

    // Negative penalty: high FUD ratio decreases health
    const score = this.scoreSentiment(texts);
    if (score.negativeCount > score.positiveCount) {
      health -= 15;
    }

    // Spam penalty: too many very short messages
    const shortMessages = texts.filter((t) => t.length < 10).length;
    const spamRatio = shortMessages / texts.length;
    if (spamRatio > 0.5) health -= 15;

    return clamp(health, 0, 100);
  }

  private computeFudLevel(texts: string[]): number {
    if (texts.length === 0) return 0;

    let fudCount = 0;
    const fudTerms = ['rug', 'scam', 'dump', 'dead', 'rugpull', 'honeypot', 'avoid',
      'warning', 'danger', 'fraud', 'fake', 'ponzi', 'beware', 'sell', 'exit'];

    for (const text of texts) {
      const lower = text.toLowerCase();
      if (fudTerms.some((term) => lower.includes(term))) {
        fudCount++;
      }
    }

    const fudRatio = fudCount / texts.length;
    return clamp(fudRatio * 100, 0, 100);
  }

  private computeHypeMeter(texts: string[]): number {
    if (texts.length === 0) return 0;

    let hypeCount = 0;
    const hypeTerms = ['moon', 'pump', '100x', 'lfg', 'gem', 'based', 'alpha',
      'rocket', 'lambo', 'parabolic', 'insane', 'massive', 'banger', 'fire',
      'wagmi', 'send', 'mooning', 'pumping', 'early'];

    for (const text of texts) {
      const lower = text.toLowerCase();
      if (hypeTerms.some((term) => lower.includes(term))) {
        hypeCount++;
      }
    }

    const hypeRatio = hypeCount / texts.length;
    return clamp(hypeRatio * 100, 0, 100);
  }

  // ─── Fallback AI Sentiment ─────────────────────────────────

  private fallbackAISentiment(texts: string[]): AISentimentResult {
    const score = this.scoreSentiment(texts);
    const fudLevel = this.computeFudLevel(texts);
    const hypeMeter = this.computeHypeMeter(texts);

    const categories: AISentimentResult['categories'] = [];

    if (hypeMeter > 30) categories.push({ category: 'hype', percentage: Math.round(hypeMeter * 0.6) });
    if (fudLevel > 30) categories.push({ category: 'fud', percentage: Math.round(fudLevel * 0.6) });

    const assignedPct = categories.reduce((sum, c) => sum + c.percentage, 0);
    if (score.positiveCount > score.negativeCount) {
      categories.push({ category: 'genuine-interest', percentage: Math.round((100 - assignedPct) * 0.6) });
    }

    const remaining = 100 - categories.reduce((sum, c) => sum + c.percentage, 0);
    if (remaining > 0) {
      categories.push({ category: 'neutral', percentage: remaining });
    }

    return {
      overallSentiment: score.score,
      categories,
      summary: `Keyword-based analysis (no AI): sentiment is ${score.sentiment} with ${texts.length} texts analyzed.`,
      keyInsights: [
        `${score.positiveCount} positive, ${score.negativeCount} negative, ${score.neutralCount} neutral texts`,
        `FUD level: ${Math.round(fudLevel)}%, Hype meter: ${Math.round(hypeMeter)}%`,
      ],
    };
  }

  // ─── Cache ─────────────────────────────────────────────────

  private getFromCache<T>(key: string): T | undefined {
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

  // ─── Rate Limiting ─────────────────────────────────────────

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60_000;

    // Remove timestamps outside the window
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < windowStart) {
      this.requestTimestamps.shift();
    }

    if (this.requestTimestamps.length >= this.config.maxRequestsPerMinute) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitMs = oldestInWindow + 60_000 - now + 100;
      this.logger.debug('Rate limit reached, waiting', { waitMs });
      await sleep(waitMs);
    }

    this.requestTimestamps.push(Date.now());
  }

  // ─── HTTP Helpers ──────────────────────────────────────────

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetchWithTimeout(url, init, HTTP_TIMEOUT_MS);

        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return response;
        }

        // Retry server errors (5xx)
        if (response.status >= 500) {
          lastError = new Error(`Server error: ${response.status}`);
          if (attempt < MAX_RETRIES - 1) {
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
            this.logger.debug('Retrying after server error', {
              url,
              status: response.status,
              attempt: attempt + 1,
              delay,
            });
            await sleep(delay);
            continue;
          }
          return response;
        }

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          this.logger.debug('Retrying after fetch error', {
            url,
            error: lastError.message,
            attempt: attempt + 1,
            delay,
          });
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
  }

  // ─── JSON Parsing ──────────────────────────────────────────

  private parseJsonResponse<T>(raw: string): T {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error(`Failed to parse JSON from LLM response: ${cleaned.slice(0, 200)}`);
    }
  }
}
