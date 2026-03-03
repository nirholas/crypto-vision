<div align="center">  
 
# 🔶 Binance MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-≥18.0.0-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.11.0-purple)](https://modelcontextprotocol.io/)

**The most comprehensive Model Context Protocol server for Binance — 478+ tools covering the entire Binance.com API**

[Quick Start](#-quick-start) •
[Features](#-features) •
[Configuration](#%EF%B8%8F-configuration) •
[Documentation](#-documentation) • 
[Contributing](#-contributing)

</div>

---

## 🎯 Overview

Binance MCP Server enables AI assistants like **Claude**, **ChatGPT**, and other MCP-compatible clients to interact directly with the Binance cryptocurrency exchange. Execute trades, manage portfolios, analyze markets, and automate strategies through natural language.

### Why Binance MCP?

- **Complete Coverage** — 478+ tools spanning every Binance API endpoint
- **🔐 Secure by Design** — API credentials never leave your machine
- **⚡ Production Ready** — Built with official Binance SDKs and TypeScript
- **🔌 Universal Compatibility** — Works with Claude Desktop, Cursor, ChatGPT, and any MCP client
- **📡 Dual Transport** — STDIO for desktop apps, SSE for web applications

---

## ✨ Features

<table>
<tr>
<td width="50%">

### Trading & Markets
- **Spot Trading** — Orders, market data, account info
- **Margin Trading** — Cross & isolated margin
- **Futures (USD-M & COIN-M)** — Perpetual contracts
- **Options** — European-style options
- **Portfolio Margin** — Unified margin accounts
- **Algo Trading** — TWAP, VP algorithms

</td>
<td width="50%">

### Earn & Invest
- **Simple Earn** — Flexible & locked products
- **Staking** — ETH & SOL staking
- **Auto-Invest** — DCA & recurring buys
- **Dual Investment** — Structured products
- **Crypto Loans** — Flexible rate loans
- **VIP Loans** — Institutional lending

</td>
</tr>
<tr>
<td width="50%">

### Wallet & Transfers
- **Wallet** — Deposits, withdrawals, transfers
- **Sub-Accounts** — Multi-account management
- **Convert** — Instant asset conversion
- **Pay** — Binance Pay integration
- **Gift Cards** — Create & redeem

</td>
<td width="50%">

### Additional Services
- **Copy Trading** — Lead trader features
- **Mining** — Pool mining operations
- **NFT** — NFT marketplace
- **C2C/P2P** — Peer-to-peer trading
- **Fiat** — Fiat on/off ramps
- **Rebate** — Referral program

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18.0.0
- Binance account with API credentials
- An MCP-compatible client (Claude Desktop, Cursor, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/nirholas/Binance-MCP.git
cd Binance-MCP

# Install dependencies
npm install

# Build the project
npm run build
```

### Interactive Setup

Run the setup wizard to configure your environment:

```bash
npm run init
```

This will guide you through:
- Setting up your Binance API credentials
- Choosing your transport method (STDIO/SSE)
- Configuring your MCP client

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here
```

> **🔒 Security Note:** Never commit your `.env` file. It's already in `.gitignore`.

### Running the Server

#### STDIO Transport (Claude Desktop, Cursor)

```bash
npm run start
```

#### SSE Transport (ChatGPT, Web Apps)

```bash
npm run start:sse
```

#### Development Mode (Hot Reload)

```bash
npm run dev      # STDIO
npm run dev:sse  # SSE
```

---

## 🖥️ Client Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "binance": {
      "command": "node",
      "args": ["/absolute/path/to/Binance-MCP/build/index.js"],
      "env": {
        "BINANCE_API_KEY": "your_api_key",
        "BINANCE_API_SECRET": "your_api_secret"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json
{
  "binance": {
    "command": "node",
    "args": ["/absolute/path/to/Binance-MCP/build/index.js"],
    "env": {
      "BINANCE_API_KEY": "your_api_key",
      "BINANCE_API_SECRET": "your_api_secret"
    }
  }
}
```

### ChatGPT (via SSE)

1. Start the SSE server: `npm run start:sse`
2. Connect to `http://localhost:3000/sse`

---

## 📖 Usage Examples

### Check Account Balance

```
"What's my current Binance account balance?"
```

### Place a Market Order

```
"Buy 0.01 BTC at market price"
```

### Get Market Data

```
"Show me the order book for BTCUSDT with 20 levels"
```

### Set Up Auto-Invest

```
"Create a daily auto-invest plan to buy $100 of ETH"
```

### Manage Futures Position

```
"Open a 5x long position on ETHUSDT futures with $1000"
```

---

## 📊 Module Coverage

| Module | Tools | Description |
|--------|------:|-------------|
| Wallet | 40+ | Deposits, withdrawals, transfers, asset management |
| Spot | 35+ | Market data, trading, order management |
| Futures (USD-M) | 40+ | Perpetual futures, positions, leverage |
| Futures (COIN-M) | 35+ | Coin-margined futures contracts |
| Margin (Cross) | 26 | Cross-margin trading and borrowing |
| Margin (Isolated) | 15 | Isolated margin pairs |
| Options | 27 | European-style options trading |
| Portfolio Margin | 15 | Unified margin account management |
| Sub-Account | 22 | Sub-account creation and management |
| Staking | 22+ | ETH, SOL, and other staking products |
| Simple Earn | 15+ | Flexible and locked savings products |
| Auto-Invest | 13 | DCA and recurring purchase plans |
| Mining | 13+ | Mining pool statistics and earnings |
| Algo Trading | 11+ | TWAP, VP, and algorithmic orders |
| VIP Loan | 9+ | Institutional lending services |
| Convert | 9+ | Instant asset conversion |
| Dual Investment | 10+ | Structured yield products |
| NFT | 10+ | NFT marketplace operations |
| Gift Card | 8 | Gift card creation and redemption |
| Copy Trading | 10+ | Lead trader and copy features |
| Crypto Loans | 12+ | Flexible rate crypto loans |
| Fiat | 5+ | Fiat deposit and withdrawal |
| Pay | 5+ | Binance Pay transactions |
| C2C/P2P | 5+ | Peer-to-peer trading |
| Rebate | 5+ | Referral rebate tracking |

**Total: 478+ tools**

---

## 🏗️ Project Structure

```
Binance-MCP/
├── src/
│   ├── index.ts                 # Entry point
│   ├── binance.ts               # Module registration
│   ├── init.ts                  # Setup wizard
│   ├── config/
│   │   ├── binanceClient.ts     # API clients with signing
│   │   └── client.ts            # HTTP utilities
│   ├── server/
│   │   ├── base.ts              # Base MCP server
│   │   ├── stdio.ts             # STDIO transport
│   │   └── sse.ts               # SSE transport
│   ├── modules/                 # API module definitions
│   │   ├── spot/
│   │   ├── margin/
│   │   ├── futures-usdm/
│   │   ├── futures-coinm/
│   │   └── ... (24 modules)
│   ├── tools/                   # Tool implementations
│   │   ├── binance-spot/
│   │   ├── binance-margin/
│   │   ├── binance-futures-usdm/
│   │   └── ... (24 tool sets)
│   └── utils/
│       └── logger.ts
├── docs/
│   ├── QUICK_START.md           # Getting started guide
│   └── TOOLS_REFERENCE.md       # Complete tool documentation
├── build/                       # Compiled JavaScript
├── package.json
├── tsconfig.json
└── config.json                  # Runtime configuration
```

---

## 🛠️ Development

### Build

```bash
npm run build
```

### Type Check

```bash
npx tsc --noEmit
```

### Test with MCP Inspector

```bash
npm run test
```

### Adding New Tools

1. Create tool file in `src/tools/binance-{module}/`
2. Export registration function
3. Import and register in module's `index.ts`
4. Register module in `src/binance.ts`

---

## 📚 Documentation

| Resource | Description |
|----------|-------------|
| [Quick Start Guide](./docs/QUICK_START.md) | Get running in 5 minutes |
| [Tools Reference](./docs/TOOLS_REFERENCE.md) | Complete API for all 478+ tools |
| [Binance API Docs](https://developers.binance.com/docs/) | Official Binance documentation |
| [MCP Specification](https://modelcontextprotocol.io/) | Model Context Protocol spec |

---

## ⚠️ Disclaimer

This software is provided for educational and informational purposes only. 

- **Not Financial Advice** — This tool does not provide financial, investment, or trading advice
- **Use at Your Own Risk** — Cryptocurrency trading involves substantial risk of loss
- **API Security** — Protect your API credentials; use IP restrictions and withdrawal limits
- **No Warranty** — The software is provided "as is" without warranty of any kind

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**nich** — [@nichxbt](https://x.com/nichxbt)

---

---

## 🌐 Live HTTP Deployment

**Binance MCP** is deployed and accessible over HTTP via [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) transport — no local installation required.

**Endpoint:**
```
https://modelcontextprotocol.name/mcp/binance-mcp
```

### Connect from any MCP Client

Add to your MCP client configuration (Claude Desktop, Cursor, SperaxOS, etc.):

```json
{
  "mcpServers": {
    "binance-mcp": {
      "type": "http",
      "url": "https://modelcontextprotocol.name/mcp/binance-mcp"
    }
  }
}
```

### Available Tools (6)

| Tool | Description |
|------|-------------|
| `get_ticker_price` | Get trading pair price |
| `get_24h_stats` | 24h statistics |
| `get_order_book` | Order book depth |
| `get_recent_trades` | Recent trades |
| `get_klines` | Candlestick data |
| `list_all_symbols` | List trading pairs |

### Example Requests

**Get trading pair price:**
```bash
curl -X POST https://modelcontextprotocol.name/mcp/binance-mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_ticker_price","arguments":{"symbol":"BTCUSDT"}}}'
```

**24h statistics:**
```bash
curl -X POST https://modelcontextprotocol.name/mcp/binance-mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_24h_stats","arguments":{"symbol":"ETHUSDT"}}}'
```

**Order book depth:**
```bash
curl -X POST https://modelcontextprotocol.name/mcp/binance-mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_order_book","arguments":{"symbol":"BTCUSDT","limit":5}}}'
```

### List All Tools

```bash
curl -X POST https://modelcontextprotocol.name/mcp/binance-mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Also Available On

- **[SperaxOS](https://speraxos.vercel.app)** — Browse and install from the [MCP marketplace](https://speraxos.vercel.app/community/mcp)
- **All 27 MCP servers** — See the full catalog at [modelcontextprotocol.name](https://modelcontextprotocol.name)

> Powered by [modelcontextprotocol.name](https://modelcontextprotocol.name) — the open MCP HTTP gateway
