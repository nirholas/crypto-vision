/**
 * Timeline Generation — Phase 4.2
 *
 * Extract events from articles, cluster by topic, score importance,
 * and produce chronological timelines suitable for UI rendering.
 *
 * Uses LLM (Groq) for event extraction and summarisation.
 *
 * @module lib/rag/timeline-generator
 */

import { callGroq, type GroqMessage, parseGroqJson } from '@/lib/groq';
import type { ScoredDocument } from './types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface TimelineEvent {
  id: string;
  date: string;           // ISO 8601
  title: string;          // One-line headline
  description: string;    // Short paragraph
  importance: number;     // 0-1
  category: TimelineCategory;
  sources: TimelineSource[];
  relatedEvents?: string[]; // IDs of related events
}

export type TimelineCategory =
  | 'regulatory'
  | 'market_move'
  | 'technology'
  | 'adoption'
  | 'security'
  | 'partnership'
  | 'launch'
  | 'other';

export interface TimelineSource {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface TimelineCluster {
  id: string;
  label: string;
  events: TimelineEvent[];
  /** Overall importance = max importance of child events */
  importance: number;
}

export interface Timeline {
  topic: string;
  startDate: string;
  endDate: string;
  events: TimelineEvent[];
  clusters: TimelineCluster[];
  summary: string;
  generatedAt: string;
}

export interface TimelineOptions {
  startDate?: string;     // YYYY-MM-DD; defaults to 30 days ago
  endDate?: string;       // YYYY-MM-DD; defaults to today
  granularity?: 'day' | 'week' | 'month';
  maxEvents?: number;     // default 30
  minImportance?: number; // 0-1, default 0.2
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE GENERATOR
// ═══════════════════════════════════════════════════════════════

export class TimelineGenerator {
  // ─── Event Extraction ───────────────────────────────────────

  /**
   * Extract structured events from a set of documents using LLM.
   * Documents should already be retrieved (e.g. from RAG search).
   */
  async extractEvents(
    topic: string,
    documents: ScoredDocument[],
    maxEvents = 30
  ): Promise<TimelineEvent[]> {
    if (documents.length === 0) return [];

    // Prepare condensed context — cap at ~20 docs so we don't exceed context window
    const docSummaries = documents.slice(0, 20).map((d, i) => {
      const date = d.publishedAt ? new Date(d.publishedAt).toISOString().split('T')[0] : 'unknown';
      return `[${i + 1}] ${date} | ${d.title}\n${d.content.slice(0, 300)}`;
    });

    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `You are a crypto news analyst. Extract distinct events from the provided articles related to the topic "${topic}". Return a JSON array of events. Each event must have:
- date (ISO 8601, best approximation from article dates)
- title (concise, 5-15 words)
- description (1-2 sentences)
- importance (0.0-1.0, where 1.0 = market-moving)
- category (one of: regulatory, market_move, technology, adoption, security, partnership, launch, other)
- sourceIndexes (array of article reference numbers)

Deduplicate events that describe the same occurrence across multiple articles.
Return at most ${maxEvents} events sorted chronologically.
Return ONLY valid JSON with no markdown fences.`,
      },
      {
        role: 'user',
        content: `Articles:\n\n${docSummaries.join('\n\n')}\n\nExtract events related to: "${topic}"`,
      },
    ];

    interface RawEvent {
      date: string;
      title: string;
      description: string;
      importance: number;
      category: string;
      sourceIndexes?: number[];
    }

    const response = await callGroq(messages, {
      temperature: 0.2,
      maxTokens: 4000,
    });

    let rawEvents: RawEvent[];
    try {
      rawEvents = parseGroqJson<RawEvent[]>(response.content);
    } catch {
      return [];
    }

    if (!Array.isArray(rawEvents)) return [];

    const events: TimelineEvent[] = rawEvents
      .filter((e) => e.date && e.title)
      .map((e, idx) => ({
        id: `evt-${idx}-${Date.now()}`,
        date: normaliseDate(e.date),
        title: e.title,
        description: e.description || '',
        importance: clamp(e.importance ?? 0.5, 0, 1),
        category: validateCategory(e.category),
        sources: (e.sourceIndexes || [])
          .filter((i) => i >= 1 && i <= documents.length)
          .map((i) => {
            const doc = documents[i - 1];
            return {
              title: doc.title,
              url: doc.url || '',
              source: doc.source,
              publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : '',
            };
          }),
      }));

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ─── Clustering ─────────────────────────────────────────────

  /**
   * Cluster events into groups by semantic similarity using LLM.
   */
  async clusterEvents(events: TimelineEvent[]): Promise<TimelineCluster[]> {
    if (events.length === 0) return [];
    if (events.length <= 3) {
      // Too few to cluster meaningfully
      return [
        {
          id: 'cluster-0',
          label: 'All Events',
          events,
          importance: Math.max(...events.map((e) => e.importance)),
        },
      ];
    }

    const eventSummaries = events.map((e, i) => `[${i}] ${e.date} — ${e.title}`);

    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: `Group the following events into 2-6 thematic clusters. Each cluster should have a short label and a list of event indexes. Return JSON array:
[{ "label": "Cluster Title", "eventIndexes": [0, 2, 5] }]
Return ONLY valid JSON with no markdown fences.`,
      },
      {
        role: 'user',
        content: eventSummaries.join('\n'),
      },
    ];

    interface RawCluster {
      label: string;
      eventIndexes: number[];
    }

    const clusterResponse = await callGroq(messages, {
      temperature: 0.2,
      maxTokens: 1500,
    });

    let raw: RawCluster[];
    try {
      raw = parseGroqJson<RawCluster[]>(clusterResponse.content);
    } catch {
      return [
        {
          id: 'cluster-0',
          label: 'All Events',
          events,
          importance: Math.max(...events.map((e) => e.importance)),
        },
      ];
    }

    if (!Array.isArray(raw) || raw.length === 0) {
      return [
        {
          id: 'cluster-0',
          label: 'All Events',
          events,
          importance: Math.max(...events.map((e) => e.importance)),
        },
      ];
    }

    const clusters: TimelineCluster[] = raw
      .filter((c) => c.label && Array.isArray(c.eventIndexes))
      .map((c, idx) => {
        const clusterEvents = c.eventIndexes
          .filter((i) => i >= 0 && i < events.length)
          .map((i) => events[i]);
        return {
          id: `cluster-${idx}`,
          label: c.label,
          events: clusterEvents,
          importance: clusterEvents.length > 0 ? Math.max(...clusterEvents.map((e) => e.importance)) : 0,
        };
      })
      .filter((c) => c.events.length > 0);

    // Include any orphan events
    const usedIndexes = new Set(
      clusters.flatMap((c) =>
        c.events.map((e) => events.indexOf(e)).filter((i) => i >= 0)
      )
    );
    const orphans = events.filter((_, i) => !usedIndexes.has(i));
    if (orphans.length > 0) {
      clusters.push({
        id: `cluster-orphan`,
        label: 'Other',
        events: orphans,
        importance: Math.max(...orphans.map((e) => e.importance)),
      });
    }

    return clusters.sort((a, b) => b.importance - a.importance);
  }

  // ─── Summarisation ──────────────────────────────────────────

  /**
   * Generate a short narrative summary from the timeline events.
   */
  async summariseTimeline(
    topic: string,
    events: TimelineEvent[]
  ): Promise<string> {
    if (events.length === 0) return `No significant events found for "${topic}".`;

    const eventList = events
      .slice(0, 20)
      .map((e) => `• ${e.date}: ${e.title}`)
      .join('\n');

    const messages: GroqMessage[] = [
      {
        role: 'system',
        content: 'You are a crypto news summariser. Write a 2-4 sentence narrative summary of the timeline. Be concise and factual.',
      },
      {
        role: 'user',
        content: `Topic: ${topic}\n\nKey events:\n${eventList}`,
      },
    ];

    const response = await callGroq(messages, {
      temperature: 0.3,
      maxTokens: 300,
    });

    return response.content.trim();
  }

  // ─── Main Entry Point ──────────────────────────────────────

  /**
   * Generate a complete timeline from documents.
   *
   * @param topic     The subject, e.g. "Bitcoin ETF"
   * @param documents Pre-retrieved documents (from RAG search)
   * @param options   Date range, granularity, etc.
   */
  async generateTimeline(
    topic: string,
    documents: ScoredDocument[],
    options: TimelineOptions = {}
  ): Promise<Timeline> {
    const {
      startDate = defaultStartDate(),
      endDate = todayStr(),
      maxEvents = 30,
      minImportance = 0.2,
    } = options;

    // 1. Extract events
    let events = await this.extractEvents(topic, documents, maxEvents * 2);

    // 2. Filter by date range
    events = events.filter(
      (e) => e.date >= startDate && e.date <= endDate
    );

    // 3. Filter by importance
    events = events.filter((e) => e.importance >= minImportance);

    // 4. Cap to maxEvents (highest importance first, then re-sort chronologically)
    if (events.length > maxEvents) {
      events
        .sort((a, b) => b.importance - a.importance)
        .splice(maxEvents);
      events.sort((a, b) => a.date.localeCompare(b.date));
    }

    // 5. Cluster events
    const clusters = await this.clusterEvents(events);

    // 6. Summarise
    const summary = await this.summariseTimeline(topic, events);

    return {
      topic,
      startDate,
      endDate,
      events,
      clusters,
      summary,
      generatedAt: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const VALID_CATEGORIES: TimelineCategory[] = [
  'regulatory',
  'market_move',
  'technology',
  'adoption',
  'security',
  'partnership',
  'launch',
  'other',
];

function validateCategory(cat: string): TimelineCategory {
  if (VALID_CATEGORIES.includes(cat as TimelineCategory)) {
    return cat as TimelineCategory;
  }
  return 'other';
}

function normaliseDate(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toISOString().split('T')[0];
  } catch {
    return raw;
  }
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════

let _timelineGenerator: TimelineGenerator | null = null;

export function getTimelineGenerator(): TimelineGenerator {
  if (!_timelineGenerator) {
    _timelineGenerator = new TimelineGenerator();
  }
  return _timelineGenerator;
}
