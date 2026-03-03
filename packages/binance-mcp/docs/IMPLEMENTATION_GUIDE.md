# Binance.US MCP Server - Tool Implementation Guide

This guide provides implementation details for developers working with or extending the Binance.US MCP Server.

## Architecture Overview

```
binance-us-mcp-server/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── config/
│   │   └── binanceUsClient.ts   # API client with HMAC signing
│   └── tools/
│       ├── general/             # Ping, time, exchange info
│       ├── market/              # Public market data
│       ├── trade/               # Spot trading orders
│       ├── wallet/              # Deposits, withdrawals
│       ├── account/             # Account info, balances
│       ├── otc/                 # OTC block trading
│       ├── staking/             # Staking products
│       ├── subaccount/          # Sub-account management
│       ├── userdata-stream/     # WebSocket listen keys
│       ├── custodial/           # Custodial balance & orders
│       ├── custodial-solution/  # Custodial transfers & settlements
│       └── creditline/          # Credit line operations
```

## Tool Module Pattern

Each tool module follows this pattern:

```typescript
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makePublicRequest, makeSignedRequest } from "../config/binanceUsClient.js";

export function registerMyTools(server: McpServer): void {
  // Tool 1: Public endpoint
  server.tool(
    "binance_us_my_tool",
    "Tool description for AI agents",
    {
      param1: z.string().describe("Parameter description"),
      param2: z.number().optional().describe("Optional parameter"),
    },
    async ({ param1, param2 }) => {
      const result = await makePublicRequest("/api/v3/endpoint", { param1, param2 });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Tool 2: Signed endpoint
  server.tool(
    "binance_us_signed_tool",
    "Description for signed endpoint",
    {
      asset: z.string().describe("Asset symbol"),
    },
    async ({ asset }) => {
      const result = await makeSignedRequest("GET", "/sapi/v1/endpoint", { asset });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
```

## API Client (`binanceUsClient.ts`)

### Public Requests
```typescript
import { makePublicRequest } from "./config/binanceUsClient.js";

// Simple GET request
const data = await makePublicRequest("/api/v3/ticker/price", { symbol: "BTCUSD" });
```

### Signed Requests
```typescript
import { makeSignedRequest } from "./config/binanceUsClient.js";

// GET with signature
const account = await makeSignedRequest("GET", "/api/v3/account");

// POST with signature
const order = await makeSignedRequest("POST", "/api/v3/order", {
  symbol: "BTCUSD",
  side: "BUY",
  type: "LIMIT",
  quantity: "0.001",
  price: "40000",
  timeInForce: "GTC",
});

// DELETE with signature
const cancelled = await makeSignedRequest("DELETE", "/api/v3/order", {
  symbol: "BTCUSD",
  orderId: 12345,
});

// PUT with signature (for userdata-stream)
const keepalive = await makeSignedRequest("PUT", "/api/v3/userDataStream", {
  listenKey: "your_listen_key",
});
```

### Signature Generation
The client automatically:
1. Adds `timestamp` parameter
2. Generates HMAC SHA256 signature
3. Appends `signature` to request
4. Includes `X-MBX-APIKEY` header

## Tool Categories by API Key Type

### Standard Exchange API Keys
- General tools (ping, time, exchange info)
- Market data tools (public)
- Trading tools (requires TRADE permission)
- Wallet tools (requires WALLET permission)
- Account tools (requires USER_DATA permission)
- OTC tools
- Staking tools
- Sub-account tools
- User data stream tools

### Custodial Solution API Keys
These require a Custody Exchange Network agreement:
- `binance_us_custodian_*` tools
- All custodial tools include a `rail` parameter

### Credit Line API Keys
These require an institutional credit agreement:
- `binance_us_cl_*` tools

## Adding New Tools

### Step 1: Create Tool Module
```bash
mkdir -p src/tools/mymodule
touch src/tools/mymodule/index.ts
```

### Step 2: Implement Tools
```typescript
// src/tools/mymodule/index.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeSignedRequest } from "../config/binanceUsClient.js";

export function registerMyModuleTools(server: McpServer): void {
  server.tool(
    "binance_us_my_feature",
    "Description of what this tool does",
    {
      requiredParam: z.string().describe("A required parameter"),
      optionalParam: z.number().optional().describe("An optional parameter"),
    },
    async ({ requiredParam, optionalParam }) => {
      const params: Record<string, unknown> = { requiredParam };
      if (optionalParam !== undefined) {
        params.optionalParam = optionalParam;
      }
      
      const result = await makeSignedRequest("GET", "/sapi/v1/myEndpoint", params);
      
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
```

### Step 3: Register in index.ts
```typescript
// src/index.ts
import { registerMyModuleTools } from "./tools/mymodule/index.js";

// In main():
registerMyModuleTools(server);
```

### Step 4: Build and Test
```bash
npm run build
npm test
```

## Zod Schema Patterns

### String Parameters
```typescript
symbol: z.string().describe("Trading pair (e.g., BTCUSD)")
```

### Optional Parameters
```typescript
limit: z.number().optional().describe("Number of results (max 1000)")
```

### Enum Parameters
```typescript
side: z.enum(["BUY", "SELL"]).describe("Order side")
type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT"]).describe("Order type")
```

### Conditional Parameters
```typescript
// Either orderId OR origClientOrderId required
orderId: z.number().optional().describe("Order ID"),
origClientOrderId: z.string().optional().describe("Original client order ID"),
```

### Rail Parameter (Custodial)
```typescript
rail: z.enum(["anchorage", "bitgo"]).describe("Custody rail provider")
```

## Error Handling

Tools should handle errors gracefully:

```typescript
server.tool(
  "binance_us_risky_tool",
  "Tool that might fail",
  { symbol: z.string() },
  async ({ symbol }) => {
    try {
      const result = await makeSignedRequest("GET", "/api/v3/endpoint", { symbol });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  }
);
```

## Testing Tools

### Manual Testing with MCP Inspector
```bash
npx @modelcontextprotocol/inspector node build/index.js
```

### Environment Variables
```bash
export BINANCE_US_API_KEY="your_api_key"
export BINANCE_US_API_SECRET="your_api_secret"
```

## Common Patterns

### Pagination
```typescript
server.tool(
  "binance_us_paginated_list",
  "Get paginated results",
  {
    startTime: z.number().optional().describe("Start time in ms"),
    endTime: z.number().optional().describe("End time in ms"),
    limit: z.number().optional().describe("Results per page (max 1000)"),
    page: z.number().optional().describe("Page number"),
  },
  async ({ startTime, endTime, limit, page }) => {
    const params: Record<string, unknown> = {};
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;
    if (limit) params.limit = limit;
    if (page) params.page = page;
    
    const result = await makeSignedRequest("GET", "/sapi/v1/list", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
```

### Conditional Required Parameters
```typescript
// Cancel by orderId or origClientOrderId
server.tool(
  "binance_us_cancel_by_id",
  "Cancel order by ID",
  {
    symbol: z.string().describe("Trading pair"),
    orderId: z.number().optional().describe("Order ID (provide this OR origClientOrderId)"),
    origClientOrderId: z.string().optional().describe("Original client order ID"),
  },
  async ({ symbol, orderId, origClientOrderId }) => {
    if (!orderId && !origClientOrderId) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Either orderId or origClientOrderId is required" }) }],
        isError: true,
      };
    }
    
    const params: Record<string, unknown> = { symbol };
    if (orderId) params.orderId = orderId;
    if (origClientOrderId) params.origClientOrderId = origClientOrderId;
    
    const result = await makeSignedRequest("DELETE", "/api/v3/order", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);
```

## API Endpoints Reference

### Public Endpoints (No Auth)
- `GET /api/v3/ping`
- `GET /api/v3/time`
- `GET /api/v3/exchangeInfo`
- `GET /api/v3/depth`
- `GET /api/v3/trades`
- `GET /api/v3/klines`
- `GET /api/v3/ticker/price`
- `GET /api/v3/ticker/24hr`

### Signed Endpoints (API Key + Signature)
- `GET /api/v3/account`
- `POST /api/v3/order`
- `DELETE /api/v3/order`
- `GET /api/v3/openOrders`
- `GET /api/v3/allOrders`
- `GET /api/v3/myTrades`
- `POST /api/v3/order/oco`

### SAPI Endpoints (Specific APIs)
- `GET /sapi/v1/capital/deposit/address`
- `GET /sapi/v1/capital/deposit/hisrec`
- `POST /sapi/v1/capital/withdraw/apply`
- `GET /sapi/v1/capital/withdraw/history`
- `GET /sapi/v1/otc/coinPairs`
- `POST /sapi/v1/otc/quotes`
- `POST /sapi/v1/otc/orders`
- `GET /sapi/v1/staking/asset`
- `POST /sapi/v1/staking/stake`
- `POST /sapi/v1/staking/unstake`

### Custodial Endpoints
- `GET /sapi/v1/custodian/balance`
- `POST /sapi/v1/custodian/transfer`
- `POST /sapi/v1/custodian/order`
- `POST /sapi/v1/custodian/settlement`

### Credit Line Endpoints
- `GET /sapi/v1/creditline/account`
- `POST /sapi/v1/creditline/transfer`
- `GET /sapi/v1/creditline/alerts`
