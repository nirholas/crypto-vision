# Binance MCP Server

A comprehensive Model Context Protocol (MCP) server for the **Binance.com** global exchange API.

## Overview

This MCP server provides **156+ tools** covering the full Binance.com API including:

- **Spot Trading** - Market data, orders, account info
- **Wallet** - Deposits, withdrawals, transfers
- **Staking** - ETH & SOL staking operations
- **Simple Earn** - Flexible/locked products
- **Convert** - Asset conversion
- **Mining** - Pool mining operations
- **Algo Trading** - TWAP, VP algorithms
- **VIP Loan** - Institutional lending
- **NFT** - NFT transactions
- **Pay** - Binance Pay
- **Copy Trading** - Lead trader features
- **Dual Investment** - Structured products
- **C2C/P2P** - Peer-to-peer trading
- **Fiat** - Fiat deposit/withdrawal
- **Rebate** - Referral rebates

## Installation

```bash
cd binance-mcp-server
npm install
```

## Configuration

Create a `.env` file or set environment variables:

```env
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
```

## Usage

### STDIO Transport (Claude Desktop, Cursor)

```bash
npm run start
# or
npx ts-node src/index.ts
```

### SSE Transport (ChatGPT, Web Apps)

```bash
npm run start:sse
# or
npx ts-node src/index.ts --sse
```

## Project Structure

```
binance-mcp-server/
├── src/
│   ├── index.ts              # Entry point
│   ├── binance.ts            # Module registration
│   ├── config/
│   │   ├── binanceClient.ts  # API client with signing
│   │   └── client.ts         # HTTP client
│   ├── server/
│   │   ├── base.ts           # Base server setup
│   │   ├── stdio.ts          # STDIO transport
│   │   └── sse.ts            # SSE transport
│   ├── modules/              # All API modules
│   │   ├── spot/
│   │   │   ├── general-api/
│   │   │   ├── market-api/
│   │   │   ├── trade-api/
│   │   │   ├── account-api/
│   │   │   └── userdatastream-api/
│   │   ├── wallet/
│   │   ├── staking/
│   │   ├── simple-earn/
│   │   ├── convert/
│   │   ├── mining/
│   │   ├── algo/
│   │   ├── vip-loan/
│   │   ├── nft/
│   │   ├── pay/
│   │   ├── copy-trading/
│   │   ├── dual-investment/
│   │   ├── c2c/
│   │   ├── fiat/
│   │   └── rebate/
│   └── utils/
│       └── logger.ts
├── tools/                    # Legacy tools (preserved)
├── package.json
└── tsconfig.json
```

## Module Coverage

| Module | Tools | Completeness |
|--------|------:|--------------|
| Wallet | 40 | 70% |
| Spot | 32 | 60% |
| Staking | 22 | 80% |
| Mining | 13 | 90% |
| Algo | 11 | 50% |
| VIP Loan | 9 | 70% |
| Convert | 9 | 80% |
| Dual Investment | 5 | 50% |
| Simple Earn | 4 | 30% |
| NFT | 4 | 60% |
| Fiat | 2 | 50% |
| Copy Trading | 2 | 20% |
| Rebate | 1 | 30% |
| Pay | 1 | 10% |
| C2C | 1 | 10% |

**Total: ~156 tools**

## Missing APIs

See [API_COVERAGE_SUMMARY.md](./API_COVERAGE_SUMMARY.md) for detailed gap analysis.

Major missing features:
- Margin Trading (Cross & Isolated)
- Futures Trading (USD-M & COIN-M)
- Options Trading
- Portfolio Margin
- Auto-Invest
- Crypto Loans
- Sub-Account Management
- Gift Card

## Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "binance": {
      "command": "npx",
      "args": ["ts-node", "/path/to/binance-mcp-server/src/index.ts"],
      "env": {
        "BINANCE_API_KEY": "your_key",
        "BINANCE_API_SECRET": "your_secret"
      }
    }
  }
}
```

## Example Tools

### Get Account Info
```
Tool: binance_account_info
```

### Place Spot Order
```
Tool: binance_spot_new_order
Parameters:
  - symbol: "BTCUSDT"
  - side: "BUY"
  - type: "LIMIT"
  - quantity: 0.001
  - price: 50000
  - timeInForce: "GTC"
```

### Get Order Book
```
Tool: binance_order_book
Parameters:
  - symbol: "BTCUSDT"
  - limit: 100
```

## Development

### Build
```bash
npm run build
```

### Type Check
```bash
npx tsc --noEmit
```

### Add New Tool

1. Create file in appropriate module folder
2. Export registration function
3. Import in module's `index.ts`
4. Register in `src/binance.ts`

## API Documentation

- [Binance API Docs](https://developers.binance.com/docs/binance-spot-api-docs)
- [Gap Analysis Prompts](./BINANCE_API_GAP_ANALYSIS_PROMPTS.md)

## License

MIT
