# 🧹 Sweep Deployment Guide

## Quick Deploy

### 1. Set Up Clerk (Authentication)

1. **Create Clerk Account**
   - Go to [clerk.com](https://clerk.com)
   - Sign up (free tier available)
   - Create a new application

2. **Configure Clerk**
   - Enable **Email** and/or **Web3** authentication
   - In "Social Connections" enable **MetaMask** and **Coinbase Wallet** if desired
   - Copy your **Publishable Key** and **Secret Key**

### 2. Frontend → Vercel (Free)

1. **Connect GitHub to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your repo
   - Set **Root Directory** to `frontend`
   - Click Deploy

2. **Set Environment Variables** (Vercel dashboard → Settings → Environment Variables)
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app
   ```

### 3. Backend → Railway (~$5/month)

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy from GitHub**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select `nirholas/sweep` (or your fork)
   - Railway auto-detects the Node.js project

3. **Add PostgreSQL**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL`

4. **Add Redis**
   - Click "New" → "Database" → "Redis"
   - Railway automatically sets `REDIS_URL`

5. **Configure Shared Variables** (Project Settings → Shared Variables)
   
   Railway detected these variables from your source code. Configure them as **Shared Variables** to sync across all services (API + Workers):

   ```bash
   # ═══════════════════════════════════════════════════════════════════════════
   # REQUIRED - Core Configuration
   # ═══════════════════════════════════════════════════════════════════════════
   NODE_ENV=production
   
   # ═══════════════════════════════════════════════════════════════════════════
   # REQUIRED - Primary API Keys
   # ═══════════════════════════════════════════════════════════════════════════
   ALCHEMY_API_KEY=your_alchemy_key          # Get from: https://alchemy.com
   COINGECKO_API_KEY=your_coingecko_key      # Get from: https://coingecko.com/api
   
   # ═══════════════════════════════════════════════════════════════════════════
   # RPC ENDPOINTS - Use Alchemy key or custom endpoints
   # ═══════════════════════════════════════════════════════════════════════════
   RPC_ETHEREUM=https://eth-mainnet.g.alchemy.com/v2/${{ALCHEMY_API_KEY}}
   RPC_BASE=https://base-mainnet.g.alchemy.com/v2/${{ALCHEMY_API_KEY}}
   RPC_ARBITRUM=https://arb-mainnet.g.alchemy.com/v2/${{ALCHEMY_API_KEY}}
   RPC_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/${{ALCHEMY_API_KEY}}
   RPC_BSC=https://bsc-dataseed1.binance.org
   RPC_LINEA=https://linea-mainnet.g.alchemy.com/v2/${{ALCHEMY_API_KEY}}
   RPC_OPTIMISM=https://opt-mainnet.g.alchemy.com/v2/${{ALCHEMY_API_KEY}}
   RPC_SOLANA=https://api.mainnet-beta.solana.com
   
   # ═══════════════════════════════════════════════════════════════════════════
   # DEX AGGREGATORS - For swap functionality
   # ═══════════════════════════════════════════════════════════════════════════
   ONEINCH_API_KEY=your_key                  # Get from: https://portal.1inch.dev
   LIFI_API_KEY=your_key                     # Get from: https://li.fi
   JUPITER_API_KEY=your_key                  # Get from: https://station.jup.ag
   
   # ═══════════════════════════════════════════════════════════════════════════
   # ACCOUNT ABSTRACTION (ERC-4337) - For gasless transactions
   # ═══════════════════════════════════════════════════════════════════════════
   PIMLICO_API_KEY=your_key                  # Get from: https://pimlico.io
   COINBASE_PAYMASTER_URL=your_url           # Get from: https://www.coinbase.com/cloud
   
   # ═══════════════════════════════════════════════════════════════════════════
   # SOLANA - Enhanced Solana support
   # ═══════════════════════════════════════════════════════════════════════════
   HELIUS_API_KEY=your_key                   # Get from: https://helius.xyz
   JITO_TIP_LAMPORTS=10000                   # MEV tip in lamports
   
   # ═══════════════════════════════════════════════════════════════════════════
   # SECURITY & SIMULATION - Transaction safety
   # ═══════════════════════════════════════════════════════════════════════════
   TENDERLY_ACCESS_KEY=your_key              # Get from: https://tenderly.co
   TENDERLY_ACCOUNT=your_account_slug
   TENDERLY_PROJECT=your_project_slug
   GOPLUS_API_KEY=your_key                   # Get from: https://gopluslabs.io
   
   # ═══════════════════════════════════════════════════════════════════════════
   # MONITORING - Production observability
   # ═══════════════════════════════════════════════════════════════════════════
   SENTRY_DSN=your_sentry_dsn                # Get from: https://sentry.io
   DATADOG_API_KEY=your_datadog_key          # Get from: https://datadoghq.com
   ```

6. **Generate Domain**
   - Settings → Networking → Generate Domain
   - Copy the URL for Vercel's `NEXT_PUBLIC_API_URL`

---

## Alternative: Render

### Backend + Database on Render

1. Go to [render.com](https://render.com)
2. New → Web Service → Connect GitHub
3. Select repo, set:
   - **Build Command**: `npm install --legacy-peer-deps && npm run build`
   - **Start Command**: `npm start`
4. Add PostgreSQL (New → PostgreSQL)
5. Add Redis (New → Redis)
6. Set environment variables

---

## Environment Variables Reference

| Variable | Required | Description | Get From |
|----------|:--------:|-------------|----------|
| **Database & Cache** ||||
| `DATABASE_URL` | ✅ | PostgreSQL connection string | Railway auto-sets |
| `REDIS_URL` | ✅ | Redis connection string | Railway auto-sets |
| **Core** ||||
| `NODE_ENV` | ✅ | `production` | Set manually |
| `ALCHEMY_API_KEY` | ✅ | Primary RPC provider | [alchemy.com](https://alchemy.com) |
| **RPC Endpoints** ||||
| `RPC_ETHEREUM` | ⚠️ | Ethereum mainnet RPC | Use `${{ALCHEMY_API_KEY}}` |
| `RPC_BASE` | ⚠️ | Base mainnet RPC | Use `${{ALCHEMY_API_KEY}}` |
| `RPC_ARBITRUM` | ⚠️ | Arbitrum mainnet RPC | Use `${{ALCHEMY_API_KEY}}` |
| `RPC_POLYGON` | ⚠️ | Polygon mainnet RPC | Use `${{ALCHEMY_API_KEY}}` |
| `RPC_BSC` | ⚠️ | BSC mainnet RPC | Free public RPC |
| `RPC_LINEA` | ⚠️ | Linea mainnet RPC | Use `${{ALCHEMY_API_KEY}}` |
| `RPC_OPTIMISM` | ⚠️ | Optimism mainnet RPC | Use `${{ALCHEMY_API_KEY}}` |
| `RPC_SOLANA` | ⚠️ | Solana mainnet RPC | Free or [helius.xyz](https://helius.xyz) |
| **Price & Data** ||||
| `COINGECKO_API_KEY` | ⚠️ | Token prices | [coingecko.com/api](https://coingecko.com/api) |
| `DEFILLAMA_API_KEY` | ❌ | DeFi TVL data | [defillama.com](https://defillama.com) |
| **DEX Aggregators** ||||
| `ONEINCH_API_KEY` | ⚠️ | Swap quotes | [portal.1inch.dev](https://portal.1inch.dev) |
| `LIFI_API_KEY` | ⚠️ | Cross-chain | [li.fi](https://li.fi) |
| `JUPITER_API_KEY` | ⚠️ | Solana swaps | [station.jup.ag](https://station.jup.ag) |
| **Account Abstraction** ||||
| `PIMLICO_API_KEY` | ⚠️ | ERC-4337 bundler | [pimlico.io](https://pimlico.io) |
| `COINBASE_PAYMASTER_URL` | ⚠️ | Gasless txs | [coinbase.com/cloud](https://coinbase.com/cloud) |
| `PAYMASTER_SIGNER_KEY` | ❌ | Self-hosted paymaster | Generate locally |
| **Solana** ||||
| `HELIUS_API_KEY` | ⚠️ | Enhanced Solana RPC | [helius.xyz](https://helius.xyz) |
| `JITO_TIP_LAMPORTS` | ❌ | MEV tip (default: 10000) | Set manually |
| **Security** ||||
| `TENDERLY_ACCESS_KEY` | ⚠️ | Tx simulation | [tenderly.co](https://tenderly.co) |
| `TENDERLY_ACCOUNT` | ⚠️ | Account slug | [tenderly.co](https://tenderly.co) |
| `TENDERLY_PROJECT` | ⚠️ | Project slug | [tenderly.co](https://tenderly.co) |
| `GOPLUS_API_KEY` | ⚠️ | Token security | [gopluslabs.io](https://gopluslabs.io) |
| **Monitoring** ||||
| `SENTRY_DSN` | ❌ | Error tracking | [sentry.io](https://sentry.io) |
| `DATADOG_API_KEY` | ❌ | Metrics & APM | [datadoghq.com](https://datadoghq.com) |

**Legend:** ✅ Required | ⚠️ Recommended | ❌ Optional

---

## Cost Estimates

| Service | Provider | Monthly Cost |
|---------|----------|--------------|
| Frontend | Vercel | **Free** |
| Backend | Railway | ~$5-10 |
| PostgreSQL | Railway | ~$5 |
| Redis | Railway | ~$5 |
| **Total** | | **~$15-20/month** |

---

## After Deployment

1. **Run database migrations**
   ```bash
   # In Railway, add a one-time job or run locally:
   DATABASE_URL=your_railway_postgres_url npm run db:migrate
   ```

2. **Update Vercel env vars** with your Railway API URL

3. **Test the app** at your Vercel domain

4. **Set up custom domain** (optional)
   - Vercel: Settings → Domains → Add `sweep.exchange`
   - Railway: Settings → Networking → Custom Domain → Add `api.sweep.exchange`

---

## Troubleshooting

**Build fails on Vercel?**
- Make sure Root Directory is set to `frontend`

**API not connecting?**
- Check `NEXT_PUBLIC_API_URL` has no trailing slash
- Check Railway service is running (green dot)

**Database connection fails?**
- Verify `DATABASE_URL` is set in Railway
- Run `npm run db:migrate` if tables don't exist
