# Swap & DEX Tools

Tools for token swaps, liquidity provision, and DEX aggregation across multiple decentralized exchanges.

---

## swap_get_quote

Get a swap quote from DEX aggregators (1inch, 0x, ParaSwap).

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `tokenIn` | string | Yes | - | Input token address or symbol |
| `tokenOut` | string | Yes | - | Output token address or symbol |
| `amountIn` | string | Yes | - | Amount to swap (human-readable) |
| `slippage` | number | No | `0.5` | Max slippage percentage |

### Response Schema

```typescript
{
  tokenIn: {
    address: string;
    symbol: string;
    decimals: number;
    amount: string;
    amountUSD: string;
  };
  tokenOut: {
    address: string;
    symbol: string;
    decimals: number;
    amount: string;
    amountUSD: string;
  };
  rate: string;                // Exchange rate
  priceImpact: string;         // Price impact percentage
  route: Array<{
    protocol: string;
    percent: number;
    path: string[];
  }>;
  gas: {
    estimated: number;
    priceGwei: string;
    costUSD: string;
  };
  aggregator: string;
}
```

### Example Usage

```typescript
// Get quote for swapping 1 ETH to USDC
const result = await client.callTool('swap_get_quote', {
  network: 'ethereum',
  tokenIn: 'ETH',
  tokenOut: 'USDC',
  amountIn: '1.0',
  slippage: 0.5
});

// Response
{
  "tokenIn": {
    "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "symbol": "ETH",
    "decimals": 18,
    "amount": "1.0",
    "amountUSD": "2450.00"
  },
  "tokenOut": {
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "symbol": "USDC",
    "decimals": 6,
    "amount": "2442.50",
    "amountUSD": "2442.50"
  },
  "rate": "2442.50",
  "priceImpact": "0.31%",
  "route": [
    {
      "protocol": "Uniswap V3",
      "percent": 70,
      "path": ["ETH", "USDC"]
    },
    {
      "protocol": "Curve",
      "percent": 30,
      "path": ["ETH", "stETH", "USDC"]
    }
  ],
  "gas": {
    "estimated": 180000,
    "priceGwei": "25",
    "costUSD": "11.25"
  },
  "aggregator": "1inch"
}
```

### Related Tools

- [swap_execute](#swap_execute)
- [swap_get_best_route](#swap_get_best_route)
- [swap_get_price_impact](#swap_get_price_impact)

---

## swap_execute

Execute a token swap through DEX.

!!! warning "Requires Private Key"
    This tool requires `PRIVATE_KEY` environment variable to be set.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `tokenIn` | string | Yes | - | Input token address |
| `tokenOut` | string | Yes | - | Output token address |
| `amountIn` | string | Yes | - | Amount to swap |
| `amountOutMin` | string | No | - | Minimum output (auto-calculated if not set) |
| `slippage` | number | No | `0.5` | Max slippage percentage |
| `deadline` | number | No | `1200` | Transaction deadline in seconds |
| `privateKey` | string | No | env | Override wallet private key |

### Response Schema

```typescript
{
  success: boolean;
  transactionHash: string;
  tokenIn: {
    address: string;
    symbol: string;
    amount: string;
  };
  tokenOut: {
    address: string;
    symbol: string;
    amount: string;
  };
  gasUsed: number;
  effectiveGasPrice: string;
  blockNumber: number;
}
```

### Example Usage

```typescript
const result = await client.callTool('swap_execute', {
  network: 'arbitrum',
  tokenIn: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC
  tokenOut: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  amountIn: '1000',
  slippage: 1.0
});

// Response
{
  "success": true,
  "transactionHash": "0x1234567890abcdef...",
  "tokenIn": {
    "address": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    "symbol": "USDC",
    "amount": "1000"
  },
  "tokenOut": {
    "address": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    "symbol": "WETH",
    "amount": "0.408"
  },
  "gasUsed": 185432,
  "effectiveGasPrice": "0.1",
  "blockNumber": 175234567
}
```

---

## swap_get_best_route

Find the best swap route across multiple DEXs.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `tokenIn` | string | Yes | - | Input token address |
| `tokenOut` | string | Yes | - | Output token address |
| `amountIn` | string | Yes | - | Amount to swap |
| `includeGas` | boolean | No | `true` | Factor in gas costs |

### Response Schema

```typescript
{
  bestRoute: {
    aggregator: string;
    amountOut: string;
    amountOutUSD: string;
    priceImpact: string;
    gasCostUSD: string;
    netValueUSD: string;
    route: Array<{
      protocol: string;
      percent: number;
      path: string[];
    }>;
  };
  alternatives: Array<{
    aggregator: string;
    amountOut: string;
    amountOutUSD: string;
    priceImpact: string;
    gasCostUSD: string;
    netValueUSD: string;
  }>;
  comparison: {
    bestVsWorst: string;      // Percentage difference
    savingsUSD: string;
  };
}
```

### Example Usage

```typescript
const result = await client.callTool('swap_get_best_route', {
  network: 'ethereum',
  tokenIn: 'WETH',
  tokenOut: 'USDT',
  amountIn: '10'
});

// Response
{
  "bestRoute": {
    "aggregator": "1inch",
    "amountOut": "24420.50",
    "amountOutUSD": "24420.50",
    "priceImpact": "0.12%",
    "gasCostUSD": "15.30",
    "netValueUSD": "24405.20",
    "route": [
      {
        "protocol": "Uniswap V3",
        "percent": 60,
        "path": ["WETH", "USDT"]
      },
      {
        "protocol": "Curve",
        "percent": 40,
        "path": ["WETH", "USDC", "USDT"]
      }
    ]
  },
  "alternatives": [
    {
      "aggregator": "0x",
      "amountOut": "24410.20",
      "amountOutUSD": "24410.20",
      "priceImpact": "0.15%",
      "gasCostUSD": "12.50",
      "netValueUSD": "24397.70"
    },
    {
      "aggregator": "ParaSwap",
      "amountOut": "24405.00",
      "amountOutUSD": "24405.00",
      "priceImpact": "0.18%",
      "gasCostUSD": "14.00",
      "netValueUSD": "24391.00"
    }
  ],
  "comparison": {
    "bestVsWorst": "0.06%",
    "savingsUSD": "14.20"
  }
}
```

---

## swap_get_price_impact

Calculate price impact for a swap.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `tokenIn` | string | Yes | - | Input token address |
| `tokenOut` | string | Yes | - | Output token address |
| `amountIn` | string | Yes | - | Amount to swap |

### Response Schema

```typescript
{
  priceImpact: string;         // Percentage
  severity: 'low' | 'medium' | 'high' | 'very_high';
  spotPrice: string;
  executionPrice: string;
  warning?: string;
}
```

### Example Usage

```typescript
const result = await client.callTool('swap_get_price_impact', {
  network: 'ethereum',
  tokenIn: 'ETH',
  tokenOut: '0x1234...', // Small cap token
  amountIn: '100'
});

// Response
{
  "priceImpact": "15.42%",
  "severity": "very_high",
  "spotPrice": "0.00001234",
  "executionPrice": "0.00001044",
  "warning": "High price impact! Consider splitting into smaller trades."
}
```

---

## swap_add_liquidity

Add liquidity to a DEX pool.

!!! warning "Requires Private Key"
    This tool requires `PRIVATE_KEY` environment variable to be set.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `dex` | string | No | `uniswap` | DEX protocol |
| `tokenA` | string | Yes | - | First token address |
| `tokenB` | string | Yes | - | Second token address |
| `amountA` | string | Yes | - | Amount of token A |
| `amountB` | string | No | - | Amount of token B (calculated if not provided) |
| `slippage` | number | No | `0.5` | Max slippage percentage |
| `privateKey` | string | No | env | Override wallet private key |

### Response Schema

```typescript
{
  success: boolean;
  transactionHash: string;
  lpTokensReceived: string;
  lpTokenAddress: string;
  tokenA: {
    address: string;
    symbol: string;
    amountDeposited: string;
  };
  tokenB: {
    address: string;
    symbol: string;
    amountDeposited: string;
  };
  poolShare: string;           // Percentage of pool
  gasUsed: number;
}
```

### Example Usage

```typescript
const result = await client.callTool('swap_add_liquidity', {
  network: 'arbitrum',
  dex: 'camelot',
  tokenA: 'WETH',
  tokenB: 'USDC',
  amountA: '1.0',
  slippage: 1.0
});

// Response
{
  "success": true,
  "transactionHash": "0xabcdef...",
  "lpTokensReceived": "1234.567890",
  "lpTokenAddress": "0x84652bb2539513BAf36e225c930Fdd8eaa63CE27",
  "tokenA": {
    "address": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    "symbol": "WETH",
    "amountDeposited": "1.0"
  },
  "tokenB": {
    "address": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    "symbol": "USDC",
    "amountDeposited": "2450.00"
  },
  "poolShare": "0.0234%",
  "gasUsed": 245000
}
```

---

## swap_remove_liquidity

Remove liquidity from a DEX pool.

!!! warning "Requires Private Key"
    This tool requires `PRIVATE_KEY` environment variable to be set.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `dex` | string | No | `uniswap` | DEX protocol |
| `lpToken` | string | Yes | - | LP token address |
| `amount` | string | Yes | - | Amount of LP tokens |
| `slippage` | number | No | `0.5` | Max slippage percentage |
| `privateKey` | string | No | env | Override wallet private key |

### Response Schema

```typescript
{
  success: boolean;
  transactionHash: string;
  lpTokensBurned: string;
  tokenA: {
    address: string;
    symbol: string;
    amountReceived: string;
  };
  tokenB: {
    address: string;
    symbol: string;
    amountReceived: string;
  };
  gasUsed: number;
}
```

---

## swap_get_pool_info

Get information about a liquidity pool.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `dex` | string | No | `uniswap` | DEX protocol |
| `tokenA` | string | Yes | - | First token address |
| `tokenB` | string | Yes | - | Second token address |

### Response Schema

```typescript
{
  poolAddress: string;
  dex: string;
  tokenA: {
    address: string;
    symbol: string;
    reserve: string;
    reserveUSD: string;
  };
  tokenB: {
    address: string;
    symbol: string;
    reserve: string;
    reserveUSD: string;
  };
  totalLiquidity: string;
  totalLiquidityUSD: string;
  price: string;               // tokenA per tokenB
  volume24h: string;
  fees24h: string;
  apy: string;
}
```

### Example Usage

```typescript
const result = await client.callTool('swap_get_pool_info', {
  network: 'ethereum',
  dex: 'uniswap',
  tokenA: 'WETH',
  tokenB: 'USDC'
});

// Response
{
  "poolAddress": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
  "dex": "Uniswap V3",
  "tokenA": {
    "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "symbol": "WETH",
    "reserve": "45234.56",
    "reserveUSD": "110,823,872.00"
  },
  "tokenB": {
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "symbol": "USDC",
    "reserve": "108,234,567.89",
    "reserveUSD": "108,234,567.89"
  },
  "totalLiquidity": "219,058,439.89",
  "totalLiquidityUSD": "219,058,439.89",
  "price": "2450.00",
  "volume24h": "45,678,901.23",
  "fees24h": "136,936.70",
  "apy": "22.84%"
}
```

---

## swap_calculate_arbitrage

Calculate potential arbitrage opportunities across DEXs.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `network` | string | No | `ethereum` | Target network |
| `tokenA` | string | Yes | - | First token address |
| `tokenB` | string | Yes | - | Second token address |
| `amount` | string | Yes | - | Trade amount |

### Response Schema

```typescript
{
  hasOpportunity: boolean;
  profitUSD: string;
  profitPercent: string;
  route: {
    buy: {
      dex: string;
      price: string;
    };
    sell: {
      dex: string;
      price: string;
    };
  };
  gasCostUSD: string;
  netProfitUSD: string;
  warning?: string;
}
```

### Example Usage

```typescript
const result = await client.callTool('swap_calculate_arbitrage', {
  network: 'bsc',
  tokenA: 'WBNB',
  tokenB: 'BUSD',
  amount: '100'
});

// Response
{
  "hasOpportunity": true,
  "profitUSD": "12.50",
  "profitPercent": "0.04%",
  "route": {
    "buy": {
      "dex": "PancakeSwap",
      "price": "315.20"
    },
    "sell": {
      "dex": "Biswap",
      "price": "315.33"
    }
  },
  "gasCostUSD": "0.50",
  "netProfitUSD": "12.00",
  "warning": "Opportunity may be captured by MEV bots"
}
```

---

## Supported DEXs

| Network | DEXs |
|---------|------|
| Ethereum | Uniswap V2/V3, SushiSwap, Curve, Balancer |
| BNB Chain | PancakeSwap, Biswap, BakerySwap |
| Arbitrum | Uniswap V3, SushiSwap, Camelot, GMX |
| Polygon | QuickSwap, SushiSwap, Uniswap V3 |
| Base | Uniswap V3, Aerodrome, BaseSwap |
| Optimism | Uniswap V3, Velodrome |

---

## Error Handling

### Common Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `INSUFFICIENT_LIQUIDITY` | Not enough liquidity | Split trade or try different route |
| `PRICE_IMPACT_TOO_HIGH` | Price impact exceeds threshold | Reduce trade size |
| `INSUFFICIENT_BALANCE` | Wallet balance too low | Check token balance |
| `APPROVAL_REQUIRED` | Token not approved | Use `token_approve` first |
| `DEADLINE_EXCEEDED` | Transaction took too long | Increase deadline or gas |

---

## Best Practices

1. **Always get a quote first** - Check prices before executing
2. **Set appropriate slippage** - 0.5% for stable pairs, 1-3% for volatile
3. **Consider gas costs** - Factor into profitability calculations
4. **Use aggregators** - Get best prices across multiple DEXs
5. **Check price impact** - Avoid large trades in illiquid pools
6. **Monitor MEV** - Use private transactions for large swaps
