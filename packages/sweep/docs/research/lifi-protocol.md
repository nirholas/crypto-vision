# Li.Fi Protocol - Comprehensive Research Documentation

## Overview

Li.Fi (Linked Finance) is a cross-chain bridge and DEX aggregation protocol that enables seamless token transfers across multiple blockchain networks. It aggregates bridges (Stargate, Across, Hop, DeBridge, etc.) and DEXs to find optimal routes for cross-chain swaps.

---

## 1. API Documentation

### Base URL
```
https://li.quest/v1
```

### Core Endpoints

#### Quote Endpoint
```http
GET /quote
GET /quote/toAmount
```

**Parameters:**
- `fromChain` - Source chain ID or key
- `toChain` - Destination chain ID or key  
- `fromToken` - Source token address
- `toToken` - Destination token address
- `fromAmount` - Amount to send (use with `/quote`)
- `toAmount` - Amount to receive (use with `/quote/toAmount`)
- `fromAddress` - Sender wallet address
- `toAddress` - Recipient address (optional)
- `slippage` - Slippage tolerance (0.01 = 1%)
- `integrator` - Your app/company identifier (required)
- `order` - Route ordering: `FASTEST`, `CHEAPEST`, `RECOMMENDED`

#### Routes Endpoint
```http
POST /advanced/routes
```

**Request Body:**
```typescript
interface RoutesRequest {
  fromChainId: number
  toChainId: number
  fromTokenAddress: string
  toTokenAddress: string
  fromAmount: string
  fromAddress?: string
  toAddress?: string
  options?: {
    integrator: string
    slippage?: number
    order?: 'FASTEST' | 'CHEAPEST' | 'RECOMMENDED'
    allowBridges?: string[]
    denyBridges?: string[]
    preferBridges?: string[]
    allowExchanges?: string[]
    denyExchanges?: string[]
  }
}
```

#### Status Endpoint
```http
GET /status
```

**Parameters:**
- `txHash` - Transaction hash
- `bridge` - Bridge tool name
- `fromChain` - Source chain ID
- `toChain` - Destination chain ID

**Response Status Values:**
- `PENDING` - Transaction in progress
- `DONE` - Transaction completed
- `FAILED` - Transaction failed
- `NOT_FOUND` - Transaction not found

#### Substatuses:
- `WAIT_SOURCE_CONFIRMATIONS` - Waiting for source chain confirmations
- `WAIT_DESTINATION_TRANSACTION` - Waiting for destination transaction
- `BRIDGE_NOT_AVAILABLE` - Bridge temporarily unavailable
- `CHAIN_NOT_AVAILABLE` - RPC unavailable
- `PARTIAL` - Partial completion
- `COMPLETED` - Fully completed
- `REFUNDED` - Tokens refunded

#### Contract Calls Quote
```http
POST /quote/contractCalls
```

For combining cross-chain transfers with smart contract interactions.

#### Other Endpoints
- `GET /chains` - Get supported chains
- `GET /tokens` - Get supported tokens  
- `GET /tools` - Get available bridges and exchanges
- `GET /connections` - Get available token routes
- `GET /gas` - Gas recommendations

---

## 2. SDK Integration (@lifi/sdk)

### Installation
```bash
npm install @lifi/sdk
# or
yarn add @lifi/sdk
```

### Basic Setup
```typescript
import { createConfig, EVM } from '@lifi/sdk'
import { createWalletClient, http } from 'viem'
import { mainnet } from 'viem/chains'

// Create wallet client
const walletClient = createWalletClient({
  chain: mainnet,
  transport: http(),
})

// Initialize SDK
createConfig({
  integrator: 'your-app-name', // Required - your dApp/company name
  providers: [
    EVM({
      getWalletClient: () => Promise.resolve(walletClient),
      switchChain: async (chainId) => {
        // Handle chain switching
        return createWalletClient({
          chain: getChainById(chainId),
          transport: http(),
        })
      },
    }),
  ],
})
```

### Advanced Configuration
```typescript
createConfig({
  integrator: 'your-app-name',
  apiKey: 'optional-api-key',
  apiUrl: 'https://li.quest/v1', // Default
  rpcUrls: {
    1: ['https://eth-mainnet.g.alchemy.com/v2/...'],
    137: ['https://polygon-mainnet.g.alchemy.com/v2/...'],
  },
  routeOptions: {
    slippage: 0.005, // 0.5%
    order: 'CHEAPEST',
    bridges: {
      allow: ['stargate', 'across', 'hop'],
      deny: ['multichain'],
    },
    exchanges: {
      allow: ['uniswap', 'sushiswap'],
    },
  },
  providers: [
    EVM({ getWalletClient, switchChain }),
  ],
})
```

### Core SDK Functions

#### Get Quote
```typescript
import { getQuote, ChainId } from '@lifi/sdk'

const quote = await getQuote({
  fromChain: ChainId.ARB,
  toChain: ChainId.OPT,
  fromToken: '0x0000000000000000000000000000000000000000', // Native ETH
  toToken: '0x0000000000000000000000000000000000000000',
  fromAmount: '1000000000000000000', // 1 ETH
  fromAddress: '0xYourAddress',
})
```

#### Get Routes (Multiple Options)
```typescript
import { getRoutes } from '@lifi/sdk'

const routes = await getRoutes({
  fromChainId: 42161, // Arbitrum
  toChainId: 10, // Optimism
  fromTokenAddress: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC
  toTokenAddress: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC
  fromAmount: '1000000000', // 1000 USDC
  fromAddress: '0xYourAddress',
  options: {
    slippage: 0.005,
    order: 'CHEAPEST',
  },
})
```

#### Execute Route
```typescript
import { executeRoute } from '@lifi/sdk'

const executedRoute = await executeRoute(route, {
  updateRouteHook: (updatedRoute) => {
    // Track execution progress
    console.log('Route updated:', updatedRoute)
    
    for (const step of updatedRoute.steps) {
      if (step.execution) {
        console.log('Step status:', step.execution.status)
        for (const process of step.execution.process) {
          console.log('Process:', process.type, process.status)
          if (process.txHash) {
            console.log('TX Hash:', process.txHash)
          }
        }
      }
    }
  },
})
```

#### Check Status
```typescript
import { getStatus } from '@lifi/sdk'

// Poll for status
let status
do {
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  status = await getStatus({
    txHash: txReceipt.transactionHash,
    bridge: quote.tool,
    fromChain: quote.action.fromChainId,
    toChain: quote.action.toChainId,
  })
  
  console.log('Status:', status.status)
} while (status.status !== 'DONE' && status.status !== 'FAILED')
```

#### Contract Calls Quote (DeFi Interactions)
```typescript
import { getContractCallsQuote } from '@lifi/sdk'

const contractCallsQuote = await getContractCallsQuote({
  fromAddress: '0xYourAddress',
  fromChain: 42161, // Arbitrum
  fromToken: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC
  fromAmount: '1000000000',
  toChain: 10, // Optimism
  toToken: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  contractCalls: [
    {
      fromAmount: '1000000000',
      fromTokenAddress: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      toContractAddress: '0xProtocolAddress',
      toContractCallData: encodedCalldata,
      toContractGasLimit: '300000',
    },
  ],
  toFallbackAddress: '0xYourAddress',
  slippage: 0.005,
})
```

---

## 3. Supported Chains

### EVM Chains
| Chain | Chain ID | Key |
|-------|----------|-----|
| Ethereum | 1 | `eth` |
| Polygon | 137 | `pol` |
| Arbitrum | 42161 | `arb` |
| Optimism | 10 | `opt` |
| Base | 8453 | `bas` |
| Avalanche | 43114 | `ava` |
| BNB Chain | 56 | `bsc` |
| Fantom | 250 | `ftm` |
| Gnosis | 100 | `dai` |
| zkSync Era | 324 | `era` |
| Polygon zkEVM | 1101 | `pze` |
| Linea | 59144 | `lna` |
| Scroll | 534352 | `scl` |
| Mode | 34443 | `mod` |
| Mantle | 5000 | `mnt` |
| Blast | 81457 | `bls` |
| Sei | 1329 | `sei` |
| Fraxtal | 252 | `fra` |
| Taiko | 167000 | `tai` |
| Immutable zkEVM | 13371 | `imx` |
| Kaia | 8217 | `kai` |
| opBNB | 204 | `opb` |
| World Chain | 480 | `wcc` |
| Lisk | 1135 | `lsk` |
| Abstract | 2741 | `abs` |
| Berachain | 80094 | `ber` |
| Sonic | 146 | `son` |
| Unichain | 130 | `uni` |
| ApeChain | 33139 | `ape` |
| Soneium | 1868 | `soe` |
| Ink | 57073 | `ink` |
| Lens | 232 | `lns` |
| Swell | 1923 | `swl` |
| Corn | 21000000 | `crn` |
| Etherlink | 42793 | `etl` |
| Superposition | 55244 | `sup` |
| HyperEVM | 999 | `hyp` |
| XDC | 50 | `xdc` |
| BOB | 60808 | `boc` |
| Viction | 88 | `vic` |
| Flare | 14 | `flr` |
| Katana | 747474 | `kat` |
| Vana | 1480 | `van` |
| Ronin | 2020 | `ron` |
| Plume | 98866 | `plu` |
| Nibiru | 6900 | `nib` |
| Sophon | 50104 | `sop` |
| Plasma | 9745 | `pla` |
| Flow | 747 | `flw` |
| Hemi | 43111 | `hmi` |
| Monad | 143 | `mon` |
| StarkNet | 988 | `sta` |
| MegaETH | 4326 | `meg` |
| Botanix | 3637 | `bot` |

### Non-EVM Chains
| Chain | Chain ID | Key | Type |
|-------|----------|-----|------|
| Solana | 1151111081099710 | `sol` | SVM |
| Sui | 9270000000000000 | `sui` | MVM |
| Bitcoin | 20000000000001 | `btc` | UTXO |
| Bitcoin Cash | 20000000000002 | `bch` | UTXO |
| Litecoin | 20000000000003 | `ltc` | UTXO |
| Dogecoin | 20000000000004 | `dge` | UTXO |
| Tron | 728126428 | `trn` | TVM |

---

## 4. Route Aggregation - Supported Bridges

Li.Fi aggregates the following bridges to find optimal routes:

### Bridge Protocols
- **Stargate** - LayerZero-based bridge (USDC, USDT, ETH)
- **Across** - Optimistic bridge with fast finality
- **Hop** - Cross-rollup bridge optimized for L2s
- **DeBridge DLN** - Decentralized cross-chain liquidity network
- **Polygon Bridge** - Native Polygon PoS bridge
- **Arbitrum Bridge** - Native Arbitrum bridge
- **Optimism Bridge** - Native Optimism bridge
- **Circle CCTP** - Native USDC cross-chain transfer
- **Synapse** - Cross-chain AMM bridge
- **Celer cBridge** - State channel bridge
- **Multichain** (deprecated)
- **Connext** - Non-custodial crosschain transfer
- **Symbiosis** - Cross-chain liquidity protocol
- **Squid** - Cross-chain swap & liquidity routing
- **Mayan** - Cross-chain swaps via Solana
- **Relay** - Intent-based cross-chain protocol
- **AllBridge** - Cross-chain token transfers
- **ThorSwap** - Cross-chain DEX aggregator
- **Pioneer** - Li.Fi's own solver network
- **Garden** - Bitcoin bridge
- **Polymer CCTP** - Enhanced CCTP with Polymer

### Aggregation Logic
```typescript
// Route options for bridge selection
const routes = await getRoutes({
  // ... other params
  options: {
    // Allow only specific bridges
    allowBridges: ['stargate', 'across', 'hop'],
    
    // Or deny specific bridges
    denyBridges: ['multichain'],
    
    // Prefer certain bridges (higher priority)
    preferBridges: ['across'],
  },
})
```

---

## 5. Gas Abstraction Features

### Relayer Service
Li.Fi provides gasless transactions via relayer:

```typescript
import { getRelayerQuote, relayTransaction } from '@lifi/sdk'

// Get relayer quote
const relayerQuote = await getRelayerQuote({
  fromChain: 42161,
  fromToken: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  fromAddress: '0xYourAddress',
  fromAmount: '1000000000',
  toChain: 10,
  toToken: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
})

// Relay transaction (gasless)
const result = await relayTransaction({
  typedData: signedTypedData,
})
```

### Permit2 Integration
Li.Fi supports gasless approvals via Permit2:

```typescript
// Permit2 addresses (canonical)
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

// Permit2Proxy for Li.Fi
// Available per chain via ExtendedChain.permit2Proxy
```

### Check Relayer Status
```typescript
import { getRelayedTransactionStatus } from '@lifi/sdk'

const status = await getRelayedTransactionStatus({
  taskId: '0xTaskId...',
  fromChain: 42161,
  toChain: 10,
})
```

---

## 6. Diamond Proxy Contract Addresses

Li.Fi uses the **EIP-2535 Diamond Standard** for upgradeable, modular contracts.

### Production Diamond Address
```
0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE
```
*This address is consistent across most EVM chains*

### Contract Architecture

```
LiFiDiamond (Proxy)
├── DiamondCutFacet - Upgrade management
├── DiamondLoupeFacet - Facet inspection
├── OwnershipFacet - Owner management
├── EmergencyPauseFacet - Emergency controls
└── Bridge Facets
    ├── StargateFacet
    ├── AcrossFacet
    ├── HopFacet
    ├── DeBridgeDlnFacet
    ├── PolygonBridgeFacet
    ├── ArbitrumBridgeFacet
    ├── OptimismBridgeFacet
    ├── CircleBridgeFacet
    ├── SynapseBridgeFacet
    ├── MayanFacet
    ├── RelayFacet
    ├── RelayDepositoryFacet
    ├── SquidFacet
    ├── ThorSwapFacet
    ├── AllBridgeFacet
    ├── PioneerFacet
    ├── GardenFacet
    ├── PolymerCCTPFacet
    └── ... more facets
```

### Key Periphery Contracts
- **Permit2Proxy** - Handles Permit2 signatures for gasless approvals
- **Executor** - Executes swaps on destination chain
- **Receiver** - Receives bridged tokens
- **FeeCollector** - Collects integrator fees

### Querying Contract Addresses via API
```typescript
import { getChains } from '@lifi/sdk'

const chains = await getChains()
for (const chain of chains) {
  console.log(`${chain.name}:`)
  console.log(`  Diamond: ${chain.diamondAddress}`)
  console.log(`  Permit2: ${chain.permit2}`)
  console.log(`  Permit2Proxy: ${chain.permit2Proxy}`)
}
```

---

## 7. Integration Patterns for Cross-Chain Dust Consolidation

### Pattern 1: Multi-Chain Balance Sweep
```typescript
import { getRoutes, executeRoute, getChains, getTokens } from '@lifi/sdk'

async function consolidateDust(
  walletAddress: string,
  destinationChain: number,
  destinationToken: string,
  minValueUSD: number = 1
) {
  const chains = await getChains()
  const consolidationRoutes = []

  for (const chain of chains) {
    // Get balances on each chain
    const tokens = await getTokens({ chains: [chain.id] })
    
    for (const token of tokens) {
      // Skip dust below threshold
      if (parseFloat(token.priceUSD) * parseFloat(token.balance) < minValueUSD) {
        continue
      }
      
      // Skip if already on destination
      if (chain.id === destinationChain && token.address === destinationToken) {
        continue
      }

      // Get route for this token
      const routes = await getRoutes({
        fromChainId: chain.id,
        toChainId: destinationChain,
        fromTokenAddress: token.address,
        toTokenAddress: destinationToken,
        fromAmount: token.balance,
        fromAddress: walletAddress,
        options: {
          slippage: 0.01, // 1% for dust
          order: 'CHEAPEST',
        },
      })

      if (routes.routes.length > 0) {
        consolidationRoutes.push({
          chain: chain.name,
          token: token.symbol,
          amount: token.balance,
          route: routes.routes[0],
        })
      }
    }
  }

  return consolidationRoutes
}
```

### Pattern 2: Sequential Execution with Status Tracking
```typescript
async function executeConsolidation(routes: Route[]) {
  const results = []

  for (const route of routes) {
    try {
      const executed = await executeRoute(route, {
        updateRouteHook: (updated) => {
          const lastStep = updated.steps[updated.steps.length - 1]
          if (lastStep.execution?.status === 'FAILED') {
            console.error(`Failed: ${route.fromToken.symbol} on ${route.fromChainId}`)
          }
        },
      })
      
      results.push({
        success: true,
        route: executed,
      })
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        route,
      })
    }
  }

  return results
}
```

### Pattern 3: Contract Calls for DeFi Integration
```typescript
// Example: Bridge + Deposit to Vault
import { getContractCallsQuote } from '@lifi/sdk'
import { encodeFunctionData } from 'viem'

const vaultAbi = parseAbi(['function deposit(uint256 amount) external'])

const depositCalldata = encodeFunctionData({
  abi: vaultAbi,
  functionName: 'deposit',
  args: [BigInt(amount)],
})

const quote = await getContractCallsQuote({
  fromAddress: walletAddress,
  fromChain: 42161, // Arbitrum
  fromToken: USDC_ARB,
  fromAmount: amount,
  toChain: 10, // Optimism
  toToken: USDC_OPT,
  contractCalls: [
    {
      fromAmount: amount,
      fromTokenAddress: USDC_OPT,
      toContractAddress: VAULT_ADDRESS,
      toContractCallData: depositCalldata,
      toContractGasLimit: '300000',
    },
  ],
  toFallbackAddress: walletAddress,
  slippage: 0.005,
})
```

---

## 8. Fee Structure and Partner Programs

### Integrator Fees
```typescript
// Configure fee in route options
const routes = await getRoutes({
  // ... params
  options: {
    integrator: 'your-app-name',
    fee: 0.003, // 0.3% fee
    referrer: '0xYourFeeWallet', // Wallet to receive fees
  },
})
```

### Fee Types
```typescript
enum IntegratorFeeType {
  FIXED = 'FIXED',   // Fixed percentage kept by integrator
  SHARED = 'SHARED', // Revenue share with Li.Fi
}
```

### Fee Collection
- Fees are automatically deducted from the transaction
- Collected in the source token before swap/bridge
- Sent to configured `referrer` wallet
- Can be configured per-chain via `chainWallets`

### Partner Program Features
- Custom fee percentages (up to 1%)
- Analytics dashboard access
- Priority support
- Custom RPC endpoints
- Whitelisted contract addresses

### Fee Calculation in Response
```typescript
interface Route {
  // ... other fields
  gasCostUSD: string       // Estimated gas cost
  feeCosts: FeeCost[]      // Array of fee breakdowns
}

interface FeeCost {
  name: string
  percentage: string
  token: Token
  amount: string
  amountUSD: string
}
```

---

## 9. Error Handling

### Error Codes
```typescript
enum LiFiErrorCode {
  // Transaction errors
  TransactionFailed = 'TransactionFailed',
  TransactionRejected = 'TransactionRejected',
  TransactionCanceled = 'TransactionCanceled',
  TransactionExpired = 'TransactionExpired',
  TransactionUnprepared = 'TransactionUnprepared',
  TransactionNotFound = 'TransactionNotFound',
  
  // Wallet errors
  WalletChangedDuringExecution = 'WalletChangedDuringExecution',
  SignatureRejected = 'SignatureRejected',
  
  // Balance errors
  InsufficientBalance = 'InsufficientBalance',
  InsufficientGas = 'InsufficientGas',
  
  // Validation errors
  ValidationError = 'ValidationError',
  
  // Server errors
  ServerError = 'ServerError',
}
```

### Error Classes
```typescript
import {
  TransactionError,
  ValidationError,
  BalanceError,
  ProviderError,
  RPCError,
  ServerError,
  SDKError,
} from '@lifi/sdk'
```

### Handling Failed Bridges
```typescript
import { getStatus } from '@lifi/sdk'

async function handleFailedBridge(txHash: string, step: LiFiStep) {
  const status = await getStatus({
    txHash,
    bridge: step.tool,
    fromChain: step.action.fromChainId,
    toChain: step.action.toChainId,
  })

  switch (status.status) {
    case 'FAILED':
      // Check substatus for more details
      if (status.substatus === 'REFUNDED') {
        console.log('Tokens refunded to sender')
      } else if (status.substatus === 'UNKNOWN_ERROR') {
        console.log('Contact support with:', status.lifiExplorerLink)
      }
      break;
      
    case 'PENDING':
      // Check specific substatus
      if (status.substatus === 'BRIDGE_NOT_AVAILABLE') {
        console.log('Bridge temporarily unavailable, retry later')
      } else if (status.substatus === 'WAIT_DESTINATION_TRANSACTION') {
        console.log('Waiting for destination chain, be patient')
      }
      break;
  }
  
  return status
}
```

### Retry Pattern for Stuck Transactions
```typescript
async function waitForCompletion(
  txHash: string,
  step: LiFiStep,
  maxAttempts: number = 60,
  intervalMs: number = 10000
) {
  let attempts = 0
  
  while (attempts < maxAttempts) {
    const status = await getStatus({
      txHash,
      bridge: step.tool,
      fromChain: step.action.fromChainId,
      toChain: step.action.toChainId,
    })
    
    if (status.status === 'DONE') {
      return { success: true, status }
    }
    
    if (status.status === 'FAILED') {
      return { success: false, status }
    }
    
    // Log progress
    console.log(`Attempt ${attempts + 1}/${maxAttempts}: ${status.status}`)
    if (status.substatus) {
      console.log(`  Substatus: ${status.substatus}`)
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs))
    attempts++
  }
  
  return { success: false, status: 'TIMEOUT' }
}
```

### Recovery Strategies
```typescript
// 1. Check Li.Fi Explorer for stuck transactions
const explorerUrl = `https://explorer.li.fi/tx/${txHash}`

// 2. Contact bridge protocol directly for refunds
// Each bridge has its own recovery mechanism

// 3. Use status API with fromAddress for transaction history
const history = await getTransactionHistory({
  wallet: walletAddress,
  fromTimestamp: startTime,
  toTimestamp: endTime,
})
```

---

## 10. Best Practices

### SDK Initialization
```typescript
// ✅ Do: Initialize once at app startup
const config = createConfig({
  integrator: 'your-app',
  // ... options
})

// ❌ Don't: Create new config for each transaction
```

### Quote vs Routes
```typescript
// Use getQuote for simple single-route needs
const quote = await getQuote(params)

// Use getRoutes when you need multiple options to display
const routes = await getRoutes(params)
```

### Slippage Configuration
```typescript
// For stablecoins (lower risk)
options: { slippage: 0.003 } // 0.3%

// For volatile tokens
options: { slippage: 0.01 } // 1%

// For dust consolidation (higher tolerance)
options: { slippage: 0.02 } // 2%
```

### Transaction Monitoring
```typescript
// Always implement updateRouteHook for execution tracking
await executeRoute(route, {
  updateRouteHook: (updated) => {
    // Save state for recovery
    saveRouteState(updated)
    
    // Update UI
    updateUI(updated)
  },
})
```

---

## Resources

- **Documentation**: https://docs.li.fi
- **API Reference**: https://apidocs.li.fi
- **SDK GitHub**: https://github.com/lifinance/sdk
- **Contracts GitHub**: https://github.com/lifinance/contracts
- **Explorer**: https://explorer.li.fi
- **Status Page**: https://status.li.fi
- **Discord**: https://discord.gg/lifi
