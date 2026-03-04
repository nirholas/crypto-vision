# Prompt 16 — Volume Agent

## Agent Identity & Rules

```
You are the VOLUME-AGENT builder. Create the volume generation agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add volume agent for organic-looking trade activity generation"
```

## Objective

Create `packages/pump-agent-swarm/src/agents/volume-agent.ts` — an agent that generates trading volume by executing balanced buy/sell cycles across multiple wallets, creating organic-looking activity patterns.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/agents/volume-agent.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/agents/volume-agent.ts`

1. **`VolumeAgent` class**:
   - `constructor(wallets: AgentWallet[], connection: Connection, config: VolumeConfig)`
   - `start(mint: string): void`
   - `stop(): void`
   - `getVolumeStats(): VolumeStats`
   - `setTargetVolume(solPerHour: number): void`
   - `addWallet(wallet: AgentWallet): void`
   - `removeWallet(agentId: string): void`

2. **VolumeConfig**:
   ```typescript
   interface VolumeConfig {
     targetVolumeSolPerHour: number;
     minTradeSize: BN;
     maxTradeSize: BN;
     minIntervalMs: number;
     maxIntervalMs: number;
     walletRotationEnabled: boolean;
     maxTradesPerWallet: number;
     balancedMode: boolean; // true = net zero volume, false = can have imbalance
     naturalPatterns: boolean; // true = use time-of-day volume curves
   }
   ```

3. **Volume generation patterns**:
   - **Balanced cycles**: Wallet A buys 0.05 SOL → wait → Wallet B sells equivalent tokens → net effect is volume with minimal position change
   - **Cascade**: A→B→C→A chain of trades creating a flow pattern
   - **Burst**: Random bursts of 3-5 trades in quick succession, then quiet period
   - **Natural curve**: Higher volume during "peak hours" (configurable), lower during off-hours

4. **Wallet rotation**:
   - Never use the same wallet more than `maxTradesPerWallet` times in a row
   - Rotate through all available wallets
   - Distribute volume evenly across wallets over time
   - Track per-wallet trade count and cooldown

5. **Volume stats tracking**:
   ```typescript
   interface VolumeStats {
     totalVolumeSol: number;
     volumeLastHour: number;
     volumeLastMinute: number;
     tradesExecuted: number;
     avgTradeSize: number;
     walletUtilization: Record<string, { trades: number; volumeSol: number }>;
     netPositionChange: BN;
   }
   ```

### Success Criteria

- Volume generation uses multiple wallets for organic appearance
- Balanced mode maintains near-zero net position change
- Natural patterns create time-varying volume curves
- Wallet rotation prevents detectable patterns
- Volume targets are achieved within ±10%
- Compiles with `npx tsc --noEmit`
