# DEX Aggregation & Swap Infrastructure - Technical Research

> **Purpose**: Technical research document for implementing multi-chain dust sweeping in Sweep
> **Target Scale**: 600,000 users across EVM chains (Ethereum, Base, Arbitrum, BNB Chain, Polygon, Linea) and Solana
> **Last Updated**: January 2026

---

## Table of Contents

1. [Executive Summary & Recommendations](#1-executive-summary--recommendations)
2. [1inch Fusion API (EVM Chains)](#2-1inch-fusion-api-evm-chains)
3. [Jupiter Aggregator (Solana)](#3-jupiter-aggregator-solana)
4. [Li.Fi SDK (Cross-Chain)](#4-lifi-sdk-cross-chain)
5. [CoW Protocol (Batch Auctions)](#5-cow-protocol-batch-auctions)
6. [Practical Considerations for Dust](#6-practical-considerations-for-dust)
7. [High-Volume Architecture](#7-high-volume-architecture)
8. [Cost Analysis](#8-cost-analysis)
9. [Aggregator Selection Matrix](#9-aggregator-selection-matrix)

---

## 1. Executive Summary & Recommendations

### Primary Recommendation by Use Case

| Use Case | Recommended Aggregator | Reason |
|----------|----------------------|--------|
| **EVM Same-Chain Dust Swaps** | 1inch Fusion | Gasless, MEV protection, batch support |
| **EVM Small Amounts (<$5)** | CoW Protocol | Batch auctions maximize value for dust |
| **Solana Dust Swaps** | Jupiter API | Native Solana, best routing |
| **Cross-Chain Consolidation** | Li.Fi SDK | Bridge + swap in one tx |
| **High-Volume Production** | Multi-aggregator routing | Failover, best prices |

### Tech Stack Summary

```typescript
// Required packages
const packages = {
  evm: {
    fusion: '@1inch/fusion-sdk',         // Gasless intent-based swaps
    lifi: '@lifi/sdk',                    // Cross-chain
    cow: '@cowprotocol/app-data',        // Batch auctions
    viem: 'viem',                         // EVM interactions
  },
  solana: {
    jupiter: '@jup-ag/api',              // Swap API client
    web3: '@solana/web3.js',             // Solana basics
  },
  shared: {
    axios: 'axios',                       // API calls
    redis: 'ioredis',                     // Rate limit caching
  }
};
```

### Rate Limits Overview for 600K Users

| Provider | Free Tier | Paid Tier | Recommendation for 600K Users |
|----------|-----------|-----------|-------------------------------|
| **1inch** | ~10 RPS | 100+ RPS (Enterprise) | Enterprise plan + caching |
| **Jupiter** | 10 req/s (Lite) | 600 req/s (Pro) | Pro plan ($250/mo) |
| **Li.Fi** | 10 req/s | Custom | Partner program |
| **CoW Protocol** | No hard limit | N/A | Rate limit client-side |

---

## 2. 1inch Fusion API (EVM Chains)

### Overview

1inch Fusion is an **intent-based, gasless** swap protocol using Dutch auctions. Users sign "intents" that are filled by professional market makers (Resolvers).

**Key Benefits for Dust Sweeping:**
- ✅ **Gasless**: Users don't pay gas - Resolvers cover it
- ✅ **MEV Protection**: Orders go through private resolver networks
- ✅ **Batch Support**: Can submit multiple orders in one API call
- ✅ **Small Amount Friendly**: `slow` preset allows more time for small orders

### Supported Chains

| Network | Chain ID | Status |
|---------|----------|--------|
| Ethereum | 1 | ✅ Full support |
| Polygon | 137 | ✅ Full support |
| BNB Chain | 56 | ✅ Full support |
| Arbitrum | 42161 | ✅ Full support |
| Base | 8453 | ✅ Full support |
| Linea | 59144 | ✅ Full support |
| Optimism | 10 | ✅ Full support |
| Avalanche | 43114 | ✅ Full support |

### API Endpoints

```
Base URL: https://api.1inch.dev/fusion

# Quoter API
GET  /quoter/v2.0/{chainId}/quote/receive/    # Get quote
POST /quoter/v2.0/{chainId}/quote/receive/    # Quote with custom preset

# Relayer API  
POST /relayer/v2.0/{chainId}/order/submit     # Submit single order
POST /relayer/v2.0/{chainId}/order/submit/many # Submit batch orders

# Orders API
GET  /orders/v2.0/{chainId}/order/active/     # Get active orders
GET  /orders/v2.0/{chainId}/order/status/{hash} # Get order status

# WebSocket
wss://api.1inch.dev/fusion/ws                 # Real-time updates
```

### Authentication

```typescript
// All requests require API key from https://portal.1inch.dev
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};
```

### Batching Multiple Token Swaps

**Method 1: Batch Submit via Relayer API**

```typescript
import {
  FusionSDK,
  NetworkEnum,
  PresetEnum,
  PrivateKeyProviderConnector,
} from '@1inch/fusion-sdk';

async function batchDustSwap(
  sdk: FusionSDK,
  userAddress: string,
  dustTokens: Array<{ token: string; amount: string }>,
  outputToken: string
) {
  // 1. Get quotes for all dust tokens in parallel
  const quotes = await Promise.all(
    dustTokens.map(({ token, amount }) =>
      sdk.getQuote({
        fromTokenAddress: token,
        toTokenAddress: outputToken,
        amount,
        walletAddress: userAddress,
        enableEstimate: true,
      })
    )
  );

  // 2. Create orders from quotes
  const ordersWithSignatures = await Promise.all(
    quotes.map(async (quote) => {
      // Use 'slow' preset for small amounts - more time for resolvers
      const order = quote.createFusionOrder({
        network: NetworkEnum.ETHEREUM,
        preset: PresetEnum.slow,
        allowPartialFills: false,  // Atomic for dust
        allowMultipleFills: false,
      });

      // Sign the order
      const signature = await connector.signTypedData(
        userAddress,
        order.getTypedData(NetworkEnum.ETHEREUM)
      );

      return {
        order: order.build(),
        signature,
        quoteId: quote.quoteId,
        extension: order.extension.encode(),
      };
    })
  );

  // 3. Submit all orders in one batch call
  const result = await sdk.api.relayerApi.submitBatch(ordersWithSignatures);
  
  return result; // Contains orderHashes for tracking
}
```

**Method 2: Create Orders Individually, Submit Together**

```typescript
// For more control over timing and error handling
async function batchWithRetry(dustTokens: DustToken[]) {
  const batchSize = 10; // Submit in batches of 10
  const results = [];
  
  for (let i = 0; i < dustTokens.length; i += batchSize) {
    const batch = dustTokens.slice(i, i + batchSize);
    
    const orders = await Promise.all(
      batch.map(async (token) => {
        try {
          const quote = await sdk.getQuote({/*...*/});
          const order = quote.createFusionOrder({/*...*/});
          return { success: true, order, quote };
        } catch (error) {
          return { success: false, token, error };
        }
      })
    );

    // Filter successful orders and submit
    const validOrders = orders.filter(o => o.success);
    if (validOrders.length > 0) {
      const batchResult = await submitBatch(validOrders);
      results.push(...batchResult);
    }
    
    // Respect rate limits
    await delay(100);
  }
  
  return results;
}
```

### Gas Optimization for Small Amounts

1inch Fusion is inherently gas-optimized for dust because:

1. **Resolvers Pay Gas**: User signs intent, resolver pays execution gas
2. **Dutch Auction**: Resolvers compete, incentivized even for small trades
3. **Batched Settlements**: Resolvers can batch multiple orders in one tx

```typescript
// Best practices for small amounts
const smallAmountQuote = await sdk.getQuote({
  fromTokenAddress: dustToken,
  toTokenAddress: outputToken,
  amount: smallAmount,
  walletAddress: userAddress,
  enableEstimate: true,
  // Key settings for dust:
  surplus: true,  // Enable surplus mode for better rates
});

// Check viability before submitting
const preset = smallAmountQuote.getPreset(PresetEnum.slow);
const spread = BigInt(preset.auctionStartAmount) - BigInt(preset.auctionEndAmount);
const gasCost = preset.gasCostInfo.gasBumpEstimate;

// If spread > 0, order is viable (resolver can profit)
const isViable = spread > gasCost;
if (!isViable) {
  console.log('Dust too small - gas exceeds value');
}
```

### MEV Protection Features

1. **Private Order Flow**: Orders submitted to resolver network, not public mempool
2. **No Front-Running**: Price determined by Dutch auction, not DEX state
3. **Slippage Protection**: `auctionEndAmount` guarantees minimum output
4. **Resolver Competition**: Multiple resolvers compete for best execution

```typescript
// MEV-protected order
const order = quote.createFusionOrder({
  network: NetworkEnum.ETHEREUM,
  preset: PresetEnum.fast,
  // Whitelist ensures only trusted resolvers can fill
  // Automatically set from quote.whitelist
});

// The order includes:
// - Dutch auction parameters (price decays over time)
// - Resolver whitelist (only approved fillers)
// - Expiry time (order auto-cancels if not filled)
```

### Rate Limits for 600K Users

**Current Limits (check portal.1inch.dev for updates):**
- Free tier: ~10 requests/second
- Paid tiers: Varies by plan (100+ RPS enterprise)

**Scaling Strategy:**

```typescript
// 1. Implement caching layer
import Redis from 'ioredis';

const redis = new Redis();

async function getCachedQuote(params: QuoteParams) {
  const cacheKey = `quote:${params.fromToken}:${params.toToken}:${params.amount}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    // Quotes valid for ~30 seconds
    if (Date.now() - timestamp < 20000) {
      return data;
    }
  }
  
  const quote = await sdk.getQuote(params);
  await redis.setex(cacheKey, 30, JSON.stringify({
    data: quote,
    timestamp: Date.now()
  }));
  
  return quote;
}

// 2. Queue system for batch processing
import { Queue, Worker } from 'bullmq';

const swapQueue = new Queue('dust-swaps', { connection: redis });

// Workers process at controlled rate
const worker = new Worker('dust-swaps', async (job) => {
  const { userId, dustTokens } = job.data;
  return await batchDustSwap(sdk, userId, dustTokens);
}, {
  connection: redis,
  limiter: {
    max: 50,      // 50 jobs
    duration: 1000 // per second
  }
});
```

### SDK Setup

```typescript
import {
  FusionSDK,
  NetworkEnum,
  PrivateKeyProviderConnector,
  Web3Like
} from '@1inch/fusion-sdk';
import { JsonRpcProvider } from 'ethers';

// Initialize SDK
const provider = new JsonRpcProvider(RPC_URL);

const web3Like: Web3Like = {
  eth: {
    call: (tx) => provider.call(tx)
  },
  extend: () => {}
};

const connector = new PrivateKeyProviderConnector(PRIVATE_KEY, web3Like);

const sdk = new FusionSDK({
  url: 'https://api.1inch.dev/fusion',
  network: NetworkEnum.ETHEREUM,
  blockchainProvider: connector,
  authKey: '1INCH_API_KEY'
});
```

---

## 3. Jupiter Aggregator (Solana)

### Overview

Jupiter is the dominant swap aggregator on Solana with deep liquidity across all DEXs.

**Key Benefits for Dust Sweeping:**
- ✅ Best routing on Solana (aggregates all major DEXs)
- ✅ Versioned transactions (efficient instruction packing)
- ✅ Priority fee control (land transactions reliably)
- ✅ Native SOL wrapping/unwrapping

### API Endpoints

```
# Lite (Free) Tier
Base URL: https://lite-api.jup.ag/swap/v1

# Pro Tier (API Key)
Base URL: https://api.jup.ag/swap/v1

Endpoints:
GET  /quote              # Get swap quote
POST /swap               # Get unsigned transaction
POST /swap-instructions  # Get individual instructions (for batching)
GET  /program-id-to-label # Map DEX program IDs
```

### API Structure for Swaps

**Step 1: Get Quote**

```typescript
import { createJupiterApiClient } from '@jup-ag/api';

const jupiterApi = createJupiterApiClient({
  apiKey: 'YOUR_API_KEY' // Optional for pro tier
});

interface QuoteParams {
  inputMint: string;        // Source token mint (base58)
  outputMint: string;       // Destination token mint (base58)
  amount: number;           // Amount in smallest units (must be integer!)
  slippageBps?: number;     // Slippage in basis points (100 = 1%)
  onlyDirectRoutes?: boolean; // Skip multi-hop for simple dust
}

const quote = await jupiterApi.quoteGet({
  inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  outputMint: "So11111111111111111111111111111111111111112",  // SOL
  amount: 1000000,  // 1 USDC (6 decimals)
  slippageBps: 100, // 1% slippage
});

// Response includes:
// - outAmount: expected output
// - priceImpactPct: price impact
// - routePlan: detailed route through DEXs
```

**Step 2: Get Swap Transaction**

```typescript
const swapResponse = await jupiterApi.swapPost({
  swapRequest: {
    quoteResponse: quote,
    userPublicKey: wallet.publicKey.toBase58(),
    
    // Auto wrap/unwrap SOL ↔ WSOL
    wrapAndUnwrapSol: true,
    
    // Dynamic compute units (recommended)
    dynamicComputeUnitLimit: true,
    
    // Priority fees for reliable landing
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        priorityLevel: 'high',
        maxLamports: 1000000, // Max 0.001 SOL priority fee
      }
    }
  }
});

// Response: { swapTransaction: "base64 encoded versioned tx" }
```

**Step 3: Sign and Send**

```typescript
import { 
  Connection, 
  VersionedTransaction,
  Keypair 
} from '@solana/web3.js';

const connection = new Connection(RPC_URL);

// Deserialize the transaction
const txBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
const transaction = VersionedTransaction.deserialize(txBuf);

// Sign with user's keypair
transaction.sign([wallet]);

// Send with skip preflight for speed
const txid = await connection.sendRawTransaction(transaction.serialize(), {
  skipPreflight: true,
  maxRetries: 3,
});

// Confirm
await connection.confirmTransaction(txid, 'confirmed');
```

### Handling Dust Amounts

**Minimum Amount Considerations:**

```typescript
// Jupiter accepts any amount, but consider economics:
const MINIMUM_ECONOMICS = {
  // Priority fee (~0.00005-0.001 SOL typical)
  minPriorityFee: 50000, // lamports
  
  // Transaction base fee (5000 lamports = 0.000005 SOL)
  baseFee: 5000,
  
  // Token account rent (~0.002 SOL if creating new)
  accountRent: 2039280, // lamports
};

// Check if dust swap is economically viable
function isDustViable(
  inputValueUsd: number, 
  outputToken: string,
  needsNewAccount: boolean
): boolean {
  const totalCostLamports = MINIMUM_ECONOMICS.minPriorityFee + 
    MINIMUM_ECONOMICS.baseFee +
    (needsNewAccount ? MINIMUM_ECONOMICS.accountRent : 0);
  
  const solPrice = 100; // Get from price API
  const totalCostUsd = (totalCostLamports / 1e9) * solPrice;
  
  // Dust is viable if value > 2x costs
  return inputValueUsd > totalCostUsd * 2;
}
```

**Dust-Optimized Quote Request:**

```typescript
// For dust, use direct routes to minimize hops/fees
const dustQuote = await jupiterApi.quoteGet({
  inputMint: dustTokenMint,
  outputMint: "So11111111111111111111111111111111111111112", // Convert to SOL
  amount: dustAmount,
  slippageBps: 200, // Higher slippage for low liquidity dust
  onlyDirectRoutes: true, // Simpler routes for dust
  maxAccounts: 20, // Limit accounts to fit in tx
});
```

### Batching Multiple Swaps (swap-instructions)

For batching multiple dust swaps in one transaction:

```typescript
async function batchSolanaSwaps(
  swaps: Array<{ inputMint: string; amount: number }>,
  outputMint: string,
  wallet: Keypair
) {
  const allInstructions = [];
  const allLookupTables: string[] = [];

  // Get instructions for each swap
  for (const swap of swaps) {
    const quote = await jupiterApi.quoteGet({
      inputMint: swap.inputMint,
      outputMint,
      amount: swap.amount,
      slippageBps: 150,
    });

    const instructions = await jupiterApi.swapInstructionsPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      }
    });

    // Collect all instructions
    allInstructions.push(
      ...instructions.computeBudgetInstructions,
      ...instructions.setupInstructions,
      instructions.swapInstruction,
    );
    
    if (instructions.cleanupInstruction) {
      allInstructions.push(instructions.cleanupInstruction);
    }

    allLookupTables.push(...instructions.addressLookupTableAddresses);
  }

  // Build combined transaction
  // Note: May hit size limits - usually 2-3 swaps max per tx
  return buildVersionedTransaction(
    connection,
    wallet.publicKey,
    allInstructions,
    [...new Set(allLookupTables)] // Deduplicate
  );
}

// Helper to build versioned transaction
async function buildVersionedTransaction(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[],
  lookupTableAddresses: string[]
) {
  const { blockhash } = await connection.getLatestBlockhash();
  
  // Fetch lookup tables
  const lookupTables = await Promise.all(
    lookupTableAddresses.map(addr =>
      connection.getAddressLookupTable(new PublicKey(addr))
        .then(res => res.value)
    )
  );

  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTables.filter(Boolean));

  return new VersionedTransaction(messageV0);
}
```

### Versioned Transactions

Jupiter uses Versioned Transactions (V0) by default for:
- Smaller transaction size via Address Lookup Tables (ALTs)
- More accounts per transaction (up to 64 vs 35 legacy)
- Better for complex multi-hop routes

```typescript
// Check if wallet supports versioned transactions
const supportsVersioned = true; // Most modern wallets do

const swapRequest = {
  quoteResponse: quote,
  userPublicKey: wallet.publicKey.toBase58(),
  // Force legacy if needed (not recommended)
  asLegacyTransaction: !supportsVersioned,
};
```

### Rate Limits for 600K Users

**Tiers (as of Dec 2024):**

| Tier | Endpoint | Rate Limit | Price |
|------|----------|------------|-------|
| Lite | lite-api.jup.ag | 10 req/s | Free |
| Pro | api.jup.ag | 600 req/s | Varies |

**Scaling for 600K Users:**

```typescript
// Use Pro tier with API key
const jupiterApi = createJupiterApiClient({
  basePath: 'https://api.jup.ag/swap/v1',
  apiKey: process.env.JUPITER_API_KEY,
});

// Implement request queuing
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  reservoir: 500,      // 500 requests
  reservoirRefreshAmount: 500,
  reservoirRefreshInterval: 1000, // per second
  maxConcurrent: 50,   // 50 concurrent
});

const rateLimitedQuote = limiter.wrap(async (params) => {
  return jupiterApi.quoteGet(params);
});
```

### Common Token Mints

```typescript
const SOLANA_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
};
```

---

## 4. Li.Fi SDK (Cross-Chain)

### Overview

Li.Fi aggregates bridges (Stargate, Across, Hop, etc.) and DEXs to enable cross-chain swaps in one transaction.

**Key Benefits for Dust Sweeping:**
- ✅ Bridge + swap combined in single flow
- ✅ Supports 40+ EVM chains + Solana
- ✅ Route optimization (cheapest, fastest)
- ✅ Built-in status tracking

### API & SDK Setup

```typescript
import { createConfig, getRoutes, executeRoute, EVM } from '@lifi/sdk';
import { createWalletClient, http } from 'viem';
import { mainnet, arbitrum, base, polygon, bsc, linea } from 'viem/chains';

// Initialize SDK
createConfig({
  integrator: 'sweep',  // Required - your app name
  apiKey: 'YOUR_LIFI_API_KEY', // Optional but recommended
  
  // Custom RPC URLs for reliability
  rpcUrls: {
    1: ['https://eth.llamarpc.com'],
    42161: ['https://arb1.arbitrum.io/rpc'],
    8453: ['https://mainnet.base.org'],
    137: ['https://polygon-rpc.com'],
    56: ['https://bsc-dataseed.binance.org'],
    59144: ['https://rpc.linea.build'],
  },
  
  providers: [
    EVM({
      getWalletClient: async () => walletClient,
      switchChain: async (chainId) => {
        // Implement chain switching
      },
    }),
  ],
});
```

### Combining Bridge + Swap in One Flow

**Pattern: Consolidate dust from multiple chains to one destination**

```typescript
import { getRoutes, executeRoute, ChainId } from '@lifi/sdk';

interface DustPosition {
  chainId: number;
  tokenAddress: string;
  amount: string; // wei
  symbol: string;
}

async function consolidateCrossChainDust(
  dustPositions: DustPosition[],
  destinationChain: number,
  destinationToken: string,
  walletAddress: string
) {
  const consolidationRoutes = [];

  for (const dust of dustPositions) {
    // Skip if already on destination
    if (dust.chainId === destinationChain && 
        dust.tokenAddress.toLowerCase() === destinationToken.toLowerCase()) {
      continue;
    }

    try {
      const routes = await getRoutes({
        fromChainId: dust.chainId,
        toChainId: destinationChain,
        fromTokenAddress: dust.tokenAddress,
        toTokenAddress: destinationToken,
        fromAmount: dust.amount,
        fromAddress: walletAddress,
        options: {
          slippage: 0.02,  // 2% for dust (higher tolerance)
          order: 'CHEAPEST',
          // Prefer fast bridges for dust
          preferBridges: ['across', 'stargate'],
        },
      });

      if (routes.routes.length > 0) {
        consolidationRoutes.push({
          dust,
          route: routes.routes[0], // Best route
          estimate: {
            toAmount: routes.routes[0].toAmount,
            gasCostUSD: routes.routes[0].gasCostUSD,
            bridgeFeeUSD: routes.routes[0].steps
              .reduce((sum, s) => sum + parseFloat(s.estimate.feeCosts?.reduce(
                (a, f) => a + parseFloat(f.amountUSD || '0'), 0
              ) || '0'), 0),
          }
        });
      }
    } catch (error) {
      console.log(`No route for ${dust.symbol} on chain ${dust.chainId}`);
    }
  }

  return consolidationRoutes;
}
```

**Execute Cross-Chain Swap:**

```typescript
async function executeCrossChainSwap(route: Route, walletAddress: string) {
  const executedRoute = await executeRoute(route, {
    // Track execution progress
    updateRouteHook: (updatedRoute) => {
      for (const step of updatedRoute.steps) {
        if (step.execution) {
          console.log(`Step ${step.id}: ${step.execution.status}`);
          
          for (const process of step.execution.process) {
            if (process.txHash) {
              console.log(`  TX: ${process.txHash}`);
            }
            if (process.status === 'FAILED') {
              console.error(`  Failed: ${process.message}`);
            }
          }
        }
      }
    },
    
    // Handle user signature requests
    acceptSlippageUpdateHook: async (params) => {
      // Auto-accept small slippage increases for dust
      return params.newSlippage <= 0.05; // Accept up to 5%
    },
  });

  return executedRoute;
}
```

### Supported Routes

**Bridges Aggregated:**
- Stargate (LayerZero)
- Across Protocol
- Hop Protocol
- DeBridge DLN
- Circle CCTP (native USDC)
- Synapse
- Celer cBridge
- Connext
- Mayan (Solana)
- And 15+ more

**Chain Coverage:**

| Chain | Chain ID | Cross-Chain Support |
|-------|----------|-------------------|
| Ethereum | 1 | ✅ All bridges |
| Arbitrum | 42161 | ✅ All bridges |
| Base | 8453 | ✅ Most bridges |
| Polygon | 137 | ✅ All bridges |
| BNB Chain | 56 | ✅ Most bridges |
| Linea | 59144 | ✅ Limited bridges |
| Solana | 1151111081099710 | ✅ Mayan, Wormhole |

### SDK Integration Patterns

**Pattern 1: Quote API for Price Display**

```typescript
import { getQuote } from '@lifi/sdk';

// Quick single route quote
const quote = await getQuote({
  fromChain: 42161,  // Arbitrum
  toChain: 8453,     // Base
  fromToken: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC.e
  toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // USDC
  fromAmount: '10000000', // 10 USDC
  fromAddress: walletAddress,
});

console.log('Output:', quote.estimate.toAmount);
console.log('Gas cost:', quote.estimate.gasCostUSD);
```

**Pattern 2: Contract Calls for DeFi Integration**

```typescript
import { getContractCallsQuote } from '@lifi/sdk';
import { encodeFunctionData, parseAbi } from 'viem';

// Bridge + deposit into vault in one transaction
const vaultAbi = parseAbi(['function deposit(uint256 amount) external']);

const depositCalldata = encodeFunctionData({
  abi: vaultAbi,
  functionName: 'deposit',
  args: [BigInt(amount)],
});

const quote = await getContractCallsQuote({
  fromAddress: walletAddress,
  fromChain: 42161, // Arbitrum
  fromToken: USDC_ARB,
  fromAmount: amount,
  toChain: 1, // Ethereum
  toToken: USDC_ETH,
  contractCalls: [{
    fromAmount: amount,
    fromTokenAddress: USDC_ETH,
    toContractAddress: VAULT_ADDRESS,
    toContractCallData: depositCalldata,
    toContractGasLimit: '300000',
  }],
  toFallbackAddress: walletAddress,
  slippage: 0.01,
});
```

**Pattern 3: Status Tracking**

```typescript
import { getStatus } from '@lifi/sdk';

async function trackBridgeStatus(txHash: string, step: LiFiStep) {
  let status;
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    status = await getStatus({
      txHash,
      bridge: step.tool,
      fromChain: step.action.fromChainId,
      toChain: step.action.toChainId,
    });

    console.log(`Status: ${status.status}, Substatus: ${status.substatus}`);

    if (status.status === 'DONE') {
      return { success: true, destinationTx: status.receiving?.txHash };
    }
    if (status.status === 'FAILED') {
      return { success: false, error: status.substatus };
    }

    await new Promise(r => setTimeout(r, 10000)); // 10s polling
    attempts++;
  }

  return { success: false, error: 'TIMEOUT' };
}
```

### Rate Limits

- Default: ~10 requests/second
- Partner program: Higher limits available
- Recommended: Implement client-side rate limiting

```typescript
import Bottleneck from 'bottleneck';

const lifiLimiter = new Bottleneck({
  minTime: 100,  // 100ms between requests
  maxConcurrent: 5,
});

const rateLimitedGetRoutes = lifiLimiter.wrap(getRoutes);
```

---

## 5. CoW Protocol (Batch Auctions)

### Overview

CoW Protocol (Coincidence of Wants) uses batch auctions where orders are collected and settled together. This is ideal for dust because:

1. **Batch Efficiency**: Multiple small orders grouped into one settlement
2. **MEV Protection**: Uniform clearing price, no front-running
3. **CoW Matching**: Orders can match directly (e.g., your sell matches someone's buy)
4. **Gasless**: Users sign intents, solvers pay gas

### How Batch Auctions Work

```
Traditional DEX:          CoW Protocol:
─────────────────        ─────────────────
User → Pool → User       User1 ─┐
(each tx separate)              │ Batch
                         User2 ─┼→ Solver → Settlement
                         User3 ─┘   (single tx)
                         
Benefits for dust:
- Multiple dust orders settled in ONE transaction
- Solver absorbs gas costs
- Better prices via CoW matching
```

### Supported Chains

| Chain | Status | Dust Viability |
|-------|--------|---------------|
| Ethereum | ✅ Full | Good (batch efficiency offsets gas) |
| Gnosis Chain | ✅ Full | Excellent (low gas) |
| Arbitrum | ✅ Full | Excellent |
| Base | ✅ Full | Excellent |
| Polygon | ⚠️ Limited | Good |

### API Endpoints

```
Base URL: https://api.cow.fi/{chainId}

# Quote & Orders
POST /api/v1/quote      # Get quote
POST /api/v1/orders     # Place order

# Order Status  
GET /api/v1/orders/{uid}  # Get order details
GET /api/v1/trades       # Get user's trades

# Batch Auctions
GET /api/v1/auction     # Current auction state
```

### Integration Approach

**Method 1: Direct API**

```typescript
interface CowQuoteRequest {
  sellToken: string;
  buyToken: string;
  receiver: string;
  appData: string;      // Metadata hash
  partiallyFillable: boolean;
  sellTokenBalance: 'erc20' | 'internal' | 'external';
  buyTokenBalance: 'erc20' | 'internal';
  from: string;
  kind: 'sell' | 'buy';
  sellAmountBeforeFee?: string;
  buyAmountAfterFee?: string;
}

async function getCowQuote(params: {
  chainId: number;
  sellToken: string;
  buyToken: string;
  amount: string;
  userAddress: string;
}) {
  const response = await fetch(
    `https://api.cow.fi/${params.chainId}/api/v1/quote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellToken: params.sellToken,
        buyToken: params.buyToken,
        receiver: params.userAddress,
        from: params.userAddress,
        kind: 'sell',
        sellAmountBeforeFee: params.amount,
        appData: '0x0000000000000000000000000000000000000000000000000000000000000000',
        partiallyFillable: false,
        sellTokenBalance: 'erc20',
        buyTokenBalance: 'erc20',
      }),
    }
  );

  return response.json();
}
```

**Method 2: CoW SDK**

```typescript
import {
  OrderBookApi,
  OrderSigningUtils,
  SupportedChainId,
  SigningScheme,
} from '@cowprotocol/cow-sdk';

const orderBookApi = new OrderBookApi({ chainId: SupportedChainId.MAINNET });

// Get quote
const quoteRequest = {
  sellToken: '0x...',
  buyToken: '0x...',
  from: userAddress,
  receiver: userAddress,
  sellAmountBeforeFee: '1000000000000000000', // 1 token
  kind: OrderKind.SELL,
};

const { quote } = await orderBookApi.getQuote(quoteRequest);

// Sign order
const orderSigningResult = await OrderSigningUtils.signOrder(
  quote,
  SupportedChainId.MAINNET,
  signer
);

// Submit order
const orderUid = await orderBookApi.sendOrder({
  ...quote,
  signature: orderSigningResult.signature,
  signingScheme: SigningScheme.EIP712,
});

// Track status
const order = await orderBookApi.getOrder(orderUid);
console.log('Status:', order.status); // 'open', 'fulfilled', 'cancelled', 'expired'
```

### Benefits for Dust

1. **Batch Settlement**: Your $2 swap gets batched with many others
2. **No Minimum**: Any amount accepted (solver decides if profitable)
3. **Better Rates**: CoW matching can give you better than DEX rates
4. **Guaranteed Execution or Cancel**: Orders either fill or expire (no partial loss)

```typescript
// Dust-optimized CoW order
const dustOrder = {
  sellToken: dustTokenAddress,
  buyToken: WETH_ADDRESS,
  sellAmount: dustAmount,
  buyAmount: '1', // Accept any amount (let solver optimize)
  validTo: Math.floor(Date.now() / 1000) + 3600, // 1 hour validity
  feeAmount: '0', // Fee taken from sellAmount
  kind: 'sell',
  partiallyFillable: false, // Atomic for dust
  appData: SWEEP_BANK_APP_DATA, // Your app identifier
};
```

### Limitations

- **Not realtime**: Batches settle every ~30 seconds
- **May not fill**: If not profitable, solvers skip your order
- **Limited chains**: Fewer chains than 1inch/Li.Fi

---

## 6. Practical Considerations for Dust

### Minimum Viable Swap Amounts by Chain

| Chain | Min Economical Amount (USD) | Notes |
|-------|----------------------------|-------|
| **Ethereum** | $5-10 | High gas, use batch/gasless only |
| **Base** | $0.50-1 | Very low gas |
| **Arbitrum** | $0.50-1 | Low gas |
| **Polygon** | $0.25-0.50 | Very low gas |
| **BNB Chain** | $1-2 | Medium gas |
| **Linea** | $0.50-1 | Low gas |
| **Solana** | $0.10-0.25 | Low fees + account rent |

### Slippage Handling for Low-Liquidity Tokens

```typescript
function calculateDustSlippage(params: {
  tokenLiquidity: 'high' | 'medium' | 'low' | 'very-low';
  swapValueUsd: number;
  priceImpactPct: number;
}): number {
  // Base slippage by liquidity
  const baseSlippage = {
    'high': 0.5,      // 0.5%
    'medium': 1,      // 1%
    'low': 2,         // 2%
    'very-low': 5,    // 5%
  }[params.tokenLiquidity];

  // Add buffer for price impact
  const impactBuffer = Math.min(params.priceImpactPct * 1.5, 5);
  
  // Cap total slippage
  return Math.min(baseSlippage + impactBuffer, 10); // Max 10%
}

// Usage
const slippageBps = calculateDustSlippage({
  tokenLiquidity: 'low',
  swapValueUsd: 2.5,
  priceImpactPct: 1.2,
}) * 100; // Convert to basis points
```

### Failed Transaction Handling

```typescript
interface SwapAttempt {
  aggregator: '1inch' | 'jupiter' | 'lifi' | 'cow';
  txHash?: string;
  error?: string;
  retryCount: number;
}

async function executeWithFallback(
  dustSwap: DustSwapParams,
  maxRetries: number = 3
): Promise<SwapResult> {
  const aggregatorOrder = ['1inch', 'cow', 'lifi']; // Fallback order
  
  for (const aggregator of aggregatorOrder) {
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        const result = await executeSwap(aggregator, dustSwap);
        return { success: true, aggregator, result };
      } catch (error) {
        const isRetryable = isRetryableError(error);
        
        if (!isRetryable) {
          console.log(`${aggregator} failed permanently:`, error.message);
          break; // Try next aggregator
        }
        
        // Exponential backoff
        await delay(Math.pow(2, retry) * 1000);
      }
    }
  }
  
  return { success: false, error: 'All aggregators failed' };
}

function isRetryableError(error: any): boolean {
  const retryableCodes = [
    'NETWORK_ERROR',
    'TIMEOUT',
    'RATE_LIMIT',
    'SLIPPAGE_EXCEEDED',
    'INSUFFICIENT_LIQUIDITY_TEMPORARY',
  ];
  return retryableCodes.includes(error.code);
}
```

### Price Impact Calculations

```typescript
interface PriceImpactResult {
  percentage: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

function analyzePriceImpact(
  inputValueUsd: number,
  expectedOutputUsd: number,
  spotPriceOutput: number
): PriceImpactResult {
  // Calculate actual vs expected
  const expectedAtSpot = inputValueUsd; // Assuming 1:1 value
  const priceImpact = ((expectedAtSpot - expectedOutputUsd) / expectedAtSpot) * 100;

  // Severity thresholds for dust
  let severity: PriceImpactResult['severity'];
  let recommendation: string;

  if (priceImpact < 1) {
    severity = 'low';
    recommendation = 'Proceed - minimal price impact';
  } else if (priceImpact < 3) {
    severity = 'medium';
    recommendation = 'Acceptable for dust amounts';
  } else if (priceImpact < 10) {
    severity = 'high';
    recommendation = 'Consider batching with other dust';
  } else {
    severity = 'critical';
    recommendation = 'Skip - price impact too high for amount';
  }

  return { percentage: priceImpact, severity, recommendation };
}
```

---

## 7. High-Volume Architecture

### System Architecture for 600K Users

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SWEEP ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   Frontend   │────▶│  API Gateway │────▶│ Load Balancer│                │
│  │   (React)    │     │   (Nginx)    │     │              │                │
│  └──────────────┘     └──────────────┘     └──────┬───────┘                │
│                                                    │                        │
│                           ┌────────────────────────┼────────────────────┐   │
│                           │                        │                    │   │
│                           ▼                        ▼                    ▼   │
│                    ┌──────────────┐        ┌──────────────┐     ┌──────────┐│
│                    │ Quote Service│        │ Swap Service │     │  Status  ││
│                    │  (Stateless) │        │ (Stateless)  │     │ Service  ││
│                    └──────┬───────┘        └──────┬───────┘     └────┬─────┘│
│                           │                       │                   │     │
│                           ▼                       ▼                   ▼     │
│                    ┌──────────────────────────────────────────────────────┐ │
│                    │                    Redis Cluster                     │ │
│                    │  • Quote cache (30s TTL)                            │ │
│                    │  • Rate limit counters                              │ │
│                    │  • User session data                                │ │
│                    └──────────────────────────────────────────────────────┘ │
│                                                                             │
│                    ┌──────────────────────────────────────────────────────┐ │
│                    │                   Job Queue (BullMQ)                 │ │
│                    │  • Swap execution queue                             │ │
│                    │  • Status polling queue                             │ │
│                    │  • Retry queue                                      │ │
│                    └──────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     Aggregator Adapters                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ ┌─────────┐ │   │
│  │  │  1inch   │  │ Jupiter  │  │  Li.Fi   │  │   CoW    │ │ Fallback│ │   │
│  │  │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapter  │ │ Router  │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ └─────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Multi-Aggregator Routing Logic

```typescript
interface AggregatorConfig {
  name: string;
  supportedChains: number[];
  minAmountUsd: number;
  maxAmountUsd: number;
  priority: number;
  features: {
    gasless: boolean;
    batchSupport: boolean;
    crossChain: boolean;
  };
}

const AGGREGATOR_CONFIG: AggregatorConfig[] = [
  {
    name: '1inch-fusion',
    supportedChains: [1, 56, 137, 42161, 8453, 59144, 10, 43114],
    minAmountUsd: 0.5,
    maxAmountUsd: 1000000,
    priority: 1,
    features: { gasless: true, batchSupport: true, crossChain: false },
  },
  {
    name: 'cow-protocol',
    supportedChains: [1, 100, 42161, 8453],
    minAmountUsd: 0.1,
    maxAmountUsd: 100000,
    priority: 2,
    features: { gasless: true, batchSupport: true, crossChain: false },
  },
  {
    name: 'lifi',
    supportedChains: [1, 56, 137, 42161, 8453, 59144, 10, 43114], // + many more
    minAmountUsd: 1,
    maxAmountUsd: 10000000,
    priority: 3,
    features: { gasless: false, batchSupport: false, crossChain: true },
  },
  {
    name: 'jupiter',
    supportedChains: [1151111081099710], // Solana
    minAmountUsd: 0.1,
    maxAmountUsd: 10000000,
    priority: 1,
    features: { gasless: false, batchSupport: true, crossChain: false },
  },
];

function selectAggregator(params: {
  sourceChain: number;
  destinationChain: number;
  amountUsd: number;
  requireGasless: boolean;
}): string[] {
  const candidates = AGGREGATOR_CONFIG
    .filter(agg => {
      // Chain support
      if (!agg.supportedChains.includes(params.sourceChain)) return false;
      
      // Cross-chain check
      if (params.sourceChain !== params.destinationChain) {
        if (!agg.features.crossChain) return false;
        if (!agg.supportedChains.includes(params.destinationChain)) return false;
      }
      
      // Amount range
      if (params.amountUsd < agg.minAmountUsd) return false;
      if (params.amountUsd > agg.maxAmountUsd) return false;
      
      // Gasless requirement
      if (params.requireGasless && !agg.features.gasless) return false;
      
      return true;
    })
    .sort((a, b) => a.priority - b.priority);

  return candidates.map(c => c.name);
}
```

### Quote Service with Caching

```typescript
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';

const redis = new Redis(process.env.REDIS_URL);

interface QuoteCache {
  quote: any;
  timestamp: number;
  aggregator: string;
}

class QuoteService {
  private readonly QUOTE_TTL = 20; // 20 seconds
  
  async getQuote(params: QuoteParams): Promise<Quote> {
    const cacheKey = this.buildCacheKey(params);
    
    // Check cache
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;
    
    // Get quotes from multiple aggregators in parallel
    const aggregators = selectAggregator({
      sourceChain: params.sourceChain,
      destinationChain: params.destinationChain,
      amountUsd: params.estimatedValueUsd,
      requireGasless: params.preferGasless,
    });

    const quotes = await Promise.allSettled(
      aggregators.slice(0, 3).map(agg => // Top 3 aggregators
        this.fetchQuote(agg, params)
      )
    );

    // Select best quote
    const validQuotes = quotes
      .filter((r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount));

    if (validQuotes.length === 0) {
      throw new Error('No valid quotes available');
    }

    const bestQuote = validQuotes[0];
    
    // Cache result
    await this.cacheQuote(cacheKey, bestQuote);
    
    return bestQuote;
  }

  private buildCacheKey(params: QuoteParams): string {
    return `quote:${params.sourceChain}:${params.sourceToken}:${params.destinationChain}:${params.destinationToken}:${params.amount}`;
  }

  private async getFromCache(key: string): Promise<Quote | null> {
    const cached = await redis.get(key);
    if (!cached) return null;
    
    const { quote, timestamp } = JSON.parse(cached) as QuoteCache;
    
    // Check if still valid
    if (Date.now() - timestamp > this.QUOTE_TTL * 1000) {
      return null;
    }
    
    return quote;
  }

  private async cacheQuote(key: string, quote: Quote): Promise<void> {
    await redis.setex(key, this.QUOTE_TTL, JSON.stringify({
      quote,
      timestamp: Date.now(),
    }));
  }
}
```

### Rate Limit Management

```typescript
import Bottleneck from 'bottleneck';

// Per-aggregator rate limiters
const rateLimiters = {
  '1inch': new Bottleneck({
    reservoir: 80,        // 80 requests
    reservoirRefreshAmount: 80,
    reservoirRefreshInterval: 1000, // per second
    maxConcurrent: 20,
  }),
  'jupiter': new Bottleneck({
    reservoir: 500,
    reservoirRefreshAmount: 500,
    reservoirRefreshInterval: 1000,
    maxConcurrent: 50,
  }),
  'lifi': new Bottleneck({
    minTime: 100, // 100ms between requests
    maxConcurrent: 10,
  }),
  'cow': new Bottleneck({
    minTime: 50,
    maxConcurrent: 20,
  }),
};

// Wrap API calls with rate limiting
async function rateLimitedQuote(
  aggregator: string,
  params: QuoteParams
): Promise<Quote> {
  const limiter = rateLimiters[aggregator];
  return limiter.schedule(() => fetchQuote(aggregator, params));
}
```

---

## 8. Cost Analysis

### Per-Swap Cost Breakdown

#### Ethereum (EVM) - Using 1inch Fusion

| Cost Component | Amount | Notes |
|----------------|--------|-------|
| User Gas Cost | $0 | Gasless - resolver pays |
| Resolver Spread | ~0.1-0.5% | Built into quote |
| Integrator Fee | 0-0.3% | Your fee (optional) |
| **Total User Cost** | **~0.1-0.8%** | Depending on preset |

#### Solana - Using Jupiter

| Cost Component | Amount | Notes |
|----------------|--------|-------|
| Base Fee | 5,000 lamports ($0.0005) | Always paid |
| Priority Fee | 10K-1M lamports | $0.001-0.10 depending on congestion |
| Account Rent | ~0.002 SOL | Only if creating new accounts |
| Platform Fee | 0-0.5% | Your fee (optional) |
| **Total User Cost** | **$0.005-0.15** | Per transaction |

#### Cross-Chain - Using Li.Fi

| Cost Component | Amount | Notes |
|----------------|--------|-------|
| Source Chain Gas | Varies | User pays |
| Bridge Fee | 0.05-0.3% | Depends on bridge |
| Destination Gas | Included | Usually included in quote |
| Integrator Fee | 0-0.3% | Your fee (optional) |
| **Total User Cost** | **~0.5-2%** | + source gas |

### Cost Comparison Table

| Scenario | 1inch Fusion | CoW Protocol | Li.Fi | Jupiter |
|----------|-------------|--------------|-------|---------|
| $1 dust swap (same chain) | ~$0.01 | ~$0.01 | ~$0.02 | ~$0.01 |
| $5 dust swap (same chain) | ~$0.03 | ~$0.02 | ~$0.05 | ~$0.02 |
| $10 dust swap (same chain) | ~$0.05 | ~$0.04 | ~$0.08 | ~$0.03 |
| $5 cross-chain | N/A | N/A | ~$0.50 | N/A |

### Revenue Model for Sweep

```typescript
// Recommended fee structure
const SWEEP_BANK_FEES = {
  // Same-chain swaps
  sameChain: {
    '1inch': { bps: 30, share: 0.5 },  // 0.3%, you keep 50%
    'cow': { bps: 25, share: 1.0 },    // 0.25%, you keep 100%
    'jupiter': { bps: 50, share: 1.0 }, // 0.5%, you keep 100%
  },
  // Cross-chain
  crossChain: {
    'lifi': { bps: 30, share: 1.0 },   // 0.3%, you keep 100%
  },
};

// Example revenue calculation
function calculateRevenue(swapValueUsd: number, aggregator: string, type: 'sameChain' | 'crossChain'): number {
  const fee = SWEEP_BANK_FEES[type][aggregator];
  const grossFee = swapValueUsd * (fee.bps / 10000);
  return grossFee * fee.share;
}

// 600K users × $10 avg dust × 2 swaps/month = $12M volume/month
// At 0.3% fee = $36K/month potential revenue
```

---

## 9. Aggregator Selection Matrix

### Decision Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGGREGATOR SELECTION DECISION TREE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Is it Solana?                                                              │
│       │                                                                     │
│       ├── YES ──▶ Jupiter (only option)                                     │
│       │                                                                     │
│       └── NO (EVM) ──▶ Is it cross-chain?                                   │
│                              │                                              │
│                              ├── YES ──▶ Li.Fi                              │
│                              │                                              │
│                              └── NO ──▶ Is amount < $5?                     │
│                                              │                              │
│                                              ├── YES ──▶ CoW Protocol       │
│                                              │           (batch auctions)   │
│                                              │                              │
│                                              └── NO ──▶ 1inch Fusion        │
│                                                         (gasless, MEV prot) │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Feature Comparison

| Feature | 1inch Fusion | Jupiter | Li.Fi | CoW Protocol |
|---------|-------------|---------|-------|--------------|
| **Chains** | 12+ EVM | Solana | 40+ EVM + Solana | 5 EVM |
| **Gasless** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **MEV Protection** | ✅ High | ⚠️ Medium | ⚠️ Medium | ✅ High |
| **Cross-Chain** | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **Batch Orders** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Min Amount** | ~$0.50 | ~$0.10 | ~$1 | ~$0.10 |
| **Settlement Time** | 30s-5min | ~5s | 1-30min | ~30s |
| **SDK Quality** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Rate Limits** | Moderate | High | Moderate | High |

### Recommended Implementation Order

1. **Phase 1 - Core Swaps**
   - Jupiter for Solana dust
   - 1inch Fusion for EVM dust
   
2. **Phase 2 - Optimization**
   - CoW Protocol for small EVM amounts (<$5)
   - Fallback routing between 1inch/CoW
   
3. **Phase 3 - Cross-Chain**
   - Li.Fi for consolidation across chains
   - Contract calls for DeFi routing

### Code: Unified Aggregator Interface

```typescript
interface UnifiedSwapParams {
  sourceChain: number | 'solana';
  sourceToken: string;
  destinationChain: number | 'solana';
  destinationToken: string;
  amount: string;
  userAddress: string;
  slippageBps?: number;
}

interface UnifiedQuote {
  aggregator: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  gasCostUsd: number;
  totalCostUsd: number;
  estimatedTime: number;
  route: any; // Aggregator-specific route data
}

interface SwapResult {
  success: boolean;
  txHash?: string;
  outputAmount?: string;
  error?: string;
}

// Unified aggregator interface
abstract class BaseAggregator {
  abstract name: string;
  abstract supportedChains: (number | 'solana')[];
  
  abstract getQuote(params: UnifiedSwapParams): Promise<UnifiedQuote>;
  abstract executeSwap(quote: UnifiedQuote, signer: any): Promise<SwapResult>;
  abstract checkStatus(txHash: string): Promise<'pending' | 'success' | 'failed'>;
}

// Implementation example
class OneInchFusionAggregator extends BaseAggregator {
  name = '1inch-fusion';
  supportedChains = [1, 56, 137, 42161, 8453, 59144, 10, 43114];
  
  async getQuote(params: UnifiedSwapParams): Promise<UnifiedQuote> {
    const quote = await this.sdk.getQuote({
      fromTokenAddress: params.sourceToken,
      toTokenAddress: params.destinationToken,
      amount: params.amount,
      walletAddress: params.userAddress,
    });
    
    return {
      aggregator: this.name,
      inputAmount: quote.fromTokenAmount,
      outputAmount: quote.toTokenAmount,
      priceImpact: 0, // Calculated from quote
      gasCostUsd: 0, // Gasless
      totalCostUsd: 0,
      estimatedTime: 180, // ~3 minutes typical
      route: quote,
    };
  }
  
  async executeSwap(quote: UnifiedQuote, signer: any): Promise<SwapResult> {
    // Implementation using SDK
  }
}
```

---

## Summary & Next Steps

### Key Takeaways

1. **EVM Dust**: Use 1inch Fusion (gasless) or CoW Protocol (batch auctions) depending on amount
2. **Solana Dust**: Jupiter is the clear choice with excellent SDK
3. **Cross-Chain**: Li.Fi is the most comprehensive option
4. **Scale**: Implement caching, rate limiting, and multi-aggregator fallback for 600K users

### Implementation Checklist

- [ ] Set up 1inch Developer Portal account (API key)
- [ ] Set up Jupiter Pro tier access
- [ ] Apply for Li.Fi partner program
- [ ] Implement Redis caching layer
- [ ] Build unified aggregator interface
- [ ] Implement rate limiting per aggregator
- [ ] Build fallback routing logic
- [ ] Set up status monitoring for long-running swaps
- [ ] Implement fee collection infrastructure

### Resources

| Resource | URL |
|----------|-----|
| 1inch Developer Portal | https://portal.1inch.dev |
| 1inch Fusion SDK | https://github.com/1inch/fusion-sdk |
| Jupiter Portal | https://portal.jup.ag |
| Jupiter API Docs | https://dev.jup.ag |
| Li.Fi Docs | https://docs.li.fi |
| Li.Fi SDK | https://github.com/lifinance/sdk |
| CoW Protocol Docs | https://docs.cow.fi |

---

*Document compiled for Sweep dust sweeper project. January 2026.*
