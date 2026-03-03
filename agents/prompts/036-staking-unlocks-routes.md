# Prompt 036 — Staking & Unlocks Routes

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/staking.ts` and `src/routes/unlocks.ts` — staking yield data and token unlock/vesting schedules.

### Endpoints — Staking

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Staking market overview |
| GET | `/yields` | Staking yields across networks |
| GET | `/yield/:token` | Staking yield for specific token |
| GET | `/validators/:chain` | Validator set for a chain |
| GET | `/calculator` | Staking rewards calculator |
| GET | `/liquid-staking` | Liquid staking protocol comparison |
| GET | `/restaking` | Restaking (EigenLayer) metrics |
| GET | `/history/:token` | Historical staking rate |

### Endpoints — Unlocks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/upcoming` | Upcoming token unlocks |
| GET | `/token/:symbol` | Unlock schedule for token |
| GET | `/calendar` | Calendar view of unlocks |
| GET | `/large` | Large unlocks (>$10M) |
| GET | `/impact/:symbol` | Unlock price impact analysis |
| GET | `/cliff` | Upcoming cliff unlocks |
| GET | `/vesting/:symbol` | Full vesting schedule |

### Staking Rewards Calculator

```typescript
stakingRoutes.get('/calculator', async (c) => {
  const { token, amount, period } = z.object({
    token: z.string(),
    amount: z.coerce.number().positive(),
    period: z.coerce.number().int().min(1).max(3650).default(365),
  }).parse(c.req.query());
  
  const stakingInfo = await staking.getStakingYield(token);
  
  const dailyRate = stakingInfo.apy / 36500;
  const simpleRewards = amount * (stakingInfo.apy / 100) * (period / 365);
  const compoundedValue = amount * Math.pow(1 + dailyRate, period);
  const compoundedRewards = compoundedValue - amount;
  
  return c.json({
    data: {
      token,
      amountStaked: amount,
      periodDays: period,
      apy: stakingInfo.apy,
      simpleRewards,
      compoundedRewards,
      compoundedValue,
      dailyReward: amount * dailyRate,
      monthlyReward: amount * dailyRate * 30,
      yearlyReward: simpleRewards,
      effectiveAPY: ((compoundedValue / amount) - 1) * 100,
      unstakingPeriod: stakingInfo.unbondingDays,
      minimumStake: stakingInfo.minimumStake,
      validatorCommission: stakingInfo.avgValidatorCommission,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Unlock Impact Analysis

```typescript
unlocksRoutes.get('/impact/:symbol', async (c) => {
  const { symbol } = c.req.param();
  
  const [unlockSchedule, tokenData] = await Promise.allSettled([
    unlocks.getTokenUnlocks(symbol),
    cg.getCoinDetail(symbol.toLowerCase()),
  ]);
  
  // Compute:
  // 1. Unlock amount as % of circulating supply
  // 2. Historical price impact of previous unlocks
  // 3. Selling pressure estimate
  // 4. Risk rating
  
  return c.json({
    data: {
      symbol,
      nextUnlock: {
        date: nextUnlockDate,
        amount: unlockAmount,
        valueUsd: unlockValueUsd,
        percentOfCirculating: unlockPercent,
      },
      impactAssessment: {
        sellingPressure: unlockPercent > 5 ? 'extreme' : unlockPercent > 2 ? 'high' : unlockPercent > 0.5 ? 'moderate' : 'low',
        historicalAvgImpact: avgPriceDropAfterUnlock,
        riskRating: riskScore,
        recommendation: recommendation,
      },
      upcomingUnlocks: nextThreeMonths,
      totalLocked: totalLockedAmount,
      totalLockedUsd: totalLockedValue,
      percentVested: percentVested,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Liquid Staking Comparison

```typescript
stakingRoutes.get('/liquid-staking', async (c) => {
  const chain = c.req.query('chain') || 'ethereum';
  
  // Fetch LST protocols from DefiLlama (category: "Liquid Staking")
  const protocols = await llama.getProtocols();
  const lstProtocols = protocols
    .filter(p => p.category === 'Liquid Staking')
    .filter(p => !chain || p.chains.includes(capitalize(chain)))
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));
  
  return c.json({
    data: lstProtocols.map(p => ({
      name: p.name,
      slug: p.slug,
      tvl: p.tvl,
      change24h: p.change_1d,
      change7d: p.change_7d,
      chains: p.chains,
      token: p.symbol,
      apy: null, // would need yields API
      marketShare: (p.tvl / lstProtocols.reduce((s, pp) => s + (pp.tvl ?? 0), 0)) * 100,
    })),
    timestamp: new Date().toISOString(),
  });
});
```

### Acceptance Criteria

- [ ] All 15 endpoints compile and return JSON
- [ ] Staking calculator correctly computes simple and compound rewards
- [ ] Unlock impact analysis estimates selling pressure
- [ ] Liquid staking comparison pulls from DefiLlama
- [ ] Unlock calendar formats dates correctly
- [ ] Large unlock filtering works by USD threshold
- [ ] Tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

Staking APY ≠ APR. APY includes compounding. Ethereum unbonding period is variable (depends on exit queue), not fixed. Cosmos chains typically have 21-day unbonding. Token unlocks data sources vary — some use Token Unlocks API, others aggregate from documentation. If unsure about specific staking parameters or unlock data sources, tell the prompter.
