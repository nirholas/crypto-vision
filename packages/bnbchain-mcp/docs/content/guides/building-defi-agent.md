# Building a DeFi Agent

A comprehensive guide to building an AI-powered DeFi agent using BNB-Chain-MCP.

---

## Overview

This guide walks you through creating a fully functional DeFi agent that can:

- Monitor market conditions
- Analyze opportunities
- Execute trades safely
- Manage portfolios
- Assess risks

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    DeFi Agent                        │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Market    │  │   Risk      │  │  Execution  │ │
│  │   Analyzer  │  │   Manager   │  │   Engine    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │        │
│         └────────────────┼────────────────┘        │
│                          │                          │
│              ┌───────────┴───────────┐              │
│              │   Universal Crypto    │              │
│              │      MCP Server       │              │
│              └───────────┬───────────┘              │
└──────────────────────────┼──────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
    │Ethereum │      │ Arbitrum│      │   BSC   │
    └─────────┘      └─────────┘      └─────────┘
```

---

## Step 1: Project Setup

### Initialize Project

```bash
mkdir defi-agent
cd defi-agent
npm init -y
npm install @modelcontextprotocol/sdk openai dotenv
```

### Environment Configuration

Create `.env`:

```env
OPENAI_API_KEY=your-openai-key
PRIVATE_KEY=0x...  # Optional: for transactions
```

### Project Structure

```
defi-agent/
├── src/
│   ├── agent.ts
│   ├── mcp-client.ts
│   ├── strategies/
│   │   ├── market-analyzer.ts
│   │   ├── yield-optimizer.ts
│   │   └── risk-manager.ts
│   └── utils/
│       ├── formatters.ts
│       └── validators.ts
├── config/
│   └── settings.json
├── .env
└── package.json
```

---

## Step 2: MCP Client Setup

### Basic MCP Client

```typescript
// src/mcp-client.ts
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, any>;
}

export class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private initialized = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['-y', '@nirholas/bnb-chain-mcp@latest'], {
        env: {
          ...process.env,
          PRIVATE_KEY: process.env.PRIVATE_KEY
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const rl = readline.createInterface({
        input: this.process.stdout!,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        try {
          const response = JSON.parse(line);
          const pending = this.pending.get(response.id);
          if (pending) {
            this.pending.delete(response.id);
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
          }
        } catch (e) {
          // Handle parse errors
        }
      });

      this.process.stderr?.on('data', (data) => {
        console.error('MCP Error:', data.toString());
      });

      // Initialize connection
      this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'defi-agent', version: '1.0.0' }
      }).then(() => {
        this.sendNotification('notifications/initialized', {});
        this.initialized = true;
        resolve();
      }).catch(reject);
    });
  }

  private sendRequest(method: string, params: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      this.pending.set(id, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  private sendNotification(method: string, params: Record<string, any>): void {
    this.process?.stdin?.write(JSON.stringify({
      jsonrpc: '2.0',
      method,
      params
    }) + '\n');
  }

  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized');
    }

    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });

    const content = result?.content || [];
    if (content[0]?.type === 'text') {
      try {
        return JSON.parse(content[0].text);
      } catch {
        return content[0].text;
      }
    }
    return result;
  }

  async listTools(): Promise<any[]> {
    const result = await this.sendRequest('tools/list', {});
    return result?.tools || [];
  }

  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
```

---

## Step 3: Market Analyzer

```typescript
// src/strategies/market-analyzer.ts
import { MCPClient } from '../mcp-client';

export interface MarketCondition {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  fearGreedIndex: number;
  btcDominance: number;
  totalMarketCap: number;
  defiTvl: number;
  gasConditions: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export class MarketAnalyzer {
  constructor(private mcp: MCPClient) {}

  async getMarketCondition(): Promise<MarketCondition> {
    // Gather market data in parallel
    const [
      fearGreed,
      btcData,
      globalData,
      defiTvl,
      gasPrice
    ] = await Promise.all([
      this.mcp.callTool('market_get_fear_greed_index'),
      this.mcp.callTool('market_get_price', { coinId: 'bitcoin' }),
      this.mcp.callTool('market_get_global_data'),
      this.mcp.callTool('defi_get_total_tvl'),
      this.mcp.callTool('gas_get_gas_price', { network: 'ethereum' })
    ]);

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(fearGreed.value, btcData.priceChange24h);
    
    // Analyze gas conditions
    const gasConditions = this.analyzeGas(gasPrice.gasPrice);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations({
      sentiment,
      fearGreed: fearGreed.value,
      gasConditions
    });

    return {
      sentiment,
      fearGreedIndex: fearGreed.value,
      btcDominance: globalData.btcDominance,
      totalMarketCap: globalData.totalMarketCap,
      defiTvl: defiTvl.tvl,
      gasConditions,
      recommendations
    };
  }

  private analyzeSentiment(
    fearGreed: number,
    btcChange: number
  ): 'bullish' | 'bearish' | 'neutral' {
    if (fearGreed > 60 && btcChange > 0) return 'bullish';
    if (fearGreed < 40 && btcChange < 0) return 'bearish';
    return 'neutral';
  }

  private analyzeGas(gwei: number): 'low' | 'medium' | 'high' {
    if (gwei < 30) return 'low';
    if (gwei < 80) return 'medium';
    return 'high';
  }

  private generateRecommendations(data: {
    sentiment: string;
    fearGreed: number;
    gasConditions: string;
  }): string[] {
    const recommendations: string[] = [];

    if (data.fearGreed < 25) {
      recommendations.push('Extreme fear - potential buying opportunity');
    } else if (data.fearGreed > 75) {
      recommendations.push('Extreme greed - consider taking profits');
    }

    if (data.gasConditions === 'high') {
      recommendations.push('Gas prices elevated - delay non-urgent transactions');
    } else if (data.gasConditions === 'low') {
      recommendations.push('Low gas - good time for on-chain operations');
    }

    return recommendations;
  }

  async findOpportunities(
    tokens: string[],
    minPriceChange: number = -10
  ): Promise<any[]> {
    const opportunities: any[] = [];

    for (const token of tokens) {
      try {
        const [price, security] = await Promise.all([
          this.mcp.callTool('market_get_price', { coinId: token }),
          this.mcp.callTool('security_check_token', { 
            tokenAddress: token,
            network: 'ethereum' 
          })
        ]);

        // Look for dips that might be opportunities
        if (price.priceChange24h <= minPriceChange && security.isSecure) {
          opportunities.push({
            token,
            price: price.price,
            change24h: price.priceChange24h,
            securityScore: security.score,
            signal: 'potential_dip_buy'
          });
        }
      } catch (e) {
        // Skip tokens that fail
      }
    }

    return opportunities.sort((a, b) => a.change24h - b.change24h);
  }
}
```

---

## Step 4: Risk Manager

```typescript
// src/strategies/risk-manager.ts
import { MCPClient } from '../mcp-client';

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: RiskFactor[];
  approved: boolean;
  warnings: string[];
}

interface RiskFactor {
  name: string;
  risk: 'low' | 'medium' | 'high';
  weight: number;
  details: string;
}

export class RiskManager {
  private riskLimits = {
    maxPositionSize: 0.2,      // 20% of portfolio
    maxSlippage: 0.03,         // 3%
    minSecurityScore: 60,      // GoPlus score
    minHealthFactor: 1.5,      // For lending
    maxGasGwei: 100
  };

  constructor(private mcp: MCPClient) {}

  async assessTokenRisk(
    tokenAddress: string,
    network: string = 'ethereum'
  ): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    const warnings: string[] = [];

    // Security analysis
    const security = await this.mcp.callTool('security_check_token', {
      tokenAddress,
      network
    });

    factors.push({
      name: 'Smart Contract Security',
      risk: security.score >= 80 ? 'low' : security.score >= 60 ? 'medium' : 'high',
      weight: 0.4,
      details: `GoPlus score: ${security.score}/100`
    });

    if (security.isHoneypot) {
      warnings.push('⚠️ HONEYPOT DETECTED - DO NOT TRADE');
      factors.push({
        name: 'Honeypot',
        risk: 'high',
        weight: 1.0,
        details: 'Token cannot be sold'
      });
    }

    if (security.hasOwnershipRisk) {
      warnings.push('Owner can modify token - centralization risk');
      factors.push({
        name: 'Ownership Risk',
        risk: 'medium',
        weight: 0.2,
        details: 'Owner has elevated privileges'
      });
    }

    // Liquidity analysis
    try {
      const liquidity = await this.mcp.callTool('dex_get_liquidity', {
        tokenAddress,
        network
      });

      factors.push({
        name: 'Liquidity',
        risk: liquidity.totalLiquidity > 1000000 ? 'low' : 
              liquidity.totalLiquidity > 100000 ? 'medium' : 'high',
        weight: 0.2,
        details: `Total liquidity: $${liquidity.totalLiquidity.toLocaleString()}`
      });

      if (liquidity.totalLiquidity < 50000) {
        warnings.push('Very low liquidity - high slippage risk');
      }
    } catch (e) {
      factors.push({
        name: 'Liquidity',
        risk: 'high',
        weight: 0.2,
        details: 'Unable to determine liquidity'
      });
    }

    return this.calculateOverallRisk(factors, warnings);
  }

  async assessTradeRisk(
    tokenIn: string,
    tokenOut: string,
    amount: string,
    network: string = 'ethereum'
  ): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    const warnings: string[] = [];

    // Get quote to check slippage
    const quote = await this.mcp.callTool('swap_get_quote', {
      tokenIn,
      tokenOut,
      amountIn: amount,
      network
    });

    const priceImpact = parseFloat(quote.priceImpact || '0');
    
    factors.push({
      name: 'Price Impact',
      risk: priceImpact < 1 ? 'low' : priceImpact < 3 ? 'medium' : 'high',
      weight: 0.3,
      details: `Expected impact: ${priceImpact.toFixed(2)}%`
    });

    if (priceImpact > this.riskLimits.maxSlippage * 100) {
      warnings.push(`High price impact (${priceImpact.toFixed(2)}%) - consider smaller trade`);
    }

    // Check gas conditions
    const gas = await this.mcp.callTool('gas_get_gas_price', { network });
    
    factors.push({
      name: 'Gas Cost',
      risk: gas.gasPrice < 50 ? 'low' : gas.gasPrice < 100 ? 'medium' : 'high',
      weight: 0.2,
      details: `Current gas: ${gas.gasPrice} Gwei`
    });

    if (gas.gasPrice > this.riskLimits.maxGasGwei) {
      warnings.push('Gas prices are elevated - consider waiting');
    }

    // Check token security
    const tokenRisk = await this.assessTokenRisk(tokenOut, network);
    factors.push(...tokenRisk.factors.map(f => ({ ...f, weight: f.weight * 0.5 })));
    warnings.push(...tokenRisk.warnings);

    return this.calculateOverallRisk(factors, warnings);
  }

  private calculateOverallRisk(
    factors: RiskFactor[],
    warnings: string[]
  ): RiskAssessment {
    // Calculate weighted score
    let totalWeight = 0;
    let weightedScore = 0;

    for (const factor of factors) {
      const riskScore = factor.risk === 'low' ? 0 : factor.risk === 'medium' ? 50 : 100;
      weightedScore += riskScore * factor.weight;
      totalWeight += factor.weight;
    }

    const score = totalWeight > 0 ? weightedScore / totalWeight : 50;

    // Determine overall risk level
    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    if (score < 25) overallRisk = 'low';
    else if (score < 50) overallRisk = 'medium';
    else if (score < 75) overallRisk = 'high';
    else overallRisk = 'critical';

    // Critical warnings override
    if (warnings.some(w => w.includes('HONEYPOT'))) {
      overallRisk = 'critical';
    }

    return {
      overallRisk,
      score: 100 - score, // Convert to "safety" score
      factors,
      approved: overallRisk === 'low' || overallRisk === 'medium',
      warnings
    };
  }
}
```

---

## Step 5: Execution Engine

```typescript
// src/strategies/execution-engine.ts
import { MCPClient } from '../mcp-client';
import { RiskManager, RiskAssessment } from './risk-manager';

export interface TradeResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  details: any;
}

export class ExecutionEngine {
  constructor(
    private mcp: MCPClient,
    private riskManager: RiskManager
  ) {}

  async executeSwap(
    tokenIn: string,
    tokenOut: string,
    amount: string,
    network: string = 'ethereum',
    options: {
      maxSlippage?: number;
      skipRiskCheck?: boolean;
    } = {}
  ): Promise<TradeResult> {
    const { maxSlippage = 1, skipRiskCheck = false } = options;

    // Risk assessment
    if (!skipRiskCheck) {
      const risk = await this.riskManager.assessTradeRisk(
        tokenIn,
        tokenOut,
        amount,
        network
      );

      if (!risk.approved) {
        return {
          success: false,
          error: `Trade rejected: ${risk.overallRisk} risk`,
          details: { riskAssessment: risk }
        };
      }

      console.log(`Risk assessment: ${risk.overallRisk} (score: ${risk.score})`);
      risk.warnings.forEach(w => console.log(`⚠️ ${w}`));
    }

    // Get quote first
    const quote = await this.mcp.callTool('swap_get_quote', {
      tokenIn,
      tokenOut,
      amountIn: amount,
      network,
      slippage: maxSlippage
    });

    console.log(`Quote received:`);
    console.log(`  Input: ${amount} ${tokenIn}`);
    console.log(`  Output: ${quote.amountOut} ${tokenOut}`);
    console.log(`  Price impact: ${quote.priceImpact}%`);
    console.log(`  Gas estimate: ${quote.gasEstimate}`);

    // Execute swap
    try {
      const result = await this.mcp.callTool('swap_execute_swap', {
        tokenIn,
        tokenOut,
        amountIn: amount,
        minAmountOut: quote.minAmountOut,
        network,
        slippage: maxSlippage
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        details: {
          amountIn: amount,
          amountOut: result.amountOut,
          priceImpact: quote.priceImpact,
          gasUsed: result.gasUsed
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        details: { quote }
      };
    }
  }

  async executeYieldStrategy(
    protocol: string,
    pool: string,
    amount: string,
    network: string = 'ethereum'
  ): Promise<TradeResult> {
    // Check pool safety
    const poolInfo = await this.mcp.callTool('staking_get_pool_info', {
      protocol,
      pool,
      network
    });

    console.log(`Pool info:`);
    console.log(`  APY: ${poolInfo.apy}%`);
    console.log(`  TVL: $${poolInfo.tvl.toLocaleString()}`);

    // Stake
    try {
      const result = await this.mcp.callTool('staking_stake', {
        protocol,
        pool,
        amount,
        network
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        details: {
          staked: amount,
          expectedApy: poolInfo.apy,
          received: result.received
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        details: { poolInfo }
      };
    }
  }
}
```

---

## Step 6: Main Agent

```typescript
// src/agent.ts
import { MCPClient } from './mcp-client';
import { MarketAnalyzer } from './strategies/market-analyzer';
import { RiskManager } from './strategies/risk-manager';
import { ExecutionEngine } from './strategies/execution-engine';
import 'dotenv/config';

class DeFiAgent {
  private mcp: MCPClient;
  private marketAnalyzer: MarketAnalyzer;
  private riskManager: RiskManager;
  private executionEngine: ExecutionEngine;

  constructor() {
    this.mcp = new MCPClient();
  }

  async initialize(): Promise<void> {
    console.log('Initializing DeFi Agent...');
    await this.mcp.connect();
    
    this.marketAnalyzer = new MarketAnalyzer(this.mcp);
    this.riskManager = new RiskManager(this.mcp);
    this.executionEngine = new ExecutionEngine(this.mcp, this.riskManager);
    
    console.log('DeFi Agent ready!');
  }

  async analyzeMarket(): Promise<void> {
    console.log('\n📊 Analyzing market conditions...\n');
    
    const condition = await this.marketAnalyzer.getMarketCondition();
    
    console.log(`Market Sentiment: ${condition.sentiment.toUpperCase()}`);
    console.log(`Fear & Greed Index: ${condition.fearGreedIndex}`);
    console.log(`BTC Dominance: ${condition.btcDominance.toFixed(1)}%`);
    console.log(`Total Market Cap: $${(condition.totalMarketCap / 1e12).toFixed(2)}T`);
    console.log(`DeFi TVL: $${(condition.defiTvl / 1e9).toFixed(2)}B`);
    console.log(`Gas Conditions: ${condition.gasConditions}`);
    
    console.log('\nRecommendations:');
    condition.recommendations.forEach(r => console.log(`  • ${r}`));
  }

  async findYieldOpportunities(
    token: string,
    network: string = 'arbitrum'
  ): Promise<void> {
    console.log(`\n🔍 Finding yield opportunities for ${token} on ${network}...\n`);
    
    const options = await this.mcp.callTool('staking_get_staking_options', {
      network,
      token
    });

    console.log('Available opportunities:');
    for (const opt of options.options.slice(0, 5)) {
      console.log(`\n  ${opt.protocol} - ${opt.pool}`);
      console.log(`    APY: ${opt.apy}%`);
      console.log(`    TVL: $${(opt.tvl / 1e6).toFixed(2)}M`);
      console.log(`    Type: ${opt.type}`);
    }
  }

  async checkPortfolio(address: string): Promise<void> {
    console.log(`\n💼 Checking portfolio for ${address.slice(0, 8)}...\n`);
    
    const networks = ['ethereum', 'arbitrum', 'polygon', 'bsc'];
    let totalValue = 0;

    for (const network of networks) {
      const balance = await this.mcp.callTool('wallet_get_balance', {
        address,
        network
      });
      
      const tokens = await this.mcp.callTool('wallet_get_token_balances', {
        address,
        network
      });

      if (tokens.totalValueUsd > 0) {
        console.log(`${network.toUpperCase()}:`);
        console.log(`  Native: ${balance.balance} ${balance.symbol}`);
        console.log(`  Tokens: $${tokens.totalValueUsd.toLocaleString()}`);
        totalValue += tokens.totalValueUsd;
      }
    }

    console.log(`\nTotal Portfolio Value: $${totalValue.toLocaleString()}`);
  }

  async executeTrade(
    tokenIn: string,
    tokenOut: string,
    amount: string,
    network: string = 'arbitrum'
  ): Promise<void> {
    console.log(`\n🔄 Executing swap: ${amount} ${tokenIn} -> ${tokenOut}...\n`);
    
    const result = await this.executionEngine.executeSwap(
      tokenIn,
      tokenOut,
      amount,
      network
    );

    if (result.success) {
      console.log('✅ Swap successful!');
      console.log(`  TX: ${result.transactionHash}`);
      console.log(`  Received: ${result.details.amountOut}`);
    } else {
      console.log('❌ Swap failed!');
      console.log(`  Error: ${result.error}`);
    }
  }

  async shutdown(): Promise<void> {
    console.log('\nShutting down DeFi Agent...');
    this.mcp.disconnect();
  }
}

// Main execution
async function main() {
  const agent = new DeFiAgent();
  
  try {
    await agent.initialize();
    
    // Example workflow
    await agent.analyzeMarket();
    await agent.findYieldOpportunities('USDC', 'arbitrum');
    
    // Check portfolio (replace with your address)
    // await agent.checkPortfolio('0x...');
    
    // Execute trade (uncomment when ready)
    // await agent.executeTrade('USDC', 'WETH', '100', 'arbitrum');
    
  } finally {
    await agent.shutdown();
  }
}

main().catch(console.error);
```

---

## Step 7: Running the Agent

### Build & Run

```bash
npx ts-node src/agent.ts
```

### Example Output

```
Initializing DeFi Agent...
DeFi Agent ready!

📊 Analyzing market conditions...

Market Sentiment: NEUTRAL
Fear & Greed Index: 52
BTC Dominance: 51.2%
Total Market Cap: $2.45T
DeFi TVL: $89.50B
Gas Conditions: low

Recommendations:
  • Low gas - good time for on-chain operations

🔍 Finding yield opportunities for USDC on arbitrum...

Available opportunities:

  Aave - USDC Supply
    APY: 3.85%
    TVL: $425.00M
    Type: lending

  GMX - GLP
    APY: 12.50%
    TVL: $285.00M
    Type: yield-farming

Shutting down DeFi Agent...
```

---

## Advanced Features

### Automated Monitoring Loop

```typescript
async function monitorLoop(agent: DeFiAgent, intervalMs: number = 60000) {
  while (true) {
    try {
      await agent.analyzeMarket();
      // Add custom logic here
    } catch (error) {
      console.error('Monitor error:', error);
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
```

### Alert System

```typescript
class AlertManager {
  async checkPriceAlerts(
    mcp: MCPClient,
    alerts: { token: string; above?: number; below?: number }[]
  ): Promise<void> {
    for (const alert of alerts) {
      const price = await mcp.callTool('market_get_price', {
        coinId: alert.token
      });

      if (alert.above && price.price > alert.above) {
        console.log(`🔔 ${alert.token} above $${alert.above}: $${price.price}`);
      }
      if (alert.below && price.price < alert.below) {
        console.log(`🔔 ${alert.token} below $${alert.below}: $${price.price}`);
      }
    }
  }
}
```

---

## Best Practices

1. **Always assess risk** before executing trades
2. **Use testnets** for development and testing
3. **Implement rate limiting** for API calls
4. **Log all operations** for debugging and auditing
5. **Monitor health factors** for lending positions
6. **Set stop-losses** for automated trading
7. **Keep private keys secure** - use hardware wallets for production

---

## Next Steps

- [Monitoring Protocol Guide](monitoring-protocol.md) - Track protocol health
- [Yield Optimization Guide](yield-optimization.md) - Maximize returns
- [API Reference](../api/README.md) - Complete tool documentation
