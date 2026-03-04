# Prompt 31 — Jito Block Engine Client

## Agent Identity & Rules

```
You are the JITO-CLIENT builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Jito block engine API calls
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add Jito block engine client for MEV-protected bundle submission"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/jito-client.ts` — a production client for the Jito block engine that submits transaction bundles for guaranteed same-slot inclusion with MEV protection.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/jito-client.ts`

## Dependencies

- `../types.ts` — `JitoBundleConfig` (P01)
- `../infra/logger.ts` — `SwarmLogger` (P07)
- `../infra/metrics.ts` — `MetricsCollector` (P08)
- `../infra/error-handler.ts` — `SwarmErrorHandler` (P09)
- `@solana/web3.js` — `Connection`, `Transaction`, `VersionedTransaction`, `PublicKey`

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/jito-client.ts`

1. **`JitoClient` class**:
   - `constructor(config: JitoBundleConfig)`
   - `sendBundle(transactions: (VersionedTransaction | Transaction)[]): Promise<JitoBundleResult>`
   - `getBundleStatus(bundleId: string): Promise<JitoBundleStatus>`
   - `waitForBundleConfirmation(bundleId: string, timeoutMs?: number): Promise<JitoBundleStatus>`
   - `getTipAccounts(): Promise<PublicKey[]>` — get Jito tip accounts
   - `addTipInstruction(tx: Transaction, tipLamports: number): Transaction` — add tip to transaction
   - `getRecommendedTip(): Promise<number>` — recommended tip based on current conditions
   - `isAvailable(): Promise<boolean>` — health check

2. **Jito API integration** (real endpoints):
   ```typescript
   // Jito Block Engine endpoints:
   // Mainnet: https://mainnet.block-engine.jito.wtf
   // - POST /api/v1/bundles — submit bundle
   // - GET /api/v1/bundles/{bundleId} — get status
   // - GET /api/v1/tip-accounts — get tip accounts
   
   // Alternative: Jito JSON-RPC
   // POST with method: "sendBundle" 
   // POST with method: "getBundleStatuses"
   // POST with method: "getTipAccounts"
   ```

3. **Bundle construction**:
   - Maximum 5 transactions per bundle
   - All transactions must be fully signed
   - Transactions execute in order within the same slot
   - Last transaction should include the Jito tip
   - Tip goes to one of the Jito tip accounts (randomly selected)

4. **JitoBundleResult**:
   ```typescript
   interface JitoBundleResult {
     bundleId: string;
     status: 'submitted' | 'confirmed' | 'failed' | 'timeout';
     slot?: number;
     signatures: string[];
     submittedAt: number;
     confirmedAt?: number;
     error?: string;
     tipLamports: number;
   }
   ```

5. **JitoBundleStatus**:
   ```typescript
   interface JitoBundleStatus {
     bundleId: string;
     status: 'pending' | 'landed' | 'failed' | 'invalid';
     slot?: number;
     confirmationStatus?: string;
     error?: string;
   }
   ```

6. **Tip management**:
   - Fetch tip accounts on startup
   - Cache for 5 minutes
   - Select random tip account per bundle (avoid concentration)
   - Recommended tip: query recent bundle tips and use median + 10%
   - Configurable tip amount with a floor and ceiling

7. **Error handling**:
   - Bundle rejected: log reason, retry with higher tip
   - Bundle landed but TX failed: inspect individual TX errors
   - Timeout: check if bundle actually landed via signatures
   - Connection failure: retry with exponential backoff

### Success Criteria

- Connects to real Jito block engine
- Submits bundles with proper formatting
- Tip instructions are correctly constructed
- Bundle status polling works with timeout
- Error handling covers all Jito-specific failure modes
- Compiles with `npx tsc --noEmit`
