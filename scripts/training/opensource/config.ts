/**
 * Configuration for open-source model fine-tuning
 *
 * Defines target models, LoRA hyperparameters, and training settings
 * for fine-tuning on crypto-specific datasets using GCP GPUs.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

// ─── Model Definitions ──────────────────────────────────────

export interface ModelConfig {
  /** HuggingFace model identifier */
  huggingFaceId: string;
  /** Minimum GPU type required for training */
  gpuRequirement: "L4" | "A100-40GB" | "A100-80GB";
  /** Estimated training time with default config */
  trainingTime: string;
  /** Approximate inference throughput */
  inferenceSpeed: string;
  /** Hourly cost for self-hosted inference */
  selfHostCost: string;
  /** Post-training quantization method */
  quantization: "GPTQ-4bit" | "AWQ-4bit";
  /** Maximum sequence length supported */
  maxSeqLength: number;
  /** LoRA rank override (null = use default) */
  loraRankOverride: number | null;
  /** Per-device batch size override (null = use default) */
  batchSizeOverride: number | null;
}

export const MODELS: Record<string, ModelConfig> = {
  // Primary: Best quality/speed tradeoff for production
  "llama-3.1-8b": {
    huggingFaceId: "meta-llama/Llama-3.1-8B-Instruct",
    gpuRequirement: "L4",
    trainingTime: "~8hrs",
    inferenceSpeed: "~50 tok/s on L4",
    selfHostCost: "$0.50/hr on L4",
    quantization: "GPTQ-4bit",
    maxSeqLength: 4096,
    loraRankOverride: null,
    batchSizeOverride: null,
  },

  // Secondary: Higher quality for complex analysis
  "llama-3.1-70b": {
    huggingFaceId: "meta-llama/Llama-3.1-70B-Instruct",
    gpuRequirement: "A100-80GB",
    trainingTime: "~24hrs",
    inferenceSpeed: "~15 tok/s on A100",
    selfHostCost: "$3/hr on A100",
    quantization: "AWQ-4bit",
    maxSeqLength: 4096,
    loraRankOverride: null,
    batchSizeOverride: 1,
  },

  // Tertiary: Fast and cheap, good for high-throughput tasks
  "mistral-7b": {
    huggingFaceId: "mistralai/Mistral-7B-Instruct-v0.3",
    gpuRequirement: "L4",
    trainingTime: "~6hrs",
    inferenceSpeed: "~60 tok/s on L4",
    selfHostCost: "$0.50/hr on L4",
    quantization: "GPTQ-4bit",
    maxSeqLength: 4096,
    loraRankOverride: null,
    batchSizeOverride: null,
  },

  // Qwen: Excellent at structured JSON output
  "qwen-2.5-7b": {
    huggingFaceId: "Qwen/Qwen2.5-7B-Instruct",
    gpuRequirement: "L4",
    trainingTime: "~6hrs",
    inferenceSpeed: "~55 tok/s on L4",
    selfHostCost: "$0.50/hr on L4",
    quantization: "GPTQ-4bit",
    maxSeqLength: 4096,
    loraRankOverride: null,
    batchSizeOverride: null,
  },
} as const;

// ─── LoRA Configuration ─────────────────────────────────────

export interface LoRAConfig {
  /** LoRA rank — higher = more capacity, more VRAM */
  r: number;
  /** LoRA alpha — scaling factor, usually 2x rank */
  alpha: number;
  /** Dropout rate for regularization */
  dropout: number;
  /** Which transformer modules to apply LoRA to */
  targetModules: string[];
  /** PEFT task type */
  taskType: "CAUSAL_LM";
}

export const LORA_CONFIG: LoRAConfig = {
  r: 16,
  alpha: 32,
  dropout: 0.05,
  targetModules: [
    "q_proj",
    "k_proj",
    "v_proj",
    "o_proj",
    "gate_proj",
    "up_proj",
    "down_proj",
  ],
  taskType: "CAUSAL_LM",
};

// ─── Training Hyperparameters ───────────────────────────────

export interface TrainingHyperparams {
  /** Batch size per GPU device */
  perDeviceBatchSize: number;
  /** Gradient accumulation steps (effective batch = batchSize × accumSteps) */
  gradientAccumulationSteps: number;
  /** Warmup steps for learning rate scheduler */
  warmupSteps: number;
  /** Total training epochs */
  numEpochs: number;
  /** Peak learning rate */
  learningRate: number;
  /** L2 weight decay for regularization */
  weightDecay: number;
  /** Optimizer — adamw_8bit for memory efficiency */
  optimizer: "adamw_8bit" | "adamw_torch" | "adamw_apex_fused";
  /** Learning rate scheduler type */
  scheduler: "cosine" | "linear" | "constant_with_warmup";
  /** Maximum sequence length in tokens */
  maxSeqLength: number;
  /** Pack short samples into single sequences to maximize GPU utilization */
  packingSamples: boolean;
  /** Use BF16 mixed precision (requires Ampere+ GPU) */
  bf16: boolean;
  /** Random seed for reproducibility */
  seed: number;
}

export const TRAINING_HYPERPARAMS: TrainingHyperparams = {
  perDeviceBatchSize: 4,
  gradientAccumulationSteps: 4, // Effective batch size = 16
  warmupSteps: 100,
  numEpochs: 3,
  learningRate: 2e-4,
  weightDecay: 0.01,
  optimizer: "adamw_8bit",
  scheduler: "cosine",
  maxSeqLength: 4096,
  packingSamples: true,
  bf16: true,
  seed: 42,
};

// ─── Evaluation Configuration ───────────────────────────────

export interface EvaluationConfig {
  /** Run eval every N training steps */
  evalSteps: number;
  /** Save checkpoint every N training steps */
  saveSteps: number;
  /** Log metrics every N training steps */
  loggingSteps: number;
  /** Maximum checkpoints to keep (oldest deleted first) */
  saveTotalLimit: number;
  /** Fraction of data to hold out for evaluation (0-1) */
  evalSplitRatio: number;
}

export const EVALUATION_CONFIG: EvaluationConfig = {
  evalSteps: 100,
  saveSteps: 200,
  loggingSteps: 10,
  saveTotalLimit: 3,
  evalSplitRatio: 0.05,
};

// ─── Infrastructure Configuration ───────────────────────────

export interface InfraConfig {
  /** GCS bucket for storing model weights */
  gcsBucket: string;
  /** GCR registry for training Docker images */
  gcrRegistry: string;
  /** GKE cluster name */
  gkeCluster: string;
  /** GCP region */
  region: string;
}

export const INFRA_CONFIG: InfraConfig = {
  gcsBucket: "crypto-vision-models",
  gcrRegistry: "gcr.io/crypto-vision",
  gkeCluster: "crypto-vision-training",
  region: "us-central1",
};

// ─── GPU Pricing (for budget tracking) ──────────────────────

export const GPU_PRICING: Record<string, { hourly: number; vram: string }> = {
  "nvidia-l4": { hourly: 1.5, vram: "24GB" },
  "nvidia-tesla-a100-40gb": { hourly: 3.0, vram: "40GB" },
  "nvidia-tesla-a100-80gb": { hourly: 7.5, vram: "80GB" },
};

// ─── Post-Credits Hosting Options ───────────────────────────

export interface HostingOption {
  provider: string;
  gpuType: string;
  hourlyRate: number;
  monthlyEstimate: number;
  notes: string;
}

export const HOSTING_OPTIONS: HostingOption[] = [
  {
    provider: "RunPod",
    gpuType: "L4",
    hourlyRate: 0.44,
    monthlyEstimate: 320,
    notes: "Serverless or dedicated, auto-scaling available",
  },
  {
    provider: "Lambda Labs",
    gpuType: "A10G",
    hourlyRate: 0.6,
    monthlyEstimate: 432,
    notes: "Reliable US-based GPU cloud",
  },
  {
    provider: "Vast.ai",
    gpuType: "RTX 4090",
    hourlyRate: 0.3,
    monthlyEstimate: 216,
    notes: "Cheapest option, peer-to-peer marketplace",
  },
  {
    provider: "Hugging Face Endpoints",
    gpuType: "L4",
    hourlyRate: 1.3,
    monthlyEstimate: 936,
    notes: "Managed inference, easiest setup",
  },
  {
    provider: "Self-hosted (RTX 3090)",
    gpuType: "RTX 3090",
    hourlyRate: 0,
    monthlyEstimate: 30, // electricity only
    notes: "$600 one-time hardware cost, ~30W idle",
  },
];

// ─── Combined Training Config ───────────────────────────────

export const TRAINING_CONFIG = {
  lora: LORA_CONFIG,
  training: TRAINING_HYPERPARAMS,
  evaluation: EVALUATION_CONFIG,
  infra: INFRA_CONFIG,
  models: MODELS,
} as const;
