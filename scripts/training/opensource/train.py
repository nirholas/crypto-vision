#!/usr/bin/env python3
"""
Fine-tune open-source LLM using LoRA + Unsloth (2x faster training)

Supports: Llama 3.1 (8B/70B), Mistral 7B, Qwen 2.5 7B
Uses QLoRA (4-bit base + LoRA adapters) for memory efficiency.
Optionally quantizes the merged model to GPTQ 4-bit for cheap inference.

Usage:
    python train.py --model meta-llama/Llama-3.1-8B-Instruct \
                    --data data/training/prepared/train.jsonl \
                    --eval-data data/training/prepared/eval.jsonl \
                    --output models/crypto-vision-llama-8b \
                    --epochs 3 \
                    --quantize

Environment:
    GCS_BUCKET          — Upload model weights to this GCS bucket
    HUGGING_FACE_HUB_TOKEN — HuggingFace token for gated models (Llama)
    WANDB_API_KEY       — Optional: log metrics to Weights & Biases

Copyright 2024-2026 nirholas. All rights reserved.
"""

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fine-tune open-source LLM with LoRA for crypto analysis"
    )
    parser.add_argument(
        "--model",
        default="meta-llama/Llama-3.1-8B-Instruct",
        help="HuggingFace model ID or local path",
    )
    parser.add_argument(
        "--data",
        default="data/training/prepared/train.jsonl",
        help="Path to training JSONL file (chat-format messages)",
    )
    parser.add_argument(
        "--eval-data",
        default=None,
        help="Path to eval JSONL file. If omitted, splits from --data",
    )
    parser.add_argument(
        "--output",
        default="models/crypto-vision-llama-8b",
        help="Output directory for LoRA adapter + merged model",
    )
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument(
        "--batch-size", type=int, default=4, help="Per-device batch size"
    )
    parser.add_argument(
        "--grad-accum", type=int, default=4, help="Gradient accumulation steps"
    )
    parser.add_argument("--lr", type=float, default=2e-4, help="Peak learning rate")
    parser.add_argument(
        "--max-seq-len", type=int, default=4096, help="Maximum sequence length"
    )
    parser.add_argument("--lora-r", type=int, default=16, help="LoRA rank")
    parser.add_argument(
        "--lora-alpha", type=int, default=None, help="LoRA alpha (default: 2x rank)"
    )
    parser.add_argument(
        "--lora-dropout", type=float, default=0.05, help="LoRA dropout"
    )
    parser.add_argument("--warmup-steps", type=int, default=100, help="Warmup steps")
    parser.add_argument(
        "--eval-steps", type=int, default=100, help="Evaluate every N steps"
    )
    parser.add_argument(
        "--save-steps", type=int, default=200, help="Save checkpoint every N steps"
    )
    parser.add_argument(
        "--logging-steps", type=int, default=10, help="Log metrics every N steps"
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--quantize",
        action="store_true",
        help="Quantize merged model to GPTQ 4-bit after training",
    )
    parser.add_argument(
        "--quantize-method",
        default="gptq",
        choices=["gptq", "awq"],
        help="Quantization method",
    )
    parser.add_argument(
        "--no-merge",
        action="store_true",
        help="Skip merging LoRA into base model (saves time for experimentation)",
    )
    parser.add_argument(
        "--resume-from",
        default=None,
        help="Resume training from a checkpoint directory",
    )
    parser.add_argument(
        "--report-to",
        default="none",
        choices=["none", "wandb", "tensorboard"],
        help="Where to report training metrics",
    )
    return parser.parse_args()


def validate_data_file(path: str) -> int:
    """Validate JSONL training data and return line count."""
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Training data not found: {path}")

    line_count = 0
    errors = 0
    with open(file_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if "messages" not in obj:
                    logger.warning(f"Line {i}: missing 'messages' field")
                    errors += 1
                    continue
                messages = obj["messages"]
                if not isinstance(messages, list) or len(messages) < 2:
                    logger.warning(
                        f"Line {i}: 'messages' must be a list with >= 2 entries"
                    )
                    errors += 1
                    continue
                # Validate each message has role and content
                for msg in messages:
                    if "role" not in msg or "content" not in msg:
                        logger.warning(
                            f"Line {i}: message missing 'role' or 'content'"
                        )
                        errors += 1
                        break
                else:
                    line_count += 1
            except json.JSONDecodeError as e:
                logger.warning(f"Line {i}: invalid JSON — {e}")
                errors += 1

    if errors > 0:
        logger.warning(f"Data validation: {errors} errors in {path}")
    if line_count == 0:
        raise ValueError(f"No valid training examples found in {path}")

    logger.info(f"Validated {path}: {line_count} valid examples, {errors} errors")
    return line_count


def upload_to_gcs(local_path: str, bucket: str) -> None:
    """Upload a directory to Google Cloud Storage."""
    import subprocess

    dest = f"gs://{bucket}/models/{Path(local_path).name}"
    logger.info(f"Uploading {local_path} → {dest}")
    result = subprocess.run(
        ["gsutil", "-m", "cp", "-r", local_path, f"gs://{bucket}/models/"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.error(f"GCS upload failed: {result.stderr}")
        raise RuntimeError(f"gsutil upload failed with code {result.returncode}")
    logger.info(f"Upload complete: {dest}")


def main() -> None:
    args = parse_args()
    start_time = time.time()

    lora_alpha = args.lora_alpha if args.lora_alpha is not None else args.lora_r * 2

    logger.info("=" * 60)
    logger.info("Crypto Vision — Open-Source Model Fine-Tuning")
    logger.info("=" * 60)
    logger.info(f"Model:          {args.model}")
    logger.info(f"Training data:  {args.data}")
    logger.info(f"Eval data:      {args.eval_data or '(split from train)'}")
    logger.info(f"Output:         {args.output}")
    logger.info(f"Epochs:         {args.epochs}")
    logger.info(f"Batch size:     {args.batch_size} × {args.grad_accum} = {args.batch_size * args.grad_accum} effective")
    logger.info(f"Learning rate:  {args.lr}")
    logger.info(f"Max seq length: {args.max_seq_len}")
    logger.info(f"LoRA:           r={args.lora_r}, alpha={lora_alpha}, dropout={args.lora_dropout}")
    logger.info(f"Quantize:       {args.quantize} ({args.quantize_method})")
    logger.info(f"Seed:           {args.seed}")
    logger.info("=" * 60)

    # Validate training data
    logger.info("Validating training data...")
    train_count = validate_data_file(args.data)

    eval_count: Optional[int] = None
    if args.eval_data:
        eval_count = validate_data_file(args.eval_data)

    # Import heavy dependencies after validation (faster fail on bad data)
    logger.info("Loading training libraries...")
    from unsloth import FastLanguageModel
    from datasets import load_dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments

    # Load base model with 4-bit quantization (QLoRA)
    logger.info(f"Loading model: {args.model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model,
        max_seq_length=args.max_seq_len,
        dtype=None,  # Auto-detect (BF16 on Ampere+, FP16 otherwise)
        load_in_4bit=True,  # QLoRA — 4-bit base model
    )
    logger.info(
        f"Model loaded. Parameters: {model.num_parameters():,} "
        f"(trainable after LoRA: ~{model.num_parameters() * args.lora_r / model.config.hidden_size:,.0f})"
    )

    # Apply LoRA adapters to all attention + MLP projection layers
    logger.info("Applying LoRA adapters...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_alpha=lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        use_gradient_checkpointing="unsloth",  # Unsloth-optimized checkpointing
    )

    # Load training data
    logger.info(f"Loading training dataset: {args.data}")
    train_dataset = load_dataset("json", data_files=args.data, split="train")

    eval_dataset = None
    if args.eval_data:
        logger.info(f"Loading eval dataset: {args.eval_data}")
        eval_dataset = load_dataset("json", data_files=args.eval_data, split="train")
    else:
        # Split from training data
        logger.info("Splitting 5% for evaluation...")
        split = train_dataset.train_test_split(test_size=0.05, seed=args.seed)
        train_dataset = split["train"]
        eval_dataset = split["test"]

    # Format messages using the model's chat template
    def format_chat(example: dict) -> dict:
        messages = example["messages"]
        formatted = tokenizer.apply_chat_template(messages, tokenize=False)
        return {"text": formatted}

    logger.info("Applying chat template formatting...")
    train_dataset = train_dataset.map(format_chat, num_proc=4, desc="Formatting train")
    eval_dataset = eval_dataset.map(format_chat, num_proc=4, desc="Formatting eval")

    logger.info(f"Training: {len(train_dataset):,} examples")
    logger.info(f"Evaluation: {len(eval_dataset):,} examples")

    # Create output directory
    Path(args.output).mkdir(parents=True, exist_ok=True)

    # Save training metadata
    metadata = {
        "base_model": args.model,
        "training_data": args.data,
        "eval_data": args.eval_data,
        "train_examples": len(train_dataset),
        "eval_examples": len(eval_dataset),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "grad_accum": args.grad_accum,
        "effective_batch_size": args.batch_size * args.grad_accum,
        "learning_rate": args.lr,
        "max_seq_length": args.max_seq_len,
        "lora_r": args.lora_r,
        "lora_alpha": lora_alpha,
        "lora_dropout": args.lora_dropout,
        "seed": args.seed,
        "quantize": args.quantize,
        "quantize_method": args.quantize_method,
    }
    with open(f"{args.output}/training-metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    # Configure training
    training_args = TrainingArguments(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        warmup_steps=args.warmup_steps,
        learning_rate=args.lr,
        weight_decay=0.01,
        fp16=False,
        bf16=True,
        logging_steps=args.logging_steps,
        eval_strategy="steps",
        eval_steps=args.eval_steps,
        save_strategy="steps",
        save_steps=args.save_steps,
        save_total_limit=3,
        lr_scheduler_type="cosine",
        optim="adamw_8bit",
        seed=args.seed,
        report_to=args.report_to,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        dataloader_num_workers=4,
        group_by_length=False,  # Disabled when packing is enabled
    )

    # Initialize trainer
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        dataset_text_field="text",
        max_seq_length=args.max_seq_len,
        packing=True,  # Pack short sequences together for efficiency
        args=training_args,
    )

    # Train
    logger.info("Starting training...")
    if args.resume_from:
        logger.info(f"Resuming from checkpoint: {args.resume_from}")
        trainer.train(resume_from_checkpoint=args.resume_from)
    else:
        trainer.train()

    train_time = time.time() - start_time
    logger.info(f"Training completed in {train_time / 3600:.1f} hours")

    # Save final LoRA adapter
    logger.info(f"Saving LoRA adapter to {args.output}")
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)

    # Save final training metrics
    if trainer.state.log_history:
        with open(f"{args.output}/training-log.json", "w") as f:
            json.dump(trainer.state.log_history, f, indent=2)

    # Merge LoRA weights into base model for deployment
    if not args.no_merge:
        merged_path = f"{args.output}-merged"
        logger.info(f"Merging LoRA weights into base model → {merged_path}")
        model = model.merge_and_unload()
        model.save_pretrained(merged_path)
        tokenizer.save_pretrained(merged_path)
        logger.info(f"Merged model saved to {merged_path}")

        # Quantize for cheap inference
        if args.quantize:
            quantized_path = f"{args.output}-{args.quantize_method}-4bit"
            logger.info(
                f"Quantizing to {args.quantize_method.upper()} 4-bit → {quantized_path}"
            )

            if args.quantize_method == "gptq":
                from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig

                quantize_config = BaseQuantizeConfig(
                    bits=4,
                    group_size=128,
                    desc_act=True,
                )

                quantized_model = AutoGPTQForCausalLM.from_pretrained(
                    merged_path,
                    quantize_config=quantize_config,
                    device_map="auto",
                )
                # Use a subset of training data as calibration data
                calib_size = min(256, len(train_dataset))
                quantized_model.quantize(
                    train_dataset.select(range(calib_size))
                )
                quantized_model.save_quantized(quantized_path)
                tokenizer.save_pretrained(quantized_path)

            elif args.quantize_method == "awq":
                from awq import AutoAWQForCausalLM

                awq_model = AutoAWQForCausalLM.from_pretrained(
                    merged_path, device_map="auto"
                )
                awq_model.quantize(
                    tokenizer,
                    quant_config={
                        "zero_point": True,
                        "q_group_size": 128,
                        "w_bit": 4,
                        "version": "GEMM",
                    },
                )
                awq_model.save_quantized(quantized_path)
                tokenizer.save_pretrained(quantized_path)

            logger.info(f"Quantized model saved to {quantized_path}")
    else:
        merged_path = None
        quantized_path = None

    # Upload to GCS if configured
    gcs_bucket = os.environ.get("GCS_BUCKET")
    if gcs_bucket:
        logger.info(f"Uploading models to GCS bucket: {gcs_bucket}")
        upload_to_gcs(args.output, gcs_bucket)
        if merged_path and not args.no_merge:
            upload_to_gcs(merged_path, gcs_bucket)
        if args.quantize and not args.no_merge:
            upload_to_gcs(quantized_path, gcs_bucket)
        logger.info("All uploads complete")

    # Print summary
    total_time = time.time() - start_time
    logger.info("")
    logger.info("=" * 60)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Base model:       {args.model}")
    logger.info(f"LoRA adapter:     {args.output}")
    if not args.no_merge:
        logger.info(f"Merged model:     {merged_path}")
    if args.quantize and not args.no_merge:
        logger.info(f"Quantized model:  {quantized_path}")
    logger.info(f"Training examples: {len(train_dataset):,}")
    logger.info(f"Eval examples:    {len(eval_dataset):,}")
    logger.info(f"Total time:       {total_time / 3600:.1f} hours")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
