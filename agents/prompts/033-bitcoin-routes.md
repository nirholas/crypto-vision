# Prompt 033 — Bitcoin Routes (Bitcoin-Specific Analytics)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/bitcoin.ts` — Bitcoin-specific blockchain analytics, mining data, Lightning Network stats, and on-chain metrics.

### Source Imports

```typescript
import { Hono } from 'hono';
import * as bitcoin from '../sources/bitcoin.js';
import * as blockchain from '../sources/blockchain.js';
import * as cg from '../sources/coingecko.js';
import { ApiError } from '../lib/api-error.js';

export const bitcoinRoutes = new Hono();
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Bitcoin market + on-chain overview |
| GET | `/price` | BTC price from multiple sources |
| GET | `/metrics` | On-chain metrics (active addresses, hash rate, etc.) |
| GET | `/mining` | Mining statistics (difficulty, hash rate, revenue) |
| GET | `/mempool` | Mempool stats (tx count, size, fee estimates) |
| GET | `/fees` | Fee estimates by priority |
| GET | `/address/:address` | Bitcoin address balance and history |
| GET | `/tx/:txid` | Transaction detail |
| GET | `/block/:height` | Block detail |
| GET | `/blocks/latest` | Latest blocks |
| GET | `/halving` | Next halving countdown |
| GET | `/supply` | Supply breakdown (mined, lost, held) |
| GET | `/utxo-stats` | UTXO set statistics |
| GET | `/lightning` | Lightning Network statistics |
| GET | `/dominance` | BTC dominance chart |
| GET | `/stock-to-flow` | Stock-to-flow model data |
| GET | `/rainbow` | Rainbow chart price bands |
| GET | `/hodl-waves` | HODL waves (UTXO age distribution) |
| GET | `/exchange-balance` | BTC on exchanges over time |
| GET | `/whale-holdings` | Top BTC holder analysis |

### Bitcoin Overview

```typescript
bitcoinRoutes.get('/overview', async (c) => {
  const [price, metrics, mining, mempool, global] = await Promise.allSettled([
    cg.getCoinDetail('bitcoin'),
    bitcoin.getOnChainMetrics(),
    bitcoin.getMiningStats(),
    bitcoin.getMempoolStats(),
    cg.getGlobalData(),
  ]);
  
  return c.json({
    data: {
      price: {
        usd: price.status === 'fulfilled' ? price.value.market_data.current_price.usd : null,
        change24h: price.status === 'fulfilled' ? price.value.market_data.price_change_percentage_24h : null,
        change7d: price.status === 'fulfilled' ? price.value.market_data.price_change_percentage_7d : null,
        change30d: price.status === 'fulfilled' ? price.value.market_data.price_change_percentage_30d : null,
        ath: price.status === 'fulfilled' ? price.value.market_data.ath.usd : null,
        athDate: price.status === 'fulfilled' ? price.value.market_data.ath_date.usd : null,
        marketCap: price.status === 'fulfilled' ? price.value.market_data.market_cap.usd : null,
      },
      onchain: metrics.status === 'fulfilled' ? {
        activeAddresses24h: metrics.value.activeAddresses,
        transactionCount24h: metrics.value.transactionCount,
        avgTransactionValue: metrics.value.avgTransactionValue,
        totalTransferVolume: metrics.value.totalTransferVolume,
      } : null,
      mining: mining.status === 'fulfilled' ? {
        hashRate: mining.value.hashRate,
        difficulty: mining.value.difficulty,
        blockReward: mining.value.blockReward,
        blocksToday: mining.value.blocksMinedToday,
        minerRevenue24h: mining.value.minerRevenue24h,
        nextDifficultyAdjustment: mining.value.nextDifficultyAdjustment,
      } : null,
      mempool: mempool.status === 'fulfilled' ? {
        txCount: mempool.value.txCount,
        totalSizeBytes: mempool.value.totalSize,
        totalFeesBtc: mempool.value.totalFees,
        fastFee: mempool.value.fastestFee,
        mediumFee: mempool.value.halfHourFee,
        slowFee: mempool.value.hourFee,
      } : null,
      dominance: global.status === 'fulfilled' ? global.value.data.market_cap_percentage.btc : null,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Halving Countdown

```typescript
bitcoinRoutes.get('/halving', async (c) => {
  const currentHeight = await bitcoin.getCurrentBlockHeight();
  const HALVING_INTERVAL = 210000;
  const nextHalvingHeight = Math.ceil(currentHeight / HALVING_INTERVAL) * HALVING_INTERVAL;
  const blocksRemaining = nextHalvingHeight - currentHeight;
  const avgBlockTime = 600; // 10 minutes in seconds
  const estimatedSeconds = blocksRemaining * avgBlockTime;
  const estimatedDate = new Date(Date.now() + estimatedSeconds * 1000);
  
  const halvingNumber = nextHalvingHeight / HALVING_INTERVAL;
  const currentReward = 50 / Math.pow(2, halvingNumber - 1);
  const nextReward = currentReward / 2;
  
  return c.json({
    data: {
      currentBlockHeight: currentHeight,
      nextHalvingBlock: nextHalvingHeight,
      blocksRemaining,
      estimatedDate: estimatedDate.toISOString(),
      daysRemaining: Math.floor(estimatedSeconds / 86400),
      halvingNumber,
      currentBlockReward: currentReward,
      nextBlockReward: nextReward,
      percentComplete: ((HALVING_INTERVAL - blocksRemaining) / HALVING_INTERVAL) * 100,
      previousHalvings: [
        { block: 210000, date: '2012-11-28', reward: '25 BTC' },
        { block: 420000, date: '2016-07-09', reward: '12.5 BTC' },
        { block: 630000, date: '2020-05-11', reward: '6.25 BTC' },
        { block: 840000, date: '2024-04-20', reward: '3.125 BTC' },
      ],
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Stock-to-Flow Model

```typescript
bitcoinRoutes.get('/stock-to-flow', async (c) => {
  const currentHeight = await bitcoin.getCurrentBlockHeight();
  const halvingNumber = Math.floor(currentHeight / 210000);
  const currentReward = 50 / Math.pow(2, halvingNumber);
  const blocksPerYear = 52560; // 365.25 * 144
  
  const annualProduction = currentReward * blocksPerYear;
  const totalMined = computeTotalMined(currentHeight);
  const stockToFlowRatio = totalMined / annualProduction;
  
  // S2F model price = e^(a * ln(SF) + b)
  // Using PlanB's original model coefficients
  const modelPrice = Math.exp(3.21956 * Math.log(stockToFlowRatio) + 14.6227);
  
  return c.json({
    data: {
      stockToFlowRatio,
      modelPrice,
      currentRewardBtc: currentReward,
      annualProduction,
      totalMined,
      percentMined: (totalMined / 21000000) * 100,
      note: 'Stock-to-Flow is a model, not a prediction. Use with caution.',
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Acceptance Criteria

- [ ] All 20 endpoints compile and return JSON
- [ ] BTC overview aggregates price, on-chain, mining, mempool data
- [ ] Halving countdown computes correct block and date
- [ ] Mining stats include hash rate, difficulty, revenue
- [ ] Mempool stats include fee estimates
- [ ] Stock-to-flow model computes ratio and model price
- [ ] Address and transaction lookups work
- [ ] Tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

Bitcoin halving block heights are multiples of 210,000. The 4th halving was at block 840,000 on April 20, 2024, reducing the reward to 3.125 BTC. Current total supply is ~19.7M BTC. The maximum supply is 21,000,000 BTC (not 21M). Average block time is ~10 minutes (600 seconds), not exactly 10. If unsure about Bitcoin blockchain specifics, tell the prompter.
