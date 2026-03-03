# Authentication Guide

This guide covers the authentication methods for the Crypto Data Aggregator API.

---

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
  - [API Keys](#api-keys)
  - [x402 Micropayments](#x402-micropayments)
- [Rate Limits](#rate-limits)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)

---

## Overview

The API supports two authentication methods:

| Method                 | Best For                       | How It Works                      |
| ---------------------- | ------------------------------ | --------------------------------- |
| **API Keys**           | Regular usage, subscriptions   | Traditional header-based auth     |
| **x402 Micropayments** | Pay-per-request, no commitment | Crypto payments via x402 protocol |

**Free endpoints** (news, search, trending) require no authentication.

**Premium endpoints** (`/api/v1/*`) require either an API key or x402 payment.

---

## Authentication Methods

### API Keys

API keys provide traditional authentication with tiered rate limits.

#### Getting an API Key

1. Visit [/developers](https://free-crypto-news.vercel.app/developers)
2. Enter your email address
3. Save your API key (shown only once!)

#### Using Your API Key

**Option 1: Header (Recommended)**

```bash
curl -H "X-API-Key: cda_free_xxxxx" \
  https://free-crypto-news.vercel.app/api/v1/coins
```

**Option 2: Query Parameter**

```bash
curl "https://free-crypto-news.vercel.app/api/v1/coins?api_key=cda_free_xxxxx"
```

#### API Key Tiers

| Tier           | Rate Limit          | Price     | Features                                 |
| -------------- | ------------------- | --------- | ---------------------------------------- |
| **Free**       | 100 requests/day    | $0        | Basic market data, top 100 coins         |
| **Pro**        | 10,000 requests/day | $29/month | All endpoints, historical data, webhooks |
| **Enterprise** | Unlimited           | $99/month | Dedicated support, SLA, custom endpoints |

#### Key Prefixes

Keys are prefixed to indicate tier:

- `cda_free_` - Free tier
- `cda_pro_` - Pro tier
- `cda_ent_` - Enterprise tier

---

### x402 Micropayments

x402 enables pay-per-request access using USDC on Base network. No subscription required.

#### How It Works

1. Request hits premium endpoint without auth
2. Server returns `402 Payment Required` with payment requirements
3. Your app signs a payment authorization
4. Re-send request with `X-PAYMENT` header
5. Server verifies payment and returns data

#### Payment Flow

```
┌──────────┐          ┌─────────────────┐          ┌─────────────┐
│  Client  │          │      API        │          │ Facilitator │
└────┬─────┘          └────────┬────────┘          └──────┬──────┘
     │                         │                          │
     │  1. GET /api/v1/coins   │                          │
     │────────────────────────>│                          │
     │                         │                          │
     │  2. 402 + X-PAYMENT-REQUIRED                       │
     │<────────────────────────│                          │
     │                         │                          │
     │  3. GET /api/v1/coins + X-PAYMENT                  │
     │────────────────────────>│                          │
     │                         │                          │
     │                         │  4. Verify payment       │
     │                         │─────────────────────────>│
     │                         │                          │
     │  5. 200 OK + Data       │                          │
     │<────────────────────────│                          │
```

#### Pricing

| Endpoint                 | Price per Request      |
| ------------------------ | ---------------------- |
| `/api/v1/coins`          | $0.001                 |
| `/api/v1/coins/:id`      | $0.001                 |
| `/api/v1/historical/:id` | $0.02 per year of data |
| `/api/v1/export`         | $0.10                  |
| `/api/v1/analytics`      | $0.005                 |
| `/api/v1/screener`       | $0.05                  |

#### Using x402 in Code

**JavaScript (with @x402/fetch)**

```javascript
import { wrapFetch } from '@x402/fetch';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

// Create wallet client
const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

// Wrap fetch with x402 support
const x402Fetch = wrapFetch(fetch, walletClient);

// Make request - payment is handled automatically
const response = await x402Fetch('https://api.example.com/api/v1/coins');
const data = await response.json();
```

**Python (manual)**

```python
import requests
import base64
import json

# First request to get payment requirements
response = requests.get('https://api.example.com/api/v1/coins')

if response.status_code == 402:
    payment_required = response.headers.get('X-PAYMENT-REQUIRED')
    requirements = json.loads(base64.b64decode(payment_required))

    # Sign payment with your wallet (implementation depends on your setup)
    payment = sign_x402_payment(requirements)
    payment_header = base64.b64encode(json.dumps(payment).encode()).decode()

    # Retry with payment
    response = requests.get(
        'https://api.example.com/api/v1/coins',
        headers={'X-PAYMENT': payment_header}
    )

    data = response.json()
```

#### Learn More

- [x402 Protocol Documentation](https://x402.org)
- [x402 GitHub](https://github.com/coinbase/x402)
- [Base Network](https://base.org)

---

## Rate Limits

### Response Headers

All authenticated requests include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1706054400000
```

| Header                  | Description                      |
| ----------------------- | -------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests per day         |
| `X-RateLimit-Remaining` | Requests remaining today         |
| `X-RateLimit-Reset`     | Unix timestamp when limit resets |

### Rate Limit by Tier

| Tier       | Daily Limit     | Per-Minute Limit |
| ---------- | --------------- | ---------------- |
| Free       | 100             | 10               |
| Pro        | 10,000          | 100              |
| Enterprise | Unlimited       | 1,000            |
| x402       | Pay-per-request | 1,000            |

---

## Error Handling

### 401 Unauthorized

No valid API key provided.

```json
{
  "error": "Unauthorized",
  "message": "Valid API key required. Get one at /developers"
}
```

### 402 Payment Required

x402 payment needed for this endpoint.

```json
{
  "error": "Payment Required",
  "message": "This endpoint requires payment via x402 protocol",
  "x402Version": 2,
  "accepts": [...]
}
```

The `X-PAYMENT-REQUIRED` header contains base64-encoded payment requirements.

### 429 Too Many Requests

Rate limit exceeded.

```json
{
  "error": "Rate limit exceeded",
  "message": "You have exceeded your Free tier limit",
  "resetAt": "2026-01-24T00:00:00.000Z"
}
```

---

## Code Examples

### TypeScript

```typescript
import { CryptoNews } from '@nirholas/crypto-news';

// With API key
const client = new CryptoNews({
  apiKey: 'cda_free_xxxxx',
});

// Get premium data
const coins = await client.getPremiumCoins({ perPage: 10 });

// Check usage
const usage = await client.getUsage();
console.log(`Used ${usage.usageToday}/${usage.limit} requests today`);

// Check rate limits after any request
const rateLimit = client.getRateLimitInfo();
console.log(`${rateLimit.remaining} requests remaining`);
```

### JavaScript

```javascript
import { CryptoNews } from './crypto-news.js';

const client = new CryptoNews({ apiKey: process.env.API_KEY });

try {
  const coins = await client.getPremiumCoins();
  console.log(coins);
} catch (error) {
  if (error.message === 'Rate limit exceeded') {
    console.log(`Retry after: ${new Date(error.retryAfter)}`);
  } else if (error.message === 'Payment Required') {
    console.log('x402 payment needed:', error.paymentRequired);
  }
}
```

### Python

```python
from crypto_news import CryptoNews, RateLimitError, PaymentRequiredError

client = CryptoNews(api_key='cda_free_xxxxx')

try:
    coins = client.get_premium_coins()
    print(coins)
except RateLimitError as e:
    print(f'Rate limit exceeded. Retry after: {e.retry_after}')
except PaymentRequiredError as e:
    print(f'Payment required: {e.payment_required}')
```

### curl

```bash
# With API key header
curl -H "X-API-Key: cda_free_xxxxx" \
  https://free-crypto-news.vercel.app/api/v1/coins

# Check rate limits in response headers
curl -i -H "X-API-Key: cda_free_xxxxx" \
  https://free-crypto-news.vercel.app/api/v1/coins 2>&1 | grep X-RateLimit
```

---

## Comparison: API Keys vs x402

| Feature                | API Keys             | x402                 |
| ---------------------- | -------------------- | -------------------- |
| **Setup**              | Register email       | Connect wallet       |
| **Payment**            | Monthly subscription | Pay per request      |
| **Rate Limits**        | Fixed by tier        | Unlimited (pay more) |
| **Best For**           | Predictable usage    | Variable/low usage   |
| **Anonymity**          | Email required       | Pseudonymous         |
| **Minimum Commitment** | None (free tier)     | $0.001 per request   |

---

## Next Steps

- [Get your API key](/developers)
- [View API documentation](/docs/api)
- [Explore premium endpoints](/pricing)
- [Learn about x402](https://x402.org)
