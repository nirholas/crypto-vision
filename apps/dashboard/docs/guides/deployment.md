# Deployment Guide

Deploy the Crypto Data Aggregator to production environments.

---

## Deployment Options

| Platform | Best For | Free Tier |
|----------|----------|-----------|
| **Vercel** | Recommended - optimal Next.js support | Yes |
| **Railway** | Full-stack with databases | Limited |
| **Docker** | Self-hosted, Kubernetes | N/A |
| **Cloudflare** | Edge deployment | Yes |

---

## Vercel Deployment

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/manicinc/crypto-data-aggregator)

### Manual Deployment

```bash
# Install Vercel CLI
pnpm add -g vercel

# Login
vercel login

# Deploy preview
vercel

# Deploy production
vercel --prod
```

### Environment Variables

Configure in Vercel Dashboard → Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `API_SECRET_KEY` | Yes | API key signing secret |
| `COINGECKO_API_KEY` | No | CoinGecko Pro key |
| `ETHERSCAN_API_KEY` | No | Etherscan API key |
| `REDIS_URL` | No | Redis for caching |
| `X402_WALLET_ADDRESS` | No | x402 payment address |

### vercel.json Configuration

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/docs/:path*", "destination": "/docs/:path*" }
  ]
}
```

---

## Railway Deployment

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/manicinc/crypto-data-aggregator)

### Manual Setup

1. **Create Railway Project**
   ```bash
   railway login
   railway init
   ```

2. **Add Services**
   ```bash
   # Add PostgreSQL
   railway add postgresql

   # Add Redis
   railway add redis
   ```

3. **Configure Environment**
   ```bash
   railway variables set API_SECRET_KEY=your_secret
   railway variables set NODE_ENV=production
   ```

4. **Deploy**
   ```bash
   railway up
   ```

### railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm start",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

---

## Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - API_SECRET_KEY=${API_SECRET_KEY}
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/crypto
    depends_on:
      - redis
      - db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: crypto
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  redis-data:
  postgres-data:
```

### Build and Run

```bash
# Build image
docker build -t crypto-aggregator .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f app
```

---

## Kubernetes Deployment

### Deployment Manifest

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crypto-aggregator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: crypto-aggregator
  template:
    metadata:
      labels:
        app: crypto-aggregator
    spec:
      containers:
        - name: app
          image: ghcr.io/manicinc/crypto-aggregator:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: API_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: crypto-secrets
                  key: api-secret-key
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: crypto-aggregator
spec:
  selector:
    app: crypto-aggregator
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crypto-aggregator-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crypto-aggregator
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Deploy to Kubernetes

```bash
# Create secrets
kubectl create secret generic crypto-secrets \
  --from-literal=api-secret-key=your_secret

# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=crypto-aggregator
```

---

## Environment Configuration

### Production Environment

```bash
# .env.production
NODE_ENV=production

# API Configuration
NEXT_PUBLIC_API_URL=https://cryptonews.direct
API_SECRET_KEY=strong_production_secret

# External APIs
COINGECKO_API_KEY=your_pro_key
ETHERSCAN_API_KEY=your_key
LLAMA_API_KEY=your_key

# Caching
REDIS_URL=redis://your-redis-host:6379

# x402 Payments
X402_FACILITATOR_URL=https://x402.org
X402_WALLET_ADDRESS=0x...
X402_NETWORK=base

# Analytics
NEXT_PUBLIC_ANALYTICS_ID=G-XXXXXXXX

# Error Tracking
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Security Checklist

- [x] Use HTTPS only
- [x] Set secure API keys
- [x] Configure CORS properly
- [x] Enable rate limiting
- [x] Set up error monitoring
- [x] Configure CSP headers
- [x] Use environment variables for secrets

---

## CDN Configuration

### Cloudflare Setup

1. **Add Domain**
   - Point DNS to deployment
   - Enable proxy (orange cloud)

2. **SSL/TLS**
   - Set to "Full (strict)"
   - Enable HSTS

3. **Caching Rules**
   ```
   # Cache API responses
   /api/v1/coins*
   Cache-Control: public, max-age=60

   # Cache static assets
   /_next/static/*
   Cache-Control: public, max-age=31536000, immutable
   ```

4. **Page Rules**
   - `/api/*` - Cache Level: Standard
   - `/*` - Cache Level: Cache Everything (for static)

---

## Health Checks

### Health Endpoint

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      api: true,
      cache: await checkRedis(),
      database: await checkDatabase(),
    },
  };

  const allHealthy = Object.values(checks.checks).every(Boolean);

  return NextResponse.json(checks, {
    status: allHealthy ? 200 : 503,
  });
}
```

### Monitoring

Configure uptime monitoring:

- **Better Uptime**: Free tier available
- **UptimeRobot**: 50 free monitors
- **Pingdom**: Professional monitoring

---

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Rollback Strategy

### Vercel Rollbacks

```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]

# Promote previous to production
vercel promote [deployment-url]
```

### Docker Rollbacks

```bash
# Tag versions
docker tag crypto-aggregator:latest crypto-aggregator:v1.0.0

# Rollback to previous version
docker-compose down
docker-compose up -d crypto-aggregator:v0.9.0
```

---

## Post-Deployment

### Verification Checklist

1. ✅ Health endpoint responding
2. ✅ API endpoints working
3. ✅ WebSocket connections stable
4. ✅ SSL certificate valid
5. ✅ Error tracking receiving events
6. ✅ Analytics tracking pageviews
7. ✅ PWA manifest loading
8. ✅ Performance metrics acceptable

### Smoke Tests

```bash
# Test API
curl -i https://your-domain.com/api/v1/coins

# Test health
curl https://your-domain.com/api/health

# Test WebSocket
wscat -c wss://your-domain.com/ws
```

---

## Next Steps

- [Performance Guide](performance.md) - Optimize production performance
- [Security Reference](../reference/security.md) - Production security
- [Troubleshooting](../reference/troubleshooting.md) - Common issues
