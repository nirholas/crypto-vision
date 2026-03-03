# Cross-Chain Bridging Infrastructure - Technical Documentation

> **Purpose**: Cross-chain bridging research for Sweep dust sweeper
> **Target Scale**: 600,000 users across Ethereum, Base, Arbitrum, BNB Chain, Polygon, Linea, and Solana
> **Last Updated**: January 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Li.Fi SDK Integration](#2-lifi-sdk-integration)
3. [Socket/Bungee API](#3-socketbungee-api)
4. [Across Protocol](#4-across-protocol)
5. [Solana↔EVM Bridging](#5-solanaevm-bridging)
6. [Consolidation Strategy](#6-consolidation-strategy)
7. [Cost Comparison](#7-cost-comparison)
8. [Error Handling Patterns](#8-error-handling-patterns)
9. [Recommended Stack](#9-recommended-stack)

---

## 1. Executive Summary

### Bridge Protocol Comparison

| Protocol | Speed | Cost | Chains | Dust Viability | Solana Support |
|----------|-------|------|--------|----------------|----------------|
| **Li.Fi (Aggregator)** | 1-30 min | Medium | 50+ EVM + Solana | ✅ Good | ✅ Via Mayan/Wormhole |
| **Socket/Bungee** | 1-30 min | Low-Medium | 20+ EVM | ✅ Good | ❌ EVM only |
| **Across Protocol** | 1-2 min | Low | 10 EVM | ⭐ Excellent | ❌ EVM only |
| **Wormhole** | 15-20 min | Medium | 20+ | ⚠️ Min $10+ | ✅ Native |
| **deBridge** | 1-5 min | Low | 15+ | ✅ Good | ✅ Native |

### Recommended Approach by Use Case

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-CHAIN BRIDGE SELECTION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EVM → EVM (Fast, Low Value)     ──▶ Across Protocol                        │
│  EVM → EVM (Any Amount)          ──▶ Li.Fi (routes through best bridge)     │
│  Solana → EVM                    ──▶ deBridge or Mayan (via Li.Fi)          │
│  EVM → Solana                    ──▶ deBridge or Wormhole                   │
│  Multi-hop Complex Routes        ──▶ Socket API                             │
│  DeFi Integration Post-Bridge    ──▶ Li.Fi Contract Calls                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Li.Fi SDK Integration

### Overview

Li.Fi is a cross-chain bridge and DEX aggregator that routes through 20+ bridges to find optimal paths. It's the recommended primary solution for its comprehensive coverage.

### Installation

```bash
npm install @lifi/sdk viem
# or
yarn add @lifi/sdk viem
```

### SDK Setup

```typescript
import { createConfig, EVM, getRoutes, executeRoute, getStatus } from '@lifi/sdk'
import { createWalletClient, http, publicActions } from 'viem'
import { mainnet, arbitrum, base, polygon, bsc, linea } from 'viem/chains'

// Chain configurations
const SUPPORTED_CHAINS = {
  1: mainnet,
  42161: arbitrum,
  8453: base,
  137: polygon,
  56: bsc,
  59144: linea,
}

// Initialize SDK once at app startup
const initializeLiFi = (getWalletClient: () => Promise<WalletClient>) => {
  createConfig({
    integrator: 'sweep-dust-sweeper', // Required - your app name
    apiKey: process.env.LIFI_API_KEY,      // Optional but recommended for higher limits
    
    // Custom RPC URLs for reliability at scale
    rpcUrls: {
      1: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
      42161: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
      8453: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
      137: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
      56: ['https://bsc-dataseed.binance.org', 'https://rpc.ankr.com/bsc'],
      59144: ['https://rpc.linea.build', 'https://linea.drpc.org'],
    },
    
    // Route preferences for dust sweeping
    routeOptions: {
      slippage: 0.02,           // 2% default for dust (higher tolerance)
      order: 'CHEAPEST',        // Optimize for cost over speed for dust
      allowSwitchChain: true,   // Allow automatic chain switching
    },
    
    providers: [
      EVM({
        getWalletClient,
        switchChain: async (chainId) => {
          // Implement chain switching logic
          const chain = SUPPORTED_CHAINS[chainId]
          if (!chain) throw new Error(`Unsupported chain: ${chainId}`)
          return getWalletClient() // Return new client for chain
        },
      }),
    ],
  })
}
```

### Get Cross-Chain Routes

```typescript
import { getRoutes, ChainId } from '@lifi/sdk'

interface CrossChainQuoteParams {
  fromChainId: number
  toChainId: number
  fromToken: string
  toToken: string
  fromAmount: string
  fromAddress: string
  toAddress?: string
}

async function getCrossChainRoutes(params: CrossChainQuoteParams) {
  const routes = await getRoutes({
    fromChainId: params.fromChainId,
    toChainId: params.toChainId,
    fromTokenAddress: params.fromToken,
    toTokenAddress: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress || params.fromAddress,
    options: {
      slippage: 0.02, // 2% for dust
      order: 'CHEAPEST',
      
      // Bridge preferences for dust sweeping
      preferBridges: ['across', 'stargate', 'hop'], // Fast & reliable
      denyBridges: ['multichain'], // Deprecated bridges
      
      // Allow/deny specific DEXs
      allowExchanges: ['uniswap', 'sushiswap', '1inch'],
    },
  })

  return routes.routes.map(route => ({
    id: route.id,
    fromAmount: route.fromAmount,
    toAmount: route.toAmount,
    toAmountMin: route.toAmountMin,
    gasCostUSD: route.gasCostUSD,
    steps: route.steps.map(step => ({
      type: step.type, // 'swap', 'cross', 'lifi'
      tool: step.tool, // Bridge/DEX name
      fromChain: step.action.fromChainId,
      toChain: step.action.toChainId,
      estimatedTime: step.estimate.executionDuration,
    })),
    tags: route.tags, // ['CHEAPEST', 'FASTEST', etc.]
  }))
}
```

### Execute Cross-Chain Swap

```typescript
import { executeRoute, Route, ProcessType } from '@lifi/sdk'

interface ExecutionCallbacks {
  onStepUpdate?: (step: any) => void
  onTxHash?: (hash: string, chainId: number) => void
  onComplete?: (route: Route) => void
  onError?: (error: Error) => void
}

async function executeCrossChainSwap(
  route: Route,
  callbacks: ExecutionCallbacks = {}
) {
  const executedRoute = await executeRoute(route, {
    // Progress tracking
    updateRouteHook: (updatedRoute) => {
      for (const step of updatedRoute.steps) {
        if (step.execution) {
          callbacks.onStepUpdate?.(step)
          
          // Extract tx hashes
          for (const process of step.execution.process) {
            if (process.txHash && process.status === 'PENDING') {
              callbacks.onTxHash?.(process.txHash, step.action.fromChainId)
            }
          }
        }
      }
    },
    
    // Auto-accept slippage updates for dust (within reason)
    acceptSlippageUpdateHook: async ({ oldSlippage, newSlippage }) => {
      // Accept up to 5% slippage for dust amounts
      return newSlippage <= 0.05
    },
    
    // Handle exchange rate updates
    acceptExchangeRateUpdateHook: async ({ oldRate, newRate }) => {
      const changePercent = Math.abs((newRate - oldRate) / oldRate * 100)
      // Accept up to 3% rate change
      return changePercent <= 3
    },
  })

  callbacks.onComplete?.(executedRoute)
  return executedRoute
}
```

### Status Tracking for Bridge Transactions

```typescript
import { getStatus, StatusResponse } from '@lifi/sdk'

interface BridgeStatusResult {
  status: 'PENDING' | 'DONE' | 'FAILED' | 'NOT_FOUND'
  substatus?: string
  sourceTxHash?: string
  destTxHash?: string
  bridgeExplorerUrl?: string
}

async function trackBridgeStatus(
  txHash: string,
  bridge: string,
  fromChain: number,
  toChain: number,
  maxAttempts: number = 60,
  pollIntervalMs: number = 10000
): Promise<BridgeStatusResult> {
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      const status = await getStatus({
        txHash,
        bridge,
        fromChain,
        toChain,
      })

      // Log progress
      console.log(`[${attempts + 1}/${maxAttempts}] Status: ${status.status}`)
      if (status.substatus) {
        console.log(`  Substatus: ${status.substatus}`)
      }

      // Check terminal states
      if (status.status === 'DONE') {
        return {
          status: 'DONE',
          substatus: status.substatus,
          sourceTxHash: status.sending?.txHash,
          destTxHash: status.receiving?.txHash,
          bridgeExplorerUrl: status.lifiExplorerLink,
        }
      }

      if (status.status === 'FAILED') {
        return {
          status: 'FAILED',
          substatus: status.substatus,
          sourceTxHash: status.sending?.txHash,
          bridgeExplorerUrl: status.lifiExplorerLink,
        }
      }

      // Handle specific pending substatuses
      if (status.substatus === 'BRIDGE_NOT_AVAILABLE') {
        console.log('Bridge temporarily unavailable, will retry...')
      } else if (status.substatus === 'WAIT_DESTINATION_TRANSACTION') {
        console.log('Waiting for destination chain confirmation...')
      }

    } catch (error) {
      console.error(`Status check failed:`, error.message)
    }

    await new Promise(r => setTimeout(r, pollIntervalMs))
    attempts++
  }

  return { status: 'PENDING', substatus: 'TIMEOUT' }
}
```

### Contract Calls Quote (Bridge + DeFi in One TX)

```typescript
import { getContractCallsQuote } from '@lifi/sdk'
import { encodeFunctionData, parseAbi } from 'viem'

// Example: Bridge USDC from Arbitrum to Base, then deposit into Aave
async function bridgeAndDepositToAave(
  userAddress: string,
  amount: string,
  fromChain: number,
  toChain: number
) {
  // Aave Pool ABI
  const aavePoolAbi = parseAbi([
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external'
  ])

  const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  const AAVE_POOL_BASE = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'

  // Encode Aave deposit call
  const depositCalldata = encodeFunctionData({
    abi: aavePoolAbi,
    functionName: 'supply',
    args: [
      USDC_BASE,           // asset
      BigInt(amount),      // amount
      userAddress,         // onBehalfOf
      0                    // referralCode
    ],
  })

  const quote = await getContractCallsQuote({
    fromAddress: userAddress,
    fromChain: fromChain,      // Arbitrum (42161)
    fromToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
    fromAmount: amount,
    toChain: toChain,          // Base (8453)
    toToken: USDC_BASE,
    contractCalls: [
      {
        fromAmount: amount,
        fromTokenAddress: USDC_BASE,
        toContractAddress: AAVE_POOL_BASE,
        toContractCallData: depositCalldata,
        toContractGasLimit: '300000',
      },
    ],
    toFallbackAddress: userAddress, // If contract call fails, send tokens here
    slippage: 0.01, // 1% for contract calls (more precise needed)
  })

  return quote
}
```

### Li.Fi Rate Limits & Scaling

```typescript
import Bottleneck from 'bottleneck'

// Rate limiter for Li.Fi API (default ~10 req/s)
const lifiLimiter = new Bottleneck({
  minTime: 100,        // 100ms between requests (10 RPS)
  maxConcurrent: 5,    // Max 5 concurrent requests
  reservoir: 100,      // 100 requests per window
  reservoirRefreshAmount: 100,
  reservoirRefreshInterval: 10 * 1000, // 10 second window
})

// Wrap all Li.Fi SDK calls
const rateLimitedGetRoutes = lifiLimiter.wrap(getRoutes)
const rateLimitedGetStatus = lifiLimiter.wrap(getStatus)

// For 600K users: Apply for Li.Fi Partner Program for higher limits
// Contact: partners@li.fi
```

---

## 3. Socket/Bungee API

### Overview

Socket (branded as Bungee for consumer) provides bridge aggregation across 15+ bridges. It's particularly good for EVM-to-EVM transfers with transparent multi-hop support.

### API Endpoints

```
Base URL: https://api.socket.tech/v2

Authentication: API-KEY header required
Get API key: https://sockettech.xyz/

Endpoints:
GET  /quote                    # Get bridging quote
POST /build-tx                 # Build transaction
GET  /route/active-routes/{txHash}  # Get route status
GET  /supported/chains         # List supported chains
GET  /supported/bridges        # List supported bridges
GET  /token-lists/chain/{chainId}   # Tokens on chain
```

### Get Bridge Quote

```typescript
const SOCKET_API_KEY = process.env.SOCKET_API_KEY

interface SocketQuoteParams {
  fromChainId: number
  toChainId: number
  fromTokenAddress: string
  toTokenAddress: string
  fromAmount: string
  userAddress: string
  uniqueRoutesPerBridge?: boolean
  sort?: 'output' | 'gas' | 'time'
  singleTxOnly?: boolean
}

async function getSocketQuote(params: SocketQuoteParams) {
  const queryParams = new URLSearchParams({
    fromChainId: params.fromChainId.toString(),
    toChainId: params.toChainId.toString(),
    fromTokenAddress: params.fromTokenAddress,
    toTokenAddress: params.toTokenAddress,
    fromAmount: params.fromAmount,
    userAddress: params.userAddress,
    uniqueRoutesPerBridge: (params.uniqueRoutesPerBridge ?? true).toString(),
    sort: params.sort || 'output', // Best output amount
    singleTxOnly: (params.singleTxOnly ?? false).toString(),
  })

  const response = await fetch(
    `https://api.socket.tech/v2/quote?${queryParams}`,
    {
      headers: {
        'API-KEY': SOCKET_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Socket API error: ${response.status}`)
  }

  const data = await response.json()
  return data.result
}

// Example usage
const quote = await getSocketQuote({
  fromChainId: 42161,  // Arbitrum
  toChainId: 8453,     // Base
  fromTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
  toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // USDC
  fromAmount: '10000000', // 10 USDC
  userAddress: '0x...',
  sort: 'output',
})
```

### Build and Execute Transaction

```typescript
interface SocketRoute {
  routeId: string
  fromAmount: string
  toAmount: string
  usedBridgeNames: string[]
  totalGasFeesInUsd: number
  totalUserTx: number
  userTxs: Array<{
    userTxType: string
    txType: string
    chainId: number
    protocol: { name: string }
    approvalData?: {
      minimumApprovalAmount: string
      approvalTokenAddress: string
      allowanceTarget: string
    }
  }>
}

async function buildSocketTx(route: SocketRoute) {
  const response = await fetch('https://api.socket.tech/v2/build-tx', {
    method: 'POST',
    headers: {
      'API-KEY': SOCKET_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ route }),
  })

  const data = await response.json()
  return data.result
}

async function executeSocketBridge(
  route: SocketRoute,
  signer: ethers.Signer
) {
  const results = []

  for (const userTx of route.userTxs) {
    // Handle approval if needed
    if (userTx.approvalData) {
      const approveTx = await buildSocketTx({
        ...route,
        // Socket returns approval tx data
      })
      
      const approvalResult = await signer.sendTransaction({
        to: userTx.approvalData.allowanceTarget,
        data: approveTx.approvalData,
      })
      await approvalResult.wait()
    }

    // Build and send main tx
    const txData = await buildSocketTx(route)
    
    const tx = await signer.sendTransaction({
      to: txData.txTarget,
      data: txData.txData,
      value: txData.value,
      gasLimit: txData.gasLimit,
    })

    const receipt = await tx.wait()
    results.push({
      txHash: receipt.transactionHash,
      chainId: userTx.chainId,
    })
  }

  return results
}
```

### Track Bridge Status

```typescript
async function trackSocketBridgeStatus(
  txHash: string,
  fromChainId: number,
  toChainId: number
) {
  const response = await fetch(
    `https://api.socket.tech/v2/route/active-routes/${txHash}?fromChainId=${fromChainId}&toChainId=${toChainId}`,
    {
      headers: { 'API-KEY': SOCKET_API_KEY },
    }
  )

  const data = await response.json()
  
  return {
    status: data.result.activeRouteStatus, // 'PENDING', 'COMPLETED', 'FAILED'
    sourceTxHash: data.result.sourceTxHash,
    destTxHash: data.result.destinationTxHash,
    bridgeUsed: data.result.bridgeName,
  }
}
```

### Multi-Hop Routes

Socket excels at complex multi-hop routes:

```typescript
// Example: Token A on Chain 1 → Token B on Chain 2 → Token C on Chain 3
// Socket handles this as a single "route" with multiple steps

async function getMultiHopRoute(
  fromChain: number,
  toChain: number,
  fromToken: string,
  toToken: string,
  amount: string,
  userAddress: string
) {
  const quote = await getSocketQuote({
    fromChainId: fromChain,
    toChainId: toChain,
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    fromAmount: amount,
    userAddress,
    singleTxOnly: false, // Allow multi-tx routes
  })

  // Filter routes with reasonable hop count
  const viableRoutes = quote.routes.filter(
    (route: SocketRoute) => route.totalUserTx <= 3 // Max 3 transactions
  )

  return viableRoutes.sort(
    (a: SocketRoute, b: SocketRoute) => 
      parseFloat(b.toAmount) - parseFloat(a.toAmount)
  )
}
```

### Socket Supported Chains (for Sweep)

| Chain | Chain ID | Bridge Support |
|-------|----------|----------------|
| Ethereum | 1 | ✅ Full |
| Arbitrum | 42161 | ✅ Full |
| Base | 8453 | ✅ Full |
| Polygon | 137 | ✅ Full |
| BNB Chain | 56 | ✅ Full |
| Linea | 59144 | ✅ Limited |
| Optimism | 10 | ✅ Full |

---

## 4. Across Protocol

### Overview

Across is an **optimistic bridge** that provides the fastest and cheapest EVM-to-EVM transfers. It uses a network of relayers who front capital on the destination chain, then get reimbursed from the origin chain.

**Key Advantages for Dust:**
- ✅ **Fast**: 1-2 minutes (relayers front funds)
- ✅ **Cheap**: Lowest fees of major bridges
- ✅ **Reliable**: Simple architecture, minimal failure modes
- ❌ **EVM Only**: No Solana support

### How Across Works

```
Traditional Bridge:           Across Protocol:
─────────────────            ─────────────────
1. User deposits              1. User deposits to SpokePool
2. Wait for finality          2. Relayer sees deposit
3. Mint on dest chain         3. Relayer fronts funds immediately
4. ~15-30 min                 4. User receives in ~1-2 min
                              5. Relayer reimbursed later
```

### API Endpoints

```
Base URL: https://across.to/api

Endpoints:
GET  /suggested-fees         # Get recommended fees
GET  /limits                 # Route limits
GET  /available-routes       # Supported routes
POST /deposit/status         # Check deposit status
```

### Get Bridge Quote

```typescript
interface AcrossQuoteParams {
  originChainId: number
  destinationChainId: number
  token: string          // Token address on origin
  amount: string         // Amount in wei
  recipient?: string     // Destination address
  timestamp?: number     // For fee calculation
}

async function getAcrossQuote(params: AcrossQuoteParams) {
  const queryParams = new URLSearchParams({
    originChainId: params.originChainId.toString(),
    destinationChainId: params.destinationChainId.toString(),
    token: params.token,
    amount: params.amount,
    timestamp: (params.timestamp || Math.floor(Date.now() / 1000)).toString(),
  })

  const response = await fetch(
    `https://across.to/api/suggested-fees?${queryParams}`
  )

  const data = await response.json()

  return {
    totalRelayFee: data.totalRelayFee,           // Total fee in wei
    relayerFeePercent: data.relayerFeePercent,   // Fee as percentage
    lpFeePercent: data.lpFeePercent,             // LP fee percentage
    capitalFeePercent: data.capitalFeePercent,   // Capital cost
    isAmountTooLow: data.isAmountTooLow,         // Dust check
    quoteTimestamp: data.timestamp,
    fillDeadline: data.exclusiveRelayer?.fillDeadline,
  }
}

// Example
const quote = await getAcrossQuote({
  originChainId: 42161,  // Arbitrum
  destinationChainId: 8453, // Base
  token: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
  amount: '5000000', // 5 USDC
})

console.log(`Fee: ${quote.relayerFeePercent}%`) // Usually 0.06-0.12%
```

### Execute Bridge via SpokePool Contract

```typescript
import { ethers } from 'ethers'

// Across SpokePool addresses (canonical across chains)
const SPOKE_POOL_ADDRESSES: Record<number, string> = {
  1: '0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5',     // Ethereum
  42161: '0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A', // Arbitrum
  8453: '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64',  // Base
  137: '0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096',   // Polygon
  56: '0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5',    // BNB
  10: '0x6f26Bf09B1C792e3228e5467807a900A503c0281',    // Optimism
}

const SPOKE_POOL_ABI = [
  `function deposit(
    address recipient,
    address originToken,
    uint256 amount,
    uint256 destinationChainId,
    int64 relayerFeePct,
    uint32 quoteTimestamp,
    bytes message,
    uint256 maxCount
  ) external payable`,
  
  `function depositV3(
    address depositor,
    address recipient,
    address inputToken,
    address outputToken,
    uint256 inputAmount,
    uint256 outputAmount,
    uint256 destinationChainId,
    address exclusiveRelayer,
    uint32 quoteTimestamp,
    uint32 fillDeadline,
    uint32 exclusivityDeadline,
    bytes message
  ) external payable`
]

async function executeAcrossBridge(
  signer: ethers.Signer,
  params: {
    recipient: string
    originToken: string
    amount: string
    destinationChainId: number
    relayerFeePct: number  // From quote
    quoteTimestamp: number // From quote
  }
) {
  const originChainId = await signer.getChainId()
  const spokePoolAddress = SPOKE_POOL_ADDRESSES[originChainId]
  
  const spokePool = new ethers.Contract(spokePoolAddress, SPOKE_POOL_ABI, signer)

  // First approve token spend
  const token = new ethers.Contract(
    params.originToken,
    ['function approve(address,uint256) external returns (bool)'],
    signer
  )
  const approveTx = await token.approve(spokePoolAddress, params.amount)
  await approveTx.wait()

  // Execute deposit
  const depositTx = await spokePool.deposit(
    params.recipient,
    params.originToken,
    params.amount,
    params.destinationChainId,
    Math.floor(params.relayerFeePct * 1e18), // Convert to wei percentage
    params.quoteTimestamp,
    '0x', // Empty message
    ethers.MaxUint256 // maxCount
  )

  const receipt = await depositTx.wait()
  
  // Extract deposit ID from logs
  const depositEvent = receipt.logs.find(
    (log: any) => log.topics[0] === ethers.id('FundsDeposited(...)')
  )
  
  return {
    txHash: receipt.transactionHash,
    depositId: depositEvent?.topics[1],
  }
}
```

### Track Across Bridge Status

```typescript
async function trackAcrossBridgeStatus(
  depositTxHash: string,
  originChainId: number,
  destinationChainId: number
) {
  const response = await fetch('https://across.to/api/deposit/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originChainId,
      depositTxHash,
    }),
  })

  const data = await response.json()

  return {
    status: data.status, // 'pending', 'filled', 'expired'
    fillTxHash: data.fillTx,
    fillTimestamp: data.fillTimestamp,
    relayer: data.relayer,
  }
}
```

### Across SDK (Alternative)

```typescript
import { AcrossClient } from '@across-protocol/sdk'

const acrossClient = new AcrossClient({
  chains: [mainnet, arbitrum, base, polygon],
  useTestnet: false,
})

// Get quote using SDK
const quote = await acrossClient.getQuote({
  route: {
    originChainId: 42161,
    destinationChainId: 8453,
    inputToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    outputToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  inputAmount: parseUnits('10', 6), // 10 USDC
})

// Execute
const { depositTxReceipt } = await acrossClient.executeQuote({
  walletClient,
  deposit: quote.deposit,
  onProgress: (progress) => {
    console.log(`Step: ${progress.step}, Status: ${progress.status}`)
  },
})
```

---

## 5. Solana↔EVM Bridging

### Overview

Bridging between Solana and EVM chains requires specialized bridges. The main options are:

| Bridge | Speed | Min Amount | Best For |
|--------|-------|------------|----------|
| **deBridge** | 1-5 min | ~$1 | Small amounts, dust |
| **Wormhole** | 15-20 min | ~$10 | Larger amounts, reliability |
| **Mayan** | 2-5 min | ~$5 | Via Li.Fi integration |

### deBridge Integration (Recommended for Dust)

deBridge provides fast, cheap transfers between Solana and EVM chains.

#### API Setup

```typescript
const DEBRIDGE_API = 'https://api.dln.trade/v1.0'

interface DeBridgeQuoteParams {
  srcChainId: number | string  // 7565164 for Solana
  srcChainTokenIn: string
  srcChainTokenInAmount: string
  dstChainId: number | string
  dstChainTokenOut: string
  dstChainTokenOutRecipient: string
  senderAddress: string
  srcChainOrderAuthorityAddress?: string
  dstChainOrderAuthorityAddress?: string
}

// Chain IDs
const DEBRIDGE_CHAIN_IDS = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  polygon: 137,
  bsc: 56,
  solana: 7565164,
}
```

#### Get Solana→EVM Quote

```typescript
async function getDeBridgeSolanaToEvmQuote(params: {
  solanaToken: string    // Solana token mint address
  evmChainId: number
  evmToken: string       // Destination token address
  amount: string         // In smallest units
  solanaAddress: string  // Solana wallet
  evmAddress: string     // EVM destination
}) {
  const queryParams = new URLSearchParams({
    srcChainId: '7565164', // Solana
    srcChainTokenIn: params.solanaToken,
    srcChainTokenInAmount: params.amount,
    dstChainId: params.evmChainId.toString(),
    dstChainTokenOut: params.evmToken,
    dstChainTokenOutRecipient: params.evmAddress,
    senderAddress: params.solanaAddress,
  })

  const response = await fetch(
    `${DEBRIDGE_API}/dln/order/quote?${queryParams}`
  )

  const data = await response.json()

  return {
    estimatedOutput: data.estimation.dstChainTokenOut.amount,
    fees: {
      bridgeFee: data.estimation.fees.bridgeFee,
      srcChainFee: data.estimation.fees.srcChainFee,
      dstChainFee: data.estimation.fees.dstChainFee,
    },
    executionTime: data.estimation.executionTime, // seconds
    orderId: data.orderId,
    tx: data.tx, // Transaction to sign on Solana
  }
}
```

#### Execute Solana→EVM Bridge

```typescript
import { 
  Connection, 
  Transaction, 
  Keypair,
  VersionedTransaction 
} from '@solana/web3.js'

async function executeDeBridgeSolanaToEvm(
  quote: any,
  solanaWallet: Keypair,
  connection: Connection
) {
  // Deserialize the transaction from deBridge
  const txBuffer = Buffer.from(quote.tx.data, 'base64')
  
  let transaction: Transaction | VersionedTransaction
  
  try {
    // Try versioned transaction first
    transaction = VersionedTransaction.deserialize(txBuffer)
    transaction.sign([solanaWallet])
  } catch {
    // Fall back to legacy transaction
    transaction = Transaction.from(txBuffer)
    transaction.sign(solanaWallet)
  }

  // Send transaction
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: true, maxRetries: 3 }
  )

  // Confirm
  await connection.confirmTransaction(signature, 'confirmed')

  return {
    solanaSignature: signature,
    orderId: quote.orderId,
  }
}
```

#### Track deBridge Order

```typescript
async function trackDeBridgeOrder(orderId: string) {
  const response = await fetch(
    `${DEBRIDGE_API}/dln/order/${orderId}/status`
  )

  const data = await response.json()

  return {
    status: data.status, // 'Created', 'Fulfilled', 'SentUnlock', 'ClaimedUnlock', 'Cancelled'
    srcTxHash: data.srcChainTxHash,
    dstTxHash: data.dstChainTxHash,
    createdAt: data.createdAt,
    fulfilledAt: data.fulfilledAt,
  }
}
```

### Wormhole Integration

Wormhole is the most battle-tested Solana↔EVM bridge, best for larger amounts.

#### Wormhole SDK Setup

```typescript
import {
  Wormhole,
  chainToPlatform,
  signSendWait,
  amount as wormholeAmount,
} from '@wormhole-foundation/sdk'
import evm from '@wormhole-foundation/sdk/evm'
import solana from '@wormhole-foundation/sdk/solana'

// Initialize Wormhole
const wh = new Wormhole('Mainnet', [evm, solana])

// Get chain contexts
const solanaChain = wh.getChain('Solana')
const arbitrumChain = wh.getChain('Arbitrum')
```

#### Solana→EVM Transfer

```typescript
import { TokenTransfer } from '@wormhole-foundation/sdk'

async function wormholeSolanaToEvm(params: {
  sourceChain: 'Solana'
  destChain: 'Arbitrum' | 'Ethereum' | 'Base' | 'Polygon'
  token: string
  amount: string
  senderSigner: any // Solana signer
  recipientAddress: string
}) {
  const srcChain = wh.getChain(params.sourceChain)
  const dstChain = wh.getChain(params.destChain)

  // Create transfer
  const transfer = await TokenTransfer.from(wh, {
    chain: srcChain,
    token: params.token,
    amount: wormholeAmount.parse(params.amount),
    to: {
      chain: dstChain,
      address: params.recipientAddress,
    },
  })

  // Quote the transfer
  const quote = await TokenTransfer.quoteTransfer(wh, srcChain, dstChain, transfer)
  console.log('Transfer quote:', quote)

  // Initiate transfer on source chain
  const srcTxIds = await transfer.initiateTransfer(params.senderSigner)
  console.log('Source txs:', srcTxIds)

  // Wait for attestation (VAA)
  const attestation = await transfer.fetchAttestation(60_000) // 60 second timeout
  console.log('Attestation received')

  return {
    srcTxIds,
    attestation,
    transfer, // Use for completing on destination
  }
}
```

#### Complete on Destination (EVM)

```typescript
async function completeWormholeOnEvm(
  transfer: TokenTransfer<any>,
  evmSigner: any
) {
  // Complete the transfer on destination chain
  const dstTxIds = await transfer.completeTransfer(evmSigner)
  
  return {
    destinationTxIds: dstTxIds,
    status: 'completed',
  }
}
```

### EVM→Solana Bridging

```typescript
// Using deBridge (recommended for dust)
async function getDeBridgeEvmToSolanaQuote(params: {
  evmChainId: number
  evmToken: string
  solanaToken: string
  amount: string
  evmAddress: string
  solanaAddress: string
}) {
  const queryParams = new URLSearchParams({
    srcChainId: params.evmChainId.toString(),
    srcChainTokenIn: params.evmToken,
    srcChainTokenInAmount: params.amount,
    dstChainId: '7565164', // Solana
    dstChainTokenOut: params.solanaToken,
    dstChainTokenOutRecipient: params.solanaAddress,
    senderAddress: params.evmAddress,
  })

  const response = await fetch(
    `${DEBRIDGE_API}/dln/order/quote?${queryParams}`
  )

  return response.json()
}

async function executeDeBridgeEvmToSolana(
  quote: any,
  signer: ethers.Signer
) {
  // Approve token if needed
  if (quote.tx.allowanceTarget) {
    const token = new ethers.Contract(
      quote.estimation.srcChainTokenIn.address,
      ['function approve(address,uint256) external'],
      signer
    )
    const approveTx = await token.approve(
      quote.tx.allowanceTarget,
      quote.estimation.srcChainTokenIn.amount
    )
    await approveTx.wait()
  }

  // Execute bridge transaction
  const tx = await signer.sendTransaction({
    to: quote.tx.to,
    data: quote.tx.data,
    value: quote.tx.value,
  })

  const receipt = await tx.wait()

  return {
    txHash: receipt.transactionHash,
    orderId: quote.orderId,
  }
}
```

### Mayan via Li.Fi

Li.Fi integrates Mayan for Solana bridges, providing a unified interface:

```typescript
import { getRoutes, executeRoute } from '@lifi/sdk'

// Li.Fi Solana chain ID
const SOLANA_CHAIN_ID = 1151111081099710

async function bridgeSolanaViaLiFi(params: {
  toEvmChain: number
  solanaToken: string
  evmToken: string
  amount: string
  solanaAddress: string
  evmAddress: string
}) {
  const routes = await getRoutes({
    fromChainId: SOLANA_CHAIN_ID,
    toChainId: params.toEvmChain,
    fromTokenAddress: params.solanaToken,
    toTokenAddress: params.evmToken,
    fromAmount: params.amount,
    fromAddress: params.solanaAddress,
    toAddress: params.evmAddress,
    options: {
      preferBridges: ['mayan'], // Prefer Mayan for Solana
      slippage: 0.02,
    },
  })

  return routes
}
```

---

## 6. Consolidation Strategy

### Optimal Destination Chain Selection

For dust consolidation from multiple chains, choose the destination based on:

```typescript
interface ChainScoreFactors {
  gasCost: number      // Average tx cost in USD
  bridgingCost: number // Avg cost to bridge TO this chain
  defiOptions: number  // Number of yield opportunities
  speed: number        // Avg bridge time in seconds
  liquidity: number    // DEX liquidity score
}

const CHAIN_SCORES: Record<number, ChainScoreFactors> = {
  // Base - Recommended for dust consolidation
  8453: {
    gasCost: 0.01,
    bridgingCost: 0.50,
    defiOptions: 8,
    speed: 120,
    liquidity: 9,
  },
  // Arbitrum - Good alternative
  42161: {
    gasCost: 0.03,
    bridgingCost: 0.40,
    defiOptions: 10,
    speed: 60,
    liquidity: 10,
  },
  // Polygon - Cheapest but slower
  137: {
    gasCost: 0.005,
    bridgingCost: 0.60,
    defiOptions: 7,
    speed: 300,
    liquidity: 8,
  },
  // Ethereum - Only for large amounts
  1: {
    gasCost: 3.00,
    bridgingCost: 2.00,
    defiOptions: 10,
    speed: 180,
    liquidity: 10,
  },
}

function selectOptimalDestination(
  userPositions: Array<{ chainId: number; valueUsd: number }>,
  prioritize: 'cost' | 'speed' | 'yield' = 'cost'
): number {
  const totalValue = userPositions.reduce((sum, p) => sum + p.valueUsd, 0)
  
  // For small dust (<$50), prioritize cost
  if (totalValue < 50) {
    prioritize = 'cost'
  }
  
  // Score each potential destination
  const scores = Object.entries(CHAIN_SCORES).map(([chainId, factors]) => {
    let score = 0
    
    // Calculate total bridging cost from all source chains
    const bridgingCosts = userPositions
      .filter(p => p.chainId !== parseInt(chainId))
      .reduce((sum, p) => sum + factors.bridgingCost * (p.valueUsd / 100), 0)
    
    switch (prioritize) {
      case 'cost':
        score = 100 - (factors.gasCost * 10 + bridgingCosts)
        break
      case 'speed':
        score = 100 - (factors.speed / 60) // Lower is better
        break
      case 'yield':
        score = factors.defiOptions * 10
        break
    }
    
    return { chainId: parseInt(chainId), score }
  })
  
  return scores.sort((a, b) => b.score - a.score)[0].chainId
}
```

### Recommended Consolidation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              DUST CONSOLIDATION DECISION TREE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User has dust on multiple chains                                           │
│       │                                                                     │
│       ▼                                                                     │
│  Total dust value?                                                          │
│       │                                                                     │
│       ├── < $10 ──▶ Consolidate to Base (cheapest)                         │
│       │              Use: Across (EVM) + deBridge (Solana)                  │
│       │                                                                     │
│       ├── $10-$100 ──▶ Consolidate to Arbitrum (good DeFi options)         │
│       │                 Use: Li.Fi for optimal routing                      │
│       │                                                                     │
│       └── > $100 ──▶ Let user choose destination                           │
│                      Offer: Base, Arbitrum, or keep on Ethereum            │
│                                                                             │
│  After consolidation:                                                       │
│       │                                                                     │
│       └──▶ Route to DeFi (Aave, Beefy, etc.) on destination chain          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Batching Cross-Chain Operations

```typescript
interface ConsolidationBatch {
  userId: string
  positions: Array<{
    chainId: number
    token: string
    amount: string
    valueUsd: number
  }>
  destination: {
    chainId: number
    token: string
  }
}

class CrossChainBatcher {
  private batches: Map<string, ConsolidationBatch[]> = new Map()
  private batchTimeout = 30000 // 30 seconds
  
  async addToBatch(consolidation: ConsolidationBatch) {
    // Group by destination chain + token
    const batchKey = `${consolidation.destination.chainId}-${consolidation.destination.token}`
    
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, [])
      
      // Schedule batch execution
      setTimeout(() => this.executeBatch(batchKey), this.batchTimeout)
    }
    
    this.batches.get(batchKey)!.push(consolidation)
  }
  
  private async executeBatch(batchKey: string) {
    const batch = this.batches.get(batchKey)
    if (!batch || batch.length === 0) return
    
    // Group by source chain for efficiency
    const bySourceChain = new Map<number, ConsolidationBatch[]>()
    
    for (const consolidation of batch) {
      for (const position of consolidation.positions) {
        if (!bySourceChain.has(position.chainId)) {
          bySourceChain.set(position.chainId, [])
        }
        bySourceChain.get(position.chainId)!.push(consolidation)
      }
    }
    
    // Execute bridges from each source chain in parallel
    const results = await Promise.allSettled(
      Array.from(bySourceChain.entries()).map(async ([sourceChain, items]) => {
        return this.executeBridgesFromChain(sourceChain, items)
      })
    )
    
    // Clear batch
    this.batches.delete(batchKey)
    
    return results
  }
  
  private async executeBridgesFromChain(
    sourceChain: number,
    consolidations: ConsolidationBatch[]
  ) {
    // Select best bridge for this source chain
    const bridge = this.selectBridge(sourceChain)
    
    const results = []
    for (const consolidation of consolidations) {
      try {
        const result = await this.executeSingleBridge(bridge, consolidation)
        results.push({ success: true, ...result })
      } catch (error) {
        results.push({ success: false, error: error.message })
      }
    }
    
    return results
  }
  
  private selectBridge(sourceChain: number): string {
    // Solana requires special bridges
    if (sourceChain === 7565164) return 'debridge'
    
    // EVM chains - prefer Across for speed
    return 'across'
  }
}
```

### Failed Bridge Handling

```typescript
interface BridgeAttempt {
  bridge: string
  txHash?: string
  status: 'pending' | 'success' | 'failed' | 'refunded'
  error?: string
  retryCount: number
  timestamp: number
}

class BridgeRecoveryManager {
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAYS = [60000, 300000, 900000] // 1min, 5min, 15min
  
  async handleFailedBridge(attempt: BridgeAttempt): Promise<RecoveryResult> {
    // 1. Check if funds are stuck or refunded
    const status = await this.checkBridgeStatus(attempt)
    
    if (status.status === 'refunded') {
      return {
        action: 'REFUNDED',
        message: 'Tokens returned to source wallet',
        refundTxHash: status.refundTxHash,
      }
    }
    
    if (status.status === 'stuck') {
      // 2. Attempt recovery based on bridge
      return this.attemptRecovery(attempt, status)
    }
    
    if (status.status === 'pending' && attempt.retryCount < this.MAX_RETRIES) {
      // 3. Schedule retry with backoff
      const delay = this.RETRY_DELAYS[attempt.retryCount]
      return {
        action: 'RETRY_SCHEDULED',
        retryAt: Date.now() + delay,
        retryCount: attempt.retryCount + 1,
      }
    }
    
    // 4. Escalate to manual review
    return {
      action: 'MANUAL_REVIEW',
      message: 'Bridge failed, manual intervention required',
      supportData: {
        bridge: attempt.bridge,
        txHash: attempt.txHash,
        error: attempt.error,
      },
    }
  }
  
  private async attemptRecovery(
    attempt: BridgeAttempt,
    status: BridgeStatus
  ): Promise<RecoveryResult> {
    switch (attempt.bridge) {
      case 'across':
        // Across usually auto-refunds after timeout
        return {
          action: 'WAIT_REFUND',
          message: 'Across will auto-refund within 2 hours',
          checkAgainAt: Date.now() + 7200000, // 2 hours
        }
        
      case 'lifi':
        // Check Li.Fi explorer for recovery options
        return {
          action: 'CHECK_EXPLORER',
          explorerUrl: `https://explorer.li.fi/tx/${attempt.txHash}`,
          message: 'Check Li.Fi explorer for status and recovery options',
        }
        
      case 'debridge':
        // deBridge orders can be cancelled by user
        return {
          action: 'CANCEL_ORDER',
          message: 'Order can be cancelled on deBridge app',
          appUrl: `https://app.debridge.finance/order/${status.orderId}`,
        }
        
      case 'wormhole':
        // Wormhole requires manual VAA submission
        return {
          action: 'MANUAL_REDEEM',
          message: 'Complete transfer manually on Wormhole Portal',
          portalUrl: 'https://portalbridge.com/redeem',
          vaa: status.vaa,
        }
        
      default:
        return {
          action: 'UNKNOWN',
          message: 'Unknown bridge, contact support',
        }
    }
  }
}
```

### Refund Detection and Handling

```typescript
interface RefundEvent {
  bridge: string
  originalTxHash: string
  refundTxHash: string
  amount: string
  token: string
  chainId: number
}

async function detectRefunds(
  userAddress: string,
  pendingBridges: BridgeAttempt[]
): Promise<RefundEvent[]> {
  const refunds: RefundEvent[] = []
  
  for (const bridge of pendingBridges) {
    const refund = await checkForRefund(bridge)
    if (refund) {
      refunds.push({
        bridge: bridge.bridge,
        originalTxHash: bridge.txHash!,
        refundTxHash: refund.txHash,
        amount: refund.amount,
        token: refund.token,
        chainId: refund.chainId,
      })
    }
  }
  
  return refunds
}

async function handleRefund(refund: RefundEvent) {
  // Log refund
  console.log(`Refund detected: ${refund.amount} ${refund.token} on chain ${refund.chainId}`)
  
  // Options:
  // 1. Retry with different bridge
  // 2. Notify user
  // 3. Auto-retry after delay
  
  return {
    action: 'REFUND_RECEIVED',
    suggestion: 'Retry bridge with alternative protocol',
    alternatives: await getAlternativeBridges(refund),
  }
}
```

---

## 7. Cost Comparison

### Bridge Fee Comparison

| Bridge | ETH→ARB | ARB→BASE | SOL→ETH | Min Amount |
|--------|---------|----------|---------|------------|
| **Across** | ~0.06% | ~0.06% | N/A | $1 |
| **Li.Fi (via Stargate)** | ~0.10% | ~0.10% | ~0.15% | $5 |
| **Li.Fi (via Hop)** | ~0.08% | ~0.08% | N/A | $2 |
| **Socket** | ~0.08% | ~0.08% | N/A | $2 |
| **deBridge** | ~0.10% | ~0.10% | ~0.10% | $1 |
| **Wormhole** | ~0.15% | N/A | ~0.15% | $10 |

### Total Cost for Dust Consolidation

```
Scenario: User has dust across 5 chains, consolidating to Base

Position: 
- Ethereum: $5 USDC
- Arbitrum: $8 USDC  
- Polygon: $3 USDC
- BNB: $4 USDC
- Solana: $10 USDC
Total: $30

Using Recommended Stack (Across + deBridge):
─────────────────────────────────────────
| Source    | Amount | Bridge | Fee    |
|-----------|--------|--------|--------|
| ETH→Base  | $5     | Across | $0.03  |
| ARB→Base  | $8     | Across | $0.02  |
| POL→Base  | $3     | Across | $0.02  |
| BNB→Base  | $4     | Across | $0.02  |
| SOL→Base  | $10    | deBridge| $0.10 |
|-----------|--------|--------|--------|
| TOTAL     | $30    |        | $0.19  |
─────────────────────────────────────────

Final amount on Base: ~$29.81 (0.63% total fees)
```

### Break-Even Analysis

```typescript
function calculateBreakeven(
  sourceChain: number,
  destChain: number,
  bridge: string
): number {
  // Fixed costs
  const bridgeBaseFee: Record<string, number> = {
    across: 0.00,      // No fixed fee
    lifi: 0.00,
    debridge: 0.00,
    wormhole: 0.50,    // ~$0.50 gas on Solana side
  }
  
  // Percentage fees
  const bridgePercentFee: Record<string, number> = {
    across: 0.0006,    // 0.06%
    lifi: 0.001,       // 0.1%
    debridge: 0.001,   // 0.1%
    wormhole: 0.0015,  // 0.15%
  }
  
  // Source chain gas (for approval + deposit)
  const sourceGasCost: Record<number, number> = {
    1: 3.00,     // Ethereum
    42161: 0.05, // Arbitrum
    8453: 0.02,  // Base
    137: 0.01,   // Polygon
    56: 0.10,    // BNB
    7565164: 0.01, // Solana
  }
  
  const fixedCost = bridgeBaseFee[bridge] + sourceGasCost[sourceChain]
  const percentFee = bridgePercentFee[bridge]
  
  // Break-even when: amount * (1 - fee) - fixedCost > 0
  // amount > fixedCost / (1 - fee)
  const breakeven = fixedCost / (1 - percentFee)
  
  return Math.ceil(breakeven * 100) / 100 // Round up to cents
}

// Example breakevens
console.log(calculateBreakeven(42161, 8453, 'across'))  // ~$0.05
console.log(calculateBreakeven(1, 8453, 'across'))      // ~$3.00
console.log(calculateBreakeven(7565164, 8453, 'debridge')) // ~$0.01
```

---

## 8. Error Handling Patterns

### Unified Error Types

```typescript
enum BridgeErrorCode {
  // Transaction Errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REVERTED = 'TRANSACTION_REVERTED',
  TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
  INSUFFICIENT_GAS = 'INSUFFICIENT_GAS',
  
  // Bridge-Specific Errors
  BRIDGE_UNAVAILABLE = 'BRIDGE_UNAVAILABLE',
  BRIDGE_PAUSED = 'BRIDGE_PAUSED',
  LIQUIDITY_INSUFFICIENT = 'LIQUIDITY_INSUFFICIENT',
  AMOUNT_TOO_LOW = 'AMOUNT_TOO_LOW',
  AMOUNT_TOO_HIGH = 'AMOUNT_TOO_HIGH',
  
  // Route Errors
  NO_ROUTE_FOUND = 'NO_ROUTE_FOUND',
  ROUTE_EXPIRED = 'ROUTE_EXPIRED',
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  
  // Destination Errors
  DESTINATION_TX_FAILED = 'DESTINATION_TX_FAILED',
  DESTINATION_TIMEOUT = 'DESTINATION_TIMEOUT',
  
  // Recovery
  REFUND_PENDING = 'REFUND_PENDING',
  MANUAL_INTERVENTION_REQUIRED = 'MANUAL_INTERVENTION_REQUIRED',
}

class BridgeError extends Error {
  constructor(
    public code: BridgeErrorCode,
    public bridge: string,
    public details: Record<string, any>,
    message: string
  ) {
    super(message)
    this.name = 'BridgeError'
  }
  
  get isRetryable(): boolean {
    return [
      BridgeErrorCode.TRANSACTION_TIMEOUT,
      BridgeErrorCode.BRIDGE_UNAVAILABLE,
      BridgeErrorCode.SLIPPAGE_EXCEEDED,
      BridgeErrorCode.DESTINATION_TIMEOUT,
    ].includes(this.code)
  }
  
  get requiresUserAction(): boolean {
    return [
      BridgeErrorCode.INSUFFICIENT_GAS,
      BridgeErrorCode.MANUAL_INTERVENTION_REQUIRED,
    ].includes(this.code)
  }
}
```

### Retry Strategy

```typescript
interface RetryConfig {
  maxRetries: number
  backoffMs: number[]
  retryableCodes: BridgeErrorCode[]
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: [5000, 15000, 60000], // 5s, 15s, 60s
  retryableCodes: [
    BridgeErrorCode.TRANSACTION_TIMEOUT,
    BridgeErrorCode.BRIDGE_UNAVAILABLE,
    BridgeErrorCode.SLIPPAGE_EXCEEDED,
  ],
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // Check if retryable
      if (error instanceof BridgeError) {
        if (!config.retryableCodes.includes(error.code)) {
          throw error // Not retryable
        }
      }
      
      // Check if we have retries left
      if (attempt >= config.maxRetries) {
        break
      }
      
      // Wait before retry
      const delay = config.backoffMs[attempt] || config.backoffMs[config.backoffMs.length - 1]
      console.log(`Retry ${attempt + 1}/${config.maxRetries} after ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  
  throw lastError
}
```

### Fallback Bridge Selection

```typescript
const BRIDGE_FALLBACK_ORDER: Record<string, string[]> = {
  // EVM to EVM
  'evm-evm': ['across', 'stargate', 'hop', 'celer'],
  // Solana to EVM
  'solana-evm': ['debridge', 'mayan', 'wormhole'],
  // EVM to Solana
  'evm-solana': ['debridge', 'wormhole', 'mayan'],
}

async function bridgeWithFallback(
  params: BridgeParams
): Promise<BridgeResult> {
  const routeType = getRouteType(params.sourceChain, params.destChain)
  const bridges = BRIDGE_FALLBACK_ORDER[routeType]
  
  const errors: Array<{ bridge: string; error: Error }> = []
  
  for (const bridge of bridges) {
    try {
      console.log(`Attempting bridge: ${bridge}`)
      const result = await executeBridge(bridge, params)
      return result
    } catch (error) {
      errors.push({ bridge, error: error as Error })
      console.log(`Bridge ${bridge} failed:`, error.message)
      
      // Don't try more if it's a user error
      if (error instanceof BridgeError && error.requiresUserAction) {
        throw error
      }
    }
  }
  
  // All bridges failed
  throw new BridgeError(
    BridgeErrorCode.NO_ROUTE_FOUND,
    'all',
    { errors: errors.map(e => ({ bridge: e.bridge, message: e.error.message })) },
    `All bridges failed: ${errors.map(e => e.bridge).join(', ')}`
  )
}
```

---

## 9. Recommended Stack

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SWEEP BRIDGING ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────┐                                                         │
│   │   User Input  │  "Consolidate my dust to Base"                         │
│   └───────┬───────┘                                                         │
│           │                                                                 │
│           ▼                                                                 │
│   ┌───────────────────────────────────────────────────────────────┐        │
│   │                    Route Optimizer                             │        │
│   │  • Scans all positions across chains                          │        │
│   │  • Calculates optimal destination                             │        │
│   │  • Selects best bridge per route                              │        │
│   └───────┬───────────────────────────────────────────────────────┘        │
│           │                                                                 │
│           ▼                                                                 │
│   ┌───────────────────────────────────────────────────────────────┐        │
│   │                    Bridge Router                               │        │
│   │                                                                │        │
│   │   EVM→EVM:        │   SOL→EVM:        │   EVM→SOL:            │        │
│   │   ┌─────────┐     │   ┌─────────┐     │   ┌─────────┐         │        │
│   │   │ Across  │◀───Primary for fast, cheap transfers             │        │
│   │   └─────────┘     │   │deBridge │◀───Primary for Solana       │        │
│   │   ┌─────────┐     │   └─────────┘     │   └─────────┘         │        │
│   │   │  Li.Fi  │◀───Fallback for complex routes                  │        │
│   │   └─────────┘     │   ┌─────────┐     │   ┌─────────┐         │        │
│   │   ┌─────────┐     │   │Wormhole │◀───Fallback for large amts  │        │
│   │   │ Socket  │◀───Alternative for multi-hop                    │        │
│   │   └─────────┘     │   └─────────┘     │   └─────────┘         │        │
│   │                                                                │        │
│   └───────┬───────────────────────────────────────────────────────┘        │
│           │                                                                 │
│           ▼                                                                 │
│   ┌───────────────────────────────────────────────────────────────┐        │
│   │                    Status Monitor                              │        │
│   │  • Polls bridge status APIs                                   │        │
│   │  • Handles timeouts and retries                               │        │
│   │  • Detects refunds                                            │        │
│   │  • Escalates stuck transfers                                  │        │
│   └───────────────────────────────────────────────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Package Dependencies

```json
{
  "dependencies": {
    // Bridge SDKs
    "@lifi/sdk": "^3.0.0",
    "@across-protocol/sdk": "^2.0.0",
    "@wormhole-foundation/sdk": "^0.10.0",
    
    // Chain interaction
    "viem": "^2.0.0",
    "@solana/web3.js": "^1.90.0",
    "ethers": "^6.0.0",
    
    // Utilities
    "bottleneck": "^2.19.5",
    "ioredis": "^5.3.0",
    "bullmq": "^5.0.0",
    
    // HTTP client
    "axios": "^1.6.0"
  }
}
```

### Implementation Priority

| Priority | Feature | Bridge/Tool | Timeline |
|----------|---------|-------------|----------|
| **P0** | EVM↔EVM bridging | Across | Week 1 |
| **P0** | Quote aggregation | Li.Fi | Week 1 |
| **P1** | Solana→EVM | deBridge | Week 2 |
| **P1** | Status tracking | All | Week 2 |
| **P2** | EVM→Solana | deBridge | Week 3 |
| **P2** | Fallback routing | Socket | Week 3 |
| **P3** | Multi-hop routes | Socket/Li.Fi | Week 4 |
| **P3** | Contract calls | Li.Fi | Week 4 |

### Rate Limit Summary

| Service | Free Tier | Production Tier | Cost |
|---------|-----------|-----------------|------|
| **Li.Fi** | 10 req/s | 50+ req/s | Partner program |
| **Socket** | 5 req/s | 50 req/s | API key |
| **Across** | No limit | No limit | Free |
| **deBridge** | 10 req/s | 100 req/s | API key |

### Monitoring & Alerting

```typescript
// Key metrics to track
const BRIDGE_METRICS = {
  // Success rates
  'bridge.success_rate': 'gauge',
  'bridge.failure_rate': 'gauge',
  
  // Timing
  'bridge.quote_latency_ms': 'histogram',
  'bridge.execution_time_seconds': 'histogram',
  
  // Volume
  'bridge.volume_usd': 'counter',
  'bridge.transaction_count': 'counter',
  
  // Errors
  'bridge.error_count': 'counter',
  'bridge.refund_count': 'counter',
  
  // Per-bridge breakdown
  'bridge.usage_by_protocol': 'counter',
}

// Alert thresholds
const ALERTS = {
  // Alert if success rate drops below 95%
  lowSuccessRate: {
    metric: 'bridge.success_rate',
    threshold: 0.95,
    comparison: 'lt',
  },
  // Alert if avg bridge time exceeds 30 minutes
  slowBridging: {
    metric: 'bridge.execution_time_seconds',
    threshold: 1800,
    comparison: 'gt',
  },
  // Alert if refund rate exceeds 5%
  highRefundRate: {
    metric: 'bridge.refund_count / bridge.transaction_count',
    threshold: 0.05,
    comparison: 'gt',
  },
}
```

---

## Resources

### Documentation Links

| Resource | URL |
|----------|-----|
| Li.Fi Docs | https://docs.li.fi |
| Li.Fi SDK | https://github.com/lifinance/sdk |
| Across Protocol | https://docs.across.to |
| Socket API | https://docs.socket.tech |
| deBridge API | https://docs.debridge.finance |
| Wormhole SDK | https://docs.wormhole.com/wormhole/quick-start/cross-chain-dev |

### Support Channels

| Bridge | Support Channel |
|--------|-----------------|
| Li.Fi | Discord: discord.gg/lifi |
| Across | Discord: discord.gg/across |
| Socket | Discord: discord.gg/sockettech |
| deBridge | Discord: discord.gg/debridge |
| Wormhole | Discord: discord.gg/wormholecrypto |

---

*Document compiled for Sweep cross-chain bridging infrastructure. January 2026.*
