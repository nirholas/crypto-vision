# Security Guide

Security considerations and best practices for Crypto Data Aggregator.

---

## Table of Contents

- [Overview](#overview)
- [API Security](#api-security)
- [Rate Limiting](#rate-limiting)
- [Data Handling](#data-handling)
- [Client-Side Security](#client-side-security)
- [Deployment Security](#deployment-security)
- [Reporting Vulnerabilities](#reporting-vulnerabilities)

---

## Overview

Crypto Data Aggregator follows security best practices:

- **No API keys required** - Uses public APIs
- **No user accounts** - All data stored client-side
- **No sensitive data** - No PII collected
- **Edge Runtime** - Reduced attack surface

---

## API Security

### Public API Proxying

All external API calls are proxied through Next.js API routes:

```
Client → /api/market/coins → CoinGecko API
```

**Benefits:**

- Hides external API endpoints from clients
- Enables rate limiting at proxy level
- Allows response transformation
- Enables caching

### Response Headers

All API responses include security headers:

```typescript
// src/lib/api-utils.ts
export function jsonResponse(data: unknown, options?: ResponseOptions) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}
```

### CORS Configuration

```typescript
// next.config.js
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGIN || '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
      ],
    },
  ];
}
```

---

## Rate Limiting

### API v2 Rate Limiting ✅

All `/api/v2/*` endpoints now include built-in rate limiting with response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

**Default Limits:**
- **News/Articles**: 100 requests/minute
- **Market Data**: 60 requests/minute
- **AI Digest**: 20 requests/minute

When rate limited, API returns `429 Too Many Requests` with `Retry-After` header.

### External API Limits

| API            | Rate Limit    | Implementation       |
| -------------- | ------------- | -------------------- |
| CoinGecko      | 10-30 req/min | Server-side caching  |
| DeFiLlama      | Unlimited     | Cache for efficiency |
| Alternative.me | ~10 req/min   | 5-minute cache       |

### Client-Side Throttling

```typescript
// SWR configuration
const { data } = useSWR('/api/market/coins', fetcher, {
  refreshInterval: 60000, // 1 minute
  dedupingInterval: 30000, // 30 seconds
  revalidateOnFocus: false,
});
```

### Server-Side Caching

```typescript
// Cache responses to reduce API calls
import { newsCache } from '@/lib/cache';

export async function getNews() {
  const cached = newsCache.get('latest');
  if (cached) return cached;

  const data = await fetchFromAPI();
  newsCache.set('latest', data, 300); // 5 min TTL
  return data;
}
```

### Implementing Rate Limiting (Optional)

For self-hosted deployments:

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimit = new Map<string, { count: number; resetTime: number }>();

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = request.ip ?? 'anonymous';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;

  const current = rateLimit.get(ip);

  if (!current || now > current.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
    return NextResponse.next();
  }

  if (current.count >= maxRequests) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((current.resetTime - now) / 1000)),
      },
    });
  }

  current.count++;
  return NextResponse.next();
}
```

---

## Data Handling

### Client-Side Storage

All user data is stored in browser localStorage:

| Data Type   | Storage Key    | Sensitive        |
| ----------- | -------------- | ---------------- |
| Watchlist   | `watchlist`    | No               |
| Portfolio   | `portfolios`   | Low (no amounts) |
| Alerts      | `price_alerts` | No               |
| Bookmarks   | `bookmarks`    | No               |
| Preferences | `theme`        | No               |

### Data Validation

All user input is validated:

```typescript
// Portfolio validation example
export function addHolding(portfolioId: string, holding: { coinId: string; amount: number }) {
  // Validate inputs
  if (!portfolioId || typeof portfolioId !== 'string') {
    throw new Error('Invalid portfolio ID');
  }

  if (!holding.coinId || typeof holding.coinId !== 'string') {
    throw new Error('Invalid coin ID');
  }

  if (typeof holding.amount !== 'number' || holding.amount < 0) {
    throw new Error('Invalid amount');
  }

  // Sanitize coinId (alphanumeric + hyphens only)
  const sanitizedCoinId = holding.coinId.replace(/[^a-z0-9-]/gi, '');

  // ... rest of implementation
}
```

### XSS Prevention

React automatically escapes content. For raw HTML:

```tsx
// ❌ Dangerous
<div dangerouslySetInnerHTML={{ __html: userContent }} />;

// ✅ Safe - sanitize first
import DOMPurify from 'dompurify';

<div
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(userContent),
  }}
/>;
```

### API Response Sanitization

```typescript
// Strip potentially dangerous fields from API responses
function sanitizeApiResponse(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeApiResponse);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip potentially dangerous fields
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      continue;
    }
    sanitized[key] = sanitizeApiResponse(value);
  }

  return sanitized;
}
```

---

## Client-Side Security

### Content Security Policy

Configure CSP in `next.config.js`:

```javascript
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Required for Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.coingecko.com https://api.llama.fi",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];
```

### Subresource Integrity

For external scripts (if any):

```html
<script src="https://example.com/script.js" integrity="sha384-..." crossorigin="anonymous"></script>
```

### Safe External Links

```tsx
// Always use rel="noopener noreferrer" for external links
<a href={article.url} target="_blank" rel="noopener noreferrer">
  Read More
</a>
```

---

## Deployment Security

### Environment Variables

```bash
# .env.local (never commit!)
COINGECKO_API_KEY=cg-xxxxx     # Optional, for higher rate limits
WEBHOOK_SECRET=your-secret     # For webhook verification
ALLOWED_ORIGINS=https://yourdomain.com
```

### Vercel Security

```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

### Docker Security

```dockerfile
# Use non-root user
FROM node:20-alpine

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# ... build steps ...

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
```

### HTTPS Only

Always deploy with HTTPS. For self-hosted:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Dependency Security

### Audit Dependencies

```bash
# Check for vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# Check for outdated packages
npm outdated
```

### Automated Updates

Use Dependabot or Renovate:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
    groups:
      production-dependencies:
        dependency-type: 'production'
      development-dependencies:
        dependency-type: 'development'
```

---

## Reporting Vulnerabilities

### Responsible Disclosure

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email security concerns to the repository owner
3. Include detailed reproduction steps
4. Allow reasonable time for a fix before disclosure

### Security Contact

Report security issues via GitHub Security Advisories:

1. Go to repository → Security → Advisories
2. Click "New draft security advisory"
3. Provide detailed information

---

## Security Checklist

### Development

- [ ] Validate all user inputs
- [ ] Sanitize data before rendering
- [ ] Use parameterized queries (if using DB)
- [ ] Keep dependencies updated
- [ ] Review npm audit regularly

### Deployment

- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Environment variables secured
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Error messages don't leak info

### Monitoring

- [ ] Monitor for unusual traffic patterns
- [ ] Set up alerts for error spikes
- [ ] Review access logs periodically
- [ ] Check for dependency vulnerabilities

---

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Architecture](./ARCHITECTURE.md)
- [OWASP Security Guidelines](https://owasp.org/www-project-web-security-testing-guide/)
