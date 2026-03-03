#!/usr/bin/env python3
"""
Crypto Vision — Model Benchmark Suite

Benchmarks a fine-tuned model's throughput, latency, and quality across
varying concurrency levels and prompt sizes. Outputs metrics compatible
with the evaluation framework.

Usage:
    python scripts/training/opensource/benchmark.py \
        --endpoint http://localhost:8000 \
        --concurrency 1,4,8,16 \
        --prompt-tokens 128,512,1024,2048

Output:
    data/evaluation/benchmark-{model}-{timestamp}.json

Copyright 2024-2026 nirholas. All rights reserved.
"""

import argparse
import asyncio
import json
import logging
import os
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    import aiohttp
except ImportError:
    aiohttp = None  # type: ignore[assignment]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─── Types ────────────────────────────────────────────────────

SAMPLE_PROMPTS = {
    128: "What is the current market sentiment for Bitcoin? Respond in JSON with sentiment, confidence, and reasoning fields.",
    512: (
        "Analyze the following crypto market data and provide a comprehensive assessment:\n"
        "- BTC: $67,450 (+4.2% 24h), volume $38.2B, RSI 68, MACD bullish crossover\n"
        "- ETH: $3,420 (+1.8% 24h), gas 12 gwei, DeFi TVL $89.2B\n"
        "- SOL: $145 (+15.2% 24h), DEX volume surpassed ETH for 3rd day\n"
        "- Market cap: $2.38T (+2.1%), BTC dominance 53.8%\n"
        "- Fear & Greed: 72 (Greed), stablecoin supply $165B (+1.2%)\n"
        "- Whale flows: +12,400 BTC moved off exchanges in 48h\n"
        "- Funding rates: BTC 0.015%, ETH 0.008% (neutral-positive)\n"
        "- Key levels: BTC resistance $69K, support $63.5K\n\n"
        "Respond in JSON with: headline, summary, topMovers (array), riskLevel, "
        "keyMetrics (object), and actionItems (array)."
    ),
    1024: (
        "You are a senior DeFi protocol analyst. Provide a comprehensive risk assessment "
        "for the following yield farming strategy across multiple protocols:\n\n"
        "## Strategy Overview\n"
        "1. Deposit 100 ETH ($342,000) as collateral on Aave V3 (Arbitrum)\n"
        "2. Borrow 200,000 USDC at 3.1% APR (LTV: 58%)\n"
        "3. Deposit 100,000 USDC in Curve TriPool (USDC/USDT/DAI) at 6.8% APY\n"
        "4. Deposit 100,000 USDC in Pendle PT-sUSDe at 18.5% fixed APY (90-day maturity)\n"
        "5. Collect CRV, ARB, and PENDLE token incentives (~4.2% additional APY)\n\n"
        "## Protocol Data\n"
        "- Aave V3: TVL $12.8B, audited by Trail of Bits + OZ, 18-month track record\n"
        "- Curve: TVL $2.1B, 4+ years operational, no major exploits\n"
        "- Pendle: TVL $3.8B, audited by Dedaub, 12-month track record on Arbitrum\n"
        "- Arbitrum: $8.2B TVL, sequencer uptime 99.97% (30d)\n\n"
        "## Risk Factors to Consider\n"
        "- Smart contract risk across 4 protocols\n"
        "- Liquidation risk on Aave if ETH drops >42%\n"
        "- Stablecoin depeg risk (USDC/USDT/DAI)\n"
        "- Bridge risk for Arbitrum\n"
        "- Impermanent loss in Curve pool\n"
        "- Pendle PT maturity and redemption risk\n"
        "- Token incentive sustainability\n"
        "- Gas costs for rebalancing\n\n"
        "Respond in JSON with: strategy, totalEstimatedAPY, riskScore (0-100), "
        "riskLevel (low/medium/high/critical), protocolRisks (array of objects with "
        "protocol, riskFactor, severity, mitigation), liquidationScenario (object), "
        "worstCaseLoss (percentage), recommendation, monitoringTriggers (array)."
    ),
    2048: (
        "You are an institutional-grade crypto market analyst. Produce a comprehensive "
        "daily market intelligence report based on the following data. This report will "
        "be distributed to portfolio managers and traders.\n\n"
        "## Global Market Overview\n"
        "- Total crypto market cap: $2.38T (+2.1% 24h, +8.5% 7d)\n"
        "- 24h trading volume: $95.2B (40% above 20-day average)\n"
        "- BTC dominance: 53.8% (+0.4% 24h)\n"
        "- Total DeFi TVL: $89.2B (+3.5% 24h)\n"
        "- Stablecoin total supply: $165B (+1.2% 7d)\n"
        "- Fear & Greed Index: 72 (Greed) — up from 65 yesterday\n\n"
        "## Bitcoin Analysis\n"
        "- Price: $67,450 (+4.2% 24h, +12.8% 7d)\n"
        "- Volume: $38.2B (65% above average)\n"
        "- RSI(14): 68 — approaching overbought\n"
        "- MACD: Bullish crossover confirmed 2 days ago\n"
        "- Key resistance: $69,000 (previous ATH), $72,000 (Fibonacci 1.618 extension)\n"
        "- Key support: $63,500 (20-day MA), $60,000 (50-day MA)\n"
        "- Open interest: $18.5B (approaching ATH)\n"
        "- Funding rates: 0.015% (moderately positive)\n"
        "- Whale activity: +12,400 BTC moved off exchanges in 48h\n"
        "- Miner reserves: declining (suggesting selling pressure ahead)\n"
        "- Hash rate: 620 EH/s (ATH)\n\n"
        "## Ethereum & L2 Ecosystem\n"
        "- ETH price: $3,450 (+1.8% 24h), ETH/BTC: 0.0511 (declining)\n"
        "- Gas: 12 gwei average, blob fees: 1.2 gwei\n"
        "- Staking: 31.2M ETH staked (26.1% of supply)\n"
        "- L2 TVL: Arbitrum $12.1B, Optimism $6.8B, Base $5.2B\n"
        "- EIP-4844 blob utilization: 68%\n\n"
        "## DeFi Highlights\n"
        "- Aave V3 TVL: $12.8B, utilization: 72% (USDC supply APY: 4.2%)\n"
        "- Uniswap V3 volume: $4.2B/day, fee revenue: $3.8M/day\n"
        "- Lido stETH APY: 3.4%, total staked: 9.4M ETH\n"
        "- MakerDAO DAI supply: $5.2B, DSR: 5.0%\n"
        "- Pendle TVL: $3.8B, PT yields: 8-22% on various assets\n\n"
        "## Solana Ecosystem\n"
        "- SOL price: $145 (+15.2% 24h)\n"
        "- DEX volume: $4.8B (surpassed ETH mainnet for 3rd consecutive day)\n"
        "- Jupiter aggregator volume: $2.1B\n"
        "- Raydium TVL: $1.2B (+18% 7d)\n"
        "- Jito MEV tips: $12M (7d average)\n"
        "- Notable: Memecoin activity driving volume, pump.fun daily revenue $800K\n\n"
        "## Macro & Regulatory\n"
        "- Federal Reserve: Rates held at 5.25-5.50%, dovish tone in statement\n"
        "- CPI: 3.1% (slightly above 3.0% forecast)\n"
        "- DXY: 104.2 (-0.3%)\n"
        "- S&P 500: +0.8%, NASDAQ: +1.2%\n"
        "- BTC ETF flows: +$450M (7d), IBIT volume: $2.1B/day\n"
        "- Notable: SEC approved 2 new altcoin ETF applications for comment period\n\n"
        "## On-Chain Intelligence\n"
        "- Exchange reserves: BTC 2.1M (declining), ETH 15.8M (stable)\n"
        "- USDT treasury: printed 1B USDT on Tron (bullish signal historically)\n"
        "- Large transaction volume (>$100K): $42B (elevated, +25% vs 7d avg)\n"
        "- Active addresses: BTC 1.1M, ETH 580K, SOL 2.4M\n\n"
        "Respond in comprehensive JSON with ALL of the following fields:\n"
        "headline (string), executiveSummary (string, 3-5 sentences), "
        "marketSentiment (object with score 0-100, label, drivers array), "
        "topMovers (array of {coin, price, change24h, change7d, catalyst}), "
        "sectorAnalysis (array of {sector, performance, outlook, topProtocol}), "
        "riskAssessment (object with level, score 0-100, factors array, "
        "blackSwanRisks array), "
        "tradingSignals (array of {coin, action, entry, target, stopLoss, "
        "confidence, timeframe}), "
        "defiOpportunities (array of {protocol, chain, type, apy, riskLevel}), "
        "keyLevels (object with btcResistance, btcSupport, ethResistance, ethSupport), "
        "regulatoryUpdate (string), "
        "outlook (object with shortTerm, mediumTerm, keyRisks array), "
        "actionItems (array of strings)"
    ),
}

SYSTEM_PROMPT = (
    "You are an institutional-grade cryptocurrency market analyst. "
    "Provide precise, data-driven analysis in valid JSON format. "
    "Be specific with numbers, levels, and actionable insights."
)


# ─── Benchmark Runner ─────────────────────────────────────────

async def run_single_request(
    session: "aiohttp.ClientSession",
    endpoint: str,
    model: str,
    prompt: str,
    max_tokens: int,
) -> dict:
    """Run a single inference request and measure performance."""
    url = endpoint.rstrip("/") + "/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }

    start = time.monotonic()
    try:
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=120)) as resp:
            data = await resp.json()
            elapsed = time.monotonic() - start

            if resp.status != 200:
                return {
                    "success": False,
                    "error": f"HTTP {resp.status}",
                    "latency_ms": round(elapsed * 1000),
                }

            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage = data.get("usage", {})
            completion_tokens = usage.get("completion_tokens", 0)
            prompt_tokens = usage.get("prompt_tokens", 0)
            total_tokens = usage.get("total_tokens", 0)

            # Calculate tokens per second
            tps = completion_tokens / elapsed if elapsed > 0 and completion_tokens > 0 else 0

            return {
                "success": True,
                "latency_ms": round(elapsed * 1000),
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "tokens_per_second": round(tps, 1),
                "output_length": len(content),
                "json_valid": is_valid_json(content),
            }
    except asyncio.TimeoutError:
        return {
            "success": False,
            "error": "Timeout (120s)",
            "latency_ms": round((time.monotonic() - start) * 1000),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "latency_ms": round((time.monotonic() - start) * 1000),
        }


def is_valid_json(text: str) -> bool:
    """Check if text contains valid JSON."""
    text = text.strip()
    # Strip code fences
    if "```" in text:
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            text = match.group(1).strip()

    try:
        json.loads(text)
        return True
    except (json.JSONDecodeError, ValueError):
        # Try to find JSON object in text
        import re
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                json.loads(match.group(0))
                return True
            except (json.JSONDecodeError, ValueError):
                pass
    return False


async def benchmark_concurrency(
    endpoint: str,
    model: str,
    concurrency: int,
    prompt_tokens: int,
    num_requests: int = 10,
) -> dict:
    """Run benchmark at a specific concurrency level."""
    prompt = SAMPLE_PROMPTS.get(prompt_tokens, SAMPLE_PROMPTS[512])
    max_tokens = min(1024, prompt_tokens)  # Generate proportional response

    if aiohttp is None:
        raise ImportError("aiohttp is required for benchmarking. Install with: pip install aiohttp")

    results = []

    async with aiohttp.ClientSession() as session:
        # Warm up with 2 requests
        logger.info(f"  Warming up ({concurrency} concurrent, ~{prompt_tokens} prompt tokens)...")
        warmup_tasks = [
            run_single_request(session, endpoint, model, prompt, max_tokens)
            for _ in range(min(2, concurrency))
        ]
        await asyncio.gather(*warmup_tasks)

        # Run benchmark
        logger.info(f"  Running {num_requests} requests at concurrency {concurrency}...")
        start = time.monotonic()

        # Submit requests in batches of `concurrency`
        for batch_start in range(0, num_requests, concurrency):
            batch_size = min(concurrency, num_requests - batch_start)
            tasks = [
                run_single_request(session, endpoint, model, prompt, max_tokens)
                for _ in range(batch_size)
            ]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)

        total_time = time.monotonic() - start

    # Aggregate metrics
    successful = [r for r in results if r.get("success")]
    failed = [r for r in results if not r.get("success")]
    latencies = [r["latency_ms"] for r in successful]
    tps_values = [r["tokens_per_second"] for r in successful if r.get("tokens_per_second", 0) > 0]
    json_valid_count = sum(1 for r in successful if r.get("json_valid"))

    metrics = {
        "concurrency": concurrency,
        "prompt_tokens_approx": prompt_tokens,
        "total_requests": len(results),
        "successful": len(successful),
        "failed": len(failed),
        "errors": [r.get("error", "unknown") for r in failed],
        "total_time_s": round(total_time, 2),
        "requests_per_second": round(len(successful) / total_time, 2) if total_time > 0 else 0,
    }

    if latencies:
        metrics.update({
            "latency_avg_ms": round(statistics.mean(latencies)),
            "latency_p50_ms": round(statistics.median(latencies)),
            "latency_p95_ms": round(sorted(latencies)[int(len(latencies) * 0.95)]) if len(latencies) >= 20 else round(max(latencies)),
            "latency_p99_ms": round(sorted(latencies)[int(len(latencies) * 0.99)]) if len(latencies) >= 100 else round(max(latencies)),
            "latency_min_ms": round(min(latencies)),
            "latency_max_ms": round(max(latencies)),
        })

    if tps_values:
        metrics.update({
            "tokens_per_second_avg": round(statistics.mean(tps_values), 1),
            "tokens_per_second_max": round(max(tps_values), 1),
        })

    metrics["json_valid_rate"] = round(json_valid_count / len(successful) * 100) if successful else 0
    metrics["total_tokens"] = sum(r.get("total_tokens", 0) for r in successful)

    return metrics


# ─── Main ─────────────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark fine-tuned model throughput and quality")
    parser.add_argument("--endpoint", default="http://localhost:8000", help="Model endpoint URL")
    parser.add_argument("--model", default="crypto-vision", help="Model name")
    parser.add_argument(
        "--concurrency",
        default="1,4,8,16",
        help="Comma-separated concurrency levels to test",
    )
    parser.add_argument(
        "--prompt-tokens",
        default="128,512,1024",
        help="Comma-separated approximate prompt token counts to test",
    )
    parser.add_argument(
        "--requests-per-level",
        type=int,
        default=10,
        help="Number of requests per concurrency level (default: 10)",
    )
    args = parser.parse_args()

    concurrency_levels = [int(x.strip()) for x in args.concurrency.split(",")]
    prompt_token_sizes = [int(x.strip()) for x in args.prompt_tokens.split(",")]

    logger.info("═" * 60)
    logger.info("Crypto Vision — Model Benchmark")
    logger.info("═" * 60)
    logger.info(f"Endpoint:       {args.endpoint}")
    logger.info(f"Model:          {args.model}")
    logger.info(f"Concurrency:    {concurrency_levels}")
    logger.info(f"Prompt sizes:   {prompt_token_sizes}")
    logger.info(f"Requests/level: {args.requests_per_level}")
    logger.info("═" * 60)

    all_results = []

    for pt in prompt_token_sizes:
        for conc in concurrency_levels:
            logger.info(f"\nBenchmark: ~{pt} prompt tokens, concurrency={conc}")
            try:
                metrics = await benchmark_concurrency(
                    args.endpoint,
                    args.model,
                    conc,
                    pt,
                    num_requests=args.requests_per_level,
                )
                all_results.append(metrics)

                # Print inline summary
                success_rate = metrics["successful"] / metrics["total_requests"] * 100
                logger.info(
                    f"  → {metrics.get('latency_avg_ms', 'N/A')}ms avg latency | "
                    f"{metrics.get('tokens_per_second_avg', 'N/A')} tok/s | "
                    f"{metrics.get('requests_per_second', 'N/A')} req/s | "
                    f"{success_rate:.0f}% success | "
                    f"{metrics.get('json_valid_rate', 'N/A')}% JSON valid"
                )
            except Exception as e:
                logger.error(f"  Benchmark failed: {e}")
                all_results.append({
                    "concurrency": conc,
                    "prompt_tokens_approx": pt,
                    "error": str(e),
                })

    # Save results
    output_dir = Path("data/evaluation")
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    output_file = output_dir / f"benchmark-{args.model}-{timestamp}.json"

    report = {
        "benchmarkedAt": datetime.now(timezone.utc).isoformat(),
        "endpoint": args.endpoint,
        "model": args.model,
        "configuration": {
            "concurrencyLevels": concurrency_levels,
            "promptTokenSizes": prompt_token_sizes,
            "requestsPerLevel": args.requests_per_level,
        },
        "results": all_results,
    }

    with open(output_file, "w") as f:
        json.dump(report, f, indent=2)

    # Print summary table
    logger.info("\n" + "═" * 60)
    logger.info("BENCHMARK SUMMARY")
    logger.info("═" * 60)
    logger.info(f"{'Tokens':>8} {'Conc':>6} {'Avg(ms)':>8} {'P95(ms)':>8} {'tok/s':>8} {'req/s':>8} {'JSON%':>6}")
    logger.info("-" * 60)
    for r in all_results:
        if "error" in r:
            logger.info(f"{r.get('prompt_tokens_approx', '?'):>8} {r.get('concurrency', '?'):>6}  ERROR: {r['error'][:30]}")
        else:
            logger.info(
                f"{r.get('prompt_tokens_approx', '?'):>8} "
                f"{r.get('concurrency', '?'):>6} "
                f"{r.get('latency_avg_ms', '-'):>8} "
                f"{r.get('latency_p95_ms', '-'):>8} "
                f"{r.get('tokens_per_second_avg', '-'):>8} "
                f"{r.get('requests_per_second', '-'):>8} "
                f"{r.get('json_valid_rate', '-'):>5}%"
            )
    logger.info("═" * 60)
    logger.info(f"Report saved: {output_file}")


if __name__ == "__main__":
    asyncio.run(main())
