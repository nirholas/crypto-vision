# Prompt 23 — MCP Servers & Agent Runtime Packages

## Context

You are working on the MCP (Model Context Protocol) and agent runtime packages for crypto-vision. These packages allow AI assistants (Claude, ChatGPT plugins, etc.) to access crypto data tools:

### Package Inventory

1. **`packages/mcp-server/`** — Main MCP server with 24 tool modules:
   - Modules: `ai-predictions/`, `ai-prompts/`, `alerts/`, `coingecko/`, `defi/`, `dex-analytics/`, `governance/`, `historical-data/`, `indicators/`, `lyra-ecosystem/`, `market-data/`, `news/`, `portfolio/`, `pump-fun/`, `research/`, `rubic/`, `server-utils/`, `social/`, `token-unlocks/`, `tool-marketplace/`, `tradingview/`, `utils/`, `wallet-analytics/`, `websockets/`
   - Entry: `index.ts`, CLI via `cli.ts`
   - Server: Express-based MCP server
   - Types: `types/` directory

2. **`packages/binance-mcp/`** — Binance-specific MCP server:
   - `src/` — Binance API tools (spot, futures, margin)
   - `binance-mcp-server/` — Server implementation
   - `binance-us-mcp-server/` — Binance US variant
   - Docs, config, test tools

3. **`packages/bnbchain-mcp/`** — BNB Chain MCP server:
   - `src/` — BNB Chain tools (BEP-20, DEX, BSC explorer)
   - Similar structure to binance-mcp

4. **`packages/agent-runtime/`** — ERC-8004 agent runtime:
   - `src/agent.ts` — Core agent implementation
   - `src/server.ts` — Runtime server
   - `src/main.ts` — Entry point
   - `src/protocols/a2a/` — Agent-to-Agent protocol
   - `src/protocols/erc8004/` — ERC-8004 on-chain agent registry
   - `src/protocols/x402/` — x402 payment protocol
   - `src/discovery/` — Agent discovery (connect, search, wellKnown)
   - `src/middleware/` — Runtime middleware
   - `src/utils/` — Utilities
   - Docker + docker-compose for deployment

## Task

### 1. Audit & Fix `packages/mcp-server/`

For each of the 24 modules, verify:
- **Tool definitions** are valid MCP tool schemas (name, description, inputSchema)
- **Handlers** make real API calls to the crypto-vision backend (`localhost:8080` or configured URL)
- **Error handling** — every tool returns structured errors, not raw exceptions
- **Input validation** — every tool validates inputs with Zod schemas
- **Rate limiting** — tools that call external APIs respect rate limits

Fix common issues:
```typescript
// BEFORE (broken):
export const tools = [{
  name: 'get_bitcoin_price',
  description: 'Get Bitcoin price',
  inputSchema: {}, // missing schema
  handler: async (params: any) => { // untyped
    const res = await fetch('...'); // no error handling
    return res.json();
  }
}];

// AFTER (correct):
const GetBitcoinPriceInput = z.object({
  currency: z.string().default('usd').describe('Fiat currency code'),
});

export const tools: McpTool[] = [{
  name: 'get_bitcoin_price',
  description: 'Get the current Bitcoin price in any fiat currency',
  inputSchema: zodToJsonSchema(GetBitcoinPriceInput),
  handler: async (params: z.infer<typeof GetBitcoinPriceInput>) => {
    const validated = GetBitcoinPriceInput.parse(params);
    try {
      const res = await fetch(`${API_BASE}/api/bitcoin/price?currency=${validated.currency}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}];
```

### 2. Complete Module Implementations

Review each module directory and ensure all tools are fully implemented:

**Priority modules:**
- `coingecko/` — Price, market cap, trending, search, OHLC
- `market-data/` — Real-time prices, volume, market overview
- `defi/` — TVL, yields, protocol data
- `pump-fun/` — Token creation, bonding curves, trading
- `indicators/` — RSI, MACD, Bollinger, moving averages
- `wallet-analytics/` — Balance, transaction history, token holdings
- `news/` — Latest crypto news, sentiment
- `ai-predictions/` — Price predictions, anomaly detection

**Each module should expose 3-8 tools covering its full capability.**

### 3. Fix `packages/binance-mcp/`

- Ensure all Binance API tools work with valid API keys
- Support both Binance International and Binance US
- Tools needed:
  - `get_spot_price` — Current spot price
  - `get_order_book` — Order book depth
  - `get_klines` — Candlestick data
  - `get_24h_stats` — 24h price/volume stats
  - `get_recent_trades` — Recent trade list
  - `get_account_info` — Account balances (auth required)
  - `place_order` — Place spot order (auth required)
  - `get_open_orders` — List open orders (auth required)
  - `cancel_order` — Cancel order (auth required)
- Handle API key authentication properly (HMAC-SHA256 signatures)
- Rate limit compliance (1200 weight per minute)

### 4. Fix `packages/bnbchain-mcp/`

- BNB Chain specific tools:
  - `get_bnb_price` — BNB price
  - `get_bep20_balance` — BEP-20 token balance
  - `get_bsc_transaction` — BSC transaction details
  - `get_bsc_block` — BSC block details
  - `get_pancakeswap_pairs` — PancakeSwap trading pairs
  - `get_venus_markets` — Venus lending markets
- Use BSCScan API and DeFiLlama

### 5. Complete `packages/agent-runtime/`

**Agent implementation (`src/agent.ts`):**
```typescript
// Agent must implement:
// - Registration with ERC-8004 on-chain registry
// - Agent-to-Agent (A2A) protocol communication
// - x402 payment handling for paid API calls
// - Health reporting
// - Capability advertisement
// - Task execution with timeout and cancellation
```

**Discovery (`src/discovery/`):**
```typescript
// wellKnown.ts — Serve /.well-known/agent.json
// search.ts — Search for agents by capability
// connect.ts — Establish A2A connections
```

**Protocols:**
- `a2a/` — Implement Google's Agent-to-Agent protocol
- `erc8004/` — On-chain agent registry (read/write)
- `x402/` — Payment protocol for monetized agent calls

**Server (`src/server.ts`):**
- Express or Hono server
- Middleware: auth, rate-limit, logging
- Routes: /agent, /tasks, /health, /.well-known/agent.json
- WebSocket support for streaming responses

### 6. Integration Tests

Create tests for each package:

```typescript
// packages/mcp-server/tests/
// - Tool schema validation (all tools have valid MCP schemas)
// - Handler execution (mock API responses, verify structured output)
// - Error handling (API errors return clean error objects)

// packages/agent-runtime/tests/
// - Agent lifecycle (create, register, execute task, shutdown)
// - A2A protocol (message exchange between two agents)
// - Discovery (well-known endpoint returns valid agent.json)
```

### 7. Package Build & Publish

For each package:
- Fix `package.json` — correct `main`, `types`, `exports`, `files` fields
- Fix `tsconfig.json` — correct `outDir`, `rootDir`, `composite`
- Build succeeds: `npm run build` (or `npx tsc`)
- TypeScript compiles cleanly with strict mode
- No circular dependencies

## Verification

1. `cd packages/mcp-server && npm run build` succeeds
2. `cd packages/binance-mcp && npm run build` succeeds
3. `cd packages/bnbchain-mcp && npm run build` succeeds
4. `cd packages/agent-runtime && npm run build` succeeds
5. MCP server starts and lists all tools: `node dist/cli.js --list-tools`
6. Agent runtime starts: `node dist/main.js` → serves `/.well-known/agent.json`
7. All tests pass: `npm test` in each package
8. No TypeScript errors: `npx tsc --noEmit` in each package
