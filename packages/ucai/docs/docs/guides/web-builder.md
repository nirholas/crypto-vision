---
title: Web Builder
description: Generate MCP servers in your browser — no installation required
---

# Web Builder

**[mcp.ucai.tech](https://mcp.ucai.tech)** — Generate MCP servers directly in your browser, with built-in security scanning and plain English contract explanations.

## Features

### 🛡️ Security Scanner

Before creating an MCP server, the security scanner analyzes the contract for **50+ risk patterns**:

- **Critical risks:** `selfdestruct`, arbitrary `delegatecall`, `tx.origin` auth
- **High risks:** Hidden mint functions, pause/freeze, blacklists, adjustable fees
- **Medium risks:** Transfer restrictions, proxy patterns, assembly code
- **Low risks:** Timestamp dependence, unchecked math

The scanner produces a **risk score (0-100)** and categorizes the contract:

| Score | Level | Meaning |
|-------|-------|---------|
| 80-100 | 🟢 Safe | Low risk, standard patterns |
| 60-79 | 🟡 Caution | Some concerns, review carefully |
| 40-59 | 🟠 Warning | Multiple risks detected |
| 0-39 | 🔴 Danger | High risk, proceed with extreme caution |

### 📖 Contract Whisperer

The Contract Whisperer explains what a smart contract does in plain English:

- **Summary:** One-sentence description
- **Main functions:** What each function does
- **Permissions:** Who can do what (owner, admin, anyone)
- **Tokenomics:** Mintable, burnable, fees
- **Risk summary:** Plain English explanation of risks

### ⚡ Pro Templates

Pre-built multi-contract bundles for advanced use cases:

| Template | Contracts | Use Case |
|----------|-----------|----------|
| Flash Loan Playground | Aave V3, Uniswap | Flash loan arbitrage |
| Multi-DEX Arbitrage | Uniswap, Sushi, Curve | Cross-DEX price comparison |
| Yield Aggregator Intel | Yearn, Convex, Aura | Yield farming opportunities |
| Liquidation Bot Intel | Aave, Compound | Liquidation monitoring |
| Base DeFi Starter | Aerodrome, BaseSwap | L2 DeFi on Base |
| Arbitrum Perps Suite | GMX, Camelot | Perpetual futures |

### 🔧 Custom Contract Builder

1. **Connect wallet** (optional) — Saves your servers to localStorage
2. **Select network** — Ethereum, Polygon, Arbitrum, Base, Optimism, BSC, Avalanche
3. **Enter contract address** — Or paste an ABI
4. **Fetch ABI** — Automatically retrieves from block explorer
5. **Security scan** — Auto-runs after fetching ABI
6. **Download** — ZIP with `server.py`, `requirements.txt`, `README.md`

## Usage

### Quick Start

1. Go to [mcp.ucai.tech](https://mcp.ucai.tech)
2. Enter a contract address (e.g., `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D` for Uniswap)
3. Click **Fetch ABI**
4. Review the security scan results
5. Click **Generate & Download Server**
6. Unzip and follow the included README

### Using Pro Templates

1. Click the **⚡ Pro Templates** tab
2. Browse templates by category
3. Click **Generate X-Contract Bundle**
4. Wait for ABIs to be fetched
5. Download the ZIP containing all servers

### Sharing Links

Share a pre-filled form with anyone:

```
https://mcp.ucai.tech?address=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D&network=ethereum
```

Parameters:
- `address` — Contract address
- `network` — Network ID (ethereum, polygon, arbitrum, base, optimism, bsc, avalanche)

### Dark/Light Mode

Toggle between light and dark themes using the sun/moon switch in the header.

### Export/Import Servers

If you've connected a wallet, your generated servers are saved to localStorage:

- **Export:** Download your server list as JSON
- **Import:** Restore servers from a JSON backup

## Downloaded Files

Each generated server includes:

```
my-contract-mcp-server/
├── server.py           # MCP server implementation
├── requirements.txt    # Python dependencies
├── README.md           # Setup instructions
└── abi.json            # Contract ABI
```

### server.py

A complete MCP server with:

- All view/read functions as tools
- All write functions as tools (with simulation)
- Events as queryable resources
- Proper type mappings (address, uint256, bytes, etc.)

### requirements.txt

```
mcp>=1.0.0
web3>=6.0.0
python-dotenv>=1.0.0
```

### README.md

Step-by-step setup instructions:

1. Install dependencies
2. Set RPC_URL environment variable
3. Add to Claude Desktop config
4. Example prompts to try

## Supported Networks

| Network | Explorer API |
|---------|-------------|
| Ethereum Mainnet | Etherscan |
| Polygon | Polygonscan |
| Arbitrum One | Arbiscan |
| Base | Basescan |
| Optimism | Optimistic Etherscan |
| BNB Smart Chain | BSCScan |
| Avalanche C-Chain | Snowtrace |
| Custom RPC | Manual ABI entry required |

## API Routes

The web builder uses the following API endpoints:

### POST /api/analyze

Analyzes a contract for security risks and generates explanations.

**Request:**
```json
{
  "address": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  "network": "ethereum"
}
```

**Response:**
```json
{
  "success": true,
  "address": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  "contractName": "UniswapV2Router02",
  "isVerified": true,
  "isProxy": false,
  "securityReport": {
    "overallScore": 85,
    "riskLevel": "safe",
    "risks": [...],
    "positives": [...]
  },
  "explanation": {
    "summary": "Uniswap V2 Router - Decentralized exchange",
    "purpose": "...",
    "mainFunctions": [...],
    "permissions": [...],
    "riskSummary": "..."
  }
}
```

## Privacy

- **No backend storage** — All server configs are stored in your browser's localStorage
- **Wallet optional** — Connect only if you want to save servers across sessions
- **No tracking** — We don't track which contracts you analyze
- **Open source** — [View the code on GitHub](https://github.com/nirholas/UCAI/tree/main/web-v2)
