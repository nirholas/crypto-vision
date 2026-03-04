/**
 * Strategy Brain — AI Decision Engine for the Swarm
 *
 * The central intelligence that decides:
 *   1. Should we launch a new token or buy an existing one?
 *   2. Which trading strategy fits current conditions?
 *   3. When to switch phases (accumulate → graduate → exit)?
 *
 * Uses OpenRouter LLM calls for complex strategic reasoning
 * and rule-based heuristics for fast tactical decisions.
 */

import type { Connection } from '@solana/web3.js';

import type {
  BondingCurveState,
  TradingStrategy,
} from '../types.js';
import {
  PRESET_STRATEGIES,
  STRATEGY_EXIT,
  STRATEGY_GRADUATION,
  STRATEGY_ORGANIC,
  STRATEGY_VOLUME,
} from '../strategies.js';
import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Configuration ────────────────────────────────────────────

export interface StrategyBrainConfig {
  /** OpenRouter API key */
  openRouterApiKey: string;
  /** Model to use for strategic reasoning */
  model: string;
  /** OpenRouter API base URL */
  apiBaseUrl: string;
  /** Max tokens for LLM response */
  maxTokens: number;
  /** Temperature for creativity vs consistency */
  temperature: number;
  /** Risk tolerance: 0-1 (0 = ultra conservative, 1 = degen) */
  riskTolerance: number;
  /** Minimum confidence score to act (0-1) */
  minConfidence: number;
  /** Maximum SOL budget per decision */
  maxBudgetPerAction: number;
  /** Cache TTL for market context (ms) */
  contextCacheTtl: number;
}

/** Sensible defaults for StrategyBrainConfig */
export const DEFAULT_STRATEGY_BRAIN_CONFIG: Omit<StrategyBrainConfig, 'openRouterApiKey'> = {
  model: 'google/gemini-2.0-flash-001',
  apiBaseUrl: 'https://openrouter.ai/api/v1',
  maxTokens: 2000,
  temperature: 0.3,
  riskTolerance: 0.5,
  minConfidence: 0.6,
  maxBudgetPerAction: 5, // SOL
  contextCacheTtl: 30_000, // 30 seconds
};

// ─── Market Context ───────────────────────────────────────────

export interface MarketContext {
  /** SOL price in USD */
  solPrice: number;
  /** SOL 24h price change percent */
  solPriceChange24h: number;
  /** Pump.fun new launches in last hour */
  recentLaunchCount: number;
  /** Pump.fun graduation rate in last 24h */
  graduationRate: number;
  /** Trending narrative categories */
  trendingNarratives: string[];
  /** Fear & Greed index (0-100) */
  fearGreedIndex: number;
  /** Current swarm portfolio value in SOL */
  portfolioValue: number;
  /** Available SOL budget */
  availableBudget: number;
  /** Active positions count */
  activePositions: number;
  /** Current market regime */
  regime: 'bull' | 'bear' | 'crab' | 'euphoria' | 'capitulation';
  /** Top alpha opportunities detected */
  alphaOpportunities: Array<{ mint: string; name: string; score: number }>;
  /** Timestamp */
  timestamp: number;
}

// ─── Decision Types ───────────────────────────────────────────

export interface StrategyDecision {
  /** What action to take */
  action: 'launch-new' | 'buy-existing' | 'adjust-strategy' | 'exit-position' | 'hold' | 'wait';
  /** Confidence 0-1 */
  confidence: number;
  /** Human-readable reasoning */
  reasoning: string;
  /** If launch-new: narrative details */
  launchParams?: {
    narrative: string;
    category: string;
    suggestedBudget: number;
    suggestedStrategy: string;
  };
  /** If buy-existing: target token */
  buyParams?: {
    mint: string;
    suggestedAmount: number;
    urgency: 'immediate' | 'soon' | 'watch';
  };
  /** If adjust-strategy: new parameters */
  strategyAdjustment?: {
    newStrategy: string;
    changes: Record<string, unknown>;
    reason: string;
  };
  /** If exit-position: which to exit */
  exitParams?: {
    mint: string;
    exitStrategy: 'gradual' | 'immediate' | 'trailing-stop';
    reason: string;
  };
  /** Timestamp of decision */
  decidedAt: number;
  /** Model used */
  model: string;
}

export interface TokenAssessment {
  mint: string;
  overallScore: number;
  scores: {
    bondingCurveHealth: number;
    volumeQuality: number;
    holderDistribution: number;
    narrativeStrength: number;
    /** Higher = SAFER (inverted rug risk) */
    rugRisk: number;
    momentumScore: number;
  };
  recommendation: 'strong-buy' | 'buy' | 'hold' | 'avoid' | 'strong-avoid';
  reasoning: string;
  assessedAt: number;
}

export interface LaunchDecision {
  shouldLaunch: boolean;
  confidence: number;
  reasoning: string;
  suggestedTiming: 'now' | 'wait-1h' | 'wait-4h' | 'wait-24h' | 'dont';
  riskAssessment: string;
  estimatedSuccessProbability: number;
}

export interface BuyDecision {
  shouldBuy: boolean;
  confidence: number;
  reasoning: string;
  suggestedAmount: number;
  suggestedEntry: 'market' | 'limit' | 'dca';
  riskAssessment: string;
  /** Target price multiple (e.g., 2.0 = 2x) */
  targetExit: number;
  /** Stop-loss price multiple (e.g., 0.7 = -30%) */
  stopLoss: number;
}

export interface SwarmMetricsInput {
  totalTrades: number;
  totalVolume: number;
  activeTradersCount: number;
  averageTradeSize: number;
  buyToSellRatio: number;
  currentPhase: string;
  phaseElapsedMs: number;
  walletCount: number;
}

export interface PerformanceMetrics {
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  /** Percentage return-on-investment */
  roi: number;
  /** Percentage from peak */
  maxDrawdown: number;
  /** Percentage of profitable trades */
  winRate: number;
  sharpeRatio: number;
  avgTradeProfit: number;
  bestTrade: number;
  worstTrade: number;
  /** Duration in ms */
  tradingDuration: number;
}

// ─── LLM Response Schema ─────────────────────────────────────

interface LLMDecisionResponse {
  action: StrategyDecision['action'];
  confidence: number;
  reasoning: string;
  launchParams?: StrategyDecision['launchParams'];
  buyParams?: StrategyDecision['buyParams'];
  strategyAdjustment?: StrategyDecision['strategyAdjustment'];
  exitParams?: StrategyDecision['exitParams'];
}

interface LLMTokenAssessmentResponse {
  overallScore: number;
  scores: TokenAssessment['scores'];
  recommendation: TokenAssessment['recommendation'];
  reasoning: string;
}

interface LLMLaunchResponse {
  shouldLaunch: boolean;
  confidence: number;
  reasoning: string;
  suggestedTiming: LaunchDecision['suggestedTiming'];
  riskAssessment: string;
  estimatedSuccessProbability: number;
}

interface LLMBuyResponse {
  shouldBuy: boolean;
  confidence: number;
  reasoning: string;
  suggestedAmount: number;
  suggestedEntry: BuyDecision['suggestedEntry'];
  riskAssessment: string;
  targetExit: number;
  stopLoss: number;
}

// ─── Constants ────────────────────────────────────────────────

const MAX_DECISION_HISTORY = 500;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const HTTP_REFERER = 'https://crypto-vision.dev';
const X_TITLE = 'CryptoVision Swarm';

const SYSTEM_PROMPT = `You are SWARM-STRATEGIST, an elite crypto-native AI strategist operating a memecoin trading swarm on Pump.fun (Solana).

Your role: Analyze market conditions, bonding curve data, and portfolio metrics to make high-quality trading decisions.

Core principles:
1. CAPITAL PRESERVATION first — never risk more than the budget allows
2. NARRATIVE TIMING — memecoins are narrative-driven; launch during peak hype, not dead markets
3. BONDING CURVE AWARENESS — understand graduation mechanics (85 SOL threshold), supply distribution, and price impact
4. RISK-ADJUSTED RETURNS — prefer 3x with 70% probability over 10x with 10% probability
5. MARKET REGIME AWARENESS — be aggressive in bull/euphoria, defensive in bear/capitulation, selective in crab
6. ANTI-DETECTION — recommend trading patterns that look organic, not botted

Decision framework:
- In BULL/EUPHORIA: favor launching new tokens with trending narratives, aggressive accumulation
- In BEAR/CAPITULATION: hold cash, only snipe extreme undervalued opportunities, exit weak positions
- In CRAB: volume generation for existing positions, wait for narrative catalysts before launching
- ALWAYS consider: available budget, current positions, portfolio concentration risk

You MUST respond with valid JSON matching the requested schema. No markdown, no explanations outside JSON.`;

// ─── Strategy Brain ───────────────────────────────────────────

export class StrategyBrain {
  private readonly config: StrategyBrainConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;
  private readonly decisionHistory: StrategyDecision[] = [];
  private cachedDecision: { decision: StrategyDecision; expiresAt: number } | null = null;

  constructor(config: StrategyBrainConfig, eventBus: SwarmEventBus) {
    this.config = { ...DEFAULT_STRATEGY_BRAIN_CONFIG, ...config };
    this.eventBus = eventBus;
    this.logger = SwarmLogger.create('strategy-brain', 'intelligence');
  }

  // ─── Main Decision Method ────────────────────────────────────

  /**
   * Main entry point: analyze market context and decide what
   * the swarm should do next.
   */
  async decideAction(context: MarketContext): Promise<StrategyDecision> {
    // Return cached decision if still valid
    if (this.cachedDecision && Date.now() < this.cachedDecision.expiresAt) {
      this.logger.debug('Returning cached decision', {
        action: this.cachedDecision.decision.action,
        expiresIn: this.cachedDecision.expiresAt - Date.now(),
      });
      return this.cachedDecision.decision;
    }

    this.logger.info('Evaluating market context for next action', {
      regime: context.regime,
      solPrice: context.solPrice,
      budget: context.availableBudget,
      positions: context.activePositions,
    });

    // Apply fast rule-based overrides before calling LLM
    const ruleBasedDecision = this.applyRuleBasedOverrides(context);
    if (ruleBasedDecision) {
      this.recordDecision(ruleBasedDecision);
      return ruleBasedDecision;
    }

    // Call LLM for complex strategic reasoning
    const userPrompt = JSON.stringify({
      task: 'decide_action',
      marketContext: context,
      riskTolerance: this.config.riskTolerance,
      maxBudget: this.config.maxBudgetPerAction,
      minConfidence: this.config.minConfidence,
      recentDecisions: this.decisionHistory.slice(-5).map((d) => ({
        action: d.action,
        confidence: d.confidence,
        reasoning: d.reasoning,
        decidedAt: d.decidedAt,
      })),
      instructions: `Analyze the market context and decide the best action for the swarm.
Return JSON with shape: { action, confidence, reasoning, launchParams?, buyParams?, strategyAdjustment?, exitParams? }
action must be one of: "launch-new", "buy-existing", "adjust-strategy", "exit-position", "hold", "wait"
confidence must be 0-1. Only recommend actions with confidence >= ${this.config.minConfidence}.
If no good opportunity exists, return action "wait" with reasoning.`,
    });

    const llmResponse = await this.callLLM<LLMDecisionResponse>(userPrompt);

    if (llmResponse) {
      const decision: StrategyDecision = {
        action: llmResponse.action,
        confidence: clamp(llmResponse.confidence, 0, 1),
        reasoning: llmResponse.reasoning,
        launchParams: llmResponse.launchParams,
        buyParams: llmResponse.buyParams,
        strategyAdjustment: llmResponse.strategyAdjustment,
        exitParams: llmResponse.exitParams,
        decidedAt: Date.now(),
        model: this.config.model,
      };

      // Enforce minimum confidence
      if (decision.confidence < this.config.minConfidence) {
        const waitDecision = this.makeWaitDecision(
          `LLM confidence ${decision.confidence.toFixed(2)} below threshold ${this.config.minConfidence}. Original: ${decision.reasoning}`,
        );
        this.recordDecision(waitDecision);
        return waitDecision;
      }

      // Enforce budget limits
      if (decision.launchParams && decision.launchParams.suggestedBudget > this.config.maxBudgetPerAction) {
        decision.launchParams.suggestedBudget = this.config.maxBudgetPerAction;
        decision.reasoning += ` [Budget capped to ${this.config.maxBudgetPerAction} SOL]`;
      }
      if (decision.buyParams && decision.buyParams.suggestedAmount > this.config.maxBudgetPerAction) {
        decision.buyParams.suggestedAmount = this.config.maxBudgetPerAction;
        decision.reasoning += ` [Amount capped to ${this.config.maxBudgetPerAction} SOL]`;
      }

      this.recordDecision(decision);
      return decision;
    }

    // Fallback to rule-based if LLM fails
    this.logger.warn('LLM call failed, falling back to rule-based decision');
    const fallback = this.makeFallbackDecision(context);
    this.recordDecision(fallback);
    return fallback;
  }

  // ─── Token Evaluation ────────────────────────────────────────

  /**
   * Deep evaluation of a specific token using on-chain data + LLM analysis.
   */
  async evaluateToken(mint: string, connection: Connection): Promise<TokenAssessment> {
    this.logger.info('Evaluating token', { mint });

    // Fetch on-chain bonding curve state
    const curveState = await this.fetchBondingCurveState(mint, connection);

    const userPrompt = JSON.stringify({
      task: 'evaluate_token',
      mint,
      bondingCurve: curveState
        ? {
            currentPriceSol: curveState.currentPriceSol,
            marketCapSol: curveState.marketCapSol,
            graduationProgress: curveState.graduationProgress,
            complete: curveState.complete,
          }
        : null,
      instructions: `Evaluate this token for investment potential.
Return JSON: { overallScore (0-100), scores: { bondingCurveHealth, volumeQuality, holderDistribution, narrativeStrength, rugRisk (higher=SAFER), momentumScore } (all 0-100), recommendation ("strong-buy"|"buy"|"hold"|"avoid"|"strong-avoid"), reasoning }
If bonding curve data is null, make conservative estimates and note the uncertainty.`,
    });

    const llmResponse = await this.callLLM<LLMTokenAssessmentResponse>(userPrompt);

    if (llmResponse) {
      return {
        mint,
        overallScore: clamp(llmResponse.overallScore, 0, 100),
        scores: {
          bondingCurveHealth: clamp(llmResponse.scores.bondingCurveHealth, 0, 100),
          volumeQuality: clamp(llmResponse.scores.volumeQuality, 0, 100),
          holderDistribution: clamp(llmResponse.scores.holderDistribution, 0, 100),
          narrativeStrength: clamp(llmResponse.scores.narrativeStrength, 0, 100),
          rugRisk: clamp(llmResponse.scores.rugRisk, 0, 100),
          momentumScore: clamp(llmResponse.scores.momentumScore, 0, 100),
        },
        recommendation: llmResponse.recommendation,
        reasoning: llmResponse.reasoning,
        assessedAt: Date.now(),
      };
    }

    // Fallback: conservative assessment if LLM fails
    this.logger.warn('LLM evaluation failed, returning conservative assessment', { mint });
    return this.makeConservativeAssessment(mint, curveState);
  }

  // ─── Launch Decision ────────────────────────────────────────

  /**
   * Should we launch a new token with this narrative?
   */
  async shouldLaunch(narrative: string, marketContext: MarketContext): Promise<LaunchDecision> {
    this.logger.info('Evaluating launch decision', { narrative, regime: marketContext.regime });

    // Hard rule: never launch in capitulation
    if (marketContext.regime === 'capitulation') {
      return {
        shouldLaunch: false,
        confidence: 0.95,
        reasoning: 'Market is in capitulation — launching tokens now has extremely low success probability.',
        suggestedTiming: 'dont',
        riskAssessment: 'EXTREME RISK: Market-wide selloff, no buyer demand.',
        estimatedSuccessProbability: 0.02,
      };
    }

    // Hard rule: insufficient budget
    if (marketContext.availableBudget < 1) {
      return {
        shouldLaunch: false,
        confidence: 0.99,
        reasoning: `Insufficient budget (${marketContext.availableBudget.toFixed(2)} SOL). Need at least 1 SOL for a viable launch.`,
        suggestedTiming: 'dont',
        riskAssessment: 'Cannot fund launch — budget too low.',
        estimatedSuccessProbability: 0,
      };
    }

    const userPrompt = JSON.stringify({
      task: 'should_launch',
      narrative,
      marketContext: {
        regime: marketContext.regime,
        solPrice: marketContext.solPrice,
        solPriceChange24h: marketContext.solPriceChange24h,
        recentLaunchCount: marketContext.recentLaunchCount,
        graduationRate: marketContext.graduationRate,
        trendingNarratives: marketContext.trendingNarratives,
        fearGreedIndex: marketContext.fearGreedIndex,
        availableBudget: marketContext.availableBudget,
        activePositions: marketContext.activePositions,
      },
      riskTolerance: this.config.riskTolerance,
      instructions: `Decide whether to launch a new memecoin with the given narrative.
Consider: Is this narrative trending? Is the market receptive? Is the timing right?
Return JSON: { shouldLaunch (bool), confidence (0-1), reasoning, suggestedTiming ("now"|"wait-1h"|"wait-4h"|"wait-24h"|"dont"), riskAssessment, estimatedSuccessProbability (0-1) }`,
    });

    const llmResponse = await this.callLLM<LLMLaunchResponse>(userPrompt);

    if (llmResponse) {
      return {
        shouldLaunch: llmResponse.shouldLaunch,
        confidence: clamp(llmResponse.confidence, 0, 1),
        reasoning: llmResponse.reasoning,
        suggestedTiming: llmResponse.suggestedTiming,
        riskAssessment: llmResponse.riskAssessment,
        estimatedSuccessProbability: clamp(llmResponse.estimatedSuccessProbability, 0, 1),
      };
    }

    // Fallback: conservative launch decision
    return this.makeFallbackLaunchDecision(narrative, marketContext);
  }

  // ─── Buy Decision ───────────────────────────────────────────

  /**
   * Should we buy into an existing token?
   */
  async shouldBuyExisting(mint: string, marketContext: MarketContext): Promise<BuyDecision> {
    this.logger.info('Evaluating buy decision', { mint, regime: marketContext.regime });

    // Hard rule: no buying in extreme fear
    if (marketContext.fearGreedIndex < 10) {
      return {
        shouldBuy: false,
        confidence: 0.9,
        reasoning: 'Extreme fear (F&G < 10) — not a safe time to enter new positions.',
        suggestedAmount: 0,
        suggestedEntry: 'dca',
        riskAssessment: 'Market extremely fearful, high risk of further decline.',
        targetExit: 1,
        stopLoss: 1,
      };
    }

    // Hard rule: insufficient budget
    if (marketContext.availableBudget < 0.1) {
      return {
        shouldBuy: false,
        confidence: 0.99,
        reasoning: `Insufficient budget (${marketContext.availableBudget.toFixed(3)} SOL). Need at least 0.1 SOL.`,
        suggestedAmount: 0,
        suggestedEntry: 'market',
        riskAssessment: 'Cannot afford entry — budget depleted.',
        targetExit: 1,
        stopLoss: 1,
      };
    }

    const userPrompt = JSON.stringify({
      task: 'should_buy',
      mint,
      marketContext: {
        regime: marketContext.regime,
        solPrice: marketContext.solPrice,
        fearGreedIndex: marketContext.fearGreedIndex,
        availableBudget: marketContext.availableBudget,
        activePositions: marketContext.activePositions,
        portfolioValue: marketContext.portfolioValue,
      },
      riskTolerance: this.config.riskTolerance,
      maxBudget: Math.min(this.config.maxBudgetPerAction, marketContext.availableBudget),
      instructions: `Decide whether to buy this existing token.
Return JSON: { shouldBuy (bool), confidence (0-1), reasoning, suggestedAmount (SOL), suggestedEntry ("market"|"limit"|"dca"), riskAssessment, targetExit (price multiple, e.g. 2.0=2x), stopLoss (price multiple, e.g. 0.7=-30%) }
suggestedAmount must not exceed ${Math.min(this.config.maxBudgetPerAction, marketContext.availableBudget)} SOL.`,
    });

    const llmResponse = await this.callLLM<LLMBuyResponse>(userPrompt);

    if (llmResponse) {
      const maxAmount = Math.min(this.config.maxBudgetPerAction, marketContext.availableBudget);
      return {
        shouldBuy: llmResponse.shouldBuy,
        confidence: clamp(llmResponse.confidence, 0, 1),
        reasoning: llmResponse.reasoning,
        suggestedAmount: Math.min(llmResponse.suggestedAmount, maxAmount),
        suggestedEntry: llmResponse.suggestedEntry,
        riskAssessment: llmResponse.riskAssessment,
        targetExit: Math.max(llmResponse.targetExit, 1),
        stopLoss: clamp(llmResponse.stopLoss, 0, 1),
      };
    }

    // Fallback
    return this.makeFallbackBuyDecision(marketContext);
  }

  // ─── Strategy Selection (Fast Path) ──────────────────────────

  /**
   * Pick the right trading strategy for current conditions.
   * This is the fast, non-LLM path used for real-time adjustments.
   */
  selectStrategy(phase: string, metrics: SwarmMetricsInput): TradingStrategy {
    this.logger.debug('Selecting strategy', { phase, totalTrades: metrics.totalTrades });

    // Phase-based selection
    switch (phase) {
      case 'minting':
      case 'bundling':
      case 'distributing':
        return STRATEGY_ORGANIC;

      case 'trading':
      case 'market_making': {
        // If volume is anemic, switch to volume generation
        if (metrics.totalVolume < 0.5 && metrics.phaseElapsedMs > 300_000) {
          this.logger.info('Low volume detected, switching to VOLUME strategy');
          return STRATEGY_VOLUME;
        }
        // Default to organic for early trading
        if (metrics.phaseElapsedMs < 600_000) {
          return STRATEGY_ORGANIC;
        }
        return STRATEGY_VOLUME;
      }

      case 'accumulating':
        return STRATEGY_ORGANIC;

      case 'graduating':
        return STRATEGY_GRADUATION;

      case 'exiting':
      case 'emergency_exit':
        return STRATEGY_EXIT;

      default:
        return STRATEGY_ORGANIC;
    }
  }

  /**
   * Fine-tune strategy based on performance results.
   * Adjusts parameters within the current strategy template.
   */
  adjustStrategy(
    currentStrategy: TradingStrategy,
    performance: PerformanceMetrics,
  ): TradingStrategy {
    this.logger.info('Adjusting strategy based on performance', {
      strategy: currentStrategy.id,
      roi: performance.roi,
      winRate: performance.winRate,
      maxDrawdown: performance.maxDrawdown,
    });

    // Hard override: if losing > 20%, switch to EXIT
    if (performance.roi < -20) {
      this.logger.warn('Portfolio down >20%, overriding to EXIT strategy', {
        roi: performance.roi,
      });
      this.emitEvent('strategy:override', {
        from: currentStrategy.id,
        to: 'exit',
        reason: `ROI at ${performance.roi.toFixed(1)}%, exceeds -20% threshold`,
      });
      return STRATEGY_EXIT;
    }

    // Hard override: if strongly positive momentum, push toward graduation
    if (performance.roi > 50 && performance.winRate > 0.7) {
      this.logger.info('Strong momentum detected, switching to GRADUATION strategy', {
        roi: performance.roi,
        winRate: performance.winRate,
      });
      this.emitEvent('strategy:override', {
        from: currentStrategy.id,
        to: 'graduation',
        reason: `ROI at ${performance.roi.toFixed(1)}% with ${(performance.winRate * 100).toFixed(0)}% win rate`,
      });
      return STRATEGY_GRADUATION;
    }

    // Moderate adjustments: clone current strategy with tweaks
    const adjusted = { ...currentStrategy };

    // If win rate is low, reduce trade sizes and increase intervals
    if (performance.winRate < 0.4) {
      adjusted.buySellRatio = Math.max(adjusted.buySellRatio * 0.8, 0.2);
      adjusted.maxIntervalSeconds = Math.min(adjusted.maxIntervalSeconds * 1.5, 300);
      this.logger.info('Low win rate, reducing aggression', {
        newRatio: adjusted.buySellRatio,
        newMaxInterval: adjusted.maxIntervalSeconds,
      });
    }

    // If max drawdown is concerning, tighten the risk
    if (performance.maxDrawdown > 15) {
      adjusted.buySellRatio = Math.max(adjusted.buySellRatio * 0.9, 0.3);
      this.logger.info('High drawdown, tightening risk', {
        drawdown: performance.maxDrawdown,
        newRatio: adjusted.buySellRatio,
      });
    }

    // If Sharpe ratio is negative, we're generating noise not alpha
    if (performance.sharpeRatio < 0) {
      adjusted.minIntervalSeconds = Math.min(adjusted.minIntervalSeconds * 2, 120);
      this.logger.info('Negative Sharpe, slowing trade frequency', {
        sharpe: performance.sharpeRatio,
        newMinInterval: adjusted.minIntervalSeconds,
      });
    }

    return adjusted;
  }

  // ─── Decision History ────────────────────────────────────────

  /**
   * Past decisions for learning and analysis.
   */
  getDecisionHistory(): StrategyDecision[] {
    return [...this.decisionHistory];
  }

  // ─── Private: LLM Integration ───────────────────────────────

  /**
   * Call OpenRouter API with retry and exponential backoff.
   */
  private async callLLM<T>(userPrompt: string): Promise<T | null> {
    const url = `${this.config.apiBaseUrl}/chat/completions`;
    const body = {
      model: this.config.model,
      messages: [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        { role: 'user' as const, content: userPrompt },
      ],
      response_format: { type: 'json_object' as const },
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        this.logger.debug('Calling OpenRouter API', {
          model: this.config.model,
          attempt: attempt + 1,
          promptLength: userPrompt.length,
        });

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': HTTP_REFERER,
            'X-Title': X_TITLE,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'unknown error');
          this.logger.warn('OpenRouter API error', {
            status: response.status,
            statusText: response.statusText,
            body: errorText.slice(0, 500),
            attempt: attempt + 1,
          });

          // Don't retry on auth errors
          if (response.status === 401 || response.status === 403) {
            this.logger.error('Authentication failed — check OPENROUTER_API_KEY');
            return null;
          }

          // Don't retry on invalid request
          if (response.status === 400) {
            this.logger.error('Bad request to OpenRouter', { body: errorText.slice(0, 200) });
            return null;
          }

          // Retry on rate-limit and server errors
          if (attempt < MAX_RETRIES - 1) {
            const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
            this.logger.info(`Retrying in ${delay}ms`, { attempt: attempt + 1 });
            await sleep(delay);
            continue;
          }
          return null;
        }

        const json = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          error?: { message?: string };
        };

        if (json.error) {
          this.logger.warn('OpenRouter returned error in body', { error: json.error.message });
          return null;
        }

        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          this.logger.warn('No content in OpenRouter response');
          return null;
        }

        const parsed = JSON.parse(content) as T;
        this.logger.debug('LLM response parsed successfully');
        return parsed;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn('OpenRouter call failed', { error: errMsg, attempt: attempt + 1 });

        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }

    this.logger.error('All OpenRouter retries exhausted');
    return null;
  }

  // ─── Private: On-chain Data ─────────────────────────────────

  /**
   * Fetch bonding curve state from on-chain accounts.
   * Returns null if the account doesn't exist or can't be parsed.
   */
  private async fetchBondingCurveState(
    mint: string,
    connection: Connection,
  ): Promise<BondingCurveState | null> {
    try {
      const { PublicKey } = await import('@solana/web3.js');
      const BN = (await import('bn.js')).default;

      // Pump.fun program ID
      const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

      // Derive bonding curve PDA
      const mintPubkey = new PublicKey(mint);
      const [bondingCurvePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding-curve'), mintPubkey.toBuffer()],
        PUMP_PROGRAM_ID,
      );

      const accountInfo = await connection.getAccountInfo(bondingCurvePda);
      if (!accountInfo || !accountInfo.data || accountInfo.data.length < 49) {
        this.logger.debug('Bonding curve account not found or too small', { mint });
        return null;
      }

      // Parse bonding curve account data
      // Layout: discriminator(8) + virtualTokenReserves(8) + virtualSolReserves(8) +
      //         realTokenReserves(8) + realSolReserves(8) + tokenTotalSupply(8) + complete(1)
      const data = accountInfo.data;
      const virtualTokenReserves = new BN(data.subarray(8, 16), 'le');
      const virtualSolReserves = new BN(data.subarray(16, 24), 'le');
      const realTokenReserves = new BN(data.subarray(24, 32), 'le');
      const realSolReserves = new BN(data.subarray(32, 40), 'le');
      const complete = data[48] === 1;

      // Calculate derived values
      const LAMPORTS = 1_000_000_000;
      const currentPriceSol = virtualTokenReserves.isZero()
        ? 0
        : virtualSolReserves.toNumber() / (virtualTokenReserves.toNumber() || 1);
      const marketCapSol = realSolReserves.toNumber() / LAMPORTS;
      const GRADUATION_THRESHOLD = 85; // SOL
      const graduationProgress = Math.min(
        (marketCapSol / GRADUATION_THRESHOLD) * 100,
        100,
      );

      return {
        mint,
        virtualSolReserves,
        virtualTokenReserves,
        realSolReserves,
        realTokenReserves,
        complete,
        currentPriceSol,
        marketCapSol,
        graduationProgress,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('Failed to fetch bonding curve state', { mint, error: errMsg });
      return null;
    }
  }

  // ─── Private: Rule-Based Overrides ──────────────────────────

  /**
   * Fast rule-based checks that don't need LLM.
   * Returns a decision if rules trigger, null otherwise (defer to LLM).
   */
  private applyRuleBasedOverrides(context: MarketContext): StrategyDecision | null {
    // Emergency: no budget at all
    if (context.availableBudget <= 0) {
      return {
        action: 'hold',
        confidence: 1,
        reasoning: 'No available budget. Cannot take any action.',
        decidedAt: Date.now(),
        model: 'rule-engine',
      };
    }

    // Emergency: capitulation market with active positions → exit
    if (context.regime === 'capitulation' && context.activePositions > 0) {
      return {
        action: 'exit-position',
        confidence: 0.85,
        reasoning: 'Market in capitulation with active positions — recommend exiting to preserve capital.',
        exitParams: {
          mint: context.alphaOpportunities[0]?.mint ?? 'all',
          exitStrategy: 'gradual',
          reason: 'Capitulation regime detected',
        },
        decidedAt: Date.now(),
        model: 'rule-engine',
      };
    }

    // Euphoria + top alpha opportunity → immediate buy if budget allows
    if (
      context.regime === 'euphoria' &&
      context.alphaOpportunities.length > 0 &&
      context.alphaOpportunities[0].score > 80 &&
      context.availableBudget >= 0.5
    ) {
      const top = context.alphaOpportunities[0];
      return {
        action: 'buy-existing',
        confidence: 0.75,
        reasoning: `Euphoria market with high-score alpha opportunity: ${top.name} (score: ${top.score})`,
        buyParams: {
          mint: top.mint,
          suggestedAmount: Math.min(this.config.maxBudgetPerAction * 0.5, context.availableBudget),
          urgency: 'immediate',
        },
        decidedAt: Date.now(),
        model: 'rule-engine',
      };
    }

    return null;
  }

  // ─── Private: Fallback Decisions ────────────────────────────

  private makeFallbackDecision(context: MarketContext): StrategyDecision {
    // Conservative fallback when LLM is unavailable
    if (context.regime === 'bear' || context.regime === 'capitulation') {
      return this.makeWaitDecision(
        'LLM unavailable, bearish/capitulation market — waiting for conditions to improve.',
      );
    }

    if (context.activePositions === 0 && context.availableBudget >= 1) {
      // No positions, have budget — suggest watching
      return {
        action: 'wait',
        confidence: 0.5,
        reasoning: 'LLM unavailable. Have budget but no positions — monitoring market for opportunities.',
        decidedAt: Date.now(),
        model: 'rule-engine-fallback',
      };
    }

    return {
      action: 'hold',
      confidence: 0.5,
      reasoning: 'LLM unavailable. Holding current positions and monitoring.',
      decidedAt: Date.now(),
      model: 'rule-engine-fallback',
    };
  }

  private makeFallbackLaunchDecision(
    _narrative: string,
    context: MarketContext,
  ): LaunchDecision {
    // Simple heuristics when LLM is down
    const bullish = context.regime === 'bull' || context.regime === 'euphoria';
    const hasBudget = context.availableBudget >= 2;
    const fearOk = context.fearGreedIndex > 40;

    if (bullish && hasBudget && fearOk) {
      return {
        shouldLaunch: true,
        confidence: 0.45,
        reasoning: 'LLM unavailable. Market appears bullish with sufficient budget — cautious launch recommended.',
        suggestedTiming: 'wait-1h',
        riskAssessment: 'Medium risk — proceeding without AI analysis. Wait for LLM to come back for better timing.',
        estimatedSuccessProbability: 0.3,
      };
    }

    return {
      shouldLaunch: false,
      confidence: 0.6,
      reasoning: 'LLM unavailable. Conditions uncertain — deferring launch until AI analysis is available.',
      suggestedTiming: 'wait-4h',
      riskAssessment: 'Cannot assess risk without AI — defaulting to conservative stance.',
      estimatedSuccessProbability: 0.15,
    };
  }

  private makeFallbackBuyDecision(context: MarketContext): BuyDecision {
    return {
      shouldBuy: false,
      confidence: 0.5,
      reasoning: 'LLM unavailable. Deferring buy decision until AI analysis is restored.',
      suggestedAmount: 0,
      suggestedEntry: 'dca',
      riskAssessment: 'Cannot properly assess — defaulting to no-buy.',
      targetExit: 2,
      stopLoss: 0.7,
    };
  }

  private makeWaitDecision(reasoning: string): StrategyDecision {
    return {
      action: 'wait',
      confidence: 0.5,
      reasoning,
      decidedAt: Date.now(),
      model: this.config.model,
    };
  }

  private makeConservativeAssessment(
    mint: string,
    curveState: BondingCurveState | null,
  ): TokenAssessment {
    // If we have curve data, derive some scores
    if (curveState) {
      const healthScore = curveState.complete ? 30 : Math.min(curveState.graduationProgress * 1.2, 80);
      return {
        mint,
        overallScore: 35,
        scores: {
          bondingCurveHealth: Math.round(healthScore),
          volumeQuality: 30,
          holderDistribution: 30,
          narrativeStrength: 30,
          rugRisk: 40,
          momentumScore: 30,
        },
        recommendation: 'hold',
        reasoning: 'LLM analysis unavailable — conservative assessment based on on-chain data only. Manual review recommended.',
        assessedAt: Date.now(),
      };
    }

    return {
      mint,
      overallScore: 20,
      scores: {
        bondingCurveHealth: 20,
        volumeQuality: 20,
        holderDistribution: 20,
        narrativeStrength: 20,
        rugRisk: 20,
        momentumScore: 20,
      },
      recommendation: 'avoid',
      reasoning: 'LLM unavailable and no on-chain data — cannot assess. Avoid until proper analysis is possible.',
      assessedAt: Date.now(),
    };
  }

  // ─── Private: Helpers ───────────────────────────────────────

  private recordDecision(decision: StrategyDecision): void {
    this.decisionHistory.push(decision);

    // Trim history if too long
    if (this.decisionHistory.length > MAX_DECISION_HISTORY) {
      this.decisionHistory.splice(0, this.decisionHistory.length - MAX_DECISION_HISTORY);
    }

    // Cache the decision
    this.cachedDecision = {
      decision,
      expiresAt: Date.now() + this.config.contextCacheTtl,
    };

    // Emit event
    this.emitEvent('strategy:decision', {
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      model: decision.model,
    });

    this.logger.info('Decision recorded', {
      action: decision.action,
      confidence: decision.confidence,
      model: decision.model,
      historySize: this.decisionHistory.length,
    });
  }

  private emitEvent(type: string, payload: Record<string, unknown>): void {
    try {
      this.eventBus.emit({
        id: crypto.randomUUID(),
        type,
        category: 'intelligence',
        source: 'strategy-brain',
        payload,
        timestamp: Date.now(),
      });
    } catch {
      // Non-critical — don't let event emission failures break the brain
    }
  }
}

// ─── Utility Functions ────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
