/**
 * Unit tests for PersonalizationEngine (Phase 4.3)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PersonalizationEngine } from './personalization';
import type { ScoredDocument } from './types';

function makeDoc(overrides: Partial<ScoredDocument> = {}): ScoredDocument {
  return {
    id: `doc-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Default Title',
    content: 'Default content about crypto markets',
    source: 'TestSource',
    score: 0.8,
    ...overrides,
  };
}

describe('PersonalizationEngine', () => {
  let engine: PersonalizationEngine;

  beforeEach(() => {
    engine = new PersonalizationEngine();
  });

  // ─── Profile Management ────────────────────────────────────

  it('creates a new profile on first access', () => {
    const profile = engine.getOrCreateProfile('user-1');
    expect(profile.userId).toBe('user-1');
    expect(profile.preferences.readingLevel).toBe('intermediate');
    expect(profile.preferences.interests).toEqual([]);
  });

  it('returns same profile on subsequent calls', () => {
    const p1 = engine.getOrCreateProfile('user-1');
    const p2 = engine.getOrCreateProfile('user-1');
    expect(p1).toBe(p2);
  });

  it('updates preferences partially', () => {
    engine.getOrCreateProfile('user-1');
    const updated = engine.updatePreferences('user-1', {
      interests: ['DeFi', 'Ethereum'],
      readingLevel: 'expert',
    });
    expect(updated.preferences.interests).toEqual(['DeFi', 'Ethereum']);
    expect(updated.preferences.readingLevel).toBe('expert');
    // Other prefs unchanged
    expect(updated.preferences.responseStyle).toBe('detailed');
  });

  // ─── Query Tracking & Interest Inference ───────────────────

  it('records query and infers interests', () => {
    engine.recordQuery('user-1', 'What is the latest on Ethereum DeFi regulation?');
    const profile = engine.getProfile('user-1')!;
    
    expect(profile.queryHistory).toHaveLength(1);
    expect(profile.inferredInterests.length).toBeGreaterThan(0);

    const topics = profile.inferredInterests.map((i) => i.topic);
    expect(topics).toContain('Ethereum');
    expect(topics).toContain('DeFi');
  });

  it('increases inferred interest weight on repeated queries', () => {
    engine.recordQuery('user-1', 'Bitcoin price analysis');
    const w1 = engine.getProfile('user-1')!.inferredInterests.find((i) => i.topic === 'Bitcoin')!.weight;
    
    engine.recordQuery('user-1', 'Bitcoin halving news');
    const w2 = engine.getProfile('user-1')!.inferredInterests.find((i) => i.topic === 'Bitcoin')!.weight;
    
    expect(w2).toBeGreaterThan(w1);
  });

  it('respects privacy mode — no history stored', () => {
    engine.setPrivacyMode('user-1', true);
    engine.recordQuery('user-1', 'Bitcoin secret plans');
    
    const profile = engine.getProfile('user-1')!;
    expect(profile.queryHistory).toHaveLength(0);
    expect(profile.privacyMode).toBe(true);
    // Inferred interests still work since they're anonymous
    expect(profile.inferredInterests.length).toBeGreaterThan(0);
  });

  // ─── Personalised Ranking ──────────────────────────────────

  it('boosts documents matching user interests', () => {
    engine.updatePreferences('user-1', { interests: ['DeFi'] });

    const docs: ScoredDocument[] = [
      makeDoc({ title: 'Stock Market News', content: 'Traditional finance update', score: 0.9 }),
      makeDoc({ title: 'DeFi Yields Soar', content: 'DeFi protocols see high yields', score: 0.7 }),
    ];

    const result = engine.personaliseRanking('user-1', docs);
    // DeFi doc should now rank higher after interest boost
    expect(result.documents[0].title).toBe('DeFi Yields Soar');
    expect(result.boostsApplied.interestBoosted).toBeGreaterThan(0);
  });

  it('boosts documents from preferred sources', () => {
    engine.updatePreferences('user-1', { sources: ['CoinDesk'] });

    const docs: ScoredDocument[] = [
      makeDoc({ source: 'RandomBlog', score: 0.85 }),
      makeDoc({ source: 'CoinDesk', score: 0.75 }),
    ];

    const result = engine.personaliseRanking('user-1', docs);
    expect(result.documents[0].source).toBe('CoinDesk');
    expect(result.boostsApplied.sourceBoosted).toBe(1);
  });

  it('penalises documents matching muted topics', () => {
    engine.updatePreferences('user-1', { mutedTopics: ['NFT'] });

    const docs: ScoredDocument[] = [
      makeDoc({ title: 'NFT Market Crash', content: 'NFT prices collapse', score: 0.9 }),
      makeDoc({ title: 'Bitcoin Rally', content: 'BTC hits new ATH', score: 0.7 }),
    ];

    const result = engine.personaliseRanking('user-1', docs);
    expect(result.documents[0].title).toBe('Bitcoin Rally');
    expect(result.boostsApplied.mutedPenalized).toBe(1);
  });

  it('returns unchanged docs for unknown user', () => {
    const docs: ScoredDocument[] = [
      makeDoc({ score: 0.9 }),
      makeDoc({ score: 0.7 }),
    ];

    const result = engine.personaliseRanking('nonexistent', docs);
    expect(result.documents).toHaveLength(2);
    expect(result.boostsApplied.interestBoosted).toBe(0);
  });

  // ─── Response Style Adaptation ─────────────────────────────

  it('generates system prompt modifier based on preferences', () => {
    engine.updatePreferences('user-1', {
      readingLevel: 'beginner',
      responseStyle: 'concise',
      interests: ['Solana'],
    });

    const modifier = engine.getSystemPromptModifier('user-1');
    expect(modifier).toContain('simply');
    expect(modifier).toContain('brief');
    expect(modifier).toContain('Solana');
  });

  it('returns empty modifier for unknown user', () => {
    const modifier = engine.getSystemPromptModifier('nonexistent');
    expect(modifier).toBe('');
  });

  // ─── Source Weights ────────────────────────────────────────

  it('returns source weights from preferences', () => {
    engine.updatePreferences('user-1', { sources: ['CoinDesk', 'The Block'] });
    const weights = engine.getSourceWeights('user-1');
    expect(weights.get('coindesk')).toBeGreaterThan(1);
    expect(weights.get('the block')).toBeGreaterThan(1);
  });

  // ─── Privacy & Data Management ─────────────────────────────

  it('exports full user data', () => {
    engine.updatePreferences('user-1', { interests: ['Bitcoin'] });
    engine.recordQuery('user-1', 'What is Bitcoin?');

    const data = engine.exportUserData('user-1');
    expect(data).toBeDefined();
    expect(data!.preferences.interests).toContain('Bitcoin');
    expect(data!.queryHistory).toHaveLength(1);
  });

  it('returns null for non-existent user export', () => {
    expect(engine.exportUserData('ghost')).toBeNull();
  });

  it('deletes user data completely', () => {
    engine.getOrCreateProfile('user-1');
    expect(engine.deleteUser('user-1')).toBe(true);
    expect(engine.getProfile('user-1')).toBeUndefined();
    expect(engine.deleteUser('user-1')).toBe(false);
  });

  // ─── Stats ─────────────────────────────────────────────────

  it('tracks total user count', () => {
    expect(engine.totalUsers).toBe(0);
    engine.getOrCreateProfile('user-1');
    engine.getOrCreateProfile('user-2');
    expect(engine.totalUsers).toBe(2);
  });

  it('returns user stats', () => {
    engine.updatePreferences('user-1', { interests: ['DeFi'] });
    engine.recordQuery('user-1', 'DeFi news');

    const stats = engine.getUserStats('user-1');
    expect(stats).toBeDefined();
    expect(stats!.queryCount).toBe(1);
    expect(stats!.preferences.interests).toContain('DeFi');
  });

  // ─── Reset ─────────────────────────────────────────────────

  it('resets the engine', () => {
    engine.getOrCreateProfile('user-1');
    engine.reset();
    expect(engine.totalUsers).toBe(0);
  });
});
