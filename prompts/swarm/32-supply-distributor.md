# Prompt 32 — Supply Distributor

## Agent Identity & Rules

```
You are the SUPPLY-DISTRIBUTOR builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add post-launch supply distributor for token spreading"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/supply-distributor.ts` — after a bundle buy acquires tokens into specific wallets, this redistributes tokens across all agent wallets so no single wallet holds an outsized percentage.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/supply-distributor.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/supply-distributor.ts`

1. **`SupplyDistributor` class**:
   - `constructor(connection: Connection, walletVault: WalletVault, eventBus: SwarmEventBus)`
   - `planDistribution(mint: string, sourceWallets: AgentWallet[], targetWallets: AgentWallet[], strategy: DistributionStrategy): Promise<DistributionPlan>`
   - `executeDistribution(plan: DistributionPlan): Promise<DistributionResult>`
   - `getDistributionStatus(planId: string): DistributionResult | undefined`
   - `getCurrentDistribution(mint: string, wallets: AgentWallet[]): Promise<TokenDistribution>`
   - `analyzeDistribution(distribution: TokenDistribution): DistributionAnalysis`

2. **DistributionStrategy**:
   ```typescript
   type DistributionStrategy = 
     | 'equal'           // Equal tokens to each wallet
     | 'weighted'        // Based on role (market makers get more)
     | 'random'          // Random amounts for anti-detection
     | 'pyramid'         // Few wallets hold more, many hold less
     | 'gaussian';       // Normal distribution around mean

   interface DistributionConfig {
     strategy: DistributionStrategy;
     /** Max percentage any single wallet should hold */
     maxPerWalletPercent: number;
     /** Whether to stagger transfers for anti-detection */
     staggerTransfers: boolean;
     /** Delay between transfers (ms) */
     transferDelayMs: { min: number; max: number };
     /** Whether to add random noise to amounts */
     addNoise: boolean;
     /** Noise factor (0-0.3, percent deviation from target) */
     noiseFactor: number;
   }
   ```

3. **Distribution execution**:
   - Uses SPL Token `transfer` instruction (not bonding curve trades)
   - No fee on direct token transfers
   - Create associated token accounts if they don't exist
   - Batch multiple transfers into single transactions where possible
   - Verify all transfers landed

4. **DistributionPlan**:
   ```typescript
   interface DistributionPlan {
     id: string;
     mint: string;
     transfers: Array<{
       from: string;
       to: string;
       amount: BN;
       createAta: boolean; // Need to create Associated Token Account
       delayMs: number;
     }>;
     totalTokensToMove: BN;
     estimatedFees: BN;
     estimatedTimeMs: number;
   }
   ```

5. **TokenDistribution**:
   ```typescript
   interface TokenDistribution {
     mint: string;
     totalSupply: BN;
     wallets: Array<{
       address: string;
       agentId: string;
       balance: BN;
       percentOfSupply: number;
       percentOfSwarmHoldings: number;
     }>;
     giniCoefficient: number; // 0 = perfectly equal, 1 = one wallet holds all
     topWalletPercent: number;
     medianBalance: BN;
   }
   ```

6. **Gini coefficient**: Calculate distribution inequality metric — lower is more evenly distributed, which looks more organic.

### Success Criteria

- All distribution strategies produce valid plans
- SPL token transfers execute correctly
- Associated token account creation works
- Gini coefficient calculation is accurate
- Staggered transfers add anti-detection delays
- Noise factor adds realistic variance
- Compiles with `npx tsc --noEmit`
