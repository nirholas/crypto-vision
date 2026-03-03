# Tutorial 3: Creating a DeFi Monitor

Build a comprehensive DeFi monitoring system that tracks protocol health, yield opportunities, and your positions across multiple protocols.

**Difficulty:** ⭐⭐⭐ Advanced  
**Time:** 45 minutes  
**Prerequisites:** Completed Tutorial 2, Understanding of DeFi concepts

---

## Table of Contents

1. [Overview](#overview)
2. [DeFi Concepts](#defi-concepts)
3. [Project Architecture](#project-architecture)
4. [Protocol Health Monitoring](#protocol-health-monitoring)
5. [Yield Tracking](#yield-tracking)
6. [Position Management](#position-management)
7. [Alert System](#alert-system)
8. [Complete Implementation](#complete-implementation)

---

## Overview

This tutorial teaches you to build a DeFi monitor that:

- 📊 Tracks protocol TVL and health metrics
- 💰 Monitors yield opportunities across protocols
- 📈 Tracks your DeFi positions (lending, staking, LP)
- ⚠️ Alerts on significant changes
- 🔄 Auto-refreshes at configurable intervals

### What We'll Build

```
┌────────────────────────────────────────────────────┐
│              DeFi Monitor Dashboard                │
├─────────────┬─────────────┬────────────────────────┤
│  Protocol   │    Your     │       Yield           │
│   Health    │  Positions  │    Opportunities      │
├─────────────┼─────────────┼────────────────────────┤
│ Aave   ✓   │ USDC Lend   │ ETH/USDC LP  12.5%   │
│ Compound ✓  │ ETH Stake   │ stETH        4.2%    │
│ Uniswap ✓  │ DAI Lend    │ AAVE stake   8.1%    │
└─────────────┴─────────────┴────────────────────────┘
```

---

## DeFi Concepts

Before diving into code, let's review key concepts:

### Total Value Locked (TVL)

The total value of assets deposited in a protocol. Higher TVL generally indicates:
- More trust in the protocol
- Better liquidity
- Lower slippage for trades

### Annual Percentage Yield (APY)

The annualized return on deposits, including compound interest.

```
APY = (1 + periodic_rate)^periods - 1
```

### Impermanent Loss

Loss from providing liquidity to AMMs when token prices diverge.

### Health Factor

In lending protocols, the ratio of collateral to debt:
- Above 1.0: Safe
- Below 1.0: Liquidation risk

---

## Project Architecture

```
defi-monitor/
├── src/
│   ├── index.ts           # Main entry point
│   ├── types.ts           # Type definitions
│   ├── config.ts          # Configuration
│   ├── lib/
│   │   └── mcp.ts         # MCP client wrapper
│   ├── services/
│   │   ├── protocols.ts   # Protocol health tracking
│   │   ├── yields.ts      # Yield opportunity finder
│   │   └── positions.ts   # Position management
│   ├── alerts/
│   │   └── alerter.ts     # Alert system
│   └── display/
│       └── dashboard.ts   # Console dashboard
├── package.json
└── tsconfig.json
```

---

## Protocol Health Monitoring

### Define Protocol Types

```typescript
// types.ts
export interface Protocol {
    id: string;
    name: string;
    category: "lending" | "dex" | "yield" | "staking";
    networks: string[];
}

export interface ProtocolHealth {
    protocol: Protocol;
    tvl: number;
    tvlChange24h: number;
    volume24h?: number;
    fees24h?: number;
    status: "healthy" | "warning" | "critical";
    lastChecked: Date;
}

export const TRACKED_PROTOCOLS: Protocol[] = [
    { id: "aave-v3", name: "Aave V3", category: "lending", networks: ["ethereum", "arbitrum", "polygon"] },
    { id: "compound-v3", name: "Compound V3", category: "lending", networks: ["ethereum"] },
    { id: "uniswap-v3", name: "Uniswap V3", category: "dex", networks: ["ethereum", "arbitrum", "polygon"] },
    { id: "lido", name: "Lido", category: "staking", networks: ["ethereum"] },
    { id: "curve", name: "Curve", category: "dex", networks: ["ethereum", "arbitrum"] },
    { id: "pancakeswap", name: "PancakeSwap", category: "dex", networks: ["bsc"] }
];
```

### Fetch Protocol Data

```typescript
// services/protocols.ts
import { callTool } from "../lib/mcp.js";
import { Protocol, ProtocolHealth, TRACKED_PROTOCOLS } from "../types.js";

export async function getProtocolHealth(protocol: Protocol): Promise<ProtocolHealth> {
    try {
        // Get TVL data
        const tvlData = await callTool<{
            tvl: number;
            change24h: number;
        }>("defi_get_protocol_tvl", {
            protocol: protocol.id
        });

        // Determine health status based on TVL changes
        let status: "healthy" | "warning" | "critical" = "healthy";
        if (tvlData.change24h < -20) {
            status = "critical";
        } else if (tvlData.change24h < -10) {
            status = "warning";
        }

        return {
            protocol,
            tvl: tvlData.tvl,
            tvlChange24h: tvlData.change24h,
            status,
            lastChecked: new Date()
        };
    } catch (error) {
        return {
            protocol,
            tvl: 0,
            tvlChange24h: 0,
            status: "critical",
            lastChecked: new Date()
        };
    }
}

export async function getAllProtocolHealth(): Promise<ProtocolHealth[]> {
    const results = await Promise.all(
        TRACKED_PROTOCOLS.map(p => getProtocolHealth(p))
    );
    return results;
}

export function assessOverallHealth(protocols: ProtocolHealth[]): {
    healthy: number;
    warning: number;
    critical: number;
} {
    return {
        healthy: protocols.filter(p => p.status === "healthy").length,
        warning: protocols.filter(p => p.status === "warning").length,
        critical: protocols.filter(p => p.status === "critical").length
    };
}
```

---

## Yield Tracking

### Define Yield Types

```typescript
// types.ts (add these)
export interface YieldOpportunity {
    protocol: string;
    network: string;
    asset: string;
    apy: number;
    tvl: number;
    risk: "low" | "medium" | "high";
    type: "lending" | "staking" | "lp" | "vault";
}

export interface YieldComparison {
    asset: string;
    opportunities: YieldOpportunity[];
    bestApy: number;
    bestProtocol: string;
}
```

### Fetch Yield Data

```typescript
// services/yields.ts
import { callTool } from "../lib/mcp.js";
import { YieldOpportunity, YieldComparison } from "../types.js";

const STABLE_COINS = ["USDC", "USDT", "DAI"];
const MAJOR_ASSETS = ["ETH", "BTC", "BNB"];

export async function getYieldOpportunities(
    asset: string,
    network?: string
): Promise<YieldOpportunity[]> {
    try {
        const result = await callTool<{
            opportunities: Array<{
                protocol: string;
                network: string;
                apy: number;
                tvl: number;
                type: string;
            }>;
        }>("defi_get_yields", {
            asset,
            network,
            minTvl: 1000000 // Only pools with >$1M TVL
        });

        return result.opportunities.map(opp => ({
            protocol: opp.protocol,
            network: opp.network,
            asset,
            apy: opp.apy,
            tvl: opp.tvl,
            risk: assessRisk(opp.apy, opp.tvl, opp.type),
            type: opp.type as YieldOpportunity["type"]
        }));
    } catch {
        return [];
    }
}

function assessRisk(
    apy: number,
    tvl: number,
    type: string
): "low" | "medium" | "high" {
    // High APY usually means higher risk
    if (apy > 50) return "high";
    if (apy > 20) return "medium";
    
    // Low TVL means higher risk
    if (tvl < 10000000) return "medium";
    
    // LP positions have impermanent loss risk
    if (type === "lp") return "medium";
    
    return "low";
}

export async function compareYields(asset: string): Promise<YieldComparison> {
    const opportunities = await getYieldOpportunities(asset);
    
    // Sort by APY descending
    opportunities.sort((a, b) => b.apy - a.apy);
    
    return {
        asset,
        opportunities,
        bestApy: opportunities[0]?.apy || 0,
        bestProtocol: opportunities[0]?.protocol || "none"
    };
}

export async function getTopYields(limit = 10): Promise<YieldOpportunity[]> {
    const allAssets = [...STABLE_COINS, ...MAJOR_ASSETS];
    const allOpportunities: YieldOpportunity[] = [];
    
    for (const asset of allAssets) {
        const opps = await getYieldOpportunities(asset);
        allOpportunities.push(...opps);
    }
    
    // Sort by APY and return top yields
    return allOpportunities
        .sort((a, b) => b.apy - a.apy)
        .slice(0, limit);
}
```

---

## Position Management

### Define Position Types

```typescript
// types.ts (add these)
export interface DeFiPosition {
    protocol: string;
    network: string;
    type: "supply" | "borrow" | "stake" | "lp";
    asset: string;
    amount: string;
    amountUsd: number;
    apy: number;
    healthFactor?: number; // For lending positions
    rewards?: {
        token: string;
        amount: string;
        amountUsd: number;
    }[];
}

export interface PositionSummary {
    totalSupplied: number;
    totalBorrowed: number;
    totalStaked: number;
    totalLiquidity: number;
    netPosition: number;
    pendingRewards: number;
    avgApy: number;
}
```

### Fetch Positions

```typescript
// services/positions.ts
import { callTool } from "../lib/mcp.js";
import { DeFiPosition, PositionSummary } from "../types.js";

export async function getLendingPositions(
    address: string,
    network: string
): Promise<DeFiPosition[]> {
    const positions: DeFiPosition[] = [];
    
    // Check Aave
    try {
        const aavePositions = await callTool<{
            supplies: Array<{
                asset: string;
                amount: string;
                amountUsd: number;
                apy: number;
            }>;
            borrows: Array<{
                asset: string;
                amount: string;
                amountUsd: number;
                apy: number;
            }>;
            healthFactor: number;
        }>("defi_get_aave_positions", {
            address,
            network
        });
        
        for (const supply of aavePositions.supplies) {
            positions.push({
                protocol: "Aave V3",
                network,
                type: "supply",
                asset: supply.asset,
                amount: supply.amount,
                amountUsd: supply.amountUsd,
                apy: supply.apy,
                healthFactor: aavePositions.healthFactor
            });
        }
        
        for (const borrow of aavePositions.borrows) {
            positions.push({
                protocol: "Aave V3",
                network,
                type: "borrow",
                asset: borrow.asset,
                amount: borrow.amount,
                amountUsd: borrow.amountUsd,
                apy: -borrow.apy // Negative because you're paying
            });
        }
    } catch {
        // Protocol not available or no positions
    }
    
    return positions;
}

export async function getStakingPositions(
    address: string,
    network: string
): Promise<DeFiPosition[]> {
    const positions: DeFiPosition[] = [];
    
    // Check Lido stETH
    if (network === "ethereum") {
        try {
            const stethBalance = await callTool<{
                balance: string;
                formatted: string;
                usdValue: number;
            }>("get_erc20_balance", {
                address,
                tokenAddress: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", // stETH
                network: "ethereum"
            });
            
            if (parseFloat(stethBalance.formatted) > 0) {
                positions.push({
                    protocol: "Lido",
                    network: "ethereum",
                    type: "stake",
                    asset: "stETH",
                    amount: stethBalance.formatted,
                    amountUsd: stethBalance.usdValue,
                    apy: 4.0 // Approximate Lido APY
                });
            }
        } catch {
            // No stETH position
        }
    }
    
    return positions;
}

export async function getAllPositions(
    address: string
): Promise<DeFiPosition[]> {
    const networks = ["ethereum", "arbitrum", "polygon", "bsc"];
    const allPositions: DeFiPosition[] = [];
    
    for (const network of networks) {
        const [lending, staking] = await Promise.all([
            getLendingPositions(address, network),
            getStakingPositions(address, network)
        ]);
        
        allPositions.push(...lending, ...staking);
    }
    
    return allPositions;
}

export function calculateSummary(positions: DeFiPosition[]): PositionSummary {
    let totalSupplied = 0;
    let totalBorrowed = 0;
    let totalStaked = 0;
    let totalLiquidity = 0;
    let pendingRewards = 0;
    let weightedApy = 0;
    let totalValue = 0;
    
    for (const pos of positions) {
        switch (pos.type) {
            case "supply":
                totalSupplied += pos.amountUsd;
                break;
            case "borrow":
                totalBorrowed += pos.amountUsd;
                break;
            case "stake":
                totalStaked += pos.amountUsd;
                break;
            case "lp":
                totalLiquidity += pos.amountUsd;
                break;
        }
        
        if (pos.rewards) {
            pendingRewards += pos.rewards.reduce((sum, r) => sum + r.amountUsd, 0);
        }
        
        if (pos.type !== "borrow") {
            weightedApy += pos.apy * pos.amountUsd;
            totalValue += pos.amountUsd;
        }
    }
    
    return {
        totalSupplied,
        totalBorrowed,
        totalStaked,
        totalLiquidity,
        netPosition: totalSupplied + totalStaked + totalLiquidity - totalBorrowed,
        pendingRewards,
        avgApy: totalValue > 0 ? weightedApy / totalValue : 0
    };
}
```

---

## Alert System

### Define Alert Types

```typescript
// alerts/types.ts
export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
    id: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    protocol?: string;
    network?: string;
    timestamp: Date;
    acknowledged: boolean;
}

export interface AlertRule {
    id: string;
    name: string;
    condition: (data: any) => boolean;
    severity: AlertSeverity;
    message: (data: any) => string;
}
```

### Implement Alert System

```typescript
// alerts/alerter.ts
import { Alert, AlertRule, AlertSeverity } from "./types.js";
import { ProtocolHealth } from "../types.js";

class AlertSystem {
    private alerts: Alert[] = [];
    private rules: AlertRule[] = [];
    private callbacks: ((alert: Alert) => void)[] = [];
    
    constructor() {
        this.setupDefaultRules();
    }
    
    private setupDefaultRules(): void {
        // TVL drop alert
        this.addRule({
            id: "tvl-drop",
            name: "TVL Significant Drop",
            condition: (health: ProtocolHealth) => health.tvlChange24h < -15,
            severity: "warning",
            message: (health: ProtocolHealth) => 
                `${health.protocol.name} TVL dropped ${Math.abs(health.tvlChange24h).toFixed(1)}% in 24h`
        });
        
        // Critical TVL drop
        this.addRule({
            id: "tvl-critical",
            name: "TVL Critical Drop",
            condition: (health: ProtocolHealth) => health.tvlChange24h < -30,
            severity: "critical",
            message: (health: ProtocolHealth) =>
                `⚠️ CRITICAL: ${health.protocol.name} TVL dropped ${Math.abs(health.tvlChange24h).toFixed(1)}%!`
        });
        
        // Health factor alert (for lending)
        this.addRule({
            id: "health-factor-low",
            name: "Low Health Factor",
            condition: (position: any) => 
                position.healthFactor && position.healthFactor < 1.5,
            severity: "warning",
            message: (position: any) =>
                `Health factor for ${position.protocol} is ${position.healthFactor.toFixed(2)} - consider adding collateral`
        });
        
        // Critical health factor
        this.addRule({
            id: "health-factor-critical",
            name: "Critical Health Factor",
            condition: (position: any) =>
                position.healthFactor && position.healthFactor < 1.2,
            severity: "critical",
            message: (position: any) =>
                `⚠️ LIQUIDATION RISK: Health factor is ${position.healthFactor.toFixed(2)}!`
        });
    }
    
    addRule(rule: AlertRule): void {
        this.rules.push(rule);
    }
    
    onAlert(callback: (alert: Alert) => void): void {
        this.callbacks.push(callback);
    }
    
    check(data: any): Alert[] {
        const newAlerts: Alert[] = [];
        
        for (const rule of this.rules) {
            if (rule.condition(data)) {
                const alert: Alert = {
                    id: `${rule.id}-${Date.now()}`,
                    severity: rule.severity,
                    title: rule.name,
                    message: rule.message(data),
                    timestamp: new Date(),
                    acknowledged: false
                };
                
                newAlerts.push(alert);
                this.alerts.push(alert);
                
                // Notify callbacks
                for (const callback of this.callbacks) {
                    callback(alert);
                }
            }
        }
        
        return newAlerts;
    }
    
    getActiveAlerts(): Alert[] {
        return this.alerts.filter(a => !a.acknowledged);
    }
    
    acknowledgeAlert(id: string): void {
        const alert = this.alerts.find(a => a.id === id);
        if (alert) {
            alert.acknowledged = true;
        }
    }
    
    clearOldAlerts(maxAgeMs = 3600000): void {
        const cutoff = Date.now() - maxAgeMs;
        this.alerts = this.alerts.filter(
            a => a.timestamp.getTime() > cutoff || !a.acknowledged
        );
    }
}

export const alertSystem = new AlertSystem();
```

---

## Complete Implementation

### Main Dashboard

```typescript
// display/dashboard.ts
import { getAllProtocolHealth, assessOverallHealth } from "../services/protocols.js";
import { getTopYields } from "../services/yields.js";
import { getAllPositions, calculateSummary } from "../services/positions.js";
import { alertSystem } from "../alerts/alerter.js";
import { ProtocolHealth, YieldOpportunity, DeFiPosition } from "../types.js";

function formatUsd(value: number): string {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
}

function formatChange(change: number): string {
    const sign = change >= 0 ? "+" : "";
    const color = change >= 0 ? "\x1b[32m" : "\x1b[31m";
    return `${color}${sign}${change.toFixed(2)}%\x1b[0m`;
}

function getStatusIcon(status: string): string {
    switch (status) {
        case "healthy": return "✅";
        case "warning": return "⚠️";
        case "critical": return "🚨";
        default: return "❓";
    }
}

function getRiskIcon(risk: string): string {
    switch (risk) {
        case "low": return "🟢";
        case "medium": return "🟡";
        case "high": return "🔴";
        default: return "⚪";
    }
}

export async function displayDashboard(address?: string): Promise<void> {
    console.clear();
    console.log("═".repeat(70));
    console.log("                    📊 DeFi MONITOR DASHBOARD");
    console.log("═".repeat(70));
    console.log();
    
    // Fetch all data
    console.log("Fetching protocol health...");
    const protocols = await getAllProtocolHealth();
    
    console.log("Fetching yield opportunities...");
    const yields = await getTopYields(5);
    
    let positions: DeFiPosition[] = [];
    if (address) {
        console.log("Fetching your positions...");
        positions = await getAllPositions(address);
    }
    
    console.clear();
    console.log("═".repeat(70));
    console.log("                    📊 DeFi MONITOR DASHBOARD");
    console.log("═".repeat(70));
    console.log(`Updated: ${new Date().toLocaleString()}`);
    console.log();
    
    // Check for alerts
    for (const protocol of protocols) {
        alertSystem.check(protocol);
    }
    for (const position of positions) {
        alertSystem.check(position);
    }
    
    // Display active alerts
    const activeAlerts = alertSystem.getActiveAlerts();
    if (activeAlerts.length > 0) {
        console.log("─".repeat(70));
        console.log("🔔 ACTIVE ALERTS");
        console.log("─".repeat(70));
        for (const alert of activeAlerts.slice(0, 5)) {
            const icon = alert.severity === "critical" ? "🚨" : "⚠️";
            console.log(`${icon} ${alert.message}`);
        }
        console.log();
    }
    
    // Protocol Health Section
    console.log("─".repeat(70));
    console.log("🏛️ PROTOCOL HEALTH");
    console.log("─".repeat(70));
    
    const health = assessOverallHealth(protocols);
    console.log(`Status: ${health.healthy} ✅ | ${health.warning} ⚠️ | ${health.critical} 🚨`);
    console.log();
    
    console.log("Protocol".padEnd(15) + "TVL".padStart(12) + "24h".padStart(10) + "Status".padStart(10));
    console.log("-".repeat(47));
    
    for (const p of protocols) {
        console.log(
            p.protocol.name.padEnd(15) +
            formatUsd(p.tvl).padStart(12) +
            formatChange(p.tvlChange24h).padStart(18) +
            getStatusIcon(p.status).padStart(5)
        );
    }
    console.log();
    
    // Top Yields Section
    console.log("─".repeat(70));
    console.log("💰 TOP YIELD OPPORTUNITIES");
    console.log("─".repeat(70));
    
    console.log("Protocol".padEnd(15) + "Asset".padEnd(8) + "APY".padStart(10) + "TVL".padStart(12) + "Risk".padStart(8));
    console.log("-".repeat(53));
    
    for (const y of yields) {
        console.log(
            y.protocol.padEnd(15) +
            y.asset.padEnd(8) +
            `${y.apy.toFixed(2)}%`.padStart(10) +
            formatUsd(y.tvl).padStart(12) +
            getRiskIcon(y.risk).padStart(5)
        );
    }
    console.log();
    
    // Your Positions Section
    if (address && positions.length > 0) {
        console.log("─".repeat(70));
        console.log("👤 YOUR POSITIONS");
        console.log("─".repeat(70));
        
        const summary = calculateSummary(positions);
        console.log(`Net Position: ${formatUsd(summary.netPosition)} | Avg APY: ${summary.avgApy.toFixed(2)}%`);
        console.log(`Supplied: ${formatUsd(summary.totalSupplied)} | Borrowed: ${formatUsd(summary.totalBorrowed)}`);
        console.log();
        
        console.log("Protocol".padEnd(12) + "Type".padEnd(8) + "Asset".padEnd(8) + "Value".padStart(12) + "APY".padStart(8));
        console.log("-".repeat(48));
        
        for (const pos of positions) {
            console.log(
                pos.protocol.slice(0, 11).padEnd(12) +
                pos.type.padEnd(8) +
                pos.asset.padEnd(8) +
                formatUsd(pos.amountUsd).padStart(12) +
                `${pos.apy.toFixed(2)}%`.padStart(8)
            );
        }
        
        if (summary.pendingRewards > 0) {
            console.log();
            console.log(`🎁 Pending Rewards: ${formatUsd(summary.pendingRewards)}`);
        }
    }
    
    console.log();
    console.log("═".repeat(70));
}
```

### Main Entry Point

```typescript
// index.ts
import { displayDashboard } from "./display/dashboard.js";
import { alertSystem } from "./alerts/alerter.js";

const REFRESH_INTERVAL = 60000; // 1 minute
const address = process.argv[2]; // Optional wallet address

// Setup alert notifications
alertSystem.onAlert((alert) => {
    if (alert.severity === "critical") {
        // In a real app, send push notification, email, etc.
        console.log("\x07"); // Terminal bell
        console.log(`\n🚨 CRITICAL ALERT: ${alert.message}\n`);
    }
});

async function main(): Promise<void> {
    console.log("Starting DeFi Monitor...");
    
    if (address) {
        console.log(`Tracking wallet: ${address}`);
    }
    
    // Initial display
    await displayDashboard(address);
    
    // Auto-refresh
    setInterval(async () => {
        try {
            await displayDashboard(address);
        } catch (error) {
            console.error("Refresh failed:", error);
        }
    }, REFRESH_INTERVAL);
    
    // Keep process running
    console.log("\nPress Ctrl+C to exit");
    console.log(`Auto-refresh every ${REFRESH_INTERVAL / 1000} seconds`);
}

main().catch(console.error);
```

### Run the Monitor

```bash
# Monitor protocols only
npx tsx src/index.ts

# Monitor with your positions
npx tsx src/index.ts 0xYourWalletAddress
```

---

## Exercises

### Exercise 1: Add Email Alerts

Implement email notifications for critical alerts.

<details>
<summary>Hint</summary>

Use nodemailer:
```typescript
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS }
});

alertSystem.onAlert(async (alert) => {
    if (alert.severity === "critical") {
        await transporter.sendMail({
            to: "you@email.com",
            subject: `DeFi Alert: ${alert.title}`,
            text: alert.message
        });
    }
});
```
</details>

### Exercise 2: Historical Charts

Track and display TVL changes over time.

### Exercise 3: Liquidation Simulator

Calculate how much price movement would trigger liquidation.

---

## Next Steps

- **[Tutorial 4: Token Security Guide](./04-token-security-guide.md)** - Deep dive into security analysis
- **[Tutorial 5: Multi-Agent System](./05-multi-agent-system.md)** - Build autonomous agents

---

## Full Source Code

See the complete implementation in: [examples/advanced/autonomous-agent.ts](../advanced/autonomous-agent.ts)
