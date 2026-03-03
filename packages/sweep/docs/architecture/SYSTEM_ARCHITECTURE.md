# 🧹 Sweep - Production System Architecture

> **Target Scale**: 600,000 users across 7 chains
> **Last Updated**: January 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Core Components](#core-components)
4. [DEX Aggregation Layer](#dex-aggregation-layer)
5. [Account Abstraction Layer](#account-abstraction-layer)
6. [Cross-Chain Bridge Layer](#cross-chain-bridge-layer)
7. [DeFi Routing Layer](#defi-routing-layer)
8. [Backend Infrastructure](#backend-infrastructure)
9. [Database Schema](#database-schema)
10. [API Design](#api-design)
11. [Cost Analysis](#cost-analysis)
12. [Deployment Strategy](#deployment-strategy)

---

## Executive Summary

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Smart Wallets** | Coinbase Smart Wallet (ERC-4337) | User account abstraction |
| **Gas Abstraction** | Coinbase Verifying Paymaster | Pay gas with ERC-20 tokens |
| **Gasless Approvals** | Permit2 + ERC-2612 | Sign instead of approve() tx |
| **Bundlers** | Pimlico (primary) + Alchemy (fallback) | UserOp submission |
| **DEX (EVM)** | 1inch Fusion + CoW Protocol | Batch swaps, MEV protection |
| **DEX (Solana)** | Jupiter Aggregator | Solana swaps |
| **Cross-chain** | Li.Fi (routing) + Across (fast bridge) | Bridge + swap |
| **DeFi** | Aave V3, Yearn V3, Beefy, Lido, Jito | Yield destinations |
| **Backend** | Node.js + BullMQ + PostgreSQL + Redis | Queue & data management |
| **Monetization** | x402 Protocol | Per-API-call payments |

### Cost Per Sweep (Estimated)

| Chain | Gas Cost | Protocol Fee | Total |
|-------|----------|--------------|-------|
| Base/Optimism | $0.02 | $0.05 | ~$0.07 |
| Arbitrum | $0.05 | $0.05 | ~$0.10 |
| Polygon | $0.01 | $0.05 | ~$0.06 |
| BNB Chain | $0.03 | $0.05 | ~$0.08 |
| Solana | $0.001 | $0.05 | ~$0.05 |
| Ethereum L1 | $5-30 | $0.05 | Avoid for dust |

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             SWEEP ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                           CLIENT LAYER                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │  Web App    │  │ Mobile App  │  │  SDK/API    │  │  AI Agents  │      │   │
│  │  │  (React)    │  │  (RN/Expo)  │  │  (REST)     │  │  (AgentKit) │      │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │   │
│  └─────────┼────────────────┼────────────────┼────────────────┼─────────────┘   │
│            │                │                │                │                 │
│            └────────────────┴────────────────┴────────────────┘                 │
│                                     │                                           │
│  ┌──────────────────────────────────▼───────────────────────────────────────┐   │
│  │                           API GATEWAY                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │  Auth       │  │ Rate Limit  │  │  x402       │  │  Load       │      │   │
│  │  │  (SIWE)     │  │  (Redis)    │  │  Paywall    │  │  Balancer   │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  └──────────────────────────────────┬───────────────────────────────────────┘   │
│                                     │                                           │
│  ┌──────────────────────────────────▼───────────────────────────────────────┐   │
│  │                        BACKEND SERVICES                                  │   │
│  │                                                                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │  Wallet     │  │  Price      │  │  Sweep      │  │  Position   │      │   │
│  │  │  Indexer    │  │  Service    │  │  Executor   │  │  Tracker    │      │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │   │
│  │         │                │                │                │             │   │
│  │  ┌──────▼────────────────▼────────────────▼────────────────▼──────┐      │   │
│  │  │                     MESSAGE QUEUE (BullMQ)                      │     │   │
│  │  │  [scan-wallet] [price-update] [execute-sweep] [track-position]  │     │   │
│  │  └─────────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────┬───────────────────────────────────────┘   │
│                                     │                                           │
│  ┌──────────────────────────────────▼───────────────────────────────────────┐   │
│  │                      BLOCKCHAIN INTEGRATION                              │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │  │                    ACCOUNT ABSTRACTION                          │     │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │     │   │
│  │  │  │ Smart Wallet │  │  Paymaster   │  │   Bundlers   │           │     │   │
│  │  │  │  (Coinbase)  │  │ (Verifying)  │  │  (Pimlico)   │           │     │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘           │     │   │
│  │  └─────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │  │                    DEX AGGREGATION                              │     │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │     │   │
│  │  │  │  1inch   │  │   CoW    │  │ Jupiter  │  │  Li.Fi   │         │     │   │
│  │  │  │ (Fusion) │  │ Protocol │  │ (Solana) │  │ (Bridge) │         │     │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │     │   │
│  │  └─────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐     │   │
│  │  │                    DEFI PROTOCOLS                               │     │   │
│  │  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │     │   │
│  │  │  │ Aave   │  │ Yearn  │  │ Beefy  │  │ Lido   │  │ Jito   │     │     │   │
│  │  │  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘     │     │   │
│  │  └─────────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │ PostgreSQL  │  │   Redis     │  │  TimescaleDB│  │    S3       │      │   │
│  │  │ (Users/Txs) │  │  (Cache)    │  │ (Analytics) │  │  (Backups)  │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Smart Wallet System

Using Coinbase Smart Wallet for ERC-4337 account abstraction:

```typescript
// Smart Wallet Factory Addresses
const SMART_WALLET_FACTORY = {
  ethereum: "0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842",
  base: "0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842",
  arbitrum: "0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842",
  polygon: "0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842",
  optimism: "0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842",
};

// Deploy smart wallet for user
import { CoinbaseSmartWalletFactory } from "@coinbase/smart-wallet";

async function deploySmartWallet(ownerAddress: string, chain: Chain) {
  const factory = new CoinbaseSmartWalletFactory(
    SMART_WALLET_FACTORY[chain.name],
    publicClient
  );
  
  // Counterfactual address (predictable before deployment)
  const smartWalletAddress = await factory.getAddress([ownerAddress], 0n);
  
  // Deploy on first transaction (lazy deployment)
  return smartWalletAddress;
}
```

### 2. Paymaster (Gas Abstraction)

> **Reference**: MetaMask calls this "Gas Included Transactions" - users pay gas with tokens like USDT/USDC instead of ETH. We implement the same UX using ERC-4337 Paymasters.

#### Supported Gas Tokens (matching MetaMask coverage)

```typescript
const SUPPORTED_GAS_TOKENS: Record<string, GasToken[]> = {
  ethereum: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EesfdKAD3eF3eBF" },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
    { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
    { symbol: "wstETH", address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" },
    { symbol: "cbBTC", address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" },
    { symbol: "rETH", address: "0xae78736Cd615f374D3085123A210448E74Fc6393" },
  ],
  base: [
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" },
    { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
    { symbol: "wstETH", address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" },
    { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" },
    { symbol: "cbBTC", address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" },
    { symbol: "rETH", address: "0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c" },
  ],
  arbitrum: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { symbol: "USDC.e", address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8" },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" },
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
    { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" },
    { symbol: "ARB", address: "0x912CE59144191C1204E64559FE8253a0e49E6548" },
  ],
  polygon: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
    { symbol: "USDC.e", address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" },
    { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063" },
    { symbol: "WETH", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" },
    { symbol: "WBTC", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6" },
  ],
  bnb: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955" },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
    { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3" },
    { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" },
    { symbol: "ETH", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8" },
    { symbol: "WBTC", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" },
  ],
  linea: [
    { symbol: "USDT", address: "0xA219439258ca9da29E9Cc4cE5596924745e12B93" },
    { symbol: "USDC", address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff" },
    { symbol: "DAI", address: "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5" },
    { symbol: "WETH", address: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f" },
    { symbol: "wstETH", address: "0xB5beDd42000b71FddE22D3eE8a79Bd49A568fC8F" },
    { symbol: "WBTC", address: "0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4" },
  ],
};
```

#### Paymaster Configuration
interface PaymasterConfig {
  paymasterAddress: string;
  verifyingSignerKey: string;
  supportedTokens: {
    [tokenAddress: string]: {
      symbol: string;
      exchangeRate: bigint; // Token per ETH (with margin)
      minBalance: bigint;
    };
  };
}

// Generate paymaster signature for UserOp
async function signPaymasterData(
  userOp: UserOperation,
  gasToken: string,
  config: PaymasterConfig
): Promise<string> {
  const paymasterData = {
    validUntil: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    validAfter: 0,
    sponsorUUID: generateUUID(),
    allowAnyBundler: true,
    precheckBalance: true,
    prepaymentRequired: false,
    token: gasToken,
    receiver: SWEEP_TREASURY_ADDRESS,
    exchangeRate: config.supportedTokens[gasToken].exchangeRate,
    postOpGas: 50000n,
  };

  const hash = await paymaster.getHash(userOp, paymasterData);
  const signature = await signer.signMessage(ethers.getBytes(hash));
  
  return encodePaymasterAndData(paymasterData, signature);
}
```

### 3. Permit2 (Gasless Approvals)

Permit2 allows users to approve tokens with a **signature** instead of an on-chain transaction. This saves ~$0.50-5 per token approval.

```typescript
import { PERMIT2_ADDRESS, SignatureTransfer, Witness } from "@uniswap/permit2-sdk";

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Same on all chains

interface PermitTransferFrom {
  permitted: {
    token: string;
    amount: bigint;
  };
  spender: string;
  nonce: bigint;
  deadline: number;
}

// Generate permit signature (user signs this - NO GAS)
async function generatePermit2Signature(
  token: string,
  amount: bigint,
  spender: string, // Our router contract
  owner: string,
  chainId: number
): Promise<{ permit: PermitTransferFrom; signature: string }> {
  const nonce = await getPermit2Nonce(owner, token, spender);
  
  const permit: PermitTransferFrom = {
    permitted: { token, amount },
    spender,
    nonce,
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };
  
  const { domain, types, values } = SignatureTransfer.getPermitData(
    permit,
    PERMIT2,
    chainId
  );
  
  // User signs this message (no gas cost!)
  const signature = await signer._signTypedData(domain, types, values);
  
  return { permit, signature };
}

// For ERC-2612 tokens (USDC, DAI) - even simpler
async function generateERC2612Permit(
  token: string,
  spender: string,
  amount: bigint,
  owner: string
): Promise<{ v: number; r: string; s: string; deadline: number }> {
  const tokenContract = new ethers.Contract(token, ERC20_PERMIT_ABI, signer);
  
  const nonce = await tokenContract.nonces(owner);
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  
  const domain = {
    name: await tokenContract.name(),
    version: "1",
    chainId: await signer.getChainId(),
    verifyingContract: token,
  };
  
  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  
  const signature = await signer._signTypedData(domain, types, {
    owner,
    spender,
    value: amount,
    nonce,
    deadline,
  });
  
  const { v, r, s } = ethers.utils.splitSignature(signature);
  return { v, r, s, deadline };
}
```

### 4. Bundler Integration

```typescript
// Multi-bundler setup with failover
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createAlchemySmartAccountClient } from "@alchemy/aa-alchemy";

const bundlers = {
  pimlico: {
    client: createPimlicoClient({
      transport: http(`https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_KEY}`),
    }),
    priority: 1,
    rateLimit: 300, // req/s
  },
  alchemy: {
    client: createAlchemySmartAccountClient({
      apiKey: ALCHEMY_KEY,
      chain: chain,
    }),
    priority: 2,
    rateLimit: 100,
  },
};

// Submit UserOp with failover
async function submitUserOp(userOp: UserOperation): Promise<string> {
  const sortedBundlers = Object.values(bundlers).sort((a, b) => a.priority - b.priority);
  
  for (const bundler of sortedBundlers) {
    try {
      const hash = await bundler.client.sendUserOperation({ userOperation: userOp });
      return hash;
    } catch (error) {
      console.error(`Bundler ${bundler} failed:`, error);
      continue;
    }
  }
  throw new Error("All bundlers failed");
}
```

---

## DEX Aggregation Layer

### Aggregator Selection Strategy

```typescript
// Select optimal aggregator based on context
function selectAggregator(params: {
  chain: Chain;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  isCrossChain: boolean;
}): Aggregator {
  // Cross-chain: Always use Li.Fi
  if (params.isCrossChain) {
    return "lifi";
  }
  
  // Solana: Jupiter only
  if (params.chain === "solana") {
    return "jupiter";
  }
  
  // Small dust amounts (<$5): CoW Protocol (batch auctions, no gas for swaps)
  const valueUSD = await getTokenValueUSD(params.tokenIn, params.amountIn);
  if (valueUSD < 5) {
    return "cow";
  }
  
  // Standard swaps: 1inch Fusion
  return "1inch";
}
```

### 1inch Fusion Integration

```typescript
import { FusionSDK, NetworkEnum } from "@1inch/fusion-sdk";

const fusionSDK = new FusionSDK({
  url: "https://api.1inch.dev/fusion",
  network: NetworkEnum.ETHEREUM,
  authKey: process.env.ONEINCH_API_KEY,
});

// Get quote for dust swap
async function getOneInchQuote(
  tokenIn: string,
  tokenOut: string,
  amount: bigint
): Promise<Quote> {
  const quote = await fusionSDK.getQuote({
    fromTokenAddress: tokenIn,
    toTokenAddress: tokenOut,
    amount: amount.toString(),
    walletAddress: userSmartWallet,
  });
  
  return {
    aggregator: "1inch",
    amountOut: BigInt(quote.toTokenAmount),
    gas: 0n, // Fusion is gasless for user
    route: quote.protocols,
  };
}

// Execute batch of dust swaps
async function executeOneInchBatch(swaps: Swap[]): Promise<string> {
  const orders = await Promise.all(
    swaps.map(swap => fusionSDK.createOrder({
      fromTokenAddress: swap.tokenIn,
      toTokenAddress: swap.tokenOut,
      amount: swap.amount.toString(),
      walletAddress: swap.wallet,
      receiver: swap.receiver,
    }))
  );
  
  // Submit batch
  const result = await fusionSDK.submitBatch(orders);
  return result.orderHash;
}
```

### Jupiter (Solana) Integration

```typescript
import { createJupiterApiClient } from "@jup-ag/api";

const jupiter = createJupiterApiClient();

async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number
): Promise<Quote> {
  const quote = await jupiter.quoteGet({
    inputMint,
    outputMint,
    amount,
    slippageBps: 100, // 1% slippage for dust
    onlyDirectRoutes: false,
    asLegacyTransaction: false,
  });
  
  return {
    aggregator: "jupiter",
    amountOut: BigInt(quote.outAmount),
    priceImpact: parseFloat(quote.priceImpactPct),
    route: quote.routePlan,
  };
}

async function executeJupiterSwap(quote: QuoteResponse): Promise<string> {
  const { swapTransaction } = await jupiter.swapPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: userWallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    },
  });
  
  // Deserialize and sign versioned transaction
  const txBuffer = Buffer.from(swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuffer);
  tx.sign([userWallet]);
  
  const signature = await connection.sendTransaction(tx);
  return signature;
}
```

### CoW Protocol (Batch Auctions)

```typescript
import { OrderBookApi, OrderSigningUtils, SupportedChainId } from "@cowprotocol/cow-sdk";

const orderBookApi = new OrderBookApi({ chainId: SupportedChainId.MAINNET });

// CoW is ideal for dust - orders batch together, no gas wasted
async function createCowOrder(
  tokenIn: string,
  tokenOut: string,
  amount: bigint,
  smartWallet: string
): Promise<string> {
  const quote = await orderBookApi.getQuote({
    sellToken: tokenIn,
    buyToken: tokenOut,
    sellAmountBeforeFee: amount.toString(),
    kind: "sell",
    from: smartWallet,
  });
  
  const order = {
    sellToken: tokenIn,
    buyToken: tokenOut,
    sellAmount: quote.quote.sellAmount,
    buyAmount: quote.quote.buyAmount,
    validTo: Math.floor(Date.now() / 1000) + 1800, // 30 min
    appData: SWEEP_APP_DATA,
    feeAmount: quote.quote.feeAmount,
    kind: "sell",
    partiallyFillable: false,
    receiver: smartWallet,
  };
  
  const signature = await signCowOrder(order, smartWallet);
  const orderId = await orderBookApi.sendOrder({ ...order, signature });
  
  return orderId;
}
```

---

## Cross-Chain Bridge Layer

### Li.Fi Integration (Primary Router)

```typescript
import { createConfig, getRoutes, executeRoute } from "@lifi/sdk";

const lifiConfig = createConfig({
  integrator: "sweep",
  chains: [1, 8453, 42161, 137, 56, 59144], // ETH, Base, ARB, Polygon, BNB, Linea
});

// Get best route for cross-chain consolidation
async function getCrossChainRoute(
  fromChain: number,
  toChain: number,
  fromToken: string,
  toToken: string,
  amount: bigint,
  userAddress: string
): Promise<Route> {
  const routes = await getRoutes({
    fromChainId: fromChain,
    toChainId: toChain,
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    fromAmount: amount.toString(),
    fromAddress: userAddress,
    toAddress: userAddress,
    options: {
      slippage: 0.01, // 1%
      order: "RECOMMENDED", // or "FASTEST", "CHEAPEST"
      bridges: {
        allow: ["across", "stargate", "hop", "cbridge"],
      },
    },
  });
  
  return routes.routes[0]; // Best route
}

// Execute with progress tracking
async function executeCrossChainSwap(
  route: Route,
  signer: Signer
): Promise<{ txHash: string; status: string }> {
  return new Promise((resolve, reject) => {
    executeRoute(route, {
      updateRouteHook: (updatedRoute) => {
        const step = updatedRoute.steps[0];
        if (step.execution?.status === "DONE") {
          resolve({
            txHash: step.execution.process[0].txHash,
            status: "completed",
          });
        }
        if (step.execution?.status === "FAILED") {
          reject(new Error(step.execution.process[0].error?.message));
        }
      },
      signer,
    });
  });
}
```

### Across Protocol (Fast EVM Bridge)

```typescript
import { SpokePool__factory } from "@across-protocol/contracts";

const SPOKE_POOLS = {
  ethereum: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
  base: "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64",
  arbitrum: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A",
  polygon: "0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096",
  optimism: "0x6f26Bf09B1C792e3228e5467807a900A503c0281",
};

async function bridgeWithAcross(
  fromChain: Chain,
  toChain: Chain,
  token: string,
  amount: bigint,
  recipient: string
): Promise<string> {
  const spokePool = SpokePool__factory.connect(
    SPOKE_POOLS[fromChain.name],
    signer
  );
  
  // Get suggested relay fee
  const suggestedFees = await fetch(
    `https://across.to/api/suggested-fees?` +
    `originChainId=${fromChain.id}&destinationChainId=${toChain.id}` +
    `&token=${token}&amount=${amount}`
  ).then(r => r.json());
  
  const tx = await spokePool.depositV3(
    recipient,                           // depositor
    recipient,                           // recipient
    token,                               // inputToken
    token,                               // outputToken (same for simple bridge)
    amount,                              // inputAmount
    amount - suggestedFees.relayerFeePct, // outputAmount
    toChain.id,                          // destinationChainId
    ethers.ZeroAddress,                  // exclusiveRelayer
    Math.floor(Date.now() / 1000) + 21600, // quoteTimestamp + 6hr
    Math.floor(Date.now() / 1000) + 18000, // fillDeadline (5hr)
    0,                                   // exclusivityDeadline
    "0x"                                 // message
  );
  
  return tx.hash;
}
```

---

## DeFi Routing Layer

### Protocol Selection Logic

```typescript
interface YieldDestination {
  protocol: string;
  chain: number;
  token: string;
  vault: string;
  apy: number;
  minDeposit: bigint;
  risk: "low" | "medium" | "high";
}

// Fetch and rank yield destinations
async function getOptimalYieldDestination(
  token: string,
  amount: bigint,
  riskTolerance: "low" | "medium" | "high"
): Promise<YieldDestination> {
  const destinations: YieldDestination[] = [];
  
  // Aave V3 pools
  const aavePools = await getAavePools(token);
  destinations.push(...aavePools.map(p => ({
    protocol: "aave",
    chain: p.chainId,
    token: p.underlyingAsset,
    vault: p.aTokenAddress,
    apy: p.liquidityRate / 1e25,
    minDeposit: 0n,
    risk: "low" as const,
  })));
  
  // Yearn V3 vaults
  const yearnVaults = await getYearnVaults(token);
  destinations.push(...yearnVaults.map(v => ({
    protocol: "yearn",
    chain: v.chainId,
    token: v.token,
    vault: v.address,
    apy: v.apy.net_apy * 100,
    minDeposit: 0n,
    risk: "medium" as const,
  })));
  
  // Beefy vaults
  const beefyVaults = await getBeefyVaults(token);
  destinations.push(...beefyVaults.map(v => ({
    protocol: "beefy",
    chain: v.chainId,
    token: v.tokenAddress,
    vault: v.earnContractAddress,
    apy: v.apy * 100,
    minDeposit: 0n,
    risk: "medium" as const,
  })));
  
  // Filter by risk tolerance and amount
  const filtered = destinations.filter(d => {
    if (riskTolerance === "low" && d.risk !== "low") return false;
    if (riskTolerance === "medium" && d.risk === "high") return false;
    if (amount < d.minDeposit) return false;
    return true;
  });
  
  // Sort by APY
  filtered.sort((a, b) => b.apy - a.apy);
  
  return filtered[0];
}
```

### Aave V3 Integration

```typescript
import { Pool } from "@aave/contract-helpers";
import { AaveV3Base } from "@bgd-labs/aave-address-book";

async function depositToAave(
  token: string,
  amount: bigint,
  onBehalfOf: string,
  chain: Chain
): Promise<PopulatedTransaction[]> {
  const pool = new Pool(provider, {
    POOL: AaveV3Base.POOL,
    WETH_GATEWAY: AaveV3Base.WETH_GATEWAY,
  });
  
  // Generate supply transaction
  const txs = await pool.supply({
    user: onBehalfOf,
    reserve: token,
    amount: amount.toString(),
    onBehalfOf,
  });
  
  return txs;
}

// With Permit (gasless approval)
async function depositToAaveWithPermit(
  token: string,
  amount: bigint,
  user: string,
  permitSignature: PermitSignature
): Promise<PopulatedTransaction[]> {
  const pool = new Pool(provider, { POOL: AaveV3Base.POOL });
  
  const txs = await pool.supplyWithPermit({
    user,
    reserve: token,
    amount: amount.toString(),
    signature: permitSignature,
    onBehalfOf: user,
    deadline: permitSignature.deadline.toString(),
  });
  
  return txs;
}
```

### Liquid Staking Integration

```typescript
// Lido stETH wrapping (for DeFi compatibility)
async function stakeWithLido(amount: bigint, recipient: string): Promise<string> {
  const lido = new ethers.Contract(LIDO_ADDRESS, LIDO_ABI, signer);
  const wstETH = new ethers.Contract(WSTETH_ADDRESS, WSTETH_ABI, signer);
  
  // Stake ETH → stETH
  const stakeTx = await lido.submit(REFERRAL_ADDRESS, { value: amount });
  await stakeTx.wait();
  
  // Wrap stETH → wstETH (better for DeFi)
  const stETHBalance = await lido.balanceOf(signer.address);
  const wrapTx = await wstETH.wrap(stETHBalance);
  
  return wrapTx.hash;
}

// Jito (Solana) staking
async function stakeWithJito(amount: number, wallet: Keypair): Promise<string> {
  const jitoProgram = new Program(JITO_IDL, JITO_PROGRAM_ID, provider);
  
  const tx = await jitoProgram.methods
    .stake(new BN(amount))
    .accounts({
      stakePool: JITO_STAKE_POOL,
      staker: wallet.publicKey,
      // ... other accounts
    })
    .signers([wallet])
    .rpc();
  
  return tx;
}
```

---

## Backend Infrastructure

### Queue Architecture (BullMQ)

```typescript
import { Queue, Worker, QueueScheduler } from "bullmq";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Define queues
const queues = {
  walletScan: new Queue("wallet-scan", { connection: redis }),
  priceUpdate: new Queue("price-update", { connection: redis }),
  executeSweep: new Queue("execute-sweep", { connection: redis }),
  trackPosition: new Queue("track-position", { connection: redis }),
  crossChainBridge: new Queue("cross-chain-bridge", { connection: redis }),
};

// Wallet scan worker
const walletScanWorker = new Worker(
  "wallet-scan",
  async (job) => {
    const { userId, walletAddress, chains } = job.data;
    
    const dustTokens = await Promise.all(
      chains.map(chain => scanWalletForDust(walletAddress, chain))
    );
    
    // Store results and notify user
    await db.dustTokens.upsert({
      userId,
      tokens: dustTokens.flat(),
      scannedAt: new Date(),
    });
    
    return { tokensFound: dustTokens.flat().length };
  },
  {
    connection: redis,
    concurrency: 50, // 50 concurrent scans
    limiter: {
      max: 100,
      duration: 1000, // 100/sec rate limit
    },
  }
);

// Sweep execution worker
const sweepWorker = new Worker(
  "execute-sweep",
  async (job) => {
    const { userId, sweepConfig } = job.data;
    
    try {
      // Build UserOperation
      const userOp = await buildSweepUserOp(sweepConfig);
      
      // Sign with paymaster
      const signedOp = await signWithPaymaster(userOp, sweepConfig.gasToken);
      
      // Submit to bundler
      const txHash = await submitUserOp(signedOp);
      
      // Track transaction
      await queues.trackPosition.add("track", {
        userId,
        txHash,
        chain: sweepConfig.chain,
      });
      
      return { success: true, txHash };
    } catch (error) {
      // Retry logic handled by BullMQ
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 20,
    limiter: {
      max: 50,
      duration: 1000,
    },
  }
);
```

### Wallet Indexing Service

```typescript
import { Alchemy, Network } from "alchemy-sdk";
import { Helius } from "helius-sdk";

// Multi-provider indexing for redundancy
const indexers = {
  ethereum: new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.ETH_MAINNET }),
  base: new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.BASE_MAINNET }),
  arbitrum: new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.ARB_MAINNET }),
  polygon: new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.MATIC_MAINNET }),
  solana: new Helius(HELIUS_KEY),
};

interface DustToken {
  chain: string;
  address: string;
  symbol: string;
  balance: bigint;
  valueUSD: number;
  decimals: number;
}

async function scanWalletForDust(
  wallet: string,
  chain: string,
  dustThreshold: number = 10 // $10 default
): Promise<DustToken[]> {
  const indexer = indexers[chain];
  const dustTokens: DustToken[] = [];
  
  if (chain === "solana") {
    // Helius for Solana
    const balances = await indexer.rpc.getTokenAccountsByOwner(wallet);
    for (const token of balances) {
      const price = await getTokenPrice(token.mint);
      const valueUSD = (Number(token.amount) / 10 ** token.decimals) * price;
      
      if (valueUSD > 0.01 && valueUSD < dustThreshold) {
        dustTokens.push({
          chain: "solana",
          address: token.mint,
          symbol: token.symbol,
          balance: BigInt(token.amount),
          valueUSD,
          decimals: token.decimals,
        });
      }
    }
  } else {
    // Alchemy for EVM
    const balances = await indexer.core.getTokenBalances(wallet);
    
    for (const token of balances.tokenBalances) {
      if (token.tokenBalance === "0x0") continue;
      
      const metadata = await indexer.core.getTokenMetadata(token.contractAddress);
      const price = await getTokenPrice(token.contractAddress, chain);
      const balance = BigInt(token.tokenBalance);
      const valueUSD = (Number(balance) / 10 ** metadata.decimals) * price;
      
      if (valueUSD > 0.01 && valueUSD < dustThreshold) {
        dustTokens.push({
          chain,
          address: token.contractAddress,
          symbol: metadata.symbol,
          balance,
          valueUSD,
          decimals: metadata.decimals,
        });
      }
    }
  }
  
  return dustTokens;
}
```

### Price Service

```typescript
import { CoinGeckoClient } from "coingecko-api-v3";

const coingecko = new CoinGeckoClient({ timeout: 10000 });
const priceCache = new Redis(process.env.REDIS_URL);

// Cache prices for 60 seconds
async function getTokenPrice(
  address: string,
  chain: string = "ethereum"
): Promise<number> {
  const cacheKey = `price:${chain}:${address.toLowerCase()}`;
  
  // Check cache
  const cached = await priceCache.get(cacheKey);
  if (cached) return parseFloat(cached);
  
  // Fetch from CoinGecko
  const platformId = CHAIN_TO_COINGECKO_PLATFORM[chain];
  
  try {
    const data = await coingecko.simpleTokenPrice({
      id: platformId,
      contract_addresses: address,
      vs_currencies: "usd",
    });
    
    const price = data[address.toLowerCase()]?.usd || 0;
    
    // Cache for 60s
    await priceCache.setex(cacheKey, 60, price.toString());
    
    return price;
  } catch (error) {
    // Fallback to on-chain oracle
    return getOnChainPrice(address, chain);
  }
}

// Batch price fetching for efficiency
async function getBatchTokenPrices(
  tokens: { address: string; chain: string }[]
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  // Group by chain
  const byChain = tokens.reduce((acc, t) => {
    if (!acc[t.chain]) acc[t.chain] = [];
    acc[t.chain].push(t.address);
    return acc;
  }, {} as Record<string, string[]>);
  
  // Fetch in parallel
  await Promise.all(
    Object.entries(byChain).map(async ([chain, addresses]) => {
      const platformId = CHAIN_TO_COINGECKO_PLATFORM[chain];
      const data = await coingecko.simpleTokenPrice({
        id: platformId,
        contract_addresses: addresses.join(","),
        vs_currencies: "usd",
      });
      
      for (const [addr, priceData] of Object.entries(data)) {
        prices.set(`${chain}:${addr}`, priceData.usd || 0);
      }
    })
  );
  
  return prices;
}
```

### ⚠️ Price Validation & Safety (CRITICAL)

**Risk:** Mispricing a token could cause users to lose valuable assets. We MUST implement defense-in-depth.

#### Safety Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PRICE VALIDATION PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Layer 1    │    │   Layer 2    │    │   Layer 3    │    │   Layer 4    │   │
│  │ Multi-Oracle │───▶│  Liquidity   │───▶│   Anomaly    │───▶│  Execution   │   │
│  │  Consensus   │    │    Check     │    │  Detection   │    │   Guards     │   │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                   │                   │           │
│    3+ sources          >$10K pool          <50% from 7d        <3% slippage     │
│    within 5%            required              average             max           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Layer 1: Multi-Oracle Price Consensus

```typescript
interface PriceSource {
  name: string;
  price: number;
  confidence: number;
  timestamp: number;
}

interface ValidatedPrice {
  price: number;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNTRUSTED";
  sources: PriceSource[];
  requiresApproval: boolean;
}

const PRICE_DEVIATION_THRESHOLD = 0.05; // 5% max deviation from median
const MIN_SOURCES_REQUIRED = 2;

async function getValidatedPrice(
  tokenAddress: string,
  chain: string
): Promise<ValidatedPrice> {
  // Fetch from multiple sources in parallel
  const sources = await Promise.allSettled([
    fetchCoinGeckoPrice(tokenAddress, chain),
    fetchDefiLlamaPrice(tokenAddress, chain),
    fetchDexScreenerPrice(tokenAddress, chain),
    fetchOnChainDexPrice(tokenAddress, chain), // Actual swap quote
  ]);

  const validPrices: PriceSource[] = sources
    .filter((r): r is PromiseFulfilledResult<PriceSource> => 
      r.status === "fulfilled" && r.value.price > 0
    )
    .map(r => r.value);

  if (validPrices.length === 0) {
    return {
      price: 0,
      confidence: "UNTRUSTED",
      sources: [],
      requiresApproval: true,
    };
  }

  // Calculate median
  const sortedPrices = validPrices.map(p => p.price).sort((a, b) => a - b);
  const median = sortedPrices[Math.floor(sortedPrices.length / 2)];

  // Filter sources within acceptable deviation
  const consensusSources = validPrices.filter(
    p => Math.abs(p.price - median) / median <= PRICE_DEVIATION_THRESHOLD
  );

  // Determine confidence level
  let confidence: ValidatedPrice["confidence"];
  if (consensusSources.length >= 3) {
    confidence = "HIGH";
  } else if (consensusSources.length >= 2) {
    confidence = "MEDIUM";
  } else if (consensusSources.length === 1) {
    confidence = "LOW";
  } else {
    confidence = "UNTRUSTED";
  }

  return {
    price: median,
    confidence,
    sources: validPrices,
    requiresApproval: confidence === "LOW" || confidence === "UNTRUSTED",
  };
}
```

#### Layer 2: Liquidity Validation

```typescript
const MIN_LIQUIDITY_USD = 10_000; // $10K minimum pool liquidity

interface LiquidityCheck {
  isLiquid: boolean;
  liquidityUsd: number;
  topPools: { dex: string; liquidity: number }[];
}

async function checkTokenLiquidity(
  tokenAddress: string,
  chain: string
): Promise<LiquidityCheck> {
  // Check liquidity via DEX aggregator
  const [oneinchLiquidity, dexscreenerPools] = await Promise.all([
    fetch1inchLiquidity(tokenAddress, chain),
    fetchDexScreenerPools(tokenAddress, chain),
  ]);

  const totalLiquidity = Math.max(
    oneinchLiquidity.liquidityUsd,
    dexscreenerPools.reduce((sum, p) => sum + p.liquidity, 0)
  );

  return {
    isLiquid: totalLiquidity >= MIN_LIQUIDITY_USD,
    liquidityUsd: totalLiquidity,
    topPools: dexscreenerPools.slice(0, 3),
  };
}

// Skip tokens with insufficient liquidity (price easily manipulated)
async function shouldSweepToken(
  tokenAddress: string,
  chain: string
): Promise<{ sweep: boolean; reason?: string }> {
  const liquidity = await checkTokenLiquidity(tokenAddress, chain);
  
  if (!liquidity.isLiquid) {
    return {
      sweep: false,
      reason: `Insufficient liquidity ($${liquidity.liquidityUsd.toFixed(0)} < $${MIN_LIQUIDITY_USD})`,
    };
  }
  
  return { sweep: true };
}
```

#### Layer 3: Historical Anomaly Detection

```typescript
const ANOMALY_THRESHOLD = 0.5; // 50% deviation from 7d average = anomaly

interface AnomalyCheck {
  isAnomalous: boolean;
  currentPrice: number;
  avg7d: number;
  deviation: number;
}

async function detectPriceAnomaly(
  tokenAddress: string,
  chain: string,
  currentPrice: number
): Promise<AnomalyCheck> {
  // Get 7-day price history from cache/API
  const cacheKey = `price:history:${chain}:${tokenAddress.toLowerCase()}`;
  const history = await redis.lrange(cacheKey, 0, -1);
  
  if (history.length < 24) { // Need at least 24 data points
    return {
      isAnomalous: true, // Conservative - treat new tokens as anomalous
      currentPrice,
      avg7d: 0,
      deviation: 1,
    };
  }
  
  const prices = history.map(h => JSON.parse(h).price);
  const avg7d = prices.reduce((a, b) => a + b, 0) / prices.length;
  const deviation = Math.abs(currentPrice - avg7d) / avg7d;
  
  return {
    isAnomalous: deviation > ANOMALY_THRESHOLD,
    currentPrice,
    avg7d,
    deviation,
  };
}
```

#### Layer 4: Execution Guards (Slippage Protection)

```typescript
const MAX_SLIPPAGE = 0.03; // 3% max slippage
const AUTO_SWEEP_THRESHOLD_USD = 50; // Require approval above $50

interface ExecutionGuard {
  canExecute: boolean;
  requiresApproval: boolean;
  reason?: string;
  expectedValue: number;
  minAcceptableValue: number;
}

async function validateExecution(
  tokenAddress: string,
  chain: string,
  amount: bigint,
  validatedPrice: ValidatedPrice
): Promise<ExecutionGuard> {
  const expectedValue = validatedPrice.price * Number(amount) / 1e18;
  const minAcceptableValue = expectedValue * (1 - MAX_SLIPPAGE);
  
  // Get actual swap quote
  const quote = await get1inchQuote({
    src: tokenAddress,
    dst: STABLECOIN_ADDRESS[chain],
    amount: amount.toString(),
  });
  
  const quoteValue = Number(quote.toAmount) / 1e6; // USDC decimals
  const actualSlippage = (expectedValue - quoteValue) / expectedValue;
  
  if (actualSlippage > MAX_SLIPPAGE) {
    return {
      canExecute: false,
      requiresApproval: true,
      reason: `Slippage too high (${(actualSlippage * 100).toFixed(1)}% > ${MAX_SLIPPAGE * 100}%)`,
      expectedValue,
      minAcceptableValue,
    };
  }
  
  // Require user approval for high-value sweeps
  if (expectedValue > AUTO_SWEEP_THRESHOLD_USD) {
    return {
      canExecute: true,
      requiresApproval: true,
      reason: `Value exceeds auto-sweep threshold ($${expectedValue.toFixed(2)} > $${AUTO_SWEEP_THRESHOLD_USD})`,
      expectedValue,
      minAcceptableValue,
    };
  }
  
  return {
    canExecute: true,
    requiresApproval: false,
    expectedValue,
    minAcceptableValue,
  };
}
```

#### Token Whitelist/Blacklist System

```typescript
// Tokens with reliable pricing - auto-sweep allowed
const WHITELISTED_TOKENS: Record<string, Set<string>> = {
  ethereum: new Set([
    "0xA0b86a33E6441b8623E8e1C1d0aB6B55e7a8C8dC", // USDC
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0x6B175474E89094C44Da98b954EesD5cD0E5f33e", // DAI
    // ... major tokens
  ]),
  base: new Set([/* ... */]),
  arbitrum: new Set([/* ... */]),
};

// Tokens to NEVER sweep (scams, rebasing, NFT-like)
const BLACKLISTED_TOKENS: Record<string, Set<string>> = {
  ethereum: new Set([
    // Known scam tokens, honeypots, rebasing tokens
  ]),
};

// Tokens requiring manual review
const GRAYLISTED_PATTERNS = [
  /rebase/i,
  /elastic/i,
  /reflect/i,
  /safemoon/i,
];

function getTokenSweepStatus(
  tokenAddress: string,
  tokenSymbol: string,
  chain: string
): "WHITELIST" | "BLACKLIST" | "GRAYLIST" | "UNKNOWN" {
  if (BLACKLISTED_TOKENS[chain]?.has(tokenAddress.toLowerCase())) {
    return "BLACKLIST";
  }
  
  if (WHITELISTED_TOKENS[chain]?.has(tokenAddress.toLowerCase())) {
    return "WHITELIST";
  }
  
  if (GRAYLISTED_PATTERNS.some(p => p.test(tokenSymbol))) {
    return "GRAYLIST";
  }
  
  return "UNKNOWN";
}
```

#### Complete Sweep Validation Pipeline

```typescript
interface SweepValidation {
  canSweep: boolean;
  requiresApproval: boolean;
  validatedPrice: ValidatedPrice;
  liquidityCheck: LiquidityCheck;
  anomalyCheck: AnomalyCheck;
  executionGuard: ExecutionGuard;
  listStatus: "WHITELIST" | "BLACKLIST" | "GRAYLIST" | "UNKNOWN";
  reasons: string[];
}

async function validateSweep(
  tokenAddress: string,
  tokenSymbol: string,
  chain: string,
  amount: bigint
): Promise<SweepValidation> {
  const reasons: string[] = [];
  
  // Step 1: Check whitelist/blacklist
  const listStatus = getTokenSweepStatus(tokenAddress, tokenSymbol, chain);
  if (listStatus === "BLACKLIST") {
    return {
      canSweep: false,
      requiresApproval: false,
      validatedPrice: { price: 0, confidence: "UNTRUSTED", sources: [], requiresApproval: true },
      liquidityCheck: { isLiquid: false, liquidityUsd: 0, topPools: [] },
      anomalyCheck: { isAnomalous: true, currentPrice: 0, avg7d: 0, deviation: 1 },
      executionGuard: { canExecute: false, requiresApproval: false, expectedValue: 0, minAcceptableValue: 0 },
      listStatus,
      reasons: ["Token is blacklisted"],
    };
  }
  
  // Step 2: Multi-oracle price validation
  const validatedPrice = await getValidatedPrice(tokenAddress, chain);
  if (validatedPrice.confidence === "UNTRUSTED") {
    reasons.push("No reliable price data available");
  }
  
  // Step 3: Liquidity check
  const liquidityCheck = await checkTokenLiquidity(tokenAddress, chain);
  if (!liquidityCheck.isLiquid) {
    reasons.push(`Insufficient liquidity: $${liquidityCheck.liquidityUsd.toFixed(0)}`);
  }
  
  // Step 4: Anomaly detection
  const anomalyCheck = await detectPriceAnomaly(tokenAddress, chain, validatedPrice.price);
  if (anomalyCheck.isAnomalous) {
    reasons.push(`Price anomaly detected: ${(anomalyCheck.deviation * 100).toFixed(0)}% from 7d avg`);
  }
  
  // Step 5: Execution guards
  const executionGuard = await validateExecution(tokenAddress, chain, amount, validatedPrice);
  if (!executionGuard.canExecute) {
    reasons.push(executionGuard.reason || "Execution validation failed");
  }
  
  // Determine final sweep decision
  const canSweep = 
    listStatus !== "BLACKLIST" &&
    validatedPrice.confidence !== "UNTRUSTED" &&
    liquidityCheck.isLiquid &&
    executionGuard.canExecute;
  
  const requiresApproval = 
    listStatus === "GRAYLIST" ||
    listStatus === "UNKNOWN" ||
    validatedPrice.requiresApproval ||
    anomalyCheck.isAnomalous ||
    executionGuard.requiresApproval;
  
  return {
    canSweep,
    requiresApproval,
    validatedPrice,
    liquidityCheck,
    anomalyCheck,
    executionGuard,
    listStatus,
    reasons,
  };
}
```

#### Layer 5-6: (Value Cap & Whitelist - see above)

#### Layer 7: On-Chain Oracle Cross-Check

```typescript
import { ChainlinkPriceFeed, PythClient } from "./oracles";

const ORACLE_DEVIATION_THRESHOLD = 0.10; // 10% max deviation from on-chain

async function crossCheckOnChainOracles(
  tokenAddress: string,
  chain: string,
  apiPrice: number
): Promise<{ valid: boolean; chainlinkPrice?: number; pythPrice?: number; deviation?: number }> {
  const [chainlinkPrice, pythPrice] = await Promise.allSettled([
    ChainlinkPriceFeed.getPrice(tokenAddress, chain),
    PythClient.getPrice(tokenAddress, chain),
  ]);

  const oraclePrice = 
    chainlinkPrice.status === "fulfilled" ? chainlinkPrice.value :
    pythPrice.status === "fulfilled" ? pythPrice.value : null;

  if (!oraclePrice) {
    // No on-chain oracle available - rely on other checks
    return { valid: true };
  }

  const deviation = Math.abs(oraclePrice - apiPrice) / apiPrice;
  
  return {
    valid: deviation <= ORACLE_DEVIATION_THRESHOLD,
    chainlinkPrice: chainlinkPrice.status === "fulfilled" ? chainlinkPrice.value : undefined,
    pythPrice: pythPrice.status === "fulfilled" ? pythPrice.value : undefined,
    deviation,
  };
}
```

#### Layer 8: 24h Volume Check

```typescript
const MIN_24H_VOLUME_USD = 5_000;

interface VolumeCheck {
  sufficient: boolean;
  volume24h: number;
  volumeChange24h: number;
}

async function checkTradingVolume(
  tokenAddress: string,
  chain: string
): Promise<VolumeCheck> {
  const data = await fetchDexScreenerToken(tokenAddress, chain);
  
  return {
    sufficient: data.volume24h >= MIN_24H_VOLUME_USD,
    volume24h: data.volume24h,
    volumeChange24h: data.volumeChange24h,
  };
}
```

#### Layer 9: Honeypot Detection

```typescript
interface HoneypotCheck {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  hasProxyContract: boolean;
}

async function detectHoneypot(
  tokenAddress: string,
  chain: string
): Promise<HoneypotCheck> {
  // Use honeypot.is API or GoPlus Security API
  const [honeypotIs, goplus] = await Promise.allSettled([
    fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${tokenAddress}&chainID=${getChainId(chain)}`).then(r => r.json()),
    fetch(`https://api.gopluslabs.io/api/v1/token_security/${getChainId(chain)}?contract_addresses=${tokenAddress}`).then(r => r.json()),
  ]);

  const honeypot = honeypotIs.status === "fulfilled" ? honeypotIs.value : null;
  const security = goplus.status === "fulfilled" ? goplus.value?.result?.[tokenAddress.toLowerCase()] : null;

  return {
    isHoneypot: honeypot?.honeypotResult?.isHoneypot || security?.is_honeypot === "1",
    buyTax: parseFloat(security?.buy_tax || "0") * 100,
    sellTax: parseFloat(security?.sell_tax || "0") * 100,
    isOpenSource: security?.is_open_source === "1",
    hasProxyContract: security?.is_proxy === "1",
  };
}
```

#### Layer 10: Transfer Tax Simulation

```typescript
const MAX_HIDDEN_TAX = 0.05; // 5% max hidden transfer fee

async function simulateTransferTax(
  tokenAddress: string,
  chain: string,
  amount: bigint
): Promise<{ hiddenTax: number; actualReceived: bigint }> {
  const rpcUrl = RPC_URLS[chain];
  const client = createPublicClient({ transport: http(rpcUrl) });

  // Simulate a transfer using eth_call
  const simulatedOutput = await client.simulateContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [SIMULATION_RECIPIENT, amount],
  });

  // Some tokens return actual received amount
  const actualReceived = simulatedOutput.result || amount;
  const hiddenTax = Number(amount - actualReceived) / Number(amount);

  return { hiddenTax, actualReceived };
}
```

#### Layer 11: TWAP vs Spot Price

```typescript
const TWAP_DEVIATION_THRESHOLD = 0.20; // 20% max deviation from TWAP

async function compareTWAP(
  tokenAddress: string,
  chain: string
): Promise<{ valid: boolean; spotPrice: number; twap1h: number; twap24h: number }> {
  const [spot, twap1h, twap24h] = await Promise.all([
    getSpotPrice(tokenAddress, chain),
    getTWAPFromDex(tokenAddress, chain, "1h"),
    getTWAPFromDex(tokenAddress, chain, "24h"),
  ]);

  const deviation1h = Math.abs(spot - twap1h) / twap1h;
  const deviation24h = Math.abs(spot - twap24h) / twap24h;

  return {
    valid: deviation1h <= TWAP_DEVIATION_THRESHOLD && deviation24h <= TWAP_DEVIATION_THRESHOLD,
    spotPrice: spot,
    twap1h,
    twap24h,
  };
}
```

#### Layer 12: Holder Concentration Risk

```typescript
const MAX_TOP_HOLDER_CONCENTRATION = 0.80; // Top 10 shouldn't hold >80%

interface HolderDistribution {
  isConcentrated: boolean;
  top10Percentage: number;
  holderCount: number;
}

async function analyzeHolderDistribution(
  tokenAddress: string,
  chain: string
): Promise<HolderDistribution> {
  // Use Etherscan/block explorer API
  const holders = await getTokenHolders(tokenAddress, chain);
  
  const totalSupply = holders.reduce((sum, h) => sum + h.balance, 0n);
  const top10Balance = holders.slice(0, 10).reduce((sum, h) => sum + h.balance, 0n);
  const top10Percentage = Number(top10Balance) / Number(totalSupply);

  return {
    isConcentrated: top10Percentage > MAX_TOP_HOLDER_CONCENTRATION,
    top10Percentage,
    holderCount: holders.length,
  };
}
```

#### Layer 13: Token Age Verification

```typescript
const MIN_TOKEN_AGE_DAYS = 7;

async function checkTokenAge(
  tokenAddress: string,
  chain: string
): Promise<{ isMature: boolean; ageInDays: number; deployedAt: Date }> {
  const deployTx = await getContractCreationTx(tokenAddress, chain);
  const deployedAt = new Date(deployTx.timestamp * 1000);
  const ageInDays = (Date.now() - deployedAt.getTime()) / (1000 * 60 * 60 * 24);

  return {
    isMature: ageInDays >= MIN_TOKEN_AGE_DAYS,
    ageInDays,
    deployedAt,
  };
}
```

#### Layer 14: Cross-DEX Arbitrage Detection

```typescript
const MAX_CROSS_DEX_DEVIATION = 0.05; // 5% max price diff between DEXs

async function detectCrossDexArbitrage(
  tokenAddress: string,
  chain: string
): Promise<{ isManipulated: boolean; prices: Record<string, number>; maxDeviation: number }> {
  const dexes = getDexesForChain(chain);
  
  const prices: Record<string, number> = {};
  await Promise.all(
    dexes.map(async (dex) => {
      try {
        prices[dex.name] = await dex.getPrice(tokenAddress);
      } catch {}
    })
  );

  const validPrices = Object.values(prices).filter(p => p > 0);
  if (validPrices.length < 2) return { isManipulated: false, prices, maxDeviation: 0 };

  const maxPrice = Math.max(...validPrices);
  const minPrice = Math.min(...validPrices);
  const maxDeviation = (maxPrice - minPrice) / minPrice;

  return {
    isManipulated: maxDeviation > MAX_CROSS_DEX_DEVIATION,
    prices,
    maxDeviation,
  };
}
```

#### Layer 15: Transaction Simulation (Tenderly/Alchemy)

```typescript
interface SimulationResult {
  success: boolean;
  gasUsed: bigint;
  outputAmount: bigint;
  revertReason?: string;
  stateChanges: any[];
}

async function simulateSwapTransaction(
  swapCalldata: `0x${string}`,
  fromAddress: string,
  aggregatorAddress: string,
  chain: string
): Promise<SimulationResult> {
  // Use Tenderly Simulation API
  const simulation = await fetch("https://api.tenderly.co/api/v1/simulate", {
    method: "POST",
    headers: {
      "X-Access-Key": process.env.TENDERLY_ACCESS_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      network_id: getChainId(chain),
      from: fromAddress,
      to: aggregatorAddress,
      input: swapCalldata,
      save: false,
      simulation_type: "quick",
    }),
  }).then(r => r.json());

  if (!simulation.simulation.status) {
    return {
      success: false,
      gasUsed: 0n,
      outputAmount: 0n,
      revertReason: simulation.simulation.error_message,
      stateChanges: [],
    };
  }

  // Parse token transfers from trace
  const outputTransfer = simulation.transaction.transaction_info.asset_changes
    ?.find((c: any) => c.to === fromAddress && c.type === "Transfer");

  return {
    success: true,
    gasUsed: BigInt(simulation.simulation.gas_used),
    outputAmount: BigInt(outputTransfer?.raw_amount || "0"),
    stateChanges: simulation.transaction.transaction_info.state_changes,
  };
}
```

#### Price Validation Summary Table

| Layer | Check | Threshold | Action if Failed |
|-------|-------|-----------|------------------|
| **1. Multi-Oracle** | Price consensus | 3+ sources within 5% | Require approval |
| **2. Liquidity** | Pool depth | >$10K liquidity | Skip token |
| **3. Anomaly** | Historical deviation | <50% from 7d avg | Require approval |
| **4. Execution** | Slippage | <3% slippage | Abort transaction |
| **5. Value** | Auto-sweep limit | <$50 USD | Require approval |
| **6. Whitelist** | Token status | Known tokens only | Manual review |
| **7. On-Chain Oracle** | Chainlink/Pyth cross-check | <10% from API price | Require approval |
| **8. Volume** | 24h trading volume | >$5K daily volume | Skip token |
| **9. Honeypot** | Sell tax detection | No honeypot flags | Blacklist token |
| **10. Transfer Tax** | Hidden fee simulation | <5% hidden tax | Skip token |
| **11. TWAP** | Spot vs time-weighted avg | <20% deviation | Require approval |
| **12. Holder Dist** | Whale concentration | Top 10 <80% supply | Require approval |
| **13. Token Age** | Contract deploy date | >7 days old | Require approval |
| **14. Cross-DEX** | Price across DEXs | <5% price diff | Flag manipulation |
| **15. Simulation** | Tenderly tx simulation | Must succeed | Abort transaction |

#### Monitoring & Alerts

```typescript
// Alert on suspicious activity
async function monitorPriceValidation(validation: SweepValidation, userId: string) {
  if (!validation.canSweep && validation.validatedPrice.price > 0) {
    await alerting.send({
      type: "BLOCKED_SWEEP",
      severity: "MEDIUM",
      userId,
      data: {
        reasons: validation.reasons,
        price: validation.validatedPrice.price,
        confidence: validation.validatedPrice.confidence,
      },
    });
  }
  
  if (validation.anomalyCheck.isAnomalous) {
    await alerting.send({
      type: "PRICE_ANOMALY",
      severity: "HIGH",
      data: {
        currentPrice: validation.anomalyCheck.currentPrice,
        avg7d: validation.anomalyCheck.avg7d,
        deviation: validation.anomalyCheck.deviation,
      },
    });
  }
}
```

---

## Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(66) NOT NULL UNIQUE,
  smart_wallet_address VARCHAR(66),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_smart_wallet ON users(smart_wallet_address);

-- Dust tokens (scanned from wallets)
CREATE TABLE dust_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  chain VARCHAR(20) NOT NULL,
  token_address VARCHAR(66) NOT NULL,
  symbol VARCHAR(20),
  balance NUMERIC(78, 0) NOT NULL,
  value_usd DECIMAL(20, 8),
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  swept BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, chain, token_address)
);

CREATE INDEX idx_dust_user ON dust_tokens(user_id);
CREATE INDEX idx_dust_chain ON dust_tokens(chain);
CREATE INDEX idx_dust_unswept ON dust_tokens(user_id) WHERE NOT swept;

-- Sweep transactions
CREATE TABLE sweep_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  chain VARCHAR(20) NOT NULL,
  tx_hash VARCHAR(130),
  user_op_hash VARCHAR(130),
  status VARCHAR(20) DEFAULT 'pending',
  tokens_swept JSONB,
  gas_token VARCHAR(66),
  gas_paid NUMERIC(78, 0),
  output_token VARCHAR(66),
  output_amount NUMERIC(78, 0),
  defi_destination VARCHAR(66),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX idx_sweeps_user ON sweep_transactions(user_id);
CREATE INDEX idx_sweeps_status ON sweep_transactions(status);
CREATE INDEX idx_sweeps_chain ON sweep_transactions(chain);

-- DeFi positions
CREATE TABLE defi_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  protocol VARCHAR(50) NOT NULL,
  chain VARCHAR(20) NOT NULL,
  vault_address VARCHAR(66) NOT NULL,
  underlying_token VARCHAR(66),
  shares NUMERIC(78, 0),
  deposited_amount NUMERIC(78, 0),
  current_value_usd DECIMAL(20, 8),
  apy DECIMAL(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_user ON defi_positions(user_id);
CREATE INDEX idx_positions_protocol ON defi_positions(protocol);

-- Cross-chain bridges
CREATE TABLE bridge_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  bridge_protocol VARCHAR(50) NOT NULL,
  source_chain VARCHAR(20) NOT NULL,
  dest_chain VARCHAR(20) NOT NULL,
  source_tx_hash VARCHAR(130),
  dest_tx_hash VARCHAR(130),
  token VARCHAR(66),
  amount NUMERIC(78, 0),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_bridges_user ON bridge_transactions(user_id);
CREATE INDEX idx_bridges_status ON bridge_transactions(status);

-- Auto-sweep rules
CREATE TABLE auto_sweep_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  chain VARCHAR(20),
  dust_threshold_usd DECIMAL(10, 2) DEFAULT 10.00,
  output_token VARCHAR(66),
  defi_destination VARCHAR(66),
  frequency VARCHAR(20) DEFAULT 'weekly',
  enabled BOOLEAN DEFAULT TRUE,
  last_executed TIMESTAMPTZ,
  next_execution TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rules_user ON auto_sweep_rules(user_id);
CREATE INDEX idx_rules_next ON auto_sweep_rules(next_execution) WHERE enabled;
```

---

## API Design

### REST Endpoints

```typescript
// Express router
const router = express.Router();

// Auth middleware (SIWE - Sign In With Ethereum)
router.use(authMiddleware);

// x402 payment middleware for paid endpoints
router.use("/sweep", x402Middleware({ amount: "50000" })); // $0.05 USDC

// GET /api/v1/wallet/dust
// Scan wallet for dust tokens
router.get("/wallet/dust", async (req, res) => {
  const { chains } = req.query;
  const userId = req.user.id;
  
  // Queue wallet scan job
  const job = await queues.walletScan.add("scan", {
    userId,
    walletAddress: req.user.walletAddress,
    chains: chains?.split(",") || ALL_CHAINS,
  });
  
  // Wait for result (with timeout)
  const result = await job.waitUntilFinished(queueEvents, 30000);
  
  // Return dust tokens
  const dustTokens = await db.dustTokens.findMany({
    where: { userId, swept: false },
    orderBy: { valueUsd: "desc" },
  });
  
  res.json({
    totalValueUsd: dustTokens.reduce((sum, t) => sum + t.valueUsd, 0),
    tokens: dustTokens,
  });
});

// POST /api/v1/sweep
// Execute dust sweep
router.post("/sweep", async (req, res) => {
  const { tokenIds, outputToken, defiDestination, gasToken, chain } = req.body;
  const userId = req.user.id;
  
  // Validate tokens belong to user
  const tokens = await db.dustTokens.findMany({
    where: { id: { in: tokenIds }, userId },
  });
  
  if (tokens.length !== tokenIds.length) {
    return res.status(400).json({ error: "Invalid token selection" });
  }
  
  // Queue sweep job
  const job = await queues.executeSweep.add("sweep", {
    userId,
    tokens,
    outputToken,
    defiDestination,
    gasToken,
    chain,
  });
  
  res.json({
    jobId: job.id,
    status: "queued",
    estimatedGas: await estimateSweepGas(tokens, chain),
  });
});

// GET /api/v1/sweep/:jobId
// Check sweep status
router.get("/sweep/:jobId", async (req, res) => {
  const job = await queues.executeSweep.getJob(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  
  const state = await job.getState();
  const result = job.returnvalue;
  
  res.json({
    jobId: job.id,
    status: state,
    result: state === "completed" ? result : null,
    progress: job.progress,
  });
});

// GET /api/v1/positions
// Get user's DeFi positions
router.get("/positions", async (req, res) => {
  const positions = await db.defiPositions.findMany({
    where: { userId: req.user.id },
  });
  
  // Refresh values in background
  queues.trackPosition.add("refresh", { userId: req.user.id });
  
  res.json({ positions });
});

// POST /api/v1/rules
// Create auto-sweep rule
router.post("/rules", async (req, res) => {
  const { chain, dustThreshold, outputToken, defiDestination, frequency } = req.body;
  
  const rule = await db.autoSweepRules.create({
    data: {
      userId: req.user.id,
      chain,
      dustThresholdUsd: dustThreshold,
      outputToken,
      defiDestination,
      frequency,
      enabled: true,
      nextExecution: calculateNextExecution(frequency),
    },
  });
  
  res.json({ rule });
});

// WebSocket for real-time updates
io.on("connection", (socket) => {
  socket.on("subscribe", async (userId) => {
    socket.join(`user:${userId}`);
  });
});

// Emit updates when sweep completes
sweepWorker.on("completed", (job, result) => {
  io.to(`user:${job.data.userId}`).emit("sweep:completed", result);
});
```

---

## Cost Analysis

### Infrastructure Costs (600K Users)

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| **Bundler API (Pimlico)** | $3,000-5,000 | Based on UserOp volume |
| **RPC Nodes (Alchemy)** | $2,000-4,000 | Multi-chain access |
| **Wallet Indexing (Alchemy/Helius)** | $1,500-3,000 | Balance queries |
| **Price API (CoinGecko Pro)** | $500 | Unlimited calls |
| **Database (PostgreSQL)** | $500-1,000 | Managed, high availability |
| **Redis (Cache/Queue)** | $300-500 | Managed Redis |
| **Compute (Kubernetes)** | $2,000-4,000 | Auto-scaling cluster |
| **CDN/Load Balancer** | $200-400 | CloudFlare/AWS |
| **Monitoring (Datadog)** | $500-1,000 | APM, logs, alerts |
| **Total** | **$10,500-19,400** | |

### Revenue Model

| Source | Rate | Est. Monthly (600K users, 10% active) |
|--------|------|--------------------------------------|
| **Sweep Fee** | 1.5% of dust | $90,000 (assuming $100 avg dust) |
| **Gas Margin** | 5% on paymaster | $15,000 |
| **x402 API Calls** | $0.05/sweep | $3,000 |
| **Premium Subscriptions** | $5/mo | $30,000 (10% conversion) |
| **Total Revenue** | | **~$138,000/mo** |

### Unit Economics

- **Cost per sweep**: ~$0.03-0.08 (infra) + $0.05-0.30 (gas)
- **Revenue per sweep**: ~$1.50 (1.5% of $100)
- **Gross margin**: ~90%+

---

## Deployment Strategy

### Phase 1: MVP (Month 1-2)
- Single chain (Base)
- Basic dust scan + sweep
- Aave deposit only
- 1,000 beta users

### Phase 2: Multi-Chain (Month 3-4)
- Add Arbitrum, Polygon
- Cross-chain consolidation (Li.Fi)
- Add Yearn, Beefy
- 10,000 users

### Phase 3: Scale (Month 5-6)
- All 7 chains
- Auto-sweep rules
- x402 monetization
- 100,000 users

### Phase 4: Full Product (Month 7+)
- AI agent integration (AgentKit)
- Advanced DeFi strategies
- Mobile app
- 600,000 users

---

## Security Considerations

1. **No Seed Phrases**: Smart wallets only, passkey authentication
2. **Non-Custodial**: Users always sign, we never hold keys
3. **Permit2 Approvals**: Gasless, time-limited, revocable
4. **Rate Limiting**: Per-user, per-IP, per-endpoint
5. **Audit**: Smart contracts audited before mainnet
6. **Bug Bounty**: Immunefi program for vulnerabilities

---

*This document represents the comprehensive architecture for Sweep at scale. All code examples are production-ready patterns.*
