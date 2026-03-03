# Jupiter Aggregator (Solana) - Technical Research

> **Jupiter** is the best swap aggregator on Solana, built for smart traders who like money.
> - Official site: https://jup.ag
> - Developer docs: https://dev.jup.ag
> - API Portal: https://portal.jup.ag

---

## Table of Contents
1. [API Overview](#1-api-overview)
2. [V6/V1 Swap API Endpoints](#2-v6v1-swap-api-endpoints)
3. [Quote API](#3-quote-api)
4. [Swap API](#4-swap-api)
5. [Price API](#5-price-api)
6. [DCA (Dollar-Cost Averaging)](#6-dca-dollar-cost-averaging)
7. [Limit Orders](#7-limit-orders)
8. [SDK & Libraries](#8-sdk--libraries)
9. [Integration Patterns](#9-integration-patterns)
10. [Fees & Priority Fees](#10-fees--priority-fees)
11. [Token List & Registry](#11-token-list--registry)
12. [Small Amounts & Dust Handling](#12-small-amounts--dust-handling)

---

## 1. API Overview

### Base URLs

| Tier | Base URL | Description |
|------|----------|-------------|
| **Free (Lite)** | `https://lite-api.jup.ag/swap/v1` | Public API with rate limits |
| **Pro (API Key)** | `https://api.jup.ag/swap/v1` | Higher rate limits with API key |

### Rate Limits (Since December 1, 2024)
- Updated API structure with tiered access
- Pro plan available via https://portal.jup.ag
- API key passed via `x-api-key` header

### Data Types
- **Public keys**: Base58 encoded strings
- **Raw data** (like `Vec<u8>`): Base64 encoded strings

---

## 2. V6/V1 Swap API Endpoints

Jupiter's current Swap API (referred to as V6 or V1 depending on context) provides:

### Main Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/quote` | GET | Get a quote for token swap |
| `/swap` | POST | Get unsigned transaction for swap |
| `/swap-instructions` | POST | Get individual swap instructions |
| `/program-id-to-label` | GET | Map program IDs to DEX labels |

### API Features (V6/Latest)
- **Instruction Versions**: V1 and V2 instruction formats
- **Swap Modes**: `ExactIn` (fixed input) and `ExactOut` (fixed output)
- **Dynamic Slippage**: Auto-adjusts slippage (deprecated, focusing on Ultra Swap API)
- **Versioned Transactions**: Default (can fallback to legacy)
- **Address Lookup Tables**: For efficient transaction sizes

---

## 3. Quote API

### GET `/quote`

Request a quote to be used in POST `/swap`.

#### Request Parameters

```typescript
interface QuoteGetRequest {
  // Required
  inputMint: string;           // Input token mint address (base58)
  outputMint: string;          // Output token mint address (base58)
  amount: number;              // Amount in smallest units (lamports/raw)
  
  // Optional
  slippageBps?: number;        // Slippage tolerance in basis points (100 = 1%)
  swapMode?: 'ExactIn' | 'ExactOut';  // Default: ExactIn
  dexes?: string[];            // Include only these DEXes
  excludeDexes?: string[];     // Exclude these DEXes
  restrictIntermediateTokens?: boolean;  // Limit intermediate tokens
  onlyDirectRoutes?: boolean;  // No multi-hop routes
  asLegacyTransaction?: boolean;  // Use legacy tx format
  platformFeeBps?: number;     // Platform fee in basis points
  maxAccounts?: number;        // Limit accounts for route
  instructionVersion?: 'V1' | 'V2';  // Instruction version
  dynamicSlippage?: boolean;   // Auto slippage adjustment
}
```

#### Response

```typescript
interface QuoteResponse {
  inputMint: string;
  inAmount: string;            // Input amount as string
  outputMint: string;
  outAmount: string;           // Calculated output (includes fees, excludes slippage)
  otherAmountThreshold: string; // Min output after slippage
  instructionVersion?: 'V1' | 'V2' | null;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee?: PlatformFee;
  priceImpactPct: string;      // Price impact percentage
  routePlan: RoutePlanStep[];  // Detailed route information
  contextSlot?: number;
  timeTaken?: number;          // Time to compute quote
}

interface PlatformFee {
  amount?: string;
  feeBps?: number;
}

interface RoutePlanStep {
  swapInfo: SwapInfo;
  percent: number;
}

interface SwapInfo {
  ammKey: string;
  label?: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  feeMint: string;
}
```

#### Example Usage

```typescript
import { createJupiterApiClient } from '@jup-ag/api';

const jupiterApi = createJupiterApiClient();

const quote = await jupiterApi.quoteGet({
  inputMint: "So11111111111111111111111111111111111111112",  // SOL
  outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  amount: 100000000,  // 0.1 SOL (9 decimals)
  slippageBps: 100,   // 1%
});
```

---

## 4. Swap API

### POST `/swap`

Returns a base64-encoded unsigned swap transaction.

#### Request Body

```typescript
interface SwapRequest {
  // Required
  userPublicKey: string;       // User's wallet public key
  quoteResponse: QuoteResponse; // Quote from /quote endpoint
  
  // Optional - Transaction Configuration
  payer?: string;              // Custom payer for fees/rent
  wrapAndUnwrapSol?: boolean;  // Auto wrap/unwrap SOL ↔ WSOL
  useSharedAccounts?: boolean; // Use shared intermediate accounts
  asLegacyTransaction?: boolean; // Legacy tx instead of versioned
  
  // Optional - Token Accounts
  feeAccount?: string;         // Fee collection account (must be input/output mint)
  trackingAccount?: string;    // Your public key for tracking swaps
  destinationTokenAccount?: string;  // Custom output token account
  nativeDestinationAccount?: string; // Native SOL destination
  
  // Optional - Priority Fees
  prioritizationFeeLamports?: SwapRequestPrioritizationFeeLamports;
  computeUnitPriceMicroLamports?: number;  // Direct compute unit price
  dynamicComputeUnitLimit?: boolean;  // Auto-adjust compute limit
  
  // Optional - Other
  dynamicSlippage?: boolean;   // Auto slippage (deprecated)
  skipUserAccountsRpcCalls?: boolean;  // Skip RPC account checks
  blockhashSlotsToExpiry?: number;  // Tx validity in slots (~400ms/slot)
}
```

#### Priority Fee Options

```typescript
type SwapRequestPrioritizationFeeLamports = 
  | JitoTipLamports 
  | JitoTipLamportsWithPayer 
  | PriorityLevelWithMaxLamports;

interface JitoTipLamports {
  jitoTipLamports: number;
}

interface JitoTipLamportsWithPayer {
  jitoTipLamportsWithPayer: {
    lamports: number;
    payer: string;
  };
}

interface PriorityLevelWithMaxLamports {
  priorityLevelWithMaxLamports: {
    maxLamports: number;
    priorityLevel: 'min' | 'low' | 'medium' | 'high' | 'veryHigh';
  };
}
```

#### Response

```typescript
interface SwapResponse {
  swapTransaction: string;     // Base64 encoded transaction
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
  prioritizationType?: {
    computeBudget?: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport?: {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
  };
  simulationError?: string;
}
```

#### Example Usage

```typescript
const swapResponse = await jupiterApi.swapPost({
  swapRequest: {
    quoteResponse: quote,
    userPublicKey: wallet.publicKey.toBase58(),
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        maxLamports: 10000000,
        priorityLevel: "veryHigh"
      }
    }
  }
});

// Deserialize and sign
const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, "base64");
const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
transaction.sign([wallet.payer]);

// Send transaction
const txid = await connection.sendTransaction(transaction);
```

---

### POST `/swap-instructions`

Get individual instructions for custom transaction building.

#### Response

```typescript
interface SwapInstructionsResponse {
  otherInstructions: Instruction[];        // Jito tips, etc.
  computeBudgetInstructions: Instruction[]; // Compute budget setup
  setupInstructions: Instruction[];         // Token account setup
  swapInstruction: Instruction;             // Main swap instruction
  cleanupInstruction?: Instruction;         // Post-swap cleanup
  addressLookupTableAddresses: string[];    // ALT addresses for versioned tx
}

interface Instruction {
  programId: string;           // Program ID (base58)
  accounts: AccountMeta[];     // Account list
  data: string;                // Instruction data (base64)
}

interface AccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}
```

This endpoint is useful for:
- Batching multiple swaps in one transaction
- Adding custom instructions before/after swap
- Advanced transaction composition

---

## 5. Price API

Jupiter provides a separate Price API for real-time token prices.

### Base URL
```
https://price.jup.ag/v6
```

### GET `/price`

```typescript
// Single token
GET /price?ids=SOL

// Multiple tokens
GET /price?ids=SOL,USDC,JUP

// Specific mint addresses
GET /price?ids=So11111111111111111111111111111111111111112
```

#### Response
```typescript
interface PriceResponse {
  data: {
    [mintAddress: string]: {
      id: string;
      mintSymbol: string;
      vsToken: string;
      vsTokenSymbol: string;
      price: number;
    };
  };
  timeTaken: number;
}
```

### Price by VS Token
```typescript
// Get price vs specific token
GET /price?ids=SOL&vsToken=USDC
```

---

## 6. DCA (Dollar-Cost Averaging)

Jupiter DCA allows users to automatically buy tokens at regular intervals.

### DCA Program
- **Program ID**: `DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M`
- **Docs**: https://station.jup.ag/docs/dca

### How DCA Works

1. **Create DCA Account**: User deposits funds and sets parameters
2. **Automated Execution**: Keepers execute swaps at intervals
3. **Withdraw**: User withdraws accumulated tokens anytime

### DCA Parameters

```typescript
interface DCAParams {
  inputMint: PublicKey;        // Token to spend
  outputMint: PublicKey;       // Token to receive
  totalInAmount: BN;           // Total amount to DCA
  inAmountPerCycle: BN;        // Amount per order
  cycleFrequency: number;      // Seconds between orders
  minOutAmount?: BN;           // Min output per cycle (slippage)
  maxOutAmount?: BN;           // Max output per cycle
  startAt?: number;            // Unix timestamp to start
}
```

### DCA SDK Usage

```typescript
// Note: SDK may be @jup-ag/dca-sdk
import { DCA } from '@jup-ag/dca-sdk';

const dca = new DCA(connection, wallet);

// Create DCA order
const { dcaPublicKey, tx } = await dca.createDCA({
  inputMint: USDC_MINT,
  outputMint: SOL_MINT,
  totalInAmount: new BN(100_000_000), // 100 USDC
  inAmountPerCycle: new BN(10_000_000), // 10 USDC per order
  cycleFrequency: 86400, // Daily
});

// Get user's DCA accounts
const dcaAccounts = await dca.getUserDCAAccounts(wallet.publicKey);

// Withdraw from DCA
await dca.withdraw(dcaPublicKey);

// Close DCA account
await dca.closeDCA(dcaPublicKey);
```

### DCA Features
- **Flexible intervals**: Minute to monthly
- **Price protection**: Min/max output amounts
- **Partial fills**: Continue even if one cycle fails
- **No keeper fees**: Only standard swap fees

---

## 7. Limit Orders

Jupiter Limit Orders allow users to set orders at specific prices.

### Limit Order Program
- **Program ID**: `jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu`
- **Docs**: https://station.jup.ag/docs/limit-order

### How Limit Orders Work

1. **Create Order**: User specifies input/output amounts
2. **Order Book**: Orders stored on-chain
3. **Execution**: Keepers fill orders when market reaches price
4. **Expiry**: Optional expiration time

### Limit Order SDK

```typescript
// Note: SDK may be @jup-ag/limit-order-sdk
import { LimitOrderProvider } from '@jup-ag/limit-order-sdk';

const limitOrder = new LimitOrderProvider(connection);

// Create limit order
const { orderPubKey, tx } = await limitOrder.createOrder({
  owner: wallet.publicKey,
  inputMint: USDC_MINT,
  outputMint: SOL_MINT,
  inAmount: new BN(100_000_000),  // 100 USDC
  outAmount: new BN(500_000_000), // Want 0.5 SOL (200 USDC/SOL)
  expiredAt: null,  // No expiration
  base: Keypair.generate().publicKey,
});

// Get open orders
const orders = await limitOrder.getOrders([wallet.publicKey]);

// Cancel order
await limitOrder.cancelOrder({
  owner: wallet.publicKey,
  orderPubKey,
});
```

### Limit Order Features
- **No fees** for placing orders (only tx costs)
- **Keeper network** fills orders
- **Partial fills** supported
- **Order expiration** optional

---

## 8. SDK & Libraries

### Official SDKs

#### 1. @jup-ag/api (Quote API Client)

```bash
npm install @jup-ag/api
```

```typescript
import { createJupiterApiClient } from '@jup-ag/api';

// Without API key (lite tier)
const jupiterApi = createJupiterApiClient();

// With API key (pro tier)
const jupiterApiPro = createJupiterApiClient({
  apiKey: 'your-api-key'
});

// All methods
await jupiterApi.quoteGet({ ... });
await jupiterApi.swapPost({ ... });
await jupiterApi.swapInstructionsPost({ ... });
await jupiterApi.programIdToLabelGet();
```

#### 2. @jup-ag/core (Legacy/Core SDK)

```bash
npm install @jup-ag/core
```

```typescript
import { Jupiter, TOKEN_LIST_URL, getPlatformFeeAccounts } from '@jup-ag/core';

// Initialize Jupiter
const jupiter = await Jupiter.load({
  connection,
  cluster: 'mainnet-beta',
  user: keypair,
  platformFeeAndAccounts: {
    feeBps: 50, // 0.5% platform fee
    feeAccounts: await getPlatformFeeAccounts(
      connection,
      new PublicKey('YOUR_FEE_ACCOUNT_OWNER')
    ),
  },
});

// Get route map
const routeMap = jupiter.getRouteMap();

// Compute routes
const routes = await jupiter.computeRoutes({
  inputMint: new PublicKey(inputToken.address),
  outputMint: new PublicKey(outputToken.address),
  amount: JSBI.BigInt(amountInLamports),
  slippageBps: 100,
  forceFetch: true,
});

// Execute swap
const { execute } = await jupiter.exchange({
  routeInfo: routes.routesInfos[0],
});
const result = await execute();
```

#### 3. @jup-ag/react-hook

For React applications:

```bash
npm install @jup-ag/react-hook
```

```typescript
import { useJupiter } from '@jup-ag/react-hook';

function SwapComponent() {
  const { 
    exchange, 
    routes, 
    loading,
    refresh 
  } = useJupiter({
    amount: inputAmount,
    inputMint,
    outputMint,
    slippage: 1,
  });

  const handleSwap = async () => {
    const result = await exchange();
  };
}
```

### Token List URLs

```typescript
const TOKEN_LIST_URL = {
  'mainnet-beta': 'https://token.jup.ag/all',
  'devnet': 'https://token.jup.ag/devnet/all',
};

// Strict list (verified tokens only)
const STRICT_LIST = 'https://token.jup.ag/strict';
```

---

## 9. Integration Patterns

### Basic Swap Flow

```typescript
import { createJupiterApiClient } from '@jup-ag/api';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const jupiterApi = createJupiterApiClient();

async function swap(
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number
) {
  // 1. Get quote
  const quote = await jupiterApi.quoteGet({
    inputMint,
    outputMint,
    amount,
    slippageBps: 100,
  });

  // 2. Get swap transaction
  const swapResponse = await jupiterApi.swapPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 1000000,
          priorityLevel: 'high',
        },
      },
    },
  });

  // 3. Deserialize and sign
  const txBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([wallet]);

  // 4. Simulate first
  const simulation = await connection.simulateTransaction(tx, {
    replaceRecentBlockhash: true,
    commitment: 'processed',
  });

  if (simulation.value.err) {
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  // 5. Send transaction
  const txid = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  // 6. Confirm
  await connection.confirmTransaction(txid, 'confirmed');
  
  return txid;
}
```

### Batching Multiple Swaps

Use `/swap-instructions` to combine multiple swaps:

```typescript
async function batchSwaps(swapConfigs: SwapConfig[]) {
  const allInstructions = [];
  const allALTs: string[] = [];

  // Collect instructions for all swaps
  for (const config of swapConfigs) {
    const quote = await jupiterApi.quoteGet(config);
    
    const instructions = await jupiterApi.swapInstructionsPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toBase58(),
      },
    });

    allInstructions.push(
      ...instructions.setupInstructions,
      instructions.swapInstruction,
      ...(instructions.cleanupInstruction ? [instructions.cleanupInstruction] : [])
    );
    
    allALTs.push(...instructions.addressLookupTableAddresses);
  }

  // Build single transaction with all instructions
  // Note: May hit transaction size limits
}
```

### Error Handling

```typescript
import { ResponseError } from '@jup-ag/api';

try {
  const quote = await jupiterApi.quoteGet({
    inputMint: "...",
    amount: 35281.123, // Decimal - will fail!
    outputMint: "...",
  });
} catch (e) {
  if (e instanceof ResponseError) {
    const errorBody = await e.response.json();
    console.error('API Error:', errorBody);
  }
}
```

### Transaction Sending Best Practices

From Jupiter docs:

```typescript
// Use RPC providers with staked SOL (Helius, Triton)
const connection = new Connection(process.env.HELIUS_RPC_URL);

// Skip preflight for faster landing
const txid = await connection.sendRawTransaction(tx.serialize(), {
  skipPreflight: true,
  maxRetries: 3,
});

// Use commitment levels appropriately
await connection.confirmTransaction(txid, 'confirmed');
```

---

## 10. Fees & Priority Fees

### Fee Structure

#### Platform Fees (Integrators)
```typescript
// In quote request
const quote = await jupiterApi.quoteGet({
  ...params,
  platformFeeBps: 50, // 0.5% platform fee
});

// In swap request - provide fee account
const swap = await jupiterApi.swapPost({
  swapRequest: {
    ...params,
    feeAccount: 'YOUR_FEE_TOKEN_ACCOUNT', // Must be input or output mint
  },
});
```

#### Priority Fees

Three methods to set priority fees:

```typescript
// Method 1: Priority Level with Max
prioritizationFeeLamports: {
  priorityLevelWithMaxLamports: {
    priorityLevel: 'veryHigh', // min, low, medium, high, veryHigh
    maxLamports: 10000000,      // Max willing to pay
  },
}

// Method 2: Jito Tips
prioritizationFeeLamports: {
  jitoTipLamports: 10000, // Direct Jito tip
}

// Method 3: Jito Tips with Custom Payer
prioritizationFeeLamports: {
  jitoTipLamportsWithPayer: {
    lamports: 10000,
    payer: 'PAYER_PUBLIC_KEY',
  },
}

// Method 4: Direct Compute Unit Price
computeUnitPriceMicroLamports: 100000, // Manual price
```

### Fee Calculation

```
Total Fee = (computeUnitLimit × computeUnitPriceMicroLamports) / 1_000_000

Example:
- computeUnitLimit: 1,400,000 (default max)
- computeUnitPriceMicroLamports: 100,000
- Fee = 1,400,000 × 100,000 / 1,000,000 = 140,000 lamports = 0.00014 SOL
```

### Dynamic Compute Unit Limit

```typescript
// Recommended: Let Jupiter optimize compute units
dynamicComputeUnitLimit: true,
```

---

## 11. Token List & Registry

### Token List Architecture

Jupiter uses a multi-tiered token list system:

| List | URL | Description |
|------|-----|-------------|
| **All** | `https://token.jup.ag/all` | All tradeable tokens |
| **Strict** | `https://token.jup.ag/strict` | Verified tokens only |
| **Banned** | Internal | Blocked tokens |

### Token List Sources

1. **Original Solana Registry**: Legacy token list
2. **Community Validated**: Tokens validated via `jup-ag/token-list` repo
3. **Wormhole Tokens**: Bridge tokens from Wormhole
4. **Partner APIs**: SolanaFM verified tokens

### Token Data Structure

```typescript
interface Token {
  address: string;     // Mint address
  chainId: number;     // 101 for mainnet
  decimals: number;    // Token decimals
  name: string;        // Full name
  symbol: string;      // Ticker symbol
  logoURI: string;     // Logo URL
  tags?: string[];     // Categories: 'lp-token', 'community', etc.
}
```

### Validation Process

**Note**: As of the latest update, the `jup-ag/token-list` repo is deprecated. Jupiter now uses "Jupiter Verify" (V3 token list system):

- Tokens with organic engagement get discovered
- "Smart likes" on token pages drive verification
- No manual PR submissions required
- Token page: `https://jup.ag/tokens/{MINT_ADDRESS}`

### Fetching Token Lists

```typescript
// All tokens
const allTokens = await fetch('https://token.jup.ag/all').then(r => r.json());

// Strict tokens only
const strictTokens = await fetch('https://token.jup.ag/strict').then(r => r.json());

// Tags help identify token types
const lstTokens = allTokens.filter(t => t.tags?.includes('lst'));
```

---

## 12. Small Amounts & Dust Handling

### Minimum Amounts

Jupiter doesn't enforce strict minimums, but practical limits exist:

1. **Transaction fees**: Swapping tiny amounts may not be economical
2. **DEX minimums**: Individual AMMs may have minimum trade sizes
3. **Rent**: Token accounts require ~0.002 SOL rent

### Amount Specifications

```typescript
// Amount MUST be an integer (smallest units)
const quote = await jupiterApi.quoteGet({
  inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  outputMint: "So11111111111111111111111111111111111111112",
  amount: 1000000, // 1 USDC (6 decimals) ✓
  // amount: 1.5,  // WRONG - will error!
});
```

### Dust Handling

```typescript
// SOL wrapping/unwrapping
wrapAndUnwrapSol: true, // Handles WSOL ↔ native SOL automatically

// Destination accounts
destinationTokenAccount: "...", // Specific output account
nativeDestinationAccount: "...", // For native SOL output
```

### Common Dust Scenarios

| Scenario | Solution |
|----------|----------|
| Leftover WSOL | `wrapAndUnwrapSol: true` unwraps automatically |
| Small remainders | Quote API returns exact `outAmount` |
| Failed partial swaps | Check `simulationError` in response |

---

## Quick Reference

### Common Mints

```typescript
const MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
};
```

### NPM Packages

```bash
npm install @jup-ag/api          # Quote/Swap API client
npm install @jup-ag/core         # Legacy core SDK
npm install @jup-ag/react-hook   # React integration
npm install @jup-ag/dca-sdk      # DCA functionality
npm install @jup-ag/limit-order-sdk  # Limit orders
```

### API Endpoints Summary

```
# Swap API
GET  https://api.jup.ag/swap/v1/quote
POST https://api.jup.ag/swap/v1/swap
POST https://api.jup.ag/swap/v1/swap-instructions
GET  https://api.jup.ag/swap/v1/program-id-to-label

# Price API
GET  https://price.jup.ag/v6/price

# Token Lists
GET  https://token.jup.ag/all
GET  https://token.jup.ag/strict
```

### Resources

- **Developer Docs**: https://dev.jup.ag
- **Station (Main Docs)**: https://station.jup.ag
- **API Portal**: https://portal.jup.ag
- **Discord**: https://discord.gg/jup
- **GitHub**: https://github.com/jup-ag

---

*Research compiled from Jupiter's official GitHub repositories and documentation. Last updated: January 2026.*
