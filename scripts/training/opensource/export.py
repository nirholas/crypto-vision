#!/usr/bin/env python3
"""
Crypto Vision — Model Export & Download Utility

Manages model weights between GCS and local storage. Supports:
  - Downloading trained model weights from GCS
  - Listing available models in GCS
  - Verifying model integrity after download
  - Preparing models for deployment (inference server)

Usage:
    # List all available models
    python scripts/training/opensource/export.py list --bucket my-project-models

    # Download a specific model
    python scripts/training/opensource/export.py download \
        --bucket my-project-models \
        --model crypto-vision-llama-8b-gptq-4bit \
        --output /mnt/models/

    # Download and verify checksum
    python scripts/training/opensource/export.py download \
        --bucket my-project-models \
        --model crypto-vision-llama-8b-gptq-4bit \
        --output /mnt/models/ \
        --verify

    # Upload a local model to GCS
    python scripts/training/opensource/export.py upload \
        --bucket my-project-models \
        --model-path ./models/crypto-vision-llama-8b-merged

Copyright 2024-2026 nirholas. All rights reserved.
"""

import argparse
import hashlib
import json
import logging
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def run_gsutil(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a gsutil command and return the result."""
    cmd = ["gsutil"] + args
    logger.debug(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if check and result.returncode != 0:
        logger.error(f"gsutil failed: {result.stderr}")
        raise RuntimeError(f"gsutil command failed with code {result.returncode}: {result.stderr}")
    return result


def list_models(bucket: str) -> list[dict]:
    """List all model directories in the GCS bucket."""
    gcs_path = f"gs://{bucket}/models/"
    logger.info(f"Listing models in {gcs_path}")

    result = run_gsutil(["ls", "-l", gcs_path], check=False)
    if result.returncode != 0:
        if "BucketNotFoundException" in result.stderr or "404" in result.stderr:
            logger.error(f"Bucket not found: {bucket}")
            return []
        raise RuntimeError(f"Failed to list bucket: {result.stderr}")

    models = []
    for line in result.stdout.strip().split("\n"):
        line = line.strip()
        if not line or line.startswith("TOTAL:"):
            continue
        # Parse gsutil ls -l output: size  date  path
        parts = line.split()
        if len(parts) >= 3:
            path = parts[-1]
            if path.endswith("/"):
                model_name = path.rstrip("/").split("/")[-1]
                models.append({
                    "name": model_name,
                    "path": path,
                    "size_bytes": int(parts[0]) if parts[0].isdigit() else 0,
                })
        elif line.endswith("/"):
            model_name = line.rstrip("/").split("/")[-1]
            models.append({"name": model_name, "path": line})

    return models


def get_model_size(bucket: str, model_name: str) -> int:
    """Get total size of a model in GCS."""
    gcs_path = f"gs://{bucket}/models/{model_name}"
    result = run_gsutil(["du", "-s", gcs_path], check=False)
    if result.returncode != 0:
        return 0
    parts = result.stdout.strip().split()
    return int(parts[0]) if parts and parts[0].isdigit() else 0


def download_model(
    bucket: str,
    model_name: str,
    output_dir: str,
    verify: bool = False,
) -> str:
    """Download a model from GCS to local storage."""
    gcs_path = f"gs://{bucket}/models/{model_name}"
    local_path = os.path.join(output_dir, model_name)

    # Check if model exists in GCS
    result = run_gsutil(["ls", gcs_path], check=False)
    if result.returncode != 0:
        raise FileNotFoundError(f"Model not found in GCS: {gcs_path}")

    # Get model size
    total_size = get_model_size(bucket, model_name)
    size_gb = total_size / (1024**3)
    logger.info(f"Downloading {model_name} ({size_gb:.1f} GB) → {local_path}")

    # Create output directory
    os.makedirs(local_path, exist_ok=True)

    # Download with parallel composite uploads
    start = time.time()
    run_gsutil(["-m", "cp", "-r", f"{gcs_path}/*", local_path])
    elapsed = time.time() - start

    download_speed = total_size / elapsed / (1024**2) if elapsed > 0 else 0
    logger.info(f"Download complete: {elapsed:.0f}s ({download_speed:.1f} MB/s)")

    # Verify integrity if requested
    if verify:
        logger.info("Verifying model integrity...")
        verify_model(local_path)

    return local_path


def upload_model(
    bucket: str,
    model_path: str,
    model_name: Optional[str] = None,
) -> str:
    """Upload a local model to GCS."""
    if not os.path.isdir(model_path):
        raise FileNotFoundError(f"Model directory not found: {model_path}")

    if model_name is None:
        model_name = os.path.basename(model_path.rstrip("/"))

    gcs_path = f"gs://{bucket}/models/{model_name}"

    # Calculate local size
    total_size = sum(
        f.stat().st_size
        for f in Path(model_path).rglob("*")
        if f.is_file()
    )
    size_gb = total_size / (1024**3)
    logger.info(f"Uploading {model_name} ({size_gb:.1f} GB) → {gcs_path}")

    # Generate checksums before upload
    checksums = generate_checksums(model_path)
    checksum_file = os.path.join(model_path, "checksums.json")
    with open(checksum_file, "w") as f:
        json.dump(checksums, f, indent=2)

    # Upload with parallel composite uploads
    start = time.time()
    run_gsutil(["-m", "cp", "-r", model_path, f"gs://{bucket}/models/"])
    elapsed = time.time() - start

    upload_speed = total_size / elapsed / (1024**2) if elapsed > 0 else 0
    logger.info(f"Upload complete: {elapsed:.0f}s ({upload_speed:.1f} MB/s)")
    logger.info(f"Model available at: {gcs_path}")

    return gcs_path


def generate_checksums(model_path: str) -> dict:
    """Generate SHA256 checksums for all model files."""
    checksums = {}
    model_dir = Path(model_path)

    for file_path in sorted(model_dir.rglob("*")):
        if file_path.is_file() and file_path.name != "checksums.json":
            relative = str(file_path.relative_to(model_dir))
            sha256 = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    sha256.update(chunk)
            checksums[relative] = {
                "sha256": sha256.hexdigest(),
                "size_bytes": file_path.stat().st_size,
            }

    return checksums


def verify_model(model_path: str) -> bool:
    """Verify model integrity using checksums."""
    checksum_file = os.path.join(model_path, "checksums.json")

    if not os.path.exists(checksum_file):
        logger.warning("No checksums.json found — generating checksums for future use")
        checksums = generate_checksums(model_path)
        with open(checksum_file, "w") as f:
            json.dump(checksums, f, indent=2)
        logger.info(f"Generated checksums for {len(checksums)} files")
        return True

    with open(checksum_file, "r") as f:
        expected = json.load(f)

    errors = 0
    verified = 0
    model_dir = Path(model_path)

    for relative, info in expected.items():
        file_path = model_dir / relative
        if not file_path.exists():
            logger.error(f"  MISSING: {relative}")
            errors += 1
            continue

        # Verify size
        actual_size = file_path.stat().st_size
        if actual_size != info["size_bytes"]:
            logger.error(
                f"  SIZE MISMATCH: {relative} "
                f"(expected {info['size_bytes']}, got {actual_size})"
            )
            errors += 1
            continue

        # Verify hash
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)

        if sha256.hexdigest() != info["sha256"]:
            logger.error(f"  HASH MISMATCH: {relative}")
            errors += 1
        else:
            verified += 1

    if errors > 0:
        logger.error(f"Verification FAILED: {errors} errors, {verified} verified")
        return False

    logger.info(f"Verification PASSED: {verified} files verified")
    return True


def check_model_ready(model_path: str) -> dict:
    """Check if a model is ready for deployment with vLLM."""
    model_dir = Path(model_path)
    status = {
        "path": model_path,
        "exists": model_dir.exists(),
        "has_config": (model_dir / "config.json").exists(),
        "has_tokenizer": (
            (model_dir / "tokenizer.json").exists()
            or (model_dir / "tokenizer.model").exists()
            or (model_dir / "tokenizer_config.json").exists()
        ),
        "has_weights": False,
        "total_size_gb": 0.0,
        "quantization_detected": None,
        "ready": False,
    }

    if not status["exists"]:
        return status

    # Check for model weights
    weight_patterns = ["*.safetensors", "*.bin", "*.pt", "*.gguf"]
    weight_files = []
    for pattern in weight_patterns:
        weight_files.extend(list(model_dir.glob(pattern)))
    status["has_weights"] = len(weight_files) > 0

    # Total size
    total_bytes = sum(f.stat().st_size for f in model_dir.rglob("*") if f.is_file())
    status["total_size_gb"] = round(total_bytes / (1024**3), 2)

    # Detect quantization
    if (model_dir / "quantize_config.json").exists():
        try:
            with open(model_dir / "quantize_config.json") as f:
                qconfig = json.load(f)
                bits = qconfig.get("bits", "unknown")
                status["quantization_detected"] = f"GPTQ-{bits}bit"
        except (json.JSONDecodeError, KeyError):
            status["quantization_detected"] = "GPTQ (unknown bits)"
    elif (model_dir / "quant_config.json").exists():
        try:
            with open(model_dir / "quant_config.json") as f:
                qconfig = json.load(f)
                bits = qconfig.get("w_bit", qconfig.get("bits", "unknown"))
                status["quantization_detected"] = f"AWQ-{bits}bit"
        except (json.JSONDecodeError, KeyError):
            status["quantization_detected"] = "AWQ (unknown bits)"

    # Overall readiness
    status["ready"] = all([
        status["has_config"],
        status["has_tokenizer"],
        status["has_weights"],
    ])

    return status


# ─── CLI ──────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Manage Crypto Vision model weights (GCS ↔ local)"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # list
    list_parser = subparsers.add_parser("list", help="List available models in GCS")
    list_parser.add_argument("--bucket", required=True, help="GCS bucket name")

    # download
    dl_parser = subparsers.add_parser("download", help="Download model from GCS")
    dl_parser.add_argument("--bucket", required=True, help="GCS bucket name")
    dl_parser.add_argument("--model", required=True, help="Model name in GCS")
    dl_parser.add_argument("--output", default="/mnt/models", help="Local output directory")
    dl_parser.add_argument("--verify", action="store_true", help="Verify integrity after download")

    # upload
    up_parser = subparsers.add_parser("upload", help="Upload local model to GCS")
    up_parser.add_argument("--bucket", required=True, help="GCS bucket name")
    up_parser.add_argument("--model-path", required=True, help="Path to local model directory")
    up_parser.add_argument("--name", default=None, help="Override model name in GCS")

    # verify
    verify_parser = subparsers.add_parser("verify", help="Verify local model integrity")
    verify_parser.add_argument("--path", required=True, help="Path to local model directory")

    # check
    check_parser = subparsers.add_parser("check", help="Check if model is ready for deployment")
    check_parser.add_argument("--path", required=True, help="Path to local model directory")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    if args.command == "list":
        models = list_models(args.bucket)
        if not models:
            print("No models found.")
            return

        print(f"\nAvailable models in gs://{args.bucket}/models/:\n")
        for m in models:
            size = get_model_size(args.bucket, m["name"])
            size_gb = size / (1024**3) if size > 0 else 0
            print(f"  {m['name']:<50} {size_gb:>6.1f} GB")
        print(f"\nTotal: {len(models)} models")

    elif args.command == "download":
        local_path = download_model(args.bucket, args.model, args.output, args.verify)
        status = check_model_ready(local_path)
        if status["ready"]:
            print(f"\nModel ready for deployment at: {local_path}")
            if status["quantization_detected"]:
                print(f"Quantization: {status['quantization_detected']}")
            print(f"Size: {status['total_size_gb']} GB")
        else:
            print(f"\nWARNING: Model at {local_path} is NOT ready for deployment")
            print(f"  config.json:  {'✓' if status['has_config'] else '✗'}")
            print(f"  tokenizer:    {'✓' if status['has_tokenizer'] else '✗'}")
            print(f"  weights:      {'✓' if status['has_weights'] else '✗'}")

    elif args.command == "upload":
        gcs_path = upload_model(args.bucket, args.model_path, args.name)
        print(f"\nModel uploaded to: {gcs_path}")

    elif args.command == "verify":
        ok = verify_model(args.path)
        sys.exit(0 if ok else 1)

    elif args.command == "check":
        status = check_model_ready(args.path)
        print(json.dumps(status, indent=2))
        sys.exit(0 if status["ready"] else 1)


if __name__ == "__main__":
    main()
