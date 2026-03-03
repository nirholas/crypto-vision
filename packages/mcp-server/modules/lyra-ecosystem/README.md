# 🌐 Lyra Ecosystem Payment Layer

> Unified x402 payment integration for the entire Lyra ecosystem

## Overview

This module provides a single payment layer for all Lyra services:

| Service | GitHub | Description | Stars |
|---------|--------|-------------|-------|
| **lyra-intel** | [nirholas/lyra-intel](https://github.com/nirholas/lyra-intel) | Code analysis & security scanning | 9⭐ |
| **lyra-registry** | [nirholas/lyra-registry](https://github.com/nirholas/lyra-registry) | MCP tool catalog | 9⭐ |
| **lyra-tool-discovery** | [nirholas/lyra-tool-discovery](https://github.com/nirholas/lyra-tool-discovery) | Automatic API discovery | 6⭐ |

## 💰 Yield-Bearing Payments with USDs

**AI agents can earn while they sleep!** Using [Sperax USDs](https://sperax.io) on Arbitrum, your payment balance automatically earns ~5-10% APY.

```typescript
// Create a yield-bearing client
const lyra = LyraClient.yieldBearing(process.env.EVM_KEY as `0x${string}`);

// Your USDs balance earns yield even when not making payments!
const yield30Days = lyra.estimateUSdsYield(100, 30);
// → { low: "0.41", mid: "0.62", high: "0.82" }

// Check if using yield-bearing token
lyra.isUsingUSDs(); // true
```

## Quick Start

```typescript
import { LyraClient } from "@/modules/lyra-ecosystem";

const lyra = new LyraClient({
  x402Wallet: process.env.X402_PRIVATE_KEY
});

// Initialize payments (optional - enables paid features)
await lyra.initializePayments();

// All Lyra services, one payment layer
await lyra.intel.securityScan(repoUrl);    // $0.05
await lyra.registry.getToolDetails(id);     // $0.01  
await lyra.discovery.analyze(apiUrl);       // $0.02
```

## Pricing

### Lyra Intel (Code Analysis)

| Tier | Price | Description |
|------|-------|-------------|
| Basic Analysis | **FREE** | File analysis, complexity metrics |
| Security Scan | **$0.05** | Vulnerability detection, OWASP Top 10 |
| Repo Audit | **$0.10** | Full repository code quality audit |
| Enterprise | **$1.00** | Monorepo analysis, dependency graphs |

### Lyra Registry (Tool Catalog)

| Tier | Price | Description |
|------|-------|-------------|
| Browse | **FREE** | Search and list tools |
| Tool Details | **$0.01** | Examples, config, documentation |
| Private Registration | **$0.05** | Register your own MCP tool |
| Featured Listing | **$10/mo** | Homepage placement, badges |

### Lyra Tool Discovery (Auto-Discovery)

| Tier | Price | Description |
|------|-------|-------------|
| Basic Discovery | **FREE** | Detect API endpoints |
| Compatibility | **$0.02** | AI-analyzed MCP compatibility |
| Config Generation | **$0.10** | Auto-generate MCP config |
| Full Assistance | **$0.50** | Code, tests, documentation |

## Usage Examples

### Lyra Intel

```typescript
// Free: Analyze a file
const analysis = await lyra.intel.analyzeFile({
  content: "const x = 1;",
  filename: "example.ts"
});

// $0.05: Security scan
const security = await lyra.intel.securityScan(
  "https://github.com/user/repo"
);
console.log(`Security score: ${security.score}/100`);

// $0.10: Full repo audit
const audit = await lyra.intel.repoAudit(repoUrl, {
  branch: "main",
  focus: ["security", "quality"]
});

// $1.00: Enterprise monorepo analysis
const enterprise = await lyra.intel.enterpriseAnalysis(repoUrl, {
  packageManager: "pnpm"
});
```

### Lyra Registry

```typescript
// Free: Browse tools
const tools = await lyra.registry.browse({
  category: "blockchain",
  sortBy: "stars"
});

// $0.01: Get detailed info
const details = await lyra.registry.getToolDetails("mcp-server-filesystem");
console.log(details.examples[0].code);

// $0.05: Register your tool
const result = await lyra.registry.registerTool({
  name: "my-mcp-tool",
  description: "Custom MCP server",
  version: "1.0.0",
  endpoint: "https://api.mytool.com/mcp",
  category: "utilities",
  visibility: "private"
});
console.log(`Tool ID: ${result.toolId}`);
```

### Lyra Tool Discovery

```typescript
// Free: Discover API
const discovered = await lyra.discovery.discover(
  "https://api.example.com"
);
console.log(`Protocol: ${discovered.protocol}`);

// $0.02: Compatibility analysis
const analysis = await lyra.discovery.analyze(apiUrl);
console.log(`MCP Compatible: ${analysis.mcpCompatible}`);

// $0.10: Generate MCP config
const config = await lyra.discovery.generateMcpConfig(apiUrl, {
  serverName: "my-api-mcp"
});

// $0.50: Full integration assistance
const assistance = await lyra.discovery.getFullAssistance(apiUrl, {
  targetLanguage: "typescript"
});
```

## MCP Tools

Register Lyra tools with your MCP server:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLyraTools } from "@/modules/lyra-ecosystem";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
registerLyraTools(server);
```

Available MCP tools:

| Tool | Description | Cost |
|------|-------------|------|
| `lyra_intel_analyze_file` | Analyze code file | FREE |
| `lyra_intel_security_scan` | Security vulnerability scan | $0.05 |
| `lyra_intel_repo_audit` | Full repository audit | $0.10 |
| `lyra_intel_enterprise_analysis` | Enterprise monorepo analysis | $1.00 |
| `lyra_registry_browse` | Browse tool catalog | FREE |
| `lyra_registry_tool_details` | Detailed tool info | $0.01 |
| `lyra_registry_register` | Register private tool | $0.05 |
| `lyra_registry_trending` | Get trending tools | FREE |
| `lyra_discovery_discover` | Discover API endpoints | FREE |
| `lyra_discovery_analyze` | AI compatibility analysis | $0.02 |
| `lyra_discovery_generate_config` | Generate MCP config | $0.10 |
| `lyra_discovery_full_assist` | Full integration assistance | $0.50 |
| `lyra_get_usage` | Get usage statistics | FREE |
| `lyra_get_pricing` | Get pricing info | FREE |

## Usage Tracking

```typescript
// Check spending
const stats = lyra.getUsageStats("day");
console.log(`Spent today: $${stats.totalSpent}`);
console.log(`Requests: ${stats.requestCount}`);

// Set daily limit
const lyra = new LyraClient({
  x402Wallet: process.env.X402_PRIVATE_KEY,
  maxDailySpend: "5.00" // Max $5/day
});

// Check remaining allowance
const remaining = lyra.getRemainingDailyAllowance();
console.log(`Can still spend: $${remaining}`);
```

## Environment Variables

```bash
# EVM wallet (Base, Arbitrum, BSC, Ethereum, Polygon, Optimism)
X402_EVM_PRIVATE_KEY=0x...

# Solana wallet (optional)
X402_SVM_PRIVATE_KEY=...

# Configuration
LYRA_NETWORK=arbitrum           # Primary network (arbitrum for USDs)
LYRA_MAX_DAILY_SPEND=10.00      # Daily spending limit in USD
LYRA_PREFERRED_TOKEN=USDs       # USDC, USDT, or USDs (yield-bearing!)
```

## 🪙 Sperax USDs Integration

[Sperax USDs](https://docs.sperax.io/) is a yield-bearing stablecoin on Arbitrum. Your balance automatically earns ~5-10% APY with no staking required!

### Why USDs for AI Agents?

| Benefit | Description |
|---------|-------------|
| **Auto-Yield** | Earn ~5-10% APY automatically |
| **No Lock-up** | Fully liquid, use anytime |
| **AI-Friendly** | Agents earn while idle |
| **Low Fees** | Arbitrum = cheap transactions |

### USDs Contract Addresses

```typescript
// Arbitrum One
const USDS = "0xD74f5255D557944cf7Dd0E45FF521520002D5748";
const SPA  = "0x5575552988A3A80504bBaeB1311674fCFd40aD4B";
const xSPA = "0x0966E72256d6055145902F72F9D3B6a194B9cCc3";
const veSPA = "0x2e2071180682Ce6C247B1eF93d382D509F5F6A17";
```

### Using USDs in Lyra

```typescript
// Yield-bearing client (uses USDs on Arbitrum)
const lyra = LyraClient.yieldBearing(process.env.EVM_KEY as `0x${string}`);

// Check if using yield-bearing token
if (lyra.isUsingUSDs()) {
  console.log("✨ Earning yield while idle!");
}

// Estimate yield on $100 over 30 days
const yield = lyra.estimateUSdsYield(100, 30);
console.log(`Expected yield: $${yield.mid}`); // ~$0.62

// Get Sperax contracts
const contracts = lyra.getSperaxContracts();
// → { usds: "0xD74...", spa: "0x557...", xspa: "0x096...", vespa: "0x2e2..." }

// Get supported tokens for current network
const tokens = lyra.getSupportedTokens();
// On Arbitrum: ["USDC", "USDs"]

// Check if token is yield-bearing
lyra.isYieldBearing("USDs");  // true
lyra.isYieldBearing("USDC");  // false
```

## 🔗 Multi-Chain Support

### Supported Networks

| Network | ID | Type | Token | Gas |
|---------|----|----|-------|-----|
| **Base** | `base` | EVM | USDC | ETH |
| **Arbitrum** | `arbitrum` | EVM | USDC, USDs | ETH |
| **BNB Chain** | `bsc` | EVM | USDC, USDT | BNB |
| **Ethereum** | `ethereum` | EVM | USDC, USDT | ETH |
| **Polygon** | `polygon` | EVM | USDC, USDT | MATIC |
| **Optimism** | `optimism` | EVM | USDC, USDT | ETH |
| **Solana** | `solana-mainnet` | SVM | USDC | SOL |

### Testnets

| Network | ID | Type |
|---------|----|----|
| Base Sepolia | `base-sepolia` | EVM |
| Arbitrum Sepolia | `arbitrum-sepolia` | EVM |
| BNB Testnet | `bsc-testnet` | EVM |
| Solana Devnet | `solana-devnet` | SVM |

### Multi-Chain Examples

```typescript
// EVM + Solana support
const lyra = new LyraClient({
  wallets: {
    evmPrivateKey: process.env.EVM_KEY as `0x${string}`,
    svmPrivateKey: process.env.SOL_KEY,
  },
  network: "arbitrum",
  chainPreference: {
    primary: "arbitrum",
    fallbacks: ["base", "bsc"],
    preferLowFees: true,
  },
});

// Low-cost client (uses cheapest chain)
const cheapLyra = LyraClient.lowCost(process.env.EVM_KEY as `0x${string}`);

// Solana-only client
const solLyra = LyraClient.solana(process.env.SOL_KEY);

// Testnet for development
const testLyra = LyraClient.testnet(
  process.env.EVM_KEY as `0x${string}`,
  process.env.SOL_KEY
);

// Switch networks at runtime
await lyra.switchNetwork("bsc");
console.log(`Now using: ${lyra.getActiveNetwork()}`);

// Get all supported networks
const networks = lyra.getSupportedNetworks();
// → [{ id: "base", name: "Base", type: "evm", testnet: false }, ...]
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     LyraClient                          │
│               (Unified Multi-Chain Entry)               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ LyraIntel   │  │ LyraRegistry│  │ LyraDiscovery   │ │
│  │             │  │             │  │                 │ │
│  │ • Analyze   │  │ • Browse    │  │ • Discover      │ │
│  │ • Security  │  │ • Details   │  │ • Analyze       │ │
│  │ • Audit     │  │ • Register  │  │ • Generate      │ │
│  │ • Enterprise│  │ • Featured  │  │ • Assist        │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                   │          │
│         └────────────────┼───────────────────┘          │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              x402 Payment Layer                  │   │
│  │  ┌─────┐ ┌───────┐ ┌─────┐ ┌────┐ ┌────────┐   │   │
│  │  │Base │ │Arbitrum│ │ BSC │ │ ETH│ │ Solana │   │   │
│  │  └──┬──┘ └───┬───┘ └──┬──┘ └─┬──┘ └───┬────┘   │   │
│  │     └────────┴────────┴──────┴────────┘         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │   USDC / USDT    │
              │  on any chain    │
              └──────────────────┘
```

## License

Apache-2.0
