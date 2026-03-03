# Development Guide

Set up local development for BNB-Chain-MCP.

---

## Prerequisites

- [Bun](https://bun.sh/) v1.2.10+
- [Node.js](https://nodejs.org/) v17+

---

## Quick Start

```bash
# Clone
git clone https://github.com/nirholas/bnb-chain-mcp
cd bnb-chain-mcp

# Install dependencies
bun install

# Start development server
bun dev:sse
```

---

## Environment Variables

Create a `.env` file:

```bash
cp .env.example .env
```

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Wallet private key (for write operations) | For transactions |
| `LOG_LEVEL` | DEBUG, INFO, WARN, ERROR | Optional |
| `PORT` | Server port (default: 3001) | Optional |
| `INFURA_API_KEY` | Infura API key for RPC | Optional |
| `ALCHEMY_API_KEY` | Alchemy API key for RPC | Optional |
| `ETHERSCAN_API_KEY` | Etherscan API key for verification | Optional |
| `CRYPTOPANIC_API_KEY` | CryptoPanic for news | Optional |

---

## Project Structure

```
bnb-chain-mcp/
├── src/
│   ├── index.ts           # Entry point
│   ├── evm.ts             # EVM entry point
│   ├── lib.ts             # Library exports
│   ├── evm/
│   │   ├── chains.ts      # Chain configurations (50+ networks)
│   │   ├── index.ts       # EVM module registry
│   │   ├── modules/       # EVM-specific modules
│   │   │   ├── blocks/
│   │   │   ├── bridge/
│   │   │   ├── contracts/
│   │   │   ├── deployment/
│   │   │   ├── domains/     # ENS
│   │   │   ├── events/
│   │   │   ├── gas/
│   │   │   ├── governance/
│   │   │   ├── lending/
│   │   │   ├── mev/
│   │   │   ├── multicall/
│   │   │   ├── network/
│   │   │   ├── nft/
│   │   │   ├── portfolio/
│   │   │   ├── price-feeds/
│   │   │   ├── security/
│   │   │   ├── signatures/
│   │   │   ├── staking/
│   │   │   ├── swap/
│   │   │   ├── tokens/
│   │   │   ├── transactions/
│   │   │   └── wallet/
│   │   └── services/      # Core EVM services
│   ├── modules/           # General modules
│   │   ├── governance/
│   │   ├── news/
│   │   └── utils/
│   ├── server/            # MCP server (stdio/SSE)
│   └── utils/             # Utilities & logging
├── docs/                  # Documentation (MkDocs)
└── package.json
```

---

## Adding a New Tool

Create a file in `src/evm/modules/<module>/tools.ts`:

```typescript
import { z } from "zod"
import { getPublicClient } from "../../services/clients"

export const exampleTools = {
  example_tool: {
    description: "Example tool description",
    schema: z.object({
      network: z.string().default("mainnet").describe("Network name"),
      address: z.string().describe("Address to check")
    }),
    handler: async ({ network, address }) => {
      const client = getPublicClient(network)
      const balance = await client.getBalance({ address })
      return { 
        address,
        balance: balance.toString(),
        network 
      }
    }
  }
}
```

Register in `src/evm/modules/<module>/index.ts`:

```typescript
import { exampleTools } from "./tools"

export const tools = { ...exampleTools }

export const registerModule = (server) => {
  Object.entries(tools).forEach(([name, tool]) => {
    server.tool(name, tool.description, tool.schema, tool.handler)
  })
}
```

---

## Adding ABIs

For tools requiring contract interactions:

```typescript
// Define ABI constants
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }]
  }
] as const

// Use in handler
const balance = await client.readContract({
  address,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [walletAddress]
})
```

---

## Adding Prompts

Create prompts in `src/evm/modules/<module>/prompts.ts`:

```typescript
import { PromptMessage } from "@modelcontextprotocol/sdk/types.js"

export const analyzePrompts = {
  analyze_example: {
    name: "analyze_example",
    description: "Analyze an example",
    arguments: [
      { name: "address", description: "Address to analyze", required: true },
      { name: "network", description: "Network name", required: false }
    ],
    handler: async ({ address, network = "mainnet" }): Promise<PromptMessage[]> => {
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze the address ${address} on ${network}...`
          }
        }
      ]
    }
  }
}
```

---

## Testing

```bash
# Run MCP Inspector
bun test

# Test specific module
bun test:evm

# Run E2E tests
bun e2e
```

### Manual Testing

Use the MCP Inspector for interactive testing:

```bash
npx @anthropic/mcp-inspector
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server (stdio) |
| `bun dev:sse` | Start dev server (SSE) |
| `bun build` | Build for production |
| `bun test` | Launch MCP Inspector |
| `bun format` | Format code |
| `bun lint` | Lint code |

---

## Architecture

### Module Pattern

Each module follows this pattern:

```
module/
├── index.ts       # Exports & registration
├── tools.ts       # Tool definitions
└── prompts.ts     # Prompt definitions (optional)
```

### Service Layer

Services in `src/evm/services/` provide reusable functionality:

- **clients.ts** - RPC client management
- **balance.ts** - Balance queries
- **tokens.ts** - Token operations
- **transactions.ts** - Transaction building
- **contracts.ts** - Contract interactions
- **ens.ts** - ENS resolution

### Error Handling

Tools should return structured errors:

```typescript
try {
  // operation
} catch (error) {
  return {
    error: error instanceof Error ? error.message : "Unknown error",
    success: false
  }
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tools with tests
4. Update documentation
5. Submit a pull request

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))
