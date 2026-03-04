# Prompt 14 — Sniper Agent

## Agent Identity & Rules

```
You are the SNIPER-AGENT builder. Create an agent that snipes token launches.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Solana transactions, real bonding curves
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add sniper agent for rapid early-stage token acquisition"
```

## Objective

Create `packages/pump-agent-swarm/src/agents/sniper-agent.ts` — an agent that monitors for brand-new token launches and executes extremely fast buy orders to acquire tokens at the lowest possible bonding curve price.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/agents/sniper-agent.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/agents/sniper-agent.ts`

1. **`SniperAgent` class** extends EventEmitter:
   - `constructor(wallet: AgentWallet, connection: Connection, config: SniperConfig)`
   - `watchForLaunch(targetMint?: string): Promise<void>` — monitors for new mints
   - `snipe(mint: string, solAmount: BN): Promise<TradeResult>` — instant buy with max priority
   - `setReady(): void` — pre-builds transaction template for fastest execution
   - `stop(): void`

2. **SniperConfig**:
   ```typescript
   interface SniperConfig {
     /** SOL to spend on snipe */
     snipeAmountLamports: BN;
     /** Max slippage (bps) — can be high for snipes */
     maxSlippageBps: number; // e.g., 2000 = 20%
     /** Priority fee — should be very high */
     priorityFeeMicroLamports: number; // e.g., 1_000_000
     /** Jito tip for guaranteed inclusion */
     jitoTipLamports?: number;
     /** Whether to use pre-built TX approach */
     prebuiltTx: boolean;
     /** Max age of target token in seconds (don't snipe old tokens) */
     maxTokenAgeSeconds: number;
     /** Auto-sell after N seconds (take profit) */
     autoSellAfterSeconds?: number;
     /** Auto-sell if price increases by X% */
     autoSellPriceMultiplier?: number;
   }
   ```

3. **Launch detection methods**:
   a. **WebSocket subscription** — subscribe to Pump.fun program logs:
      - Listen for `CreateV2` instruction logs
      - Parse the mint address from the log
      - Immediately trigger snipe

   b. **Account subscription** — monitor the Pump.fun global account for changes
   
   c. **Polling fallback** — poll `getSignaturesForAddress` on Pump.fun program

4. **Speed optimizations**:
   - Pre-fetch global state and keep it cached (refresh every 5s)
   - Pre-build transaction skeleton (fill in mint at execution time)
   - Use `sendTransaction` with `skipPreflight: true` for speed
   - Submit to multiple RPC endpoints simultaneously for fastest landing
   - Use Jito bundles when available for guaranteed slot inclusion

5. **Auto-sell mechanism**:
   - After successful snipe, start a timer for auto-sell
   - Monitor price via bonding curve state
   - Sell when target multiplier is reached or time expires
   - Use trailing stop: if price drops 20% from peak, sell immediately

6. **Event emissions**:
   - `sniper:watching` — monitoring for launches
   - `sniper:detected` — new token detected
   - `sniper:sniping` — buy TX submitted
   - `sniper:success` — snipe confirmed
   - `sniper:auto-sell` — auto-sell triggered
   - `sniper:failed` — snipe failed (too slow, insufficient funds, etc.)

### Success Criteria

- Detects new Pump.fun token launches within seconds
- Executes buy with maximum priority for fast inclusion  
- Pre-built TX approach minimizes latency
- Auto-sell with trailing stop works
- Multiple detection methods for redundancy
- Compiles with `npx tsc --noEmit`
