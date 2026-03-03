# Crypto Vision — Build Prompts

## $110k GCP Credits Strategy: 6-Month Execution Plan

These prompts are designed to be fed to Claude agents to systematically build out the Crypto Vision infrastructure, data pipelines, ML models, and product features using $110k in GCP credits over 6 months.

### Rules for All Agents

1. **Always work on current branch** (`master`)
2. **Always commit and push as `nirholas`**
3. **Always kill terminals** after use (`isBackground: true`, then kill)
4. **Unlimited Claude credits** — build the best possible version of everything
5. **Every dollar produces a permanent artifact** — trained models, datasets, code, not rent

### Prompt Execution Order

| Phase | Month | Prompt | Budget | What You Keep |
|-------|-------|--------|--------|---------------|
| 1 | 1 | [01-bigquery-data-warehouse.md](01-bigquery-data-warehouse.md) | $15-20k | TB-scale datasets (Parquet exports) |
| 2 | 1-2 | [02-data-ingestion-pipelines.md](02-data-ingestion-pipelines.md) | $10k | Pipeline code (portable Beam/TS) |
| 3 | 2 | [03-embeddings-rag-pipeline.md](03-embeddings-rag-pipeline.md) | $10k | Vector indices, RAG corpus |
| 4 | 2-3 | [04-vertex-ai-model-training.md](04-vertex-ai-model-training.md) | $20k | Fine-tuned model weights, eval suites |
| 5 | 3 | [05-open-source-model-finetune.md](05-open-source-model-finetune.md) | $15k | Self-hostable Llama/Mistral weights |
| 6 | 3-4 | [06-anomaly-detection.md](06-anomaly-detection.md) | $5k | Anomaly models + alerting code |
| 7 | 4 | [07-agent-orchestration.md](07-agent-orchestration.md) | $5k | A2A interaction data, orchestration code |
| 8 | 4-5 | [08-testing-hardening.md](08-testing-hardening.md) | $5k | Battle-tested codebase |
| 9 | 5-6 | [09-semantic-search.md](09-semantic-search.md) | $5k | Search index + UI |
| 10 | 6 | [10-export-portability.md](10-export-portability.md) | $5k | Everything downloaded/mirrored |

**Buffer: $10-15k** for overages and opportunistic experiments.

### How to Use

Feed any prompt file to a Claude agent session. Each prompt is self-contained with:
- Exact objectives and deliverables
- GCP services to use with cost estimates
- Code scaffolding to generate
- Validation criteria
- Agent workflow rules (git identity, terminal management, etc.)
