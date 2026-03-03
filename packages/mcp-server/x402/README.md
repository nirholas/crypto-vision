# x402 Payment Protocol for Universal Crypto MCP

> **Give Claude Money!** 💰 AI agents can now pay for premium APIs automatically.

## What is x402?

x402 implements the HTTP 402 Payment Required standard, enabling:
- **Automatic payments**: AI agents pay for APIs without human intervention
- **Micropayments**: Pay fractions of a cent per request
- **USDs yield**: Payments use Sperax USDs stablecoin which earns ~5% APY

## Quick Start

### 1. Configure your wallet

```bash
export X402_PRIVATE_KEY=0x...  # Your EVM private key
export X402_CHAIN=arbitrum      # Default: arbitrum
```

### 2. Fund your wallet

Send USDs (Sperax USD) to your wallet address:
- Get address: Use `x402_address` tool
- Get USDs: Swap on [Uniswap](https://app.uniswap.org) or [SperaxDApp](https://app.sperax.io)

### 3. Make paid requests

The AI agent can now use x402 tools to pay for premium APIs.

## Available Tools

| Tool | Description |
|------|-------------|
| `x402_pay_request` | Make HTTP request with automatic 402 payment |
| `x402_balance` | Check wallet balance (USDs + native) |
| `x402_send` | Send direct payment to address |
| `x402_estimate` | Check cost before paying |
| `x402_networks` | List supported networks |
| `x402_address` | Get your wallet address |
| `x402_yield` | Check USDs yield earnings |

## Example Usage

### Pay for a premium API
```
User: "Get the premium weather forecast for Tokyo"
Agent: [uses x402_pay_request to call weather API]
       [automatically pays $0.01 in USDs]
       [returns weather data]
```

### Check balance
```
User: "How much do I have in my crypto wallet?"
Agent: [uses x402_balance]
       "You have 45.23 USDs ($45.23) and 0.001 ETH"
```

### Send payment
```
User: "Send $5 to 0x123..."
Agent: [uses x402_send with amount="5.00"]
       "Sent 5.00 USDs. Transaction: 0xabc..."
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `X402_PRIVATE_KEY` | EVM private key (required for payments) | - |
| `X402_CHAIN` | Default chain | `arbitrum` |
| `X402_RPC_URL` | Custom RPC URL | Chain default |
| `X402_MAX_PAYMENT` | Max payment per request | `1.00` |
| `X402_ENABLE_GASLESS` | Enable gasless payments | `true` |
| `X402_DEBUG` | Debug logging | `false` |

## Supported Networks

| Chain | CAIP-2 | Testnet |
|-------|--------|---------|
| Arbitrum One | `eip155:42161` | No |
| Arbitrum Sepolia | `eip155:421614` | Yes |
| Base | `eip155:8453` | No |
| Ethereum | `eip155:1` | No |
| Polygon | `eip155:137` | No |
| Optimism | `eip155:10` | No |
| BNB Chain | `eip155:56` | No |

## Why USDs?

[Sperax USDs](https://sperax.io) is a stablecoin that:
- **Auto-rebases**: Your balance grows automatically (~5% APY)
- **No claiming**: Yield appears in your wallet instantly
- **Arbitrum native**: Low gas fees

This means your AI agent's wallet balance **grows while it waits**!

## Security

- Private keys are only read from environment variables
- Never logged or exposed
- Max payment limits prevent overspending
- Testnet support for development

## Source

Based on [x402-stablecoin](https://github.com/nirholas/x402-stablecoin) - Apache-2.0 license.
