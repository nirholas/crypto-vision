# @sperax/x402-facilitator

An [x402](https://github.com/coinbase/x402) payment facilitator that verifies and settles EIP-3009 USDC micropayments on Base, Arbitrum, and Ethereum.

Built with [Hono](https://hono.dev), [viem](https://viem.sh), and [Zod](https://zod.dev).

## How It Works

The x402 protocol enables HTTP 402-based micropayments. This facilitator acts as the trusted intermediary:

```
Client                    Resource Server              Facilitator            Blockchain
  │                            │                           │                      │
  ├── GET /resource ──────────►│                           │                      │
  │◄── 402 + payment reqs ────┤                           │                      │
  │                            │                           │                      │
  │  (sign EIP-712 authorization)                          │                      │
  │                            │                           │                      │
  ├── GET /resource + X-402 ──►│                           │                      │
  │                            ├── POST /settle ──────────►│                      │
  │                            │                           ├── transferWith ──────►│
  │                            │                           │   Authorization      │
  │                            │                           │◄── tx receipt ────────┤
  │                            │◄── { success, txHash } ───┤                      │
  │◄── 200 + resource ────────┤                           │                      │
```

1. Client requests a paid resource, gets a 402 with payment requirements
2. Client signs an EIP-712 `TransferWithAuthorization` (EIP-3009) message
3. Resource server forwards the payment to this facilitator for verification and settlement
4. Facilitator verifies the signature, checks on-chain state, and calls `transferWithAuthorization` to move USDC
5. Resource server grants access

## Quick Start

```bash
pnpm install
cp .env.example .env
# Edit .env with your private key and RPC URLs
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm start` | Start production server |
| `pnpm build` | Build for production |
| `pnpm test` | Run tests (28 unit tests) |
| `pnpm typecheck` | Type-check without emitting |

## API Endpoints

### `POST /verify`

Verify an EIP-3009 payment signature without settling.

```json
{
  "x402Version": 1,
  "payment": {
    "chainId": 8453,
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "authorization": {
      "from": "0x...",
      "to": "0x...",
      "value": "1000000",
      "validAfter": "0",
      "validBefore": "1735689600",
      "nonce": "0x..."
    },
    "signature": "0x..."
  },
  "paymentRequirements": {
    "chainId": 8453,
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x...",
    "maxAmountRequired": "1000000"
  }
}
```

Response:
```json
{ "valid": true, "isValid": true }
```

### `POST /settle`

Verify and settle a payment on-chain via `transferWithAuthorization`.

Response:
```json
{
  "success": true,
  "txHash": "0x...",
  "transaction": "0x...",
  "network": "base",
  "payer": "0x..."
}
```

### `GET /health`

Per-chain RPC connectivity check.

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "chains": [
    { "chainId": 8453, "network": "base", "connected": true, "blockNumber": 12345678 }
  ]
}
```

### `GET /info`

Facilitator metadata: address, supported chains, and tokens.

## Supported Chains

| Chain | Chain ID | USDC Address |
|---|---|---|
| Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Arbitrum One | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Arbitrum Sepolia | 421614 | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| Ethereum | 1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |

## Environment Variables

See [`.env.example`](.env.example) for all options. Required:

- `FACILITATOR_PRIVATE_KEY` — 32-byte hex private key (the wallet that submits settlement transactions)
- `BASE_RPC_URL` — RPC endpoint for Base (enabled by default)

The facilitator wallet needs ETH on each enabled chain to pay gas for `transferWithAuthorization` calls.

## Deployment

### Docker

```bash
docker build -t x402-facilitator .
docker run -p 3402:3402 --env-file .env x402-facilitator
```

### Railway

The repo includes `railway.json` for one-click Railway deployment. Set environment variables in the Railway dashboard.

## Security

- **Private key**: Stored as an environment variable, never committed. The facilitator wallet only needs enough ETH for gas — it does not custody user funds.
- **EIP-712 verification**: All payment signatures are cryptographically verified against the sender's address before settlement.
- **Nonce protection**: Each authorization nonce is checked on-chain before submission to prevent replay attacks. In-flight nonces are tracked in memory to prevent concurrent double-settlement.
- **Rate limiting**: Configurable per-IP rate limiting via middleware.
- **Input validation**: All request bodies are validated with Zod schemas before processing.

## Architecture

```
src/
├── index.ts                  # Hono server entry point
├── server.ts                 # Server factory
├── core/
│   ├── facilitator.ts        # Orchestrates verify → settle flow
│   ├── verifier.ts           # EIP-712 signature + requirements validation
│   ├── settler.ts            # On-chain transferWithAuthorization
│   └── nonce-store.ts        # LRU nonce dedup cache
├── config/
│   ├── chains.ts             # Chain configs (Base, Arbitrum, Ethereum)
│   ├── tokens.ts             # Token registry + EIP-712 domains
│   └── env.ts                # Zod-validated environment
├── routes/
│   ├── verify.ts             # POST /verify
│   ├── settle.ts             # POST /settle
│   ├── health.ts             # GET /health
│   └── info.ts               # GET /info
├── middleware/
│   ├── cors.ts               # CORS configuration
│   ├── rateLimit.ts          # Per-IP rate limiting
│   ├── validate.ts           # Request validation
│   └── x402-resource-server.ts  # x402 resource server middleware
├── types/
│   └── index.ts              # TypeScript interfaces
└── utils/
    ├── logger.ts             # Structured JSON logging (pino)
    ├── metrics.ts            # Prometheus-style counters
    ├── errors.ts             # Error classes
    └── hex.ts                # Hex utilities
```

## License

MIT
