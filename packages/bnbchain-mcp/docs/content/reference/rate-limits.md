# Rate Limits

Reference for rate limiting in BNB-Chain-MCP and integrated external APIs.

---

## Overview

Rate limits protect both the MCP server and external API providers from abuse. Understanding these limits helps you build robust applications.

---

## MCP Server Limits

### Default Limits

| Mode | Requests/Minute | Concurrent | Burst |
|------|-----------------|------------|-------|
| stdio | 100 | 5 | 20 |
| HTTP | 60 | 10 | 15 |

### Configuration

Set custom limits via environment variables:

```bash
RATE_LIMIT_RPM=200          # Requests per minute
RATE_LIMIT_CONCURRENT=10    # Concurrent requests
RATE_LIMIT_BURST=30         # Burst allowance
```

---

## External API Limits

### CoinGecko

| Tier | Requests/Minute | Daily Limit |
|------|-----------------|-------------|
| Free | 10-30 | 10,000 |
| Demo | 30 | 10,000 |
| Pro | 500 | Unlimited |

**Affected Tools:**
- `market_get_price`
- `market_get_ohlcv`
- `market_get_trending`
- `market_get_global_data`
- `market_get_fear_greed_index`

### CoinStats

| Tier | Requests/Minute | Monthly Limit |
|------|-----------------|---------------|
| Free | 5 | 5,000 |
| Pro | 30 | 100,000 |

**Affected Tools:**
- `market_coinstats_*` tools

### GoPlus Security

| Tier | Requests/Minute | Daily Limit |
|------|-----------------|-------------|
| Free | 20 | 1,000 |
| Pro | 100 | 50,000 |

**Affected Tools:**
- `security_check_token`
- `security_check_address`
- `security_check_approval`
- `security_check_nft`

### DefiLlama

| Access | Requests/Minute | Notes |
|--------|-----------------|-------|
| Public | 5 | No auth required |

**Affected Tools:**
- `defi_get_protocol_tvl`
- `defi_get_chain_tvl`
- `defi_get_yields`
- `defi_get_stablecoin_data`

### GeckoTerminal / DexPaprika

| API | Requests/Minute | Notes |
|-----|-----------------|-------|
| GeckoTerminal | 30 | Free tier |
| DexPaprika | 30 | Free tier |

**Affected Tools:**
- `dex_get_pool_info`
- `dex_get_trades`
- `dex_get_ohlcv`

### Blockchain RPC

| Network | Requests/Minute | Notes |
|---------|-----------------|-------|
| Public RPC | 10-50 | Varies by provider |
| Private RPC | 100-1000+ | Depends on plan |

**Affected Tools:**
- All blockchain read/write operations

---

## Rate Limit Headers

HTTP mode returns rate limit info in headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1710432000
Retry-After: 30
```

---

## Error Response

When rate limited:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32600,
    "message": "Rate limit exceeded",
    "data": {
      "limit": 60,
      "window": "60s",
      "retryAfter": 30,
      "source": "coingecko"
    }
  }
}
```

---

## Best Practices

### 1. Implement Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.code === -32600 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 2. Use Caching

```typescript
const cache = new Map<string, { data: any; expires: number }>();

async function cachedCall(
  mcp: MCPClient,
  tool: string,
  args: Record<string, any>,
  ttlSeconds: number = 60
): Promise<any> {
  const key = `${tool}:${JSON.stringify(args)}`;
  const cached = cache.get(key);
  
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  const data = await mcp.callTool(tool, args);
  cache.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000
  });
  
  return data;
}
```

### 3. Batch Requests

Instead of multiple individual calls:

```typescript
// Bad - 10 requests
for (const token of tokens) {
  await mcp.callTool('market_get_price', { coinId: token });
}

// Good - 1 request
await mcp.callTool('market_get_prices', { 
  coinIds: tokens.join(',') 
});
```

### 4. Use Rate Limiter

```typescript
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  minTime: 100,        // 100ms between requests
  maxConcurrent: 5,    // Max 5 concurrent
  reservoir: 60,       // 60 requests
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 60 * 1000  // Per minute
});

async function rateLimitedCall(mcp: MCPClient, tool: string, args: any) {
  return limiter.schedule(() => mcp.callTool(tool, args));
}
```

### 5. Prioritize Requests

```typescript
const highPriorityLimiter = new Bottleneck({ maxConcurrent: 3 });
const lowPriorityLimiter = new Bottleneck({ maxConcurrent: 1 });

// Critical operations (trades, security)
async function highPriority(fn: () => Promise<any>) {
  return highPriorityLimiter.schedule(fn);
}

// Non-critical (market data, analytics)
async function lowPriority(fn: () => Promise<any>) {
  return lowPriorityLimiter.schedule(fn);
}
```

---

## Tool-Specific Recommendations

### High-Frequency Tools

These tools are commonly called frequently - use caching:

| Tool | Recommended TTL |
|------|-----------------|
| `market_get_price` | 30s |
| `gas_get_gas_price` | 15s |
| `network_get_block_number` | 5s |

### Low-Frequency Tools

These change rarely - cache longer:

| Tool | Recommended TTL |
|------|-----------------|
| `network_list_networks` | 24h |
| `tokens_get_token_info` | 1h |
| `security_check_token` | 5m |

### Real-Time Tools

Avoid caching these:

- `swap_get_quote` - Prices change rapidly
- `lending_get_health_factor` - Critical for safety
- Transaction execution tools

---

## Monitoring Rate Limits

### Track Usage

```typescript
class RateLimitMonitor {
  private usage: Map<string, number[]> = new Map();
  
  track(source: string) {
    const now = Date.now();
    const calls = this.usage.get(source) || [];
    
    // Keep last minute only
    const recent = calls.filter(t => now - t < 60000);
    recent.push(now);
    this.usage.set(source, recent);
    
    return recent.length;
  }
  
  getUsage(source: string): number {
    const calls = this.usage.get(source) || [];
    return calls.filter(t => Date.now() - t < 60000).length;
  }
  
  isNearLimit(source: string, limit: number): boolean {
    return this.getUsage(source) > limit * 0.8;
  }
}
```

### Alert on Limits

```typescript
monitor.on('nearLimit', (source, usage, limit) => {
  console.warn(`⚠️ ${source}: ${usage}/${limit} requests (80% threshold)`);
});

monitor.on('limited', (source) => {
  console.error(`🚫 ${source}: Rate limited!`);
});
```

---

## API Key Configuration

Increase limits with API keys:

```bash
# CoinGecko Pro
COINGECKO_API_KEY=your-key

# GoPlus Pro
GOPLUS_API_KEY=your-key

# Custom RPC (higher limits)
ETHEREUM_RPC_URL=https://your-rpc.com
ARBITRUM_RPC_URL=https://your-arb-rpc.com
```

---

## Related Documentation

- [Error Codes](errors.md) - Error handling
- [API Overview](../api/README.md) - API documentation
- [Custom Clients](../integrations/custom-clients.md) - Client implementation
