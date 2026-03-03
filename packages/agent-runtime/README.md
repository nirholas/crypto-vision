# @nirholas/erc8004-agent-runtime

> ERC-8004 agent runtime with A2A messaging and x402 micropayments.

Build AI agents with **on-chain identity** (ERC-8004), **agent-to-agent communication** (A2A), and **pay-per-request micropayments** (x402) — all in ~10 lines of TypeScript.

## Quick Start

```bash
npm install @nirholas/erc8004-agent-runtime
```

```typescript
import { ERC8004Agent } from '@nirholas/erc8004-agent-runtime';

const agent = new ERC8004Agent({
  name: "My Trading Agent",
  description: "Executes DeFi trades with verified on-chain identity",
  privateKey: process.env.PRIVATE_KEY!,
  chain: "bsc-testnet",
  capabilities: ["trading", "analysis", "portfolio"],
  pricing: {
    "trading/execute": { price: "0.001", token: "USDC" },
    "analysis/report": { price: "0.0005", token: "USDC" },
  },
  trust: ["reputation", "crypto-economic"],
});

agent.onTask("trading/execute", async (task) => {
  return { status: "completed", result: { txHash: "0x..." } };
});

agent.onTask("analysis/report", async (task) => {
  return { status: "completed", result: { report: "..." } };
});

// Registers on-chain + starts A2A server + enables x402
await agent.start({ port: 3000 });
```

When `agent.start()` is called, the server automatically:

1. Registers agent on ERC-8004 IdentityRegistry (if not already registered)
2. Serves `/.well-known/agent.json` (A2A agent card)
3. Serves `/.well-known/agent-card.json` (alternative discovery)
4. Handles A2A task requests at `/a2a`
5. Enforces x402 payments on configured endpoints
6. Exposes reputation at `/.well-known/reputation`
7. Health check at `/health`

## Three Protocols, One SDK

### A2A (Agent-to-Agent)

Google's protocol for agent messaging and task delegation. Agents can discover each other via `.well-known/agent.json` and exchange tasks using JSON-RPC.

### x402 (HTTP 402 Micropayments)

Per-request payment protocol. Configure pricing per endpoint and the middleware handles 402 responses, payment verification, and receipt tracking automatically.

### ERC-8004 (On-chain Identity)

On-chain agent identity, reputation, and validation on BSC, Ethereum, and L2s. Agents are registered as ERC-721 NFTs with metadata, reputation scoring, and validator attestations.

## Agent-to-Agent Communication

```typescript
// Discover agents on-chain
const analysts = await agent.discover({
  service: "A2A",
  minReputation: 3.5,
  chain: "bsc-mainnet",
});

// Connect to a specific agent
const targetAgent = await agent.connect("https://agent.example.com");

// Call with automatic x402 payment
const result = await agent.callAgent(targetAgent, {
  task: "analysis/report",
  data: { token: "BNB", timeframe: "7d" },
});
```

## Architecture

```
agent-runtime/
├── src/
│   ├── index.ts              # Main exports
│   ├── agent.ts              # ERC8004Agent class
│   ├── server.ts             # Hono server with A2A + x402 middleware
│   ├── protocols/
│   │   ├── a2a/              # A2A message handler, task manager, agent card
│   │   ├── x402/             # x402 payment middleware, facilitator, pricing
│   │   └── erc8004/          # Identity, reputation, validation, registry
│   ├── middleware/            # Auth, rate limiting, logging
│   ├── discovery/             # .well-known endpoints, search, connect
│   └── utils/                 # Chains, contracts, crypto
├── examples/                  # 4 complete examples
├── tests/                     # Comprehensive test suite
├── Dockerfile                 # Production Docker image
└── docker-compose.yml         # Multi-agent deployment
```

## Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| BSC Testnet | 97 | Live |
| BSC Mainnet | 56 | Live |
| Ethereum Mainnet | 1 | Live |
| Ethereum Sepolia | 11155111 | Live |
| Base Sepolia | 84532 | Planned |
| Arbitrum Sepolia | 421614 | Planned |
| Optimism Sepolia | 11155420 | Planned |
| Polygon Amoy | 80002 | Planned |

## Contract Addresses

All contracts use the `0x8004` vanity prefix via deterministic CREATE2 deployment.

**Testnets:**
| Contract | Address |
|----------|---------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

**Mainnets (BSC & Ethereum):**
| Contract | Address |
|----------|---------|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

## Examples

### Simple Agent

Minimal agent in ~20 lines — see [`examples/simple-agent/`](examples/simple-agent/).

### Paid Agent

Agent with x402 micropayments per request — see [`examples/paid-agent/`](examples/paid-agent/).

### Multi-Agent System

Orchestrator + worker agents communicating via A2A — see [`examples/multi-agent/`](examples/multi-agent/).

### DeFi Trading Agent

Full-featured DeFi agent with trading, analysis, and portfolio management — see [`examples/defi-agent/`](examples/defi-agent/).

## Dev Mode

Run without on-chain registration or payment verification:

```typescript
await agent.start({
  port: 3000,
  skipRegistration: true,
  devMode: true,
});
```

## Docker

```bash
# Build and run
docker compose up -d

# With environment variables
PRIVATE_KEY=0x... CHAIN=bsc-testnet docker compose up -d
```

## API Reference

### `ERC8004Agent`

| Method | Description |
|--------|-------------|
| `onTask(skillId, handler)` | Register a task handler |
| `onDefault(handler)` | Register fallback handler |
| `start(options)` | Start the agent server |
| `stop()` | Stop the agent |
| `discover(query)` | Find other agents on-chain |
| `connect(endpoint)` | Connect to a remote agent |
| `callAgent(target, options)` | Call a remote agent via A2A + x402 |
| `getReputation()` | Get this agent's reputation |
| `submitFeedback(agentId, score, comment)` | Rate another agent |

### Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent.json` | GET | A2A agent card |
| `/.well-known/agent-card.json` | GET | Extended agent card |
| `/.well-known/reputation` | GET | Reputation summary |
| `/a2a` | POST | A2A JSON-RPC endpoint |
| `/health` | GET | Health check |
| `/` | GET | Agent info |

## Testing

```bash
npm test
```

## References

- [ERC-8004 Specification](https://erc8004.agency)
- [A2A Protocol](https://google.github.io/A2A)
- [x402 Protocol](https://www.x402.org)
- [Reference: x402-erc8004-agent](https://github.com/OnChainMee/x402-erc8004-agent)
- [Reference: strands-erc8004](https://github.com/cagataycali/strands-erc8004)

## License

MIT
