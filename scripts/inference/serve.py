#!/usr/bin/env python3
"""
vLLM inference server for the fine-tuned Crypto Vision model.

Serves an OpenAI-compatible API that is a drop-in replacement for
the external providers in src/lib/ai.ts. Supports batching, KV cache
management, and continuous batching out of the box.

Usage:
    # Serve GPTQ-quantized 8B model on L4 GPU (~50 tok/s)
    python serve.py --model models/crypto-vision-llama-8b-gptq-4bit --port 8000

    # Serve AWQ-quantized 70B model on A100 GPU (~15 tok/s)
    python serve.py --model models/crypto-vision-llama-70b-awq-4bit \\
                    --port 8000 --quantization awq

    # Serve unquantized model (FP16, requires more VRAM)
    python serve.py --model models/crypto-vision-llama-8b-merged \\
                    --port 8000 --quantization none

Endpoints:
    POST /v1/chat/completions   — OpenAI-compatible chat completions
    GET  /v1/models             — List available models
    GET  /health                — Health check

Environment:
    CUDA_VISIBLE_DEVICES  — GPU selection (default: all)

Copyright 2024-2026 nirholas. All rights reserved.
"""

import argparse
import logging
import os
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Serve fine-tuned Crypto Vision model via vLLM (OpenAI-compatible API)"
    )
    parser.add_argument(
        "--model",
        required=True,
        help="Path to model directory (local or GCS)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to serve on (default: 8000)",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--max-model-len",
        type=int,
        default=4096,
        help="Maximum context length in tokens (default: 4096)",
    )
    parser.add_argument(
        "--gpu-memory-utilization",
        type=float,
        default=0.90,
        help="Fraction of GPU memory to use (default: 0.90)",
    )
    parser.add_argument(
        "--quantization",
        default="gptq",
        choices=["gptq", "awq", "none"],
        help="Quantization method used by the model (default: gptq)",
    )
    parser.add_argument(
        "--served-model-name",
        default="crypto-vision",
        help="Model name exposed via API (default: crypto-vision)",
    )
    parser.add_argument(
        "--max-num-seqs",
        type=int,
        default=64,
        help="Maximum concurrent sequences for batching (default: 64)",
    )
    parser.add_argument(
        "--tensor-parallel-size",
        type=int,
        default=1,
        help="Number of GPUs for tensor parallelism (default: 1)",
    )
    parser.add_argument(
        "--trust-remote-code",
        action="store_true",
        default=True,
        help="Trust remote code in model repo (default: True)",
    )
    return parser.parse_args()


def download_from_gcs(gcs_path: str, local_path: str) -> str:
    """Download model from GCS if path starts with gs://."""
    if not gcs_path.startswith("gs://"):
        return gcs_path

    import subprocess

    logger.info(f"Downloading model from GCS: {gcs_path} → {local_path}")
    os.makedirs(local_path, exist_ok=True)
    result = subprocess.run(
        ["gsutil", "-m", "cp", "-r", f"{gcs_path}/*", local_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.error(f"GCS download failed: {result.stderr}")
        raise RuntimeError(f"gsutil download failed with code {result.returncode}")
    logger.info("Download complete")
    return local_path


def main() -> None:
    args = parse_args()

    logger.info("=" * 60)
    logger.info("Crypto Vision — Self-Hosted Inference Server")
    logger.info("=" * 60)
    logger.info(f"Model:            {args.model}")
    logger.info(f"Port:             {args.port}")
    logger.info(f"Max context:      {args.max_model_len}")
    logger.info(f"GPU utilization:  {args.gpu_memory_utilization:.0%}")
    logger.info(f"Quantization:     {args.quantization}")
    logger.info(f"Served as:        {args.served_model_name}")
    logger.info(f"Tensor parallel:  {args.tensor_parallel_size}")
    logger.info("=" * 60)

    # Download from GCS if needed
    model_path = args.model
    if model_path.startswith("gs://"):
        local_cache = f"/tmp/model-cache/{os.path.basename(model_path)}"
        model_path = download_from_gcs(model_path, local_cache)

    # Build vLLM server arguments
    # vLLM's OpenAI-compatible server is the standard way to serve models
    # It handles batching, KV cache, continuous batching, and streaming
    vllm_args = [
        "vllm.entrypoints.openai.api_server",
        "--model", model_path,
        "--host", args.host,
        "--port", str(args.port),
        "--max-model-len", str(args.max_model_len),
        "--gpu-memory-utilization", str(args.gpu_memory_utilization),
        "--served-model-name", args.served_model_name,
        "--max-num-seqs", str(args.max_num_seqs),
        "--tensor-parallel-size", str(args.tensor_parallel_size),
    ]

    if args.quantization != "none":
        vllm_args.extend(["--quantization", args.quantization])

    if args.trust_remote_code:
        vllm_args.append("--trust-remote-code")

    # Replace sys.argv and launch vLLM server
    logger.info(f"Starting vLLM server on {args.host}:{args.port}...")
    sys.argv = vllm_args

    from vllm.entrypoints.openai.cli_args import make_arg_parser
    from vllm.entrypoints.openai.api_server import run_server

    server_args = make_arg_parser().parse_args()
    run_server(server_args)


if __name__ == "__main__":
    main()
