# Prompt 25 — Order Router

## Agent Identity & Rules

```
You are the ORDER-ROUTER builder. Create the multi-RPC order routing system.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add order router with multi-RPC submission and confirmation tracking"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/order-router.ts` — routes trade transactions to the optimal RPC endpoint, supports multi-RPC simultaneous submission for speed, tracks confirmations, and handles landing failures.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/order-router.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/order-router.ts`

1. **`OrderRouter` class**:
   - `constructor(rpcPool: RpcPool, config: RouterConfig, eventBus: SwarmEventBus)`
   - `submitOrder(tx: VersionedTransaction | Transaction, options: SubmitOptions): Promise<OrderResult>`
   - `submitToAll(tx: VersionedTransaction | Transaction, options: SubmitOptions): Promise<OrderResult>` — submit to all healthy RPCs simultaneously
   - `getOrderStatus(signature: string): Promise<OrderStatus>`
   - `waitForConfirmation(signature: string, commitment?: Commitment, timeoutMs?: number): Promise<TransactionConfirmation>`
   - `getRecentSignatures(): string[]`
   - `getStats(): RouterStats`

2. **SubmitOptions**:
   ```typescript
   interface SubmitOptions {
     /** Whether to skip preflight simulation */
     skipPreflight: boolean;
     /** Commitment level for confirmation */
     commitment: Commitment;
     /** Max retries */
     maxRetries: number;
     /** Whether to submit to multiple RPCs simultaneously */
     multiRpc: boolean;
     /** Timeout for the entire submission+confirmation flow */
     timeoutMs: number;
     /** Priority fee in micro-lamports */
     priorityFee?: number;
     /** Whether to use Jito for submission */
     useJito?: boolean;
   }
   ```

3. **Multi-RPC submission**:
   - Send the same signed TX to all healthy RPC endpoints simultaneously
   - First confirmation wins — return that result
   - Cancel/ignore other pending submissions
   - This minimizes landing time by maximizing the chance at least one endpoint gets it to a leader

4. **Confirmation tracking**:
   - Subscribe to signature status on fastest WS endpoint
   - Fallback: poll `getSignatureStatuses` every 2 seconds
   - Track: submitted → processed → confirmed → finalized
   - Emit events at each stage

5. **OrderResult**:
   ```typescript
   interface OrderResult {
     signature: string;
     status: 'submitted' | 'confirmed' | 'finalized' | 'failed' | 'timeout';
     endpoint: string; // which RPC confirmed first
     submittedAt: number;
     confirmedAt?: number;
     latencyMs?: number;
     slot?: number;
     error?: string;
     retries: number;
   }
   ```

6. **RouterStats**:
   ```typescript
   interface RouterStats {
     totalSubmitted: number;
     totalConfirmed: number;
     totalFailed: number;
     avgLandingTimeMs: number;
     successRate: number;
     endpointPerformance: Record<string, { submitted: number; confirmed: number; avgLatencyMs: number }>;
   }
   ```

7. **Landing failure handling**:
   - If TX not confirmed after timeout, check if nonce was consumed
   - If nonce consumed but no confirmation, the TX likely landed — query by signature
   - If nonce NOT consumed, safe to retry with fresh blockhash
   - Track "ghost" transactions that might have landed but we can't confirm

### Success Criteria

- Multi-RPC submission sends to all endpoints simultaneously
- First confirmation is returned efficiently
- Landing time is minimized
- Retry logic handles expired blockhashes correctly
- Stats track per-endpoint performance
- Compiles with `npx tsc --noEmit`
