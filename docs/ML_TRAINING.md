# ML Training Pipeline

> Fine-tuning crypto-specialized LLMs with Vertex AI (Gemini) and open-source models (Llama, Mistral, Qwen).

## Overview

Crypto Vision trains domain-specific language models for cryptocurrency analysis. The pipeline generates training data from live API endpoints, validates it, and fine-tunes models through two paths:

1. **Vertex AI (Gemini)** — managed fine-tuning on GCP with Gemini 2.0 Flash
2. **Open-Source (Llama/Mistral/Qwen)** — QLoRA fine-tuning with Unsloth on GPU nodes

```
Live Market APIs  →  Training Data Generator  →  Validation  →  Fine-Tuning
                                                                    │
                                                    ┌───────────────┼───────────────┐
                                                    │               │               │
                                              Vertex AI         Local GPU       GKE GPU
                                              (Gemini)          (Unsloth)       (K8s Job)
                                                    │               │               │
                                                    └───────────────┼───────────────┘
                                                                    │
                                                              Inference
                                                    ┌───────────────┼───────────────┐
                                                    │               │               │
                                              Vertex AI         vLLM            K8s Inference
                                              Endpoint          Server          Deployment
```

## Quick Start

```bash
# 1. Generate training data from live APIs
npm run training:generate

# 2. Validate the JSONL output
npm run training:validate

# 3a. Fine-tune on Vertex AI (Gemini)
npm run training:finetune

# 3b. Prepare for open-source training
npm run training:prepare

# 3b. Train locally with QLoRA
cd scripts/training/opensource
pip install -r requirements.txt
python train.py --model llama-3.1-8b --data-dir ../data

# 4. Evaluate
npm run training:eval
```

## Scripts

### NPM Commands

| Script | Command | Description |
|--------|---------|-------------|
| `training:generate` | `tsx scripts/training/generate-training-data.ts` | Generate SFT datasets from live APIs |
| `training:validate` | `tsx scripts/training/validate-data.ts` | Validate JSONL format and structure |
| `training:finetune` | `tsx scripts/training/finetune-gemini.ts` | Submit Vertex AI Gemini fine-tuning jobs |
| `training:eval` | `tsx scripts/training/eval-models.ts` | Evaluate model performance |
| `training:eval:quick` | `tsx scripts/training/eval-models.ts quick` | Quick evaluation mode |
| `training:retrain` | `tsx scripts/training/retrain.ts` | Automated retraining pipeline |
| `training:prepare` | `tsx scripts/training/opensource/prepare-data.ts` | Merge, deduplicate, shuffle, split JSONL |

### File Structure

```
scripts/
├── training/
│   ├── generate-training-data.ts   # 853 lines — generates 7 categories from live APIs
│   ├── validate-data.ts            # 404 lines — validates JSONL, estimates costs
│   ├── finetune-gemini.ts          # 522 lines — Vertex AI fine-tuning pipeline
│   ├── eval-models.ts              # Model evaluation (placeholder)
│   ├── retrain.ts                  # Automated retraining
│   └── opensource/
│       ├── train.py                # 466 lines — LoRA + Unsloth fine-tuning
│       ├── prepare-data.ts         # 281 lines — data preparation pipeline
│       ├── config.ts               # 270 lines — model defs + hyperparams
│       ├── benchmark.py            # 457 lines — throughput/latency/quality
│       ├── export.py               # 409 lines — GCS model upload/download
│       └── requirements.txt        # Python dependencies
├── inference/
│   ├── serve.py                    # vLLM inference server
│   └── healthcheck.py             # Inference health check
```

## Training Data Generation

`generate-training-data.ts` creates supervised fine-tuning pairs from live API data across 7 categories:

| Category | Pairs | Source | Description |
|----------|-------|--------|-------------|
| Sentiment | ~500 | CoinGecko + RSs | Coin sentiment analysis with rationale |
| Signals | ~300 | CoinGecko + DeFiLlama | Trading signal detection |
| Digest | ~200 | All sources | Market summary generation |
| Risk | ~400 | DeFiLlama | DeFi protocol risk assessment |
| Yield | ~300 | DeFiLlama | Yield farming strategy analysis |
| Whale | ~200 | Etherscan + Blockchair | Whale activity pattern analysis |
| Narrative | ~200 | News + Market | Market narrative detection |

Output: JSONL files in `scripts/training/data/` following the ChatML format:

```jsonl
{"messages": [{"role": "system", "content": "You are a crypto market analyst..."}, {"role": "user", "content": "Analyze BTC sentiment given: price $68,432..."}, {"role": "assistant", "content": "{\"sentiment\": \"bullish\", \"score\": 78, ...}"}]}
```

## Vertex AI (Gemini) Fine-Tuning

### Models

7 specialized Gemini models, each fine-tuned for a specific task:

| Model | Base | Training Data | Epochs | LR | Adapter Size |
|-------|------|--------------|--------|-----|-------------|
| `crypto-vision-sentiment-v1` | `gemini-2.0-flash-001` | `sentiment-pairs.jsonl` | 5 | 1.0 | 4 |
| `crypto-vision-signals-v1` | `gemini-2.0-flash-001` | `signals-pairs.jsonl` | 3 | 0.5 | 4 |
| `crypto-vision-digest-v1` | `gemini-2.0-flash-001` | `digest-pairs.jsonl` | 5 | 1.0 | 8 |
| `crypto-vision-risk-v1` | `gemini-2.0-flash-001` | `risk-pairs.jsonl` | 4 | 0.8 | 4 |
| `crypto-vision-yield-v1` | `gemini-2.0-flash-001` | `yield-pairs.jsonl` | 4 | 0.8 | 4 |
| `crypto-vision-whale-v1` | `gemini-2.0-flash-001` | `whale-pairs.jsonl` | 4 | 0.8 | 4 |
| `crypto-vision-narrative-v1` | `gemini-2.0-flash-001` | `narrative-pairs.jsonl` | 5 | 1.0 | 8 |

### Pipeline

```
1. Upload JSONL to GCS (gs://{project}-training-data/)
2. Submit SupervisedTuningJob to Vertex AI
3. Vertex trains model (typically 1-4 hours)
4. Model available as Vertex AI endpoint
5. Update VERTEX_FINETUNED_MODEL env var
```

### Environment

```env
GCP_PROJECT_ID=your-project
GCP_REGION=us-central1
```

## Open-Source Model Fine-Tuning

### Supported Models

| Model | HuggingFace ID | GPU | Train Time | Inference | Quantization |
|-------|---------------|-----|------------|-----------|-------------|
| **Llama 3.1 8B** (primary) | `meta-llama/Llama-3.1-8B-Instruct` | L4 24GB | ~8 hrs | ~50 tok/s | GPTQ-4bit |
| **Llama 3.1 70B** (secondary) | `meta-llama/Llama-3.1-70B-Instruct` | A100 80GB | ~24 hrs | ~15 tok/s | AWQ-4bit |
| **Mistral 7B** (tertiary) | `mistralai/Mistral-7B-Instruct-v0.3` | L4 24GB | ~6 hrs | ~60 tok/s | GPTQ-4bit |
| **Qwen 2.5 7B** | `Qwen/Qwen2.5-7B-Instruct` | L4 24GB | ~6 hrs | ~55 tok/s | GPTQ-4bit |

### QLoRA Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| Rank (r) | 16 | LoRA rank |
| Alpha | 32 | LoRA alpha (2x rank) |
| Dropout | 0.05 | LoRA dropout |
| Target Modules | `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj` | Attention + MLP projections |
| Quantization | 4-bit NF4 | Base model quantization |
| Optimizer | `adamw_8bit` | Memory-efficient optimizer |
| Learning Rate | 2e-4 | Peak learning rate |
| Scheduler | Cosine | LR schedule |
| Warmup Ratio | 0.03 | Warm-up proportion |
| Max Seq Length | 4096 | Maximum sequence length |
| Batch Size | 4 (x4 gradient accumulation) | Effective batch size 16 |

### Training Command

```bash
cd scripts/training/opensource
pip install -r requirements.txt

# Train with Unsloth (recommended)
python train.py \
  --model llama-3.1-8b \
  --data-dir ../data \
  --output-dir ./output \
  --epochs 3

# With Weights & Biases tracking
WANDB_API_KEY=your-key python train.py \
  --model llama-3.1-8b \
  --data-dir ../data \
  --wandb-project crypto-vision
```

### Pipeline

```
1. prepare-data.ts: Merge JSONL files → dedup → shuffle → train/val split (90/10)
2. train.py: Load base model (4-bit) → apply LoRA → train → merge → quantize
3. export.py: Upload merged model to GCS / HuggingFace Hub
4. benchmark.py: Measure throughput, latency, and output quality
```

## Inference

### vLLM Server

```bash
cd scripts/inference

# Serve fine-tuned model
python serve.py \
  --model ./output/merged \
  --port 8000 \
  --tensor-parallel-size 1

# Health check
python healthcheck.py --url http://localhost:8000
```

### Environment

```env
SELF_HOSTED_URL=http://gpu-node:8000/v1
```

The AI engine automatically routes to the self-hosted model when `SELF_HOSTED_URL` is set, before falling back to cloud providers.

### Kubernetes Inference

Deploy as a K8s Deployment with GPU node selector:

```bash
kubectl apply -f infra/k8s/inference.yaml
```

See `infra/k8s/inference.yaml` for the full deployment spec (GPU requests, readiness probes, autoscaling).

## Docker GPU Container

`Dockerfile.train` provides a complete GPU training environment:

| Component | Version |
|-----------|---------|
| CUDA | 12.4.1 |
| Python | 3.11 |
| PyTorch | 2.4 |
| Transformers | Latest |
| PEFT | Latest |
| TRL | Latest |
| Unsloth | Latest |
| vLLM | Latest |
| AutoGPTQ | Latest |
| AutoAWQ | Latest |
| bitsandbytes | Latest |

```bash
# Build
docker build -f Dockerfile.train -t crypto-vision-train:latest .

# Run training
docker run --gpus all \
  -v ./scripts/training/data:/data \
  -v ./output:/output \
  crypto-vision-train:latest \
  python /app/scripts/training/opensource/train.py \
    --model llama-3.1-8b \
    --data-dir /data \
    --output-dir /output

# Run inference
docker run --gpus all -p 8000:8000 \
  -v ./output:/model \
  crypto-vision-train:latest \
  python /app/scripts/inference/serve.py \
    --model /model/merged \
    --port 8000
```

## Benchmarking

```bash
cd scripts/training/opensource

python benchmark.py \
  --model ./output/merged \
  --test-file ../data/test.jsonl \
  --report-file benchmark-report.json
```

Measures:
- **Throughput** — tokens per second
- **Latency** — P50/P95/P99 response times
- **Quality** — BLEU, ROUGE, and domain-specific crypto accuracy metrics

## GKE GPU Training Job

For large models (70B), use the GKE GPU cluster:

```bash
# Provision GPU cluster (Terraform)
cd infra/terraform
terraform apply -target=google_container_cluster.gpu_cluster

# Submit training job
kubectl apply -f infra/k8s/training-job.yaml
```

The training job provisions A100 80GB GPUs, runs training, and uploads results to GCS.

## Automated Retraining

The `training:retrain` script runs the full pipeline:

```bash
npm run training:retrain
```

1. Generate fresh training data from live APIs
2. Validate generated data
3. Submit Vertex AI fine-tuning job
4. Wait for completion
5. Run evaluation
6. Update model endpoint if quality improves

Scheduled via Cloud Scheduler for weekly retraining.
