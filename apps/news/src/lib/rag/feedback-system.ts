/**
 * Enhanced Feedback Loop System — Phase 4.1
 *
 * Comprehensive feedback collection, analysis, and quality-alert system
 * for the RAG pipeline. Extends the basic feedback route with:
 * - Structured feedback storage with rich metadata
 * - Rating analytics (satisfaction trends, category breakdown)
 * - Training-data export for fine-tuning
 * - Quality alerts when satisfaction drops
 * - A/B test integration (link feedback to experiment variants)
 *
 * @module lib/rag/feedback-system
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type FeedbackRating = 'positive' | 'negative';
export type FeedbackCategory = 'accuracy' | 'relevance' | 'completeness' | 'timeliness' | 'other';

export interface FeedbackEntry {
  id: string;
  queryId: string;
  query: string;
  answer: string;
  rating: FeedbackRating;
  category?: FeedbackCategory;
  comment?: string;
  /** Sources delivered with the answer */
  sources?: string[];
  /** Confidence score of the original answer */
  confidence?: number;
  /** A/B experiment variant ID (if any) */
  experimentVariantId?: string;
  /** User / session identifier (anonymised) */
  userId?: string;
  ip: string;
  timestamp: string;
}

export interface FeedbackAnalytics {
  totalFeedback: number;
  positiveCount: number;
  negativeCount: number;
  satisfactionRate: number;
  /** Rolling satisfaction over recent window */
  recentSatisfaction: number;
  categoryBreakdown: Record<FeedbackCategory, { positive: number; negative: number }>;
  /** Per-day satisfaction for trend charting */
  dailyTrend: DailySatisfaction[];
  /** Top queries that received negative feedback */
  topNegativeQueries: { query: string; count: number }[];
}

export interface DailySatisfaction {
  date: string; // YYYY-MM-DD
  total: number;
  positive: number;
  satisfactionRate: number;
}

export interface QualityAlert {
  id: string;
  type: 'satisfaction_drop' | 'negative_spike' | 'category_spike';
  severity: 'warning' | 'critical';
  message: string;
  metric: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

export interface TrainingExample {
  query: string;
  answer: string;
  rating: FeedbackRating;
  category?: string;
  sources: string[];
  confidence?: number;
}

export interface TrainingDataExport {
  version: string;
  exportedAt: string;
  examples: TrainingExample[];
  stats: {
    total: number;
    positive: number;
    negative: number;
  };
}

export interface FeedbackSystemConfig {
  /** Max entries in memory store */
  maxEntries: number;
  /** Window size for "recent" satisfaction (number of entries) */
  recentWindow: number;
  /** Satisfaction threshold below which a warning fires */
  satisfactionWarningThreshold: number;
  /** Satisfaction threshold below which a critical alert fires */
  satisfactionCriticalThreshold: number;
  /** Minimum feedback count before alerts can trigger */
  minFeedbackForAlerts: number;
  /** Negative spike: max negatives in recentWindow before alert */
  negativeSpikeThreshold: number;
}

const DEFAULT_CONFIG: FeedbackSystemConfig = {
  maxEntries: 50_000,
  recentWindow: 100,
  satisfactionWarningThreshold: 0.65,
  satisfactionCriticalThreshold: 0.45,
  minFeedbackForAlerts: 30,
  negativeSpikeThreshold: 0.5,
};

// ═══════════════════════════════════════════════════════════════
// FEEDBACK STORE
// ═══════════════════════════════════════════════════════════════

/**
 * In-memory feedback store.
 *
 * In production, swap `entries` for a database table via the same
 * interface. Everything else (analytics, alerts, export) stays the same.
 */
export class FeedbackStore {
  private entries: FeedbackEntry[] = [];
  private alerts: QualityAlert[] = [];
  private readonly config: FeedbackSystemConfig;
  private idCounter = 0;

  constructor(config?: Partial<FeedbackSystemConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── CRUD ──────────────────────────────────────────────────

  /** Record a new feedback entry; returns entry ID */
  addFeedback(entry: Omit<FeedbackEntry, 'id'>): string {
    const id = `fb-${++this.idCounter}-${Date.now()}`;
    const full: FeedbackEntry = { ...entry, id };
    this.entries.push(full);

    // Trim if oversized
    if (this.entries.length > this.config.maxEntries) {
      this.entries.splice(0, this.entries.length - this.config.maxEntries);
    }

    // Check quality alerts after new entry
    this.evaluateAlerts();

    return id;
  }

  getFeedback(id: string): FeedbackEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  getFeedbackByQuery(queryId: string): FeedbackEntry[] {
    return this.entries.filter((e) => e.queryId === queryId);
  }

  getRecentFeedback(limit = 20): FeedbackEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  get size(): number {
    return this.entries.length;
  }

  // ─── ANALYTICS ─────────────────────────────────────────────

  getAnalytics(): FeedbackAnalytics {
    const total = this.entries.length;
    const positiveCount = this.entries.filter((e) => e.rating === 'positive').length;
    const negativeCount = total - positiveCount;
    const satisfactionRate = total > 0 ? positiveCount / total : 0;

    // Recent window
    const recent = this.entries.slice(-this.config.recentWindow);
    const recentPositive = recent.filter((e) => e.rating === 'positive').length;
    const recentSatisfaction = recent.length > 0 ? recentPositive / recent.length : 0;

    // Category breakdown
    const categories: FeedbackCategory[] = ['accuracy', 'relevance', 'completeness', 'timeliness', 'other'];
    const categoryBreakdown = {} as FeedbackAnalytics['categoryBreakdown'];
    for (const cat of categories) {
      const catEntries = this.entries.filter((e) => e.category === cat);
      categoryBreakdown[cat] = {
        positive: catEntries.filter((e) => e.rating === 'positive').length,
        negative: catEntries.filter((e) => e.rating === 'negative').length,
      };
    }

    // Daily trend (last 30 days)
    const dailyTrend = this.computeDailyTrend(30);

    // Top negative queries
    const negCounts = new Map<string, number>();
    for (const e of this.entries) {
      if (e.rating === 'negative') {
        const short = e.query.slice(0, 100);
        negCounts.set(short, (negCounts.get(short) || 0) + 1);
      }
    }
    const topNegativeQueries = [...negCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      totalFeedback: total,
      positiveCount,
      negativeCount,
      satisfactionRate,
      recentSatisfaction,
      categoryBreakdown,
      dailyTrend,
      topNegativeQueries,
    };
  }

  /** Satisfaction trend grouped by day */
  private computeDailyTrend(days: number): DailySatisfaction[] {
    const now = new Date();
    const trend: DailySatisfaction[] = [];

    for (let d = days - 1; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];

      const dayEntries = this.entries.filter(
        (e) => e.timestamp.startsWith(dateStr)
      );
      const positive = dayEntries.filter((e) => e.rating === 'positive').length;
      trend.push({
        date: dateStr,
        total: dayEntries.length,
        positive,
        satisfactionRate: dayEntries.length > 0 ? positive / dayEntries.length : 0,
      });
    }

    return trend;
  }

  // ─── QUALITY ALERTS ────────────────────────────────────────

  private evaluateAlerts(): void {
    if (this.entries.length < this.config.minFeedbackForAlerts) return;

    const recent = this.entries.slice(-this.config.recentWindow);
    const recentPositive = recent.filter((e) => e.rating === 'positive').length;
    const recentSatisfaction = recent.length > 0 ? recentPositive / recent.length : 1;

    // Overall satisfaction drop — critical
    if (recentSatisfaction < this.config.satisfactionCriticalThreshold) {
      this.raiseAlert({
        type: 'satisfaction_drop',
        severity: 'critical',
        message: `Satisfaction rate dropped to ${(recentSatisfaction * 100).toFixed(1)}% (critical threshold: ${(this.config.satisfactionCriticalThreshold * 100).toFixed(0)}%)`,
        metric: recentSatisfaction,
        threshold: this.config.satisfactionCriticalThreshold,
      });
    }
    // Overall satisfaction drop — warning
    else if (recentSatisfaction < this.config.satisfactionWarningThreshold) {
      this.raiseAlert({
        type: 'satisfaction_drop',
        severity: 'warning',
        message: `Satisfaction rate at ${(recentSatisfaction * 100).toFixed(1)}% (warning threshold: ${(this.config.satisfactionWarningThreshold * 100).toFixed(0)}%)`,
        metric: recentSatisfaction,
        threshold: this.config.satisfactionWarningThreshold,
      });
    }

    // Negative spike in recent window
    const negativeRate = recent.length > 0 ? (recent.length - recentPositive) / recent.length : 0;
    if (negativeRate >= this.config.negativeSpikeThreshold) {
      this.raiseAlert({
        type: 'negative_spike',
        severity: 'warning',
        message: `Negative feedback spike: ${(negativeRate * 100).toFixed(1)}% of last ${recent.length} entries are negative`,
        metric: negativeRate,
        threshold: this.config.negativeSpikeThreshold,
      });
    }

    // Category spike: any single category has >60% of recent negatives
    const recentNeg = recent.filter((e) => e.rating === 'negative');
    if (recentNeg.length >= 5) {
      const catCount = new Map<string, number>();
      for (const e of recentNeg) {
        if (e.category) {
          catCount.set(e.category, (catCount.get(e.category) || 0) + 1);
        }
      }
      for (const [cat, count] of catCount) {
        if (count / recentNeg.length > 0.6) {
          this.raiseAlert({
            type: 'category_spike',
            severity: 'warning',
            message: `Category "${cat}" accounts for ${((count / recentNeg.length) * 100).toFixed(0)}% of recent negative feedback`,
            metric: count / recentNeg.length,
            threshold: 0.6,
          });
        }
      }
    }
  }

  private raiseAlert(partial: Omit<QualityAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    // De-duplicate: skip if an unacknowledged alert of same type+severity exists within 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const exists = this.alerts.some(
      (a) =>
        a.type === partial.type &&
        a.severity === partial.severity &&
        !a.acknowledged &&
        new Date(a.timestamp).getTime() > oneHourAgo
    );
    if (exists) return;

    this.alerts.push({
      ...partial,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });

    // Keep alerts list bounded
    if (this.alerts.length > 500) {
      this.alerts.splice(0, this.alerts.length - 500);
    }
  }

  getActiveAlerts(): QualityAlert[] {
    return this.alerts.filter((a) => !a.acknowledged);
  }

  getAllAlerts(limit = 50): QualityAlert[] {
    return this.alerts.slice(-limit).reverse();
  }

  acknowledgeAlert(id: string): boolean {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  // ─── TRAINING DATA EXPORT ─────────────────────────────────

  /**
   * Export feedback as structured training data for model fine-tuning.
   *
   * @param minPositiveRating - Minimum satisfaction ratio to include positives (0-1)
   * @param includeNegatives  - Include negative examples (useful for DPO)
   * @param limit             - Max examples to export
   */
  exportTrainingData(
    options: {
      minPositiveRating?: number;
      includeNegatives?: boolean;
      limit?: number;
      categories?: FeedbackCategory[];
    } = {}
  ): TrainingDataExport {
    const {
      minPositiveRating: _minPositiveRating = 0.8,
      includeNegatives = true,
      limit = 5000,
      categories,
    } = options;

    let filtered = [...this.entries];

    // Filter by categories if specified
    if (categories && categories.length > 0) {
      filtered = filtered.filter((e) => e.category && categories.includes(e.category));
    }

    // Filter by rating type
    if (!includeNegatives) {
      filtered = filtered.filter((e) => e.rating === 'positive');
    }

    // Limit
    filtered = filtered.slice(-limit);

    const examples: TrainingExample[] = filtered.map((e) => ({
      query: e.query,
      answer: e.answer,
      rating: e.rating,
      category: e.category,
      sources: e.sources || [],
      confidence: e.confidence,
    }));

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      examples,
      stats: {
        total: examples.length,
        positive: examples.filter((e) => e.rating === 'positive').length,
        negative: examples.filter((e) => e.rating === 'negative').length,
      },
    };
  }

  // ─── A/B INTEGRATION ──────────────────────────────────────

  /** Get feedback for a specific experiment variant */
  getFeedbackByVariant(variantId: string): FeedbackEntry[] {
    return this.entries.filter((e) => e.experimentVariantId === variantId);
  }

  /** Get satisfaction rate for a specific experiment variant */
  getVariantSatisfaction(variantId: string): {
    total: number;
    positive: number;
    negative: number;
    satisfactionRate: number;
  } {
    const variant = this.getFeedbackByVariant(variantId);
    const positive = variant.filter((e) => e.rating === 'positive').length;
    return {
      total: variant.length,
      positive,
      negative: variant.length - positive,
      satisfactionRate: variant.length > 0 ? positive / variant.length : 0,
    };
  }

  /** Compare satisfaction between two experiment variants */
  compareVariants(
    variantA: string,
    variantB: string
  ): {
    a: ReturnType<FeedbackStore['getVariantSatisfaction']>;
    b: ReturnType<FeedbackStore['getVariantSatisfaction']>;
    winner: string | null;
    delta: number;
  } {
    const a = this.getVariantSatisfaction(variantA);
    const b = this.getVariantSatisfaction(variantB);
    const delta = a.satisfactionRate - b.satisfactionRate;

    let winner: string | null = null;
    // Only declare a winner if both have reasonable samples
    if (a.total >= 10 && b.total >= 10 && Math.abs(delta) > 0.05) {
      winner = delta > 0 ? variantA : variantB;
    }

    return { a, b, winner, delta };
  }

  // ─── RESET (for testing) ───────────────────────────────────

  reset(): void {
    this.entries = [];
    this.alerts = [];
    this.idCounter = 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

let _feedbackStore: FeedbackStore | null = null;

export function getFeedbackStore(config?: Partial<FeedbackSystemConfig>): FeedbackStore {
  if (!_feedbackStore) {
    _feedbackStore = new FeedbackStore(config);
  }
  return _feedbackStore;
}
