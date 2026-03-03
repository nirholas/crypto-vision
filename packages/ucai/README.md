# Universal Contract AI Interface    
## The ABI-to-MCP Server Generator
  
```
    ██╗   ██╗ ██████╗ █████╗ ██╗
    ██║   ██║██╔════╝██╔══██╗██║
    ██║   ██║██║     ███████║██║
    ██║   ██║██║     ██╔══██║██║
    ╚██████╔╝╚██████╗██║  ██║██║
     ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝
                                
    Any contract. One command. Claude speaks it.
```

<!-- mcp-name: io.github.nirholas/abi-to-mcp -->

[![PyPI version](https://badge.fury.io/py/abi-to-mcp.svg)](https://badge.fury.io/py/abi-to-mcp)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)
[![UCAI Standard](https://img.shields.io/badge/UCAI-Standard-blue.svg)](#-the-ucai-standard)

<p align="center">
  <a href="https://registry.modelcontextprotocol.io/?q=nirholas"><strong>☑️ UCAI in Anthropic MCP Registry</strong></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://mcp.ucai.tech"><strong>🌐 Try the Web Builder →</strong></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="https://docs.ucai.tech"><strong>📖 Documentation</strong></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-security-scanner"><strong>🛡️ Security Scanner</strong></a>
</p>

---

## 🌐 Try It Live — No Install Required

**[mcp.ucai.tech](https://mcp.ucai.tech)** — Generate MCP servers directly in your browser.


```
+--------------------------------------------------------------------------+
|                                                                          |
|   MCP BUILDER                                         [Connect Wallet]   |
|                                                                          |
|   +---------------------------+--------------------------------------+   |
|   |  Pro Templates            |    Custom Contract                   |   |
|   +---------------------------+--------------------------------------+   |
|                                                                          |
|   Security Scanner: Score 87/100 - Low Risk                              |
|   |-- Contract verified on Etherscan                                     |
|   |-- Uses OpenZeppelin (audited)                                        |
|   |-- Owner can pause transfers (warning)                                |
|   +-- Mint function detected (warning)                                   |
|                                                                          |
|   What This Contract Does:                                               |
|   "ERC-20 token with standard transfer, approve, and allowance           |
|    functions."                                                           |
|                                                                          |
|   [Download Server]  [Share Link]  [Copy Config]                         |
|                                                                          |
+--------------------------------------------------------------------------+
```


**Features:**
- 🛡️ **Security Scanner** — Detects rug pulls, honeypots, and 50+ risks before you connect
- 📖 **Contract Whisperer** — Explains contracts in plain English
- ⚡ **Pro Templates** — Pre-built bundles for Flash Loans, Arbitrage, Yield Aggregators
- 🌙 **Dark/Light Mode** — Easy on the eyes
- 📥 **ZIP Download** — Complete server with `server.py`, `requirements.txt`, `README.md`
- 🔗 **Share Links** — Send `?address=0x...&network=ethereum` to anyone

---

## Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   1. FIND                      2. GENERATE                   3. DONE       │
│                                                                            │
│   ┌─────────────────┐         ┌─────────────────┐       ┌───────────────┐  │
│   │   Etherscan     │         │                 │       │               │  │
│   │   ┌─────────┐   │         │  $ abi-to-mcp   │       │    Claude     │  │
│   │   │ Contract│   │  ────▶  │    generate     │  ──▶  │   Tools       │  │
│   │   │   ABI   │   │         │    0x7a25...    │       │               │  │
│   │   └─────────┘   │         │                 │       │  "Swap 1 ETH" │  │
│   └─────────────────┘         └─────────────────┘       └───────────────┘  │
│                                                                            │
│        Any contract              One command               AI speaks it    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

Found a contract on Etherscan? One command. Claude can now use it.

```bash
pip install abi-to-mcp

# Uniswap — Claude can swap tokens
abi-to-mcp generate 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D -o ~/uniswap-server

# ETH 2.0 Beacon Deposit — Claude can explore staking
abi-to-mcp generate 0x00000000219ab540356cBB839Cbe05303d7705Fa -o ~/eth-staking-server

# Any verified contract works
abi-to-mcp generate <ANY_CONTRACT_ADDRESS>
```

**That's it.** Every function, every event, every query — now a Claude tool.

---

## Quick Start

### 1. Generate a server

```bash
abi-to-mcp generate 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D -o ~/uniswap-server
cd ~/uniswap-server && pip install -r requirements.txt
```

### 2. Connect to Claude Desktop

Add to your config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "uniswap": {
      "command": "python",
      "args": ["/Users/YOU/uniswap-server/server.py"],
      "env": {
        "RPC_URL": "https://eth.llamarpc.com"
      }
    }
  }
}
```

### 3. Ask Claude anything

- *"What's the best route to swap 1 ETH for USDC?"*
- *"Get the reserves for the ETH/DAI pool"*
- *"Show me recent swaps on Uniswap"*

**Claude now speaks DeFi.**

---

## Example

```
┌────────────────────────────────────────────────────────────────────────────┐
│  YOU                                                                       │
├────────────────────────────────────────────────────────────────────────────┤
│  "What's the best route to swap 1 ETH for USDC on Uniswap?"                │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  CLAUDE                                                                    │
├────────────────────────────────────────────────────────────────────────────┤
│  I'll check the Uniswap router for the best path...                        │
│                                                                            │
│  Called: getAmountsOut(1 ETH, [WETH, USDC])                                │
│                                                                            │
│  Best route: ETH -> WETH -> USDC                                           │
│  You would receive: 3,847.23 USDC                                          │
│  Price impact: 0.02%                                                       │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  YOU                                                                       │
├────────────────────────────────────────────────────────────────────────────┤
│  "Do it. Swap 1 ETH for USDC."                                             │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  CLAUDE                                                                    │
├────────────────────────────────────────────────────────────────────────────┤
│  Simulating transaction first...                                           │
│                                                                            │
│  Simulation successful                                                     │
│  Gas estimate: 152,847 (~$3.42)                                            │
│  Expected output: 3,847.23 USDC                                            │
│                                                                            │
│  Ready to execute. Confirm? [Yes/No]                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## The UCAI Standard

**UCAI** (Universal Contract AI Interface) is a standard for how AI agents interact with smart contracts.

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ┌─────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────┐   ║
║   │         │      │              │      │              │      │          │   ║
║   │  Claude │─────>│  abi-to-mcp  │─────>│  MCP Server  │─────>│  Chain   │   ║
║   │         │      │   generate   │      │ (your tools) │      │          │   ║
║   └─────────┘      └──────────────┘      └──────────────┘      └──────────┘   ║
║        │                                        │                     │       ║
║        │              "swap 1 ETH"              │    call swap()      │       ║
║        └────────────────────────────────────────┴─────────────────────┘       ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

**UCAI defines**
- 📋 **Tool schemas** — How contract functions become AI-callable tools
- 🔄 **Type mappings** — Solidity → JSON Schema → Python
- 🔒 **Safety patterns** — Simulation-first for all state changes
- 📡 **Event queries** — Historical data access patterns

**Why UCAI**
- 🔁 **Repeatable** — Same pattern works for ERC20, ERC721, DeFi, DAOs, Solana, anything
- 🔒 **Safe by default** — All write operations simulate first
- 🌐 **Universal** — Works on any chain, with any AI agent
- 🤖 **AI-native** — Designed specifically for LLM tool-calling

Every contract becomes AI-accessible through the same interface. No custom code per contract.

*This package (`abi-to-mcp`) is the reference implementation of UCAI for MCP.*

---

## Why UCAI?

**The Problem:** You want AI to interact with smart contracts. But:
- Writing MCP server boilerplate is tedious
- Mapping Solidity types to JSON Schema is error-prone  
- Every contract needs the same patterns repeated
- Safety (simulation, gas limits) is easy to forget

**The Solution:** One command generates a production-ready MCP server from any ABI.

| Manual Approach | With abi-to-mcp |
|-----------------|-----------------|
| Read contract ABI | `abi-to-mcp generate 0x...` |
| Write 15+ tool functions | ✅ Auto-generated |
| Map types (address → string, uint256 → string) | ✅ Handled |
| Add transaction simulation | ✅ Built-in |
| Handle events as resources | ✅ Included |
| **~2-4 hours per contract** | **~10 seconds** |

---

## Use Cases

- **AI Agent Builders** — Give your agent DeFi superpowers (swap, lend, vote)
- **Wallet Developers** — Let Claude explain and execute transactions
- **DAO Tooling** — AI-powered proposal creation, voting, treasury management
- **DeFi Dashboards** — Natural language queries for on-chain data
- **Vibecoders** — Ship faster with AI-generated blockchain tools

---

## Real Examples

### 🦄 Uniswap: Swap tokens with natural language

```bash
abi-to-mcp generate 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D -o ~/uniswap-server
```

Now ask Claude:
> *"What's the current rate for swapping 10 ETH to USDC?"*

Claude calls `getAmountsOut()` and responds:
> *"10 ETH → 38,472.31 USDC via the WETH/USDC pool. Want me to simulate the swap?"*

---

### 🏦 Aave: Check your health factor

```bash
abi-to-mcp generate 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 -o ~/aave-server
```

> *"What's my health factor on Aave? Am I at risk of liquidation?"*

Claude reads your position and warns you before it's too late.

---

### 🎨 Any NFT: Explore collections

```bash
abi-to-mcp generate 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D -o ~/bayc-server
```

> *"Who owns BAYC #8817? How many apes does that wallet have?"*

Claude calls `ownerOf()` and `balanceOf()` to answer.

---

### 🔮 Your own contract

```bash
abi-to-mcp generate ./my-contract-abi.json --address 0x... -o ~/my-server
```

Any verified contract. Any local ABI. One command.

---

## 🛡️ Security Scanner

Before you connect Claude to a contract, know what you're dealing with. The security scanner analyzes contracts for **50+ risk patterns**:

```
+------------------------------------------------------------------------------+
|  SECURITY REPORT                                            Score: 42/100    |
+------------------------------------------------------------------------------+
|                                                                              |
|  CRITICAL                                                                    |
|  |-- Self-Destruct Function -- Contract can be destroyed                     |
|  +-- tx.origin Authentication -- Vulnerable to phishing                      |
|                                                                              |
|  HIGH                                                                        |
|  |-- Hidden Mint -- Owner can create unlimited tokens                        |
|  |-- Pausable -- Owner can freeze all transfers                              |
|  +-- Blacklist -- Owner can block specific addresses                         |
|                                                                              |
|  POSITIVES                                                                   |
|  |-- Contract verified on Etherscan                                          |
|  |-- Uses OpenZeppelin (audited library)                                     |
|  +-- Has reentrancy protection                                               |
|                                                                              |
|  [Proceed Anyway]                                     [Cancel -- Too Risky]  |
|                                                                              |
+------------------------------------------------------------------------------+
```

**Risk Detection Categories:**

| Severity | Examples |
|----------|----------|
| 🚨 Critical | `selfdestruct`, arbitrary `delegatecall`, `tx.origin` auth |
| ⚠️ High | Hidden mint, pause, blacklist, adjustable fees, tx limits |
| ⚡ Medium | Transfer restrictions, external calls, proxy patterns |
| ℹ️ Low | Timestamp dependence, unchecked math |

**Positive Indicators:**
- ✅ Contract verified on block explorer
- ✅ Uses OpenZeppelin
- ✅ Reentrancy guards
- ✅ Ownership renounced
- ✅ NatSpec documentation

**Try it:** [mcp.ucai.tech](https://mcp.ucai.tech) — Enter any contract address and click "🛡️ Scan"

---

## 📖 Contract Whisperer

Don't understand what a contract does? The Contract Whisperer explains it in plain English:

```
+------------------------------------------------------------------------------+
|  WHAT THIS CONTRACT DOES                                                     |
+------------------------------------------------------------------------------+
|                                                                              |
|  Summary: Uniswap V2 Router -- Decentralized token exchange                  |
|                                                                              |
|  Main Functions:                                                             |
|  |-- [R] getAmountsOut -- Calculate expected output for a swap               |
|  |-- [W] swapExactTokensForTokens -- Exchange tokens at market rate          |
|  |-- [W] addLiquidity -- Provide liquidity to earn fees                      |
|  +-- [R] getReserves -- Check pool balances                                  |
|                                                                              |
|  Permissions:                                                                |
|  |-- Anyone -- Can swap, add/remove liquidity                                |
|  +-- Factory -- Can create new pairs                                         |
|                                                                              |
|  Risk Summary:                                                               |
|  "Standard DEX router. No owner privileges. Interacts with external pools    |
|   which may have their own risks."                                           |
|                                                                              |
+------------------------------------------------------------------------------+
```

**Explains:**
- What the contract does (in one sentence)
- Main functions and their purpose
- Who can do what (permissions/roles)
- Tokenomics (mintable, burnable, fees)
- Risk summary

---

## ⚡ Pro Templates

Pre-built multi-contract bundles for advanced use cases:

| Template | Contracts | Description |
|----------|-----------|-------------|
| **Flash Loan Playground** | Aave V3 Pool, Uniswap Router | Explore flash loans for arbitrage |
| **Multi-DEX Arbitrage** | Uniswap, Sushiswap, Curve | Compare prices across exchanges |
| **Yield Aggregator Intel** | Yearn, Convex, Aura | Track yield farming opportunities |
| **Liquidation Bot Intel** | Aave, Compound | Monitor positions for liquidation |
| **Base DeFi Starter** | Aerodrome, BaseSwap | L2-native DeFi on Base |
| **Arbitrum Perps Suite** | GMX, Camelot | Perpetual futures on Arbitrum |

Each bundle downloads as a ZIP with:
- Multiple `server.py` files (one per contract)
- Pre-configured `claude_config.json`
- Sample prompts to get started

**Try it:** [mcp.ucai.tech](https://mcp.ucai.tech) → "⚡ Pro Templates" tab

---

## What Gets Generated?

When you point abi-to-mcp at a contract, it introspects every function and event, then generates tools Claude can call:

| Contract has... | You get... | Claude can... |
|-----------------|------------|---------------|
| `balanceOf(address)` | Read tool | *"Check vitalik.eth's USDC balance"* |
| `swap(path, amount)` | Write tool (simulated) | *"Swap 1 ETH for DAI"* — simulates first, shows you gas |
| `Transfer` event | Query tool | *"Show me the last 10 transfers over $1M"* |
| Complex structs | Typed schemas | Handles tuples, arrays, nested data |

**15-30 tools per contract**, fully typed, simulation-protected for writes.

## CLI Reference

### `abi-to-mcp generate`

Generate an MCP server from an ABI.

```bash
abi-to-mcp generate <source> [options]
```

**Arguments:**
- `source`: ABI file path or contract address

**Options:**
- `-o, --output PATH`: Output directory (default: `./mcp-server`)
- `-n, --network TEXT`: Network for address lookups (default: `mainnet`)
- `-a, --address TEXT`: Contract address (if not in source)
- `--name TEXT`: Server name (auto-detected if not provided)
- `--read-only`: Only generate read operations
- `--no-events`: Exclude events as resources
- `--no-simulate`: Disable simulation by default for writes

### `abi-to-mcp inspect`

Preview what would be generated without creating files.

```bash
abi-to-mcp inspect ./token-abi.json
```

### `abi-to-mcp validate`

Validate an ABI without generating.

```bash
abi-to-mcp validate ./token-abi.json
```

## Generated Server Structure

```
my-mcp-server/
├── server.py           # Main MCP server
├── config.py           # Configuration
├── requirements.txt    # Dependencies
├── README.md           # Documentation
├── pyproject.toml      # Package config
└── .env.example        # Environment template
```

## Type Mapping

| Solidity Type | JSON Schema | Python Type |
|---------------|-------------|-------------|
| `address` | `string` with pattern | `str` |
| `uint256` | `string` (for precision) | `str` |
| `uint8-uint32` | `integer` with bounds | `int` |
| `bool` | `boolean` | `bool` |
| `string` | `string` | `str` |
| `bytes` | `string` with pattern | `str` |
| `bytes32` | `string` with pattern | `str` |
| `tuple` | `object` | `Dict` |
| `T[]` | `array` | `List` |
| `T[N]` | `array` with bounds | `List` |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `RPC_URL` | Web3 RPC endpoint | Yes |
| `CONTRACT_ADDRESS` | Override contract address | No |
| `PRIVATE_KEY` | For write operations | For writes |
| `ETHERSCAN_API_KEY` | For fetching from Etherscan | For Etherscan |

## Supported Networks

| Network | ID | Chain ID |
|---------|------|----------|
| `mainnet` | Ethereum | 1 |
| `sepolia` | Sepolia Testnet | 11155111 |
| `polygon` | Polygon | 137 |
| `arbitrum` | Arbitrum One | 42161 |
| `optimism` | Optimism | 10 |
| `base` | Base | 8453 |
| `bsc` | BNB Chain | 56 |
| `avalanche` | Avalanche C-Chain | 43114 |

---

## Security

1. **Private keys** — Only loaded from environment variables, never from files or CLI
2. **Simulation by default** — Write operations simulate first; set `simulate=False` to execute
3. **Read-only mode** — Use `--read-only` to completely disable writes
4. **Gas protection** — Configurable maximum gas price limits

---

## Development

```bash
git clone https://github.com/nirholas/UCAI.git
cd UCAI

make setup    # Install dependencies
make test     # Run 876 tests (92% coverage)
make lint     # Check code quality
make docs     # Build documentation
```

---

## Real-World Applications

### 1. DeFi Portfolio Agent
```
"Show me my positions across Uniswap, Aave, and Compound"
"Swap 1 ETH for USDC if the price is above $3,500"
```
Generate servers for each protocol, Claude handles the rest.

### 2. DAO Governance Assistant
```
"What proposals are active on Nouns DAO?"
"Draft a proposal to fund the marketing budget"
"Cast my vote on proposal #47"
```

### 3. NFT Collection Manager
```
"List all my NFTs on Opensea"
"Transfer Bored Ape #1234 to vitalik.eth"
"What's the floor price history for CryptoPunks?"
```

### 4. Wallet Assistant
```
"What tokens do I hold?"
"Send 100 USDC to alice.eth"
"What did I spend on gas this month?"
```

---

## Keywords

*For SEO and discoverability:*

**UCAI** • **Universal Contract AI Interface** • **MCP** • **Model Context Protocol** • **Claude** • **AI Agent** • **Smart Contract** • **Ethereum** • **EVM** • **DeFi** • **Web3** • **Solidity** • **ABI** • **Blockchain** • **Token** • **ERC20** • **ERC721** • **NFT** • **DAO** • **Uniswap** • **Aave** • **Polygon** • **Arbitrum** • **Base** • **Optimism** • **LLM Tool** • **AI Blockchain** • **Vibecoding**

---

## Roadmap

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md).

### 🔴 High Priority
- **Integration tests for generated servers** — Validate MCP servers import correctly

### 🟡 Good First Issues
- **More EVM chains** — Fantom, zkSync, Cronos, etc.
- **More ABI sources** — Blockscout, 4byte.directory
- **Example contracts** — Uniswap, Aave, Compound, OpenSea

### 🚀 Future
- **UCAI for Solana** — Generate from Anchor IDL
- **UCAI for REST APIs** — Generate from OpenAPI specs
- **TypeScript output** — Generate servers in JS/TS
- **Batch generation** — Multiple contracts at once
- **Event subscriptions** — Real-time WebSocket streaming

---

## License

MIT License — see [LICENSE](LICENSE).

---

## Acknowledgments

Built with:
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) — Official Model Context Protocol implementation
- [web3.py](https://github.com/ethereum/web3.py) — Ethereum interaction
- [Typer](https://typer.tiangolo.com/) — CLI framework

---

<p align="center">
  <strong>UCAI — The Universal Contract AI Interface</strong><br>
  <em>Let AI talk to any contract, on any chain.</em><br><br>
  <a href="https://github.com/nirholas/UCAI">⭐ Star on GitHub</a> •
  <a href="https://pypi.org/project/abi-to-mcp/">📦 Install from PyPI</a> •
  <a href="https://modelcontextprotocol.io">🔌 Learn about MCP</a>
</p>

---

## 🌐 Live HTTP Deployment

**UCAI — ABI to MCP** is deployed and accessible over HTTP via [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) transport — no local installation required.

**Endpoint:**
```
https://modelcontextprotocol.name/mcp/ucai
```

### Connect from any MCP Client

Add to your MCP client configuration (Claude Desktop, Cursor, SperaxOS, etc.):

```json
{
  "mcpServers": {
    "ucai": {
      "type": "http",
      "url": "https://modelcontextprotocol.name/mcp/ucai"
    }
  }
}
```

### Available Tools (5)

| Tool | Description |
|------|-------------|
| `lookup_contract` | Look up a smart contract |
| `get_token_by_contract` | Token metadata by contract |
| `get_price` | Get crypto prices |
| `search_coins` | Search coins |
| `get_coin_detail` | Coin details |

### Example Requests

**Look up a smart contract:**
```bash
curl -X POST https://modelcontextprotocol.name/mcp/ucai \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lookup_contract","arguments":{"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"}}}'
```

**Token metadata by contract:**
```bash
curl -X POST https://modelcontextprotocol.name/mcp/ucai \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_token_by_contract","arguments":{"address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"}}}'
```

**Get crypto prices:**
```bash
curl -X POST https://modelcontextprotocol.name/mcp/ucai \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_price","arguments":{"ids":"usd-coin","vs_currencies":"usd"}}}'
```

### List All Tools

```bash
curl -X POST https://modelcontextprotocol.name/mcp/ucai \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Also Available On

- **[SperaxOS](https://speraxos.vercel.app)** — Browse and install from the [MCP marketplace](https://speraxos.vercel.app/community/mcp)
- **All 27 MCP servers** — See the full catalog at [modelcontextprotocol.name](https://modelcontextprotocol.name)

> Powered by [modelcontextprotocol.name](https://modelcontextprotocol.name) — the open MCP HTTP gateway
