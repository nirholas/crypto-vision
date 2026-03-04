# Prompt 18: x402 — Register Server-Side & UCAI Tools with MCP Server

## Agent Identity & Rules

```
You are completing the tool registration in the x402 payment protocol entry point.
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

In `packages/mcp-server/x402/index.ts`, the `registerX402()` function has two commented-out TODO lines that prevent server-side and UCAI tools from being registered:

```typescript
export function registerX402(server: McpServer): void {
  // ... config validation and logging ...
  
  // Register client-side tools (making payments)
  registerX402Tools(server)  // ✅ This works
  
  // TODO: Register server-side tools (receiving payments)
  // registerX402ServerTools(server)  // ← COMMENTED OUT
  
  // TODO: Register UCAI tools (smart contract AI payments)
  // registerUCAITools(server)  // ← COMMENTED OUT
  
  Logger.info("x402: Payment protocol ready 💰")
}
```

Both `registerX402ServerTools` and `registerUCAITools` are already exported from their respective modules and imported at the top of the file. They just need to be called.

## Context

### Already Imported

From `packages/mcp-server/x402/index.ts` imports (already at the top of the file):

```typescript
export { registerX402ServerTools } from "./server/index.js"  // Already exported
export { registerUCAI, registerUCAITools, ... } from "./ucai/index.js"  // Already exported
```

### Server-Side Tools (from `./server/index.js`)

Read `packages/mcp-server/x402/server/index.ts` to understand what `registerX402ServerTools` does. It registers tools for **receiving** payments:
- `x402_create_protected_endpoint` — Define a new paywall
- `x402_list_earnings` — View revenue
- `x402_withdraw_earnings` — Withdraw funds
- `x402_set_pricing` — Configure prices
- `x402_server_status` — Check server configuration
- `x402_export_analytics` — Export payment data
- `x402_list_endpoints` — List protected endpoints

### UCAI Tools (from `./ucai/index.js`)

Read `packages/mcp-server/x402/ucai/index.ts` to understand what `registerUCAITools` does. It registers tools for **smart contract AI payments**:
- `ucai_sponsor_gas` — Pay for user's gas via x402
- `ucai_analyze_contract` — Premium security analysis ($0.05)
- `ucai_detect_rug_pull` — Rug pull detection ($0.05)
- `ucai_simulate_transaction` — Preview outcomes ($0.01)
- `ucai_query_historical_data` — Query past data ($0.02)
- `ucai_generate_abi` — Generate ABI from bytecode ($0.10)

## Deliverables

### 1. Uncomment and wire up both tool registrations in `x402/index.ts`

Replace the commented-out lines with proper conditional registration:

```typescript
export function registerX402(server: McpServer): void {
  const config = loadX402Config()
  const validation = validateX402Config(config)
  
  Logger.info("x402: Initializing payment protocol...")
  // ... existing logging ...
  
  // Log any warnings/errors (keep existing code)
  
  // Register client-side tools (making payments) — always available
  registerX402Tools(server)
  
  // Register server-side tools (receiving payments)
  // Only register if server-side config is available
  if (isX402ServerConfigured()) {
    registerX402ServerTools(server)
    Logger.info("x402: Server-side payment tools registered ✅")
  } else {
    Logger.info("x402: Server-side tools skipped (not configured)")
  }
  
  // Register UCAI tools (smart contract AI payments)
  // Only register if EVM is configured (UCAI needs on-chain access)
  if (isEvmConfigured()) {
    registerUCAITools(server)
    Logger.info("x402: UCAI smart contract tools registered ✅")
  } else {
    Logger.info("x402: UCAI tools skipped (EVM not configured)")
  }
  
  Logger.info("x402: Payment protocol ready 💰")
}
```

### 2. Verify the imported functions exist and work

Read these files to confirm the functions are properly exported:
- `packages/mcp-server/x402/server/index.ts` — confirm `registerX402ServerTools` exists and accepts `McpServer`
- `packages/mcp-server/x402/ucai/index.ts` — confirm `registerUCAITools` exists and accepts `McpServer`
- `packages/mcp-server/x402/config.ts` — confirm `isX402ServerConfigured` is exported (if not, check what the equivalent function is called)

If `isX402ServerConfigured` doesn't exist, read `packages/mcp-server/x402/server/index.ts` to find the correct config check function, or import `loadX402ServerConfig` and check if it returns valid config.

### 3. Update `x402Status()` to reflect registration state

Update the `x402Status()` function in the same file to include server-side and UCAI tool counts:

```typescript
export function x402Status(): {
  available: boolean
  evmConfigured: boolean
  svmConfigured: boolean
  serverConfigured: boolean    // NEW
  ucaiAvailable: boolean       // NEW
  defaultChain: string
  maxPayment: string
  supportedChains: string[]
  registeredToolGroups: string[] // NEW: e.g., ["client", "server", "ucai"]
} {
  // ...
}
```

### 4. Remove ALL TODO comments from the function

After the changes, there should be zero `// TODO` comments in the `registerX402()` function.

## Constraints

- Don't modify the actual tool implementations in `server/` or `ucai/` — just wire them up
- Registration should be conditional on proper configuration being present
- If a tool group fails to register (throws an error), catch it, log the error, and continue
- Don't let UCAI registration failure prevent server-side tools from registering (and vice versa)

## Verification

1. `grep -n "TODO" packages/mcp-server/x402/index.ts` → zero matches
2. `grep -n "registerX402ServerTools" packages/mcp-server/x402/index.ts` → should show an uncommented call
3. `grep -n "registerUCAITools" packages/mcp-server/x402/index.ts` → should show an uncommented call
4. TypeScript compiles without errors
