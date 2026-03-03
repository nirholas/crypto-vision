# Development Guide

> **⚠️ CRITICAL: This application handles user funds. Follow all security practices when developing locally.**

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Database Management](#database-management)
5. [Testing](#testing)
6. [Code Style](#code-style)
7. [Debugging](#debugging)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 20+ | Runtime |
| **npm** | 10+ | Package manager |
| **Docker** | 24+ | Infrastructure |
| **Docker Compose** | 2.20+ | Local services |
| **Foundry** | Latest | Smart contract tooling |
| **Git** | 2.40+ | Version control |

### Optional Tools

| Tool | Purpose |
|------|---------|
| **pgAdmin** | PostgreSQL GUI (included in docker-compose) |
| **Redis Insight** | Redis GUI |
| **VS Code** | Recommended editor |

### Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/nirholas/sweep.git
cd sweep
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Configure Environment Variables

Edit `.env` with your API keys:

```bash
# ============================================
# Database (local defaults work out of box)
# ============================================
DATABASE_URL="postgresql://sweep:sweep@localhost:5432/sweep"

# ============================================
# Redis (local defaults work out of box)
# ============================================
REDIS_URL="redis://localhost:6379"

# ============================================
# RPC Endpoints (REQUIRED - get free keys)
# ============================================
# Recommended: Alchemy, Infura, or QuickNode
RPC_ETHEREUM="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
RPC_BASE="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
RPC_ARBITRUM="https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY"
RPC_POLYGON="https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY"
RPC_OPTIMISM="https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY"
RPC_BSC="https://bsc-dataseed1.binance.org"
RPC_LINEA="https://linea-mainnet.g.alchemy.com/v2/YOUR_KEY"
RPC_SOLANA="https://api.mainnet-beta.solana.com"

# ============================================
# Account Abstraction (REQUIRED for full features)
# ============================================
# Get key from https://dashboard.pimlico.io
PIMLICO_API_KEY="your_pimlico_key"

# Get key from https://dashboard.alchemy.com
ALCHEMY_API_KEY="your_alchemy_key"

# ============================================
# DEX Aggregators (REQUIRED for swaps)
# ============================================
# Get key from https://portal.1inch.dev
ONEINCH_API_KEY="your_1inch_key"

# Get key from https://li.fi
LIFI_API_KEY="your_lifi_key"

# ============================================
# Price APIs (at least one REQUIRED)
# ============================================
# Get key from https://www.coingecko.com/api
COINGECKO_API_KEY="your_coingecko_key"

# ============================================
# Optional Services
# ============================================
# COINBASE_PAYMASTER_URL=""
# JUPITER_API_KEY=""
```

### 4. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and pgAdmin
npm run docker:up

# Or manually:
docker compose up -d
```

### 5. Install Dependencies

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend && npm install && cd ..

# Contract dependencies
cd contracts && forge install && cd ..
```

### 6. Run Database Migrations

```bash
npm run db:migrate
```

### 7. Seed Development Data (Optional)

```bash
npm run db:seed
```

---

## Local Development

### Start All Services

**Terminal 1 - Backend API:**
```bash
npm run dev
# API available at http://localhost:3000
```

**Terminal 2 - Workers (optional):**
```bash
npm run start:workers
# Processes background jobs
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
# Frontend available at http://localhost:3001
```

### Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API server with hot reload |
| `npm run dev:server` | Alias for dev |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled API (production) |
| `npm run start:workers` | Run background workers |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:ui` | Open Vitest UI |

### Docker Commands

| Script | Description |
|--------|-------------|
| `npm run docker:up` | Start infrastructure |
| `npm run docker:down` | Stop infrastructure |
| `npm run docker:reset` | Reset with fresh volumes |

---

## Database Management

### Drizzle ORM Commands

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:push` | Push schema directly (dev only) |
| `npm run db:studio` | Open Drizzle Studio GUI |
| `npm run db:seed` | Seed development data |

### Access pgAdmin

1. Open http://localhost:5050
2. Login: `admin@sweep.local` / `admin`
3. Add server:
   - Host: `postgres`
   - Port: `5432`
   - Database: `sweep`
   - User: `sweep`
   - Password: `sweep`

### Direct Database Access

```bash
# Connect to PostgreSQL
docker exec -it sweep-postgres psql -U sweep -d sweep

# Common commands
\dt           # List tables
\d+ users     # Describe users table
\q            # Quit
```

### Redis Access

```bash
# Connect to Redis
docker exec -it sweep-redis redis-cli

# Common commands
KEYS *        # List all keys
GET key       # Get value
INFO          # Server info
```

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Groups

```bash
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests
npm run test:api         # API route tests
npm run test:services    # Service tests
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Visual Test UI

```bash
npm run test:ui
# Opens at http://localhost:51204
```

See [TESTING.md](./TESTING.md) for comprehensive testing documentation.

---

## Code Style

### TypeScript

- Use explicit types for function parameters and returns
- Prefer `interface` over `type` for object shapes
- Use `const` by default, `let` when reassignment needed

### Formatting

```bash
# Check linting
npm run lint

# Type check
npm run typecheck
```

### File Structure

```
src/
├── api/              # HTTP layer
│   ├── routes/       # Route handlers
│   ├── middleware/   # Express middleware
│   └── server.ts     # Server setup
├── services/         # Business logic
│   ├── defi/         # DeFi integrations
│   ├── dex/          # DEX aggregators
│   └── ...
├── db/               # Database layer
│   ├── schema.ts     # Drizzle schema
│   └── migrate.ts    # Migration runner
├── queue/            # Background jobs
│   └── workers/      # Job processors
├── config/           # Configuration
├── types/            # Shared types
└── utils/            # Utilities
```

---

## Debugging

### VS Code Launch Configurations

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["tsx", "src/api/index.ts"],
      "env": { "NODE_ENV": "development" },
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["vitest", "--run", "${file}"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Enable Debug Logging

```bash
# Set environment variable
DEBUG=sweep:* npm run dev
```

### Inspect Queue Jobs

```bash
# Use BullMQ Board
npm install -g bull-board
npx bull-board --redis redis://localhost:6379
# Opens at http://localhost:3030
```

---

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

#### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View logs
docker logs sweep-postgres

# Restart
npm run docker:reset
```

#### Redis Connection Failed

```bash
# Check if Redis is running
docker ps | grep redis

# Test connection
docker exec -it sweep-redis redis-cli ping
# Should return: PONG
```

#### Migration Errors

```bash
# Reset database completely
npm run docker:reset
npm run db:migrate
npm run db:seed
```

#### Node Module Issues

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript Errors After Schema Changes

```bash
# Regenerate types
npm run db:generate
npm run typecheck
```

### Getting Help

1. Check existing issues: https://github.com/nirholas/sweep/issues
2. Review documentation in `/docs`
3. Ask in team Slack/Discord

---

## Next Steps

- Read [CONTRACTS.md](./CONTRACTS.md) for smart contract development
- Read [API.md](./API.md) for API development
- Read [TESTING.md](./TESTING.md) for comprehensive testing guide
- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment procedures
