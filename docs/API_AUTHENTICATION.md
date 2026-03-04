# API Authentication

> Complete guide to API key authentication, tier-based rate limiting, and key management.

---

## Table of Contents

- [Overview](#overview)
- [Authentication Flow](#authentication-flow)
- [Tiers](#tiers)
- [API Key Configuration](#api-key-configuration)
  - [Static Keys](#static-keys)
  - [Dynamic Keys](#dynamic-keys)
  - [Admin Keys](#admin-keys)
- [Making Authenticated Requests](#making-authenticated-requests)
- [Rate Limit Headers](#rate-limit-headers)
- [Key Management API](#key-management-api)
- [Error Responses](#error-responses)

---

## Overview

Crypto Vision uses API key authentication with four tiers of access. Each tier provides different rate limits and feature access levels. Authentication is optional for public-tier access but required for higher rate limits and premium features.

**Source file:** `src/lib/auth.ts`

---

## Authentication Flow

```
Request arrives
     │
     ▼
Extract API key from:
  1. X-API-Key header
  2. Authorization: Bearer <key>
  3. ?api_key= query parameter
     │
     ├── No key found → assign "public" tier (30 rpm)
     │
     ├── Key found → validate:
     │     │
     │     ├── Check in-memory key store
     │     │     (seeded from API_KEYS env var)
     │     │
     │     ├── Check Redis (cv:keys:{key})
     │     │
     │     ├── Check admin keys
     │     │     (ADMIN_API_KEYS env var)
     │     │
     │     ├── Key valid → assign tier (basic/pro/enterprise)
     │     │
     │     └── Key invalid → 401 Unauthorized
     │
     ▼
Apply rate limit based on tier
     │
     ├── Within limit → proceed to route handler
     │
     └── Limit exceeded → 429 Too Many Requests
```

**Security note:** Key comparison uses `crypto.timingSafeEqual` to prevent timing side-channel attacks that could leak key values byte-by-byte.

---

## Tiers

| Tier | Rate Limit | Window | Key Required | Features |
|---|---|---|---|---|
| `public` | 30 requests | 60s | No | All read endpoints |
| `basic` | 200 requests | 60s | Yes | All read endpoints + AI endpoints |
| `pro` | 2,000 requests | 60s | Yes | All endpoints + priority queue |
| `enterprise` | 10,000 requests | 60s | Yes | All endpoints + priority queue + dedicated support |

### Feature Matrix

| Feature | Public | Basic | Pro | Enterprise |
|---|---|---|---|---|
| Market data | Yes | Yes | Yes | Yes |
| DeFi data | Yes | Yes | Yes | Yes |
| Bitcoin data | Yes | Yes | Yes | Yes |
| Search | Yes | Yes | Yes | Yes |
| AI analysis | Limited | Yes | Yes | Yes |
| RAG queries | No | Yes | Yes | Yes |
| WebSocket | Yes | Yes | Yes | Yes |
| Anomaly stream | Yes | Yes | Yes | Yes |
| Key management | No | No | No | Admin only |

---

## API Key Configuration

### Static Keys

Define API keys in the `API_KEYS` environment variable. Keys are comma-separated with an optional tier suffix:

```bash
# Format: key1:tier,key2:tier,key3
# Default tier is "basic" if not specified

API_KEYS=sk_prod_abc123:pro,sk_prod_def456:enterprise,sk_test_simple
```

**Examples:**

| Value | Key | Tier |
|---|---|---|
| `sk_prod_abc123:pro` | `sk_prod_abc123` | pro |
| `sk_prod_def456:enterprise` | `sk_prod_def456` | enterprise |
| `sk_test_simple` | `sk_test_simple` | basic (default) |

Static keys are loaded into memory at startup and don't require Redis.

### Dynamic Keys

Dynamic keys can be created at runtime via the admin API and are stored in Redis:

```
Redis key: cv:keys:{api_key}
Value: { "tier": "basic", "createdAt": 1709568000000 }
```

**Advantages of dynamic keys:**
- No restart required to add/remove keys
- Distributed across all instances (via Redis)
- Can be created/revoked programmatically
- Include creation timestamp for auditing

**Disadvantage:** Requires Redis to be available for authentication.

### Admin Keys

Admin keys are stored separately for security:

```bash
ADMIN_API_KEYS=sk_admin_xyz789,sk_admin_abc456
```

Admin keys:
- Have enterprise-tier rate limits (10,000 rpm)
- Can access key management endpoints
- Are checked separately from regular keys
- Cannot be created dynamically (env var only)

---

## Making Authenticated Requests

### Header Authentication (Recommended)

```bash
# X-API-Key header
curl -H "X-API-Key: sk_prod_abc123" \
  https://api.cryptocurrency.cv/api/market/prices

# Authorization Bearer
curl -H "Authorization: Bearer sk_prod_abc123" \
  https://api.cryptocurrency.cv/api/market/prices
```

### Query Parameter Authentication

```bash
# Query parameter (less secure — visible in logs)
curl "https://api.cryptocurrency.cv/api/market/prices?api_key=sk_prod_abc123"
```

**Warning:** Query parameter authentication is supported for convenience but is less secure because the key appears in server access logs, browser history, and potentially CDN logs. Prefer header-based authentication.

### JavaScript/TypeScript Client

```typescript
const API_KEY = process.env.CRYPTO_VISION_API_KEY;

async function fetchMarketData(): Promise<MarketData> {
  const response = await fetch('https://api.cryptocurrency.cv/api/market/prices', {
    headers: {
      'X-API-Key': API_KEY,
      'Accept': 'application/json',
    },
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    throw new Error(`Rate limited. Retry after ${retryAfter}s`);
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

---

## Rate Limit Headers

Every response includes rate limit information:

### Successful Request (within limit)

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 1709568060
```

### Rate Limited Request

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1709568060
Retry-After: 45
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "details": {
      "limit": 30,
      "windowSeconds": 60,
      "retryAfter": 45
    }
  }
}
```

### Header Reference

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Maximum requests allowed per window |
| `X-RateLimit-Remaining` | Remaining requests in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the current window resets |
| `Retry-After` | Seconds until the next window (only on 429) |

---

## Key Management API

These endpoints require an admin API key.

### Create a Key

**`POST /api/keys/create`**

```bash
curl -X POST \
  -H "X-API-Key: sk_admin_xyz789" \
  -H "Content-Type: application/json" \
  -d '{"tier": "pro"}' \
  https://api.cryptocurrency.cv/api/keys/create
```

**Response:**

```json
{
  "success": true,
  "data": {
    "key": "cv_auto_a1b2c3d4e5f6g7h8",
    "tier": "pro",
    "createdAt": 1709568000000
  }
}
```

### Delete a Key

**`DELETE /api/keys/:key`**

```bash
curl -X DELETE \
  -H "X-API-Key: sk_admin_xyz789" \
  https://api.cryptocurrency.cv/api/keys/cv_auto_a1b2c3d4e5f6g7h8
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

### List All Keys

**`GET /api/keys`**

```bash
curl -H "X-API-Key: sk_admin_xyz789" \
  https://api.cryptocurrency.cv/api/keys
```

**Response:**

```json
{
  "success": true,
  "data": {
    "keys": [
      { "key": "sk_prod_***123", "tier": "pro", "source": "env" },
      { "key": "cv_auto_***f6g", "tier": "basic", "source": "redis", "createdAt": 1709568000000 }
    ],
    "total": 2
  }
}
```

**Note:** Key values are partially masked in the list response to prevent exposure.

---

## Error Responses

### 401 Unauthorized

Returned when a request includes an API key that is not recognized:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key"
  }
}
```

### 403 Forbidden

Returned when attempting to access an admin endpoint with a non-admin key:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

### 429 Too Many Requests

Returned when the rate limit is exceeded (see headers above).

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds."
  }
}
```
