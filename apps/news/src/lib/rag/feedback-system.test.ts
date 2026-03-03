/**
 * Unit tests for FeedbackStore (Phase 4.1)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FeedbackStore } from './feedback-system';
import type { FeedbackEntry } from './feedback-system';

function makeFeedback(
  overrides: Partial<Omit<FeedbackEntry, 'id'>> = {}
): Omit<FeedbackEntry, 'id'> {
  return {
    queryId: `q-${Math.random().toString(36).slice(2, 8)}`,
    query: 'What is Bitcoin?',
    answer: 'Bitcoin is a cryptocurrency.',
    rating: 'positive',
    ip: '127.0.0.1',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('FeedbackStore', () => {
  let store: FeedbackStore;

  beforeEach(() => {
    store = new FeedbackStore({ maxEntries: 100, recentWindow: 10, minFeedbackForAlerts: 5 });
  });

  // ─── Basic CRUD ────────────────────────────────────────────

  it('adds feedback and increments size', () => {
    const id = store.addFeedback(makeFeedback());
    expect(id).toContain('fb-');
    expect(store.size).toBe(1);
  });

  it('retrieves feedback by id', () => {
    const id = store.addFeedback(makeFeedback({ rating: 'negative' }));
    const entry = store.getFeedback(id);
    expect(entry).toBeDefined();
    expect(entry?.rating).toBe('negative');
  });

  it('retrieves feedback by queryId', () => {
    store.addFeedback(makeFeedback({ queryId: 'q-test' }));
    store.addFeedback(makeFeedback({ queryId: 'q-test' }));
    store.addFeedback(makeFeedback({ queryId: 'q-other' }));
    expect(store.getFeedbackByQuery('q-test')).toHaveLength(2);
  });

  it('returns recent feedback in reverse order', () => {
    store.addFeedback(makeFeedback({ queryId: 'first' }));
    store.addFeedback(makeFeedback({ queryId: 'second' }));
    store.addFeedback(makeFeedback({ queryId: 'third' }));
    const recent = store.getRecentFeedback(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].queryId).toBe('third');
    expect(recent[1].queryId).toBe('second');
  });

  it('trims oldest entries when exceeding maxEntries', () => {
    const smallStore = new FeedbackStore({ maxEntries: 3, recentWindow: 3, minFeedbackForAlerts: 999 });
    smallStore.addFeedback(makeFeedback({ queryId: 'q1' }));
    smallStore.addFeedback(makeFeedback({ queryId: 'q2' }));
    smallStore.addFeedback(makeFeedback({ queryId: 'q3' }));
    smallStore.addFeedback(makeFeedback({ queryId: 'q4' }));
    expect(smallStore.size).toBe(3);
    expect(smallStore.getFeedbackByQuery('q1')).toHaveLength(0);
  });

  // ─── Analytics ─────────────────────────────────────────────

  it('computes satisfaction rate', () => {
    store.addFeedback(makeFeedback({ rating: 'positive' }));
    store.addFeedback(makeFeedback({ rating: 'positive' }));
    store.addFeedback(makeFeedback({ rating: 'negative' }));

    const analytics = store.getAnalytics();
    expect(analytics.totalFeedback).toBe(3);
    expect(analytics.positiveCount).toBe(2);
    expect(analytics.negativeCount).toBe(1);
    expect(analytics.satisfactionRate).toBeCloseTo(2 / 3);
  });

  it('computes category breakdown', () => {
    store.addFeedback(makeFeedback({ rating: 'positive', category: 'accuracy' }));
    store.addFeedback(makeFeedback({ rating: 'negative', category: 'accuracy' }));
    store.addFeedback(makeFeedback({ rating: 'positive', category: 'relevance' }));

    const analytics = store.getAnalytics();
    expect(analytics.categoryBreakdown.accuracy.positive).toBe(1);
    expect(analytics.categoryBreakdown.accuracy.negative).toBe(1);
    expect(analytics.categoryBreakdown.relevance.positive).toBe(1);
  });

  it('computes daily trend', () => {
    store.addFeedback(makeFeedback());
    const analytics = store.getAnalytics();
    expect(analytics.dailyTrend.length).toBeGreaterThan(0);
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = analytics.dailyTrend.find((d) => d.date === today);
    expect(todayEntry?.total).toBe(1);
  });

  it('identifies top negative queries', () => {
    store.addFeedback(makeFeedback({ rating: 'negative', query: 'bad query' }));
    store.addFeedback(makeFeedback({ rating: 'negative', query: 'bad query' }));
    store.addFeedback(makeFeedback({ rating: 'negative', query: 'another' }));

    const analytics = store.getAnalytics();
    expect(analytics.topNegativeQueries[0].query).toBe('bad query');
    expect(analytics.topNegativeQueries[0].count).toBe(2);
  });

  // ─── Quality Alerts ────────────────────────────────────────

  it('raises satisfaction drop alert when below critical threshold', () => {
    const alertStore = new FeedbackStore({
      maxEntries: 100,
      recentWindow: 10,
      minFeedbackForAlerts: 5,
      satisfactionCriticalThreshold: 0.45,
    });

    // Add mostly negative feedback
    for (let i = 0; i < 8; i++) {
      alertStore.addFeedback(makeFeedback({ rating: 'negative' }));
    }

    const alerts = alertStore.getActiveAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a) => a.type === 'satisfaction_drop' && a.severity === 'critical')).toBe(true);
  });

  it('acknowledges alerts', () => {
    const alertStore = new FeedbackStore({
      maxEntries: 100,
      recentWindow: 5,
      minFeedbackForAlerts: 5,
      satisfactionCriticalThreshold: 0.45,
    });

    for (let i = 0; i < 6; i++) {
      alertStore.addFeedback(makeFeedback({ rating: 'negative' }));
    }

    const alerts = alertStore.getActiveAlerts();
    expect(alerts.length).toBeGreaterThan(0);

    const ack = alertStore.acknowledgeAlert(alerts[0].id);
    expect(ack).toBe(true);
    expect(alertStore.getActiveAlerts().length).toBe(alerts.length - 1);
  });

  // ─── Training Data Export ──────────────────────────────────

  it('exports training data', () => {
    store.addFeedback(makeFeedback({ rating: 'positive', query: 'q1', answer: 'a1' }));
    store.addFeedback(makeFeedback({ rating: 'negative', query: 'q2', answer: 'a2' }));

    const data = store.exportTrainingData();
    expect(data.version).toBe('1.0.0');
    expect(data.stats.total).toBe(2);
    expect(data.stats.positive).toBe(1);
    expect(data.stats.negative).toBe(1);
  });

  it('filters exports by includeNegatives=false', () => {
    store.addFeedback(makeFeedback({ rating: 'positive' }));
    store.addFeedback(makeFeedback({ rating: 'negative' }));

    const data = store.exportTrainingData({ includeNegatives: false });
    expect(data.stats.total).toBe(1);
    expect(data.stats.negative).toBe(0);
  });

  it('filters exports by categories', () => {
    store.addFeedback(makeFeedback({ category: 'accuracy' }));
    store.addFeedback(makeFeedback({ category: 'relevance' }));
    store.addFeedback(makeFeedback({ category: undefined }));

    const data = store.exportTrainingData({ categories: ['accuracy'] });
    expect(data.stats.total).toBe(1);
  });

  // ─── A/B Integration ───────────────────────────────────────

  it('tracks variant satisfaction', () => {
    store.addFeedback(makeFeedback({ rating: 'positive', experimentVariantId: 'v-a' }));
    store.addFeedback(makeFeedback({ rating: 'positive', experimentVariantId: 'v-a' }));
    store.addFeedback(makeFeedback({ rating: 'negative', experimentVariantId: 'v-b' }));

    const satA = store.getVariantSatisfaction('v-a');
    expect(satA.total).toBe(2);
    expect(satA.satisfactionRate).toBe(1);

    const satB = store.getVariantSatisfaction('v-b');
    expect(satB.total).toBe(1);
    expect(satB.satisfactionRate).toBe(0);
  });

  it('compares two variants', () => {
    for (let i = 0; i < 15; i++) {
      store.addFeedback(makeFeedback({ rating: 'positive', experimentVariantId: 'v-a' }));
    }
    for (let i = 0; i < 10; i++) {
      store.addFeedback(makeFeedback({ rating: 'negative', experimentVariantId: 'v-b' }));
    }

    const comparison = store.compareVariants('v-a', 'v-b');
    expect(comparison.winner).toBe('v-a');
    expect(comparison.delta).toBeGreaterThan(0);
  });

  // ─── Reset ─────────────────────────────────────────────────

  it('resets the store', () => {
    store.addFeedback(makeFeedback());
    store.reset();
    expect(store.size).toBe(0);
    expect(store.getActiveAlerts()).toHaveLength(0);
  });
});
