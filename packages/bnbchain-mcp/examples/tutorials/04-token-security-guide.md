# Tutorial 4: Token Security Guide

Learn how to perform comprehensive security analysis on tokens to identify scams, honeypots, and rug pulls before investing.

**Difficulty:** ⭐⭐ Intermediate  
**Time:** 30 minutes  
**Prerequisites:** Basic understanding of smart contracts and DeFi risks

---

## Table of Contents

1. [Why Security Analysis Matters](#why-security-analysis-matters)
2. [Common Token Scams](#common-token-scams)
3. [Security Check Categories](#security-check-categories)
4. [Using Security Tools](#using-security-tools)
5. [Building a Security Scanner](#building-a-security-scanner)
6. [Interpreting Results](#interpreting-results)
7. [Red Flags Checklist](#red-flags-checklist)
8. [Best Practices](#best-practices)

---

## Why Security Analysis Matters

The crypto space is filled with scams and malicious tokens. In 2024 alone:

- 💸 **$1.8 billion** lost to rug pulls
- 🍯 **200,000+** honeypot tokens deployed
- ⚠️ **60%** of new tokens have at least one security risk

Security analysis helps you:
- Identify honeypots before buying
- Detect potential rug pulls
- Understand token mechanics
- Make informed investment decisions

---

## Common Token Scams

### 1. Honeypot Tokens 🍯

**What it is:** A token you can buy but cannot sell.

**How it works:**
```solidity
// Malicious sell function
function transfer(address to, uint256 amount) public returns (bool) {
    require(msg.sender == owner, "Only owner can transfer");
    // Regular users can't sell!
    return super.transfer(to, amount);
}
```

**Detection:** Simulate a sell transaction before buying.

### 2. Rug Pulls 🚨

**What it is:** Developer drains liquidity or mints tokens to dump.

**Types:**
- **Liquidity Pull:** Remove all liquidity from the pool
- **Mint Function:** Create unlimited tokens and sell
- **Backdoor Function:** Hidden function to drain funds

### 3. Tax Tokens 💸

**What it is:** Excessive buy/sell taxes (sometimes 90%+).

**Warning signs:**
- High or modifiable tax rates
- Different buy vs sell taxes
- Tax goes to developer wallet

### 4. Ownership Risks 👤

**What it is:** Owner retains dangerous privileges.

**Risks:**
- Can pause/disable trading
- Can blacklist addresses
- Can modify contract parameters

---

## Security Check Categories

### Contract Security
| Check | Risk Level | Description |
|-------|------------|-------------|
| Verified Source | Medium | Unverified = can't audit |
| Proxy Contract | Medium | Can be upgraded maliciously |
| Mint Function | High | Owner can create tokens |
| Self-Destruct | Critical | Contract can be destroyed |

### Trading Security
| Check | Risk Level | Description |
|-------|------------|-------------|
| Honeypot | Critical | Cannot sell tokens |
| High Tax | High | Excessive fees on trades |
| Trading Paused | High | Trading can be disabled |
| Anti-Whale | Low | Limits large transactions |

### Ownership Security
| Check | Risk Level | Description |
|-------|------------|-------------|
| Owner Privileges | Medium | What owner can do |
| Renounced | Low | Ownership given up |
| Multisig | Low | Multiple signatures needed |
| Timelock | Low | Delays on admin actions |

### Liquidity Security
| Check | Risk Level | Description |
|-------|------------|-------------|
| LP Locked | High | Liquidity can be pulled |
| LP Amount | Medium | Low liquidity = high slippage |
| LP Holders | Medium | Concentrated = risky |

---

## Using Security Tools

### Basic Security Check

Ask Claude:
```
Is this token safe? 0x1234...abcd on BSC
```

Or programmatically:

```typescript
import { callTool } from "./lib/mcp.js";

interface SecurityResult {
    score: number;
    isHoneypot: boolean;
    flags: {
        canMint: boolean;
        canPause: boolean;
        canBlacklist: boolean;
        hasProxy: boolean;
        ownershipRenounced: boolean;
    };
    tax: {
        buy: number;
        sell: number;
    };
    liquidity: {
        amount: number;
        locked: boolean;
        lockExpiry?: string;
    };
    risks: Array<{
        severity: "critical" | "high" | "medium" | "low";
        type: string;
        message: string;
    }>;
}

async function checkTokenSecurity(
    tokenAddress: string,
    network: string
): Promise<SecurityResult> {
    const result = await callTool<SecurityResult>("security_check_token", {
        tokenAddress,
        network
    });
    
    return result;
}
```

### Honeypot Detection

```typescript
async function checkHoneypot(
    tokenAddress: string,
    network: string
): Promise<{
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    transferTax: number;
    reason?: string;
}> {
    return await callTool("security_honeypot_check", {
        tokenAddress,
        network
    });
}
```

### Contract Analysis

```typescript
async function analyzeContract(
    tokenAddress: string,
    network: string
): Promise<{
    sourceVerified: boolean;
    contractType: string;
    compiler: string;
    functions: string[];
    dangerousFunctions: string[];
    modifiers: string[];
}> {
    return await callTool("security_analyze_contract", {
        tokenAddress,
        network
    });
}
```

---

## Building a Security Scanner

### Complete Scanner Implementation

```typescript
// security-scanner.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Types
interface SecurityReport {
    token: {
        address: string;
        name: string;
        symbol: string;
        network: string;
    };
    score: number;
    verdict: "SAFE" | "CAUTION" | "DANGEROUS" | "SCAM";
    honeypot: HoneypotResult;
    ownership: OwnershipResult;
    trading: TradingResult;
    liquidity: LiquidityResult;
    risks: Risk[];
    recommendations: string[];
}

interface HoneypotResult {
    isHoneypot: boolean;
    simulationSuccess: boolean;
    buyTax: number;
    sellTax: number;
    reason?: string;
}

interface OwnershipResult {
    owner: string;
    isRenounced: boolean;
    canMint: boolean;
    canPause: boolean;
    canBlacklist: boolean;
    canModifyTax: boolean;
}

interface TradingResult {
    isEnabled: boolean;
    maxTxAmount?: string;
    maxWalletAmount?: string;
    cooldownEnabled: boolean;
}

interface LiquidityResult {
    totalUsd: number;
    isLocked: boolean;
    lockExpiry?: Date;
    lpHolders: number;
    topLpHolderPercent: number;
}

interface Risk {
    severity: "critical" | "high" | "medium" | "low";
    category: string;
    title: string;
    description: string;
}

// MCP Client
let client: Client | null = null;

async function getClient(): Promise<Client> {
    if (client) return client;
    
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@nirholas/universal-crypto-mcp@latest"]
    });
    
    client = new Client({
        name: "security-scanner",
        version: "1.0.0"
    }, { capabilities: {} });
    
    await client.connect(transport);
    return client;
}

async function callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const mcp = await getClient();
    const result = await mcp.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text?: string }>;
    if (content?.[0]?.type === "text" && content[0].text) {
        return JSON.parse(content[0].text);
    }
    throw new Error("Invalid response");
}

// Security Scanner Class
class TokenSecurityScanner {
    
    async scan(tokenAddress: string, network: string): Promise<SecurityReport> {
        console.log(`\n🔍 Scanning token: ${tokenAddress}`);
        console.log(`   Network: ${network}\n`);
        
        // Get basic token info
        const tokenInfo = await this.getTokenInfo(tokenAddress, network);
        console.log(`   Token: ${tokenInfo.name} (${tokenInfo.symbol})`);
        
        // Run all checks in parallel
        const [honeypot, ownership, trading, liquidity] = await Promise.all([
            this.checkHoneypot(tokenAddress, network),
            this.checkOwnership(tokenAddress, network),
            this.checkTrading(tokenAddress, network),
            this.checkLiquidity(tokenAddress, network)
        ]);
        
        // Compile risks
        const risks = this.compileRisks(honeypot, ownership, trading, liquidity);
        
        // Calculate score
        const score = this.calculateScore(risks);
        
        // Determine verdict
        const verdict = this.determineVerdict(score, honeypot.isHoneypot);
        
        // Generate recommendations
        const recommendations = this.generateRecommendations(risks, verdict);
        
        return {
            token: {
                address: tokenAddress,
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                network
            },
            score,
            verdict,
            honeypot,
            ownership,
            trading,
            liquidity,
            risks,
            recommendations
        };
    }
    
    private async getTokenInfo(address: string, network: string): Promise<{
        name: string;
        symbol: string;
        decimals: number;
    }> {
        try {
            return await callTool("get_erc20_token_info", {
                tokenAddress: address,
                network
            });
        } catch {
            return { name: "Unknown", symbol: "???", decimals: 18 };
        }
    }
    
    private async checkHoneypot(address: string, network: string): Promise<HoneypotResult> {
        try {
            const result = await callTool<{
                isHoneypot: boolean;
                simulationSuccess: boolean;
                buyTax: number;
                sellTax: number;
                reason?: string;
            }>("security_honeypot_check", {
                tokenAddress: address,
                network
            });
            return result;
        } catch {
            return {
                isHoneypot: false,
                simulationSuccess: false,
                buyTax: 0,
                sellTax: 0,
                reason: "Could not simulate"
            };
        }
    }
    
    private async checkOwnership(address: string, network: string): Promise<OwnershipResult> {
        try {
            const result = await callTool<{
                owner: string;
                functions: string[];
            }>("security_analyze_contract", {
                tokenAddress: address,
                network
            });
            
            const isRenounced = result.owner === "0x0000000000000000000000000000000000000000";
            const functions = result.functions.map(f => f.toLowerCase());
            
            return {
                owner: result.owner,
                isRenounced,
                canMint: functions.some(f => f.includes("mint")),
                canPause: functions.some(f => f.includes("pause")),
                canBlacklist: functions.some(f => 
                    f.includes("blacklist") || f.includes("exclude") || f.includes("ban")
                ),
                canModifyTax: functions.some(f => 
                    f.includes("settax") || f.includes("setfee")
                )
            };
        } catch {
            return {
                owner: "unknown",
                isRenounced: false,
                canMint: false,
                canPause: false,
                canBlacklist: false,
                canModifyTax: false
            };
        }
    }
    
    private async checkTrading(address: string, network: string): Promise<TradingResult> {
        // This would typically come from contract analysis
        return {
            isEnabled: true,
            cooldownEnabled: false
        };
    }
    
    private async checkLiquidity(address: string, network: string): Promise<LiquidityResult> {
        try {
            const result = await callTool<{
                totalLiquidityUsd: number;
                isLocked: boolean;
                lockExpiry?: string;
                lpHolders: number;
                topHolderPercent: number;
            }>("security_check_liquidity", {
                tokenAddress: address,
                network
            });
            
            return {
                totalUsd: result.totalLiquidityUsd,
                isLocked: result.isLocked,
                lockExpiry: result.lockExpiry ? new Date(result.lockExpiry) : undefined,
                lpHolders: result.lpHolders,
                topLpHolderPercent: result.topHolderPercent
            };
        } catch {
            return {
                totalUsd: 0,
                isLocked: false,
                lpHolders: 0,
                topLpHolderPercent: 100
            };
        }
    }
    
    private compileRisks(
        honeypot: HoneypotResult,
        ownership: OwnershipResult,
        trading: TradingResult,
        liquidity: LiquidityResult
    ): Risk[] {
        const risks: Risk[] = [];
        
        // Honeypot risks
        if (honeypot.isHoneypot) {
            risks.push({
                severity: "critical",
                category: "Honeypot",
                title: "Token is a honeypot",
                description: honeypot.reason || "Sell transactions will fail"
            });
        }
        
        // Tax risks
        if (honeypot.buyTax > 10) {
            risks.push({
                severity: honeypot.buyTax > 25 ? "high" : "medium",
                category: "Tax",
                title: `High buy tax (${honeypot.buyTax}%)`,
                description: "Significant portion of your purchase goes to fees"
            });
        }
        
        if (honeypot.sellTax > 10) {
            risks.push({
                severity: honeypot.sellTax > 25 ? "high" : "medium",
                category: "Tax",
                title: `High sell tax (${honeypot.sellTax}%)`,
                description: "Significant portion of your sale goes to fees"
            });
        }
        
        // Ownership risks
        if (ownership.canMint && !ownership.isRenounced) {
            risks.push({
                severity: "high",
                category: "Ownership",
                title: "Owner can mint tokens",
                description: "Owner could create unlimited tokens and dump"
            });
        }
        
        if (ownership.canPause && !ownership.isRenounced) {
            risks.push({
                severity: "medium",
                category: "Ownership",
                title: "Trading can be paused",
                description: "Owner could disable trading at any time"
            });
        }
        
        if (ownership.canBlacklist && !ownership.isRenounced) {
            risks.push({
                severity: "medium",
                category: "Ownership",
                title: "Addresses can be blacklisted",
                description: "Owner could prevent specific addresses from trading"
            });
        }
        
        if (ownership.canModifyTax && !ownership.isRenounced) {
            risks.push({
                severity: "medium",
                category: "Ownership",
                title: "Tax can be modified",
                description: "Owner could increase taxes after you buy"
            });
        }
        
        // Liquidity risks
        if (liquidity.totalUsd < 10000) {
            risks.push({
                severity: "high",
                category: "Liquidity",
                title: "Very low liquidity",
                description: `Only $${liquidity.totalUsd.toLocaleString()} in liquidity`
            });
        } else if (liquidity.totalUsd < 50000) {
            risks.push({
                severity: "medium",
                category: "Liquidity",
                title: "Low liquidity",
                description: `Only $${liquidity.totalUsd.toLocaleString()} in liquidity`
            });
        }
        
        if (!liquidity.isLocked) {
            risks.push({
                severity: "high",
                category: "Liquidity",
                title: "Liquidity not locked",
                description: "LP tokens can be removed at any time (rug pull risk)"
            });
        }
        
        if (liquidity.topLpHolderPercent > 80) {
            risks.push({
                severity: "medium",
                category: "Liquidity",
                title: "Concentrated LP ownership",
                description: `Top holder owns ${liquidity.topLpHolderPercent}% of liquidity`
            });
        }
        
        return risks;
    }
    
    private calculateScore(risks: Risk[]): number {
        let score = 100;
        
        for (const risk of risks) {
            switch (risk.severity) {
                case "critical":
                    score -= 40;
                    break;
                case "high":
                    score -= 20;
                    break;
                case "medium":
                    score -= 10;
                    break;
                case "low":
                    score -= 5;
                    break;
            }
        }
        
        return Math.max(0, score);
    }
    
    private determineVerdict(
        score: number,
        isHoneypot: boolean
    ): "SAFE" | "CAUTION" | "DANGEROUS" | "SCAM" {
        if (isHoneypot) return "SCAM";
        if (score >= 80) return "SAFE";
        if (score >= 50) return "CAUTION";
        if (score >= 20) return "DANGEROUS";
        return "SCAM";
    }
    
    private generateRecommendations(risks: Risk[], verdict: string): string[] {
        const recommendations: string[] = [];
        
        if (verdict === "SCAM" || verdict === "DANGEROUS") {
            recommendations.push("⛔ DO NOT invest in this token");
            recommendations.push("🚫 High likelihood of losing your entire investment");
        }
        
        if (risks.some(r => r.category === "Liquidity" && r.title.includes("not locked"))) {
            recommendations.push("💧 Wait for liquidity to be locked before investing");
        }
        
        if (risks.some(r => r.category === "Tax")) {
            recommendations.push("💸 Factor in taxes when calculating potential profits");
        }
        
        if (risks.some(r => r.category === "Ownership" && !r.title.includes("renounced"))) {
            recommendations.push("👤 Research the team and their previous projects");
        }
        
        if (verdict === "CAUTION") {
            recommendations.push("⚠️ Only invest what you can afford to lose");
            recommendations.push("📊 Monitor for changes in contract or liquidity");
        }
        
        if (verdict === "SAFE") {
            recommendations.push("✅ Token appears relatively safe");
            recommendations.push("📈 Still DYOR and monitor your investment");
        }
        
        return recommendations;
    }
}

// Display Functions
function displayReport(report: SecurityReport): void {
    console.log("\n" + "═".repeat(60));
    console.log("           🛡️ TOKEN SECURITY REPORT");
    console.log("═".repeat(60));
    console.log();
    
    // Token Info
    console.log(`Token: ${report.token.name} (${report.token.symbol})`);
    console.log(`Address: ${report.token.address}`);
    console.log(`Network: ${report.token.network}`);
    console.log();
    
    // Score and Verdict
    const verdictColors: Record<string, string> = {
        SAFE: "\x1b[32m",      // Green
        CAUTION: "\x1b[33m",   // Yellow
        DANGEROUS: "\x1b[31m", // Red
        SCAM: "\x1b[41m\x1b[37m" // Red background
    };
    const color = verdictColors[report.verdict] || "";
    const reset = "\x1b[0m";
    
    console.log(`Security Score: ${report.score}/100`);
    console.log(`Verdict: ${color}${report.verdict}${reset}`);
    console.log();
    
    // Honeypot Status
    console.log("─".repeat(60));
    console.log("🍯 HONEYPOT CHECK");
    console.log("─".repeat(60));
    console.log(`Is Honeypot: ${report.honeypot.isHoneypot ? "⚠️ YES" : "✅ No"}`);
    console.log(`Buy Tax: ${report.honeypot.buyTax}%`);
    console.log(`Sell Tax: ${report.honeypot.sellTax}%`);
    console.log();
    
    // Ownership
    console.log("─".repeat(60));
    console.log("👤 OWNERSHIP");
    console.log("─".repeat(60));
    console.log(`Owner: ${report.ownership.owner.slice(0, 10)}...`);
    console.log(`Renounced: ${report.ownership.isRenounced ? "✅ Yes" : "⚠️ No"}`);
    console.log(`Can Mint: ${report.ownership.canMint ? "⚠️ Yes" : "✅ No"}`);
    console.log(`Can Pause: ${report.ownership.canPause ? "⚠️ Yes" : "✅ No"}`);
    console.log(`Can Blacklist: ${report.ownership.canBlacklist ? "⚠️ Yes" : "✅ No"}`);
    console.log();
    
    // Liquidity
    console.log("─".repeat(60));
    console.log("💧 LIQUIDITY");
    console.log("─".repeat(60));
    console.log(`Total: $${report.liquidity.totalUsd.toLocaleString()}`);
    console.log(`Locked: ${report.liquidity.isLocked ? "✅ Yes" : "⚠️ No"}`);
    if (report.liquidity.lockExpiry) {
        console.log(`Lock Expires: ${report.liquidity.lockExpiry.toLocaleDateString()}`);
    }
    console.log();
    
    // Risks
    if (report.risks.length > 0) {
        console.log("─".repeat(60));
        console.log("⚠️ RISKS IDENTIFIED");
        console.log("─".repeat(60));
        
        for (const risk of report.risks) {
            const icons: Record<string, string> = {
                critical: "🚨",
                high: "🔴",
                medium: "🟡",
                low: "🟢"
            };
            console.log(`${icons[risk.severity]} [${risk.severity.toUpperCase()}] ${risk.title}`);
            console.log(`   ${risk.description}`);
        }
        console.log();
    }
    
    // Recommendations
    console.log("─".repeat(60));
    console.log("💡 RECOMMENDATIONS");
    console.log("─".repeat(60));
    for (const rec of report.recommendations) {
        console.log(rec);
    }
    
    console.log();
    console.log("═".repeat(60));
}

// Main
async function main(): Promise<void> {
    const tokenAddress = process.argv[2];
    const network = process.argv[3] || "ethereum";
    
    if (!tokenAddress) {
        console.log("Usage: npx tsx security-scanner.ts <token-address> [network]");
        console.log("\nExample:");
        console.log("  npx tsx security-scanner.ts 0x1234...abcd bsc");
        process.exit(1);
    }
    
    const scanner = new TokenSecurityScanner();
    const report = await scanner.scan(tokenAddress, network);
    displayReport(report);
}

main().catch(console.error);
```

---

## Interpreting Results

### Score Breakdown

| Score | Verdict | Action |
|-------|---------|--------|
| 80-100 | SAFE | Consider investing (with caution) |
| 50-79 | CAUTION | High risk, small position only |
| 20-49 | DANGEROUS | Very high risk, likely to lose funds |
| 0-19 | SCAM | Do not invest |

### Understanding Tax

```
Buy Tax 5% + Sell Tax 5% = 10% round trip
$1000 investment → Buy: $950 received → Sell: $902.50 back

You need 10.8% gain just to break even!
```

### Liquidity Analysis

- **<$10K**: Extreme slippage, easy to manipulate
- **$10K-50K**: High risk, can be drained easily
- **$50K-500K**: Moderate liquidity, still risky
- **>$500K**: Better liquidity, harder to manipulate

---

## Red Flags Checklist

Use this checklist before investing:

### 🚨 Critical (Don't Invest)
- [ ] Is a honeypot
- [ ] Sell tax >50%
- [ ] Owner can mint unlimited tokens
- [ ] Liquidity <$10K
- [ ] Contract not verified

### ⚠️ High Risk
- [ ] Sell tax >20%
- [ ] Liquidity not locked
- [ ] Owner can pause trading
- [ ] Contract just deployed (<24h)
- [ ] Top holder owns >50% of supply

### 🟡 Caution
- [ ] Sell tax >10%
- [ ] Owner not renounced
- [ ] Liquidity lock <6 months
- [ ] No audit
- [ ] Anonymous team

---

## Best Practices

### Before Buying

1. **Always scan first** - Use security tools before every purchase
2. **Check multiple sources** - Use 2-3 different scanners
3. **Verify contract** - Is source code verified on explorer?
4. **Check social proof** - Active community? Real engagement?
5. **Small test first** - Buy small amount, try to sell

### During Holding

1. **Monitor changes** - Set up alerts for contract modifications
2. **Watch liquidity** - Is it decreasing?
3. **Track ownership** - Did owner change wallet?
4. **Community sentiment** - Are others having issues?

### Red Flag Response

If you detect issues after buying:
1. **Don't panic sell** - You might trigger a honeypot
2. **Check recent transactions** - Can others sell?
3. **Use aggregators** - Sometimes specific DEXs work
4. **Document everything** - For potential recovery

---

## Next Steps

- **[Tutorial 5: Multi-Agent System](./05-multi-agent-system.md)** - Build autonomous agents

---

## Full Source Code

See the complete implementation in: [examples/basic/security-scanner.ts](../basic/security-scanner.ts)
