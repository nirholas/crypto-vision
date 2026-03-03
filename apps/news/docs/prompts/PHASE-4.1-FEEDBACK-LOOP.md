# Phase 4.1: Feedback Loop System

**Priority:** Medium | **Effort:** 2 days | **Impact:** High (Priority Score: 8)  
**Dependency:** Phase 1.1 (REST API Routes)

---

## Objective

Build a feedback collection and analysis system that enables continuous improvement of RAG answer quality. Users rate responses (thumbs up/down), optionally categorize issues, and leave comments. Aggregated feedback drives training data generation and automatic quality alerts.

---

## Implementation Prompt

> Implement a feedback loop system for the existing RAG pipeline in `src/lib/rag/`. The system collects user feedback on RAG responses, stores it persistently, analyzes quality trends, exports training data, and integrates with A/B testing. Use the existing RAG types from `src/lib/rag/types.ts`.

### Files to Create

```
src/lib/rag/feedback/
├── index.ts              # Public exports
├── types.ts              # FeedbackEntry, FeedbackStats, TrainingExample
├── feedback-store.ts     # In-memory + file-based persistent storage
├── feedback-service.ts   # Collection, validation, aggregation
├── quality-alerts.ts     # Automatic alerts when quality drops
├── training-export.ts    # Export positive/negative pairs for fine-tuning
└── ab-integration.ts     # Tag feedback with experiment variants
```

### API Endpoints (in `src/app/api/rag/feedback/`)

```
POST /api/rag/feedback          # Submit feedback
GET  /api/rag/feedback/stats    # Get aggregated stats
GET  /api/rag/feedback/export   # Export training data (JSON/JSONL)
GET  /api/rag/feedback/alerts   # Get active quality alerts
```

### Type Definitions

```typescript
interface FeedbackEntry {
  id: string;
  queryId: string;
  query: string;
  answer: string;
  rating: 'positive' | 'negative';
  category?: 'accuracy' | 'relevance' | 'completeness' | 'timeliness' | 'other';
  comment?: string;
  sources: string[];        // source URLs from the RAG response
  timestamp: string;        // ISO 8601
  experimentId?: string;    // For A/B testing
  variant?: string;
  userId?: string;          // Anonymous or authenticated
  metadata?: Record<string, unknown>;
}

interface FeedbackStats {
  total: number;
  positive: number;
  negative: number;
  satisfactionRate: number; // positive / total
  byCategory: Record<string, { positive: number; negative: number }>;
  byDay: Array<{ date: string; positive: number; negative: number }>;
  topIssues: Array<{ query: string; negativeCount: number }>;
  trend: 'improving' | 'stable' | 'declining';
}

interface TrainingExample {
  query: string;
  positiveAnswer: string;
  negativeAnswer?: string;
  context: string[];
  rating: number;
}

interface QualityAlert {
  id: string;
  type: 'satisfaction_drop' | 'high_negative_rate' | 'category_spike';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  triggeredAt: string;
}
```

### Key Business Logic

1. **Feedback Collection**: Validate `queryId` matches a recent query (within 24h), prevent duplicate submissions, rate-limit per IP (10/min)
2. **Rating Analysis**: Rolling 7-day satisfaction rate, category breakdown, trend detection using linear regression on daily rates
3. **Quality Alerts**: Trigger when satisfaction drops below 70% (warning) or 50% (critical), or any category spikes 2x above baseline
4. **Training Data Export**: Pair positive-rated Q&A with their contexts, optionally include negative examples as contrast pairs. Output JSONL format compatible with OpenAI fine-tuning
5. **A/B Integration**: Accept `experimentId` + `variant` fields, aggregate feedback per variant for significance testing

### Storage Strategy

- **Primary**: JSON file in `data/feedback/` directory (no external DB required)
- **Index**: In-memory Map for fast lookups, rebuilt on startup from file
- **Rotation**: Auto-archive monthly files, keep last 6 months active
- **Max Size**: 100K entries before oldest are archived

### Testing

- Unit tests for feedback validation, stats aggregation, alert triggering
- Integration test: submit feedback → verify stats update → check alert trigger
- Edge cases: duplicate submissions, malformed data, storage full
