# Tutorial 2: Building a Portfolio Dashboard

Learn how to build a comprehensive multi-chain portfolio dashboard that tracks your crypto assets across multiple blockchain networks.

**Difficulty:** ⭐⭐ Intermediate  
**Time:** 30 minutes  
**Prerequisites:** Completed Tutorial 1, Basic TypeScript knowledge

---

## Table of Contents

1. [Overview](#overview)
2. [Project Setup](#project-setup)
3. [Fetching Balances](#fetching-balances)
4. [Adding Token Support](#adding-token-support)
5. [Price Integration](#price-integration)
6. [Portfolio Analytics](#portfolio-analytics)
7. [Building the Dashboard](#building-the-dashboard)
8. [Exercises](#exercises)

---

## Overview

By the end of this tutorial, you'll have a dashboard that:

- ✅ Fetches native token balances across 6+ networks
- ✅ Tracks ERC20 token holdings
- ✅ Calculates USD values using real-time prices
- ✅ Shows portfolio allocation breakdown
- ✅ Identifies your largest positions
- ✅ Tracks performance over time

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Portfolio Dashboard                   │
├─────────────┬─────────────┬─────────────┬──────────────┤
│  Ethereum   │     BSC     │  Arbitrum   │   Polygon    │
│  ETH + ERC20│ BNB + BEP20 │ ETH + ERC20 │ MATIC + ERC20│
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬───────┘
       │             │             │             │
       └─────────────┴──────┬──────┴─────────────┘
                           │
                    ┌──────▼──────┐
                    │  MCP Server │
                    └─────────────┘
```

---

## Project Setup

### 1. Create Project Directory

```bash
mkdir portfolio-dashboard
cd portfolio-dashboard
npm init -y
```

### 2. Install Dependencies

```bash
npm install @modelcontextprotocol/sdk typescript tsx @types/node
```

### 3. Create TypeScript Config

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist"
  }
}
```

### 4. Create Main File

```typescript
// portfolio.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// We'll build this step by step!
```

---

## Fetching Balances

### Step 1: Create MCP Connection

```typescript
// lib/mcp.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let client: Client | null = null;

export async function getClient(): Promise<Client> {
    if (client) return client;

    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@nirholas/universal-crypto-mcp@latest"]
    });

    client = new Client({
        name: "portfolio-dashboard",
        version: "1.0.0"
    }, {
        capabilities: {}
    });

    await client.connect(transport);
    return client;
}

export async function callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const mcp = await getClient();
    const result = await mcp.callTool({ name, arguments: args });
    
    const content = result.content as Array<{ type: string; text?: string }>;
    if (content?.[0]?.type === "text" && content[0].text) {
        return JSON.parse(content[0].text) as T;
    }
    
    throw new Error("Invalid response format");
}
```

### Step 2: Define Types

```typescript
// types.ts
export interface NetworkConfig {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
}

export interface Balance {
    network: string;
    symbol: string;
    balance: string;
    formatted: string;
    usdValue?: number;
}

export interface TokenHolding extends Balance {
    tokenAddress: string;
    tokenName: string;
}

export interface Portfolio {
    address: string;
    nativeBalances: Balance[];
    tokenHoldings: TokenHolding[];
    totalValueUsd: number;
    lastUpdated: Date;
}

export const NETWORKS: NetworkConfig[] = [
    { id: "ethereum", name: "Ethereum", symbol: "ETH", decimals: 18 },
    { id: "bsc", name: "BNB Chain", symbol: "BNB", decimals: 18 },
    { id: "arbitrum", name: "Arbitrum", symbol: "ETH", decimals: 18 },
    { id: "polygon", name: "Polygon", symbol: "MATIC", decimals: 18 },
    { id: "optimism", name: "Optimism", symbol: "ETH", decimals: 18 },
    { id: "base", name: "Base", symbol: "ETH", decimals: 18 }
];
```

### Step 3: Fetch Native Balances

```typescript
// services/balances.ts
import { callTool } from "../lib/mcp.js";
import { Balance, NETWORKS } from "../types.js";

export async function getNativeBalances(address: string): Promise<Balance[]> {
    const balances: Balance[] = [];
    
    // Fetch all networks in parallel
    const promises = NETWORKS.map(async (network) => {
        try {
            const result = await callTool<{
                balance: string;
                formatted: string;
                symbol: string;
            }>("get_native_balance", {
                address,
                network: network.id
            });
            
            return {
                network: network.id,
                symbol: result.symbol,
                balance: result.balance,
                formatted: result.formatted
            };
        } catch (error) {
            console.warn(`Failed to fetch ${network.name} balance:`, error);
            return null;
        }
    });
    
    const results = await Promise.all(promises);
    
    return results.filter((b): b is Balance => b !== null);
}
```

### Step 4: Test It

```typescript
// test-balances.ts
import { getNativeBalances } from "./services/balances.js";

async function main() {
    const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth
    
    console.log("Fetching balances...\n");
    const balances = await getNativeBalances(address);
    
    console.log("Native Token Balances:");
    console.log("─".repeat(50));
    
    for (const balance of balances) {
        console.log(`${balance.network.padEnd(12)} ${balance.formatted} ${balance.symbol}`);
    }
}

main().catch(console.error);
```

Run it:

```bash
npx tsx test-balances.ts
```

---

## Adding Token Support

### Popular Tokens to Track

```typescript
// config/tokens.ts
export interface TrackedToken {
    address: string;
    symbol: string;
    network: string;
}

export const TRACKED_TOKENS: TrackedToken[] = [
    // Ethereum
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", network: "ethereum" },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", network: "ethereum" },
    { address: "0x6B175474E89094C44Da98b954EescdecB68C", symbol: "DAI", network: "ethereum" },
    
    // BSC
    { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", network: "bsc" },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", network: "bsc" },
    
    // Arbitrum
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", network: "arbitrum" },
    { address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", symbol: "USDC", network: "arbitrum" }
];
```

### Fetch Token Balances

```typescript
// services/tokens.ts
import { callTool } from "../lib/mcp.js";
import { TokenHolding } from "../types.js";
import { TRACKED_TOKENS } from "../config/tokens.js";

export async function getTokenBalances(address: string): Promise<TokenHolding[]> {
    const holdings: TokenHolding[] = [];
    
    const promises = TRACKED_TOKENS.map(async (token) => {
        try {
            const result = await callTool<{
                balance: string;
                formatted: string;
                symbol: string;
                name: string;
            }>("get_erc20_balance", {
                address,
                tokenAddress: token.address,
                network: token.network
            });
            
            // Only include non-zero balances
            if (parseFloat(result.formatted) > 0) {
                return {
                    network: token.network,
                    tokenAddress: token.address,
                    tokenName: result.name,
                    symbol: result.symbol,
                    balance: result.balance,
                    formatted: result.formatted
                };
            }
            return null;
        } catch {
            return null;
        }
    });
    
    const results = await Promise.all(promises);
    return results.filter((h): h is TokenHolding => h !== null);
}
```

---

## Price Integration

### Fetch Prices

```typescript
// services/prices.ts
import { callTool } from "../lib/mcp.js";

interface PriceData {
    id: string;
    symbol: string;
    current_price: number;
}

// Map symbols to CoinGecko IDs
const SYMBOL_TO_COINGECKO: Record<string, string> = {
    ETH: "ethereum",
    BNB: "binancecoin",
    MATIC: "matic-network",
    USDT: "tether",
    USDC: "usd-coin",
    DAI: "dai"
};

export async function getPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    const ids = [...new Set(
        symbols
            .map(s => SYMBOL_TO_COINGECKO[s.toUpperCase()])
            .filter(Boolean)
    )];
    
    if (ids.length === 0) return prices;
    
    try {
        const result = await callTool<{
            coins: Array<{ id: string; symbol: string; current_price: number }>;
        }>("market_get_coins", {
            coinIds: ids,
            currency: "USD"
        });
        
        for (const coin of result.coins) {
            prices.set(coin.symbol.toUpperCase(), coin.current_price);
        }
    } catch (error) {
        console.warn("Failed to fetch prices:", error);
    }
    
    // Stablecoins fallback
    prices.set("USDT", prices.get("USDT") || 1);
    prices.set("USDC", prices.get("USDC") || 1);
    prices.set("DAI", prices.get("DAI") || 1);
    
    return prices;
}
```

### Calculate Portfolio Value

```typescript
// services/portfolio.ts
import { Balance, TokenHolding, Portfolio } from "../types.js";
import { getNativeBalances } from "./balances.js";
import { getTokenBalances } from "./tokens.js";
import { getPrices } from "./prices.js";

export async function buildPortfolio(address: string): Promise<Portfolio> {
    console.log("Fetching native balances...");
    const nativeBalances = await getNativeBalances(address);
    
    console.log("Fetching token balances...");
    const tokenHoldings = await getTokenBalances(address);
    
    // Collect all symbols for price lookup
    const symbols = [
        ...nativeBalances.map(b => b.symbol),
        ...tokenHoldings.map(t => t.symbol)
    ];
    
    console.log("Fetching prices...");
    const prices = await getPrices(symbols);
    
    // Calculate USD values
    let totalValueUsd = 0;
    
    for (const balance of nativeBalances) {
        const price = prices.get(balance.symbol.toUpperCase()) || 0;
        balance.usdValue = parseFloat(balance.formatted) * price;
        totalValueUsd += balance.usdValue;
    }
    
    for (const holding of tokenHoldings) {
        const price = prices.get(holding.symbol.toUpperCase()) || 0;
        holding.usdValue = parseFloat(holding.formatted) * price;
        totalValueUsd += holding.usdValue;
    }
    
    return {
        address,
        nativeBalances,
        tokenHoldings,
        totalValueUsd,
        lastUpdated: new Date()
    };
}
```

---

## Portfolio Analytics

### Allocation Analysis

```typescript
// analytics/allocation.ts
import { Portfolio } from "../types.js";

interface Allocation {
    asset: string;
    network: string;
    value: number;
    percentage: number;
}

export function calculateAllocation(portfolio: Portfolio): Allocation[] {
    const allocations: Allocation[] = [];
    
    // Add native balances
    for (const balance of portfolio.nativeBalances) {
        if (balance.usdValue && balance.usdValue > 0) {
            allocations.push({
                asset: balance.symbol,
                network: balance.network,
                value: balance.usdValue,
                percentage: (balance.usdValue / portfolio.totalValueUsd) * 100
            });
        }
    }
    
    // Add token holdings
    for (const holding of portfolio.tokenHoldings) {
        if (holding.usdValue && holding.usdValue > 0) {
            allocations.push({
                asset: holding.symbol,
                network: holding.network,
                value: holding.usdValue,
                percentage: (holding.usdValue / portfolio.totalValueUsd) * 100
            });
        }
    }
    
    // Sort by value descending
    return allocations.sort((a, b) => b.value - a.value);
}

export function getNetworkDistribution(portfolio: Portfolio): Map<string, number> {
    const distribution = new Map<string, number>();
    
    for (const balance of portfolio.nativeBalances) {
        const current = distribution.get(balance.network) || 0;
        distribution.set(balance.network, current + (balance.usdValue || 0));
    }
    
    for (const holding of portfolio.tokenHoldings) {
        const current = distribution.get(holding.network) || 0;
        distribution.set(holding.network, current + (holding.usdValue || 0));
    }
    
    return distribution;
}
```

---

## Building the Dashboard

### Console Dashboard

```typescript
// dashboard.ts
import { buildPortfolio } from "./services/portfolio.js";
import { calculateAllocation, getNetworkDistribution } from "./analytics/allocation.js";

function formatUsd(value: number): string {
    return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
}

function printBar(percentage: number, width = 30): string {
    const filled = Math.round((percentage / 100) * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
}

async function displayDashboard(address: string): Promise<void> {
    console.clear();
    console.log("═".repeat(60));
    console.log("           💼 PORTFOLIO DASHBOARD");
    console.log("═".repeat(60));
    console.log();
    
    const portfolio = await buildPortfolio(address);
    
    // Header
    console.log(`Address: ${address.slice(0, 8)}...${address.slice(-6)}`);
    console.log(`Total Value: ${formatUsd(portfolio.totalValueUsd)}`);
    console.log(`Updated: ${portfolio.lastUpdated.toLocaleString()}`);
    console.log();
    
    // Network Distribution
    console.log("─".repeat(60));
    console.log("📊 NETWORK DISTRIBUTION");
    console.log("─".repeat(60));
    
    const networkDist = getNetworkDistribution(portfolio);
    for (const [network, value] of networkDist) {
        const pct = (value / portfolio.totalValueUsd) * 100;
        console.log(
            `${network.padEnd(12)} ${printBar(pct)} ${formatPercent(pct).padStart(7)} ${formatUsd(value).padStart(15)}`
        );
    }
    console.log();
    
    // Top Holdings
    console.log("─".repeat(60));
    console.log("🏆 TOP HOLDINGS");
    console.log("─".repeat(60));
    
    const allocations = calculateAllocation(portfolio);
    for (const alloc of allocations.slice(0, 10)) {
        console.log(
            `${alloc.asset.padEnd(8)} ${alloc.network.padEnd(10)} ${formatPercent(alloc.percentage).padStart(7)} ${formatUsd(alloc.value).padStart(15)}`
        );
    }
    console.log();
    
    // Native Balances Detail
    console.log("─".repeat(60));
    console.log("💎 NATIVE BALANCES");
    console.log("─".repeat(60));
    
    for (const balance of portfolio.nativeBalances) {
        if (balance.usdValue && balance.usdValue > 0.01) {
            console.log(
                `${balance.network.padEnd(12)} ${balance.formatted.padStart(18)} ${balance.symbol.padEnd(6)} ${formatUsd(balance.usdValue).padStart(12)}`
            );
        }
    }
    console.log();
    
    // Token Holdings Detail
    if (portfolio.tokenHoldings.length > 0) {
        console.log("─".repeat(60));
        console.log("🪙 TOKEN HOLDINGS");
        console.log("─".repeat(60));
        
        for (const holding of portfolio.tokenHoldings) {
            console.log(
                `${holding.symbol.padEnd(8)} ${holding.network.padEnd(10)} ${holding.formatted.padStart(15)} ${formatUsd(holding.usdValue || 0).padStart(12)}`
            );
        }
    }
    
    console.log();
    console.log("═".repeat(60));
}

// Main execution
const address = process.argv[2] || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
displayDashboard(address).catch(console.error);
```

### Run the Dashboard

```bash
# Use default address (vitalik.eth)
npx tsx dashboard.ts

# Or specify your own address
npx tsx dashboard.ts 0xYourWalletAddress
```

### Sample Output

```
════════════════════════════════════════════════════════════
           💼 PORTFOLIO DASHBOARD
════════════════════════════════════════════════════════════

Address: 0xd8dA6B...96045
Total Value: $15,892,345.67
Updated: 1/15/2025, 10:30:45 AM

────────────────────────────────────────────────────────────
📊 NETWORK DISTRIBUTION
────────────────────────────────────────────────────────────
ethereum     ████████████████████████████░░  94.23%   $14,976,123.45
arbitrum     ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░   3.45%      $548,234.12
polygon      █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   2.32%      $367,988.10

────────────────────────────────────────────────────────────
🏆 TOP HOLDINGS
────────────────────────────────────────────────────────────
ETH      ethereum    94.12%   $14,958,234.56
ETH      arbitrum     3.45%      $548,234.12
MATIC    polygon      2.31%      $367,988.10
USDC     ethereum     0.12%       $17,888.89
```

---

## Exercises

### Exercise 1: Add More Networks

Extend the dashboard to support Avalanche and Base networks.

<details>
<summary>Solution</summary>

Add to `types.ts`:
```typescript
{ id: "avalanche", name: "Avalanche", symbol: "AVAX", decimals: 18 },
{ id: "base", name: "Base", symbol: "ETH", decimals: 18 }
```
</details>

### Exercise 2: Historical Tracking

Store portfolio snapshots and show 24h changes.

<details>
<summary>Hint</summary>

Use a simple JSON file to store historical data:
```typescript
import { writeFileSync, readFileSync, existsSync } from "fs";

function saveSnapshot(portfolio: Portfolio): void {
    const history = loadHistory();
    history.push({
        timestamp: Date.now(),
        totalValue: portfolio.totalValueUsd
    });
    writeFileSync("portfolio-history.json", JSON.stringify(history));
}
```
</details>

### Exercise 3: NFT Support

Add NFT holdings to the portfolio display.

<details>
<summary>Hint</summary>

Use the `get_nfts_by_owner` tool:
```typescript
const nfts = await callTool("get_nfts_by_owner", {
    address,
    network: "ethereum"
});
```
</details>

---

## Next Steps

Congratulations! You've built a multi-chain portfolio dashboard. Next tutorials:

- **[Tutorial 3: Creating a DeFi Monitor](./03-creating-defi-monitor.md)** - Track DeFi positions
- **[Tutorial 4: Token Security Guide](./04-token-security-guide.md)** - Security analysis deep dive
- **[Tutorial 5: Multi-Agent System](./05-multi-agent-system.md)** - Build autonomous agents

---

## Full Source Code

See the complete implementation in: [examples/intermediate/portfolio-analyzer.ts](../intermediate/portfolio-analyzer.ts)
