# DeFi Trading Agent Example

A full-featured DeFi trading agent with on-chain identity, reputation, and x402 micropayments.

## Features

- **Trading**: Quote and execute swaps across BSC DEXs
- **Analysis**: Technical analysis reports with indicators
- **Portfolio**: Balance and P&L tracking
- **x402 Payments**: Per-request micropayments
- **Reputation**: On-chain reputation tracking

## Pricing

| Endpoint | Price | Description |
|----------|-------|-------------|
| `trading/execute` | 0.001 USDC | Execute a swap |
| `trading/quote` | 0.0001 USDC | Get swap quotes |
| `analysis/report` | 0.0005 USDC | Technical analysis |
| `portfolio/balance` | 0.0001 USDC | Portfolio balances |

## Quick Start

```bash
# Dev mode (no on-chain registration, no payments)
npx tsx examples/defi-agent/index.ts

# Production (with on-chain registration)
PRIVATE_KEY=0x... npx tsx examples/defi-agent/index.ts
```

## API Examples

```bash
# Get a trading quote
curl -X POST http://localhost:3000/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tasks/send",
    "params": {
      "id": "quote-1",
      "message": {
        "role": "user",
        "parts": [{"type": "data", "data": {"task": "trading/quote", "tokenIn": "BNB", "tokenOut": "USDC", "amount": "1.0"}}]
      },
      "metadata": {"skill": "trading/quote"}
    }
  }'

# Execute a trade
curl -X POST http://localhost:3000/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tasks/send",
    "params": {
      "id": "trade-1",
      "message": {
        "role": "user",
        "parts": [{"type": "data", "data": {"task": "trading/execute", "tokenIn": "BNB", "tokenOut": "USDC", "amount": "0.5"}}]
      },
      "metadata": {"skill": "trading/execute"}
    }
  }'

# Get analysis report
curl -X POST http://localhost:3000/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3",
    "method": "tasks/send",
    "params": {
      "id": "analysis-1",
      "message": {
        "role": "user",
        "parts": [{"type": "data", "data": {"task": "analysis/report", "token": "BNB", "timeframe": "7d"}}]
      },
      "metadata": {"skill": "analysis/report"}
    }
  }'
```

## Agent Discovery

Other agents can discover this agent via:
- **A2A**: `GET /.well-known/agent.json`
- **ERC-8004**: On-chain IdentityRegistry query
- **Health**: `GET /health`
