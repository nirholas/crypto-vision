/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerMEVPrompts(server: McpServer) {
  server.prompt(
    "protect_swap_from_mev",
    "Guide through executing a swap with MEV protection",
    {
      tokenIn: { description: "Token to swap from", required: true },
      tokenOut: { description: "Token to swap to", required: true },
      amount: { description: "Amount to swap", required: true },
      network: { description: "Network for the swap", required: true }
    },
    ({ tokenIn, tokenOut, amount, network }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me execute an MEV-protected swap on ${network}.

Swap Details:
- From: ${amount} ${tokenIn}
- To: ${tokenOut}

## MEV Protection Process

### 1. Analyze MEV Risk
Use check_mev_exposure to analyze the swap transaction:
- Identify potential sandwich attack risk
- Assess slippage requirements
- Determine optimal protection strategy

### 2. Choose Protection Method
Options:
- **Flashbots Protect**: Send directly to block builders
- **MEV Blocker**: Aggregate across multiple builders
- **Private RPC**: Network-specific protection

### 3. Execute Protected Swap
Use send_private_transaction with:
- DEX router address
- Encoded swap data
- Appropriate gas settings

### 4. Monitor Execution
- Verify transaction was included
- Check execution price vs quote
- Confirm no MEV extraction occurred

## Checklist
- [ ] MEV risk analyzed
- [ ] Protection provider selected
- [ ] Slippage set appropriately
- [ ] Transaction sent privately
- [ ] Execution verified`
          }
        }
      ]
    })
  )

  server.prompt(
    "analyze_mev_risk",
    "Analyze MEV risk for a planned transaction",
    {
      transactionType: { description: "Type of transaction (swap, liquidation, arbitrage)", required: true },
      value: { description: "Approximate value in ETH/USD", required: true }
    },
    ({ transactionType, value }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze MEV risk for a ${transactionType} transaction worth ${value}.

## MEV Risk Analysis

### Transaction Type: ${transactionType}
### Approximate Value: ${value}

### Risk Factors to Check
1. **Visibility Risk**
   - Public mempool exposure
   - Time in mempool
   - Block inclusion predictability

2. **Value Extraction Risk**
   - Sandwich attack potential
   - Frontrunning profit margin
   - Backrunning opportunities

3. **Market Impact**
   - Price impact of transaction
   - Liquidity depth
   - Volatility considerations

### Analysis Steps
1. Use check_mev_exposure with transaction details
2. Review identified risks and severity
3. Determine appropriate protection level

### Protection Recommendations
Based on ${transactionType} type:
${transactionType === "swap" ? `
- Use private transaction submission
- Set tight slippage (0.1-0.5%)
- Consider splitting large swaps
- Use limit orders if available
` : transactionType === "liquidation" ? `
- Flashbots bundle submission essential
- Race condition expected - optimize gas
- Consider building with MEV searchers
- Time-sensitive execution
` : `
- Evaluate profitability after gas
- Private submission critical
- Bundle multiple operations if possible
- Monitor for competing bots
`}`
          }
        }
      ]
    })
  )

  server.prompt(
    "simulate_transaction_bundle",
    "Simulate a bundle of transactions before execution",
    {
      bundleDescription: { description: "Description of what the bundle should accomplish", required: true }
    },
    ({ bundleDescription }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me simulate a transaction bundle: ${bundleDescription}

## Bundle Simulation Guide

### 1. Define Bundle Transactions
List all transactions in order:
- Transaction 1: [describe]
- Transaction 2: [describe]
- etc.

### 2. Prepare Transaction Data
For each transaction, specify:
- Target contract address
- Function to call
- Parameters
- Value (if any)

### 3. Simulate Bundle
Use simulate_bundle with:
- Array of transaction objects
- Target block number (optional)

### 4. Analyze Results
Review simulation output:
- All transactions successful?
- Total gas cost
- Return values
- Any reverts?

### 5. Optimize Bundle
If issues found:
- Reorder transactions
- Adjust gas limits
- Fix failing transactions
- Re-simulate

### Simulation Report Template
| # | To | Function | Success | Gas | Notes |
|---|-----|----------|---------|-----|-------|
| 1 | ... | ...      | ✅/❌   | ... | ...   |

**Total Gas**: [sum]
**Estimated Cost**: [ETH amount]
**Bundle Status**: Ready / Needs Work`
          }
        }
      ]
    })
  )

  server.prompt(
    "mev_protection_setup",
    "Set up MEV protection for a wallet/dApp",
    {
      network: { description: "Target network", required: true },
      useCase: { description: "Primary use case (trading, liquidations, arbitrage)", required: true }
    },
    ({ network, useCase }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Set up MEV protection for ${useCase} on ${network}.

## MEV Protection Setup Guide

### 1. Check Available Protection
Use get_mev_protection_info for ${network}:
- Available providers
- Chain-specific options
- Built-in protections

### 2. Choose Protection Strategy

For **${useCase}**:
${useCase === "trading" ? `
**Recommended: Flashbots Protect / MEV Blocker**
- Automatic protection for all swaps
- No code changes needed
- Configure wallet to use protect RPC

Setup Steps:
1. Add protected RPC to wallet
2. All transactions route through protection
3. No mempool visibility
` : useCase === "liquidations" ? `
**Recommended: Flashbots Bundle API**
- Atomic execution guarantee
- Competitive submission
- Block builder integration

Setup Steps:
1. Build transaction bundle
2. Sign with Flashbots reputation key
3. Submit to multiple builders
4. Monitor for inclusion
` : `
**Recommended: Private Transaction + Bundle**
- Combine multiple operations
- Protect entire strategy
- Optimize for atomicity

Setup Steps:
1. Structure operations as bundle
2. Simulate for profitability
3. Submit privately
4. Monitor execution
`}

### 3. Configure RPC Endpoints

For ${network}:
| Provider | URL | Best For |
|----------|-----|----------|
| Flashbots | https://rpc.flashbots.net | General protection |
| MEV Blocker | https://rpc.mevblocker.io | Multi-builder |

### 4. Test Protection
- Send small test transaction
- Verify private submission
- Check block inclusion

### 5. Monitor & Optimize
- Track execution quality
- Compare with public mempool
- Adjust strategy as needed`
          }
        }
      ]
    })
  )
}
