# AI Agents

> 43+ specialized DeFi AI agents for cryptocurrency intelligence.

## Overview

Crypto Vision ships with a library of 43+ specialized AI agents, each designed for a specific domain of cryptocurrency intelligence. Agents are defined as JSON files with system prompts, capabilities, and metadata. They are served through the API (`/api/agents`), available as an npm package (`@nirholas/ai-agents-library`), and accessible via MCP servers.

**Package:** `@nirholas/ai-agents-library` v1.42.0
**Location:** `agents/`
**npm:** Published to npm, usable in any TypeScript/JavaScript project

## Agent Categories

| Category | Agents | Use Cases |
|----------|--------|-----------|
| **Portfolio** | Portfolio Rebalancer, Risk Assessor | Portfolio optimization, risk analysis |
| **Trading** | DCA Strategist, Arbitrage Hunter, Signal Generator, MEV Protector | Trading strategies, signal detection |
| **DeFi** | Yield Farmer, Liquidity Analyst, Protocol Comparator, Insurance Advisor, Risk Scorer | Yield optimization, protocol evaluation |
| **Research** | News Analyst, Alpha Leak Detector, Governance Advisor, Treasury Analyst | Market research, governance analysis |
| **Security** | Smart Contract Auditor, Wallet Security, Bridge Security Analyst | Security auditing, threat detection |
| **Education** | APY vs APR Educator, DeFi Onboarding Mentor, Layer 2 Guide | User education, onboarding |
| **Specialized** | Airdrop Hunter, DEX Aggregator Optimizer, Whale Watcher, Crypto Tax Strategist | Niche use cases |

## Agent Catalog

Full list of 43+ agents in `agents/src/`:

| Agent | File | Description |
|-------|------|-------------|
| Airdrop Hunter | `airdrop-hunter.json` | Discover and qualify for crypto airdrops |
| Alpha Leak Detector | `alpha-leak-detector.json` | Detect alpha signals from on-chain data |
| APY vs APR Educator | `apy-vs-apr-educator.json` | Explain yield calculations clearly |
| Bridge Security Analyst | `bridge-security-analyst.json` | Analyze cross-chain bridge risks |
| Crypto News Analyst | `crypto-news-analyst.json` | Analyze and summarize crypto news |
| Crypto Tax Strategist | `crypto-tax-strategist.json` | Optimize cryptocurrency tax strategies |
| DeFi Insurance Advisor | `defi-insurance-advisor.json` | Evaluate DeFi insurance protocols |
| DeFi Onboarding Mentor | `defi-onboarding-mentor.json` | Guide new users into DeFi |
| DeFi Protocol Comparator | `defi-protocol-comparator.json` | Compare DeFi protocols side by side |
| DeFi Risk Scoring Engine | `defi-risk-scoring-engine.json` | Score DeFi protocol risk |
| DeFi Yield Farmer | `defi-yield-farmer.json` | Optimize yield farming strategies |
| DEX Aggregator Optimizer | `dex-aggregator-optimizer.json` | Optimize DEX swap routing |
| Whale Watcher | `whale-watcher.json` | Track large wallet movements |
| Smart Contract Auditor | `smart-contract-auditor.json` | Audit smart contract security |
| ... | ... | 30+ more agents |

## Agent Definition Schema

Each agent is a JSON file following `agents/schema/speraxAgentSchema_v1.json`:

```json
{
  "id": "defi-yield-farmer",
  "name": "DeFi Yield Farmer",
  "version": "1.0.0",
  "description": "Optimizes yield farming strategies across DeFi protocols",
  "category": "defi",
  "capabilities": ["yield-analysis", "risk-assessment", "protocol-comparison"],
  "systemPrompt": "You are a specialized DeFi yield farming advisor...",
  "parameters": {
    "riskTolerance": { "type": "string", "enum": ["low", "medium", "high"] },
    "chains": { "type": "array", "items": { "type": "string" } },
    "minTvl": { "type": "number", "default": 1000000 }
  },
  "metadata": {
    "author": "nirholas",
    "tags": ["defi", "yield", "farming"],
    "sperax": false
  }
}
```

## Directory Structure

```
agents/
├── agents-manifest.json    # Full agent index with access patterns
├── agent-template.json     # Template for creating new agents
├── agent-template-full.json # Extended template
├── meta.json               # Package metadata
├── server.json             # MCP server registration
├── AGENTS.md               # Agent development guidelines
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # Contribution guide
├── LICENSE                 # MIT license
├── schema/
│   └── speraxAgentSchema_v1.json  # JSON schema definition
├── src/                    # Agent JSON definitions (43+ files)
├── prompts/                # Build prompts for source adapters and routes
├── locales/                # i18n translations per agent
│   ├── airdrop-hunter/
│   ├── alpha-leak-detector/
│   └── ... (one folder per agent with translations)
├── docs/
│   ├── AGENT_GUIDE.md      # How to use agents
│   ├── API.md              # Agent API reference
│   ├── CONTRIBUTING.md     # Contributing to the agent library
│   ├── DEPLOYMENT.md       # Deploying agents
│   ├── EXAMPLES.md         # Usage examples
│   ├── FAQ.md              # Frequently asked questions
│   ├── I18N_WORKFLOW.md    # Internationalization workflow
│   ├── KEYWORDS.md         # SEO keyword strategy
│   ├── MODELS.md           # Compatible AI models
│   ├── PROMPTS.md          # Prompt engineering guide
│   ├── SEO_STRATEGY.md     # SEO strategy documentation
│   ├── TEAMS.md            # Team structure
│   ├── TROUBLESHOOTING.md  # Troubleshooting guide
│   └── WORKFLOW.md         # Development workflow
└── scripts/                # Agent utilities
```

## API Access

### REST API

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

### MCP Server

Agents are registered as an MCP server (`agents/server.json`) for use with Claude Desktop and other MCP clients:

```json
{
  "mcpServers": {
    "crypto-agents": {
      "command": "node",
      "args": ["agents/dist/index.js"]
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
console.log(farmer.systemPrompt);
```

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

## Sperax-Specific Agents

23 agents are specifically designed for the Sperax ecosystem (USDs stablecoin, SPA token, Arbitrum-based DeFi). These are marked with `"sperax": true` in the manifest.

## Internationalization (i18n)

Each agent has translations in `agents/locales/<agent-id>/`. The i18n pipeline generates translations for agent names, descriptions, and key phrases. See `agents/docs/I18N_WORKFLOW.md` for the full workflow.

## Creating a New Agent

1. Copy `agents/agent-template.json` to `agents/src/<your-agent>.json`
2. Fill in the schema fields (id, name, description, category, capabilities, systemPrompt)
3. Add the agent to `agents/agents-manifest.json`
4. Optionally add locale translations in `agents/locales/<your-agent>/`
5. Test via the API: `POST /api/agents/<your-agent>/chat`
