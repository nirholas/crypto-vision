# AI Agents

> 58 production-ready AI agents for DeFi, portfolio management, trading, and Web3 workflows.

## Overview

Crypto Vision ships with **58 specialized AI agents**, each designed for a specific domain of cryptocurrency intelligence. Agents are defined as declarative JSON files with system prompts, few-shot examples, and metadata — they are runtime-agnostic and served as static JSON from a CDN.

| | |
|---|---|
| **Package** | `@nirholas/ai-agents-library` v1.42.0 |
| **Location** | `agents/` |
| **CDN** | `https://sperax.click/` (GitHub Pages) |
| **MCP Server** | `io.github.nirholas/defi-agents` (stdio transport) |
| **Languages** | 18 locales with AI-powered translation |

## Architecture

```
agents/
├── src/                        # Agent source definitions (English)
├── locales/                    # Auto-translated locale files (18 languages)
├── prompts/                    # System prompts per agent
├── schema/                     # JSON Schema validation (draft-07)
│   └── speraxAgentSchema_v1.json
├── scripts/                    # Build / i18n / validation pipeline
├── docs/                       # Detailed agent guides (14 docs)
├── agents-manifest.json        # Full agent registry
├── agent-template.json         # Template for creating new agents
├── agent-template-full.json    # Extended template
├── meta.json                   # Package metadata
├── server.json                 # MCP server configuration
├── AGENTS.md                   # Agent development guidelines
├── CHANGELOG.md                # Version history
├── CONTRIBUTING.md             # Contribution guide
└── LICENSE                     # MIT license
```

**Key design principle:** Agent definitions are **data, not code**. The `agents/` directory is purely declarative; the `packages/agent-runtime/` package provides the execution engine.

---

## Agent Categories

| Category | Count | Description |
|----------|------:|-------------|
| **Trading** | 12 | Signal bots, DCA, arbitrage, pump screening, strategy marketplace |
| **DeFi** | 14 | Yield farming, liquidity, protocol comparison, insurance, bridges |
| **Portfolio** | 7 | Dashboard, asset tracking, analytics, wallet management, rebalancing |
| **Security** | 5 | Smart contract auditing, bridge analysis, wallet security, risk monitoring |
| **Education** | 5 | Onboarding, APY/APR explanation, protocol comparison, stablecoin guides |

---

## Complete Agent List

### Sperax Ecosystem Agents (23)

23 agents specifically designed for the Sperax ecosystem (USDs stablecoin, SPA token, Arbitrum-based DeFi):

| Agent ID | Name | Category |
|----------|------|----------|
| `sperax-dashboard` | Sperax Portfolio Dashboard | portfolio |
| `sperax-assets-tracker` | Sperax Assets Tracker | portfolio |
| `sperax-analytics-expert` | Sperax Analytics Expert | portfolio |
| `sperax-wallet-manager` | Sperax Wallet Manager | portfolio |
| `sperax-portfolio-tracker` | Sperax Portfolio Tracker | portfolio |
| `sperax-settings-manager` | Sperax Settings Manager | portfolio |
| `sperax-trading-assistant` | Sperax Trading Assistant | trading |
| `sperax-ai-trading-bot` | Sperax AI Trading Bot | trading |
| `sperax-signal-bot` | Sperax Signal Bot | trading |
| `sperax-dca-bot` | Sperax DCA Bot | trading |
| `sperax-arbitrage-bot` | Sperax Arbitrage Bot | trading |
| `sperax-pump-screener` | Sperax Pump Screener | trading |
| `sperax-strategies-marketplace` | Sperax Strategies Marketplace | trading |
| `sperax-bot-templates` | Sperax Bot Templates | trading |
| `sperax-defi-center` | Sperax DeFi Center | defi |
| `sperax-defi-protocols` | Sperax DeFi Protocols | defi |
| `sperax-yield-aggregator` | Sperax Yield Aggregator | defi |
| `sperax-liquidity-strategist` | Sperax Liquidity Strategist | defi |
| `sperax-bridge-assistant` | Sperax Bridge Assistant | defi |
| `sperax-risk-monitor` | Sperax Risk Monitor | security |
| `sperax-help-center` | Sperax Help Center | education |
| `sperax-governance-guide` | Sperax Governance Guide | education |
| `sperax-onboarding-guide` | Sperax Onboarding Guide | education |

### DeFi Agents (35)

#### Yield (4)

| Agent ID | Name |
|----------|------|
| `defi-yield-farmer` | DeFi Yield Farmer |
| `staking-rewards-calculator` | Staking Rewards Calculator |
| `yield-sustainability-analyst` | Yield Sustainability Analyst |
| `yield-dashboard-builder` | Yield Dashboard Builder |

#### Risk (4)

| Agent ID | Name |
|----------|------|
| `liquidation-risk-manager` | Liquidation Risk Manager |
| `defi-risk-scoring-engine` | DeFi Risk Scoring Engine |
| `defi-insurance-advisor` | DeFi Insurance Advisor |
| `impermanent-loss-calculator` | Impermanent Loss Calculator |

#### Trading (4)

| Agent ID | Name |
|----------|------|
| `dex-aggregator-optimizer` | DEX Aggregator Optimizer |
| `gas-optimization-expert` | Gas Optimization Expert |
| `mev-protection-advisor` | MEV Protection Advisor |
| `airdrop-hunter` | Airdrop Hunter |

#### Security (3)

| Agent ID | Name |
|----------|------|
| `smart-contract-auditor` | Smart Contract Auditor |
| `bridge-security-analyst` | Bridge Security Analyst |
| `wallet-security-advisor` | Wallet Security Advisor |

#### Analysis (4)

| Agent ID | Name |
|----------|------|
| `protocol-revenue-analyst` | Protocol Revenue Analyst |
| `protocol-treasury-analyst` | Protocol Treasury Analyst |
| `governance-proposal-analyst` | Governance Proposal Analyst |
| `narrative-trend-analyst` | Narrative Trend Analyst |

#### Education (5)

| Agent ID | Name |
|----------|------|
| `defi-onboarding-mentor` | DeFi Onboarding Mentor |
| `apy-vs-apr-educator` | APY vs APR Educator |
| `defi-protocol-comparator` | DeFi Protocol Comparator |
| `stablecoin-comparator` | Stablecoin Comparator |
| `layer2-comparison-guide` | Layer 2 Comparison Guide |

#### Specialized (11)

| Agent ID | Name |
|----------|------|
| `alpha-leak-detector` | Alpha Leak Detector |
| `crypto-tax-strategist` | Crypto Tax Strategist |
| `liquidity-pool-analyzer` | Liquidity Pool Analyzer |
| `nft-liquidity-advisor` | NFT Liquidity Advisor |
| `portfolio-rebalancing-advisor` | Portfolio Rebalancing Advisor |
| `pump-fun-sdk-expert` | Pump.fun SDK Expert |
| `spa-tokenomics-analyst` | SPA Tokenomics Analyst |
| `token-unlock-tracker` | Token Unlock Tracker |
| `usds-stablecoin-expert` | USDs Stablecoin Expert |
| `vespa-optimizer` | veSPA Optimizer |
| `whale-watcher` | Whale Watcher |

---

## Agent Definition Schema

Each agent conforms to a JSON Schema (draft-07) defined in `agents/schema/speraxAgentSchema_v1.json`.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `author` | string | GitHub username of the agent creator |
| `config` | object | Core configuration (see below) |
| `createdAt` | string | ISO 8601 creation date |
| `homepage` | string | Agent homepage URL |
| `identifier` | string | URL-safe unique agent ID |
| `knowledgeCount` | number | Number of attached knowledge bases |
| `meta` | object | Display metadata (see below) |
| `pluginCount` | number | Number of attached plugins |
| `schemaVersion` | number | Schema version number |
| `tokenUsage` | number | Estimated token count |

### Config Object

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `systemRole` | **Yes** | string | The agent's system prompt |
| `model` | No | string | Preferred LLM model |
| `displayMode` | No | enum | `chat` or `docs` |
| `openingMessage` | No | string | Initial greeting message |
| `openingQuestions` | No | string[] | Suggested starter questions |
| `fewShots` | No | array | Few-shot examples (role + content pairs) |
| `inputTemplate` | No | string | Template for user input formatting |
| `params` | No | object | `temperature`, `top_p`, `frequency_penalty`, `presence_penalty`, `max_tokens` |
| `plugins` | No | array | Attached plugin identifiers |
| `knowledgeBases` | No | array | Attached knowledge base identifiers |
| `historyCount` | No | number | Conversation history window |
| `compressThreshold` | No | number | Token count before compression |

### Meta Object

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `avatar` | **Yes** | string | Emoji avatar |
| `title` | **Yes** | string | Display name |
| `description` | **Yes** | string | Short description |
| `tags` | **Yes** | string[] | Searchable tags |
| `category` | No | string | Agent category |
| `backgroundColor` | No | string | Theme color |

### Example

```json
{
  "author": "nirholas",
  "identifier": "defi-yield-farmer",
  "schemaVersion": 1,
  "createdAt": "2024-01-01",
  "homepage": "https://sperax.click",
  "knowledgeCount": 0,
  "pluginCount": 0,
  "tokenUsage": 500,
  "config": {
    "systemRole": "You are a DeFi expert specializing in yield optimization...",
    "displayMode": "chat",
    "openingMessage": "Hello! I can help you find the best yield opportunities.",
    "openingQuestions": [
      "What's the best stablecoin yield right now?",
      "Compare Aave vs Compound lending rates"
    ],
    "params": {
      "temperature": 0.7,
      "max_tokens": 2000
    }
  },
  "meta": {
    "avatar": "🌾",
    "title": "DeFi Yield Farmer",
    "description": "Finds optimal DeFi yield strategies across protocols",
    "tags": ["defi", "yield", "farming"],
    "category": "defi"
  }
}
```

---

## Internationalization (i18n)

Agents are automatically translated into **18 languages** using an AI-powered pipeline.

### Supported Locales

| Code | Language | Code | Language |
|------|----------|------|----------|
| `en-US` | English | `ja-JP` | Japanese |
| `ar` | Arabic | `ko-KR` | Korean |
| `bg-BG` | Bulgarian | `nl-NL` | Dutch |
| `zh-CN` | Chinese (Simplified) | `pl-PL` | Polish |
| `zh-TW` | Chinese (Traditional) | `pt-BR` | Portuguese (Brazil) |
| `de-DE` | German | `ru-RU` | Russian |
| `es-ES` | Spanish | `tr-TR` | Turkish |
| `fa-IR` | Persian | `vi-VN` | Vietnamese |
| `fr-FR` | French | `it-IT` | Italian |

### Translation Workflow

1. Agent defined in English in `agents/src/`
2. `pnpm run format` triggers AI translation via OpenAI to all 18 languages
3. Translated files saved to `agents/locales/{agent-id}/index.json`
4. `pnpm run build` generates CDN-ready distribution
5. Language detection validated via `@yutengjing/eld`
6. Quality control with `pnpm run i18n:validate` / `i18n:fix` / `i18n:clean`

### Translated Fields

- `config.systemRole` — system prompt
- `config.openingMessage` — greeting
- `config.openingQuestions` — starter questions
- `meta.title` — display name
- `meta.description` — description
- `examples` — usage examples
- `summary` — short summary

---

## CDN API

Agents are served as static JSON from GitHub Pages at `https://sperax.click/`.

| Endpoint | Description |
|----------|-------------|
| `GET /index.json` | All agents (English) |
| `GET /index.{locale}.json` | All agents in a specific language |
| `GET /{agent-id}.json` | Single agent (English) |
| `GET /{agent-id}.{locale}.json` | Single agent in a specific language |

---

## Backend API Endpoints

### Agent Routes

```bash
# List all available agents
GET /api/agents

# Get agent details
GET /api/agents/:id

# Chat with an agent
POST /api/agents/:id/chat
Content-Type: application/json
{
  "message": "What's the best yield farming strategy for $10k in stablecoins?",
  "context": {
    "riskTolerance": "medium",
    "chains": ["ethereum", "base", "arbitrum"]
  }
}
```

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents/list` | List all available agents |
| `GET` | `/agents/detail/:id` | Agent details and capabilities |
| `POST` | `/agents/run/:id` | Execute an agent with input |
| `GET` | `/agents/history` | Recent agent execution history |
| `POST` | `/agents/compose` | Chain multiple agents together |
| `GET` | `/agents/categories` | Available categories |

### AI-Enhanced Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ai/chat` | Conversational AI |
| `POST` | `/ai/analyze` | Market analysis |
| `POST` | `/ai/summarize` | Content summarization |
| `POST` | `/ai/sentiment` | Sentiment analysis |
| `POST` | `/ai/strategy` | Strategy generation |
| `POST` | `/ai/explain` | Concept explanation |
| `POST` | `/ai/embed` | Text embedding |
| `POST` | `/ai/compare` | Asset comparison |
| `POST` | `/ai/risk-assessment` | Risk assessment |
| `POST` | `/ai/portfolio-review` | Portfolio review |

---

## Agent Orchestration

The root API includes multi-agent orchestration (`src/lib/orchestrator.ts`) and workflow templates (`src/lib/workflow-templates.ts`) for coordinating multiple agents on complex tasks:

```
User Query: "What should I do with $50k?"
    │
    ├── Risk Assessor → assess risk tolerance
    ├── Yield Farmer → find best yields
    ├── Protocol Comparator → compare top protocols
    ├── Whale Watcher → check whale activity
    │
    └── Orchestrator → synthesize all agent outputs
         │
         └── Final recommendation with citations
```

---

## Agent Teams

Agents can be composed into **teams** for collaborative multi-agent conversations:

- Each team has a **host agent** that coordinates discussion and synthesizes insights
- Teams typically have 3–5 agents with complementary expertise
- Supports `@mentions` to target specific agents and private messaging

### Preset Templates

| Template | Description |
|----------|-------------|
| DeFi Strategy Team | Yield + risk + liquidity analysis |
| Content Creation Team | Research + writing + editing |
| Research Team | Multi-source analysis and synthesis |
| Problem Solving Team | Debugging + architecture + testing |

See `agents/docs/TEAMS.md` for details.

---

## Agent Runtime

The `packages/agent-runtime` package (`@nirholas/erc8004-agent-runtime`) provides a full ERC-8004 compliant execution engine with three protocol layers.

### A2A (Agent-to-Agent Protocol)

Task-based messaging between agents with states: `submitted → working → completed | failed`.

- **TaskManager** — creates, routes, and tracks tasks
- **A2AHandler** — processes incoming agent messages
- **Agent Cards** — capability declarations with skills and endpoints
- **Discovery** — `searchAgents()`, `fetchAgentCard()`, `connectToAgent()`, `callAgent()`

Well-known endpoints: `/.well-known/agent.json`, `/.well-known/agent-card.json`, `/.well-known/reputation`

### x402 Micropayments

HTTP 402-based payment protocol for monetizing agent services:

- Route-level pricing (e.g., `"trading/execute": { price: "0.001", token: "USDC" }`)
- **PaymentFacilitator** — processes payment headers and validates transactions
- **PricingManager** — per-endpoint pricing configuration

### ERC-8004 Identity

On-chain agent registration on BSC:

- **IdentityManager** — agent registration and identity management
- **ReputationManager** — on-chain reputation scoring
- **ValidationManager** — validation records and trust attestations

---

## MCP Server

Registered as MCP server `io.github.nirholas/defi-agents` (v1.42.0) for Claude Desktop and other MCP clients:

```json
{
  "mcpServers": {
    "crypto-agents": {
      "command": "npx",
      "args": ["@nirholas/ai-agents-library"]
    }
  }
}
```

### npm Package

```bash
npm install @nirholas/ai-agents-library
```

```typescript
import { getAgent, listAgents } from '@nirholas/ai-agents-library';

const agents = listAgents();
const farmer = getAgent('defi-yield-farmer');
console.log(farmer.config.systemRole);
```

---

## Scripts Reference

Run from the `agents/` directory with `pnpm run`:

| Command | Description |
|---------|-------------|
| `build` | Build all agent files, schemas, and indexes for CDN |
| `format` | Format agent configs and trigger AI translation |
| `test` | Validate agent config format and integrity |
| `test:locale` | Validate multi-language file completeness |
| `i18n:validate` | Validate translation accuracy |
| `i18n:fix` | Auto-fix incorrect translations |
| `i18n:clean` | Remove bad translation files |
| `awesome` | Build + update README agent list |
| `submit` | Auto-process GitHub Issues into agent PRs |

---

## Creating a New Agent

1. Copy `agents/agent-template.json` to `agents/src/{your-agent}/index.json`
2. Fill in all required schema fields: `identifier`, `meta` (avatar, title, description, tags), `config.systemRole`
3. Run `pnpm run format` to auto-translate to all 18 languages
4. Run `pnpm run test` to validate schema compliance
5. Run `pnpm run build` to generate CDN distribution
6. Test via the API: `POST /api/agents/{your-agent}/chat`
7. Submit a PR — or use `pnpm run submit` for automated processing

See `agents/docs/AGENT_GUIDE.md` for the full development guide.
