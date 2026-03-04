# Prompt 24 — ML Training & Inference Pipeline

## Context

You are working on the machine learning pipeline for crypto-vision. The project has ML components in multiple locations:

### ML Infrastructure

1. **Training scripts** (`scripts/training/`):
   - `generate-training-data.ts` — Generate training data from BigQuery/API
   - `finetune-gemini.ts` — Fine-tune Gemini models via Vertex AI
   - `eval-models.ts` — Evaluate model performance
   - `validate-data.ts` — Validate training data quality
   - `opensource/` — Open-source model fine-tuning scripts

2. **Inference scripts** (`scripts/inference/`):
   - Runtime inference against trained models

3. **UCAI package** (`packages/ucai/`):
   - Python-based ML package
   - `src/abi_to_mcp/` — ABI to MCP conversion
   - `ucai/` — Core ML module
   - `web/` and `web-v2/` — Web interfaces
   - `pyproject.toml` — Python project config
   - `Makefile` — Build automation
   - Tests in `tests/`

4. **Docker** (`Dockerfile.train`):
   - Training container for GCP Vertex AI

5. **AI route handlers** (`src/routes/`):
   - AI chat, predictions, anomaly detection endpoints
   - Multi-provider: Groq → Gemini → OpenAI → Anthropic → OpenRouter fallback chain

6. **AI library** (`src/lib/ai.ts`):
   - AI provider abstraction
   - Prompt management
   - Response parsing

7. **Existing docs**:
   - `docs/ML_TRAINING.md`
   - `prompts/04-vertex-ai-model-training.md`
   - `prompts/05-open-source-model-finetune.md`

## Task

### 1. Training Data Pipeline (`scripts/training/generate-training-data.ts`)

Complete the training data generator:

```typescript
// Pull data from multiple sources and format for model training:
//
// Data Sources:
//   1. BigQuery — historical price data, market snapshots
//   2. API responses — cached predictions vs actual outcomes
//   3. News corpus — articles with sentiment labels
//   4. Anomaly events — labeled anomalies with resolution
//
// Output Formats:
//   1. JSONL for Gemini fine-tuning (prompt/response pairs)
//   2. CSV for tabular model training (features/labels)
//   3. Parquet for large-scale training (Arrow format)
//
// Training Tasks:
//   a. Price prediction — Given market state, predict 24h price change
//   b. Anomaly detection — Given market metrics, classify anomaly type
//   c. Sentiment analysis — Given news text, classify sentiment
//   d. Token risk scoring — Given token metrics, output risk score 0-100
//
// Quality Checks:
//   - Remove duplicates
//   - Balance class distribution
//   - Validate schema conformance
//   - Split: 80% train, 10% validation, 10% test
//   - Log statistics: total examples, class distribution, date range
```

### 2. Gemini Fine-Tuning (`scripts/training/finetune-gemini.ts`)

Complete the Vertex AI fine-tuning script:

```typescript
// 1. Upload training data to GCS bucket
// 2. Create Vertex AI tuning job:
//    - Base model: gemini-1.5-flash or gemini-2.0-flash
//    - Training data: gs://bucket/training-data.jsonl
//    - Validation data: gs://bucket/validation-data.jsonl
//    - Hyperparameters: epochs, learning_rate_multiplier, batch_size
// 3. Monitor job progress (poll status every 30s)
// 4. On completion: save model endpoint, run evaluation
// 5. Log metrics: loss curve, accuracy, latency
```

### 3. Model Evaluation (`scripts/training/eval-models.ts`)

Complete the evaluation framework:

```typescript
// Evaluate models against test data:
//
// Metrics:
//   - Price prediction: MAE, RMSE, directional accuracy
//   - Anomaly detection: precision, recall, F1, AUC-ROC
//   - Sentiment: accuracy, macro-F1, confusion matrix
//   - Risk scoring: Spearman correlation, calibration
//
// Comparison:
//   - Base model vs fine-tuned model
//   - Different model sizes
//   - Latency vs accuracy tradeoff
//
// Output:
//   - Evaluation report (Markdown)
//   - Metrics JSON for tracking
//   - Comparison charts (if matplotlib available)
```

### 4. Open-Source Model Fine-Tuning (`scripts/training/opensource/`)

Create scripts for fine-tuning open-source models:

```typescript
// Target models:
//   - Llama 3.1 8B (for local inference)
//   - Mistral 7B (for sentiment analysis)
//
// Method: LoRA (Low-Rank Adaptation)
// Framework: Use Hugging Face Transformers via Python subprocess
//
// Workflow:
//   1. Export training data to HuggingFace datasets format
//   2. Run Python fine-tuning script:
//      - LoRA rank: 16, alpha: 32
//      - Batch size: 4, gradient accumulation: 4
//      - Learning rate: 2e-4
//      - Epochs: 3
//   3. Merge LoRA weights
//   4. Quantize to GGUF (4-bit) for local deployment
//   5. Evaluate on test set
```

### 5. UCAI Package (`packages/ucai/`)

Audit and fix the Python ML package:
- Review `pyproject.toml` — ensure correct dependencies
- Review `src/abi_to_mcp/` — ABI to MCP tool conversion
- Review `ucai/` — core ML utilities
- Ensure `make build` works
- Ensure `make test` passes
- Fix any import errors or missing dependencies

### 6. Inference Integration (`scripts/inference/`)

Create inference scripts and integrate with the API:

```typescript
// src/lib/inference.ts
//
// InferenceProvider interface:
//   predict(input: PredictionInput): Promise<PredictionResult>
//
// Implementations:
//   1. VertexAIProvider — Call fine-tuned Gemini endpoint
//   2. LocalModelProvider — Call local GGUF model via llama.cpp HTTP server
//   3. FallbackProvider — Chain providers with fallback
//
// Integration with API routes:
//   - POST /api/ai/predict — Use fine-tuned model for predictions
//   - POST /api/ai/analyze — Use fine-tuned model for analysis
//   - POST /api/ai/sentiment — Use fine-tuned model for sentiment
//
// Caching: Redis cache predictions for 5 minutes
// Monitoring: Track inference latency, error rate, result distribution
```

### 7. Training Docker Container (`Dockerfile.train`)

Review and fix the training Dockerfile:
```dockerfile
# Should:
# - Use Python 3.11+ base image
# - Install Node.js 22 for TypeScript training scripts
# - Install ML dependencies (torch, transformers, datasets)
# - Install gcloud CLI for Vertex AI
# - Copy training scripts
# - Set entrypoint to run training pipeline
```

### 8. Data Validation (`scripts/training/validate-data.ts`)

Complete data validation:
```typescript
// Validate training data quality:
// - Schema validation (each example has required fields)
// - Content validation (no empty strings, valid ranges)
// - Distribution checks (class balance, feature ranges)
// - Duplicate detection
// - Temporal validation (dates are in expected range)
// - Cross-reference with source data for accuracy
// Output: validation report with pass/fail and statistics
```

## Verification

1. `npx tsx scripts/training/generate-training-data.ts --dry-run` works
2. `npx tsx scripts/training/validate-data.ts --input data/training.jsonl` validates correctly
3. `npx tsx scripts/training/eval-models.ts --help` shows usage
4. `cd packages/ucai && make build` succeeds
5. `Dockerfile.train` builds: `docker build -f Dockerfile.train -t train .`
6. TypeScript compiles: `npx tsc --noEmit`
7. Training data output conforms to Gemini fine-tuning format
