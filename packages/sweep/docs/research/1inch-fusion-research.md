# 1inch Fusion API & Aggregation Protocol - Technical Research

## Table of Contents
1. [Overview](#overview)
2. [Supported Chains](#supported-chains)
3. [API Documentation](#api-documentation)
4. [Fusion Mode - Intent-Based Swaps](#fusion-mode---intent-based-swaps)
5. [SDK & Libraries](#sdk--libraries)
6. [Rate Limits & Pricing](#rate-limits--pricing)
7. [Integration Patterns](#integration-patterns)
8. [Small Amount Handling](#small-amount-handling)
9. [Gas Estimation](#gas-estimation)
10. [Code Examples](#code-examples)

---

## Overview

1inch Fusion is an intent-based, gasless swap protocol that uses Dutch auctions to get users the best execution price. Instead of executing swaps directly, users sign an "intent" (order) that gets filled by professional market makers called **Resolvers**.

**Key Benefits:**
- **Gasless**: Users don't pay gas fees; Resolvers pay gas and are compensated through price arbitrage
- **MEV Protection**: No front-running since orders go through private resolver networks
- **Better Prices**: Dutch auction mechanism ensures competitive pricing
- **Intent-Based**: Users sign what they want, Resolvers figure out how to execute

---

## Supported Chains

The Fusion SDK supports the following EVM networks via `NetworkEnum`:

| Network | Chain ID | Wrapped Native Token |
|---------|----------|---------------------|
| **Ethereum** | 1 | `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2` (WETH) |
| **Polygon** | 137 | `0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270` (WMATIC) |
| **BNB Chain (BSC)** | 56 | `0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c` (WBNB) |
| **Arbitrum** | 42161 | `0x82af49447d8a07e3bd95bd0d56f35241523fbab1` (WETH) |
| **Avalanche** | 43114 | `0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7` (WAVAX) |
| **Optimism** | 10 | `0x4200000000000000000000000000000000000006` (WETH) |
| **Gnosis** | 100 | `0xe91d153e0b41518a2ce8dd3d7944fa863463a97d` (WXDAI) |
| **Coinbase (Base)** | 8453 | `0x4200000000000000000000000000000000000006` (WETH) |
| **Fantom** | 250 | `0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83` (WFTM) |
| **zkSync Era** | 324 | `0x5aea5775959fbc2557cc8789bc1bf90a239d9a91` (WETH) |
| **Linea** | 59144 | `0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f` (WETH) |
| **Sonic** | 146 | `0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38` |
| **Unichain** | 130 | `0x4200000000000000000000000000000000000006` (WETH) |

---

## API Documentation

### Base URLs

| Service | URL |
|---------|-----|
| **REST API** | `https://api.1inch.dev/fusion` |
| **WebSocket** | `wss://api.1inch.dev/fusion/ws` |
| **API Version** | `v2.0` |

### Authentication

All API requests require an `authKey` from the 1inch Developer Portal:
- Register at: https://portal.1inch.dev
- Pass via header or SDK config

### API Endpoints

#### 1. Quoter API (Get Swap Quotes)

**GET Quote:**
```
GET /quoter/v2.0/{chainId}/quote/receive/
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromTokenAddress` | string | ✓ | Source token address |
| `toTokenAddress` | string | ✓ | Destination token address |
| `amount` | string | ✓ | Amount in smallest denomination (wei) |
| `walletAddress` | string | ✓ | User's wallet address |
| `enableEstimate` | boolean | | Enable gas estimation |
| `permit` | string | | EIP-2612 permit signature |
| `fee` | number | | Integrator fee in bps |
| `source` | string | | Tracking identifier |
| `isPermit2` | boolean | | Use Permit2 for approval |
| `surplus` | boolean | | Enable surplus mode (default: true) |
| `slippage` | number | | Slippage tolerance 1-50% |

**Response Structure:**
```typescript
type QuoterResponse = {
    fromTokenAmount: string;
    toTokenAmount: string;
    presets: {
        fast: PresetData;
        medium: PresetData;
        slow: PresetData;
        custom?: PresetData;
    };
    recommended_preset: 'fast' | 'medium' | 'slow';
    prices: { usd: { fromToken: string; toToken: string } };
    volume: { usd: { fromToken: string; toToken: string } };
    settlementAddress: string;
    whitelist: string[];  // Resolver addresses
    quoteId: string | null;
    autoK: number;  // Auto-calculated slippage
    fee: {
        whitelistDiscountPercent: number;
        receiver: string;
        bps: number;
    };
    marketAmount: string;
    integratorFee: number;
    integratorFeeReceiver?: string;
    integratorFeeShare: number;
    nativeOrderFactoryAddress?: string;
    nativeOrderImplAddress?: string;
}

type PresetData = {
    auctionDuration: number;      // Seconds
    startAuctionIn: number;       // Delay before auction starts
    bankFee: string;
    initialRateBump: number;      // Starting price bump
    auctionStartAmount: string;   // Best price at start
    auctionEndAmount: string;     // Minimum acceptable price
    tokenFee: string;
    points: AuctionPoint[];
    allowPartialFills: boolean;
    allowMultipleFills: boolean;
    exclusiveResolver: string | null;
    gasCost: {
        gasBumpEstimate: number;
        gasPriceEstimate: string;
    };
}
```

**POST Quote with Custom Preset:**
```
POST /quoter/v2.0/{chainId}/quote/receive/
```

**Body:**
```typescript
{
    customPreset: {
        auctionDuration: number;
        auctionStartAmount: string;
        auctionEndAmount: string;
        points?: Array<{ toTokenAmount: string; delay: number }>;
    }
}
```

#### 2. Relayer API (Submit Orders)

**Submit Single Order:**
```
POST /relayer/v2.0/{chainId}/order/submit
```

**Submit Batch Orders:**
```
POST /relayer/v2.0/{chainId}/order/submit/many
```

**Request Body:**
```typescript
type RelayerRequest = {
    order: LimitOrderV4Struct;
    signature: string;
    quoteId: string;
    extension: string;
}
```

#### 3. Orders API (Query Orders)

**Get Active Orders:**
```
GET /orders/v2.0/{chainId}/order/active/
```

Query params: `page`, `limit` (1-500)

**Get Order Status:**
```
GET /orders/v2.0/{chainId}/order/status/{orderHash}
```

**Get Orders by Maker:**
```
GET /orders/v2.0/{chainId}/order/maker/{address}/
```

**Order Status Enum:**
```typescript
enum OrderStatus {
    Pending = 'pending',
    Filled = 'filled',
    FalsePredicate = 'false-predicate',
    NotEnoughBalanceOrAllowance = 'not-enough-balance-or-allowance',
    Expired = 'expired',
    PartiallyFilled = 'partially-filled',
    WrongPermit = 'wrong-permit',
    Cancelled = 'cancelled',
    InvalidSignature = 'invalid-signature'
}
```

#### 4. WebSocket API (Real-time Updates)

**Connection:**
```typescript
const ws = new WebSocketApi({
    url: 'wss://api.1inch.dev/fusion/ws',
    network: NetworkEnum.ETHEREUM,
    authKey: 'your-auth-key'
})
```

**Events:**
- `order.created` - New order placed
- `order.filled` - Order fully filled
- `order.filled_partially` - Partial fill
- `order.cancelled` - Order cancelled
- `order.invalid` - Order became invalid
- `order.balance_or_allowance_change` - Balance/allowance changed

**RPC Methods:**
- `ping` - Healthcheck
- `getAllowedMethods` - List available methods
- `getActiveOrders` - Get active orders

---

## Fusion Mode - Intent-Based Swaps

### How Dutch Auctions Work

1. **Order Creation**: User signs an intent specifying tokens, amounts, and auction parameters
2. **Auction Start**: Price starts at `auctionStartAmount` (better than market)
3. **Price Decay**: Price decreases over `auctionDuration` toward `auctionEndAmount`
4. **Resolution**: First resolver to accept the current price executes the swap
5. **Settlement**: User receives tokens, resolver keeps the spread

```
Price
  ^
  |  auctionStartAmount
  |  ___________
  |             \
  |              \
  |               \
  |                \_____ auctionEndAmount
  +-----------------------> Time
  0    startAuctionIn + auctionDuration
```

### Auction Parameters

```typescript
const auctionDetails = new AuctionDetails({
    duration: 180n,           // 3 minutes auction
    startTime: BigInt(Math.floor(Date.now() / 1000)) + 12n, // Start in 12s
    initialRateBump: 50000,   // 5% starting premium
    points: [                 // Price decay curve
        { delay: 60, coefficient: 30000 },   // After 60s, 3% bump
        { delay: 120, coefficient: 10000 }   // After 120s, 1% bump
    ],
    gasCost: {
        gasBumpEstimate: 0n,
        gasPriceEstimate: 0n
    }
});
```

### Resolver Whitelist

Orders include a whitelist of approved resolvers who can fill them:

```typescript
const whitelist = Whitelist.new(0n, [
    { address: resolverAddress1, allowFrom: 0n },      // Can fill immediately
    { address: resolverAddress2, allowFrom: startTime } // Can fill after startTime
]);
```

**Exclusive Resolver**: One resolver can have exclusive rights at auction start, then opens to others.

### Fee Structure

```typescript
const fees = new Fees(
    // Resolver fee (goes to protocol)
    new ResolverFee(
        protocolAddress,
        Bps.fromPercent(1)  // 1% resolver fee
    ),
    // Integrator fee (split between integrator and protocol)
    new IntegratorFee(
        integratorAddress,
        protocolAddress,
        Bps.fromPercent(0.1),   // 0.1% total fee
        Bps.fromPercent(50)     // 50% goes to integrator
    )
);
```

### Native Asset Swaps (ETH, BNB, MATIC)

For swapping FROM native assets:

1. User creates order with native factory
2. ETH is deposited and wrapped to WETH in a clone contract
3. Clone contract acts as the maker
4. After fill, clone unwraps WETH back to ETH for receiver

```typescript
// Order from native asset
const nativeOrder = FusionOrder.fromNative(
    chainId,
    nativeOrderFactory,
    settlementExtension,
    orderInfo,
    details,
    extra
);
```

---

## SDK & Libraries

### Official SDK

**Package:** `@1inch/fusion-sdk`

**Installation:**
```bash
npm install @1inch/fusion-sdk
# or
yarn add @1inch/fusion-sdk
```

**Dependencies:**
- `@1inch/limit-order-sdk` - Core limit order protocol
- `ethers` v6+ - Ethereum interactions
- `axios` - HTTP client (default, replaceable)

### SDK Initialization

```typescript
import { 
    FusionSDK, 
    NetworkEnum, 
    PrivateKeyProviderConnector,
    Web3Like
} from '@1inch/fusion-sdk';
import { JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider(NODE_URL);

const web3Like: Web3Like = {
    eth: {
        call(transactionConfig): Promise<string> {
            return provider.call(transactionConfig);
        }
    },
    extend(): void {}
};

const connector = new PrivateKeyProviderConnector(
    PRIVATE_KEY,
    web3Like
);

const sdk = new FusionSDK({
    url: 'https://api.1inch.dev/fusion',
    network: NetworkEnum.ETHEREUM,
    blockchainProvider: connector,
    authKey: 'YOUR_API_KEY'
});
```

### Custom HTTP Provider

```typescript
import { HttpProviderConnector } from '@1inch/fusion-sdk';

class CustomHttpProvider implements HttpProviderConnector {
    get<T>(url: string): Promise<T> {
        return myApiClient.get(url);
    }
    post<T>(url: string, data: unknown): Promise<T> {
        return myApiClient.post(url, data);
    }
}

const sdk = new FusionSDK({
    url: 'https://api.1inch.dev/fusion',
    network: NetworkEnum.ETHEREUM,
    httpProvider: new CustomHttpProvider()
});
```

### SDK Methods

| Method | Description |
|--------|-------------|
| `getQuote(params)` | Get swap quote with presets |
| `getQuoteWithCustomPreset(params, body)` | Get quote with custom auction params |
| `createOrder(params)` | Create order from quote |
| `submitOrder(order, quoteId)` | Submit ERC20 order to relayer |
| `submitNativeOrder(order, maker, quoteId)` | Submit native asset order |
| `placeOrder(params)` | Convenience: create + submit |
| `getActiveOrders(params)` | List active orders |
| `getOrderStatus(orderHash)` | Get order status |
| `getOrdersByMaker(params)` | Get orders by maker address |
| `buildCancelOrderCallData(orderHash)` | Get cancellation calldata |

---

## Rate Limits & Pricing

### Developer Portal Tiers

Access the 1inch Developer Portal: https://portal.1inch.dev

**Typical Rate Limits (subject to change):**
- Free tier: Limited RPS
- Paid tiers: Higher RPS based on plan
- Enterprise: Custom limits

### Partner/Integrator Programs

**Integrator Fee:**
```typescript
const integratorFee = {
    receiver: new Address('YOUR_FEE_RECEIVER'),
    value: new Bps(100n),        // 1% (100 bps = 1%)
    share: Bps.fromPercent(50)   // You keep 50%, protocol gets 50%
};

const quote = await sdk.getQuote({
    fromTokenAddress: DAI,
    toTokenAddress: WETH,
    amount: '1000000000000000000000',
    walletAddress: USER_ADDRESS,
    integratorFee
});
```

---

## Integration Patterns

### Basic Swap Flow

```typescript
// 1. Get Quote
const quote = await sdk.getQuote({
    fromTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',   // WETH
    amount: '1000000000000000000000', // 1000 DAI
    walletAddress: userAddress
});

console.log('Expected output:', quote.toTokenAmount);
console.log('Recommended preset:', quote.recommendedPreset);
console.log('Presets:', quote.presets);

// 2. Create Order
const order = quote.createFusionOrder({
    network: NetworkEnum.ETHEREUM,
    preset: PresetEnum.fast,         // or 'medium', 'slow'
    receiver: recipientAddress,      // Optional: different receiver
    nonce: customNonce,              // Optional: for batch cancellation
    allowPartialFills: true,
    allowMultipleFills: true
});

// 3. Sign & Submit
const signature = await connector.signTypedData(
    userAddress,
    order.getTypedData(NetworkEnum.ETHEREUM)
);

const result = await sdk.submitOrder(order, quote.quoteId);
console.log('Order hash:', result.orderHash);

// 4. Monitor Status
const status = await sdk.getOrderStatus(result.orderHash);
console.log('Status:', status.status);
```

### Batch Multiple Swaps

```typescript
// For multiple swaps, use submitBatch on the relayer API directly
const orders = await Promise.all(
    swapParams.map(async (params) => {
        const quote = await sdk.getQuote(params);
        const order = quote.createFusionOrder({ network, preset: PresetEnum.fast });
        const signature = await connector.signTypedData(address, order.getTypedData(network));
        return RelayerRequest.new({
            order: order.build(),
            signature,
            quoteId: quote.quoteId,
            extension: order.extension.encode()
        });
    })
);

// Submit batch
await sdk.api.relayerApi.submitBatch(orders);
```

### Custom Auction Parameters

```typescript
const quote = await sdk.getQuoteWithCustomPreset(
    {
        fromTokenAddress: DAI,
        toTokenAddress: WETH,
        amount: '1000000000000000000000',
        walletAddress: userAddress
    },
    {
        customPreset: {
            auctionDuration: 300,        // 5 minutes
            auctionStartAmount: '620000000000000000', // Optimistic start
            auctionEndAmount: '600000000000000000',   // Minimum acceptable
            points: [
                { toTokenAmount: '615000000000000000', delay: 60 },
                { toTokenAmount: '610000000000000000', delay: 120 },
                { toTokenAmount: '605000000000000000', delay: 180 }
            ]
        }
    }
);
```

### Permit2 Integration

```typescript
// Enable Permit2 for single approval
const quote = await sdk.getQuote({
    fromTokenAddress: tokenAddress,
    toTokenAddress: outputToken,
    amount: amount,
    walletAddress: userAddress,
    isPermit2: true  // Use Permit2
});

const order = quote.createFusionOrder({
    network: NetworkEnum.ETHEREUM,
    // isPermit2 is automatically carried from quote params
});
```

### Order Cancellation

```typescript
// Get cancellation calldata
const cancelData = await sdk.buildCancelOrderCallData(orderHash);

// Execute cancellation on-chain
const tx = await signer.sendTransaction({
    to: ONE_INCH_LIMIT_ORDER_V4,
    data: cancelData
});
```

---

## Small Amount Handling

### Minimum Amounts

The Fusion protocol doesn't have explicit minimums, but practical considerations:

1. **Gas Economics**: Resolvers need profit > gas costs
2. **Slippage on Small Amounts**: Higher relative slippage
3. **Preset Selection**: `slow` preset allows more time for small orders

**Best Practices for Small Swaps:**

```typescript
const quote = await sdk.getQuote({
    fromTokenAddress: token,
    toTokenAddress: outputToken,
    amount: smallAmount,
    walletAddress: userAddress,
    enableEstimate: true  // Get gas estimates
});

// Check if viable
const gasCost = quote.presets.slow.gasCost;
const spread = BigInt(quote.presets.slow.auctionStartAmount) - 
               BigInt(quote.presets.slow.auctionEndAmount);

// Use slow preset for small amounts (more time for resolvers)
const order = quote.createFusionOrder({
    network,
    preset: PresetEnum.slow,
    allowPartialFills: false,  // Atomic for small amounts
    allowMultipleFills: false
});
```

### Low Liquidity Tokens

For tokens with limited liquidity:
- Wider auction spreads needed
- Longer auction duration
- May fall back to partial fills

```typescript
const customPreset = {
    auctionDuration: 600,  // 10 minutes for illiquid tokens
    auctionStartAmount: marketAmount * 105n / 100n,  // 5% premium
    auctionEndAmount: marketAmount * 90n / 100n,     // 10% discount acceptable
};
```

---

## Gas Estimation

### Quote-Time Estimation

```typescript
const quote = await sdk.getQuote({
    fromTokenAddress: DAI,
    toTokenAddress: WETH,
    amount: amount,
    walletAddress: userAddress,
    enableEstimate: true  // Enable gas estimation
});

// Access gas cost info from preset
const preset = quote.getPreset(PresetEnum.fast);
console.log('Gas bump estimate:', preset.gasCostInfo.gasBumpEstimate);
console.log('Gas price estimate:', preset.gasCostInfo.gasPriceEstimate);
```

### Auction Calculator

The SDK includes an `AuctionCalculator` for computing auction amounts at any time:

```typescript
import { AuctionCalculator, AuctionDetails } from '@1inch/fusion-sdk';

const auctionDetails = new AuctionDetails({
    startTime: auctionStartTime,
    initialRateBump: 50000,
    duration: 180n,
    points: [],
    gasCost: {
        gasBumpEstimate: gasEstimate,
        gasPriceEstimate: gasPriceEstimate
    }
});

const calculator = AuctionCalculator.fromAuctionData(auctionDetails);

// Calculate rate bump at specific time
const currentTime = BigInt(Math.floor(Date.now() / 1000));
const rateBump = calculator.calcRateBump(currentTime);

// Calculate taking amount with gas bump
const takingAmount = calculator.calcAuctionTakingAmount(
    baseTakingAmount,
    rateBump,
    baseFee  // Optional: current block base fee
);
```

### Gas Cost Structure

```typescript
type GasCostInfo = {
    gasBumpEstimate: bigint;    // Additional taking amount for gas
    gasPriceEstimate: bigint;   // Estimated gas price in wei
};

// Gas bump is added to taking amount to compensate resolvers
const effectiveTakingAmount = baseTakingAmount + gasBumpEstimate;
```

---

## Code Examples

### Complete Swap Example (ERC20)

```typescript
import {
    FusionSDK,
    NetworkEnum,
    PresetEnum,
    PrivateKeyProviderConnector,
    Web3Like
} from '@1inch/fusion-sdk';
import { JsonRpcProvider, Wallet, formatUnits } from 'ethers';

const PRIVATE_KEY = 'YOUR_PRIVATE_KEY';
const NODE_URL = 'YOUR_RPC_URL';
const API_KEY = 'YOUR_1INCH_API_KEY';

async function executeSwap() {
    // Setup provider
    const provider = new JsonRpcProvider(NODE_URL);
    const wallet = new Wallet(PRIVATE_KEY, provider);
    
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
        authKey: API_KEY
    });

    // Get quote
    const params = {
        fromTokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
        toTokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',   // WETH
        amount: '1000000000000000000000', // 1000 DAI
        walletAddress: wallet.address
    };

    const quote = await sdk.getQuote(params);
    
    console.log('Quote received:');
    console.log('  From amount:', formatUnits(quote.fromTokenAmount, 18), 'DAI');
    console.log('  To amount:', formatUnits(quote.toTokenAmount, 18), 'WETH');
    console.log('  Recommended preset:', quote.recommendedPreset);

    const fastPreset = quote.getPreset(PresetEnum.fast);
    console.log('  Auction start:', formatUnits(fastPreset.auctionStartAmount, 18));
    console.log('  Auction end:', formatUnits(fastPreset.auctionEndAmount, 18));
    console.log('  Duration:', fastPreset.auctionDuration.toString(), 'seconds');

    // Create and submit order
    const { order, quoteId, hash } = await sdk.createOrder({
        ...params,
        preset: PresetEnum.fast
    });

    console.log('\nOrder created:');
    console.log('  Hash:', hash);
    console.log('  Quote ID:', quoteId);

    // Submit
    const result = await sdk.submitOrder(order, quoteId);
    console.log('\nOrder submitted:', result.orderHash);

    // Poll for status
    let status;
    do {
        await new Promise(r => setTimeout(r, 5000));
        status = await sdk.getOrderStatus(result.orderHash);
        console.log('Status:', status.status);
    } while (status.status === 'pending');

    console.log('Final status:', status);
}

executeSwap().catch(console.error);
```

### Native Asset Swap Example (ETH to Token)

```typescript
import {
    FusionSDK,
    NetworkEnum,
    PresetEnum,
    PrivateKeyProviderConnector,
    NativeOrdersFactory,
    Address
} from '@1inch/fusion-sdk';
import { JsonRpcProvider, Wallet, formatUnits, parseEther } from 'ethers';

async function swapFromNative() {
    const provider = new JsonRpcProvider(NODE_URL);
    const wallet = new Wallet(PRIVATE_KEY, provider);
    
    // ... connector setup same as above ...
    
    const sdk = new FusionSDK({
        url: 'https://api.1inch.dev/fusion',
        network: NetworkEnum.BINANCE,
        blockchainProvider: connector,
        authKey: API_KEY
    });

    const params = {
        fromTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Native BNB
        toTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',   // USDC
        amount: parseEther('0.1').toString(),
        walletAddress: wallet.address
    };

    const quote = await sdk.getQuote(params);
    
    // Create order (will use native order factory automatically)
    const { order, quoteId, nativeOrderFactory } = await sdk.createOrder({
        ...params,
        preset: PresetEnum.fast
    });

    // For native orders, need to deposit ETH/BNB first
    if (nativeOrderFactory) {
        const factory = new NativeOrdersFactory(
            provider,
            nativeOrderFactory.toString()
        );
        
        // Create the on-chain order with ETH deposit
        const tx = await factory.create(order.build(), {
            value: parseEther('0.1')
        });
        await tx.wait();
        
        // Then submit to relayer
        const signature = order.nativeSignature(new Address(wallet.address));
        await sdk.submitNativeOrder(order, new Address(wallet.address), quoteId);
    }
}
```

### WebSocket Real-time Monitoring

```typescript
import { WebSocketApi, NetworkEnum } from '@1inch/fusion-sdk';

const ws = new WebSocketApi({
    url: 'wss://api.1inch.dev/fusion/ws',
    network: NetworkEnum.ETHEREUM,
    authKey: API_KEY
});

// Subscribe to order events
ws.order.onOrderCreated((event) => {
    console.log('New order:', event.orderHash);
});

ws.order.onOrderFilled((event) => {
    console.log('Order filled:', event.orderHash);
    console.log('Tx hash:', event.txHash);
});

ws.order.onOrderFilledPartially((event) => {
    console.log('Partial fill:', event.orderHash);
    console.log('Filled amount:', event.filledMakerAmount);
});

ws.order.onOrderCancelled((event) => {
    console.log('Order cancelled:', event.orderHash);
});

ws.order.onOrderInvalid((event) => {
    console.log('Order invalid:', event.orderHash, event.reason);
});

// RPC methods
ws.rpc.ping();
ws.rpc.getActiveOrders();

ws.rpc.onPong((data) => {
    console.log('Pong received:', data);
});

ws.rpc.onGetActiveOrders((data) => {
    console.log('Active orders:', data.items.length);
});

// Connection events
ws.onOpen(() => console.log('Connected'));
ws.onClose(() => console.log('Disconnected'));
ws.on('error', (err) => console.error('Error:', err));
```

---

## Contract Addresses

### Limit Order Protocol V4
```
0x111111125421ca6dc452d289314280a0f8842a65
```
(Same across all supported chains)

### Settlement Extension
Retrieved from quote response: `quote.settlementAddress`

### Native Order Factory
Retrieved from quote response: `quote.nativeOrderFactoryAddress`

---

## Related Repositories

| Repository | Description |
|------------|-------------|
| [1inch/fusion-sdk](https://github.com/1inch/fusion-sdk) | Official TypeScript SDK |
| [1inch/limit-order-sdk](https://github.com/1inch/limit-order-sdk) | Core limit order library |
| [1inch/limit-order-protocol](https://github.com/1inch/limit-order-protocol) | Smart contracts |
| [1inch/fusion-resolver-example](https://github.com/1inch/fusion-resolver-example) | Resolver implementation example |
| [1inch/limit-order-settlement](https://github.com/1inch/limit-order-settlement) | Settlement contracts |

---

## Error Handling

Common error codes and handling:

```typescript
try {
    const quote = await sdk.getQuote(params);
} catch (error) {
    if (error.message.includes('fromTokenAddress and toTokenAddress should be different')) {
        // Same token error
    }
    if (error.message.includes('replace 0x000...000 with')) {
        // Use native currency address
    }
    if (error.code === 'INSUFFICIENT_LIQUIDITY') {
        // Not enough liquidity for this pair
    }
}
```

---

## Best Practices Summary

1. **Use recommended preset** unless you have specific requirements
2. **Enable estimation** for accurate gas cost information
3. **Set appropriate slippage** (1-5% typical, higher for volatile tokens)
4. **Allow partial fills** for better execution probability
5. **Use WebSocket** for real-time order monitoring
6. **Implement retry logic** for API calls
7. **Cache quotes** briefly (they expire ~30-60s)
8. **Handle native assets** with the native order factory flow
9. **Set integrator fees** to earn revenue from swaps
10. **Use Permit2** for better UX (single approval)

---

*Last updated: January 2026*
*SDK Version: v2.0*
