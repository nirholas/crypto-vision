# UCAI x402 - Smart Contract AI Payments

> Let AI agents pay to interact with smart contracts

UCAI (Universal Contract AI) with x402 payment capabilities transforms how AI agents interact with blockchain smart contracts. This module enables AI to pay for premium services like gas sponsorship, security analysis, and historical data queries using the x402 payment protocol.

## 🎯 Features

### 1. Gas Sponsorship 
**Pay for user's gas with x402**

Enable gasless UX for end users - the AI agent pays for transaction gas using x402 micropayments.

```typescript
// Sponsor gas for a user's transaction
const result = await mcpClient.callTool("ucai_sponsor_gas", {
  userAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
  contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  functionName: "transfer",
  args: ["0xRecipient...", "1000000"],
  abi: USDT_ABI,
  network: "arbitrum"
})
```

**Features:**
- x402 payment covers gas costs
- Account abstraction (ERC-4337) integration
- Supports Arbitrum, Base, Polygon, Optimism
- Fee: 10% of gas cost + gas cost in USD

### 2. Premium Contract Analysis - $0.05
**Security audit, rug pull detection, contract verification**

```typescript
// Full security analysis
const analysis = await mcpClient.callTool("ucai_analyze_contract", {
  contractAddress: "0x...",
  network: "ethereum",
  analysisType: ["full_audit"]
})

// Rug pull detection
const rugCheck = await mcpClient.callTool("ucai_detect_rug_pull", {
  tokenAddress: "0x...",
  network: "bsc"
})
```

**Analysis includes:**
- Security score (0-100)
- Vulnerability detection
- Ownership analysis
- Proxy detection
- Honeypot detection
- Buy/sell tax analysis
- Liquidity lock verification

### 3. Transaction Simulation - $0.01
**Simulate before executing, show outcome preview**

```typescript
const simulation = await mcpClient.callTool("ucai_simulate_transaction", {
  contractAddress: "0x...",
  functionName: "swap",
  args: [...],
  abi: DEX_ABI,
  from: "0xUserWallet...",
  network: "arbitrum"
})

// Returns:
// - success: boolean
// - returnValue: decoded return
// - gasEstimate: { gasUsed, gasLimit }
// - stateChanges: [...modified storage]
// - tokenTransfers: [...ERC20 transfers]
// - warnings: [...potential issues]
```

**Benefits:**
- Catch errors before spending gas
- Preview token transfers
- Detect approval scams
- Estimate accurate gas costs

### 4. Historical Contract Data - $0.02/query
**Past transactions, event logs, state changes**

```typescript
const history = await mcpClient.callTool("ucai_query_historical_data", {
  contractAddress: "0x...",
  network: "ethereum",
  dataType: "event_logs",
  fromBlock: "18000000",
  toBlock: "latest",
  eventFilter: { eventName: "Transfer" },
  limit: 100
})
```

**Data types:**
- `transactions` - All transactions to/from contract
- `event_logs` - Filtered event emissions
- `state_changes` - Storage slot modifications
- `balance_history` - Token balance changes
- `function_calls` - Specific function invocations

### 5. Custom ABI Generation - $0.10
**Generate ABIs from unverified contracts**

```typescript
const abi = await mcpClient.callTool("ucai_generate_abi", {
  contractAddress: "0xUnverifiedContract...",
  network: "ethereum",
  includeDescriptions: true,
  detectStandards: true
})

// Returns:
// - abi: [...function/event definitions]
// - detectedStandards: ["ERC20", "Ownable"]
// - contractType: "ERC20 Token"
// - confidence: 85
// - warnings: ["2 functions could not be decoded"]
```

**Methods:**
- Verified source (100% confidence)
- Bytecode decompilation
- Pattern matching against known signatures
- AI-enhanced interface detection

## 💰 Pricing

| Feature | Price |
|---------|-------|
| Gas Sponsorship | 10% fee + gas cost |
| Contract Analysis | $0.05 |
| Rug Pull Detection | $0.05 |
| Transaction Simulation | $0.01 |
| Historical Data Query | $0.02 |
| ABI Generation | $0.10 |

### Subscription Plans

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0/mo | 5 analyses, 10 simulations, 20 queries |
| **Basic** | $9.99/mo | 50 analyses, 100 simulations, 500 queries |
| **Pro** | $49.99/mo | 500 analyses, 1000 simulations, 5000 queries, $100 gas |
| **Enterprise** | $199.99/mo | Unlimited + $1000 gas sponsorship |

## 🔧 Configuration

### Environment Variables

```bash
# Required for payments
X402_EVM_PRIVATE_KEY=0x...          # Wallet for x402 payments
UCAI_PRIVATE_KEY=0x...              # Alternative key for UCAI only

# Required for gas sponsorship
X402_SPONSOR_PRIVATE_KEY=0x...      # Dedicated sponsor wallet

# Optional API keys for better analysis
ETHERSCAN_API_KEY=...
ARBISCAN_API_KEY=...
BASESCAN_API_KEY=...
POLYGONSCAN_API_KEY=...
BSCSCAN_API_KEY=...
```

### Network Support

UCAI supports these networks:
- **Ethereum** - Mainnet
- **Arbitrum** - Primary payment network
- **Base** - Gas sponsorship supported
- **Polygon** - Lower gas costs
- **Optimism** - OP Stack compatible
- **BSC** - Binance Smart Chain

## 📦 Integration

### With MCP Server

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerX402 } from "@/x402"

const server = new McpServer({ name: "my-agent" })

// Register all x402 tools including UCAI
registerX402(server)

// Or register UCAI separately
import { registerUCAI } from "@/x402/ucai"
registerUCAI(server)
```

### Direct Service Usage

```typescript
import {
  getGasSponsorService,
  getContractAnalysisService,
  getTransactionSimulationService,
  getHistoricalDataService,
  getABIGenerationService,
} from "@/x402/ucai"

// Gas sponsorship
const sponsor = getGasSponsorService()
const estimate = await sponsor.estimateSponsorshipCost(
  contractAddress,
  functionName,
  args,
  abi,
  "arbitrum"
)

// Contract analysis
const analyzer = getContractAnalysisService()
const audit = await analyzer.analyzeContract({
  contractAddress,
  network: "ethereum",
  analysisType: ["full_audit"]
})

// Transaction simulation
const simulator = getTransactionSimulationService()
const result = await simulator.simulateTransaction({
  contractAddress,
  functionName,
  args,
  abi,
  from: userAddress,
  network: "arbitrum"
})
```

## 🔐 Payment Integration

UCAI integrates with x402-stablecoin contracts:

### X402PaymentChannel
Efficient micropayments for gas sponsorship using state channels.

```typescript
import { getUCAIPaymentService } from "@/x402/ucai"

const payment = getUCAIPaymentService()

// Open a payment channel for efficient micropayments
await payment.openPaymentChannel("100.00", 30) // $100 for 30 days

// Payments use the channel automatically
const result = await payment.processPayment("gas_sponsor", "0.50")
```

### X402Subscription
Monthly subscription plans for predictable costs.

```typescript
// Subscribe to Pro tier
await payment.subscribe("pro", 1) // 1 month

// Check subscription
const sub = await payment.getSubscription()
console.log(sub.tier) // "pro"
console.log(sub.features) // ["500 analyses/month", ...]
```

### ToolRegistry
On-chain registry of available tools and pricing.

```typescript
// Tools are automatically registered and discoverable
const tools = await mcpClient.callTool("ucai_list_tools", {})
// Returns all available UCAI tools with pricing
```

## 📊 Example: Full Contract Analysis Flow

```typescript
// 1. Check if it's safe to interact with a token
const rugCheck = await mcpClient.callTool("ucai_detect_rug_pull", {
  tokenAddress: "0xNewToken...",
  network: "bsc"
})

if (rugCheck.rugPullAnalysis.isHoneypot) {
  console.log("⚠️ HONEYPOT DETECTED - DO NOT INTERACT")
  return
}

// 2. Generate ABI if not verified
const abiResult = await mcpClient.callTool("ucai_generate_abi", {
  contractAddress: "0xNewToken...",
  network: "bsc"
})

// 3. Simulate a swap before executing
const sim = await mcpClient.callTool("ucai_simulate_transaction", {
  contractAddress: "0xDEXRouter...",
  functionName: "swapExactTokensForTokens",
  args: [amount, minOut, path, deadline],
  abi: abiResult.abi,
  from: userWallet,
  network: "bsc"
})

if (!sim.simulation.success) {
  console.log(`❌ Transaction would fail: ${sim.simulation.revertReason}`)
  return
}

// 4. Sponsor gas for the user
const sponsored = await mcpClient.callTool("ucai_sponsor_gas", {
  userAddress: userWallet,
  contractAddress: "0xDEXRouter...",
  functionName: "swapExactTokensForTokens",
  args: [amount, minOut, path, deadline],
  abi: abiResult.abi,
  network: "bsc"
})

console.log(`✅ Swap executed: ${sponsored.transactionHash}`)
console.log(`💰 Gas sponsored: $${sponsored.gasCost.usd}`)
```

## 🏗️ Architecture

```
src/x402/ucai/
├── index.ts              # Module entry point
├── types.ts              # TypeScript interfaces
├── tools.ts              # MCP tool registration
├── payment.ts            # x402-stablecoin integration
├── gas-sponsorship.ts    # ERC-4337 gas sponsorship
├── contract-analysis.ts  # Security analysis service
├── transaction-simulation.ts  # TX simulation
├── historical-data.ts    # Historical queries
└── abi-generation.ts     # ABI from bytecode
```

## 🤝 Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines.

## 📄 License

Apache-2.0 - see [LICENSE](../../../LICENSE)
