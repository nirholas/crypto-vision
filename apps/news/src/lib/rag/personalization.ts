/**
 * Personalization System — Phase 4.3
 *
 * Per-user preference management, interest inference, personalised
 * ranking boosts, response-style adaptation, source weighting, and
 * privacy controls.
 *
 * All user data is stored in-memory (swap for DB in production).
 * The system is designed to be privacy-first: user data can be
 * exported and fully wiped via the API.
 *
 * @module lib/rag/personalization
 */

import type { ScoredDocument } from './types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type ReadingLevel = 'beginner' | 'intermediate' | 'expert';
export type ResponseStyle = 'concise' | 'detailed' | 'technical' | 'casual';

export interface UserPreferences {
  /** Explicit topic interests, e.g. ["DeFi", "Regulation", "Bitcoin"] */
  interests: string[];
  /** Preferred news sources, e.g. ["CoinDesk", "The Block"] */
  sources: string[];
  /** Preferred response depth */
  readingLevel: ReadingLevel;
  /** Preferred answer style */
  responseStyle: ResponseStyle;
  /** Languages the user speaks (ISO 639-1) */
  languages: string[];
  /** Categories to de-prioritise (e.g. ["NFT"]) */
  mutedTopics: string[];
}

export interface UserProfile {
  userId: string;
  preferences: UserPreferences;
  /** Topics inferred from interaction history */
  inferredInterests: InferredInterest[];
  /** Query history (last N queries — for inference) */
  queryHistory: QueryHistoryEntry[];
  /** When the profile was created */
  createdAt: string;
  /** Last activity */
  lastActiveAt: string;
  /** Privacy: if true, no query history is stored */
  privacyMode: boolean;
}

export interface InferredInterest {
  topic: string;
  weight: number;   // 0-1
  sourceCount: number; // how many queries contributed
  lastSeen: string;
}

export interface QueryHistoryEntry {
  query: string;
  timestamp: string;
  /** Topics extracted from query */
  topics: string[];
}

export interface PersonalizationBoost {
  /** Score multiplier for documents matching interests (1.0 = no change) */
  interestBoost: number;
  /** Score multiplier for preferred sources */
  sourceBoost: number;
  /** Penalty multiplier for muted topics (< 1.0) */
  mutedPenalty: number;
}

export interface PersonalizedRankingResult {
  documents: ScoredDocument[];
  boostsApplied: {
    interestBoosted: number;
    sourceBoosted: number;
    mutedPenalized: number;
  };
}

export interface PersonalizationConfig {
  /** Max query history entries per user */
  maxHistorySize: number;
  /** Max inferred interests per user */
  maxInferredInterests: number;
  /** Interest inference decay — weight reduction per day since last seen */
  interestDecayPerDay: number;
  /** Minimum weight for an inferred interest to be kept */
  minInterestWeight: number;
  /** Default interest boost multiplier */
  defaultInterestBoost: number;
  /** Default source boost multiplier */
  defaultSourceBoost: number;
  /** Default muted topic penalty */
  defaultMutedPenalty: number;
}

const DEFAULT_CONFIG: PersonalizationConfig = {
  maxHistorySize: 200,
  maxInferredInterests: 50,
  interestDecayPerDay: 0.02,
  minInterestWeight: 0.1,
  defaultInterestBoost: 1.3,
  defaultSourceBoost: 1.2,
  defaultMutedPenalty: 0.5,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  interests: [],
  sources: [],
  readingLevel: 'intermediate',
  responseStyle: 'detailed',
  languages: ['en'],
  mutedTopics: [],
};

// ═══════════════════════════════════════════════════════════════
// PERSONALIZATION ENGINE
// ═══════════════════════════════════════════════════════════════

export class PersonalizationEngine {
  private profiles = new Map<string, UserProfile>();
  private readonly config: PersonalizationConfig;

  constructor(config?: Partial<PersonalizationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── Profile Management ────────────────────────────────────

  getOrCreateProfile(userId: string): UserProfile {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        preferences: { ...DEFAULT_PREFERENCES },
        inferredInterests: [],
        queryHistory: [],
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        privacyMode: false,
      };
      this.profiles.set(userId, profile);
    }
    return profile;
  }

  getProfile(userId: string): UserProfile | undefined {
    return this.profiles.get(userId);
  }

  /** Update explicit preferences. Merges with existing. */
  updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): UserProfile {
    const profile = this.getOrCreateProfile(userId);
    profile.preferences = { ...profile.preferences, ...updates };
    profile.lastActiveAt = new Date().toISOString();
    return profile;
  }

  /** Toggle privacy mode — when enabled, clears and stops storing query history */
  setPrivacyMode(userId: string, enabled: boolean): void {
    const profile = this.getOrCreateProfile(userId);
    profile.privacyMode = enabled;
    if (enabled) {
      profile.queryHistory = [];
    }
  }

  /** Full data export for GDPR-style portability */
  exportUserData(userId: string): UserProfile | null {
    return this.profiles.get(userId) ?? null;
  }

  /** Delete all user data (right to erasure) */
  deleteUser(userId: string): boolean {
    return this.profiles.delete(userId);
  }

  // ─── Query Tracking & Interest Inference ───────────────────

  /**
   * Record a user query and infer interests from it.
   * Extracts topics using simple keyword matching.
   */
  recordQuery(userId: string, query: string): void {
    const profile = this.getOrCreateProfile(userId);
    profile.lastActiveAt = new Date().toISOString();

    // Extract topics from query
    const topics = extractTopics(query);

    // Store in history (unless privacy mode)
    if (!profile.privacyMode) {
      profile.queryHistory.push({
        query: query.slice(0, 500),
        timestamp: new Date().toISOString(),
        topics,
      });

      // Trim history
      if (profile.queryHistory.length > this.config.maxHistorySize) {
        profile.queryHistory.splice(
          0,
          profile.queryHistory.length - this.config.maxHistorySize
        );
      }
    }

    // Update inferred interests
    for (const topic of topics) {
      this.updateInferredInterest(profile, topic);
    }

    // Decay and prune old interests
    this.decayInterests(profile);
  }

  private updateInferredInterest(profile: UserProfile, topic: string): void {
    const existing = profile.inferredInterests.find(
      (i) => i.topic.toLowerCase() === topic.toLowerCase()
    );
    if (existing) {
      existing.weight = Math.min(1, existing.weight + 0.1);
      existing.sourceCount += 1;
      existing.lastSeen = new Date().toISOString();
    } else {
      profile.inferredInterests.push({
        topic,
        weight: 0.3,
        sourceCount: 1,
        lastSeen: new Date().toISOString(),
      });
    }

    // Cap interests
    if (profile.inferredInterests.length > this.config.maxInferredInterests) {
      profile.inferredInterests
        .sort((a, b) => b.weight - a.weight)
        .splice(this.config.maxInferredInterests);
    }
  }

  private decayInterests(profile: UserProfile): void {
    const now = Date.now();
    profile.inferredInterests = profile.inferredInterests
      .map((i) => {
        const daysSince = (now - new Date(i.lastSeen).getTime()) / (24 * 60 * 60 * 1000);
        const decay = daysSince * this.config.interestDecayPerDay;
        return { ...i, weight: Math.max(0, i.weight - decay) };
      })
      .filter((i) => i.weight >= this.config.minInterestWeight);
  }

  // ─── Personalised Ranking ──────────────────────────────────

  /**
   * Re-rank documents using user preferences and inferred interests.
   * Does NOT mutate the input array.
   */
  personaliseRanking(
    userId: string,
    documents: ScoredDocument[],
    boost?: Partial<PersonalizationBoost>
  ): PersonalizedRankingResult {
    const profile = this.profiles.get(userId);
    if (!profile) {
      return {
        documents: [...documents],
        boostsApplied: { interestBoosted: 0, sourceBoosted: 0, mutedPenalized: 0 },
      };
    }

    const interestBoost = boost?.interestBoost ?? this.config.defaultInterestBoost;
    const sourceBoost = boost?.sourceBoost ?? this.config.defaultSourceBoost;
    const mutedPenalty = boost?.mutedPenalty ?? this.config.defaultMutedPenalty;

    // Combine explicit + inferred interests
    const allInterests = new Set([
      ...profile.preferences.interests.map((i) => i.toLowerCase()),
      ...profile.inferredInterests
        .filter((i) => i.weight >= 0.3)
        .map((i) => i.topic.toLowerCase()),
    ]);

    const preferredSources = new Set(
      profile.preferences.sources.map((s) => s.toLowerCase())
    );
    const mutedTopics = new Set(
      profile.preferences.mutedTopics.map((t) => t.toLowerCase())
    );

    let interestBoosted = 0;
    let sourceBoosted = 0;
    let mutedPenalized = 0;

    const ranked = documents.map((doc) => {
      let newScore = doc.score;
      const contentLower = `${doc.title} ${doc.content}`.toLowerCase();

      // Interest boost
      for (const interest of allInterests) {
        if (contentLower.includes(interest)) {
          newScore *= interestBoost;
          interestBoosted++;
          break; // Only apply once per doc
        }
      }

      // Source boost
      if (preferredSources.has(doc.source.toLowerCase())) {
        newScore *= sourceBoost;
        sourceBoosted++;
      }

      // Muted penalty
      for (const muted of mutedTopics) {
        if (contentLower.includes(muted)) {
          newScore *= mutedPenalty;
          mutedPenalized++;
          break;
        }
      }

      return { ...doc, score: newScore };
    });

    // Re-sort by new score
    ranked.sort((a, b) => b.score - a.score);

    return {
      documents: ranked,
      boostsApplied: { interestBoosted, sourceBoosted, mutedPenalized },
    };
  }

  // ─── Response Style Adaptation ─────────────────────────────

  /**
   * Build a system prompt modifier based on user preferences.
   */
  getSystemPromptModifier(userId: string): string {
    const profile = this.profiles.get(userId);
    if (!profile) return '';

    const parts: string[] = [];

    // Reading level
    switch (profile.preferences.readingLevel) {
      case 'beginner':
        parts.push('Explain concepts simply, avoid jargon, use analogies.');
        break;
      case 'expert':
        parts.push('Use technical language, assume deep crypto knowledge, be concise.');
        break;
      default:
        parts.push('Balance clarity with technical accuracy.');
    }

    // Response style
    switch (profile.preferences.responseStyle) {
      case 'concise':
        parts.push('Keep answers brief and to the point. Bullet points when possible.');
        break;
      case 'technical':
        parts.push('Include technical details, metrics, and data points.');
        break;
      case 'casual':
        parts.push('Use a conversational, friendly tone.');
        break;
      default:
        parts.push('Provide thorough analysis with examples.');
    }

    // Interests context
    const interests = [
      ...profile.preferences.interests,
      ...profile.inferredInterests.filter((i) => i.weight >= 0.5).map((i) => i.topic),
    ];
    if (interests.length > 0) {
      parts.push(`The user is interested in: ${interests.slice(0, 10).join(', ')}.`);
    }

    return parts.join(' ');
  }

  /**
   * Build source preference weights for the retrieval step.
   * Returns a map of source → weight multiplier.
   */
  getSourceWeights(userId: string): Map<string, number> {
    const profile = this.profiles.get(userId);
    const weights = new Map<string, number>();
    if (!profile) return weights;

    for (const source of profile.preferences.sources) {
      weights.set(source.toLowerCase(), this.config.defaultSourceBoost);
    }
    return weights;
  }

  // ─── Stats ─────────────────────────────────────────────────

  get totalUsers(): number {
    return this.profiles.size;
  }

  getUserStats(userId: string): {
    preferences: UserPreferences;
    inferredInterests: InferredInterest[];
    queryCount: number;
    memberSince: string;
    lastActive: string;
    privacyMode: boolean;
  } | null {
    const profile = this.profiles.get(userId);
    if (!profile) return null;
    return {
      preferences: profile.preferences,
      inferredInterests: profile.inferredInterests,
      queryCount: profile.queryHistory.length,
      memberSince: profile.createdAt,
      lastActive: profile.lastActiveAt,
      privacyMode: profile.privacyMode,
    };
  }

  // ─── Reset (for testing) ───────────────────────────────────

  reset(): void {
    this.profiles.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
// TOPIC EXTRACTION (lightweight, no LLM needed)
// ═══════════════════════════════════════════════════════════════

const CRYPTO_TOPICS: string[] = [
  // Coins / Ecosystems
  'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'cardano', 'ada',
  'polkadot', 'dot', 'avalanche', 'avax', 'polygon', 'matic', 'chainlink',
  'link', 'ripple', 'xrp', 'dogecoin', 'doge', 'litecoin', 'ltc',
  'binance', 'bnb', 'tron', 'trx', 'cosmos', 'atom', 'near',
  'arbitrum', 'optimism', 'base', 'sui', 'aptos', 'ton', 'toncoin',

  // Categories
  'defi', 'nft', 'metaverse', 'gaming', 'web3', 'dao', 'stablecoin',
  'layer 2', 'layer2', 'l2', 'bridge', 'dex', 'cex', 'amm',
  'yield farming', 'staking', 'lending', 'borrowing', 'derivatives',

  // Broader themes
  'regulation', 'sec', 'cftc', 'etf', 'institutional', 'adoption',
  'security', 'hack', 'exploit', 'rug pull', 'scam',
  'mining', 'proof of stake', 'proof of work', 'consensus',
  'cbdc', 'privacy', 'zk', 'zero knowledge', 'rollup',
  'ai', 'artificial intelligence', 'rwa', 'tokenization',
  'airdrop', 'ico', 'ido', 'launchpad',
];

/**
 * Extract crypto-related topics from a query string.
 * Simple keyword matching — fast and deterministic.
 */
function extractTopics(query: string): string[] {
  const lower = query.toLowerCase();
  const found: string[] = [];

  for (const topic of CRYPTO_TOPICS) {
    // Word boundary match using regex
    const regex = new RegExp(`\\b${escapeRegex(topic)}\\b`, 'i');
    if (regex.test(lower)) {
      // Normalise to canonical form
      found.push(canonicalise(topic));
    }
  }

  return [...new Set(found)];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Map common aliases to canonical names */
function canonicalise(topic: string): string {
  const aliases: Record<string, string> = {
    btc: 'Bitcoin',
    bitcoin: 'Bitcoin',
    eth: 'Ethereum',
    ethereum: 'Ethereum',
    sol: 'Solana',
    solana: 'Solana',
    ada: 'Cardano',
    cardano: 'Cardano',
    dot: 'Polkadot',
    polkadot: 'Polkadot',
    avax: 'Avalanche',
    avalanche: 'Avalanche',
    matic: 'Polygon',
    polygon: 'Polygon',
    link: 'Chainlink',
    chainlink: 'Chainlink',
    xrp: 'XRP',
    ripple: 'XRP',
    doge: 'Dogecoin',
    dogecoin: 'Dogecoin',
    ltc: 'Litecoin',
    litecoin: 'Litecoin',
    bnb: 'BNB',
    binance: 'BNB',
    trx: 'TRON',
    tron: 'TRON',
    atom: 'Cosmos',
    cosmos: 'Cosmos',
    ton: 'TON',
    toncoin: 'TON',
    defi: 'DeFi',
    nft: 'NFT',
    'layer 2': 'Layer 2',
    layer2: 'Layer 2',
    l2: 'Layer 2',
    sec: 'SEC',
    cftc: 'CFTC',
    etf: 'ETF',
    cbdc: 'CBDC',
    zk: 'Zero Knowledge',
    'zero knowledge': 'Zero Knowledge',
    ai: 'AI',
    'artificial intelligence': 'AI',
    rwa: 'RWA',
    ico: 'ICO',
    ido: 'IDO',
  };
  return aliases[topic.toLowerCase()] || topic;
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

let _engine: PersonalizationEngine | null = null;

export function getPersonalizationEngine(
  config?: Partial<PersonalizationConfig>
): PersonalizationEngine {
  if (!_engine) {
    _engine = new PersonalizationEngine(config);
  }
  return _engine;
}
