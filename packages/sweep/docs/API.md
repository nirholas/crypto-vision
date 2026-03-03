# API Reference

> **⚠️ CRITICAL: API endpoints that execute transactions handle user funds. Implement proper error handling and validation.**

## OpenAPI Specification

The complete API is documented in OpenAPI 3.1 format:

- **Spec file**: [openapi.yaml](./openapi.yaml)
- **View online**: Import the spec into [Swagger Editor](https://editor.swagger.io/) or [Redocly](https://redocly.github.io/redoc/)

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limits](#rate-limits)
4. [Endpoints](#endpoints)
   - [Wallet API](#wallet-api)
   - [Quote API](#quote-api)
   - [Sweep API](#sweep-api)
   - [Status API](#status-api)
   - [DeFi API](#defi-api)
   - [Bridge API](#bridge-api)
   - [Health API](#health-api)
5. [Error Handling](#error-handling)
6. [Webhooks](#webhooks)
7. [WebSocket Events](#websocket-events)

---

## Overview

The Sweep API is a RESTful service built with [Hono](https://hono.dev/). All endpoints return JSON and follow consistent patterns for requests and responses.

### Base URL

```
Production: https://api.sweep.xyz/api
Staging:    https://staging-api.sweep.xyz/api
Local:      http://localhost:3000/api
```

### Common Headers

| Header | Description | Required |
|--------|-------------|----------|
| `Content-Type` | `application/json` | Yes (POST/PUT) |
| `Authorization` | `Bearer <jwt_token>` | For authenticated endpoints |
| `X-Request-ID` | UUID for request tracing | No |

---

## Authentication

### SIWE (Sign-In with Ethereum)

The API uses Sign-In with Ethereum (SIWE) for wallet-based authentication.

#### 1. Request Nonce

```http
GET /api/auth/nonce?address=0x...
```

**Response:**
```json
{
  "nonce": "abc123xyz",
  "expiresAt": 1699999999999
}
```

#### 2. Sign Message

Sign the SIWE message with your wallet:

```javascript
const message = `Sign in to Sweep
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;
```

#### 3. Authenticate

```http
POST /api/auth/login
Content-Type: application/json

{
  "address": "0x...",
  "message": "Sign in to Sweep...",
  "signature": "0x..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": 1699999999999,
  "user": {
    "id": "uuid",
    "walletAddress": "0x...",
    "smartWalletAddress": "0x..."
  }
}
```

### x402 Payment Protocol

Some endpoints require micropayments via the x402 protocol:

```http
POST /api/sweep
Authorization: Bearer <token>
X-Payment: <x402_payment_header>
```

---

## Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Wallet scanning | 100 requests | 60 seconds |
| Quote requests | 50 requests | 60 seconds |
| Sweep execution | 10 requests | 60 seconds |
| Status checks | 200 requests | 60 seconds |
| DeFi endpoints | 100 requests | 60 seconds |
| Bridge endpoints | 50 requests | 60 seconds |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
```

---

## Endpoints

### Wallet API

#### Scan Wallet for Dust Tokens

Scans a wallet across multiple chains for small token balances ("dust").

```http
GET /api/wallet/:address/dust
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `address` | `string` | Wallet address (0x...) |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `chains` | `string` | all | Comma-separated chain list |
| `threshold` | `number` | 10 | Max USD value for dust |
| `async` | `boolean` | false | Queue scan for background processing |

**Example Request:**
```bash
curl "https://api.sweep.xyz/api/wallet/0x1234.../dust?chains=ethereum,base,arbitrum&threshold=5"
```

**Response (200 OK):**
```json
{
  "wallet": "0x1234...",
  "dust": {
    "ethereum": [
      {
        "address": "0xtoken...",
        "symbol": "SHIB",
        "name": "Shiba Inu",
        "decimals": 18,
        "balance": "1000000000000000000000",
        "usdValue": 3.45,
        "priceUsd": 0.00000345,
        "canSweep": true,
        "confidence": "HIGH"
      }
    ],
    "base": [
      {
        "address": "0xtoken...",
        "symbol": "PEPE",
        "name": "Pepe",
        "decimals": 18,
        "balance": "5000000000000000000000",
        "usdValue": 1.23,
        "priceUsd": 0.00000025,
        "canSweep": true,
        "confidence": "MEDIUM"
      }
    ]
  },
  "summary": {
    "totalTokens": 2,
    "totalValueUsd": 4.68,
    "chains": ["ethereum", "base"],
    "scannedAt": 1699999999999
  }
}
```

**Async Mode Response (202 Accepted):**
```json
{
  "status": "queued",
  "jobId": "job_123abc",
  "message": "Wallet scan queued. Poll /api/wallet/:address/dust/status/:jobId for results."
}
```

---

### Quote API

#### Get Sweep Quote

Generate a quote for sweeping dust tokens.

```http
POST /api/quote
Authorization: Bearer <token>  (optional)
```

**Request Body:**
```json
{
  "wallet": "0x1234...",
  "chains": ["ethereum", "base", "arbitrum"],
  "tokens": [
    {
      "address": "0xtoken1...",
      "chain": "ethereum",
      "amount": "1000000000000000000000"
    }
  ],
  "destination": {
    "chain": "ethereum",
    "token": "0xusdc...",
    "protocol": "aave",
    "vault": "0xaavePool..."
  },
  "slippageBps": 100,
  "gasToken": "0xusdc..."
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallet` | `string` | Yes | Source wallet address |
| `chains` | `string[]` | Yes | Chains to sweep from |
| `tokens` | `object[]` | No | Specific tokens (auto-scan if omitted) |
| `destination.chain` | `string` | Yes | Output chain |
| `destination.token` | `string` | Yes | Output token address |
| `destination.protocol` | `string` | No | DeFi protocol (aave/yearn/beefy/lido) |
| `destination.vault` | `string` | No | Vault address for DeFi deposit |
| `slippageBps` | `number` | No | Slippage in basis points (default: 100 = 1%) |
| `gasToken` | `string` | No | Token to pay gas with (sponsored if omitted) |

**Response (200 OK):**
```json
{
  "quoteId": "uuid-quote-123",
  "wallet": "0x1234...",
  "tokens": [
    {
      "address": "0xtoken...",
      "chain": "ethereum",
      "symbol": "SHIB",
      "amount": "1000000000000000000000",
      "usdValue": 3.45,
      "canSweep": true
    }
  ],
  "destination": {
    "chain": "ethereum",
    "token": "0xusdc...",
    "symbol": "USDC",
    "protocol": "aave",
    "vault": "0xaavePool..."
  },
  "summary": {
    "totalInputValueUsd": 4.68,
    "estimatedOutputAmount": "4500000",
    "estimatedOutputValueUsd": 4.50,
    "estimatedGasUsd": 0.15,
    "netValueUsd": 4.35,
    "savingsVsManual": 2.50
  },
  "route": {
    "aggregator": "1inch",
    "steps": [
      {
        "type": "swap",
        "chain": "ethereum",
        "protocol": "1inch",
        "tokenIn": "0xshib...",
        "tokenOut": "0xusdc...",
        "amountIn": "1000000000000000000000",
        "amountOut": "3450000"
      },
      {
        "type": "deposit",
        "chain": "ethereum",
        "protocol": "aave",
        "tokenIn": "0xusdc...",
        "tokenOut": "0xaUsdc...",
        "amountIn": "4500000",
        "amountOut": "4500000"
      }
    ]
  },
  "expiresAt": 1699999999999,
  "createdAt": 1699999000000
}
```

---

### Sweep API

#### Execute Sweep

Execute a sweep based on a previously obtained quote.

> **⚠️ CRITICAL**: This endpoint executes transactions that move user funds.

```http
POST /api/sweep
Authorization: Bearer <token>
X-Payment: <x402_payment>  (if required)
```

**Request Body:**
```json
{
  "wallet": "0x1234...",
  "quoteId": "uuid-quote-123",
  "signature": "0xsig...",
  "gasToken": "0xusdc..."
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallet` | `string` | Yes | Wallet address (must match auth) |
| `quoteId` | `string` | Yes | Quote ID from /api/quote |
| `signature` | `string` | Yes | Permit2 signature |
| `gasToken` | `string` | No | Token to pay gas (override quote) |

**Response (202 Accepted):**
```json
{
  "sweepId": "uuid-sweep-456",
  "status": "pending",
  "message": "Sweep submitted for execution",
  "estimatedCompletion": 1699999999999
}
```

**Possible Status Values:**
| Status | Description |
|--------|-------------|
| `pending` | Sweep created, awaiting processing |
| `quoting` | Getting final swap quotes |
| `signing` | Preparing transactions |
| `submitted` | UserOps submitted to bundler |
| `confirmed` | All transactions confirmed |
| `failed` | Sweep failed (see errorMessage) |
| `cancelled` | User cancelled the sweep |

---

### Status API

#### Get Sweep Status

Check the current status of a sweep.

```http
GET /api/sweep/:id/status
Authorization: Bearer <token>  (optional, for full details)
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Sweep UUID |

**Response (200 OK) - Authenticated:**
```json
{
  "sweepId": "uuid-sweep-456",
  "status": "confirmed",
  "chains": ["ethereum", "base"],
  "tokens": [
    {
      "address": "0xtoken...",
      "chain": "ethereum",
      "symbol": "SHIB",
      "amount": "1000000000000000000000",
      "usdValue": 3.45
    }
  ],
  "quote": {
    "quoteId": "uuid-quote-123",
    "outputToken": "0xusdc...",
    "outputAmount": "4500000",
    "estimatedGas": "150000",
    "netValueUsd": 4.35
  },
  "txHashes": {
    "ethereum": "0xtxhash1...",
    "base": "0xtxhash2..."
  },
  "userOpHashes": {
    "ethereum": "0xuserophash1..."
  },
  "outputToken": "0xusdc...",
  "outputAmount": "4480000",
  "outputChain": "ethereum",
  "totalInputValueUsd": "4.68",
  "totalOutputValueUsd": "4.48",
  "defiProtocol": "aave",
  "defiDestination": "0xaavePool...",
  "createdAt": 1699999000000,
  "updatedAt": 1699999500000,
  "completedAt": 1699999600000
}
```

**Response (200 OK) - Unauthenticated:**
```json
{
  "sweepId": "uuid-sweep-456",
  "status": "confirmed",
  "tokenCount": 2,
  "chainCount": 2,
  "createdAt": 1699999000000,
  "completedAt": 1699999600000
}
```

#### Get Transaction Details

```http
GET /api/sweep/:id/transactions
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "sweepId": "uuid-sweep-456",
  "transactions": [
    {
      "chain": "ethereum",
      "type": "userOp",
      "hash": "0xuserophash...",
      "txHash": "0xtxhash...",
      "status": "confirmed",
      "blockNumber": 18500000,
      "gasUsed": "150000",
      "timestamp": 1699999600000
    }
  ]
}
```

---

### DeFi API

#### Get Supported Chains

```http
GET /api/defi/chains
```

**Response:**
```json
{
  "success": true,
  "data": ["ethereum", "base", "arbitrum", "polygon", "bsc", "optimism"]
}
```

#### Get Supported Protocols

```http
GET /api/defi/protocols
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "AAVE",
      "name": "Aave V3",
      "supportedChains": ["ethereum", "base", "arbitrum", "polygon", "optimism"]
    },
    {
      "id": "YEARN",
      "name": "Yearn Finance",
      "supportedChains": ["ethereum", "arbitrum"]
    },
    {
      "id": "BEEFY",
      "name": "Beefy Finance",
      "supportedChains": ["ethereum", "base", "arbitrum", "polygon", "bsc", "optimism"]
    },
    {
      "id": "LIDO",
      "name": "Lido",
      "supportedChains": ["ethereum"]
    }
  ]
}
```

#### Get Vaults on Chain

```http
GET /api/defi/vaults/:chain
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chain": "ethereum",
    "count": 50,
    "vaults": [
      {
        "id": "aave-v3-usdc",
        "protocol": "AAVE",
        "name": "Aave V3 USDC",
        "symbol": "aUSDC",
        "address": "0x...",
        "productType": "LENDING",
        "depositToken": {
          "address": "0xusdc...",
          "symbol": "USDC",
          "decimals": 6
        },
        "apy": 4.5,
        "apyBase": 3.2,
        "apyReward": 1.3,
        "tvlUsd": 1500000000,
        "riskLevel": "LOW",
        "audited": true
      }
    ]
  }
}
```

#### Get Deposit Quote

```http
GET /api/defi/vaults/:chain/:protocol/:vaultAddress/quote?amount=1000000&userAddress=0x...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vault": "0xvault...",
    "depositToken": "0xusdc...",
    "amount": "1000000",
    "estimatedShares": "980000",
    "estimatedValue": "1000.00",
    "apy": 4.5,
    "estimatedYearlyReturn": "45.00",
    "gasEstimate": "150000"
  }
}
```

#### Find Best Route

```http
GET /api/defi/route/:chain?assetAddress=0x...&amount=1000000&userAddress=0x...
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `assetAddress` | `string` | Token to deposit |
| `amount` | `string` | Amount (wei) |
| `userAddress` | `string` | User wallet |
| `maxRiskLevel` | `string` | LOW/MEDIUM/HIGH |
| `minApy` | `number` | Minimum APY |
| `minTvl` | `number` | Minimum TVL |

**Response:**
```json
{
  "success": true,
  "data": {
    "bestVault": {
      "id": "yearn-usdc",
      "protocol": "YEARN",
      "apy": 5.2,
      "tvlUsd": 500000000
    },
    "alternatives": [
      {
        "id": "aave-v3-usdc",
        "protocol": "AAVE",
        "apy": 4.5
      }
    ],
    "route": {
      "steps": [
        {
          "type": "deposit",
          "protocol": "YEARN",
          "tokenIn": "0xusdc...",
          "vault": "0xvault..."
        }
      ]
    }
  }
}
```

---

### Bridge API

#### Get Bridge Routes

Get all available routes for cross-chain bridging.

```http
GET /api/bridge/routes?sourceChain=ethereum&destChain=base&token=0x...&amount=1000000&userAddress=0x...
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `sourceChain` | `string` | Source chain name |
| `destChain` | `string` | Destination chain name |
| `token` | `string` | Token address |
| `amount` | `string` | Amount in wei |
| `userAddress` | `string` | User wallet address |

**Response:**
```json
{
  "routes": [
    {
      "provider": "across",
      "inputAmount": "1000000000000000000",
      "outputAmount": "998000000000000000",
      "fee": "2000000000000000",
      "estimatedTime": 120,
      "protocolInfo": {
        "name": "Across Protocol",
        "website": "https://across.to",
        "avgTime": "2 minutes",
        "security": "Optimistic"
      }
    },
    {
      "provider": "stargate",
      "inputAmount": "1000000000000000000",
      "outputAmount": "995000000000000000",
      "fee": "5000000000000000",
      "estimatedTime": 300,
      "protocolInfo": {
        "name": "Stargate Finance",
        "website": "https://stargate.finance",
        "avgTime": "5 minutes",
        "security": "LayerZero"
      }
    }
  ],
  "count": 2,
  "meta": {
    "sourceChain": "ethereum",
    "destChain": "base",
    "token": "0x...",
    "amount": "1000000000000000000",
    "timestamp": 1699999999999
  }
}
```

#### Get Best Quote

```http
GET /api/bridge/quote?sourceChain=ethereum&destChain=base&sourceToken=0x...&amount=1000000&sender=0x...
```

**Additional Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `destToken` | `string` | Destination token (defaults to source) |
| `recipient` | `string` | Recipient address (defaults to sender) |
| `slippage` | `number` | Slippage tolerance |
| `priority` | `string` | `speed`, `cost`, or `reliability` |

**Response:**
```json
{
  "quote": {
    "id": "quote_abc123",
    "provider": "across",
    "sourceChain": "ethereum",
    "destChain": "base",
    "sourceToken": "0x...",
    "destToken": "0x...",
    "inputAmount": "1000000000000000000",
    "outputAmount": "998000000000000000",
    "fee": "2000000000000000",
    "estimatedTime": 120,
    "expiresAt": 1699999999999,
    "callData": "0x..."
  },
  "protocolInfo": {
    "name": "Across Protocol",
    "avgTime": "2 minutes"
  }
}
```

#### Execute Bridge

```http
POST /api/bridge/execute
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "quoteId": "quote_abc123",
  "userAddress": "0x...",
  "signature": "0x..."
}
```

**Response (202 Accepted):**
```json
{
  "bridgeId": "bridge_xyz789",
  "status": "pending",
  "txHash": "0x...",
  "trackingUrl": "https://across.to/tx/0x..."
}
```

#### Check Bridge Status

```http
GET /api/bridge/status/:txHash?sourceChain=ethereum
```

**Response:**
```json
{
  "status": "completed",
  "sourceChain": "ethereum",
  "destChain": "base",
  "sourceTxHash": "0x...",
  "destTxHash": "0x...",
  "inputAmount": "1000000000000000000",
  "outputAmount": "998000000000000000",
  "completedAt": 1699999999999
}
```

---

### Health API

#### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1699999999999,
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "connected",
    "queue": "running"
  }
}
```

#### Readiness Check

```http
GET /api/health/ready
```

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "redis": true,
    "providers": {
      "1inch": true,
      "paraswap": true,
      "across": true
    }
  }
}
```

#### Metrics (Prometheus)

```http
GET /api/metrics
```

Returns Prometheus-formatted metrics:

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/wallet",status="200"} 1234

# HELP sweep_execution_duration Sweep execution duration in seconds
# TYPE sweep_execution_duration histogram
sweep_execution_duration_bucket{chain="ethereum",le="5"} 100
```

---

## Error Handling

### Error Response Format

All errors follow this structure:

```json
{
  "error": "Error type",
  "message": "Human-readable description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `202` | Accepted (async processing) |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `410` | Gone (quote expired) |
| `429` | Too Many Requests |
| `500` | Internal Server Error |
| `503` | Service Unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_ADDRESS` | Invalid wallet address format |
| `INVALID_SIGNATURE` | Signature verification failed |
| `QUOTE_EXPIRED` | Quote has expired |
| `QUOTE_NOT_FOUND` | Quote ID not found |
| `INSUFFICIENT_BALANCE` | Insufficient token balance |
| `TOKEN_BLACKLISTED` | Token is blacklisted |
| `PRICE_UNTRUSTED` | Unable to validate token price |
| `SLIPPAGE_EXCEEDED` | Slippage tolerance exceeded |
| `CHAIN_UNAVAILABLE` | Chain is temporarily unavailable |
| `PROVIDER_ERROR` | External provider error |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

---

## Webhooks

Configure webhooks to receive real-time updates.

### Event Types

| Event | Description |
|-------|-------------|
| `sweep.created` | Sweep submitted |
| `sweep.submitted` | UserOps submitted to bundler |
| `sweep.confirmed` | All transactions confirmed |
| `sweep.failed` | Sweep execution failed |

### Webhook Payload

```json
{
  "event": "sweep.confirmed",
  "timestamp": 1699999999999,
  "data": {
    "sweepId": "uuid-sweep-456",
    "wallet": "0x...",
    "status": "confirmed",
    "outputAmount": "4480000",
    "outputToken": "0xusdc..."
  }
}
```

### Verifying Webhooks

Webhooks include a signature header for verification:

```
X-Webhook-Signature: sha256=abc123...
```

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

---

## WebSocket Events

Connect to `wss://api.sweep.xyz/ws` for real-time updates.

### Subscribe to Sweep Updates

```json
{
  "type": "subscribe",
  "channel": "sweep",
  "sweepId": "uuid-sweep-456"
}
```

### Events

```json
{
  "type": "sweep.status",
  "data": {
    "sweepId": "uuid-sweep-456",
    "status": "submitted",
    "txHash": "0x..."
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { SweepClient } from '@sweep/sdk';

const client = new SweepClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.sweep.xyz',
});

// Scan for dust
const dust = await client.wallet.scanDust('0x...', {
  chains: ['ethereum', 'base'],
  threshold: 10,
});

// Get quote
const quote = await client.quote.get({
  wallet: '0x...',
  chains: ['ethereum', 'base'],
  destination: {
    chain: 'ethereum',
    token: '0xusdc...',
  },
});

// Execute sweep
const sweep = await client.sweep.execute({
  quoteId: quote.quoteId,
  signature: await signer.signMessage(quote.message),
});

// Poll status
const status = await client.sweep.getStatus(sweep.sweepId);
```

### Python

```python
from sweep_bank import SweepClient

client = SweepClient(api_key="your-api-key")

# Scan for dust
dust = client.wallet.scan_dust("0x...", chains=["ethereum", "base"])

# Get quote
quote = client.quote.get(
    wallet="0x...",
    chains=["ethereum"],
    destination={"chain": "ethereum", "token": "0xusdc..."}
)

# Execute sweep
sweep = client.sweep.execute(quote_id=quote.quote_id, signature=sig)
```
