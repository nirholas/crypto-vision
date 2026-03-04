# Prompt 17: x402 SDK — Complete Yield Tracker, Wallet Swap Integration & CLI History

## Agent Identity & Rules

```
You are completing placeholder implementations in the x402 SDK and CLI.
- Always work on the current branch
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- No mocks, no stubs, no placeholders — every function must do real work
- TypeScript strict mode — no `any` types, no `@ts-ignore`
- Use viem for all EVM interactions
```

## Objective

Complete placeholder implementations across three x402 subsystems:

1. **`x402/sdk/yield/tracker.ts`** — Multiple placeholder return values and missing yield history
2. **`x402/sdk/wallet/yielding-wallet.ts`** — Swap integration is a placeholder
3. **`x402/cli/commands/history.ts`** — Returns empty array instead of real blockchain data
4. **`x402/utils/index.ts`** — Hardcoded placeholder contract address

## Context

### File 1: yield/tracker.ts (267 lines)

Read `packages/mcp-server/x402/sdk/yield/tracker.ts`. Current placeholders:

**`getYieldInfo()` (line ~73):**
```typescript
// For now, return 0 as placeholder
const totalYield = '0';  // ← Should calculate real yield from rebase history
```

**`getCurrentAPY()` (line ~90):**
```typescript
// Placeholder: Return default APY
return DEFAULTS.USDS_APY;  // ← Should query on-chain rebase data or Sperax API
```

**`getYieldHistory()` (line ~195):**
```typescript
// This is a placeholder implementation
// Returns current state as single entry instead of real history
return [{ timestamp: ..., balance: currentBalance.formatted, yieldEarned: '0', ... }]
```

### File 2: wallet/yielding-wallet.ts (711 lines)

Read `packages/mcp-server/x402/sdk/wallet/yielding-wallet.ts`. Current placeholder:

**`receiveAndConvert()` (line ~604):**
```typescript
// Placeholder for swap integration
return {
  success: true, fromToken, toToken: 'USDs',
  amountIn: amount, amountOut: amount, // 1:1 for stablecoins ← NOT REAL
}
```

Should use a DEX aggregator (1inch, Rubic, or direct Camelot/Uniswap on Arbitrum) to swap tokens into USDs.

### File 3: cli/commands/history.ts (187 lines)

Read `packages/mcp-server/x402/cli/commands/history.ts`. Current placeholder:

**`getPaymentHistory()` (line ~160-187):**
```typescript
async function getPaymentHistory(client, address, options): Promise<PaymentRecord[]> {
  // For demo purposes, return empty array  ← FAKE
  // Real implementation would use viem to query events
  return [];
}
```

The function has a commented-out real implementation that shows the correct approach:
```typescript
// const logs = await client.publicClient.getLogs({
//   address: USDS_ADDRESS,
//   event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
//   args: options.direction === 'sent' ? { from: address } : { to: address },
// });
```

### File 4: utils/index.ts (261 lines)

Read `packages/mcp-server/x402/utils/index.ts`. Current placeholder:

**`getUSDsAddress()` (line ~195):**
```typescript
const addresses: Partial<Record<X402Chain, `0x${string}`>> = {
  arbitrum: '0xD74f5255D557944cf7Dd0e45FF521520002D5748', // Real
  'arbitrum-sepolia': '0x5555555555555555555555555555555555555555', // Placeholder ← FAKE
};
```

### Supporting Context

- The USDs (Sperax USD) contract on Arbitrum: `0xD74f5255D557944cf7Dd0e45FF521520002D5748`
- USDs is a rebasing stablecoin — yield accrues via balance increases (no claim required)
- The rebase mechanics: `rebasingCreditsPerToken` decreases over time → token balance increases
- Sperax API for APY data: `https://api.sperax.io/usds/apy` (check if this endpoint exists)
- The `USDS_ABI` is already defined in `packages/mcp-server/x402/sdk/constants.ts`
- The `X402Client` class in `packages/mcp-server/x402/sdk/client.ts` has a `publicClient` property

## Deliverables

### 1. Complete `getCurrentAPY()` in yield/tracker.ts

Query real APY data:

```typescript
async getCurrentAPY(): Promise<number> {
  // Strategy 1: Query Sperax API
  try {
    const response = await fetch('https://api.sperax.io/usds/apy')
    if (response.ok) {
      const data = await response.json()
      return data.apy // or whatever the actual response shape is
    }
  } catch { /* fall through */ }
  
  // Strategy 2: Calculate from on-chain rebase data
  // - Get rebasingCreditsPerToken at current block
  // - Get rebasingCreditsPerToken at block ~7 days ago
  // - Calculate annualized rate from the change
  try {
    const currentCredits = await this.getRebasingCreditsPerToken()
    // ... calculate from historical data
  } catch { /* fall through */ }
  
  // Strategy 3: Fall back to default
  return DEFAULTS.USDS_APY
}
```

### 2. Complete `getYieldInfo()` totalYield calculation

```typescript
// Instead of hardcoded '0', calculate real yield:
// 1. Get current balance
// 2. Get Transfer events (deposits/withdrawals) from subgraph or logs
// 3. totalYield = currentBalance - totalDeposits + totalWithdrawals
```

### 3. Complete `getYieldHistory()` in yield/tracker.ts

Replace the single-entry placeholder with real event log querying:

```typescript
async getYieldHistory(address: Address, fromBlock?: number, toBlock?: number): Promise<YieldHistoryEntry[]> {
  // 1. Query Transfer events involving this address on the USDs contract
  const transferLogs = await this.publicClient.getLogs({
    address: this.usdsAddress,
    event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
    fromBlock: fromBlock ? BigInt(fromBlock) : 'earliest',
    toBlock: toBlock ? BigInt(toBlock) : 'latest',
  })
  
  // 2. Filter for transfers TO this address (deposits) and FROM this address (withdrawals)
  // 3. Track balance at each point
  // 4. Calculate yield earned between transfer events (balance increase not from transfers = yield)
  // 5. Return chronological array of YieldHistoryEntry
}
```

### 4. Complete `receiveAndConvert()` in yielding-wallet.ts

Implement real token swap via DEX:

```typescript
async receiveAndConvert(fromAddress, amount, fromToken): Promise<ConversionResult> {
  if (!this.config.autoConvertToUSDs || fromToken === 'USDs') {
    return { success: true, fromToken, toToken: 'USDs', amountIn: amount, amountOut: amount }
  }
  
  // 1. Get token addresses (USDC, USDT, etc.) and USDs on Arbitrum
  // 2. Check if direct pair exists on Camelot DEX (Arbitrum's main DEX)
  // 3. Get quote from Camelot Router
  // 4. Execute swap with slippage tolerance (0.5%)
  // 5. Return actual amountOut and transactionHash
  
  // If swap fails, return { success: false, error: ... } — don't throw
}
```

Use the Camelot V3 Router on Arbitrum: `0x1F721E2E82F6676FCE4eA07A5958cF098D339e18`
Or use 1inch API as fallback: `https://api.1inch.dev/swap/v6.0/42161/swap`

### 5. Complete `getPaymentHistory()` in cli/commands/history.ts

Uncomment and implement the real blockchain event query:

```typescript
async function getPaymentHistory(client, address, options): Promise<PaymentRecord[]> {
  const usdsAddress = getUSDsAddress(client.chain)
  if (!usdsAddress) return []
  
  // Query Transfer events from the USDs contract
  const logs = await client.publicClient.getLogs({
    address: usdsAddress,
    event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
    args: options.direction === 'sent' 
      ? { from: address as `0x${string}` }
      : options.direction === 'received'
      ? { to: address as `0x${string}` }
      : undefined,
    fromBlock: 'earliest', // Or last N blocks for performance
    toBlock: 'latest',
  })
  
  // Convert logs to PaymentRecord[] format
  // Sort by timestamp descending
  // Limit to options.limit
  
  return records.slice(0, options.limit)
}
```

### 6. Fix placeholder address in utils/index.ts

Replace the `0x5555...` placeholder for arbitrum-sepolia USDs:

```typescript
// Research the actual USDs testnet deployment on Arbitrum Sepolia
// If no testnet deployment exists, remove the entry and handle gracefully:
'arbitrum-sepolia': null, // USDs not deployed on testnet
```

Check the Sperax docs or contracts for the real testnet address. If there's no testnet deployment, set to `null` and update `getUSDsAddress()` to handle `null` properly.

## Constraints

- All blockchain queries must have proper error handling (RPC can fail, rate limit, timeout)
- Event log queries should be bounded — don't query from block 0 to latest on mainnet (that's millions of blocks). Use a reasonable lookback (e.g., last 90 days / ~2M blocks on Arbitrum)
- For the swap integration, use a well-known DEX router — don't interact with unknown contracts
- Slippage tolerance for swaps should be configurable (default 0.5%)
- All amounts must use proper decimal handling (USDs = 18 decimals, USDC = 6 decimals)

## Verification

1. `grep -rn "placeholder" packages/mcp-server/x402/sdk/yield/tracker.ts` → zero matches (case-insensitive)
2. `grep -rn "Placeholder" packages/mcp-server/x402/sdk/wallet/yielding-wallet.ts` → zero matches
3. `grep -rn "demo purposes" packages/mcp-server/x402/cli/commands/history.ts` → zero matches
4. `grep -rn "5555555555" packages/mcp-server/x402/utils/index.ts` → zero matches
5. `grep -rn "return \[\]" packages/mcp-server/x402/cli/commands/history.ts` → zero matches (in getPaymentHistory)
6. TypeScript compiles without errors
