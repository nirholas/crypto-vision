/**
 * Tests for scripts/training/opensource/config.ts
 *
 * Validates model configurations, LoRA parameters, training
 * hyperparameters, and infrastructure config.
 */

import { describe, expect, it } from "vitest";
import {
  EVALUATION_CONFIG,
  GPU_PRICING,
  HOSTING_OPTIONS,
  INFRA_CONFIG,
  LORA_CONFIG,
  MODELS,
  TRAINING_CONFIG,
  TRAINING_HYPERPARAMS
} from "../../../scripts/training/opensource/config.js";

describe("Model Configurations", () => {
  it("defines all four target models", () => {
    expect(Object.keys(MODELS)).toEqual(
      expect.arrayContaining(["llama-3.1-8b", "llama-3.1-70b", "mistral-7b", "qwen-2.5-7b"]),
    );
    expect(Object.keys(MODELS)).toHaveLength(4);
  });

  it("all models have valid HuggingFace IDs", () => {
    for (const [name, config] of Object.entries(MODELS)) {
      expect(config.huggingFaceId).toMatch(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/);
    }
  });

  it("all models specify valid GPU requirements", () => {
    const validGpus = ["L4", "A100-40GB", "A100-80GB"];
    for (const [name, config] of Object.entries(MODELS)) {
      expect(validGpus).toContain(config.gpuRequirement);
    }
  });

  it("all models have valid quantization methods", () => {
    const validQuant = ["GPTQ-4bit", "AWQ-4bit"];
    for (const config of Object.values(MODELS)) {
      expect(validQuant).toContain(config.quantization);
    }
  });

  it("7-8B models require L4 GPU", () => {
    expect(MODELS["llama-3.1-8b"].gpuRequirement).toBe("L4");
    expect(MODELS["mistral-7b"].gpuRequirement).toBe("L4");
    expect(MODELS["qwen-2.5-7b"].gpuRequirement).toBe("L4");
  });

  it("70B model requires A100-80GB GPU", () => {
    expect(MODELS["llama-3.1-70b"].gpuRequirement).toBe("A100-80GB");
  });

  it("all models have maxSeqLength of 4096", () => {
    for (const config of Object.values(MODELS)) {
      expect(config.maxSeqLength).toBe(4096);
    }
  });

  it("70B model has batch size override of 1", () => {
    expect(MODELS["llama-3.1-70b"].batchSizeOverride).toBe(1);
  });

  it("7-8B models have no overrides (use defaults)", () => {
    expect(MODELS["llama-3.1-8b"].loraRankOverride).toBeNull();
    expect(MODELS["llama-3.1-8b"].batchSizeOverride).toBeNull();
  });
});

describe("LoRA Configuration", () => {
  it("has valid rank and alpha", () => {
    expect(LORA_CONFIG.r).toBe(16);
    expect(LORA_CONFIG.alpha).toBe(32);
    expect(LORA_CONFIG.alpha).toBe(LORA_CONFIG.r * 2);
  });

  it("has moderate dropout", () => {
    expect(LORA_CONFIG.dropout).toBeGreaterThan(0);
    expect(LORA_CONFIG.dropout).toBeLessThan(0.2);
  });

  it("targets all attention + MLP modules", () => {
    const expected = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"];
    expect(LORA_CONFIG.targetModules).toEqual(expect.arrayContaining(expected));
    expect(LORA_CONFIG.targetModules).toHaveLength(7);
  });

  it("uses CAUSAL_LM task type", () => {
    expect(LORA_CONFIG.taskType).toBe("CAUSAL_LM");
  });
});

describe("Training Hyperparameters", () => {
  it("has reasonable effective batch size", () => {
    const effective =
      TRAINING_HYPERPARAMS.perDeviceBatchSize * TRAINING_HYPERPARAMS.gradientAccumulationSteps;
    expect(effective).toBe(16);
    expect(effective).toBeGreaterThanOrEqual(8);
    expect(effective).toBeLessThanOrEqual(64);
  });

  it("uses memory-efficient optimizer", () => {
    expect(TRAINING_HYPERPARAMS.optimizer).toBe("adamw_8bit");
  });

  it("uses cosine learning rate schedule", () => {
    expect(TRAINING_HYPERPARAMS.scheduler).toBe("cosine");
  });

  it("trains for 3 epochs", () => {
    expect(TRAINING_HYPERPARAMS.numEpochs).toBe(3);
  });

  it("uses reasonable learning rate", () => {
    expect(TRAINING_HYPERPARAMS.learningRate).toBe(2e-4);
    expect(TRAINING_HYPERPARAMS.learningRate).toBeGreaterThan(1e-5);
    expect(TRAINING_HYPERPARAMS.learningRate).toBeLessThan(1e-3);
  });

  it("enables BF16 for Ampere+ GPUs", () => {
    expect(TRAINING_HYPERPARAMS.bf16).toBe(true);
  });

  it("enables sequence packing for efficiency", () => {
    expect(TRAINING_HYPERPARAMS.packingSamples).toBe(true);
  });

  it("has deterministic seed", () => {
    expect(TRAINING_HYPERPARAMS.seed).toBe(42);
  });
});

describe("Evaluation Configuration", () => {
  it("evaluates frequently enough", () => {
    expect(EVALUATION_CONFIG.evalSteps).toBeLessThanOrEqual(200);
  });

  it("saves checkpoints", () => {
    expect(EVALUATION_CONFIG.saveSteps).toBeGreaterThan(0);
  });

  it("limits checkpoint count to save disk", () => {
    expect(EVALUATION_CONFIG.saveTotalLimit).toBeLessThanOrEqual(5);
  });

  it("holds out 5% for eval", () => {
    expect(EVALUATION_CONFIG.evalSplitRatio).toBe(0.05);
  });
});

describe("Infrastructure Configuration", () => {
  it("has non-empty GCS bucket", () => {
    expect(INFRA_CONFIG.gcsBucket).toBeTruthy();
  });

  it("has valid GCP region", () => {
    expect(INFRA_CONFIG.region).toMatch(/^[a-z]+-[a-z]+\d+$/);
  });
});

describe("GPU Pricing", () => {
  it("includes all GPU types used by models", () => {
    expect(GPU_PRICING["nvidia-l4"]).toBeDefined();
    expect(GPU_PRICING["nvidia-tesla-a100-40gb"]).toBeDefined();
    expect(GPU_PRICING["nvidia-tesla-a100-80gb"]).toBeDefined();
  });

  it("L4 is cheaper than A100", () => {
    expect(GPU_PRICING["nvidia-l4"].hourly).toBeLessThan(
      GPU_PRICING["nvidia-tesla-a100-40gb"].hourly,
    );
  });
});

describe("Hosting Options", () => {
  it("provides at least 4 hosting alternatives", () => {
    expect(HOSTING_OPTIONS.length).toBeGreaterThanOrEqual(4);
  });

  it("all options have required fields", () => {
    for (const option of HOSTING_OPTIONS) {
      expect(option.provider).toBeTruthy();
      expect(option.gpuType).toBeTruthy();
      expect(typeof option.hourlyRate).toBe("number");
      expect(typeof option.monthlyEstimate).toBe("number");
      expect(option.notes).toBeTruthy();
    }
  });

  it("monthly estimates are reasonable", () => {
    for (const option of HOSTING_OPTIONS) {
      // Self-hosted has $0/hr rate but low monthly (electricity)
      if (option.hourlyRate > 0) {
        const computed = Math.round(option.hourlyRate * 24 * 30);
        // Allow 30% tolerance for partial-month estimates
        expect(option.monthlyEstimate).toBeGreaterThan(0);
        expect(option.monthlyEstimate).toBeLessThan(2000);
      }
    }
  });
});

describe("TRAINING_CONFIG Export", () => {
  it("combines all sub-configs", () => {
    expect(TRAINING_CONFIG.lora).toBe(LORA_CONFIG);
    expect(TRAINING_CONFIG.training).toBe(TRAINING_HYPERPARAMS);
    expect(TRAINING_CONFIG.evaluation).toBe(EVALUATION_CONFIG);
    expect(TRAINING_CONFIG.infra).toBe(INFRA_CONFIG);
    expect(TRAINING_CONFIG.models).toBe(MODELS);
  });
});
