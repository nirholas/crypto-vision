# Prompt 034 — Solana Routes (Solana-Specific Data)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode** — no `any`. 3. **Always kill terminals** after every command. 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.** 7. **Improve any existing code you touch.**

---

## Task

Build / improve `src/routes/solana.ts` — Solana ecosystem data including Jupiter DEX, token metrics, validator stats, and program analytics.

### Source Imports

```typescript
import { Hono } from 'hono';
import * as jupiter from '../sources/jupiter.js';
import * as cg from '../sources/coingecko.js';
import { ApiError } from '../lib/api-error.js';

export const solanaRoutes = new Hono();
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Solana ecosystem overview |
| GET | `/tokens` | Top Solana tokens by market cap |
| GET | `/token/:mint` | Token detail by mint address |
| GET | `/quote` | Jupiter swap quote |
| GET | `/routes/:inputMint/:outputMint` | Best swap routes |
| GET | `/price/:mint` | Token price via Jupiter |
| GET | `/prices` | Batch token prices |
| GET | `/dex/pools` | Top Solana DEX pools |
| GET | `/dex/volume` | Solana DEX volume stats |
| GET | `/validators` | Validator rankings |
| GET | `/tps` | Current TPS (transactions per second) |
| GET | `/supply` | SOL supply breakdown |
| GET | `/staking` | Staking statistics |
| GET | `/programs/top` | Top Solana programs by usage |
| GET | `/nft/collections` | Top Solana NFT collections |
| GET | `/new-tokens` | Recently created SPL tokens |
| GET | `/memecoins` | Trending memecoins on Solana |

### Solana Overview

```typescript
solanaRoutes.get('/overview', async (c) => {
  const [solPrice, jupTokens, tps, validators] = await Promise.allSettled([
    cg.getCoinDetail('solana'),
    jupiter.getTokenList(),
    getSolanaClusterStats(),
    getSolanaValidators(),
  ]);
  
  return c.json({
    data: {
      price: solPrice.status === 'fulfilled' ? {
        usd: solPrice.value.market_data.current_price.usd,
        change24h: solPrice.value.market_data.price_change_percentage_24h,
        marketCap: solPrice.value.market_data.market_cap.usd,
        volume24h: solPrice.value.market_data.total_volume.usd,
      } : null,
      network: {
        tps: tps.status === 'fulfilled' ? tps.value : null,
        validatorCount: validators.status === 'fulfilled' ? validators.value.length : null,
        totalStaked: validators.status === 'fulfilled' 
          ? validators.value.reduce((sum, v) => sum + v.activatedStake, 0) / 1e9 
          : null,
      },
      ecosystem: {
        registeredTokens: jupTokens.status === 'fulfilled' ? jupTokens.value.length : null,
      },
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Jupiter Swap Quote

```typescript
solanaRoutes.get('/quote', async (c) => {
  const inputMint = c.req.query('input_mint');
  const outputMint = c.req.query('output_mint');
  const amount = c.req.query('amount');      // in smallest unit (lamports for SOL)
  const slippage = Number(c.req.query('slippage') || 50);  // basis points
  const dexes = c.req.query('dexes');        // optional: filter to specific DEXs
  
  if (!inputMint || !outputMint || !amount) {
    throw new ApiError(400, 'input_mint, output_mint, and amount are required');
  }
  
  const quote = await jupiter.getQuote({
    inputMint,
    outputMint,
    amount: BigInt(amount),
    slippageBps: slippage,
    ...(dexes ? { dexes: dexes.split(',') } : {}),
  });
  
  return c.json({
    data: {
      inputMint,
      outputMint,
      inputAmount: quote.inAmount.toString(),
      outputAmount: quote.outAmount.toString(),
      otherAmountThreshold: quote.otherAmountThreshold.toString(),
      priceImpactPct: quote.priceImpactPct,
      routePlan: quote.routePlan.map(step => ({
        ammKey: step.swapInfo.ammKey,
        label: step.swapInfo.label,
        inputMint: step.swapInfo.inputMint,
        outputMint: step.swapInfo.outputMint,
        inAmount: step.swapInfo.inAmount,
        outAmount: step.swapInfo.outAmount,
        feeAmount: step.swapInfo.feeAmount,
        feeMint: step.swapInfo.feeMint,
      })),
      slippageBps: slippage,
    },
    timestamp: new Date().toISOString(),
  });
});
```

### Trending Memecoins

```typescript
solanaRoutes.get('/memecoins', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') || 20), 50);
  
  // Get tokens tagged as memecoins from Jupiter's verified list
  const tokens = await jupiter.getTokenList();
  const memecoins = tokens.filter(t => 
    t.tags?.includes('meme') || t.tags?.includes('pump')
  );
  
  // Get prices for all memecoins
  const mints = memecoins.map(t => t.address);
  const prices = await jupiter.getTokenPrices(mints.slice(0, 100));
  
  const withPrices = memecoins
    .map(token => ({
      name: token.name,
      symbol: token.symbol,
      mint: token.address,
      decimals: token.decimals,
      logo: token.logoURI,
      price: prices[token.address]?.price ?? null,
      volume24h: prices[token.address]?.volume24h ?? null,
      tags: token.tags,
    }))
    .filter(t => t.price !== null)
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
    .slice(0, limit);
  
  return c.json({ data: withPrices, timestamp: new Date().toISOString() });
});
```

### Acceptance Criteria

- [ ] All 17 endpoints compile and return JSON
- [ ] Jupiter quote integration returns full route details
- [ ] Batch price lookups efficient (single API call for multiple tokens)
- [ ] Memecoin filtering uses Jupiter token tags
- [ ] Validator and staking stats computed correctly
- [ ] SOL amounts properly divided by 1e9 (9 decimals)
- [ ] Tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

SOL has 9 decimals (1 SOL = 1,000,000,000 lamports). Jupiter API v6 base URL is `https://quote-api.jup.ag/v6`. Jupiter token list is at `https://token.jup.ag/strict` (verified) or `https://token.jup.ag/all`. The `/quote` endpoint takes `inputMint`, `outputMint`, `amount` (in smallest unit), and `slippageBps`. If unsure about Jupiter API specifics, tell the prompter.
