# Phase 4.2: Timeline Generation

**Priority:** Medium | **Effort:** 2 days | **Impact:** Medium (Priority Score: 6)  
**Dependency:** None

---

## Objective

Generate structured chronological timelines for any crypto topic by extracting key events from archived news articles. Useful for trending topics like "Bitcoin ETF saga" or "Ethereum merge timeline". Returns structured JSON suitable for front-end charting.

---

## Implementation Prompt

> Build a timeline generation system that extracts events from the crypto news archive (`archive/`), clusters related events, scores their importance, and produces chronological timelines. Integrate with the existing RAG search pipeline in `src/lib/rag/`.

### Files to Create

```
src/lib/rag/timeline/
├── index.ts                 # Public exports
├── types.ts                 # TimelineEvent, Timeline, TimelineOptions
├── event-extractor.ts       # Extract events from articles using LLM
├── event-clusterer.ts       # Cluster similar/related events  
├── importance-scorer.ts     # Score event significance
├── timeline-builder.ts      # Assemble and order timeline
└── timeline-service.ts      # Orchestrator: query → search → extract → build
```

### API Endpoint

```
POST /api/rag/timeline
  Body: { topic: string, startDate?: string, endDate?: string, granularity?: 'day'|'week'|'month', maxEvents?: number }
  Response: Timeline
```

### Type Definitions

```typescript
interface TimelineEvent {
  id: string;
  date: string;                // ISO 8601 date
  title: string;               // Short event title (< 100 chars)
  description: string;         // 1-2 sentence summary
  importance: number;          // 0-1 score
  category: 'price' | 'regulation' | 'technology' | 'adoption' | 'security' | 'market';
  entities: string[];          // Crypto/org names mentioned
  sources: Array<{
    title: string;
    url: string;
    pubDate: string;
    source: string;
  }>;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface Timeline {
  topic: string;
  dateRange: { start: string; end: string };
  events: TimelineEvent[];
  summary: string;             // LLM-generated timeline summary
  totalArticlesAnalyzed: number;
  generatedAt: string;
  processingTimeMs: number;
}

interface TimelineOptions {
  startDate?: string;
  endDate?: string;
  granularity?: 'day' | 'week' | 'month';
  maxEvents?: number;          // Default: 20
  minImportance?: number;      // Default: 0.3
  categories?: string[];       // Filter to specific categories
}
```

### Key Implementation Details

1. **Event Extraction** (`event-extractor.ts`):
   - Use the existing `hybrid-search.ts` to find relevant articles for the topic
   - Batch articles to LLM (OpenAI/Groq) with prompt: "Extract the key event from this article. Return: date, title, description, category, sentiment"
   - Process 5-10 articles per LLM call to reduce API costs
   - Fall back to metadata extraction (title + pubDate) if LLM unavailable

2. **Event Clustering** (`event-clusterer.ts`):
   - Use embedding similarity to cluster events about the same real-world occurrence
   - Merge events within the same `granularity` window with cosine similarity > 0.85
   - Keep the most detailed description, combine all sources

3. **Importance Scoring** (`importance-scorer.ts`):
   - Multi-signal scoring: source count (more sources = more important), vote score from archive, recency boost, entity count
   - Normalize to 0-1 range
   - Weight: `0.3 * sourceCount + 0.2 * voteScore + 0.2 * sentimentStrength + 0.15 * entityCount + 0.15 * recency`

4. **Timeline Builder** (`timeline-builder.ts`):
   - Sort events chronologically
   - Apply `maxEvents` limit, keeping highest importance
   - Generate overall summary via LLM: "Summarize this timeline of {topic} from {start} to {end}"
   - Fill temporal gaps with "no significant events" markers if granularity requires it

5. **Caching**: Cache complete timelines for 1 hour (topics are relatively stable). Key: `timeline:{topic}:{startDate}:{endDate}:{granularity}`

### Integration Points

- Uses `src/lib/rag/hybrid-search.ts` for initial article retrieval
- Uses `src/lib/rag/embedding-service.ts` for event clustering
- Uses `src/lib/rag/cache.ts` for timeline caching
- Output JSON is compatible with front-end charting libraries (Recharts, Chart.js)

### Testing

- Unit tests for each module: extraction prompt formatting, clustering logic, scoring formula, builder ordering
- Integration test: generate timeline for "Bitcoin ETF" using real archive data
- Edge cases: no results found, single event timeline, date range with no articles
