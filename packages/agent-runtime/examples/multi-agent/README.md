# Multi-Agent Example

Demonstrates agent-to-agent communication using A2A protocol.

## Architecture

```
┌──────────────┐      A2A + x402       ┌──────────────┐
│ Orchestrator │ ───────────────────>   │    Worker     │
│  (port 3002) │ <─────────────────    │  (port 3003) │
│              │      Results          │              │
│ - Discovers  │                       │ - Token      │
│   agents     │                       │   Analysis   │
│ - Delegates  │                       │ - Risk       │
│   tasks      │                       │   Analysis   │
└──────────────┘                       └──────────────┘
```

## Quick Start

```bash
# Terminal 1: Start the worker agent
PRIVATE_KEY=0x... npx tsx examples/multi-agent/worker.ts

# Terminal 2: Start the orchestrator
PRIVATE_KEY=0x... npx tsx examples/multi-agent/orchestrator.ts
```

## Test

```bash
# Ask orchestrator to rebalance
curl -X POST http://localhost:3002/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tasks/send",
    "params": {
      "id": "rebalance-1",
      "message": {
        "role": "user",
        "parts": [{"type": "data", "data": {"task": "portfolio/rebalance", "portfolio": ["BNB", "ETH", "USDC"]}}]
      },
      "metadata": {"skill": "portfolio/rebalance"}
    }
  }'

# Call worker directly
curl -X POST http://localhost:3003/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tasks/send",
    "params": {
      "id": "analyze-1",
      "message": {
        "role": "user",
        "parts": [{"type": "data", "data": {"task": "analysis/token", "token": "BNB"}}]
      },
      "metadata": {"skill": "analysis/token"}
    }
  }'
```
