# BNB Chain MCP

> **Talk to BNB Chain like you talk to ChatGPT.**

A production-ready Model Context Protocol server for BNB Smart Chain, opBNB, and Greenfield.

---

## Example Prompts

No coding required. Just type what you want in natural language:

### Check Balances & Portfolio
```
"What's the BNB balance of 0x1234...?"
"Show me all BEP-20 tokens in this wallet"
"How much USDT do I have on BSC?"
"What's my portfolio value across BSC and opBNB?"
```

### Research & Security
```
"Is this token safe to buy on PancakeSwap? 0xTokenAddress"
"Check if this BSC contract is a honeypot"
"What's the TVL of PancakeSwap?"
"Show me the top holders of CAKE token"
"Is this BNB Chain dApp legit or a phishing site?"
```

### Market Data & Prices
```
"What's the price of BNB?"
"Show me trending tokens on BSC"
"What are the best yield farming opportunities on BNB Chain?"
"Get me the latest BNB Chain news"
"What's the Fear & Greed Index?"
```

### Swaps & DeFi
```
"Get me a quote to swap 1 BNB for USDT on PancakeSwap"
"What's the best DEX on BSC to swap CAKE to BNB?"
"Show me the liquidity pools for BNB/USDT on PancakeSwap"
"What are the current gas prices on BSC?"
```

### Bridging
```
"How do I bridge USDT from Ethereum to BSC?"
"Get me a quote to bridge 100 USDT from BSC to opBNB"
"What's the cheapest way to bridge assets to BNB Chain?"
```

### Lending & Borrowing (Venus, Lista DAO)
```
"What's the supply APY for USDT on Venus?"
"Show me my health factor on Venus Protocol"
"What can I borrow against my BNB collateral on Lista DAO?"
"Compare lending rates between Venus and Lista"
```

### Staking
```
"How do I stake BNB?"
"What's the current BNB staking APY?"
"Show me liquid staking options on BNB Chain"
```

### Wallet Security
```
"Show me all token approvals for my BSC wallet"
"Which BEP-20 approvals should I revoke?"
"Has this wallet interacted with any scam contracts on BSC?"
```

### News & Sentiment
```
"What's the latest news about BNB Chain?"
"Show me social sentiment for CAKE"
"What are the top trending projects on BSC?"
```

---

## Quick Start

### For Claude Desktop

1. Open Claude Desktop settings
2. Add this to your config:

```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"]
    }
  }
}
```

3. Restart Claude Desktop
4. Start asking questions about BNB Chain

### For Cursor

Add to your MCP settings (Cursor Settings → MCP):

```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"]
    }
  }
}
```

### For ChatGPT (Developer Mode)

```bash
npx @nirholas/universal-crypto-mcp --http
```

Then connect ChatGPT to `http://localhost:3001/mcp`

---

## Real-World Use Cases

### Due Diligence Before Buying on PancakeSwap
> "I found this new token on BSC. Can you check if it's safe? Here's the contract: 0x..."

The AI will automatically:
- Check for honeypot traps using GoPlus
- Analyze holder distribution for whale concentration
- Look for rug pull risks (mint functions, ownership)
- Check if ownership is renounced
- Verify liquidity is locked on PancakeSwap

### Find the Best Yields on BNB Chain
> "Where can I earn the highest APY on my USDT on BNB Chain?"

The AI will:
- Compare lending rates on Venus Protocol
- Check Lista DAO borrowing rates
- Show PancakeSwap liquidity pool APYs
- Factor in risks and TVL
- Recommend the best options for your risk profile

### Clean Up Your BSC Wallet
> "Audit my BSC wallet and tell me what approvals I should revoke"

The AI will:
- List all active BEP-20 token approvals
- Flag unlimited approvals (high risk)
- Identify old/unused approvals from forgotten dApps
- Help you revoke dangerous ones

### Optimize Bridging to BNB Chain
> "I need to move $1000 USDT from Ethereum to BSC. What's the cheapest way?"

The AI will:
- Compare bridge options (Stargate, LayerZero, cBridge)
- Calculate total fees including gas
- Estimate transfer time
- Recommend the best route

### Bridge Between BSC and opBNB
> "How do I move my tokens from BSC to opBNB?"

The AI will:
- Show native bridge options
- Compare fees and speeds
- Guide you through the process

### Track Your BNB Chain Portfolio
> "Give me a complete breakdown of my holdings on BSC and opBNB"

The AI will:
- Fetch all BEP-20 token balances
- Show token values in USD
- Calculate your allocation
- Highlight any security concerns with tokens you hold

### Analyze Venus Protocol Position
> "What's my current position on Venus? Am I at risk of liquidation?"

The AI will:
- Show your supplied assets
- Display borrowed amounts
- Calculate health factor
- Warn if approaching liquidation threshold

---

## Platform Compatibility

| AI Platform | Status | Setup |
|-------------|--------|-------|
| **Claude Desktop** | Supported | Native MCP support |
| **Cursor** | Supported | Native MCP support |
| **ChatGPT** | Supported | Developer Mode (HTTP) |
| **VS Code + Copilot** | Supported | Via MCP extension |
| **Any MCP Client** | Supported | stdio or HTTP |

---

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| **BNB Smart Chain (BSC)** | 56 | Full Support |
| **opBNB** | 204 | Full Support |
| **BSC Testnet** | 97 | Full Support |
| **opBNB Testnet** | 5611 | Full Support |
| **Ethereum** | 1 | Full Support |
| **Arbitrum One** | 42161 | Full Support |
| **Polygon** | 137 | Full Support |
| **Base** | 8453 | Full Support |
| **Optimism** | 10 | Full Support |

---

## BNB Chain Protocols Supported

| Protocol | Category | Features |
|----------|----------|----------|
| **PancakeSwap** | DEX | Swaps, liquidity, farms, IFO |
| **Venus Protocol** | Lending | Supply, borrow, liquidations |
| **Lista DAO** | Lending/CDP | lisUSD minting, collateral |
| **Stargate** | Bridge | Cross-chain transfers |
| **Biswap** | DEX | Swaps, liquidity |
| **Thena** | DEX | ve(3,3) swaps, liquidity |
| **Alpaca Finance** | Yield | Leveraged yield farming |
| **Belt Finance** | Yield | Stablecoin yields |

---

## Capabilities

| Category | Features |
|----------|----------|
| **Tokens** | BEP-20 balances, transfers, approvals, token info |
| **Swaps** | PancakeSwap quotes, execute swaps, liquidity pools |
| **Bridges** | BSC to opBNB, cross-chain transfers, quotes |
| **Lending** | Venus supply/borrow, health factor, liquidations |
| **Security** | Honeypot check, rug detection, GoPlus audits |
| **Data** | BNB price, TVL, yields, gas prices |
| **News** | BNB Chain news, sentiment, trending |
| **Governance** | Snapshot votes, on-chain proposals |
| **Signing** | Messages, typed data, verification |
| **Deployment** | BEP-20 contracts, proxies, verification |

---

## Security

- **Read-only by default** - No transactions without your private key
- **Keys stay local** - Never transmitted externally
- **Review before signing** - Always displays transaction details
- **Open source** - Verify the code yourself

---

## Documentation

Full documentation: **https://sperax.cloud**

---

## Support

- Twitter: [@nichxbt](https://x.com/nichxbt)
- GitHub: [github.com/speraxos/BNB-Chain-MCP](https://github.com/speraxos/BNB-Chain-MCP)
- Docs: [sperax.cloud](https://sperax.cloud)

---

<details>
<summary><h2>Technical Documentation (Click to Expand)</h2></summary>

## Supported Networks

- BNB Smart Chain (BSC) - Chain ID: 56
- opBNB - Chain ID: 204
- BSC Testnet - Chain ID: 97
- opBNB Testnet - Chain ID: 5611
- Ethereum, Arbitrum, Polygon, Base, Optimism

## Features

- **Swap/DEX** - Token swaps via PancakeSwap, 1inch, 0x, ParaSwap
- **Bridge** - Cross-chain transfers via LayerZero, Stargate, cBridge
- **Gas** - BSC/opBNB gas prices, EIP-1559 suggestions
- **Multicall** - Batch read/write operations
- **Events/Logs** - Query historical events, decode logs
- **Security** - Rug pull detection, honeypot check, GoPlus token/address security, dApp phishing detection
- **Staking** - BNB staking, liquid staking, LP farming
- **Signatures** - Sign messages, verify signatures, EIP-712
- **Lending** - Venus/Lista positions, borrow rates, health factor
- **Price Feeds** - Historical prices, TWAP, Chainlink oracles
- **Portfolio** - Track holdings across BSC, opBNB, and other chains
- **Governance** - Snapshot votes, on-chain proposals
- **Deployment** - Deploy BEP-20 contracts, CREATE2, upgradeable proxies, BSCScan verification
- **MEV Protection** - Private transactions, bundle simulation
- **Domains** - Space ID (.bnb) resolution
- **Market Data** - CoinGecko & CoinStats prices, OHLCV, trending
- **DeFi Analytics** - DefiLlama TVL, yields, fees, protocol data
- **Social Sentiment** - LunarCrush social metrics, influencers
- **DEX Analytics** - GeckoTerminal pools, trades, OHLCV, trending tokens

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

### Cursor

Add to your MCP settings:

```json
{
  "mcpServers": {
    "bnb-chain-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

### ChatGPT Developer Mode

```bash
PORT=3001 npx @nirholas/universal-crypto-mcp --http
```

Then in ChatGPT Developer Mode, add the MCP endpoint: `http://localhost:3001/mcp`

## Server Modes

| Mode | Command | Use Case |
|------|---------|----------|
| stdio | `npx @nirholas/universal-crypto-mcp` | Claude Desktop, Cursor |
| HTTP | `npx @nirholas/universal-crypto-mcp --http` | ChatGPT Developer Mode |
| SSE | `npx @nirholas/universal-crypto-mcp --sse` | Legacy HTTP clients |

## Local Development

```bash
# Clone
git clone https://github.com/speraxos/BNB-Chain-MCP
cd BNB-Chain-MCP

# Install
bun install

# Run dev server (stdio - Claude)
bun dev

# Run dev server (HTTP - ChatGPT)
bun dev:http

# Run dev server (SSE - legacy)
bun dev:sse
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Wallet private key for write operations | No |
| `PORT` | Server port (default: 3001) | No |
| `LOG_LEVEL` | DEBUG, INFO, WARN, ERROR | No |
| `COINGECKO_API_KEY` | CoinGecko API key | No |
| `COINSTATS_API_KEY` | CoinStats API key | No |
| `LUNARCRUSH_API_KEY` | LunarCrush API key | No |
| `CRYPTOPANIC_API_KEY` | CryptoPanic API key | No |

## Data Sources

| Provider | Data Type | API Key Required |
|----------|-----------|------------------|
| [BscScan](https://bscscan.com) | BSC blockchain data | Optional |
| [CoinGecko](https://coingecko.com) | Market data, prices, OHLCV | Optional |
| [CoinStats](https://coinstats.app) | Portfolio, prices, wallets | Yes |
| [DefiLlama](https://defillama.com) | TVL, yields, fees, protocols | No |
| [LunarCrush](https://lunarcrush.com) | Social sentiment, influencers | Yes |
| [GoPlus](https://gopluslabs.io) | Security analysis, honeypot detection | No |
| [GeckoTerminal](https://geckoterminal.com) | DEX pools, trades, OHLCV | No |
| [DexPaprika](https://dexpaprika.com) | DEX analytics, pools | No |
| [CryptoPanic](https://cryptopanic.com) | Crypto news | Yes |

---

## Roadmap

Full roadmap with 500+ planned features available in the repository.

### Implemented
- BEP-20 token operations (balances, transfers, approvals)
- PancakeSwap integration (swaps, quotes, liquidity)
- Venus Protocol (supply, borrow, health factor)
- Cross-chain bridging (Stargate, LayerZero)
- Security analysis (GoPlus honeypot, rug detection)
- BSC gas price monitoring
- Portfolio tracking across BSC/opBNB
- Market data and prices
- Social sentiment analysis

### Planned
- Lista DAO full integration
- Space ID (.bnb) domain registration
- opBNB native bridge
- BNB staking
- Greenfield storage integration
- More BNB Chain protocols

</details>

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))

## License

MIT
