# PumpFun x402 — Architecture Plan

> **Machine-to-machine micropayments for AI agent token intelligence**
>
> An AI agent asks a question about a pump.fun memecoin. Free data comes from the public API.
> Premium analytics (whale tracking, sniper detection, smart money flows) are paywalled behind x402.
> The agent's embedded wallet auto-pays $0.02–$0.05 USDC per request on Base L2 — no human approval needed.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Payment Flow](#payment-flow)
4. [Module Structure](#module-structure)
5. [Deployment Topology](#deployment-topology)
6. [API Endpoints](#api-endpoints)
7. [MCP Tools](#mcp-tools)
8. [Security Model](#security-model)
9. [Configuration](#configuration)
10. [Extension Points](#extension-points)

---

## Overview

This module demonstrates **x402 agent micropayments** in a realistic setting: AI agents paying for premium token intelligence on Solana's pump.fun ecosystem.

### Key Principles

| Principle | Implementation |
|-----------|---------------|
| **Real payments** | USDC on Base L2 via EIP-3009 gasless transfers |
| **Invisible to users** | x402 middleware handles 402 → sign → retry automatically |
| **Sub-cent pricing** | $0.02–$0.05 per request, economically viable at scale |
| **Standard HTTP** | Uses HTTP 402 status code — works with any HTTP client |
| **Two-sided market** | Consumer (agent with wallet) ↔ Provider (analytics API) |

### What x402 Is

x402 is an open protocol for machine-to-machine payments over HTTP:

```
Client → GET /api/data
Server → 402 Payment Required (+ payment instructions)
Client → Signs USDC transfer (EIP-3009, gasless)
Client → GET /api/data + X-PAYMENT header
Server → Verifies payment via facilitator
Server → 200 OK (data)
```

No API keys. No subscriptions. No invoices. Just HTTP + crypto.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER LAYER                                  │
│                                                                      │
│   User / Developer  ──natural language──▶  AI Agent (Claude/GPT)    │
│                                                                      │
└────────────────────────────────────┬─────────────────────────────────┘
                                     │ MCP Protocol (stdio / SSE)
                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        MCP SERVER LAYER                              │
│                                                                      │
│   packages/mcp-server/                                               │
│   ├── server/base.ts       ← startServer() entry point              │
│   ├── evm.ts               ← registerEVM() aggregator               │
│   ├── x402/                ← x402 client, config, types             │
│   │   ├── client.ts        ← createX402Client(), wrapFetch()        │
│   │   └── config.ts        ← USDC addresses, facilitator URL        │
│   └── modules/pump-fun/    ← THIS MODULE                            │
│       ├── index.ts          ← registerPumpFun(server)               │
│       ├── tools.ts          ← 8 MCP tools (3 free + 5 premium)     │
│       ├── prompts.ts        ← 3 analysis prompts                    │
│       ├── client.ts         ← x402-enabled HTTP client              │
│       ├── types.ts          ← TypeScript interfaces                 │
│       ├── server.ts         ← Standalone x402 API server            │
│       └── demo.ts           ← Visual walkthrough                    │
│                                                                      │
└───────┬────────────────────────────┬─────────────────────────────────┘
        │                            │
        │ Free                       │ Premium ($0.02–$0.05)
        ▼                            ▼
┌──────────────────┐   ┌──────────────────────────────────────────────┐
│  pump.fun API    │   │         x402-PAYWALLED API SERVER            │
│  (public, free)  │   │                                              │
│                  │   │  server.ts (:4020)                           │
│  /coins/{mint}   │   │  ├── /api/pump/analysis/{mint}    → $0.03   │
│  /coins?sort=... │   │  ├── /api/pump/whales/{mint}      → $0.05   │
│                  │   │  ├── /api/pump/smart-money/{mint}  → $0.05   │
└──────────────────┘   │  ├── /api/pump/snipers/{mint}     → $0.02   │
                       │  ├── /api/pump/graduation-odds/{mint} → $0.03│
                       │  └── /.well-known/x402 (discovery)          │
                       │                                              │
                       └──────┬───────────────┬───────────────────────┘
                              │               │
                              ▼               ▼
                    ┌──────────────┐  ┌──────────────────┐
                    │ x402         │  │ Solana RPC        │
                    │ Facilitator  │  │ mainnet-beta      │
                    │ x402.org     │  │                   │
                    └──────┬───────┘  │ pump programs:    │
                           │          │ • pump (bonding)  │
                           ▼          │ • pump_amm        │
                    ┌──────────────┐  │ • pump_fees       │
                    │  Base L2     │  └──────────────────┘
                    │ eip155:8453  │
                    │              │
                    │ USDC:        │
                    │ 0x8335...2913│
                    └──────────────┘
```

---

## Payment Flow

The complete lifecycle of a single premium request:

```
 User                  Agent              x402 MW          Analytics API       Facilitator        Base L2
  │                      │                   │                  │                  │                 │
  │  "Analyze BONK..."   │                   │                  │                  │                 │
  ├─────────────────────▶│                   │                  │                  │                 │
  │                      │                   │                  │                  │                 │
  │                      │ ① pump_lookup     │                  │                  │                 │
  │                      │──(free)──────────▶│   GET /coins/xx  │                  │                 │
  │                      │                   │─────────────────▶│                  │                 │
  │                      │                   │◀─ 200 OK ────────│                  │                 │
  │                      │◀──────────────────│  {name, price}   │                  │                 │
  │                      │                   │                  │                  │                 │
  │                      │ ② pump_deep_analysis ($0.03)         │                  │                 │
  │                      │──(premium)───────▶│                  │                  │                 │
  │                      │                   │   GET /analysis  │                  │                 │
  │                      │                   │─────────────────▶│                  │                 │
  │                      │                   │◀─ 402 ───────────│                  │                 │
  │                      │                   │  {price, payTo,  │                  │                 │
  │                      │                   │   network, asset}│                  │                 │
  │                      │                   │                  │                  │                 │
  │                      │                   │ ③ Sign EIP-3009  │                  │                 │
  │                      │                   │ TransferWithAuth │                  │                 │
  │                      │                   │ (gasless USDC)   │                  │                 │
  │                      │                   │                  │                  │                 │
  │                      │                   │ ④ Retry with     │                  │                 │
  │                      │                   │   X-PAYMENT hdr  │                  │                 │
  │                      │                   │─────────────────▶│                  │                 │
  │                      │                   │                  │ ⑤ POST /verify   │                 │
  │                      │                   │                  │─────────────────▶│                 │
  │                      │                   │                  │                  │ ⑥ Verify USDC   │
  │                      │                   │                  │                  │────────────────▶│
  │                      │                   │                  │                  │◀────── ✅ ──────│
  │                      │                   │                  │◀─ valid: true ───│                 │
  │                      │                   │                  │                  │                 │
  │                      │                   │◀─ 200 OK ────────│                  │                 │
  │                      │◀──────────────────│  {healthScore,   │                  │                 │
  │                      │                   │   rugRisk, ...}  │                  │                 │
  │                      │                   │                  │                  │                 │
  │  "Score: 72/100      │                   │                  │                  │                 │
  │   Risk: LOW          │                   │                  │                  │                 │
  │   Graduation: 65%"   │                   │                  │                  │                 │
  │◀─────────────────────│                   │                  │                  │                 │
  │                      │                   │                  │                  │                 │
     Cost: $0.03 USDC on Base. User never saw the payment.
```

### Payment Details

| Property | Value |
|----------|-------|
| **Payment Asset** | USDC on Base L2 |
| **USDC Contract** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **Chain ID** | `eip155:8453` (Base mainnet) |
| **Transfer Method** | EIP-3009 `TransferWithAuthorization` (gasless) |
| **Facilitator** | `https://x402.org/facilitator` |
| **Pricing Scheme** | `exact` — fixed price per endpoint |

### Why Base L2?

- **Low fees**: ~$0.001 per tx (vs $5+ on Ethereum L1)
- **Fast finality**: ~2 seconds
- **Native USDC**: Circle's bridged USDC with EIP-3009 support
- **Coinbase ecosystem**: Most x402 facilitators run on Base

---

## Module Structure

```
packages/mcp-server/modules/pump-fun/
├── index.ts           Entry point — registerPumpFun(server)
│                      Calls registerPumpFunTools + registerPumpFunPrompts
│
├── tools.ts           8 MCP tools (the "consumer" interface)
│   ├── FREE:
│   │   ├── pump_lookup_token   — basic token data from pump.fun
│   │   ├── pump_get_price      — price + bonding curve position
│   │   └── pump_list_new       — recently launched tokens
│   └── PREMIUM (x402):
│       ├── pump_deep_analysis  — $0.03 — health score, risk, signals
│       ├── pump_whale_tracker  — $0.05 — top holders + labels
│       ├── pump_smart_money    — $0.05 — smart money flow analysis
│       ├── pump_sniper_detection — $0.02 — bot detection
│       └── pump_graduation_odds  — $0.03 — ML graduation probability
│
├── client.ts          x402-enabled HTTP client (wraps fetch)
│                      Auto-signs USDC payments on 402 responses
│
├── types.ts           TypeScript interfaces + pricing constants
│                      PumpToken, TokenDeepAnalysis, WhaleHolder, etc.
│
├── prompts.ts         3 pre-built analysis workflow prompts
│   ├── pump_analyze_token    — full analysis workflow
│   ├── pump_find_opportunities — opportunity scanner
│   └── pump_whale_alert      — whale movement alerts
│
├── server.ts          Standalone x402-paywalled API server
│                      The "provider" side — deploy to monetize analytics
│                      Processes real on-chain Solana data
│
├── demo.ts            Visual terminal demonstration
│                      Run: npx tsx demo.ts --dry-run
│
├── README.md          Usage documentation
└── ARCHITECTURE.md    This file
```

### Registration Chain

```
server/base.ts → startServer()
  └─▶ evm.ts → registerEVM(server)
        ├─▶ x402/ → x402 client infrastructure
        ├─▶ modules/pump-fun/ → registerPumpFun(server)
        │     ├─▶ registerPumpFunTools(server)  — 8 tools
        │     └─▶ registerPumpFunPrompts(server) — 3 prompts
        └─▶ ...other modules
```

### Dependency Graph

```
index.ts ──▶ tools.ts ──▶ client.ts ──▶ @x402/core
         │            │            └──▶ @x402/evm
         │            │            └──▶ x402/client.ts (shared infra)
         │            └──▶ types.ts
         └──▶ prompts.ts

server.ts ──▶ types.ts
          └──▶ @solana/web3.js
          └──▶ @pump-fun/pump-sdk (optional)
```

---

## Deployment Topology

Two independently deployable components:

### 1. Consumer (AI Agent + MCP Server)

The MCP server runs alongside an AI agent. When the agent calls a premium tool, the x402 client auto-pays:

```
┌─────────────────────────────────────────────┐
│  AI Agent Process                            │
│                                              │
│  ┌──────────┐    ┌────────────┐             │
│  │  Agent   │───▶│ MCP Server │             │
│  │  (LLM)   │    │            │             │
│  └──────────┘    │ ┌────────┐ │             │
│                  │ │PumpFun │ │             │
│                  │ │ Tools  │ │             │
│                  │ └───┬────┘ │             │
│                  │     │      │             │
│                  │ ┌───▼────┐ │             │
│                  │ │ x402   │ │             │
│                  │ │ Client │ │             │
│                  │ └───┬────┘ │             │
│                  └─────┼──────┘             │
│                        │                     │
│  ┌─────────────────────▼───────────────────┐│
│  │         Agent Wallet (embedded)          ││
│  │  • Private key in env (X402_PRIVATE_KEY) ││
│  │  • USDC balance on Base L2               ││
│  │  • Signs EIP-3009 transfers              ││
│  │  • No ETH needed (gasless)               ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

**Environment Variables:**
```bash
X402_PRIVATE_KEY=0x...       # Agent's embedded wallet private key
X402_NETWORK=eip155:8453     # Base mainnet
PUMP_ANALYTICS_API_URL=https://your-analytics-api.com
```

### 2. Provider (Analytics API Server)

The standalone `server.ts` serves analytics behind x402 paywalls:

```
┌───────────────────────────────────────────────────┐
│  Analytics API Server (server.ts)                  │
│  Port: 4020                                        │
│                                                    │
│  ┌────────────────────────────────────────────────┐│
│  │  HTTP Router                                    ││
│  │  ├── GET /.well-known/x402 (discovery)         ││
│  │  ├── GET /api/pump/analysis/:mint ($0.03)      ││
│  │  ├── GET /api/pump/whales/:mint   ($0.05)      ││
│  │  ├── GET /api/pump/smart-money/:mint ($0.05)   ││
│  │  ├── GET /api/pump/snipers/:mint  ($0.02)      ││
│  │  └── GET /api/pump/graduation-odds/:mint ($0.03)││
│  └────────────┬───────────────────────────────────┘│
│               │                                     │
│  ┌────────────▼──────────────────┐                 │
│  │  x402 Payment Verification    │                 │
│  │  • Parse X-PAYMENT header     │                 │
│  │  • POST to facilitator        │                 │
│  │  • Verify payment on-chain    │                 │
│  └────────────┬──────────────────┘                 │
│               │                                     │
│  ┌────────────▼──────────────────┐                 │
│  │  On-Chain Analytics Engine    │                 │
│  │  • Solana RPC queries         │                 │
│  │  • Token holder analysis      │                 │
│  │  • Transaction pattern        │                 │
│  │    detection                  │                 │
│  │  • Bonding curve math         │                 │
│  │  • Graduation scoring         │                 │
│  └────────────┬──────────────────┘                 │
│               │                                     │
│  ┌────────────▼──────────────────┐                 │
│  │  Provider Wallet              │                 │
│  │  • Receives USDC payments     │                 │
│  │  • X402_PAY_TO_ADDRESS env    │                 │
│  └───────────────────────────────┘                 │
└────────────────────────────────────────────────────┘
```

**Environment Variables:**
```bash
X402_PAY_TO_ADDRESS=0x...    # Wallet to receive USDC payments
SOLANA_RPC_URL=https://...   # Solana RPC for on-chain data
X402_FACILITATOR_URL=https://x402.org/facilitator
PUMP_X402_PORT=4020          # API server port
```

---

## API Endpoints

### Provider API (server.ts)

| Method | Path | Price | Description |
|--------|------|-------|-------------|
| `GET` | `/.well-known/x402` | Free | x402 discovery — lists all paywalled endpoints |
| `GET` | `/api/pump/analysis/{mint}` | $0.03 | Deep analysis: health score, rug risk, signals |
| `GET` | `/api/pump/whales/{mint}` | $0.05 | Top 20 holders with whale/sniper labels |
| `GET` | `/api/pump/smart-money/{mint}` | $0.05 | Smart money inflow/outflow tracking |
| `GET` | `/api/pump/snipers/{mint}` | $0.02 | Sniper bot detection on launch |
| `GET` | `/api/pump/graduation-odds/{mint}` | $0.03 | ML-scored graduation probability |

### 402 Response Format

When a client calls without payment:

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
X-Payment-Required: true

{
  "x402": {
    "version": 1,
    "scheme": "exact",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "30000",
    "payTo": "0xYourProviderAddress",
    "facilitator": "https://x402.org/facilitator",
    "description": "Deep analysis of pump.fun token",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 300,
    "extra": {
      "name": "USDC",
      "decimals": 6
    }
  }
}
```

### Authenticated Request

```http
GET /api/pump/analysis/TokenMintHere HTTP/1.1
X-PAYMENT: eyJwYXlsb2FkIjp7InNpZ25hdHVyZSI6IjB4Li4uIi... (base64)
```

---

## MCP Tools

### Free Tier

| Tool | Input | Output |
|------|-------|--------|
| `pump_lookup_token` | `mint: string` | Token name, symbol, creator, bonding curve state |
| `pump_get_price` | `mint: string` | Price in SOL & USD, market cap, bonding position |
| `pump_list_new` | `limit?: number` | Last N tokens launched on pump.fun |

### Premium Tier (x402)

| Tool | Cost | Input | Output |
|------|------|-------|--------|
| `pump_deep_analysis` | $0.03 | `mint` | Health score 0-100, rug risk, holder distribution, signals |
| `pump_whale_tracker` | $0.05 | `mint` | Top 20 holders, % owned, whale/sniper/team labels |
| `pump_smart_money` | $0.05 | `mint` | Net flow, notable wallets, trend direction |
| `pump_sniper_detection` | $0.02 | `mint` | Sniper count, block speed, total % sniped |
| `pump_graduation_odds` | $0.03 | `mint` | Graduation probability, time estimate, risk factors |

### Cost Examples

| Agent Task | Tools Used | Total Cost |
|-----------|------------|------------|
| "What's the price of BONK?" | `pump_get_price` | **Free** |
| "Is this token safe?" | `pump_lookup` + `pump_deep_analysis` | **$0.03** |
| "Full memecoin report" | `pump_lookup` + `pump_deep_analysis` + `pump_whale_tracker` + `pump_sniper_detection` | **$0.10** |
| "Find opportunities" | `pump_list_new` + 5x `pump_graduation_odds` | **$0.15** |
| Scan 100 tokens/day | Mixed | **~$3–8/day** |

---

## Security Model

### Agent Wallet

```
┌──────────────────────────────────────────────┐
│  Agent Wallet Security                        │
│                                               │
│  ╔═══════════════════════════════════════╗    │
│  ║  Private Key (X402_PRIVATE_KEY)       ║    │
│  ║  • Stored in env / secret manager     ║    │
│  ║  • Never logged, never transmitted    ║    │
│  ║  • Only used for EIP-3009 signing     ║    │
│  ╚═══════════════════════════════════════╝    │
│                                               │
│  Spending Controls:                           │
│  • Per-request cap: max_payment_usd ($1.00)  │
│  • Session budget: configurable               │
│  • Allowlisted endpoints only                 │
│  • Amount verified before signing              │
│                                               │
│  EIP-3009 Benefits:                           │
│  • Gasless — no ETH balance needed            │
│  • Nonce-based — replay-protected             │
│  • Expiry — time-bounded authorizations       │
│  • Scoped — exact amount, specific recipient  │
│                                               │
└──────────────────────────────────────────────┘
```

### Payment Verification (Provider Side)

1. **Parse** `X-PAYMENT` header (base64 → JSON)
2. **Validate** payment amount >= required price
3. **Verify** via facilitator (POST to `x402.org/facilitator`)
4. Facilitator **checks on-chain** USDC transfer on Base L2
5. Returns `{ valid: true, txHash: "0x..." }`
6. Server returns data only after verification

### Threat Mitigations

| Threat | Mitigation |
|--------|-----------|
| Replay attacks | EIP-3009 nonce ensures one-time use |
| Overpayment | Client validates amount before signing |
| Fake payments | Facilitator verifies on-chain settlement |
| Key exposure | Env-only, never in code or logs |
| Price manipulation | Server sets prices; client can reject |
| DoS via 402 loop | Max retry limit (default: 1 attempt) |

---

## Configuration

### Required Environment Variables

```bash
# Consumer (Agent) Side
X402_PRIVATE_KEY=0x...                    # EVM wallet private key
X402_NETWORK=eip155:8453                  # Settlement network (Base)
PUMP_ANALYTICS_API_URL=https://...        # Provider's API URL

# Provider (Analytics Server) Side
X402_PAY_TO_ADDRESS=0x...                 # Receiving wallet address
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PUMP_X402_PORT=4020                       # HTTP port
X402_FACILITATOR_URL=https://x402.org/facilitator
```

### Optional Configuration

```bash
# Spending limits
X402_MAX_PAYMENT_USD=1.00                 # Max per-request (default $1)
X402_SESSION_BUDGET_USD=10.00             # Session spending cap

# Network
X402_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  # Base USDC
X402_CHAIN_ID=8453                        # Base chain ID
```

---

## Extension Points

### Adding a New Premium Endpoint

1. **Define the type** in `types.ts`:
   ```typescript
   export interface NewAnalysis {
     // your fields
   }
   ```

2. **Add pricing** to `PUMP_X402_PRICING`:
   ```typescript
   export const PUMP_X402_PRICING = {
     // ...existing
     newAnalysis: 0.04,  // $0.04 USDC
   }
   ```

3. **Add the client method** in `client.ts`:
   ```typescript
   async getNewAnalysis(mint: string): Promise<NewAnalysis> {
     const res = await this.fetch(`${PUMP_API_BASE}/api/pump/new-analysis/${mint}`)
     // ...
   }
   ```

4. **Register the MCP tool** in `tools.ts`:
   ```typescript
   server.tool(
     "pump_new_analysis",
     `New analysis — Cost: $${PUMP_X402_PRICING.newAnalysis} USDC via x402`,
     { mint: z.string().describe("Solana token mint address") },
     async ({ mint }) => { /* ... */ }
   )
   ```

5. **Add the server route** in `server.ts`:
   ```typescript
   // Route handler with 402 gating
   ```

### Switching Settlement Networks

Change the settlement from Base to another chain:

| Network | Chain ID | USDC Address | Config |
|---------|----------|-------------|--------|
| Base | `eip155:8453` | `0x8335...2913` | Default |
| Ethereum | `eip155:1` | `0xA0b8...5cb2` | Higher gas |
| Polygon | `eip155:137` | `0x3c49...4ca2` | Low gas |
| Solana | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | EPjFWdd... | Native |

### Adding Solana-Native Payments (SVM)

x402 supports Solana settlement via `@x402/svm`:

```typescript
import { createX402SvmClient } from "@x402/svm"

// Pay with USDC on Solana instead of Base
const client = createX402SvmClient({
  network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana
  wallet: solanaKeypair,
})
```

---

## Running the Demo

```bash
# Visual walkthrough (no real payments)
npx tsx packages/mcp-server/modules/pump-fun/demo.ts --dry-run

# Start the analytics API server
export X402_PAY_TO_ADDRESS="0xYourAddress"
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
npx tsx packages/mcp-server/modules/pump-fun/server.ts

# Test against the live server with a real x402 client
export X402_PRIVATE_KEY="0xYourAgentWalletKey"
npx tsx packages/mcp-server/modules/pump-fun/demo.ts TokenMintHere
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **USDC over native tokens** | Stable pricing ($0.03 stays $0.03 regardless of ETH/SOL price) |
| **Base L2 over Ethereum** | Sub-cent tx fees make micropayments economically viable |
| **EIP-3009 over transfer()** | Gasless — agent doesn't need ETH, just USDC |
| **Facilitator over self-verify** | Offloads on-chain verification; standard x402 pattern |
| **Lazy client init** | Only creates x402 wallet connection when premium tools are first used |
| **Free + premium tiers** | Free tools for discovery, premium for alpha — natural upgrade path |
| **MCP over REST** | Agents speak MCP natively; tools are discoverable and self-documenting |
| **Per-request pricing** | No subscriptions, no rate limits — pay only for what you use |

---

*Built for the [crypto-vision](https://github.com/nirholas/crypto-vision) project by [@nirholas](https://github.com/nirholas)*
