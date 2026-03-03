# Phase 4.3: Personalization System

**Priority:** Medium | **Effort:** 3-4 days | **Impact:** Medium (Priority Score: 5)  
**Dependency:** Phase 4.1 (Feedback Loop System)

---

## Objective

Deliver personalized RAG responses by learning user interests from explicit preferences and implicit behavior (query history, feedback patterns). Boost/demote results based on preferred topics, sources, and reading level. Respect privacy with full user control.

---

## Implementation Prompt

> Build a personalization layer for the RAG system that tracks user preferences (explicit + inferred), adjusts retrieval ranking, adapts response style, and provides privacy controls. Integrate with `src/lib/rag/ultimate-rag-service.ts` and the feedback system from Phase 4.1.

### Files to Create

```
src/lib/rag/personalization/
├── index.ts                    # Public exports
├── types.ts                    # UserProfile, Preferences, PersonalizationConfig
├── user-profile-store.ts       # Persist user profiles (file-based + in-memory)
├── interest-inferrer.ts        # Infer interests from query history & feedback
├── personalized-ranker.ts      # Re-rank results based on user profile
├── response-adapter.ts         # Adapt response style (beginner/expert, concise/detailed)
├── source-weighter.ts          # Weight preferred/blocked sources
└── privacy-controls.ts         # Data export, deletion, opt-out
```

### API Endpoints

```
GET    /api/rag/profile/:userId       # Get user profile
PUT    /api/rag/profile/:userId       # Update explicit preferences
DELETE /api/rag/profile/:userId       # Delete all user data (GDPR)
GET    /api/rag/profile/:userId/export # Export user data (GDPR)
POST   /api/rag/ask                   # Extended with userId + usePersonalization flag
```

### Type Definitions

```typescript
interface UserProfile {
  userId: string;
  createdAt: string;
  updatedAt: string;
  explicit: ExplicitPreferences;
  inferred: InferredPreferences;
  history: QueryHistoryEntry[];
  settings: PersonalizationSettings;
}

interface ExplicitPreferences {
  interests: string[];               // e.g., ['DeFi', 'Ethereum', 'Regulation']
  blockedTopics: string[];           // e.g., ['memecoins']
  preferredSources: string[];        // e.g., ['CoinDesk', 'The Block']
  blockedSources: string[];
  readingLevel: 'beginner' | 'intermediate' | 'expert';
  responseStyle: 'concise' | 'detailed' | 'balanced';
  language?: string;                 // Preferred response language
}

interface InferredPreferences {
  topicScores: Record<string, number>;    // topic → affinity score 0-1
  sourceScores: Record<string, number>;   // source → preference score 0-1
  readingLevelEstimate: 'beginner' | 'intermediate' | 'expert';
  peakActivityHours: number[];            // Hours of day (UTC) when user is most active
  avgQueryComplexity: number;             // 0-1 scale
  lastUpdated: string;
}

interface QueryHistoryEntry {
  queryId: string;
  query: string;
  timestamp: string;
  topics: string[];                       // Extracted from query
  sources: string[];                      // Sources in results
  feedback?: 'positive' | 'negative';
}

interface PersonalizationSettings {
  enabled: boolean;                       // Master toggle
  useInferred: boolean;                   // Use inferred preferences
  historyRetentionDays: number;           // Default: 90
  shareAnonymizedData: boolean;           // For aggregate improvements
}

interface PersonalizationConfig {
  explicitBoost: number;         // Weight for explicit prefs (default: 0.3)
  inferredBoost: number;         // Weight for inferred prefs (default: 0.15)
  historyWindow: number;         // Queries to consider (default: 50)
  decayFactor: number;           // Time decay for old preferences (default: 0.95)
  minInteractions: number;       // Minimum queries before inference (default: 5)
}
```

### Key Implementation Details

1. **Interest Inference** (`interest-inferrer.ts`):
   - Analyze last N queries for recurring entities/topics using `currency-extractor.ts`
   - Weight recent queries higher (exponential decay with `decayFactor`)
   - Cross-reference with feedback: topics where user gave positive feedback get boosted
   - Update inferred preferences after every 5th query (not on every query for perf)
   - Use simple TF-IDF over query history, no additional LLM calls needed

2. **Personalized Ranking** (`personalized-ranker.ts`):
   - Integrate as post-processing step after `reranker.ts` in the RAG pipeline
   - Score adjustment: `finalScore = baseScore + (explicitBoost * topicMatch) + (inferredBoost * inferredMatch) - (blockPenalty)`
   - Source preference: +10% for preferred sources, -50% for blocked sources
   - Never completely remove results — just reorder (user might need diverse info)

3. **Response Adaptation** (`response-adapter.ts`):
   - Beginner: Add glossary links, avoid jargon, use analogies
   - Expert: Include technical details, skip basics, use precise terminology
   - Concise: Limit to 2-3 sentences per point
   - Detailed: Include background, examples, multiple perspectives
   - Implemented as system prompt modifications to the LLM generation step

4. **Source Weighting** (`source-weighter.ts`):
   - Apply source weights during the retrieval phase (before reranking)
   - Preferred sources get `1.0 + sourceBoost` multiplier
   - Blocked sources get `0.0` multiplier (filtered out)
   - Default sources stay at `1.0`

5. **Privacy Controls** (`privacy-controls.ts`):
   - Full data export in JSON format (GDPR Article 20)
   - Complete deletion (GDPR Article 17) — removes profile, history, inferred data
   - Opt-out at any time — disables personalization, retains explicit prefs only
   - All data stored locally (no third-party analytics)

### Storage Strategy

- **Location**: `data/profiles/{userId}.json`
- **In-memory cache**: LRU cache with 1000 profile limit
- **History cap**: Last 200 queries per user, auto-prune oldest
- **Anonymous users**: Session-based profiles (cookie ID), auto-expire after 30 days

### Testing

- Unit tests: interest inference from mock history, ranking adjustment math, response adaptation prompts
- Integration test: create profile → submit queries → verify personalized results differ from default
- Privacy tests: export contains all data, deletion removes all traces, opt-out disables inference
- Edge cases: new user with no history, user with conflicting explicit/inferred preferences
