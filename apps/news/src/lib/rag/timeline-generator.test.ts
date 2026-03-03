/**
 * Unit tests for TimelineGenerator (Phase 4.2)
 *
 * Tests helper functions and non-LLM parts. LLM-dependent methods
 * (extractEvents, clusterEvents, summariseTimeline) require mocking
 * callGroq which is tested via integration tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineGenerator } from './timeline-generator';
import type { ScoredDocument } from './types';

// Mock groq module to avoid real API calls
vi.mock('@/lib/groq', () => ({
  callGroq: vi.fn().mockResolvedValue({
    content: JSON.stringify([
      {
        date: '2024-01-10',
        title: 'SEC approves spot Bitcoin ETFs',
        description: 'The SEC approved multiple spot Bitcoin ETF applications.',
        importance: 0.95,
        category: 'regulatory',
        sourceIndexes: [1],
      },
      {
        date: '2024-01-11',
        title: 'Bitcoin price surges 8%',
        description: 'Following ETF approval, BTC rallied sharply.',
        importance: 0.8,
        category: 'market_move',
        sourceIndexes: [2],
      },
    ]),
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
  }),
  parseGroqJson: vi.fn((content: string) => JSON.parse(content)),
}));

function makeDoc(overrides: Partial<ScoredDocument> = {}): ScoredDocument {
  return {
    id: 'doc-1',
    title: 'Bitcoin ETF Approved',
    content: 'The SEC has approved Bitcoin ETFs after months of deliberation.',
    source: 'CoinDesk',
    url: 'https://example.com/1',
    publishedAt: new Date('2024-01-10'),
    score: 0.9,
    ...overrides,
  };
}

describe('TimelineGenerator', () => {
  let generator: TimelineGenerator;

  beforeEach(() => {
    generator = new TimelineGenerator();
    vi.clearAllMocks();
  });

  it('extracts events from documents', async () => {
    const docs = [
      makeDoc(),
      makeDoc({ id: 'doc-2', title: 'BTC price surge', publishedAt: new Date('2024-01-11') }),
    ];

    const events = await generator.extractEvents('Bitcoin ETF', docs);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].title).toBe('SEC approves spot Bitcoin ETFs');
    expect(events[0].category).toBe('regulatory');
    expect(events[0].importance).toBeGreaterThan(0);
  });

  it('returns empty array for empty documents', async () => {
    const events = await generator.extractEvents('Bitcoin ETF', []);
    expect(events).toEqual([]);
  });

  it('generates a complete timeline', async () => {
    // Mock clusterEvents response
    const { callGroq } = await import('@/lib/groq');
    const mockCallGroq = vi.mocked(callGroq);
    
    // First call: extractEvents, Second call: clusterEvents, Third call: summarise
    mockCallGroq
      .mockResolvedValueOnce({
        content: JSON.stringify([
          {
            date: '2024-01-10',
            title: 'SEC approves spot Bitcoin ETFs',
            description: 'ETF approval',
            importance: 0.95,
            category: 'regulatory',
            sourceIndexes: [1],
          },
        ]),
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      })
      .mockResolvedValueOnce({
        content: JSON.stringify([
          { label: 'Regulatory', eventIndexes: [0] },
        ]),
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
      })
      .mockResolvedValueOnce({
        content: 'The SEC approved Bitcoin ETFs in January 2024, marking a significant regulatory milestone.',
        usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
      });

    const docs = [makeDoc()];
    const timeline = await generator.generateTimeline('Bitcoin ETF', docs, {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      maxEvents: 10,
    });

    expect(timeline.topic).toBe('Bitcoin ETF');
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(timeline.generatedAt).toBeDefined();
    expect(timeline.summary).toBeTruthy();
  });

  it('filters events by importance threshold', async () => {
    const { callGroq } = await import('@/lib/groq');
    const mockCallGroq = vi.mocked(callGroq);

    mockCallGroq.mockResolvedValueOnce({
      content: JSON.stringify([
        { date: '2024-01-10', title: 'Major event', description: '', importance: 0.9, category: 'market_move', sourceIndexes: [] },
        { date: '2024-01-11', title: 'Minor event', description: '', importance: 0.1, category: 'other', sourceIndexes: [] },
      ]),
      usage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 },
    })
    .mockResolvedValueOnce({
      content: JSON.stringify([{ label: 'All', eventIndexes: [0] }]),
      usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
    })
    .mockResolvedValueOnce({
      content: 'Summary of events.',
      usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
    });

    const docs = [makeDoc()];
    const timeline = await generator.generateTimeline('Bitcoin', docs, {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      minImportance: 0.5,
    });

    // Only the major event (0.9) should survive the 0.5 threshold
    expect(timeline.events.every((e) => e.importance >= 0.5)).toBe(true);
  });
});
