# x402 Payments

> HTTP 402 micropayment system for pay-per-request API access.

## Overview

Crypto Vision implements [x402](https://www.x402.org/) — Coinbase's HTTP 402 payment protocol — to enable agents and users to pay for premium API endpoints with USDC stablecoin. Instead of traditional API key subscriptions, clients pay per request using on-chain micropayments.

This enables a new paradigm: **give your agent a wallet with USDC, and it can autonomously purchase premium intelligence data**.

## How x402 Works

The x402 protocol adds a payment layer to standard HTTP:

```
┌──────────┐                    ┌──────────────┐                  ┌─────────────┐
│  Client   │ ──── GET /api ──► │  API Server   │                  │ Facilitator │
│  (Agent)  │ ◄── 402 + reqs ── │              │                  │ (x402.org)  │
│           │                    │              │                  │             │
│  Sign     │                    │              │                  │             │
│  EIP-3009 │                    │              │                  │             │
│           │ ── GET + X-PAY ──► │  Verify ─────────────────────► │  Settle     │
│           │ ◄── 200 + data ── │              │ ◄── tx hash ──── │  on-chain   │
└──────────┘                    └──────────────┘                  └─────────────┘
```

### Step-by-Step Flow

1. **Client requests a premium endpoint** (no payment attached)
2. **Server returns HTTP 402** with payment requirements in the `X-PAYMENT-REQUIRED` header (base64-encoded JSON)
3. **Client parses requirements** — learns the price, payment address, network, and asset
4. **Client signs an EIP-3009 `transferWithAuthorization`** — USDC gasless transfer authorization
5. **Client retries with `X-PAYMENT` header** containing the signed payment proof (base64-encoded)
6. **Server forwards to facilitator** — the facilitator validates the signature and settles on-chain
7. **Server returns data** with `X-Payment-Response` header containing the settlement transaction hash

### Payment Requirements Format

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "maxAmountRequired": "1000",
      "resource": "/api/premium/market/coins",
      "description": "Top cryptocurrency prices and market caps",
      "mimeType": "application/json",
      "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
      "maxTimeoutSeconds": 300,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
    }
  ]
}
```

### Payment Proof Format

```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "eip155:84532",
  "payload": {
    "signature": "0x...",
    "authorization": {
      "from": "0x<agent-wallet>",
      "to": "0x<payment-address>",
      "value": "1000",
      "validAfter": 1709510400,
      "validBefore": 1709510700,
      "nonce": "0x..."
    }
  }
}
```

## Codebase Layout

### Server-Side (Dashboard App)

| File | Purpose |
|------|---------|
| `apps/dashboard/src/lib/x402/config.ts` | Network configs, facilitators, USDC addresses, payment address |
| `apps/dashboard/src/lib/x402/pricing.ts` | Endpoint pricing ($0.001–$0.01), tier definitions, endpoint metadata |
| `apps/dashboard/src/lib/x402/middleware.ts` | Hybrid auth middleware (API key → access pass → x402) |
| `apps/dashboard/src/lib/x402/server.ts` | x402 resource server setup, facilitator client |
| `apps/dashboard/src/lib/x402/routes.ts` | Route generation from pricing config |

### Client-Side (Agent)

| File | Purpose |
|------|---------|
| `packages/pump-agent-swarm/src/analytics/x402-client.ts` | Production x402 client with full payment loop |

### SDK Packages

| Package | Version |
|---------|---------|
| `@x402/core` | ^2.2.0 |
| `@x402/evm` | ^2.2.0 |
| `@x402/next` | ^2.2.0 |

## Pricing

Premium endpoints are priced per request in USDC:

| Tier | Price | Endpoints |
|------|-------|-----------|
| Basic | $0.001 | Market data, coin listings |
| Standard | $0.002–$0.003 | Sentiment, DeFi protocols |
| Premium | $0.005 | AI analysis, whale tracking |
| Enterprise | $0.01 | Custom research, bulk data |

Individual endpoint prices are defined in `apps/dashboard/src/lib/x402/pricing.ts`.

## Supported Networks

| Network | Chain ID | USDC Address |
|---------|----------|-------------|
| Base Sepolia (testnet) | eip155:84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Base Mainnet | eip155:8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Ethereum | eip155:1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Polygon | eip155:137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |
| Arbitrum | eip155:42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Optimism | eip155:10 | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |

## Facilitators

Facilitators are third-party services that validate payment signatures and settle transactions on-chain:

| Facilitator | URL | Environment |
|-------------|-----|-------------|
| x402.org | `https://x402.org/facilitator` | Testnet (no setup needed) |
| Coinbase CDP | `https://api.developer.coinbase.com/rpc/v1/base/...` | Production |
| PayAI | `https://payai.network/facilitator` | Multi-chain |
| x402.rs | `https://x402.rs/facilitator` | Community (Rust) |

## Using the x402 Client

### For Agents (TypeScript)

```typescript
import { AnalyticsClient } from '@nirholas/pump-agent-swarm';

const client = new AnalyticsClient({
  baseUrl: 'https://cryptocurrency.cv',
  privateKey: process.env.WALLET_PRIVATE_KEY!,
  network: 'eip155:84532',
  maxPaymentPerRequest: 0.10,  // $0.10 max per request
  maxTotalBudget: 10.0,        // $10.00 total session budget
});

// Automatic 402 → sign → pay → data flow
const analytics = await client.getTokenAnalytics('SOL');    // $0.02
const signals = await client.getTradingSignals();           // $0.03
const curve = await client.getBondingCurveState(mintAddr);  // $0.005
const launches = await client.getNewLaunches();             // $0.01

// Listen to payment events
client.on('payment', ({ amount, txHash, endpoint }) => {
  console.log(`Paid $${amount} for ${endpoint} → ${txHash}`);
});

client.on('budgetWarning', ({ spent, budget }) => {
  console.log(`Budget warning: ${spent}/${budget} spent`);
});
```

### For HTTP Clients (Any Language)

```bash
# Step 1: Hit the endpoint (no payment)
curl -i https://cryptocurrency.cv/api/premium/market/coins
# → HTTP 402 with X-PAYMENT-REQUIRED header

# Step 2: Parse requirements, sign payment, retry
curl -H "X-PAYMENT: <base64-payment-proof>" \
     https://cryptocurrency.cv/api/premium/market/coins
# → HTTP 200 with data + X-Payment-Response header
```

## Demo

Two demo scripts demonstrate the full x402 flow with a "gas station" metaphor:

```bash
# Terminal 1: Start the demo server (5 premium endpoints)
npx tsx scripts/demo/x402-gas-station-server.ts

# Terminal 2: Run the agent demo
npx tsx scripts/demo/x402-gas-station-agent.ts
```

The agent demo shows a cinematic flow: wallet check → mission received → route planning → gas station refueling (5 paid endpoints) → AI analysis → full intelligence report → receipt showing total spent ($0.016 across 5 sources).

## Hybrid Authentication

The middleware supports three auth methods, checked in order:

1. **API key** — traditional `X-API-Key` header (for subscription users)
2. **Access pass** — pre-purchased access tokens
3. **x402 payment** — pay-per-request with USDC (for agents)

If none succeed, the endpoint returns HTTP 402 with payment requirements.

## EIP-3009: TransferWithAuthorization

x402 uses EIP-3009 for gasless USDC transfers. The agent signs a typed data message (EIP-712) authorizing the facilitator to transfer USDC on its behalf — no gas needed from the agent's wallet.

EIP-712 domain:
```
{
  name: "USD Coin",
  version: "2",
  chainId: <network-chain-id>,
  verifyingContract: <usdc-contract-address>
}
```

This means agents only need USDC in their wallet — no native chain token for gas.
