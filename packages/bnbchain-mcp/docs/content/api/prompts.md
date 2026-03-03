# MCP Prompts

BNB-Chain-MCP provides pre-built prompts that guide AI assistants through common DeFi workflows.

---

## Overview

Prompts are templates that help AI assistants complete complex tasks by providing structured guidance and context. They're particularly useful for:

- Multi-step workflows
- Domain-specific tasks
- Consistent output formatting
- Best practice enforcement

---

## Available Prompts

| Prompt Name | Description |
|-------------|-------------|
| `analyze-token` | Comprehensive token analysis |
| `portfolio-review` | Portfolio assessment and recommendations |
| `yield-opportunity` | Find and compare yield opportunities |
| `trade-assistant` | Guided swap execution |
| `security-audit` | Token/contract security analysis |
| `market-analysis` | Market conditions and trends |
| `gas-optimizer` | Optimize transaction timing |
| `bridge-assistant` | Cross-chain transfer guidance |
| `lending-advisor` | Lending position management |
| `defi-research` | Protocol deep-dive research |

---

## analyze-token

Perform comprehensive analysis of a cryptocurrency token.

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | string | Yes | Token symbol or address |
| `network` | string | No | Network name (default: ethereum) |

### Example Usage

```
Use the analyze-token prompt for PEPE on ethereum
```

### Prompt Template

```
Analyze the token {token} on {network}:

1. Basic Information
   - Get token metadata (name, symbol, decimals)
   - Check total supply and holders

2. Price Analysis
   - Current price and market cap
   - 24h, 7d, 30d price changes
   - Trading volume

3. Security Assessment
   - Run security_check_token for contract analysis
   - Check for honeypot, ownership risks
   - Verify liquidity

4. On-Chain Metrics
   - Top holders analysis
   - Recent transfers
   - Contract interactions

5. Summary
   - Overall risk rating
   - Investment considerations
   - Recommendations

Present findings in a structured format.
```

---

## portfolio-review

Review a wallet's portfolio with recommendations.

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `address` | string | Yes | Wallet address |
| `networks` | string | No | Comma-separated networks |

### Example Usage

```
Use portfolio-review for 0x742d35... on ethereum,arbitrum,polygon
```

### Prompt Template

```
Review portfolio for {address} across {networks}:

1. Asset Discovery
   - Check native token balances
   - List all ERC-20 holdings
   - Identify NFT collections

2. Valuation
   - Calculate total USD value
   - Show allocation percentages
   - Compare to benchmarks (ETH, BTC)

3. Risk Analysis
   - Check security of held tokens
   - Identify concentration risks
   - Assess protocol exposure

4. DeFi Positions
   - Active staking positions
   - Lending/borrowing positions
   - LP positions

5. Recommendations
   - Diversification suggestions
   - Risk reduction opportunities
   - Yield optimization options

Format as a professional portfolio report.
```

---

## yield-opportunity

Find and compare yield opportunities.

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `token` | string | Yes | Token to stake/lend |
| `amount` | string | Yes | Amount to deploy |
| `network` | string | No | Preferred network |
| `riskTolerance` | string | No | low, medium, high |

### Example Usage

```
Use yield-opportunity for 10000 USDC on arbitrum with medium risk tolerance
```

### Prompt Template

```
Find yield opportunities for {amount} {token} on {network}:

Risk Tolerance: {riskTolerance}

1. Discovery
   - Search lending protocols (Aave, Compound)
   - Find staking options
   - Identify LP opportunities

2. Analysis (for each opportunity)
   - Current APY/APR
   - Historical yield stability
   - TVL and trend
   - Lock-up requirements
   - Protocol security score

3. Risk Assessment
   - Smart contract risk
   - Impermanent loss risk (for LPs)
   - Protocol risk
   - Liquidity risk

4. Comparison Table
   | Protocol | Type | APY | TVL | Risk | Lock |
   
5. Recommendations
   - Best option for risk tolerance
   - Diversification strategy
   - Entry strategy

Consider gas costs and minimum amounts.
```

---

## trade-assistant

Guided token swap execution.

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `tokenIn` | string | Yes | Token to sell |
| `tokenOut` | string | Yes | Token to buy |
| `amount` | string | Yes | Amount to swap |
| `network` | string | No | Network for swap |

### Example Usage

```
Use trade-assistant to swap 1000 USDC for ETH on arbitrum
```

### Prompt Template

```
Execute swap: {amount} {tokenIn} → {tokenOut} on {network}

1. Pre-Trade Checks
   - Verify wallet balance
   - Check token security for {tokenOut}
   - Confirm network gas prices

2. Quote Comparison
   - Get quotes from multiple DEXes
   - Compare prices and fees
   - Check price impact

3. Risk Assessment
   - Evaluate slippage risk
   - Check liquidity depth
   - Assess MEV exposure

4. Execution Plan
   - Recommended DEX
   - Suggested slippage tolerance
   - Gas price recommendation

5. Confirmation
   - Final quote summary
   - Expected output
   - Estimated gas cost

6. Post-Trade (if executed)
   - Transaction confirmation
   - Actual amounts received
   - Final price achieved

Ask for confirmation before executing.
```

---

## security-audit

Comprehensive security analysis for tokens or contracts.

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `target` | string | Yes | Token/contract address |
| `network` | string | No | Network name |

### Example Usage

```
Use security-audit for 0x1234... on bsc
```

### Prompt Template

```
Security audit for {target} on {network}:

1. Contract Analysis
   - Verify source code availability
   - Check proxy patterns
   - Identify owner/admin functions

2. GoPlus Security Check
   - Run comprehensive security scan
   - Check honeypot status
   - Analyze tax functions
   - Review ownership privileges

3. Liquidity Analysis
   - Check DEX liquidity
   - Identify locked liquidity
   - Assess rug pull risk

4. Historical Review
   - Check contract age
   - Review transaction patterns
   - Look for suspicious activity

5. Risk Summary
   - Overall risk score (0-100)
   - Critical issues found
   - Medium/low concerns
   - Recommendations

Present as a security report with clear risk rating.
```

---

## market-analysis

Analyze current market conditions and trends.

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `focus` | string | No | Specific sector (defi, nft, l2) |

### Example Usage

```
Use market-analysis with focus on defi
```

### Prompt Template

```
Market Analysis Report {focus}:

1. Global Overview
   - Total market cap and change
   - BTC dominance trend
   - Fear & Greed Index

2. Sector Analysis ({focus})
   - Sector market cap
   - Top performers (24h, 7d)
   - Worst performers
   - Volume trends

3. DeFi Metrics
   - Total TVL and change
   - Chain distribution
   - Protocol rankings
   - Yield trends

4. On-Chain Indicators
   - Network activity
   - Gas trends
   - Whale movements

5. Social Sentiment
   - Trending topics
   - Social volume
   - News highlights

6. Outlook
   - Key support/resistance levels
   - Upcoming events
   - Risk factors
   - Opportunities

Format as a professional market report.
```

---

## Using Prompts

### With MCP SDK

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// List available prompts
const prompts = await client.listPrompts();
console.log(prompts.prompts);

// Get a specific prompt
const prompt = await client.getPrompt({
  name: 'analyze-token',
  arguments: {
    token: 'ethereum',
    network: 'ethereum'
  }
});

// Use prompt messages
console.log(prompt.messages);
```

### With Claude Desktop

Simply mention the prompt name in your conversation:

```
Please use the yield-opportunity prompt to find the best places 
to stake my 5000 USDC on Arbitrum
```

---

## Custom Prompt Arguments

Some prompts accept additional optional arguments:

### analyze-token

```json
{
  "token": "PEPE",
  "network": "ethereum",
  "depth": "full",          // quick, standard, full
  "includeOnChain": true,   // Include on-chain metrics
  "compareWith": "DOGE"     // Compare with another token
}
```

### portfolio-review

```json
{
  "address": "0x...",
  "networks": "ethereum,arbitrum",
  "includeDeFi": true,      // Include DeFi positions
  "includeNFTs": false,     // Include NFT valuations
  "timeframe": "30d"        // Performance timeframe
}
```

---

## Related Documentation

- [Tools Reference](tools/README.md) - Tool documentation
- [Resources](resources.md) - MCP resources
- [Building DeFi Agent](../guides/building-defi-agent.md) - Agent development
