# Prompt 14: MCP Hosting Platform — Runtime Completion (Proxy, Routing, Payment Verification)

## Agent Identity & Rules

```
You are completing the unfinished runtime functions in the MCP Hosting Platform.
- Always work on the current branch
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- No mocks, no stubs, no placeholders — every function must do real work
- TypeScript strict mode — no `any` types, no `@ts-ignore`
```

## Objective

Complete three unfinished functions in `packages/mcp-server/hosting/runtime.ts` that currently throw errors or return stubs:

1. **`executeProxyTool()`** (line ~182) — currently `throw new Error("Proxy tools not yet implemented")`
2. **`routeToHostedServer()`** (line ~262) — currently `return { error: "Not implemented" }`
3. **Payment verification** (line ~117) — currently `// TODO: Verify payment on-chain` with no verification

## Context

### Current runtime.ts (271 lines)

Read the full file at `packages/mcp-server/hosting/runtime.ts`. Key structure:

```typescript
// executeProxyTool — needs to forward tool calls to another MCP server
async function executeProxyTool(target: string, args: Record<string, unknown>): Promise<unknown> {
  // TODO: Implement MCP-to-MCP proxy
  throw new Error("Proxy tools not yet implemented")
}

// routeToHostedServer — needs to actually route requests
export async function routeToHostedServer(subdomain: string, request: unknown): Promise<unknown> {
  const server = await getServerForSubdomain(subdomain)
  if (!server) { return { error: "Server not found", code: 404, ... } }
  // TODO: Route the request through the server
  return { error: "Not implemented" }
}

// In registerHostedTool — payment verification is skipped
if (tool.price > 0) {
  const paymentProof = args._paymentProof as string | undefined
  if (!paymentProof) { /* returns 402 */ }
  // TODO: Verify payment on-chain  ← this just logs and continues
}
```

### Available Verification Module

The x402 package already has a payment verification module. Read these files:

- `packages/mcp-server/x402/verify.ts` — exports `verifyUSDCTransfer()` and `verifyPaymentForTool()`
- `packages/mcp-server/x402/verification.ts` — exports `verifyPaymentProof()`, `isNonceUsed()`, `markNonceUsed()`

Key functions available:
```typescript
import { verifyPaymentForTool } from "../x402/verify.js"
// verifyPaymentForTool(txHash, expectedAmount, expectedRecipient, chainId) → { verified, amount, ... }

import { verifyPaymentProof } from "../x402/verification.js"
// verifyPaymentProof(proof) → { valid, txHash, amount, ... }
```

### MCP SDK for Proxy

The MCP SDK (`@modelcontextprotocol/sdk`) supports client connections. For proxy tools, create an MCP client that connects to the target server:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
```

### The Router Already Works

`packages/mcp-server/hosting/router.ts` (601 lines) already has a fully working `createHostingRouter()` with session management, 402 responses, and usage tracking. The `routeToHostedServer()` in `runtime.ts` should delegate to it properly.

## Deliverables

### 1. Implement `executeProxyTool()` in runtime.ts

Complete the MCP-to-MCP proxy that forwards tool calls to another MCP server:

```typescript
async function executeProxyTool(target: string, args: Record<string, unknown>): Promise<unknown> {
  // 1. Parse target URL (e.g., "https://other-server.agenti.cash/mcp")
  // 2. Create MCP client transport (StreamableHTTPClientTransport)
  // 3. Connect and call the target tool
  // 4. Return the result
  // 5. Clean up the connection
  // 6. Add timeout (10s) and error handling
  // 7. Cache the client connection for reuse with TTL
}
```

Requirements:
- Connection pool/cache for proxy targets (don't create new connection per call)
- 10-second timeout on proxy calls
- Proper cleanup on connection errors
- Structured logging for proxy operations
- Circuit breaker pattern: if a target fails 3 times in a row, skip it for 60s

### 2. Implement payment verification in `registerHostedTool()`

Replace the `// TODO: Verify payment on-chain` comment with real verification:

```typescript
// After the paymentProof is extracted from args:
if (paymentProof) {
  // 1. Verify the proof format using verifyPaymentProof()
  // 2. Check the txHash hasn't been used before (replay protection) using isNonceUsed()/markNonceUsed()
  // 3. Verify the on-chain transfer using verifyPaymentForTool()
  // 4. Confirm amount >= tool.price
  // 5. Confirm recipient matches config.pricing.payoutAddress
  // 6. Record the payment using revenue.recordPayment()
  // 7. If verification fails, return 402 with error details
}
```

### 3. Fix `routeToHostedServer()` in runtime.ts

The function currently returns `{ error: "Not implemented" }`. Fix it to actually route:

```typescript
export async function routeToHostedServer(subdomain: string, request: unknown): Promise<unknown> {
  const server = await getServerForSubdomain(subdomain)
  if (!server) { return { error: "Server not found", ... } }
  
  // Create/get the hosted MCP server instance
  const mcpServer = await createHostedServer(server)
  
  // Route the MCP JSON-RPC request through the server
  // Parse the request, find the matching tool/prompt/resource, execute it
  // Return the JSON-RPC response
}
```

### 4. Fix `getServerForSubdomain()` in runtime.ts

Currently returns `null` with a `// TODO: Load config from database` comment. After Prompt 13 (database migration) is done, this will use real DB queries. For now, wire it up to call `getServerBySubdomain()` from `router.ts`:

```typescript
import { getServerBySubdomain } from "./router.js"

export async function getServerForSubdomain(subdomain: string): Promise<McpServer | null> {
  const cached = serverCache.get(subdomain)
  if (cached) { cached.lastAccess = new Date(); return cached.server }
  
  const config = await getServerBySubdomain(subdomain)
  if (!config) return null
  
  const server = await createHostedServer(config)
  serverCache.set(subdomain, { server, config, lastAccess: new Date() })
  return server
}
```

### 5. Remove ALL remaining TODO comments from runtime.ts

After all implementations are complete, there should be zero `// TODO` comments remaining in the file.

## Constraints

- Import verification functions from the existing x402 modules — don't reimplement them
- The proxy tool connection pool should be bounded (max 50 concurrent proxy connections)
- All new code must have proper TypeScript types — no `any`
- Add structured logging (using the existing Logger) for all operations
- Handle errors gracefully — never crash the server on a proxy or verification failure
- Test by reading the file after changes and verifying no TODOs remain

## Verification

1. `grep -n "TODO" packages/mcp-server/hosting/runtime.ts` → should return zero results
2. `grep -n "Not implemented" packages/mcp-server/hosting/runtime.ts` → should return zero results
3. `grep -n "not yet implemented" packages/mcp-server/hosting/runtime.ts` → should return zero results
4. All TypeScript compiles without errors
