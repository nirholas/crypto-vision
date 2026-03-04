# Prompt 12 — Enhanced Creator Agent

## Agent Identity & Rules

```
You are the CREATOR-AGENT-V2 builder. Enhance the existing creator agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- Preserve ALL existing functionality — only add, never remove
- TypeScript strict mode, run npx tsc --noEmit after changes  
- Commit message: "feat(swarm): enhance creator agent with metadata upload, versioned transactions, and retry logic"
```

## Objective

Enhance `packages/pump-agent-swarm/src/agents/creator-agent.ts` with: metadata upload integration, VersionedTransaction support for larger bundles, compute budget optimization, retry logic with the error handler, event bus integration, and support for both `createV2` and the dev-buy-only flow (buying supply on an existing token instead of creating).

## File Ownership

- **Modifies**: `packages/pump-agent-swarm/src/agents/creator-agent.ts`

## Dependencies

- All existing imports preserved
- Add: event bus, logger, error handler, metrics from `../infra/`
- Add: wallet vault from `../wallet-manager.ts`

## Deliverables

### Enhance `packages/pump-agent-swarm/src/agents/creator-agent.ts`

Keep all existing methods working. Add:

1. **New method: `buyExistingToken(mint: string, solAmount: BN, slippageBps: number): Promise<MintResult>`**
   - For the "buy dev supply on existing tech coin" flow
   - Buys tokens on an existing bonding curve (no creation)
   - Returns a MintResult-compatible object for downstream compatibility
   - Uses the error handler's `withRetry` for TX submission

2. **New method: `createTokenWithMetadata(narrative: TokenNarrative, bundle: BundleBuyConfig): Promise<MintResult>`**
   - Takes a `TokenNarrative` from the narrative agent
   - Uploads metadata to IPFS if not already uploaded
   - Creates the token using the uploaded metadata URI
   - Full pipeline: narrative → metadata → IPFS → create → dev buy

3. **VersionedTransaction support**:
   - Replace `Transaction` with `VersionedTransaction` for bundle buys
   - Use `TransactionMessage.compile()` with address lookup tables  
   - This allows more instructions per transaction (for larger bundles)

4. **Compute budget optimization**:
   - `estimateComputeUnits(instructions: TransactionInstruction[]): Promise<number>` 
   - Use `simulateTransaction` to estimate actual compute units needed
   - Set compute budget to 1.2x estimated (20% buffer)
   - Dynamic priority fee: read recent priority fees from `getRecentPrioritizationFees()`

5. **Enhanced bundle buys with Jito support**:
   - If `JitoBundleConfig` is provided, submit bundles via Jito block engine
   - `executeBundleBuysJito(mint: string, bundle: BundleBuyConfig, jitoConfig: JitoBundleConfig): Promise<string[]>`
   - Include Jito tip instruction in each transaction
   - Submit all transactions as a Jito bundle for same-slot execution

6. **Integration with infrastructure**:
   - Use `SwarmEventBus` for all event emissions (instead of direct EventEmitter)
   - Use `SwarmLogger.create('creator', 'agent')` for logging
   - Use `MetricsCollector` to track creates, bundle buys, failures
   - Use `SwarmErrorHandler.withRetry()` for transaction submission
   - Use `SwarmErrorHandler.withCircuitBreaker('rpc')` for RPC calls

7. **Post-creation verification**:
   - After creating, verify the mint exists on-chain
   - Verify bonding curve PDA exists
   - Verify creator's token account has the dev buy tokens
   - Retry verification up to 3 times with 2s delays

### Success Criteria

- All existing tests still pass
- `buyExistingToken` works for buying into existing bonding curves
- `createTokenWithMetadata` handles the full narrative → on-chain flow
- VersionedTransaction support enables larger bundles
- Dynamic compute budget reduces failed transactions
- Jito bundle submission works (when configured)
- Infrastructure integration (events, logging, metrics, errors) complete
- Compiles with `npx tsc --noEmit`
