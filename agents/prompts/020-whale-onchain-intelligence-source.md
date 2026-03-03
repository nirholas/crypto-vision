# Prompt 020 — Whale & On-Chain Intelligence Source

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode.** 3. **Always kill terminals.** 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.**

---

## Task

Build `src/sources/whales.ts` — a whale tracking and on-chain intelligence adapter combining multiple services to monitor large transactions, smart money wallets, and token flows.

### APIs

```
https://api.whale-alert.io/v1           # Whale Alert (Env: WHALE_ALERT_API_KEY)
https://api.arkham.intelligence          # Arkham Intelligence (Env: ARKHAM_API_KEY) [if available]
https://api.etherscan.io/api             # Etherscan (Env: ETHERSCAN_API_KEY)
https://api.blockchair.com               # Blockchair (Env: BLOCKCHAIR_API_KEY)
```

### Zod Schemas

```typescript
const WhaleTransaction = z.object({
  id: z.string(),
  blockchain: z.string(),
  symbol: z.string(),
  hash: z.string(),
  from: z.object({
    address: z.string(),
    owner: z.string().optional(),    // labeled entity name
    ownerType: z.enum(['exchange', 'whale', 'fund', 'defi', 'unknown']).optional(),
  }),
  to: z.object({
    address: z.string(),
    owner: z.string().optional(),
    ownerType: z.enum(['exchange', 'whale', 'fund', 'defi', 'unknown']).optional(),
  }),
  amount: z.number(),
  amountUsd: z.number(),
  timestamp: z.number(),
  transactionType: z.enum([
    'exchange_deposit',
    'exchange_withdrawal',
    'whale_transfer',
    'defi_interaction',
    'bridge_transfer',
    'mint',
    'burn',
    'unknown',
  ]),
})

const WalletProfile = z.object({
  address: z.string(),
  label: z.string().optional(),
  chain: z.string(),
  firstSeen: z.string(),
  lastActive: z.string(),
  totalTransactions: z.number(),
  totalVolumeUsd: z.number(),
  holdings: z.array(z.object({
    token: z.string(),
    symbol: z.string(),
    balance: z.number(),
    valueUsd: z.number(),
  })),
  tags: z.array(z.string()),           // ['whale', 'smart_money', 'mev_bot', 'exchange']
  profitLoss: z.object({
    realized: z.number(),
    unrealized: z.number(),
    winRate: z.number(),
    avgHoldTime: z.number(),            // seconds
  }).optional(),
})

const TokenFlow = z.object({
  token: z.string(),
  symbol: z.string(),
  period: z.string(),
  exchangeInflow: z.number(),
  exchangeOutflow: z.number(),
  netFlow: z.number(),                  // negative = outflow (accumulation)
  largeTransactionCount: z.number(),
  averageTransactionSize: z.number(),
  topReceivers: z.array(z.object({
    address: z.string(),
    label: z.string().optional(),
    amount: z.number(),
  })),
  topSenders: z.array(z.object({
    address: z.string(),
    label: z.string().optional(),
    amount: z.number(),
  })),
})

const ExchangeFlowData = z.object({
  exchange: z.string(),
  token: z.string(),
  inflow24h: z.number(),
  outflow24h: z.number(),
  netFlow24h: z.number(),
  inflow7d: z.number(),
  outflow7d: z.number(),
  netFlow7d: z.number(),
  reserveBalance: z.number().optional(),
  reserveChange24h: z.number().optional(),
})

const SmartMoneyTrade = z.object({
  wallet: z.string(),
  walletLabel: z.string().optional(),
  action: z.enum(['buy', 'sell', 'add_liquidity', 'remove_liquidity', 'stake', 'unstake']),
  token: z.string(),
  amount: z.number(),
  valueUsd: z.number(),
  timestamp: z.number(),
  hash: z.string(),
  protocol: z.string().optional(),
  profitIfSold: z.number().optional(),
})
```

### Exported Functions

| Function | Source | Cache TTL |
|----------|--------|-----------|
| `getRecentWhaleTransactions(opts?)` | Whale Alert `/transactions` | 30s |
| `getWhaleTransactionsByToken(symbol, minUsd?)` | Whale Alert `/transactions` + filter | 30s |
| `getWhaleTransactionsByChain(chain, minUsd?)` | Whale Alert `/transactions` + filter | 30s |
| `getWalletProfile(address, chain)` | Etherscan/Blockchair | 120s |
| `getWalletTransactions(address, chain, limit?)` | Etherscan/Blockchair | 60s |
| `getWalletTokenBalances(address, chain)` | Etherscan `tokentx` | 60s |
| `getTokenFlows(symbol, period)` | Aggregated | 120s |
| `getExchangeFlows(exchange, token?)` | Aggregated | 120s |
| `getSmartMoneyTrades(token?, limit?)` | Aggregated on-chain | 60s |
| `getTopWhaleWallets(chain, limit?)` | Etherscan rich list / Blockchair | 300s |
| `trackWallet(address, chain)` | Add to monitoring set | — |
| `getTrackedWalletActivity()` | Poll tracked wallets | 30s |

### Analytics: Whale Activity Classifier

```typescript
export function classifyWhaleActivity(txs: WhaleTransaction[]): {
  totalVolumeUsd: number;
  transactionCount: number;
  exchangeDeposits: { count: number; volumeUsd: number };     // selling signal
  exchangeWithdrawals: { count: number; volumeUsd: number };  // accumulation signal
  whaleToWhale: { count: number; volumeUsd: number };         // OTC/neutral
  defiInteractions: { count: number; volumeUsd: number };
  burns: { count: number; volumeUsd: number };
  mints: { count: number; volumeUsd: number };
  overallSignal: 'accumulation' | 'distribution' | 'neutral';
  signalStrength: number;    // 0-100
  topTokensByVolume: { symbol: string; volume: number; txCount: number }[];
}
```

### Analytics: Exchange Reserve Analysis

```typescript
export function analyzeExchangeReserves(flows: ExchangeFlowData[]): {
  totalReserves: number;
  reserveChange24h: number;
  reserveChange7d: number;
  trend: 'accumulating' | 'distributing' | 'stable';
  exchangeBreakdown: {
    exchange: string;
    reserve: number;
    netFlow24h: number;
    percentChange: number;
  }[];
  supplyOnExchanges: number;      // percentage
  riskLevel: 'low' | 'medium' | 'high';  // high = lots on exchanges
}
```

### Analytics: Smart Money Tracker

```typescript
export function analyzeSmartMoney(trades: SmartMoneyTrade[]): {
  consensusBuys: { token: string; walletCount: number; totalUsd: number }[];
  consensusSells: { token: string; walletCount: number; totalUsd: number }[];
  topPerformingWallets: { wallet: string; label?: string; roi: number; winRate: number }[];
  newPositions: SmartMoneyTrade[];     // tokens bought by 3+ smart wallets recently
  exitingPositions: SmartMoneyTrade[]; // tokens sold by 3+ smart wallets recently
  defiTrends: {
    protocol: string;
    action: string;
    walletCount: number;
    totalUsd: number;
  }[];
}
```

### Analytics: Alert Generation

```typescript
export function generateWhaleAlerts(txs: WhaleTransaction[]): {
  type: 'large_transfer' | 'exchange_deposit' | 'exchange_withdrawal' | 'unusual_activity' | 'dormant_wallet_active';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  transaction: WhaleTransaction;
  context: string;           // human-readable explanation
  marketImpact: 'bullish' | 'bearish' | 'neutral';
}[]
```

### Wallet Label Database (in-memory)

```typescript
const KNOWN_WALLETS: Record<string, { label: string; type: string }> = {
  // Major exchange hot wallets — populate from Etherscan labels
  '0x...': { label: 'Binance Hot Wallet', type: 'exchange' },
  // etc.
}

export function labelAddress(address: string): { label?: string; type: string }
```

### Important Gotchas

1. **Whale Alert free tier** — 10 requests/min, 100 results per call, 5-minute delay on data.
2. **Etherscan rate limits** — 5 calls/sec on free tier. Use queue-based rate limiting.
3. **Address checksums** — Always normalize addresses to lowercase for comparisons.
4. **Cross-chain addresses** — Same address on EVM chains can be different entities.
5. **Labeling accuracy** — Not all addresses are labeled. Return "unknown" instead of guessing.
6. **USD values** — Use CoinGecko/CoinMarketCap prices at time of transaction, not current price.

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] Whale Alert integration returns real transaction data
- [ ] Wallet profiling works for Ethereum addresses via Etherscan
- [ ] Token flow analysis correctly classifies inflow/outflow patterns
- [ ] Smart money tracking identifies consensus positions
- [ ] Alert generation produces actionable, severity-rated alerts
- [ ] Rate limiting prevents API throttling
- [ ] Existing `src/routes/onchain.ts` can use these exports
- [ ] Committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

Whale Alert's free tier has a 5-minute delay. The `/transactions` endpoint requires `start` timestamp parameter (Unix) and `min_value` for filtering. Response format: `{ result: "success", cursor: "...", transactions: [...] }`. If you are unsure about Arkham Intelligence API availability or schema, tell the prompter.
