# Deployment Guide

Deploy Crypto Data Aggregator to production.

---

## Table of Contents

- [Vercel (Recommended)](#vercel-recommended)
- [Railway](#railway)
- [Docker](#docker)
- [Self-Hosted](#self-hosted)
- [Environment Variables](#environment-variables)
- [Post-Deployment](#post-deployment)

---

## Vercel (Recommended)

Vercel is the recommended platform for Next.js applications.

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnirholas%2Fcrypto-data-aggregator)

### Manual Deployment

1. **Install Vercel CLI**

```bash
npm install -g vercel
```

2. **Login to Vercel**

```bash
vercel login
```

3. **Deploy**

```bash
# From project root
vercel

# For production
vercel --prod
```

4. **Configure Environment Variables**

```bash
# Set optional API key for higher rate limits
vercel env add COINGECKO_API_KEY
```

### Vercel Configuration

Create `vercel.json` for custom settings:

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Cache-Control", "value": "public, s-maxage=60" }
      ]
    }
  ]
}
```

### Edge Functions

API routes automatically deploy to Edge Runtime for low latency:

```typescript
// src/app/api/market/coins/route.ts
export const runtime = 'edge';
```

---

## Railway

Railway provides simple deployments with automatic scaling.

### Quick Start

1. **Create Railway Account**

   Go to [railway.app](https://railway.app) and sign up.

2. **Deploy from GitHub**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `crypto-data-aggregator`
   - Railway auto-detects Next.js

3. **Configure Build**

   Railway auto-detects settings. Override if needed:

   ```
   Build Command: npm run build
   Start Command: npm start
   ```

4. **Add Environment Variables**

   In Railway dashboard:
   - Go to Variables tab
   - Add `COINGECKO_API_KEY` (optional)

### Railway Configuration

Create `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Custom Domain

1. Go to Settings → Domains
2. Add custom domain
3. Configure DNS:
   ```
   CNAME your-app.railway.app
   ```

---

## Docker

Deploy with Docker for maximum portability.

### Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
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

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - COINGECKO_API_KEY=${COINGECKO_API_KEY:-}
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/trending']
      interval: 30s
      timeout: 10s
      retries: 3
```

### Build & Run

```bash
# Build image
docker build -t crypto-data-aggregator .

# Run container
docker run -p 3000:3000 crypto-data-aggregator

# With environment variables
docker run -p 3000:3000 \
  -e COINGECKO_API_KEY=your_key \
  crypto-data-aggregator
```

### Docker Compose

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Next.js Standalone Output

Enable standalone output in `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = nextConfig;
```

---

## Self-Hosted

Deploy to your own server.

### Prerequisites

- Node.js 18+
- npm or yarn
- Process manager (PM2 recommended)
- Reverse proxy (nginx recommended)

### Setup

1. **Clone Repository**

```bash
git clone https://github.com/nirholas/crypto-data-aggregator.git
cd crypto-data-aggregator
```

2. **Install Dependencies**

```bash
npm ci --production=false
```

3. **Build Application**

```bash
npm run build
```

4. **Install PM2**

```bash
npm install -g pm2
```

5. **Create PM2 Config**

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'crypto-data-aggregator',
      script: 'npm',
      args: 'start',
      cwd: '/path/to/crypto-data-aggregator',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        COINGECKO_API_KEY: 'your_key',
      },
    },
  ],
};
```

6. **Start Application**

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name crypto.yourdomain.com;

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

    # Cache static assets
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### SSL with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d crypto.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## Environment Variables

### Required

None. The application works with free tier APIs.

### Optional

| Variable             | Description           | Default                            |
| -------------------- | --------------------- | ---------------------------------- |
| `COINGECKO_API_KEY`  | CoinGecko Pro API key | -                                  |
| `COINGECKO_BASE_URL` | CoinGecko API URL     | `https://api.coingecko.com/api/v3` |
| `DEFILLAMA_BASE_URL` | DeFiLlama API URL     | `https://api.llama.fi`             |

### Setting Environment Variables

#### Vercel

```bash
vercel env add COINGECKO_API_KEY
```

Or via dashboard: Settings → Environment Variables

#### Railway

Dashboard: Variables tab → Add variable

#### Docker

```bash
docker run -e COINGECKO_API_KEY=xxx ...
```

Or in `docker-compose.yml`:

```yaml
environment:
  - COINGECKO_API_KEY=xxx
```

#### Self-Hosted

Create `.env.local`:

```env
COINGECKO_API_KEY=your_api_key
COINGECKO_BASE_URL=https://pro-api.coingecko.com/api/v3
```

---

## Post-Deployment

### Verify Deployment

```bash
# Check health
curl https://your-domain.com/api/trending

# Check specific endpoint
curl https://your-domain.com/api/market/coins?limit=5
```

### Monitor Performance

#### Vercel Analytics

Enable in `next.config.js`:

```javascript
const nextConfig = {
  experimental: {
    webVitals: true,
  },
};
```

#### Custom Monitoring

Add response timing in API routes:

```typescript
import { withTiming } from '@/lib/api-utils';

export async function GET() {
  const startTime = Date.now();
  const data = await fetchData();
  return Response.json(withTiming(data, startTime));
}
```

### Troubleshooting

#### Build Fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

#### API Rate Limited

- Add `COINGECKO_API_KEY` for higher limits
- Check rate limit state in logs
- Increase cache TTLs if needed

#### Memory Issues

For self-hosted:

```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

For Docker:

```yaml
deploy:
  resources:
    limits:
      memory: 1G
```

---

## Scaling

### Horizontal Scaling

#### Vercel

Automatic. Edge functions scale globally.

#### Railway

Increase replicas in settings or `railway.json`:

```json
{
  "deploy": {
    "numReplicas": 3
  }
}
```

#### Docker/Self-Hosted

Use PM2 cluster mode:

```javascript
// ecosystem.config.js
{
  instances: 'max',  // Use all CPU cores
  exec_mode: 'cluster',
}
```

### Caching Recommendations

For high traffic:

1. Enable Redis for shared cache
2. Use CDN for static assets
3. Increase stale-while-revalidate windows

---

## CI/CD

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run lint
      - run: npm run test:run
      - run: npm run build

      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Preview Deployments

Vercel automatically creates preview deployments for PRs.

For Railway:

```json
{
  "build": {
    "builder": "NIXPACKS"
  }
}
```

Railway creates preview environments from PRs when connected to GitHub.
