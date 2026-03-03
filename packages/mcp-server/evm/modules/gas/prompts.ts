/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerGasPrompts(server: McpServer) {
  server.prompt(
    "optimize_gas",
    "Analyze and provide gas optimization recommendations for transactions",
    {
      network: { description: "Target network", required: true },
      transactionType: { description: "Type of transaction (swap, transfer, etc.)", required: true }
    },
    ({ network, transactionType }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze gas conditions on ${network} for a ${transactionType} transaction and provide optimization recommendations.

Use the available tools to:
1. Get current gas price with get_gas_price
2. Get EIP-1559 fee data with get_eip1559_fees
3. Get gas history with get_gas_history
4. Get standard gas limits with get_standard_gas_limits

Provide:
## Gas Optimization Report for ${network}

### Current Conditions
- Current gas price
- Base fee trend (rising/falling/stable)
- Network congestion level

### Cost Estimate
- Estimated cost for ${transactionType}
- Cost in native token and approximate USD

### Optimization Recommendations
1. **Timing**: Best time to submit transaction
2. **Gas Settings**: Recommended maxFeePerGas and maxPriorityFeePerGas
3. **Alternative**: Consider other networks if applicable

### Historical Context
- How current prices compare to recent average
- Expected savings if waiting for lower gas`
          }
        }
      ]
    })
  )

  server.prompt(
    "compare_chain_costs",
    "Compare transaction costs across different chains",
    {
      transactionType: { description: "Type of transaction", required: true },
      amount: { description: "Amount being transacted (for context)", required: false }
    },
    ({ transactionType, amount }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Compare the cost of a ${transactionType} transaction across all supported chains${amount ? ` for amount ${amount}` : ""}.

Use get_gas_prices_all_chains to get current prices across networks.

Provide:
## Cross-Chain Cost Comparison

### Transaction Type: ${transactionType}

| Chain | Gas Price | Est. Gas | Est. Cost | Native Token |
|-------|-----------|----------|-----------|--------------|
[Fill in data for each chain]

### Recommendations
- **Cheapest Option**: [Chain with lowest cost]
- **Best Value**: [Consider speed + cost trade-off]
- **Fastest Option**: [Chain with fastest finality]

### Considerations
- Bridge costs if assets need to be moved
- DEX liquidity differences between chains
- Security considerations`
          }
        }
      ]
    })
  )
}
