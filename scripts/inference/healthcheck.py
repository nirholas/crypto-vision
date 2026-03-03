#!/usr/bin/env python3
"""
Health check and smoke test for the self-hosted Crypto Vision inference server.

Validates that a vLLM server is running, responsive, and producing
valid structured output for crypto analysis tasks. Use after deployment
to verify the model is working correctly before routing production traffic.

Usage:
    # Quick health check
    python healthcheck.py --endpoint http://localhost:8000

    # Full smoke test with all task types
    python healthcheck.py --endpoint http://localhost:8000 --full

    # Check and exit with status code (for K8s readiness probes)
    python healthcheck.py --endpoint http://localhost:8000 --exit-code

Copyright 2024-2026 nirholas. All rights reserved.
"""

import argparse
import json
import logging
import sys
import time
from typing import NamedTuple
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


class CheckResult(NamedTuple):
    name: str
    passed: bool
    latency_ms: float
    details: str


SMOKE_TEST_PROMPTS = [
    {
        "name": "sentiment-analysis",
        "system": "You are a crypto sentiment analyst. Respond with valid JSON only.",
        "user": (
            "Analyze the sentiment of this headline: "
            "'Bitcoin surges past $100,000 as institutional demand soars'. "
            "Return JSON: {\"sentiment\": \"bullish\"|\"bearish\"|\"neutral\", "
            "\"confidence\": 0-100, \"reasoning\": \"...\"}"
        ),
        "expected_fields": ["sentiment", "confidence", "reasoning"],
        "validate": lambda d: (
            d.get("sentiment") in ("bullish", "bearish", "neutral")
            and isinstance(d.get("confidence"), (int, float))
            and 0 <= d.get("confidence", -1) <= 100
        ),
    },
    {
        "name": "risk-assessment",
        "system": "You are a DeFi risk analyst. Respond with valid JSON only.",
        "user": (
            "Assess the risk of providing liquidity to an ETH/USDC pool on Uniswap V3 "
            "with current ETH price at $3,500 and 30-day volatility at 45%. "
            "Return JSON: {\"risk_level\": \"low\"|\"medium\"|\"high\"|\"critical\", "
            "\"risk_score\": 0-100, \"key_risks\": [\"...\"], \"recommendation\": \"...\"}"
        ),
        "expected_fields": ["risk_level", "risk_score", "key_risks", "recommendation"],
        "validate": lambda d: (
            d.get("risk_level") in ("low", "medium", "high", "critical")
            and isinstance(d.get("risk_score"), (int, float))
            and isinstance(d.get("key_risks"), list)
        ),
    },
    {
        "name": "market-signal",
        "system": "You are a crypto trading signal generator. Respond with valid JSON only.",
        "user": (
            "Given: BTC price $98,500, RSI 72, MACD bullish crossover, "
            "volume up 40% in 24h, funding rate 0.03%. "
            "Generate a trading signal. Return JSON: "
            "{\"signal\": \"buy\"|\"sell\"|\"hold\", \"strength\": 0-100, "
            "\"timeframe\": \"...\", \"rationale\": \"...\"}"
        ),
        "expected_fields": ["signal", "strength", "timeframe", "rationale"],
        "validate": lambda d: (
            d.get("signal") in ("buy", "sell", "hold")
            and isinstance(d.get("strength"), (int, float))
        ),
    },
    {
        "name": "structured-json",
        "system": "You are a crypto data analyst. Respond with valid JSON only.",
        "user": (
            "Provide a brief market overview for the top 3 cryptocurrencies. "
            "Return JSON: {\"coins\": [{\"symbol\": \"...\", \"trend\": \"up\"|\"down\"|\"flat\", "
            "\"note\": \"...\"}]}"
        ),
        "expected_fields": ["coins"],
        "validate": lambda d: (
            isinstance(d.get("coins"), list)
            and len(d.get("coins", [])) >= 1
            and all("symbol" in c and "trend" in c for c in d.get("coins", []))
        ),
    },
]


def check_health(endpoint: str) -> CheckResult:
    """Check the /health endpoint."""
    url = f"{endpoint}/health"
    start = time.monotonic()
    try:
        req = Request(url, method="GET")
        with urlopen(req, timeout=10) as resp:
            latency = (time.monotonic() - start) * 1000
            status = resp.status
            return CheckResult(
                name="health-endpoint",
                passed=status == 200,
                latency_ms=latency,
                details=f"HTTP {status}",
            )
    except (URLError, HTTPError, TimeoutError) as e:
        latency = (time.monotonic() - start) * 1000
        return CheckResult(
            name="health-endpoint",
            passed=False,
            latency_ms=latency,
            details=str(e),
        )


def check_models(endpoint: str) -> CheckResult:
    """Check the /v1/models endpoint."""
    url = f"{endpoint}/v1/models"
    start = time.monotonic()
    try:
        req = Request(url, method="GET")
        with urlopen(req, timeout=10) as resp:
            latency = (time.monotonic() - start) * 1000
            data = json.loads(resp.read())
            models = [m.get("id", "") for m in data.get("data", [])]
            has_model = any("crypto-vision" in m for m in models)
            return CheckResult(
                name="models-endpoint",
                passed=has_model,
                latency_ms=latency,
                details=f"Models: {', '.join(models)}" if models else "No models found",
            )
    except (URLError, HTTPError, TimeoutError, json.JSONDecodeError) as e:
        latency = (time.monotonic() - start) * 1000
        return CheckResult(
            name="models-endpoint",
            passed=False,
            latency_ms=latency,
            details=str(e),
        )


def check_completion(endpoint: str, prompt: dict) -> CheckResult:
    """Send a chat completion and validate the response."""
    url = f"{endpoint}/v1/chat/completions"
    payload = json.dumps({
        "model": "crypto-vision",
        "messages": [
            {"role": "system", "content": prompt["system"]},
            {"role": "user", "content": prompt["user"]},
        ],
        "max_tokens": 512,
        "temperature": 0.3,
    }).encode("utf-8")

    start = time.monotonic()
    try:
        req = Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req, timeout=60) as resp:
            latency = (time.monotonic() - start) * 1000
            data = json.loads(resp.read())

        # Extract text
        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not text:
            return CheckResult(
                name=prompt["name"],
                passed=False,
                latency_ms=latency,
                details="Empty response",
            )

        # Parse JSON from response
        json_str = text.strip()
        # Strip markdown fences if present
        if "```" in json_str:
            import re
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", json_str)
            if match:
                json_str = match.group(1).strip()

        # Find JSON object
        import re
        json_match = re.search(r"[\[{][\s\S]*[\]}]", json_str)
        if not json_match:
            return CheckResult(
                name=prompt["name"],
                passed=False,
                latency_ms=latency,
                details=f"No JSON found in response: {text[:200]}",
            )

        parsed = json.loads(json_match.group(0))

        # Check expected fields
        missing = [f for f in prompt["expected_fields"] if f not in parsed]
        if missing:
            return CheckResult(
                name=prompt["name"],
                passed=False,
                latency_ms=latency,
                details=f"Missing fields: {missing}",
            )

        # Run custom validation
        if prompt["validate"] and not prompt["validate"](parsed):
            return CheckResult(
                name=prompt["name"],
                passed=False,
                latency_ms=latency,
                details=f"Validation failed. Output: {json.dumps(parsed)[:300]}",
            )

        tokens = data.get("usage", {}).get("total_tokens")
        tok_info = f", {tokens} tokens" if tokens else ""
        return CheckResult(
            name=prompt["name"],
            passed=True,
            latency_ms=latency,
            details=f"Valid JSON with all fields{tok_info}",
        )

    except json.JSONDecodeError as e:
        latency = (time.monotonic() - start) * 1000
        return CheckResult(
            name=prompt["name"],
            passed=False,
            latency_ms=latency,
            details=f"JSON parse error: {e}",
        )
    except (URLError, HTTPError, TimeoutError) as e:
        latency = (time.monotonic() - start) * 1000
        return CheckResult(
            name=prompt["name"],
            passed=False,
            latency_ms=latency,
            details=str(e),
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Health check and smoke test for Crypto Vision inference server"
    )
    parser.add_argument(
        "--endpoint",
        required=True,
        help="Base URL of the vLLM server (e.g. http://localhost:8000)",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Run all smoke test prompts (not just health check)",
    )
    parser.add_argument(
        "--exit-code",
        action="store_true",
        help="Exit with non-zero status on any failure",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=60,
        help="Timeout in seconds for completion requests (default: 60)",
    )
    args = parser.parse_args()

    endpoint = args.endpoint.rstrip("/")
    results: list[CheckResult] = []

    logger.info("=" * 60)
    logger.info("Crypto Vision — Inference Server Health Check")
    logger.info("=" * 60)
    logger.info(f"Endpoint: {endpoint}")
    logger.info("")

    # 1. Health endpoint
    logger.info("Checking /health endpoint...")
    result = check_health(endpoint)
    results.append(result)
    status = "PASS" if result.passed else "FAIL"
    logger.info(f"  [{status}] {result.name}: {result.details} ({result.latency_ms:.0f}ms)")

    if not result.passed:
        logger.error("Server is not healthy. Aborting further checks.")
        if args.exit_code:
            sys.exit(1)
        return

    # 2. Models endpoint
    logger.info("Checking /v1/models endpoint...")
    result = check_models(endpoint)
    results.append(result)
    status = "PASS" if result.passed else "FAIL"
    logger.info(f"  [{status}] {result.name}: {result.details} ({result.latency_ms:.0f}ms)")

    # 3. Smoke test completions
    prompts = SMOKE_TEST_PROMPTS if args.full else SMOKE_TEST_PROMPTS[:1]
    logger.info(f"\nRunning {len(prompts)} smoke test(s)...")

    for prompt in prompts:
        logger.info(f"  Testing: {prompt['name']}...")
        result = check_completion(endpoint, prompt)
        results.append(result)
        status = "PASS" if result.passed else "FAIL"
        logger.info(f"    [{status}] {result.details} ({result.latency_ms:.0f}ms)")

    # Summary
    passed = sum(1 for r in results if r.passed)
    failed = sum(1 for r in results if not r.passed)
    avg_latency = sum(r.latency_ms for r in results) / len(results) if results else 0

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"Results: {passed} passed, {failed} failed")
    logger.info(f"Average latency: {avg_latency:.0f}ms")
    logger.info("=" * 60)

    if failed > 0 and args.exit_code:
        sys.exit(1)


if __name__ == "__main__":
    main()
