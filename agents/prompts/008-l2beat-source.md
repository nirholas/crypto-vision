# Prompt 008 — L2Beat Source Adapter (Layer 2 Analytics)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**, the most comprehensive crypto/DeFi API infrastructure. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** Real implementations only.
2. **TypeScript strict mode** — no `any`, no `@ts-ignore`.
3. **Every async call** needs try/catch, every response needs validation.
4. **Always kill terminals** after commands complete.
5. **Always commit and push** as `nirholas`.
6. **If close to hallucinating** — stop and tell the prompter.
7. **Always improve existing code** you touch.
8. **Run `npx tsc --noEmit` and `npx vitest run`** after changes.

---

## Task

Build the **complete L2Beat source adapter** at `src/sources/l2beat.ts`. L2Beat is the definitive source for Layer 2 TVL, risk assessments, activity metrics, and scaling technology comparisons.

### API Base URL

```
https://l2beat.com/api           # Main API
https://api.l2beat.com           # Alternative base
```

### Requirements

#### 1. Zod Schemas

- `L2Project` — id, name, slug, type (rollup, validium, optimium, etc.), category, provider, stage (Stage 0/1/2), purposes[], tvl, tvlChange, riskView
- `L2RiskView` — stateValidation, dataAvailability, exitWindow, sequencerFailure, proposerFailure (each with value, sentiment, description)
- `L2TVLData` — timestamp, tvl (usd, eth, native), canonical, external, native (breakdown by bridge type)
- `L2ActivityData` — timestamp, transactions, ethereumTransactions, ratio
- `L2CostsData` — timestamp, overhead, calldata, compute, blob
- `L2LivenessData` — last30Days, last90Days averages for stateUpdates, proofSubmissions, batchSubmissions
- `L2MilestonesData` — name, date, description, link
- `L2StageRequirement` — name, description, satisfied (boolean)

#### 2. Exported Functions

**Projects & TVL:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getL2Projects()` | `/scaling/summary` | 300s |
| `getProjectDetail(slug)` | `/scaling/project/{slug}` | 300s |
| `getProjectTVL(slug)` | `/scaling/tvl/{slug}` | 120s |
| `getAggregatedTVL()` | `/scaling/tvl` | 120s |
| `getTVLBreakdown(slug)` | `/scaling/tvl/breakdown/{slug}` | 300s |

**Activity:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getActivity()` | `/scaling/activity` | 120s |
| `getProjectActivity(slug)` | `/scaling/activity/{slug}` | 120s |
| `getActivityComparison()` | Derived: all L2s vs L1 | 300s |

**Costs:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getCosts()` | `/scaling/costs` | 300s |
| `getProjectCosts(slug)` | `/scaling/costs/{slug}` | 300s |

**Risk & Liveness:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getRiskSummary()` | Derived from projects | 300s |
| `getLiveness()` | `/scaling/liveness` | 300s |
| `getProjectLiveness(slug)` | `/scaling/liveness/{slug}` | 300s |
| `getStageAssessment(slug)` | Derived from project detail | 300s |

**Emerging & Bridges:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getBridges()` | `/bridges/summary` | 300s |
| `getBridgeDetail(slug)` | `/bridges/{slug}` | 300s |
| `getBridgeTVL(slug)` | `/bridges/tvl/{slug}` | 120s |
| `getDAProjects()` | `/data-availability/summary` | 300s |

#### 3. Analytics & Comparison Functions

```typescript
export function rankByTVL(projects: L2Project[]): L2Project[]
export function rankByActivity(projects: L2Project[]): L2Project[]
export function compareRiskProfiles(a: L2Project, b: L2Project): { safer: string; reasons: string[] }
export function categorizeByType(projects: L2Project[]): Record<string, L2Project[]>
export function categorizeByStage(projects: L2Project[]): Record<string, L2Project[]>
export function calculateL2Dominance(l2TVL: number, ethTVL: number): number
export function calculateActivityShare(project: L2ActivityData, total: L2ActivityData): number
export function identifyFastestGrowing(projects: L2Project[], period: '7d' | '30d'): L2Project[]
export function assessDecentralization(project: L2Project): {
  score: number;  // 0-100
  factors: { name: string; score: number; description: string }[];
  stage: string;
}
export function estimateCostSavings(l2Costs: L2CostsData, ethGasPrice: number): {
  savingsRatio: number;
  avgL2CostUsd: number;
  equivalentL1CostUsd: number;
}
```

#### 4. Alerting Helpers

```typescript
export function detectTVLAnomalies(history: L2TVLData[]): {
  anomalies: { timestamp: number; tvl: number; expectedTvl: number; deviationPercent: number }[];
  trend: 'growing' | 'declining' | 'stable';
}

export function detectLivenessIssues(liveness: L2LivenessData): {
  healthy: boolean;
  issues: string[];
  lastUpdate: number;
}
```

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] All TVL, activity, costs, and risk functions implemented
- [ ] Risk view parsing handles all L2Beat sentiment values
- [ ] Stage assessment correctly identifies Stage 0/1/2
- [ ] TVL breakdown separates canonical, external, native correctly
- [ ] Activity comparison includes L2 vs L1 ratio
- [ ] `src/routes/l2.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`
- [ ] All terminals killed

### Hallucination Warning

L2Beat's API is not officially documented and may change. The TVL data has three categories: canonical (bridged from L1), external (bridged from other chains), and native (minted on L2). Risk views use sentiments: "good", "warning", "bad", "neutral", "UnderReview". If you're unsure about any endpoint's existence or response shape, tell the prompter — scraping l2beat.com network requests may be needed.
