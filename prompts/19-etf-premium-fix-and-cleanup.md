# Prompt 19: ETF Premium Calculation Fix & Bot Ecosystem Schema

## Agent Identity & Rules

```
You are fixing two smaller issues: a placeholder calculation in the ETF data source and an empty schema file.
- Always work on the current branch
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- No mocks, no stubs, no placeholders — every function must do real work
- TypeScript strict mode — no `any` types, no `@ts-ignore`
```

## Objective

Fix two issues:

1. **`src/sources/etf.ts` → `getETFPremiums()`** — Has a placeholder daily return comparison that doesn't actually work
2. **`src/bot/db/ecosystem-schema.ts`** — Totally empty file (0 bytes), either implement or remove

## Context

### Issue 1: ETF Premium Calculation

In `src/sources/etf.ts` (line ~232), the `getETFPremiums()` function has this broken code:

```typescript
const mapPremiums = (etfs: ETFQuote[], spot: number | null) =>
  etfs.map((e) => {
    const etfReturn = e.price && e.previousClose ? (e.price - e.previousClose) / e.previousClose : null;
    const spotReturn = spot && btcPrice ? 0 : null; // Placeholder — daily return comparison  ← BUG
    return {
      symbol: e.symbol,
      name: e.name,
      price: e.price,
      spot,
      premiumPct: e.changePercent, // Use daily change as proxy  ← NOT REAL PREMIUM
    };
  });
```

Problems:
1. `spotReturn` is always `0` or `null` — it never computes the actual spot return
2. `etfReturn` is calculated but never used
3. `premiumPct` just returns the ETF's own daily change, not the premium/discount vs spot
4. The `mapPremiums` function is called for both BTC and ETH ETFs, but inside uses `btcPrice` for both (bug — ETH ETFs should use `ethPrice`)

**What premium/discount means:** If the ETF is trading at a higher price relative to its NAV (underlying asset), it's at a premium. If lower, a discount. Since NAV isn't freely available, tracking error (ETF daily return vs spot daily return) is a good proxy.

### Issue 2: Empty ecosystem-schema.ts

`src/bot/db/ecosystem-schema.ts` is 0 bytes. It's not imported anywhere in the codebase (verified by grep). Two options:
- **Option A:** Remove it (if it was created by mistake)
- **Option B:** Implement it (if the bot needs ecosystem-specific tables)

The bot's main schema is in `src/bot/db/schema.ts` (471 lines) which covers users, groups, calls, leaderboards, PnL, referrals, premium subscriptions, insider alerts, etc.

An "ecosystem schema" might cover: token ecosystem data, project metadata, project health scores, ecosystem comparisons, etc. But since nothing references it, removal is safest.

## Deliverables

### 1. Fix `getETFPremiums()` in `src/sources/etf.ts`

Replace the broken implementation with a proper premium/discount calculation:

```typescript
export async function getETFPremiums(): Promise<{
  btc: Array<{ symbol: string; name: string; price: number | null; spot: number | null; premiumPct: number | null; trackingError: number | null }>;
  eth: Array<{ symbol: string; name: string; price: number | null; spot: number | null; premiumPct: number | null; trackingError: number | null }>;
}> {
  return cache.wrap("etf:premiums", 120, async () => {
    const [btcETFs, ethETFs, btcSpot, ethSpot] = await Promise.all([
      getBTCETFs(),
      getETHETFs(),
      fetchQuote("BTC-USD", "1d", "1d"),
      fetchQuote("ETH-USD", "1d", "1d"),
    ]);

    const btcPrice = btcSpot?.meta.regularMarketPrice ?? null;
    const ethPrice = ethSpot?.meta.regularMarketPrice ?? null;
    const btcPrevClose = btcSpot?.meta.previousClose ?? null;
    const ethPrevClose = ethSpot?.meta.previousClose ?? null;

    const mapPremiums = (
      etfs: ETFQuote[], 
      spotPrice: number | null, 
      spotPrevClose: number | null
    ) =>
      etfs.map((e) => {
        // Calculate daily returns
        const etfReturn = e.price && e.previousClose 
          ? (e.price - e.previousClose) / e.previousClose 
          : null;
        const spotReturn = spotPrice && spotPrevClose 
          ? (spotPrice - spotPrevClose) / spotPrevClose 
          : null;
        
        // Tracking error = ETF return - Spot return
        // Positive = ETF outperformed spot (premium expanding or premium)
        // Negative = ETF underperformed spot (discount expanding or discount)
        const trackingError = etfReturn !== null && spotReturn !== null
          ? +((etfReturn - spotReturn) * 100).toFixed(4)
          : null;
        
        // Premium/discount estimate
        // For spot ETFs, price/share != BTC price (different units), 
        // so we use tracking error as the premium proxy
        const premiumPct = trackingError;

        return {
          symbol: e.symbol,
          name: e.name,
          price: e.price,
          spot: spotPrice,
          premiumPct,
          trackingError,
        };
      });

    return {
      btc: mapPremiums(btcETFs, btcPrice, btcPrevClose),
      eth: mapPremiums(ethETFs, ethPrice, ethPrevClose),  // Uses ethPrice, not btcPrice
    };
  });
}
```

Key fixes:
- Pass `spotPrevClose` separately so daily spot return can be calculated
- Fix the ETH path to use `ethPrice`/`ethPrevClose` (not `btcPrice`)
- Actually compute `spotReturn` and `trackingError`
- Add `trackingError` to the return type
- Remove the `// Placeholder` comment

### 2. Handle the empty ecosystem-schema.ts

Delete `src/bot/db/ecosystem-schema.ts` since it's empty and unreferenced:

```bash
rm src/bot/db/ecosystem-schema.ts
```

Verify no imports reference it:
```bash
grep -rn "ecosystem-schema\|ecosystem.schema\|ecosystemSchema" src/
```

If any imports are found (unlikely based on previous search), update them too.

### 3. Update the route that serves premium data (if applicable)

Check if there's a route that calls `getETFPremiums()` and update its response type to include the new `trackingError` field:

```bash
grep -rn "getETFPremiums\|etf.*premium" src/routes/
```

If found, update the route handler's response to include `trackingError` in the documentation/comments.

### 4. Add a test for the premium calculation

Create or update `src/sources/__tests__/etf.test.ts` to test the premium calculation logic:

```typescript
describe("getETFPremiums", () => {
  it("calculates tracking error correctly", async () => {
    // Mock fetchQuote to return known prices
    // BTC ETF: prev=50, current=51 (2% return)
    // BTC spot: prev=60000, current=61800 (3% return)
    // Expected tracking error: 2% - 3% = -1% (ETF underperformed)
    
    const result = await getETFPremiums();
    // Assert trackingError is approximately -1
  });
  
  it("handles missing spot data gracefully", async () => {
    // Mock fetchQuote to return null for spot
    const result = await getETFPremiums();
    // Assert premiumPct and trackingError are null
  });
  
  it("uses ethPrice for ETH ETFs not btcPrice", async () => {
    // Verify ETH ETFs use ETH spot, not BTC spot
  });
});
```

## Constraints

- Don't change the return type signature in a breaking way — add `trackingError` as a new field, keep `premiumPct`
- The fix must handle null values gracefully (spot data may not be available outside market hours)
- Cache TTL stays at 120 seconds

## Verification

1. `grep -n "Placeholder" src/sources/etf.ts` → zero matches (case-insensitive)
2. `grep -n "spotReturn.*=.*0" src/sources/etf.ts` → zero matches (no more hardcoded 0)
3. `ls src/bot/db/ecosystem-schema.ts` → file should not exist
4. `grep -rn "ecosystem-schema" src/` → zero matches
5. TypeScript compiles without errors
