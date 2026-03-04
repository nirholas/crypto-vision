# Prompt 11 — Scanner Agent (New Token Discovery)

## Agent Identity & Rules

```
You are the SCANNER-AGENT builder. Create the token discovery and evaluation agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real API calls to Pump.fun, Helius, Birdeye, Jupiter
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add scanner agent for new token discovery and evaluation"
```

## Objective

Create `packages/pump-agent-swarm/src/agents/scanner-agent.ts` — an agent that monitors Pump.fun for newly launched tokens, evaluates them based on configurable criteria (tech-related, holder distribution, volume, rug risk), and signals the swarm when a viable target is found.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/agents/scanner-agent.ts`

## Dependencies

- Types from `../types.ts`: `ScannerConfig`, `TokenAnalytics`, `BondingCurveState`, `AgentIdentity`
- Event bus, logger, metrics, error handler from `../infra/`
- `@solana/web3.js` for on-chain data

## Deliverables

### Create `packages/pump-agent-swarm/src/agents/scanner-agent.ts`

1. **`ScannerAgent` class** extends EventEmitter:
   - `constructor(config: ScannerConfig, rpcUrl: string, eventBus: SwarmEventBus)`
   - `startScanning(): void` — begins periodic scanning
   - `stopScanning(): void`
   - `scanOnce(): Promise<ScannedToken[]>` — single scan pass
   - `evaluateToken(mint: string): Promise<TokenEvaluation>` — deep evaluation of a specific token
   - `getDiscoveredTokens(): ScannedToken[]` — all discovered tokens
   - `getTargetToken(): ScannedToken | null` — the best candidate found

2. **Scanning sources** (real APIs):

   a. **Pump.fun API** — `https://frontend-api-v3.pump.fun/`:
      - `GET /coins/latest` — newest tokens
      - `GET /coins/featured` — featured/trending
      - `GET /coins/{mint}` — specific token details
      - Parse response for name, symbol, description, market cap, volume
   
   b. **Helius API** — `https://api.helius.xyz/`:
      - `GET /v0/token-metadata?api-key={KEY}` — token metadata
      - `GET /v0/addresses/{address}/transactions` — transaction history
      - Use for holder analysis and transaction patterns
   
   c. **On-chain data** via RPC:
      - Fetch bonding curve state directly
      - Check token supply distribution
      - Verify creator holdings
   
   d. **Jupiter API** — `https://api.jup.ag/`:
      - `GET /price/v2?ids={mint}` — current price
      - Token list for validation

3. **Evaluation criteria** (`TokenEvaluation` type):
   ```typescript
   interface TokenEvaluation {
     mint: string;
     name: string;
     symbol: string;
     score: number; // 0-100 composite score
     criteria: {
       marketCap: { value: number; score: number; reason: string };
       age: { seconds: number; score: number; reason: string };
       holders: { count: number; score: number; reason: string };
       volume: { sol: number; score: number; reason: string };
       devHoldings: { percent: number; score: number; reason: string };
       rugRisk: { score: number; flags: string[] };
       narrative: { category: string; score: number; keywords: string[] };
       momentum: { buyPressure: number; score: number; trend: 'up' | 'down' | 'flat' };
     };
     recommendation: 'strong_buy' | 'buy' | 'watch' | 'avoid';
     reasoning: string;
     evaluatedAt: number;
   }
   ```

4. **Keyword matching** for tech/AI detection:
   - AI keywords: `ai, gpt, claude, llm, neural, ml, deep, transformer, agent`
   - Tech keywords: `tech, dev, code, hack, api, protocol, sdk, chain, web3`
   - Score boost for tokens matching target categories

5. **Rug risk detection**:
   - Top 10 holder concentration > 50% → high risk
   - Creator holding > 20% → elevated risk
   - No social links → elevated risk
   - Very low holder count (<10) with high market cap → suspicious
   - Token age < 60s with high volume → potential snipe target

6. **Event emissions**:
   - `scanner:scanning` — scan started
   - `scanner:token-found` — new token discovered
   - `scanner:token-evaluated` — evaluation complete
   - `scanner:target-selected` — best candidate selected
   - `scanner:no-targets` — scan found nothing viable

7. **Rate limiting**: Respect API rate limits for all external services. Use configurable delays between requests.

### Success Criteria

- Discovers real tokens from Pump.fun API
- Evaluates tokens with multi-criteria scoring
- Correctly identifies tech/AI tokens from keywords
- Rug risk detection catches suspicious patterns
- Scanner runs continuously without memory leaks
- Real API calls with proper error handling
- Compiles with `npx tsc --noEmit`
