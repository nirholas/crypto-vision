# Solana x402 + Pump.fun SDK — Architecture Plan

> **Protocol**: x402 (HTTP 402 Payment Required)  
> **Chain**: Solana (no EVM, no facilitator, no bridges)  
> **Token**: USDC (SPL)  
> **SDK**: `@pump-fun/pump-sdk` v1.28.0  
> **Package**: `@nirholas/pump-agent-swarm`

---

## 1. Overview

A **pure Solana** x402 implementation that lets AI agents autonomously pay USDC micropayments for premium Pump.fun market data. Solana's ~400ms finality eliminates the need for a facilitator — agents pay directly on-chain, servers verify via RPC.

```
Agent wants data → API returns 402 → Agent pays USDC on Solana → API verifies on-chain → Data returned
```

---

## 2. Why Solana x402 Is Different

| Aspect | EVM x402 (Coinbase SDK) | Solana x402 (ours) |
|--------|-------------------------|-------------------|
| Settlement | Facilitator submits tx | Agent pays directly |
| Verification | Off-chain allowance check | `getParsedTransaction()` on-chain |
| Latency | ~12s (Ethereum L1) | ~400ms (Solana) |
| Token standard | ERC-20 via EIP-3009 | SPL Transfer |
| Challenge binding | EIP-712 typed data | Memo program instruction |
| Facilitator fee | 1–5% | 0% (no intermediary) |
| SDK status | `@x402/evm` official | Custom (built here) |

---

## 3. Payment Flow

### 3.1 Sequence

```
Step 1:  Agent  ──GET /api/pump/screener──▶  Server
                                              │
Step 2:  Agent  ◀──402 + challenge nonce──────┘
                │
                │  Budget check: $0.003 ≤ $0.10/req ✅
                │  Balance check: USDC ≥ $0.003 ✅
                │
Step 3:  Agent  ──SPL Transfer ($0.003 USDC) + Memo("x402:nonce")──▶  Solana
                                                                        │
Step 4:  Agent  ◀──txSignature (confirmed ~400ms)───────────────────────┘
                │
Step 5:  Agent  ──GET + X-PAYMENT: {txSig, challenge, payer}──▶  Server
                                                                    │
                                                   Server ──getParsedTransaction()──▶ Solana
                                                   Server ◀──tx details (SPL + memo)──┘
                                                   Verify: amount ✅ dest ✅ memo ✅ replay ✅
                                                                    │
Step 6:  Agent  ◀──200 + premium data───────────────────────────────┘
```

### 3.2 Transaction Structure

Each payment is a single Solana transaction with exactly 2 instructions:

```
Transaction {
  instruction[0]: SPL Transfer (checked)
    ├── source:      Agent's USDC ATA
    ├── destination:  Server's USDC ATA
    ├── amount:       3000 (= $0.003, 6 decimals)
    ├── mint:         EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    └── decimals:     6

  instruction[1]: Memo v2
    ├── program:      MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
    ├── signer:       Agent public key (must be signer)
    └── data:         "x402:<challenge_nonce>"
}
```

### 3.3 Headers

**402 Response** — `X-PAYMENT-REQUIRED`:
```json
{
  "x402Version": 1,
  "scheme": "exact-solana",
  "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "maxAmountRequired": "3000",
  "resource": "/api/pump/screener",
  "description": "Pay $0.003 USDC for Pump.fun screener data",
  "payTo": "<server-usdc-ata>",
  "challenge": "x402_<32-byte-hex>",
  "expiry": 1719500000,
  "extra": {
    "memo_program": "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    "usdc_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  }
}
```

**Payment Proof** — `X-PAYMENT`:
```json
{
  "x402Version": 1,
  "scheme": "exact-solana",
  "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "payload": {
    "txSignature": "<base58-tx-signature>",
    "challenge": "x402_<same-nonce>",
    "payer": "<agent-pubkey-base58>"
  }
}
```

---

## 4. Component Architecture

### 4.1 File Map

```
packages/pump-agent-swarm/src/
├── x402/                          ← SOLANA-NATIVE (implemented)
│   ├── types.ts       (240 lines)    Type definitions, constants
│   ├── client.ts      (590 lines)    SolanaX402Client
│   ├── server.ts      (561 lines)    SolanaX402Server
│   └── index.ts        (43 lines)    Barrel exports
│
├── api/                           ← SCREENER SERVER (to build)
│   ├── screener-server.ts             Hono HTTP server
│   ├── x402-middleware.ts             402 challenge/verify middleware
│   └── routes/
│       └── pump.ts                    Pump.fun data routes
│
├── analytics/                     ← LEGACY (to deprecate)
│   └── x402-client.ts (336 lines)    EVM client (ethers.js)
│
├── swarm.ts                       ← NEEDS MIGRATION
│   └── imports AnalyticsClient        → should import SolanaX402Client
│
└── config/
    └── env.ts                     ← NEEDS UPDATE
        └── evmPrivateKey              → should use solanaPrivateKey
```

### 4.2 Component Responsibilities

| Component | Class | Role |
|-----------|-------|------|
| **x402 Client** | `SolanaX402Client` | Auto-pay USDC on 402, budget enforcement, 6 premium endpoint wrappers |
| **x402 Server** | `SolanaX402Server` | Generate challenges, verify on-chain, prevent replay, revenue tracking |
| **x402 Types** | — | `SolanaX402PaymentRequired`, `SolanaPaymentScheme`, `SolanaX402PaymentProof`, USDC constants, CAIP-2 IDs |
| **Screener API** | (to build) | HTTP server with x402-gated Pump.fun endpoints |
| **Middleware** | (to build) | Express/Hono middleware for 402 flow |
| **SwarmCoordinator** | `SwarmCoordinator` | Orchestrates agents, needs to use `SolanaX402Client` |

---

## 5. API Endpoints

### 5.1 Premium Endpoints (x402-gated)

| Endpoint | Method | Price (USDC) | Data Source |
|----------|--------|-------------|-------------|
| `/api/pump/screener` | GET | $0.003 | `getNewLaunches()` — new token launches |
| `/api/pump/analytics/:mint` | GET | $0.01 | `bondingCurvePda()` + `getTokenPrice()` |
| `/api/pump/whales/:mint` | GET | $0.05 | Token account analysis via RPC |
| `/api/pump/graduation/:mint` | GET | $0.02 | Bonding curve progress → Raydium |
| `/api/pump/signals` | GET | $0.01 | Aggregated signals across tokens |

### 5.2 Free Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/x402` | GET | Discovery document (prices, schemes) |
| `/healthz` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |

### 5.3 Discovery Document

```json
{
  "version": "1.0.0",
  "provider": "pump-agent-swarm",
  "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "paymentScheme": "exact-solana",
  "acceptedTokens": [{
    "symbol": "USDC",
    "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "decimals": 6
  }],
  "endpoints": [
    { "path": "/api/pump/screener", "price": "3000", "method": "GET" },
    { "path": "/api/pump/analytics/:mint", "price": "10000", "method": "GET" },
    { "path": "/api/pump/whales/:mint", "price": "50000", "method": "GET" },
    { "path": "/api/pump/graduation/:mint", "price": "20000", "method": "GET" },
    { "path": "/api/pump/signals", "price": "10000", "method": "GET" }
  ]
}
```

---

## 6. Security Model

### 6.1 Client-Side

| Protection | Implementation |
|------------|---------------|
| Budget cap per request | `maxPaymentPerRequest: $0.10` — reject above |
| Budget cap per session | `totalBudget: $10.00` — hard stop |
| Balance pre-check | `getAccount()` before signing |
| Challenge validation | Format + expiry check before paying |
| User confirmation | Prompt human for payments > $1.00 |

### 6.2 Server-Side

| Protection | Implementation |
|------------|---------------|
| On-chain verification | `getParsedTransaction()` confirms actual transfer |
| Replay prevention | `Set<string>` of used tx signatures |
| Challenge TTL | Nonces expire after 5 minutes |
| Amount validation | Transfer amount ≥ `maxAmountRequired` |
| Destination check | Transfer must land at server's ATA |
| Memo binding | Memo must contain exact challenge nonce |

### 6.3 Attack Matrix

| Attack | Mitigation |
|--------|-----------|
| Replay (reuse txSig) | Each signature used exactly once |
| Expired challenge | Server-side expiry check |
| Underpayment | Amount comparison on-chain |
| Wrong destination | ATA address comparison |
| Front-running | Challenge bound to payer via memo signer |
| Double-spend | `confirmed` commitment (31+ validators) |

---

## 7. Dependencies

```
@pump-fun/pump-sdk v1.28.0       ← Pump.fun on-chain SDK
├── PumpSdk / OnlinePumpSdk         Bonding curve operations
├── bondingCurvePda()                Derive curve PDAs
├── getTokenPrice()                  Price from on-chain reserves
├── getBuyTokenAmountFromSolAmount() 
├── PUMP_PROGRAM_ID                  6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
└── DecodedBondingCurve              Curve state type

@solana/web3.js v1.98.0           ← Solana RPC + transactions
├── Connection                       RPC client
├── Keypair                          Agent wallet
├── Transaction                      Payment txs
├── sendAndConfirmTransaction        Submit + confirm
└── getParsedTransaction             Server verification

@solana/spl-token v0.4.13        ← USDC token operations
├── getAssociatedTokenAddress        Derive ATAs
├── createTransferCheckedInstruction Transfer with decimals
└── getAccount                       Balance queries
```

### Constants

```typescript
// USDC Mint Addresses
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_MINT_DEVNET  = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// Memo Program v2
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

// CAIP-2 Network Identifiers
const CAIP2_SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const CAIP2_SOLANA_DEVNET  = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
```

---

## 8. Implementation Roadmap

### Phase 1 — Wire Up (Immediate)

| Task | File | Description |
|------|------|-------------|
| Migrate SwarmCoordinator | `swarm.ts` | Replace `AnalyticsClient` → `SolanaX402Client` |
| Fix config | `config/env.ts` | `evmPrivateKey` → existing Solana keypair |
| Delete legacy | `analytics/x402-client.ts` | Remove EVM client (ethers.js + EIP-712) |

### Phase 2 — Screener API Server

| Task | File | Description |
|------|------|-------------|
| x402 middleware | `api/x402-middleware.ts` | Hono middleware: 402 challenge + verify |
| Screener server | `api/screener-server.ts` | HTTP server, endpoint registration |
| Route handlers | `api/routes/pump.ts` | 5 premium routes using Pump.fun SDK |
| Discovery document | `.well-known/x402` | JSON schema of all endpoints + prices |
| Health + metrics | `api/screener-server.ts` | `/healthz`, revenue tracking |

### Phase 3 — Production Hardening

| Task | Description |
|------|-------------|
| Persistent challenge store | Redis-backed (multi-instance) |
| Rate limiting | Per-wallet limits even with valid payments |
| Webhook notifications | Alert on large payments |
| Prometheus metrics | Payment success rate, verification latency, revenue |

### Phase 4 — Visual Builder UX

| Task | Description |
|------|-------------|
| Node-based flow editor | 6-node pipeline: Trigger → Tool Call → 402 → Policy → Sign → Response |
| Live transaction viewer | Real-time USDC payments on Solana Explorer |
| Budget dashboard | Spending analytics, per-endpoint costs, remaining budget |

---

## 9. Quick Start

### Agent (Client) Usage

```typescript
import { SolanaX402Client } from './x402/client.js';
import { Keypair, Connection } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const wallet = Keypair.fromSecretKey(/* agent wallet */);

const client = new SolanaX402Client({
  connection,
  payer: wallet,
  apiBaseUrl: 'https://api.cryptovision.dev',
  maxPaymentPerRequest: 0.10,
  totalBudget: 10.00,
  network: 'mainnet-beta',
});

// Auto-pays USDC when API returns 402
const launches = await client.getNewLaunches({ limit: 20 });
const signals = await client.getTradingSignals('pump-fun');
const whales = await client.getWhaleAnalysis('TokenMintAddress...');

console.log(client.getStats());
// { totalSpent: 0.063, requestCount: 3, remainingBudget: 9.937 }
```

### Server Usage

```typescript
import { SolanaX402Server } from './x402/server.js';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');

const server = new SolanaX402Server({
  connection,
  receiverPubkey: new PublicKey('YourServerWallet...'),
  network: 'mainnet-beta',
  challengeTtlMs: 300_000, // 5 minutes
});

// In your route handler:
app.get('/api/pump/screener', async (req, res) => {
  const paymentHeader = req.headers['x-payment'];
  
  if (!paymentHeader) {
    const challenge = server.createPaymentRequired('/api/pump/screener', 3000);
    res.status(402).set(server.create402Headers(challenge)).json(challenge);
    return;
  }

  const result = await server.verifyPayment(paymentHeader);
  if (!result.valid) {
    res.status(402).json({ error: result.reason });
    return;
  }

  // Payment verified — serve premium data
  const data = await fetchPumpFunScreenerData();
  res.json(data);
});
```

---

*Generated from codebase analysis of `packages/pump-agent-swarm/src/x402/` (1,469 lines across 4 files).*
