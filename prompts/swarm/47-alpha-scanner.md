# Prompt 47 — Alpha Scanner

## Agent Identity & Rules

```
You are the ALPHA-SCANNER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Pump.fun API scanning
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add alpha opportunity scanner for Pump.fun tokens"
```

## Objective

Create `packages/pump-agent-swarm/src/intelligence/alpha-scanner.ts` — continuously scans Pump.fun for alpha opportunities: early-entry tokens, graduation plays, narrative matches, and tokens with strong organic signals. Emits opportunities via event bus for the strategy brain to act on.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/intelligence/alpha-scanner.ts`

## Dependencies

- `infra/event-bus.ts` — `SwarmEventBus`
- `infra/logger.ts` — structured logging
- Node.js `fetch` for Pump.fun API

## Deliverables

### Create `packages/pump-agent-swarm/src/intelligence/alpha-scanner.ts`

1. **`AlphaScanner` class**:
   - `constructor(eventBus: SwarmEventBus, config?: AlphaScannerConfig)`
   - `scan(): Promise<AlphaOpportunity[]>` — run a single scan cycle
   - `startContinuousScan(intervalMs: number): void` — start continuous scanning
   - `stopScan(): void` — stop scanning
   - `getTopOpportunities(limit: number): AlphaOpportunity[]` — best current opportunities
   - `subscribeToOpportunities(callback: (opp: AlphaOpportunity) => void): () => void` — subscribe to new finds
   - `getScannedCount(): number` — total tokens scanned
   - `getScanHistory(): ScanResult[]` — past scan results

2. **AlphaScannerConfig**:
   ```typescript
   interface AlphaScannerConfig {
     /** Pump.fun API base URL */
     pumpFunApiBase: string;         // 'https://frontend-api-v3.pump.fun'
     /** Tokens to fetch per scan */
     tokensPerScan: number;          // default: 100
     /** Minimum score to consider as opportunity */
     minOpportunityScore: number;    // default: 60
     /** Categories to prioritize */
     priorityCategories: string[];   // ['ai', 'tech', 'political']
     /** Max age of token to consider (ms) */
     maxTokenAge: number;            // default: 3600000 (1 hour)
     /** Scan interval (ms) */
     scanInterval: number;           // default: 30000 (30s)
     /** Max opportunities to keep in memory */
     maxOpportunities: number;       // default: 50
     /** Exclude tokens we've already evaluated */
     excludeMints: Set<string>;
   }
   ```

3. **AlphaOpportunity**:
   ```typescript
   interface AlphaOpportunity {
     /** Unique ID */
     id: string;
     /** Token mint address */
     mint: string;
     /** Token name */
     name: string;
     /** Token symbol */
     symbol: string;
     /** Opportunity score (0-100) */
     score: number;
     /** Type of alpha */
     category: 'early-entry' | 'graduation-play' | 'narrative-match' | 'volume-surge' | 'revival';
     /** How urgent is this opportunity */
     urgency: 'immediate' | 'soon' | 'watch';
     /** Why this is an opportunity */
     reasoning: string;
     /** Estimated upside (multiple, e.g., 2.0 = 2x) */
     estimatedUpside: number;
     /** Risk level */
     risk: 'low' | 'medium' | 'high' | 'extreme';
     /** Key metrics at time of discovery */
     metrics: {
       marketCap: number;
       price: number;
       holderCount: number;
       replyCount: number;
       age: number;                  // ms since creation
       volumeRecent: number;         // Recent volume estimate
       graduationProgress: number;   // 0-100%
     };
     /** Token description from Pump.fun */
     description: string;
     /** Image URI */
     imageUri: string;
     /** Discovered at timestamp */
     discoveredAt: number;
     /** Time-to-live: how long this opportunity is valid */
     ttlMs: number;
   }
   ```

4. **Scanning strategies**:

   **Early Entry** — tokens launched in last 10 minutes with promising signals:
   ```typescript
   // Criteria:
   // - Age < 10 minutes
   // - Market cap < $10k
   // - At least 3 unique buyers
   // - Reply count > 0 (people are commenting)
   // - Name/description contains trending keywords
   // Score boost: +20 if in priority category
   ```

   **Graduation Play**: tokens close to graduating to PumpSwap:
   ```typescript
   // Criteria:
   // - Graduation progress > 70% (SOL in curve > 60 SOL)
   // - Active trading (not stagnant near threshold)
   // - Growing holder count
   // - Market cap indicates continued interest
   // Score boost: +30 for > 90% graduation progress
   ```

   **Narrative Match** — tokens matching trending narratives:
   ```typescript
   // Criteria:
   // - Name/symbol matches trending category keywords
   // - Age < 1 hour (fresh enough to have upside)
   // - Some traction (market cap > $1k)
   // Score boost: +15 for exact trending narrative match
   ```

   **Volume Surge** — sudden volume increase on existing token:
   ```typescript
   // Criteria:
   // - Volume in last 15 min > 3x average volume
   // - Growing market cap (not a dump)
   // - Price trending up during volume surge
   ```

   **Revival** — older tokens showing renewed interest:
   ```typescript
   // Criteria:
   // - Age > 1 hour but < 24 hours
   // - Recent volume spike after period of quiet
   // - New comments appearing
   // - Holder count increasing again
   ```

5. **ScanResult** (per scan cycle):
   ```typescript
   interface ScanResult {
     scanId: string;
     tokensFetched: number;
     tokensAnalyzed: number;
     opportunitiesFound: number;
     topOpportunity: AlphaOpportunity | null;
     scanDuration: number;
     timestamp: number;
   }
   ```

6. **Deduplication and lifecycle**:
   - Track seen mints to avoid re-reporting same opportunity
   - Opportunities have TTL — expire old ones
   - If a token was an opportunity but score drops, remove it
   - Emit `alpha:opportunity-found` event for each new opportunity
   - Emit `alpha:opportunity-expired` when TTL expires

7. **API fetching**:
   ```typescript
   // Fetch multiple endpoints per scan:
   // 1. Recent launches (sort by created_timestamp)
   // 2. King of the Hill (near graduation)
   // 3. Top by market cap (volume surge detection)
   //
   // Parse each token's data and run through all 5 strategy filters
   // Return opportunities sorted by score (highest first)
   ```

### Success Criteria

- Scans real Pump.fun API endpoints
- Correctly identifies opportunities across all 5 categories
- Continuous scanning with configurable interval works
- Opportunities expire via TTL mechanism
- Event bus integration emits discovered opportunities
- Deduplication prevents re-reporting same token
- Compiles with `npx tsc --noEmit`
