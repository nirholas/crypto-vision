# Universal Crypto MCP - Code Examples & Tutorials

> 📚 Comprehensive examples and tutorials for BNB Chain MCP Servers

This directory contains production-ready code examples and step-by-step tutorials for developers building with the Universal Crypto MCP server across all supported EVM networks.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Examples Overview](#examples-overview)
- [Prerequisites](#prerequisites)
- [Running Examples](#running-examples)
- [Tutorials](#tutorials)
- [Contributing](#contributing)

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/nirholas/bnbchain-mcp.git
cd bnbchain-mcp

# Install dependencies
pnpm install

# Navigate to examples
cd examples

# Install example dependencies
pnpm install

# Run your first example
npx ts-node basic/token-balance-checker.ts
```

## 📂 Examples Overview

### Basic Examples (Beginner)
| Example | Description | Difficulty | Est. Time |
|---------|-------------|------------|-----------|
| [token-balance-checker.ts](./basic/token-balance-checker.ts) | Check native & ERC20 token balances | ⭐ Beginner | 5 min |
| [gas-tracker.ts](./basic/gas-tracker.ts) | Monitor gas prices across chains | ⭐ Beginner | 10 min |
| [security-scanner.ts](./basic/security-scanner.ts) | Scan tokens for security risks | ⭐ Beginner | 10 min |

### Intermediate Examples
| Example | Description | Difficulty | Est. Time |
|---------|-------------|------------|-----------|
| [portfolio-analyzer.ts](./intermediate/portfolio-analyzer.ts) | Analyze multi-chain portfolio | ⭐⭐ Intermediate | 20 min |
| [swap-aggregator.ts](./intermediate/swap-aggregator.ts) | Compare DEX quotes and execute swaps | ⭐⭐ Intermediate | 15 min |
| [market-monitor.ts](./intermediate/market-monitor.ts) | Track market data and trends | ⭐⭐ Intermediate | 15 min |

### Advanced Examples
| Example | Description | Difficulty | Est. Time |
|---------|-------------|------------|-----------|
| [autonomous-agent.ts](./advanced/autonomous-agent.ts) | Autonomous DeFi monitoring agent | ⭐⭐⭐ Advanced | 45 min |
| [multi-chain-tracker.ts](./advanced/multi-chain-tracker.ts) | Track assets across all chains | ⭐⭐⭐ Advanced | 30 min |
| [webhook-integration.ts](./advanced/webhook-integration.ts) | HTTP server with webhooks | ⭐⭐⭐ Advanced | 40 min |

### Integration Examples
| Example | Description | Language | Difficulty |
|---------|-------------|----------|------------|
| [langchain-agent.py](./integrations/langchain-agent.py) | LangChain agent integration | Python | ⭐⭐ Intermediate |
| [autogpt-plugin/](./integrations/autogpt-plugin/) | Complete AutoGPT plugin | Python | ⭐⭐⭐ Advanced |
| [discord-bot.ts](./integrations/discord-bot.ts) | Discord bot for crypto queries | TypeScript | ⭐⭐⭐ Advanced |

## 📋 Prerequisites

### For TypeScript Examples

- **Node.js** 18.0.0 or higher
- **pnpm** (recommended) or npm
- **TypeScript** 5.0 or higher

```bash
# Verify Node.js version
node --version  # Should be >= 18.0.0

# Install pnpm if needed
npm install -g pnpm
```

### For Python Examples

- **Python** 3.9 or higher
- **pip** or **poetry**

```bash
# Verify Python version
python --version  # Should be >= 3.9

# Install dependencies
pip install -r requirements.txt
```

### Environment Setup

Create a `.env` file in the examples directory:

```bash
# Required for write operations
PRIVATE_KEY=your_private_key_here

# Optional: For enhanced functionality  
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key

# API Keys for market data
COINGECKO_API_KEY=your_coingecko_key
COINSTATS_API_KEY=your_coinstats_key

# For Discord bot example
DISCORD_BOT_TOKEN=your_discord_token

# For webhook example
WEBHOOK_SECRET=your_webhook_secret
```

## 🌐 Supported Networks

All examples support these EVM-compatible networks:

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| Ethereum | 1 | ETH |
| BNB Smart Chain | 56 | BNB |
| Arbitrum One | 42161 | ETH |
| Polygon | 137 | MATIC |
| Optimism | 10 | ETH |
| Base | 8453 | ETH |
| opBNB | 204 | BNB |
| Avalanche | 43114 | AVAX |

## 🏃 Running Examples

### TypeScript Examples

```bash
# Using ts-node (development)
npx ts-node basic/token-balance-checker.ts

# Or build and run
pnpm build
node dist/basic/token-balance-checker.js

# Run with custom parameters
ADDRESS=0xYourAddress NETWORK=bsc npx ts-node basic/token-balance-checker.ts
```

### Python Examples

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run example
python integrations/langchain-agent.py
```

## 📖 Tutorials

Comprehensive step-by-step guides for building with the Universal Crypto MCP Server:

| Tutorial | Description | Difficulty | Est. Time |
|----------|-------------|------------|-----------|
| [01 - Getting Started](./tutorials/01-getting-started.md) | First steps with MCP server | ⭐ Beginner | 30 min |
| [02 - Portfolio Dashboard](./tutorials/02-building-portfolio-dashboard.md) | Build a multi-chain portfolio dashboard | ⭐⭐ Intermediate | 2 hours |
| [03 - DeFi Monitor](./tutorials/03-creating-defi-monitor.md) | Create a DeFi monitoring bot | ⭐⭐⭐ Advanced | 3 hours |
| [04 - Security Scanner](./tutorials/04-token-security-guide.md) | Build a token security scanner | ⭐⭐ Intermediate | 1.5 hours |
| [05 - Multi-Agent System](./tutorials/05-multi-agent-system.md) | Build multi-agent architecture | ⭐⭐⭐ Advanced | 4 hours |

## 🛠 Tool Categories Reference

The Universal Crypto MCP Server provides 384 tools across multiple categories:

### Core EVM Tools

| Category | Tools | Description |
|----------|-------|-------------|
| Tokens | 10+ | ERC20 operations, balances, transfers |
| Wallet | 5+ | Address management, signing |
| Transactions | 8+ | Send, decode, trace transactions |
| Contracts | 6+ | Read/write, deployment, verification |
| Blocks | 4+ | Block data, timestamps |

### DeFi Tools

| Category | Tools | Description |
|----------|-------|-------------|
| Swap | 6+ | DEX aggregation (1inch, 0x, ParaSwap) |
| Bridge | 5+ | Cross-chain transfers |
| Staking | 4+ | Liquid staking, LP farming |
| Lending | 6+ | Aave/Compound positions |
| Price Feeds | 5+ | Oracles, TWAP, historical prices |

### Security Tools

| Category | Tools | Description |
|----------|-------|-------------|
| Token Security | 5+ | Rug pull detection, honeypot check |
| Address Security | 3+ | Malicious address detection |
| Contract Audit | 4+ | Basic security analysis |

### Market Data Tools

| Category | Tools | Description |
|----------|-------|-------------|
| CoinGecko | 8+ | Prices, charts, trending |
| CoinStats | 6+ | Market overview, portfolios |
| DeFiLlama | 5+ | TVL, yields, protocols |
| DEX Analytics | 5+ | Pool data, trades, OHLCV |

### Utility Tools

| Category | Tools | Description |
|----------|-------|-------------|
| Gas | 4+ | Gas prices, estimation |
| Events | 3+ | Log querying, decoding |
| Multicall | 2+ | Batch operations |
| Domains | 5+ | ENS, Unstoppable Domains |
| Portfolio | 4+ | Multi-chain tracking |

## 🧪 Testing Examples

Each example includes built-in tests:

```bash
# Run all example tests
pnpm test

# Run specific example tests
pnpm test basic/token-balance-checker.test.ts

# Run with coverage
pnpm test --coverage
```

## 📝 Code Standards

All examples follow these standards:

- ✅ Full TypeScript/Python with complete imports
- ✅ Comprehensive JSDoc/docstrings
- ✅ Error handling with try/catch
- ✅ Input validation
- ✅ Formatted output
- ✅ Environment variable support
- ✅ Testable structure
- ✅ Comments explaining the "why"

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

### Adding New Examples

1. Create your example in the appropriate directory
2. Follow the code standards above
3. Add tests for your example
4. Update this README with your example
5. Submit a pull request

## 📜 License

MIT License - see [LICENSE](../LICENSE) for details.

## 🔗 Resources

- [Universal Crypto MCP Documentation](https://universal-crypto-mcp.vercel.app/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [BNB Chain Developer Docs](https://docs.bnbchain.org/)
- [Ethereum Developer Docs](https://ethereum.org/developers)

---

Built with ❤️ by the Universal Crypto MCP Community
