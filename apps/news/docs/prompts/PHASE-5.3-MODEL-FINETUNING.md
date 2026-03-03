# Phase 5.3: Model Fine-tuning Pipeline

**Priority:** Medium | **Effort:** 5+ days | **Impact:** Very High (Priority Score: 8)  
**Dependency:** Phase 2.1 (RAGAS Evaluation Framework)

---

## Objective

Build an end-to-end pipeline for fine-tuning embedding models and rerankers on crypto news data. Custom models dramatically improve retrieval quality for domain-specific queries. Includes training data preparation, model training/uploading, versioning, A/B testing between model versions, and rollback capability.

---

## Implementation Prompt

> Build a model fine-tuning pipeline for the RAG system. The pipeline prepares training data from crypto news archives and user feedback, fine-tunes embedding models (OpenAI or Sentence Transformers) and rerankers, versions models, A/B tests new vs. old, and supports instant rollback. Integrate with the evaluation framework from Phase 2.1 and feedback system from Phase 4.1.

### Files to Create

```
src/lib/rag/fine-tuning/
├── index.ts                    # Public exports
├── types.ts                    # TrainingConfig, ModelVersion, ABTest, etc.
├── data-preparer.ts            # Extract & format training pairs from archive + feedback
├── embedding-trainer.ts        # Fine-tune embedding models (OpenAI API or local)
├── reranker-trainer.ts         # Fine-tune reranker (cross-encoder training)
├── model-registry.ts           # Version management, storage, metadata
├── ab-tester.ts                # Run A/B tests between model versions
├── rollback-manager.ts         # Instant rollback to previous model version
├── training-scheduler.ts       # Schedule periodic retraining (weekly/monthly)
└── evaluation-bridge.ts        # Connect to RAGAS evaluator for automated quality checks
```

### Type Definitions

```typescript
interface TrainingConfig {
  name: string;
  type: 'embedding' | 'reranker';
  baseModel: string;                 // e.g., 'text-embedding-3-small' or 'BAAI/bge-reranker-base'
  dataSource: {
    archive: boolean;                // Use news archive for positive pairs
    feedback: boolean;               // Use user feedback for quality signals
    synthetic: boolean;              // Generate synthetic training data via LLM
    minExamples: number;             // Minimum training examples required (default: 1000)
  };
  hyperparameters: {
    epochs: number;                  // Default: 3
    batchSize: number;               // Default: 32
    learningRate: number;            // Default: 2e-5
    warmupSteps: number;             // Default: 100
    maxSequenceLength: number;       // Default: 512
  };
  validation: {
    splitRatio: number;              // Train/val split (default: 0.9)
    earlyStoppingPatience: number;   // Epochs without improvement (default: 2)
    minImprovement: number;          // Min eval improvement to continue (default: 0.01)
  };
  autoPromote: boolean;              // Auto-promote if eval passes threshold
  evalThreshold: number;             // Minimum eval score to promote (default: 0.85)
}

interface TrainingPair {
  query: string;
  positive: string;                  // Relevant document content
  negative?: string;                 // Irrelevant document (hard negative)
  score?: number;                    // Relevance score 0-1 (for reranker)
  source: 'archive' | 'feedback' | 'synthetic';
}

interface ModelVersion {
  id: string;                        // e.g., 'emb-v2-20260315'
  type: 'embedding' | 'reranker';
  baseModel: string;
  version: number;
  status: 'training' | 'evaluating' | 'staged' | 'active' | 'deprecated' | 'failed';
  createdAt: string;
  trainingMetrics: {
    loss: number;
    epochs: number;
    trainingExamples: number;
    trainingDuration: number;        // seconds
  };
  evaluationMetrics?: {
    faithfulness: number;
    relevance: number;
    contextPrecision: number;
    contextRecall: number;
    improvement: number;             // % improvement over previous version
  };
  config: TrainingConfig;
  artifactPath: string;              // Path to model artifacts
  promotedAt?: string;
  deprecatedAt?: string;
  notes?: string;
}

interface ABTestConfig {
  id: string;
  name: string;
  modelA: string;                    // ModelVersion ID (control)
  modelB: string;                    // ModelVersion ID (challenger)
  trafficSplit: number;              // 0-1, fraction going to B (default: 0.2)
  minSamples: number;               // Minimum queries before concluding (default: 100)
  maxDuration: number;               // Max test duration in hours (default: 168 = 1 week)
  metrics: string[];                 // Metrics to compare
  autoPromote: boolean;              // Auto-promote winner
  status: 'running' | 'concluded' | 'cancelled';
}

interface ABTestResult {
  testId: string;
  winner: 'A' | 'B' | 'inconclusive';
  samplesA: number;
  samplesB: number;
  metricsA: Record<string, number>;
  metricsB: Record<string, number>;
  pValues: Record<string, number>;   // Statistical significance per metric
  confidence: number;                // Overall confidence 0-1
  recommendation: string;            // Human-readable recommendation
}
```

### Key Implementation Details

1. **Data Preparation** (`data-preparer.ts`):
   - **Archive mining**: Generate (query, relevant_doc) pairs from article titles → article content
   - **Feedback pairs**: Positive-rated query-answer pairs become training examples
   - **Synthetic data**: Use LLM to generate questions from articles: "Generate 3 questions that this article answers"
   - **Hard negative mining**: For each positive pair, find semantically similar but irrelevant docs (highest-scoring wrong answers)
   - Format: JSONL with fields: `{"query": "", "pos": "", "neg": "", "score": 0.0}`
   - Target: 5,000+ training pairs for embedding, 2,000+ for reranker

2. **Embedding Trainer** (`embedding-trainer.ts`):
   - **OpenAI path**: Use OpenAI fine-tuning API for `text-embedding-3-small`
     - Upload training file, create fine-tuning job, poll for completion
     - Returns fine-tuned model ID to use in API calls
   - **Local path**: Use Sentence Transformers (Python subprocess) for open models
     - Train `BAAI/bge-small-en-v1.5` with contrastive loss
     - Export to ONNX for fast inference, store in `data/models/`
   - Both paths: validate output dimensions match existing vector store

3. **Reranker Trainer** (`reranker-trainer.ts`):
   - Fine-tune cross-encoder on (query, document, score) triples
   - Use `BAAI/bge-reranker-base` as starting point
   - Train with binary cross-entropy loss (relevant=1, irrelevant=0)
   - Export trained model, integrate with existing `reranker.ts`

4. **Model Registry** (`model-registry.ts`):
   - Track all model versions in `data/models/registry.json`
   - States: training → evaluating → staged → active (or failed at any step)
   - Only one model per type can be `active` at a time
   - Keep last 3 versions for quick rollback
   - Store artifacts: model files, training config, eval results, training logs

5. **A/B Testing** (`ab-tester.ts`):
   - Route N% of traffic to challenger model based on `trafficSplit`
   - Use consistent hashing on query text for deterministic routing
   - Collect metrics per variant: latency, faithfulness, user feedback
   - Statistical test: two-sample t-test with Bonferroni correction for multiple metrics
   - Auto-promote if p-value < 0.05 and challenger wins on primary metric

6. **Rollback** (`rollback-manager.ts`):
   - Instant rollback: swap active model ID in registry, no reprocessing needed
   - Re-embedding rollback: if new embeddings are incompatible, fall back to previous vector store snapshot
   - Automated rollback trigger: if error rate spikes 3x within 15 minutes of promotion

7. **Training Scheduler** (`training-scheduler.ts`):
   - Weekly data preparation: generate fresh training pairs from new articles
   - Monthly retraining: if enough new data accumulated (>500 new pairs)
   - Cron-based: `0 2 * * 0` (Sunday 2AM UTC) for data prep, `0 2 1 * *` (1st of month) for training
   - Configurable via env: `FINETUNE_SCHEDULE=weekly|monthly|manual`

### API Endpoints

```
POST   /api/rag/models/train          # Start training job
GET    /api/rag/models                 # List all model versions
GET    /api/rag/models/:id             # Get model version details
POST   /api/rag/models/:id/promote     # Promote to active
POST   /api/rag/models/:id/rollback    # Rollback to this version
POST   /api/rag/models/ab-test         # Start A/B test
GET    /api/rag/models/ab-test/:id     # Get A/B test results
DELETE /api/rag/models/ab-test/:id     # Cancel A/B test
```

### Environment Variables

```
FINETUNE_ENABLED=true|false           # Master toggle (default: false)
FINETUNE_SCHEDULE=weekly|monthly|manual
FINETUNE_PROVIDER=openai|local        # Training provider
FINETUNE_MIN_EXAMPLES=1000            # Minimum training examples
FINETUNE_AUTO_PROMOTE=false           # Auto-promote after eval passes
OPENAI_FINETUNE_MODEL=text-embedding-3-small
```

### Testing

- Unit tests: data preparation output format, registry state transitions, A/B traffic splitting
- Integration test: prepare data → mock training → register model → A/B test → promote
- Rollback test: promote bad model → detect quality drop → auto-rollback → verify recovery
- Edge cases: training with insufficient data, model version conflicts, concurrent A/B tests
