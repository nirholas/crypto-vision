# Prompt 09 — Error Handler & Circuit Breaker

## Agent Identity & Rules

```
You are the ERROR-HANDLER agent. Build the error handling and circuit breaker system.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add error handler with circuit breaker and retry logic"
```

## Objective

Create `packages/pump-agent-swarm/src/infra/error-handler.ts` — centralized error handling with circuit breakers, retry logic with exponential backoff, error classification, and automatic recovery actions.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/infra/error-handler.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/infra/error-handler.ts`

1. **Error classification**:
   ```typescript
   type ErrorSeverity = 'recoverable' | 'degraded' | 'critical' | 'fatal';
   type ErrorCategory = 'rpc' | 'transaction' | 'wallet' | 'intelligence' | 'bundle' | 'unknown';
   
   interface ClassifiedError {
     original: Error;
     severity: ErrorSeverity;
     category: ErrorCategory;
     retryable: boolean;
     suggestedAction: 'retry' | 'skip' | 'pause' | 'exit' | 'switch_rpc';
     context: Record<string, unknown>;
   }
   ```

2. **`SwarmErrorHandler` class**:
   - `classify(error: Error, context?: Record<string, unknown>): ClassifiedError` — classifies errors based on message patterns
   - `handle(error: Error, context?: Record<string, unknown>): Promise<void>` — handles error based on classification
   - `withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>` — wraps async function with retry logic
   - `withCircuitBreaker<T>(name: string, fn: () => Promise<T>): Promise<T>` — wraps with circuit breaker
   - `getCircuitBreakerState(name: string): 'closed' | 'open' | 'half-open'`
   - `resetCircuitBreaker(name: string): void`
   - `getErrorStats(): { total: number; byCategory: Record<ErrorCategory, number>; bySeverity: Record<ErrorSeverity, number> }`

3. **Error classification rules**:
   - `"429"` or `"rate limit"` → recoverable, rpc, retry with backoff
   - `"insufficient funds"` or `"0x1"` → critical, wallet, pause
   - `"blockhash not found"` → recoverable, transaction, retry
   - `"Transaction simulation failed"` → recoverable, transaction, skip
   - `"unable to confirm"` → recoverable, transaction, retry
   - `"Network request failed"` → recoverable, rpc, switch_rpc
   - `"Account not found"` → degraded, transaction, skip
   - `"custom program error"` → degraded, transaction, skip
   - Unrecognized → unknown severity based on frequency

4. **Retry logic** (`RetryOptions`):
   ```typescript
   interface RetryOptions {
     maxRetries: number;          // default: 3
     initialDelayMs: number;      // default: 1000
     maxDelayMs: number;          // default: 30000
     backoffMultiplier: number;   // default: 2
     jitter: boolean;             // default: true (adds random delay to prevent thundering herd)
     retryableErrors?: string[];  // error message patterns that are retryable
     onRetry?: (attempt: number, error: Error) => void;
   }
   ```

5. **Circuit breaker**:
   - Three states: closed (normal), open (failing, reject immediately), half-open (testing)
   - Opens after `failureThreshold` failures (default: 5) within `windowMs` (default: 60000)
   - After `resetTimeoutMs` (default: 30000), transitions to half-open
   - In half-open, next success → closed, next failure → open
   - Different circuit breakers per operation type (rpc, trade, bundle)

6. **Integration with event bus**: All errors emit to event bus with full classification

### Success Criteria

- Error classification correctly identifies Solana-specific errors
- Retry logic with exponential backoff and jitter works
- Circuit breaker opens after threshold, recovers in half-open
- All errors are logged and emitted to event bus
- `withRetry` and `withCircuitBreaker` can be composed
- Compiles with `npx tsc --noEmit`
