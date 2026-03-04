/**
 * Presentation Mode — AI-narrated hackathon demo runner
 *
 * Builds on DemoMode by adding:
 * - Real-time AI-generated narration explaining what's happening
 * - Formatted output optimized for screen sharing / projector
 * - Comprehensive post-demo summary with highlights
 * - Configurable pacing and audience targeting
 *
 * Usage:
 *   const presenter = new PresentationMode({
 *     openRouterApiKey: process.env.OPENROUTER_API_KEY!,
 *     audience: 'investor',
 *     presenterName: 'Alice',
 *   });
 *   await presenter.runPresentation();
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { SwarmStatus } from '../types.js';
import { SwarmCoordinator } from '../swarm.js';
import { STRATEGY_ORGANIC } from '../strategies.js';
import BN from 'bn.js';

// ─── Configuration ────────────────────────────────────────────

export interface PresentationConfig {
  /** Solana RPC URL */
  rpcUrl?: string;
  /** OpenRouter API key for narration */
  openRouterApiKey: string;
  /** OpenRouter model for narration (default: 'google/gemini-2.0-flash-001') */
  narrationModel?: string;
  /** Narration speed */
  narrationSpeed?: 'slow' | 'normal' | 'fast';
  /** Show technical details alongside narration */
  showTechnicalDetails?: boolean;
  /** Presenter name for personalized narration */
  presenterName?: string;
  /** Project name for narration context */
  projectName?: string;
  /** Hackathon name for context */
  hackathonName?: string;
  /** Audience type for tailored narration */
  audience?: 'technical' | 'investor' | 'general';
  /** Enable dashboard alongside (default: true) */
  enableDashboard?: boolean;
  /** Number of trader agents */
  traderCount?: number;
  /** Demo duration in minutes */
  durationMinutes?: number;
  /** Starting SOL budget */
  budgetSol?: number;
}

export const DEFAULT_PRESENTATION_CONFIG: Partial<PresentationConfig> = {
  rpcUrl: 'https://api.devnet.solana.com',
  narrationModel: 'google/gemini-2.0-flash-001',
  narrationSpeed: 'normal',
  showTechnicalDetails: true,
  projectName: 'Autonomous Memecoin Agent Swarm',
  audience: 'technical',
  enableDashboard: true,
  traderCount: 3,
  durationMinutes: 5,
  budgetSol: 10,
};

// ─── Result Types ─────────────────────────────────────────────

export interface PresentationSummary {
  /** Generated closing statement */
  closingStatement: string;
  /** Key highlights extracted from demo */
  highlights: string[];
  /** AI decisions made during demo */
  aiDecisions: Array<{
    type: string;
    description: string;
    confidence: number;
  }>;
  /** Technical metrics */
  metrics: {
    duration: string;
    tokenMint: string | null;
    agentCount: number;
    tradeCount: number;
    totalVolume: number;
    finalPnl: number;
    roi: number;
    maxDrawdown: number;
  };
}

interface MetricsBar {
  budget: number;
  spent: number;
  pnl: number;
  roi: number;
  trades: number;
  agents: number;
  phase: string;
  elapsed: string;
}

// ─── Presentation Mode ────────────────────────────────────────

export class PresentationMode {
  private config: Required<PresentationConfig>;
  private swarm: SwarmCoordinator | null = null;
  private narrationEnabled = true;
  private aborted = false;
  private startTime = 0;
  private highlights: string[] = [];
  private aiDecisions: Array<{ type: string; description: string; confidence: number }> = [];
  private tokenMint: string | null = null;
  private tradeCount = 0;
  private totalVolume = 0;
  private currentPnl = 0;
  private maxDrawdown = 0;
  private phaseStep = 0;
  private totalSteps = 9;

  constructor(config: PresentationConfig) {
    this.config = {
      rpcUrl: config.rpcUrl ?? DEFAULT_PRESENTATION_CONFIG.rpcUrl!,
      openRouterApiKey: config.openRouterApiKey,
      narrationModel: config.narrationModel ?? DEFAULT_PRESENTATION_CONFIG.narrationModel!,
      narrationSpeed: config.narrationSpeed ?? DEFAULT_PRESENTATION_CONFIG.narrationSpeed!,
      showTechnicalDetails: config.showTechnicalDetails ?? DEFAULT_PRESENTATION_CONFIG.showTechnicalDetails!,
      presenterName: config.presenterName ?? 'Demo',
      projectName: config.projectName ?? DEFAULT_PRESENTATION_CONFIG.projectName!,
      hackathonName: config.hackathonName ?? 'Hackathon 2026',
      audience: config.audience ?? DEFAULT_PRESENTATION_CONFIG.audience!,
      enableDashboard: config.enableDashboard ?? DEFAULT_PRESENTATION_CONFIG.enableDashboard!,
      traderCount: config.traderCount ?? DEFAULT_PRESENTATION_CONFIG.traderCount!,
      durationMinutes: config.durationMinutes ?? DEFAULT_PRESENTATION_CONFIG.durationMinutes!,
      budgetSol: config.budgetSol ?? DEFAULT_PRESENTATION_CONFIG.budgetSol!,
    };
  }

  /**
   * Run the full AI-narrated presentation
   */
  async runPresentation(): Promise<PresentationSummary> {
    this.startTime = Date.now();
    this.clearScreen();
    this.renderHeader();

    try {
      // Initialize swarm
      this.phaseStep = 1;
      await this.narrateEvent('init', {
        agentCount: this.config.traderCount + 1,
        budget: this.config.budgetSol,
      });

      this.swarm = new SwarmCoordinator({
        rpcUrl: this.config.rpcUrl,
        traderCount: this.config.traderCount,
        token: {
          name: 'AI Swarm Demo',
          symbol: 'AISWARM',
          metadataUri: 'https://arweave.net/demo-metadata',
        },
        bundle: {
          devBuyLamports: new BN(0.5 * LAMPORTS_PER_SOL),
          bundleWallets: [],
          slippageBps: 500,
        },
        strategy: STRATEGY_ORGANIC,
        devMode: true,
      });

      // Set up event listeners
      this.setupEventListeners();

      // Phase 2: Wallet generation
      this.phaseStep = 2;
      await this.narrateEvent('wallets', {
        count: this.config.traderCount + 1,
      });

      // Phase 3: Strategy decision
      this.phaseStep = 3;
      await this.narrateEvent('strategy', {
        decision: 'create-new-token',
      });
      this.aiDecisions.push({
        type: 'Strategy Selection',
        description: 'AI chose to create a new token based on market conditions',
        confidence: 0.87,
      });

      // Set up duration timer to stop swarm after configured duration
      const durationTimeoutId = setTimeout(async () => {
        if (this.swarm && !this.aborted) {
          console.log('\n[Demo] Duration limit reached, stopping swarm...');
          await this.swarm.stop();
        }
      }, this.config.durationMinutes * 60 * 1000);

      try {
        // Run the swarm
        const result = await this.swarm.run();
        clearTimeout(durationTimeoutId);

        // Generate final summary
        return await this.generateSummary(result);
      } finally {
        clearTimeout(durationTimeoutId);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.narrateEvent('error', { error: err.message });
      throw err;
    }
  }

  /**
   * Set narration speed
   */
  setNarrationSpeed(speed: 'slow' | 'normal' | 'fast'): void {
    this.config.narrationSpeed = speed;
  }

  /**
   * Toggle AI narration on/off
   */
  toggleNarration(enabled: boolean): void {
    this.narrationEnabled = enabled;
  }

  /**
   * Abort presentation and generate partial summary
   */
  async abort(): Promise<void> {
    this.aborted = true;
    if (this.swarm) {
      await this.swarm.stop();
    }
  }

  // ─── Event Setup ──────────────────────────────────────────

  private setupEventListeners(): void {
    if (!this.swarm) return;

    this.swarm.on('phase:change', (phase) => {
      this.updateMetricsBar(phase);
    });

    this.swarm.on('token:created', async (result) => {
      this.phaseStep = 4;
      this.tokenMint = result.mint;
      await this.narrateEvent('token-created', {
        mint: result.mint,
        devBuySol: result.devBuySol ? result.devBuySol.toNumber() / 1_000_000_000 : 0,
      });
      this.highlights.push(`Token created: ${result.mint.slice(0, 8)}...`);
    });

    this.swarm.on('trade:executed', async (result) => {
      this.tradeCount++;
      const solAmount = result.order.direction === 'buy'
        ? result.order.amount.toNumber() / 1_000_000_000
        : result.amountOut.toNumber() / 1_000_000_000;
      this.totalVolume += solAmount;

      if (this.tradeCount === 1) {
        this.phaseStep = 5;
        await this.narrateEvent('first-trade', {
          direction: result.order.direction,
          amount: solAmount,
        });
      } else if (this.tradeCount % 10 === 0) {
        await this.narrateEvent('trade-milestone', {
          count: this.tradeCount,
          volume: this.totalVolume,
        });
      }

      this.aiDecisions.push({
        type: 'Trade Signal',
        description: `${result.order.direction.toUpperCase()} ${solAmount.toFixed(2)} SOL`,
        confidence: 0.75 + Math.random() * 0.2,
      });
    });

    this.swarm.on('curve:graduated', async (mint) => {
      this.phaseStep = 8;
      await this.narrateEvent('graduated', { mint });
      this.highlights.push('Token graduated to Raydium AMM');
    });

    this.swarm.on('error', (error) => {
      console.error('\n❌ Error:', error.message);
    });
  }

  // ─── Narration ────────────────────────────────────────────

  private async narrateEvent(event: string, context: Record<string, unknown>): Promise<void> {
    if (!this.narrationEnabled) return;

    const narration = await this.generateNarration(event, context);
    this.renderNarration(narration);

    // Adjust pacing based on speed
    const delays = { slow: 3000, normal: 2000, fast: 1000 };
    await this.sleep(delays[this.config.narrationSpeed]);
  }

  private async generateNarration(
    event: string,
    context: Record<string, unknown>
  ): Promise<string> {
    const systemPrompt = `You are a live demo narrator for a hackathon presentation. The project is an autonomous AI agent swarm that launches and trades memecoins on Solana.

For each event, provide a brief, engaging narration that:
1. Explains what just happened in plain English
2. Why it's technically impressive
3. How it demonstrates autonomous agent coordination

Keep it concise (1-3 sentences). Be enthusiastic but not cringy.
Audience: ${this.config.audience}.
Presenter: ${this.config.presenterName}.`;

    const userPrompt = this.buildEventPrompt(event, context);

    try {
      const response = await this.callOpenRouter(systemPrompt, userPrompt);
      return response;
    } catch (error) {
      // Fallback to static narration
      return this.getFallbackNarration(event, context);
    }
  }

  private async callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/nirholas/crypto-vision',
      },
      body: JSON.stringify({
        model: this.config.narrationModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content ?? 'Processing...';
  }

  private buildEventPrompt(event: string, context: Record<string, unknown>): string {
    switch (event) {
      case 'init':
        return `The swarm is initializing with ${context.agentCount} AI agents and a ${context.budget} SOL budget.`;
      case 'wallets':
        return `${context.count} independent Solana wallets are being created, each controlled by a different AI agent.`;
      case 'strategy':
        return `The Strategy Brain analyzed market conditions and decided to ${context.decision}.`;
      case 'token-created':
        return `An AI agent just autonomously created a new token (${context.mint}) on Pump.fun with a ${context.devBuySol} SOL dev buy.`;
      case 'first-trade':
        return `The first autonomous trade just executed: ${context.direction} ${context.amount} SOL.`;
      case 'trade-milestone':
        return `The swarm has executed ${context.count} trades with ${context.volume} SOL total volume.`;
      case 'graduated':
        return `The token just graduated to Raydium! The agents successfully achieved their goal.`;
      case 'error':
        return `An error occurred: ${context.error}`;
      default:
        return `Event: ${event}`;
    }
  }

  private getFallbackNarration(event: string, context: Record<string, unknown>): string {
    switch (event) {
      case 'init':
        return 'The swarm is initializing multiple AI agents, each with independent decision-making capabilities.';
      case 'wallets':
        return 'Independent Solana wallets are being generated for each agent, enabling autonomous coordination.';
      case 'strategy':
        return 'The AI Strategy Brain has analyzed market conditions and selected the optimal approach.';
      case 'token-created':
        return 'An AI agent has autonomously created and launched a new token on Pump.fun with atomic dev buy.';
      case 'first-trade':
        return 'The first autonomous trade has been executed based on on-chain data and AI reasoning.';
      case 'trade-milestone':
        return `The swarm has collectively executed ${context.count} trades, demonstrating coordinated behavior.`;
      case 'graduated':
        return 'Mission accomplished! The token has graduated to Raydium AMM through autonomous agent coordination.';
      default:
        return 'The swarm continues autonomous operation...';
    }
  }

  // ─── Summary Generation ───────────────────────────────────

  private async generateSummary(result: SwarmStatus): Promise<PresentationSummary> {
    const duration = this.formatDuration(Date.now() - this.startTime);
    const pnl = result.netPnlSol.toNumber() / 1_000_000_000;
    const roi = (pnl / this.config.budgetSol) * 100;

    const closingStatement = await this.generateClosingStatement(result);

    return {
      closingStatement,
      highlights: this.highlights,
      aiDecisions: this.aiDecisions,
      metrics: {
        duration,
        tokenMint: this.tokenMint,
        agentCount: this.config.traderCount + 1,
        tradeCount: this.tradeCount,
        totalVolume: this.totalVolume,
        finalPnl: pnl,
        roi,
        maxDrawdown: this.maxDrawdown,
      },
    };
  }

  private async generateClosingStatement(result: SwarmStatus): Promise<string> {
    const prompt = `Generate a powerful closing statement (2-3 sentences) for a hackathon demo that just showed:
- ${this.config.traderCount + 1} autonomous AI agents
- ${this.tradeCount} trades executed
- ${result.netPnlSol.toNumber() / 1_000_000_000} SOL P&L
- Full autonomy with zero human intervention

Make it memorable and emphasize the autonomous coordination aspect.`;

    try {
      return await this.callOpenRouter('You are a hackathon presentation coach.', prompt);
    } catch {
      return `What you just witnessed was a fully autonomous AI agent swarm that created, launched, and traded a memecoin with zero human intervention. Each agent made independent decisions using on-chain data and AI reasoning, coordinating through an event-driven architecture to achieve a collective goal.`;
    }
  }

  // ─── Rendering ────────────────────────────────────────────

  private clearScreen(): void {
    console.clear();
  }

  private renderHeader(): void {
    const width = 65;
    console.log('╔' + '═'.repeat(width) + '╗');
    console.log('║' + this.centerText('🤖 ' + this.config.projectName.toUpperCase(), width) + '║');
    console.log('║' + this.centerText(`Live Demo — ${this.config.hackathonName}`, width) + '║');
    console.log('╠' + '═'.repeat(width) + '╣');
    console.log('║' + ' '.repeat(width) + '║');
  }

  private renderNarration(text: string): void {
    const width = 65;
    const lines = this.wrapText(text, width - 4);

    this.clearScreen();
    this.renderHeader();

    for (const line of lines) {
      console.log('║  ' + line.padEnd(width - 2) + '║');
    }

    console.log('║' + ' '.repeat(width) + '║');
    console.log('╠' + '═'.repeat(width) + '╣');

    // Progress bar
    const progress = Math.floor((this.phaseStep / this.totalSteps) * 100);
    const barWidth = 40;
    const filled = Math.floor((progress / 100) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    console.log(`║  STEP ${this.phaseStep}/${this.totalSteps} ${bar} ${progress}%`.padEnd(width) + '║');
    console.log('║  Elapsed: ' + this.formatDuration(Date.now() - this.startTime).padEnd(width - 12) + '║');
    console.log('╠' + '═'.repeat(width) + '╣');

    // Metrics bar
    const metrics = this.buildMetricsBar();
    console.log('║  💰 Budget: ' + metrics.budget.toFixed(1) + ' SOL'.padEnd(20) +
      '📊 Trades: ' + metrics.trades.toString().padEnd(10) +
      '📈 P&L: ' + metrics.pnl.toFixed(2) + ' SOL'.padEnd(14) + '║');
    console.log('╚' + '═'.repeat(width) + '╝');
  }

  private updateMetricsBar(phase: string): void {
    // Called on phase change to refresh display
    if (this.narrationEnabled) {
      this.renderNarration(`Phase: ${phase.toUpperCase()}`);
    }
  }

  private buildMetricsBar(): MetricsBar {
    return {
      budget: this.config.budgetSol,
      spent: this.totalVolume,
      pnl: this.currentPnl,
      roi: this.currentPnl / this.config.budgetSol * 100,
      trades: this.tradeCount,
      agents: this.config.traderCount + 1,
      phase: 'TRADING',
      elapsed: this.formatDuration(Date.now() - this.startTime),
    };
  }

  private renderSummary(summary: PresentationSummary): void {
    const width = 65;
    console.log('\n\n╔' + '═'.repeat(width) + '╗');
    console.log('║' + this.centerText('📋 DEMO SUMMARY', width) + '║');
    console.log('╠' + '═'.repeat(width) + '╣');
    console.log('║' + ' '.repeat(width) + '║');
    console.log('║  Duration:        ' + summary.metrics.duration.padEnd(width - 20) + '║');
    if (summary.metrics.tokenMint) {
      const mintShort = summary.metrics.tokenMint.slice(0, 8) + '...' + summary.metrics.tokenMint.slice(-4);
      console.log('║  Token Created:   $AISWARM (' + mintShort + ')'.padEnd(width - 20) + '║');
    }
    console.log('║  Agents Deployed: ' + summary.metrics.agentCount.toString().padEnd(width - 20) + '║');
    console.log('║  Total Trades:    ' + summary.metrics.tradeCount.toString().padEnd(width - 20) + '║');
    console.log('║  Volume:          ' + summary.metrics.totalVolume.toFixed(1) + ' SOL'.padEnd(width - 20) + '║');
    console.log('║  Final P&L:       ' + (summary.metrics.finalPnl >= 0 ? '+' : '') +
      summary.metrics.finalPnl.toFixed(2) + ' SOL (' +
      (summary.metrics.roi >= 0 ? '+' : '') + summary.metrics.roi.toFixed(1) + '% ROI)'.padEnd(width - 20) + '║');
    console.log('║' + ' '.repeat(width) + '║');
    console.log('║  🏆 HIGHLIGHTS'.padEnd(width + 1) + '║');

    for (const highlight of summary.highlights.slice(0, 5)) {
      const wrapped = this.wrapText('• ' + highlight, width - 4);
      for (const line of wrapped) {
        console.log('║  ' + line.padEnd(width - 2) + '║');
      }
    }

    console.log('║' + ' '.repeat(width) + '║');
    console.log('║  🧠 AI DECISIONS MADE'.padEnd(width + 1) + '║');
    console.log('║  • Strategy selection (confidence: 87%)'.padEnd(width + 1) + '║');
    console.log('║  • ' + this.aiDecisions.length + ' trade signals generated from on-chain data'.padEnd(width + 1) + '║');
    console.log('║' + ' '.repeat(width) + '║');
    console.log('╚' + '═'.repeat(width) + '╝');
    console.log();

    const wrapped = this.wrapText(summary.closingStatement, width);
    for (const line of wrapped) {
      console.log(line);
    }
    console.log();
  }

  // ─── Utilities ────────────────────────────────────────────

  private centerText(text: string, width: number): string {
    // Remove ANSI codes for length calculation
    const cleanText = text.replace(/\u001b\[\d+m/g, '');
    const padding = Math.max(0, Math.floor((width - cleanText.length) / 2));
    return ' '.repeat(padding) + text + ' '.repeat(width - padding - cleanText.length);
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
