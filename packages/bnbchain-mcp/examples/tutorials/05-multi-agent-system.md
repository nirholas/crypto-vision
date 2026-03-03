# Tutorial 5: Building Multi-Agent Systems

Learn how to build sophisticated multi-agent systems that coordinate multiple AI agents to perform complex crypto tasks autonomously.

**Difficulty:** ⭐⭐⭐⭐ Advanced  
**Time:** 60 minutes  
**Prerequisites:** All previous tutorials, Understanding of agent architectures

---

## Table of Contents

1. [Introduction to Multi-Agent Systems](#introduction-to-multi-agent-systems)
2. [Agent Architecture](#agent-architecture)
3. [Building Specialized Agents](#building-specialized-agents)
4. [Agent Communication](#agent-communication)
5. [Orchestration Layer](#orchestration-layer)
6. [Complete Implementation](#complete-implementation)
7. [Real-World Applications](#real-world-applications)
8. [Best Practices](#best-practices)

---

## Introduction to Multi-Agent Systems

### Why Multi-Agent?

Single agents have limitations:
- **Context limits** - Can't hold all information
- **Specialization** - One agent can't be expert at everything
- **Parallelism** - Sequential processing is slow

Multi-agent systems solve this by:
- **Division of labor** - Specialized agents for specific tasks
- **Parallel processing** - Multiple agents work simultaneously
- **Collective intelligence** - Agents share insights

### Architecture Overview

```
                    ┌─────────────────┐
                    │  Orchestrator   │
                    │    Agent        │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Security    │   │    Market     │   │   Portfolio   │
│    Agent      │   │    Agent      │   │    Agent      │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼───────┐
                    │  MCP Server   │
                    └───────────────┘
```

---

## Agent Architecture

### Base Agent Class

```typescript
// agents/base.ts
import { EventEmitter } from "events";

export interface AgentConfig {
    name: string;
    description: string;
    capabilities: string[];
    maxConcurrentTasks: number;
}

export interface Task {
    id: string;
    type: string;
    params: Record<string, unknown>;
    priority: number;
    deadline?: Date;
}

export interface TaskResult {
    taskId: string;
    success: boolean;
    data?: unknown;
    error?: string;
    duration: number;
}

export interface AgentMessage {
    from: string;
    to: string;
    type: "request" | "response" | "broadcast" | "alert";
    content: unknown;
    timestamp: Date;
}

export abstract class BaseAgent extends EventEmitter {
    protected config: AgentConfig;
    protected taskQueue: Task[] = [];
    protected activeTasks: Map<string, Task> = new Map();
    protected isRunning = false;

    constructor(config: AgentConfig) {
        super();
        this.config = config;
    }

    get name(): string {
        return this.config.name;
    }

    get capabilities(): string[] {
        return this.config.capabilities;
    }

    // Submit a task to this agent
    async submitTask(task: Task): Promise<string> {
        this.taskQueue.push(task);
        this.taskQueue.sort((a, b) => b.priority - a.priority);
        this.emit("task:submitted", task);
        return task.id;
    }

    // Process pending tasks
    async processTasks(): Promise<void> {
        while (
            this.taskQueue.length > 0 &&
            this.activeTasks.size < this.config.maxConcurrentTasks
        ) {
            const task = this.taskQueue.shift()!;
            this.activeTasks.set(task.id, task);
            
            this.emit("task:started", task);
            
            const startTime = Date.now();
            try {
                const result = await this.executeTask(task);
                this.emit("task:completed", {
                    taskId: task.id,
                    success: true,
                    data: result,
                    duration: Date.now() - startTime
                } as TaskResult);
            } catch (error) {
                this.emit("task:failed", {
                    taskId: task.id,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    duration: Date.now() - startTime
                } as TaskResult);
            } finally {
                this.activeTasks.delete(task.id);
            }
        }
    }

    // Handle incoming messages
    async handleMessage(message: AgentMessage): Promise<void> {
        this.emit("message:received", message);
        
        if (message.type === "request") {
            const response = await this.processRequest(message.content);
            this.emit("message:send", {
                from: this.name,
                to: message.from,
                type: "response",
                content: response,
                timestamp: new Date()
            } as AgentMessage);
        }
    }

    // Start the agent
    async start(): Promise<void> {
        this.isRunning = true;
        this.emit("started");
        await this.initialize();
        
        // Process loop
        while (this.isRunning) {
            await this.processTasks();
            await this.tick();
            await this.sleep(100);
        }
    }

    // Stop the agent
    async stop(): Promise<void> {
        this.isRunning = false;
        await this.cleanup();
        this.emit("stopped");
    }

    // Abstract methods to implement
    protected abstract executeTask(task: Task): Promise<unknown>;
    protected abstract processRequest(content: unknown): Promise<unknown>;
    protected abstract initialize(): Promise<void>;
    protected abstract cleanup(): Promise<void>;
    protected abstract tick(): Promise<void>;

    // Utility
    protected sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

---

## Building Specialized Agents

### Security Agent

```typescript
// agents/security-agent.ts
import { BaseAgent, Task, AgentConfig } from "./base.js";
import { callTool } from "../lib/mcp.js";

interface SecurityScanResult {
    tokenAddress: string;
    network: string;
    score: number;
    isHoneypot: boolean;
    risks: Array<{
        severity: string;
        type: string;
        message: string;
    }>;
    recommendation: "safe" | "caution" | "avoid";
}

export class SecurityAgent extends BaseAgent {
    private scanCache: Map<string, SecurityScanResult> = new Map();
    private cacheExpiry = 300000; // 5 minutes

    constructor() {
        super({
            name: "SecurityAgent",
            description: "Analyzes token and contract security",
            capabilities: [
                "token_security_scan",
                "honeypot_check",
                "contract_analysis",
                "risk_assessment"
            ],
            maxConcurrentTasks: 5
        });
    }

    protected async initialize(): Promise<void> {
        console.log(`[${this.name}] Initialized`);
    }

    protected async cleanup(): Promise<void> {
        this.scanCache.clear();
        console.log(`[${this.name}] Cleaned up`);
    }

    protected async tick(): Promise<void> {
        // Clean expired cache entries
        const now = Date.now();
        for (const [key, result] of this.scanCache) {
            const cacheTime = parseInt(key.split(":")[2]);
            if (now - cacheTime > this.cacheExpiry) {
                this.scanCache.delete(key);
            }
        }
    }

    protected async executeTask(task: Task): Promise<unknown> {
        switch (task.type) {
            case "token_security_scan":
                return this.scanToken(
                    task.params.tokenAddress as string,
                    task.params.network as string
                );
            
            case "honeypot_check":
                return this.checkHoneypot(
                    task.params.tokenAddress as string,
                    task.params.network as string
                );
            
            case "batch_scan":
                return this.batchScan(
                    task.params.tokens as Array<{ address: string; network: string }>
                );
            
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    }

    protected async processRequest(content: unknown): Promise<unknown> {
        const request = content as { action: string; params: Record<string, unknown> };
        
        switch (request.action) {
            case "is_safe":
                const result = await this.scanToken(
                    request.params.tokenAddress as string,
                    request.params.network as string
                );
                return { safe: result.recommendation === "safe", details: result };
            
            case "get_cached":
                const key = `${request.params.tokenAddress}:${request.params.network}`;
                return this.scanCache.get(key);
            
            default:
                return { error: "Unknown action" };
        }
    }

    private async scanToken(
        tokenAddress: string,
        network: string
    ): Promise<SecurityScanResult> {
        // Check cache
        const cacheKey = `${tokenAddress}:${network}:${Date.now()}`;
        const cached = this.findCachedResult(tokenAddress, network);
        if (cached) return cached;

        // Perform scan
        const [securityData, honeypotData] = await Promise.all([
            callTool<{
                score: number;
                risks: Array<{ severity: string; type: string; message: string }>;
            }>("security_check_token", { tokenAddress, network }),
            callTool<{ isHoneypot: boolean }>("security_honeypot_check", { tokenAddress, network })
        ]);

        const result: SecurityScanResult = {
            tokenAddress,
            network,
            score: securityData.score,
            isHoneypot: honeypotData.isHoneypot,
            risks: securityData.risks,
            recommendation: this.getRecommendation(securityData.score, honeypotData.isHoneypot)
        };

        // Cache result
        this.scanCache.set(cacheKey, result);
        
        // Emit alert for dangerous tokens
        if (result.recommendation === "avoid") {
            this.emit("alert", {
                type: "dangerous_token",
                severity: "high",
                data: result
            });
        }

        return result;
    }

    private async checkHoneypot(
        tokenAddress: string,
        network: string
    ): Promise<{ isHoneypot: boolean; reason?: string }> {
        return callTool("security_honeypot_check", { tokenAddress, network });
    }

    private async batchScan(
        tokens: Array<{ address: string; network: string }>
    ): Promise<SecurityScanResult[]> {
        const results = await Promise.all(
            tokens.map(t => this.scanToken(t.address, t.network))
        );
        return results;
    }

    private findCachedResult(
        tokenAddress: string,
        network: string
    ): SecurityScanResult | undefined {
        for (const [key, result] of this.scanCache) {
            if (key.startsWith(`${tokenAddress}:${network}`)) {
                return result;
            }
        }
        return undefined;
    }

    private getRecommendation(
        score: number,
        isHoneypot: boolean
    ): "safe" | "caution" | "avoid" {
        if (isHoneypot) return "avoid";
        if (score >= 80) return "safe";
        if (score >= 50) return "caution";
        return "avoid";
    }
}
```

### Market Agent

```typescript
// agents/market-agent.ts
import { BaseAgent, Task } from "./base.js";
import { callTool } from "../lib/mcp.js";

interface PriceData {
    coinId: string;
    price: number;
    change24h: number;
    marketCap: number;
    volume24h: number;
    lastUpdated: Date;
}

interface MarketSignal {
    type: "bullish" | "bearish" | "neutral";
    strength: number; // 0-100
    indicators: string[];
}

export class MarketAgent extends BaseAgent {
    private priceCache: Map<string, PriceData> = new Map();
    private watchlist: Set<string> = new Set();
    private priceAlerts: Map<string, { above?: number; below?: number }> = new Map();

    constructor() {
        super({
            name: "MarketAgent",
            description: "Monitors market data and generates signals",
            capabilities: [
                "price_tracking",
                "market_signals",
                "price_alerts",
                "trend_analysis"
            ],
            maxConcurrentTasks: 10
        });
    }

    protected async initialize(): Promise<void> {
        // Add default watchlist
        this.watchlist.add("bitcoin");
        this.watchlist.add("ethereum");
        this.watchlist.add("binancecoin");
        console.log(`[${this.name}] Initialized with ${this.watchlist.size} watched coins`);
    }

    protected async cleanup(): Promise<void> {
        this.priceCache.clear();
        this.watchlist.clear();
        this.priceAlerts.clear();
    }

    protected async tick(): Promise<void> {
        // Update prices for watchlist
        for (const coinId of this.watchlist) {
            try {
                await this.updatePrice(coinId);
            } catch (error) {
                // Silently continue on error
            }
        }

        // Check price alerts
        await this.checkPriceAlerts();
    }

    protected async executeTask(task: Task): Promise<unknown> {
        switch (task.type) {
            case "get_price":
                return this.getPrice(task.params.coinId as string);
            
            case "get_market_signal":
                return this.getMarketSignal(task.params.coinId as string);
            
            case "add_to_watchlist":
                this.watchlist.add(task.params.coinId as string);
                return { success: true };
            
            case "set_price_alert":
                this.priceAlerts.set(task.params.coinId as string, {
                    above: task.params.above as number | undefined,
                    below: task.params.below as number | undefined
                });
                return { success: true };
            
            case "get_trending":
                return this.getTrending();
            
            case "get_fear_greed":
                return this.getFearGreedIndex();
            
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    }

    protected async processRequest(content: unknown): Promise<unknown> {
        const request = content as { action: string; params: Record<string, unknown> };
        
        switch (request.action) {
            case "quick_price":
                const cached = this.priceCache.get(request.params.coinId as string);
                return cached || await this.getPrice(request.params.coinId as string);
            
            case "get_watchlist":
                return Array.from(this.watchlist);
            
            default:
                return { error: "Unknown action" };
        }
    }

    private async updatePrice(coinId: string): Promise<void> {
        const data = await callTool<{
            coin: {
                current_price: number;
                price_change_percentage_24h: number;
                market_cap: number;
                total_volume: number;
            };
        }>("market_get_coin_by_id", { coinId, currency: "USD" });

        this.priceCache.set(coinId, {
            coinId,
            price: data.coin.current_price,
            change24h: data.coin.price_change_percentage_24h,
            marketCap: data.coin.market_cap,
            volume24h: data.coin.total_volume,
            lastUpdated: new Date()
        });
    }

    private async getPrice(coinId: string): Promise<PriceData> {
        const cached = this.priceCache.get(coinId);
        if (cached && Date.now() - cached.lastUpdated.getTime() < 60000) {
            return cached;
        }
        
        await this.updatePrice(coinId);
        return this.priceCache.get(coinId)!;
    }

    private async getMarketSignal(coinId: string): Promise<MarketSignal> {
        const priceData = await this.getPrice(coinId);
        const fearGreed = await this.getFearGreedIndex();
        
        const indicators: string[] = [];
        let score = 50; // Neutral

        // Price momentum
        if (priceData.change24h > 5) {
            score += 15;
            indicators.push("Strong 24h momentum");
        } else if (priceData.change24h > 0) {
            score += 5;
            indicators.push("Positive 24h trend");
        } else if (priceData.change24h < -5) {
            score -= 15;
            indicators.push("Strong selling pressure");
        } else if (priceData.change24h < 0) {
            score -= 5;
            indicators.push("Negative 24h trend");
        }

        // Fear & Greed
        if (fearGreed.value > 70) {
            score += 10;
            indicators.push("Extreme greed (contrarian caution)");
        } else if (fearGreed.value < 30) {
            score -= 10;
            indicators.push("Extreme fear (potential opportunity)");
        }

        // Volume analysis
        if (priceData.volume24h > priceData.marketCap * 0.1) {
            indicators.push("High trading volume");
            score += 5;
        }

        return {
            type: score > 60 ? "bullish" : score < 40 ? "bearish" : "neutral",
            strength: Math.min(100, Math.max(0, score)),
            indicators
        };
    }

    private async getTrending(): Promise<Array<{ name: string; symbol: string; rank: number }>> {
        const result = await callTool<{
            coins: Array<{ item: { name: string; symbol: string; market_cap_rank: number } }>;
        }>("market_get_trending", {});
        
        return result.coins.map(c => ({
            name: c.item.name,
            symbol: c.item.symbol,
            rank: c.item.market_cap_rank
        }));
    }

    private async getFearGreedIndex(): Promise<{ value: number; classification: string }> {
        return callTool("market_get_fear_and_greed", {});
    }

    private async checkPriceAlerts(): Promise<void> {
        for (const [coinId, alert] of this.priceAlerts) {
            const price = this.priceCache.get(coinId);
            if (!price) continue;

            if (alert.above && price.price >= alert.above) {
                this.emit("alert", {
                    type: "price_above",
                    coinId,
                    price: price.price,
                    threshold: alert.above
                });
                this.priceAlerts.delete(coinId);
            }

            if (alert.below && price.price <= alert.below) {
                this.emit("alert", {
                    type: "price_below",
                    coinId,
                    price: price.price,
                    threshold: alert.below
                });
                this.priceAlerts.delete(coinId);
            }
        }
    }
}
```

### Portfolio Agent

```typescript
// agents/portfolio-agent.ts
import { BaseAgent, Task } from "./base.js";
import { callTool } from "../lib/mcp.js";

interface Holding {
    network: string;
    asset: string;
    balance: string;
    usdValue: number;
}

interface PortfolioSnapshot {
    address: string;
    holdings: Holding[];
    totalValueUsd: number;
    timestamp: Date;
}

export class PortfolioAgent extends BaseAgent {
    private portfolios: Map<string, PortfolioSnapshot[]> = new Map();
    private trackedAddresses: Set<string> = new Set();

    constructor() {
        super({
            name: "PortfolioAgent",
            description: "Tracks and analyzes crypto portfolios",
            capabilities: [
                "portfolio_tracking",
                "performance_analysis",
                "allocation_breakdown",
                "rebalancing_suggestions"
            ],
            maxConcurrentTasks: 3
        });
    }

    protected async initialize(): Promise<void> {
        console.log(`[${this.name}] Initialized`);
    }

    protected async cleanup(): Promise<void> {
        this.portfolios.clear();
        this.trackedAddresses.clear();
    }

    protected async tick(): Promise<void> {
        // Update tracked portfolios
        for (const address of this.trackedAddresses) {
            try {
                await this.updatePortfolio(address);
            } catch {
                // Continue on error
            }
        }
    }

    protected async executeTask(task: Task): Promise<unknown> {
        switch (task.type) {
            case "get_portfolio":
                return this.getPortfolio(task.params.address as string);
            
            case "track_address":
                this.trackedAddresses.add(task.params.address as string);
                return { success: true };
            
            case "get_performance":
                return this.getPerformance(
                    task.params.address as string,
                    task.params.days as number || 7
                );
            
            case "get_allocation":
                return this.getAllocation(task.params.address as string);
            
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    }

    protected async processRequest(content: unknown): Promise<unknown> {
        const request = content as { action: string; params: Record<string, unknown> };
        
        switch (request.action) {
            case "quick_value":
                const portfolio = this.portfolios.get(request.params.address as string);
                if (portfolio && portfolio.length > 0) {
                    return { value: portfolio[portfolio.length - 1].totalValueUsd };
                }
                const fresh = await this.getPortfolio(request.params.address as string);
                return { value: fresh.totalValueUsd };
            
            default:
                return { error: "Unknown action" };
        }
    }

    private async getPortfolio(address: string): Promise<PortfolioSnapshot> {
        const networks = ["ethereum", "bsc", "arbitrum", "polygon"];
        const holdings: Holding[] = [];

        await Promise.all(networks.map(async (network) => {
            try {
                const result = await callTool<{
                    formatted: string;
                    symbol: string;
                    usdValue?: number;
                }>("get_native_balance", { address, network });

                if (parseFloat(result.formatted) > 0) {
                    holdings.push({
                        network,
                        asset: result.symbol,
                        balance: result.formatted,
                        usdValue: result.usdValue || 0
                    });
                }
            } catch {
                // Skip failed networks
            }
        }));

        const totalValueUsd = holdings.reduce((sum, h) => sum + h.usdValue, 0);

        const snapshot: PortfolioSnapshot = {
            address,
            holdings,
            totalValueUsd,
            timestamp: new Date()
        };

        // Store history
        if (!this.portfolios.has(address)) {
            this.portfolios.set(address, []);
        }
        this.portfolios.get(address)!.push(snapshot);

        // Keep only last 100 snapshots
        const history = this.portfolios.get(address)!;
        if (history.length > 100) {
            this.portfolios.set(address, history.slice(-100));
        }

        return snapshot;
    }

    private async updatePortfolio(address: string): Promise<void> {
        await this.getPortfolio(address);
    }

    private getPerformance(
        address: string,
        days: number
    ): { change: number; percentChange: number } | null {
        const history = this.portfolios.get(address);
        if (!history || history.length < 2) return null;

        const now = history[history.length - 1];
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        
        const past = history.find(s => s.timestamp.getTime() >= cutoff) || history[0];

        const change = now.totalValueUsd - past.totalValueUsd;
        const percentChange = past.totalValueUsd > 0 
            ? (change / past.totalValueUsd) * 100 
            : 0;

        return { change, percentChange };
    }

    private async getAllocation(
        address: string
    ): Promise<Array<{ asset: string; percentage: number }>> {
        const portfolio = await this.getPortfolio(address);
        
        return portfolio.holdings.map(h => ({
            asset: `${h.asset} (${h.network})`,
            percentage: portfolio.totalValueUsd > 0 
                ? (h.usdValue / portfolio.totalValueUsd) * 100 
                : 0
        })).sort((a, b) => b.percentage - a.percentage);
    }
}
```

---

## Agent Communication

### Message Bus

```typescript
// communication/message-bus.ts
import { EventEmitter } from "events";
import { BaseAgent, AgentMessage } from "../agents/base.js";

export class MessageBus extends EventEmitter {
    private agents: Map<string, BaseAgent> = new Map();

    registerAgent(agent: BaseAgent): void {
        this.agents.set(agent.name, agent);
        
        // Forward agent's outgoing messages
        agent.on("message:send", (message: AgentMessage) => {
            this.routeMessage(message);
        });

        // Forward alerts
        agent.on("alert", (alert: unknown) => {
            this.emit("alert", { from: agent.name, alert });
        });
    }

    unregisterAgent(name: string): void {
        this.agents.delete(name);
    }

    private routeMessage(message: AgentMessage): void {
        if (message.to === "*") {
            // Broadcast to all agents
            for (const [name, agent] of this.agents) {
                if (name !== message.from) {
                    agent.handleMessage(message);
                }
            }
        } else {
            // Direct message
            const target = this.agents.get(message.to);
            if (target) {
                target.handleMessage(message);
            } else {
                this.emit("undeliverable", message);
            }
        }

        this.emit("message", message);
    }

    sendMessage(
        from: string,
        to: string,
        type: AgentMessage["type"],
        content: unknown
    ): void {
        this.routeMessage({
            from,
            to,
            type,
            content,
            timestamp: new Date()
        });
    }

    broadcast(from: string, content: unknown): void {
        this.sendMessage(from, "*", "broadcast", content);
    }
}
```

---

## Orchestration Layer

### Orchestrator Agent

```typescript
// orchestrator/orchestrator.ts
import { BaseAgent, Task, TaskResult, AgentMessage } from "../agents/base.js";
import { SecurityAgent } from "../agents/security-agent.js";
import { MarketAgent } from "../agents/market-agent.js";
import { PortfolioAgent } from "../agents/portfolio-agent.js";
import { MessageBus } from "../communication/message-bus.js";
import { v4 as uuid } from "uuid";

interface OrchestratorConfig {
    enableSecurity: boolean;
    enableMarket: boolean;
    enablePortfolio: boolean;
}

export class Orchestrator extends BaseAgent {
    private messageBus: MessageBus;
    private childAgents: Map<string, BaseAgent> = new Map();
    private pendingTasks: Map<string, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
    }> = new Map();

    constructor(config: OrchestratorConfig) {
        super({
            name: "Orchestrator",
            description: "Coordinates multiple specialized agents",
            capabilities: [
                "task_routing",
                "agent_coordination",
                "result_aggregation"
            ],
            maxConcurrentTasks: 50
        });

        this.messageBus = new MessageBus();
        this.initializeAgents(config);
    }

    private initializeAgents(config: OrchestratorConfig): void {
        if (config.enableSecurity) {
            const securityAgent = new SecurityAgent();
            this.childAgents.set(securityAgent.name, securityAgent);
            this.messageBus.registerAgent(securityAgent);
        }

        if (config.enableMarket) {
            const marketAgent = new MarketAgent();
            this.childAgents.set(marketAgent.name, marketAgent);
            this.messageBus.registerAgent(marketAgent);
        }

        if (config.enablePortfolio) {
            const portfolioAgent = new PortfolioAgent();
            this.childAgents.set(portfolioAgent.name, portfolioAgent);
            this.messageBus.registerAgent(portfolioAgent);
        }

        // Listen for alerts
        this.messageBus.on("alert", (alert) => {
            this.emit("alert", alert);
        });
    }

    protected async initialize(): Promise<void> {
        // Start all child agents
        for (const agent of this.childAgents.values()) {
            agent.start();
            this.setupAgentListeners(agent);
        }
        console.log(`[Orchestrator] Started with ${this.childAgents.size} agents`);
    }

    protected async cleanup(): Promise<void> {
        for (const agent of this.childAgents.values()) {
            await agent.stop();
        }
    }

    protected async tick(): Promise<void> {
        // Orchestrator doesn't need periodic work
    }

    protected async executeTask(task: Task): Promise<unknown> {
        // Route task to appropriate agent
        const targetAgent = this.findAgentForTask(task);
        
        if (!targetAgent) {
            throw new Error(`No agent available for task type: ${task.type}`);
        }

        return new Promise((resolve, reject) => {
            const taskId = uuid();
            this.pendingTasks.set(taskId, { resolve, reject });
            
            targetAgent.submitTask({ ...task, id: taskId });
        });
    }

    protected async processRequest(content: unknown): Promise<unknown> {
        // Forward to appropriate agent
        return content;
    }

    private setupAgentListeners(agent: BaseAgent): void {
        agent.on("task:completed", (result: TaskResult) => {
            const pending = this.pendingTasks.get(result.taskId);
            if (pending) {
                pending.resolve(result.data);
                this.pendingTasks.delete(result.taskId);
            }
        });

        agent.on("task:failed", (result: TaskResult) => {
            const pending = this.pendingTasks.get(result.taskId);
            if (pending) {
                pending.reject(new Error(result.error));
                this.pendingTasks.delete(result.taskId);
            }
        });
    }

    private findAgentForTask(task: Task): BaseAgent | undefined {
        for (const agent of this.childAgents.values()) {
            if (agent.capabilities.includes(task.type)) {
                return agent;
            }
        }

        // Fallback: check for related capabilities
        const taskToCapability: Record<string, string> = {
            "is_token_safe": "token_security_scan",
            "get_price": "price_tracking",
            "portfolio_value": "portfolio_tracking"
        };

        const capability = taskToCapability[task.type];
        if (capability) {
            for (const agent of this.childAgents.values()) {
                if (agent.capabilities.includes(capability)) {
                    return agent;
                }
            }
        }

        return undefined;
    }

    // High-level API
    async analyzeToken(
        tokenAddress: string,
        network: string
    ): Promise<{
        security: unknown;
        price?: unknown;
    }> {
        const securityTask: Task = {
            id: uuid(),
            type: "token_security_scan",
            params: { tokenAddress, network },
            priority: 10
        };

        const security = await this.executeTask(securityTask);

        return { security };
    }

    async getMarketOverview(): Promise<{
        trending: unknown;
        fearGreed: unknown;
    }> {
        const [trending, fearGreed] = await Promise.all([
            this.executeTask({
                id: uuid(),
                type: "get_trending",
                params: {},
                priority: 5
            }),
            this.executeTask({
                id: uuid(),
                type: "get_fear_greed",
                params: {},
                priority: 5
            })
        ]);

        return { trending, fearGreed };
    }

    async getPortfolioAnalysis(address: string): Promise<{
        portfolio: unknown;
        allocation: unknown;
    }> {
        const [portfolio, allocation] = await Promise.all([
            this.executeTask({
                id: uuid(),
                type: "get_portfolio",
                params: { address },
                priority: 8
            }),
            this.executeTask({
                id: uuid(),
                type: "get_allocation",
                params: { address },
                priority: 8
            })
        ]);

        return { portfolio, allocation };
    }
}
```

---

## Complete Implementation

### Main Entry Point

```typescript
// index.ts
import { Orchestrator } from "./orchestrator/orchestrator.js";
import { v4 as uuid } from "uuid";

async function main(): Promise<void> {
    console.log("═".repeat(60));
    console.log("         🤖 MULTI-AGENT CRYPTO SYSTEM");
    console.log("═".repeat(60));
    console.log();

    // Create orchestrator with all agents
    const orchestrator = new Orchestrator({
        enableSecurity: true,
        enableMarket: true,
        enablePortfolio: true
    });

    // Listen for alerts
    orchestrator.on("alert", (alert) => {
        console.log("\n🚨 ALERT:", JSON.stringify(alert, null, 2));
    });

    // Start the system
    await orchestrator.start();
    console.log("✅ System started\n");

    // Example: Analyze a token
    console.log("─".repeat(60));
    console.log("📊 Analyzing token...");
    
    const tokenAnalysis = await orchestrator.analyzeToken(
        "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
        "ethereum"
    );
    console.log("Token Analysis:", JSON.stringify(tokenAnalysis, null, 2));

    // Example: Get market overview
    console.log("\n─".repeat(60));
    console.log("📈 Getting market overview...");
    
    const marketOverview = await orchestrator.getMarketOverview();
    console.log("Market Overview:", JSON.stringify(marketOverview, null, 2));

    // Example: Portfolio analysis
    console.log("\n─".repeat(60));
    console.log("💼 Analyzing portfolio...");
    
    const portfolioAnalysis = await orchestrator.getPortfolioAnalysis(
        "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    );
    console.log("Portfolio Analysis:", JSON.stringify(portfolioAnalysis, null, 2));

    // Keep running
    console.log("\n═".repeat(60));
    console.log("System running. Press Ctrl+C to exit.");
    
    process.on("SIGINT", async () => {
        console.log("\nShutting down...");
        await orchestrator.stop();
        process.exit(0);
    });
}

main().catch(console.error);
```

---

## Real-World Applications

### 1. Automated Trading Bot

```typescript
// Use multi-agent system for trading decisions
const decision = await Promise.all([
    securityAgent.checkToken(token),
    marketAgent.getSignal(token),
    portfolioAgent.checkAllocation()
]);

if (decision.security.safe && decision.market.bullish && decision.portfolio.canBuy) {
    // Execute trade
}
```

### 2. Portfolio Rebalancer

```typescript
// Agents coordinate to rebalance
const current = await portfolioAgent.getAllocation(address);
const target = { ETH: 50, BTC: 30, STABLE: 20 };

for (const asset of current) {
    if (asset.percentage > target[asset.symbol] + 5) {
        // Sell excess
    } else if (asset.percentage < target[asset.symbol] - 5) {
        // Buy more
    }
}
```

### 3. Risk Monitor

```typescript
// Continuous monitoring with alerts
orchestrator.on("alert", async (alert) => {
    if (alert.type === "dangerous_token") {
        await notificationService.sendUrgent(
            `🚨 Dangerous token detected: ${alert.data.tokenAddress}`
        );
    }
    
    if (alert.type === "price_drop") {
        await portfolioAgent.triggerStopLoss(alert.data.coinId);
    }
});
```

---

## Best Practices

### 1. Error Handling

```typescript
// Always handle agent failures gracefully
agent.on("task:failed", (result) => {
    logger.error(`Task ${result.taskId} failed:`, result.error);
    metrics.increment("agent.task.failed");
    
    // Retry logic
    if (retryCount < 3) {
        agent.submitTask(task);
    }
});
```

### 2. Resource Management

```typescript
// Limit concurrent operations
const semaphore = new Semaphore(10);

async function executeWithLimit(task: Task): Promise<unknown> {
    await semaphore.acquire();
    try {
        return await agent.executeTask(task);
    } finally {
        semaphore.release();
    }
}
```

### 3. Monitoring

```typescript
// Track agent performance
agent.on("task:completed", (result) => {
    metrics.histogram("agent.task.duration", result.duration);
    metrics.increment("agent.task.completed");
});

// Health checks
setInterval(() => {
    for (const agent of agents) {
        if (!agent.isHealthy()) {
            logger.warn(`Agent ${agent.name} unhealthy`);
            agent.restart();
        }
    }
}, 60000);
```

---

## Conclusion

You've learned how to:

- ✅ Build specialized crypto agents
- ✅ Implement agent communication
- ✅ Create an orchestration layer
- ✅ Handle complex multi-agent workflows
- ✅ Apply best practices for production systems

Multi-agent systems are powerful tools for building sophisticated crypto applications. By dividing responsibilities among specialized agents, you can create systems that are more robust, scalable, and intelligent than single-agent solutions.

---

## Full Source Code

See the complete implementation in: [examples/advanced/autonomous-agent.ts](../advanced/autonomous-agent.ts)
