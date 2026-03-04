# Packages

> Standalone packages in the `crypto-vision` monorepo — independently publishable to npm.

## Overview

The `packages/` directory contains 8 standalone packages. Each has its own `package.json`, `tsconfig.json`, build pipeline, and tests. Packages are **not** tightly coupled to the root API — they can be published and used independently.

| Package | npm Name | Purpose | Stack |
|---------|----------|---------|-------|
| [agent-runtime](#agent-runtime) | `@nirholas/erc8004-agent-runtime` | ERC-8004 agent runtime with A2A + x402 payments | Hono, ethers.js |
| [binance-mcp](#binance-mcp) | `@nirholas/binance-mcp-server` | Binance MCP server (478+ tools) | MCP SDK, Binance SDKs |
| [bnbchain-mcp](#bnbchain-mcp) | `@nirholas/bnbchain-mcp` | BNB Chain MCP server (384 tools) | MCP SDK, viem |
| [market-data](#market-data) | `@nirholas/crypto-market-data` | Standalone market data library | Zero deps, native fetch |
| [mcp-server](#mcp-server) | `@crypto-vision/mcp-server` | Crypto Vision MCP server | MCP SDK, Solana web3 |
| [pump-agent-swarm](#pump-agent-swarm) | `@nirholas/pump-agent-swarm` | Pump.fun multi-agent swarm | Solana, pump-sdk |
| [sweep](#sweep) | `sweep` | Multi-chain dust sweeper | ethers, viem, BullMQ |
| [ucai](#ucai) | `abi-to-mcp` (Python) | Universal Contract AI Interface | Python, web3.py |

---

## agent-runtime

**Package:** `@nirholas/erc8004-agent-runtime`
**Location:** `packages/agent-runtime/`

Build AI agents with on-chain identity, inter-agent communication, and pay-per-request monetization.

### Features

- **ERC-8004 on-chain identity** — agents have verifiable blockchain identities
- **A2A protocol** — Google's Agent-to-Agent messaging standard for inter-agent communication
- **x402 micropayments** — HTTP 402-based pay-per-request pricing with USDC
- **`.well-known/agent.json` discovery** — automatic agent discovery endpoint
- **Hono HTTP server** — lightweight agent HTTP interface

### Structure

```
src/
├── agent.ts            # Core agent class
├── server.ts           # HTTP server setup
├── discovery/          # Agent discovery (.well-known/agent.json)
├── middleware/          # Auth, payment, logging middleware
├── protocols/          # A2A protocol implementation
└── utils/              # Shared utilities
```

### Usage

```bash
cd packages/agent-runtime
npm install
npm run build
npm test
```

---

## binance-mcp

**Package:** `@nirholas/binance-mcp-server`
**Location:** `packages/binance-mcp/`

MCP (Model Context Protocol) server exposing the **entire Binance API** — 478+ tools covering spot, margin, futures, options, staking, mining, NFT, pay, and more.

### Features

- **478+ MCP tools** — complete Binance API coverage
- **Dual transport** — STDIO (local) and SSE (remote)
- **Type-safe** — Zod schemas for all tool inputs
- **26 official Binance SDK packages** — uses `@binance/*` libraries directly

### Binance API Coverage

| Category | Tools |
|----------|-------|
| Spot Trading | Market data, orders, account |
| Margin Trading | Cross/isolated margin |
| Futures (USDⓈ-M) | Positions, orders, funding |
| Futures (COIN-M) | Delivery futures |
| Options | Options trading |
| Staking | ETH staking, SOL staking |
| Mining | Mining pool data |
| NFT | NFT marketplace |
| Pay | Binance Pay |
| Convert | Crypto conversion |
| Savings | Flexible/locked savings |
| Dual Investment | Dual investment products |

### Usage

```bash
cd packages/binance-mcp
npm install
npm run build

# STDIO mode (for Claude Desktop)
npm start

# SSE mode (for remote MCP clients)
npm run start:sse
```

### Claude Desktop Config

```json
{
  "mcpServers": {
    "binance": {
      "command": "node",
      "args": ["packages/binance-mcp/dist/index.js"],
      "env": {
        "BINANCE_API_KEY": "your-key",
        "BINANCE_SECRET_KEY": "your-secret"
      }
    }
  }
}
```

---

## bnbchain-mcp

**Package:** `@nirholas/bnbchain-mcp`
**Location:** `packages/bnbchain-mcp/`

MCP server for BNB Chain ecosystem — BSC EVM, opBNB (L2), and Greenfield decentralized storage.

### Features

- **384 MCP tools** — comprehensive BNB Chain coverage
- **10+ EVM network support** — BSC, opBNB, Ethereum, Polygon, Arbitrum, and more
- **Greenfield storage** — decentralized file storage and management
- **Token operations** — ERC-20/721/1155 transfers, approvals, balance checks
- **DeFi interactions** — swap routing, liquidity provision, staking

### Structure

```
src/
├── tools/              # MCP tool definitions by category
│   ├── bsc/            # BSC-specific tools
│   ├── opbnb/          # opBNB L2 tools
│   ├── greenfield/     # Decentralized storage tools
│   ├── tokens/         # Token operations
│   └── defi/           # DeFi protocol interactions
└── utils/              # Chain configs, ABI helpers
```

### Usage

```bash
cd packages/bnbchain-mcp
npm install
npm run build
npm start
```

---

## market-data

**Package:** `@nirholas/crypto-market-data`
**Location:** `packages/market-data/`

Standalone cryptocurrency market data library. Edge Runtime compatible — works in Cloudflare Workers, Vercel Edge Functions, and any standard Node.js environment.

### Features

- **Zero dependencies** — uses native `fetch()`, no npm packages required
- **Edge Runtime compatible** — works anywhere with `fetch`
- **Stale-while-revalidate caching** — built-in SWR cache layer
- **Rate limiting** — automatic rate limit handling with backoff
- **Full TypeScript types** — complete type definitions for all API responses
- **CoinGecko + DeFiLlama + Fear & Greed** — three data sources in one client

### API

```typescript
import { MarketDataClient } from '@nirholas/crypto-market-data';

const client = new MarketDataClient({
  coingeckoApiKey: process.env.COINGECKO_API_KEY, // optional
  cacheTtl: 30_000, // 30s cache
});

// Market data
const coins = await client.getCoins({ page: 1, perPage: 100 });
const price = await client.getPrice(['bitcoin', 'ethereum']);
const chart = await client.getChart('bitcoin', { days: 7 });
const trending = await client.getTrending();

// DeFi
const protocols = await client.getProtocols({ limit: 50 });
const yields = await client.getYields({ minTvl: 1_000_000 });

// Sentiment
const fearGreed = await client.getFearGreed();
```

### Build

```bash
cd packages/market-data
npm install
npm run build    # tsup → ESM + CJS
npm test
```

---

## mcp-server

**Package:** `@crypto-vision/mcp-server` (private)
**Location:** `packages/mcp-server/`

MCP server that exposes the full Crypto Vision API as tools for AI assistants (Claude, ChatGPT, etc.).

### Features

- **All Crypto Vision endpoints as MCP tools** — market data, DeFi, news, on-chain, AI
- **Multi-transport** — STDIO, HTTP, SSE
- **Solana integration** — on-chain operations via `@solana/web3.js`
- **x402 payment support** — premium tools gated by micropayments
- **EVM tools** — EVM chain interactions

### Structure

```
src/
├── server/
│   ├── base.ts         # Base MCP server
│   ├── http.ts         # HTTP transport
│   ├── sse.ts          # SSE transport
│   └── stdio.ts        # STDIO transport
├── cli/                # CLI interface
├── evm/                # EVM chain tools
├── hosting/            # Hosting configs
├── modules/            # Tool modules by domain
├── types/              # Type definitions
├── utils/              # Utilities
├── vendors/            # Vendor integrations
└── x402/               # x402 payment integration
```

---

## pump-agent-swarm

**Package:** `@nirholas/pump-agent-swarm`
**Location:** `packages/pump-agent-swarm/`

Multi-agent system for Pump.fun token lifecycle management. Creator agents mint tokens on bonding curves, trader agents trade with organic strategies, and the x402 analytics layer provides premium intelligence.

### Features

- **Creator agents** — mint tokens on Pump.fun bonding curves
- **Trader agents** — execute organic trading strategies (DCA, momentum, social signals)
- **Swarm coordination** — multi-agent orchestration with role assignment
- **Bundle launches** — coordinated multi-wallet token launches
- **DEX screener integration** — real-time DEX pair monitoring
- **Telegram bot** — notifications and control interface
- **x402 analytics** — premium analytics endpoints with micropayments
- **CLI** — command-line interface for swarm management

### Structure

```
src/
├── agents/             # Agent implementations
│   ├── creator/        # Token creator agents
│   └── trader/         # Trading agents
├── trading/            # Trading strategies
├── bundle/             # Bundle launch coordination
├── intelligence/       # Market intelligence (11 modules)
├── coordination/       # Swarm coordination
├── dashboard/          # Web dashboard
├── demo/               # Demo scripts
├── api/                # REST API
├── infra/              # Infrastructure helpers (event bus, logger)
├── telegram/           # Telegram bot
├── x402/               # x402 payment layer
└── analytics/
    └── x402-client.ts  # Production x402 client (336 lines)
```

### Intelligence Modules

The `intelligence/` directory contains 11 modules for market analysis and decision-making:

| Module | Description |
|---|---|
| **alpha-scanner.ts** | Continuous Pump.fun opportunity scanner with 5 strategies: Early Entry (<10 min, <$10k mcap), Graduation Play (>70% toward Raydium), Narrative Match (trending keywords), Volume Surge (3x+ avg), Revival (renewed interest on dormant tokens). Emits `alpha:opportunity-found` events with TTL-based expiry and deduplication. |
| **token-evaluator.ts** | Evaluates individual tokens across 6 criteria (market cap, liquidity, holder distribution, creator history, social signals, technical indicators). Produces a composite score (0-100) with weighted scoring and risk classification. |
| **strategy-brain.ts** | Central decision-making engine that combines signals from all intelligence modules to generate trading decisions. Maintains portfolio state and position sizing rules. |
| **sentiment-analyzer.ts** | Analyzes token/market sentiment from Pump.fun comments, social metrics, and engagement patterns. Produces sentiment scores with confidence levels. |
| **signal-generator.ts** | Generates buy/sell/hold signals from multiple data sources. Combines alpha scanner opportunities with token evaluations and sentiment data. |
| **trend-detector.ts** | Detects momentum trends using moving averages, volume patterns, and price action analysis. Identifies trend reversals and continuation patterns. |
| **narrative-generator.ts** | Identifies and tracks trending narratives across the Pump.fun ecosystem. Maps tokens to narrative categories (AI, meme, political, tech, gaming, DePIN, RWA). |
| **portfolio-optimizer.ts** | Optimizes portfolio allocation across active positions using risk-adjusted returns. Implements position sizing, rebalancing triggers, and correlation analysis. |
| **risk-manager.ts** | Risk management system with stop-loss tracking, maximum drawdown limits, exposure caps, and position-level risk scoring. |
| **market-regime.ts** | Classifies current market conditions (bull/bear/sideways/volatile) to adjust strategy parameters. |
| **index.ts** | Barrel export for all intelligence modules. |

### x402 Client

The package includes a production-grade x402 client (`src/analytics/x402-client.ts`) that implements the full HTTP 402 payment flow:

```typescript
import { AnalyticsClient } from '@nirholas/pump-agent-swarm';

const client = new AnalyticsClient({
  baseUrl: 'https://cryptocurrency.cv',
  privateKey: process.env.WALLET_PRIVATE_KEY,
  maxPaymentPerRequest: 0.10, // $0.10 max per request
  maxTotalBudget: 10.0,       // $10 total budget
});

const analysis = await client.getTokenAnalytics('SOL');  // $0.02
const curve = await client.getBondingCurveState(mintAddress); // $0.005
const signals = await client.getTradingSignals(); // $0.03
```

---

## sweep

**Package:** `sweep`
**Location:** `packages/sweep/`

Multi-chain dust sweeper — consolidates small token balances across 8 chains into productive DeFi yield positions.

### Features

- **8 chain support** — Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, BSC, Solana
- **ERC-4337 account abstraction** — gasless operations via smart accounts
- **CoW Protocol MEV protection** — MEV-resistant swaps
- **DeFi yield routing** — Aave, Yearn, Beefy, Lido auto-deposit
- **Cross-chain consolidation** — bridge dust from multiple chains to one
- **Job queue** — BullMQ for reliable async processing
- **Prometheus metrics** — full observability

### Structure

```
packages/sweep/
├── src/
│   ├── api/            # Hono REST API
│   ├── config/         # Chain/protocol configs
│   ├── db/             # Drizzle ORM schemas
│   ├── queue/          # BullMQ job queue
│   ├── services/       # Business logic
│   ├── types/          # Type definitions
│   ├── utils/          # Helpers
│   └── workers.ts      # Background workers
├── contracts/          # Solidity smart contracts
└── frontend/           # Next.js frontend
```

---

## ucai

**Package:** `abi-to-mcp` (Python)
**Location:** `packages/ucai/`

**UCAI — The Universal Contract AI Interface.** Converts any smart contract ABI into a fully functional MCP server. One command to make any deployed contract accessible to Claude, ChatGPT, or any MCP-compatible AI assistant.

### Features

- **ABI → MCP** — automatic conversion of contract ABIs to MCP tool definitions
- **Security scanner** — 50+ risk checks on contract code
- **Contract whisperer** — plain English explanations of contract functions
- **Pro templates** — pre-built templates for flash loans, arbitrage, yield strategies
- **Web builder** — visual interface at [mcp.ucai.tech](https://mcp.ucai.tech)
- **Multi-chain** — Ethereum, Polygon, BSC, Arbitrum, Base, and more

### Usage

```bash
cd packages/ucai

# Install Python dependencies
pip install -e .

# Convert an ABI to MCP server
abi-to-mcp generate 0xdAC17F958D2ee523a2206206994597C13D831ec7 \
  --chain ethereum \
  --output ./my-usdt-mcp

# Run security scan
abi-to-mcp scan 0xdAC17F958D2ee523a2206206994597C13D831ec7

# Explain contract in plain English
abi-to-mcp explain 0xdAC17F958D2ee523a2206206994597C13D831ec7
```

### Structure

```
packages/ucai/
├── src/abi_to_mcp/     # Python CLI + core logic
├── web/                # Web builder frontend (v1)
├── web-v2/             # Web builder frontend (v2)
├── examples/           # Example generated MCP servers
├── scripts/            # Helper scripts
└── tests/              # Python tests
```
