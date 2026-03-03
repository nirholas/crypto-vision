# Prompt 05: Open-Source Model Fine-Tuning (Self-Hostable)

## Agent Identity & Rules

```
You are fine-tuning open-source LLMs (Llama 3, Mistral, Qwen) on GCP GPUs for Crypto Vision.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- The goal: produce model weights you can self-host on a $50/mo GPU box after credits expire
- No mocks, no fakes, no stubs — real implementations only
```

## Objective

Fine-tune open-source LLMs on crypto-specific data using GCP GPU instances. The result is a self-hostable model that eliminates dependency on paid API providers. After 6 months, you run this model on a single A10G GPU for ~$0.50/hr and never pay per-token again.

## Budget: $15k

- GKE with GPUs: ~$3/hr (A100 40GB), ~$1.50/hr (L4), ~$7.50/hr (A100 80GB)
- Training 3 models × ~40hrs each ≈ $3,600
- Evaluation and iteration: ~$2,000
- Buffer for experimentation: ~$9,400

## Current State

- Training data from Prompt 04 (JSONL pairs for sentiment, signals, digest, risk, Q&A)
- Evaluation framework from Prompt 04
- BigQuery data warehouse with historical market data
- 43 agent system prompts available for domain knowledge

## Deliverables

### 1. Model Selection & Training Config (`scripts/training/opensource/`)

```typescript
// scripts/training/opensource/config.ts
// Configuration for open-source model fine-tuning

export const MODELS = {
  // Primary: Best quality/speed tradeoff
  "llama-3.1-8b": {
    huggingFaceId: "meta-llama/Llama-3.1-8B-Instruct",
    gpuRequirement: "L4",     // 24GB VRAM is enough with LoRA
    trainingTime: "~8hrs",
    inferenceSpeed: "~50 tok/s on L4",
    selfHostCost: "$0.50/hr on L4",
    quantization: "GPTQ-4bit",  // For cheap inference
  },
  
  // Secondary: Higher quality
  "llama-3.1-70b": {
    huggingFaceId: "meta-llama/Llama-3.1-70B-Instruct",
    gpuRequirement: "A100-80GB",  // Need 80GB for LoRA
    trainingTime: "~24hrs",
    inferenceSpeed: "~15 tok/s on A100",
    selfHostCost: "$3/hr on A100",
    quantization: "AWQ-4bit",     // Fits on single A100
  },

  // Tertiary: Fast and cheap
  "mistral-7b": {
    huggingFaceId: "mistralai/Mistral-7B-Instruct-v0.3",
    gpuRequirement: "L4",
    trainingTime: "~6hrs",
    inferenceSpeed: "~60 tok/s on L4",
    selfHostCost: "$0.50/hr on L4",
    quantization: "GPTQ-4bit",
  },

  // Qwen: Excellent at structured output
  "qwen-2.5-7b": {
    huggingFaceId: "Qwen/Qwen2.5-7B-Instruct",
    gpuRequirement: "L4",
    trainingTime: "~6hrs",
    inferenceSpeed: "~55 tok/s on L4",
    selfHostCost: "$0.50/hr on L4",
    quantization: "GPTQ-4bit",
  },
};

export const TRAINING_CONFIG = {
  // LoRA hyperparameters (proven defaults for instruction tuning)
  lora: {
    r: 16,              // LoRA rank
    alpha: 32,          // LoRA alpha (usually 2x rank)
    dropout: 0.05,
    targetModules: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    taskType: "CAUSAL_LM",
  },
  
  training: {
    perDeviceBatchSize: 4,
    gradientAccumulationSteps: 4,  // Effective batch size = 16
    warmupSteps: 100,
    numEpochs: 3,
    learningRate: 2e-4,
    weightDecay: 0.01,
    optimizer: "adamw_8bit",       // Memory efficient
    scheduler: "cosine",
    maxSeqLength: 4096,
    packingSamples: true,          // Pack short samples to save compute
    bf16: true,                    // BF16 for faster training
  },
  
  evaluation: {
    evalSteps: 100,
    saveSteps: 200,
    loggingSteps: 10,
  },
};
```

### 2. GKE GPU Cluster Setup (`infra/terraform/gke-gpu.tf`)

```hcl
# GKE cluster with GPU node pool for training
resource "google_container_cluster" "training" {
  name     = "crypto-vision-training"
  location = var.region
  
  # Autopilot for cost efficiency (auto-scales GPU nodes)
  enable_autopilot = true
  
  ip_allocation_policy {
    # Required for autopilot
  }
}

# Alternative: Standard cluster with specific GPU node pool
resource "google_container_node_pool" "gpu_l4" {
  name       = "gpu-l4-pool"
  cluster    = google_container_cluster.training.id
  node_count = 0  # Scale from 0

  autoscaling {
    min_node_count = 0
    max_node_count = 4
  }

  node_config {
    machine_type = "g2-standard-8"  # L4 GPU
    
    guest_accelerator {
      type  = "nvidia-l4"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "LATEST"
      }
    }

    disk_size_gb = 200
    disk_type    = "pd-ssd"
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
  }
}

resource "google_container_node_pool" "gpu_a100" {
  name       = "gpu-a100-pool"
  cluster    = google_container_cluster.training.id
  node_count = 0

  autoscaling {
    min_node_count = 0
    max_node_count = 2
  }

  node_config {
    machine_type = "a2-highgpu-1g"  # A100 40GB
    
    guest_accelerator {
      type  = "nvidia-tesla-a100"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "LATEST"
      }
    }

    disk_size_gb = 500
    disk_type    = "pd-ssd"
  }
}
```

### 3. Training Script (Python — runs on GPU node)

```python
# scripts/training/opensource/train.py
# Fine-tune open-source LLM using LoRA + Unsloth (2x faster training)

import os
import json
import argparse
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="meta-llama/Llama-3.1-8B-Instruct")
    parser.add_argument("--data", default="data/training/all-pairs.jsonl")
    parser.add_argument("--output", default="models/crypto-vision-llama-8b")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--max-seq-len", type=int, default=4096)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--quantize", action="store_true", help="Quantize after training")
    args = parser.parse_args()

    # Use Unsloth for 2x faster training
    from unsloth import FastLanguageModel
    from datasets import load_dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments
    from peft import LoraConfig

    print(f"Loading model: {args.model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model,
        max_seq_length=args.max_seq_len,
        dtype=None,  # Auto-detect
        load_in_4bit=True,  # QLoRA
    )

    # Apply LoRA
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        lora_alpha=args.lora_r * 2,
        lora_dropout=0.05,
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    # Load training data
    print(f"Loading data: {args.data}")
    dataset = load_dataset("json", data_files=args.data, split="train")
    
    # Format for chat template
    def format_chat(example):
        messages = example["messages"]
        formatted = tokenizer.apply_chat_template(messages, tokenize=False)
        return {"text": formatted}
    
    dataset = dataset.map(format_chat)

    # Split train/eval
    split = dataset.train_test_split(test_size=0.05, seed=42)
    train_data = split["train"]
    eval_data = split["test"]

    print(f"Training: {len(train_data)} examples, Eval: {len(eval_data)} examples")

    # Training
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_data,
        eval_dataset=eval_data,
        dataset_text_field="text",
        max_seq_length=args.max_seq_len,
        packing=True,
        args=TrainingArguments(
            output_dir=args.output,
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=4,
            warmup_steps=100,
            learning_rate=args.lr,
            weight_decay=0.01,
            fp16=False,
            bf16=True,
            logging_steps=10,
            eval_strategy="steps",
            eval_steps=100,
            save_strategy="steps",
            save_steps=200,
            save_total_limit=3,
            lr_scheduler_type="cosine",
            optim="adamw_8bit",
            seed=42,
            report_to="none",
        ),
    )

    print("Starting training...")
    trainer.train()

    # Save model
    print(f"Saving model to {args.output}")
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)

    # Merge LoRA weights into base model for deployment
    merged_path = f"{args.output}-merged"
    print(f"Merging LoRA weights to {merged_path}")
    model = model.merge_and_unload()
    model.save_pretrained(merged_path)
    tokenizer.save_pretrained(merged_path)

    # Optional: Quantize for cheap inference
    if args.quantize:
        print("Quantizing to GPTQ 4-bit...")
        from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig
        
        quantize_config = BaseQuantizeConfig(
            bits=4,
            group_size=128,
            desc_act=True,
        )
        
        quantized_path = f"{args.output}-gptq-4bit"
        quantized_model = AutoGPTQForCausalLM.from_pretrained(
            merged_path,
            quantize_config=quantize_config,
            device_map="auto",
        )
        quantized_model.quantize(train_data.select(range(min(256, len(train_data)))))
        quantized_model.save_quantized(quantized_path)
        tokenizer.save_pretrained(quantized_path)
        print(f"Quantized model saved to {quantized_path}")

    # Upload to GCS
    if os.environ.get("GCS_BUCKET"):
        print("Uploading to GCS...")
        import subprocess
        bucket = os.environ["GCS_BUCKET"]
        subprocess.run(["gsutil", "-m", "cp", "-r", args.output, f"gs://{bucket}/models/"], check=True)
        subprocess.run(["gsutil", "-m", "cp", "-r", merged_path, f"gs://{bucket}/models/"], check=True)
        if args.quantize:
            subprocess.run(["gsutil", "-m", "cp", "-r", quantized_path, f"gs://{bucket}/models/"], check=True)
        print("Upload complete")

    print("\n=== Training Complete ===")
    print(f"Base model: {args.model}")
    print(f"LoRA adapter: {args.output}")
    print(f"Merged model: {merged_path}")


if __name__ == "__main__":
    main()
```

### 4. Docker Image for Training (`Dockerfile.train`)

```dockerfile
# Dockerfile.train — GPU training container
FROM nvidia/cuda:12.4.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    python3.11 python3.11-venv python3-pip git curl \
    && rm -rf /var/lib/apt/lists/*

RUN python3.11 -m pip install --upgrade pip

# Install training dependencies
RUN pip install \
    torch==2.4.0 \
    transformers==4.44.0 \
    datasets==2.21.0 \
    accelerate==0.33.0 \
    peft==0.12.0 \
    trl==0.9.6 \
    bitsandbytes==0.43.3 \
    scipy \
    sentencepiece \
    protobuf \
    auto-gptq==0.7.1 \
    google-cloud-storage

# Install Unsloth for 2x faster training
RUN pip install "unsloth[cu124-torch240] @ git+https://github.com/unslothai/unsloth.git"

WORKDIR /training
COPY scripts/training/ ./scripts/
COPY data/training/ ./data/

ENTRYPOINT ["python3.11"]
CMD ["scripts/opensource/train.py"]
```

### 5. Kubernetes Job for Training (`infra/k8s/training-job.yaml`)

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: crypto-vision-train-llama-8b
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never
      nodeSelector:
        cloud.google.com/gke-accelerator: nvidia-l4
      containers:
        - name: trainer
          image: gcr.io/${PROJECT_ID}/crypto-vision-trainer:latest
          command: ["python3.11", "scripts/opensource/train.py"]
          args:
            - "--model=meta-llama/Llama-3.1-8B-Instruct"
            - "--data=data/training/all-pairs.jsonl"
            - "--output=/models/crypto-vision-llama-8b"
            - "--epochs=3"
            - "--quantize"
          resources:
            requests:
              nvidia.com/gpu: 1
              memory: "24Gi"
              cpu: "8"
            limits:
              nvidia.com/gpu: 1
              memory: "32Gi"
              cpu: "8"
          env:
            - name: GCS_BUCKET
              value: "crypto-vision-models"
            - name: HUGGING_FACE_HUB_TOKEN
              valueFrom:
                secretKeyRef:
                  name: hf-token
                  key: token
          volumeMounts:
            - mountPath: /models
              name: model-storage
      volumes:
        - name: model-storage
          emptyDir:
            sizeLimit: 100Gi
---
# Repeat for 70B model on A100
apiVersion: batch/v1
kind: Job
metadata:
  name: crypto-vision-train-llama-70b
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never
      nodeSelector:
        cloud.google.com/gke-accelerator: nvidia-tesla-a100
      containers:
        - name: trainer
          image: gcr.io/${PROJECT_ID}/crypto-vision-trainer:latest
          command: ["python3.11", "scripts/opensource/train.py"]
          args:
            - "--model=meta-llama/Llama-3.1-70B-Instruct"
            - "--data=data/training/all-pairs.jsonl"
            - "--output=/models/crypto-vision-llama-70b"
            - "--epochs=3"
            - "--batch-size=1"
            - "--quantize"
          resources:
            requests:
              nvidia.com/gpu: 1
              memory: "80Gi"
              cpu: "12"
            limits:
              nvidia.com/gpu: 1
              memory: "85Gi"
              cpu: "12"
          env:
            - name: GCS_BUCKET
              value: "crypto-vision-models"
            - name: HUGGING_FACE_HUB_TOKEN
              valueFrom:
                secretKeyRef:
                  name: hf-token
                  key: token
          volumeMounts:
            - mountPath: /models
              name: model-storage
      volumes:
        - name: model-storage
          emptyDir:
            sizeLimit: 200Gi
```

### 6. Self-Hosted Inference Server (`scripts/inference/serve.py`)

After training, deploy the quantized model as a vLLM server:

```python
# scripts/inference/serve.py
# vLLM inference server for the fine-tuned model
# Compatible with OpenAI API format → drop-in replacement in src/lib/ai.ts

"""
Usage:
  python serve.py --model models/crypto-vision-llama-8b-gptq-4bit --port 8000

This serves an OpenAI-compatible API at http://localhost:8000/v1/chat/completions
"""

import argparse
import uvicorn
from vllm import LLM, SamplingParams
from vllm.entrypoints.openai.api_server import create_app

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to model directory")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--max-model-len", type=int, default=4096)
    parser.add_argument("--gpu-memory-utilization", type=float, default=0.90)
    parser.add_argument("--quantization", default="gptq", choices=["gptq", "awq", "none"])
    args = parser.parse_args()

    print(f"Loading model: {args.model}")
    print(f"Quantization: {args.quantization}")
    print(f"Max context: {args.max_model_len}")
    
    # vLLM handles batching, KV cache, and continuous batching automatically
    # This gives us ~50 tok/s on L4 GPU for 8B model
    
    # Start OpenAI-compatible server
    # Endpoint: POST /v1/chat/completions
    # Compatible with src/lib/ai.ts OpenAI provider format
    
    from vllm.entrypoints.openai.cli_args import make_arg_parser
    import sys
    
    sys.argv = [
        "vllm.entrypoints.openai.api_server",
        "--model", args.model,
        "--port", str(args.port),
        "--max-model-len", str(args.max_model_len),
        "--gpu-memory-utilization", str(args.gpu_memory_utilization),
        "--quantization", args.quantization if args.quantization != "none" else "",
        "--served-model-name", "crypto-vision",
        "--trust-remote-code",
    ]
    
    from vllm.entrypoints.openai.api_server import run_server
    run_server(make_arg_parser().parse_args())


if __name__ == "__main__":
    main()
```

### 7. Integration into AI Provider Cascade

Add self-hosted model as a provider in `src/lib/ai.ts`:

```typescript
// Add to the PROVIDERS array — priority between groq and gemini
{
  name: "self-hosted",
  envKey: "SELF_HOSTED_URL",  // e.g., http://gpu-server:8000
  url: "",
  model: "crypto-vision",
  buildRequest: (key, system, user, maxTokens, temperature) => ({
    url: `${process.env.SELF_HOSTED_URL}/v1/chat/completions`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        model: "crypto-vision",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature,
        response_format: { type: "json_object" },
      },
    },
  }),
  extractText: (r) => r.choices?.[0]?.message?.content || "",
  extractUsage: (r) => r.usage?.total_tokens,
}
```

### 8. Deployment Manifests for Post-Credits Hosting

```yaml
# infra/k8s/inference-deployment.yaml
# Deploy on any Kubernetes cluster with GPU (RunPod, Lambda, Vast.ai, etc.)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crypto-vision-llm
spec:
  replicas: 1
  selector:
    matchLabels:
      app: crypto-vision-llm
  template:
    metadata:
      labels:
        app: crypto-vision-llm
    spec:
      containers:
        - name: vllm
          image: vllm/vllm-openai:latest
          args:
            - "--model=/models/crypto-vision-llama-8b-gptq-4bit"
            - "--quantization=gptq"
            - "--max-model-len=4096"
            - "--gpu-memory-utilization=0.90"
            - "--served-model-name=crypto-vision"
          ports:
            - containerPort: 8000
          resources:
            requests:
              nvidia.com/gpu: 1
              memory: "16Gi"
            limits:
              nvidia.com/gpu: 1
              memory: "24Gi"
          volumeMounts:
            - mountPath: /models
              name: model-weights
      volumes:
        - name: model-weights
          hostPath:
            path: /mnt/models  # Download from GCS before deploying
---
apiVersion: v1
kind: Service
metadata:
  name: crypto-vision-llm
spec:
  selector:
    app: crypto-vision-llm
  ports:
    - port: 8000
      targetPort: 8000
```

### 9. Training Data Preparation — Merge All Datasets

```typescript
// scripts/training/opensource/prepare-data.ts
// Merge all training pairs into a single, deduplicated, shuffled JSONL file

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { createHash } from "crypto";

async function prepareData() {
  const dataDir = "data/training";
  const files = readdirSync(dataDir).filter(f => f.endsWith("-pairs.jsonl"));
  
  const allPairs: string[] = [];
  const seen = new Set<string>();
  
  for (const file of files) {
    const lines = readFileSync(`${dataDir}/${file}`, "utf-8").trim().split("\n");
    for (const line of lines) {
      // Deduplicate by content hash
      const hash = createHash("md5").update(line).digest("hex");
      if (!seen.has(hash)) {
        seen.add(hash);
        allPairs.push(line);
      }
    }
    console.log(`${file}: ${lines.length} pairs (${allPairs.length} total after dedup)`);
  }

  // Shuffle
  for (let i = allPairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPairs[i], allPairs[j]] = [allPairs[j], allPairs[i]];
  }

  // Split: 95% train, 5% eval
  const evalSize = Math.max(10, Math.floor(allPairs.length * 0.05));
  const trainPairs = allPairs.slice(evalSize);
  const evalPairs = allPairs.slice(0, evalSize);

  mkdirSync("data/training/prepared", { recursive: true });
  writeFileSync("data/training/prepared/train.jsonl", trainPairs.join("\n") + "\n");
  writeFileSync("data/training/prepared/eval.jsonl", evalPairs.join("\n") + "\n");

  console.log(`\nPrepared: ${trainPairs.length} train, ${evalPairs.length} eval`);
  console.log("Files: data/training/prepared/train.jsonl, eval.jsonl");
}

prepareData().catch(console.error);
```

## Validation

1. Training Docker image builds and runs on GPU
2. LoRA fine-tuning completes for 8B model in <12 hours on L4
3. Merged model produces coherent crypto analysis
4. GPTQ quantization runs without errors
5. vLLM serves the quantized model at ~50 tok/s on L4
6. OpenAI-compatible API returns valid responses
7. Integration into `src/lib/ai.ts` works with fallback
8. Model weights upload to GCS successfully  
9. Inference deployment YAML works on any K8s cluster with GPU
10. All model weights exported and downloadable from GCS

## GCP APIs to Enable

```bash
gcloud services enable \
  container.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com
```

## npm Dependencies

None — training uses Python. TypeScript code only touches the inference endpoint.

## Post-Credits Hosting Options

After GCP credits expire, host the quantized model on:
- **RunPod**: L4 GPU at ~$0.44/hr ($320/mo)
- **Lambda Labs**: A10G at ~$0.60/hr ($432/mo)
- **Vast.ai**: RTX 4090 at ~$0.30/hr ($216/mo)
- **Hugging Face Inference Endpoints**: ~$1.30/hr (L4)
- **Self-hosted**: Buy a used RTX 3090 ($600 one-time) and run at home
