/**
 * Agent Ecosystem Engine — Core Runtime
 *
 * The autonomous brain of the ecosystem. Manages organism lifecycle:
 * boot → observe → analyze → decide → execute → reflect → repeat.
 *
 * Each organism runs on its own tick interval, proportional to
 * its capital (well-funded agents tick faster = think faster).
 *
 * The engine handles:
 * - Organism lifecycle management (boot, dormancy, extinction)
 * - Tick loop orchestration
 * - Skill acquisition and leveling
 * - Inter-agent interaction detection
 * - Composition triggers
 * - Leaderboard and snapshot updates
 * - Real-time event broadcasting
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { EventEmitter } from "events";
import { createHash } from "node:crypto";
import type {
  AgentDecision,
  DecisionContext,
  EcosystemConfig,
  EcosystemEngineEvents,
  EcosystemState,
  Observation,
  OrganismPhase,
  OrganismRuntime,
  PeriodMetrics,
  TradeResult,
} from "./types.js";

// ─── Defaults ───────────────────────────────────────────────

const DEFAULT_CONFIG: Partial<EcosystemConfig> = {
  snapshotIntervalMs: 5 * 60 * 1000,      // 5 minutes
  leaderboardIntervalMs: 60 * 1000,        // 1 minute
  maxConcurrentOrganisms: 100,
  dormancyThresholdLamports: "10000000",   // 0.01 SOL
  activationThresholdLamports: "100000000", // 0.1 SOL
  compositionInteractionThreshold: 20,
  compositionInvestmentThreshold: "50000000", // 0.05 SOL
  platformFeeBps: 100,                     // 1%
  liveTrading: false,
  logLevel: "info",
  aiModel: "anthropic/claude-sonnet-4-20250514",
  aiProvider: "openrouter",
};

// ─── Engine ─────────────────────────────────────────────────

export class EcosystemEngine extends EventEmitter {
  private config: EcosystemConfig;
  private state: EcosystemState;
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;
  private leaderboardTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<EcosystemConfig> & Pick<EcosystemConfig, "rpcUrl" | "databaseUrl">) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config } as EcosystemConfig;
    this.state = {
      organisms: new Map(),
      globalTick: 0,
      totalTrades: 0,
      totalVolumeLamports: "0",
      startedAt: Date.now(),
      running: false,
    };
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /** Start the ecosystem engine */
  async start(): Promise<void> {
    if (this.state.running) return;
    this.state.running = true;
    this.state.startedAt = Date.now();

    this.log("info", "Ecosystem engine starting", {
      maxOrganisms: this.config.maxConcurrentOrganisms,
      liveTrading: this.config.liveTrading,
    });

    // Start periodic tasks
    this.snapshotTimer = setInterval(
      () => void this.takeSnapshot(),
      this.config.snapshotIntervalMs,
    );
    this.leaderboardTimer = setInterval(
      () => void this.updateLeaderboard(),
      this.config.leaderboardIntervalMs,
    );

    this.log("info", "Ecosystem engine started");
  }

  /** Stop the ecosystem engine gracefully */
  async stop(): Promise<void> {
    if (!this.state.running) return;
    this.state.running = false;

    this.log("info", "Ecosystem engine stopping...");

    // Stop all organism tick loops
    for (const [id, runtime] of this.state.organisms) {
      this.stopOrganism(id);
      this.log("debug", `Stopped organism ${id}`);
    }

    // Clear periodic timers
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    if (this.leaderboardTimer) clearInterval(this.leaderboardTimer);

    // Final snapshot
    await this.takeSnapshot();

    this.log("info", "Ecosystem engine stopped");
  }

  // ─── Organism Management ──────────────────────────────────

  /** Boot an organism and start its tick loop */
  async bootOrganism(organismId: string, config: {
    name: string;
    systemPrompt: string;
    balanceLamports: string;
    tickIntervalSeconds: number;
    skills: Array<{ skillId: string; name: string; slug: string; category: string; proficiency: number }>;
    riskTolerance: number;
  }): Promise<OrganismRuntime> {
    if (this.state.organisms.has(organismId)) {
      throw new Error(`Organism ${organismId} is already running`);
    }
    if (this.state.organisms.size >= this.config.maxConcurrentOrganisms) {
      throw new Error(`Maximum concurrent organisms (${this.config.maxConcurrentOrganisms}) reached`);
    }

    const runtime: OrganismRuntime = {
      organismId,
      phase: "booting",
      tickTimer: null,
      positions: new Map(),
      observations: [],
      activeSkills: new Map(),
      recentInteractions: new Map(),
      decisionContext: this.createEmptyContext(),
      periodMetrics: this.createEmptyMetrics(),
      lastTickMs: Date.now(),
      tickInProgress: false,
      consecutiveErrors: 0,
    };

    // Load skills
    for (const skill of config.skills) {
      runtime.activeSkills.set(skill.skillId, {
        skillId: skill.skillId,
        name: skill.name,
        slug: skill.slug,
        category: skill.category,
        proficiency: skill.proficiency,
        influence: skill.proficiency * 5, // baseWeight default
        sessionUsageCount: 0,
        sessionSuccessRate: 0,
      });
    }

    this.state.organisms.set(organismId, runtime);

    // Calculate tick interval — well-funded agents think faster
    const balanceSol = Number(config.balanceLamports) / 1e9;
    const speedMultiplier = Math.min(3, Math.max(0.5, Math.sqrt(balanceSol)));
    const adjustedInterval = Math.max(10, Math.round(config.tickIntervalSeconds / speedMultiplier));

    // Start tick loop
    runtime.tickTimer = setInterval(
      () => void this.tick(organismId),
      adjustedInterval * 1000,
    );

    runtime.phase = "idle";
    this.emit("organism:booted", organismId);
    this.log("info", `Organism ${config.name} booted`, {
      id: organismId,
      skills: config.skills.length,
      tickInterval: adjustedInterval,
      balance: balanceSol,
    });

    return runtime;
  }

  /** Stop an organism's tick loop */
  stopOrganism(organismId: string): void {
    const runtime = this.state.organisms.get(organismId);
    if (!runtime) return;

    if (runtime.tickTimer) {
      clearInterval(runtime.tickTimer);
      runtime.tickTimer = null;
    }
    runtime.phase = "dormant";
  }

  /** Remove an organism entirely */
  removeOrganism(organismId: string): void {
    this.stopOrganism(organismId);
    this.state.organisms.delete(organismId);
  }

  // ─── Core Tick Loop ───────────────────────────────────────

  /**
   * One tick of an organism's life cycle.
   * This is the heartbeat — the organism observes, thinks, and acts.
   */
  private async tick(organismId: string): Promise<void> {
    const runtime = this.state.organisms.get(organismId);
    if (!runtime || runtime.tickInProgress || !this.state.running) return;

    runtime.tickInProgress = true;
    runtime.lastTickMs = Date.now();
    this.state.globalTick++;

    try {
      // Phase 1: OBSERVE — gather market data and other agents' activity
      runtime.phase = "observing";
      const observations = await this.observe(organismId);
      runtime.observations.push(...observations);

      // Keep rolling window of last 50 observations
      if (runtime.observations.length > 50) {
        runtime.observations = runtime.observations.slice(-50);
      }

      // Phase 2: ANALYZE — build decision context
      runtime.phase = "analyzing";
      runtime.decisionContext = await this.analyze(organismId, observations);

      // Phase 3: DECIDE — LLM-powered decision
      runtime.phase = "deciding";
      const decision = await this.decide(organismId, runtime.decisionContext);

      // Phase 4: EXECUTE — carry out the decision
      runtime.phase = "executing";
      await this.execute(organismId, decision);

      // Phase 5: REFLECT — update skills, check for interactions
      runtime.phase = "reflecting";
      await this.reflect(organismId, decision);

      runtime.phase = "idle";
      runtime.consecutiveErrors = 0;
      runtime.periodMetrics.observationsProcessed += observations.length;

    } catch (error) {
      runtime.consecutiveErrors++;
      runtime.phase = "error";

      this.log("error", `Tick failed for organism ${organismId}`, {
        error: error instanceof Error ? error.message : String(error),
        consecutiveErrors: runtime.consecutiveErrors,
      });

      // Exponential backoff on repeated errors
      if (runtime.consecutiveErrors > 5) {
        runtime.phase = "dormant";
        this.emit("organism:dormant", organismId);
        this.log("warn", `Organism ${organismId} entering dormancy after ${runtime.consecutiveErrors} errors`);
      }
    } finally {
      runtime.tickInProgress = false;
    }
  }

  // ─── Phase Implementations ────────────────────────────────

  /**
   * OBSERVE: Gather information about the market and other agents.
   * This is the agent's sensory input.
   */
  private async observe(organismId: string): Promise<Observation[]> {
    const observations: Observation[] = [];
    const now = Date.now();

    // Observe other organisms' recent activity
    for (const [otherId, otherRuntime] of this.state.organisms) {
      if (otherId === organismId) continue;

      // Check if any other organism made a notable trade recently
      if (otherRuntime.periodMetrics.trades > 0) {
        observations.push({
          type: "agent_trade",
          data: {
            agentId: otherId,
            trades: otherRuntime.periodMetrics.trades,
            wins: otherRuntime.periodMetrics.wins,
            pnl: otherRuntime.periodMetrics.pnlLamports,
          },
          relevance: 0.5,
          observedAt: now,
        });
      }
    }

    // Market observations would come from real data sources
    // (PumpFun API, DexScreener, CoinGecko, etc.)
    // These are hooks for the data enrichment pipeline
    observations.push({
      type: "market_trend",
      data: {
        ecosystemSize: this.state.organisms.size,
        globalTick: this.state.globalTick,
        totalTrades: this.state.totalTrades,
      },
      relevance: 0.3,
      observedAt: now,
    });

    return observations;
  }

  /**
   * ANALYZE: Build a decision context from observations and state.
   * This is the agent's working memory.
   */
  private async analyze(
    organismId: string,
    latestObservations: Observation[],
  ): Promise<DecisionContext> {
    const runtime = this.state.organisms.get(organismId);
    if (!runtime) throw new Error(`Organism ${organismId} not found`);

    // Summarize positions
    const positionSummaries: string[] = [];
    for (const [mint, pos] of runtime.positions) {
      positionSummaries.push(
        `${pos.symbol}: ${pos.tokenAmount} tokens, cost ${pos.costBasisLamports} lamports, ` +
        `current value ${pos.currentValueLamports} lamports, ` +
        `unrealized P&L ${pos.unrealizedPnlLamports} lamports`
      );
    }

    // Summarize recent performance
    const metrics = runtime.periodMetrics;
    const winRate = metrics.trades > 0 ? metrics.wins / metrics.trades : 0;

    // Agent activity from observations
    const agentActivity = latestObservations
      .filter((o) => o.type === "agent_trade")
      .map((o) => ({
        organismId: o.data.agentId as string,
        name: o.data.agentId as string,
        action: `${o.data.trades} trades, ${o.data.wins} wins`,
        relevance: o.relevance,
        timestamp: o.observedAt,
      }));

    // Top observations sorted by relevance
    const topObservations = [...latestObservations]
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);

    return {
      marketSummary: `Ecosystem: ${this.state.organisms.size} organisms, ${this.state.totalTrades} total trades`,
      availableBalanceLamports: "0", // Will be enriched from DB
      positionsSummary: positionSummaries.join("\n") || "No open positions",
      performanceSummary: `Period: ${metrics.trades} trades, ${winRate.toFixed(2)} win rate, ${metrics.pnlLamports} lamports P&L`,
      topObservations,
      agentActivity,
      riskLevel: winRate > 0.6 ? "low" : winRate > 0.4 ? "medium" : "high",
    };
  }

  /**
   * DECIDE: Use LLM to make a trading/interaction decision.
   * This is the agent's brain.
   */
  private async decide(
    organismId: string,
    context: DecisionContext,
  ): Promise<AgentDecision> {
    const runtime = this.state.organisms.get(organismId);
    if (!runtime) throw new Error(`Organism ${organismId} not found`);

    // Build skill summary for the prompt
    const skillSummary = [...runtime.activeSkills.values()]
      .sort((a, b) => b.influence - a.influence)
      .map((s) => `${s.name} (${s.category}, proficiency: ${s.proficiency.toFixed(2)})`)
      .join(", ");

    // The actual LLM call would happen here via the AI module
    // For now, return a default "observe" decision
    // The real implementation will use the agent's systemPrompt + context
    // to generate a decision via the configured AI provider

    const decision: AgentDecision = {
      action: "hold",
      reasoning: "Observing market conditions and gathering data before taking action.",
      confidence: 0.3,
      skillsUsed: [],
    };

    this.log("debug", `Organism ${organismId} decided: ${decision.action}`, {
      confidence: decision.confidence,
      reasoning: decision.reasoning,
    });

    return decision;
  }

  /**
   * EXECUTE: Carry out the agent's decision.
   * This is where real on-chain transactions happen.
   */
  private async execute(
    organismId: string,
    decision: AgentDecision,
  ): Promise<void> {
    if (decision.action === "hold" || decision.action === "rest") {
      return; // Nothing to execute
    }

    const runtime = this.state.organisms.get(organismId);
    if (!runtime) return;

    if (decision.action === "buy" || decision.action === "sell") {
      if (!decision.execution) {
        this.log("warn", `Organism ${organismId} decided to ${decision.action} but no execution params`);
        return;
      }

      if (this.config.liveTrading) {
        // Real on-chain execution
        const result = await this.executeTrade(organismId, decision.execution);
        this.emit("trade:executed", organismId, decision.execution, result);

        if (result.success) {
          runtime.periodMetrics.trades++;
          runtime.periodMetrics.wins++;
          this.state.totalTrades++;
        } else {
          runtime.periodMetrics.trades++;
          runtime.periodMetrics.losses++;
          this.emit("trade:failed", organismId, decision.execution, result.error ?? "Unknown error");
        }
      } else {
        // Simulation mode — log the decision but don't execute
        this.log("debug", `[SIM] Organism ${organismId} would ${decision.execution.direction} ${decision.execution.amount} of ${decision.execution.symbol}`);
        runtime.periodMetrics.trades++;
      }
    }

    if (decision.action === "observe" && decision.interactionTarget) {
      // Record interaction
      const count = runtime.recentInteractions.get(decision.interactionTarget) ?? 0;
      runtime.recentInteractions.set(decision.interactionTarget, count + 1);
      runtime.periodMetrics.interactions++;

      this.emit("interaction:started", organismId, decision.interactionTarget, "observe");

      // Check composition threshold
      await this.checkCompositionThreshold(organismId, decision.interactionTarget);
    }

    if (decision.action === "invest" && decision.execution) {
      // Agent investing in another agent's token
      this.log("info", `Organism ${organismId} investing in ${decision.execution.mint}`);
      // This would call the PumpFun buy instruction for the target agent's token
    }
  }

  /**
   * REFLECT: Update skills, learn from outcomes.
   * This is how agents improve over time.
   */
  private async reflect(
    organismId: string,
    decision: AgentDecision,
  ): Promise<void> {
    const runtime = this.state.organisms.get(organismId);
    if (!runtime) return;

    // Update skill usage counts
    for (const skillId of decision.skillsUsed) {
      const skill = runtime.activeSkills.get(skillId);
      if (skill) {
        skill.sessionUsageCount++;
        // Proficiency grows slowly with usage
        skill.proficiency = Math.min(1, skill.proficiency + 0.001);
        skill.influence = skill.proficiency * 5;
      }
    }

    // Check for dormancy (low balance)
    // This would check the actual on-chain balance
    // For now, dormancy is triggered by consecutive errors
  }

  // ─── Trading Execution ────────────────────────────────────

  /**
   * Execute a real on-chain trade via the PumpFun SDK.
   * This is the bridge between the AI brain and the blockchain.
   */
  private async executeTrade(
    organismId: string,
    execution: { mint: string; symbol: string; direction: string; amount: string; maxSlippageBps: number },
  ): Promise<TradeResult> {
    // This will be wired to the trading agent
    // For now, return a placeholder result
    return {
      success: false,
      error: "Live trading not yet connected",
      executedAt: Date.now(),
    };
  }

  // ─── Composition ──────────────────────────────────────────

  /**
   * Check if two organisms have interacted enough to trigger composition.
   * Composition = two agents merging skills to create a new organism.
   */
  private async checkCompositionThreshold(
    organismA: string,
    organismB: string,
  ): Promise<void> {
    const runtimeA = this.state.organisms.get(organismA);
    if (!runtimeA) return;

    const interactionCount = runtimeA.recentInteractions.get(organismB) ?? 0;
    if (interactionCount >= this.config.compositionInteractionThreshold) {
      this.log("info", `Composition threshold reached between ${organismA} and ${organismB}`);
      this.emit("composition:triggered", [organismA, organismB]);
      // Actual composition logic would create a new organism with merged skills
    }
  }

  // ─── Periodic Tasks ───────────────────────────────────────

  /** Take a snapshot of the entire ecosystem state */
  private async takeSnapshot(): Promise<void> {
    const activeCount = [...this.state.organisms.values()].filter(
      (r) => r.phase !== "dormant" && r.phase !== "error",
    ).length;

    this.log("debug", "Ecosystem snapshot", {
      active: activeCount,
      total: this.state.organisms.size,
      globalTick: this.state.globalTick,
      totalTrades: this.state.totalTrades,
    });

    // Reset period metrics for all organisms
    for (const runtime of this.state.organisms.values()) {
      runtime.periodMetrics = this.createEmptyMetrics();
    }
  }

  /** Update the global leaderboard */
  private async updateLeaderboard(): Promise<void> {
    // Leaderboard update would read from DB and compute rankings
    this.emit("leaderboard:updated");
  }

  // ─── Getters ──────────────────────────────────────────────

  /** Get current ecosystem state summary */
  getState(): {
    running: boolean;
    organismCount: number;
    activeCount: number;
    totalTrades: number;
    globalTick: number;
    uptimeSeconds: number;
  } {
    const activeCount = [...this.state.organisms.values()].filter(
      (r) => r.phase !== "dormant" && r.phase !== "error",
    ).length;

    return {
      running: this.state.running,
      organismCount: this.state.organisms.size,
      activeCount,
      totalTrades: this.state.totalTrades,
      globalTick: this.state.globalTick,
      uptimeSeconds: Math.floor((Date.now() - this.state.startedAt) / 1000),
    };
  }

  /** Get a specific organism's runtime state */
  getOrganismRuntime(organismId: string): OrganismRuntime | undefined {
    return this.state.organisms.get(organismId);
  }

  /** Get all organism IDs */
  getOrganismIds(): string[] {
    return [...this.state.organisms.keys()];
  }

  // ─── Helpers ──────────────────────────────────────────────

  private createEmptyContext(): DecisionContext {
    return {
      marketSummary: "",
      availableBalanceLamports: "0",
      positionsSummary: "",
      performanceSummary: "",
      topObservations: [],
      agentActivity: [],
      riskLevel: "medium",
    };
  }

  private createEmptyMetrics(): PeriodMetrics {
    return {
      trades: 0,
      wins: 0,
      losses: 0,
      pnlLamports: "0",
      skillOutcomes: new Map(),
      observationsProcessed: 0,
      interactions: 0,
      computeUnits: 0,
      periodStartMs: Date.now(),
    };
  }

  /** Hash a system prompt for content-addressing */
  static hashPrompt(prompt: string): string {
    return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
  }

  private log(level: string, message: string, data?: Record<string, unknown>): void {
    const levels = ["debug", "info", "warn", "error"];
    const configLevel = levels.indexOf(this.config.logLevel);
    const msgLevel = levels.indexOf(level);

    if (msgLevel >= configLevel) {
      const prefix = `[ecosystem:${level}]`;
      if (data) {
        console.log(prefix, message, JSON.stringify(data));
      } else {
        console.log(prefix, message);
      }
    }
  }
}

// ─── Export ──────────────────────────────────────────────────

export { EcosystemEngine as default };
