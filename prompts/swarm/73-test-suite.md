# Prompt 73 — Integration & E2E Test Suite

## Agent Identity & Rules

```
You are the TEST-SUITE builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks for blockchain interactions — use devnet for integration tests
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add integration and E2E test suite with devnet fixtures"
```

## Objective

Create a comprehensive test suite for the pump-agent-swarm package. This includes unit tests for pure logic modules, integration tests that verify agent interactions on Solana devnet, and an E2E test that runs the full token lifecycle (create → bundle → trade → exit). Use vitest as the test runner (already configured in the monorepo root).

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/__tests__/unit/types.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/unit/config.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/unit/event-bus.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/unit/state-machine.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/unit/risk-manager.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/unit/pnl-tracker.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/unit/slippage-calculator.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/unit/anti-detection.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/integration/wallet-vault.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/integration/rpc-pool.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/integration/creator-agent.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/integration/trader-agent.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/integration/bundle-coordinator.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/e2e/full-lifecycle.test.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/helpers/devnet-fixtures.ts`
- **Creates**: `packages/pump-agent-swarm/src/__tests__/helpers/test-config.ts`
- **Creates**: `packages/pump-agent-swarm/vitest.config.ts`

## Dependencies

- All `packages/pump-agent-swarm/src/` modules (01-72)
- `vitest` (already in monorepo devDependencies)
- `@solana/web3.js` for devnet connections
- Solana devnet RPC: `https://api.devnet.solana.com`

## Deliverables

### Create `packages/pump-agent-swarm/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/e2e/**'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: {
      forks: { maxForks: 4 },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/demo/**', 'src/examples/**'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
```

### Create `packages/pump-agent-swarm/src/__tests__/helpers/test-config.ts`

1. **`createTestConfig()` function**:
   - Returns a valid `SwarmConfig` with devnet RPC URLs
   - Uses `https://api.devnet.solana.com` as primary RPC
   - Sets conservative limits (small SOL amounts, low trade counts)
   - All timeouts shortened for test speed
   - Returns config satisfying full type validation from P06

2. **`createTestLogger()` function**:
   - Returns a logger instance that captures logs in an array for assertions
   - Implements the Logger interface from P07
   - `getLogs(): LogEntry[]` — retrieve captured logs
   - `clear(): void` — reset captured logs

3. **`createTestMetrics()` function**:
   - Returns a metrics collector that stores metrics in-memory
   - `getMetric(name: string): number` — retrieve specific metric value
   - `getAllMetrics(): Record<string, number>` — snapshot all metrics

### Create `packages/pump-agent-swarm/src/__tests__/helpers/devnet-fixtures.ts`

1. **`airdropToWallet(connection, publicKey, lamports)` function**:
   - Requests airdrop from devnet faucet
   - Confirms transaction with `confirmed` commitment
   - Retries up to 3 times with exponential backoff
   - Returns transaction signature

2. **`createTestWalletPool(connection, count)` function**:
   - Generates `count` fresh Keypairs
   - Airdrops 0.1 SOL to each
   - Waits for all airdrops to confirm
   - Returns array of funded Keypairs

3. **`waitForConfirmation(connection, signature, timeout)` function**:
   - Polls transaction status until confirmed or timeout
   - Returns `TransactionConfirmationStatus`

4. **`cleanupWallets(connection, wallets, destination)` function**:
   - Transfers all remaining SOL from test wallets back to destination
   - Closes any token accounts
   - Used in `afterAll` hooks to avoid devnet SOL waste

### Create Unit Tests

Each unit test file tests pure logic without network calls:

**`unit/types.test.ts`**:
- Validate type guard functions (if any exist)
- Verify enum values and constants
- Test type factory functions
- Ensure default values are correct

**`unit/config.test.ts`**:
- `loadConfig()` with valid env vars → returns valid config
- `loadConfig()` with missing required vars → throws descriptive error
- `loadConfig()` with invalid values → throws validation error
- `getDefaultConfig()` → returns complete config with all defaults
- Config validation catches out-of-range numbers, invalid URLs, empty strings

**`unit/event-bus.test.ts`**:
- Subscribe → emit → handler called with correct payload
- Multiple subscribers receive same event
- Unsubscribe → handler no longer called
- `once()` handler fires exactly once
- Event history/replay works for late subscribers
- Wildcard patterns match correct events
- Error in one handler doesn't block others

**`unit/state-machine.test.ts`**:
- Valid transitions succeed (`IDLE → SCANNING → CREATING → TRADING → EXITING → COMPLETED`)
- Invalid transitions throw with descriptive message
- State change emits events
- Guards block transition when condition not met
- State history is recorded
- Concurrent transition attempts are serialized

**`unit/risk-manager.test.ts`**:
- Position size calculation respects max allocation
- Stop-loss triggers at configured threshold
- Take-profit triggers at configured threshold
- Portfolio exposure limits enforced
- Drawdown circuit breaker activates at threshold
- Risk score calculation produces values in [0, 100]

**`unit/pnl-tracker.test.ts`**:
- Track buy → track sell → P&L calculated correctly
- Multiple positions averaged correctly (FIFO)
- Unrealized P&L updates with price changes
- Fee accounting deducted from profits
- SOL and token P&L tracked independently
- Export produces correct summary report

**`unit/slippage-calculator.test.ts`**:
- Small trade on deep liquidity → low slippage
- Large trade on thin liquidity → high slippage
- Bonding curve math matches Pump.fun formula
- Slippage exceeding max → trade rejected
- Edge cases: zero liquidity, max supply, empty pool

**`unit/anti-detection.test.ts`**:
- Timing randomization produces values within configured bounds
- Amount randomization deviates within percentage tolerance
- Pattern detection flags suspicious sequences
- Wallet rotation triggers at configured trade count
- Cooldown periods enforced between trades

### Create Integration Tests

Integration tests connect to Solana devnet:

**`integration/wallet-vault.test.ts`**:
- Derive wallets from master seed → consistent addresses
- Assign wallet → wallet marked as in-use
- Release wallet → wallet available again
- Concurrent assignments don't double-assign
- `reclaimAll()` sweeps SOL back to master on devnet
- Encrypted storage round-trips keys correctly

**`integration/rpc-pool.test.ts`**:
- Pool initializes with devnet endpoints
- `getConnection()` returns healthy connection
- Failed endpoint removed from rotation
- Health check restores recovered endpoint
- Request counting and rate limiting work
- Failover to backup endpoint on primary failure

**`integration/creator-agent.test.ts`**:
- Generate token metadata via narrative agent
- **Skip actual Pump.fun creation** (devnet doesn't have Pump.fun) — test up to the instruction building
- Verify transaction structure is valid
- Verify compute budget instructions are present
- Verify metadata format matches Pump.fun schema

**`integration/trader-agent.test.ts`**:
- Build buy instruction for devnet token
- Build sell instruction for devnet token
- Position tracking updates on simulated fills
- P&L calculation on simulated price changes
- Risk limits prevent oversized trades

**`integration/bundle-coordinator.test.ts`**:
- Build multi-wallet bundle with correct structure
- Verify all transactions in bundle reference same blockhash
- Verify signer arrays are correct per transaction
- Anti-detection timing delays applied
- Bundle validation catches malformed transactions

### Create E2E Test

**`e2e/full-lifecycle.test.ts`**:

This is a long-running test (tagged with `@slow`, skipped in CI by default) that runs the complete swarm lifecycle on devnet:

```typescript
describe('Full Swarm Lifecycle (devnet)', () => {
  // Setup: airdrop SOL to master wallet
  // 1. Initialize SwarmOrchestrator with devnet config
  // 2. Start swarm in SCANNING phase
  // 3. Verify narrative agent generates token concept
  // 4. Verify creator agent builds valid transaction (no actual Pump.fun on devnet)
  // 5. Simulate bundle coordination with devnet wallets
  // 6. Verify trader agents can build buy/sell instructions
  // 7. Verify P&L tracking across simulated trades
  // 8. Trigger exit phase
  // 9. Verify wallet reclamation sweeps funds
  // 10. Verify audit log contains all events
  // 11. Verify graceful shutdown releases all resources
});
```

- Use `describe.skipIf(!process.env.RUN_E2E)` to skip in normal test runs
- Total test should complete within 120 seconds on devnet
- All wallets cleaned up in `afterAll`
- Captures comprehensive test report with timings

### Add npm scripts

Add to `packages/pump-agent-swarm/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "RUN_E2E=true vitest run --config vitest.e2e.config.ts",
    "test:integration": "vitest run --include 'src/__tests__/integration/**'"
  }
}
```

### Success Criteria

- All unit tests pass with `vitest run`
- Integration tests pass against Solana devnet
- E2E test produces complete lifecycle trace (when `RUN_E2E=true`)
- Coverage report generated with `vitest run --coverage`
- No test uses mocks for actual blockchain logic — only for LLM calls and external APIs
- Compiles with `npx tsc --noEmit`
